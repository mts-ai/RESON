import { Trophy } from '../icons';
import { SliceChartCard } from './SliceChartCard';
import { ANALYTICS_MODEL_COLORS } from '../../utils/analyticsModelProfile';
import type { SliceWinRateStats } from '../../utils/analyticsSlice';

interface SliceWinRatePanelProps {
  stats: SliceWinRateStats;
  modelOrder: string[];
  isDark: boolean;
}

export function SliceWinRatePanel({
  stats,
  modelOrder,
  isDark,
}: SliceWinRatePanelProps) {
  const colorIndexMap = new Map(modelOrder.map((modelName, index) => [modelName, index]));
  const maxWins = Math.max(...stats.entries.map((entry) => entry.wins), 1);

  return (
    <SliceChartCard
      icon={<Trophy className="w-3.5 h-3.5" />}
      title="Win-rate на срезе"
      description="Доля примеров, где модель — единственный лучший WER среди выбранных"
      isDark={isDark}
      className="reson-slice-win-rate-card"
    >
      <div className="reson-slice-win-rate-list">
        {stats.entries.map((entry) => {
          const colorIndex = colorIndexMap.get(entry.modelName) ?? 0;
          const color = ANALYTICS_MODEL_COLORS[colorIndex % ANALYTICS_MODEL_COLORS.length];
          const barWidth = maxWins > 0 ? (entry.wins / maxWins) * 100 : 0;

          return (
            <div key={entry.modelName} className="reson-slice-win-rate-row">
              <div className="reson-slice-win-rate-label">
                <span
                  className="reson-slice-win-rate-dot"
                  style={{ backgroundColor: color }}
                />
                <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>
                  {entry.displayName}
                </span>
              </div>
              <div className="reson-slice-win-rate-bar-wrap">
                <div className="reson-slice-win-rate-bar-track">
                  <div
                    className="reson-slice-win-rate-bar-fill"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
                <span className={`reson-slice-win-rate-value ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {entry.winRate.toFixed(1)}%
                </span>
                <span className={`reson-slice-win-rate-count ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {entry.wins.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className={`reson-slice-win-rate-meta ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        Решающих примеров: {stats.decisiveSamples.toLocaleString()} из{' '}
        {stats.totalSamples.toLocaleString()}
        {stats.exclusiveTies > 0
          ? ` · ничьи по лучшему WER: ${stats.exclusiveTies.toLocaleString()}`
          : ''}
      </p>

      {stats.pairComparison && (
        <p className={`reson-slice-win-rate-pair ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          <strong>{stats.pairComparison.targetDisplayName}</strong> vs{' '}
          <strong>{stats.pairComparison.baseDisplayName}</strong>: target выигрывает{' '}
          {stats.pairComparison.targetWinRate.toFixed(1)}% сравнимых примеров (
          {stats.pairComparison.targetWins.toLocaleString()} из{' '}
          {stats.pairComparison.comparableSamples.toLocaleString()}
          {stats.pairComparison.ties > 0
            ? `, ничьи ${stats.pairComparison.ties.toLocaleString()}`
            : ''}
          )
        </p>
      )}
    </SliceChartCard>
  );
}
