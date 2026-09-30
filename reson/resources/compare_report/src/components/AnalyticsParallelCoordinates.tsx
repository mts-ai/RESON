import { useMemo, useState } from "react";
import { Filter } from "./icons";
import { useTheme } from "./ThemeProvider";
import {
  RESON_ANALYTICS_INNER_CARD,
  RESON_ANALYTICS_SECTION_TITLE,
  RESON_ANALYTICS_SUBTITLE,
} from "../styles/reportStyles";
import {
  ANALYTICS_MODEL_COLORS,
  normalizeAcrossModels,
  type AnalyticsSliceStat,
} from "../utils/analyticsModelProfile";

interface AnalyticsParallelCoordinatesProps {
  sliceStats: AnalyticsSliceStat[];
  selectedRadarModels: Set<string>;
  compact?: boolean;
  embedded?: boolean;
}

const PARALLEL_DIMENSIONS = [
  {
    key: "insertions",
    label: "Вставки",
    shortLabel: "INS",
    getValue: (stat: AnalyticsSliceStat) => stat.totalInsertions,
    format: (value: number) => value.toLocaleString(),
  },
  {
    key: "deletions",
    label: "Удаления",
    shortLabel: "DEL",
    getValue: (stat: AnalyticsSliceStat) => stat.totalDeletions,
    format: (value: number) => value.toLocaleString(),
  },
  {
    key: "substitutions",
    label: "Замены",
    shortLabel: "SUB",
    getValue: (stat: AnalyticsSliceStat) => stat.totalSubstitutions,
    format: (value: number) => value.toLocaleString(),
  },
  {
    key: "wer",
    label: "WER (%)",
    shortLabel: "WER",
    getValue: (stat: AnalyticsSliceStat) => stat.avgWER,
    format: (value: number) => `${value.toFixed(2)}%`,
  },
] as const;

const DEFAULT_LAYOUT = {
  chartHeight: 360,
  plotWidth: 640,
  padding: { top: 36, right: 24, bottom: 48, left: 52 },
  minHeightClass: "reson-analytics-parallel-chart",
};

const COMPACT_LAYOUT = {
  chartHeight: 200,
  plotWidth: 360,
  padding: { top: 22, right: 12, bottom: 26, left: 32 },
  minHeightClass: "reson-analytics-parallel-chart--compact",
};

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function AnalyticsParallelCoordinates({
  sliceStats,
  selectedRadarModels,
  compact = false,
  embedded = false,
}: AnalyticsParallelCoordinatesProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const layout = compact ? COMPACT_LAYOUT : DEFAULT_LAYOUT;
  const { chartHeight, plotWidth, padding, minHeightClass } = layout;
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    modelName: string;
    values: Record<string, number>;
  } | null>(null);

  const visibleStats = useMemo(
    () =>
      sliceStats.filter((stat) =>
        selectedRadarModels.size === 0
          ? true
          : selectedRadarModels.has(stat.displayName),
      ),
    [sliceStats, selectedRadarModels],
  );

  const colorIndexMap = useMemo(
    () => new Map(sliceStats.map((stat, index) => [stat.displayName, index])),
    [sliceStats],
  );

  const modelSeries = useMemo(() => {
    return visibleStats.map((stat) => {
      const points = PARALLEL_DIMENSIONS.map((dimension) => {
        const normalizedMap = normalizeAcrossModels(visibleStats, dimension.getValue);
        return {
          key: dimension.key,
          label: dimension.label,
          raw: dimension.getValue(stat),
          normalized: normalizedMap.get(stat.displayName) ?? 50,
          format: dimension.format,
        };
      });
      return { stat, points };
    });
  }, [visibleStats]);

  const axisRanges = useMemo(() => {
    return PARALLEL_DIMENSIONS.map((dimension) => {
      const values = visibleStats.map((stat) => dimension.getValue(stat));
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min;
      return {
        label: dimension.label,
        min,
        max,
        span,
        format: dimension.format,
      };
    });
  }, [visibleStats]);

  if (visibleStats.length === 0) {
    return (
      <div className={`${embedded ? '' : RESON_ANALYTICS_INNER_CARD} py-10 text-center text-sm text-gray-500`}>
        Выберите модели для отображения параллельных координат
      </div>
    );
  }

  const plotHeight = chartHeight - padding.top - padding.bottom;
  const axisCount = PARALLEL_DIMENSIONS.length;
  const axisSpacing = plotWidth / (axisCount - 1);
  const svgWidth = padding.left + plotWidth + padding.right;

  const axisX = (index: number) => padding.left + index * axisSpacing;
  const valueY = (normalized: number) =>
    padding.top + plotHeight * (1 - normalized / 100);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const svgPoint = pt.matrixTransform(ctm.inverse());
    const mouseX = svgPoint.x;
    const mouseY = svgPoint.y;

    let closestModel: string | null = null;
    let minDistance = 20;

    modelSeries.forEach(({ stat, points }) => {
      for (let index = 0; index < points.length - 1; index += 1) {
        const x1 = axisX(index);
        const y1 = valueY(points[index].normalized);
        const x2 = axisX(index + 1);
        const y2 = valueY(points[index + 1].normalized);
        const distance = distanceToSegment(mouseX, mouseY, x1, y1, x2, y2);
        if (distance < minDistance) {
          minDistance = distance;
          closestModel = stat.displayName;
        }
      }
    });

    setHoveredModel(closestModel);
    if (closestModel) {
      const series = modelSeries.find((item) => item.stat.displayName === closestModel);
      if (series) {
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          modelName: closestModel,
          values: Object.fromEntries(
            series.points.map((point) => [point.label, point.raw]),
          ),
        });
      }
    } else {
      setTooltip(null);
    }
  };

  const gridColor = isDark ? "#2A2D35" : "#E5E7EB";
  const axisColor = isDark ? "#3A3D45" : "#D1D5DB";
  const textColor = isDark ? "#9CA3AF" : "#6B7280";
  const labelColor = isDark ? "#D1D5DB" : "#374151";

  return (
    <div
      className={
        embedded
          ? `${compact ? "space-y-2" : "space-y-3"} h-full`
          : `${RESON_ANALYTICS_INNER_CARD} ${compact ? "p-3 space-y-2" : "p-4 space-y-3"} h-full`
      }
    >
      {!embedded && (
        <div className="flex items-start gap-2">
          <Filter className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0`} />
          <div>
            <h4 className={`${RESON_ANALYTICS_SECTION_TITLE} ${compact ? "text-xs" : ""}`}>
              Параллельные координаты
            </h4>
            {!compact && (
              <p className={RESON_ANALYTICS_SUBTITLE}>
                Сравнение моделей по агрегатам среза; каждая ось нормализована отдельно
              </p>
            )}
          </div>
        </div>
      )}

      <div className="w-full">
        <svg
          viewBox={`0 0 ${svgWidth} ${chartHeight}`}
          className={`w-full ${minHeightClass}`}
          role="img"
          aria-label="Параллельные координаты моделей"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoveredModel(null);
            setTooltip(null);
          }}
        >
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = valueY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + plotWidth}
                  y2={y}
                  stroke={gridColor}
                  strokeDasharray="4 4"
                />
                {!compact && (
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill={textColor}
                    fontSize={10}
                  >
                    {tick}
                  </text>
                )}
              </g>
            );
          })}

          {PARALLEL_DIMENSIONS.map((dimension, index) => {
            const x = axisX(index);
            const range = axisRanges[index];
            return (
              <g key={dimension.key}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + plotHeight}
                  stroke={axisColor}
                  strokeWidth={compact ? 1.5 : 2}
                />
                <text
                  x={x}
                  y={padding.top - (compact ? 8 : 12)}
                  textAnchor="middle"
                  fill={labelColor}
                  fontSize={compact ? 10 : 12}
                  fontWeight={600}
                >
                  {compact ? dimension.shortLabel : dimension.label}
                </text>
                {!compact && (
                  <text
                    x={x}
                    y={chartHeight - 18}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={10}
                  >
                    {range.format(range.min)} – {range.format(range.max)}
                  </text>
                )}
              </g>
            );
          })}

          {modelSeries.map(({ stat, points }) => {
            const colorIndex = colorIndexMap.get(stat.displayName) ?? 0;
            const color = ANALYTICS_MODEL_COLORS[colorIndex % ANALYTICS_MODEL_COLORS.length];
            const isHovered = hoveredModel === stat.displayName;
            const isDimmed = hoveredModel !== null && !isHovered;
            const path = points
              .map((point, index) => {
                const x = axisX(index);
                const y = valueY(point.normalized);
                return `${index === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ");

            return (
              <g key={stat.modelName}>
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={compact ? 14 : 18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="stroke"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHovered ? (compact ? 2.5 : 3.5) : compact ? 1.75 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isDimmed ? 0.18 : 0.85}
                  pointerEvents="none"
                />
                {points.map((point, index) => (
                  <circle
                    key={`${stat.modelName}-${point.key}`}
                    cx={axisX(index)}
                    cy={valueY(point.normalized)}
                    r={isHovered ? (compact ? 3.5 : 5) : compact ? 2.5 : 4}
                    fill={color}
                    opacity={isDimmed ? 0.25 : 1}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {tooltip && (
        <div
          className={`fixed z-50 pointer-events-none px-3 py-2 rounded-lg border shadow-lg text-xs ${
            isDark
              ? "bg-[#1A1D24] border-[#2A2D35] text-gray-200"
              : "bg-white border-gray-200 text-gray-800"
          }`}
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-medium mb-1.5">{tooltip.modelName}</p>
          {Object.entries(tooltip.values).map(([label, value]) => {
            const dimension = PARALLEL_DIMENSIONS.find((item) => item.label === label);
            return (
              <div key={label} className="flex justify-between gap-4 tabular-nums">
                <span className={isDark ? "text-gray-400" : "text-gray-500"}>{label}</span>
                <span>{dimension ? dimension.format(value) : value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
