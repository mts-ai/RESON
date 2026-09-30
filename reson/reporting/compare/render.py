"""Generate interactive HTML compare reports from multiple RESONRun objects.

Flow:
1. :class:`~reson.reporting.bundling.builders.ComparePayloadBuilder` — JSON for React.
2. :class:`~reson.reporting.bundling.builders.HtmlReportBundler` — Vite build and inline.

Public API: :func:`render_compare_report_html`, :func:`render_compare_report_from_files`.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple

from reson.core.analysis.run import RESONRun
from reson.reporting.bundling.builders import ComparePayloadBuilder, HtmlReportBundler

_COMPARE_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "resources" / "compare_report"


def render_compare_report_html(
    reson_runs: List[RESONRun],
    model_names: Optional[List[str]] = None,
    model_display_names: Optional[List[str]] = None,
    output_html: str = "model_compare_report.html",
    dataset_name: Optional[str] = None,
    dataset_description: str = "",
    base_model: Optional[str] = None,
    target_model: Optional[str] = None,
    additional_pairs: Optional[List[Tuple[str, str]]] = None,
    significance_pairs: Optional[List[Tuple[str, str]]] = None,
    num_bootstraps: int = 2000,
    alpha: float = 0.05,
) -> str:
    """Build and save an HTML model-comparison report.

    Args:
        reson_runs: At least two analysis runs.
        model_names: Model identifiers; defaults to ``RESONRun.name``.
        output_html: Output HTML path.

    Returns:
        Absolute path to the generated file.
    """
    if len(reson_runs) < 2:
        raise ValueError("At least 2 RESONRun objects are required for comparison")

    names = model_names or [run.name for run in reson_runs]
    if len(names) != len(reson_runs):
        raise ValueError("Number of model_names must match number of reson_runs")

    resolved_dataset = dataset_name or (reson_runs[0].name if reson_runs else "Dataset")

    payload_builder = ComparePayloadBuilder()
    data_payload = payload_builder.build(
        reson_runs=reson_runs,
        model_names=names,
        model_display_names=model_display_names,
        dataset_name=resolved_dataset,
        dataset_description=dataset_description,
        base_model=base_model,
        target_model=target_model,
        additional_pairs=additional_pairs,
        significance_pairs=significance_pairs,
        num_bootstraps=num_bootstraps,
        alpha=alpha,
    )

    bundler = HtmlReportBundler()
    build_dir = bundler.build_project(str(_COMPARE_FRONTEND_DIR))
    return bundler.inline_payload(
        build_dir=build_dir,
        data_payload=data_payload,
        output_html=output_html,
        data_global_name="window.RESON_DATA",
    )


def render_compare_report_from_files(
    reson_run_files: List[str],
    model_names: List[str],
    model_display_names: Optional[List[str]] = None,
    output_html: str = "model_compare_report.html",
    dataset_name: str = "Dataset",
    dataset_description: str = "",
    num_bootstraps: int = 2000,
    alpha: float = 0.05,
) -> str:
    """Compare report from paths to serialized RESONRun JSON artifacts."""
    if len(reson_run_files) < 2:
        raise ValueError("At least 2 RESONRun files are required for comparison")
    if len(reson_run_files) != len(model_names):
        raise ValueError("Number of files must match number of model_names")

    reson_runs = [RESONRun.from_json(path) for path in reson_run_files]
    return render_compare_report_html(
        reson_runs=reson_runs,
        model_names=model_names,
        model_display_names=model_display_names,
        output_html=output_html,
        dataset_name=dataset_name,
        dataset_description=dataset_description,
        num_bootstraps=num_bootstraps,
        alpha=alpha,
    )
