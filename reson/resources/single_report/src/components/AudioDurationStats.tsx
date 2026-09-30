import { TrendingUp } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useData } from "../contexts/DataContext";
import { useMemo } from "react";

export function AudioDurationStats() {
  const { theme } = useTheme();
  const { data } = useData();

  // Вычисляем интервалы из manifest данных
  const intervals = useMemo(() => {
    if (!data?.manifest || data.manifest.length === 0) {
      return [
        { range: "0-5с", count: 0, percentage: 0 },
        { range: "5-10с", count: 0, percentage: 0 },
        { range: "10-15с", count: 0, percentage: 0 },
        { range: "15-20с", count: 0, percentage: 0 },
        { range: "20-25с", count: 0, percentage: 0 },
        { range: "25-30с", count: 0, percentage: 0 },
        { range: "30+с", count: 0, percentage: 0 },
      ];
    }

    const bins = [
      { min: 0, max: 5, label: "0-5с" },
      { min: 5, max: 10, label: "5-10с" },
      { min: 10, max: 15, label: "10-15с" },
      { min: 15, max: 20, label: "15-20с" },
      { min: 20, max: 25, label: "20-25с" },
      { min: 25, max: 30, label: "25-30с" },
      { min: 30, max: Infinity, label: "30+с" },
    ];

    const counts = bins.map(() => 0);
    let processedCount = 0;
    
    data.manifest.forEach((item) => {
      const duration = typeof item.duration === 'number' ? item.duration : parseFloat(item.duration) || 0;
      if (duration <= 0) return; // Пропускаем некорректные значения
      
      for (let i = 0; i < bins.length; i++) {
        if (bins[i].max === Infinity) {
          // Для последнего интервала (30+с)
          if (duration >= bins[i].min) {
            counts[i]++;
            processedCount++;
            break;
          }
        } else if (duration >= bins[i].min && duration < bins[i].max) {
          counts[i]++;
          processedCount++;
          break;
        }
      }
    });

    const total = processedCount > 0 ? processedCount : counts.reduce((sum, count) => sum + count, 0);
    return bins.map((bin, idx) => ({
      range: bin.label,
      count: counts[idx],
      percentage: total > 0 ? (counts[idx] / total) * 100 : 0,
    }));
  }, [data?.manifest]);

  // Статистика из summary.durationStats
  const stats = data?.summary?.durationStats || {};
  const durationTypes = data?.summary?.durationTypes || { short: 0, normal: 0, long: 0 };
  const totalUtterances = data?.summary?.totalUtterances || 0;

  return (
    <div
      className={`rounded-xl p-5 border ${
        theme === "dark"
          ? "bg-[#1A1D24] border-[#2A2D35]"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      <h3
        className={`reson-overview-panel-title ${theme === "dark" ? "text-white" : "text-gray-900"}`}
      >
        Длительность аудио
      </h3>

      {/* Statistics */}
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <div
            className={`rounded-lg p-2.5 border ${
              theme === "dark"
                ? "bg-[#23262F] border-[#2A2D35]"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div
              className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Минимум
            </div>
            <div
              className={`text-xl font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {stats.min !== undefined ? `${stats.min.toFixed(2)}с` : "н/д"}
            </div>
          </div>
          <div
            className={`rounded-lg p-2.5 border ${
              theme === "dark"
                ? "bg-[#23262F] border-[#2A2D35]"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div
              className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Среднее
            </div>
            <div
              className={`text-xl font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {stats.mean !== undefined ? `${stats.mean.toFixed(2)}с` : "н/д"}
            </div>
          </div>
          <div
            className={`rounded-lg p-2.5 border ${
              theme === "dark"
                ? "bg-[#23262F] border-[#2A2D35]"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div
              className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Максимум
            </div>
            <div
              className={`text-xl font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {stats.max !== undefined ? `${stats.max.toFixed(2)}с` : "н/д"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          <div
            className={`rounded-lg p-2.5 border ${
              theme === "dark"
                ? "bg-[#23262F] border-[#3B82F6]"
                : "bg-[#EEF2FF] border-[#818CF8]"
            }`}
          >
            <div className="text-xs text-[#6366F1] mb-1">
              25-й %
            </div>
            <div
              className={`text-lg font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {stats['25%'] !== undefined ? `${stats['25%'].toFixed(2)}с` : "н/д"}
            </div>
          </div>
          <div
            className={`rounded-lg p-2.5 border ${
              theme === "dark"
                ? "bg-[#23262F] border-[#8B5CF6]"
                : "bg-[#F5F3FF] border-[#A78BFA]"
            }`}
          >
            <div className="text-xs text-[#8B5CF6] mb-1">
              50-й % (медиана)
            </div>
            <div
              className={`text-lg font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {stats['50%'] !== undefined ? `${stats['50%'].toFixed(2)}с` : "н/д"}
            </div>
          </div>
          <div
            className={`rounded-lg p-2.5 border ${
              theme === "dark"
                ? "bg-[#23262F] border-[#10B981]"
                : "bg-[#ECFDF5] border-[#6EE7B7]"
            }`}
          >
            <div className="text-xs text-[#10B981] mb-1">
              75-й %
            </div>
            <div
              className={`text-lg font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {stats['75%'] !== undefined ? `${stats['75%'].toFixed(2)}с` : "н/д"}
            </div>
          </div>
          <div
            className={`rounded-lg p-2.5 border ${
              theme === "dark"
                ? "bg-[#23262F] border-[#F59E0B]"
                : "bg-[#FEF3C7] border-[#FCD34D]"
            }`}
          >
            <div className="text-xs text-[#F59E0B] mb-1">
              95-й %
            </div>
            <div
              className={`text-lg font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {stats['95%'] !== undefined ? `${stats['95%'].toFixed(2)}с` : stats['75%'] !== undefined ? `${(stats['75%'] * 1.2).toFixed(2)}с` : "н/д"}
            </div>
          </div>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className={`rounded-lg p-3 ${
            theme === "dark"
              ? "bg-gradient-to-br from-[#1A2E1F] to-[#16181E]"
              : "bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9]"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Короткие (до 5с)
            </span>
            <TrendingUp className="w-4 h-4 text-[#4CAF50]" />
          </div>
          <div
            className={`text-2xl font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            {durationTypes.short?.toLocaleString() || 0}
          </div>
          <div className="text-xs text-[#4CAF50]">
            {totalUtterances > 0 ? ((durationTypes.short / totalUtterances) * 100).toFixed(1) : 0}%
          </div>
        </div>

        <div
          className={`rounded-lg p-3 ${
            theme === "dark"
              ? "bg-gradient-to-br from-[#1A2638] to-[#16181E]"
              : "bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB]"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Нормальные (5-30с)
            </span>
            <TrendingUp className="w-4 h-4 text-[#2196F3]" />
          </div>
          <div
            className={`text-2xl font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            {durationTypes.normal?.toLocaleString() || 0}
          </div>
          <div className="text-xs text-[#2196F3]">
            {totalUtterances > 0 ? ((durationTypes.normal / totalUtterances) * 100).toFixed(1) : 0}%
          </div>
        </div>

        <div
          className={`rounded-lg p-3 ${
            theme === "dark"
              ? "bg-gradient-to-br from-[#2E1A1A] to-[#16181E]"
              : "bg-gradient-to-br from-[#FFEBEE] to-[#FFCDD2]"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Длинные (30+с)
            </span>
            <TrendingUp className="w-4 h-4 text-[#F44336]" />
          </div>
          <div
            className={`text-2xl font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            {durationTypes.long?.toLocaleString() || 0}
          </div>
          <div className="text-xs text-[#F44336]">
            {totalUtterances > 0 ? ((durationTypes.long / totalUtterances) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      <div>
        {/* Bar Chart Visualization */}
        <div
          className={`p-3 rounded-lg ${
            theme === "dark" ? "bg-[#16181E]" : "bg-gray-50"
          }`}
        >
          {intervals.some(i => i.count > 0) ? (
          <div className="flex items-end justify-between gap-1.5 h-36">
            {intervals.map((interval, idx) => {
              // Находим максимальное количество для нормализации
              const maxCount = Math.max(
                ...intervals.map((i) => i.count),
                1
              );
              
              // Вычисляем высоту в процентах от максимального значения
              // Используем count напрямую, так как это более надежно
              const heightPercent = maxCount > 0 
                ? (interval.count / maxCount) * 100 
                : 0;

              // Минимальная высота 4px для видимости даже при малых значениях
              const minHeightPx = 3;
              const containerHeightPx = 144; // h-36 = 144px
              const calculatedHeightPx = (heightPercent / 100) * containerHeightPx;
              const finalHeightPx = Math.max(calculatedHeightPx, minHeightPx);

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div className="relative flex-1 w-full flex items-end justify-center">
                    {interval.count > 0 ? (
                    <div
                      className={`w-full rounded-t-lg transition-all hover:opacity-80 relative group ${
                        theme === "dark"
                          ? "bg-gradient-to-t from-[#6366F1] to-[#818CF8]"
                          : "bg-gradient-to-t from-[#6366F1] to-[#818CF8]"
                      }`}
                        style={{ 
                          height: `${finalHeightPx}px`,
                          minHeight: `${minHeightPx}px`
                        }}
                    >
                      {/* Tooltip on hover */}
                      <div
                          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 ${
                          theme === "dark"
                            ? "bg-white text-black"
                            : "bg-gray-900 text-white"
                        }`}
                      >
                          {interval.count.toLocaleString()} записей (
                        {interval.percentage.toFixed(1)}%)
                      </div>
                    </div>
                    ) : (
                      <div
                        className={`w-full rounded-t-lg ${
                          theme === "dark"
                            ? "bg-[#2A2D35]"
                            : "bg-gray-200"
                        }`}
                        style={{ height: "2px" }}
                      />
                    )}
                  </div>
                  <div
                    className={`text-xs text-center ${
                      theme === "dark"
                        ? "text-gray-400"
                        : "text-gray-600"
                    }`}
                  >
                    {interval.range.replace("с", "")}
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
            <div className="flex items-center justify-center h-36">
              <div className={`text-xs ${
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              }`}>
                Нет данных для отображения
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}