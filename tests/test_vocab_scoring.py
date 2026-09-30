"""Tests for vocabulary enrichment and word scoring helpers."""

from __future__ import annotations

import pandas as pd
import pytest

from reson.core.analysis.errors import ErrorAnalyzer
from reson.core.analysis.vocab_scoring import (
    asr_substitution_targets_for_word,
    calculate_optimal_wis,
    enrich_vocab,
    ensure_run_vocab_enriched,
    extract_word_type,
    replacement_targets_from_run,
    replacement_targets_from_stats,
    vocab_needs_enrichment,
    wis_components_for_frontend,
    word_ops_stats_from_vocab,
    word_scoring_from_vocab_record,
)
from reson.core.stats import ReplaceVocabStats, Vocab


def test_extract_word_type():
    assert extract_word_type("привет") == "russian"
    assert extract_word_type("hello") == "english"
    assert extract_word_type("123") == "number"
    assert extract_word_type("") == "other"


def test_vocab_needs_enrichment_detects_missing_columns():
    bare = Vocab(pd.DataFrame([{"word": "test", "count": 1}]))
    assert vocab_needs_enrichment(bare) is True

    enriched = Vocab(
        pd.DataFrame(
            [
                {
                    "word": "test",
                    "count": 1,
                    "insertions": 0,
                    "deletions": 0,
                    "substitutions": 0,
                    "wis": 1.0,
                }
            ]
        )
    )
    assert vocab_needs_enrichment(enriched) is False


def test_enrich_vocab_adds_ops_and_wis(sample_records):
    manifest_df = pd.DataFrame(sample_records)
    vocab = Vocab(
        pd.DataFrame(
            [
                {"word": "hello", "count": 1},
                {"word": "world", "count": 1},
                {"word": "second", "count": 1},
            ]
        )
    )
    enriched = enrich_vocab(vocab, manifest_df)
    for column in ("insertions", "deletions", "substitutions", "wis", "wis_components"):
        assert column in enriched.data.columns


def test_enrich_vocab_matches_error_analyzer_ops(sample_records):
    manifest_df = pd.DataFrame(sample_records)
    analyzer = ErrorAnalyzer(manifest_df)
    vocab = Vocab(pd.DataFrame([{"word": "hello", "count": 2}, {"word": "world", "count": 1}]))
    enriched = enrich_vocab(vocab, manifest_df, error_analyzer=analyzer)

    ops = analyzer.word_ops_stats(include_sub_as_dst=True)
    hello_ops = ops.get("hello", {})
    hello_row = enriched.data.loc[enriched.data["word"] == "hello"].iloc[0]
    assert hello_row["deletions"] == hello_ops.get("del", 0)
    assert hello_row["substitutions"] == hello_ops.get("sub", 0)


def test_asr_substitution_targets_for_word_uses_replacement_targets():
    targets = asr_substitution_targets_for_word(
        "hello",
        error_examples_sub=[
            {
                "replacement_targets": [
                    {"word": "hi", "count": 2},
                    {"word": "hey", "count": 1},
                ]
            }
        ],
    )
    assert targets[0]["word"] == "hi"
    assert targets[0]["count"] == 2
    assert targets[1]["word"] == "hey"


def test_ensure_run_vocab_enriched_on_analyzed_run(candidate_run):
    _, run = candidate_run
    enriched = ensure_run_vocab_enriched(run)
    assert not vocab_needs_enrichment(enriched.vocab)
    assert "wis" in enriched.vocab.data.columns


def test_word_ops_stats_from_vocab_roundtrip(candidate_run):
    run = ensure_run_vocab_enriched(candidate_run[1])
    stats = word_ops_stats_from_vocab(run.vocab)
    assert stats
    first_word = next(iter(stats))
    assert {"ins", "del", "sub"}.issubset(stats[first_word].keys())


def test_calculate_optimal_wis_returns_bounded_score_and_components():
    result = calculate_optimal_wis(
        frequency=10,
        max_frequency=100,
        f1_score=50.0,
        ops={"del": 2, "sub": 1, "ins": 0},
        replacements=[{"target": "alt", "count": 3}],
        word_type="russian",
        word_length=5,
    )
    assert 0.0 <= result["wis"] <= 100.0
    assert set(result["components"]) == {
        "frequencyScore",
        "errorSeverity",
        "errorCriticality",
        "substitutionDiversity",
    }


def test_calculate_optimal_wis_higher_ops_increase_criticality():
    low_ops = calculate_optimal_wis(
        frequency=5,
        max_frequency=10,
        f1_score=80.0,
        ops={"del": 0, "sub": 0, "ins": 0},
    )
    high_ops = calculate_optimal_wis(
        frequency=5,
        max_frequency=10,
        f1_score=80.0,
        ops={"del": 5, "sub": 3, "ins": 2},
    )
    assert high_ops["components"]["errorCriticality"] >= low_ops["components"]["errorCriticality"]


def test_wis_components_for_frontend_maps_weights():
    mapped = wis_components_for_frontend(
        {
            "frequencyScore": 10.0,
            "errorSeverity": 20.0,
            "errorCriticality": 30.0,
            "substitutionDiversity": 40.0,
        }
    )
    assert mapped["frequency"] == {"value": 10.0, "weight": 25.0}
    assert mapped["errorSeverity"]["weight"] == 35.0
    assert mapped["substitutionVariability"]["value"] == 40.0


def test_word_scoring_from_vocab_record():
    scoring = word_scoring_from_vocab_record(
        {
            "wis": 42.5,
            "insertions": 1,
            "deletions": 2,
            "substitutions": 3,
            "wis_components": {
                "frequencyScore": 10.0,
                "errorSeverity": 20.0,
                "errorCriticality": 30.0,
                "substitutionDiversity": 40.0,
            },
        }
    )
    assert scoring["wis"] == 42.5
    assert scoring["insertions"] == 1
    assert scoring["deletions"] == 2
    assert scoring["substitutions"] == 3
    assert "frequency" in scoring["wisComponents"]


def test_replacement_targets_from_stats():
    stats = ReplaceVocabStats(
        vocab={"hello": ["hi"]},
        fields={"text": 2},
        words={"uh": 3},
        examples={0: [("text", "uh", "")]},
    )
    targets = replacement_targets_from_stats(stats)
    assert "uh" in targets
    assert targets["uh"][0]["target"] == ""
    assert targets["uh"][0]["count"] == 3


def test_replacement_targets_from_run(candidate_run):
    _, run = candidate_run
    targets = replacement_targets_from_run(run)
    if run.replacements is not None and run.replacements.words:
        assert targets


def test_ensure_run_vocab_enriched_force_recomputes(candidate_run):
    _, run = candidate_run
    enriched_once = ensure_run_vocab_enriched(run)
    original_wis = enriched_once.vocab.data["wis"].tolist()
    enriched_force = ensure_run_vocab_enriched(enriched_once, force=True)
    assert enriched_force.vocab.data["wis"].tolist() == original_wis
