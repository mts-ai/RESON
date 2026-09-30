# RESON compare_report (Vite + React)

Interactive HTML report that compares several RESON runs. Python injects the data as `window.RESON_DATA` (see `reson/reporting/compare/`).

## Generate a report

```bash
reson report compare candidate.json baseline.json -o compare.html
```

```python
from reson import RESONRun
from reson.reporting import render_compare_report_html

render_compare_report_html(
    reson_runs=[RESONRun.from_json("candidate.json"), RESONRun.from_json("baseline.json")],
    model_names=["candidate", "baseline"],
    output_html="compare.html",
)
```

## Local UI development

```bash
npm ci
npm run dev      # no RESON_DATA — mock from src/utils/dataLoader.ts
npm run build    # production bundle → build/
```

The build used when Python generates HTML is described in [`docs/html-reports.md`](../../../docs/html-reports.md) (`RESON_INLINE_HTML=1`).

## `src/` layout

| Path | Purpose |
|------|---------|
| `utils/dataLoader.ts` | `window.RESON_DATA` or the dev mock |
| `components/` | Overview, Dictionary, Analytics, and Manifest tabs |
| `utils/manifestHelpers.ts`, `oracleWer.ts`, … | UI helpers |

The payload contract is built in `reson/reporting/compare/payload.py`.
