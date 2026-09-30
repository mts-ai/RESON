"""Single-run interactive report (payload + HTML)."""

from reson.reporting.single.payload import build_single_report_payload
from reson.reporting.single.render import render_single_report_html

__all__ = ["build_single_report_payload", "render_single_report_html"]
