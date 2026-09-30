"""Generate interactive HTML single reports from an RESONRun.

Flow:
1. :class:`~reson.reporting.bundling.builders.RunContextAssembler` — context + ErrorAnalyzer.
2. :class:`~reson.reporting.bundling.builders.SinglePayloadBuilder` — JSON for React.
3. :class:`~reson.reporting.bundling.builders.HtmlReportBundler` — Vite build and inline HTML.

Public API: :func:`render_single_report_html`.
"""

from __future__ import annotations

from pathlib import Path

from reson.core.analysis.run import RESONRun
from reson.reporting.bundling.builders import HtmlReportBundler, RunContextAssembler, SinglePayloadBuilder

_SINGLE_REPORT_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "resources" / "single_report"
_DATA_GLOBAL = "window.RESON_DATA"


def render_single_report_html(
    reson_run: RESONRun | str,
    output_html: str = "single_report.html",
) -> str:
    """Build and save an interactive HTML report for a single run.

    Args:
        reson_run: :class:`RESONRun` instance or path to a serialized run JSON file.
        output_html: Output HTML path.

    Returns:
        Absolute path to the generated file.
    """
    if isinstance(reson_run, str):
        reson_run = RESONRun.from_json(reson_run)

    context_assembler = RunContextAssembler()
    payload_builder = SinglePayloadBuilder(context_assembler=context_assembler)
    
    bundle = context_assembler.assemble(reson_run)
    data_payload = payload_builder.build(reson_run, bundle=bundle)

    bundler = HtmlReportBundler()
    build_dir = bundler.build_project(str(_SINGLE_REPORT_FRONTEND_DIR))
    
    return bundler.inline_payload(
        build_dir=build_dir,
        data_payload=data_payload,
        output_html=output_html,
        data_global_name=_DATA_GLOBAL,
    )
