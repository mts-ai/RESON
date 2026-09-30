# Local development

## Requirements

- Python **3.11+**
- Node.js **18+**, npm **9+** (for HTML reports)
- Git

## Install Python dependencies

### Poetry (recommended)

```bash
poetry env use 3.11
poetry install --with dev
poetry run reson --help
```

### pip

```bash
python -m pip install --upgrade pip
pip install -e .
pip install -e ".[dev]"
```

> **Note:** the `[dev]` extra in `setup.py` includes pytest and pytest-cov. With Poetry, use `poetry install --with dev`. How to run tests: [testing.md](testing.md).

## Build report frontends

Three apps: `single_report`, `compare_report`, `leaderboard_report`.

```bash
cd reson/resources/single_report && npm ci && npm run build
cd ../compare_report && npm ci && npm run build
cd ../leaderboard_report && npm ci && npm run build
```

For the HTML export build (one JS bundle), set:

```bash
export RESON_INLINE_HTML=1
npm run build
```

The Docker image already sets `RESON_INLINE_HTML=1`.

UI development without Python:

```bash
cd reson/resources/single_report
npm ci && npm run dev   # mock data in DataContext
```

## Useful environment variables

| Variable | Read by | Purpose |
|----------|---------|---------|
| `RESON_INLINE_HTML=1` | Vite (`vite.config.ts`) | One JS bundle for inline HTML |
| `RESON_FORCE_REBUILD=1` | Python (`run_vite_build`) | Force a frontend rebuild |

## Code layout

```text
reson/
  cli.py              # Typer CLI
  core/               # Manifest, RESONRun, metrics, vocab
  reporting/          # payload + HTML bundling
  resources/          # React/Vite reports
tests/                # pytest
tutorials/            # user guides
```
