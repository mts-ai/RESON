import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Activity } from "./icons";
import { useTheme } from "./ThemeProvider";
import { RESON_ANALYTICS_INNER_CARD } from "../styles/reportStyles";
import {
  ANALYTICS_MODEL_COLORS,
  PROFILE_AXIS_DESCRIPTIONS,
  buildMultiModelRadarData,
  computeModelProfile,
  type AnalyticsSliceStat,
} from "../utils/analyticsModelProfile";

interface AnalyticsRadarChartProps {
  sliceStats: AnalyticsSliceStat[];
  selectedRadarModels: Set<string>;
  compact?: boolean;
  embedded?: boolean;
}

function ProfileTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="reson-analytics-radar-tooltip">
      <p className="reson-analytics-radar-tooltip-title">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="reson-analytics-radar-tooltip-row">
          <span
            className="reson-analytics-radar-tooltip-dot"
            style={{ backgroundColor: entry.color }}
          />
          <span className="reson-analytics-radar-tooltip-name">{entry.name}</span>
          <span className="reson-analytics-radar-tooltip-value">
            {entry.value.toFixed(1)}%
          </span>
        </div>
      ))}
      {label && PROFILE_AXIS_DESCRIPTIONS[label] ? (
        <p className="reson-analytics-radar-tooltip-desc">
          {PROFILE_AXIS_DESCRIPTIONS[label]}
        </p>
      ) : null}
    </div>
  );
}

export function AnalyticsRadarChart({
  sliceStats,
  selectedRadarModels,
  compact = false,
  embedded = false,
}: AnalyticsRadarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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

  const profiles = useMemo(
    () =>
      visibleStats.map((stat) => ({
        displayName: stat.displayName,
        metrics: computeModelProfile(stat),
      })),
    [visibleStats],
  );

  const radarData = useMemo(() => buildMultiModelRadarData(profiles), [profiles]);

  if (visibleStats.length === 0) {
    return (
      <div className={`${embedded ? '' : RESON_ANALYTICS_INNER_CARD} p-6 text-center text-sm text-gray-500`}>
        Выберите модели для отображения профиля
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? `${compact ? "space-y-2" : "space-y-3"} h-full`
          : `${RESON_ANALYTICS_INNER_CARD} ${compact ? "p-3 space-y-2" : "p-4 space-y-3"} h-full`
      }
    >
      {!embedded && (
        <div className={`flex items-center gap-3 ${compact ? "mb-2" : "mb-4"}`}>
          <div className={`p-2 rounded-lg ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
            <Activity className={`${compact ? "w-4 h-4" : "w-5 h-5"} ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
          </div>
          <div>
            <h3 className={`${compact ? "text-xs" : "text-sm"} mb-0.5 ${isDark ? "text-white" : "text-gray-900"}`}>
              Профиль моделей
            </h3>
            {!compact && (
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Радарный профиль по метрикам текущего среза
              </p>
            )}
          </div>
        </div>
      )}

      <div
        className={`reson-analytics-chart ${
          compact ? "reson-analytics-chart-h-300" : "reson-analytics-chart-h-420"
        }`}
      >
        <ResponsiveContainer width="100%" height={compact ? 300 : 420}>
          <RadarChart
            data={radarData}
            cx="50%"
            cy="50%"
            outerRadius={compact ? "82%" : "78%"}
          >
          <PolarGrid stroke={isDark ? "#2A2D35" : "#E5E7EB"} strokeWidth={1} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{
              fill: isDark ? "#9CA3AF" : "#6B7280",
              fontSize: compact ? 10 : 13,
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{
              fill: isDark ? "#6B7280" : "#9CA3AF",
              fontSize: compact ? 9 : 11,
            }}
            tickCount={compact ? 5 : 6}
          />
          {profiles.map((profile) => {
            const colorIndex = colorIndexMap.get(profile.displayName) ?? 0;
            const color = ANALYTICS_MODEL_COLORS[colorIndex % ANALYTICS_MODEL_COLORS.length];
            return (
              <Radar
                key={profile.displayName}
                name={profile.displayName}
                dataKey={profile.displayName}
                stroke={color}
                fill={color}
                fillOpacity={isDark ? 0.22 : 0.18}
                strokeWidth={2}
              />
            );
          })}
          <Tooltip
            content={<ProfileTooltip />}
            wrapperStyle={{ outline: "none", zIndex: 20 }}
            contentStyle={{
              background: "transparent",
              border: "none",
              boxShadow: "none",
              padding: 0,
            }}
            cursor={{ stroke: isDark ? "#4B5563" : "#D1D5DB", strokeWidth: 1 }}
          />
        </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
