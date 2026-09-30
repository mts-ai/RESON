"""Resolve which model pairs should receive bootstrap significance analysis."""

from __future__ import annotations

from typing import Iterable, List, Literal, Optional, Sequence, Tuple

SignificanceScope = Literal["none", "primary", "candidate-all"]

_VALID_SCOPES = {"none", "primary", "candidate-all"}


def normalize_significance_scope(scope: str) -> SignificanceScope:
    normalized = scope.strip().lower()
    if normalized not in _VALID_SCOPES:
        raise ValueError(
            f"Invalid significance scope {scope!r}; expected one of: "
            + ", ".join(sorted(_VALID_SCOPES))
        )
    return normalized  # type: ignore[return-value]


def parse_significance_pair(value: str) -> Tuple[str, str]:
    """Parse ``baseline:candidate`` or ``baseline>candidate``."""
    raw = value.strip()
    for separator in ("->", ":", ">"):
        if separator in raw:
            baseline, candidate = raw.split(separator, 1)
            baseline_name = baseline.strip()
            candidate_name = candidate.strip()
            if baseline_name and candidate_name:
                return baseline_name, candidate_name
            break
    raise ValueError(
        f"Invalid significance pair {value!r}; expected BASE:TARGET or BASE>TARGET"
    )


def parse_significance_pairs(values: Optional[Sequence[str]]) -> List[Tuple[str, str]]:
    if not values:
        return []
    return [parse_significance_pair(item) for item in values]


def resolve_significance_pairs(
    model_names: Sequence[str],
    *,
    candidate_name: str,
    primary_baseline_name: Optional[str] = None,
    scope: SignificanceScope = "primary",
    explicit_pairs: Optional[Iterable[Tuple[str, str]]] = None,
) -> List[Tuple[str, str]]:
    """Return ordered baseline→candidate pairs for bootstrap analysis."""
    known_models = list(model_names)
    if candidate_name not in known_models:
        raise ValueError(f"Candidate model not found: {candidate_name!r}")

    pairs: List[Tuple[str, str]] = []
    seen: set[Tuple[str, str]] = set()

    def add_pair(baseline_name: str, target_name: str) -> None:
        if baseline_name not in known_models:
            raise ValueError(f"Baseline model not found: {baseline_name!r}")
        if target_name not in known_models:
            raise ValueError(f"Candidate model not found: {target_name!r}")
        if baseline_name == target_name:
            return
        key = (baseline_name, target_name)
        reverse = (target_name, baseline_name)
        if key in seen or reverse in seen:
            return
        seen.add(key)
        pairs.append(key)

    if scope == "primary" and primary_baseline_name:
        add_pair(primary_baseline_name, candidate_name)
    elif scope == "candidate-all":
        for model_name in known_models:
            if model_name != candidate_name:
                add_pair(model_name, candidate_name)

    if explicit_pairs:
        for baseline_name, target_name in explicit_pairs:
            add_pair(baseline_name, target_name)

    return pairs
