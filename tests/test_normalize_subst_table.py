"""Tests for substitution-table normalization."""

from __future__ import annotations

import pytest

from reson.cli_helpers import subst_table_option_value
from reson.core.text.normalize import TextNormalizer, _normalize_vocab_mapping


def test_subst_table_option_value_none_sentinel():
    assert subst_table_option_value(None) is None
    assert subst_table_option_value("none") is None
    assert subst_table_option_value("NONE") is None


def test_subst_table_option_value_rejects_default():
    with pytest.raises(Exception, match="No bundled substitution dictionary"):
        subst_table_option_value("default")


def test_empty_target_row_means_delete_variants():
    vocab = _normalize_vocab_mapping({"": ["uh", "um"], "hello": ["hi"]})
    assert vocab[""] == ["uh", "um"]
    assert vocab["hello"] == ["hi"]


def test_empty_target_variants_are_applied_by_normalizer(tmp_path):
    csv_path = tmp_path / "subst.csv"
    csv_path.write_text(";uh;um\nhello;hi\n", encoding="utf-8")

    normalizer = TextNormalizer(subst_table=str(csv_path))
    normalizer.fit()

    assert normalizer.variant2target["uh"] == ""
    assert normalizer.variant2target["um"] == ""
    assert normalizer.variant2target["hi"] == "hello"

    transformed = normalizer.transform_series(
        __import__("pandas").Series(["please uh hello hi"]),
        field_name="text",
    )
    assert transformed.iloc[0] == "please  hello hello"


def test_default_subst_table_is_disabled_without_path():
    normalizer = TextNormalizer()
    normalizer.fit()
    assert normalizer.variant2target == {}
    assert normalizer._pattern is None


def test_default_sentinel_raises_when_explicitly_requested():
    normalizer = TextNormalizer(subst_table="default")
    with pytest.raises(ValueError, match="No bundled substitution dictionary"):
        normalizer.fit()
