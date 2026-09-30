# 🇷🇺 RESON

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.11+-blue.svg" alt="Python 3.11+"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-18+-green.svg" alt="Node.js 18+"></a>
  <a href="#"><img src="https://img.shields.io/badge/🤗-Datasets-Coming_Soon-yellow.svg" alt="HuggingFace"></a>
  <a href="#"><img src="https://img.shields.io/badge/🏆-Coming_Soon-orange.svg" alt="Leaderboard"></a>
  <a href="#"><img src="https://img.shields.io/badge/📰-Habr-Coming_Soon-blue.svg" alt="Habr Article"></a>
</p>

<div align="center">

**Research Engine for Speech & Observation Notes**

*Практический инструмент для анализа качества ASR, сравнения моделей и интерактивных HTML-отчётов*

[📖 Документация](docs/README.md) • [🤗 Dataset](#)  • [📰 Habr (RU)](#) • [English](./README.md)

</div>


## Update — 24 июня 2026

### Open-source релиз 1.0.0

Первый публичный релиз RESON под **MIT**. В OSS-сборке:

- локальные загрузчики манифестов (`.json` / `.jsonl` / `.csv`);
- встроенный провайдер метрик **jiwer** (WER, CER);
- self-contained HTML-отчёты (React + Vite);
- словарь замен **не включён** — путь к `.csv` указывается явно.

Подробности — в [CHANGELOG.md](CHANGELOG.md).

---

## 🎯 Обзор

**RESON** помогает перейти от сырых манифестов и гипотез ASR к практической диагностике: метрики, анализ ошибок на уровне словаря, сравнение моделей с опциональной bootstrap-значимостью и интерактивные HTML-отчёты без серверной части.

### 🔥 Зачем RESON?

Оценка ASR в проде — это не один WER. RESON закрывает полный цикл:

- 📄 **Подготовка манифестов** — профилирование, нормализация, split, sample, merge
- 📊 **Расширенные метрики** — WER/CER, recall/precision по словарю, разбор INS/DEL/SUB
- ⚖️ **Сравнение моделей** — candidate vs baseline(s) в терминале и в HTML
- 📈 **Статистическая значимость** — bootstrap в compare-сценариях
- 🖥️ **Интерактивные отчёты** — single, compare и leaderboard

Поддерживаются сценарии **CLI-first** и **Python API**.

---

## 🚀 Ключевые возможности

### 📚 **Работа с манифестами**

- Загрузка из **.json**, **.jsonl**, **.csv**
- Предобработка текста (пунктуация, регистр, опциональный словарь замен)
- Split, sample, merge и диагностика датасетов

### 📐 **Провайдеры метрик**

- Встроенный **jiwer** (WER, CER) — без дополнительной установки
- Расширяемый **MetricProviderABC** для custom backend'ов через Python API

### 🖥️ **Интерактивные HTML-отчёты**


| Отчёт                | Назначение                               |
| -------------------- | ---------------------------------------- |
| `single_report`      | Детальный разбор одного `RESONRun`        |
| `compare_report`     | Candidate vs baseline(s) со significance |
| `leaderboard_report` | Компактный обзор нескольких моделей      |


Отчёты — **один HTML-файл**, backend не нужен.

Чтобы посмотреть, как они выглядят, откройте готовый файл из [`examples/`](examples/) в браузере. Установка и генерация не нужны.

| Отчёт | Пример |
|-------|--------|
| Single | [examples/SingleRun.html](examples/SingleRun.html) |
| Compare | [examples/CompareExample.html](examples/CompareExample.html) |
| Leaderboard | [examples/LeaderBoardExample.html](examples/LeaderBoardExample.html) |

---

## 🚀 Быстрый старт

### Установка

**Требования:** Python **3.11+**. Node.js **18+** и npm **9+** нужны только для локальной сборки HTML-отчётов (в Docker frontend уже собран).



**Docker (рекомендуемый)**

```bash
docker build -t reson .
docker run --rm reson reson --help

# или через инетрактивный shell
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
# Клонируйте репозиторий и установите RESON из корневой папки
python -m pip install --upgrade pip
pip install -e .

# Опционально: dev-зависимости (pytest)
pip install -e ".[dev]"
```

### Первый прогон

Примеры манифестов — в `[tutorials/data/](tutorials/data/)`.

```bash
# 1) Проверка манифеста
reson manifest profile tutorials/data/candidate.json --full

# 2) Анализ candidate и baseline
reson run analyze tutorials/data/candidate.json -n candidate -o artifacts/runs
reson run analyze tutorials/data/baseline.json -n baseline -o artifacts/runs

# 3) Сравнение в терминале (bootstrap significance)
reson run compare artifacts/runs/candidate.json artifacts/runs/baseline.json --bootstrap

# 4) HTML-отчёты
reson report single artifacts/runs/candidate.json -o artifacts/reports/single_candidate.html
reson report compare artifacts/runs/candidate.json artifacts/runs/baseline.json \
  -o artifacts/reports/compare.html --bootstrap
```

Те же три отчёта уже лежат в [`examples/`](examples/), если хотите посмотреть их до своей генерации.

Пошаговые гайды: [tutorials/README.md](tutorials/README.md).

---

## 📄 Формат манифеста

На текущий момент RESON работает с манифестами со следующими полями:


| Поле             | Описание                |
| ---------------- | ----------------------- |
| `audio_filepath` | Путь к аудиофайлу       |
| `duration`       | Длительность в секундах |
| `text`           | Эталонная транскрипция  |
| `prediction`     | Гипотеза ASR            |

Поддержка кастомных полей планируется к добавлению позднее

**Пример JSONL**

```json
{"audio_filepath": "/audio/001.wav", "duration": 2.1, "text": "Hello world", "prediction": "hello word"}
```

Рекомендуемые форматы: `**.jsonl**` или `**.json**`.

---

## 📐 Провайдеры метрик


| Провайдер              | Метрики  | Примечание            |
| ---------------------- | -------- | --------------------- |
| `jiwer` (по умолчанию) | WER, CER | Входит в base install |


```bash
reson run analyze tutorials/data/candidate.json -o artifacts/runs -m WER -m CER
```

Custom-провайдеры: реализуйте `MetricProviderABC` и передайте экземпляр в `RESON(metric_provider=...)`. На текущий момент, CLI поддерживает только `jiwer`.

---

## 🗂️ Словарь замен (опционально)

Словарь замен — `.csv` с разделителем `;`, где варианты написания слова приводятся к канонической форме. **По умолчанию отключён.**

```csv
vpn;впн;випиэн
тв;тэвэ;тиви
```

Включение явно:

```bash
reson manifest preprocess manifest.jsonl -o normalized.jsonl \
  --subst-table /path/to/subst.csv
```

Пример для tutorials: [tutorials/data/subst_table/example.csv](tutorials/data/subst_table/example.csv).

## 🖥️ Обзор CLI


| Группа команд   | Назначение                                       |
| --------------- | ------------------------------------------------ |
| `reson manifest` | Профилирование, preprocess, split, sample, merge |
| `reson run`      | Анализ, профилирование run'ов, сравнение моделей |
| `reson report`   | HTML-отчёты из готовых `RESONRun` JSON            |
| `reson pipeline` | Сквозной сценарий: preprocess → analyze → report |


```bash
reson manifest --help
reson run --help
reson report --help
reson pipeline --help
```

Справочник команд: [tutorials/04_RESON_CLI.md](tutorials/04_RESON_CLI.md).

---

## 🐍 Python API

```python
from reson import RESON, Manifest, RESONRun

# Загрузку и нормализация манифеста
manifest = Manifest.load_from("tutorials/data/candidate.json")
normalized = manifest.normalize(fields=["text", "prediction"])

# Анализ манифеста: посчет глобальных, per-sample метрик, формирование словаря и так далее 
reson = RESON(name="candidate", metrics=("WER", "CER"))
run = reson.analyze(normalized, artifacts_dir="artifacts/runs/candidate")

# Сохранение RESON Run в формате .json для передачи и генерация интерактивного отчета по запуску
run.to_json("artifacts/runs/candidate.json")
run.report(output_html="artifacts/reports/single.html")
```

Сравнение и HTML-отчёт:

```python
# Воссоздание сущностей для формирования отчета
baseline = RESONRun.from_json("artifacts/runs/baseline.json")
candidate = RESONRun.from_json("artifacts/runs/candidate.json")

# Генерация сравнительного html отчета с подсчетом стат значимости результатов
reson.compare_report(
    runs=[candidate, baseline],
    model_names=["candidate", "baseline"],
    output_html="artifacts/reports/compare.html",
    base_model="baseline",
    target_model="candidate",
    num_bootstraps=2000,
)
```

Больше примеров: [tutorials/03_Python_API.md](tutorials/03_Python_API.md).  
Справочник классов и методов: [docs/api.md](docs/api.md).

---

## 📁 Структура репозитория

```text
reson/                 # Основной Python-пакет (CLI, core, reporting, frontends)
examples/             # Готовые HTML-отчёты: single, compare, leaderboard
tests/                # Pytest suite
tutorials/            # Гайды
docs/                 # Справочник Python API и документация для разработчиков
Dockerfile            # Образ с prebuilt frontend
pyproject.toml        # Конфигурация и зависимости
CHANGELOG.md          # История релизов
LICENSE               # MIT License
```

---

## 🤝 Contributing & feedback

Issues и pull request'ы приветствуются.

- **Предложить улучшение**: issue или discussion
- **Pull requests**: особенно ценны bugfix'ы, тесты и docs, новый функционал

Перед отправкой изменений прогоните тесты — см. [docs/testing.md](docs/testing.md).

---

## 📜 Лицензия

Распространяется под [MIT License](LICENSE). Copyright (c) 2026 **MWS AI**.