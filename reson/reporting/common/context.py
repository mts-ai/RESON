"""Build context used by payload builders for interactive reports."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from reson.core.analysis.alerts import AlertAnalyzer
from reson.core.analysis.errors import ErrorAnalyzer
from reson.core.analysis.run import RESONRun
from reson.core.analysis.vocab_scoring import (
    ensure_run_vocab_enriched,
    vocab_needs_enrichment,
    word_ops_stats_from_vocab,
)


def _build_manifest_records(reson_run: RESONRun) -> list[dict[str, Any]]:
    manifest_df = reson_run.manifest.copy()
    if "WER" not in manifest_df.columns:
        return []

    base_cols = [
        "audio_filepath",
        "duration",
        "WER",
        "INS",
        "DEL",
        "SUB",
        "text",
        "prediction",
    ]
    if "duration_type" in manifest_df.columns:
        base_cols.insert(2, "duration_type")
    cols = [c for c in base_cols if c in manifest_df.columns]
    for col in manifest_df.columns:
        if col not in cols:
            cols.append(col)
    return manifest_df[cols].to_dict(orient="records")


def build_report_context(
    reson_run: RESONRun,
    error_analyzer: Optional[ErrorAnalyzer] = None,
) -> Dict[str, Any]:
    """Build slim context consumed by single-report payload builder."""
    run = reson_run
    if run is None:
        raise RuntimeError("No run available. Call analyze() first.")

    run = ensure_run_vocab_enriched(run)
    err = error_analyzer or ErrorAnalyzer(reson_run.manifest)
    info = run.summary
    metrics = run.metrics
    vocab_df = run.vocab.data
    vocab_stats = run.vocab
    cfg = run.config or {}

    alerts = AlertAnalyzer(
        manifest=reson_run.manifest,
        vocab_df=vocab_df,
        metrics_df=metrics,
    ).compute()

    manifest_records = _build_manifest_records(reson_run)
    df = reson_run.manifest.copy()
    ins_total = int(df["INS"].sum()) if "INS" in df.columns else 0
    del_total = int(df["DEL"].sum()) if "DEL" in df.columns else 0
    sub_total = int(df["SUB"].sum()) if "SUB" in df.columns else 0
    replacement_fields = run.replacements.fields if run.replacements else {}
    normalize_cfg = cfg.get("normalize_cfg") or {}

    return {
        "info": info,
        "run_name": run.name,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "wer": metrics.loc["WER", "VALUE"] if "WER" in metrics.index else None,
        "metrics": metrics,
        "duration_type_counts": info.get("Duration types", {}),
        "manifest_records": manifest_records,
        "word_ops_stats": (
            word_ops_stats_from_vocab(vocab_stats)
            if not vocab_needs_enrichment(vocab_stats)
            else err.word_ops_stats(include_sub_as_dst=False)
        ),
        "errors_ins_total": ins_total,
        "errors_del_total": del_total,
        "errors_sub_total": sub_total,
        "replacement_fields": replacement_fields,
        "normalize_used": cfg.get("normalized"),
        "normalize_cfg": normalize_cfg,
        "provider_name": cfg.get("metric_provider"),
        "ru_alphabet": run.alphabet.russian.chars,
        "en_alphabet": run.alphabet.english.chars,
        "num_alphabet": run.alphabet.numeric.chars,
        "other_alphabet": run.alphabet.other.chars,
        "vocab_russian_size": vocab_stats.russian.size,
        "vocab_english_size": vocab_stats.english.size,
        "vocab_numeric_size": vocab_stats.numeric.size,
        "vocab_other_size": vocab_stats.other.size,
        "vocab_mean_recall": vocab_stats.mean_recall,
        "vocab_mean_precision": vocab_stats.mean_precision,
        "vocab_mean_f1score": vocab_stats.mean_f1score,
        "vocab_total_words": vocab_stats.size,
        "meta_info": run.meta or {},
        "alerts": [a.to_dict() for a in alerts],
    }


