# Changelog


## [1.0.0] - 2026-06-24

First public **open-source** release of RESON (Research Engine for Speech & Observation Notes) under the **MIT License**.

### Added

- **CLI** with four command groups: `manifest`, `run`, `report`, and `pipeline`.
- **Python API** — `Manifest`, `RESON`, and `RESONRun` for programmatic analysis and reporting.
- **Manifest toolkit** — profile, import, preprocess, split, sample, and merge for `.json`, `.jsonl`, and `.csv` files.
- **Metric provider interface** with built-in **`jiwer`** backend (WER and CER).
- **Vocabulary-level analysis** — word recall/precision, replacements, and error breakdowns.
- **Model comparison** in the terminal and HTML, with optional **bootstrap significance** testing.
- **Interactive HTML reports** (React + Vite), self-contained and shareable without a server:
  - `single_report` — deep dive into one run
  - `compare_report` — multi-model comparison with significance
  - `leaderboard_report` — compact model overview
- **Docker** image with prebuilt report frontends (`docker build -t reson .`).
- **Documentation** — bilingual README (EN/RU), developer docs, tutorials, and [testing guide](docs/testing.md).
- **Dev extras** — `pip install -e ".[dev]"` / `poetry install --with dev` for pytest and pytest-cov.

### Open-source scope

This release is intended for general use without proprietary infrastructure:

- Local manifest loaders only (JSON / JSONL / CSV).
- Default metric provider: **jiwer**.
- Substitution dictionaries are optional: pass an explicit `.csv` path via `--subst-table` / `subst_table=` when needed.
- Custom metric providers and data loaders can be added via the **Python API** (`MetricProviderABC`, `DataSourceAdapter`).

### Requirements

- Python **3.11+**
- Node.js **18+** and npm **9+** (for building HTML reports locally or in Docker)
