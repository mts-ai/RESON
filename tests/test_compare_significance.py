"""Tests for bootstrap significance pair resolution."""

from __future__ import annotations

import pytest

from reson.compare_significance import (
    normalize_significance_scope,
    parse_significance_pair,
    parse_significance_pairs,
    resolve_significance_pairs,
)


def test_normalize_significance_scope_accepts_known_values():
    assert normalize_significance_scope("primary") == "primary"
    assert normalize_significance_scope(" Candidate-All ") == "candidate-all"
    assert normalize_significance_scope("NONE") == "none"


def test_normalize_significance_scope_rejects_unknown_value():
    with pytest.raises(ValueError, match="Invalid significance scope"):
        normalize_significance_scope("all-models")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("baseline:candidate", ("baseline", "candidate")),
        ("baseline>candidate", ("baseline", "candidate")),
        ("baseline->candidate", ("baseline", "candidate")),
    ],
)
def test_parse_significance_pair(raw, expected):
    assert parse_significance_pair(raw) == expected


def test_parse_significance_pair_rejects_invalid_value():
    with pytest.raises(ValueError, match="Invalid significance pair"):
        parse_significance_pair("baseline")


def test_parse_significance_pairs_empty():
    assert parse_significance_pairs(None) == []
    assert parse_significance_pairs([]) == []


def test_resolve_significance_pairs_primary_scope():
    pairs = resolve_significance_pairs(
        ["baseline", "candidate", "other"],
        candidate_name="candidate",
        primary_baseline_name="baseline",
        scope="primary",
    )
    assert pairs == [("baseline", "candidate")]


def test_resolve_significance_pairs_candidate_all_scope():
    pairs = resolve_significance_pairs(
        ["baseline", "candidate", "other"],
        candidate_name="candidate",
        scope="candidate-all",
    )
    assert ("baseline", "candidate") in pairs
    assert ("other", "candidate") in pairs
    assert len(pairs) == 2


def test_resolve_significance_pairs_explicit_pairs_are_merged():
    pairs = resolve_significance_pairs(
        ["baseline", "candidate", "other"],
        candidate_name="candidate",
        primary_baseline_name="baseline",
        scope="none",
        explicit_pairs=[("other", "candidate")],
    )
    assert pairs == [("other", "candidate")]


def test_resolve_significance_pairs_skips_self_pairs_and_duplicates():
    pairs = resolve_significance_pairs(
        ["baseline", "candidate"],
        candidate_name="candidate",
        scope="candidate-all",
        explicit_pairs=[("baseline", "candidate"), ("candidate", "baseline")],
    )
    assert pairs == [("baseline", "candidate")]


def test_resolve_significance_pairs_unknown_model_raises():
    with pytest.raises(ValueError, match="Candidate model not found"):
        resolve_significance_pairs(
            ["baseline"],
            candidate_name="candidate",
            scope="primary",
            primary_baseline_name="baseline",
        )
