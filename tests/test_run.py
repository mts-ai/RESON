"""Unit tests for :class:`reson.core.analysis.run.RESONRun`."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from reson.core.analysis.run import RESONRun
from reson.core.analysis.vocab_scoring import vocab_needs_enrichment


class TestRESONRunSerialization:
    def test_to_dict_includes_schema_version(self, candidate_run):
        _, run = candidate_run
        payload = run.to_dict()
        assert payload["schema_version"] == "1.0"
        assert payload["name"] == run.name
        assert payload["manifest"]
        assert payload["vocab"]

    def test_to_json_from_json_roundtrip(self, candidate_run, tmp_path: Path):
        _, run = candidate_run
        out = tmp_path / "nested/run.json"
        run.to_json(str(out))

        loaded = RESONRun.from_json(str(out))
        assert loaded.name == run.name
        assert len(loaded.manifest) == len(run.manifest)
        assert set(loaded.metrics.index.astype(str)) == set(run.metrics.index.astype(str))
        assert loaded.config == run.config
        assert loaded.meta == run.meta

    def test_from_dict_roundtrip_via_json(self, candidate_run):
        _, run = candidate_run
        payload = run.to_dict()
        restored = json.loads(json.dumps(payload, ensure_ascii=False))
        loaded = RESONRun.from_dict(restored)
        assert loaded.name == run.name
        assert loaded.summary == run.summary

    def test_from_dict_auto_enriches_bare_vocab(self, candidate_run):
        _, run = candidate_run
        payload = run.to_dict()
        payload["vocab"] = [
            {"word": row["word"], "count": row["count"], "recall": row["recall"]}
            for row in payload["vocab"]
        ]

        loaded = RESONRun.from_dict(payload)
        assert not vocab_needs_enrichment(loaded.vocab)
        assert "wis" in loaded.vocab.data.columns
        assert "insertions" in loaded.vocab.data.columns

    def test_str_contains_summary_and_metrics(self, candidate_run):
        _, run = candidate_run
        rendered = str(run)
        assert "Number of examples" in rendered
        assert "Metrics:" in rendered
        assert "WER" in rendered


class TestRESONRunReportWrapper:
    def test_report_delegates_to_rendering(self, candidate_run, tmp_path: Path, monkeypatch):
        _, run = candidate_run
        called = {}

        def _fake_render(current_run, output_html):
            called["run_name"] = current_run.name
            called["output_html"] = output_html
            Path(output_html).write_text("<html></html>", encoding="utf-8")
            return output_html

        monkeypatch.setattr(
            "reson.reporting.render_single_report_html",
            _fake_render,
        )
        out = tmp_path / "report.html"
        result = run.report(str(out))
        assert result == str(out)
        assert called["run_name"] == run.name
