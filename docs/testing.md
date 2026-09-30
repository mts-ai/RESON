# Tests

Tests live in [`tests/`](../tests/). Pytest and coverage settings are in [`pyproject.toml`](../pyproject.toml).

## Install dev dependencies

```bash
pip install -e ".[dev]"
# or
poetry install --with dev
```

The `[dev]` extra includes `pytest` and `pytest-cov`.

## Quick run

```bash
python -m pytest -q
```

Some tests are marked `@pytest.mark.frontend` and need a built frontend (`build/index.html`) in all three report folders. Without that build they are skipped.

## Build frontends before frontend tests

```bash
cd reson/resources/single_report && npm ci && npm run build
cd ../compare_report && npm ci && npm run build
cd ../leaderboard_report && npm ci && npm run build
```

You can set `export RESON_INLINE_HTML=1` before the build, the same way Docker does.

## Coverage

```bash
python -m pytest -q \
  --cov=reson \
  --cov-report=term-missing:skip-covered \
  --cov-fail-under=75 \
  --cov-report=html:coverage_html
```

The line-coverage threshold for the `reson` package is **75%** (`tool.coverage.report.fail_under` in `pyproject.toml`). `reson/resources/*` is excluded from coverage.

Coverage HTML report: `coverage_html/index.html`.

## Useful markers

| Marker | Purpose |
|--------|---------|
| `frontend` | Requires prebuilt assets in `reson/resources/*/build/` |

Marker list: `tool.pytest.ini_options.markers` in `pyproject.toml`.
