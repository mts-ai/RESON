import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMemo, useState } from 'react';
import { VocabularyWord, WisComponentsUi, WordMetrics } from './VocabularyComparison';
import { AlertCircle, X, BookOpen, ChevronDown, ChevronUp } from './icons';
import { VisuallyHidden } from './VisuallyHidden';
import { WordErrorDrillDown } from './WordErrorDrillDown';
import type { CompareManifestEntry } from '../utils/wordErrorHelpers';
import { hasErrorExamples } from '../utils/wordErrorHelpers';

interface ModelInfo {
  name: string;
  displayName: string;
}

interface WordDetailModalProps {
  word: VocabularyWord;
  selectedModels: string[];
  availableModels: ModelInfo[];
  manifestData?: Record<string, CompareManifestEntry[]>;
  audioBasePath?: string;
  onClose: () => void;
}

type LegacyWisComponents = {
  frequencyScore?: number;
  errorSeverity?: number;
  errorCriticality?: number;
  substitutionDiversity?: number;
};

const METRIC_COLUMNS = {
  recall: { pillClass: 'reson-vocab-metric-pill--recall', barColor: '#3B82F6' },
  precision: { pillClass: 'reson-vocab-metric-pill--precision', barColor: '#10B981' },
  f1: { pillClass: 'reson-vocab-metric-pill--f1', barColor: '#8B5CF6' },
} as const;

type RankMetric = 'f1Score' | 'recall' | 'precision';

const RANK_METRIC_OPTIONS: Array<{ id: RankMetric; label: string }> = [
  { id: 'f1Score', label: 'F1' },
  { id: 'recall', label: 'Recall' },
  { id: 'precision', label: 'Precision' },
];

const WIS_COMPONENTS = [
  {
    key: 'frequency' as const,
    label: 'Частота',
    barClass: 'reson-word-wis-bar--frequency',
  },
  {
    key: 'errorSeverity' as const,
    label: 'Серьёзность ошибок',
    barClass: 'reson-word-wis-bar--severity',
  },
  {
    key: 'errorCriticality' as const,
    label: 'Критичность ошибок',
    barClass: 'reson-word-wis-bar--criticality',
  },
  {
    key: 'substitutionVariability' as const,
    label: 'Вариативность замен',
    barClass: 'reson-word-wis-bar--substitution',
  },
];

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function getTypeBadgeClass(type: string): string {
  switch (type) {
    case 'russian': return 'reson-vocab-type-badge--russian';
    case 'english': return 'reson-vocab-type-badge--english';
    case 'number': return 'reson-vocab-type-badge--number';
    default: return 'reson-vocab-type-badge--other';
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'russian': return 'RU';
    case 'english': return 'EN';
    case 'number': return '№';
    default: return '?';
  }
}

function getWisTier(wis: number): 'low' | 'moderate' | 'medium' | 'high' | 'critical' {
  if (wis < 30) return 'low';
  if (wis < 45) return 'moderate';
  if (wis < 60) return 'medium';
  if (wis < 75) return 'high';
  return 'critical';
}

function getWisBadgeClass(wis: number): string {
  return `reson-vocab-wis-badge--${getWisTier(wis)}`;
}

function getWisLabel(wis: number): string {
  if (wis < 30) return 'Маленький';
  if (wis < 45) return 'Умеренный';
  if (wis < 60) return 'Средний';
  if (wis < 75) return 'Высокий';
  return 'Критический';
}

function deltaClass(value: number, invert = false): string {
  if (Math.abs(value) < 0.005) return '';
  const positive = invert ? value < 0 : value > 0;
  return positive ? 'reson-delta-good' : 'reson-delta-bad';
}

function normalizeWisComponents(
  raw?: WisComponentsUi | LegacyWisComponents | null,
): WisComponentsUi | null {
  if (!raw) return null;

  if ('frequency' in raw && typeof raw.frequency === 'object' && raw.frequency !== null) {
    return raw as WisComponentsUi;
  }

  const legacy = raw as LegacyWisComponents;
  return {
    frequency: { value: legacy.frequencyScore ?? 0, weight: 25 },
    errorSeverity: { value: legacy.errorSeverity ?? 0, weight: 35 },
    errorCriticality: { value: legacy.errorCriticality ?? 0, weight: 25 },
    substitutionVariability: { value: legacy.substitutionDiversity ?? 0, weight: 15 },
  };
}

function DeltaChip({
  delta,
  invert = false,
  threshold = 0.01,
  decimals = 1,
}: {
  delta: number;
  invert?: boolean;
  threshold?: number;
  decimals?: number;
}) {
  if (!Number.isFinite(delta) || Math.abs(delta) < threshold) return null;

  const isPositive = invert ? delta < 0 : delta > 0;

  return (
    <span
      className={`reson-vocab-metric-delta-chip ${
        isPositive ? 'reson-vocab-metric-delta-chip--up' : 'reson-vocab-metric-delta-chip--down'
      }`}
    >
      {delta > 0 ? '+' : ''}
      {delta.toFixed(decimals)}
    </span>
  );
}

function ModelRoleBadge({ role }: { role: 'base' | 'target' | 'optional' }) {
  const labels = { base: 'Base', target: 'Target', optional: 'Optional' };
  return (
    <span className={`reson-word-role-badge reson-word-role-badge--${role}`}>
      {labels[role]}
    </span>
  );
}

function ModalMetricCell({
  baseValue,
  modelValue,
  delta,
  invertDelta = false,
  format = 'percent',
  barColor,
  pillClass,
}: {
  baseValue: number;
  modelValue: number;
  delta: number;
  invertDelta?: boolean;
  format?: 'percent' | 'wis';
  barColor: string;
  pillClass?: string;
}) {
  const formattedValue =
    format === 'percent' ? `${modelValue.toFixed(1)}%` : modelValue.toFixed(1);

  return (
    <div className="reson-vocab-metric-cell reson-word-modal-metric-cell">
      <div
        className="reson-vocab-metric-bar-track"
        title={`Base ${baseValue.toFixed(1)} → ${modelValue.toFixed(1)}`}
      >
        <div
          className="reson-vocab-metric-bar-base"
          style={{ width: `${clampPercent(baseValue)}%` }}
        />
        <div
          className="reson-vocab-metric-bar-target"
          style={{
            width: `${clampPercent(modelValue)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <div className="reson-vocab-metric-cell-values">
        {format === 'wis' ? (
          <span className={`reson-vocab-wis-badge ${getWisBadgeClass(modelValue)}`}>
            {formattedValue}
          </span>
        ) : (
          <span className={`reson-vocab-metric-pill ${pillClass}`}>{formattedValue}</span>
        )}
        <DeltaChip delta={delta} invert={invertDelta} />
      </div>
    </div>
  );
}

function WisComponentCard({
  label,
  barClass,
  target,
  base,
  invertDelta = false,
  showDelta = false,
}: {
  label: string;
  barClass: string;
  target: { value: number; weight: number };
  base?: { value: number; weight: number };
  invertDelta?: boolean;
  showDelta?: boolean;
}) {
  const targetValue = Number.isFinite(target.value) ? target.value : 0;
  const baseValue = base && Number.isFinite(base.value) ? base.value : null;
  const delta = baseValue !== null ? targetValue - baseValue : 0;

  return (
    <div className="reson-word-wis-component">
      <div className="reson-word-wis-component-head">
        <span className="reson-word-wis-component-label">
          <span className={`reson-word-wis-dot ${barClass}`} />
          {label}
          <span className="reson-word-wis-weight">вес {target.weight}%</span>
        </span>
        <span className="reson-word-wis-component-value">
          {targetValue.toFixed(1)}
          {showDelta && baseValue !== null && (
            <DeltaChip delta={delta} invert={invertDelta} threshold={0.05} />
          )}
        </span>
      </div>
      <div className="reson-word-wis-bar-track">
        <div
          className={`reson-word-wis-bar ${barClass}`}
          style={{ width: `${clampPercent(targetValue)}%` }}
        />
      </div>
    </div>
  );
}

export function WordDetailModal({
  word,
  selectedModels,
  availableModels,
  manifestData = {},
  audioBasePath,
  onClose,
}: WordDetailModalProps) {
  const [drillDownModel, setDrillDownModel] = useState(
    () => selectedModels[selectedModels.length - 1] ?? selectedModels[0] ?? '',
  );
  const [rankMetric, setRankMetric] = useState<RankMetric>('f1Score');

  const baseModel = selectedModels[0];
  const targetModel = selectedModels[selectedModels.length - 1];
  const baseMetrics = word.modelMetrics[baseModel];
  const targetMetrics = word.modelMetrics[targetModel];

  const baseModelName = availableModels.find(m => m.name === baseModel)?.displayName || baseModel;
  const targetModelName = availableModels.find(m => m.name === targetModel)?.displayName || targetModel;

  const f1Delta = targetMetrics && baseMetrics ? targetMetrics.f1Score - baseMetrics.f1Score : 0;
  const recallDelta = targetMetrics && baseMetrics ? targetMetrics.recall - baseMetrics.recall : 0;
  const precisionDelta = targetMetrics && baseMetrics ? targetMetrics.precision - baseMetrics.precision : 0;
  const wisDelta = targetMetrics && baseMetrics ? targetMetrics.wis - baseMetrics.wis : 0;
  const targetWis = targetMetrics?.wis ?? 0;

  const targetWisComponents = normalizeWisComponents(targetMetrics?.wisComponents);
  const baseWisComponents = normalizeWisComponents(baseMetrics?.wisComponents);

  const modelsByF1 = selectedModels
    .map(modelName => ({
      modelName,
      displayName: availableModels.find(m => m.name === modelName)?.displayName || modelName,
      metrics: word.modelMetrics[modelName],
    }))
    .filter(m => m.metrics)
    .sort((a, b) => (b.metrics?.f1Score || 0) - (a.metrics?.f1Score || 0));

  const modelsByRank = useMemo(
    () => selectedModels
      .map(modelName => ({
        modelName,
        displayName: availableModels.find(m => m.name === modelName)?.displayName || modelName,
        metrics: word.modelMetrics[modelName],
      }))
      .filter(m => m.metrics)
      .sort((a, b) => (b.metrics?.[rankMetric] || 0) - (a.metrics?.[rankMetric] || 0)),
    [selectedModels, word.modelMetrics, availableModels, rankMetric],
  );

  const bestRankScore = modelsByRank[0]?.metrics?.[rankMetric] || 0;
  const worstRankScore = modelsByRank[modelsByRank.length - 1]?.metrics?.[rankMetric] || 0;
  const allModelsEqualByRank = bestRankScore === worstRankScore;
  const bestF1Score = modelsByF1[0]?.metrics?.f1Score || 0;
  const worstF1Score = modelsByF1[modelsByF1.length - 1]?.metrics?.f1Score || 0;
  const allModelsEqualF1 = bestF1Score === worstF1Score;

  const hasMultipleModels = selectedModels.length > 1;
  const showModelsTable = selectedModels.length >= 3;
  const showRankSection = selectedModels.length > 2;

  const getModelRole = (modelName: string): 'base' | 'target' | 'optional' | null => {
    if (modelName === baseModel) return 'base';
    if (modelName === targetModel && baseModel !== targetModel) return 'target';
    if (selectedModels.length > 2 && modelName !== baseModel && modelName !== targetModel) return 'optional';
    return null;
  };

  const renderRoleBadge = (modelName: string) => {
    const role = getModelRole(modelName);
    return role ? <ModelRoleBadge role={role} /> : null;
  };

  const getMetricDelta = (modelName: string, field: keyof Pick<WordMetrics, 'recall' | 'precision' | 'f1Score' | 'wis'>) => {
    const modelMetrics = word.modelMetrics[modelName];
    if (!modelMetrics || !baseMetrics || modelName === baseModel) return 0;
    return modelMetrics[field] - baseMetrics[field];
  };

  const hasErrorStats = !selectedModels.every(m => {
    const metrics = word.modelMetrics[m];
    return !metrics?.insertions && !metrics?.deletions && !metrics?.substitutions;
  });

  const showWisComponentDelta = Boolean(
    baseWisComponents && targetWisComponents && baseModel !== targetModel,
  );

  const drillDownMetrics = word.modelMetrics[drillDownModel];
  const drillDownModelName = availableModels.find(m => m.name === drillDownModel)?.displayName || drillDownModel;
  const drillDownManifestEntries = manifestData[drillDownModel] ?? [];
  const modelsWithExamples = useMemo(
    () => selectedModels.filter((modelName) => hasErrorExamples(word.modelMetrics[modelName])),
    [selectedModels, word.modelMetrics],
  );
  const [drillPanelOpen, setDrillPanelOpen] = useState(false);

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && !drillPanelOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="reson-word-modal-overlay" />
        <DialogPrimitive.Content
          className="reson-word-modal"
          data-tour="word-detail-modal"
          onPointerDownOutside={(event) => {
            if (drillPanelOpen) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (drillPanelOpen) event.preventDefault();
          }}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Детализация слова: {word.word}</DialogPrimitive.Title>
          </VisuallyHidden>
          <VisuallyHidden>
            <DialogPrimitive.Description>
              Анализ метрик распознавания слова {word.word} по выбранным моделям.
            </DialogPrimitive.Description>
          </VisuallyHidden>

          <div className="reson-word-modal-header">
            <div className="reson-word-modal-header-main">
              <div className="reson-word-modal-header-icon">
                <BookOpen />
              </div>
              <div>
                <div className="reson-word-modal-title-row">
                  <h2 className="reson-word-modal-title">{word.word}</h2>
                  <span className={`reson-vocab-type-badge ${getTypeBadgeClass(word.type)}`}>
                    {getTypeLabel(word.type)}
                  </span>
                </div>
                <p className="reson-word-modal-subtitle">
                  Полный анализ распознавания · {baseModelName} → {targetModelName}
                </p>
              </div>
            </div>
            <DialogPrimitive.Close className="reson-word-modal-close" aria-label="Закрыть">
              <X />
            </DialogPrimitive.Close>
          </div>

          <div className="reson-word-modal-body">
            <div className={`reson-word-wis-banner reson-word-wis-banner--${getWisTier(targetWis)}`}>
              <div>
                <div className="reson-word-wis-banner-label">WIS (Target)</div>
                <div className="reson-word-wis-banner-tier">{getWisLabel(targetWis)}</div>
              </div>
              <div className="reson-word-wis-banner-value">
                <span className={`reson-vocab-wis-badge ${getWisBadgeClass(targetWis)}`}>
                  {targetWis.toFixed(1)}
                </span>
                {Math.abs(wisDelta) >= 0.01 && (
                  <span className={`reson-vocab-metric-delta-chip ${wisDelta < 0 ? 'reson-vocab-metric-delta-chip--up' : 'reson-vocab-metric-delta-chip--down'}`}>
                    {wisDelta > 0 ? '+' : ''}{wisDelta.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {targetWisComponents && (
              <div className="reson-vocab-card reson-word-section reson-word-wis-details-card">
                <details className="reson-word-wis-details">
                  <summary className="reson-word-wis-details-summary">
                    <ChevronDown className="reson-word-wis-chevron reson-word-wis-chevron--closed" />
                    <ChevronUp className="reson-word-wis-chevron reson-word-wis-chevron--open" />
                    <span>Декомпозиция WIS (Target)</span>
                    {baseWisComponents && baseModel !== targetModel && (
                      <span className="reson-word-wis-details-hint">Δ относительно Base</span>
                    )}
                  </summary>
                  <div className="reson-word-wis-components-grid">
                    {WIS_COMPONENTS.map(({ key, label, barClass }) => (
                      <WisComponentCard
                        key={key}
                        label={label}
                        barClass={barClass}
                        target={targetWisComponents[key]}
                        base={baseWisComponents?.[key]}
                        showDelta={showWisComponentDelta}
                        invertDelta={key === 'errorSeverity' || key === 'errorCriticality'}
                      />
                    ))}
                  </div>
                </details>
              </div>
            )}

            <div className="reson-word-frequency-stat">
              <span className="reson-word-frequency-label">Частота</span>
              <strong>{word.frequency.toLocaleString()}</strong>
              <span className="reson-word-frequency-hint">вхождений</span>
            </div>

            {hasMultipleModels && baseMetrics && targetMetrics && baseModel !== targetModel && (
              <div className="reson-vocab-card reson-word-section">
                <div className="reson-word-section-head">
                  <h3 className="reson-word-section-title">Base → Target</h3>
                  <p className="reson-word-section-desc">
                    Компактное сравнение ключевых метрик
                  </p>
                </div>
                <div className="reson-word-base-target-grid">
                  <div className="reson-word-base-target-col">
                    <div className="reson-word-base-target-label">
                      Base
                      <span className="reson-word-base-target-name">{baseModelName}</span>
                    </div>
                    <div className="reson-word-base-target-metrics">
                      <div><span>Recall</span><strong>{baseMetrics.recall.toFixed(1)}%</strong></div>
                      <div><span>Precision</span><strong>{baseMetrics.precision.toFixed(1)}%</strong></div>
                      <div><span>F1</span><strong>{baseMetrics.f1Score.toFixed(1)}%</strong></div>
                      <div><span>WIS</span><strong>{baseMetrics.wis.toFixed(1)}</strong></div>
                    </div>
                  </div>
                  <div className="reson-word-base-target-arrow">→</div>
                  <div className="reson-word-base-target-col reson-word-base-target-col--target">
                    <div className="reson-word-base-target-label">
                      Target
                      <span className="reson-word-base-target-name">{targetModelName}</span>
                    </div>
                    <div className="reson-word-base-target-metrics">
                      <div>
                        <span>Recall</span>
                        <strong className={deltaClass(recallDelta)}>{targetMetrics.recall.toFixed(1)}%</strong>
                        <DeltaChip delta={recallDelta} />
                      </div>
                      <div>
                        <span>Precision</span>
                        <strong className={deltaClass(precisionDelta)}>{targetMetrics.precision.toFixed(1)}%</strong>
                        <DeltaChip delta={precisionDelta} />
                      </div>
                      <div>
                        <span>F1</span>
                        <strong className={deltaClass(f1Delta)}>{targetMetrics.f1Score.toFixed(1)}%</strong>
                        <DeltaChip delta={f1Delta} />
                      </div>
                      <div>
                        <span>WIS</span>
                        <strong className={deltaClass(wisDelta, true)}>{targetMetrics.wis.toFixed(1)}</strong>
                        <DeltaChip delta={wisDelta} invert />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showRankSection && (
              <div className="reson-vocab-card reson-word-section reson-word-rank-strip">
                <div className="reson-word-section-head">
                  <h3 className="reson-word-section-title">Рейтинг моделей</h3>
                  {allModelsEqualByRank && (
                    <p className="reson-word-section-desc">
                      Все модели с одинаковым {RANK_METRIC_OPTIONS.find(o => o.id === rankMetric)?.label}
                    </p>
                  )}
                </div>
                <div className="reson-word-rank-metric-chips">
                  {RANK_METRIC_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`reson-word-rank-metric-chip ${
                        rankMetric === option.id ? 'reson-word-rank-metric-chip--active' : ''
                      }`}
                      onClick={() => setRankMetric(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {allModelsEqualByRank ? (
                  <div className="reson-word-model-tags">
                    {modelsByRank.map((model) => (
                      <span key={model.modelName} className="reson-word-model-tag">
                        {model.displayName}
                        {renderRoleBadge(model.modelName)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="reson-word-rank-chips">
                    {modelsByRank.map((model, idx) => (
                      <span
                        key={model.modelName}
                        className={`reson-word-rank-chip ${
                          idx === 0 ? 'reson-word-rank-chip--best' : idx === modelsByRank.length - 1 ? 'reson-word-rank-chip--worst' : ''
                        }`}
                      >
                        <span className="reson-word-rank-chip-pos">#{idx + 1}</span>
                        <span>{model.displayName}</span>
                        <span className="reson-word-rank-chip-f1">
                          {(model.metrics?.[rankMetric] ?? 0).toFixed(1)}%
                        </span>
                        {renderRoleBadge(model.modelName)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="reson-vocab-card reson-word-section">
              <div className="reson-word-section-head">
                <h3 className="reson-word-section-title">Детализация WER</h3>
                <p className="reson-word-section-desc">
                  Вставки, удаления и замены по моделям
                </p>
              </div>

              {hasErrorStats ? (
                <div className="reson-word-wer-grid">
                  {selectedModels.map((modelName) => {
                    const metrics = word.modelMetrics[modelName];
                    if (!metrics) return null;

                    const insertions = metrics.insertions || 0;
                    const deletions = metrics.deletions || 0;
                    const substitutions = metrics.substitutions || 0;
                    const totalErrors = insertions + deletions + substitutions;
                    const modelDisplayName = availableModels.find(m => m.name === modelName)?.displayName || modelName;

                    return (
                      <div key={modelName} className="reson-word-wer-card">
                        <div className="reson-word-wer-card-head">
                          <span className="reson-word-wer-model">{modelDisplayName}</span>
                          {renderRoleBadge(modelName)}
                        </div>
                        <div className="reson-word-error-rows">
                          <div className="reson-word-error-row">
                            <span className="reson-word-error-label">Вставки</span>
                            <div className="reson-word-error-bar-wrap">
                              <div className="reson-word-error-bar-track">
                                <div
                                  className="reson-word-error-bar reson-word-error-bar--ins"
                                  style={{ width: totalErrors > 0 ? `${(insertions / totalErrors) * 100}%` : '0%' }}
                                />
                              </div>
                              <span className="reson-word-error-value reson-vocab-error-value--ins">{insertions}</span>
                            </div>
                          </div>
                          <div className="reson-word-error-row">
                            <span className="reson-word-error-label">Удаления</span>
                            <div className="reson-word-error-bar-wrap">
                              <div className="reson-word-error-bar-track">
                                <div
                                  className="reson-word-error-bar reson-word-error-bar--del"
                                  style={{ width: totalErrors > 0 ? `${(deletions / totalErrors) * 100}%` : '0%' }}
                                />
                              </div>
                              <span className="reson-word-error-value reson-vocab-error-value--del">{deletions}</span>
                            </div>
                          </div>
                          <div className="reson-word-error-row">
                            <span className="reson-word-error-label">Замены</span>
                            <div className="reson-word-error-bar-wrap">
                              <div className="reson-word-error-bar-track">
                                <div
                                  className="reson-word-error-bar reson-word-error-bar--sub"
                                  style={{ width: totalErrors > 0 ? `${(substitutions / totalErrors) * 100}%` : '0%' }}
                                />
                              </div>
                              <span className="reson-word-error-value reson-vocab-error-value--sub">{substitutions}</span>
                            </div>
                          </div>
                        </div>
                        <div className="reson-word-error-total">
                          <span>Всего ошибок</span>
                          <strong>{totalErrors}</strong>
                        </div>

                        {metrics.substitutedBy && Object.keys(metrics.substitutedBy).length > 0 && (
                          <div className="reson-word-sub-list">
                            <div className="reson-word-sub-list-title">Топ замен</div>
                            {Object.entries(metrics.substitutedBy)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 3)
                              .map(([substitution, count]) => (
                                <div key={substitution} className="reson-word-sub-item">
                                  <span>→ {substitution}</span>
                                  <span className="reson-word-sub-count">{count}×</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="reson-word-empty-note">
                  <AlertCircle />
                  <span>Статистика операций редактирования пока недоступна</span>
                </div>
              )}
            </div>

            <div className="reson-vocab-card reson-word-section">
              <div className="reson-word-section-head">
                <h3 className="reson-word-section-title">Примеры ошибок</h3>
                <p className="reson-word-section-desc">
                  Drill-down по удалениям, вставкам и заменам для выбранной модели
                </p>
              </div>

              {selectedModels.length > 1 && (
                <div className="reson-word-drill-model-chips">
                  {selectedModels.map((modelName) => {
                    const role = getModelRole(modelName);
                    const examplesAvailable = hasErrorExamples(word.modelMetrics[modelName]);
                    return (
                      <button
                        key={modelName}
                        type="button"
                        className={`reson-word-drill-model-chip ${
                          drillDownModel === modelName ? 'reson-word-drill-model-chip--active' : ''
                        }`}
                        onClick={() => setDrillDownModel(modelName)}
                      >
                        <span>{availableModels.find(m => m.name === modelName)?.displayName || modelName}</span>
                        {role && <ModelRoleBadge role={role} />}
                        {!examplesAvailable && (
                          <span className="reson-word-drill-model-chip-note">нет примеров</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {modelsWithExamples.length === 0 ? (
                <div className="reson-word-empty-note">
                  <AlertCircle />
                  <span>Примеры ошибок недоступны. Пересоберите отчёт с обновлённым payload.</span>
                </div>
              ) : (
                <WordErrorDrillDown
                  word={word.word}
                  modelName={drillDownModel}
                  modelDisplayName={drillDownModelName}
                  errorExamples={drillDownMetrics?.errorExamples}
                  manifestEntries={drillDownManifestEntries}
                  audioBasePath={audioBasePath}
                  onPanelOpenChange={setDrillPanelOpen}
                />
              )}
            </div>

            {showModelsTable && (
            <div className="reson-vocab-card reson-word-section">
              <div className="reson-word-section-head">
                <h3 className="reson-word-section-title">Метрики по моделям</h3>
                <p className="reson-word-section-desc">
                  Δ относительно Base ({baseModelName})
                </p>
              </div>
              <div className="reson-vocab-table-wrap">
                <table className="reson-vocab-stats-table reson-word-models-table">
                  <thead>
                    <tr>
                      <th>Модель</th>
                      <th className="reson-vocab-th-right">Recall</th>
                      <th className="reson-vocab-th-right">Precision</th>
                      <th className="reson-vocab-th-right">F1-score</th>
                      <th className="reson-vocab-th-right">WIS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelsByF1.map((model, idx) => {
                      const metrics = model.metrics!;
                      const isBase = model.modelName === baseModel;

                      return (
                        <tr
                          key={model.modelName}
                          className={
                            idx === 0 && !allModelsEqualF1
                              ? 'reson-word-table-row--best'
                              : idx === modelsByF1.length - 1 && !allModelsEqualF1
                                ? 'reson-word-table-row--worst'
                                : undefined
                          }
                        >
                          <td>
                            <div className="reson-word-table-model">
                              {!allModelsEqualF1 && idx < 3 && (
                                <span className="reson-word-rank">#{idx + 1}</span>
                              )}
                              <span>{model.displayName}</span>
                              {renderRoleBadge(model.modelName)}
                            </div>
                          </td>
                          <td>
                            {isBase ? (
                              <div className="reson-word-table-base-value reson-word-metric-value--recall">
                                {metrics.recall.toFixed(1)}%
                              </div>
                            ) : (
                              <ModalMetricCell
                                baseValue={baseMetrics?.recall ?? 0}
                                modelValue={metrics.recall}
                                delta={getMetricDelta(model.modelName, 'recall')}
                                barColor={METRIC_COLUMNS.recall.barColor}
                                pillClass={METRIC_COLUMNS.recall.pillClass}
                              />
                            )}
                          </td>
                          <td>
                            {isBase ? (
                              <div className="reson-word-table-base-value reson-word-metric-value--precision">
                                {metrics.precision.toFixed(1)}%
                              </div>
                            ) : (
                              <ModalMetricCell
                                baseValue={baseMetrics?.precision ?? 0}
                                modelValue={metrics.precision}
                                delta={getMetricDelta(model.modelName, 'precision')}
                                barColor={METRIC_COLUMNS.precision.barColor}
                                pillClass={METRIC_COLUMNS.precision.pillClass}
                              />
                            )}
                          </td>
                          <td>
                            {isBase ? (
                              <div className="reson-word-table-base-value reson-word-metric-value--f1">
                                {metrics.f1Score.toFixed(1)}%
                              </div>
                            ) : (
                              <ModalMetricCell
                                baseValue={baseMetrics?.f1Score ?? 0}
                                modelValue={metrics.f1Score}
                                delta={getMetricDelta(model.modelName, 'f1Score')}
                                barColor={METRIC_COLUMNS.f1.barColor}
                                pillClass={METRIC_COLUMNS.f1.pillClass}
                              />
                            )}
                          </td>
                          <td>
                            {isBase ? (
                              <div className="reson-word-table-base-value">
                                <span className={`reson-vocab-wis-badge ${getWisBadgeClass(metrics.wis)}`}>
                                  {metrics.wis.toFixed(1)}
                                </span>
                              </div>
                            ) : (
                              <ModalMetricCell
                                baseValue={baseMetrics?.wis ?? 0}
                                modelValue={metrics.wis}
                                delta={getMetricDelta(model.modelName, 'wis')}
                                invertDelta
                                format="wis"
                                barColor="#f59e0b"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
