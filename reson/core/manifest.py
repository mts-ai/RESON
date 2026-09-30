"""
Core manifest abstraction for RESON.

Provides loading, normalization, sampling, splitting and statistics over
NeMo-like JSON Lines manifests.
"""

import json
from pathlib import Path
from typing import List, Dict, TypeVar, Any, Optional, Tuple
import pandas as pd
import random

from reson.core.stats import Vocab, ManifestSummary, ReplaceVocabStats, Alphabet
from reson.core.text.normalize import TextNormalizer
from reson.io.loader import default_registry

_Manifest = TypeVar("_Manifest")


class Manifest:
    """
    Main RESON component for working with manifests.

    Features:
    - loading from local JSON/JSONL and CSV files
    - normalization of selected text fields
    - statistics for duration/words/alphabet
    - splitting into train/test, sampling, concatenation
    """

    def __init__(
        self,
        manifest: List[Dict[str, Any]],
        stats: Optional[ManifestSummary] = None,
    ):
        self.manifest: List[Dict[str, Any]] = manifest
        self._df_cache: Optional[pd.DataFrame] = None
        self._stats: Optional[ManifestSummary] = stats
        self._stats_dirty: bool = stats is None
        self._replace_stats_state: Optional[ReplaceVocabStats] = (
            stats.replace_stats if stats is not None else None
        )
        self._normalized_state: bool = bool(stats.normalized) if stats is not None else False
        self._normalized_cfg_state: Dict[str, Any] = (
            dict(stats.normalized_cfg) if stats is not None else {}
        )

    def _ensure_df_cache(self) -> pd.DataFrame:
        if self._df_cache is None:
            self._df_cache = pd.DataFrame(self.manifest)
        return self._df_cache

    def _ensure_stats(self) -> ManifestSummary:
        if self._stats is None or self._stats_dirty:
            self._stats = self._build_stats(self._ensure_df_cache())
            self._stats_dirty = False
        return self._stats

    def _build_stats(
        self,
        df: pd.DataFrame,
        *,
        replace_stats: Optional[ReplaceVocabStats] = None,
        normalized: Optional[bool] = None,
        normalized_cfg: Optional[Dict[str, Any]] = None,
    ) -> ManifestSummary:
        """Build fresh ManifestSummary for a dataframe with current flags by default."""
        return ManifestSummary.from_dataframe(
            df=df,
            replace_stats=replace_stats if replace_stats is not None else self._replace_stats_state,
            normalized=normalized if normalized is not None else self._normalized_state,
            normalized_cfg=normalized_cfg if normalized_cfg is not None else self._normalized_cfg_state,
        )

    def _from_df(
        self,
        df: pd.DataFrame,
        *,
        inplace: bool = False,
        replace_stats: Optional[ReplaceVocabStats] = None,
        normalized: Optional[bool] = None,
        normalized_cfg: Optional[Dict[str, Any]] = None,
    ) -> _Manifest:
        """Return new manifest (or mutate self) with invalidated lazy caches."""
        next_replace_stats = replace_stats if replace_stats is not None else self._replace_stats_state
        next_normalized = normalized if normalized is not None else self._normalized_state
        next_normalized_cfg = (
            dict(normalized_cfg) if normalized_cfg is not None else dict(self._normalized_cfg_state)
        )
        next_df = df.copy()
        if inplace:
            self._df_cache = next_df
            self.manifest = next_df.to_dict("records")
            self._replace_stats_state = next_replace_stats
            self._normalized_state = next_normalized
            self._normalized_cfg_state = next_normalized_cfg
            self._stats = None
            self._stats_dirty = True
            return self
        obj = self.__class__(manifest=next_df.to_dict("records"), stats=None)
        obj._df_cache = next_df
        obj._replace_stats_state = next_replace_stats
        obj._normalized_state = next_normalized
        obj._normalized_cfg_state = next_normalized_cfg
        obj._stats = None
        obj._stats_dirty = True
        return obj

    @property
    def vocab(self) -> Vocab:
        return self._ensure_stats().vocab

    @property
    def alphabet(self) -> Alphabet:
        return self._ensure_stats().alphabet

    @property
    def summary(self) -> Dict[str, Any]:
        return self._ensure_stats().summary

    @property
    def normalized(self) -> bool:
        return self._normalized_state

    @property
    def normalized_cfg(self) -> Dict[str, Any]:
        return dict(self._normalized_cfg_state)

    @property
    def replacements(self) -> Dict[str, List[str]]:
        return self._replace_stats_state

    @property
    def stats(self) -> ManifestSummary:
        return self._ensure_stats()

    @classmethod
    def load_from(cls: _Manifest, source: str, **kwargs: Any) -> _Manifest:
        """Automatically detect source and load manifest from path/clearml_id/customer_id."""
        return cls(default_registry().load(source, **kwargs))
        
    def to_json(self, output_fp: str) -> None:
        """
        Save manifest to a JSON Lines file.
        Args:
            manifest_fp: str - output path for the JSON Lines file
        Returns:
            None
        """
        Path(output_fp).parent.mkdir(exist_ok=True, parents=True)
        with open(output_fp, "w", encoding="utf-8") as f:
            for s in self.manifest:
                json.dump(s, f, ensure_ascii=False)
                f.write("\n")

    def to_csv(self, output_fp: str) -> None:
        """
        Save manifest to a CSV file.
        Args:
            manifest_fp: str - output path for the CSV file
        Returns:
            None
        """
        Path(output_fp).parent.mkdir(exist_ok=True, parents=True)
        self.to_df().to_csv(output_fp, index=False)


    def head(self, n: int = 5) -> pd.DataFrame:
        """
        Show the first N records as a DataFrame.
        Args:
            n: int - number of rows to show
        Returns:
            Subset as a pandas DataFrame
        """
        return self.to_df().head(n)

    def rename(self, mapping: Dict[str, str], inplace: bool = False) -> _Manifest:
        """
        Rename manifest keys (columns) according to a mapping.
        Args:
            mapping: Dict[str, str] - replacements as {original_name: new_name}
            inplace: bool - modify current manifest or return a new one
        Returns:
            Updated Manifest instance
        """
        df = self.to_df().rename(columns=mapping)
        return self._from_df(df, inplace=inplace)

    def select_columns(self, columns: str | List[str]) -> _Manifest:
        """
        Select only the specified columns from the manifest.
        Args:
            columns: str | List[str] - column name or list of names to keep
        Returns:
            Manifest containing only the specified columns
        """
        if isinstance(columns, str):
            columns = [columns]
        df = self.to_df()[columns]
        return self._from_df(df, inplace=False)

    def drop(self, columns: str | List[str]) -> _Manifest:
        """
        Drop the specified columns from the manifest.
        Args:
            columns: str | List[str] - column name or list of names to drop
        Returns:
            Manifest containing only the specified columns
        """
        if isinstance(columns, str):
            columns = [columns]
        df = self.to_df().drop(columns=columns)
        return self._from_df(df, inplace=False)

    def normalize(
        self,
        fields: str | List[str],
        remove_punct: bool = True,
        lowercase: bool = True,
        replace_yo: bool = True,
        subst_table: Dict[str, List[str]] | Path | str | None = None,
        inplace: bool = False,
    ) -> _Manifest:
        """
        Normalize selected fields:
        1) remove punctuation
        2) lowercase
        3) apply replacement dictionary (variant -> target)
        4) replace 'ё' with 'е'

        Args:
            fields: str | List[str] - field name or list of field names to normalize
            remove_punct: bool - remove punctuation
            lowercase: bool - convert to lowercase
            replace_yo: bool - replace 'ё' to 'е'
            subst_table: Dict[str, List[str]] | Path | str | None - replacement vocabulary
                mapping, path to a `.csv` file, or `None` to skip dictionary replacements
        Returns:
            Normalized Manifest instance
        """
        if isinstance(fields, str):
            fields = [fields]

        normalizer_cfg = dict(
            remove_punct=remove_punct,
            lowercase=lowercase,
            replace_yo=replace_yo,
            subst_table=subst_table,
        )

        normalizer = TextNormalizer(**normalizer_cfg)
        df = normalizer.fit_transform(self.to_df(), fields)

        return self._from_df(
            df,
            inplace=inplace,
            replace_stats=normalizer.stats,
            normalized=True,
            normalized_cfg=normalizer.config,
        )

    def train_test_split(
        self,
        test_size: float,
        random_state: int = 42,
        shuffle: bool = True,
        stratify: Optional[object] = None,
    ) -> Tuple[_Manifest]:
        """
        Split the manifest into train and test Manifests.

        Args:
            test_size:  float - fraction of data to allocate to the test set
            random_state: int -  seed controlling shuffling for reproducibility
            shuffle: bool -  whether to shuffle before split
            stratify: Optional[array-like] - column/array to preserve distribution across splits
        Returns:
            A tuple of (train_manifest, test_manifest)
        """
        df = self.to_df()
        if not 0 < test_size < 1:
            raise ValueError("test_size должен быть в диапазоне (0, 1)")
        if len(df) < 2:
            raise ValueError("Для split требуется минимум 2 записи")

        # Используем train_test_split из sklearn для простого и корректного разбиения
        from sklearn.model_selection import train_test_split

        # Для stratify надо передать Series, а не просто название колонки
        stratify_vals = None
        if stratify is not None and stratify in df.columns:
            stratify_vals = df[stratify]
        X_train, X_test = train_test_split(
            df,
            test_size=test_size,
            random_state=random_state,
            shuffle=shuffle,
            stratify=stratify_vals,
        )
        # train
        m_tr = self._from_df(X_train, inplace=False)
        # test
        m_te = self._from_df(X_test, inplace=False)
        return (m_tr, m_te)

    def replace(
        self,
        columns: str | List[str],
        source: str | List[str],
        target: str | List[str],
        inplace: bool = False,
    ) -> _Manifest:
        """Replace occurrences of source strings with target strings in columns.

        Args:
            columns: str | List[str] - column name(s) where replacement should occur
            source: str | List[str] - string(s) to be replaced
            target: str | List[str] - replacement string(s)
            inplace: bool - modify current manifest or return a new one
        Returns:
            Updated Manifest instance
        """
        df = pd.DataFrame(self.manifest).copy()
        if isinstance(columns, str):
            columns = [columns]
        if isinstance(source, str):
            source = [source]
        if isinstance(target, str):
            target = [target]

        for col in columns:
            if col in df.columns:
                for src, dst in zip(source, target):
                    df[col] = df[col].str.replace(src, dst, regex=False)
        return self._from_df(df, inplace=inplace)

    def sample(
        self, n: int | float, shuffle: bool = False, random_seed: Optional[int] = None
    ) -> _Manifest:
        total = len(self.manifest)
        if isinstance(n, float):
            if not (0 < n < 1):
                raise ValueError(
                    f"Parameter n={n} as float must be in the range (0, 1)"
                )
            count = int(total * n)
            count = max(count, 1)
        elif isinstance(n, int):
            count = n
        else:
            raise TypeError("n must be of type int or float")
        idxs = list(range(total))
        if shuffle:
            if random_seed is not None:
                random.seed(random_seed)
            random.shuffle(idxs)
        count = min(count, total)
        samples = [self.manifest[i] for i in idxs[:count]]

        return self._from_df(pd.DataFrame(samples), inplace=False)

    def to_df(self) -> pd.DataFrame:
        return self._ensure_df_cache().copy()

    def __add__(self, other):
        if not isinstance(other, self.__class__):
            return NotImplemented
        merged_manifest = self.manifest + other.manifest
        return self.__class__(manifest=merged_manifest)

    def __radd__(self, other):
        if other == 0:
            return self
        return self.__add__(other)

    def __len__(self) -> int:
        return len(self.manifest)

    def __str__(self) -> str:
        return str(self.manifest)

    def __iter__(self):
        return iter(self.manifest)

    def __getitem__(self, idx):
        if isinstance(idx, slice):
            slice_manifest = self.manifest[idx]
            return self._from_df(pd.DataFrame(slice_manifest), inplace=False)
        else:
            return self.manifest[idx]
