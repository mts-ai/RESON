"""Interactive HTML reporting for RESON runs.

Layout::

    reporting/
      common/     — context + shared helpers
      bundling/   — payload builders, Vite inline
      single/       — one-run report
      compare/      — multi-run comparison report
      leaderboard/  — lightweight model podium report
"""

from reson.reporting.bundling.builders import (
    ComparePayloadBuilder,
    HtmlReportBundler,
    LeaderboardPayloadBuilder,
    RunContextAssembler,
    RunContextBundle,
    SinglePayloadBuilder,
)
from reson.reporting.common.context import build_report_context
from reson.reporting.compare.payload import build_compare_report_payload
from reson.reporting.compare.render import (
    render_compare_report_from_files,
    render_compare_report_html,
)
from reson.reporting.leaderboard.payload import build_leaderboard_report_payload
from reson.reporting.leaderboard.render import (
    render_leaderboard_report_from_files,
    render_leaderboard_report_html,
)
from reson.reporting.single.payload import build_single_report_payload
from reson.reporting.single.render import render_single_report_html

__all__ = [
    "build_compare_report_payload",
    "build_leaderboard_report_payload",
    "build_report_context",
    "build_single_report_payload",
    "ComparePayloadBuilder",
    "HtmlReportBundler",
    "LeaderboardPayloadBuilder",
    "render_compare_report_from_files",
    "render_compare_report_html",
    "render_leaderboard_report_from_files",
    "render_leaderboard_report_html",
    "render_single_report_html",
    "RunContextAssembler",
    "RunContextBundle",
    "SinglePayloadBuilder",
]
