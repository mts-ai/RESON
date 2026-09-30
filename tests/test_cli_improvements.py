"""CLI smoke and regression tests for unified RESON commands."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TUTORIALS_DATA = ROOT / "tutorials" / "data"
CANDIDATE_MANIFEST = TUTORIALS_DATA / "candidate.json"
BASELINE_MANIFEST = TUTORIALS_DATA / "baseline.json"


def test_manifest_profile_full(cli_runner, jsonl_path):
    runner, app = cli_runner
    result = runner.invoke(
        app,
        ["manifest", "profile", str(jsonl_path), "--full"],
    )
    assert result.exit_code == 0, result.stdout
    assert "Number of utterances" in result.stdout or "records" in result.stdout.lower()


def test_manifest_preprocess_with_subst_table_none(tmp_path, cli_runner, jsonl_path):
    runner, app = cli_runner
    out_path = tmp_path / "normalized.jsonl"
    result = runner.invoke(
        app,
        [
            "manifest",
            "preprocess",
            str(jsonl_path),
            "-o",
            str(out_path),
            "--subst-table",
            "none",
        ],
    )
    assert result.exit_code == 0, result.stdout
    assert out_path.is_file()


def test_run_analyze_single_manifest(tmp_path, cli_runner):
    runner, app = cli_runner
    out_dir = tmp_path / "runs"
    result = runner.invoke(
        app,
        [
            "run",
            "analyze",
            str(CANDIDATE_MANIFEST),
            "-n",
            "candidate",
            "-o",
            str(out_dir),
            "-m",
            "WER",
            "-m",
            "CER",
        ],
    )
    assert result.exit_code == 0, result.stdout
    run_json = out_dir / "candidate.json"
    assert run_json.is_file()
    payload = json.loads(run_json.read_text(encoding="utf-8"))
    assert payload["name"] == "candidate"
    assert payload["metrics"]


def test_run_analyze_batch_rejects_meta(cli_runner, tmp_path):
    runner, app = cli_runner
    batch_dir = tmp_path / "batch"
    batch_dir.mkdir()
    (batch_dir / "candidate.json").write_text(
        CANDIDATE_MANIFEST.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    (batch_dir / "baseline.json").write_text(
        BASELINE_MANIFEST.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    result = runner.invoke(
        app,
        [
            "run",
            "analyze",
            str(batch_dir),
            "-o",
            str(tmp_path / "runs"),
            "--meta",
            '{"team":"qa"}',
        ],
    )
    assert result.exit_code != 0
    output = f"{result.stdout}\n{result.stderr}"
    assert "meta" in output.lower()


def test_run_compare_candidate_first(tmp_path, cli_runner, candidate_run, baseline_run):
    runner, app = cli_runner
    candidate_path, _ = candidate_run
    baseline_path, _ = baseline_run
    result = runner.invoke(
        app,
        [
            "run",
            "compare",
            str(candidate_path),
            str(baseline_path),
        ],
    )
    assert result.exit_code == 0, result.stdout
    assert "candidate" in result.stdout.lower()


def test_pipeline_single_builds_html(tmp_path, cli_runner, frontend_built):
    if not frontend_built:
        pytest.skip("frontend build/ artifacts are required for HTML pipeline tests")

    runner, app = cli_runner
    out_html = tmp_path / "single.html"
    run_json = tmp_path / "candidate.json"
    result = runner.invoke(
        app,
        [
            "pipeline",
            "single",
            str(CANDIDATE_MANIFEST),
            "-o",
            str(out_html),
            "--save-run-json",
            str(run_json),
            "--subst-table",
            "none",
        ],
    )
    assert result.exit_code == 0, result.stdout
    assert out_html.is_file()
    assert run_json.is_file()
    html = out_html.read_text(encoding="utf-8")
    assert "window.RESON_DATA" in html


def test_cli_help_lists_top_level_groups(cli_runner):
    runner, app = cli_runner
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for group in ("manifest", "run", "report", "pipeline"):
        assert group in result.stdout
