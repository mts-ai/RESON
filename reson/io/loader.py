"""Manifest source loaders for local JSON/JSONL and CSV files."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Iterable, List
import json

import pandas as pd


ManifestRecords = List[Dict[str, Any]]


class DataSourceAdapter(ABC):
    """Source adapter interface."""

    @abstractmethod
    def can_handle(self, source: str) -> bool:
        """Check if the adapter can handle the given source."""
        raise NotImplementedError

    @abstractmethod
    def load(self, source: str, **kwargs: Any) -> ManifestRecords:
        """Strategy how to load the data from the source."""
        raise NotImplementedError


class JsonlLoader(DataSourceAdapter):
    """Load manifests from JSONL or JSON array/object files."""

    def can_handle(self, source: str) -> bool:
        return source.endswith(".jsonl") or source.endswith(".json")

    def load(self, source: str, **kwargs: Any) -> ManifestRecords:
        records: ManifestRecords = []
        fp = Path(source)
        with fp.open("r", encoding="utf-8") as f:
            raw = f.read().strip()
            if not raw:
                return []
            # Support both json lines and pure json arrays.
            if raw.startswith("["):
                payload = json.loads(raw)
                if not isinstance(payload, list):
                    raise ValueError(f"{source} must contain a JSON array or JSONL records")
                records = [dict(x) for x in payload]
            else:
                for line in raw.splitlines():
                    records.append(dict(json.loads(line)))
        return records


class CsvLoader(DataSourceAdapter):
    """Load manifests from CSV files."""

    def can_handle(self, source: str) -> bool:
        return source.endswith(".csv")

    def load(self, source: str, **kwargs: Any) -> ManifestRecords:
        return pd.read_csv(source).to_dict(orient="records")


class LoaderRegistry:
    """Select the first adapter that can handle a source path."""

    def __init__(self, loaders: Iterable[DataSourceAdapter]):
        self.loaders = list(loaders)

    def load(self, source: str, **kwargs: Any) -> ManifestRecords:
        for loader in self.loaders:
            if loader.can_handle(source):
                return loader.load(source, **kwargs)
        raise ValueError(f"No loader found for source: {source}")


def default_registry() -> LoaderRegistry:
    """Return the default OSS loader registry (JSON/JSONL and CSV)."""
    return LoaderRegistry(
        [
            JsonlLoader(),
            CsvLoader(),
        ]
    )
