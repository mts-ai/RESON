"""CLI tests for multi-run profile and compare flows."""

from __future__ import annotations

import pytest


def test_run_profile_single_run(cli_runner, candidate_run):
    runner, app = cli_runner
    run_path, _ = candidate_run
    result = runner.invoke(
        app,
        ["run", "profile", str(run_path), "--mode", "both"],
    )
    assert result.exit_code == 0, result.stdout
    assert "WER" in result.stdout or "Metrics" in result.stdout


def test_run_profile_many_runs_table(cli_runner, candidate_run, baseline_run):
    runner, app = cli_runner
    candidate_path, _ = candidate_run
    baseline_path, _ = baseline_run
    runs_dir = candidate_path.parent
    result = runner.invoke(
        app,
        ["run", "profile", str(runs_dir), "--mode", "table"],
    )
    assert result.exit_code == 0, result.stdout
    assert "candidate" in result.stdout
    assert "baseline" in result.stdout


def test_run_compare_with_bootstrap(cli_runner, candidate_run, baseline_run):
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
            "--bootstrap",
            "-b",
            "1000",
            "--significance-scope",
            "primary",
        ],
    )
    assert result.exit_code == 0, result.stdout
    assert "candidate" in result.stdout.lower()


def test_report_compare_requires_frontend(tmp_path, cli_runner, candidate_run, baseline_run, frontend_built):
    if not frontend_built:
        pytest.skip("frontend build/ artifacts are required for compare HTML tests")

    runner, app = cli_runner
    candidate_path, _ = candidate_run
    baseline_path, _ = baseline_run
    out_html = tmp_path / "compare.html"
    result = runner.invoke(
        app,
        [
            "report",
            "compare",
            str(candidate_path),
            str(baseline_path),
            "-o",
            str(out_html),
        ],
    )
    assert result.exit_code == 0, result.stdout
    html = out_html.read_text(encoding="utf-8")
    assert "window.RESON_DATA" in html
    assert "<div id=\"root\">" in html
