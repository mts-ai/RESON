"""Build JSON payload for the interactive single report (``ASRReportData`` contract).

Architecture
------------
1. :class:`reson.core.analysis.run.RESONRun` — domain data (manifest, metrics, vocab,
   replacements, summary).
2. :func:`reson.reporting.common.context.build_report_context` — precomputed slim UI context.
3. :class:`reson.core.analysis.vocab_scoring` — WIS and INS/DEL/SUB in ``RESONRun.vocab``.
4. :class:`reson.core.analysis.errors.ErrorAnalyzer` — ``error_examples`` for the UI only.
5. This module — **mapping** into the frontend ``window.RESON_DATA`` format.

Delegation to RESONRun
---------------------
Domain serialization can live on ``RESONRun`` / ``ReplaceVocabStats``, but payload shape
is tied to the React contract (alert colors, camelCase keys, diff_tokens). Normalization
dictionary and manifest UI views therefore stay in the reporting layer.

Public entry point: :func:`build_single_report_payload`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from reson.core.analysis.errors import ErrorAnalyzer
from reson.core.analysis.run import RESONRun
from reson.core.analysis.vocab_scoring import (
    asr_substitution_targets_for_word,
    ensure_run_vocab_enriched,
    word_scoring_from_vocab_record,
)
from reson.reporting.common.context import build_report_context
from reson.reporting.common.shared import (
    compute_f1_score_from_record,
    extract_float_value,
    extract_int_value,
    generate_word_diff_tokens,
    humanize_hours,
    is_missing_metric_value,
    optional_metric_float,
    optional_metric_int,
    duration_type_from_seconds,
)

# Short module-local aliases (no extra public wrappers).
_as_float = extract_float_value
_as_int = extract_int_value

_DURATION_UI_LABELS: Tuple[Tuple[str, str], ...] = (
    ("short", "Короткие (<5s)"),
    ("normal", "Средние (5-30s)"),
    ("long", "Длинные (30+s)"),
)

_ADDITIONAL_METRIC_NAMES = ("CER", "LER", "WER_H")


@dataclass(frozen=True)
class _PayloadInputs:
    """Input bundle shared across payload sections."""

    reson_run: RESONRun
    base_ctx: Dict[str, Any]
    error_analyzer: Optional[ErrorAnalyzer]


def _resolve_inputs(
    reson_run: RESONRun,
    base_ctx: Optional[Dict[str, Any]],
    error_analyzer: Optional[ErrorAnalyzer] = None,
) -> _PayloadInputs:
    reson_run = ensure_run_vocab_enriched(reson_run)
    analyzer = ErrorAnalyzer(reson_run.manifest) if error_analyzer is None else error_analyzer
    ctx = base_ctx if base_ctx is not None else build_report_context(reson_run, error_analyzer=analyzer)
    return _PayloadInputs(reson_run=reson_run, base_ctx=ctx, error_analyzer=analyzer)


def _metrics_dataframe(base_ctx: Dict[str, Any]):
    metrics_df = base_ctx.get("metrics")
    if metrics_df is None or not hasattr(metrics_df, "reset_index"):
        return None
    return metrics_df.reset_index()


def _infer_duration_type(rec: Dict[str, Any]) -> str:
    dt = rec.get("duration_type")
    if dt in ("short", "normal", "long"):
        return dt
    duration = _as_float(rec.get("duration"), 0.0)
    if duration <= 5:
        return "short"
    if duration <= 30:
        return "normal"
    return "long"


def _format_total_hours(info: Dict[str, Any]) -> str:
    total_hours = info.get("Number of hours")
    if isinstance(total_hours, str):
        if ":" in total_hours or "ч" in total_hours:
            return total_hours
        try:
            return humanize_hours(float(total_hours))
        except Exception:
            return total_hours
    if isinstance(total_hours, (int, float)):
        return humanize_hours(float(total_hours))
    return "н/д"


def _build_wer_metric(base_ctx: Dict[str, Any], metrics_df) -> Dict[str, Any]:
    wer_val = base_ctx.get("wer")
    if metrics_df is not None:
        try:
            wer_row = metrics_df[metrics_df["index"] == "WER"]
            if not wer_row.empty:
                row = wer_row.iloc[0]
                return {
                    "value": _as_float(row.get("VALUE"), wer_val or 0.0),
                    "mean": _as_float(row.get("mean_value"), wer_val or 0.0),
                    "std": _as_float(row.get("sd"), 0.0),
                    "deletions": _as_int(row.get("DEL"), 0),
                    "insertions": _as_int(row.get("INS"), 0),
                    "substitutions": _as_int(row.get("SUB"), 0),
                    "total_words": _as_int(row.get("LEN"), 0),
                }
        except Exception:
            pass
    info = base_ctx.get("info", {}) or {}
    return {
        "value": _as_float(wer_val, 0.0),
        "mean": _as_float(wer_val, 0.0),
        "std": 0.0,
        "deletions": _as_int(base_ctx.get("errors_del_total"), 0),
        "insertions": _as_int(base_ctx.get("errors_ins_total"), 0),
        "substitutions": _as_int(base_ctx.get("errors_sub_total"), 0),
        "total_words": _as_int(info.get("Number of words", 0), 0),
    }


def _build_metrics_block(base_ctx: Dict[str, Any]) -> Dict[str, Any]:
    metrics_df = _metrics_dataframe(base_ctx)
    wer_metric = _build_wer_metric(base_ctx, metrics_df)
    additional_metrics: List[Dict[str, Any]] = []
    run_metrics_table: List[Dict[str, Any]] = []
    if metrics_df is not None:
        try:
            for metric_name in _ADDITIONAL_METRIC_NAMES:
                metric_row = metrics_df[metrics_df["index"] == metric_name]
                if not metric_row.empty:
                    row = metric_row.iloc[0]
                    additional_metrics.append({
                        "name": metric_name,
                        "value": _as_float(row.get("VALUE"), 0.0),
                        "mean": _as_float(row.get("mean_value"), 0.0),
                        "std": _as_float(row.get("sd"), 0.0),
                    })
            for _, row in metrics_df.iterrows():
                idx_name = row.get("index", None)
                if idx_name is None or is_missing_metric_value(idx_name):
                    continue
                run_metrics_table.append({
                    "index": str(idx_name),
                    "VALUE": optional_metric_float(row.get("VALUE")),
                    "mean_value": optional_metric_float(row.get("mean_value")),
                    "sd": optional_metric_float(row.get("sd")),
                    "DEL": _as_int(row.get("DEL"), 0),
                    "INS": _as_int(row.get("INS"), 0),
                    "SUB": optional_metric_int(row.get("SUB")),
                    "EQ": optional_metric_int(row.get("EQ")),
                    "LEN": _as_int(row.get("LEN"), 0),
                    "NOM": optional_metric_float(row.get("NOM")),
                })
        except Exception:
            pass
    return {
        "wer": wer_metric,
        "additional": additional_metrics,
        "runTable": run_metrics_table,
    }


def _build_summary(base_ctx: Dict[str, Any]) -> Dict[str, Any]:
    info = base_ctx.get("info", {}) or {}
    duration_type_counts = base_ctx.get("duration_type_counts", {}) or {}
    summary: Dict[str, Any] = {
        "totalHours": _format_total_hours(info),
        "totalUtterances": _as_int(info.get("Number of utterances"), 0),
        "durationTypes": {
            "short": _as_int(duration_type_counts.get("short", 0), 0),
            "normal": _as_int(duration_type_counts.get("normal", 0), 0),
            "long": _as_int(duration_type_counts.get("long", 0), 0),
        },
        "durationStats": {},
        "vocabularySize": (
            info.get("Vocabulary size", "0 words")
            if isinstance(info.get("Vocabulary size"), str)
            else f"{_as_int(info.get('Vocabulary size', 0), 0)} words"
        ),
        "alphabetSize": (
            info.get("Alphabet size", "0 chars")
            if isinstance(info.get("Alphabet size"), str)
            else (
                f"{len(base_ctx.get('ru_alphabet', []) or []) + len(base_ctx.get('en_alphabet', []) or []) + len(base_ctx.get('num_alphabet', []) or []) + len(base_ctx.get('other_alphabet', []) or [])} chars"
            )
        ),
        "uniqueChars": (base_ctx.get("ru_alphabet", []) or [])
        + (base_ctx.get("en_alphabet", []) or [])
        + (base_ctx.get("num_alphabet", []) or [])
        + (base_ctx.get("other_alphabet", []) or []),
        "normalized": base_ctx.get("normalize_used", False),
        "normalizationConfig": base_ctx.get("normalize_cfg") or {},
        "replacementsTotal": _as_int(
            base_ctx.get("replacement_fields", {}).get("total", 0)
            if isinstance(base_ctx.get("replacement_fields"), dict)
            else 0,
            0,
        ),
    }
    try:
        dur_info = info.get("Duration info", {}) or {}
        if dur_info and isinstance(dur_info, dict):
            p95 = dur_info.get("95%")
            if p95 is None:
                p75 = dur_info.get("75%")
                p95 = float(p75) * 1.2 if p75 is not None else dur_info.get("max", 0)
            summary["durationStats"] = {
                "mean": _as_float(dur_info.get("mean")),
                "std": _as_float(dur_info.get("std")),
                "min": _as_float(dur_info.get("min")),
                "25%": _as_float(dur_info.get("25%")),
                "50%": _as_float(dur_info.get("50%")),
                "75%": _as_float(dur_info.get("75%")),
                "95%": _as_float(p95),
                "max": _as_float(dur_info.get("max")),
            }
    except Exception:
        pass
    return summary


def _sum_ins_del_sub(recs: List[Dict[str, Any]]) -> Tuple[int, int, int]:
    ins = sum(_as_int(r.get("INS"), 0) for r in recs)
    dele = sum(_as_int(r.get("DEL"), 0) for r in recs)
    sub = sum(_as_int(r.get("SUB"), 0) for r in recs)
    return ins, dele, sub


def _build_heatmap_data(manifest_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    heatmap_data: List[Dict[str, Any]] = []
    try:
        for duration_type, label in _DURATION_UI_LABELS:
            subset = [r for r in manifest_records if _infer_duration_type(r) == duration_type]
            if not subset:
                heatmap_data.append({
                    "duration": label,
                    "insertions": {"top10": 0, "p80_90": 0, "below80": 0},
                    "deletions": {"top10": 0, "p80_90": 0, "below80": 0},
                    "substitutions": {"top10": 0, "p80_90": 0, "below80": 0},
                })
                continue
            sorted_by_wer = sorted(subset, key=lambda r: -_as_float(r.get("WER"), 0))
            n = len(sorted_by_wer)
            idx_top10 = max(1, math.ceil(n * 0.10))
            idx_p80_90 = max(idx_top10 + 1, math.ceil(n * 0.20))
            ins_t10, del_t10, sub_t10 = _sum_ins_del_sub(sorted_by_wer[:idx_top10])
            ins_p, del_p, sub_p = _sum_ins_del_sub(sorted_by_wer[idx_top10:idx_p80_90])
            ins_b, del_b, sub_b = _sum_ins_del_sub(sorted_by_wer[idx_p80_90:])
            heatmap_data.append({
                "duration": label,
                "insertions": {"top10": ins_t10, "p80_90": ins_p, "below80": ins_b},
                "deletions": {"top10": del_t10, "p80_90": del_p, "below80": del_b},
                "substitutions": {"top10": sub_t10, "p80_90": sub_p, "below80": sub_b},
            })
    except Exception:
        pass
    return heatmap_data


def _build_vocab_entries(inputs: _PayloadInputs) -> List[Dict[str, Any]]:
    vocab: List[Dict[str, Any]] = []
    try:
        vocab_records = inputs.reson_run.vocab.data.to_dict(orient="records")
        word_error_examples: Dict[str, Any] = {}
        word_replacements: Dict[str, Any] = {}
        if inputs.error_analyzer is not None:
            try:
                word_error_examples = inputs.error_analyzer.word_error_examples(include_sub_as_dst=False)
                word_replacements = inputs.error_analyzer.word_replacements(return_df=False)
            except Exception:
                word_error_examples = {}
                word_replacements = {}

        for idx, rec in enumerate(vocab_records, 1):
            word = str(rec.get("word", "")).strip()
            if not word:
                continue
            error_examples = word_error_examples.get(word, {})
            scoring = word_scoring_from_vocab_record(rec)
            vocab.append({
                "rank": idx,
                "word": word,
                "count": _as_int(rec.get("count"), 0),
                "recall": _as_float(rec.get("recall"), 0.0),
                "precision": _as_float(rec.get("precision"), 0.0),
                "f1_score": compute_f1_score_from_record(rec),
                **scoring,
                "asrSubstitutionTargets": asr_substitution_targets_for_word(
                    word,
                    word_replacements,
                    error_examples_sub=error_examples.get("sub", []),
                ),
                "error_examples": {
                    "deletions": error_examples.get("del", []),
                    "insertions": error_examples.get("ins", []),
                    "substitutions": error_examples.get("sub", []),
                },
            })
    except Exception:
        pass
    return vocab


def _build_model_replacements(inputs: _PayloadInputs) -> Dict[str, Any]:
    replacements_vocab: List[Dict[str, Any]] = []
    replacements_examples: List[Dict[str, Any]] = []
    try:
        if inputs.error_analyzer is None:
            raise RuntimeError("ErrorAnalyzer is unavailable")
        word_replacements_dict = inputs.error_analyzer.word_replacements(return_df=False)
        word_replacements_examples = inputs.error_analyzer.word_replacement_examples(max_examples=100)
        for source_word, replacements_list in word_replacements_dict.items():
            if not source_word or not replacements_list:
                continue
            variants_with_counts = []
            total_count = 0
            for replaced_with, count in replacements_list:
                if replaced_with and replaced_with != source_word:
                    variants_with_counts.append({"word": replaced_with, "count": count})
                    total_count += count
            if variants_with_counts and total_count > 0:
                variants_with_counts.sort(key=lambda x: x["count"], reverse=True)
                replacements_vocab.append({
                    "original": source_word,
                    "variants": [v["word"] for v in variants_with_counts],
                    "variantsWithCounts": variants_with_counts,
                    "count": total_count,
                })
        for key, examples_list in word_replacements_examples.items():
            if "|||" not in key:
                continue
            source_word, target_word = key.split("|||", 1)
            for example in examples_list:
                replacements_examples.append({
                    "sampleId": str(example.get("audio_filepath", "")),
                    "field": "text",
                    "found": source_word,
                    "replaced": target_word,
                })
    except Exception:
        pass
    return {
        "vocab": replacements_vocab,
        "examples": replacements_examples,
        "stats": {
            "totalReplacements": sum(item.get("count", 0) for item in replacements_vocab),
            "byField": {},
        },
    }


def _build_quality_zones(manifest_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    quality_zones = {
        "excellent": {"count": 0, "percentage": 0.0},
        "good": {"count": 0, "percentage": 0.0},
        "poor": {"count": 0, "percentage": 0.0},
    }
    try:
        total = len(manifest_records)
        if total > 0:
            excellent = sum(1 for r in manifest_records if _as_float(r.get("WER"), 100) < 5)
            good = sum(1 for r in manifest_records if 5 <= _as_float(r.get("WER"), 100) < 15)
            poor = total - excellent - good
            quality_zones = {
                "excellent": {"count": excellent, "percentage": round(excellent / total * 100, 1)},
                "good": {"count": good, "percentage": round(good / total * 100, 1)},
                "poor": {"count": poor, "percentage": round(poor / total * 100, 1)},
            }
    except Exception:
        pass
    return quality_zones


def _build_manifest_ui(manifest_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    manifest: List[Dict[str, Any]] = []
    try:
        for rec in manifest_records:
            duration = _as_float(rec.get("duration"), 0.0)
            reference_text = str(rec.get("text", ""))
            hypothesis_text = str(rec.get("prediction", ""))
            try:
                diff_tokens = generate_word_diff_tokens(reference_text, hypothesis_text)
            except Exception:
                diff_tokens = []
            manifest.append({
                "audio_filepath": str(rec.get("audio_filepath", "")),
                "duration": duration,
                "text": reference_text,
                "prediction": hypothesis_text,
                "WER": _as_float(rec.get("WER"), 0.0),
                "CER": optional_metric_float(rec.get("CER")),
                "LER": optional_metric_float(rec.get("LER")),
                "WER_H": optional_metric_float(rec.get("WER_H")),
                "INS": _as_int(rec.get("INS"), 0),
                "DEL": _as_int(rec.get("DEL"), 0),
                "SUB": _as_int(rec.get("SUB"), 0),
                "duration_type": duration_type_from_seconds(duration),
                "diff_tokens": diff_tokens,
            })
    except Exception:
        pass
    return manifest


def _build_normalization_dictionary(reson_run: RESONRun) -> Optional[Dict[str, Any]]:
    """Normalization dictionary (REF/HYP rules), not model replacements."""
    if not reson_run.replacements:
        return None
    try:
        examples_dict = reson_run.replacements.examples if hasattr(reson_run.replacements, "examples") else {}
        field_counts: Dict[Tuple[str, str], Dict[str, int]] = {}
        for _row_idx_str, examples_list in (examples_dict or {}).items():
            for ex in examples_list or []:
                if isinstance(ex, list) and len(ex) >= 3:
                    field, source, target = ex[0], ex[1], ex[2]
                    key = (target, source)
                    field_counts.setdefault(key, {"text": 0, "prediction": 0})
                    if field == "text":
                        field_counts[key]["text"] += 1
                    elif field == "prediction":
                        field_counts[key]["prediction"] += 1

        norm_vocab = []
        vocab_dict = reson_run.replacements.vocab if hasattr(reson_run.replacements, "vocab") else {}
        words_dict = reson_run.replacements.words if hasattr(reson_run.replacements, "words") else {}
        for target, sources in vocab_dict.items():
            rule_count = 0
            source_details = []
            for src in sources:
                c = words_dict.get(src, 0)
                rule_count += c
                counts = field_counts.get((target, src), {"text": 0, "prediction": 0})
                ct, cp = counts.get("text", 0), counts.get("prediction", 0)
                if ct == 0 and cp == 0 and c > 0:
                    ct = c
                source_details.append({
                    "word": src,
                    "count": c,
                    "countText": ct,
                    "countPrediction": cp,
                })
            source_details.sort(key=lambda x: x["count"], reverse=True)
            norm_vocab.append({"target": target, "sources": source_details, "count": rule_count})
        norm_vocab.sort(key=lambda x: x["count"], reverse=True)

        norm_examples = []
        if examples_dict:
            for row_idx_str, examples_list in examples_dict.items():
                try:
                    row_idx = int(row_idx_str)
                    audio_filepath = str(row_idx)
                    if hasattr(reson_run.manifest, "iloc") and 0 <= row_idx < len(reson_run.manifest):
                        rec = reson_run.manifest.iloc[row_idx]
                        audio_filepath = str(rec.get("audio_filepath", row_idx))
                    for ex in examples_list:
                        if isinstance(ex, list) and len(ex) >= 3:
                            field, source, target = ex[0], ex[1], ex[2]
                            norm_examples.append({
                                "sampleId": audio_filepath,
                                "field": field,
                                "found": source,
                                "replaced": target,
                            })
                except Exception:
                    continue
        return {
            "vocab": norm_vocab,
            "examples": norm_examples,
            "stats": {
                "totalReplacements": sum(words_dict.values()),
                "byField": reson_run.replacements.fields if hasattr(reson_run.replacements, "fields") else {},
            },
        }
    except Exception:
        return None


def _build_top_error_words(base_ctx: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    top_error_words: Dict[str, List[Dict[str, Any]]] = {
        "insertions": [],
        "deletions": [],
        "substitutions": [],
    }
    try:
        ops = base_ctx.get("word_ops_stats") or {}
        if not isinstance(ops, dict):
            return top_error_words
        ins_items: List[Tuple[str, int]] = []
        del_items: List[Tuple[str, int]] = []
        sub_items: List[Tuple[str, int]] = []
        for w, d in ops.items():
            if not isinstance(d, dict):
                continue
            ins = int(d.get("ins") or d.get("INS") or 0)
            dele = int(d.get("del") or d.get("DEL") or 0)
            sub = int(d.get("sub") or d.get("SUB") or 0)
            word = str(w).strip()
            if ins:
                ins_items.append((word, ins))
            if dele:
                del_items.append((word, dele))
            if sub:
                sub_items.append((word, sub))
        ins_items.sort(key=lambda x: -x[1])
        del_items.sort(key=lambda x: -x[1])
        sub_items.sort(key=lambda x: -x[1])
        top_error_words["insertions"] = [{"word": w, "count": c} for w, c in ins_items[:10]]
        top_error_words["deletions"] = [{"word": w, "count": c} for w, c in del_items[:10]]
        top_error_words["substitutions"] = [{"word": w, "count": c} for w, c in sub_items[:10]]
    except Exception:
        pass
    return top_error_words


def _infer_json_type(val: Any) -> str:
    if val is None:
        return "null"
    if isinstance(val, bool):
        return "boolean"
    if isinstance(val, int):
        return "integer"
    if isinstance(val, float):
        return "number"
    if isinstance(val, str):
        return "string"
    if isinstance(val, list):
        return "array"
    if isinstance(val, dict):
        return "object"
    return type(val).__name__


def _build_run_info(
    base_ctx: Dict[str, Any],
    *,
    has_normalization_dictionary: bool = False,
) -> Dict[str, Any]:
    run_info: Dict[str, Any] = {
        "runName": base_ctx.get("run_name") or "ASR Report",
        "createdAt": base_ctx.get("created_at") or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "recordCount": len(base_ctx.get("manifest_records") or []),
        "normalized": bool(base_ctx.get("normalize_used", False)),
        "hasNormalizationDictionary": bool(has_normalization_dictionary),
        "metricProvider": base_ctx.get("provider_name") or "",
        "meta": base_ctx.get("meta_info") or {},
        "manifestSchema": {},
        "normalizeCfg": base_ctx.get("normalize_cfg") or {},
    }
    try:
        records = base_ctx.get("manifest_records") or []
        if records and isinstance(records[0], dict):
            run_info["manifestSchema"] = {str(k): _infer_json_type(v) for k, v in records[0].items()}
    except Exception:
        pass
    return run_info


def _build_alerts_ui(base_ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    alerts_ui: List[Dict[str, Any]] = []
    severity_to_color = {
        "error": "text-[#EF4444]",
        "warning": "text-[#FFB300]",
        "info": "text-[#2196F3]",
    }
    kind_to_color = {
        "Suspect metrics": "text-[#9C27B0]",
        "Duration": "text-[#2196F3]",
        "Coverage": "text-[#00BCD4]",
        "Performance": "text-[#4CAF50]",
        "Missing Values": "text-[#EF4444]",
        "Empty": "text-[#EF4444]",
    }
    try:
        for alert in base_ctx.get("alerts") or []:
            if not isinstance(alert, dict):
                continue
            severity = (alert.get("severity") or "info").lower()
            if severity not in ("error", "warning", "info"):
                severity = "info"
            entity = (alert.get("entity") or "manifest").lower()
            source = "dictionary" if entity == "vocab" else entity
            if source not in ("manifest", "dictionary", "metrics"):
                source = "manifest"
            kind = alert.get("kind") or "General"
            category_color = kind_to_color.get(kind) or severity_to_color.get(severity, "text-[#2196F3]")
            msg = alert.get("message") or ""
            payload = alert.get("data") if isinstance(alert.get("data"), dict) else None
            alerts_ui.append({
                "id": alert.get("code") or f"alert-{len(alerts_ui)}",
                "code": alert.get("code"),
                "type": severity,
                "severity": severity,
                "source": source,
                "category": kind,
                "categoryColor": category_color,
                "title": msg,
                "description": "",
                "details": "",
                "payload": payload,
            })
    except Exception:
        return []
    return alerts_ui


def build_single_report_payload(
    reson_run: RESONRun,
    base_ctx: Optional[Dict[str, Any]] = None,
    error_analyzer: Optional[ErrorAnalyzer] = None,
) -> Dict[str, Any]:
    """Build ``ASRReportData`` payload for the single_report frontend.

    Args:
        reson_run: Analysis result.
        base_ctx: Prebuilt report context (otherwise ``build_report_context`` is called).
        error_analyzer: Reusable error analyzer (otherwise created from the manifest).
    """
    inputs: _PayloadInputs = _resolve_inputs(reson_run, base_ctx, error_analyzer)
    ctx = inputs.base_ctx
    manifest_records = ctx.get("manifest_records", []) or []
    vocab = _build_vocab_entries(inputs)
    normalization_dictionary = _build_normalization_dictionary(reson_run)
    has_normalization_dictionary = bool(
        normalization_dictionary and normalization_dictionary.get("vocab")
    )

    return {
        "name": ctx.get("run_name", "ASR Report"),
        "metrics": _build_metrics_block(ctx),
        "summary": _build_summary(ctx),
        "heatmapData": _build_heatmap_data(manifest_records),
        "vocab": vocab,
        "dictionary": {
            "metrics": {
                "meanRecall": _as_float(ctx.get("vocab_mean_recall"), 0.0),
                "meanPrecision": _as_float(ctx.get("vocab_mean_precision"), 0.0),
                "meanF1Score": _as_float(ctx.get("vocab_mean_f1score"), 0.0),
            },
            "totals": {
                "total": _as_int(ctx.get("vocab_total_words"), len(vocab)),
                "russian": _as_int(ctx.get("vocab_russian_size"), 0),
                "english": _as_int(ctx.get("vocab_english_size"), 0),
                "numbers": _as_int(ctx.get("vocab_numeric_size"), 0),
                "other": _as_int(ctx.get("vocab_other_size"), 0),
            },
            "replacements": normalization_dictionary,
        },
        "replacements": _build_model_replacements(inputs),
        "qualityZones": _build_quality_zones(manifest_records),
        "manifest": _build_manifest_ui(manifest_records),
        "topErrorWords": _build_top_error_words(ctx),
        "runInfo": _build_run_info(
            ctx,
            has_normalization_dictionary=has_normalization_dictionary,
        ),
        "alerts": _build_alerts_ui(ctx),
    }
