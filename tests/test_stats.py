"""Tests for :mod:`reson.core.stats`."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from reson.core.stats import (
    Alphabet,
    ManifestSummary,
    ReplaceVocabStats,
    Vocab,
    seconds2hms,
)


@pytest.fixture
def mixed_vocab() -> Vocab:
    return Vocab(
        [
            {"word": "привет", "count": 5, "recall": 90.0, "precision": 85.0, "f1_score": 87.0, "wis": 10.0},
            {"word": "hello", "count": 3, "recall": 80.0, "precision": 75.0, "f1_score": 77.0, "wis": 20.0},
            {"word": "123", "count": 2, "recall": 100.0, "precision": 100.0, "f1_score": 100.0, "wis": 5.0},
            {"word": "foo-bar", "count": 1, "recall": 50.0, "precision": 50.0, "f1_score": 50.0, "wis": 15.0},
        ]
    )


@pytest.fixture
def mixed_alphabet() -> Alphabet:
    return Alphabet.from_records(
        [
            {"char": "п", "count": 10},
            {"char": "a", "count": 8},
            {"char": "1", "count": 2},
            {"char": " ", "count": 20},
        ]
    )


class TestSeconds2Hms:
    def test_seconds2hms_basic(self):
        assert seconds2hms(0) == "00:00:00"
        assert seconds2hms(65.0) == "00:01:05"
        assert seconds2hms(3600) == "01:00:00"
        assert seconds2hms(86401) == "24:00:01"

    def test_seconds2hms_invalid_becomes_zero(self):
        assert seconds2hms(float("nan")) == "00:00:00"
        assert seconds2hms(-1) == "00:00:00"


class TestManifestSummary:
    def test_from_dataframe_builds_vocab_and_alphabet(self, sample_records):
        df = pd.DataFrame(sample_records)
        summary = ManifestSummary.from_dataframe(df)

        assert summary.total_samples == 3
        assert summary.vocab.size > 0
        assert summary.alphabet.size > 0
        assert "Number of utterances" in summary.summary
        assert summary.summary["Normalized"] is False

    def test_from_dataframe_empty(self):
        summary = ManifestSummary.from_dataframe(pd.DataFrame())
        assert summary.total_samples == 0
        assert summary.total_duration == "00:00:00"
        assert summary.vocab.size == 0
        assert summary.alphabet.size == 0

    def test_from_dataframe_includes_replacement_stats(self):
        repl = ReplaceVocabStats(fields={"text": 4}, words={"uh": 2})
        summary = ManifestSummary.from_dataframe(
            pd.DataFrame([{"duration": 1.0, "text": "hello"}]),
            replace_stats=repl,
            normalized=True,
            normalized_cfg={"lowercase": True},
        )
        assert summary.summary["Normalized"] is True
        assert summary.summary["Replacements total"] == 4
        assert summary.summary["Replacements by field"] == {"text": 4}


class TestVocab:
    def test_category_subsets(self, mixed_vocab):
        assert mixed_vocab.russian.size == 1
        assert mixed_vocab.english.size == 1
        assert mixed_vocab.numeric.size == 1
        assert mixed_vocab.other.size == 1

    def test_mean_metrics(self, mixed_vocab):
        assert mixed_vocab.mean_recall == pytest.approx(80.0)
        assert mixed_vocab.mean_precision == pytest.approx(77.5)
        assert mixed_vocab.mean_f1score == pytest.approx(78.5)
        assert mixed_vocab.mean_wis == pytest.approx(12.5)

    def test_mean_recall_raises_without_column(self):
        bare = Vocab([{"word": "x", "count": 1}])
        with pytest.raises(ValueError, match="Recall"):
            _ = bare.mean_recall

    def test_top_words(self, mixed_vocab):
        top = mixed_vocab.top_words(n=2, by="count")
        assert list(top["word"]) == ["привет", "hello"]

    def test_top_words_unknown_column_raises(self, mixed_vocab):
        with pytest.raises(ValueError, match="Column 'missing'"):
            mixed_vocab.top_words(by="missing")

    def test_find_word_modes(self, mixed_vocab):
        assert len(mixed_vocab.find_word("hello", exact=True)) == 1
        assert len(mixed_vocab.find_word("hel", startswith=True)) == 1
        assert len(mixed_vocab.find_word("foo", case=False)) == 1

    def test_subtract_vocab(self, mixed_vocab):
        remaining = mixed_vocab - mixed_vocab.english
        words = set(remaining.data["word"])
        assert "hello" not in words
        assert "привет" in words

    def test_subtract_invalid_type_raises(self, mixed_vocab):
        with pytest.raises(ValueError, match="Other is not a Vocab"):
            _ = mixed_vocab - object()

    def test_to_csv_and_jsonl_roundtrip(self, mixed_vocab, tmp_path: Path):
        csv_path = tmp_path / "vocab.csv"
        jsonl_path = tmp_path / "vocab.jsonl"
        mixed_vocab.to_csv(str(csv_path))
        mixed_vocab.to_jsonl(str(jsonl_path))

        reloaded = Vocab(pd.read_csv(csv_path))
        assert reloaded.size == mixed_vocab.size
        lines = [json.loads(line) for line in jsonl_path.read_text(encoding="utf-8").splitlines() if line]
        assert len(lines) == mixed_vocab.size

    def test_str_contains_category_summary(self, mixed_vocab):
        rendered = str(mixed_vocab)
        assert "Total words:" in rendered
        assert "Mean recall:" in rendered
        assert "Russian words" in rendered


class TestAlphabet:
    def test_from_records_and_chars(self, mixed_alphabet):
        assert mixed_alphabet.size == 4
        assert set(mixed_alphabet.chars) == {" ", "1", "a", "п"}

    def test_category_subsets(self, mixed_alphabet):
        assert mixed_alphabet.russian.size == 1
        assert mixed_alphabet.english.size == 1
        assert mixed_alphabet.numeric.size == 1
        assert mixed_alphabet.other.size == 1

    def test_to_csv(self, mixed_alphabet, tmp_path: Path):
        out = tmp_path / "alphabet.csv"
        mixed_alphabet.to_csv(str(out))
        reloaded = Alphabet.from_records(pd.read_csv(out).to_dict("records"))
        assert reloaded.size == mixed_alphabet.size


class TestReplaceVocabStats:
    def test_total_replacements(self):
        stats = ReplaceVocabStats(fields={"text": 2, "prediction": 1}, words={"uh": 3})
        assert stats.total_replacements == 3

    def test_str_summary(self):
        stats = ReplaceVocabStats(fields={"text": 2}, words={"uh": 3, "um": 1})
        rendered = str(stats)
        assert "text: 2" in rendered
        assert "uh: 3" in rendered
