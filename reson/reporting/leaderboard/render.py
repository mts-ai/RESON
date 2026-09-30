"""Generate standalone HTML leaderboard reports from multiple RESONRun objects.

Public API: :func:`render_leaderboard_report_html`, :func:`render_leaderboard_report_from_files`.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from reson.core.analysis.run import RESONRun
from reson.reporting.bundling.builders import HtmlReportBundler, LeaderboardPayloadBuilder

_LEADERBOARD_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "resources" / "leaderboard_report"


def render_leaderboard_report_html(
    reson_runs: List[RESONRun],
    model_names: Optional[List[str]] = None,
    model_display_names: Optional[List[str]] = None,
    output_html: str = "leaderboard_report.html",
    dataset_name: Optional[str] = None,
) -> str:
    """Build and save a standalone HTML model leaderboard report.

    Args:
        reson_runs: At least two runs on the same dataset.
        model_names: Model identifiers; defaults to ``RESONRun.name``.
        output_html: Output HTML path.

    Returns:
        Absolute path to the generated file.
    """
    if len(reson_runs) < 2:
        raise ValueError("At least 2 RESONRun objects are required for a leaderboard report")

    names = model_names or [run.name for run in reson_runs]
    if len(names) != len(reson_runs):
        raise ValueError("Number of model_names must match number of reson_runs")

    resolved_dataset = dataset_name or (reson_runs[0].name if reson_runs else "Dataset")

    payload_builder = LeaderboardPayloadBuilder()
    data_payload = payload_builder.build(
        reson_runs=reson_runs,
        model_names=names,
        model_display_names=model_display_names,
        dataset_name=resolved_dataset,
    )

    bundler = HtmlReportBundler()
    build_dir = bundler.build_project(str(_LEADERBOARD_FRONTEND_DIR))
    return bundler.inline_payload(
        build_dir=build_dir,
        data_payload=data_payload,
        output_html=output_html,
        data_global_name="window.RESON_DATA",
    )


def render_leaderboard_report_from_files(
    reson_run_files: List[str],
    model_names: List[str],
    model_display_names: Optional[List[str]] = None,
    output_html: str = "leaderboard_report.html",
    dataset_name: str = "Dataset",
) -> str:
    """Leaderboard report from paths to serialized RESONRun JSON artifacts."""
    if len(reson_run_files) < 2:
        raise ValueError("At least 2 RESONRun files are required for a leaderboard report")
    if len(reson_run_files) != len(model_names):
        raise ValueError("Number of files must match number of model_names")

    reson_runs = [RESONRun.from_json(path) for path in reson_run_files]
    return render_leaderboard_report_html(
        reson_runs=reson_runs,
        model_names=model_names,
        model_display_names=model_display_names,
        output_html=output_html,
        dataset_name=dataset_name,
    )
