# RESON leaderboard_report (Vite + React)

A compact standalone HTML "podium" for several models on one dataset. It shows a metrics overview without the full vocabulary and manifest drill-down. Use it when you need to compare many models quickly and `compare_report` is more than you need.

Python injects the data as `window.RESON_DATA` (see `reson/reporting/leaderboard/`).

## When to use it

| Report | Purpose |
|--------|---------|
| `single_report` | Deep dive into one run (metrics, vocab, manifest, analytics) |
| `compare_report` | Pairwise comparison with bootstrap, vocab, and manifest drill-down |
| `leaderboard_report` | Compact podium for **2+** models on one dataset |

## Generate a report

From existing `RESONRun` JSON files (at least two runs on the same dataset):

```bash
reson report leaderboard candidate.json baseline.json model_c.json -o leaderboard.html
```

From a directory of runs:

```bash
reson report leaderboard runs/ -o leaderboard.html --dataset-name "My dataset"
```

Through the Python API:

```python
from reson import RESON, RESONRun

RESON().leaderboard_report(
    runs=[
        RESONRun.from_json("candidate.json"),
        RESONRun.from_json("baseline.json"),
    ],
    model_names=["candidate", "baseline"],
    output_html="leaderboard.html",
    dataset_name="My dataset",
)
```

Lower-level render:

```python
from reson import RESONRun
from reson.reporting import render_leaderboard_report_html

render_leaderboard_report_html(
    reson_runs=[
        RESONRun.from_json("candidate.json"),
        RESONRun.from_json("baseline.json"),
    ],
    model_names=["candidate", "baseline"],
    output_html="leaderboard.html",
    dataset_name="My dataset",
)
```

## Frontend build

`reson report leaderboard ...` builds the report frontend automatically, and rebuilds it when needed.

- Force a rebuild with `RESON_FORCE_REBUILD=1`
- Keep `package-lock.json` in the repository so builds stay reproducible
- Requirements: Node.js **18+**, npm **9+**

Details: [`docs/html-reports.md`](../../../docs/html-reports.md) (`RESON_INLINE_HTML=1`).

## Local UI development

```bash
npm ci
npm run dev      # requires window.RESON_DATA (no dev mock)
npm run build    # production bundle → build/
```

For local UI work it is easier to generate the HTML with the CLI and open it in a browser, or to paste a payload into `index.html` temporarily.

## `src/` layout

| Path | Purpose |
|------|---------|
| `dataLoader.ts` | `window.RESON_DATA` → data for the Leaderboard component |
| `App.tsx` | Standalone page with a header and the podium |
| `ThemeProvider.tsx`, `ThemeToggle.tsx` | Light / dark / system theme |
| `@compare/components/Leaderboard` | UI component from `compare_report` (alias in `vite.config.ts`) |

The payload contract is built in `reson/reporting/leaderboard/payload.py` (a minimal subset: `models`, `overviewData`, `datasetInfo`, `settings`).
