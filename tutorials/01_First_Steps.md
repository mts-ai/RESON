# First Steps

This tutorial gets you from zero to your first RESON reports.

## Goal

By the end you will:

- analyze two manifests,
- compare candidate vs baseline,
- generate single and compare HTML reports.

## Prerequisites

- Python `>=3.11`
- RESON installed in a virtual environment (`pip install -e .`)
- You are in repository root

## Step 1: Verify CLI

```bash
reson --help
reson run --help
```

## Step 2: Inspect sample manifests

```bash
reson manifest profile tutorials/data/candidate.json --full
reson manifest profile tutorials/data/baseline.json --full
```

This gives you:

- row counts,
- duration distribution,
- vocabulary/alphabet stats,
- schema/null diagnostics.

## Step 3: Analyze runs

```bash
mkdir -p artifacts/first_steps/runs

reson run analyze tutorials/data/candidate.json -n candidate -o artifacts/first_steps/runs
reson run analyze tutorials/data/baseline.json -n baseline -o artifacts/first_steps/runs

#or analyze all runs inside dir
reson run analyze tutorials/data -o artifacts/first_steps/runs --force
```

Output:

- `artifacts/first_steps/runs/candidate.json`
- `artifacts/first_steps/runs/baseline.json`

## Step 4: Inspect RESON Run meta-information with metrics

```bash
# One RESON Run stats
reson run profile artifacts/first_steps/runs/baseline.json 

# Many RESON Runs compare inspect mode
reson run profile artifacts/first_steps/runs
```

## Step 5: Compare in terminal with bootstrap

```bash
reson run compare \
  artifacts/first_steps/runs/candidate.json \
  artifacts/first_steps/runs/baseline.json \
  --bootstrap
```

Use this when you need quick model-vs-model checks from a shell script.

## Step 6: Build HTML reports

To see the result first, open a ready-made report in a browser: [single](../examples/SingleRun.html), [compare](../examples/CompareExample.html), or [leaderboard](../examples/LeaderBoardExample.html). Generating your own copy is optional.

```bash
mkdir -p artifacts/first_steps/reports

reson report single \
  artifacts/first_steps/runs/candidate.json \
  -o artifacts/first_steps/reports/single_candidate.html

reson report compare \
  artifacts/first_steps/runs/candidate.json \
  artifacts/first_steps/runs/baseline.json \
  -o artifacts/first_steps/reports/compare_candidate_vs_baseline.html \
  --bootstrap
```

## Step 7: One-command pipelines (optional)

```bash
reson pipeline single tutorials/data/candidate.json -o artifacts/first_steps/reports/pipeline_single.html

reson pipeline compare \
  tutorials/data/candidate.json \
  tutorials/data/baseline.json \
  -o artifacts/first_steps/reports/pipeline_compare.html \
  --bootstrap
```

## What to read next

- Manifest operations: `[02_Manifest.md](02_Manifest.md)`
- Python automation: `[03_Python_API.md](03_Python_API.md)`

