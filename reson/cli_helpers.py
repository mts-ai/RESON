"""Shared helpers for RESON CLI commands."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import typer

from reson import Manifest
from reson.compare_significance import (
    normalize_significance_scope,
    parse_significance_pairs,
    resolve_significance_pairs,
)


def resolve_input_paths(
    inputs: List[Path],
    *,
    allowed_exts: set[str],
    what: str,
    recursive: bool = False,
) -> List[Path]:
    resolved: List[Path] = []
    for p in inputs:
        if p.is_dir():
            file_iter = p.rglob("*") if recursive else p.iterdir()
            resolved.extend(
                sorted(
                    fp
                    for fp in file_iter
                    if fp.is_file() and fp.suffix.lower() in allowed_exts
                )
            )
        elif p.exists() and p.is_file() and p.suffix.lower() in allowed_exts:
            resolved.append(p)
        else:
            raise typer.BadParameter(
                f"{what}: path does not exist or is not supported ({p})"
            )
    if not resolved:
        raise typer.BadParameter(f"{what}: no matching files were found")
    uniq: List[Path] = []
    seen = set()
    for fp in resolved:
        key = str(fp.resolve())
        if key not in seen:
            seen.add(key)
            uniq.append(fp)
    return uniq


def subst_table_option_value(subst_table: Optional[str]) -> Optional[str]:
    if subst_table is None:
        return None
    if isinstance(subst_table, str) and subst_table.lower() == "none":
        return None
    if isinstance(subst_table, str) and subst_table.lower() == "default":
        raise typer.BadParameter(
            "No bundled substitution dictionary is available. "
            "Pass an explicit path to a .csv file or use 'none' to disable."
        )
    return subst_table


def parse_kv_options(items: List[str]) -> Dict[str, Any]:
    """
    Parse repeated --kv key=value options into a dictionary.

    Values are parsed as JSON when possible (numbers, booleans, objects, arrays),
    otherwise kept as raw strings.
    """
    parsed: Dict[str, Any] = {}
    for item in items:
        if "=" not in item:
            raise typer.BadParameter(
                f"Malformed --kv/-k value: expected key=value, got '{item}'"
            )
        key, raw_value = item.split("=", 1)
        key = key.strip()
        if not key:
            raise typer.BadParameter("Malformed --kv/-k value: key cannot be empty")

        value: Any = raw_value
        try:
            value = json.loads(raw_value)
        except json.JSONDecodeError:
            value = raw_value
        parsed[key] = value
    return parsed


def load_meta(meta: Optional[str], meta_file: Optional[Path]) -> Optional[Dict[str, Any]]:
    if meta is not None and meta_file is not None:
        raise typer.BadParameter("Use only one metadata input: --meta or --meta-file")

    if meta is not None:
        try:
            payload = json.loads(meta)
        except json.JSONDecodeError as e:
            raise typer.BadParameter(f"Invalid JSON in --meta: {e}") from e
        if not isinstance(payload, dict):
            raise typer.BadParameter("--meta must be a JSON object")
        return payload

    if meta_file is not None:
        try:
            payload = json.loads(meta_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise typer.BadParameter(f"Invalid JSON in file {meta_file}: {e}") from e
        if not isinstance(payload, dict):
            raise typer.BadParameter("--meta-file must contain a JSON object")
        return payload

    return None


def resolve_metric_provider(
    metric_provider: str,
    metrics: List[str],
    replace_yo: bool,
):
    """Resolve a built-in metric provider name for CLI usage.

    The Python API accepts any :class:`~reson.core.metrics.provider.MetricProviderABC`
    implementation directly (for example via ``RESON(metric_provider=MyProvider())``).
    """
    from reson.core.metrics.provider import JiwerMetricProvider

    del replace_yo  # reserved for preprocessing; custom providers may use it in the future

    metric_provider_key = (metric_provider or "").strip().lower()
    if metric_provider_key == "jiwer":
        return JiwerMetricProvider(metrics=metrics), metric_provider_key
    raise typer.BadParameter(
        f"Unknown metric provider: {metric_provider}. "
        "Built-in CLI provider: jiwer. "
        "For custom providers, pass a MetricProviderABC instance via the Python API."
    )


def normalize_manifest_inplace(
    manifest: Manifest,
    *,
    fields: List[str],
    remove_punct: bool,
    lowercase: bool,
    replace_yo: bool,
    subst_table: Optional[str],
) -> None:
    manifest.normalize(
        fields=fields,
        remove_punct=remove_punct,
        lowercase=lowercase,
        replace_yo=replace_yo,
        subst_table=subst_table_option_value(subst_table),
        inplace=True,
    )


def compare_report_bootstraps(bootstrap: bool, num_bootstraps: int) -> int:
    """Return bootstrap iteration count for compare HTML (0 = skip significance)."""
    if not bootstrap:
        return 0
    return max(int(num_bootstraps), 1)


def resolve_compare_significance_pairs(
    *,
    bootstrap: bool,
    model_names: List[str],
    candidate_name: str,
    primary_baseline_name: Optional[str],
    significance_scope: str,
    significance_pair_options: List[str],
) -> List[tuple[str, str]]:
    """Resolve bootstrap pairs for compare commands; empty when bootstrap is disabled."""
    if not bootstrap:
        return []

    try:
        scope = normalize_significance_scope(significance_scope)
        explicit_pairs = parse_significance_pairs(significance_pair_options)
        pairs = resolve_significance_pairs(
            model_names,
            candidate_name=candidate_name,
            primary_baseline_name=primary_baseline_name,
            scope=scope,
            explicit_pairs=explicit_pairs or None,
        )
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc

    if not pairs:
        raise typer.BadParameter(
            "No significance pairs resolved. Use --significance-scope "
            "(primary | candidate-all | none) and/or --significance-pair BASE:TARGET."
        )
    return pairs
