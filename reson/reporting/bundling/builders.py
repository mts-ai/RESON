"""Builder classes for reporting payload and HTML generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from reson.core.analysis.errors import ErrorAnalyzer
from reson.core.analysis.run import RESONRun
from reson.reporting.common.context import build_report_context
from reson.reporting.common.shared import inline_build_to_single_html, run_vite_build


@dataclass
class RunContextBundle:
    """Container with prepared context and reusable analyzers."""

    context: Dict[str, Any]
    error_analyzer: Optional[ErrorAnalyzer]


class RunContextAssembler:
    """Assemble reusable context for report payload builders."""

    def assemble(self, reson_run: RESONRun) -> RunContextBundle:
        try:
            error_analyzer = ErrorAnalyzer(reson_run.manifest)
        except Exception:
            error_analyzer = None
        context = build_report_context(reson_run, error_analyzer=error_analyzer)
        return RunContextBundle(context=context, error_analyzer=error_analyzer)


class SinglePayloadBuilder:
    """Build payload for single interactive report."""

    def __init__(self, context_assembler: Optional[RunContextAssembler] = None) -> None:
        self.context_assembler = context_assembler or RunContextAssembler()

    def build(self, reson_run: RESONRun, bundle: Optional[RunContextBundle] = None) -> Dict[str, Any]:
        from reson.reporting.single.payload import build_single_report_payload

        context_bundle = bundle or self.context_assembler.assemble(reson_run)
        return build_single_report_payload(
            reson_run,
            base_ctx=context_bundle.context,
            error_analyzer=context_bundle.error_analyzer,
        )


class LeaderboardPayloadBuilder:
    """Build minimal payload for standalone leaderboard report."""

    def build(
        self,
        reson_runs: List[RESONRun],
        model_names: List[str],
        model_display_names: Optional[List[str]] = None,
        dataset_name: str = "Dataset",
    ) -> Dict[str, Any]:
        from reson.reporting.leaderboard.payload import build_leaderboard_report_payload

        return build_leaderboard_report_payload(
            reson_runs=reson_runs,
            model_names=model_names,
            model_display_names=model_display_names,
            dataset_name=dataset_name,
        )


class ComparePayloadBuilder:
    """Build payload for comparison interactive report."""

    def build(
        self,
        reson_runs: List[RESONRun],
        model_names: List[str],
        model_display_names: Optional[List[str]] = None,
        dataset_name: str = "Dataset",
        dataset_description: str = "",
        base_model: Optional[str] = None,
        target_model: Optional[str] = None,
        additional_pairs: Optional[List[Tuple[str, str]]] = None,
        significance_pairs: Optional[List[Tuple[str, str]]] = None,
        num_bootstraps: int = 2000,
        alpha: float = 0.05,
    ) -> Dict[str, Any]:
        from reson.reporting.compare.payload import build_compare_report_payload

        return build_compare_report_payload(
            reson_runs=reson_runs,
            model_names=model_names,
            model_display_names=model_display_names,
            dataset_name=dataset_name,
            dataset_description=dataset_description,
            base_model=base_model,
            target_model=target_model,
            additional_pairs=additional_pairs,
            significance_pairs=significance_pairs,
            num_bootstraps=num_bootstraps,
            alpha=alpha,
        )


class HtmlReportBundler:
    """Build and inline Vite-based report into one HTML file."""

    def build_project(self, project_dir: str) -> str:
        return run_vite_build(project_dir)

    def inline_payload(
        self,
        build_dir: str,
        data_payload: Dict[str, Any],
        output_html: str,
        data_global_name: str,
    ) -> str:
        return inline_build_to_single_html(
            build_dir=build_dir,
            data_payload=data_payload,
            output_html=output_html,
            data_global_name=data_global_name,
        )
