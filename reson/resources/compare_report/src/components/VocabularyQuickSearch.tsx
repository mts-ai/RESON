import { useMemo, useState } from 'react';
import { Search, CheckCircle2, XCircle } from './icons';
import { VocabularyWord } from './VocabularyComparison';
import { useTheme } from './ThemeProvider';

interface VocabularyQuickSearchProps {
  words: VocabularyWord[];
  onWordClick: (word: VocabularyWord) => void;
  onOpenInTable?: (word: string) => void;
  baseModel?: string | null;
  targetModel?: string | null;
}

const TYPE_LABELS: Record<VocabularyWord['type'], string> = {
  russian: 'RU',
  english: 'EN',
  number: 'NUM',
  other: 'OTHER',
};

export function VocabularyQuickSearch({
  words,
  onWordClick,
  onOpenInTable,
  baseModel,
  targetModel,
}: VocabularyQuickSearchProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return words
      .filter((word) => word.word.toLowerCase().includes(query))
      .slice(0, 5);
  }, [words, searchQuery]);

  const exactMatch = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    return words.find((word) => word.word.toLowerCase() === query) ?? null;
  }, [words, searchQuery]);

  const previewMetrics = exactMatch && targetModel
    ? exactMatch.modelMetrics[targetModel]
    : null;

  const handleSuggestionClick = (word: VocabularyWord) => {
    setSearchQuery(word.word);
    setShowSuggestions(false);
  };

  return (
    <div className="reson-vocab-card reson-vocab-summary-col">
      <div className="flex items-center gap-2 mb-1">
        <Search className="w-4 h-4 text-[var(--reson-accent)]" />
        <h3 className={`reson-vocab-panel-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Быстрый поиск слова
        </h3>
      </div>
      <p className="reson-vocab-panel-desc mb-4">
        Найдите метрики любого слова из словаря
      </p>

      <div className="relative">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        />
        <input
          type="text"
          placeholder="Введите слово для поиска..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(e.target.value.trim().length > 0);
          }}
          onFocus={() => {
            if (searchQuery.trim() && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          className="reson-vocab-search-input"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="reson-vocab-suggestions">
            {suggestions.map((word, index) => (
              <button
                key={word.word}
                type="button"
                onClick={() => handleSuggestionClick(word)}
                className={`w-full px-3 py-2.5 text-left flex items-center justify-between transition-colors ${
                  isDark ? 'hover:bg-[#2A2D35] text-gray-300' : 'hover:bg-gray-50 text-gray-700'
                } ${index !== suggestions.length - 1 ? (isDark ? 'border-b border-[#2A2D35]' : 'border-b border-gray-100') : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="text-sm truncate">{word.word}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {TYPE_LABELS[word.type]}
                  </span>
                </div>
                <span className="text-xs text-gray-500 shrink-0 ml-2">
                  {word.frequency.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {searchQuery.trim() && (
        <div className="mt-3">
          {!exactMatch ? (
            <div className={`rounded-lg p-3 border ${
              isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                  Слово не найдено
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                Слово «{searchQuery}» отсутствует в словаре датасета
              </p>
            </div>
          ) : (
            <div className={`rounded-lg p-3 ${isDark ? 'bg-[#23262F]' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className={`text-base font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {exactMatch.word}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                    isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {TYPE_LABELS[exactMatch.type]}
                  </span>
                </div>
                <span className={`text-xs shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Частота: {exactMatch.frequency.toLocaleString()}
                </span>
              </div>

              {previewMetrics ? (
                <div className="grid grid-cols-4 gap-2">
                  {(['recall', 'precision', 'f1Score', 'wis'] as const).map((metric) => (
                    <div key={metric}>
                      <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {metric === 'f1Score' ? 'F1-score' : metric.charAt(0).toUpperCase() + metric.slice(1)}
                      </div>
                      <div className={`text-sm ${
                        metric === 'recall' ? 'text-blue-600 dark:text-blue-400'
                          : metric === 'precision' ? 'text-green-600 dark:text-green-400'
                          : metric === 'f1Score' ? 'text-purple-600 dark:text-purple-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {previewMetrics[metric].toFixed(1)}
                        {metric !== 'wis' ? '%' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="reson-vocab-quick-actions">
                <button
                  type="button"
                  onClick={() => onWordClick(exactMatch)}
                  className={`reson-vocab-quick-action-btn ${
                    isDark ? 'reson-vocab-quick-action-btn--dark' : ''
                  }`}
                >
                  Посмотреть детализацию
                </button>
                {onOpenInTable && (
                  <button
                    type="button"
                    onClick={() => onOpenInTable(exactMatch.word)}
                    className={`reson-vocab-quick-action-btn reson-vocab-quick-action-btn--secondary ${
                      isDark ? 'reson-vocab-quick-action-btn--dark' : ''
                    }`}
                  >
                    Открыть в интерактивном словаре
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
