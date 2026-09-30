import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock } from "./icons";
import { useTheme } from "./ThemeProvider";
import {
  RESON_ANALYTICS_INNER_CARD,
  RESON_ANALYTICS_SECTION_TITLE,
  RESON_ANALYTICS_SUBTITLE,
  resonAnalyticsViewToggleClass,
} from "../styles/reportStyles";
import {
  ANALYTICS_MODEL_COLORS,
  type AnalyticsSliceStat,
} from "../utils/analyticsModelProfile";

interface AnalyticsDurationDistributionProps {
  sliceStats: AnalyticsSliceStat[];
  selectedModels: Set<string>;
  compact?: boolean;
  embedded?: boolean;
  singleChart?: boolean;
}

type ErrorType = "insertions" | "deletions" | "substitutions";
type ErrorViewMode = "count" | "density";

type DurationBin = {
  range: string;
  density: number;
  count: number;
};

const BIN_DURATION_SEC = 5;
const MAX_DURATION_SEC = 500;
const SAMPLE_BAR_COLOR = "#10B981";

const ERROR_VIEW_MODES: Array<{ id: ErrorViewMode; label: string }> = [
  { id: "count", label: "Абсолютные значения" },
  { id: "density", label: "Плотность" },
];

const ERROR_TYPE_OPTIONS: Array<{ id: ErrorType; label: string }> = [
  { id: "insertions", label: "Вставки" },
  { id: "deletions", label: "Удаления" },
  { id: "substitutions", label: "Замены" },
];

const ERROR_CONFIG: Record<ErrorType, { title: string }> = {
  insertions: {
    title: "Распределение вставок по длительности",
  },
  deletions: {
    title: "Распределение удалений по длительности",
  },
  substitutions: {
    title: "Распределение замен по длительности",
  },
};

function buildDurationBins(maxDuration: number) {
  const maxBinEnd = Math.min(
    MAX_DURATION_SEC,
    Math.ceil(maxDuration / BIN_DURATION_SEC) * BIN_DURATION_SEC || BIN_DURATION_SEC,
  );
  const numBins = Math.max(1, Math.ceil(maxBinEnd / BIN_DURATION_SEC));

  return Array.from({ length: numBins }, (_, index) => {
    const min = index * BIN_DURATION_SEC;
    const max = (index + 1) * BIN_DURATION_SEC;
    return { min, max, maxBinEnd, range: `${min}-${max}` };
  });
}

function getBinIndex(
  duration: number,
  binDefinitions: ReturnType<typeof buildDurationBins>,
) {
  const lastBin = binDefinitions[binDefinitions.length - 1];
  return duration >= lastBin.maxBinEnd
    ? binDefinitions.length - 1
    : Math.min(
        binDefinitions.length - 1,
        Math.floor(duration / BIN_DURATION_SEC),
      );
}

function buildSampleCountBins(
  samples: AnalyticsSliceStat["samples"],
  binDefinitions: ReturnType<typeof buildDurationBins>,
) {
  const counts = new Array(binDefinitions.length).fill(0);

  samples.forEach((sample) => {
    counts[getBinIndex(sample.duration, binDefinitions)] += 1;
  });

  return counts;
}

function buildDurationErrorBins(
  samples: AnalyticsSliceStat["samples"],
  errorType: ErrorType,
  binDefinitions: ReturnType<typeof buildDurationBins>,
): DurationBin[] {
  const counts = new Array(binDefinitions.length).fill(0);

  samples.forEach((sample) => {
    counts[getBinIndex(sample.duration, binDefinitions)] += sample[errorType];
  });

  const total = counts.reduce((sum, value) => sum + value, 0);
  return binDefinitions.map((bin, index) => ({
    range: bin.range,
    density: total > 0 ? counts[index] / total : 0,
    count: counts[index],
  }));
}

function gradientId(modelName: string, errorType: ErrorType) {
  return `duration-${errorType}-${modelName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function DurationErrorChart({
  errorType,
  sliceStats,
  visibleStats,
  binDefinitions,
  sampleCounts,
  errorViewMode,
  isDark,
  compact = false,
  embedded = false,
  hideTitle = false,
}: {
  errorType: ErrorType;
  sliceStats: AnalyticsSliceStat[];
  visibleStats: AnalyticsSliceStat[];
  binDefinitions: ReturnType<typeof buildDurationBins>;
  sampleCounts: number[];
  errorViewMode: ErrorViewMode;
  isDark: boolean;
  compact?: boolean;
  embedded?: boolean;
  hideTitle?: boolean;
}) {
  const config = ERROR_CONFIG[errorType];
  const colorIndexMap = useMemo(
    () => new Map(sliceStats.map((stat, index) => [stat.displayName, index])),
    [sliceStats],
  );

  const modelColor = (displayName: string) => {
    const colorIndex = colorIndexMap.get(displayName) ?? 0;
    return ANALYTICS_MODEL_COLORS[colorIndex % ANALYTICS_MODEL_COLORS.length];
  };

  const chartData = useMemo(() => {
    const distributions = new Map(
      visibleStats.map((stat) => [
        stat.displayName,
        buildDurationErrorBins(stat.samples, errorType, binDefinitions),
      ]),
    );

    return binDefinitions.map((bin, index) => {
      const row: Record<string, string | number> = {
        range: bin.range,
        samples: sampleCounts[index] ?? 0,
      };

      visibleStats.forEach((stat) => {
        const binData = distributions.get(stat.displayName)?.[index];
        row[`${stat.displayName}__count`] = binData?.count ?? 0;
        row[`${stat.displayName}__density`] = binData?.density ?? 0;
        row[stat.displayName] =
          errorViewMode === "count"
            ? (binData?.count ?? 0)
            : (binData?.density ?? 0);
      });

      return row;
    });
  }, [visibleStats, errorType, binDefinitions, sampleCounts, errorViewMode]);

  const tooltipStyle = {
    backgroundColor: isDark ? "#1A1D24" : "#FFFFFF",
    border: `1px solid ${isDark ? "#2A2D35" : "#E5E7EB"}`,
    borderRadius: "8px",
    fontSize: "12px",
  };

  const hasErrors = visibleStats.some((stat) =>
    stat.samples.some((sample) => sample[errorType] > 0),
  );

  const rightAxisLabel = errorViewMode === "count" ? "Ошибок" : "Плотность";

  const chartLayout = embedded
    ? {
        height: 260,
        heightClass: "reson-analytics-chart-h-280",
        margin: { top: 20, right: 56, left: 12, bottom: 36 },
      }
    : compact
      ? {
          height: 200,
          heightClass: "reson-analytics-chart-h-260",
          margin: { top: 16, right: 48, left: 8, bottom: 28 },
        }
      : {
          height: 300,
          heightClass: "reson-analytics-chart-h-320",
          margin: { top: 20, right: 56, left: 12, bottom: 40 },
        };

  const wrapperClass = embedded
    ? ""
    : `${compact ? "reson-analytics-duration-chart-compact" : RESON_ANALYTICS_INNER_CARD} p-4`;

  return (
    <div className={wrapperClass}>
      {!compact && !hideTitle && (
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
          <h4 className={`${RESON_ANALYTICS_SECTION_TITLE} text-sm`}>{config.title}</h4>
        </div>
      )}
      {compact && !hideTitle && (
        <h5 className="reson-analytics-duration-chart-compact-title">{config.title}</h5>
      )}

      {!hasErrors ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          Нет {errorType === "insertions" ? "вставок" : errorType === "deletions" ? "удалений" : "замен"} в текущем срезе
        </p>
      ) : (
        <div className={`reson-analytics-chart ${chartLayout.heightClass}`}>
          <ResponsiveContainer width="100%" height={chartLayout.height}>
            <ComposedChart
              data={chartData}
              margin={chartLayout.margin}
            >
              <defs>
                {visibleStats.map((stat) => {
                  const color = modelColor(stat.displayName);

                  return (
                    <linearGradient
                      key={gradientId(stat.displayName, errorType)}
                      id={gradientId(stat.displayName, errorType)}
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
                angle={binDefinitions.length > 8 ? -35 : 0}
                textAnchor={binDefinitions.length > 8 ? "end" : "middle"}
                height={binDefinitions.length > 8 ? 52 : 32}
                label={{
                  value: "Длительность (с)",
                  position: "insideBottom",
                  offset: binDefinitions.length > 8 ? -4 : -5,
                  fill: isDark ? "#9CA3AF" : "#6B7280",
                }}
              />
              <YAxis
                yAxisId="left"
                width={56}
                tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 11 }}
                label={{
                  value: "Сэмплов",
                  angle: -90,
                  position: "left",
                  offset: 4,
                  style: { textAnchor: "middle" },
                  fill: isDark ? "#9CA3AF" : "#6B7280",
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                width={56}
                tick={{ fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 11 }}
                tickFormatter={(value: number) =>
                  errorViewMode === "density" ? value.toFixed(2) : value.toLocaleString()
                }
                label={{
                  value: rightAxisLabel,
                  angle: -90,
                  position: "right",
                  offset: 4,
                  style: { textAnchor: "middle" },
                  fill: isDark ? "#9CA3AF" : "#6B7280",
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as Record<string, number>;

                  return (
                    <div style={tooltipStyle} className="px-3 py-2 space-y-1.5 min-w-[200px]">
                      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {label} с
                      </p>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: SAMPLE_BAR_COLOR }}
                          />
                          <span className={isDark ? "text-gray-300" : "text-gray-700"}>
                            Сэмплов в бине
                          </span>
                        </div>
                        <span className={`tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>
                          {Number(row?.samples ?? 0).toLocaleString()}
                        </span>
                      </div>
                      {visibleStats.map((stat) => {
                        const color = modelColor(stat.displayName);
                        const count = Number(row?.[`${stat.displayName}__count`] ?? 0);
                        const density = Number(row?.[`${stat.displayName}__density`] ?? 0);
                        const primaryValue =
                          errorViewMode === "count"
                            ? count.toLocaleString()
                            : density.toFixed(3);
                        const secondaryLabel =
                          errorViewMode === "count" ? "Плотность" : "Ошибок";
                        const secondaryValue =
                          errorViewMode === "count"
                            ? density.toFixed(3)
                            : count.toLocaleString();

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
                                {primaryValue}
                              </span>
                            </div>
                            <div className={`text-[11px] pl-4 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                              {secondaryLabel}: {secondaryValue}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />

              <Bar
                yAxisId="left"
                dataKey="samples"
                name="Сэмплов в бине"
                fill={SAMPLE_BAR_COLOR}
                fillOpacity={0.28}
                radius={[4, 4, 0, 0]}
                legendType="none"
              />

              {visibleStats.map((stat) => {
                const color = modelColor(stat.displayName);

                return (
                  <Area
                    key={stat.modelName}
                    yAxisId="right"
                    type="monotone"
                    dataKey={stat.displayName}
                    name={stat.displayName}
                    stroke={color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                  fill={`url(#${gradientId(stat.displayName, errorType)})`}
                  legendType="none"
                />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function AnalyticsDurationDistribution({
  sliceStats,
  selectedModels,
  compact = false,
  embedded = false,
  singleChart,
}: AnalyticsDurationDistributionProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [errorViewMode, setErrorViewMode] = useState<ErrorViewMode>("count");
  const [selectedErrorType, setSelectedErrorType] = useState<ErrorType>("insertions");
  const showSingleChart = singleChart ?? embedded;

  const visibleStats = useMemo(
    () => sliceStats.filter((stat) => selectedModels.has(stat.displayName)),
    [sliceStats, selectedModels],
  );

  const binDefinitions = useMemo(() => {
    const maxDuration = sliceStats.reduce((max, stat) => {
      const statMax = stat.samples.reduce(
        (innerMax, sample) => Math.max(innerMax, sample.duration),
        0,
      );
      return Math.max(max, statMax);
    }, 0);
    return buildDurationBins(maxDuration);
  }, [sliceStats]);

  const sampleCounts = useMemo(() => {
    const referenceSamples = visibleStats[0]?.samples ?? sliceStats[0]?.samples ?? [];
    return buildSampleCountBins(referenceSamples, binDefinitions);
  }, [visibleStats, sliceStats, binDefinitions]);

  if (selectedModels.size === 0) {
    return (
      <div className={`${embedded ? '' : RESON_ANALYTICS_INNER_CARD} py-10 text-center text-sm text-gray-500`}>
        Выберите хотя бы одну модель для отображения распределения по длительности
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
        Нет сэмплов в текущем срезе для построения распределения по длительности
      </div>
    );
  }

  const controls = (
    <div
      className={`${
        embedded ? "reson-slice-duration-controls" : RESON_ANALYTICS_INNER_CARD
      } px-4 py-3 flex flex-col gap-3`}
    >
      <div className="reson-slice-duration-controls-row">
        {showSingleChart && (
          <div className="reson-slice-duration-controls-group">
            <p className={RESON_ANALYTICS_SUBTITLE}>Тип ошибок</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Тип ошибок">
              {ERROR_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selectedErrorType === option.id}
                  onClick={() => setSelectedErrorType(option.id)}
                  className={resonAnalyticsViewToggleClass(selectedErrorType === option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="reson-slice-duration-controls-group">
          <p className={RESON_ANALYTICS_SUBTITLE}>Режим отображения</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Режим отображения ошибок">
            {ERROR_VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={errorViewMode === mode.id}
                onClick={() => setErrorViewMode(mode.id)}
                className={resonAnalyticsViewToggleClass(errorViewMode === mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const errorTypesToRender = showSingleChart
    ? [selectedErrorType]
    : (["insertions", "deletions", "substitutions"] as const);

  const charts = (
    <div className={showSingleChart ? 'space-y-3' : compact ? 'reson-analytics-duration-grid' : 'space-y-4'}>
      {errorTypesToRender.map((errorType) => (
        <DurationErrorChart
          key={errorType}
          errorType={errorType}
          sliceStats={sliceStats}
          visibleStats={visibleStats}
          binDefinitions={binDefinitions}
          sampleCounts={sampleCounts}
          errorViewMode={errorViewMode}
          isDark={isDark}
          compact={compact && !embedded}
          embedded={embedded && showSingleChart}
          hideTitle={showSingleChart}
        />
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        {controls}
        {charts}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {controls}
      {charts}
    </div>
  );
}
