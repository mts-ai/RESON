import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Info,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
} from './icons';
import { RangeSlider } from './ui/range-slider';
import { VocabularyWord } from './VocabularyComparison';
import { PageSizeSelect } from './ui/PageSizeSelect';
import { useTheme } from './ThemeProvider';
import { VocabSectionHint } from './vocabulary/VocabSectionHint';
import { INTERACTIVE_DICT_HINT_ITEMS, vocabularySubtabClass } from '../utils/vocabularyHelpers';

interface ModelInfo {
  name: string;
  displayName: string;
}

import type { VocabSubTab, VocabTableFilters } from '../utils/hashNavigation';

interface VocabularyComparisonTableProps {
  words: VocabularyWord[];
  selectedModels: string[];
  availableModels: ModelInfo[];
  onWordClick: (word: VocabularyWord) => void;
  initialSearchQuery?: string;
  initialTableFilters?: VocabTableFilters;
  onTableRouteChange?: (filters: VocabTableFilters) => void;
}

type SortField =
  | 'word'
  | 'frequency'
  | 'recall'
  | 'precision'
  | 'f1'
  | 'wis'
  | 'deletions'
  | 'substitutions'
  | 'insertions';
type SortDirection = 'asc' | 'desc';
type ChangeFilter = 'all' | 'improved' | 'worsened' | 'unchanged';
type ChangeMetric = 'recall' | 'precision' | 'f1Score';

const CHANGE_METRIC_OPTIONS: Array<{ id: ChangeMetric; label: string }> = [
  { id: 'recall', label: 'Recall' },
  { id: 'precision', label: 'Precision' },
  { id: 'f1Score', label: 'F1-score' },
];

type ProcessedWord = VocabularyWord & {
  recallDelta: number;
  precisionDelta: number;
  f1Delta: number;
  wisDelta: number;
  changeType: 'improved' | 'worsened' | 'unchanged';
};

const TYPE_FILTER_OPTIONS = [
  { id: 'all', label: 'Все типы' },
  { id: 'russian', label: 'RU', badgeClass: 'reson-vocab-type-badge--russian' },
  { id: 'english', label: 'EN', badgeClass: 'reson-vocab-type-badge--english' },
  { id: 'number', label: '№', badgeClass: 'reson-vocab-type-badge--number' },
  { id: 'other', label: '?', badgeClass: 'reson-vocab-type-badge--other' },
] as const;

const METRIC_COLUMNS = {
  recall: { pillClass: 'reson-vocab-metric-pill--recall', barColor: '#3B82F6' },
  precision: { pillClass: 'reson-vocab-metric-pill--precision', barColor: '#10B981' },
  f1: { pillClass: 'reson-vocab-metric-pill--f1', barColor: '#8B5CF6' },
} as const;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function getWisBadgeClass(wis: number): string {
  if (wis < 30) return 'reson-vocab-wis-badge--low';
  if (wis < 45) return 'reson-vocab-wis-badge--moderate';
  if (wis < 60) return 'reson-vocab-wis-badge--medium';
  if (wis < 75) return 'reson-vocab-wis-badge--high';
  return 'reson-vocab-wis-badge--critical';
}

function getMetricValue(
  metrics: VocabularyWord['modelMetrics'][string] | undefined,
  metric: ChangeMetric,
): number {
  if (!metrics) return 0;
  return metric === 'f1Score' ? metrics.f1Score : metrics[metric];
}

function getChangeDelta(
  baseMetrics: VocabularyWord['modelMetrics'][string] | undefined,
  targetMetrics: VocabularyWord['modelMetrics'][string] | undefined,
  metric: ChangeMetric,
): number {
  return getMetricValue(targetMetrics, metric) - getMetricValue(baseMetrics, metric);
}

function MetricDeltaLine({
  delta,
  invert = false,
  threshold = 0.01,
  decimals = 1,
  suffix = ' п.п.',
}: {
  delta: number;
  invert?: boolean;
  threshold?: number;
  decimals?: number;
  suffix?: string;
}) {
  if (Math.abs(delta) < threshold) {
    return (
      <span className="reson-vocab-table-metric-delta reson-vocab-table-metric-delta--neutral">
        Δ 0{suffix}
      </span>
    );
  }

  const isPositive = invert ? delta < 0 : delta > 0;

  return (
    <span
      className={`reson-vocab-table-metric-delta ${
        isPositive
          ? 'reson-vocab-table-metric-delta--up'
          : 'reson-vocab-table-metric-delta--down'
      }`}
    >
      Δ {delta > 0 ? '+' : ''}
      {delta.toFixed(decimals)}
      {suffix}
    </span>
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
    <td>
      <div className="reson-vocab-metric-cell reson-vocab-table-metric-cell">
        <div
          className="reson-vocab-metric-bar-track"
          title={`Base ${baseValue.toFixed(1)}% → Target ${targetValue.toFixed(1)}%`}
        >
          <div
            className="reson-vocab-metric-bar-base"
            style={{ width: `${clampPercent(baseValue)}%` }}
          />
          <div
            className="reson-vocab-metric-bar-target"
            style={{
              width: `${clampPercent(targetValue)}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
        <div className="reson-vocab-table-metric-main">
          <span className="reson-vocab-table-metric-label">Target</span>
          <span className={`reson-vocab-metric-pill ${pillClass}`}>
            {targetValue.toFixed(1)}%
          </span>
        </div>
        <MetricDeltaLine delta={delta} />
      </div>
    </td>
  );
}

function WisMetricCell({
  baseValue,
  targetValue,
  delta,
}: {
  baseValue: number;
  targetValue: number;
  delta: number;
}) {
  return (
    <td>
      <div className="reson-vocab-metric-cell reson-vocab-table-metric-cell">
        <div
          className="reson-vocab-metric-bar-track"
          title={`Base ${baseValue.toFixed(1)} → Target ${targetValue.toFixed(1)}`}
        >
          <div
            className="reson-vocab-metric-bar-base"
            style={{ width: `${clampPercent(baseValue)}%` }}
          />
          <div
            className="reson-vocab-metric-bar-target"
            style={{
              width: `${clampPercent(targetValue)}%`,
              backgroundColor: '#f59e0b',
            }}
          />
        </div>
        <div className="reson-vocab-table-metric-main">
          <span className="reson-vocab-table-metric-label">Target</span>
          <span className={`reson-vocab-wis-badge ${getWisBadgeClass(targetValue)}`}>
            {targetValue.toFixed(1)}
          </span>
        </div>
        <MetricDeltaLine delta={delta} invert suffix="" />
      </div>
    </td>
  );
}

function ErrorMetricCell({
  baseValue,
  targetValue,
  tone,
}: {
  baseValue: number;
  targetValue: number;
  tone: 'del' | 'sub' | 'ins';
}) {
  const delta = targetValue - baseValue;

  return (
    <td className="reson-vocab-td-right">
      <div className="reson-vocab-error-cell reson-vocab-table-metric-cell">
        <div className="reson-vocab-table-metric-main reson-vocab-table-metric-main--right">
          <span className="reson-vocab-table-metric-label">Target</span>
          <span className={`reson-vocab-error-value reson-vocab-error-value--${tone}`}>
            {targetValue.toLocaleString()}
          </span>
        </div>
        <MetricDeltaLine delta={delta} invert threshold={1} decimals={0} suffix="" />
      </div>
    </td>
  );
}

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function VocabularyComparisonTable({
  words,
  selectedModels,
  availableModels,
  onWordClick,
  initialSearchQuery = '',
  initialTableFilters,
  onTableRouteChange,
}: VocabularyComparisonTableProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [sortField, setSortField] = useState<SortField>('recall');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [changeMetric, setChangeMetric] = useState<ChangeMetric>('recall');
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>(
    initialTableFilters?.change ?? 'all',
  );
  const [typeFilter, setTypeFilter] = useState<string>(initialTableFilters?.type ?? 'all');
  const [currentPage, setCurrentPage] = useState(initialTableFilters?.page ?? 1);
  const [itemsPerPage, setItemsPerPage] = useState(initialTableFilters?.size ?? 25);
  const skipRouteSyncRef = React.useRef(true);

  React.useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      setCurrentPage(1);
    }
  }, [initialSearchQuery]);

  React.useEffect(() => {
    if (!initialTableFilters) return;
    if (initialTableFilters.q !== undefined) setSearchQuery(initialTableFilters.q);
    if (initialTableFilters.change) setChangeFilter(initialTableFilters.change);
    if (initialTableFilters.type) setTypeFilter(initialTableFilters.type);
    if (initialTableFilters.page) setCurrentPage(initialTableFilters.page);
    if (initialTableFilters.size) setItemsPerPage(initialTableFilters.size);
    skipRouteSyncRef.current = true;
  }, [initialTableFilters]);

  React.useEffect(() => {
    if (!onTableRouteChange) return;
    if (skipRouteSyncRef.current) {
      skipRouteSyncRef.current = false;
      return;
    }

    onTableRouteChange({
      q: searchQuery.trim() || undefined,
      change: changeFilter !== 'all' ? changeFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      page: currentPage > 1 ? currentPage : undefined,
      size: itemsPerPage !== 25 ? itemsPerPage : undefined,
    });
  }, [searchQuery, changeFilter, typeFilter, currentPage, itemsPerPage, onTableRouteChange]);

  const baseModel = selectedModels[0];
  const targetModel = selectedModels[selectedModels.length - 1];

  const filterBounds = useMemo(() => {
    const frequencies = words.map(w => w.frequency);
    const lengths = words.map(w => w.word.length);

    return {
      frequency: { min: 0, max: Math.max(...frequencies, 1) },
      length: { min: 0, max: Math.max(...lengths, 1) }
    };
  }, [words]);

  const [frequencyRange, setFrequencyRange] = useState<[number, number]>([0, 1]);
  const [lengthRange, setLengthRange] = useState<[number, number]>([0, 1]);

  React.useEffect(() => {
    setFrequencyRange([filterBounds.frequency.min, filterBounds.frequency.max]);
    setLengthRange([filterBounds.length.min, filterBounds.length.max]);
  }, [filterBounds]);

  const processedWords = useMemo<ProcessedWord[]>(() => {
    return words.map(word => {
      const baseMetrics = word.modelMetrics[baseModel];
      const targetMetrics = word.modelMetrics[targetModel];

      const recallDelta = getChangeDelta(baseMetrics, targetMetrics, 'recall');
      const precisionDelta = getChangeDelta(baseMetrics, targetMetrics, 'precision');
      const f1Delta = getChangeDelta(baseMetrics, targetMetrics, 'f1Score');
      const wisDelta = targetMetrics ? (targetMetrics.wis - (baseMetrics?.wis || 0)) : 0;
      const metricDelta = getChangeDelta(baseMetrics, targetMetrics, changeMetric);

      let changeType: 'improved' | 'worsened' | 'unchanged';
      if (metricDelta > 0.5) changeType = 'improved';
      else if (metricDelta < -0.5) changeType = 'worsened';
      else changeType = 'unchanged';

      return {
        ...word,
        recallDelta,
        precisionDelta,
        f1Delta,
        wisDelta,
        changeType
      };
    });
  }, [words, baseModel, targetModel, changeMetric]);

  const filteredWords = useMemo(() => {
    let filtered = [...processedWords];

    if (searchQuery) {
      filtered = filtered.filter(w =>
        w.word.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (changeFilter !== 'all') {
      filtered = filtered.filter(w => w.changeType === changeFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(w => w.type === typeFilter);
    }

    filtered = filtered.filter(w =>
      w.frequency >= frequencyRange[0] && w.frequency <= frequencyRange[1]
    );

    filtered = filtered.filter(w =>
      w.word.length >= lengthRange[0] && w.word.length <= lengthRange[1]
    );

    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortField === 'word') {
        aVal = a.word;
        bVal = b.word;
      } else if (sortField === 'frequency') {
        aVal = a.frequency;
        bVal = b.frequency;
      } else if (sortField === 'recall') {
        aVal = a.modelMetrics[targetModel]?.recall ?? 0;
        bVal = b.modelMetrics[targetModel]?.recall ?? 0;
      } else if (sortField === 'precision') {
        aVal = a.modelMetrics[targetModel]?.precision ?? 0;
        bVal = b.modelMetrics[targetModel]?.precision ?? 0;
      } else if (sortField === 'f1') {
        aVal = a.modelMetrics[targetModel]?.f1Score ?? 0;
        bVal = b.modelMetrics[targetModel]?.f1Score ?? 0;
      } else if (sortField === 'deletions') {
        aVal = a.modelMetrics[targetModel]?.deletions ?? 0;
        bVal = b.modelMetrics[targetModel]?.deletions ?? 0;
      } else if (sortField === 'substitutions') {
        aVal = a.modelMetrics[targetModel]?.substitutions ?? 0;
        bVal = b.modelMetrics[targetModel]?.substitutions ?? 0;
      } else if (sortField === 'insertions') {
        aVal = a.modelMetrics[targetModel]?.insertions ?? 0;
        bVal = b.modelMetrics[targetModel]?.insertions ?? 0;
      } else {
        aVal = a.modelMetrics[targetModel]?.wis ?? 0;
        bVal = b.modelMetrics[targetModel]?.wis ?? 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return filtered;
  }, [processedWords, searchQuery, changeFilter, typeFilter, frequencyRange, lengthRange, sortField, sortDirection, baseModel, targetModel]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / itemsPerPage));
  const paginatedWords = filteredWords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setFrequencyRange([filterBounds.frequency.min, filterBounds.frequency.max]);
    setLengthRange([filterBounds.length.min, filterBounds.length.max]);
    setChangeFilter('all');
    setChangeMetric('recall');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    typeFilter !== 'all' ||
    frequencyRange[0] !== filterBounds.frequency.min ||
    frequencyRange[1] !== filterBounds.frequency.max ||
    lengthRange[0] !== filterBounds.length.min ||
    lengthRange[1] !== filterBounds.length.max ||
    changeFilter !== 'all';

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown />;
    return sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />;
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'russian': return 'reson-vocab-type-badge--russian';
      case 'english': return 'reson-vocab-type-badge--english';
      case 'number': return 'reson-vocab-type-badge--number';
      default: return 'reson-vocab-type-badge--other';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'russian': return 'RU';
      case 'english': return 'EN';
      case 'number': return '№';
      default: return '?';
    }
  };

  const getChangeTypeLabel = (changeType: ProcessedWord['changeType']) => {
    switch (changeType) {
      case 'improved': return 'Улучшено';
      case 'worsened': return 'Ухудшено';
      default: return 'Без изменений';
    }
  };

  const baseModelName = availableModels.find(m => m.name === baseModel)?.displayName || baseModel;
  const targetModelName = availableModels.find(m => m.name === targetModel)?.displayName || targetModel;

  const buildExportRows = () =>
    filteredWords.map((word) => {
      const baseMetrics = word.modelMetrics[baseModel];
      const targetMetrics = word.modelMetrics[targetModel];
      const recallDelta = targetMetrics ? (targetMetrics.recall - (baseMetrics?.recall || 0)) : 0;
      const precisionDelta = targetMetrics ? (targetMetrics.precision - (baseMetrics?.precision || 0)) : 0;

      return {
        word: word.word,
        type: word.type,
        frequency: word.frequency,
        baseRecall: baseMetrics?.recall ?? 0,
        targetRecall: targetMetrics?.recall ?? 0,
        recallDelta,
        basePrecision: baseMetrics?.precision ?? 0,
        targetPrecision: targetMetrics?.precision ?? 0,
        precisionDelta,
        baseF1: baseMetrics?.f1Score ?? 0,
        targetF1: targetMetrics?.f1Score ?? 0,
        f1Delta: word.f1Delta,
        baseWis: baseMetrics?.wis ?? 0,
        targetWis: targetMetrics?.wis ?? 0,
        wisDelta: word.wisDelta,
        baseDeletions: baseMetrics?.deletions ?? 0,
        targetDeletions: targetMetrics?.deletions ?? 0,
        deletionsDelta: (targetMetrics?.deletions ?? 0) - (baseMetrics?.deletions ?? 0),
        baseSubstitutions: baseMetrics?.substitutions ?? 0,
        targetSubstitutions: targetMetrics?.substitutions ?? 0,
        substitutionsDelta: (targetMetrics?.substitutions ?? 0) - (baseMetrics?.substitutions ?? 0),
        baseInsertions: baseMetrics?.insertions ?? 0,
        targetInsertions: targetMetrics?.insertions ?? 0,
        insertionsDelta: (targetMetrics?.insertions ?? 0) - (baseMetrics?.insertions ?? 0),
        changeType: getChangeTypeLabel(word.changeType),
      };
    });

  const exportToCSV = () => {
    const headers = [
      'Слово',
      'Тип',
      'Частота',
      `Recall Base (${baseModelName})`,
      `Recall Target (${targetModelName})`,
      'Δ Recall',
      `Precision Base (${baseModelName})`,
      `Precision Target (${targetModelName})`,
      'Δ Precision',
      `F1 Base (${baseModelName})`,
      `F1 Target (${targetModelName})`,
      'Δ F1',
      `WIS Base (${baseModelName})`,
      `WIS Target (${targetModelName})`,
      'Δ WIS',
      `Удаления Base (${baseModelName})`,
      `Удаления Target (${targetModelName})`,
      'Δ Удаления',
      `Замены Base (${baseModelName})`,
      `Замены Target (${targetModelName})`,
      'Δ Замены',
      `Вставки Base (${baseModelName})`,
      `Вставки Target (${targetModelName})`,
      'Δ Вставки',
      'Изменение',
    ];

    const rows = buildExportRows().map((row) => [
      row.word,
      row.type,
      row.frequency,
      row.baseRecall.toFixed(2),
      row.targetRecall.toFixed(2),
      row.recallDelta.toFixed(2),
      row.basePrecision.toFixed(2),
      row.targetPrecision.toFixed(2),
      row.precisionDelta.toFixed(2),
      row.baseF1.toFixed(2),
      row.targetF1.toFixed(2),
      row.f1Delta.toFixed(2),
      row.baseWis.toFixed(2),
      row.targetWis.toFixed(2),
      row.wisDelta.toFixed(2),
      row.baseDeletions,
      row.targetDeletions,
      row.deletionsDelta,
      row.baseSubstitutions,
      row.targetSubstitutions,
      row.substitutionsDelta,
      row.baseInsertions,
      row.targetInsertions,
      row.insertionsDelta,
      row.changeType,
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vocabulary_compare_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const jsonData = {
      exportDate: new Date().toISOString(),
      baseModel,
      targetModel,
      totalWords: filteredWords.length,
      data: buildExportRows(),
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vocabulary_compare_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3" data-tour="vocabulary-table">
      <div className="reson-vocab-table-toolbar">
        <button type="button" className="reson-vocab-export-btn" onClick={exportToCSV}>
          <Download />
          CSV
        </button>
        <button type="button" className="reson-vocab-export-btn" onClick={exportToJSON}>
          <Download />
          JSON
        </button>
      </div>

      <div className="reson-vocab-card" data-tour="vocabulary-analytics-filters">
        <div className="reson-vocab-section-header mb-3">
          <div className="min-w-0">
            <h3
              className={`reson-vocab-panel-title reson-vocab-panel-title--sm mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Фильтры словаря
            </h3>
            <p className="reson-vocab-panel-desc mb-0">
              Поиск, тип слова и фильтры изменений Base vs Target
            </p>
          </div>
          <VocabSectionHint
            isDark={isDark}
            triggerText="Что означают эти метрики?"
            panelTitle="Столбцы таблицы"
            panelSubtitle="Кратко о числовых метриках"
            panelAriaLabel="Пояснение метрик интерактивного словаря"
            items={INTERACTIVE_DICT_HINT_ITEMS}
            scrollable
          />
        </div>

        <div className="mb-4">
          <label className="reson-vocab-filter-label" htmlFor="vocab-table-search">
            Поиск слова
          </label>
          <div className="reson-vocab-search-wrap">
            <Search />
            <input
              id="vocab-table-search"
              type="text"
              placeholder="Введите слово для поиска..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="reson-vocab-search-input"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="reson-vocab-filter-label">Тип слова</label>
          <div className="reson-vocab-type-chips">
            {TYPE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`reson-vocab-type-chip ${
                  typeFilter === option.id ? 'reson-vocab-type-chip--active' : ''
                } ${'badgeClass' in option ? option.badgeClass : ''}`}
                onClick={() => {
                  setTypeFilter(option.id);
                  setCurrentPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="reson-vocab-filters-body">
          <div className="reson-vocab-filters-sliders">
            <div className="reson-vocab-range-box">
              <div className="reson-vocab-range-box-label">
                <span>Частота</span>
                <span>{frequencyRange[0]} – {frequencyRange[1]}</span>
              </div>
              <RangeSlider
                value={frequencyRange}
                onValueChange={(val) => {
                  setFrequencyRange(val);
                  setCurrentPage(1);
                }}
                min={filterBounds.frequency.min}
                max={filterBounds.frequency.max}
                step={1}
              />
            </div>

            <div className="reson-vocab-range-box">
              <div className="reson-vocab-range-box-label">
                <span>Длина слова</span>
                <span>{lengthRange[0]} – {lengthRange[1]}</span>
              </div>
              <RangeSlider
                value={lengthRange}
                onValueChange={(val) => {
                  setLengthRange(val);
                  setCurrentPage(1);
                }}
                min={filterBounds.length.min}
                max={filterBounds.length.max}
                step={1}
              />
            </div>
          </div>

          <div className="reson-vocab-filters-changes">
            <div className="reson-vocab-change-filter-head">
              <label className="reson-vocab-filter-label">
                Фильтр по изменениям
              </label>
              <div className="reson-vocab-top-metrics">
                {CHANGE_METRIC_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={vocabularySubtabClass(changeMetric === option.id, isDark)}
                    onClick={() => {
                      setChangeMetric(option.id);
                      setCurrentPage(1);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="reson-vocab-change-grid">
              <button
                type="button"
                className={`reson-vocab-change-btn reson-vocab-change-btn--grid ${changeFilter === 'all' ? 'reson-vocab-change-btn--active' : ''}`}
                onClick={() => { setChangeFilter('all'); setCurrentPage(1); }}
              >
                Все ({processedWords.length})
              </button>
              <button
                type="button"
                className={`reson-vocab-change-btn reson-vocab-change-btn--grid ${changeFilter === 'unchanged' ? 'reson-vocab-change-btn--active' : ''}`}
                onClick={() => { setChangeFilter('unchanged'); setCurrentPage(1); }}
              >
                Без изм. ({processedWords.filter(w => w.changeType === 'unchanged').length})
              </button>
              <button
                type="button"
                className={`reson-vocab-change-btn reson-vocab-change-btn--grid ${changeFilter === 'improved' ? 'reson-vocab-change-btn--active-improved' : ''}`}
                onClick={() => { setChangeFilter('improved'); setCurrentPage(1); }}
              >
                <TrendingUp className="w-3 h-3" />
                Улучш. ({processedWords.filter(w => w.changeType === 'improved').length})
              </button>
              <button
                type="button"
                className={`reson-vocab-change-btn reson-vocab-change-btn--grid ${changeFilter === 'worsened' ? 'reson-vocab-change-btn--active-worsened' : ''}`}
                onClick={() => { setChangeFilter('worsened'); setCurrentPage(1); }}
              >
                <TrendingDown className="w-3 h-3" />
                Ухудш. ({processedWords.filter(w => w.changeType === 'worsened').length})
              </button>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="reson-vocab-active-filters">
            <span className="reson-vocab-filter-label reson-vocab-filter-label--inline">Активные:</span>
            <span className="reson-vocab-active-filters-badge">
              {[
                searchQuery && 'Поиск',
                typeFilter !== 'all' && 'Тип',
                (frequencyRange[0] !== filterBounds.frequency.min || frequencyRange[1] !== filterBounds.frequency.max) && 'Частота',
                (lengthRange[0] !== filterBounds.length.min || lengthRange[1] !== filterBounds.length.max) && 'Длина',
                changeFilter !== 'all' && 'Изменения'
              ].filter(Boolean).join(', ')}
            </span>
            <button type="button" className="reson-vocab-reset-btn" onClick={handleResetFilters}>
              <X className="w-3 h-3" />
              Сбросить
            </button>
          </div>
        )}
      </div>

      <div className="reson-vocab-results-bar">
        <div>
          {filteredWords.length > 0 ? (
            <>
              Отображено:{' '}
              <strong>{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredWords.length)}</strong>
              {' '}из <strong>{filteredWords.length}</strong>
            </>
          ) : (
            <span className="reson-delta-warn">Нет результатов по заданным фильтрам</span>
          )}
        </div>
        <div className="reson-vocab-results-meta">
          <span className="reson-vocab-help-badge">Target — основное значение; Δ — абсолютная разница</span>
          <span>{baseModelName} → {targetModelName}</span>
        </div>
      </div>

      <div className="reson-vocab-card reson-vocab-table-wrap">
        <table className="reson-vocab-stats-table reson-vocab-interactive-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('word')}>
                  Слово
                  <SortIcon field="word" />
                </button>
              </th>
              <th>Тип</th>
              <th className="reson-vocab-th-right">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('frequency')}>
                  Частота
                  <SortIcon field="frequency" />
                </button>
              </th>
              <th className="reson-vocab-th-metric">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('recall')}>
                  Recall
                  <SortIcon field="recall" />
                </button>
              </th>
              <th className="reson-vocab-th-metric">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('precision')}>
                  Precision
                  <SortIcon field="precision" />
                </button>
              </th>
              <th className="reson-vocab-th-metric">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('f1')}>
                  F1-score
                  <SortIcon field="f1" />
                </button>
              </th>
              <th className="reson-vocab-th-right">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('deletions')}>
                  Удаления
                  <SortIcon field="deletions" />
                </button>
              </th>
              <th className="reson-vocab-th-right">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('substitutions')}>
                  Замены
                  <SortIcon field="substitutions" />
                </button>
              </th>
              <th className="reson-vocab-th-right">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('insertions')}>
                  Вставки
                  <SortIcon field="insertions" />
                </button>
              </th>
              <th className="reson-vocab-th-metric">
                <button type="button" className="reson-vocab-table-sort-btn" onClick={() => handleSort('wis')}>
                  WIS
                  <SortIcon field="wis" />
                </button>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {paginatedWords.map((word, idx) => {
              const baseMetrics = word.modelMetrics[baseModel];
              const targetMetrics = word.modelMetrics[targetModel];
              const recallDelta = word.recallDelta;
              const precisionDelta = word.precisionDelta;

              return (
                <tr
                  key={`${word.word}-${idx}`}
                  onClick={() => onWordClick(word)}
                  className="reson-vocab-table-row"
                  data-tour={idx === 0 ? 'vocabulary-table-row' : undefined}
                >
                  <td>
                    <span className="reson-vocab-table-word">{word.word}</span>
                  </td>
                  <td>
                    <span className={`reson-vocab-type-badge ${getTypeBadgeClass(word.type)}`}>
                      {getTypeLabel(word.type)}
                    </span>
                  </td>
                  <td className="reson-vocab-td-right tabular-nums">
                    {word.frequency.toLocaleString()}
                  </td>
                  <MetricCell
                    baseValue={baseMetrics?.recall ?? 0}
                    targetValue={targetMetrics?.recall ?? 0}
                    delta={recallDelta}
                    pillClass={METRIC_COLUMNS.recall.pillClass}
                    barColor={METRIC_COLUMNS.recall.barColor}
                  />
                  <MetricCell
                    baseValue={baseMetrics?.precision ?? 0}
                    targetValue={targetMetrics?.precision ?? 0}
                    delta={precisionDelta}
                    pillClass={METRIC_COLUMNS.precision.pillClass}
                    barColor={METRIC_COLUMNS.precision.barColor}
                  />
                  <MetricCell
                    baseValue={baseMetrics?.f1Score ?? 0}
                    targetValue={targetMetrics?.f1Score ?? 0}
                    delta={word.f1Delta}
                    pillClass={METRIC_COLUMNS.f1.pillClass}
                    barColor={METRIC_COLUMNS.f1.barColor}
                  />
                  <ErrorMetricCell
                    baseValue={baseMetrics?.deletions ?? 0}
                    targetValue={targetMetrics?.deletions ?? 0}
                    tone="del"
                  />
                  <ErrorMetricCell
                    baseValue={baseMetrics?.substitutions ?? 0}
                    targetValue={targetMetrics?.substitutions ?? 0}
                    tone="sub"
                  />
                  <ErrorMetricCell
                    baseValue={baseMetrics?.insertions ?? 0}
                    targetValue={targetMetrics?.insertions ?? 0}
                    tone="ins"
                  />
                  <WisMetricCell
                    baseValue={baseMetrics?.wis ?? 0}
                    targetValue={targetMetrics?.wis ?? 0}
                    delta={word.wisDelta}
                  />
                  <td className="reson-vocab-td-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onWordClick(word);
                      }}
                      title="Подробнее о слове"
                      className={`reson-vocab-table-detail-btn ${idx === 0 ? 'reson-vocab-table-detail-btn--visible' : ''}`}
                    >
                      <Info />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="reson-vocab-pagination">
        <PageSizeSelect
          value={itemsPerPage}
          onChange={(size) => {
            setItemsPerPage(size);
            setCurrentPage(1);
          }}
          id="vocab-table-page-size"
        />
        <div className="reson-vocab-pagination-controls">
          <button
            type="button"
            className="reson-vocab-page-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft />
            Предыдущая
          </button>
          <span>Страница {currentPage} из {totalPages}</span>
          <button
            type="button"
            className="reson-vocab-page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Следующая
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
