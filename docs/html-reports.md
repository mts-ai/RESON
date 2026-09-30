# HTML reports

RESON writes **self-contained HTML**: one file, no server, and no `assets/` folder next to it.

Ready-made examples can be opened in a browser with no build and no pipeline run:


| Report      | File                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| Single      | [examples/SingleRun.html](../examples/SingleRun.html)                   |
| Compare     | [examples/CompareExample.html](../examples/CompareExample.html)         |
| Leaderboard | [examples/LeaderBoardExample.html](../examples/LeaderBoardExample.html) |




## Report types


| Report      | Frontend             | Data global         | Python API                       |
| ----------- | -------------------- | ------------------- | -------------------------------- |
| Single      | `single_report`      | `window.RESON_DATA` | `render_single_report_html`      |
| Compare     | `compare_report`     | `window.RESON_DATA` | `render_compare_report_html`     |
| Leaderboard | `leaderboard_report` | `window.RESON_DATA` | `render_leaderboard_report_html` |




## RESON_INLINE_HTML

This variable is for **Vite**, not for Python. With `RESON_INLINE_HTML=1`:

- Rollup emits **one** JS file (`inlineDynamicImports: true`);
- Python can embed that file in the HTML.

Without it, Vite may emit several chunks, and the inline step will fail.

Where it is set:

- `Dockerfile` (`ENV RESON_INLINE_HTML=1`);
- automatically on a local rebuild via `run_vite_build()`.


| Frontend             | Data loading                   |
| -------------------- | ------------------------------ |
| `single_report`      | `src/contexts/DataContext.tsx` |
| `compare_report`     | `src/utils/dataLoader.ts`      |
| `leaderboard_report` | `src/dataLoader.ts`            |




## UI development

```bash
# single
cd reson/resources/single_report && npm ci && npm run dev

# compare
cd reson/resources/compare_report && npm ci && npm run dev

# leaderboard (needs window.RESON_DATA; no dev mock)
cd reson/resources/leaderboard_report && npm ci && npm run dev
```

Dev mock data: `single_report/src/data/mockData.ts`, `compare_report/src/utils/dataLoader.ts`.

More on each app:

- [single_report/README.md](../reson/resources/single_report/README.md)
- [compare_report/README.md](../reson/resources/compare_report/README.md)
- [leaderboard_report/README.md](../reson/resources/leaderboard_report/README.md)



## CLI

```bash
reson pipeline single manifest.jsonl -o report.html
reson pipeline compare candidate.jsonl baseline.jsonl -o compare.html
reson report leaderboard run_a.json run_b.json run_c.json -o leaderboard.html
```

To force a frontend rebuild: `RESON_FORCE_REBUILD=1`.