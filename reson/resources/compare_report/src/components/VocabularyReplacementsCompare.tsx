import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, ExternalLink, FileText, RefreshCw } from './icons';
import { useTheme } from './ThemeProvider';
import { VocabSectionHint } from './vocabulary/VocabSectionHint';
import { REPLACEMENTS_HINT_ITEMS, vocabularySubtabClass } from '../utils/vocabularyHelpers';
import type { CompareNormalizationDictionary } from '../utils/normalizationDictionary';

interface ModelInfo {
  name: string;
  displayName: string;
}

interface ReplacementRow {
  original: string;
  replaced: string;
  byModel: Record<string, { freqRef: number; freqHyp: number }>;
}

interface VocabularyReplacementsCompareProps {
  normalizationDictionary: CompareNormalizationDictionary;
  selectedModels: string[];
  availableModels: ModelInfo[];
  onSearchWord: (word: string) => void;
}

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = ['\uFEFF' + rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')];
  const blob = new Blob(content, { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildReplacementRows(
  data: CompareNormalizationDictionary,
  selectedModels: string[],
): ReplacementRow[] {
  const rowMap = new Map<string, ReplacementRow>();

  selectedModels.forEach((modelName) => {
    const modelDict = data.byModel[modelName];
    if (!modelDict?.vocab) return;

    for (const rule of modelDict.vocab) {
      for (const source of rule.sources ?? []) {
        const key = `${source.word}\0${rule.target}`;
        const existing = rowMap.get(key) ?? {
          original: source.word,
          replaced: rule.target,
          byModel: {},
        };
        existing.byModel[modelName] = {
          freqRef: source.countText ?? source.count ?? 0,
          freqHyp: source.countPrediction ?? 0,
        };
        rowMap.set(key, existing);
      }
    }
  });

  return Array.from(rowMap.values()).sort((a, b) => {
    const totalA = Object.values(a.byModel).reduce((sum, item) => sum + item.freqRef + item.freqHyp, 0);
    const totalB = Object.values(b.byModel).reduce((sum, item) => sum + item.freqRef + item.freqHyp, 0);
    return totalB - totalA;
  });
}

function buildReplacementDictionary(data: CompareNormalizationDictionary, modelName: string) {
  const modelDict = data.byModel[modelName];
  if (!modelDict?.vocab) return {};
  const dict: Record<string, Array<{ word: string; count?: number }>> = {};
  for (const rule of modelDict.vocab) {
    dict[rule.target] = (rule.sources ?? []).map((source) => ({
      word: source.word,
      count: source.count,
    }));
  }
  return dict;
}

export function VocabularyReplacementsCompare({
  normalizationDictionary,
  selectedModels,
  availableModels,
  onSearchWord,
}: VocabularyReplacementsCompareProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [showDictionary, setShowDictionary] = useState(false);
  const [showReplacementsTable, setShowReplacementsTable] = useState(false);
  const [showAllDict, setShowAllDict] = useState(false);
  const [activeModel, setActiveModel] = useState(selectedModels[0] ?? '');

  const modelLabel = (name: string) =>
    availableModels.find((model) => model.name === name)?.displayName ?? name;

  const replacementRows = useMemo(
    () => buildReplacementRows(normalizationDictionary, selectedModels),
    [normalizationDictionary, selectedModels],
  );

  const replacementDictionary = useMemo(
    () => buildReplacementDictionary(normalizationDictionary, activeModel),
    [normalizationDictionary, activeModel],
  );

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return replacementRows.filter((row) => {
      const hasActivity = Object.values(row.byModel).some(
        (counts) => counts.freqRef > 0 || counts.freqHyp > 0,
      );
      if (!hasActivity) return false;
      if (!query) return true;
      return (
        row.original.toLowerCase().includes(query) ||
        row.replaced.toLowerCase().includes(query)
      );
    });
  }, [replacementRows, searchTerm]);

  const modelTotals = useMemo(() => {
    const totals: Record<string, { ref: number; hyp: number }> = {};
    selectedModels.forEach((modelName) => {
      const stats = normalizationDictionary.byModel[modelName]?.stats;
      const byField = stats?.byField ?? {};
      totals[modelName] = {
        ref: Number(byField.text) || 0,
        hyp: Number(byField.prediction) || 0,
      };
      if (totals[modelName].ref === 0 && totals[modelName].hyp === 0) {
        totals[modelName] = replacementRows.reduce(
          (acc, row) => {
            const counts = row.byModel[modelName];
            if (!counts) return acc;
            return {
              ref: acc.ref + counts.freqRef,
              hyp: acc.hyp + counts.freqHyp,
            };
          },
          { ref: 0, hyp: 0 },
        );
      }
    });
    return totals;
  }, [normalizationDictionary, replacementRows, selectedModels]);

  const maxFreq = useMemo(() => {
    let max = 1;
    filteredRows.forEach((row) => {
      Object.values(row.byModel).forEach((counts) => {
        max = Math.max(max, counts.freqRef, counts.freqHyp);
      });
    });
    return max;
  }, [filteredRows]);

  const getFrequencyBarClass = (freq: number) => {
    const ratio = freq / maxFreq;
    if (ratio === 0) return 'reson-vocab-repl-bar--empty';
    if (ratio < 0.5) return 'reson-vocab-repl-bar--low';
    if (ratio < 0.8) return 'reson-vocab-repl-bar--mid';
    return 'reson-vocab-repl-bar--high';
  };

  const summaryTargets = useMemo(() => {
    const totals = new Map<string, number>();
    replacementRows.forEach((row) => {
      const rowTotal = Object.values(row.byModel).reduce(
        (sum, counts) => sum + counts.freqRef + counts.freqHyp,
        0,
      );
      if (rowTotal <= 0) return;
      totals.set(row.replaced, (totals.get(row.replaced) ?? 0) + rowTotal);
    });
    return Array.from(totals.entries())
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [replacementRows]);

  const dictRuleCount = Object.keys(replacementDictionary).length;
  const totalRulesAllModels = useMemo(() => {
    return selectedModels.reduce((sum, modelName) => {
      return sum + Object.keys(buildReplacementDictionary(normalizationDictionary, modelName)).length;
    }, 0);
  }, [normalizationDictionary, selectedModels]);

  const exportDictionaryCsv = () => {
    const rows: string[][] = [['model', 'target', 'variant', 'count']];
    selectedModels.forEach((modelName) => {
      const dict = buildReplacementDictionary(normalizationDictionary, modelName);
      Object.entries(dict).forEach(([target, variants]) => {
        variants.forEach((variant) => {
          rows.push([modelLabel(modelName), target, variant.word, variant.count ?? '']);
        });
      });
    });
    downloadCsv(
      `replacement_dictionary_${new Date().toISOString().split('T')[0]}.csv`,
      rows,
    );
  };

  const exportActiveDictionaryCsv = () => {
    const rows: string[][] = [['target', 'variant', 'count']];
    Object.entries(replacementDictionary).forEach(([target, variants]) => {
      variants.forEach((variant) => {
        rows.push([target, variant.word, variant.count ?? '']);
      });
    });
    downloadCsv(
      `replacement_dictionary_${activeModel}_${new Date().toISOString().split('T')[0]}.csv`,
      rows,
    );
  };

  const exportReplacementsCsv = () => {
    const rows: string[][] = [['original_word', 'replaced_word', 'model', 'freq_ref', 'freq_hyp', 'total']];
    filteredRows.forEach((row) => {
      selectedModels.forEach((modelName) => {
        const counts = row.byModel[modelName] ?? { freqRef: 0, freqHyp: 0 };
        if (counts.freqRef === 0 && counts.freqHyp === 0) return;
        rows.push([
          row.original,
          row.replaced,
          modelLabel(modelName),
          counts.freqRef,
          counts.freqHyp,
          counts.freqRef + counts.freqHyp,
        ]);
      });
    });
    downloadCsv(
      `replacements_triggered_${new Date().toISOString().split('T')[0]}.csv`,
      rows,
    );
  };

  return (
    <div className="space-y-3" data-tour="vocabulary-replacements">
      {/* 1. Статистика по моделям */}
      <div className="reson-vocab-card">
        <div className="reson-vocab-section-header mb-3">
          <div className="min-w-0">
            <h3
              className={`reson-vocab-panel-title reson-vocab-panel-title--sm mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Срабатывания по моделям
            </h3>
            <p className="reson-vocab-panel-desc mb-0">
              Как часто словарь замен применялся в эталонном (REF) и распознанном (HYP) тексте
            </p>
          </div>
          <VocabSectionHint
            isDark={isDark}
            triggerText="Справка по обозначениям"
            panelTitle="Словарь замен"
            panelSubtitle="REF, HYP и правила нормализации"
            panelAriaLabel="Пояснение обозначений словаря замен"
            items={REPLACEMENTS_HINT_ITEMS}
          />
        </div>

        <div className="reson-vocab-repl-stats-grid">
          {selectedModels.map((modelName) => {
            const totals = modelTotals[modelName] ?? { ref: 0, hyp: 0 };
            const modelTotal = totals.ref + totals.hyp || 1;
            const refPct = (totals.ref / modelTotal) * 100;
            const hypPct = (totals.hyp / modelTotal) * 100;

            return (
              <div key={modelName} className="reson-vocab-repl-model-stat-card">
                <div className="reson-vocab-repl-model-stat-head">
                  <div className="reson-vocab-repl-model-stat-icon">
                    <FileText />
                  </div>
                  <span className="reson-vocab-repl-model-stat-name">{modelLabel(modelName)}</span>
                </div>
                <div className="reson-vocab-repl-model-stat-metrics">
                  <div className="reson-vocab-repl-model-stat-metric">
                    <div className="reson-vocab-repl-model-stat-value">{totals.ref}</div>
                    <p className="reson-vocab-repl-model-stat-caption">
                      раз в эталонном тексте (REF)
                    </p>
                    <div className="reson-vocab-repl-model-stat-bar">
                      <div
                        className="reson-vocab-repl-model-stat-bar-fill reson-vocab-repl-model-stat-bar-fill--ref"
                        style={{ width: `${refPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="reson-vocab-repl-model-stat-metric">
                    <div className="reson-vocab-repl-model-stat-value">{totals.hyp}</div>
                    <p className="reson-vocab-repl-model-stat-caption">
                      раз в распознанном тексте (HYP)
                    </p>
                    <div className="reson-vocab-repl-model-stat-bar">
                      <div
                        className="reson-vocab-repl-model-stat-bar-fill reson-vocab-repl-model-stat-bar-fill--hyp"
                        style={{ width: `${hypPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="reson-vocab-repl-legend">
          <div className="reson-vocab-repl-legend-item">
            <span className="reson-vocab-repl-legend-swatch reson-vocab-repl-legend-swatch--ref" />
            <span>REF — эталонный текст</span>
          </div>
          <div className="reson-vocab-repl-legend-item">
            <span className="reson-vocab-repl-legend-swatch reson-vocab-repl-legend-swatch--hyp" />
            <span>HYP — распознанный текст</span>
          </div>
        </div>
      </div>

      {/* 2. Словарь замен (сворачиваемый) */}
      <div className="reson-vocab-card">
        <button
          type="button"
          className="reson-vocab-repl-section-toggle"
          onClick={() => setShowDictionary((open) => !open)}
          aria-expanded={showDictionary}
        >
          <div className="min-w-0">
            <div className="reson-vocab-repl-section-toggle-title">
              <RefreshCw className="reson-vocab-repl-section-toggle-icon" />
              <span
                className={`reson-vocab-panel-title reson-vocab-panel-title--sm ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                Словарь замен
              </span>
              <span className="reson-vocab-repl-rules-badge">{totalRulesAllModels} правил</span>
            </div>
            <p className="reson-vocab-panel-desc mb-0">
              Правила нормализации: target и варианты, заменяемые при обработке текста
            </p>
          </div>
          {showDictionary ? (
            <ChevronUp className="reson-vocab-repl-section-chevron" />
          ) : (
            <ChevronDown className="reson-vocab-repl-section-chevron" />
          )}
        </button>

        {showDictionary && (
          <div className="reson-vocab-repl-section-body">
            <div className="reson-vocab-repl-dict-model-tabs">
              {selectedModels.map((modelName) => (
                <button
                  key={modelName}
                  type="button"
                  className={vocabularySubtabClass(activeModel === modelName, isDark)}
                  onClick={() => {
                    setActiveModel(modelName);
                    setShowAllDict(false);
                  }}
                >
                  {modelLabel(modelName)}
                </button>
              ))}
            </div>

            <div className="reson-vocab-repl-toolbar">
              <p className="reson-vocab-panel-desc mb-0">
                {dictRuleCount} правил для {modelLabel(activeModel)}
              </p>
              <div className="reson-vocab-repl-toolbar-actions">
                <button
                  type="button"
                  className="reson-vocab-export-btn"
                  disabled={dictRuleCount === 0}
                  onClick={exportActiveDictionaryCsv}
                >
                  <Download />
                  CSV модели
                </button>
                <button
                  type="button"
                  className="reson-vocab-export-btn"
                  disabled={totalRulesAllModels === 0}
                  onClick={exportDictionaryCsv}
                >
                  <Download />
                  CSV всех моделей
                </button>
              </div>
            </div>

            <div className="reson-vocab-repl-dict-body reson-vocab-repl-dict-body--nested">
              {dictRuleCount === 0 ? (
                <p className="reson-vocab-panel-desc text-center py-4 mb-0">
                  Нет правил для выбранной модели
                </p>
              ) : (
                Object.entries(replacementDictionary)
                  .slice(0, showAllDict ? undefined : 5)
                  .map(([target, variants]) => (
                    <div key={target} className="reson-vocab-repl-rule">
                      <div className="reson-vocab-repl-rule-target">{target}</div>
                      <div className="reson-vocab-repl-rule-variants">
                        {variants.map((variant) => (
                          <span key={`${target}-${variant.word}`} className="reson-vocab-repl-variant">
                            {variant.word}
                            {variant.count != null && (
                              <span className="reson-vocab-repl-variant-count">×{variant.count}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
              )}
              {dictRuleCount > 5 && (
                <button
                  type="button"
                  className="reson-vocab-repl-show-all"
                  onClick={() => setShowAllDict((value) => !value)}
                >
                  {showAllDict ? 'Скрыть' : `Показать все (${dictRuleCount})`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Таблица сработавших замен (сворачиваемая) */}
      <div className="reson-vocab-card">
        <button
          type="button"
          className="reson-vocab-repl-section-toggle"
          onClick={() => setShowReplacementsTable((open) => !open)}
          aria-expanded={showReplacementsTable}
        >
          <div className="min-w-0">
            <div className="reson-vocab-repl-section-toggle-title">
              <FileText className="reson-vocab-repl-section-toggle-icon" />
              <span
                className={`reson-vocab-panel-title reson-vocab-panel-title--sm ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                Сработавшие замены
              </span>
              <span className="reson-vocab-repl-rules-badge">{filteredRows.length} строк</span>
            </div>
            <p className="reson-vocab-panel-desc mb-0">
              Детальная статистика по каждой паре «исходное → заменённое» в REF и HYP для всех моделей
            </p>
          </div>
          {showReplacementsTable ? (
            <ChevronUp className="reson-vocab-repl-section-chevron" />
          ) : (
            <ChevronDown className="reson-vocab-repl-section-chevron" />
          )}
        </button>

        {showReplacementsTable && (
          <div className="reson-vocab-repl-section-body">
            <div className="reson-vocab-repl-toolbar">
              <div className="reson-vocab-repl-search-wrap">
                <input
                  type="text"
                  className="reson-vocab-repl-search reson-vocab-repl-search--full"
                  placeholder="Поиск по словам..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="reson-vocab-repl-toolbar-actions">
                <button
                  type="button"
                  className="reson-vocab-export-btn"
                  disabled={filteredRows.length === 0}
                  onClick={exportReplacementsCsv}
                >
                  <Download />
                  CSV замен
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="reson-vocab-stats-table reson-vocab-repl-table">
                <thead>
                  <tr>
                    <th className="text-left">Исходное</th>
                    <th className="text-left">Заменено</th>
                    {selectedModels.map((modelName) => (
                      <th key={modelName} colSpan={2} className="text-center">
                        {modelLabel(modelName)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th />
                    <th />
                    {selectedModels.map((modelName) => (
                      <Fragment key={modelName}>
                        <th className="text-center reson-vocab-repl-table-subhead">REF</th>
                        <th className="text-center reson-vocab-repl-table-subhead">HYP</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2 + selectedModels.length * 2}
                        className="text-center text-muted-foreground py-8"
                      >
                        Ничего не найдено
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={`${row.original}-${row.replaced}`}>
                        <td>{row.original}</td>
                        <td className="reson-vocab-repl-target">{row.replaced}</td>
                        {selectedModels.map((modelName) => {
                          const counts = row.byModel[modelName] ?? { freqRef: 0, freqHyp: 0 };
                          return (
                            <Fragment key={`${row.original}-${modelName}`}>
                              <td className="text-center">
                                <div className="reson-vocab-repl-freq-cell">
                                  <span>{counts.freqRef}</span>
                                  <span
                                    className={`reson-vocab-repl-bar ${getFrequencyBarClass(counts.freqRef)}`}
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="reson-vocab-repl-freq-cell">
                                  <span>{counts.freqHyp}</span>
                                  <span
                                    className={`reson-vocab-repl-bar ${getFrequencyBarClass(counts.freqHyp)}`}
                                  />
                                </div>
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="reson-vocab-repl-legend">
              <div className="reson-vocab-repl-legend-item">
                <span className="reson-vocab-repl-legend-swatch reson-vocab-repl-legend-swatch--empty" />
                <span>0</span>
              </div>
              <div className="reson-vocab-repl-legend-item">
                <span className="reson-vocab-repl-legend-swatch reson-vocab-repl-legend-swatch--low" />
                <span>Низкая (&lt;50% от макс.)</span>
              </div>
              <div className="reson-vocab-repl-legend-item">
                <span className="reson-vocab-repl-legend-swatch reson-vocab-repl-legend-swatch--mid" />
                <span>Средняя (50–80%)</span>
              </div>
              <div className="reson-vocab-repl-legend-item">
                <span className="reson-vocab-repl-legend-swatch reson-vocab-repl-legend-swatch--high" />
                <span>Высокая (&gt;80%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Резюме — как в single_report */}
      <div className="reson-vocab-card reson-vocab-repl-summary-section">
        <h3
          className={`reson-vocab-panel-title reson-vocab-panel-title--sm mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          Резюме
        </h3>
        <p className="reson-vocab-panel-desc mb-4">
          Целевые слова, по которым сработал словарь замен (всего замен больше нуля). Нажмите на
          иконку рядом со словом, чтобы открыть его в словаре.
        </p>

        {summaryTargets.length === 0 ? (
          <p className="reson-vocab-panel-desc text-center py-4 mb-0">Нет сработавших замен</p>
        ) : (
          <div className="reson-vocab-repl-summary-grid">
            {summaryTargets.map(([target, totalCount]) => (
              <div key={target} className="reson-vocab-repl-summary-card">
                <div className="reson-vocab-repl-summary-card-head">
                  <span className="reson-vocab-repl-summary-card-word">{target}</span>
                  <button
                    type="button"
                    className="reson-vocab-repl-summary-card-link"
                    title="Открыть в словаре"
                    onClick={() => onSearchWord(target)}
                  >
                    <ExternalLink />
                  </button>
                </div>
                <div className="reson-vocab-repl-summary-card-meta">
                  <span className="reson-vocab-repl-summary-card-label">Всего замен:</span>
                  <span className="reson-vocab-repl-summary-count-badge">{totalCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
