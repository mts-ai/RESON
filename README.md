# RESON





**Research Engine for Speech & Observation Notes**

*A practical toolkit for ASR quality analysis, model comparison, and shareable interactive HTML reports*

[📖 Documentation](docs/README.md) • [🤗 Dataset](#)  • [📰 Habr (RU)](#) • [Русский](./README.ru.md)

---

## Update — June 24, 2026



### Open-source release 1.0.0

First public **MIT** release of RESON. The OSS build includes:

- local manifest loaders (`.json` / `.jsonl` / `.csv`);
- built-in **jiwer** metric provider (WER, CER);
- self-contained HTML reports (React + Vite);
- no bundled substitution dictionary — pass an explicit `.csv` path when needed.

See [CHANGELOG.md](CHANGELOG.md) for details.

---

## 🎯 Overview

**RESON** helps you move from raw ASR manifests and hypotheses to practical diagnostics: metrics, vocabulary-level error analysis, model comparison with optional bootstrap significance, and interactive self-contained HTML reports.

### 🔥 Why RESON?

Production ASR evaluation is more than a single WER number. RESON covers the full loop:

- 📄 **Manifest preparation** — profile, normalize, split, sample, and merge evaluation data
- 📊 **Rich metrics** — WER/CER, vocabulary recall/precision, INS/DEL/SUB breakdown
- ⚖️ **Model comparison** — candidate vs baseline(s) in the terminal and in HTML
- 📈 **Statistical significance** — bootstrap testing in compare workflows
- 🖥️ **Interactive reports** — single, compare, and leaderboard views

Both **CLI-first** and **Python API** workflows are supported.

---

## 🚀 Key Features



### 📚 **Manifest toolkit**

- Load from `.json`, `.jsonl`, and `.csv`
- Preprocess text (punctuation, casing, optional substitution dictionary)
- Split, sample, merge, and inspect datasets



### 📐 **Metric providers**

- Built-in `jiwer` (WER, CER) — no extra install
- Pluggable `MetricProviderABC` for custom backends via Python API



### 🖥️ **Interactive HTML reports**


| Report               | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `single_report`      | Deep dive into one `RESONRun`              |
| `compare_report`     | Candidate vs baseline(s) with significance |
| `leaderboard_report` | Compact multi-model overview               |


Reports are **self-contained HTML files** — no backend required.

Open a ready-made file from `[examples/](examples/)` in a browser to see each report. No install and no generation step.


| Report      | Example                                                              |
| ----------- | -------------------------------------------------------------------- |
| Single      | [examples/SingleRun.html](examples/SingleRun.html)                   |
| Compare     | [examples/CompareExample.html](examples/CompareExample.html)         |
| Leaderboard | [examples/LeaderBoardExample.html](examples/LeaderBoardExample.html) |


---

## 🚀 Quick Start



### Installation

**Requirements:** Python **3.11+**. Node.js **18+** and npm **9+** are needed only when building HTML reports locally (Docker image includes prebuilt frontends).

**Docker (recommended)**

```bash
docker build -t reson .
docker run --rm reson reson --help

# or via interactive shell
docker run -it --rm reson bash
```

**Poetry**

```bash
poetry env use 3.11
poetry install --with dev
poetry run reson --help
```

**Pip**

```bash
# Clone the repository and install RESON from the project root
python -m pip install --upgrade pip
pip install -e .

# Optional: dev dependencies (pytest)
pip install -e ".[dev]"
```



### Run your first evaluation

Sample manifests live in `[tutorials/data/](tutorials/data/)`.

```bash
# 1) Inspect a manifest
reson manifest profile tutorials/data/candidate.json --full

# 2) Analyze candidate and baseline
reson run analyze tutorials/data/candidate.json -n candidate -o artifacts/runs
reson run analyze tutorials/data/baseline.json -n baseline -o artifacts/runs

# 3) Compare in the terminal (bootstrap significance)
reson run compare artifacts/runs/candidate.json artifacts/runs/baseline.json --bootstrap

# 4) Build HTML reports
reson report single artifacts/runs/candidate.json -o artifacts/reports/single_candidate.html
reson report compare artifacts/runs/candidate.json artifacts/runs/baseline.json \
  -o artifacts/reports/compare.html --bootstrap
```

The same three reports are already in `[examples/](examples/)` if you want to look before generating your own.

Step-by-step guides: [tutorials/README.md](tutorials/README.md).

---



## 📄 Manifest format

RESON currently expects manifests with the following fields:


| Field            | Description            |
| ---------------- | ---------------------- |
| `audio_filepath` | Path to the audio file |
| `duration`       | Duration in seconds    |
| `text`           | Reference transcript   |
| `prediction`     | ASR hypothesis         |


Support for custom fields is planned for a future release.

**JSONL example**

```json
{"audio_filepath": "/audio/001.wav", "duration": 2.1, "text": "Hello world", "prediction": "hello word"}
```

Recommended formats: `.jsonl` or `.json`.

---



## 📐 Metric providers


| Provider          | Metrics  | Notes                    |
| ----------------- | -------- | ------------------------ |
| `jiwer` (default) | WER, CER | Included in base install |


```bash
reson run analyze tutorials/data/candidate.json -o artifacts/runs -m WER -m CER
```

Custom providers: implement `MetricProviderABC` and pass an instance to `RESON(metric_provider=...)`. The CLI currently supports only `jiwer`.

---



## 🗂️ Substitution dictionary (optional)

A substitution dictionary is a semicolon-separated `.csv` file that maps word variants to a canonical form. **It is disabled by default.**

```csv
vpn;впн;випиэн
тв;тэвэ;тиви
```

Enable explicitly:

```bash
reson manifest preprocess manifest.jsonl -o normalized.jsonl \
  --subst-table /path/to/subst.csv
```

Example file for tutorials: `[tutorials/data/subst_table/example.csv](tutorials/data/subst_table/example.csv)`.

## 🖥️ CLI overview


| Command group    | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `reson manifest` | Profile, preprocess, split, sample, merge manifests |
| `reson run`      | Analyze manifests, profile runs, compare models     |
| `reson report`   | Build HTML reports from existing `RESONRun` JSON    |
| `reson pipeline` | End-to-end: preprocess → analyze → report           |


```bash
reson manifest --help
reson run --help
reson report --help
reson pipeline --help
```

Full command reference: [tutorials/04_RESON_CLI.md](tutorials/04_RESON_CLI.md).

---



## 🐍 Python API

```python
from reson import RESON, Manifest, RESONRun

# Load and normalize the manifest
manifest = Manifest.load_from("tutorials/data/candidate.json")
normalized = manifest.normalize(fields=["text", "prediction"])

# Analyze: global and per-sample metrics, vocabulary stats, and more
reson = RESON(name="candidate", metrics=("WER", "CER"))
run = reson.analyze(normalized, artifacts_dir="artifacts/runs/candidate")

# Save RESONRun as JSON and generate an interactive report
run.to_json("artifacts/runs/candidate.json")
run.report(output_html="artifacts/reports/single.html")
```

Compare runs and render HTML:

```python
# Load runs for reporting
baseline = RESONRun.from_json("artifacts/runs/baseline.json")
candidate = RESONRun.from_json("artifacts/runs/candidate.json")

# Build a compare HTML report with bootstrap significance
reson.compare_report(
    runs=[candidate, baseline],
    model_names=["candidate", "baseline"],
    output_html="artifacts/reports/compare.html",
    base_model="baseline",
    target_model="candidate",
    num_bootstraps=2000,
)
```

More examples: [tutorials/03_Python_API.md](tutorials/03_Python_API.md).  
Class and method reference: [docs/api.md](docs/api.md).

---



## 📁 Repository structure

```text
reson/                 # Main Python package (CLI, core, reporting, frontends)
examples/             # Ready-made single, compare, and leaderboard HTML reports
tests/                # Pytest suite
tutorials/            # Guides
docs/                 # API reference and developer documentation
Dockerfile            # Image with prebuilt frontends
pyproject.toml        # Project config and dependencies
CHANGELOG.md          # Release history
LICENSE               # MIT License
```

---



## 🤝 Contributing & feedback

Issues and pull requests are welcome.

- **Suggest improvements**: open an issue or start a discussion
- **Pull requests**: bug fixes, tests, and docs are especially welcome; new features too

Before submitting changes, run the test suite — see [docs/testing.md](docs/testing.md).

---



## 📜 License

Released under the [MIT License](LICENSE). Copyright (c) 2026 **MWS AI**.