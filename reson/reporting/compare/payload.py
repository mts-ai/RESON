"""Build JSON payload for the interactive compare report (``window.RESON_DATA`` contract).

Architecture
------------
1. :class:`reson.core.analysis.run.RESONRun` — metrics, manifest, and vocab per model.
2. :func:`reson.core.analysis.compare.compare_runs` — pairwise comparisons and bootstrap.
3. :class:`reson.core.analysis.vocab_scoring` — WIS and INS/DEL/SUB in ``RESONRun.vocab``.
4. This module — **presentation mapping** into the React compare_report format.

Delegation to RESONRun
---------------------
Run-level aggregates (WER, MWA, summary) are read from ``RESONRun``; pairwise statistics
flow through ``RESONComparison``. Keep payload out of core: the UI format (camelCase,
diff_tokens, pairwiseComparisons) is frontend-specific.

Public entry point: :func:`build_compare_report_payload`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from reson.core.analysis.compare import RESONComparison, compare_runs
from reson.core.analysis.errors import ErrorAnalyzer
from reson.core.analysis.run import RESONRun
from reson.core.analysis.vocab_scoring import (
    ensure_run_vocab_enriched,
    extract_word_type,
    replacement_targets_from_run,
    word_scoring_from_vocab_record,
)
from reson.reporting.common.shared import (
    compute_f1_score_from_vocab,
    duration_type_from_seconds,
    extract_float_value,
    extract_int_value,
    format_hours_to_hhmmss,
    generate_word_diff_tokens,
    is_missing_metric_value,
    normalize_duration_value,
)
from reson.reporting.single.payload import _build_normalization_dictionary

_as_int = extract_int_value
_as_float = extract_float_value

_MANIFEST_KEY_CANDIDATES = ("audio_filepath", "audio_file", "filepath", "file_path")
_REFERENCE_FIELDS = ("text", "reference", "transcript")
_HYPOTHESIS_FIELDS = ("prediction", "hypothesis", "hyp")
_OPTIONAL_METRIC_NAMES = ("WER_H", "LER", "CER")


def _prepare_metrics_index(reson_run: RESONRun) -> pd.DataFrame:
    metrics_df = reson_run.metrics.copy()
    if not metrics_df.empty and "index" in metrics_df.columns:
        metrics_df = metrics_df.set_index("index")
    return metrics_df


def _series_optional_float(row: Any, key: str = "VALUE") -> Optional[float]:
    try:
        value = row.get(key) if hasattr(row, "get") else (row[key] if key in row else None)
        if is_missing_metric_value(value):
            return None
        return float(value)
    except (KeyError, ValueError, TypeError):
        return None


def _series_optional_int(row: Any, key: str, default: int = 0) -> int:
    try:
        if hasattr(row, "get"):
            return int(row.get(key, default) or default)
        return int(row.get(key, default) if key in row else default) or default
    except (KeyError, ValueError, TypeError):
        return default


def _all_model_pairs(model_names: List[str]) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    for i, left in enumerate(model_names):
        for j, right in enumerate(model_names):
            if i < j:
                pairs.append((left, right))
    return pairs


def _build_model_overview(reson_run: RESONRun) -> Dict[str, Any]:
    """WER/MWA/decomposition summary for one model (``overviewData`` entry)."""
    metrics_df = _prepare_metrics_index(reson_run)
    wer_metric = metrics_df.loc["WER"] if not metrics_df.empty and "WER" in metrics_df.index else None

    wer_value = _series_optional_float(wer_metric) if wer_metric is not None else None
    wer_value = wer_value if wer_value is not None else 0.0

    ins_count = del_count = sub_count = 0
    if wer_metric is not None:
        ins_count = _series_optional_int(wer_metric, "INS", 0)
        del_count = _series_optional_int(wer_metric, "DEL", 0)
        sub_count = _series_optional_int(wer_metric, "SUB", 0)

    total_errors = ins_count + del_count + sub_count
    if total_errors > 0:
        ins_pct = (ins_count / total_errors) * 100.0
        del_pct = (del_count / total_errors) * 100.0
        sub_pct = (sub_count / total_errors) * 100.0
    else:
        ins_pct = del_pct = sub_pct = 0.0

    mwa_value = reson_run.vocab.mean_recall
    mwa_value = float(mwa_value) if mwa_value is not None else 0.0

    optional_metrics: Dict[str, float] = {}
    for metric_name, payload_key in zip(_OPTIONAL_METRIC_NAMES, ("wer_h", "ler", "cer")):
        if metrics_df.empty or metric_name not in metrics_df.index:
            continue
        value = _series_optional_float(metrics_df.loc[metric_name])
        if value is not None:
            optional_metrics[payload_key] = value

    return {
        "wer": wer_value,
        "mwa": mwa_value,
        "decomposition": {
            "insertions": ins_pct,
            "deletions": del_pct,
            "substitutions": sub_pct,
            "insertionsCount": ins_count,
            "deletionsCount": del_count,
            "substitutionsCount": sub_count,
        },
        "optionalMetrics": optional_metrics,
        "timestamp": reson_run.meta.get("timestamp", datetime.now().isoformat()),
        "checkpoint": reson_run.meta.get("checkpoint"),
    }


def _collect_vocab_auxiliary(
    reson_runs: List[RESONRun],
    model_names: List[str],
) -> Tuple[set, Dict[str, pd.DataFrame], Dict[str, Dict[str, List]], Dict[str, Dict[str, Any]]]:
    all_words: set = set()
    vocab_by_model: Dict[str, pd.DataFrame] = {}
    replacements_by_model: Dict[str, Dict[str, List]] = {}
    error_examples_by_model: Dict[str, Dict[str, Any]] = {}

    for reson_run, model_name in zip(reson_runs, model_names):
        enriched_run = ensure_run_vocab_enriched(reson_run)
        vocab_df = enriched_run.vocab.data.copy()
        vocab_by_model[model_name] = vocab_df
        if not vocab_df.empty and "word" in vocab_df.columns:
            all_words.update(vocab_df["word"].dropna().unique())
        replacements_by_model[model_name] = replacement_targets_from_run(enriched_run)
        try:
            error_examples_by_model[model_name] = ErrorAnalyzer(
                enriched_run.manifest
            ).word_error_examples(include_sub_as_dst=False)
        except Exception:
            error_examples_by_model[model_name] = {}

    return all_words, vocab_by_model, replacements_by_model, error_examples_by_model


def _substituted_by_map(replacements: List[Dict[str, Any]]) -> Optional[Dict[str, int]]:
    substituted_by: Dict[str, int] = {}
    for repl in replacements:
        target = repl.get("target", "")
        repl_count = int(repl.get("count", 0) or 0)
        if target and repl_count > 0:
            substituted_by[target] = substituted_by.get(target, 0) + repl_count
    return substituted_by or None


def _build_vocabulary_data(
    reson_runs: List[RESONRun],
    model_names: List[str],
) -> List[Dict[str, Any]]:
    all_words, vocab_by_model, replacements_by_model, error_examples_by_model = _collect_vocab_auxiliary(
        reson_runs, model_names
    )
    vocabulary: List[Dict[str, Any]] = []

    for word in all_words:
        if pd.isna(word) or not word:
            continue
        word_str = str(word)
        word_type = extract_word_type(word_str)
        model_metrics: Dict[str, Any] = {}
        max_frequency = 0

        for _reson_run, model_name in zip(reson_runs, model_names):
            vocab_df = vocab_by_model[model_name]
            if vocab_df.empty or "word" not in vocab_df.columns:
                continue
            word_rows = vocab_df[vocab_df["word"] == word]
            if word_rows.empty:
                continue
            row = word_rows.iloc[0]
            try:
                count = int(row.get("count", 0) or 0)
                recall = _as_float(row.get("recall"), 0.0) if not pd.isna(row.get("recall")) else 0.0
                precision = _as_float(row.get("precision"), 0.0) if not pd.isna(row.get("precision")) else 0.0
                f1_score = compute_f1_score_from_vocab(
                    recall,
                    precision,
                    _as_float(row.get("f1_score"), 0.0) if not pd.isna(row.get("f1_score")) else 0.0,
                )
                replacements = replacements_by_model.get(model_name, {}).get(word_str, [])
                scoring = word_scoring_from_vocab_record(row.to_dict())
                max_frequency = max(max_frequency, count)
                word_error_examples = error_examples_by_model.get(model_name, {}).get(word_str, {})
                model_metrics[model_name] = {
                    "recall": round(recall, 2),
                    "precision": round(precision, 2),
                    "f1Score": round(f1_score, 2),
                    "wis": scoring["wis"],
                    "wisComponents": scoring["wisComponents"],
                    "insertions": scoring["insertions"],
                    "deletions": scoring["deletions"],
                    "substitutions": scoring["substitutions"],
                    "substitutedBy": _substituted_by_map(replacements),
                    "errorExamples": {
                        "deletions": word_error_examples.get("del", []),
                        "insertions": word_error_examples.get("ins", []),
                        "substitutions": word_error_examples.get("sub", []),
                    },
                }
            except (ValueError, TypeError, KeyError):
                continue

        if model_metrics:
            vocabulary.append({
                "word": word_str,
                "frequency": max_frequency,
                "type": word_type,
                "modelMetrics": model_metrics,
            })

    vocabulary.sort(key=lambda x: x["frequency"], reverse=True)
    return vocabulary


def _manifest_join_key(manifest: pd.DataFrame) -> str:
    for field in _MANIFEST_KEY_CANDIDATES:
        if field in manifest.columns:
            return field
    return manifest.index.name or "index"


def _first_non_empty_field(row: Any, fields: Tuple[str, ...]) -> str:
    for field in fields:
        if field in row:
            val = row[field]
            if val is not None and not pd.isna(val):
                return str(val or "")
    return ""


def _row_metric_float(row: Any, column: str) -> float:
    if column not in row:
        return 0.0
    try:
        val = row[column]
        if val is not None and not pd.isna(val):
            return float(val)
    except (ValueError, TypeError):
        pass
    return 0.0


def _row_metric_int(row: Any, column: str) -> int:
    if column not in row:
        return 0
    try:
        val = row[column]
        if val is not None and not pd.isna(val):
            return int(val)
    except (ValueError, TypeError):
        pass
    return 0


def _build_aligned_samples(
    reson_runs: List[RESONRun],
    model_names: List[str],
) -> List[Dict[str, Any]]:
    if not reson_runs:
        return []

    base_manifest = reson_runs[0].manifest.copy()
    if base_manifest.empty:
        return []

    key_field = _manifest_join_key(base_manifest)
    samples: List[Dict[str, Any]] = []

    for idx, row in base_manifest.iterrows():
        try:
            key_value = str(row[key_field]) if key_field in row else str(idx)
            if not key_value:
                continue

            sample_data: Dict[str, Any] = {
                "id": f"sample-{idx}",
                "file_path": key_value,
                "duration": _row_metric_float(row, "duration"),
                "reference": _first_non_empty_field(row, _REFERENCE_FIELDS),
                "results": {},
            }

            for reson_run, model_name in zip(reson_runs, model_names):
                manifest = reson_run.manifest.copy()
                if manifest.empty:
                    continue
                if key_field in manifest.columns:
                    matching_rows = manifest[manifest[key_field] == key_value]
                elif idx in manifest.index:
                    matching_rows = manifest.loc[[idx]]
                else:
                    continue
                if matching_rows.empty:
                    continue

                result_row = matching_rows.iloc[0]
                reference = _first_non_empty_field(result_row, _REFERENCE_FIELDS) or sample_data["reference"]
                hypothesis = _first_non_empty_field(result_row, _HYPOTHESIS_FIELDS)
                sample_data["results"][model_name] = {
                    "reference": reference,
                    "hypothesis": hypothesis,
                    "wer": _row_metric_float(result_row, "WER"),
                    "cer": _row_metric_float(result_row, "CER"),
                    "insertions": _row_metric_int(result_row, "INS"),
                    "deletions": _row_metric_int(result_row, "DEL"),
                    "substitutions": _row_metric_int(result_row, "SUB"),
                    "words": [],
                    "metadata": {},
                }

            if sample_data["results"]:
                samples.append(sample_data)
        except Exception as exc:
            print(f"Warning: Skipping sample {idx} due to error: {exc}")
    return samples


def _build_pairwise_comparisons(
    reson_runs: List[RESONRun],
    model_names: List[str],
    pairs_to_compute: Optional[List[Tuple[str, str]]] = None,
) -> Dict[str, RESONComparison]:
    comparisons: Dict[str, RESONComparison] = {}
    model_index_map = {name: idx for idx, name in enumerate(model_names)}
    pairs = pairs_to_compute if pairs_to_compute is not None else _all_model_pairs(model_names)

    for model1_name, model2_name in pairs:
        idx1 = model_index_map.get(model1_name)
        idx2 = model_index_map.get(model2_name)
        if idx1 is None or idx2 is None:
            continue
        pair_key = f"{model1_name}_vs_{model2_name}"
        try:
            comparisons[pair_key] = compare_runs(reson_runs[idx1], reson_runs[idx2])
        except Exception as exc:
            print(f"Warning: Could not build comparison for {pair_key}: {exc}")
    return comparisons


def _build_statistical_significance(
    reson_runs: List[RESONRun],
    model_names: List[str],
    num_bootstraps: int,
    alpha: float,
    pairs_to_compute: List[Tuple[str, str]],
    pairwise_comparisons: Dict[str, RESONComparison],
) -> Dict[str, Any]:
    significance_data: Dict[str, Any] = {}
    model_index_map = {name: idx for idx, name in enumerate(model_names)}

    for model1_name, model2_name in pairs_to_compute:
        if model1_name not in model_index_map or model2_name not in model_index_map:
            print(f"Warning: Model names not found: {model1_name} or {model2_name}")
            continue
        try:
            pair_key = f"{model1_name}_vs_{model2_name}"
            comparison = pairwise_comparisons.get(pair_key)
            if comparison is None:
                comparison = compare_runs(
                    reson_runs[model_index_map[model1_name]],
                    reson_runs[model_index_map[model2_name]],
                )
            sig_result = comparison.compute_significance(num_bootstraps=num_bootstraps, alpha=alpha)
            ci_low, ci_high = sig_result.get("ci95", (None, None))
            p_value = sig_result.get("p_one_sided", 1.0)
            is_significant = (
                ci_high is not None
                and ci_high < 0
                and p_value is not None
                and p_value < alpha
            )
            significance_data[pair_key] = {
                "isSignificant": bool(is_significant),
                "pValue": float(p_value) if p_value is not None else 1.0,
                "alpha": float(alpha),
                "confidenceInterval": 95,
                "lowerBound": float(ci_low) if ci_low is not None else 0.0,
                "upperBound": float(ci_high) if ci_high is not None else 0.0,
            }
        except Exception as exc:
            print(f"Warning: Could not compute significance for {model1_name} vs {model2_name}: {exc}")
    return significance_data


def _build_normalization_dictionary_data(
    reson_runs: List[RESONRun],
    model_names: List[str],
) -> Dict[str, Any]:
    by_model: Dict[str, Any] = {}
    for reson_run, model_name in zip(reson_runs, model_names):
        norm_dict = _build_normalization_dictionary(reson_run)
        if norm_dict and norm_dict.get("vocab"):
            by_model[model_name] = norm_dict
    has_dictionary = bool(by_model)
    return {
        "hasNormalizationDictionary": has_dictionary,
        "byModel": by_model,
    }


def _duration_quantile(values: List[float], q: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = min(int(len(sorted_vals) * q), len(sorted_vals) - 1)
    return sorted_vals[idx]


def _build_duration_summary(samples: List[Dict[str, Any]]) -> Tuple[Dict[str, int], Dict[str, float]]:
    all_durations = [s.get("duration") or 0.0 for s in samples if s.get("duration") is not None]
    duration_types = {
        "short": len([d for d in all_durations if d < 5]),
        "normal": len([d for d in all_durations if 5 <= d <= 30]),
        "long": len([d for d in all_durations if d > 30]),
    }
    if all_durations:
        mean_dur = sum(all_durations) / len(all_durations)
        var_dur = sum((d - mean_dur) ** 2 for d in all_durations) / len(all_durations)
        std_dur = var_dur ** 0.5
    else:
        mean_dur = std_dur = 0.0
    sorted_durations = sorted(all_durations)
    duration_info = {
        "mean": mean_dur,
        "std": std_dur,
        "min": sorted_durations[0] if sorted_durations else 0.0,
        "25%": _duration_quantile(sorted_durations, 0.25),
        "50%": _duration_quantile(sorted_durations, 0.5),
        "75%": _duration_quantile(sorted_durations, 0.75),
        "max": sorted_durations[-1] if sorted_durations else 0.0,
    }
    return duration_types, duration_info


def _build_analytics_and_manifest(
    samples: List[Dict[str, Any]],
    model_names: List[str],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    analytics_data: Dict[str, Any] = {}
    manifest_data: Dict[str, Any] = {}

    for name in model_names:
        analytics_samples: List[Dict[str, Any]] = []
        manifest_entries: List[Dict[str, Any]] = []
        for sample in samples:
            result = sample["results"].get(name)
            if not result:
                continue
            duration = sample.get("duration") or 0.0
            analytics_samples.append({
                "audio_filepath": sample.get("file_path", ""),
                "duration": duration,
                "durationType": duration_type_from_seconds(duration),
                "wer": result.get("wer", 0.0),
                "insertions": result.get("insertions", 0),
                "deletions": result.get("deletions", 0),
                "substitutions": result.get("substitutions", 0),
            })
            reference_text = result.get("reference", sample.get("reference", ""))
            hypothesis_text = result.get("hypothesis", "")
            manifest_entries.append({
                "audio_filepath": sample.get("file_path", ""),
                "duration": duration,
                "text": reference_text,
                "prediction": hypothesis_text,
                "wer": result.get("wer", 0.0),
                "cer": result.get("cer", 0.0),
                "insertions": result.get("insertions", 0),
                "deletions": result.get("deletions", 0),
                "substitutions": result.get("substitutions", 0),
                "diff_tokens": generate_word_diff_tokens(reference_text, hypothesis_text),
            })
        analytics_data[name] = {"samples": analytics_samples, "totalSamples": len(analytics_samples)}
        manifest_data[name] = manifest_entries
    return analytics_data, manifest_data


def _resolve_significance_pairs(
    model_names: List[str],
    base_model: Optional[str],
    target_model: Optional[str],
    additional_pairs: Optional[List[Tuple[str, str]]],
) -> List[Tuple[str, str]]:
    from reson.compare_significance import resolve_significance_pairs

    if not target_model or target_model not in model_names:
        return []

    return resolve_significance_pairs(
        model_names,
        candidate_name=target_model,
        primary_baseline_name=base_model,
        scope="primary" if base_model else "none",
        explicit_pairs=additional_pairs,
    )


def build_compare_report_payload(
    reson_runs: List[RESONRun],
    model_names: List[str],
    model_display_names: Optional[List[str]] = None,
    dataset_name: str = "Dataset",
    dataset_description: str = "",
    base_model: Optional[str] = None,
    target_model: Optional[str] = None,
    additional_pairs: Optional[List[Tuple[str, str]]] = None,
    significance_pairs: Optional[List[Tuple[str, str]]] = None,
    num_bootstraps: int = 2000,
    alpha: float = 0.05,
) -> Dict[str, Any]:
    """Build payload for the compare_report frontend.

    ``dataset_description`` is reserved for future UI use (not serialized yet).
    """
    del dataset_description  # reserved in the public API; not consumed by the frontend yet

    if len(reson_runs) != len(model_names):
        raise ValueError("Number of RESONRun objects must match number of model_names")

    display_names = model_names if model_display_names is None else model_display_names
    if len(display_names) != len(model_names):
        display_names = model_names

    total_samples = 0
    total_duration_hours = 0.0
    summary_total_duration: str | None = None
    summary_vocab_size = 0
    summary_unique_chars = 0

    if reson_runs:
        first_run = reson_runs[0]
        summary = first_run.summary if isinstance(first_run.summary, dict) else {}
        summary_total_duration = normalize_duration_value(summary.get("Number of hours"))
        summary_vocab_size = _as_int(summary.get("Vocabulary size"), 0)
        summary_unique_chars = _as_int(summary.get("Alphabet size"), 0)
        total_samples = _as_int(summary.get("Number of utterances"), 0)
        if total_samples <= 0 and not first_run.manifest.empty:
            total_samples = len(first_run.manifest)
        if "duration" in first_run.manifest.columns:
            total_duration_hours = float(first_run.manifest["duration"].sum() / 3600.0)

    models = [{"name": name, "displayName": display} for name, display in zip(model_names, display_names)]
    overview = {name: _build_model_overview(run) for run, name in zip(reson_runs, model_names)}
    vocabulary = _build_vocabulary_data(reson_runs, model_names)
    samples = _build_aligned_samples(reson_runs, model_names)

    total_duration_str = summary_total_duration or format_hours_to_hhmmss(total_duration_hours)
    vocab_size = summary_vocab_size if summary_vocab_size > 0 else len(vocabulary)
    unique_chars = summary_unique_chars
    if unique_chars <= 0 and reson_runs:
        try:
            unique_chars = int(getattr(reson_runs[0].alphabet, "size", 0) or 0)
        except Exception:
            unique_chars = 0

    wer_data: Dict[str, Any] = {}
    cer_data: Dict[str, Any] = {}
    for name in model_names:
        ov = overview.get(name, {})
        dec = ov.get("decomposition", {})
        wer_data[name] = {
            "value": ov.get("wer", 0.0),
            "ins": dec.get("insertionsCount", 0),
            "del": dec.get("deletionsCount", 0),
            "sub": dec.get("substitutionsCount", 0),
        }
        cer_opt = ov.get("optionalMetrics", {}).get("cer")
        if cer_opt is not None:
            cer_data[name] = cer_opt

    analytics_data, manifest_data = _build_analytics_and_manifest(samples, model_names)
    duration_types, duration_info = _build_duration_summary(samples)

    resolved_significance_pairs: List[Tuple[str, str]] = []
    if num_bootstraps > 0:
        if significance_pairs is not None:
            resolved_significance_pairs = list(significance_pairs)
        else:
            resolved_significance_pairs = _resolve_significance_pairs(
                model_names, base_model, target_model, additional_pairs
            )

    pairwise_comparisons = _build_pairwise_comparisons(
        reson_runs=reson_runs,
        model_names=model_names,
        pairs_to_compute=None,
    )
    pairwise_comparison_data = {
        pair_key: {
            "baseline": comparison.baseline,
            "candidate": comparison.rc,
            "matchedUtterances": comparison.matched_rows,
            "metricsDelta": comparison.metrics_delta_records(),
        }
        for pair_key, comparison in pairwise_comparisons.items()
    }

    statistical_significance_data: Dict[str, Any] = {}
    if resolved_significance_pairs and num_bootstraps > 0:
        print(
            f"Computing statistical significance for {len(resolved_significance_pairs)} pair(s): "
            f"{resolved_significance_pairs}"
        )
        statistical_significance_data = _build_statistical_significance(
            reson_runs=reson_runs,
            model_names=model_names,
            num_bootstraps=num_bootstraps,
            alpha=alpha,
            pairs_to_compute=resolved_significance_pairs,
            pairwise_comparisons=pairwise_comparisons,
        )

    baseline_index = model_names.index(base_model) if base_model in model_names else 0

    return {
        "datasetInfo": {
            "name": dataset_name,
            "totalSamples": total_samples,
            "totalDuration": total_duration_str,
            "vocabSize": f"{vocab_size} words",
            "uniqueChars": int(unique_chars),
            "normalized": True,
            "durationTypes": duration_types,
            "durationInfo": duration_info,
        },
        "models": models,
        "baselineIndex": baseline_index,
        "defaultBaseModel": base_model,
        "defaultTargetModel": target_model,
        "werData": wer_data,
        "cerData": cer_data,
        "vocabularyData": vocabulary,
        "analyticsData": analytics_data,
        "manifestData": manifest_data,
        "overviewData": overview,
        "pairwiseComparisons": pairwise_comparison_data,
        "statisticalSignificanceData": statistical_significance_data,
        "normalizationDictionary": _build_normalization_dictionary_data(reson_runs, model_names),
        "settings": {"language": "ru", "defaultTheme": "dark"},
    }
