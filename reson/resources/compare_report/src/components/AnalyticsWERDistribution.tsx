import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "./icons";
import { useTheme } from "./ThemeProvider";
import {
  RESON_ANALYTICS_INNER_CARD,
  RESON_ANALYTICS_SECTION_TITLE,
} from "../styles/reportStyles";
import {
  ANALYTICS_MODEL_COLORS,
  type AnalyticsSliceStat,
} from "../utils/analyticsModelProfile";

interface AnalyticsWERDistributionProps {
  sliceStats: AnalyticsSliceStat[];
  selectedModels: Set<string>;
  embedded?: boolean;
  highlight?: boolean;
}

type WerBin = {
  range: string;
  density: number;
  samples: number;
};

function buildWerDistributionBins(samples: Array<{ wer: number }>): WerBin[] {
  const bins = Array.from({ length: 20 }, (_, index) => ({
    min: index * 5,
    max: (index + 1) * 5,
    range: `${index * 5}-${(index + 1) * 5}`,
    samples: 0,
  }));

  samples.forEach((sample) => {
    const binIndex = Math.min(19, Math.max(0, Math.floor(sample.wer / 5)));
    bins[binIndex].samples += 1;
  });

  const totalSamples = samples.length;
  return bins.map((bin) => ({
    range: bin.range,
    density: totalSamples > 0 ? bin.samples / totalSamples : 0,
    samples: bin.samples,
  }));
}

function gradientId(modelName: string) {
  return `wer-density-${modelName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function AnalyticsWERDistribution({
  sliceStats,
  selectedModels,
  embedded = false,
  highlight = false,
}: AnalyticsWERDistributionProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const colorIndexMap = useMemo(
    () => new Map(sliceStats.map((stat, index) => [stat.displayName, index])),
    [sliceStats],
  );

  const modelColor = (displayName: string) => {
    const colorIndex = colorIndexMap.get(displayName) ?? 0;
    return ANALYTICS_MODEL_COLORS[colorIndex % ANALYTICS_MODEL_COLORS.length];
  };

  const visibleStats = useMemo(
    () => sliceStats.filter((stat) => selectedModels.has(stat.displayName)),
    [sliceStats, selectedModels],
  );

  const chartData = useMemo(() => {
    const distributions = new Map(
      visibleStats.map((stat) => [
        stat.displayName,
        buildWerDistributionBins(stat.samples),
      ]),
    );

    const ranges = Array.from({ length: 20 }, (_, index) => `${index * 5}-${(index + 1) * 5}`);

    return ranges.map((range, index) => {
      const row: Record<string, string | number> = { range };

      visibleStats.forEach((stat) => {
        const bin = distributions.get(stat.displayName)?.[index];
        row[stat.displayName] = bin?.density ?? 0;
        row[`${stat.displayName}__samples`] = bin?.samples ?? 0;
      });

      return row;
    });
  }, [visibleStats]);

  const tooltipStyle = {
    backgroundColor: isDark ? "#1A1D24" : "#FFFFFF",
    border: `1px solid ${isDark ? "#2A2D35" : "#E5E7EB"}`,
    borderRadius: "8px",
    fontSize: "12px",
  };

  if (selectedModels.size === 0) {
    return (
      <div className={`${embedded ? '' : RESON_ANALYTICS_INNER_CARD} py-10 text-center text-sm text-gray-500`}>
        Выберите хотя бы одну модель для отображения распределения WER
      </div>
    );
  }

  if (visibleStats.length === 0) {
    return (
      <div className={`${embedded ? '' : RESON_ANALYTICS_INNER_CARD} py-10 text-center text-sm text-gray-500`}>
        Ни одна из выбранных моделей не найдена в текущем срезе
      </div>
    );
  }

  const totalSamplesInSlice = visibleStats.reduce(
    (sum, stat) => sum + stat.samplesCount,
    0,
  );

  if (totalSamplesInSlice === 0) {
    return (
      <div className={`${embedded ? '' : RESON_ANALYTICS_INNER_CARD} py-10 text-center text-sm text-gray-500`}>
        Нет сэмплов в текущем срезе для построения распределения WER
      </div>
    );
  }

  const chartHeightClass = highlight
    ? 'reson-analytics-chart-h-280'
    : 'reson-analytics-chart-h-260';
  const chartHeight = highlight ? 280 : 260;

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className={`${RESON_ANALYTICS_SECTION_TITLE} text-sm`}>
            Плотность распределения по WER
          </h4>
        </div>
      )}

      <div className={`reson-analytics-chart ${chartHeightClass}`}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <AreaChart
            data={chartData}
            margin={{ top: 16, right: 16, left: 12, bottom: 12 }}
          >
            <defs>
              {visibleStats.map((stat) => {
                const color = modelColor(stat.displayName);
                return (
                  <linearGradient
                    key={gradientId(stat.displayName)}
                    id={gradientId(stat.displayName)}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.04} />
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#2A2D35" : "#E5E7EB"}
            />
            <XAxis
              dataKey="range"
              tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
              label={{
                value: "WER (%)",
                position: "insideBottom",
                offset: -5,
                fill: isDark ? "#9CA3AF" : "#6B7280",
              }}
            />
            <YAxis
              width={56}
              tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 11 }}
              label={{
                value: "Плотность",
                angle: -90,
                position: "left",
                offset: 4,
                style: { textAnchor: "middle" },
                fill: isDark ? "#9CA3AF" : "#6B7280",
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;

                return (
                  <div style={tooltipStyle} className="px-3 py-2 space-y-1.5 min-w-[180px]">
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      WER: {label}%
                    </p>
                    {visibleStats.map((stat) => {
                      const color = modelColor(stat.displayName);
                      const density = Number(
                        payload[0]?.payload?.[stat.displayName] ?? 0,
                      );
                      const samples = Number(
                        payload[0]?.payload?.[`${stat.displayName}__samples`] ?? 0,
                      );

                      return (
                        <div key={stat.displayName} className="space-y-0.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className={isDark ? "text-gray-300" : "text-gray-700"}>
                                {stat.displayName}
                              </span>
                            </div>
                            <span className={`tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>
                              {density.toFixed(3)}
                            </span>
                          </div>
                          <div className={`text-[11px] pl-4 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                            Сэмплов: {samples}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />

            {visibleStats.map((stat) => {
              const color = modelColor(stat.displayName);

              return (
                <Area
                  key={stat.modelName}
                  type="monotone"
                  dataKey={stat.displayName}
                  name={stat.displayName}
                  stroke={color}
                  strokeWidth={highlight ? 3 : 2.5}
                  fillOpacity={1}
                  fill={`url(#${gradientId(stat.displayName)})`}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return <div className={`${RESON_ANALYTICS_INNER_CARD} p-4`}>{content}</div>;
}
