# Manifest Tutorial

This guide focuses on preparing high-quality manifests before evaluation.

## Why it matters

Most ASR analysis errors come from data inconsistency:

- wrong column names,
- noisy punctuation/casing,
- mixed formatting conventions,
- accidental duplicates.

RESON gives you a reproducible preprocessing pipeline.

## 1) Profile input quality

```bash
reson manifest profile tutorials/data/candidate.json --full
```

Use this first to verify:

- expected columns exist (`audio_filepath`, `duration`, `text`),
- null counts are acceptable,
- durations look realistic.

## 2) Normalize text fields

```bash
mkdir -p artifacts/manifest

reson manifest preprocess \
  tutorials/data/candidate.json \
  -o artifacts/manifest/candidate_norm.json \
  -f text -f prediction \
  --remove-punct \
  --lowercase \
  --replace-yo \
  --subst-table tutorials/data/subst_table/example.csv
```

## 3) Split train/test

```bash
reson manifest split \
  artifacts/manifest/candidate_norm.json \
  artifacts/manifest/train.json \
  artifacts/manifest/test.json \
  --test-size 0.2 \
  --seed 42 \
  --shuffle
```

If you have a grouping feature (e.g., domain), use stratification:

```bash
reson manifest split ... --stratify-field domain
```

## 4) Sample subsets

```bash
# Fixed count
reson manifest sample artifacts/manifest/candidate_norm.json -o artifacts/manifest/sample_100.json --count 100

# Ratio
reson manifest sample artifacts/manifest/candidate_norm.json -o artifacts/manifest/sample_10p.json --ratio 0.1
```

## 5) Merge sources

```bash
reson manifest merge artifacts/manifest/train.json artifacts/manifest/test.json -o artifacts/manifest/merged.json
```

Merge whole directories recursively:

```bash
reson manifest merge artifacts/manifest -o artifacts/manifest/merged_recursive.json --recursive
```

Optional deduplication:

```bash
reson manifest merge artifacts/manifest -o artifacts/manifest/merged_dedup.json --recursive --dedupe-by audio_filepath
```

