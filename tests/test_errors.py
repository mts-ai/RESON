"""Unit tests for :mod:`reson.core.analysis.errors`."""

from __future__ import annotations

import pandas as pd
import pytest

from reson.core.analysis.errors import (
    ErrorAnalyzer,
    example_totals_from_buckets,
    ui_error_totals_from_ops,
    word_quality_metrics_for_word,
)


@pytest.fixture
def error_manifest_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "audio_filepath": "/tmp/a.wav",
                "duration": 1.0,
                "text": "hello world",
                "prediction": "hi world",
            },
            {
                "audio_filepath": "/tmp/b.wav",
                "duration": 2.0,
                "text": "foo bar",
                "prediction": "foo bar baz",
            },
            {
                "audio_filepath": "/tmp/c.wav",
                "duration": 3.0,
                "text": "alpha beta gamma",
                "prediction": "alpha gamma",
            },
        ]
    )


@pytest.fixture
def analyzer(error_manifest_df) -> ErrorAnalyzer:
    return ErrorAnalyzer(error_manifest_df)


class TestErrorAnalyzerReplacements:
    def test_word_replacements_counts_substitutions(self, analyzer):
        replacements = analyzer.word_replacements()
        assert replacements.get("hello") == [("hi", 1)]

    def test_word_replacements_as_dataframe(self, analyzer):
        df = analyzer.word_replacements(return_df=True)
        assert list(df.columns) == ["source_word", "replaced_with", "count"]
        hello_row = df.loc[df["source_word"] == "hello"]
        assert not hello_row.empty
        assert hello_row.iloc[0]["replaced_with"] == "hi"

    def test_word_replacement_examples_include_inline_diff(self, analyzer):
        examples = analyzer.word_replacement_examples(max_examples=1)
        key = "hello|||hi"
        assert key in examples
        example = examples[key][0]
        assert example["text"] == "hello world"
        assert example["prediction"] == "hi world"
        assert "diff_html" in example
        assert "diff_plain" in example
        assert "<span" in example["diff_html"]


class TestErrorAnalyzerOps:
    def test_word_ops_stats_counts_insert_delete_substitute(self, analyzer):
        stats = analyzer.word_ops_stats()
        assert stats["hello"]["sub"] >= 1
        assert stats["baz"]["ins"] >= 1
        assert stats["beta"]["del"] >= 1

    def test_word_ops_stats_include_sub_as_dst(self, analyzer):
        stats = analyzer.word_ops_stats(include_sub_as_dst=True)
        assert "sub_as_dst" in stats.get("hi", {})

    def test_word_ops_stats_as_dataframe(self, analyzer):
        df = analyzer.word_ops_stats(return_df=True)
        assert {"word", "ins", "del", "sub"}.issubset(df.columns)
        assert not df.empty

    def test_word_error_examples_structure(self, analyzer):
        examples = analyzer.word_error_examples()
        assert "beta" in examples
        assert "del" in examples["beta"]
        del_example = examples["beta"]["del"][0]
        assert del_example["count"] >= 1
        assert del_example["text"] == "alpha beta gamma"


class TestErrorAnalyzerQuality:
    def test_word_quality_metrics_for_perfect_word(self, analyzer):
        metrics = analyzer.word_quality_metrics({"world": 1})
        world = metrics["world"]
        assert world["recall"] == pytest.approx(100.0)
        assert world["precision"] == pytest.approx(100.0)
        assert world["f1_score"] == pytest.approx(100.0)

    def test_word_quality_metrics_for_substituted_word(self, analyzer):
        metrics = analyzer.word_quality_metrics({"hello": 1})
        hello = metrics["hello"]
        assert hello["recall"] < 100.0


class TestErrorHelperFunctions:
    def test_ui_error_totals_from_ops(self):
        totals = ui_error_totals_from_ops({"ins": 2, "del": 1, "sub": 3})
        assert totals == {"insertions": 2, "deletions": 1, "substitutions": 3}

    def test_example_totals_from_buckets(self):
        buckets = {
            "ins": [{"count": 2}, {"count": 1}],
            "del": [{"count": 1}],
            "sub": [],
        }
        totals = example_totals_from_buckets(buckets)
        assert totals == {"insertions": 3, "deletions": 1, "substitutions": 0}

    def test_word_quality_metrics_for_word(self):
        metrics = word_quality_metrics_for_word(
            "hello",
            ref_count=2,
            match_ref={"hello": 1},
            match_hyp={"hello": 1},
            word_ops={"hello": {"ins": 0, "del": 0, "sub": 1}},
        )
        assert metrics["recall"] == pytest.approx(50.0)
        assert metrics["precision"] == pytest.approx(100.0)


class TestErrorAnalyzerCache:
    def test_pipeline_cache_is_reused_per_mode(self, analyzer):
        first = analyzer.word_ops_stats(include_sub_as_dst=False)
        second = analyzer.word_ops_stats(include_sub_as_dst=False)
        assert first is second

        with_dst = analyzer.word_ops_stats(include_sub_as_dst=True)
        assert with_dst is analyzer.word_ops_stats(include_sub_as_dst=True)
        assert with_dst is not first
