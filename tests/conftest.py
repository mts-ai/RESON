"""Shared pytest fixtures for RESON tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from reson import RESON, Manifest, RESONRun


ROOT = Path(__file__).resolve().parents[1]
TUTORIALS_DATA = ROOT / "tutorials" / "data"
CANDIDATE_MANIFEST = TUTORIALS_DATA / "candidate.json"
BASELINE_MANIFEST = TUTORIALS_DATA / "baseline.json"


@pytest.fixture
def sample_records():
    """Minimal manifest records for unit tests."""
    return [
        {
            "audio_filepath": "/tmp/a1.wav",
            "duration": 2.5,
            "text": "привет мир",
            "prediction": "привет мир",
        },
        {
            "audio_filepath": "/tmp/a2.wav",
            "duration": 5.0,
            "text": "второй строка",
            "prediction": "второй строка",
        },
        {
            "audio_filepath": "/tmp/a3.wav",
            "duration": 1.0,
            "text": "третья строка",
            "prediction": "третья строка",
        },
    ]


@pytest.fixture
def manifest(sample_records) -> Manifest:
    return Manifest(sample_records)


@pytest.fixture
def jsonl_path(tmp_path: Path, sample_records) -> Path:
    path = tmp_path / "manifest.json"
    with path.open("w", encoding="utf-8") as f:
        for row in sample_records:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return path


@pytest.fixture
def cli_runner():
    from typer.testing import CliRunner
    from reson.cli import app

    return CliRunner(), app


def _analyze_manifest(manifest_path: Path, name: str, out_dir: Path) -> tuple[Path, RESONRun]:
    manifest = Manifest.load_from(str(manifest_path))
    manifest.normalize(
        fields=["text", "prediction"],
        remove_punct=True,
        lowercase=True,
        replace_yo=True,
        subst_table=None,
        inplace=True,
    )
    run = RESON(name=name, metrics=("WER", "CER")).analyze(
        manifest,
        artifacts_dir=str(out_dir / name),
    )
    run_path = out_dir / f"{name}.json"
    run.to_json(str(run_path))
    return run_path, run


@pytest.fixture
def candidate_run(tmp_path: Path) -> tuple[Path, RESONRun]:
    return _analyze_manifest(CANDIDATE_MANIFEST, "candidate", tmp_path)


@pytest.fixture
def baseline_run(tmp_path: Path) -> tuple[Path, RESONRun]:
    return _analyze_manifest(BASELINE_MANIFEST, "baseline", tmp_path)


@pytest.fixture
def frontend_built() -> bool:
    single = ROOT / "reson" / "resources" / "single_report" / "build" / "index.html"
    compare = ROOT / "reson" / "resources" / "compare_report" / "build" / "index.html"
    leaderboard = ROOT / "reson" / "resources" / "leaderboard_report" / "build" / "index.html"
    return single.is_file() and compare.is_file() and leaderboard.is_file()
