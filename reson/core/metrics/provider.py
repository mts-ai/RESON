"""Metric providers for RESON (strategy interface).

Current provider returns flattened pandas DataFrames designed for quick visual
inspection (wide format):

- per_file_df: one row per audio sample with columns
  ['audio_filepath', 'duration', 'text', 'prediction',
   'WER', 'INS', 'DEL', 'SUB',
   '<METRIC>' for every other metric in self.metrics except 'WER']

  Where:
  - 'WER' is the VALUE of the WER metric for the sample
  - 'INS'/'DEL'/'SUB' are WER breakdown components (not prefixed)
  - Additional metrics (e.g. 'CER', 'LER') are exposed as a single
    column each with their VALUE

- summary_df: one row per metric (index = metric name). Columns include
  VALUE/INS/DEL/SUB/EQ/NOM/LEN if present in total_value, and also
  'mean_value' and 'sd' when provided by the backend. For non-WER metrics,
  INS/DEL/SUB/etc. might be absent (NaN).

Notes:
- evaluate(manifest) expects a Manifest instance. Providers may internally
  serialize it to a temporary JSONL if their backend requires a file.
- artifacts_dir (optional) controls where provider writes optional outputs
  such as an HTML report or a JSON dump returned by the underlying tool.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Tuple, Optional, TYPE_CHECKING
from abc import ABC, abstractmethod

import pandas as pd
import jiwer

from reson.core import Vocab, Manifest
from collections import defaultdict
import difflib


# Aggregate metrics: global, mean, and stddev for WER/CER columns.
def get_stats(per_file, col, nom_sum, ref_len):
    global_val = (nom_sum / ref_len * 100.0) if ref_len > 0 else 0.0
    mean_val = float(per_file[col].mean())
    std_val = float(per_file[col].std(ddof=0)) if len(per_file) > 1 else 0.0
    return round(global_val, 4), round(mean_val, 4), round(std_val, 4)

  
class MetricProviderABC(ABC):
    """Abstract provider contract with runtime enforcement."""

    artifacts_dir: str | Path | None
    metrics: Tuple[str, ...]

    @abstractmethod
    def evaluate(self, manifest: "Manifest") -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Return (per_file_df, summary_df) in the flattened format."""

    @abstractmethod
    def postprocess(
        self,
        per_file_df: pd.DataFrame,
        *,
        vocab_df: Optional[pd.DataFrame] = None,
    ) -> Tuple[pd.DataFrame, Vocab]:
        """Enrich per-file DataFrame and produce vocab stats."""


@dataclass
class BaseMetricProvider(MetricProviderABC):
    """Base class with default postprocess that can be shared across providers."""

    def postprocess(
        self,
        per_file_df: pd.DataFrame,
        *,
        vocab_df: Optional[pd.DataFrame] = None,
    ):
        df = per_file_df.copy()
        if "duration" in df.columns:
            try:
                bins = [-float("inf"), 5.0, 30.0, float("inf")]
                labels = ["short", "normal", "long"]
                df["duration_type"] = pd.cut(df["duration"], bins=bins, labels=labels)
            except Exception:
                df["duration_type"] = pd.NA
        else:
            df["duration_type"] = pd.NA

        # vocab metrics if vocab_df provided and text/prediction present
        if (
            vocab_df is not None
            and not vocab_df.empty
            and {"text", "prediction"}.issubset(df.columns)
        ):
            match_vocab = defaultdict(lambda: 0)
            insertion_vocab = defaultdict(lambda: 0)
            subst_table = defaultdict(lambda: 0)
            sm = difflib.SequenceMatcher()

            for record in df.to_dict("records"):
                text_words = str(record.get("text", "")).split()
                prediction_words = str(record.get("prediction", "")).split()
                sm.set_seqs(text_words, prediction_words)
                for seq in sm.get_grouped_opcodes():
                    for m in seq:
                        action, _, _, p_start, p_end = m
                        for word in prediction_words[p_start:p_end]:
                            if action == "replace":
                                subst_table[word] += 1
                            elif action == "insert":
                                insertion_vocab[word] += 1
                for m in sm.get_matching_blocks():
                    for word_idx in range(m[0], m[0] + m[2]):
                        if word_idx < len(text_words):
                            match_vocab[text_words[word_idx]] += 1

            vocab = vocab_df.to_dict("records")
            for item in vocab:
                word, count = item.get("word"), item.get("count", 0) or 0
                if not word:
                    continue
                try:
                    word_recall = (match_vocab[word] / max(count, 1)) * 100
                    word_FP = (
                        match_vocab[word] + insertion_vocab[word] + subst_table[word]
                    )
                    word_precision = (
                        match_vocab[word] / (word_FP or float("inf"))
                    ) * 100
                    word_f1_score = (2 * word_precision * word_recall) / max(
                        (word_precision + word_recall), 1e-9
                    )
                except Exception:
                    word_recall = 0.0
                    word_precision = 0.0
                    word_f1_score = 0.0
                item["recall"] = round(word_recall, 1)
                item["precision"] = round(word_precision, 1)
                item["f1_score"] = round(word_f1_score, 1)
            return df, Vocab(vocab)

        return df, Vocab([])


@dataclass
class JiwerMetricProvider(BaseMetricProvider):
    """open-source-safe default provider based on jiwer for evaluating WER + CER"""

    artifacts_dir: str | Path | None = None
    metrics: Tuple[str, ...] = ("WER", "CER")

    def evaluate(self, manifest: "Manifest") -> Tuple[pd.DataFrame, pd.DataFrame]:
        # Determine which metrics to compute
        metrics_set = set(str(m).upper() for m in self.metrics)
        compute_wer = "WER" in metrics_set
        compute_cer = "CER" in metrics_set

        rows = []

        # Initialize accumulators for WER and CER, only if needed
        eq_sum_word = nom_sum_word = len_sum_word = 0 if compute_wer else None
        eq_sum_char = nom_sum_char = len_sum_char = 0 if compute_cer else None

        for rec in manifest:
            text = str(rec.get("text", ""))
            pred = str(rec.get("prediction", ""))

            row = {
                "audio_filepath": rec.get("audio_filepath"),
                "duration": rec.get("duration"),
                "text": text,
                "prediction": pred,
            }

            # Always call jiwer only for the metrics requested
            if compute_wer:
                word_out = jiwer.process_words(text, pred)
                get = lambda v, d=0: int(getattr(v, d, 0)) if hasattr(v, d) else 0
                getf = lambda v, d=0.0: float(getattr(v, d, 0.0)) if hasattr(v, d) else 0.0
                eq_word = get(word_out, "hits")
                ins = get(word_out, "insertions")
                delete = get(word_out, "deletions")
                sub = get(word_out, "substitutions")
                ref_len_w = get(word_out, "reference_length") or len(text.split())
                wer = getf(word_out, "wer") * 100.0

                eq_sum_word += eq_word
                nom_sum_word += ins + delete + sub
                len_sum_word += ref_len_w

                row.update({
                    "WER": wer,
                    "INS": ins,
                    "DEL": delete,
                    "SUB": sub,
                })
            if compute_cer:
                char_out = jiwer.process_characters(text, pred)
                get = lambda v, d=0: int(getattr(v, d, 0)) if hasattr(v, d) else 0
                getf = lambda v, d=0.0: float(getattr(v, d, 0.0)) if hasattr(v, d) else 0.0
                eq_char = get(char_out, "hits")
                ins_c = get(char_out, "insertions")
                del_c = get(char_out, "deletions")
                sub_c = get(char_out, "substitutions")
                ref_len_c = get(char_out, "reference_length") or len(text)
                cer = getf(char_out, "cer") * 100.0

                eq_sum_char += eq_char
                nom_sum_char += ins_c + del_c + sub_c
                len_sum_char += ref_len_c

                row.update({
                    "CER": cer,
                    "INS_C": ins_c,
                    "DEL_C": del_c,
                    "SUB_C": sub_c,
                })

            rows.append(row)

        per_file_df = pd.DataFrame(rows)

        summary_rows = {}

        if compute_wer:
            global_wer, mean_wer, std_wer = get_stats(per_file_df, "WER", nom_sum_word, len_sum_word)
            summary_rows["WER"] = {
                "DEL": int(pd.to_numeric(per_file_df["DEL"], errors="coerce").sum()),
                "EQ": int(eq_sum_word),
                "INS": int(pd.to_numeric(per_file_df["INS"], errors="coerce").sum()),
                "LEN": int(len_sum_word),
                "NOM": int(nom_sum_word),
                "SUB": int(pd.to_numeric(per_file_df["SUB"], errors="coerce").sum()),
                "VALUE": global_wer,
                "mean_value": mean_wer,
                "sd": std_wer,
            }
        if compute_cer:
            global_cer, mean_cer, std_cer = get_stats(per_file_df, "CER", nom_sum_char, len_sum_char)
            summary_rows["CER"] = {
                "DEL": int(pd.to_numeric(per_file_df["DEL_C"], errors="coerce").sum()),
                "EQ": int(eq_sum_char),
                "INS": int(pd.to_numeric(per_file_df["INS_C"], errors="coerce").sum()),
                "LEN": int(len_sum_char),
                "NOM": int(nom_sum_char),
                "SUB": int(pd.to_numeric(per_file_df["SUB_C"], errors="coerce").sum()),
                "VALUE": global_cer,
                "mean_value": mean_cer,
                "sd": std_cer,
            }

        summary_df = pd.DataFrame.from_dict(summary_rows, orient="index")
        # Drop temporary columns if not computed
        drop_cols = []
        if not compute_wer:
            drop_cols.extend(["WER", "INS", "DEL", "SUB"])
        if not compute_cer:
            drop_cols.extend(["CER", "INS_C", "DEL_C", "SUB_C"])
        per_file_df = per_file_df.drop(columns=[c for c in drop_cols if c in per_file_df.columns], errors="ignore")
        return per_file_df, summary_df
