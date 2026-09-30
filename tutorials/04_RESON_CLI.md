# RESON CLI Tutorial

This tutorial is a command-focused reference for day-to-day RESON usage.

## Command groups

```bash
reson manifest --help
reson run --help
reson report --help
reson pipeline --help
```

## 1) `manifest` workflows

### Profile

```bash
reson manifest profile tutorials/data/candidate.json
reson manifest profile tutorials/data/candidate.json --full
reson manifest profile tutorials/data/candidate.json --json -o artifacts/cli/profile.json
```

### Preprocess

```bash
reson manifest preprocess tutorials/data/candidate.json -o artifacts/cli/candidate_norm.json
```

Explicit settings:

```bash
reson manifest preprocess tutorials/data/candidate.json \
  -o artifacts/cli/candidate_norm_explicit.json \
  -f text -f prediction \
  --subst-table tutorials/data/subst_sample.csv \
  --remove-punct --lowercase --replace-yo
```



### Split / Sample / Merge

```bash
reson manifest split artifacts/cli/candidate_norm.json artifacts/cli/train.json artifacts/cli/test.json --test-size 0.2 --seed 42
reson manifest sample artifacts/cli/candidate_norm.json -o artifacts/cli/sample.json --ratio 0.1
reson manifest merge artifacts/cli/train.json artifacts/cli/test.json -o artifacts/cli/merged.json
```



## 2) `run` workflows



### Analyze

Single manifest:

```bash
reson run analyze tutorials/data/candidate.json -n candidate -o artifacts/cli/runs -m WER -m CER
```

Multiple manifests:

```bash
reson run analyze tutorials/data/candidate.json tutorials/data/baseline.json -o artifacts/cli/runs
```

Recursive directory scan:

```bash
reson run analyze tutorials/data -o artifacts/cli/runs --recursive
```



### Profile runs

```bash
reson run profile artifacts/cli/runs/candidate.json
reson run profile artifacts/cli/runs --mode table
reson run profile artifacts/cli/runs --mode both -o artifacts/cli/profile_many.json
```



### Compare runs

```bash
reson run compare artifacts/cli/runs/candidate.json artifacts/cli/runs/baseline.json
```

With bootstrap:

```bash
reson run compare \
  artifacts/cli/runs/candidate.json \
  artifacts/cli/runs/baseline.json \
  --bootstrap \
  --bootstraps 2000 \
  --alpha 0.05
```

Significance pair strategies:

```bash
# Only first baseline vs candidate
reson run compare <candidate.json> <baseline_dir_or_file> --bootstrap --significance-scope primary

# Candidate vs all baselines
reson run compare <candidate.json> <baseline_dir_or_file> --bootstrap --significance-scope candidate-all

# Explicit pair(s) only
reson run compare <candidate.json> <baseline_dir_or_file> \
  --bootstrap \
  --significance-scope none \
  --significance-pair baseline_model:candidate_model
```



## 3) `report` workflows

Open a shipped example in a browser if you want to see the UI before building one: [single](../examples/SingleRun.html), [compare](../examples/CompareExample.html), [leaderboard](../examples/LeaderBoardExample.html).

```bash
reson report single artifacts/cli/runs/candidate.json -o artifacts/cli/reports/single.html
```

```bash
reson report compare \
  artifacts/cli/runs/candidate.json \
  artifacts/cli/runs/baseline.json \
  -o artifacts/cli/reports/compare.html \
  --bootstrap
```



## 4) `pipeline` workflows

Use when you do not need to manually handle intermediate run JSON.

```bash
reson pipeline single tutorials/data/candidate.json -o artifacts/cli/reports/pipeline_single.html
```

```bash
reson pipeline compare \
  tutorials/data/candidate.json \
  tutorials/data/baseline.json \
  -o artifacts/cli/reports/pipeline_compare.html \
  --bootstrap
```

Save intermediate run(s):

```bash
reson pipeline single tutorials/data/candidate.json \
  -o artifacts/cli/reports/pipeline_single.html \
  --save-run-json artifacts/cli/runs/pipeline_candidate.json

reson pipeline compare tutorials/data/candidate.json tutorials/data/baseline.json \
  -o artifacts/cli/reports/pipeline_compare.html \
  --save-runs-dir artifacts/cli/runs/pipeline_compare
```



## Shell smoke script

```bash
set -euo pipefail
reson manifest profile tutorials/data/candidate.json --full > /tmp/aris_profile.txt
reson run analyze tutorials/data/candidate.json -n candidate -o /tmp/reson_runs
reson run analyze tutorials/data/baseline.json -n baseline -o /tmp/reson_runs
reson run compare /tmp/reson_runs/candidate.json /tmp/reson_runs/baseline.json --bootstrap --bootstraps 1000
```

