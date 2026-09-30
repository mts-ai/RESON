"""Unit tests for :mod:`reson.core.analysis.alerts`."""

from __future__ import annotations

import pandas as pd
import pytest

from reson.core.analysis.alerts import (
    Alert,
    AlertAnalyzer,
    AlertContext,
    AlertOrchestrator,
    AlertThresholds,
    CorrelationRule,
    DuplicateAudioRule,
    DurationRule,
    DurationTypeImbalanceRule,
    EmptyTextPredictionRule,
    ErrorConcentrationRule,
    HesitationRule,
    MetricsPresenceRule,
    RequiredColumnsRule,
    TextLengthMismatchRule,
    VocabQualityRule,
    WerDistributionRule,
    default_alert_rules,
)


@pytest.fixture
def thresholds() -> AlertThresholds:
    return AlertThresholds(
        missing_rate_warn=0.05,
        high_wer_threshold=40.0,
        high_wer_share_warn=0.05,
        zero_wer_share_warn=0.90,
        vocab_coverage_threshold=80.0,
        rare_threshold=2,
        rare_share_warn=0.80,
        duration_type_imbalance_thr=0.70,
        min_duration_warn=0.5,
        max_duration_warn=60.0,
        text_length_diff_threshold=0.5,
        min_vocab_size=100,
        wer_skew_threshold=1.0,
        top_wer_percentile=0.10,
        error_concentration_threshold=0.70,
    )


def _ctx(manifest: pd.DataFrame, thresholds: AlertThresholds, **kwargs) -> AlertContext:
    return AlertContext(
        manifest=manifest,
        vocab_df=kwargs.get("vocab_df"),
        metrics_df=kwargs.get("metrics_df"),
        thresholds=thresholds,
    )


def _codes(alerts: list[Alert]) -> set[str]:
    return {alert.code for alert in alerts}


class TestAlertAnalyzerFacade:
    def test_empty_manifest_returns_dataset_empty(self):
        analyzer = AlertAnalyzer(pd.DataFrame())
        alerts = analyzer.compute()
        assert len(alerts) == 1
        assert alerts[0].code == "dataset.empty"
        assert alerts[0].severity == "error"

    def test_default_rules_cover_expected_count(self):
        assert len(default_alert_rules()) == 12


class TestRequiredColumnsRule:
    def test_missing_columns(self, thresholds):
        manifest = pd.DataFrame([{"text": "a", "prediction": "a"}])
        alerts = RequiredColumnsRule().evaluate(_ctx(manifest, thresholds))
        assert "manifest.missing_columns" in _codes(alerts)

    def test_all_required_present(self, thresholds):
        manifest = pd.DataFrame(
            [
                {
                    "audio_filepath": "/a.wav",
                    "text": "hello",
                    "prediction": "hello",
                    "duration": 1.0,
                    "duration_type": "short",
                }
            ]
        )
        assert RequiredColumnsRule().evaluate(_ctx(manifest, thresholds)) == []


class TestDuplicateAudioRule:
    def test_detects_duplicate_paths(self, thresholds):
        manifest = pd.DataFrame(
            [
                {"audio_filepath": "/dup.wav", "text": "a", "prediction": "a"},
                {"audio_filepath": "/dup.wav", "text": "b", "prediction": "b"},
            ]
        )
        alerts = DuplicateAudioRule().evaluate(_ctx(manifest, thresholds))
        assert "manifest.duplicates" in _codes(alerts)


class TestEmptyTextPredictionRule:
    def test_high_empty_share_in_text(self, thresholds):
        manifest = pd.DataFrame(
            [
                {"text": "", "prediction": "ok"},
                {"text": "   ", "prediction": "ok"},
                {"text": "ok", "prediction": "ok"},
            ]
        )
        alerts = EmptyTextPredictionRule().evaluate(_ctx(manifest, thresholds))
        assert "manifest.missing_text" in _codes(alerts)


class TestTextLengthMismatchRule:
    def test_large_relative_length_difference(self, thresholds):
        rows = [{"text": "one two three four five", "prediction": "x"} for _ in range(6)]
        rows.append({"text": "same", "prediction": "same"})
        manifest = pd.DataFrame(rows)
        alerts = TextLengthMismatchRule(min_share=0.05).evaluate(_ctx(manifest, thresholds))
        assert "text.length_mismatch" in _codes(alerts)


class TestDurationRule:
    def test_nonpositive_duration(self, thresholds):
        manifest = pd.DataFrame([{"duration": 0.0}, {"duration": -1.0}, {"duration": 2.0}])
        alerts = DurationRule(min_share=0.05).evaluate(_ctx(manifest, thresholds))
        assert "manifest.duration_nonpositive" in _codes(alerts)

    def test_too_short_duration_share(self, thresholds):
        manifest = pd.DataFrame([{"duration": 0.1} for _ in range(6)] + [{"duration": 10.0}])
        alerts = DurationRule(min_share=0.05).evaluate(_ctx(manifest, thresholds))
        assert "duration.too_short" in _codes(alerts)


class TestWerDistributionRule:
    def test_high_wer_share(self, thresholds):
        manifest = pd.DataFrame({"WER": [50.0] * 6 + [0.0] * 4})
        alerts = WerDistributionRule().evaluate(_ctx(manifest, thresholds))
        assert "wer.high_share" in _codes(alerts)

    def test_zero_wer_dominated(self, thresholds):
        manifest = pd.DataFrame({"WER": [0.0] * 10})
        alerts = WerDistributionRule().evaluate(_ctx(manifest, thresholds))
        assert "wer.zero_dominated" in _codes(alerts)


class TestDurationTypeImbalanceRule:
    def test_imbalanced_duration_type(self, thresholds):
        manifest = pd.DataFrame({"duration_type": ["short"] * 8 + ["long"] * 2})
        alerts = DurationTypeImbalanceRule().evaluate(_ctx(manifest, thresholds))
        assert "duration_type.imbalance" in _codes(alerts)


class TestMetricsPresenceRule:
    def test_empty_metrics_table(self, thresholds):
        alerts = MetricsPresenceRule().evaluate(_ctx(pd.DataFrame(), thresholds, metrics_df=pd.DataFrame()))
        assert "metrics.empty" in _codes(alerts)

    def test_missing_wer_metric(self, thresholds):
        metrics_df = pd.DataFrame([{"name": "CER", "VALUE": 1.0}]).set_index("name")
        alerts = MetricsPresenceRule().evaluate(_ctx(pd.DataFrame(), thresholds, metrics_df=metrics_df))
        assert "metrics.missing_wer" in _codes(alerts)


class TestVocabQualityRule:
    def test_small_vocab(self, thresholds):
        vocab_df = pd.DataFrame([{"word": "a", "count": 1}])
        alerts = VocabQualityRule().evaluate(_ctx(pd.DataFrame(), thresholds, vocab_df=vocab_df))
        assert "vocab.too_small" in _codes(alerts)

    def test_low_recall_coverage(self, thresholds):
        vocab_df = pd.DataFrame([{"word": f"w{i}", "count": 10, "recall": 10.0} for i in range(5)])
        alerts = VocabQualityRule().evaluate(_ctx(pd.DataFrame(), thresholds, vocab_df=vocab_df))
        assert "vocab.low_coverage" in _codes(alerts)


class TestHesitationRule:
    def test_high_hesitation_share(self, thresholds):
        manifest = pd.DataFrame({"text": ["э э э мир"] * 10})
        alerts = HesitationRule(warn_share=0.05).evaluate(_ctx(manifest, thresholds))
        assert "text.hesitation_high" in _codes(alerts)


class TestErrorConcentrationRule:
    def test_short_insertions_dominance(self, thresholds):
        manifest = pd.DataFrame(
            {
                "duration_type": ["short"] * 5 + ["long"] * 5,
                "INS": [10, 10, 10, 10, 10, 0, 0, 0, 0, 0],
                "DEL": [0] * 10,
                "SUB": [0] * 10,
            }
        )
        alerts = ErrorConcentrationRule(duration_type_share_warn=0.40).evaluate(
            _ctx(manifest, thresholds)
        )
        assert "errors.short_ins_dominance" in _codes(alerts)


class TestCorrelationRule:
    def test_detects_high_correlation(self, thresholds):
        manifest = pd.DataFrame(
            {
                "duration": list(range(1, 21)),
                "WER": [float(x) * 2 + (1 if x % 3 == 0 else 0) for x in range(1, 21)],
            }
        )
        alerts = CorrelationRule(min_corr=0.30).evaluate(_ctx(manifest, thresholds))
        assert "metrics.high_correlation" in _codes(alerts)


class TestAlertOrchestrator:
    class _BrokenRule:
        name = "broken"

        def evaluate(self, context: AlertContext) -> list[Alert]:
            raise RuntimeError("boom")

    def test_fail_open_skips_broken_rule(self, thresholds):
        orchestrator = AlertOrchestrator([self._BrokenRule(), RequiredColumnsRule()], fail_open=True)
        alerts = orchestrator.run(_ctx(pd.DataFrame([{"text": "x"}]), thresholds))
        assert "manifest.missing_columns" in _codes(alerts)

    def test_fail_closed_raises(self, thresholds):
        orchestrator = AlertOrchestrator([self._BrokenRule()], fail_open=False)
        with pytest.raises(RuntimeError, match="boom"):
            orchestrator.run(_ctx(pd.DataFrame(), thresholds))
