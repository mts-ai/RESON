# Advanced RESON Tutorial

This guide covers advanced patterns for robust experimentation and production workflows.

## 1) Statistical significance in compare reports

A finished compare report is in `[examples/CompareExample.html](../examples/CompareExample.html)`. Single and leaderboard examples: `[SingleRun.html](../examples/SingleRun.html)`, `[LeaderBoardExample.html](../examples/LeaderBoardExample.html)`. Open them in a browser; you do not need to generate a report to see the layout.

### Explicit significance pairs

Use explicit pairs when your report includes many models but significance should be computed only for specific comparisons.

```bash
reson report compare \
  artifacts/runs/candidate.json \
  artifacts/runs/baseline_a.json \
  artifacts/runs/baseline_b.json \
  --bootstrap \
  --significance-scope none \
  --significance-pair baseline_a:candidate \
  --significance-pair baseline_b:candidate \
  --bootstraps 5000 \
  --alpha 0.05
```



### Scope strategy

- `primary`: first baseline vs candidate only.
- `candidate-all`: candidate vs every baseline.
- `none`: only explicit `--significance-pair` values.



## 2) Advanced preprocessing control

When data schema differs from expected fields:

```bash
reson run analyze data/raw_manifest.jsonl \
  -o artifacts/advanced/runs \
  --rename-column REF=text \
  --rename-column HYP=prediction \
  --drop-column debug_col \
  --field text --field prediction
```

To enable replacements, pass an explicit CSV path:

```bash
reson run analyze data/raw_manifest.jsonl \
  -o artifacts/advanced/runs \
  --rename-column REF=text \
  --rename-column HYP=prediction \
  --drop-column debug_col \
  --field text --field prediction \
  --subst-table tutorials/data/subst_sample.csv
```



## 3) Import local manifests

Use `manifest import` to copy a supported local source into a normalized output file:

```bash
reson manifest import \
  --source tutorials/data/candidate.json \
  --out artifacts/advanced/imported.json
```

Supported sources in the open-source build: `.json`, `.jsonl`, and `.csv` files.
For custom loaders, extend `DataSourceAdapter` in the Python API.

## 4) Reproducibility checklist

- Pin environment in virtualenv.
- Keep `package-lock.json` committed for report frontends.
- Persist every important `RESONRun` JSON.
- Record `meta` (model checkpoint, dataset revision, preprocessing config).
- Use fixed random seeds for split/sample.

Example metadata:

```bash
reson run analyze tutorials/data/candidate.json \
  -n candidate_v3 \
  -o artifacts/advanced/runs \
  --meta '{"model":"candidate_v3","dataset":"q2_eval","commit":"<git_sha>"}'
```



## 5) Python automation patterns



### Batch analyze

```python
from reson import RESON, Manifest

reson = RESON(name="batch", metrics=("WER", "CER"))
manifests = [
    Manifest.load_from("tutorials/data/candidate.json"),
    Manifest.load_from("tutorials/data/baseline.json"),
]
runs = reson.analyze_many(manifests, names=["candidate", "baseline"], artifacts_root_dir="artifacts/advanced/batch")
```



### Compare report from restored runs

```python
from reson import RESON, RESONRun

reson = RESON(name="reporting")
runs = [
    RESONRun.from_json("artifacts/advanced/runs/candidate.json"),
    RESONRun.from_json("artifacts/advanced/runs/baseline.json"),
]
reson.compare_report(
    runs=runs,
    model_names=["candidate", "baseline"],
    output_html="artifacts/advanced/reports/compare.html",
    base_model="baseline",
    target_model="candidate",
    num_bootstraps=3000,
)
```



## 6) Performance and build controls



### Force frontend rebuild

```bash
RESON_FORCE_REBUILD=1 reson report single artifacts/runs/candidate.json -o artifacts/advanced/reports/single.html
```



### Prefer direct `report` over `pipeline` when runs already exist

This avoids recomputing metrics and speeds up report iteration.

## 7) Troubleshooting playbook

- **No significance output**: check matched key (`audio_filepath`) overlap between runs.
- **Unexpected duration buckets**: verify `duration` units are seconds.
- **Large run compare input**: use directory + `--recursive` for `run analyze`, then compare run JSON outputs.
- **Frontend build failures**: run `npm run build` manually in both report folders and inspect stack trace.

## 8) Suggested production workflow

1. Import/profile incoming dataset.
2. Normalize with explicit config.
3. Analyze baseline and candidate into versioned run JSONs.
4. Compare in terminal (fast gate).
5. Generate HTML compare report for review.
6. Archive run JSON + HTML + metadata in experiment storage.

