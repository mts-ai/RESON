"""Statistics utilities for RESON."""

from __future__ import annotations

import datetime
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd


def seconds2hms(seconds: float) -> str:
    """Convert seconds to `HH:MM:SS`, allowing total hours > 24."""
    try:
        value = float(seconds)
    except Exception:
        value = 0.0
    if not np.isfinite(value) or value < 0:
        value = 0.0
    delta = datetime.timedelta(seconds=value)
    days = delta.days
    hours = delta.seconds // 3600
    minutes = (delta.seconds % 3600) // 60
    secs = delta.seconds % 60
    total_hours = days * 24 + hours
    return f"{total_hours:02d}:{minutes:02d}:{secs:02d}"


def _to_jsonl(path: str, rows: List[Dict[str, Any]]) -> None:
    """Write row records to JSON Lines file."""
    output = Path(path)
    output.parent.mkdir(exist_ok=True, parents=True)
    with open(output, "w", encoding="utf-8") as f:
        for row in rows:
            json.dump(row, f, ensure_ascii=False)
            f.write("\n")


@dataclass
class ManifestSummary:
    """Aggregated statistics computed from a manifest DataFrame."""

    total_samples: int
    total_duration: str
    duration_info: Dict[str, Any]
    duration_type: Dict[str, int]
    vocab_records: List[Dict[str, Union[int, float, str]]]
    alphabet_records: List[Dict[str, Union[str, int]]] = field(default_factory=list)
    replace_stats: Optional["ReplaceVocabStats"] = None
    normalized: bool = False
    normalized_cfg: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dataframe(
        cls,
        df: pd.DataFrame,
        replace_stats: Optional["ReplaceVocabStats"] = None,
        normalized: bool = False,
        normalized_cfg: Optional[Dict[str, Any]] = None,
    ) -> "ManifestSummary":
        """Build summary from a manifest-like DataFrame."""
        normalized_cfg = normalized_cfg or {}
        data = df.copy() if isinstance(df, pd.DataFrame) else pd.DataFrame()
        bins = [-np.inf, 5, 30, np.inf]
        labels = ["short", "normal", "long"]

        if not data.empty and "duration" in data.columns:
            duration = pd.to_numeric(data["duration"], errors="coerce").fillna(0.0)
            total_samples = len(data)
            total_duration = seconds2hms(float(duration.sum()))
            duration_info = (
                duration.describe()
                .drop(labels=["count"], errors="ignore")
                .round(2)
                .to_dict()
            )
            data["duration_type"] = pd.cut(duration, bins=bins, labels=labels)
            duration_type = data["duration_type"].value_counts().to_dict()
        else:
            total_samples = 0
            total_duration = seconds2hms(0)
            duration_info = {}
            duration_type = {}

        if not data.empty and "text" in data.columns:
            text_series = data["text"].astype(str)
            vocab_counts = text_series.str.split().explode().dropna().value_counts()
            vocab_records = [{"word": str(w), "count": int(c)} for w, c in vocab_counts.items()]

            char_counts = text_series.apply(list).explode().dropna().astype(str).value_counts()
            alphabet_records = [{"char": str(ch), "count": int(cnt)} for ch, cnt in char_counts.items()]
        else:
            vocab_records = []
            alphabet_records = []

        return cls(
            total_samples=total_samples,
            total_duration=total_duration,
            duration_info=duration_info,
            duration_type=duration_type,
            vocab_records=vocab_records,
            alphabet_records=alphabet_records,
            replace_stats=replace_stats,
            normalized=normalized,
            normalized_cfg=normalized_cfg,
        )

    @property
    def summary(self) -> Dict[str, Any]:
        """Return user-facing summary dictionary."""
        out = {
            "Number of hours": self.total_duration,
            "Number of utterances": self.total_samples,
            "Duration types": self.duration_type,
            "Duration info": self.duration_info,
            "Vocabulary size": f"{self.vocab.size} words",
            "Alphabet size": f"{self.alphabet.size} chars",
            "Normalized": self.normalized,
            "Normalization config": self.normalized_cfg,
        }
        if self.replace_stats is not None:
            out["Replacements total"] = int(self.replace_stats.total_replacements)
            out["Replacements by field"] = dict(self.replace_stats.fields)
        return out

    @property
    def vocab(self) -> "Vocab":
        return Vocab(self.vocab_records)

    @property
    def alphabet(self) -> "Alphabet":
        return Alphabet.from_records(self.alphabet_records)


class Vocab:
    """Wrapper around a DataFrame with word-level statistics.

    Core columns: ``word``, ``count``. After metrics postprocess: ``recall``,
    ``precision``, ``f1_score``. After :func:`reson.core.analysis.vocab_scoring.enrich_vocab`:
    ``insertions``, ``deletions``, ``substitutions``, ``wis``, ``wis_components``.
    """

    def __init__(
        self,
        vocab: Optional[pd.DataFrame | List[Dict[str, Union[int, float, str]]]] = None,
    ) -> None:
        data = pd.DataFrame(vocab or []) if isinstance(vocab, list) else (vocab.copy() if isinstance(vocab, pd.DataFrame) else pd.DataFrame())
        if "word" not in data.columns:
            data["word"] = ""
        self.data = data

    def _word_series(self) -> pd.Series:
        return self.data["word"].astype(str)

    @property
    def size(self) -> int:
        return int(len(self.data))

    @property
    def russian(self) -> "Vocab":
        mask = self._word_series().str.contains(r"^[а-яё]+$", case=False, na=False)
        return Vocab(self.data[mask].copy())

    @property
    def english(self) -> "Vocab":
        mask = self._word_series().str.contains(r"^[a-z]+$", case=False, na=False)
        return Vocab(self.data[mask].copy())

    @property
    def numeric(self) -> "Vocab":
        mask = self._word_series().str.contains(r"^\d+$", na=False)
        return Vocab(self.data[mask].copy())

    @property
    def other(self) -> "Vocab":
        return self - self.russian - self.numeric - self.english

    @property
    def mean_recall(self) -> float:
        if "recall" not in self.data.columns:
            raise ValueError("Recall is not available. Metrics was not calculated")
        return float(pd.to_numeric(self.data["recall"], errors="coerce").mean())

    @property
    def mean_precision(self) -> float:
        if "precision" not in self.data.columns:
            raise ValueError("Precision is not available. Metrics was not calculated")
        return float(pd.to_numeric(self.data["precision"], errors="coerce").mean())

    @property
    def mean_f1score(self) -> float:
        if "f1_score" not in self.data.columns:
            raise ValueError("F1 Score is not available. Metrics was not calculated")
        return float(pd.to_numeric(self.data["f1_score"], errors="coerce").mean())

    @property
    def mean_wis(self) -> float:
        if "wis" not in self.data.columns:
            raise ValueError("WIS is not available. Run vocab enrichment first")
        return float(pd.to_numeric(self.data["wis"], errors="coerce").mean())

    def top_words(
        self,
        n: int = 10,
        by: str = "count",
        ascending: bool = False,
        min_count: int = 1,
        min_len: int = 1,
    ) -> pd.DataFrame:
        """Return top words by selected column with basic filters."""
        counts = (
            pd.to_numeric(self.data["count"], errors="coerce").fillna(0)
            if "count" in self.data.columns
            else pd.Series(0, index=self.data.index)
        )
        lengths = self._word_series().str.len().fillna(0)
        filtered = self.data[(counts >= min_count) & (lengths >= min_len)]
        if by not in filtered.columns:
            raise ValueError(f"Column '{by}' not found in vocabulary stats")
        return filtered.sort_values(by=by, ascending=ascending).head(n)

    def find_word(
        self,
        word: str,
        exact: bool = False,
        startswith: bool = False,
        case: bool = False,
        regex: bool = False,
    ) -> pd.DataFrame:
        """Search words in vocabulary with exact/prefix/contains modes."""
        words = self._word_series()
        query = str(word)
        if exact:
            if regex:
                mask = words.str.fullmatch(query, case=case, na=False)
            elif case:
                mask = words == query
            else:
                mask = words.str.lower() == query.lower()
        elif startswith:
            if case:
                mask = words.str.startswith(query, na=False)
            else:
                mask = words.str.lower().str.startswith(query.lower(), na=False)
        else:
            mask = words.str.contains(query, case=case, regex=regex, na=False)
        return self.data[mask]

    def to_csv(self, output_fp: str) -> None:
        Path(output_fp).parent.mkdir(exist_ok=True, parents=True)
        self.data.to_csv(output_fp, index=False)

    def to_jsonl(self, output_fp: str) -> None:
        """Serialize vocabulary rows to JSON Lines file."""
        _to_jsonl(output_fp, self.data.to_dict(orient="records"))

    def to_json(self, output_fp: str) -> None:
        """Backward-compatible alias for JSON Lines serialization."""
        self.to_jsonl(output_fp)

    def __sub__(self, other: object) -> "Vocab":
        if not isinstance(other, Vocab):
            raise ValueError("Other is not a Vocab object")
        other_words = set(other._word_series())
        mask = ~self._word_series().isin(other_words)
        return Vocab(self.data[mask].copy())

    def __str__(self) -> str:
        lines = [f"Total words: {self.size}"]
        if "recall" in self.data.columns:
            lines.append(f"Mean recall: {self.mean_recall:.2f}")
        if "precision" in self.data.columns:
            lines.append(f"Mean precision: {self.mean_precision:.2f}")
        if "f1_score" in self.data.columns:
            lines.append(f"Mean F1: {self.mean_f1score:.2f}")
        if "wis" in self.data.columns:
            lines.append(f"Mean WIS: {self.mean_wis:.2f}")
        if "count" in self.data.columns and not self.data.empty:
            top = self.data.sort_values("count", ascending=False).head(5)
            top_words = ", ".join(f"{w} ({c})" for w, c in zip(top["word"], top["count"]))
            lines.append(f"Top 5 words by frequency: {top_words}")
        cats = [
            ("Russian words", "🇷🇺", self.russian),
            ("English words", "🇬🇧", self.english),
            ("Numbers", "#️⃣", self.numeric),
            ("Other", "🔠", self.other),
        ]
        for name, emoji, subset in cats:
            cnt = subset.size
            lines.append(f"{emoji} {name}: {cnt}")
            if cnt > 0:
                example = ", ".join(subset._word_series().head(3))
                lines.append(f"   └─ examples: {example}")
        return "\n".join(lines)


@dataclass(frozen=True)
class Alphabet:
    """Wrapper around a DataFrame with alphabet symbol counts."""

    data: pd.DataFrame

    @classmethod
    def from_records(cls, records: List[Dict[str, Union[str, int]]]) -> "Alphabet":
        df = pd.DataFrame(records or [])
        if "char" not in df.columns:
            df["char"] = ""
        if "count" not in df.columns:
            df["count"] = 0
        return cls(df[["char", "count"]].copy())

    def _char_series(self) -> pd.Series:
        return self.data["char"].astype(str)

    @property
    def size(self) -> int:
        return int(len(self.data))

    @property
    def chars(self) -> List[str]:
        if self.data.empty or "char" not in self.data.columns:
            return []
        return sorted(self._char_series().unique().tolist())

    @property
    def russian(self) -> "Alphabet":
        mask = self._char_series().str.contains(r"^[а-яёА-ЯЁ]$", na=False)
        return Alphabet(self.data[mask].copy())

    @property
    def english(self) -> "Alphabet":
        mask = self._char_series().str.contains(r"^[a-zA-Z]$", na=False)
        return Alphabet(self.data[mask].copy())

    @property
    def numeric(self) -> "Alphabet":
        mask = self._char_series().str.contains(r"^[0-9]$", na=False)
        return Alphabet(self.data[mask].copy())

    @property
    def other(self) -> "Alphabet":
        chars = self._char_series()
        mask_ru = chars.str.contains(r"^[а-яёА-ЯЁ]$", na=False)
        mask_en = chars.str.contains(r"^[a-zA-Z]$", na=False)
        mask_num = chars.str.contains(r"^[0-9]$", na=False)
        return Alphabet(self.data[~(mask_ru | mask_en | mask_num)].copy())

    def to_csv(self, output_fp: str) -> None:
        Path(output_fp).parent.mkdir(exist_ok=True, parents=True)
        self.data.to_csv(output_fp, index=False)

    def to_jsonl(self, output_fp: str) -> None:
        """Serialize alphabet rows to JSON Lines file."""
        _to_jsonl(output_fp, self.data.to_dict(orient="records"))

    def to_json(self, output_fp: str) -> None:
        """Backward-compatible alias for JSON Lines serialization."""
        self.to_jsonl(output_fp)


@dataclass(frozen=True)
class ReplaceVocabStats:
    """Cumulative statistics of replacements during text normalization."""

    vocab: Dict[str, List[str]] = field(default_factory=dict)
    fields: Dict[str, int] = field(default_factory=dict)
    words: Dict[str, int] = field(default_factory=dict)
    examples: Dict[int, List[Tuple[str, str, str]]] = field(default_factory=dict)

    def __str__(self) -> str:
        """Short summary by fields and most frequent variants."""
        lines: List[str] = ["Total replacements by fields:"]
        for field_name, count in self.fields.items():
            lines.append(f"  {field_name}: {count}")
        lines.append("Top replacements:")
        for word, count in sorted(self.words.items(), key=lambda x: -x[1])[:10]:
            lines.append(f"  {word}: {count}")
        return "\n".join(lines)

    @property
    def total_replacements(self) -> int:
        return int(sum(self.fields.values()))
