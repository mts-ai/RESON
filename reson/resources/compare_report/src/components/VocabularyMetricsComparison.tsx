import { useMemo } from "react";
import { VocabularyWord } from "./VocabularyComparison";
import { VocabularyQualityHeatmap } from "./VocabularyQualityHeatmap";
import { useTheme } from "./ThemeProvider";
import { VocabSectionHint } from "./vocabulary/VocabSectionHint";
import { WORD_STATS_HINT_ITEMS } from "../utils/vocabularyHelpers";

interface VocabularyMetricsComparisonProps {
  words: VocabularyWord[];
  baseModel: string | null;
  targetModel: string | null;
  availableModels: { name: string; displayName: string }[];
}

interface TypeMetrics {
  recall: number;
  precision: number;
  f1Score: number;
  count: number;
}

interface ComparisonStats {
  byType: Record<
    string,
    {
      base: TypeMetrics;
      target: TypeMetrics;
    }
  >;
}

const TABLE_ROWS = [
  { key: "russian", label: "Русские", color: "#3B82F6" },
  { key: "english", label: "Английские", color: "#10B981" },
  { key: "number", label: "Числа", color: "#F59E0B" },
  { key: "other", label: "Прочие", color: "#8B5CF6" },
] as const;

const METRICS = [
  { id: "recall" as const, label: "Recall", pillClass: "reson-vocab-metric-pill--recall", barColor: "#3B82F6", kpiColor: "#1d4ed8" },
  { id: "precision" as const, label: "Precision", pillClass: "reson-vocab-metric-pill--precision", barColor: "#10B981", kpiColor: "#047857" },
  { id: "f1Score" as const, label: "F1-score", pillClass: "reson-vocab-metric-pill--f1", barColor: "#8B5CF6", kpiColor: "#6d28d9" },
];

function MetricDeltaDetail({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.01) {
    return (
      <div className="reson-vocab-metric-comparison-delta reson-vocab-metric-comparison-delta--neutral">
        Δ абс.: 0.0 п.п.
      </div>
    );
  }

  return (
    <div
      className={`reson-vocab-metric-comparison-delta ${
        delta > 0
          ? "reson-vocab-metric-comparison-delta--up"
          : "reson-vocab-metric-comparison-delta--down"
      }`}
    >
      Δ абс.: {delta > 0 ? "+" : ""}
      {delta.toFixed(1)} п.п.
    </div>
  );
}

function MetricCell({
  baseValue,
  targetValue,
  delta,
  pillClass,
  barColor,
}: {
  baseValue: number;
  targetValue: number;
  delta: number;
  pillClass: string;
  barColor: string;
}) {
  return (
    <td className="text-center">
      <div className="reson-vocab-metric-cell">
        <div
          className="reson-vocab-metric-bar-track"
          title={`Base ${baseValue.toFixed(1)}% → Target ${targetValue.toFixed(1)}%`}
        >
          <div
            className="reson-vocab-metric-bar-base"
            style={{ width: `${Math.min(100, Math.max(0, baseValue))}%` }}
          />
          <div
            className="reson-vocab-metric-bar-target"
            style={{
              width: `${Math.min(100, Math.max(0, targetValue))}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
        <div className="reson-vocab-metric-comparison-values">
          <div className="reson-vocab-metric-model-value">
            <span className="reson-vocab-metric-model-label">Base</span>
            <span>{baseValue.toFixed(1)}%</span>
          </div>
          <span className="reson-vocab-metric-model-arrow" aria-hidden="true">
            →
          </span>
          <div className="reson-vocab-metric-model-value">
            <span className="reson-vocab-metric-model-label">Target</span>
            <span className={`reson-vocab-metric-pill ${pillClass}`}>
              {targetValue.toFixed(1)}%
            </span>
          </div>
        </div>
        <MetricDeltaDetail delta={delta} />
      </div>
    </td>
  );
}

export function VocabularyMetricsComparison({
  words,
  baseModel,
  targetModel,
  availableModels,
}: VocabularyMetricsComparisonProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const comparisonStats = useMemo((): ComparisonStats | null => {
    if (!baseModel || !targetModel) return null;

    const byType: Record<string, { base: TypeMetrics; target: TypeMetrics }> = {};

    ["all", "russian", "english", "number", "other"].forEach((type) => {
      byType[type] = {
        base: { recall: 0, precision: 0, f1Score: 0, count: 0 },
        target: { recall: 0, precision: 0, f1Score: 0, count: 0 },
      };
    });

    words.forEach((word) => {
      const baseMetrics = word.modelMetrics[baseModel];
      const targetMetrics = word.modelMetrics[targetModel];

      if (!baseMetrics || !targetMetrics) return;

      const wordType = word.type;

      byType[wordType].base.recall += baseMetrics.recall;
      byType[wordType].base.precision += baseMetrics.precision;
      byType[wordType].base.f1Score += baseMetrics.f1Score;
      byType[wordType].base.count++;

      byType[wordType].target.recall += targetMetrics.recall;
      byType[wordType].target.precision += targetMetrics.precision;
      byType[wordType].target.f1Score += targetMetrics.f1Score;
      byType[wordType].target.count++;

      byType.all.base.recall += baseMetrics.recall;
      byType.all.base.precision += baseMetrics.precision;
      byType.all.base.f1Score += baseMetrics.f1Score;
      byType.all.base.count++;

      byType.all.target.recall += targetMetrics.recall;
      byType.all.target.precision += targetMetrics.precision;
      byType.all.target.f1Score += targetMetrics.f1Score;
      byType.all.target.count++;
    });

    Object.keys(byType).forEach((type) => {
      const baseCount = byType[type].base.count;
      const targetCount = byType[type].target.count;

      if (baseCount > 0) {
        byType[type].base.recall /= baseCount;
        byType[type].base.precision /= baseCount;
        byType[type].base.f1Score /= baseCount;
      }

      if (targetCount > 0) {
        byType[type].target.recall /= targetCount;
        byType[type].target.precision /= targetCount;
        byType[type].target.f1Score /= targetCount;
      }
    });

    return { byType };
  }, [words, baseModel, targetModel]);

  if (!baseModel || !targetModel || !comparisonStats) {
    return null;
  }

  const allStats = comparisonStats.byType.all;
  const baseModelName =
    availableModels.find((model) => model.name === baseModel)?.displayName ?? baseModel;
  const targetModelName =
    availableModels.find((model) => model.name === targetModel)?.displayName ?? targetModel;

  return (
    <div className="space-y-3">
    <div className="reson-vocab-card" data-tour="vocabulary-metrics-by-type">
      <div className="reson-vocab-section-header mb-3">
        <div className="min-w-0">
          <h3
            className={`reson-vocab-panel-title reson-vocab-panel-title--sm mb-0.5 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Статистика по словам
          </h3>
          <p className="reson-vocab-panel-desc mb-0">
            Средние метрики качества распознавания по типам слов — Base vs Target
          </p>
        </div>
        <VocabSectionHint
          isDark={isDark}
          triggerText="Что означают метрики?"
          panelTitle="Метрики таблицы"
          panelSubtitle="Кратко о recall, precision и F1"
          panelAriaLabel="Пояснение метрик статистики по словам"
          items={WORD_STATS_HINT_ITEMS}
        />
      </div>

      {allStats.base.count > 0 && (
        <div className="reson-vocab-stats-kpi-row">
          {METRICS.map((metric) => {
            const target = allStats.target[metric.id];
            const base = allStats.base[metric.id];
            const delta = target - base;

            return (
              <div key={metric.id} className="reson-vocab-stats-kpi">
                <div className="reson-vocab-stats-kpi-label">{metric.label}</div>
                <div className="reson-vocab-stats-kpi-value" style={{ color: metric.kpiColor }}>
                  {target.toFixed(1)}%
                </div>
                <span
                  className={`reson-vocab-stats-kpi-delta ${
                    delta >= 0 ? "reson-vocab-stats-kpi-delta--up" : "reson-vocab-stats-kpi-delta--down"
                  }`}
                >
                  Δ абс.: {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)} п.п.
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="reson-vocab-stats-table">
          <thead>
            <tr>
              <th className="text-left">Тип слова</th>
              <th className="text-center">Recall (%)</th>
              <th className="text-center">Precision (%)</th>
              <th className="text-center">F1-score (%)</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row) => {
              const stats = comparisonStats.byType[row.key];
              const hasData = stats.base.count > 0;

              return (
                <tr key={row.key}>
                  <td className={isDark ? "text-white" : "text-gray-900"}>
                    <div className="reson-vocab-type-label">
                      <span
                        className="reson-vocab-type-dot"
                        style={{ backgroundColor: row.color }}
                      />
                      <span>{row.label}</span>
                      {hasData && (
                        <span className="reson-vocab-type-count">
                          {stats.base.count.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </td>
                  {hasData ? (
                    METRICS.map((metric) => (
                      <MetricCell
                        key={metric.id}
                        baseValue={stats.base[metric.id]}
                        targetValue={stats.target[metric.id]}
                        delta={stats.target[metric.id] - stats.base[metric.id]}
                        pillClass={metric.pillClass}
                        barColor={metric.barColor}
                      />
                    ))
                  ) : (
                    <>
                      <td className="text-center text-muted-foreground">—</td>
                      <td className="text-center text-muted-foreground">—</td>
                      <td className="text-center text-muted-foreground">—</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    <VocabularyQualityHeatmap
      words={words}
      baseModel={baseModel}
      targetModel={targetModel}
      baseModelName={baseModelName}
      targetModelName={targetModelName}
    />
    </div>
  );
}
