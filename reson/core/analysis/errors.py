"""Error analysis utilities for report generation.

Current report pipeline relies on:
- per-word replacement stats
- replacement examples
- per-word INS/DEL/SUB aggregates
- per-word error examples

Implementation below computes these artifacts in a single pass over manifest.
"""

from __future__ import annotations

import difflib
import html
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

import pandas as pd


@dataclass
class _PipelineCache:
    """Precomputed artifacts generated from a manifest in one pass."""

    replacements: Dict[str, List[tuple[str, int]]]
    replacement_examples: Dict[str, List[dict]]
    word_ops_stats: Dict[str, Dict[str, int]]
    word_error_examples: Dict[str, Dict[str, List[dict]]]
    match_ref: Dict[str, int]
    match_hyp: Dict[str, int]


def _safe_float(value: Any, default: float = 0.0) -> float:
    """Convert value to float, returning default on invalid input."""
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return default
        return float(value)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    """Convert value to int, returning default on invalid input."""
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return default
        return int(value)
    except Exception:
        return default


def _make_row_example(row: pd.Series) -> dict:
    """Build normalized row payload for error examples."""
    return {
        "audio_filepath": str(row.get("audio_filepath", "")),
        "text": str(row.get("text", "")),
        "prediction": str(row.get("prediction", "")),
        "duration": _safe_float(row.get("duration", 0.0), 0.0),
        "WER": _safe_float(row.get("WER", 0.0), 0.0),
        "CER": _safe_float(row.get("CER"), 0.0) if pd.notna(row.get("CER")) else None,
        "LER": _safe_float(row.get("LER"), 0.0) if pd.notna(row.get("LER")) else None,
        "WER_H": _safe_float(row.get("WER_H"), 0.0) if pd.notna(row.get("WER_H")) else None,
        "INS": _safe_int(row.get("INS", 0), 0),
        "DEL": _safe_int(row.get("DEL", 0), 0),
        "SUB": _safe_int(row.get("SUB", 0), 0),
    }


def _count_words(words: List[str]) -> Dict[str, int]:
    """Count token occurrences in a list of words."""
    counts: Dict[str, int] = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    return counts


def _split_replace_segment(
    ref_segment: List[str],
    hyp_segment: List[str],
) -> tuple[List[str], List[str], List[str], List[str]]:
    """Decompose replace segment to DEL/SUB/INS (+SUB dst) tokens.

    Returns:
        (del_words, sub_words, ins_words, sub_dst_words)
    """
    ref_len = len(ref_segment)
    hyp_len = len(hyp_segment)

    if ref_len == hyp_len:
        return [], ref_segment, [], hyp_segment

    if ref_len > hyp_len:
        delta = ref_len - hyp_len
        del_words = ref_segment[:delta]
        sub_words = ref_segment[delta:]
        return del_words, sub_words, [], hyp_segment

    delta = hyp_len - ref_len
    ins_words = hyp_segment[ref_len:]
    sub_dst_words = hyp_segment[:ref_len]
    return [], ref_segment, ins_words, sub_dst_words


def _add_counts(target: Dict[str, int], counts: Dict[str, int]) -> None:
    """Accumulate one token->count mapping into another mapping."""
    for word, count in counts.items():
        target[word] = target.get(word, 0) + count


def _append_diff_segment(
    html_parts: List[str],
    plain_parts: List[str],
    tokens: List[str],
    html_class: Optional[str],
    *,
    inline_style: Optional[str] = None,
    plain_formatter: Optional[Callable[[str], str]] = None,
) -> None:
    """Append a formatted segment to HTML and plain diff outputs."""
    if not tokens:
        return
    text = " ".join(tokens)
    escaped = html.escape(text)
    class_attr = f' class="{html_class}"' if html_class else ""
    style_attr = f' style="{inline_style}"' if inline_style else ""
    if html_class or inline_style:
        html_parts.append(f"<span{class_attr}{style_attr}>{escaped}</span>")
    else:
        html_parts.append(escaped)
    if plain_formatter is None:
        plain_parts.append(text)
    else:
        plain_parts.append(plain_formatter(text))


def _inline_word_diff(reference: str, hypothesis: str) -> tuple[str, str]:
    """Build colored HTML diff and plain diff for two token sequences."""
    ref_tokens = str(reference).split()
    hyp_tokens = str(hypothesis).split()
    matcher = difflib.SequenceMatcher(None, ref_tokens, hyp_tokens)

    html_parts: List[str] = []
    plain_parts: List[str] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        ref_segment_tokens = ref_tokens[i1:i2]
        hyp_segment_tokens = hyp_tokens[j1:j2]
        if tag == "equal":
            _append_diff_segment(html_parts, plain_parts, ref_segment_tokens, None)
        elif tag == "delete":
            _append_diff_segment(
                html_parts,
                plain_parts,
                ref_segment_tokens,
                "diff-token diff-delete",
                inline_style="background:#fee2e2;color:#b91c1c;text-decoration:line-through;padding:0 6px;border-radius:6px;",
                plain_formatter=lambda t: f"[-{t}-]",
            )
        elif tag == "insert":
            _append_diff_segment(
                html_parts,
                plain_parts,
                hyp_segment_tokens,
                "diff-token diff-insert",
                inline_style="background:#dcfce7;color:#166534;padding:0 6px;border-radius:6px;",
                plain_formatter=lambda t: f"[+{t}+]",
            )
        elif tag == "replace":
            _append_diff_segment(
                html_parts,
                plain_parts,
                ref_segment_tokens,
                "diff-token diff-replace-src",
                inline_style="background:#dbeafe;color:#1d4ed8;text-decoration:line-through;padding:0 6px;border-radius:6px;",
                plain_formatter=lambda t: f"[-{t}-]",
            )
            _append_diff_segment(
                html_parts,
                plain_parts,
                hyp_segment_tokens,
                "diff-token diff-replace-dst",
                inline_style="background:#fef08a;color:#854d0e;padding:0 6px;border-radius:6px;",
                plain_formatter=lambda t: f"[+{t}+]",
            )
    return " ".join(html_parts).strip(), " ".join(plain_parts).strip()


def _merge_replacement_targets(
    existing: List[Dict[str, Any]],
    new_targets: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Merge per-utterance ASR substitution targets {word, count}."""
    merged: Dict[str, int] = {t["word"]: int(t.get("count", 0) or 0) for t in existing or []}
    for t in new_targets or []:
        w = str(t.get("word", ""))
        if not w:
            continue
        merged[w] = merged.get(w, 0) + int(t.get("count", 0) or 0)
    return [{"word": w, "count": c} for w, c in sorted(merged.items(), key=lambda x: -x[1])]


def _replacement_targets_for_source(
    row_pair_counts: Dict[tuple[str, str], int],
    source_word: str,
) -> List[Dict[str, Any]]:
    """Hypothesis targets when ``source_word`` was substituted in reference."""
    totals: Dict[str, int] = {}
    for (src, dst), cnt in row_pair_counts.items():
        if src == source_word and dst:
            totals[dst] = totals.get(dst, 0) + int(cnt or 0)
    return [{"word": dst, "count": c} for dst, c in sorted(totals.items(), key=lambda x: -x[1])]


def _append_word_error_example(
    result: Dict[str, Dict[str, List[dict]]],
    *,
    word: str,
    op_type: str,
    base_example: dict,
    count: int,
    is_sub_as_dst: bool = False,
    replacement_targets: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """Append or merge an example for a word-level operation bucket (one row per utterance)."""
    if word not in result:
        result[word] = {"ins": [], "del": [], "sub": []}

    audio = str(base_example.get("audio_filepath", ""))
    for existing in result[word][op_type]:
        if str(existing.get("audio_filepath", "")) != audio:
            continue
        existing["count"] = int(existing.get("count", 0) or 0) + int(count or 0)
        if is_sub_as_dst:
            existing["is_sub_as_dst"] = True
        if op_type == "sub" and replacement_targets:
            existing["replacement_targets"] = _merge_replacement_targets(
                existing.get("replacement_targets"),
                replacement_targets,
            )
        return

    ex = base_example.copy()
    ex["count"] = int(count or 0)
    if is_sub_as_dst:
        ex["is_sub_as_dst"] = True
    if op_type == "sub" and replacement_targets:
        ex["replacement_targets"] = replacement_targets
    result[word][op_type].append(ex)


def ui_error_totals_from_ops(ops: Dict[str, int]) -> Dict[str, int]:
    """Map internal ops counters to UI buckets (insertions / deletions / substitutions)."""
    return {
        "insertions": int(ops.get("ins", 0) or 0),
        "deletions": int(ops.get("del", 0) or 0),
        "substitutions": int(ops.get("sub", 0) or 0),
    }


def word_quality_metrics_for_word(
    word: str,
    ref_count: int,
    *,
    match_ref: Dict[str, int],
    match_hyp: Dict[str, int],
    word_ops: Dict[str, Dict[str, int]],
) -> Dict[str, float]:
    """Per-word recall/precision/F1 from the same alignment pass as INS/DEL/SUB."""
    matches_ref = int(match_ref.get(word, 0) or 0)
    matches_hyp = int(match_hyp.get(word, 0) or 0)
    ins = int(word_ops.get(word, {}).get("ins", 0) or 0)

    recall = (matches_ref / max(ref_count, 1)) * 100.0
    hyp_denom = matches_hyp + ins
    if hyp_denom > 0:
        precision = (matches_hyp / hyp_denom) * 100.0
    elif matches_hyp > 0:
        precision = 100.0
    else:
        precision = 0.0

    f1 = (2.0 * precision * recall) / max(precision + recall, 1e-9)
    return {
        "recall": round(recall, 1),
        "precision": round(precision, 1),
        "f1_score": round(f1, 1),
    }


def example_totals_from_buckets(buckets: Dict[str, List[dict]]) -> Dict[str, int]:
    """Sum ``count`` fields in error example lists (must match ui_error_totals_from_ops)."""
    return {
        "insertions": sum(int(e.get("count", 0) or 0) for e in buckets.get("ins", [])),
        "deletions": sum(int(e.get("count", 0) or 0) for e in buckets.get("del", [])),
        "substitutions": sum(int(e.get("count", 0) or 0) for e in buckets.get("sub", [])),
    }


def _build_pipeline_cache(manifest: pd.DataFrame, include_sub_as_dst: bool) -> _PipelineCache:
    """Compute all report artifacts in one pass over manifest."""
    if manifest is None or manifest.empty:
        return _PipelineCache(
            replacements={},
            replacement_examples={},
            word_ops_stats={},
            word_error_examples={},
            match_ref={},
            match_hyp={},
        )

    replacement_counts: Dict[str, Dict[str, int]] = {}
    replacement_examples: Dict[str, List[dict]] = {}
    ops_stats: Dict[str, Dict[str, int]] = {}
    word_examples: Dict[str, Dict[str, List[dict]]] = {}
    match_ref: Dict[str, int] = {}
    match_hyp: Dict[str, int] = {}

    for _, row in manifest.iterrows():
        text = str(row.get("text", ""))
        prediction = str(row.get("prediction", ""))
        ref_words = text.split()
        hyp_words = prediction.split()
        if not ref_words and not hyp_words:
            continue

        matcher = difflib.SequenceMatcher(None, ref_words, hyp_words)
        row_base_example = _make_row_example(row)

        row_pair_counts: Dict[tuple[str, str], int] = {}
        row_counts: Dict[str, Dict[str, int]] = {"ins": {}, "del": {}, "sub": {}}
        row_sub_dst_counts: Dict[str, int] = {}

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                _add_counts(match_ref, _count_words(ref_words[i1:i2]))
                _add_counts(match_hyp, _count_words(hyp_words[j1:j2]))
                continue

            if tag == "insert":
                _add_counts(row_counts["ins"], _count_words(hyp_words[j1:j2]))
                continue

            if tag == "delete":
                _add_counts(row_counts["del"], _count_words(ref_words[i1:i2]))
                continue

            # replace
            ref_segment = ref_words[i1:i2]
            hyp_segment = hyp_words[j1:j2]

            # Replacement pairs used by `word_replacements*` API.
            min_len = min(len(ref_segment), len(hyp_segment))
            for k in range(min_len):
                src = ref_segment[k]
                dst = hyp_segment[k]
                row_pair_counts[(src, dst)] = row_pair_counts.get((src, dst), 0) + 1

            del_words, sub_words, ins_words, sub_dst_words = _split_replace_segment(
                ref_segment, hyp_segment
            )
            _add_counts(row_counts["del"], _count_words(del_words))
            _add_counts(row_counts["sub"], _count_words(sub_words))
            _add_counts(row_counts["ins"], _count_words(ins_words))

            if include_sub_as_dst:
                _add_counts(row_sub_dst_counts, _count_words(sub_dst_words))

        # Persist replacement aggregates and replacement examples.
        if row_pair_counts:
            diff_html, diff_plain = _inline_word_diff(text, prediction)
            example_payload = {
                "audio_filepath": row_base_example["audio_filepath"],
                "duration": row_base_example["duration"],
                "text": row_base_example["text"],
                "prediction": row_base_example["prediction"],
                "diff_html": diff_html,
                "diff_plain": diff_plain,
            }
            for (src, dst), count in row_pair_counts.items():
                dst_map = replacement_counts.setdefault(src, {})
                dst_map[dst] = dst_map.get(dst, 0) + count

                key = f"{src}|||{dst}"
                bucket = replacement_examples.setdefault(key, [])
                # Keep historical behavior: examples may contain duplicated
                # rows when replacement happens multiple times in one sample.
                for _ in range(count):
                    bucket.append(example_payload.copy())

        # Persist per-word operation counters.
        for op_name, counts in row_counts.items():
            for word, count in counts.items():
                d = ops_stats.setdefault(word, {"ins": 0, "del": 0, "sub": 0})
                d[op_name] += count

        if include_sub_as_dst:
            for word, count in row_sub_dst_counts.items():
                d = ops_stats.setdefault(word, {"ins": 0, "del": 0, "sub": 0, "sub_as_dst": 0})
                d["sub_as_dst"] = d.get("sub_as_dst", 0) + count

        # Persist word-level examples (one merged row per utterance per bucket).
        for word, count in row_counts["ins"].items():
            _append_word_error_example(
                word_examples,
                word=word,
                op_type="ins",
                base_example=row_base_example,
                count=count,
            )
        for word, count in row_counts["del"].items():
            _append_word_error_example(
                word_examples,
                word=word,
                op_type="del",
                base_example=row_base_example,
                count=count,
            )
        for word, count in row_counts["sub"].items():
            _append_word_error_example(
                word_examples,
                word=word,
                op_type="sub",
                base_example=row_base_example,
                count=count,
                replacement_targets=_replacement_targets_for_source(row_pair_counts, word),
            )
    replacements: Dict[str, List[tuple[str, int]]] = {}
    for src, dst_counts in replacement_counts.items():
        ordered = sorted(dst_counts.items(), key=lambda x: x[1], reverse=True)
        replacements[src] = [(dst, int(cnt)) for dst, cnt in ordered]

    return _PipelineCache(
        replacements=replacements,
        replacement_examples=replacement_examples,
        word_ops_stats=ops_stats,
        word_error_examples=word_examples,
        match_ref=match_ref,
        match_hyp=match_hyp,
    )


class ErrorAnalyzer:
    """Analyze token-level ASR errors for report generation.

    Public API used by reporting modules:
    - replacement statistics (`word_replacements`)
    - replacement examples with inline diff (`word_replacement_examples`)
    - per-word operation counters (`word_ops_stats`)
    - per-word example buckets (`word_error_examples`)

    The class orchestrates cache management while heavy processing lives in
    module-level pure helper functions.
    """

    def __init__(self, manifest: pd.DataFrame) -> None:
        """Create analyzer for a manifest DataFrame."""
        self.manifest = manifest
        self._pipeline_cache_by_mode: Dict[bool, _PipelineCache] = {}

    def _get_pipeline_cache(self, include_sub_as_dst: bool) -> _PipelineCache:
        """Return cached artifacts for mode, building them if needed."""
        cache = self._pipeline_cache_by_mode.get(include_sub_as_dst)
        if cache is None:
            cache = _build_pipeline_cache(self.manifest, include_sub_as_dst)
            self._pipeline_cache_by_mode[include_sub_as_dst] = cache
        return cache

    def word_replacements(self, return_df: bool = False) -> Dict[str, List[tuple]] | pd.DataFrame:
        """Return source->target replacement frequencies.

        Args:
            return_df: If True, returns a tabular DataFrame with
                columns `source_word`, `replaced_with`, `count`.
        """
        pipeline = self._get_pipeline_cache(include_sub_as_dst=False)
        if return_df:
            rows: List[dict] = []
            for src, dsts in pipeline.replacements.items():
                for dst, count in dsts:
                    rows.append({"source_word": src, "replaced_with": dst, "count": int(count)})
            return pd.DataFrame(rows, columns=["source_word", "replaced_with", "count"])
        return pipeline.replacements

    def word_replacement_examples(self, max_examples: Optional[int] = None) -> Dict[str, List[dict]]:
        """Return replacement examples grouped by `source|||target` key."""
        pipeline = self._get_pipeline_cache(include_sub_as_dst=False)
        if max_examples is None:
            return pipeline.replacement_examples
        return {k: v[:max_examples] for k, v in pipeline.replacement_examples.items()}

    def word_ops_stats(
        self,
        *,
        include_sub_as_dst: bool = False,
        return_df: bool = False,
    ) -> Dict[str, Dict[str, int]] | pd.DataFrame:
        """Aggregate INS/DEL/SUB counts per word across the manifest.

        Args:
            include_sub_as_dst: If True, also counts replacement target tokens
                into `sub_as_dst`.
            return_df: If True, returns a DataFrame; otherwise dict mapping.
        """
        pipeline = self._get_pipeline_cache(include_sub_as_dst=include_sub_as_dst)
        stats = pipeline.word_ops_stats

        if not return_df:
            return stats

        cols = ["word", "ins", "del", "sub"] + (["sub_as_dst"] if include_sub_as_dst else [])
        rows: List[dict] = []
        for word, d in stats.items():
            row = {
                "word": word,
                "ins": int(d.get("ins", 0)),
                "del": int(d.get("del", 0)),
                "sub": int(d.get("sub", 0)),
            }
            if include_sub_as_dst:
                row["sub_as_dst"] = int(d.get("sub_as_dst", 0))
            rows.append(row)
        if not rows:
            return pd.DataFrame(columns=cols)
        return pd.DataFrame(rows)[cols].sort_values("word").reset_index(drop=True)

    def word_error_examples(
        self,
        *,
        include_sub_as_dst: bool = False,
    ) -> Dict[str, Dict[str, List[dict]]]:
        """Return mapping word -> operation type -> list of manifest examples.

        Args:
            include_sub_as_dst: If True, replacement destination words are
                included in `sub` examples and marked with `is_sub_as_dst`.
        """
        pipeline = self._get_pipeline_cache(include_sub_as_dst=include_sub_as_dst)
        return pipeline.word_error_examples

    def word_quality_metrics(
        self,
        vocab_words: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Dict[str, float]]:
        """Per-word recall/precision/F1 aligned with ``word_ops_stats``."""
        pipeline = self._get_pipeline_cache(include_sub_as_dst=True)
        words: Dict[str, int] = dict(vocab_words or {})
        if not words:
            for word, ops in pipeline.word_ops_stats.items():
                words[word] = max(
                    int(pipeline.match_ref.get(word, 0) or 0)
                    + int(ops.get("del", 0) or 0)
                    + int(ops.get("sub", 0) or 0),
                    1,
                )
        result: Dict[str, Dict[str, float]] = {}
        for word, ref_count in words.items():
            if not word:
                continue
            result[word] = word_quality_metrics_for_word(
                word,
                int(ref_count or 0),
                match_ref=pipeline.match_ref,
                match_hyp=pipeline.match_hyp,
                word_ops=pipeline.word_ops_stats,
            )
        return result
