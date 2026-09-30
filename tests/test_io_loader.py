"""Unit tests for :mod:`reson.io.loader`."""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import pandas as pd
import pytest

from reson.core.manifest import Manifest
from reson.io.loader import (
    CsvLoader,
    JsonlLoader,
    LoaderRegistry,
    default_registry,
)


@pytest.fixture
def sample_record():
    return {
        "audio_filepath": "/tmp/a.wav",
        "duration": 1.0,
        "text": "hello world",
        "prediction": "hello world",
    }


class TestJsonlLoader:
    def test_can_handle_json_extensions(self):
        loader = JsonlLoader()
        assert loader.can_handle("/data/manifest.jsonl")
        assert loader.can_handle("/data/manifest.json")
        assert not loader.can_handle("/data/manifest.csv")

    def test_load_jsonl_lines(self, tmp_path: Path, sample_record):
        path = tmp_path / "manifest.jsonl"
        path.write_text(json.dumps(sample_record, ensure_ascii=False) + "\n", encoding="utf-8")
        records = JsonlLoader().load(str(path))
        assert records == [sample_record]

    def test_load_json_array(self, tmp_path: Path, sample_record):
        path = tmp_path / "manifest.json"
        path.write_text(json.dumps([sample_record]), encoding="utf-8")
        records = JsonlLoader().load(str(path))
        assert records == [sample_record]

    def test_load_empty_file_returns_empty_list(self, tmp_path: Path):
        path = tmp_path / "empty.jsonl"
        path.write_text("", encoding="utf-8")
        assert JsonlLoader().load(str(path)) == []

    def test_load_json_object_as_single_record(self, tmp_path: Path):
        path = tmp_path / "object.json"
        path.write_text('{"text": "single object"}', encoding="utf-8")
        records = JsonlLoader().load(str(path))
        assert records == [{"text": "single object"}]

    def test_load_malformed_json_raises(self, tmp_path: Path):
        path = tmp_path / "broken.jsonl"
        path.write_text("{not valid json}\n", encoding="utf-8")
        with pytest.raises(json.JSONDecodeError):
            JsonlLoader().load(str(path))


class TestCsvLoader:
    def test_can_handle_csv(self):
        loader = CsvLoader()
        assert loader.can_handle("/data/manifest.csv")
        assert not loader.can_handle("/data/manifest.json")

    def test_load_csv_records(self, tmp_path: Path, sample_record):
        path = tmp_path / "manifest.csv"
        pd.DataFrame([sample_record]).to_csv(path, index=False)
        records = CsvLoader().load(str(path))
        assert len(records) == 1
        assert records[0]["text"] == sample_record["text"]


class TestLoaderRegistry:
    def test_registry_selects_first_matching_loader(self, tmp_path: Path, sample_record):
        path = tmp_path / "data.jsonl"
        path.write_text(json.dumps(sample_record) + "\n", encoding="utf-8")
        registry = default_registry()
        records = registry.load(str(path))
        assert records == [sample_record]

    def test_registry_raises_for_unknown_source(self):
        registry = LoaderRegistry([JsonlLoader(), CsvLoader()])
        with pytest.raises(ValueError, match="No loader found"):
            registry.load("unknown-source-without-handler")


class TestManifestLoadFromIntegration:
    def test_manifest_load_from_jsonl(self, tmp_path: Path, sample_record):
        path = tmp_path / "manifest.json"
        path.write_text(json.dumps([sample_record]), encoding="utf-8")
        manifest = Manifest.load_from(str(path))
        assert len(manifest) == 1
        assert manifest[0]["text"] == sample_record["text"]