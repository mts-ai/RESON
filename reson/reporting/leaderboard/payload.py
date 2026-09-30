"""Build minimal JSON payload for the standalone leaderboard report.

``window.RESON_DATA`` contract: only overviewData, models, datasetInfo, and settings —
no manifest, vocabulary, analytics, or bootstrap sections.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from reson.core.analysis.run import RESONRun
from reson.reporting.common.shared import (
    extract_int_value,
    format_hours_to_hhmmss,
    normalize_duration_value,
)
from reson.reporting.compare.payload import _build_model_overview

_as_int = extract_int_value


def _build_duration_types_from_manifest(reson_run: RESONRun) -> Dict[str, int]:
    manifest = reson_run.manifest
    if manifest.empty or "duration" not in manifest.columns:
        return {"short": 0, "normal": 0, "long": 0}

    durations = manifest["duration"].dropna().tolist()
    return {
        "short": len([d for d in durations if float(d) < 5]),
        "normal": len([d for d in durations if 5 <= float(d) <= 30]),
        "long": len([d for d in durations if float(d) > 30]),
    }


def build_leaderboard_report_payload(
    reson_runs: List[RESONRun],
    model_names: List[str],
    model_display_names: Optional[List[str]] = None,
    dataset_name: str = "Dataset",
) -> Dict[str, Any]:
    """Build lightweight payload for the leaderboard_report frontend."""
    if len(reson_runs) != len(model_names):
        raise ValueError("Number of RESONRun objects must match number of model_names")

    display_names = model_names if model_display_names is None else model_display_names
    if len(display_names) != len(model_names):
        display_names = model_names

    total_samples = 0
    total_duration_hours = 0.0
    summary_total_duration: str | None = None

    if reson_runs:
        first_run = reson_runs[0]
        summary = first_run.summary if isinstance(first_run.summary, dict) else {}
        summary_total_duration = normalize_duration_value(summary.get("Number of hours"))
        total_samples = _as_int(summary.get("Number of utterances"), 0)
        if total_samples <= 0 and not first_run.manifest.empty:
            total_samples = len(first_run.manifest)
        if "duration" in first_run.manifest.columns:
            total_duration_hours = float(first_run.manifest["duration"].sum() / 3600.0)

    models = [{"name": name, "displayName": display} for name, display in zip(model_names, display_names)]
    overview = {name: _build_model_overview(run) for run, name in zip(reson_runs, model_names)}
    duration_types = _build_duration_types_from_manifest(reson_runs[0]) if reson_runs else {
        "short": 0,
        "normal": 0,
        "long": 0,
    }

    return {
        "datasetInfo": {
            "name": dataset_name,
            "totalSamples": total_samples,
            "totalDuration": summary_total_duration or format_hours_to_hhmmss(total_duration_hours),
            "durationTypes": duration_types,
        },
        "models": models,
        "overviewData": overview,
        "settings": {"language": "ru", "defaultTheme": "system"},
    }
