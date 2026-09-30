import { useMemo, useState } from 'react';
import { BarChart3 } from './icons';
import { VocabularyWord } from './VocabularyComparison';
import { useTheme } from './ThemeProvider';
import { vocabularySubtabClass } from '../utils/vocabularyHelpers';

type HeatmapMetric = 'recall' | 'precision' | 'f1Score';

interface VocabularyQualityHeatmapProps {
  words: VocabularyWord[];
  baseModel: string;
  targetModel: string;
  baseModelName: string;
  targetModelName: string;
}

const WORD_TYPES = [
  { key: 'russian', label: 'Русские' },
  { key: 'english', label: 'Английские' },
  { key: 'number', label: 'Числа' },
  { key: 'other', label: 'Прочие' },
] as const;

const FREQUENCY_RANGES = [
  { id: '1_5', label: '1-5 вхождений', min: 1, max: 5 },
  { id: '5_50', label: '5-50 вхождений', min: 5, max: 50 },
  { id: '50plus', label: '50+ вхождений', min: 50, max: Infinity },
] as const;

const METRIC_OPTIONS: Array<{ id: HeatmapMetric; label: string }> = [
  { id: 'recall', label: 'Recall' },
  { id: 'precision', label: 'Precision' },
  { id: 'f1Score', label: 'F1-score' },
];

function averageMetric(
  words: VocabularyWord[],
  modelName: string,
  metric: HeatmapMetric,
): number {
  if (words.length === 0) return 0;
  const total = words.reduce((sum, word) => {
    const value = word.modelMetrics[modelName]?.[metric] ?? 0;
    return sum + value;
  }, 0);
  return total / words.length;
}

function getHeatmapColor(value: number, isDark: boolean): string {
  if (value <= 0) return isDark ? '#1A1D24' : '#F3F4F6';
  if (value >= 80) return isDark ? '#065F46' : '#10B981';
  if (value >= 60) return isDark ? '#B45309' : '#F59E0B';
  return isDark ? '#991B1B' : '#EF4444';
}

function HeatmapDelta({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="reson-vocab-heatmap-cell-delta reson-vocab-heatmap-cell-delta--neutral">
        Δ абс.: 0.0 п.п.
      </span>
    );
  }

  return (
    <span
      className={`reson-vocab-heatmap-cell-delta ${
        delta > 0
          ? 'reson-vocab-heatmap-cell-delta--up'
          : 'reson-vocab-heatmap-cell-delta--down'
      }`}
    >
      Δ абс.: {delta > 0 ? '+' : ''}
      {delta.toFixed(1)} п.п.
    </span>
  );
}

export function VocabularyQualityHeatmap({
  words,
  baseModel,
  targetModel,
  baseModelName,
  targetModelName,
}: VocabularyQualityHeatmapProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [metric, setMetric] = useState<HeatmapMetric>('recall');

  const heatmapRows = useMemo(() => {
    return WORD_TYPES.map(({ key, label }) => {
      const typeWords = words.filter((word) => word.type === key);
      const cells = FREQUENCY_RANGES.map((range) => {
        const bucketWords = typeWords.filter(
          (word) => word.frequency >= range.min && word.frequency < range.max,
        );
        const baseValue = averageMetric(bucketWords, baseModel, metric);
        const targetValue = averageMetric(bucketWords, targetModel, metric);
        return {
          rangeId: range.id,
          count: bucketWords.length,
          baseValue,
          targetValue,
          delta: targetValue - baseValue,
        };
      });
      return { typeKey: key, typeLabel: label, cells };
    });
  }, [words, baseModel, targetModel, metric]);

  const metricLabel = METRIC_OPTIONS.find((item) => item.id === metric)?.label ?? metric;

  return (
    <div className="reson-vocab-card reson-vocab-heatmap-card" data-tour="vocabulary-quality-heatmap">
      <div className="reson-vocab-heatmap-head">
        <div className="reson-vocab-heatmap-title-wrap">
          <BarChart3 className="reson-vocab-heatmap-icon" />
          <div>
            <h3
              className={`reson-vocab-panel-title reson-vocab-panel-title--sm ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Тепловая карта: Качество vs Частота
            </h3>
            <p className="reson-vocab-panel-desc mt-0.5">
              {metricLabel}: цвет ячейки — Target ({targetModelName}); подписи Base, Target и
              абсолютная дельта (Target − Base) в п.п.
            </p>
          </div>
        </div>
        <div className="reson-vocab-top-metrics">
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={vocabularySubtabClass(metric === option.id, isDark)}
              onClick={() => setMetric(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="reson-vocab-heatmap-table">
          <thead>
            <tr>
              <th className="text-left">Тип слова</th>
              {FREQUENCY_RANGES.map((range) => (
                <th key={range.id} className="text-center">{range.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapRows.map((row) => (
              <tr key={row.typeKey}>
                <td className={isDark ? 'text-white' : 'text-gray-900'}>{row.typeLabel}</td>
                {row.cells.map((cell) => (
                  <td key={cell.rangeId}>
                    {cell.count === 0 ? (
                      <div className="reson-vocab-heatmap-cell reson-vocab-heatmap-cell--empty">
                        <span className="reson-vocab-heatmap-cell-empty">нет слов</span>
                      </div>
                    ) : (
                      <div
                        className="reson-vocab-heatmap-cell"
                        style={{
                          backgroundColor: getHeatmapColor(cell.targetValue, isDark),
                          color: cell.targetValue > 0 && !isDark ? '#111827' : '#fff',
                        }}
                        title={`Base ${cell.baseValue.toFixed(1)}% → Target ${cell.targetValue.toFixed(1)}% (${cell.count} слов)`}
                      >
                        <span className="reson-vocab-heatmap-cell-label">Target</span>
                        <span className="reson-vocab-heatmap-cell-value">
                          {cell.targetValue.toFixed(1)}%
                        </span>
                        <span className="reson-vocab-heatmap-cell-base">
                          Base {cell.baseValue.toFixed(1)}%
                        </span>
                        <HeatmapDelta delta={cell.delta} />
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="reson-vocab-heatmap-legend">
        <div className="reson-vocab-heatmap-legend-item">
          <span className="reson-vocab-heatmap-legend-swatch reson-vocab-heatmap-legend-swatch--good" />
          <span>Отлично (&gt;80%)</span>
        </div>
        <div className="reson-vocab-heatmap-legend-item">
          <span className="reson-vocab-heatmap-legend-swatch reson-vocab-heatmap-legend-swatch--mid" />
          <span>Средне (60-80%)</span>
        </div>
        <div className="reson-vocab-heatmap-legend-item">
          <span className="reson-vocab-heatmap-legend-swatch reson-vocab-heatmap-legend-swatch--bad" />
          <span>Плохо (&lt;60%)</span>
        </div>
        <div className="reson-vocab-heatmap-legend-item">
          <span className="reson-vocab-heatmap-legend-delta">Δ</span>
          <span>Δ абс. — абсолютная разница Target − Base в процентных пунктах</span>
        </div>
      </div>
    </div>
  );
}
