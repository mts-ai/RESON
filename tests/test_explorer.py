"""Unit tests for :class:`reson.explorer.RESON`."""

from __future__ import annotations

from pathlib import Path

import pytest

from reson import RESON, Manifest
from reson.core.analysis.compare import RESONComparison
from reson.core.analysis.run import RESONRun


class _BadProvider:
    metrics = ("WER",)


class TestRESONInitialization:
    def test_default_provider_and_repr(self):
        reson = RESON(name="test-run", metrics=("WER", "CER"), meta={"team": "qa"})
        assert "JiwerMetricProvider" in repr(reson)
        assert reson.meta == {"team": "qa"}

    def test_rejects_invalid_provider(self):
        with pytest.raises(TypeError, match="metric_provider must implement"):
            RESON(metric_provider=_BadProvider())


class TestRESONAnalyze:
    def test_analyze_from_manifest(self, manifest, tmp_path: Path):
        reson = RESON(name="single", metrics=("WER",))
        out_dir = tmp_path / "artifacts"
        run = reson.analyze(manifest, artifacts_dir=str(out_dir), run_name="custom-name")

        assert run.name == "custom-name"
        assert not run.metrics.empty
        assert "WER" in run.metrics.index.astype(str)
        assert reson.last_run is run
        assert reson.last_run_context.run_name == "custom-name"
        assert reson.last_run_context.provider_name == "JiwerMetricProvider"
        assert reson.analyzer.manifest.equals(run.manifest)

    def test_analyze_accepts_record_list(self, sample_records):
        reson = RESON(metrics=("WER",))
        run = reson.analyze(sample_records, run_name="from-list")
        assert run.name == "from-list"
        assert len(run.manifest) == len(sample_records)

    def test_analyze_invalid_manifest_type_raises(self):
        reson = RESON()
        with pytest.raises(TypeError, match="manifest must be either"):
            reson.analyze({"not": "a manifest"})

    def test_last_run_properties_require_analyze(self):
        reson = RESON()
        with pytest.raises(RuntimeError, match="Call analyze\\(\\) first"):
            _ = reson.last_run
        with pytest.raises(RuntimeError, match="Call analyze\\(\\) first"):
            _ = reson.last_run_context
        with pytest.raises(RuntimeError, match="Call analyze\\(\\) first"):
            _ = reson.analyzer


class TestRESONAnalyzeMany:
    def test_analyze_many_empty(self):
        assert RESON().analyze_many([]) == []

    def test_analyze_many_with_names(self, sample_records, tmp_path: Path):
        reson = RESON(name="batch", metrics=("WER",))
        root = tmp_path / "runs"
        manifests = [sample_records, sample_records]
        runs = reson.analyze_many(
            manifests,
            names=["first", "second"],
            artifacts_root_dir=str(root),
        )

        assert len(runs) == 2
        assert [run.name for run in runs] == ["first", "second"]
        assert runs[-1] is reson.last_run
        assert (root / "first").is_dir()
        assert (root / "second").is_dir()

    def test_analyze_many_names_length_mismatch(self, sample_records):
        reson = RESON(metrics=("WER",))
        with pytest.raises(ValueError, match="names length must match"):
            reson.analyze_many([sample_records], names=["only-one", "two"])


class TestRESONCompare:
    def test_compare_returns_aris_comparison(self, candidate_run, baseline_run):
        _, candidate = candidate_run
        _, baseline = baseline_run
        reson = RESON()
        comparison = reson.compare(baseline, candidate)

        assert isinstance(comparison, RESONComparison)
        assert comparison.baseline == baseline.name
        assert comparison.rc == candidate.name
        assert comparison.matched_rows > 0


class TestRESONArtifactTracking:
    def test_collect_new_or_modified_artifacts(self, tmp_path: Path):
        root = tmp_path / "artifacts"
        root.mkdir()
        before = RESON._snapshot_artifacts(root)
        new_file = root / "report.html"
        new_file.write_text("<html></html>", encoding="utf-8")

        changed = RESON._collect_new_or_modified_artifacts(root, before)
        assert "report.html" in changed
        assert changed["report.html"] == str(new_file.resolve())


class TestRESONReportLast:
    def test_report_last_delegates_to_run(self, manifest, tmp_path: Path, monkeypatch):
        reson = RESON(metrics=("WER",))
        reson.analyze(manifest, run_name="report-test")

        called = {}

        def _fake_report(self, output_html, *, force_rebuild=False):
            called["run_name"] = self.name
            called["output_html"] = output_html
            called["force_rebuild"] = force_rebuild
            Path(output_html).write_text("<html></html>", encoding="utf-8")
            return output_html

        monkeypatch.setattr(RESONRun, "report", _fake_report)
        out = tmp_path / "last.html"
        result = reson.report_last(str(out), force_rebuild=True)

        assert result == str(out)
        assert called["run_name"] == "report-test"
        assert called["force_rebuild"] is True

    def test_report_last_requires_analyze(self):
        with pytest.raises(RuntimeError, match="Call analyze\\(\\) first"):
            RESON().report_last("missing.html")


class TestRESONCompareReport:
    def test_compare_report_delegates_to_rendering(
        self,
        candidate_run,
        baseline_run,
        tmp_path: Path,
        monkeypatch,
    ):
        _, candidate = candidate_run
        _, baseline = baseline_run
        called = {}

        def _fake_render(**kwargs):
            called.update(kwargs)
            out = Path(kwargs["output_html"])
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text("<html></html>", encoding="utf-8")
            return str(out.resolve())

        monkeypatch.setattr("reson.reporting.render_compare_report_html", _fake_render)
        reson = RESON()
        out = tmp_path / "compare.html"
        result = reson.compare_report(
            [candidate, baseline],
            model_names=["candidate", "baseline"],
            output_html=str(out),
            dataset_name="Tutorial",
            dataset_description="desc",
            base_model="baseline",
            target_model="candidate",
            additional_pairs=[("baseline", "candidate")],
            significance_pairs=[("baseline", "candidate")],
            num_bootstraps=500,
            alpha=0.01,
        )

        assert result == str(out.resolve())
        assert called["reson_runs"] == [candidate, baseline]
        assert called["model_names"] == ["candidate", "baseline"]
        assert called["base_model"] == "baseline"
        assert called["target_model"] == "candidate"
        assert called["dataset_name"] == "Tutorial"
        assert called["num_bootstraps"] == 500
        assert called["alpha"] == 0.01

    def test_compare_report_defaults_base_and_target(self, candidate_run, baseline_run, monkeypatch):
        _, candidate = candidate_run
        _, baseline = baseline_run
        called = {}

        def _fake_render(**kwargs):
            called.update(kwargs)
            return "/tmp/compare.html"

        monkeypatch.setattr("reson.reporting.render_compare_report_html", _fake_render)
        RESON().compare_report([candidate, baseline], model_names=["alpha", "beta"])
        assert called["base_model"] == "alpha"
        assert called["target_model"] == "beta"

    def test_compare_report_requires_two_runs(self, candidate_run):
        _, candidate = candidate_run
        with pytest.raises(ValueError, match="at least two runs"):
            RESON().compare_report([candidate])

    def test_compare_report_model_names_length_mismatch(self, candidate_run, baseline_run):
        _, candidate = candidate_run
        _, baseline = baseline_run
        with pytest.raises(ValueError, match="model_names length must match"):
            RESON().compare_report([candidate, baseline], model_names=["only-one"])

    @pytest.mark.frontend
    def test_compare_report_writes_html(self, candidate_run, baseline_run, tmp_path, frontend_built):
        if not frontend_built:
            pytest.skip("frontend build/ artifacts are required")

        _, candidate = candidate_run
        _, baseline = baseline_run
        out = tmp_path / "compare_api.html"
        result = RESON().compare_report(
            [candidate, baseline],
            model_names=["candidate", "baseline"],
            output_html=str(out),
            base_model="baseline",
            target_model="candidate",
        )
        html = Path(result).read_text(encoding="utf-8")
        assert "window.RESON_DATA" in html
        assert '"vocabularyData"' in html


class TestRESONLeaderboardReport:
    def test_leaderboard_report_delegates_to_rendering(
        self,
        candidate_run,
        baseline_run,
        tmp_path: Path,
        monkeypatch,
    ):
        _, candidate = candidate_run
        _, baseline = baseline_run
        called = {}

        def _fake_render(**kwargs):
            called.update(kwargs)
            out = Path(kwargs["output_html"])
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text("<html></html>", encoding="utf-8")
            return str(out.resolve())

        monkeypatch.setattr("reson.reporting.render_leaderboard_report_html", _fake_render)
        out = tmp_path / "leaderboard.html"
        result = RESON().leaderboard_report(
            [candidate, baseline],
            model_names=["candidate", "baseline"],
            model_display_names=["Candidate", "Baseline"],
            output_html=str(out),
            dataset_name="Tutorial set",
        )

        assert result == str(out.resolve())
        assert called["reson_runs"] == [candidate, baseline]
        assert called["model_names"] == ["candidate", "baseline"]
        assert called["model_display_names"] == ["Candidate", "Baseline"]
        assert called["dataset_name"] == "Tutorial set"

    def test_leaderboard_report_requires_two_runs(self, candidate_run):
        _, candidate = candidate_run
        with pytest.raises(ValueError, match="at least two runs"):
            RESON().leaderboard_report([candidate])

    def test_leaderboard_report_model_names_length_mismatch(self, candidate_run, baseline_run):
        _, candidate = candidate_run
        _, baseline = baseline_run
        with pytest.raises(ValueError, match="model_names length must match"):
            RESON().leaderboard_report([candidate, baseline], model_names=["one"])

    @pytest.mark.frontend
    def test_leaderboard_report_writes_html(self, candidate_run, baseline_run, tmp_path, frontend_built):
        if not frontend_built:
            pytest.skip("frontend build/ artifacts are required")

        _, candidate = candidate_run
        _, baseline = baseline_run
        out = tmp_path / "leaderboard_api.html"
        result = RESON().leaderboard_report(
            [candidate, baseline],
            model_names=["candidate", "baseline"],
            output_html=str(out),
            dataset_name="Tutorial",
        )
        html = Path(result).read_text(encoding="utf-8")
        assert "window.RESON_DATA" in html
        assert '"overviewData"' in html
        assert '"vocabularyData"' not in html
