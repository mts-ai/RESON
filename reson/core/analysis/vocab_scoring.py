"""Word-level scoring and vocabulary enrichment for RESON runs."""

from __future__ import annotations

import math
from dataclasses import replace
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import pandas as pd

from reson.core.analysis.errors import (
    ErrorAnalyzer,
    example_totals_from_buckets,
    ui_error_totals_from_ops,
)
from reson.core.stats import ReplaceVocabStats, Vocab

if TYPE_CHECKING:
    from reson.core.analysis.run import RESONRun


def vocab_needs_enrichment(vocab: Vocab) -> bool:
    """True when per-word ops/WIS columns are absent."""
    if vocab.data.empty:
        return False
    required = ("insertions", "deletions", "substitutions", "wis")
    return not all(col in vocab.data.columns for col in required)


def extract_word_type(word: str) -> str:
    """Detect lexical bucket for word statistics."""
    if not word:
        return "other"
    if word.replace(".", "").replace(",", "").replace("-", "").isdigit():
        return "number"
    has_english = any(ord(c) < 128 and c.isalpha() for c in word)
    has_cyrillic = any("\u0400" <= c <= "\u04FF" for c in word)
    if has_cyrillic and not has_english:
        return "russian"
    if has_english and not has_cyrillic:
        return "english"
    if has_cyrillic and has_english:
        return "russian"
    return "other"


def calculate_optimal_wis(
    frequency: int,
    max_frequency: int,
    f1_score: float,
    ops: Optional[Dict[str, int]] = None,
    replacements: Optional[List[Dict[str, Any]]] = None,
    word_type: str = "other",
    word_length: int = 0,
) -> Dict[str, Any]:
    """Compute weighted word importance score with interpretable components."""
    safe_max_freq = max(max_frequency, 1)
    frequency_score = min(100.0, (math.log10(frequency + 1) / math.log10(safe_max_freq + 1)) * 100.0)
    error_severity = min(100.0, 100.0 - f1_score)

    if ops:
        weighted_errors = (
            (ops.get("del", 0) or 0) * 2.0
            + (ops.get("sub", 0) or 0) * 1.5
            + (ops.get("sub_as_dst", 0) or 0) * 1.2
            + (ops.get("ins", 0) or 0) * 1.0
        )
        if frequency > 0:
            error_criticality = min(100.0, (weighted_errors / (frequency + 1)) * 100.0)
        else:
            error_criticality = min(100.0, math.log10(weighted_errors + 1) * 15.0)
    else:
        error_criticality = error_severity * 0.8

    if replacements:
        unique_targets = len(set(r.get("target", "") for r in replacements if r.get("target")))
        total_replacements = sum(r.get("count", 0) or 0 for r in replacements)
        substitution_diversity = min(100.0, unique_targets * 12.0 + math.log10(total_replacements + 1) * 8.0)
    else:
        substitution_diversity = 0.0

    type_multiplier = {
        "russian": 1.0,
        "english": 1.0,
        "numeric": 0.95,
        "number": 0.95,
        "other": 1.0,
    }.get(word_type, 1.0)
    if word_length <= 3:
        length_multiplier = 1.1
    elif word_length <= 6:
        length_multiplier = 1.0
    else:
        length_multiplier = 0.95

    base_wis = (
        frequency_score * 0.25
        + error_severity * 0.35
        + error_criticality * 0.25
        + substitution_diversity * 0.15
    )
    wis = max(0.0, min(100.0, base_wis * type_multiplier * length_multiplier))
    return {
        "wis": round(wis, 2),
        "components": {
            "frequencyScore": round(frequency_score, 2),
            "errorSeverity": round(error_severity, 2),
            "errorCriticality": round(error_criticality, 2),
            "substitutionDiversity": round(substitution_diversity, 2),
        },
    }


def wis_components_for_frontend(components: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
    """Map WIS components to single_report UI shape."""
    return {
        "frequency": {
            "value": float(components.get("frequencyScore", 0) or 0),
            "weight": 25.0,
        },
        "errorSeverity": {
            "value": float(components.get("errorSeverity", 0) or 0),
            "weight": 35.0,
        },
        "errorCriticality": {
            "value": float(components.get("errorCriticality", 0) or 0),
            "weight": 25.0,
        },
        "substitutionVariability": {
            "value": float(components.get("substitutionDiversity", 0) or 0),
            "weight": 15.0,
        },
    }


def _compute_f1_score(recall: float, precision: float, f1_score: float) -> float:
    if f1_score > 0:
        return f1_score
    if recall > 0 and precision > 0:
        denom = recall + precision
        return 2.0 * recall * precision / denom if denom > 0 else (recall + precision) / 2.0
    return (recall + precision) / 2.0


def replacement_targets_from_stats(
    replacements: Optional[ReplaceVocabStats],
) -> Dict[str, List[Dict[str, Any]]]:
    """Map normalization source word -> [{target, count, share}] for WIS."""
    replacements_dict: Dict[str, List[Dict[str, Any]]] = {}
    if not replacements or not replacements.words:
        return replacements_dict
    try:
        for variant, count in replacements.words.items():
            target = variant
            if replacements.examples:
                for examples_list in replacements.examples.values():
                    for _field, source, tgt in examples_list:
                        if source == variant:
                            target = tgt
                            break
                    if target != variant:
                        break
            replacements_dict.setdefault(variant, []).append(
                {"target": target, "count": count, "share": 100.0}
            )
    except Exception:
        return {}
    return replacements_dict


def replacement_targets_from_run(reson_run: "RESONRun") -> Dict[str, List[Dict[str, Any]]]:
    """Replacement targets for a persisted or in-memory run."""
    return replacement_targets_from_stats(reson_run.replacements)


def enrich_vocab(
    vocab: Vocab,
    manifest: pd.DataFrame,
    replacements: Optional[ReplaceVocabStats] = None,
    *,
    error_analyzer: Optional[ErrorAnalyzer] = None,
    force: bool = False,
) -> Vocab:
    """Add insertions/deletions/substitutions/wis/wis_components columns to vocab."""
    if vocab.data.empty:
        return vocab
    if not force and not vocab_needs_enrichment(vocab):
        return vocab

    data = vocab.data.copy()
    analyzer = error_analyzer or ErrorAnalyzer(manifest)
    word_ops_stats = analyzer.word_ops_stats(include_sub_as_dst=True)
    word_error_examples_all = analyzer.word_error_examples(include_sub_as_dst=False)
    replacements_dict = replacement_targets_from_stats(replacements)

    counts = pd.to_numeric(data["count"], errors="coerce").fillna(0) if "count" in data.columns else pd.Series(0, index=data.index)
    max_frequency = int(counts.max()) if len(counts) else 0
    max_frequency = max(max_frequency, 1)

    insertions: List[int] = []
    deletions: List[int] = []
    substitutions: List[int] = []
    wis_values: List[float] = []
    wis_components_col: List[Dict[str, Any]] = []
    recalls: List[float] = []
    precisions: List[float] = []
    f1_scores: List[float] = []

    vocab_word_counts = {
        str(row.get("word", "")).strip(): int(row.get("count", 0) or 0)
        for _, row in data.iterrows()
        if str(row.get("word", "")).strip()
    }
    word_quality = analyzer.word_quality_metrics(vocab_word_counts)

    for _, row in data.iterrows():
        word = str(row.get("word", "")).strip()
        count = int(row.get("count", 0) or 0)
        quality = word_quality.get(word, {})
        recall = float(quality.get("recall", 0) or 0)
        precision = float(quality.get("precision", 0) or 0)
        f1_score = float(quality.get("f1_score", 0) or 0)
        f1_score = _compute_f1_score(recall, precision, f1_score)

        ops = word_ops_stats.get(word, {}) if word else {}
        buckets = word_error_examples_all.get(word, {}) if word else {}
        totals = (
            example_totals_from_buckets(buckets)
            if buckets
            else ui_error_totals_from_ops(ops)
        )
        insertions.append(totals["insertions"])
        deletions.append(totals["deletions"])
        substitutions.append(totals["substitutions"])

        wis_result = calculate_optimal_wis(
            frequency=count,
            max_frequency=max_frequency,
            f1_score=f1_score,
            ops=ops if ops else None,
            replacements=replacements_dict.get(word),
            word_type=extract_word_type(word),
            word_length=len(word),
        )
        wis_values.append(wis_result["wis"])
        wis_components_col.append(dict(wis_result.get("components") or {}))
        recalls.append(recall)
        precisions.append(precision)
        f1_scores.append(round(f1_score, 1))

    data["insertions"] = insertions
    data["deletions"] = deletions
    data["substitutions"] = substitutions
    data["wis"] = wis_values
    data["wis_components"] = wis_components_col
    data["recall"] = recalls
    data["precision"] = precisions
    data["f1_score"] = f1_scores
    return Vocab(data)


def asr_substitution_targets_for_word(
    word: str,
    word_replacements: Optional[Dict[str, List[Any]]] = None,
    *,
    error_examples_sub: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """ASR replace targets for a reference word, aligned with substitution examples."""
    totals: Dict[str, int] = {}
    if error_examples_sub:
        for ex in error_examples_sub:
            for t in ex.get("replacement_targets") or []:
                dst = str(t.get("word", ""))
                if dst:
                    totals[dst] = totals.get(dst, 0) + int(t.get("count", 0) or 0)
    if not totals and word_replacements:
        for dst, cnt in word_replacements.get(word) or []:
            if dst:
                totals[str(dst)] = totals.get(str(dst), 0) + int(cnt or 0)
    if not totals:
        return []
    total = sum(totals.values())
    targets = [
        {
            "word": dst,
            "count": cnt,
            "share": round(cnt / total * 100.0, 1) if total > 0 else 0.0,
        }
        for dst, cnt in sorted(totals.items(), key=lambda x: -x[1])
    ]
    return targets


def ensure_run_vocab_enriched(run: "RESONRun", *, force: bool = False) -> "RESONRun":
    """Return run with enriched vocab (immutable RESONRun gets a new vocab instance)."""
    vocab = enrich_vocab(
        run.vocab,
        run.manifest,
        run.replacements,
        force=force,
    )
    if vocab is run.vocab:
        return run
    return replace(run, vocab=vocab)


def _normalize_wis_components(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    return {}


def word_scoring_from_vocab_record(rec: Dict[str, Any]) -> Dict[str, Any]:
    """Read per-word INS/DEL/SUB/WIS from a vocab row (domain columns)."""
    wis = float(rec.get("wis", 0) or 0)
    return {
        "wis": wis,
        "wisComponents": wis_components_for_frontend(_normalize_wis_components(rec.get("wis_components"))),
        "insertions": int(rec.get("insertions", 0) or 0),
        "deletions": int(rec.get("deletions", 0) or 0),
        "substitutions": int(rec.get("substitutions", 0) or 0),
    }


def word_ops_stats_from_vocab(vocab: Vocab) -> Dict[str, Dict[str, int]]:
    """Rebuild ErrorAnalyzer-style ops map from enriched vocab columns."""
    if vocab.data.empty or not all(c in vocab.data.columns for c in ("insertions", "deletions", "substitutions")):
        return {}
    out: Dict[str, Dict[str, int]] = {}
    for _, row in vocab.data.iterrows():
        word = str(row.get("word", "")).strip()
        if not word:
            continue
        out[word] = {
            "ins": int(row.get("insertions", 0) or 0),
            "del": int(row.get("deletions", 0) or 0),
            "sub": int(row.get("substitutions", 0) or 0),
        }
    return out
