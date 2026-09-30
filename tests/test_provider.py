"""Unit tests for :mod:`reson.core.metrics.provider`."""

from __future__ import annotations

import pandas as pd
import pytest

from reson.core.manifest import Manifest
from reson.core.metrics.provider import (
    BaseMetricProvider,
    JiwerMetricProvider,
    MetricProviderABC,
    get_stats,
)


@pytest.fixture
def metric_manifest(sample_records):
    return Manifest(sample_records)


class TestGetStats:
    def test_get_stats_global_mean_std(self):
        per_file = pd.DataFrame({"WER": [0.0, 20.0, 40.0]})
        global_val, mean_val, std_val = get_stats(per_file, "WER", nom_sum=3, ref_len=30)
        assert global_val == pytest.approx(10.0)
        assert mean_val == pytest.approx(20.0)
        assert std_val == pytest.approx(16.3299, rel=1e-3)

    def test_get_stats_zero_reference_length(self):
        per_file = pd.DataFrame({"WER": [0.0]})
        global_val, mean_val, std_val = get_stats(per_file, "WER", nom_sum=0, ref_len=0)
        assert global_val == 0.0


class TestJiwerMetricProvider:
    def test_evaluate_perfect_match(self, metric_manifest):
        records = [
            {
                "audio_filepath": "/tmp/perfect.wav",
                "duration": 1.0,
                "text": "hello world",
                "prediction": "hello world",
            }
        ]
        manifest = Manifest(records)
        provider = JiwerMetricProvider(metrics=("WER", "CER"))

        per_file_df, summary_df = provider.evaluate(manifest)

        assert len(per_file_df) == 1
        assert per_file_df.loc[0, "WER"] == pytest.approx(0.0)
        assert per_file_df.loc[0, "CER"] == pytest.approx(0.0)
        assert per_file_df.loc[0, "INS"] == 0
        assert per_file_df.loc[0, "DEL"] == 0
        assert per_file_df.loc[0, "SUB"] == 0
        assert "WER" in summary_df.index
        assert "CER" in summary_df.index
        assert summary_df.loc["WER", "VALUE"] == pytest.approx(0.0)

    def test_evaluate_with_word_errors(self):
        records = [
            {
                "audio_filepath": "/tmp/err.wav",
                "duration": 2.0,
                "text": "hello world",
                "prediction": "hello there",
            }
        ]
        manifest = Manifest(records)
        provider = JiwerMetricProvider(metrics=("WER",))

        per_file_df, summary_df = provider.evaluate(manifest)

        assert per_file_df.loc[0, "SUB"] == 1
        assert per_file_df.loc[0, "WER"] > 0
        assert summary_df.loc["WER", "SUB"] == 1

    def test_postprocess_adds_duration_type_and_vocab_metrics(self, metric_manifest):
        provider = JiwerMetricProvider(metrics=("WER",))
        per_file_df, _ = provider.evaluate(metric_manifest)

        enriched_df, vocab = provider.postprocess(
            per_file_df,
            vocab_df=metric_manifest.vocab.data,
        )

        assert "duration_type" in enriched_df.columns
        assert not vocab.data.empty
        assert {"word", "count", "recall", "precision", "f1_score"}.issubset(vocab.data.columns)

    def test_wer_only_drops_cer_columns(self, metric_manifest):
        provider = JiwerMetricProvider(metrics=("WER",))
        per_file_df, summary_df = provider.evaluate(metric_manifest)

        assert "CER" not in per_file_df.columns
        assert "CER" not in summary_df.index

    def test_implements_metric_provider_contract(self):
        provider = JiwerMetricProvider()
        assert isinstance(provider, MetricProviderABC)
        assert isinstance(provider, BaseMetricProvider)
