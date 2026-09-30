# Python API Tutorial

This tutorial shows how to integrate RESON into Python workflows and scripts.

For a full class and method reference (`Manifest`, `RESON`, `RESONRun`, providers, reports), see [docs/api.md](../docs/api.md).

## Imports

```python
from reson import RESON, RESONRun, Manifest
```

## 1) Load and inspect manifest

```python
manifest = Manifest.load_from("tutorials/data/candidate.json")
print(manifest.summary)
```

## 2) Normalize selected fields

```python
normalized = manifest.normalize(
    fields=["text", "prediction"],
    remove_punct=True,
    lowercase=True,
    replace_yo=True,
)
```

To apply a substitution dictionary, pass an explicit CSV path:

```python
normalized = manifest.normalize(
    fields=["text", "prediction"],
    remove_punct=True,
    lowercase=True,
    replace_yo=True,
    subst_table="tutorials/data/subst_table/example.csv",
)
```



## 3) Analyze a run

```python
reson = RESON(
    name="candidate_model",
    metrics=("WER", "CER"),
    meta={"model_version": "candidate_v1"},
)

run = reson.analyze(normalized, artifacts_dir="artifacts/python_api/candidate")
run.to_json("artifacts/python_api/candidate.json")
```

Inspect generated structures:

```python
print(run.metrics)
print(run.summary)
print(run.vocab.data.head())
print(run.alphabet.data.head())
```



## 4) Build a single report from Python

Ready-made reports you can open in a browser before running this step: [single](../examples/SingleRun.html), [compare](../examples/CompareExample.html), [leaderboard](../examples/LeaderBoardExample.html).

```python
html_path = run.report(output_html="artifacts/python_api/candidate_report.html")
print(html_path)
```



## 5) Compare two runs

```python
baseline_manifest = Manifest.load_from("tutorials/data/baseline.json")
baseline_run = RESON(name="baseline_model", metrics=("WER", "CER")).analyze(
    baseline_manifest.normalize(["text", "prediction"]),
    artifacts_dir="artifacts/python_api/baseline",
)

comparison = reson.compare(baseline=baseline_run, candidate=run)
print(comparison.metrics_delta_records())
```

## 6) Generate compare HTML report

```python
reson.compare_report(
    runs=[run, baseline_run],
    model_names=["candidate_model", "baseline_model"],
    output_html="artifacts/python_api/compare_report.html",
    base_model="baseline_model",
    target_model="candidate_model",
    num_bootstraps=2000,
    alpha=0.05,
)
```

## 7) Restore run from JSON

```python
restored = RESONRun.from_json("artifacts/python_api/candidate.json")
print(restored.name)
print(restored.metrics.head())
```

## Practical patterns

- Keep one `RESON` instance per model configuration.
- Store run metadata in `meta` to make reports self-descriptive.
- Persist every important run as JSON (`RESONRun.to_json`) for reproducible comparisons.

