"""Tests for :class:`reson.core.manifest.Manifest`."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from reson.core.manifest import Manifest


@pytest.fixture
def punctuated_records():
    return [
        {
            "audio_filepath": "/tmp/a1.wav",
            "duration": 2.0,
            "text": "Привет, мир!",
            "prediction": "ПРИВЕТ, МИР!",
        },
        {
            "audio_filepath": "/tmp/a2.wav",
            "duration": 3.0,
            "text": "Ёлка растёт.",
            "prediction": "ёлка растёт",
        },
        {
            "audio_filepath": "/tmp/a3.wav",
            "duration": 1.0,
            "text": "Третья строка.",
            "prediction": "третья строка",
        },
    ]


class TestManifestIO:
    def test_load_from_jsonl_roundtrip(self, tmp_path: Path, jsonl_path: Path, sample_records):
        manifest = Manifest.load_from(str(jsonl_path))
        assert len(manifest) == len(sample_records)

        out = tmp_path / "nested/out.jsonl"
        manifest.to_json(str(out))
        loaded = [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line]
        assert loaded == manifest.manifest

    def test_to_csv_roundtrip(self, tmp_path: Path, manifest):
        out = tmp_path / "out.csv"
        manifest.to_csv(str(out))
        reloaded = Manifest.load_from(str(out))
        assert len(reloaded) == len(manifest)


class TestManifestAccessors:
    def test_len_iter_str(self, manifest):
        assert len(manifest) == 3
        assert list(iter(manifest)) == manifest.manifest
        assert "привет мир" in str(manifest)

    def test_getitem_int_and_slice(self, manifest):
        assert manifest[0]["text"] == "привет мир"
        sub = manifest[0:2]
        assert isinstance(sub, Manifest)
        assert len(sub) == 2

    def test_to_df_returns_copy(self, manifest):
        df = manifest.to_df()
        df.loc[0, "text"] = "changed"
        assert manifest[0]["text"] == "привет мир"

    def test_head(self, manifest):
        head = manifest.head(2)
        assert len(head) == 2
        assert list(head["text"]) == ["привет мир", "второй строка"]


class TestManifestColumnOps:
    def test_rename_inplace_and_copy(self, manifest):
        original_columns = list(manifest.to_df().columns)
        copied = manifest.rename({"text": "transcript"}, inplace=False)
        assert "transcript" in copied.to_df().columns
        assert "text" in manifest.to_df().columns
        assert list(manifest.to_df().columns) == original_columns

        manifest.rename({"text": "transcript"}, inplace=True)
        assert "transcript" in manifest.to_df().columns
        assert "text" not in manifest.to_df().columns

    def test_select_columns(self, manifest):
        selected = manifest.select_columns(["text", "duration"])
        assert list(selected.to_df().columns) == ["text", "duration"]

        single = manifest.select_columns("text")
        assert list(single.to_df().columns) == ["text"]

    def test_drop(self, manifest):
        dropped = manifest.drop("prediction")
        dropped = dropped.to_df()
        assert "prediction" not in dropped.columns
        assert "text" in dropped.columns
        assert "prediction" not in dropped.columns

    def test_replace_inplace_and_copy(self, manifest):
        replaced = manifest.replace(["text"], "привет", "hello", inplace=False)
        assert replaced[0]["text"] == "hello мир"
        assert manifest[0]["text"] == "привет мир"

        manifest.replace(["text"], "второй", "second", inplace=True)
        assert manifest[1]["text"] == "second строка"


class TestManifestNormalize:
    def test_normalize_transforms_fields(self, punctuated_records):
        manifest = Manifest(punctuated_records)
        normalized = manifest.normalize(
            fields=["text", "prediction"],
            remove_punct=True,
            lowercase=True,
            replace_yo=True,
            subst_table=None,
            inplace=False,
        )

        assert normalized.normalized is True
        assert normalized.normalized_cfg["lowercase"] is True
        assert normalized.normalized_cfg["remove_punct"] is True
        assert normalized[0]["text"] == "привет мир"
        assert normalized[1]["text"] == "елка растет"
        assert manifest.normalized is False

    def test_normalize_inplace(self, punctuated_records):
        manifest = Manifest(punctuated_records)
        result = manifest.normalize(
            fields="text",
            remove_punct=True,
            lowercase=True,
            replace_yo=True,
            subst_table=None,
            inplace=True,
        )

        assert result is manifest
        assert manifest.normalized is True
        assert manifest[0]["text"] == "привет мир"

    def test_normalize_with_subst_table_file(self, punctuated_records, tmp_path):
        csv_path = tmp_path / "subst.csv"
        csv_path.write_text("мир;mir\n", encoding="utf-8")
        normalized = Manifest(punctuated_records).normalize(
            fields=["text"],
            subst_table=str(csv_path),
            inplace=False,
        )
        assert normalized.normalized is True
        assert normalized.replacements is not None

    def test_normalize_updates_vocab_and_alphabet(self, punctuated_records):
        raw = Manifest(punctuated_records)
        normalized = raw.normalize(
            fields=["text"],
            remove_punct=True,
            lowercase=True,
            replace_yo=True,
            subst_table=None,
            inplace=False,
        )

        assert raw.vocab.size > 0
        assert raw.alphabet.size > 0
        assert normalized.vocab.size > 0
        assert normalized.summary["Normalized"] is True
        assert normalized.summary["Number of utterances"] == 3


class TestManifestSample:
    def test_sample_int_with_shuffle(self, manifest):
        sampled = manifest.sample(2, shuffle=True, random_seed=42)
        assert len(sampled) == 2

    def test_sample_float_ratio(self, manifest):
        sampled = manifest.sample(0.5, shuffle=False)
        assert len(sampled) == 1

    def test_sample_without_shuffle_takes_prefix(self, manifest):
        sampled = manifest.sample(2, shuffle=False)
        assert sampled.manifest == manifest.manifest[:2]

    def test_sample_clamps_to_total(self, manifest):
        sampled = manifest.sample(10, shuffle=False)
        assert len(sampled) == len(manifest)

    @pytest.mark.parametrize(
        "n, exc",
        [
            (1.5, ValueError),
            (0.0, ValueError),
            (1.0, ValueError),
            ("3", TypeError), 
        ],
    )
    def test_sample_invalid_n(self, manifest, n, exc):
        with pytest.raises(exc):
            manifest.sample(n)


class TestManifestSplit:
    def test_train_test_split_sizes(self, manifest):
        train, test = manifest.train_test_split(test_size=0.34, random_state=0)
        assert isinstance(train, Manifest)
        assert isinstance(test, Manifest)
        assert len(train) + len(test) == len(manifest)
        assert len(test) >= 1

    @pytest.mark.parametrize("test_size", [0.0, 1.0, -0.1, 1.1])
    def test_train_test_split_invalid_test_size(self, manifest, test_size):
        with pytest.raises(ValueError, match="test_size"):
            manifest.train_test_split(test_size=test_size)

    def test_train_test_split_requires_min_two_records(self):
        single = Manifest([{"text": "one", "duration": 1.0}])
        with pytest.raises(ValueError, match="минимум 2"):
            single.train_test_split(test_size=0.5)

    def test_train_test_split_stratify(self):
        records = [
            {"text": "a1", "duration": 1.0, "speaker": "spk_a"},
            {"text": "a2", "duration": 1.0, "speaker": "spk_a"},
            {"text": "a3", "duration": 1.0, "speaker": "spk_a"},
            {"text": "b1", "duration": 1.0, "speaker": "spk_b"},
            {"text": "b2", "duration": 1.0, "speaker": "spk_b"},
            {"text": "b3", "duration": 1.0, "speaker": "spk_b"},
        ]
        manifest = Manifest(records)
        train, test = manifest.train_test_split(
            test_size=0.34,
            random_state=0,
            stratify="speaker",
        )
        assert len(train) + len(test) == len(manifest)
        assert len(test) >= 2
        train_speakers = set(train.to_df()["speaker"])
        test_speakers = set(test.to_df()["speaker"])
        assert train_speakers == {"spk_a", "spk_b"}
        assert test_speakers == {"spk_a", "spk_b"}

    def test_train_test_split_reproducible_without_shuffle(self, manifest):
        train_a, test_a = manifest.train_test_split(
            test_size=0.34,
            shuffle=False,
            random_state=0,
        )
        train_b, test_b = manifest.train_test_split(
            test_size=0.34,
            shuffle=False,
            random_state=99,
        )
        assert train_a.manifest == train_b.manifest
        assert test_a.manifest == test_b.manifest


class TestManifestMerge:
    def test_add_concatenates_manifests(self, manifest):
        first = manifest[0:1]
        second = manifest[1:2]
        merged = first + second
        assert len(merged) == 2
        assert merged.manifest == first.manifest + second.manifest

    def test_radd_zero_returns_self(self, manifest):
        assert (0 + manifest) is manifest


class TestManifestStats:
    def test_summary_on_load(self, manifest):
        summary = manifest.summary
        assert summary["Number of utterances"] == 3
        assert summary["Normalized"] is False
        assert manifest.vocab.size > 0
        assert manifest.alphabet.size > 0

    def test_stats_recomputed_after_column_rename(self, manifest):
        utterances_before = manifest.summary["Number of utterances"]
        manifest.rename({"text": "transcript"}, inplace=True)
        assert manifest.summary["Number of utterances"] == utterances_before
        assert manifest.vocab.size == 0

    def test_stats_object_available(self, manifest):
        stats = manifest.stats
        assert stats.total_samples == 3
        assert stats.vocab.size == manifest.vocab.size
