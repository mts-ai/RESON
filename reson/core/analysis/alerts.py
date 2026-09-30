"""Alert analysis for RESON report.

Computes lightweight data-quality and sanity alerts from manifest, metrics and vocab.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class Alert:
    code: str
    message: str
    severity: str  # "info" | "warning" | "error"
    entity: str  # "manifest" | "vocab" | "metrics"
    kind: str  # UI badge type
    data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if not d.get("data"):
            d.pop("data", None)
        return d


@dataclass
class AlertThresholds:
    missing_rate_warn: float = 0.05
    high_wer_threshold: float = 40.0
    high_wer_share_warn: float = 0.05
    zero_wer_share_warn: float = 0.90
    vocab_coverage_threshold: float = 80.0
    rare_threshold: int = 2
    rare_share_warn: float = 0.80
    duration_type_imbalance_thr: float = 0.70
    min_duration_warn: float = 0.5
    max_duration_warn: float = 60.0
    text_length_diff_threshold: float = 0.5
    min_vocab_size: int = 100
    wer_skew_threshold: float = 1.0
    top_wer_percentile: float = 0.10
    error_concentration_threshold: float = 0.70


@dataclass
class AlertContext:
    manifest: pd.DataFrame
    vocab_df: Optional[pd.DataFrame]
    metrics_df: Optional[pd.DataFrame]
    thresholds: AlertThresholds


class AlertRule(ABC):
    """Одна бизнес-проверка, возвращающая список alert-ов."""

    name: str = "unnamed_rule"

    @abstractmethod
    def evaluate(self, context: AlertContext) -> List[Alert]:
        """Return alerts produced by this rule."""


class RequiredColumnsRule(AlertRule):
    name = "required_columns"

    def __init__(self, required_cols: Sequence[str] | None = None) -> None:
        self.required_cols = tuple(
            required_cols or ("audio_filepath", "text", "prediction", "duration", "duration_type")
        )

    def evaluate(self, context: AlertContext) -> List[Alert]:
        missing_cols = [c for c in self.required_cols if c not in context.manifest.columns]
        if not missing_cols:
            return []
        return [
            Alert(
                code="manifest.missing_columns",
                message=f"Отсутствуют обязательные колонки: {', '.join(missing_cols)}",
                severity="error",
                entity="manifest",
                kind="Missing Values",
                data={"missing": missing_cols},
            )
        ]


class DuplicateAudioRule(AlertRule):
    name = "duplicate_audio"

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if "audio_filepath" not in context.manifest.columns:
            return []
        dup_cnt = int(context.manifest.duplicated(subset=["audio_filepath"]).sum())
        if dup_cnt <= 0:
            return []
        return [
            Alert(
                code="manifest.duplicates",
                message=f"Дублирующиеся пути к аудио: {dup_cnt}",
                severity="warning",
                entity="manifest",
                kind="Duplicates",
                data={"count": dup_cnt},
            )
        ]


class EmptyTextPredictionRule(AlertRule):
    name = "empty_text_prediction"

    def evaluate(self, context: AlertContext) -> List[Alert]:
        out: List[Alert] = []
        for col in ("text", "prediction"):
            if col not in context.manifest.columns:
                continue
            s = context.manifest[col]
            empty_mask = s.isna() | (s.astype(str).str.strip() == "")
            rate = float(empty_mask.mean())
            if rate >= context.thresholds.missing_rate_warn:
                out.append(
                    Alert(
                        code=f"manifest.missing_{col}",
                        message=f"Доля пустых значений в '{col}' = {rate:.1%}",
                        severity="warning",
                        entity="manifest",
                        kind="Empty strings",
                        data={"missing_share": rate},
                    )
                )
        return out


class TextLengthMismatchRule(AlertRule):
    name = "text_length_mismatch"

    def __init__(self, min_share: float = 0.05) -> None:
        self.min_share = float(min_share)

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if not {"text", "prediction"}.issubset(context.manifest.columns):
            return []

        def _text_len(v: Any) -> int:
            return len(str(v or "").strip())

        def _rel_diff(t_len: int, p_len: int) -> float:
            if t_len == 0 and p_len == 0:
                return 0.0
            if t_len == 0:
                return 1.0
            return abs(t_len - p_len) / t_len

        text_lens = context.manifest["text"].apply(_text_len)
        pred_lens = context.manifest["prediction"].apply(_text_len)
        rel_diffs = pd.Series(
            [_rel_diff(t, p) for t, p in zip(text_lens, pred_lens)],
            index=context.manifest.index,
        )
        high_diff_mask = rel_diffs >= context.thresholds.text_length_diff_threshold
        high_diff_count = int(high_diff_mask.sum())
        if high_diff_count <= 0:
            return []

        high_diff_share = float(high_diff_count / len(context.manifest))
        if high_diff_share < self.min_share:
            return []
        return [
            Alert(
                code="text.length_mismatch",
                message=(
                    f"Большая разница длин text и prediction "
                    f"(>={context.thresholds.text_length_diff_threshold:.0%}): "
                    f"{high_diff_count} ({high_diff_share:.1%})"
                ),
                severity="warning",
                entity="manifest",
                kind="Length mismatch",
                data={
                    "count": high_diff_count,
                    "share": high_diff_share,
                    "threshold": context.thresholds.text_length_diff_threshold,
                },
            )
        ]


class DurationRule(AlertRule):
    name = "duration"

    def __init__(self, min_share: float = 0.05) -> None:
        self.min_share = float(min_share)

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if "duration" not in context.manifest.columns:
            return []
        out: List[Alert] = []
        durations = pd.to_numeric(context.manifest["duration"], errors="coerce")

        nonpos = int((durations <= 0).sum())
        if nonpos > 0:
            out.append(
                Alert(
                    code="manifest.duration_nonpositive",
                    message=f"Найдены записи с некорректной длительностью (<=0): {nonpos}",
                    severity="warning",
                    entity="manifest",
                    kind="Duration",
                    data={"count": nonpos},
                )
            )

        valid = durations[durations > 0]
        if valid.empty:
            return out

        too_short = int((valid < context.thresholds.min_duration_warn).sum())
        if too_short > 0:
            share_short = float(too_short / len(valid))
            if share_short >= self.min_share:
                out.append(
                    Alert(
                        code="duration.too_short",
                        message=(
                            f"Найдены записи с очень короткой длительностью "
                            f"(<{context.thresholds.min_duration_warn}с): "
                            f"{too_short} ({share_short:.1%})"
                        ),
                        severity="warning",
                        entity="manifest",
                        kind="Duration",
                        data={
                            "count": too_short,
                            "share": share_short,
                            "threshold": context.thresholds.min_duration_warn,
                        },
                    )
                )

        too_long = int((valid > context.thresholds.max_duration_warn).sum())
        if too_long > 0:
            share_long = float(too_long / len(valid))
            if share_long >= self.min_share:
                out.append(
                    Alert(
                        code="duration.too_long",
                        message=(
                            f"Найдены записи с очень длинной длительностью "
                            f"(>{context.thresholds.max_duration_warn}с): "
                            f"{too_long} ({share_long:.1%})"
                        ),
                        severity="info",
                        entity="manifest",
                        kind="Duration",
                        data={
                            "count": too_long,
                            "share": share_long,
                            "threshold": context.thresholds.max_duration_warn,
                        },
                    )
                )
        return out


class WerDistributionRule(AlertRule):
    name = "wer_distribution"

    def __init__(self, outlier_share_warn: float = 0.05) -> None:
        self.outlier_share_warn = float(outlier_share_warn)

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if "WER" not in context.manifest.columns:
            return []
        out: List[Alert] = []
        wers = pd.to_numeric(context.manifest["WER"], errors="coerce")
        valid_wers = wers.dropna()
        if valid_wers.empty:
            return out

        share_high = float((valid_wers >= context.thresholds.high_wer_threshold).mean())
        if share_high >= context.thresholds.high_wer_share_warn:
            out.append(
                Alert(
                    code="wer.high_share",
                    message=(
                        f"Высокий WER (>= {context.thresholds.high_wer_threshold:.0f}) "
                        f"встречается в {share_high:.1%}"
                    ),
                    severity="warning",
                    entity="manifest",
                    kind="Suspect metrics",
                    data={
                        "threshold": context.thresholds.high_wer_threshold,
                        "share": share_high,
                    },
                )
            )

        share_zero = float((valid_wers == 0).mean())
        if share_zero >= context.thresholds.zero_wer_share_warn:
            out.append(
                Alert(
                    code="wer.zero_dominated",
                    message=f"Слишком много идеальных распознаваний (WER=0): {share_zero:.1%}",
                    severity="warning",
                    entity="manifest",
                    kind="Suspect metrics",
                    data={"share": share_zero},
                )
            )

        q1, q3 = valid_wers.quantile(0.25), valid_wers.quantile(0.75)
        iqr = q3 - q1
        if pd.notna(iqr) and float(iqr) > 0:
            upper = q3 + 1.5 * iqr
            lower = q1 - 1.5 * iqr
            out_share = float(((valid_wers > upper) | (valid_wers < lower)).mean())
            if out_share >= self.outlier_share_warn:
                out.append(
                    Alert(
                        code="wer.outliers_iqr",
                        message=f"Обнаружены выбросы WER по правилу IQR: {out_share:.1%}",
                        severity="info",
                        entity="manifest",
                        kind="Outliers",
                        data={"share": out_share},
                    )
                )

        if len(valid_wers) > 2:
            skewness = float(valid_wers.skew())
            if abs(skewness) >= context.thresholds.wer_skew_threshold:
                direction = "правосторонняя" if skewness > 0 else "левосторонняя"
                out.append(
                    Alert(
                        code="wer.high_skewness",
                        message=f"Сильная асимметрия распределения WER ({direction}): {skewness:.2f}",
                        severity="info",
                        entity="manifest",
                        kind="Distribution",
                        data={"skewness": skewness, "direction": direction},
                    )
                )
        return out


class DurationTypeImbalanceRule(AlertRule):
    name = "duration_type_imbalance"

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if "duration_type" not in context.manifest.columns:
            return []
        freq = context.manifest["duration_type"].value_counts(normalize=True)
        if freq.empty:
            return []
        top_type = str(freq.index[0])
        top_share = float(freq.iloc[0])
        if top_share < context.thresholds.duration_type_imbalance_thr:
            return []
        return [
            Alert(
                code="duration_type.imbalance",
                message=f"Дисбаланс типов длительности: '{top_type}' = {top_share:.1%}",
                severity="info",
                entity="manifest",
                kind="Imbalance",
                data={"type": top_type, "share": top_share},
            )
        ]


class MetricsPresenceRule(AlertRule):
    name = "metrics_presence"

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if context.metrics_df is None or context.metrics_df.empty:
            return [
                Alert(
                    code="metrics.empty",
                    message="Таблица метрик пуста",
                    severity="warning",
                    entity="metrics",
                    kind="Empty",
                )
            ]

        if hasattr(context.metrics_df, "columns") and "name" in context.metrics_df.columns:
            metrics_names = set(context.metrics_df["name"].astype(str))
        else:
            metrics_names = set(str(i) for i in context.metrics_df.index)
        if "WER" in metrics_names:
            return []
        return [
            Alert(
                code="metrics.missing_wer",
                message="Метрика WER отсутствует в таблице метрик",
                severity="warning",
                entity="metrics",
                kind="Empty",
            )
        ]


class VocabQualityRule(AlertRule):
    name = "vocab_quality"

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if context.vocab_df is None or context.vocab_df.empty:
            return []
        out: List[Alert] = []
        vocab_size = len(context.vocab_df)
        if vocab_size < context.thresholds.min_vocab_size:
            out.append(
                Alert(
                    code="vocab.too_small",
                    message=(
                        f"Словарь слишком маленький: {vocab_size} слов "
                        f"(минимум: {context.thresholds.min_vocab_size})"
                    ),
                    severity="warning",
                    entity="vocab",
                    kind="Vocabulary size",
                    data={
                        "vocab_size": vocab_size,
                        "min_size": context.thresholds.min_vocab_size,
                    },
                )
            )

        if "recall" in context.vocab_df.columns:
            recall = pd.to_numeric(context.vocab_df["recall"], errors="coerce").dropna()
            if not recall.empty:
                mean_recall = float(recall.mean())
                if mean_recall < context.thresholds.vocab_coverage_threshold:
                    out.append(
                        Alert(
                            code="vocab.low_coverage",
                            message=(
                                f"Низкое среднее покрытие словаря (recall): {mean_recall:.1f}% "
                                f"(порог: {context.thresholds.vocab_coverage_threshold:.1f}%)"
                            ),
                            severity="warning",
                            entity="vocab",
                            kind="Coverage",
                            data={
                                "mean_recall": mean_recall,
                                "threshold": context.thresholds.vocab_coverage_threshold,
                            },
                        )
                    )

        if "count" in context.vocab_df.columns:
            counts = pd.to_numeric(context.vocab_df["count"], errors="coerce").dropna()
            if not counts.empty:
                rare_share = float((counts <= context.thresholds.rare_threshold).mean())
                if rare_share >= context.thresholds.rare_share_warn:
                    out.append(
                        Alert(
                            code="vocab.rare_dominance",
                            message=(
                                f"Высокая доля редких слов (count <= {context.thresholds.rare_threshold}): "
                                f"{rare_share:.1%}"
                            ),
                            severity="info",
                            entity="vocab",
                            kind="Coverage",
                            data={
                                "share": rare_share,
                                "threshold": context.thresholds.rare_share_warn,
                                "rare_threshold": context.thresholds.rare_threshold,
                            },
                        )
                    )
        return out


class HesitationRule(AlertRule):
    name = "hesitations"

    def __init__(self, warn_share: float = 0.05) -> None:
        self.warn_share = float(warn_share)
        self.hes_tokens = {
            "э",
            "ээ",
            "эээ",
            "ээээ",
            "эм",
            "мм",
            "м-м",
            "м-м-м",
            "э-э",
            "э-э-э",
            "аа",
            "ааа",
            "а-а",
            "а-а-а",
            "значит",
            "значит-значит",
            "хм",
            "хмм",
            "хм-хм",
            "гм",
            "гмм",
            "гм-гм",
            "а",
            "угу",
            "угу-угу",
            "ага",
            "ага-ага",
        }

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if "text" not in context.manifest.columns:
            return []

        def _hes_cnt(val: Any) -> int:
            words = str(val or "").lower().split()
            return sum(1 for w in words if w in self.hes_tokens)

        total_words = int(
            context.manifest["text"].fillna("").apply(lambda s: len(str(s).split())).sum() or 0
        )
        if total_words <= 0:
            return []
        hes_count = int(context.manifest["text"].apply(_hes_cnt).sum() or 0)
        share_hes = float(hes_count / total_words)
        if share_hes < self.warn_share:
            return []
        return [
            Alert(
                code="text.hesitation_high",
                message=f"Высокая доля хезитаций в тексте: {share_hes:.1%}",
                severity="info",
                entity="manifest",
                kind="Hesitations",
                data={"share": share_hes},
            )
        ]


class ErrorConcentrationRule(AlertRule):
    name = "error_concentration"

    def __init__(self, duration_type_share_warn: float = 0.40) -> None:
        self.duration_type_share_warn = float(duration_type_share_warn)

    def evaluate(self, context: AlertContext) -> List[Alert]:
        if not {"INS", "DEL", "SUB"}.issubset(context.manifest.columns):
            return []
        out: List[Alert] = []
        df_e = context.manifest.copy()
        for c in ("INS", "DEL", "SUB"):
            df_e[c] = pd.to_numeric(df_e[c], errors="coerce").fillna(0)
        total_err = float(df_e[["INS", "DEL", "SUB"]].sum().sum() or 0)
        if total_err <= 0:
            return out

        if "duration_type" in df_e.columns:
            short_ins = float(df_e.loc[df_e["duration_type"] == "short", "INS"].sum() or 0)
            share_short_ins = short_ins / total_err
            if share_short_ins >= self.duration_type_share_warn:
                out.append(
                    Alert(
                        code="errors.short_ins_dominance",
                        message=f"Вставки на коротких записях составляют {share_short_ins:.1%} всех ошибок",
                        severity="info",
                        entity="manifest",
                        kind="Insertions",
                        data={"share": share_short_ins},
                    )
                )

            long_del = float(df_e.loc[df_e["duration_type"] == "long", "DEL"].sum() or 0)
            share_long_del = long_del / total_err
            if share_long_del >= self.duration_type_share_warn:
                out.append(
                    Alert(
                        code="errors.long_del_dominance",
                        message=f"Удаления на длинных записях составляют {share_long_del:.1%} всех ошибок",
                        severity="info",
                        entity="manifest",
                        kind="Deletions",
                        data={"share": share_long_del},
                    )
                )

            long_ins = float(df_e.loc[df_e["duration_type"] == "long", "INS"].sum() or 0)
            share_long_ins = long_ins / total_err
            if share_long_ins >= self.duration_type_share_warn:
                out.append(
                    Alert(
                        code="errors.long_ins_dominance",
                        message=f"Вставки на длинных записях составляют {share_long_ins:.1%} всех ошибок",
                        severity="info",
                        entity="manifest",
                        kind="Insertions",
                        data={"share": share_long_ins},
                    )
                )

        if "WER" in df_e.columns:
            wers = pd.to_numeric(df_e["WER"], errors="coerce")
            valid = wers.dropna()
            if not valid.empty:
                n_top = max(1, int(len(df_e) * context.thresholds.top_wer_percentile))
                top_idx = valid.nlargest(n_top).index
                error_types = {"INS": "вставок", "DEL": "удалений", "SUB": "замен"}
                for err_type, err_name in error_types.items():
                    total_errors = float(df_e[err_type].sum() or 0)
                    if total_errors <= 0:
                        continue
                    top_errors = float(df_e.loc[top_idx, err_type].sum() or 0)
                    err_share = top_errors / total_errors
                    if err_share >= context.thresholds.error_concentration_threshold:
                        out.append(
                            Alert(
                                code=f"errors.top_wer_{err_type.lower()}_concentration",
                                message=(
                                    f"Топ-{context.thresholds.top_wer_percentile:.0%} записей "
                                    f"с высоким WER содержат {err_share:.1%} всех {err_name}"
                                ),
                                severity="warning",
                                entity="manifest",
                                kind=err_type,
                                data={
                                    "share": err_share,
                                    "top_percentile": context.thresholds.top_wer_percentile,
                                    "total_errors": total_errors,
                                    "top_errors": top_errors,
                                },
                            )
                        )
        return out


class CorrelationRule(AlertRule):
    name = "correlation"

    def __init__(self, min_corr: float = 0.30) -> None:
        self.min_corr = float(min_corr)

    def evaluate(self, context: AlertContext) -> List[Alert]:
        num_cols = [c for c in ("duration", "WER", "INS", "DEL", "SUB") if c in context.manifest.columns]
        if len(num_cols) < 2:
            return []
        corr = (
            context.manifest[num_cols]
            .apply(pd.to_numeric, errors="coerce")
            .corr(method="pearson")
            .abs()
        )
        pairs = []
        for i, a in enumerate(num_cols):
            for j, b in enumerate(num_cols):
                if j <= i:
                    continue
                val = float(corr.loc[a, b]) if a in corr.index and b in corr.columns else 0.0
                if self.min_corr <= val < 1.0:
                    pairs.append((a, b, val))
        if not pairs:
            return []
        pairs.sort(key=lambda x: x[2], reverse=True)
        top = ", ".join([f"{a}~{b}: {v:.2f}" for a, b, v in pairs[:5]])
        return [
            Alert(
                code="metrics.high_correlation",
                message=f"Сильные корреляции: {top}",
                severity="info",
                entity="manifest",
                kind="High correlation",
                data={"pairs": pairs[:5]},
            )
        ]


class AlertOrchestrator:
    """Оркестратор, который запускает последовательность alert-правил."""

    def __init__(self, rules: Sequence[AlertRule], *, fail_open: bool = True) -> None:
        self.rules = list(rules)
        self.fail_open = bool(fail_open)

    def run(self, context: AlertContext) -> List[Alert]:
        alerts: List[Alert] = []
        for rule in self.rules:
            try:
                alerts.extend(rule.evaluate(context))
            except Exception:
                if not self.fail_open:
                    raise
                logger.exception("Alert rule '%s' failed", getattr(rule, "name", repr(rule)))
        return alerts

class AlertAnalyzer:
    """Public facade over alert pipeline for backward-compatible integration."""

    def __init__(
        self,
        manifest: pd.DataFrame,
        *,
        vocab_df: Optional[pd.DataFrame] = None,
        metrics_df: Optional[pd.DataFrame] = None,
        missing_rate_warn: float = 0.05,
        high_wer_threshold: float = 40.0,
        high_wer_share_warn: float = 0.05,
        zero_wer_share_warn: float = 0.90,
        vocab_coverage_threshold: float = 80.0,
        rare_threshold: int = 2,
        rare_share_warn: float = 0.80,
        duration_type_imbalance_thr: float = 0.70,
        min_duration_warn: float = 0.5,
        max_duration_warn: float = 60.0,
        text_length_diff_threshold: float = 0.5,
        min_vocab_size: int = 100,
        wer_skew_threshold: float = 1.0,
        top_wer_percentile: float = 0.10,
        error_concentration_threshold: float = 0.70,
        rules: Optional[Sequence[AlertRule]] = None,
        fail_open: bool = True,
    ) -> None:
        self.manifest = manifest.copy() if manifest is not None else pd.DataFrame()
        self.vocab_df = vocab_df.copy() if vocab_df is not None else None
        self.metrics_df = metrics_df.copy() if metrics_df is not None else None
        self.thresholds = AlertThresholds(
            missing_rate_warn=float(missing_rate_warn),
            high_wer_threshold=float(high_wer_threshold),
            high_wer_share_warn=float(high_wer_share_warn),
            zero_wer_share_warn=float(zero_wer_share_warn),
            vocab_coverage_threshold=float(vocab_coverage_threshold),
            rare_threshold=int(rare_threshold),
            rare_share_warn=float(rare_share_warn),
            duration_type_imbalance_thr=float(duration_type_imbalance_thr),
            min_duration_warn=float(min_duration_warn),
            max_duration_warn=float(max_duration_warn),
            text_length_diff_threshold=float(text_length_diff_threshold),
            min_vocab_size=int(min_vocab_size),
            wer_skew_threshold=float(wer_skew_threshold),
            top_wer_percentile=float(top_wer_percentile),
            error_concentration_threshold=float(error_concentration_threshold),
        )
        self.orchestrator = default_alert_factory(fail_open=fail_open, rules=rules)

    def compute(self) -> List[Alert]:
        if self.manifest is None or self.manifest.empty:
            return [
                Alert(
                    code="dataset.empty",
                    message="Манифест пуст — нет данных для анализа",
                    severity="error",
                    entity="manifest",
                    kind="Missing Values",
                )
            ]

        context = AlertContext(
            manifest=self.manifest,
            vocab_df=self.vocab_df,
            metrics_df=self.metrics_df,
            thresholds=self.thresholds,
        )
        return self.orchestrator.run(context)

def default_alert_rules() -> List[AlertRule]:
    """Default order of alert rules for report quality checks."""
    return [
        RequiredColumnsRule(),
        DuplicateAudioRule(),
        EmptyTextPredictionRule(),
        TextLengthMismatchRule(),
        DurationRule(),
        WerDistributionRule(),
        DurationTypeImbalanceRule(),
        MetricsPresenceRule(),
        VocabQualityRule(),
        HesitationRule(),
        ErrorConcentrationRule(),
        CorrelationRule(),
    ]

def default_alert_factory(
    *,
    fail_open: bool = True,
    rules: Optional[Sequence[AlertRule]] = None,
) -> AlertOrchestrator:
    """Create orchestrator with default rule set and execution policy."""
    return AlertOrchestrator(rules=rules or default_alert_rules(), fail_open=fail_open)
