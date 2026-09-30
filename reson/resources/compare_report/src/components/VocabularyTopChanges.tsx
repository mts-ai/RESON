import { useMemo, useState } from 'react';
import { VocabularyWord } from './VocabularyComparison';
import { ChevronRight, TrendingUp, TrendingDown } from './icons';
import { useTheme } from './ThemeProvider';
import { vocabularySubtabClass } from '../utils/vocabularyHelpers';

type MetricType = 'recall' | 'precision' | 'f1Score' | 'wis';

interface VocabularyTopChangesProps {
  words: VocabularyWord[];
  baseModel: string;
  targetModel: string;
  onWordClick: (word: VocabularyWord) => void;
}

const METRIC_OPTIONS: Array<{ id: MetricType; label: string }> = [
  { id: 'f1Score', label: 'F1' },
  { id: 'recall', label: 'Recall' },
  { id: 'precision', label: 'Precision' },
  { id: 'wis', label: 'WIS' },
];

const LIST_LIMIT = 5;

export function VocabularyTopChanges({
  words,
  baseModel,
  targetModel,
  onWordClick,
}: VocabularyTopChangesProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('f1Score');

  const { topImprovements, topDegradations } = useMemo(() => {
    const wordsWithDelta = words
      .map((word) => {
        const baseMetrics = word.modelMetrics[baseModel];
        const targetMetrics = word.modelMetrics[targetModel];

        if (!baseMetrics || !targetMetrics) return null;

        const delta = targetMetrics[selectedMetric] - baseMetrics[selectedMetric];

        return {
          ...word,
          delta,
        };
      })
      .filter((w) => w !== null) as Array<VocabularyWord & { delta: number }>;

    const improvements = wordsWithDelta
      .filter((w) => w.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, LIST_LIMIT);

    const degradations = wordsWithDelta
      .filter((w) => w.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, LIST_LIMIT);

    return {
      topImprovements: improvements,
      topDegradations: degradations,
    };
  }, [words, baseModel, targetModel, selectedMetric]);

  const metricLabel =
    METRIC_OPTIONS.find((metric) => metric.id === selectedMetric)?.label ?? 'F1';

  const renderList = (
    items: Array<VocabularyWord & { delta: number }>,
    tone: 'up' | 'down',
    emptyText: string,
  ) => {
    const isUp = tone === 'up';
    return (
      <div className="min-w-0">
        <div className="reson-vocab-top-list-head">
          {isUp ? (
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          )}
          <span className={`reson-vocab-top-list-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {isUp ? 'Топ улучшений' : 'Топ ухудшений'}
          </span>
        </div>
        <div className="reson-vocab-top-list">
          {items.length === 0 ? (
            <p className="reson-vocab-top-empty">{emptyText}</p>
          ) : (
            items.map((word, index) => (
              <button
                key={word.word}
                type="button"
                onClick={() => onWordClick(word)}
                className={`reson-vocab-top-row ${isUp ? 'reson-vocab-top-row--up' : 'reson-vocab-top-row--down'} ${isDark ? 'reson-vocab-top-row--dark' : ''}`}
                title="Открыть детализацию слова"
              >
                <span className="reson-vocab-top-rank">{index + 1}</span>
                <span className="reson-vocab-top-word">{word.word}</span>
                <span
                  className={`reson-vocab-top-delta ${isUp ? 'reson-vocab-top-delta--up' : 'reson-vocab-top-delta--down'}`}
                >
                  {word.delta > 0 ? '+' : ''}
                  {word.delta.toFixed(1)}
                </span>
                <ChevronRight className="reson-vocab-top-chevron" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="reson-vocab-card reson-vocab-top-changes">
      <div className="reson-vocab-top-header">
        <div className="min-w-0">
          <h3
            className={`reson-vocab-panel-title reson-vocab-panel-title--sm ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Топ изменений по словам
          </h3>
          <p className="reson-vocab-panel-desc mt-0.5">
            Наибольший сдвиг {metricLabel} между Base и Target
          </p>
        </div>
        <div className="reson-vocab-top-metrics">
          {METRIC_OPTIONS.map((metric) => (
            <button
              key={metric.id}
              type="button"
              onClick={() => setSelectedMetric(metric.id)}
              className={vocabularySubtabClass(selectedMetric === metric.id, isDark)}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      <p className="reson-vocab-top-hint">Нажмите на слово, чтобы открыть детализацию</p>

      <div className="reson-vocab-top-grid">
        {renderList(topImprovements, 'up', 'Нет улучшенных слов')}
        {renderList(topDegradations, 'down', 'Нет ухудшенных слов')}
      </div>
    </div>
  );
}
