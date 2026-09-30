"""RESON CLI."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, Dict, List, Optional

import typer
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from reson import RESON, RESONRun, Manifest
from reson.cli_helpers import (
    compare_report_bootstraps,
    load_meta,
    normalize_manifest_inplace,
    parse_kv_options,
    resolve_compare_significance_pairs,
    resolve_input_paths,
    resolve_metric_provider,
)
from reson.core.analysis.compare import compare_runs

LOWER_IS_BETTER_TOKENS = (
    "wer",
    "cer",
    "ler",
    "loss",
    "error",
    "latency",
    "delay",
    "time",
    "rtf",
)

app = typer.Typer(
    add_completion=False,
    help=(
        "RESON command line interface.\n\n"
        "Groups:\n"
        "  manifest  — inspect and preprocess manifests\n"
        "  run       — analyze RESONRun artifacts, metrics tables, comparisons\n"
        "  report    — HTML reports from RESONRun JSON\n"
        "  pipeline  — end-to-end: manifest → analyze → HTML\n\n"
        "Tips:\n"
        "  • `run analyze` / `run compare` accept one file or many (incl. directories)\n"
        "  • `run profile` — one file (details) or many (metrics table)\n"
        "  • Add `--bootstrap` only when you need statistical significance\n"
        "  • Tune pairs with `--significance-scope` and `--significance-pair BASE:TARGET`"
    ),
)
console = Console()

manifest_app = typer.Typer(
    help="Manifest operations: profile, import, preprocess, split, sample, merge.",
)
run_app = typer.Typer(
    help=(
        "Run operations: analyze, profile, compare.\n"
        "Each command accepts a single file or multiple files/directories."
    ),
)
report_app = typer.Typer(
    help="HTML reports from existing RESONRun JSON files (single, compare, leaderboard).",
)
pipeline_app = typer.Typer(
    help="End-to-end: load manifest(s), normalize, analyze, render HTML report.",
)

app.add_typer(manifest_app, name="manifest")
app.add_typer(run_app, name="run")
app.add_typer(report_app, name="report")
app.add_typer(pipeline_app, name="pipeline")

def _delta_style(metric: str, diff: Optional[float]) -> Optional[str]:
    if diff is None:
        return None
    if _lower_is_better(metric):
        return "green" if diff < 0 else ("red" if diff > 0 else "dim")
    return "green" if diff > 0 else ("red" if diff < 0 else "dim")


def _auto_save_manifest(manifest, out_path):
    out_path = Path(out_path)
    if out_path.suffix.lower() in [".json", ".jsonl"]:
        manifest.to_json(str(out_path))
    elif out_path.suffix.lower() == ".csv":
        manifest.to_csv(str(out_path))
    else:
        raise typer.BadParameter(f"Unknown file extension: {out_path.suffix.lower()}. Supported: .json, .jsonl, .csv")


def _resolve_paths(
    inputs: List[Path],
    *,
    allowed_exts: set[str],
    what: str,
    recursive: bool = False,
) -> List[Path]:
    return resolve_input_paths(
        inputs,
        allowed_exts=allowed_exts,
        what=what,
        recursive=recursive,
    )


def _lower_is_better(metric_name: str) -> bool:
    lname = (metric_name or "").strip().lower()
    return any(t in lname for t in LOWER_IS_BETTER_TOKENS)


def format_cell(value):
    if value is None:
        return "-"
    try:
        v = float(value)
        # Avoid scientific notation for INS, DEL, SUB (always for integers > 1000)
        if v == int(v) and abs(v) >= 1000:
            return f"{int(v):,}".replace(",", " ")
        elif abs(v) >= 1000:
            return f"{v:,.0f}".replace(",", " ")
        else:
            return f"{v:.4g}"
    except Exception:
        return str(value)

        
def _print_metrics_table(run: RESONRun, title: str) -> None:
    mdf = run.metrics.reset_index()
    tbl = Table(title=title, box=box.SIMPLE)
    tbl.add_column("Metric", style="bold")
    tbl.add_column("VALUE", justify="right")
    use_ins_del_sub = any(c in mdf.columns for c in ["INS", "DEL", "SUB"])
    if use_ins_del_sub:
        tbl.add_column("INS", justify="right")
        tbl.add_column("DEL", justify="right")
        tbl.add_column("SUB", justify="right")
    for _, row in mdf.iterrows():
        metric_name = str(row.get("index", row.get("name", "")))
        val = row.get("VALUE")
        # VALUE: leave auto-format or compact notation as before
        cells = [metric_name, "-" if val is None else f"{float(val):.4g}"]
        for c in ["INS", "DEL", "SUB"]:
            if c in mdf.columns:
                rv = row.get(c)
                # Use integer formatting without scientific notation
                cells.append(format_cell(rv))
        tbl.add_row(*cells)
    if getattr(run, "vocab", None) is not None and hasattr(run.vocab, "mean_recall"):
        mwa = run.vocab.mean_recall
        if mwa is not None:
            tbl.add_row("MWA (Mean Word Accuracy)", f"{mwa:.4g}", *(["-"] * (len(tbl.columns) - 2)))
    console.print(tbl)


def _safe_metric_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        fv = float(value)
        if fv != fv:  # NaN
            return None
        return fv
    except (TypeError, ValueError):
        return None


def _collect_run_metrics(run: RESONRun, *, include_mwa: bool = True) -> Dict[str, Optional[float]]:
    """Flat metric name -> VALUE for one RESONRun."""
    values: Dict[str, Optional[float]] = {}
    mdf = run.metrics.reset_index() if getattr(run, "metrics", None) is not None else None
    if mdf is not None and not mdf.empty:
        for _, row in mdf.iterrows():
            metric_name = str(row.get("index", row.get("name", ""))).strip()
            if not metric_name:
                continue
            values[metric_name] = _safe_metric_float(row.get("VALUE"))
    if include_mwa and getattr(run, "vocab", None) is not None and hasattr(run.vocab, "mean_recall"):
        mwa = _safe_metric_float(run.vocab.mean_recall)
        if mwa is not None:
            values["MWA"] = mwa
    return values


def _metric_column_sort_key(name: str) -> tuple[int, str]:
    upper = name.upper()
    priority = {
        "WER": 0,
        "MWA": 1,
        "CER": 2,
    }
    return (priority.get(upper, 10), upper)


def _parse_rename_columns(items: List[str]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for item in items:
        if "=" not in item:
            raise typer.BadParameter(
                f"Malformed --rename-column value: expected OLD=NEW, got '{item}'"
            )
        old_name, new_name = item.split("=", 1)
        old_name = old_name.strip()
        new_name = new_name.strip()
        if not old_name or not new_name:
            raise typer.BadParameter(
                f"Malformed --rename-column value: expected OLD=NEW, got '{item}'"
            )
        mapping[old_name] = new_name
    return mapping


def _apply_column_renames(
    manifest: Manifest,
    rename_map: Dict[str, str],
    *,
    context: str,
) -> Manifest:
    if not rename_map:
        return manifest
    existing_columns = set(manifest.to_df().columns)
    missing_columns = [col for col in rename_map if col not in existing_columns]
    if missing_columns:
        raise typer.BadParameter(
            f"{context}: columns for --rename-column not found: {', '.join(missing_columns)}"
        )
    return manifest.rename(rename_map)


def _load_and_preprocess_manifest(
    source: str,
    *,
    source_kwargs: Dict[str, Any],
    rename_map: Dict[str, str],
    drop_columns: List[str],
    fields: List[str],
    remove_punct: bool,
    lowercase: bool,
    replace_yo: bool,
    subst_table: Optional[str],
    context: str,
) -> Manifest:
    manifest = Manifest.load_from(source, **source_kwargs)
    manifest = _apply_column_renames(manifest, rename_map, context=context)

    if drop_columns:
        existing_columns = set(manifest.to_df().columns)
        missing_columns = [col for col in drop_columns if col not in existing_columns]
        if missing_columns:
            raise typer.BadParameter(
                f"{context}: columns for --drop-column not found: {', '.join(missing_columns)}"
            )
        manifest = manifest.drop(drop_columns)

    normalize_manifest_inplace(
        manifest,
        fields=fields,
        remove_punct=remove_punct,
        lowercase=lowercase,
        replace_yo=replace_yo,
        subst_table=subst_table,
    )
    return manifest


def _build_profile_many_payload(
    entries: List[tuple[Path, RESONRun]],
    *,
    include_mwa: bool = True,
) -> Dict[str, Any]:
    metric_names: set[str] = set()
    rows: List[Dict[str, Any]] = []
    values_by_model: Dict[str, Dict[str, Optional[float]]] = {}
    details_by_model: Dict[str, Dict[str, Any]] = {}
    display_name_counts: Dict[str, int] = {}

    for path, run in entries:
        metrics = _collect_run_metrics(run, include_mwa=include_mwa)
        metric_names.update(metrics.keys())
        base_name = run.name or path.stem
        display_name_counts[base_name] = display_name_counts.get(base_name, 0) + 1
        suffix_index = display_name_counts[base_name]
        model_name = base_name if suffix_index == 1 else f"{base_name} [{suffix_index}]"

        summary = run.summary if isinstance(getattr(run, "summary", None), dict) else {}
        run_config = run.config if isinstance(getattr(run, "config", None), dict) else {}
        details_by_model[model_name] = {
            "path": str(path),
            "source_name": base_name,
            "utterances": summary.get("Number of utterances"),
            "hours": summary.get("Number of hours"),
            "normalized": summary.get("Normalized"),
            "metric_provider": run_config.get("metric_provider"),
        }

        rows.append({"path": str(path), "name": model_name})
        values_by_model[model_name] = metrics

    columns = sorted(metric_names, key=_metric_column_sort_key)
    rankings: List[Dict[str, Any]] = []
    for metric_name in columns:
        metric_values: List[tuple[str, float]] = []
        for row in rows:
            model_name = str(row.get("name", ""))
            value = _safe_metric_float(values_by_model.get(model_name, {}).get(metric_name))
            if value is not None:
                metric_values.append((model_name, value))
        if len(metric_values) < 2:
            continue

        reverse = not _lower_is_better(metric_name)
        ranked_values = sorted(metric_values, key=lambda item: item[1], reverse=reverse)
        best_model, best_value = ranked_values[0]
        worst_model, worst_value = ranked_values[-1]
        rankings.append(
            {
                "metric": metric_name,
                "direction": "lower_is_better" if _lower_is_better(metric_name) else "higher_is_better",
                "best_model": best_model,
                "best_value": best_value,
                "worst_model": worst_model,
                "worst_value": worst_value,
                "spread_abs": abs(worst_value - best_value),
            }
        )

    return {
        "runs": rows,
        "metrics": columns,
        "values": values_by_model,
        "details": details_by_model,
        "rankings": rankings,
    }


def _render_profile_many_table(payload: Dict[str, Any]) -> None:
    columns: List[str] = list(payload.get("metrics") or [])
    values_by_model: Dict[str, Dict[str, Optional[float]]] = payload.get("values") or {}
    run_rows: List[Dict[str, Any]] = payload.get("runs") or []
    details_by_model: Dict[str, Dict[str, Any]] = payload.get("details") or {}
    rankings: List[Dict[str, Any]] = payload.get("rankings") or []

    details_tbl = Table(title="Profile many (run details)", box=box.SIMPLE, show_header=True, header_style="bold cyan")
    details_tbl.add_column("Model", style="bold", no_wrap=True)
    details_tbl.add_column("Utterances", justify="right")
    details_tbl.add_column("Hours", justify="right")
    details_tbl.add_column("Normalized", justify="center")
    details_tbl.add_column("Provider", justify="left")
    details_tbl.add_column("Path", justify="left")
    for run_row in run_rows:
        model_name = str(run_row.get("name", ""))
        details = details_by_model.get(model_name, {})
        details_tbl.add_row(
            model_name,
            str(details.get("utterances", "-")),
            str(details.get("hours", "-")),
            str(details.get("normalized", "-")),
            str(details.get("metric_provider", "-")),
            str(details.get("path", run_row.get("path", "-"))),
        )
    console.print(details_tbl)

    if rankings:
        rank_tbl = Table(title="Profile many (metric ranking)", box=box.SIMPLE, show_header=True, header_style="bold green")
        rank_tbl.add_column("Metric", style="bold")
        rank_tbl.add_column("Best model")
        rank_tbl.add_column("Best value", justify="right")
        rank_tbl.add_column("Worst model")
        rank_tbl.add_column("Worst value", justify="right")
        for item in rankings:
            rank_tbl.add_row(
                str(item.get("metric", "-")),
                str(item.get("best_model", "-")),
                format_cell(item.get("best_value")),
                str(item.get("worst_model", "-")),
                format_cell(item.get("worst_value")),
            )
        console.print(rank_tbl)

    tbl = Table(title="Profile many (models × metrics)", box=box.ROUNDED, show_header=True, header_style="bold magenta")
    tbl.add_column("Model", style="bold", no_wrap=True)
    for col in columns:
        tbl.add_column(col, justify="right")

    for run_row in run_rows:
        model_name = str(run_row.get("name", ""))
        metrics = values_by_model.get(model_name, {})
        tbl.add_row(
            model_name,
            *[format_cell(metrics.get(col)) for col in columns],
        )
    console.print(tbl)


def _get_manifest_summary(
    manifest: Manifest,
    show_vocab: bool = True,
    show_alphabet: bool = True,
) -> dict:
    """Build manifest summary with optional field filtering."""
    summary = dict(manifest.summary)
    if not show_vocab:
        summary.pop("Vocabulary size", None)
    if not show_alphabet:
        summary.pop("Alphabet size", None)
    return summary


def _print_manifest_summary_table(
    summary: dict,
    title: str = "Manifest summary"
) -> None:
    """Print a human-readable table for manifest summary."""
    tbl = Table(title=title, box=box.SIMPLE)
    tbl.add_column("Metric", style="bold", no_wrap=True)
    tbl.add_column("Value")
    for k, v in summary.items():
        tbl.add_row(str(k), json.dumps(v, ensure_ascii=False) if isinstance(v, dict) else str(v))
    console.print(tbl)


def _build_manifest_profile(manifest: Manifest) -> Dict[str, Any]:
    df = manifest.to_df()
    profile: Dict[str, Any] = {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "num_columns": int(len(df.columns)),
        "normalized": bool(manifest.normalized),
        "normalize_cfg": dict(manifest.normalized_cfg or {}),
        "nulls_by_column": {c: int(v) for c, v in df.isna().sum().to_dict().items()},
        "dtypes": {c: str(t) for c, t in df.dtypes.to_dict().items()},
    }
    if "audio_filepath" in df.columns:
        profile["audio_filepath_unique"] = int(df["audio_filepath"].astype(str).nunique())
        profile["audio_filepath_duplicates"] = max(
            int(len(df) - profile["audio_filepath_unique"]), 0
        )
    if "duration" in df.columns and len(df) > 0:
        duration = df["duration"]
        profile["duration_stats"] = {
            "mean": float(duration.mean()) if duration.notna().any() else 0.0,
            "min": float(duration.min()) if duration.notna().any() else 0.0,
            "max": float(duration.max()) if duration.notna().any() else 0.0,
        }
    return profile


def _build_manifest_profile_payload(
    manifest: Manifest,
    show_vocab: bool = True,
    show_alphabet: bool = True,
    include_technical: bool = False,
) -> Dict[str, Any]:
    """
    Build manifest profile payload.
    Default mode returns user-facing summary only.
    Full mode appends structural/technical diagnostics.
    """
    summary = _get_manifest_summary(
        manifest,
        show_vocab=show_vocab,
        show_alphabet=show_alphabet,
    )
    if not include_technical:
        return summary

    structural_profile = _build_manifest_profile(manifest)
    # Avoid semantic duplicates between legacy summary fields and structural profile keys.
    semantic_duplicates = {
        "rows": "Number of utterances",
        "normalized": "Normalized",
        "normalize_cfg": "Normalization config",
    }
    merged = dict(summary)
    for key, value in structural_profile.items():
        duplicate_of = semantic_duplicates.get(key)
        if duplicate_of is not None and duplicate_of in summary:
            continue
        if key not in merged:
            merged[key] = value
    return merged


def _order_manifest_profile_fields(profile: Dict[str, Any]) -> Dict[str, Any]:
    preferred_order = [
        "Number of utterances",
        "Number of hours",
        "Duration types",
        "Duration info",
        "Normalized",
        "Normalization config",
        "Replacements total",
        "Replacements by field",
        "Vocabulary size",
        "Alphabet size",
        "num_columns",
        "columns",
        "audio_filepath_unique",
        "audio_filepath_duplicates",
        "duration_stats",
        "nulls_by_column",
        "dtypes",
    ]
    order_index = {key: idx for idx, key in enumerate(preferred_order)}
    ordered_items = sorted(
        profile.items(),
        key=lambda kv: (order_index.get(kv[0], len(order_index)), kv[0]),
    )
    return {key: value for key, value in ordered_items}


def _render_manifest_profile_table(profile: Dict[str, Any]) -> None:
    ordered_profile = _order_manifest_profile_fields(profile)
    tbl = Table(title="Manifest profile", box=box.SIMPLE)
    tbl.add_column("Field", style="bold", no_wrap=True)
    tbl.add_column("Value")
    for key, value in ordered_profile.items():
        rendered = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
        tbl.add_row(str(key), rendered)
    console.print(tbl)


def _emit_manifest_profile_output(profile: Dict[str, Any], json_out: bool, out: Optional[Path]) -> None:
    ordered_profile = _order_manifest_profile_fields(profile)
    if json_out or out is not None:
        payload = json.dumps(ordered_profile, ensure_ascii=False, indent=2)
        if out is not None:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(payload, encoding="utf-8")
            console.print(f"Saved profile to {out}", style="green")
        if json_out:
            typer.echo(payload)
        return
    _render_manifest_profile_table(ordered_profile)


@manifest_app.command(
    "profile",
    help="Show manifest profile summary; use --full for technical diagnostics.",
)
def manifest_profile(
    manifest: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Input manifest file (.json/.jsonl/.csv)."),
    json_out: bool = typer.Option(False, "--json", "-j", help="Print profile as JSON."),
    out: Optional[Path] = typer.Option(None, "--out", "-o", help="Save profile JSON to a file."),
    full: bool = typer.Option(
        False,
        "--full",
        help="Include full technical details (schema/nulls/dtypes/key stats).",
    ),
) -> None:
    m = Manifest.load_from(str(manifest))
    profile = _build_manifest_profile_payload(
        m,
        show_vocab=True,
        show_alphabet=True,
        include_technical=full,
    )
    _emit_manifest_profile_output(profile, json_out=json_out, out=out)


@manifest_app.command("import", help="Import manifest records from supported source into local file.")
def manifest_import(
    source: str = typer.Option(..., "--source", "-s", help="Source path or external source id."),
    out: Path = typer.Option(..., "--out", "-o", help="Output file path (.json/.jsonl/.csv)."),
    kwargs: List[str] = typer.Option([], "--kv", "-k", help="Optional extra key-value argument in the form key=value. Can be repeated."),
) -> None:
    extra_kwargs = parse_kv_options(kwargs)
    m = Manifest.load_from(str(source), **extra_kwargs)
    out.parent.mkdir(parents=True, exist_ok=True)
    _auto_save_manifest(m, out)
    console.print(f"Imported records: {len(m)} -> {out}", style="green")


@manifest_app.command(
    "preprocess",
    help="Apply normalization pipeline to manifest fields and save result.",
)
def manifest_preprocess(
    manifest: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Input manifest file."),
    out: Path = typer.Option(..., "--out", "-o", help="Output manifest file."),
    fields: List[str] = typer.Option(["text", "prediction"], "--field", "-f", help="Text columns to normalize. Repeat for multiple columns."),
    rename_columns: List[str] = typer.Option(
        [],
        "--rename-column",
        "-rc",
        help="Rename columns before normalization in OLD=NEW format. Repeat for multiple mappings.",
    ),
    drop_columns: List[str] = typer.Option([], "--drop-column", "-dc", help="Drop columns before normalization."),
    remove_punct: bool = typer.Option(True, "--remove-punct/--no-remove-punct", help="Remove punctuation."),
    lowercase: bool = typer.Option(True, "--lowercase/--no-lowercase", help="Lowercase text."),
    replace_yo: bool = typer.Option(True, "--replace-yo/--no-replace-yo", help="Replace 'ё' with 'е'."),
    subst_table: Optional[str] = typer.Option(None, "--subst-table", help="Path to a substitution-table .csv. Use 'none' to disable."),
    force: bool = typer.Option(False, "--force", help="Overwrite output file if it exists."),
) -> None:
    if out.exists() and not force:
        raise typer.BadParameter(f"File already exists: {out}. Use --force to overwrite.")

    rename_map = _parse_rename_columns(rename_columns)
    m = _load_and_preprocess_manifest(
        str(manifest),
        source_kwargs={},
        rename_map=rename_map,
        drop_columns=drop_columns,
        fields=fields,
        remove_punct=remove_punct,
        lowercase=lowercase,
        replace_yo=replace_yo,
        subst_table=subst_table,
        context="manifest preprocess",
    )

    _auto_save_manifest(m, out)
    console.print(f"Saved: {out}", style="green")


@manifest_app.command("split", help="Split manifest into train and test subsets.")
def manifest_split(
    manifest: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Input manifest file."),
    out_train: Path = typer.Argument(..., resolve_path=True, help="Output path for train split."),
    out_test: Path = typer.Argument(..., resolve_path=True, help="Output path for test split."),
    test_size: float = typer.Option(0.1, min=0.01, max=0.99, help="Test split ratio in (0,1)."),
    seed: int = typer.Option(42, "--seed", "-s", help="Random seed."),
    stratify_field: Optional[str] = typer.Option(None, "--stratify-field", "-sf", help="Optional column used for stratification."),
    overwrite: bool = typer.Option(False, "--force", "-f", help="Overwrite existing output files."),
    shuffle: bool = typer.Option(True, help="Shuffle before split."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Print summary for train/test subsets."),
) -> None:
    for p in [out_train, out_test]:
        if p.exists() and not overwrite:
            raise typer.BadParameter(f"File already exists: {p}. Use --force to overwrite.")
        p.parent.mkdir(parents=True, exist_ok=True)

    m = Manifest.load_from(str(manifest))
    if stratify_field is not None and stratify_field not in m.to_df().columns:
        raise typer.BadParameter(f"Column not found: {stratify_field}")
    train_m, test_m = m.train_test_split(test_size=test_size, random_state=seed, shuffle=shuffle, stratify=stratify_field)
    _auto_save_manifest(train_m, out_train)
    _auto_save_manifest(test_m, out_test)
    console.print(f"Saved train={out_train} test={out_test}", style="green")

    if verbose:
        console.print("[bold cyan]Train Manifest Summary:[/bold cyan]")
        _print_manifest_summary_table(dict(train_m.summary), title="Train")
        console.print("[bold cyan]Test Manifest Summary:[/bold cyan]")
        _print_manifest_summary_table(dict(test_m.summary), title="Test")


@manifest_app.command("sample", help="Sample a subset from manifest by count or ratio.")
def manifest_sample(
    manifest: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Input manifest file."),
    out: Path = typer.Option(..., "--out", "-o", help="Output sampled manifest file."),
    count: Optional[int] = typer.Option(None, "--count", "-n", min=1, help="Sample size as number of rows."),
    ratio: Optional[float] = typer.Option(None, "--ratio", min=0.0, max=1.0, help="Sample size as fraction in (0,1]."),
    shuffle: bool = typer.Option(True, help="Shuffle before sampling."),
    seed: Optional[int] = typer.Option(None, "--seed", "-s", help="Optional random seed."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Print summary for sampled subset."),
) -> None:
    if (count is None and ratio is None) or (count is not None and ratio is not None):
        raise typer.BadParameter("Specify exactly one of --count/-n or --ratio.")
    if ratio is not None and ratio <= 0:
        raise typer.BadParameter("--ratio must be in (0,1].")

    m = Manifest.load_from(str(manifest))
    n_val: int | float = count if count is not None else ratio
    sampled = m.sample(n=n_val, shuffle=shuffle, random_seed=seed)
    _auto_save_manifest(sampled, out)
    console.print(f"Saved: {out}", style="green")
    if verbose:
        console.print("[bold cyan]Sample Manifest Summary:[/bold cyan]")
        _print_manifest_summary_table(dict(sampled.summary), title="Sample")


@manifest_app.command("merge", help="Merge multiple manifest files and/or directories into a single output file.")
def manifest_merge(
    manifests: List[Path] = typer.Argument(..., metavar="MANIFEST_OR_DIR...", help="Input manifest files and/or directories."),
    out: Path = typer.Option(..., "--out", "-o", help="Output merged manifest file."),
    recursive: bool = typer.Option(False, "--recursive", "-r", help="Scan input directories recursively."),
    dedupe_by: List[str] = typer.Option(
        [],
        "--dedupe-by",
        help="Drop duplicate rows by one or more columns (repeat option). Keeps first occurrence.",
    ),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show merged manifest statistics"),
) -> None:
    resolved_manifests = _resolve_paths(
        manifests,
        allowed_exts={".json", ".jsonl", ".csv"},
        what="merge manifests",
        recursive=recursive,
    )

    merged = sum((Manifest.load_from(str(p)) for p in resolved_manifests))
    if dedupe_by:
        merged_df = merged.to_df()
        missing = [col for col in dedupe_by if col not in merged_df.columns]
        if missing:
            raise typer.BadParameter(
                f"Columns for --dedupe-by not found: {', '.join(missing)}"
            )
        before_len = len(merged_df)
        deduped_df = merged_df.drop_duplicates(subset=dedupe_by, keep="first")
        dropped = before_len - len(deduped_df)
        merged = Manifest(deduped_df.to_dict("records"))
        console.print(
            f"Deduplicated rows: removed {dropped} duplicates by columns {dedupe_by}",
            style="cyan",
        )

    _auto_save_manifest(merged, out)
    console.print(
        f"Saved merged manifest: {out} (from {len(resolved_manifests)} files)", style="green"
    )
    if verbose:
        _print_manifest_summary_table(dict(merged.summary), title="Merged manifest summary")


@run_app.command(
    "analyze",
    help="Analyze manifest(s): one file, several files, or a directory → RESONRun JSON.",
)
def run_analyze(
    manifests: Annotated[
        List[str],
        typer.Argument(..., metavar="MANIFEST_OR_DIR...", help="Manifest file(s), directories, or external source id."),
    ],
    name: str = typer.Option("DefaultRun", "--name", "-n", help="Run name (single manifest only; default: filename stem)."),
    metric_provider: str = typer.Option(
        "jiwer",
        "--metric-provider",
        "-p",
        help="Metric provider to use (built-in: jiwer). Custom providers: use the Python API.",
    ),
    metrics: List[str] = typer.Option(["WER", "CER"], "--metric", "-m", help="Metrics to compute. Repeat for multiple metrics."),
    meta: Optional[str] = typer.Option(None, "--meta", help="Inline run metadata as JSON object (single manifest only)."),
    meta_file: Optional[Path] = typer.Option(None, "--meta-file", exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Metadata JSON file (single manifest only)."),
    fields: List[str] = typer.Option(["text", "prediction"], "--field", "-f", help="Fields to normalize before analysis."),
    rename_columns: List[str] = typer.Option(
        [],
        "--rename-column",
        "-rc",
        help="Rename columns before normalization in OLD=NEW format. Repeat for multiple mappings.",
    ),
    drop_columns: List[str] = typer.Option(
        [],
        "--drop-column",
        "-dc",
        help="Drop columns before normalization.",
    ),
    remove_punct: bool = typer.Option(True, "--remove-punct/--no-remove-punct", help="Remove punctuation in preprocessing."),
    lowercase: bool = typer.Option(True, "--lowercase/--no-lowercase", help="Lowercase in preprocessing."),
    replace_yo: bool = typer.Option(True, "--replace-yo/--no-replace-yo", help="Replace 'ё' with 'е' in preprocessing."),
    subst_table: Optional[str] = typer.Option(None, "--subst-table", help="Path to a substitution-table .csv. Use 'none' to disable."),
    out_dir: Optional[Path] = typer.Option(None, "--out-dir", "-o", help="Output directory for RESONRun JSON. Required for multiple manifests."),
    save_metric_provider_out: bool = typer.Option(
        False,
        "--save-metric-provider-out",
        help="Keep provider-generated artifacts in out-dir (single-manifest mode only).",
    ),
    source_kv: List[str] = typer.Option(
        [],
        "--kv",
        "-k",
        help="Extra key=value args forwarded to Manifest.load_from (e.g., for external source ids). Repeat option.",
    ),
    recursive: bool = typer.Option(
        False,
        "--recursive",
        "-r",
        help="Scan input directories recursively for manifests.",
    ),
    force: bool = typer.Option(False, "--force", help="Overwrite existing RESONRun JSON files."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Print per-file execution log."),
) -> None:
    sources = _resolve_analyze_sources(manifests, recursive=recursive)
    source_kwargs = parse_kv_options(source_kv)
    rename_map = _parse_rename_columns(rename_columns)
    batch_mode = len(sources) > 1

    if batch_mode:
        if meta is not None or meta_file is not None:
            raise typer.BadParameter("--meta/--meta-file apply to single-manifest analyze only.")
        if out_dir is None:
            raise typer.BadParameter("Provide --out-dir when analyzing multiple manifests.")
        meta_dict = None
    else:
        meta_dict = load_meta(meta, meta_file)

    provider, metric_provider_key = resolve_metric_provider(metric_provider, metrics, replace_yo)
    aris_name = "batch-run" if batch_mode else name
    reson = RESON(name=aris_name, metrics=metrics, metric_provider=provider, meta=meta_dict or None)

    if batch_mode:
        if save_metric_provider_out:
            console.print(
                "[yellow]Note:[/yellow] --save-metric-provider-out works only in single-manifest mode and is ignored in batch."
            )
        out_dir.mkdir(parents=True, exist_ok=True)
        if verbose:
            console.print(
                f"[cyan]Starting analyze:[/cyan] inputs={len(sources)}, "
                f"provider={metric_provider_key}, metrics={','.join(metrics)}"
            )
        saved_files: List[str] = []
        for idx, src in enumerate(sources, start=1):
            run_name = _derive_run_name(src, fallback_index=idx)
            if verbose:
                console.print(f"[cyan][{idx}/{len(sources)}][/cyan] Loading {src} as run '{run_name}'")
            m = _load_and_preprocess_manifest(
                src,
                source_kwargs=source_kwargs,
                rename_map=rename_map,
                drop_columns=drop_columns,
                fields=fields,
                remove_punct=remove_punct,
                lowercase=lowercase,
                replace_yo=replace_yo,
                subst_table=subst_table,
                context=f"run analyze ({src})",
            )
            if verbose:
                console.print(f"[cyan][{idx}/{len(sources)}][/cyan] Preprocess complete")
            if verbose:
                console.print(f"[cyan][{idx}/{len(sources)}][/cyan] Analyzing")
            run = reson.analyze(m, run_name=run_name)
            fp = out_dir / f"{run_name}.json"
            if fp.exists() and not force:
                raise typer.BadParameter(f"File already exists: {fp}. Use --force to overwrite.")
            run.to_json(str(fp))
            saved_files.append(str(fp))
            if verbose:
                console.print(f"[green][{idx}/{len(sources)}][/green] Saved {fp}")
        console.print(f"Saved {len(saved_files)} runs to {out_dir}", style="green")
        for fp in saved_files:
            console.print(f" - {fp}")
        return

    src = sources[0]
    run_name = name if name != "DefaultRun" else _derive_run_name(src, fallback_index=1)
    if save_metric_provider_out and out_dir is None:
        console.print(
            "[yellow]Note:[/yellow] --save-metric-provider-out requires --out-dir in single-manifest mode; flag is ignored."
        )
    m = _load_and_preprocess_manifest(
        src,
        source_kwargs=source_kwargs,
        rename_map=rename_map,
        drop_columns=drop_columns,
        fields=fields,
        remove_punct=remove_punct,
        lowercase=lowercase,
        replace_yo=replace_yo,
        subst_table=subst_table,
        context=f"run analyze ({src})",
    )
    run = reson.analyze(
        manifest=m,
        run_name=run_name,
        artifacts_dir=(str(out_dir) if out_dir is not None and save_metric_provider_out else None),
    )
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        fp = out_dir / f"{run_name}.json"
        if fp.exists() and not force:
            raise typer.BadParameter(f"File already exists: {fp}. Use --force to overwrite.")
        run.to_json(str(fp))
        console.print(f"RESONRun saved: {fp}", style="green")
    _print_metrics_table(run, f"Metrics — {run_name}")


def _resolve_analyze_sources(manifests: List[str], *, recursive: bool) -> List[str]:
    if not manifests:
        raise typer.BadParameter("Provide at least one manifest path or directory.")

    resolved: List[str] = []
    for raw_source in manifests:
        p = Path(raw_source)
        if p.exists():
            if p.is_dir():
                dir_files = _resolve_paths(
                    [p],
                    allowed_exts={".json", ".jsonl", ".csv"},
                    what="analyze",
                    recursive=recursive,
                )
                resolved.extend([str(fp) for fp in dir_files])
            elif p.is_file() and p.suffix.lower() in {".json", ".jsonl", ".csv"}:
                resolved.append(str(p))
            else:
                raise typer.BadParameter(f"analyze: unsupported input path ({raw_source})")
        else:
            # Allow source-specific kwargs forwarded to Manifest.load_from via --kv.
            if p.suffix.lower() in {".json", ".jsonl", ".csv"}:
                raise typer.BadParameter(f"analyze: path does not exist ({raw_source})")
            resolved.append(raw_source)

    uniq: List[str] = []
    seen = set()
    for source in resolved:
        key = str(Path(source).resolve()) if Path(source).exists() else source
        if key not in seen:
            seen.add(key)
            uniq.append(source)
    return uniq


def _derive_run_name(source: str, *, fallback_index: int) -> str:
    source_path = Path(source)
    if source_path.exists():
        stem = source_path.stem
        return stem if stem else f"run_{fallback_index}"

    sanitized = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in source)
    sanitized = sanitized.strip("_")
    return sanitized if sanitized else f"run_{fallback_index}"


def _print_single_run_profile(run: RESONRun) -> None:
    console.print(Panel(f"Run: {run.name}", title="RESONRun", border_style="cyan"))

    if getattr(run, "meta", None):
        meta_tbl = Table(title="Meta info", box=box.SIMPLE)
        meta_tbl.add_column("Meta key", style="bold")
        meta_tbl.add_column("Value")
        for k, v in run.meta.items():
            meta_tbl.add_row(str(k), json.dumps(v, ensure_ascii=False) if isinstance(v, dict) else str(v))
        console.print(meta_tbl)

    profile_tbl = Table(title="Run profile", box=box.SIMPLE)
    profile_tbl.add_column("Field", style="bold")
    profile_tbl.add_column("Value")

    for k, v in (run.summary or {}).items():
        profile_tbl.add_row(str(k), json.dumps(v, ensure_ascii=False) if isinstance(v, dict) else str(v))

    metric_provider_name = None
    if hasattr(run, "config") and run.config:
        metric_provider_name = run.config.get("metric_provider", None)
    if metric_provider_name:
        profile_tbl.add_row("Metric provider", metric_provider_name)

    console.print(profile_tbl)
    _print_metrics_table(run, "Metrics")


@run_app.command(
    "profile",
    help="Inspect RESONRun JSON: detailed view for one file, metrics table for many files or a directory.",
)
def run_profile(
    runs: Annotated[List[Path], typer.Argument(help="RESONRun JSON file(s) and/or directories.")],
    include_mwa: bool = typer.Option(True, "--include-mwa/--no-mwa", help="Add MWA column in multi-run table mode."),
    mode: str = typer.Option(
        "table",
        "--mode",
        help="Multi-run output mode: table | json | both.",
    ),
    out_json: Optional[Path] = typer.Option(None, "--out", "-o", help="Save multi-run table as JSON."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Print per-file loading log."),
) -> None:
    mode_key = mode.strip().lower()
    if mode_key not in {"table", "json", "both"}:
        raise typer.BadParameter("--mode must be one of: table, json, both")

    run_files = _resolve_paths(runs, allowed_exts={".json"}, what="profile")
    if len(run_files) == 1:
        if mode_key != "table":
            console.print(
                "[yellow]Note:[/yellow] --mode applies to multi-run mode only; using detailed single-run view."
            )
        if out_json is not None:
            console.print(
                "[yellow]Note:[/yellow] --out applies to multi-run table mode only; ignored for a single file.",
            )
        run = RESONRun.from_json(str(run_files[0]))
        _print_single_run_profile(run)
        return

    entries: List[tuple[Path, RESONRun]] = []
    for idx, run_fp in enumerate(run_files, start=1):
        if verbose:
            console.print(f"[cyan][{idx}/{len(run_files)}][/cyan] Loading {run_fp}")
        entries.append((run_fp, RESONRun.from_json(str(run_fp))))

    payload = _build_profile_many_payload(entries, include_mwa=include_mwa)
    if mode_key in {"table", "both"}:
        _render_profile_many_table(payload)
    if mode_key in {"json", "both"}:
        typer.echo(json.dumps(payload, ensure_ascii=False, indent=2))

    if out_json is not None:
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        console.print(f"Saved profile JSON: {out_json}", style="green")


def _format_compare_significance(sig: Optional[Dict[str, Any]], *, alpha: float) -> Optional[Dict[str, Any]]:
    if sig is None:
        return None
    return {
        "num_bootstraps": sig.get("num_bootstraps"),
        "ci95_delta_wer_pp": sig.get("ci95"),
        "p_one_sided_delta_wer_ge_0": sig.get("p_one_sided"),
        "alpha": sig.get("alpha", alpha),
        "stratified_by": sig.get("stratified_by"),
    }


def _build_compare_mwa_metric_record(
    baseline_run: RESONRun,
    candidate_run: RESONRun,
) -> Optional[Dict[str, Any]]:
    baseline_vocab = getattr(baseline_run, "vocab", None)
    candidate_vocab = getattr(candidate_run, "vocab", None)
    baseline_mwa = _safe_metric_float(getattr(baseline_vocab, "mean_recall", None) if baseline_vocab else None)
    candidate_mwa = _safe_metric_float(getattr(candidate_vocab, "mean_recall", None) if candidate_vocab else None)
    if baseline_mwa is None and candidate_mwa is None:
        return None

    diff = (
        (candidate_mwa - baseline_mwa)
        if baseline_mwa is not None and candidate_mwa is not None
        else None
    )
    rel = (
        (diff / baseline_mwa) * 100.0
        if diff is not None and baseline_mwa not in (None, 0.0)
        else None
    )
    return {
        "name": "MWA",
        "baseline": baseline_mwa,
        "rc": candidate_mwa,
        "diff_abs": diff,
        "diff_rel_pct": rel,
    }


def _enrich_compare_metrics_records(
    cmp,
    baseline_run: RESONRun,
    candidate_run: RESONRun,
    *,
    include_mwa: bool,
) -> List[Dict[str, Any]]:
    metrics = [
        rec
        for rec in cmp.metrics_delta_records()
        if _metric_has_compare_values(rec)
    ]
    if include_mwa:
        metrics = [rec for rec in metrics if str(rec.get("name", "")).upper() != "MWA"]
        mwa_record = _build_compare_mwa_metric_record(baseline_run, candidate_run)
        if mwa_record is not None:
            metrics.append(mwa_record)
    return metrics


def _metric_has_compare_values(metric_record: Dict[str, Any]) -> bool:
    return any(
        _safe_metric_float(metric_record.get(key)) is not None
        for key in ("baseline", "rc", "diff_abs")
    )


def _collect_compare_metric_names(
    rows: List[Dict[str, Any]],
    *,
    include_mwa: bool,
) -> List[str]:
    metric_names: set[str] = set()
    for row in rows:
        for metric_record in row.get("metrics", []):
            metric_name = str(metric_record.get("name", "")).strip()
            if not metric_name:
                continue
            if metric_name.upper() == "MWA" and not include_mwa:
                continue
            if _metric_has_compare_values(metric_record):
                metric_names.add(metric_name)
    return sorted(metric_names, key=_metric_column_sort_key)


def _build_candidate_table_row(
    candidate: Path,
    candidate_run: RESONRun,
    *,
    include_mwa: bool,
) -> Dict[str, Any]:
    metric_values = _collect_run_metrics(candidate_run, include_mwa=include_mwa)
    metrics: List[Dict[str, Any]] = []
    for metric_name, value in metric_values.items():
        if value is None:
            continue
        metrics.append(
            {
                "name": metric_name,
                "baseline": value,
                "rc": value,
                "diff_abs": None,
                "diff_rel_pct": None,
            }
        )

    matched: Any = "-"
    summary = candidate_run.summary if isinstance(getattr(candidate_run, "summary", None), dict) else {}
    if summary.get("Number of utterances") is not None:
        matched = summary.get("Number of utterances")
    elif getattr(candidate_run, "manifest", None) is not None and not candidate_run.manifest.empty:
        matched = len(candidate_run.manifest)

    return {
        "baseline_path": str(candidate),
        "baseline_name": candidate_run.name,
        "candidate_path": str(candidate),
        "candidate_name": candidate_run.name,
        "is_candidate": True,
        "matched_utterances": matched,
        "metrics": metrics,
        "significance": None,
    }


def _render_compare_many_table(
    *,
    candidate_name: str,
    rows: List[Dict[str, Any]],
    include_mwa: bool,
    bootstrap: bool,
) -> None:
    metric_names = _collect_compare_metric_names(rows, include_mwa=include_mwa)
    if not metric_names:
        console.print("[yellow]No comparable metrics found.[/yellow]")
        return

    tbl = Table(
        title=f"Compare ({candidate_name})",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold magenta",
    )
    tbl.add_column("Model", style="bold", no_wrap=True)
    tbl.add_column("Matched", justify="right")

    for metric_name in metric_names:
        tbl.add_column(metric_name, justify="right")
        tbl.add_column(f"Δ{metric_name}", justify="right")

    show_bootstrap = bootstrap and any(name.upper() == "WER" for name in metric_names)
    if show_bootstrap:
        tbl.add_column("CI95 ΔWER", justify="right")
        tbl.add_column("p_one", justify="right")

    for row in rows:
        metrics = row.get("metrics", [])
        is_candidate = bool(row.get("is_candidate"))
        model_label = str(row.get("baseline_name", ""))
        if is_candidate:
            model_label = f"{model_label} (candidate)"

        cells: List[Any] = [
            Text(model_label, style="bold cyan") if is_candidate else model_label,
            str(row.get("matched_utterances", "-")),
        ]
        for metric_name in metric_names:
            metric_record = _metric_delta_by_name(metrics, metric_name) or {}
            if is_candidate:
                cells.extend(
                    [
                        format_cell(metric_record.get("rc") or metric_record.get("baseline")),
                        "-",
                    ]
                )
                continue

            diff_abs = _safe_metric_float(metric_record.get("diff_abs"))
            diff_style = _delta_style(metric_name, diff_abs)
            cells.extend(
                [
                    format_cell(metric_record.get("baseline")),
                    Text("-" if diff_abs is None else f"{diff_abs:+.4g}", style=diff_style),
                ]
            )
        if show_bootstrap:
            if is_candidate:
                cells.extend(["-", "-"])
            else:
                cells.extend(
                    [
                        _format_ci95_text(row.get("significance")),
                        _format_p_one_sided_text(row.get("significance")),
                    ]
                )
        tbl.add_row(*cells)
    console.print(tbl)


def _metric_delta_by_name(metrics: List[Dict[str, Any]], metric_name: str) -> Optional[Dict[str, Any]]:
    metric_upper = metric_name.strip().upper()
    return next((m for m in metrics if str(m.get("name", "")).strip().upper() == metric_upper), None)


def _format_ci95_text(significance: Optional[Dict[str, Any]]) -> str:
    if not isinstance(significance, dict):
        return "-"
    ci = significance.get("ci95_delta_wer_pp")
    if isinstance(ci, (list, tuple)) and len(ci) == 2:
        return f"[{float(ci[0]):+.3g}, {float(ci[1]):+.3g}]"
    return "-"


def _format_p_one_sided_text(significance: Optional[Dict[str, Any]]) -> str:
    if not isinstance(significance, dict):
        return "-"
    p_value = significance.get("p_one_sided_delta_wer_ge_0")
    if p_value is None:
        return "-"
    return f"{float(p_value):.4f}"


@run_app.command(
    "compare",
    help="Compare candidate RESONRun JSON against one or more baselines (terminal output; no manifest preprocessing).",
)
def run_compare(
    candidate: Annotated[Path, typer.Argument(..., exists=True, help="Candidate RESONRun (.json).")],
    baselines: Annotated[List[Path], typer.Argument(..., help="Baseline RESONRun file(s) and/or directories.")],
    include_mwa: bool = typer.Option(True, "--include-mwa/--no-mwa", help="Include MWA metric in compare tables."),
    stratify_col: Optional[str] = typer.Option(None, "--stratify-col", "-sf", help="Optional column for stratified bootstrap."),
    bootstrap: bool = typer.Option(
        False,
        "--bootstrap/--no-bootstrap",
        help="Run utterance-level bootstrap for ΔWER significance (requires matched audio_filepath).",
    ),
    significance_scope: str = typer.Option(
        "primary",
        "--significance-scope",
        help="Which pairs get bootstrap with --bootstrap: primary | candidate-all | none (only --significance-pair).",
    ),
    significance_pair: List[str] = typer.Option(
        [],
        "--significance-pair",
        help="Explicit baseline:candidate pair for bootstrap (repeatable). Example: baseline_model:candidate_model",
    ),
    num_bootstraps: int = typer.Option(2000, "--bootstraps", "-b", min=1000, help="Number of bootstrap samples."),
    alpha: float = typer.Option(0.05, "--alpha", "-a", help="Significance level."),
    out_json: Optional[Path] = typer.Option(None, "--out", "-o", help="Optional output JSON path."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Print per-baseline execution log."),
) -> None:
    baseline_files = _resolve_paths(baselines, allowed_exts={".json"}, what="compare baselines")
    candidate_run = RESONRun.from_json(str(candidate))
    candidate_key = str(candidate.resolve())
    candidate_row = _build_candidate_table_row(
        candidate,
        candidate_run,
        include_mwa=include_mwa,
    )

    if verbose:
        console.print(
            f"[cyan]Starting compare:[/cyan] candidate={candidate_run.name}, "
            f"baselines={len(baseline_files)}, bootstrap={'yes' if bootstrap else 'no'}"
        )

    baseline_entries: List[tuple[Path, RESONRun]] = []
    for baseline_fp in baseline_files:
        if str(baseline_fp.resolve()) == candidate_key:
            if verbose:
                console.print(
                    f"[yellow]Skipping self-comparison for candidate:[/yellow] {baseline_fp.name}"
                )
            continue
        baseline_entries.append((baseline_fp, RESONRun.from_json(str(baseline_fp))))

    model_names = [candidate_run.name, *[run.name for _, run in baseline_entries]]
    primary_baseline_name = baseline_entries[0][1].name if baseline_entries else None
    significance_pairs = resolve_compare_significance_pairs(
        bootstrap=bootstrap,
        model_names=model_names,
        candidate_name=candidate_run.name,
        primary_baseline_name=primary_baseline_name,
        significance_scope=significance_scope,
        significance_pair_options=significance_pair,
    )
    significance_pair_set = set(significance_pairs)
    if verbose and bootstrap:
        console.print(f"[cyan]Significance pairs:[/cyan] {significance_pairs}")

    rows: List[Dict[str, Any]] = []
    for idx, (baseline_fp, baseline_run) in enumerate(baseline_entries, start=1):
        if verbose:
            console.print(f"[cyan][{idx}/{len(baseline_entries)}][/cyan] Comparing baseline file: {baseline_fp}")
        cmp = compare_runs(baseline_run, candidate_run)
        should_bootstrap = (baseline_run.name, candidate_run.name) in significance_pair_set
        if verbose:
            console.print(
                f"[cyan][{idx}/{len(baseline_entries)}][/cyan] Matched rows: {cmp.matched_rows}; "
                f"running bootstrap={'yes' if should_bootstrap and cmp.matched_rows > 0 else 'no'}"
            )
        sig = (
            None
            if not should_bootstrap or cmp.matched_rows == 0
            else cmp.compute_significance(
                stratify_col=stratify_col,
                num_bootstraps=num_bootstraps,
                seed=42,
                alpha=alpha,
            )
        )
        rows.append(
            {
                "baseline_path": str(baseline_fp),
                "baseline_name": baseline_run.name,
                "candidate_path": str(candidate),
                "candidate_name": candidate_run.name,
                "is_candidate": False,
                "matched_utterances": cmp.matched_rows,
                "metrics": _enrich_compare_metrics_records(
                    cmp,
                    baseline_run,
                    candidate_run,
                    include_mwa=include_mwa,
                ),
                "significance": _format_compare_significance(sig, alpha=alpha),
            }
        )
        if verbose:
            console.print(f"[green][{idx}/{len(baseline_entries)}][/green] Done: {baseline_run.name}")

    table_rows = [candidate_row, *rows]
    _render_compare_many_table(
        candidate_name=candidate_run.name,
        rows=table_rows,
        include_mwa=include_mwa,
        bootstrap=bool(significance_pairs),
    )

    if out_json is not None:
        payload = {
            "candidate": {"path": str(candidate), "name": candidate_run.name},
            "include_mwa": include_mwa,
            "candidate_row": candidate_row,
            "comparisons": rows,
        }
        out_json.parent.mkdir(parents=True, exist_ok=True)
        out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        console.print(f"Saved compare JSON: {out_json}", style="green")


@report_app.command("single", help="Generate a single-model interactive HTML report from an RESONRun JSON file.")
def report_single(
    run_json: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="RESONRun JSON file."),
    out_html: Path = typer.Option("single_report.html", "--out", "-o", help="Output HTML path."),
) -> None:
    out_html.parent.mkdir(parents=True, exist_ok=True)
    saved = RESONRun.from_json(str(run_json)).report(str(out_html))
    console.print(f"Report saved: {saved}", style="green")


@report_app.command(
    "compare",
    help="Generate compare HTML report: CANDIDATE BASELINE [BASELINE_OR_DIR ...].",
)
def report_compare(
    candidate_json: Annotated[
        Path,
        typer.Argument(
            exists=True,
            file_okay=True,
            dir_okay=False,
            readable=True,
            resolve_path=True,
            help="Candidate RESONRun JSON.",
        ),
    ],
    baselines: Annotated[
        List[Path],
        typer.Argument(help="Baseline RESONRun JSON file(s) and/or directories."),
    ],
    out_html: Path = typer.Option("model_compare_report.html", "--out", "-o", help="Output HTML path."),
    dataset_name: str = typer.Option("Dataset", "--dataset-name", "-d", help="Dataset display name."),
    dataset_description: str = typer.Option("", "--dataset-desc", help="Dataset description."),
    bootstrap: bool = typer.Option(
        False,
        "--bootstrap/--no-bootstrap",
        help="Run bootstrap resampling for statistical significance in the HTML report.",
    ),
    significance_scope: str = typer.Option(
        "primary",
        "--significance-scope",
        help="Which pairs get bootstrap with --bootstrap: primary | candidate-all | none (only --significance-pair).",
    ),
    significance_pair: List[str] = typer.Option(
        [],
        "--significance-pair",
        help="Explicit baseline:candidate pair for bootstrap (repeatable). Example: baseline_model:candidate_model",
    ),
    num_bootstraps: int = typer.Option(2000, "--bootstraps", "-b", min=1000, help="Bootstrap samples (only with --bootstrap)."),
    alpha: float = typer.Option(0.05, "--alpha", "-a", help="Significance level."),
) -> None:
    baseline_files = _resolve_paths(baselines, allowed_exts={".json"}, what="report compare baselines")
    candidate_key = str(candidate_json.resolve())
    dedup_keys = {candidate_key}
    ordered_baselines: List[Path] = []
    for fp in baseline_files:
        fp_key = str(fp.resolve())
        if fp_key not in dedup_keys:
            ordered_baselines.append(fp)
            dedup_keys.add(fp_key)
    if not ordered_baselines:
        raise typer.BadParameter(
            "report compare: provide at least one baseline JSON different from candidate."
        )

    out_html.parent.mkdir(parents=True, exist_ok=True)
    all_files = [str(candidate_json), *[str(fp) for fp in ordered_baselines]]
    reson_runs = [RESONRun.from_json(file_path) for file_path in all_files]
    model_names = [run.name for run in reson_runs]
    significance_pairs = resolve_compare_significance_pairs(
        bootstrap=bootstrap,
        model_names=model_names,
        candidate_name=model_names[0],
        primary_baseline_name=model_names[1],
        significance_scope=significance_scope,
        significance_pair_options=significance_pair,
    )
    saved = RESON(name="compare-report").compare_report(
        runs=reson_runs,
        model_names=model_names,
        output_html=str(out_html),
        dataset_name=dataset_name,
        dataset_description=dataset_description,
        base_model=model_names[1],
        target_model=model_names[0],
        significance_pairs=significance_pairs if bootstrap else None,
        num_bootstraps=compare_report_bootstraps(bootstrap, num_bootstraps),
        alpha=alpha,
    )
    console.print(f"Report saved: {saved}", style="green")


@report_app.command(
    "leaderboard",
    help="Generate standalone model podium HTML: RUN [RUN_OR_DIR ...].",
)
def report_leaderboard(
    runs: Annotated[
        List[Path],
        typer.Argument(
            help="RESONRun JSON file(s) and/or directories with runs for the same dataset.",
        ),
    ],
    out_html: Path = typer.Option(
        "leaderboard_report.html",
        "--out",
        "-o",
        help="Output HTML path.",
    ),
    dataset_name: str = typer.Option("Dataset", "--dataset-name", "-d", help="Dataset display name."),
    recursive: bool = typer.Option(
        False,
        "--recursive",
        "-r",
        help="Search directories recursively for RESONRun JSON files.",
    ),
) -> None:
    run_files = _resolve_paths(
        runs,
        allowed_exts={".json"},
        what="report leaderboard runs",
        recursive=recursive,
    )
    if len(run_files) < 2:
        raise typer.BadParameter("report leaderboard: provide at least two RESONRun JSON files.")

    dedup_keys: set[str] = set()
    ordered_files: List[Path] = []
    for fp in run_files:
        fp_key = str(fp.resolve())
        if fp_key not in dedup_keys:
            ordered_files.append(fp)
            dedup_keys.add(fp_key)

    out_html.parent.mkdir(parents=True, exist_ok=True)
    reson_runs = [RESONRun.from_json(str(file_path)) for file_path in ordered_files]
    model_names = [run.name for run in reson_runs]
    saved = RESON(name="leaderboard-report").leaderboard_report(
        runs=reson_runs,
        model_names=model_names,
        output_html=str(out_html),
        dataset_name=dataset_name,
    )
    console.print(f"Report saved: {saved}", style="green")


def _analyze_manifest_for_report(
    manifest_path: Path, reson: RESON,
    run_name: str,
    fields: List[str],
    rename_map: Dict[str, str],
    drop_columns: List[str],
    remove_punct: bool,
    lowercase: bool,
    replace_yo: bool,
    subst_table: Optional[str],
    verbose: bool = False,
    step_prefix: str = "",
) -> RESONRun:
    if verbose:
        console.print(f"[cyan]{step_prefix}Loading manifest[/cyan] {manifest_path}")
    manifest = _load_and_preprocess_manifest(
        str(manifest_path),
        source_kwargs={},
        rename_map=rename_map,
        drop_columns=drop_columns,
        fields=fields,
        remove_punct=remove_punct,
        lowercase=lowercase,
        replace_yo=replace_yo,
        subst_table=subst_table,
        context=f"pipeline ({manifest_path.name})",
    )
    if verbose:
        console.print(
            f"[cyan]{step_prefix}Preprocess[/cyan] fields={fields}, "
            f"rename_columns={list(rename_map.keys()) if rename_map else 'none'}, "
            f"drop_columns={drop_columns if drop_columns else 'none'}, "
            f"remove_punct={remove_punct}, lowercase={lowercase}, replace_yo={replace_yo}, "
            f"subst_table={subst_table}"
        )
    if verbose:
        console.print(f"[cyan]{step_prefix}Analyzing[/cyan] run_name={run_name}")
    return reson.analyze(manifest, run_name=run_name)


@pipeline_app.command(
    "single",
    help="Load manifest, normalize, analyze, render single HTML report.",
)
def pipeline_single(
    manifest: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Input manifest file."),
    out_html: Path = typer.Option("single_report.html", "--out", "-o", help="Output single HTML path."),
    save_run_json: Optional[Path] = typer.Option(None, "--save-run-json", help="Optional output path to save intermediate RESONRun JSON."),
    run_name: Optional[str] = typer.Option(None, "--name", "-n", help="Optional run name. Defaults to manifest filename."),
    meta: Optional[str] = typer.Option(None, "--meta", help="Inline run metadata as JSON object."),
    meta_file: Optional[Path] = typer.Option(
        None,
        "--meta-file",
        exists=True,
        file_okay=True,
        dir_okay=False,
        readable=True,
        resolve_path=True,
        help="Metadata JSON file.",
    ),
    metric_provider: str = typer.Option("jiwer", "--metric-provider", "-p", help="Metric provider (built-in: jiwer). Custom providers: use the Python API."),
    metrics: List[str] = typer.Option(["WER", "CER"], "--metric", "-m", help="Metrics to compute."),
    fields: List[str] = typer.Option(["text", "prediction"], "--field", "-f", help="Fields to normalize before analysis."),
    rename_columns: List[str] = typer.Option(
        [],
        "--rename-column",
        "-rc",
        help="Rename columns before normalization in OLD=NEW format. Repeat for multiple mappings.",
    ),
    drop_columns: List[str] = typer.Option(
        [],
        "--drop-column",
        "-dc",
        help="Drop columns before normalization.",
    ),
    remove_punct: bool = typer.Option(True, "--remove-punct/--no-remove-punct", help="Remove punctuation in preprocessing."),
    lowercase: bool = typer.Option(True, "--lowercase/--no-lowercase", help="Lowercase in preprocessing."),
    replace_yo: bool = typer.Option(True, "--replace-yo/--no-replace-yo", help="Replace 'ё' with 'е' in preprocessing."),
    subst_table: Optional[str] = typer.Option(None, "--subst-table", help="Path to a substitution-table .csv. Use 'none' to disable."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Print step-by-step execution log."),
) -> None:
    run_name_value = run_name or manifest.stem
    if verbose:
        console.print(
            f"[cyan]Starting pipeline single:[/cyan] manifest={manifest.name}, "
            f"provider={metric_provider}, metrics={','.join(metrics)}"
        )
    meta_payload = load_meta(meta, meta_file)
    rename_map = _parse_rename_columns(rename_columns)

    provider, metric_provider_key = resolve_metric_provider(metric_provider, metrics, replace_yo)
    if verbose:
        console.print(f"[cyan]Metric provider resolved:[/cyan] {metric_provider_key}")

    reson = RESON(
        name="pipeline-single",
        metrics=metrics,
        metric_provider=provider,
        meta=meta_payload or None,
    )
    run = _analyze_manifest_for_report(
        manifest_path=manifest, reson=reson,
        run_name=run_name_value,
        fields=fields,
        rename_map=rename_map,
        drop_columns=drop_columns,
        remove_punct=remove_punct,
        lowercase=lowercase,
        replace_yo=replace_yo,
        subst_table=subst_table,
        verbose=verbose,
    )

    if save_run_json is not None:
        save_run_json.parent.mkdir(parents=True, exist_ok=True)
        run.to_json(str(save_run_json))
        console.print(f"Saved intermediate run: {save_run_json}", style="green")

    out_html.parent.mkdir(parents=True, exist_ok=True)
    if verbose:
        console.print(f"[cyan]Generating single report[/cyan] out={out_html}")
    saved = run.report(str(out_html))
    console.print(f"Report saved: {saved}", style="green")


@pipeline_app.command(
    "compare",
    help="Load manifests, normalize, analyze, render compare HTML report.",
)
def pipeline_compare(
    candidate_manifest: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Candidate manifest file."),
    baseline_manifest: Path = typer.Argument(..., exists=True, file_okay=True, dir_okay=False, readable=True, resolve_path=True, help="Baseline manifest file."),
    additional_manifests: Annotated[Optional[List[Path]], typer.Argument(help="Additional manifest files and/or directories to include in the report.")] = None,
    out_html: Path = typer.Option("model_compare_report.html", "--out", "-o", help="Output compare HTML path."),
    save_runs_dir: Optional[Path] = typer.Option(None, "--save-runs-dir", help="Optional directory to save intermediate RESONRun JSON files."),
    dataset_name: str = typer.Option("Dataset", "--dataset-name", "-d", help="Dataset display name."),
    dataset_description: str = typer.Option("", "--dataset-desc", help="Dataset description."),
    metric_provider: str = typer.Option("jiwer", "--metric-provider", "-p", help="Metric provider (built-in: jiwer). Custom providers: use the Python API."),
    metrics: List[str] = typer.Option(["WER", "CER"], "--metric", "-m", help="Metrics to compute."),
    fields: List[str] = typer.Option(["text", "prediction"], "--field", "-f", help="Fields to normalize before analysis."),
    rename_columns: List[str] = typer.Option(
        [],
        "--rename-column",
        "-rc",
        help="Rename columns before normalization in OLD=NEW format. Repeat for multiple mappings.",
    ),
    drop_columns: List[str] = typer.Option(
        [],
        "--drop-column",
        "-dc",
        help="Drop columns before normalization.",
    ),
    remove_punct: bool = typer.Option(True, "--remove-punct/--no-remove-punct", help="Remove punctuation in preprocessing."),
    lowercase: bool = typer.Option(True, "--lowercase/--no-lowercase", help="Lowercase in preprocessing."),
    replace_yo: bool = typer.Option(True, "--replace-yo/--no-replace-yo", help="Replace 'ё' with 'е' in preprocessing."),
    subst_table: Optional[str] = typer.Option(None, "--subst-table", help="Path to a substitution-table .csv. Use 'none' to disable."),
    bootstrap: bool = typer.Option(
        False,
        "--bootstrap/--no-bootstrap",
        help="Run bootstrap resampling for statistical significance in the HTML report.",
    ),
    significance_scope: str = typer.Option(
        "primary",
        "--significance-scope",
        help="Which pairs get bootstrap with --bootstrap: primary | candidate-all | none (only --significance-pair).",
    ),
    significance_pair: List[str] = typer.Option(
        [],
        "--significance-pair",
        help="Explicit baseline:candidate pair for bootstrap (repeatable). Example: baseline_model:candidate_model",
    ),
    num_bootstraps: int = typer.Option(2000, "--bootstraps", "-b", min=1000, help="Bootstrap samples (only with --bootstrap)."),
    alpha: float = typer.Option(0.05, "--alpha", "-a", help="Significance level."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Print step-by-step execution log."),
) -> None:
    extra_files: List[Path] = []
    if additional_manifests:
        extra_files = _resolve_paths(
            additional_manifests,
            allowed_exts={".json", ".jsonl", ".csv"},
            what="pipeline compare additional manifests",
        )

    ordered_manifest_files = [baseline_manifest, candidate_manifest]
    dedup = {str(baseline_manifest.resolve()), str(candidate_manifest.resolve())}
    for fp in extra_files:
        fp_key = str(fp.resolve())
        if fp_key not in dedup:
            ordered_manifest_files.append(fp)
            dedup.add(fp_key)

    rename_map = _parse_rename_columns(rename_columns)

    if verbose:
        console.print(
            f"[cyan]Starting pipeline compare:[/cyan] candidate={candidate_manifest.name}, "
            f"baseline={baseline_manifest.name}, additional={len(ordered_manifest_files) - 2}, "
            f"provider={metric_provider}, metrics={','.join(metrics)}"
        )
    provider, metric_provider_key = resolve_metric_provider(metric_provider, metrics, replace_yo)
    if verbose:
        console.print(f"[cyan]Metric provider resolved:[/cyan] {metric_provider_key}")

    reson = RESON(name="pipeline-compare", metrics=metrics, metric_provider=provider)
    runs: List[RESONRun] = []
    model_names: List[str] = []
    for idx, manifest_fp in enumerate(ordered_manifest_files, start=1):
        run_name = manifest_fp.stem
        run = _analyze_manifest_for_report(
            manifest_path=manifest_fp, reson=reson,
            run_name=run_name,
            fields=fields,
            rename_map=rename_map,
            drop_columns=drop_columns,
            remove_punct=remove_punct,
            lowercase=lowercase,
            replace_yo=replace_yo,
            subst_table=subst_table,
            verbose=verbose,
            step_prefix=f"[{idx}/{len(ordered_manifest_files)}] ",
        )
        runs.append(run)
        model_names.append(run_name)

    if save_runs_dir is not None:
        if verbose:
            console.print(f"[cyan]Saving intermediate runs[/cyan] to {save_runs_dir}")
        save_runs_dir.mkdir(parents=True, exist_ok=True)
        saved_paths: List[str] = []
        for run, name in zip(runs, model_names):
            fp = save_runs_dir / f"{name}.json"
            run.to_json(str(fp))
            saved_paths.append(str(fp))
        console.print(f"Saved intermediate runs ({len(saved_paths)}):", style="green")
        for fp in saved_paths:
            console.print(f" - {fp}")

    out_html.parent.mkdir(parents=True, exist_ok=True)
    candidate_name = candidate_manifest.stem
    primary_baseline_name = baseline_manifest.stem
    significance_pairs = resolve_compare_significance_pairs(
        bootstrap=bootstrap,
        model_names=model_names,
        candidate_name=candidate_name,
        primary_baseline_name=primary_baseline_name,
        significance_scope=significance_scope,
        significance_pair_options=significance_pair,
    )
    if verbose:
        console.print(
            f"[cyan]Generating compare report[/cyan] out={out_html}, "
            f"bootstrap={'yes' if bootstrap else 'no'}, "
            f"bootstraps={compare_report_bootstraps(bootstrap, num_bootstraps)}, alpha={alpha}, "
            f"significance_pairs={significance_pairs or 'none'}"
        )
    saved = reson.compare_report(
        runs=runs,
        model_names=model_names,
        output_html=str(out_html),
        dataset_name=dataset_name,
        dataset_description=dataset_description,
        base_model=primary_baseline_name,
        target_model=candidate_name,
        significance_pairs=significance_pairs if bootstrap else None,
        num_bootstraps=compare_report_bootstraps(bootstrap, num_bootstraps),
        alpha=alpha,
    )
    console.print(f"Report saved: {saved}", style="green")


@app.callback()
def _main_callback(
    version: bool = typer.Option(False, "--version", help="Print version and exit.", is_eager=True),
) -> None:
    if version:
        typer.echo(__import__("reson").__version__)
        raise typer.Exit()


def main() -> None:
    app()


if __name__ == "__main__":
    main()