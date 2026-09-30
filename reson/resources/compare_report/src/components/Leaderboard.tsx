import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Trophy, Medal, Plus, Minus, RefreshCw, Info } from './icons';
import {
  RESON_SECTION_CARD_CLASS,
  RESON_TAB_TRIGGER_COMPACT_CLASS,
} from '../styles/reportStyles';

interface WERDecomposition {
  insertions: number;
  deletions: number;
  substitutions: number;
  insertionsCount: number;
  deletionsCount: number;
  substitutionsCount: number;
}

interface ModelMetrics {
  name: string;
  displayName: string;
  wer: number;
  mwa: number;
  timestamp: string;
  checkpoint?: number;
  decomposition: WERDecomposition;
  optionalMetrics?: {
    wer_h?: number;
    ler?: number;
    cer?: number;
  };
}

interface DatasetSummary {
  totalHours: string;
  totalRecords: number;
  durationTypes: {
    normal: number;
    short: number;
    long: number;
  };
}

interface LeaderboardProps {
  models: ModelMetrics[];
  datasetSummary?: DatasetSummary;
  variant?: 'standalone' | 'modal';
}

function hasOptionalMetricValues(models: ModelMetrics[]): boolean {
  return models.some(
    (m) =>
      m.optionalMetrics?.wer_h !== undefined ||
      m.optionalMetrics?.ler !== undefined ||
      m.optionalMetrics?.cer !== undefined,
  );
}

function deltaWERClass(delta: number): string {
  if (delta > 1) return 'reson-delta-bad';
  if (delta > 0.5) return 'reson-delta-warn';
  return 'reson-delta-good';
}

function deltaMWAClass(delta: number): string {
  if (delta < -1) return 'reson-delta-bad';
  if (delta < -0.5) return 'reson-delta-warn';
  return 'reson-delta-good';
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="w-6 h-6" style={{ color: '#FFD700' }} />;
  }
  if (rank === 2) {
    return <Medal className="w-5 h-5" style={{ color: '#C0C0C0' }} />;
  }
  if (rank === 3) {
    return <Medal className="w-5 h-5" style={{ color: '#CD7F32' }} />;
  }
  return null;
}

function PodiumMetricChip({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="reson-leaderboard-metric-chip">
      <div className="reson-leaderboard-metric-chip-label">{label}</div>
      <div className={`reson-leaderboard-metric-chip-value ${valueClassName}`}>{value}</div>
    </div>
  );
}

export function Leaderboard({
  models,
  datasetSummary,
  variant = 'standalone',
}: LeaderboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<'wer' | 'mwa'>('wer');
  const isModal = variant === 'modal';

  if (models.length === 0) {
    return (
      <div className={`${RESON_SECTION_CARD_CLASS} p-10`}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)] mb-3">
            <Trophy className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold mb-1.5">Выберите модели для сравнения</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Используйте настройки моделей для выбора Base, Target и дополнительных моделей
          </p>
        </div>
      </div>
    );
  }

  const sortedModels = [...models].sort((a, b) => {
    if (selectedMetric === 'wer') {
      return a.wer - b.wer;
    }
    return b.mwa - a.mwa;
  });

  const bestWER = Math.min(...models.map((m) => m.wer));
  const bestMWA = Math.max(...models.map((m) => m.mwa));
  const bestInsertions = Math.min(...models.map((m) => m.decomposition.insertionsCount));
  const bestDeletions = Math.min(...models.map((m) => m.decomposition.deletionsCount));
  const bestSubstitutions = Math.min(...models.map((m) => m.decomposition.substitutionsCount));

  const podiumModels = sortedModels.slice(0, 3);
  const remainingModels = sortedModels.slice(3);
  const hasOptionalMetrics = hasOptionalMetricValues(models);
  const showThreeColumnPodium = podiumModels.length >= 3;

  const renderPodiumCard = (model: ModelMetrics, rank: number, featured = false) => (
    <div
      className={`reson-leaderboard-podium-card ${
        featured ? 'reson-leaderboard-podium-card--featured' : ''
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-1.5 flex items-center justify-center">
          <MedalIcon rank={rank} />
        </div>
        <div
          className={`reson-leaderboard-podium-rank ${
            featured ? 'reson-leaderboard-podium-rank--first' : ''
          }`}
        >
          {rank}
        </div>
        <div className="reson-leaderboard-podium-name">{model.displayName}</div>
        <div className="reson-leaderboard-podium-metrics">
          <PodiumMetricChip
            label="WER"
            value={`${model.wer.toFixed(1)}%`}
            valueClassName="reson-metric-text-wer"
          />
          <PodiumMetricChip
            label="MWA"
            value={`${model.mwa.toFixed(1)}%`}
            valueClassName="reson-metric-text-mwa"
          />
        </div>
      </div>
    </div>
  );

  const sortToolbar = (
    <div className="reson-leaderboard-toolbar">
      <p className="reson-leaderboard-toolbar-note">
        {selectedMetric === 'wer'
          ? 'Сортировка: меньший WER — лучше'
          : 'Сортировка: больший MWA — лучше'}
        {datasetSummary ? ` · ${datasetSummary.totalRecords.toLocaleString()} записей` : ''}
      </p>
      <div className="reson-leaderboard-sort-group">
        <button
          type="button"
          onClick={() => setSelectedMetric('wer')}
          className={`reson-leaderboard-sort-btn ${
            selectedMetric === 'wer' ? 'reson-leaderboard-sort-btn--wer-active' : ''
          }`}
        >
          По WER
        </button>
        <button
          type="button"
          onClick={() => setSelectedMetric('mwa')}
          className={`reson-leaderboard-sort-btn ${
            selectedMetric === 'mwa' ? 'reson-leaderboard-sort-btn--mwa-active' : ''
          }`}
        >
          По MWA
        </button>
      </div>
    </div>
  );

  return (
    <div className={isModal ? 'space-y-0' : 'space-y-4'} data-tour="leaderboard">
      {!isModal && (
        <div className={`${RESON_SECTION_CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-xl bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)]">
                <Trophy className="w-5 h-5 text-[var(--reson-accent)]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Подиум моделей</h2>
                <p className="text-xs text-muted-foreground">Рейтинг моделей на одном датасете</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)] border border-border shrink-0">
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{models.length} моделей</span>
            </div>
          </div>
          {sortToolbar}
        </div>
      )}

      {isModal && sortToolbar}

      {podiumModels.length > 0 && (
        <div
          className={`reson-leaderboard-podium ${
            showThreeColumnPodium
              ? 'reson-leaderboard-podium--three'
              : 'reson-leaderboard-podium--two'
          }`}
          data-tour="leaderboard-podium"
        >
          {showThreeColumnPodium ? (
            <>
              {podiumModels[1] && renderPodiumCard(podiumModels[1], 2)}
              {podiumModels[0] && renderPodiumCard(podiumModels[0], 1, true)}
              {podiumModels[2] && renderPodiumCard(podiumModels[2], 3)}
            </>
          ) : (
            <>
              {podiumModels[0] && renderPodiumCard(podiumModels[0], 1, true)}
              {podiumModels[1] && renderPodiumCard(podiumModels[1], 2)}
            </>
          )}
        </div>
      )}

      {remainingModels.length > 0 && (
        <div className="reson-leaderboard-section">
          <div className="reson-leaderboard-section-head">Остальные позиции</div>
          {remainingModels.map((model, idx) => {
            const rank = idx + 4;
            return (
              <div key={model.name} className="reson-leaderboard-row">
                <div className="reson-leaderboard-row-rank">{rank}</div>
                <div className="reson-leaderboard-row-main">
                  <div className="reson-leaderboard-row-name">{model.displayName}</div>
                  <div className="reson-leaderboard-row-meta">
                    WER {model.wer.toFixed(1)}% · MWA {model.mwa.toFixed(1)}%
                  </div>
                </div>
                <div className="hidden sm:flex gap-2 shrink-0">
                  <PodiumMetricChip
                    label="WER"
                    value={`${model.wer.toFixed(1)}%`}
                    valueClassName="reson-metric-text-wer"
                  />
                  <PodiumMetricChip
                    label="MWA"
                    value={`${model.mwa.toFixed(1)}%`}
                    valueClassName="reson-metric-text-mwa"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Tabs defaultValue="overview" className="reson-leaderboard-tabs w-full" data-tour="leaderboard-tabs">
        <TabsList
          className={`grid w-full ${hasOptionalMetrics ? 'grid-cols-3' : 'grid-cols-2'} h-auto p-0 bg-transparent border-b border-border mb-3`}
        >
          <TabsTrigger value="overview" className={RESON_TAB_TRIGGER_COMPACT_CLASS}>
            Детальный обзор
          </TabsTrigger>
          <TabsTrigger value="decomposition" className={RESON_TAB_TRIGGER_COMPACT_CLASS}>
            Декомпозиция ошибок
          </TabsTrigger>
          {hasOptionalMetrics && (
            <TabsTrigger value="optional" className={RESON_TAB_TRIGGER_COMPACT_CLASS}>
              Доп. метрики
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <div className="reson-leaderboard-section">
            <div className="reson-leaderboard-table-wrap">
              <table className="reson-leaderboard-table">
                <thead>
                  <tr>
                    <th>Ранг</th>
                    <th>Модель</th>
                    <th className="text-center">WER</th>
                    <th className="text-center">Δ WER</th>
                    <th className="text-center">MWA</th>
                    <th className="text-center">Δ MWA</th>
                    <th className="text-center">Всего ошибок</th>
                    <th className="text-center">Преобладающий тип</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.map((model, idx) => {
                    const rank = idx + 1;
                    const deltaWER = model.wer - bestWER;
                    const deltaMWA = model.mwa - bestMWA;
                    const totalErrors =
                      model.decomposition.insertionsCount +
                      model.decomposition.deletionsCount +
                      model.decomposition.substitutionsCount;

                    const errorTypes = [
                      {
                        type: 'Вставки',
                        count: model.decomposition.insertionsCount,
                        className: 'reson-metric-text-insert',
                      },
                      {
                        type: 'Удаления',
                        count: model.decomposition.deletionsCount,
                        className: 'reson-metric-text-wer',
                      },
                      {
                        type: 'Замены',
                        count: model.decomposition.substitutionsCount,
                        className: 'reson-metric-text-mwa',
                      },
                    ];
                    const dominantError = errorTypes.reduce((prev, curr) =>
                      curr.count > prev.count ? curr : prev,
                    );
                    const dominantPercent =
                      totalErrors > 0
                        ? ((dominantError.count / totalErrors) * 100).toFixed(0)
                        : '0';

                    return (
                      <tr key={model.name}>
                        <td>
                          <div className="flex items-center gap-2">
                            {rank <= 3 ? (
                              <MedalIcon rank={rank} />
                            ) : (
                              <div className="reson-leaderboard-row-rank">{rank}</div>
                            )}
                          </div>
                        </td>
                        <td className="font-medium">{model.displayName}</td>
                        <td className="text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                              model.wer === bestWER
                                ? 'reson-metric-highlight-wer'
                                : 'reson-metric-cell'
                            }`}
                          >
                            {model.wer.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center">
                          {deltaWER === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className={`text-xs font-medium ${deltaWERClass(deltaWER)}`}>
                              +{deltaWER.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                              model.mwa === bestMWA
                                ? 'reson-metric-highlight-mwa'
                                : 'reson-metric-cell'
                            }`}
                          >
                            {model.mwa.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center">
                          {deltaMWA === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className={`text-xs font-medium ${deltaMWAClass(deltaMWA)}`}>
                              {deltaMWA.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          <span className="inline-block px-2 py-1 rounded-md bg-muted/50 text-xs font-medium">
                            {totalErrors.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs">{dominantError.type}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium ${dominantError.className}`}
                            >
                              {dominantPercent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="decomposition">
          <div className="reson-leaderboard-section">
            <div className="reson-leaderboard-table-wrap">
              <table className="reson-leaderboard-table">
                <thead>
                  <tr>
                    <th>Ранг</th>
                    <th>Модель</th>
                    <th className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 reson-metric-text-insert" />
                        <span>Вставки</span>
                      </div>
                    </th>
                    <th className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Minus className="w-3.5 h-3.5 reson-metric-text-wer" />
                        <span>Удаления</span>
                      </div>
                    </th>
                    <th className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 reson-metric-text-mwa" />
                        <span>Замены</span>
                      </div>
                    </th>
                    <th className="text-center">Всего</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.map((model, idx) => {
                    const rank = idx + 1;
                    const total =
                      model.decomposition.insertionsCount +
                      model.decomposition.deletionsCount +
                      model.decomposition.substitutionsCount;
                    return (
                      <tr key={model.name}>
                        <td>
                          <div className="flex items-center gap-2">
                            {rank <= 3 ? (
                              <MedalIcon rank={rank} />
                            ) : (
                              <div className="reson-leaderboard-row-rank">{rank}</div>
                            )}
                          </div>
                        </td>
                        <td className="font-medium">{model.displayName}</td>
                        <td className="text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                              model.decomposition.insertionsCount === bestInsertions
                                ? 'reson-metric-highlight-insert'
                                : 'reson-metric-cell'
                            }`}
                          >
                            {model.decomposition.insertionsCount}
                          </span>
                        </td>
                        <td className="text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                              model.decomposition.deletionsCount === bestDeletions
                                ? 'reson-metric-highlight-wer'
                                : 'reson-metric-cell'
                            }`}
                          >
                            {model.decomposition.deletionsCount}
                          </span>
                        </td>
                        <td className="text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                              model.decomposition.substitutionsCount === bestSubstitutions
                                ? 'reson-metric-highlight-mwa'
                                : 'reson-metric-cell'
                            }`}
                          >
                            {model.decomposition.substitutionsCount}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="inline-block px-2 py-1 rounded-md bg-muted/50 text-xs font-medium">
                            {total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {hasOptionalMetrics && (
          <TabsContent value="optional">
            <div className="reson-leaderboard-section">
              <div className="reson-leaderboard-table-wrap">
                <table className="reson-leaderboard-table">
                  <thead>
                    <tr>
                      <th>Ранг</th>
                      <th>Модель</th>
                      {models.some((m) => m.optionalMetrics?.wer_h !== undefined) && (
                        <th className="text-center">WER_H</th>
                      )}
                      {models.some((m) => m.optionalMetrics?.ler !== undefined) && (
                        <th className="text-center">LER</th>
                      )}
                      {models.some((m) => m.optionalMetrics?.cer !== undefined) && (
                        <th className="text-center">CER</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModels.map((model, idx) => {
                      const rank = idx + 1;
                      return (
                        <tr key={model.name}>
                          <td>
                            <div className="flex items-center gap-2">
                              {rank <= 3 ? (
                                <MedalIcon rank={rank} />
                              ) : (
                                <div className="reson-leaderboard-row-rank">{rank}</div>
                              )}
                            </div>
                          </td>
                          <td className="font-medium">{model.displayName}</td>
                          {models.some((m) => m.optionalMetrics?.wer_h !== undefined) && (
                            <td className="text-center">
                              {model.optionalMetrics?.wer_h !== undefined ? (
                                <span className="inline-block px-2 py-1 rounded-md reson-metric-cell text-xs">
                                  {model.optionalMetrics.wer_h.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">н/д</span>
                              )}
                            </td>
                          )}
                          {models.some((m) => m.optionalMetrics?.ler !== undefined) && (
                            <td className="text-center">
                              {model.optionalMetrics?.ler !== undefined ? (
                                <span className="inline-block px-2 py-1 rounded-md reson-metric-cell text-xs">
                                  {model.optionalMetrics.ler.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">н/д</span>
                              )}
                            </td>
                          )}
                          {models.some((m) => m.optionalMetrics?.cer !== undefined) && (
                            <td className="text-center">
                              {model.optionalMetrics?.cer !== undefined ? (
                                <span className="inline-block px-2 py-1 rounded-md reson-metric-cell text-xs">
                                  {model.optionalMetrics.cer.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">н/д</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
