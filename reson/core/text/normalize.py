"""
Text normalization utilities and configurable normalizer.

This module provides:
- Stateless helpers: remove_punctuation, to_lowercase
- Dictionary-based replacements with stats collection
- TextNormalizer class (fit/transform interface)
"""

import re
import string
from typing import Dict, List, Optional, Union, Any

import pandas as pd
import csv
from pathlib import Path

from reson.core.stats import ReplaceVocabStats


def remove_punctuation(text: str) -> str:
    """
    Remove punctuation characters; replace '-' with a space first.

    Args:
        text: str - input text
    Returns:
        Normalized text
    """
    text = text.strip().replace("-", " ")
    return text.translate(str.maketrans("", "", string.punctuation))


def to_lowercase(text: str) -> str:
    """
    Convert text to lowercase and collapse excessive spaces.

    Args:
        text: str - input text
    Returns:
        Normalized text
    """
    text = text.strip().lower()
    return " ".join(text.strip().split())


def _normalize_vocab_mapping(vocab: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """Normalize target->variants mapping by trimming tokens and dropping empties."""
    normalized: Dict[str, List[str]] = {}
    for target, variants in (vocab or {}).items():
        tgt = str(target).strip()
        cleaned_variants = [str(v).strip() for v in (variants or []) if str(v).strip()]
        if not cleaned_variants:
            continue
        # Empty target means delete matched variants (replace with "").
        normalized[tgt] = cleaned_variants
    return normalized


def _build_variant2target(vocab: Dict[str, List[str]]) -> Dict[str, str]:
    """Build reverse mapping variant->target from normalized vocab mapping."""
    variant2target: Dict[str, str] = {}
    for target_word, variants in (vocab or {}).items():
        for variant in variants:
            if variant:
                variant2target[variant] = target_word
    return variant2target


def build_replacement_pattern(variant2target: Dict[str, str]) -> re.Pattern:
    """Build a word-boundary regex for all variants (longest-first)."""
    if not variant2target:
        # Return a pattern that never matches
        return re.compile(r"a^")
    escaped = [re.escape(k) for k in sorted(variant2target, key=len, reverse=True)]
    pattern = r"\b(" + "|".join(escaped) + r")\b"
    return re.compile(pattern)


def vectorized_replace_with_vocab(
    series: pd.Series,
    variant2target: Dict[str, str],
    stats: Optional[ReplaceVocabStats] = None,
    field: Optional[str] = None,
    pattern: Optional[re.Pattern] = None,
) -> pd.Series:
    """Vectorized replacement by dictionary with optional stats collection.

    Args:
        series: Input text series.
        variant2target: Mapping variant -> target.
        stats: Optional replacement stats accumulator.
        field: Optional field name for per-field stats.
        pattern: Optional precompiled regex from ``build_replacement_pattern``.
    """
    s = series.fillna("").astype(str)
    if not variant2target:
        return s

    compiled_pattern = pattern if pattern is not None else build_replacement_pattern(variant2target)
    # Collect matches for stats before replacement
    if stats is not None:
        matches: pd.Series = s.str.findall(compiled_pattern)
        # Total number of replacements for the field
        if field is not None:
            stats.fields[field] = stats.fields.get(field, 0) + int(
                matches.map(len).sum()
            )
        # Per-variant frequencies
        for words in matches:
            for w in words:
                stats.words[w] = stats.words.get(w, 0) + 1
        # Examples by row index
        if field is not None:
            for idx, words in matches.items():
                if not words:
                    continue
                for w in words:
                    stats.examples.setdefault(idx, []).append(
                        (field, w, variant2target.get(w, w))
                    )
    # Replacement
    replaced = s.str.replace(
        compiled_pattern, lambda m: variant2target.get(m.group(1), m.group(1)), regex=True
    )
    return replaced


class TextNormalizer:
    """
    Configurable text normalizer with
    cached replacement pattern and stats.
    """

    def __init__(
        self,
        remove_punct: bool = True,
        lowercase: bool = True,
        replace_yo: bool = True,
        subst_table: Optional[Union[Dict[str, List[str]], Path, str]] = None,
    ) -> None:
        self.remove_punct = remove_punct
        self.lowercase = lowercase
        self.replace_yo = replace_yo
        self.subst_table = subst_table

        self.stats: Optional[ReplaceVocabStats] = None
        self.variant2target: Dict[str, str] = {}
        self._pattern: Optional[re.Pattern] = None

    @property
    def config(self) -> Dict[str, Any]:
        return {
            "remove_punct": self.remove_punct,
            "lowercase": self.lowercase,
            "replace_yo": self.replace_yo,
            "subst_table": self.subst_table,
        }

    def _load_vocab(self) -> Dict[str, List[str]]:
        """Load replacement vocabulary from a dict or a CSV file path."""
        if isinstance(self.subst_table, dict):
            return _normalize_vocab_mapping(self.subst_table)
        if isinstance(self.subst_table, str):
            if self.subst_table.lower() in {"none", "default"}:
                raise ValueError(
                    "No bundled substitution dictionary is available. "
                    "Pass an explicit path to a .csv file or omit subst_table to disable."
                )
            csv_path = Path(self.subst_table)
        elif isinstance(self.subst_table, Path):
            csv_path = self.subst_table
        else:
            return {}

        if not csv_path.is_file():
            raise FileNotFoundError(f"Substitution table not found: {csv_path}")

        vocab: Dict[str, List[str]] = {}
        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.reader(f, delimiter=";")
            for row in reader:
                if not row:
                    continue
                target_word, *variants = row
                target_word = target_word.strip()
                variants = [v.strip() for v in variants if v is not None]
                vocab[target_word] = variants
        return _normalize_vocab_mapping(vocab)

    def fit(self) -> "TextNormalizer":
        if self.subst_table is None:
            self.variant2target = {}
            self._pattern = None
            self.stats = None
            return self

        vocab = self._load_vocab()
        if not vocab:
            # No vocab loaded -> behave as disabled
            self.variant2target = {}
            self._pattern = None
            self.stats = None
            return self

        self.variant2target = _build_variant2target(vocab)
        self._pattern = build_replacement_pattern(self.variant2target)
        self.stats = ReplaceVocabStats(vocab=vocab)
       
        return self

    def transform_series(
        self, series: pd.Series, field_name: Optional[str] = None
    ) -> pd.Series:
        s = series.fillna("")
        if self.remove_punct:
            s = s.apply(remove_punctuation)
        if self.lowercase:
            s = s.apply(to_lowercase)
        if self.subst_table and self._pattern is not None:
            s = vectorized_replace_with_vocab(
                s,
                self.variant2target,
                stats=self.stats,
                field=field_name,
                pattern=self._pattern,
            )
        if self.replace_yo:
            s = s.str.replace("ё", "е")
        return s

    def transform(self, df: pd.DataFrame, fields: List[str]) -> pd.DataFrame:
        result = df.copy()
        for field in fields:
            result[field] = self.transform_series(result[field], field_name=field)
        return result

    def fit_transform(self, df: pd.DataFrame, fields: List[str]) -> pd.DataFrame:
        return self.fit().transform(df=df, fields=fields)

    def __str__(self):
        return f"TextNormalizer(remove_punct={self.remove_punct},"\
                f" lowercase={self.lowercase},"\
                f" replace_yo={self.replace_yo},"\
                f" subst_table={self.subst_table})"
