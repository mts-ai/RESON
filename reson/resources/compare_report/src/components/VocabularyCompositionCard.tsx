import { useMemo } from 'react';
import { VocabularyWord } from './VocabularyComparison';
import { useTheme } from './ThemeProvider';

interface VocabularyCompositionCardProps {
  words: VocabularyWord[];
}

const COMPOSITION_ITEMS = [
  { key: 'total', label: 'Всего слов', color: '#6366F1' },
  { key: 'russian', label: 'Русские', color: '#3B82F6' },
  { key: 'english', label: 'Английские', color: '#10B981' },
  { key: 'number', label: 'Числа', color: '#F59E0B' },
  { key: 'other', label: 'Прочие', color: '#8B5CF6' },
] as const;

export function VocabularyCompositionCard({ words }: VocabularyCompositionCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const typeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {
      russian: 0,
      english: 0,
      number: 0,
      other: 0,
    };

    words.forEach((word) => {
      distribution[word.type]++;
    });

    return distribution;
  }, [words]);

  const total = words.length;

  return (
    <div className="reson-vocab-card">
      <h3
        className={`reson-vocab-panel-title reson-vocab-panel-title--sm mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        Словарный состав
      </h3>
      <p className="reson-vocab-panel-desc mb-2">Распределение слов по типам</p>

      <div className="reson-vocab-composition-grid">
        {COMPOSITION_ITEMS.map((item, index) => {
          const isTotal = index === 0;
          const count = isTotal ? total : typeDistribution[item.key];
          const percentage = total > 0 ? (count / total) * 100 : 0;

          return (
            <div
              key={item.key}
              className={isTotal ? 'reson-vocab-composition-total' : 'reson-vocab-composition-item'}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="reson-vocab-composition-label">{item.label}</span>
              </div>

              <div
                className={`reson-vocab-word-type-count mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                {count.toLocaleString('ru-RU')}
              </div>

              {!isTotal && (
                <>
                  <div className="reson-vocab-composition-bar-track">
                    <div
                      className="reson-vocab-composition-bar-fill"
                      style={{ width: `${percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <div className="reson-vocab-composition-pct" style={{ color: item.color }}>
                    {percentage.toFixed(1)}%
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
