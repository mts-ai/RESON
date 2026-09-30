"""Multi-model compare interactive report (payload + HTML)."""

from reson.reporting.compare.payload import build_compare_report_payload
from reson.reporting.compare.render import (
    render_compare_report_from_files,
    render_compare_report_html,
)

__all__ = [
    "build_compare_report_payload",
    "render_compare_report_html",
    "render_compare_report_from_files",
]
