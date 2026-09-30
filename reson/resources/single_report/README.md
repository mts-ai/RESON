# RESON single_report (Vite + React)

Interactive HTML report for one RESON run. Python injects the data as `window.RESON_DATA` (see `reson/reporting/single/`).

## Generate a report

From an existing `RESONRun` JSON file:

```bash
reson report single candidate.json -o single.html
```

Full pipeline (manifest → normalize → analyze → HTML):

```bash
reson pipeline single manifest.jsonl -o single.html --save-run-json candidate.json
```

```python
from reson import RESONRun
from reson.reporting import render_single_report_html

render_single_report_html(
    RESONRun.from_json("candidate.json"),
    output_html="single.html",
)
```

## Local UI development

```bash
npm ci
npm run dev      # no RESON_DATA — mock from src/data/mockData.ts
npm run build    # production bundle → build/
```

The build used when Python generates HTML is described in [`docs/html-reports.md`](../../../docs/html-reports.md) (`RESON_INLINE_HTML=1`).

## `src/` layout

| Path | Purpose |
|------|---------|
| `contexts/DataContext.tsx` | `window.RESON_DATA` or the dev mock |
| `types/data.ts` | TypeScript payload contract |
| `data/mockData.ts` | Mock for `npm run dev` |
| `components/` | Overview, Vocabulary, Analytics, and Manifest tabs |

The payload contract is built in `reson/reporting/single/payload.py`.
