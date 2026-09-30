from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any

from reson.core import Manifest
from reson.core.metrics.provider import MetricProviderABC, JiwerMetricProvider
from reson.core.analysis.run import RESONRun
from reson.core.analysis.compare import RESONComparison, compare_runs
from reson.core.analysis.errors import ErrorAnalyzer


@dataclass(frozen=True)
class RESONRunContext:
    """Runtime metadata captured for the latest analyze() invocation."""

    run_name: str
    provider_name: str
    metrics: Tuple[str, ...]
    artifacts_dir: Optional[str]
    started_at: str
    finished_at: str


class RESON:

    def __init__(
        self,
        name: str = "RESON Default Run",
        metrics: Optional[Tuple[str, ...]] = None,
        metric_provider: MetricProviderABC | None = None,
        meta: Optional[Dict[str, Any]] = None,
    ):
        self.name = name
        self.metric_provider = metric_provider or JiwerMetricProvider()

        if not isinstance(self.metric_provider, MetricProviderABC):
            raise TypeError("metric_provider must implement MetricProviderABC")

        if metrics is not None:
            try:
                self.metric_provider.metrics = tuple(metrics)
            except Exception:
                pass
        self.meta = meta if meta is not None else {}

        # last run cache
        self._last_run: RESONRun | None = None
        self._last_run_context: RESONRunContext | None = None
        self._last_analyzer: ErrorAnalyzer | None = None

    def __repr__(self) -> str:
        return f"RESON(name={self.name}, metric_provider={type(self.metric_provider).__name__}, metrics={self.metric_provider.metrics}, meta={self.meta})"

    @staticmethod
    def _ensure_manifest(manifest: List[Dict[str, Any]] | Manifest) -> Manifest:
        if isinstance(manifest, Manifest):
            return manifest
        if isinstance(manifest, list):
            return Manifest(manifest)
        raise TypeError("manifest must be either Manifest or list[dict]")

    @staticmethod
    def _snapshot_artifacts(directory: Path) -> Dict[str, float]:
        if not directory.exists():
            return {}
        snapshots: Dict[str, float] = {}
        for fp in directory.rglob("*"):
            if fp.is_file():
                rel = str(fp.relative_to(directory))
                snapshots[rel] = fp.stat().st_mtime
        return snapshots

    @staticmethod
    def _collect_new_or_modified_artifacts(
        directory: Path,
        before: Dict[str, float],
    ) -> Dict[str, str]:
        if not directory.exists():
            return {}
        after = RESON._snapshot_artifacts(directory)
        changed: Dict[str, str] = {}
        for rel, mtime in after.items():
            if rel not in before or mtime > before[rel]:
                changed[rel] = str((directory / rel).resolve())
        # Fallback for providers that rewrite files with unchanged mtime resolution.
        if not changed and after:
            changed = {rel: str((directory / rel).resolve()) for rel in sorted(after.keys())}
        return changed

    def analyze(
        self,
        manifest: List[Dict[str, Any]] | Manifest,
        artifacts_dir: str | None = None,
        *,
        run_name: Optional[str] = None,
    ) -> RESONRun:
        """Analyze a single run and return RESONRun container."""
        run_display_name = run_name or self.name
        started_at = datetime.now().isoformat(timespec="seconds")
        manifest_obj = self._ensure_manifest(manifest)

        artifacts_path = Path(artifacts_dir).expanduser().resolve() if artifacts_dir is not None else None
        before_artifacts: Dict[str, float] = {}
        if artifacts_path is not None:
            artifacts_path.mkdir(parents=True, exist_ok=True)
            before_artifacts = self._snapshot_artifacts(artifacts_path)

        previous_artifacts_dir = getattr(self.metric_provider, "artifacts_dir", None)
        if artifacts_path is not None:
            self.metric_provider.artifacts_dir = str(artifacts_path)
        try:
            # evaluate metrics
            df, summary_metrics = self.metric_provider.evaluate(manifest_obj)
            # postprocess via provider (adds duration_type, computes vocab metrics)
            df, vocab = self.metric_provider.postprocess(df, vocab_df=manifest_obj.vocab.data)
            from reson.core.analysis.vocab_scoring import enrich_vocab

            vocab = enrich_vocab(vocab, df, manifest_obj.replacements)
        finally:
            # Keep provider stateless between runs.
            if artifacts_path is not None:
                self.metric_provider.artifacts_dir = previous_artifacts_dir

        artifacts = (
            self._collect_new_or_modified_artifacts(artifacts_path, before_artifacts)
            if artifacts_path is not None
            else {}
        )

        run = RESONRun(
            name=run_display_name,
            summary=manifest_obj.summary,
            alphabet=manifest_obj.alphabet,
            replacements=manifest_obj.replacements,
            vocab=vocab,
            metrics=summary_metrics,
            manifest=df,
            artifacts=artifacts,
            config={
                "normalized": manifest_obj.normalized,
                "normalize_cfg": manifest_obj.normalized_cfg,
                "metric_provider": type(self.metric_provider).__name__,
            },
            meta=dict(self.meta),
        )
        self._last_run = run
        self._last_analyzer = ErrorAnalyzer(run.manifest)
        self._last_run_context = RESONRunContext(
            run_name=run_display_name,
            provider_name=type(self.metric_provider).__name__,
            metrics=tuple(getattr(self.metric_provider, "metrics", ()) or ()),
            artifacts_dir=str(artifacts_path) if artifacts_path is not None else None,
            started_at=started_at,
            finished_at=datetime.now().isoformat(timespec="seconds"),
        )
        return run

    def analyze_many(
        self,
        manifests: List[List[Dict[str, Any]] | Manifest],
        *,
        names: Optional[List[str]] = None,
        artifacts_root_dir: Optional[str] = None,
    ) -> List[RESONRun]:
        """Analyze multiple manifests and return runs in input order."""
        if not manifests:
            return []
        if names is not None and len(names) != len(manifests):
            raise ValueError("names length must match manifests length")

        root = Path(artifacts_root_dir).expanduser().resolve() if artifacts_root_dir else None
        if root is not None:
            root.mkdir(parents=True, exist_ok=True)

        runs: List[RESONRun] = []
        for idx, item in enumerate(manifests):
            current_name = names[idx] if names is not None else f"{self.name}-{idx + 1}"
            artifacts_dir = str((root / current_name)) if root is not None else None
            runs.append(self.analyze(item, artifacts_dir=artifacts_dir, run_name=current_name))
        return runs

    def compare(
        self,
        baseline: RESONRun,
        candidate: RESONRun,
        *,
        on: str = "audio_filepath",
    ) -> RESONComparison:
        """Compare two runs via core RESONComparison entity."""
        return compare_runs(baseline, candidate, on=on)

    def report_last(self, output_html: str = "single_report.html", *, force_rebuild: bool = False) -> str:
        """Generate single-model HTML report for the latest run."""
        if self._last_run is None:
            raise RuntimeError("No run available. Call analyze() first.")
        return self._last_run.report(output_html=output_html, force_rebuild=force_rebuild)

    def compare_report(
        self,
        runs: List[RESONRun],
        *,
        model_names: Optional[List[str]] = None,
        output_html: str = "model_compare_report.html",
        dataset_name: Optional[str] = None,
        dataset_description: str = "",
        base_model: Optional[str] = None,
        target_model: Optional[str] = None,
        additional_pairs: Optional[List[Tuple[str, str]]] = None,
        significance_pairs: Optional[List[Tuple[str, str]]] = None,
        num_bootstraps: int = 2000,
        alpha: float = 0.05,
    ) -> str:
        """Generate compare HTML report for multiple RESONRun objects."""
        from reson.reporting import render_compare_report_html

        if len(runs) < 2:
            raise ValueError("compare_report requires at least two runs")
        names = model_names or [run.name for run in runs]
        if len(names) != len(runs):
            raise ValueError("model_names length must match runs length")

        resolved_base = base_model if base_model is not None else names[0]
        resolved_target = target_model if target_model is not None else names[1]
        return render_compare_report_html(
            reson_runs=runs,
            model_names=names,
            output_html=output_html,
            dataset_name=dataset_name,
            dataset_description=dataset_description,
            base_model=resolved_base,
            target_model=resolved_target,
            additional_pairs=additional_pairs,
            significance_pairs=significance_pairs,
            num_bootstraps=num_bootstraps,
            alpha=alpha,
        )

    def leaderboard_report(
        self,
        runs: List[RESONRun],
        *,
        model_names: Optional[List[str]] = None,
        model_display_names: Optional[List[str]] = None,
        output_html: str = "leaderboard_report.html",
        dataset_name: Optional[str] = None,
    ) -> str:
        """Generate standalone leaderboard HTML for multiple RESONRun objects."""
        from reson.reporting import render_leaderboard_report_html

        if len(runs) < 2:
            raise ValueError("leaderboard_report requires at least two runs")
        names = model_names or [run.name for run in runs]
        if len(names) != len(runs):
            raise ValueError("model_names length must match runs length")

        return render_leaderboard_report_html(
            reson_runs=runs,
            model_names=names,
            model_display_names=model_display_names,
            output_html=output_html,
            dataset_name=dataset_name,
        )

    @property
    def last_run(self) -> RESONRun:
        if self._last_run is None:
            raise RuntimeError("No run available. Call analyze() first.")
        return self._last_run

    @property
    def last_run_context(self) -> RESONRunContext:
        if self._last_run_context is None:
            raise RuntimeError("No run context available. Call analyze() first.")
        return self._last_run_context

    @property
    def analyzer(self) -> ErrorAnalyzer:
        if self._last_run is None:
            raise RuntimeError("No run available. Call analyze() first.")
        if self._last_analyzer is None:
            self._last_analyzer = ErrorAnalyzer(self._last_run.manifest)
        return self._last_analyzer
