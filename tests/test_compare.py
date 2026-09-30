"""Unit tests for :mod:`reson.core.analysis.compare`."""

from __future__ import annotations

import pandas as pd
import pytest

from reson.core.analysis.compare import RESONComparison, compare_runs


class TestCompareRuns:
    def test_compare_runs_basic_shapes(self, candidate_run, baseline_run):
        _, candidate = candidate_run
        _, baseline = baseline_run

        comparison = compare_runs(baseline, candidate)

        assert comparison.baseline == baseline.name
        assert comparison.rc == candidate.name
        assert comparison.matched_rows == len(candidate.manifest)
        assert not comparison.metrics_delta.empty
        assert "name" in comparison.metrics_delta.columns
        assert {"baseline", "rc", "diff_abs"}.issubset(comparison.metrics_delta.columns)
        assert not comparison.per_file_delta.empty
        assert "audio_filepath" in comparison.per_file_delta.columns
        assert not comparison.merged_vocab.empty
        assert "word" in comparison.merged_vocab.columns

    def test_compare_runs_metrics_delta_contains_wer(self, candidate_run, baseline_run):
        _, candidate = candidate_run
        _, baseline = baseline_run
        comparison = compare_runs(baseline, candidate)
        metric_names = set(comparison.metrics_delta["name"].astype(str))
        assert "WER" in metric_names

    def test_compare_runs_word_ops_stats_structure(self, candidate_run, baseline_run):
        _, candidate = candidate_run
        _, baseline = baseline_run
        comparison = compare_runs(baseline, candidate)

        assert comparison.word_ops_stats
        first_word = next(iter(comparison.word_ops_stats))
        baseline_ops = comparison.word_ops_stats[first_word]["baseline"]
        rc_ops = comparison.word_ops_stats[first_word]["rc"]
        assert {"ins", "del", "sub", "sub_as_dst"}.issubset(baseline_ops)
        assert {"ins", "del", "sub", "sub_as_dst"}.issubset(rc_ops)

    def test_compare_runs_empty_join_when_key_missing(self, candidate_run):
        _, candidate = candidate_run
        baseline = candidate
        comparison = compare_runs(baseline, candidate, on="missing_key")
        assert comparison.per_file_delta.empty


class TestRESONComparison:
    def test_corpus_wer_computes_percentage(self):
        df = pd.DataFrame(
            {
                "text_rc": ["one two three four", "five six seven eight"],
                "INS_rc": [1, 0],
                "DEL_rc": [0, 1],
                "SUB_rc": [0, 0],
                "INS_baseline": [0, 0],
                "DEL_baseline": [0, 0],
                "SUB_baseline": [0, 0],
            }
        )
        rc_wer = RESONComparison.corpus_wer(df, "_rc")
        assert rc_wer == pytest.approx(25.0)

    def test_compute_significance_returns_expected_keys(self, candidate_run, baseline_run):
        comparison = compare_runs(baseline_run[1], candidate_run[1])
        result = comparison.compute_significance(num_bootstraps=200, seed=0)

        assert set(result) == {
            "num_bootstraps",
            "ci95",
            "p_one_sided",
            "p_two_sided",
            "alpha",
            "stratified_by",
        }
        assert result["num_bootstraps"] == 200
        assert isinstance(result["ci95"], tuple)
        assert len(result["ci95"]) == 2

    def test_compute_significance_is_reproducible(self, candidate_run, baseline_run):
        comparison = compare_runs(baseline_run[1], candidate_run[1])
        first = comparison.compute_significance(num_bootstraps=100, seed=42)
        second = comparison.compute_significance(num_bootstraps=100, seed=42)
        assert first["ci95"] == second["ci95"]
        assert first["p_one_sided"] == second["p_one_sided"]

    def test_compute_significance_empty_delta(self):
        comparison = RESONComparison(
            baseline="a",
            rc="b",
            metrics_delta=pd.DataFrame(),
            per_file_delta=pd.DataFrame(),
            merged_vocab=pd.DataFrame(),
            by_slice={},
            artifacts={},
            word_ops_stats={},
        )
        result = comparison.compute_significance(num_bootstraps=10)
        assert result["ci95"] == (0.0, 0.0)
        assert result["p_one_sided"] == 1.0

    @pytest.mark.parametrize(
        "kwargs, match",
        [
            ({"num_bootstraps": 0}, "num_bootstraps"),
            ({"alpha": 0.0}, "alpha"),
            ({"alpha": 1.0}, "alpha"),
        ],
    )
    def test_compute_significance_invalid_params(self, candidate_run, baseline_run, kwargs, match):
        comparison = compare_runs(baseline_run[1], candidate_run[1])
        with pytest.raises(ValueError, match=match):
            comparison.compute_significance(**kwargs)

    def test_metrics_delta_records(self, candidate_run, baseline_run):
        comparison = compare_runs(baseline_run[1], candidate_run[1])
        records = comparison.metrics_delta_records()
        assert records
        assert "name" in records[0]
