import { useMemo } from 'react';
import { AlertTriangle, BarChart2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SliceChartCard } from './SliceChartCard';
import { buildSliceWerProfileStats } from './sliceWerProfileHelpers';

interface SliceWerProfilePanelProps {
  correlationData: Array<{ wer?: number }>;
  isDark: boolean;
  part?: 'all' | 'quantiles' | 'heavy';
}

const QUANTILE_COLORS = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'];

function quantileAxisMax(values: number[]): number {
  const peak = Math.max(...values, 1);
  const step = peak > 200 ? 100 : peak > 100 ? 50 : 25;
  return Math.min(1500, Math.ceil(peak / step) * step + step);
}

function heavyBarTone(percent: number, threshold: number, isDark: boolean): string {
  if (threshold >= 1000) return isDark ? '#c084fc' : '#7c3aed';
  if (threshold >= 200) return isDark ? '#f87171' : '#dc2626';
  if (threshold >= 100) return isDark ? '#fb923c' : '#ea580c';
  if (percent >= 25) return isDark ? '#f87171' : '#ef4444';
  if (percent >= 10) return isDark ? '#fbbf24' : '#f59e0b';
  return isDark ? '#34d399' : '#10b981';
}

export function SliceWerProfilePanel({ correlationData, isDark, part = 'all' }: SliceWerProfilePanelProps) {
  const stats = useMemo(
    () => buildSliceWerProfileStats(correlationData),
    [correlationData],
  );
  const iconClass = isDark ? 'w-3.5 h-3.5 text-purple-400' : 'w-3.5 h-3.5 text-purple-600';

  if (stats.sampleCount === 0) {
    return (
      <SliceChartCard
        icon={<BarChart2 className={iconClass} />}
        title="Профиль WER"
        description="Нет данных по срезу"
        isDark={isDark}
      >
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Нет данных по WER в срезе.</p>
      </SliceChartCard>
    );
  }

  const showQuantiles = part === 'all' || part === 'quantiles';
  const showHeavy = part === 'all' || part === 'heavy';
  const xMax = quantileAxisMax(stats.quantiles.map((point) => point.value));

  if (showQuantiles && !showHeavy) {
    return (
      <SliceChartCard
        icon={<BarChart2 className={iconClass} />}
        title="Квантили WER"
        description="Перцентили WER по сэмплам среза"
        isDark={isDark}
        className="reson-slice-chart-card--fill"
      >
        <div className="h-[170px]">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart
              data={stats.quantiles}
              layout="vertical"
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke={isDark ? '#2A2D35' : '#E5E7EB'}
              />
              <XAxis
                type="number"
                domain={[0, xMax]}
                tick={{ fill: isDark ? '#9CA3AF' : '#6B7280', fontSize: 10 }}
                axisLine={{ stroke: isDark ? '#2A2D35' : '#E5E7EB' }}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={34}
                tick={{ fill: isDark ? '#D1D5DB' : '#374151', fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgb(255 255 255 / 0.04)' : 'rgb(0 0 0 / 0.03)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as { label: string; value: number };
                  return (
                    <div className={`px-2.5 py-1.5 rounded-md border text-xs ${isDark ? 'bg-[#1A1D24] border-[#2A2D35] text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
                      {point.label}: <strong>{point.value.toFixed(1)}%</strong>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                {stats.quantiles.map((entry, index) => (
                  <Cell key={entry.label} fill={QUANTILE_COLORS[index % QUANTILE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SliceChartCard>
    );
  }

  if (showHeavy && !showQuantiles) {
    return (
      <SliceChartCard
        icon={<AlertTriangle className={iconClass} />}
        title="Тяжёлые сэмплы"
        description="Доля сэмплов выше порога WER"
        isDark={isDark}
        className="reson-slice-chart-card--fill"
      >
        <ul className="reson-slice-heavy-list">
          {stats.heavyBuckets.map((bucket) => (
            <li key={bucket.label} className="reson-slice-heavy-item">
              <div className="reson-slice-heavy-meta">
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{bucket.label}</span>
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  {bucket.count} · {bucket.percent.toFixed(1)}%
                </span>
              </div>
              <div className={`reson-slice-heavy-track ${isDark ? 'reson-slice-heavy-track--dark' : ''}`}>
                <div
                  className="reson-slice-heavy-fill"
                  style={{
                    width: `${Math.min(100, bucket.percent)}%`,
                    backgroundColor: heavyBarTone(bucket.percent, bucket.threshold, isDark),
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </SliceChartCard>
    );
  }

  return null;
}
