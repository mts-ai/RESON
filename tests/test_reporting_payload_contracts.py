"""Reporting payload and HTML contract tests."""

from __future__ import annotations

import re
from dataclasses import replace
from pathlib import Path

import pytest

from reson.core.analysis.run import RESONRun
from reson.reporting import (
    build_compare_report_payload,
    build_leaderboard_report_payload,
    build_report_context,
    build_single_report_payload,
    render_compare_report_html,
    render_leaderboard_report_html,
    render_single_report_html,
)


def test_single_payload_contract_and_vocab_scoring(candidate_run):
    _, run = candidate_run
    payload = build_single_report_payload(run)

    assert "name" in payload
    assert "metrics" in payload
    assert "summary" in payload
    assert "manifest" in payload
    assert "alerts" in payload
    assert "durationWerData" not in payload

    if payload["manifest"]:
        first = payload["manifest"][0]
        assert "diff_tokens" in first
        assert "diff_html" not in first

    words = payload.get("vocab") or []
    if words:
        first_word = words[0]
        assert "wisComponents" in first_word
        assert {"insertions", "deletions", "substitutions"}.issubset(first_word.keys())


def test_compare_payload_contract_top_level_keys(candidate_run, baseline_run):
    _, candidate = candidate_run
    _, baseline = baseline_run
    payload = build_compare_report_payload(
        reson_runs=[candidate, baseline],
        model_names=["candidate", "baseline"],
        base_model="baseline",
        target_model="candidate",
    )

    for key in (
        "datasetInfo",
        "models",
        "werData",
        "vocabularyData",
        "manifestData",
        "settings",
        "defaultBaseModel",
        "defaultTargetModel",
    ):
        assert key in payload


def test_leaderboard_payload_is_minimal(candidate_run, baseline_run):
    _, candidate = candidate_run
    _, baseline = baseline_run
    payload = build_leaderboard_report_payload(
        reson_runs=[candidate, baseline],
        model_names=["candidate", "baseline"],
        dataset_name="Test Dataset",
    )

    assert set(payload.keys()) == {"datasetInfo", "models", "overviewData", "settings"}
    assert "vocabularyData" not in payload
    assert "manifestData" not in payload
    assert "statisticalSignificanceData" not in payload
    assert len(payload["models"]) == 2
    assert "candidate" in payload["overviewData"]
    assert "baseline" in payload["overviewData"]
    assert payload["settings"]["defaultTheme"] == "system"


def test_context_is_slim_and_has_manifest_records(candidate_run):
    _, run = candidate_run
    context = build_report_context(run)

    assert "metrics_table" not in context
    assert "manifest_err_records" not in context
    assert "manifest_records" in context
    if context["manifest_records"]:
        assert "diff_html" not in context["manifest_records"][0]


def test_run_info_flags_normalization_dictionary(tmp_path):
    from reson import RESON, Manifest
    from reson.core.analysis.vocab_scoring import vocab_needs_enrichment

    subst_csv = tmp_path / "subst.csv"
    subst_csv.write_text("hello;hi\n", encoding="utf-8")

    manifest = Manifest.load_from("tutorials/data/candidate.json")
    manifest.normalize(
        fields=["text", "prediction"],
        remove_punct=True,
        lowercase=True,
        replace_yo=True,
        subst_table=str(subst_csv),
        inplace=True,
    )
    run = RESON(name="candidate", metrics=("WER", "CER")).analyze(
        manifest,
        artifacts_dir=str(tmp_path / "artifacts"),
    )

    assert not vocab_needs_enrichment(run.vocab)

    payload_with = build_single_report_payload(run)
    assert payload_with["runInfo"]["hasNormalizationDictionary"] is True
    assert payload_with["dictionary"]["replacements"] is not None

    cfg = dict(run.config or {})
    cfg["normalize_cfg"] = dict(cfg.get("normalize_cfg") or {})
    cfg["normalize_cfg"]["subst_table"] = None
    run_without = replace(run, replacements=None, config=cfg)
    payload_without = build_single_report_payload(run_without)
    assert payload_without["runInfo"]["hasNormalizationDictionary"] is False
    assert payload_without["dictionary"]["replacements"] is None


@pytest.mark.frontend
def test_single_html_inlines_js_without_external_chunks(tmp_path, candidate_run, frontend_built):
    if not frontend_built:
        pytest.skip("frontend build/ artifacts are required")

    _, run = candidate_run
    out = tmp_path / "single_inline_test.html"
    render_single_report_html(run, str(out))
    html = out.read_text(encoding="utf-8")
    assert "window.RESON_DATA" in html
    assert not re.search(r'<script[^>]+src="[^"]+\.js"', html)
    assert '<div id="root">' in html
    assert len(html) > 100_000


@pytest.mark.frontend
def test_compare_html_inlines_js_without_external_chunks(
    tmp_path,
    candidate_run,
    baseline_run,
    frontend_built,
):
    if not frontend_built:
        pytest.skip("frontend build/ artifacts are required")

    _, candidate = candidate_run
    _, baseline = baseline_run
    out = tmp_path / "compare_inline_test.html"
    render_compare_report_html(
        reson_runs=[candidate, baseline],
        model_names=["candidate", "baseline"],
        output_html=str(out),
        base_model="baseline",
        target_model="candidate",
    )
    html = out.read_text(encoding="utf-8")
    assert "window.RESON_DATA" in html
    assert not re.search(r'<script[^>]+src="[^"]+\.js"', html)
    assert '<div id="root">' in html
    assert len(html) > 100_000


@pytest.mark.frontend
def test_leaderboard_html_inlines_js_without_external_chunks(
    tmp_path,
    candidate_run,
    baseline_run,
    frontend_built,
):
    if not frontend_built:
        pytest.skip("frontend build/ artifacts are required")

    _, candidate = candidate_run
    _, baseline = baseline_run
    out = tmp_path / "leaderboard_inline_test.html"
    render_leaderboard_report_html(
        reson_runs=[candidate, baseline],
        model_names=["candidate", "baseline"],
        output_html=str(out),
        dataset_name="Test Dataset",
    )
    html = out.read_text(encoding="utf-8")
    assert "window.RESON_DATA" in html
    assert not re.search(r'<script[^>]+src="[^"]+\.js"', html)
    assert '<div id="root">' in html
    assert '"overviewData"' in html
    assert '"vocabularyData"' not in html
    assert len(html) > 50_000
