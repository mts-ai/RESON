"""Run comparison helpers for RESON."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Any
import numpy as np
import pandas as pd

from .run import RESONRun
from .vocab_scoring import ensure_run_vocab_enriched, word_ops_stats_from_vocab

@dataclass(frozen=True)
class RESONComparison:
    baseline: str
    rc: str
    metrics_delta: pd.DataFrame
    per_file_delta: pd.DataFrame
    merged_vocab: pd.DataFrame
    by_slice: Dict[str, pd.DataFrame]
    artifacts: Dict[str, str]
    word_ops_stats: Dict[str, Dict[str, Dict[str, int]]]

    @property
    def matched_rows(self) -> int:
        return int(len(self.per_file_delta)) if self.per_file_delta is not None else 0

    def metrics_delta_records(self) -> list[dict[str, Any]]:
        if self.metrics_delta is None or self.metrics_delta.empty:
            return []
        return self.metrics_delta.to_dict(orient="records")

    @staticmethod
    def corpus_wer(df: pd.DataFrame, suffix: str) -> float:
        try:
            words = df[[c for c in [f"text{suffix}", "text"] if c in df.columns][0]].fillna("")
            lens = words.apply(lambda x: len(str(x).split()))
            err = df[[f"INS{suffix}", f"DEL{suffix}", f"SUB{suffix}"]].sum().sum()
            denom = int(lens.sum())
            return float(err) / float(denom) * 100.0 if denom else 0.0
        except Exception:
            return 0.0

    def compute_significance(
        self,
        stratify_col: Optional[str] = None,
        num_bootstraps: int = 2000,
        seed: int = 42,
        alpha: float = 0.05,
    ) -> Dict[str, Any]:
        if num_bootstraps <= 0:
            raise ValueError("num_bootstraps must be positive")
        if not 0 < alpha < 1:
            raise ValueError("alpha must be in (0, 1)")

        df = self.per_file_delta.copy()
        if df.empty:
            return {
                "num_bootstraps": int(num_bootstraps),
                "ci95": (0.0, 0.0),
                "p_one_sided": 1.0,
                "p_two_sided": 1.0,
                "alpha": float(alpha),
                "stratified_by": None,
            }

        # длина по референсу RC (или fallback на baseline/text)
        if "LEN" not in df.columns:
            ref_col = "text_rc" if "text_rc" in df.columns else (
                "text_baseline" if "text_baseline" in df.columns else "text"
            )
            df["LEN"] = df[ref_col].fillna("").apply(lambda x: len(str(x).split()))

        rng = np.random.default_rng(seed)
        # Resolve stratification column: accept base name or suffixed variants from merge
        resolved_strat_col = None
        if stratify_col is not None:
            cols = set(df.columns)
            if stratify_col in cols:
                resolved_strat_col = stratify_col
            elif f"{stratify_col}_rc" in cols:
                resolved_strat_col = f"{stratify_col}_rc"
            elif f"{stratify_col}_baseline" in cols:
                resolved_strat_col = f"{stratify_col}_baseline"

        has_strata = resolved_strat_col is not None
        if has_strata:
            strata = {k: v for k, v in df.groupby(resolved_strat_col)}

        rc_samples: list[float] = []
        bl_samples: list[float] = []
        for _ in range(num_bootstraps):
            if has_strata:
                parts = []
                for _, s in strata.items():
                    parts.append(s.sample(n=len(s), replace=True, random_state=int(rng.integers(0, 2**32 - 1))))
                bs = pd.concat(parts, axis=0)
            else:
                bs = df.sample(n=len(df), replace=True, random_state=int(rng.integers(0, 2**32 - 1)))
            rc_samples.append(self.corpus_wer(bs, "_rc"))
            bl_samples.append(self.corpus_wer(bs, "_baseline"))

        rc = np.array(rc_samples, float)
        bl = np.array(bl_samples, float)
        delta = rc - bl
        lo = 100.0 * (alpha / 2.0)
        hi = 100.0 * (1.0 - alpha / 2.0)
        ci_low, ci_high = np.percentile(delta, [lo, hi])
        p_one = float(np.mean(delta >= 0))
        p_two = float(2 * min(np.mean(delta >= 0), np.mean(delta <= 0)))

        return {
            "num_bootstraps": int(num_bootstraps),
            "ci95": (float(ci_low), float(ci_high)),
            "p_one_sided": p_one,
            "p_two_sided": p_two,
            "alpha": float(alpha),
            "stratified_by": resolved_strat_col if has_strata else None,
        }


def _prepare_metrics_df(metrics: pd.DataFrame) -> pd.DataFrame:
    df = metrics.copy()
    if df.empty:
        return df
    if "name" in df.columns:
        df = df.set_index("name")
    elif "index" in df.columns:
        df = df.set_index("index")
    df.index = df.index.astype(str)
    return df


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or pd.isna(value):
            return None
        return float(value)
    except Exception:
        return None


def _build_metrics_delta_df(baseline: RESONRun, rc: RESONRun) -> pd.DataFrame:
    baseline_metrics = _prepare_metrics_df(baseline.metrics)
    rc_metrics = _prepare_metrics_df(rc.metrics)
    if baseline_metrics.empty or rc_metrics.empty:
        return pd.DataFrame()

    common = baseline_metrics.index.intersection(rc_metrics.index)
    rows: list[dict[str, Any]] = []
    for metric_name in sorted(common):
        bl_row = baseline_metrics.loc[metric_name]
        rc_row = rc_metrics.loc[metric_name]

        bl_value = _safe_float(bl_row.get("VALUE"))
        rc_value = _safe_float(rc_row.get("VALUE"))
        diff = (rc_value - bl_value) if (bl_value is not None and rc_value is not None) else None
        rel = ((diff / bl_value) * 100.0) if (diff is not None and bl_value not in (None, 0.0)) else None

        rows.append(
            {
                "name": metric_name,
                "baseline": bl_value,
                "rc": rc_value,
                "diff_abs": diff,
                "diff_rel_pct": rel,
                "baseline_INS": _safe_float(bl_row.get("INS")),
                "baseline_DEL": _safe_float(bl_row.get("DEL")),
                "baseline_SUB": _safe_float(bl_row.get("SUB")),
                "rc_INS": _safe_float(rc_row.get("INS")),
                "rc_DEL": _safe_float(rc_row.get("DEL")),
                "rc_SUB": _safe_float(rc_row.get("SUB")),
            }
        )
    return pd.DataFrame(rows)


def _build_vocab_delta_df(baseline_vocab: pd.DataFrame, rc_vocab: pd.DataFrame) -> pd.DataFrame:
    if baseline_vocab.empty and rc_vocab.empty:
        return pd.DataFrame()
    if "word" not in baseline_vocab.columns and "word" not in rc_vocab.columns:
        return pd.DataFrame()

    bl = baseline_vocab.copy()
    rc_df = rc_vocab.copy()
    if "word" not in bl.columns:
        bl["word"] = pd.Series(dtype=str)
    if "word" not in rc_df.columns:
        rc_df["word"] = pd.Series(dtype=str)
    bl["word"] = bl["word"].astype(str)
    rc_df["word"] = rc_df["word"].astype(str)

    bl_cols = {c: f"baseline_{c}" for c in ["count", "recall", "precision", "f1_score"] if c in bl.columns}
    rc_cols = {c: f"rc_{c}" for c in ["count", "recall", "precision", "f1_score"] if c in rc_df.columns}
    bl = bl[["word", *bl_cols.keys()]].rename(columns=bl_cols)
    rc_df = rc_df[["word", *rc_cols.keys()]].rename(columns=rc_cols)

    merged = bl.merge(rc_df, on="word", how="outer")
    for metric in ("recall", "precision", "f1_score"):
        bl_col = f"baseline_{metric}"
        rc_col = f"rc_{metric}"
        if bl_col in merged.columns and rc_col in merged.columns:
            merged[f"delta_{metric}"] = pd.to_numeric(merged[rc_col], errors="coerce") - pd.to_numeric(
                merged[bl_col], errors="coerce"
            )

    if "baseline_count" in merged.columns or "rc_count" in merged.columns:
        merged["max_count"] = merged[["baseline_count", "rc_count"]].fillna(0).max(axis=1)
        merged = merged.sort_values(by="max_count", ascending=False).drop(columns=["max_count"])
    return merged.reset_index(drop=True)


def _sub_as_dst_counts_from_vocab(vocab_df: pd.DataFrame) -> Dict[str, int]:
    if vocab_df.empty or "word" not in vocab_df.columns:
        return {}
    out: Dict[str, int] = {}
    for _, row in vocab_df.iterrows():
        word = str(row.get("word", "")).strip()
        if not word:
            continue
        total = 0
        raw_targets = row.get("asr_substitution_targets")
        if isinstance(raw_targets, list):
            for target in raw_targets:
                if not isinstance(target, dict):
                    continue
                total += int(target.get("count", 0) or 0)
        out[word] = total
    return out


def compare_runs(
    baseline: RESONRun, rc: RESONRun, on: str = "audio_filepath"
) -> RESONComparison:
    baseline = ensure_run_vocab_enriched(baseline)
    rc = ensure_run_vocab_enriched(rc)
    metrics_delta = _build_metrics_delta_df(baseline, rc)
    baseline_m = baseline.manifest.copy()
    rc_m = rc.manifest.copy()

    if on in baseline_m.columns and on in rc_m.columns:
        joined = baseline_m.merge(rc_m, on=on, suffixes=("_baseline", "_rc"))
    else:
        joined = pd.DataFrame()
    merged_vocab = _build_vocab_delta_df(baseline.vocab.data.copy(), rc.vocab.data.copy())

    bl_ops = word_ops_stats_from_vocab(baseline.vocab)
    rc_ops = word_ops_stats_from_vocab(rc.vocab)
    bl_sub_as_dst = _sub_as_dst_counts_from_vocab(baseline.vocab.data)
    rc_sub_as_dst = _sub_as_dst_counts_from_vocab(rc.vocab.data)

    union_words = set(bl_ops.keys()) | set(rc_ops.keys())
    word_ops_stats: Dict[str, Dict[str, Dict[str, int]]] = {}
    for w in union_words:
        b = bl_ops.get(w, {})
        r = rc_ops.get(w, {})
        word_ops_stats[w] = {
            "baseline": {
                "ins": int(b.get("ins", 0)),
                "del": int(b.get("del", 0)),
                "sub": int(b.get("sub", 0)),
                "sub_as_dst": int(bl_sub_as_dst.get(w, 0)),
            },
            "rc": {
                "ins": int(r.get("ins", 0)),
                "del": int(r.get("del", 0)),
                "sub": int(r.get("sub", 0)),
                "sub_as_dst": int(rc_sub_as_dst.get(w, 0)),
            },
        }

    return RESONComparison(
        baseline=baseline.name,
        rc=rc.name,
        metrics_delta=metrics_delta,
        per_file_delta=joined,
        merged_vocab=merged_vocab,
        by_slice={},
        artifacts={},
        word_ops_stats=word_ops_stats,
    )

