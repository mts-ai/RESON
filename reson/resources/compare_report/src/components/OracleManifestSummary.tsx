import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsChartHeader } from './AnalyticsChartHeader';
import { SliceChartCard } from './analytics/SliceChartCard';
import { useTheme } from './ThemeProvider';
import { Trophy, Target, Award, TrendingDown } from './icons';
import { computeOracleMetrics, formatOracleWins, type OracleSample } from '../utils/oracleWer';
import { ANALYTICS_MODEL_COLORS } from '../utils/analyticsModelProfile';
import {
  RESON_ANALYTICS_SECTION_CARD,
  RESON_ANALYTICS_INNER_CARD,
  RESON_ANALYTICS_SUBTITLE,
  RESON_MANIFEST_ACCENT_TEXT,
  RESON_MANIFEST_ORACLE_CALLOUT,
  RESON_MANIFEST_ORACLE_CHART_TOOLTIP,
  RESON_MANIFEST_ORACLE_METRIC_GAP,
  RESON_MANIFEST_ORACLE_METRIC_ORACLE,
  RESON_MANIFEST_ORACLE_TABLE_CELL,
  RESON_MANIFEST_ORACLE_TABLE_HEAD,
  RESON_MANIFEST_ORACLE_TABLE_NAME,
  RESON_MANIFEST_ORACLE_TABLE_ROW,
} from '../styles/reportStyles';

interface ModelResults {
  modelName: string;
  displayName: string;
  samples: OracleSample[];
}

interface OracleManifestSummaryProps {
  modelResults: ModelResults[];
  selectedModelNames: Set<string>;
  filteredSampleIds?: string[];
  activeFilterCount?: number;
}

export function OracleManifestSummary({
  modelResults,
  selectedModelNames,
  filteredSampleIds,
  activeFilterCount = 0,
}: OracleManifestSummaryProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const metrics = useMemo(
    () => computeOracleMetrics(modelResults, selectedModelNames, filteredSampleIds),
    [modelResults, selectedModelNames, filteredSampleIds],
  );

  if (!metrics) {
    return (
      <div className={RESON_ANALYTICS_SECTION_CARD} data-tour="manifest-oracle-summary">
        <AnalyticsChartHeader
          variant="manifest"
          icon={<Trophy />}
          title="Oracle WER"
          subtitle="Нет записей в текущем срезе"
        />
        <p className={RESON_ANALYTICS_SUBTITLE}>
          Измените фильтры манифеста или выберите другие модели — для расчёта Oracle WER нужна
          хотя бы одна запись.
        </p>
      </div>
    );
  }

  const isSingleModel = metrics.models.length === 1;
  const chartData = [...metrics.models]
    .sort((a, b) => b.wins - a.wins)
    .map((model, index) => ({
      name: model.displayName,
      wins: model.wins,
      winPercentage: model.winPercentage,
      globalWer: model.globalWer,
      modelName: model.modelName,
      color: ANALYTICS_MODEL_COLORS[index % ANALYTICS_MODEL_COLORS.length],
    }));

  const winLeaders = metrics.winLeaders;
  const winLeaderLabel =
    winLeaders.length === 0
      ? '—'
      : winLeaders.length === 1
        ? winLeaders[0].displayName
        : winLeaders.map((model) => model.displayName).join(', ');
  const winLeaderWins = winLeaders.length > 0 ? winLeaders[0].wins : null;
  const winLeaderMatchesBestGlobal =
    winLeaders.length > 0 &&
    metrics.bestGlobalModel != null &&
    winLeaders.some((leader) => leader.modelName === metrics.bestGlobalModel?.modelName);

  const sliceSubtitle =
    activeFilterCount > 0
      ? `${metrics.totalSamples} записей текущего среза (с учётом фильтров манифеста)`
      : `${metrics.totalSamples} записей выбранного пула моделей`;

  return (
    <div className="space-y-4" data-tour="manifest-oracle-summary">
      <div className={RESON_ANALYTICS_SECTION_CARD}>
        <AnalyticsChartHeader
          variant="manifest"
          icon={<Trophy />}
          title="Oracle WER"
          subtitle={`Анализ ансамбля на ${sliceSubtitle}`}
          help={
            <div className="space-y-2">
              <p>
                Метрики считаются на том же срезе, что и интерактивный манифест: выбранные модели
                и записи после фильтров панели (поиск, длительность, класс сложности по медианам,
                диапазоны среднего WER и σ, сравнение моделей).
              </p>
              <p>
                <strong>Oracle WER</strong> — нижняя граница качества при идеальном выборе модели
                на каждой записи: для примера берётся модель с минимальным WER (при равенстве WER —
                с меньшим числом ошибок I+D+S), суммируются её ошибки по всем записям среза и
                делятся на общее число слов в референсах.
              </p>
              <p>
                <strong>Global WER</strong> модели — суммарные ошибки модели на срезе, делённые
                на суммарное число слов референса (классический глобальный WER).{' '}
                <strong>Средний WER</strong> в таблице — среднее per-sample WER модели; может
                отличаться от Global WER.
              </p>
              <p>
                <strong>Победа на записи</strong> — модель с минимальным WER (и минимальным числом
                ошибок при ничьей по WER). При полной ничьей победа делится поровну (1/N).{' '}
                <strong>Δ к Oracle</strong> = Global WER модели − Oracle WER.
              </p>
              <p>
                Для одной выбранной модели Oracle WER совпадает с её Global WER; сравнение побед
                недоступно.
              </p>
            </div>
          }
        />

        <div className="reson-manifest-oracle-metrics">
          <div className={RESON_ANALYTICS_INNER_CARD}>
            <div className="flex items-center gap-2 mb-2">
              <Target className={`w-4 h-4 ${RESON_MANIFEST_ORACLE_METRIC_ORACLE}`} />
              <span className={RESON_ANALYTICS_SUBTITLE}>Oracle WER</span>
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${RESON_MANIFEST_ORACLE_METRIC_ORACLE}`}>
              {metrics.oracleWer.toFixed(2)}%
            </div>
            <p className={`mt-1 text-xs ${RESON_ANALYTICS_SUBTITLE}`}>
              Потолок качества при идеальном выборе модели на каждой записи
            </p>
          </div>

          <div className={RESON_ANALYTICS_INNER_CARD}>
            <div className="flex items-center gap-2 mb-2">
              <Award className={`w-4 h-4 ${RESON_MANIFEST_ACCENT_TEXT}`} />
              <span className={RESON_ANALYTICS_SUBTITLE}>Лучшая по Global WER</span>
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${RESON_MANIFEST_ACCENT_TEXT}`}>
              {metrics.bestGlobalModel?.globalWer.toFixed(2) ?? '—'}%
            </div>
            <p className={`mt-1 truncate text-xs ${RESON_ANALYTICS_SUBTITLE}`} title={metrics.bestGlobalModel?.displayName}>
              {metrics.bestGlobalModel?.displayName ?? '—'}
            </p>
          </div>

          <div className={RESON_ANALYTICS_INNER_CARD}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className={`w-4 h-4 ${RESON_MANIFEST_ACCENT_TEXT}`} />
              <span className={RESON_ANALYTICS_SUBTITLE}>Лидер по победам</span>
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${RESON_MANIFEST_ACCENT_TEXT}`}>
              {winLeaderWins != null
                ? `${formatOracleWins(winLeaderWins)} / ${metrics.totalSamples}`
                : '—'}
            </div>
            <p
              className={`mt-1 text-xs ${winLeaders.length > 1 ? '' : 'truncate'} ${RESON_ANALYTICS_SUBTITLE}`}
              title={winLeaderLabel}
            >
              {winLeaders.length === 0
                ? '—'
                : winLeaders.length === 1
                  ? `${winLeaderLabel} (${winLeaders[0].winPercentage.toFixed(1)}%)`
                  : `${winLeaderLabel} · ничья (${winLeaders.length})`}
            </p>
          </div>

          <div className={RESON_ANALYTICS_INNER_CARD}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className={`w-4 h-4 ${RESON_MANIFEST_ORACLE_METRIC_GAP}`} />
              <span className={RESON_ANALYTICS_SUBTITLE}>Запас до Oracle</span>
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${RESON_MANIFEST_ORACLE_METRIC_GAP}`}>
              {metrics.gapBestGlobalToOracle.toFixed(2)} п.п.
            </div>
            <p className={`mt-1 text-xs ${RESON_ANALYTICS_SUBTITLE}`}>
              Разрыв между лучшей одиночной моделью и потолком ансамбля
            </p>
          </div>
        </div>

        {!isSingleModel && !winLeaderMatchesBestGlobal && winLeaders.length > 0 && metrics.bestGlobalModel ? (
          <div className={`${RESON_MANIFEST_ORACLE_CALLOUT} mt-4`}>
            Лучшая по Global WER ({metrics.bestGlobalModel.displayName}) и{' '}
            {winLeaders.length === 1 ? 'лидер' : 'лидеры'} по победам на записях ({winLeaderLabel}) —
            разные модели. Это может означать, что лидер Global WER выигрывает за счёт стабильности
            на большинстве записей, а не за счёт частых побед на отдельных примерах.
          </div>
        ) : null}
      </div>

      <SliceChartCard
        icon={<Trophy />}
        title="Победы моделей на уровне записей"
        description="Сколько раз модель была лучшей на текущем срезе (при ничьей — доля 1/N)"
        isDark={isDark}
      >
        {isSingleModel ? (
          <p className={RESON_ANALYTICS_SUBTITLE}>
            Для сравнения ансамбля выберите минимум две модели. Для одной модели Oracle WER совпадает
            с её Global WER.
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2A2D35' : '#e5e7eb'} opacity={0.6} />
                  <XAxis
                    type="number"
                    allowDecimals
                    tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => formatOracleWins(Number(value))}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className={RESON_MANIFEST_ORACLE_CHART_TOOLTIP}>
                          <p className="font-medium mb-2">{data.name}</p>
                          <p>Побед: {formatOracleWins(data.wins)} ({data.winPercentage.toFixed(1)}%)</p>
                          <p>Global WER: {data.globalWer.toFixed(2)}%</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="wins" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.modelName} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={RESON_MANIFEST_ORACLE_TABLE_HEAD}>
                    <th className="py-2 pr-3 font-medium">Модель</th>
                    <th className="py-2 pr-3 font-medium">Global WER</th>
                    <th className="py-2 pr-3 font-medium">Победы</th>
                    <th className="py-2 pr-3 font-medium">Средний WER</th>
                    <th className="py-2 font-medium">Δ к Oracle</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.models.map((model) => {
                    const isBestGlobal = metrics.bestGlobalModel?.modelName === model.modelName;
                    const isWinLeader = winLeaders.some((leader) => leader.modelName === model.modelName);

                    return (
                      <tr key={model.modelName} className={RESON_MANIFEST_ORACLE_TABLE_ROW}>
                        <td className="py-3 pr-3">
                          <div className={RESON_MANIFEST_ORACLE_TABLE_NAME}>{model.displayName}</div>
                          <div className={RESON_ANALYTICS_SUBTITLE}>
                            {isBestGlobal ? 'лучший Global WER' : null}
                            {isBestGlobal && isWinLeader ? ' · ' : null}
                            {isWinLeader ? (winLeaders.length > 1 ? 'в числе лидеров по победам' : 'лидер по победам') : null}
                          </div>
                        </td>
                        <td className={`py-3 pr-3 tabular-nums ${RESON_MANIFEST_ACCENT_TEXT}`}>
                          {model.globalWer.toFixed(2)}%
                        </td>
                        <td className={`py-3 pr-3 tabular-nums ${RESON_MANIFEST_ORACLE_TABLE_CELL}`}>
                          {formatOracleWins(model.wins)} ({model.winPercentage.toFixed(1)}%)
                        </td>
                        <td className={`py-3 pr-3 tabular-nums ${RESON_MANIFEST_ORACLE_TABLE_CELL}`}>
                          {model.avgSampleWer.toFixed(2)}%
                        </td>
                        <td className={`py-3 tabular-nums ${RESON_MANIFEST_ORACLE_TABLE_CELL}`}>
                          {model.gapToOracle.toFixed(2)} п.п.
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SliceChartCard>
    </div>
  );
}
