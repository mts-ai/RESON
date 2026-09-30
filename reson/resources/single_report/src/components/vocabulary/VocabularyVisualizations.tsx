import React, { useState, useMemo } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  Cell,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { TrendingUp, BarChart3, Activity, PieChart } from "lucide-react";

export function VocabularyVisualizations() {
  const { theme } = useTheme();
  const { data } = useData();
  const [heatmapMetric, setHeatmapMetric] = useState<"recall" | "precision" | "f1">("recall");

  const vocab = data?.vocab || [];

  // 1. Heatmap Data: Quality vs Frequency - вычисляем из реальных данных
  const heatmapData = useMemo(() => {
    const types = ['Русские', 'Английские', 'Числа', 'Прочие'];
    const ranges = [
      { min: 1, max: 5, suffix: '1_5' },
      { min: 5, max: 50, suffix: '5_50' },
      { min: 50, max: Infinity, suffix: '50plus' },
    ];

    return types.map(type => {
      const typeWords = vocab.filter(w => {
        const word = w.word.toLowerCase();
        if (type === 'Русские') return /[а-яё]/.test(word) && !/[a-z]/.test(word);
        if (type === 'Английские') return /[a-z]/.test(word) && !/[а-яё]/.test(word);
        if (type === 'Числа') return /^\d+$/.test(word);
        return !/[а-яё]/.test(word) && !/[a-z]/.test(word) && !/^\d+$/.test(word);
      });

      const result: any = { type };
      
      ranges.forEach(range => {
        const rangeWords = typeWords.filter(w => w.count >= range.min && w.count < range.max);
        if (rangeWords.length > 0) {
          result[`range${range.suffix}_recall`] = rangeWords.reduce((sum, w) => sum + (w.recall || 0), 0) / rangeWords.length;
          result[`range${range.suffix}_precision`] = rangeWords.reduce((sum, w) => sum + (w.precision || 0), 0) / rangeWords.length;
          result[`range${range.suffix}_f1`] = rangeWords.reduce((sum, w) => sum + (w.f1_score || 0), 0) / rangeWords.length;
        } else {
          result[`range${range.suffix}_recall`] = 0;
          result[`range${range.suffix}_precision`] = 0;
          result[`range${range.suffix}_f1`] = 0;
        }
      });
      
      return result;
    });
  }, [vocab]);

  // 2. Кластеры распределения: X = частота, Y = Recall
  const densityData = useMemo(() => {
    if (vocab.length === 0) return [];

    const frequencyBinSize = 0.05;
    const recallBinSize = 2;

    const bins: Record<
      string,
      { count: number; frequencies: number[]; recalls: number[]; words: string[] }
    > = {};

    vocab.forEach((w) => {
      const frequency = w.count;
      const recall = w.recall || 0;
      const freqBin =
        Math.floor(Math.log10(Math.max(1, frequency)) / frequencyBinSize) *
        frequencyBinSize;
      const recallBin = Math.floor(recall / recallBinSize) * recallBinSize;
      const binKey = `${freqBin}_${recallBin}`;

      if (!bins[binKey]) {
        bins[binKey] = { count: 0, frequencies: [], recalls: [], words: [] };
      }
      bins[binKey].count++;
      bins[binKey].frequencies.push(frequency);
      bins[binKey].recalls.push(recall);
      if (bins[binKey].words.length < 3) {
        bins[binKey].words.push(w.word);
      }
    });

    return Object.entries(bins).map(([key, data]) => {
      const [freqBin, recallBin] = key.split("_").map(Number);
      const avgFrequency =
        data.frequencies.length > 0
          ? data.frequencies.reduce((a, b) => a + b, 0) / data.frequencies.length
          : Math.pow(10, freqBin);
      const avgRecall =
        data.recalls.length > 0
          ? data.recalls.reduce((a, b) => a + b, 0) / data.recalls.length
          : recallBin;

      return {
        frequency: avgFrequency,
        recall: avgRecall,
        count: data.count,
        sampleWords: data.words,
      };
    });
  }, [vocab]);

  // 3. Word Length Distribution - вычисляем из реальных данных
  const lengthDistribution = useMemo(() => {
    const dist: Record<number, number> = {};
    vocab.forEach(w => {
      const len = w.word.length;
      dist[len] = (dist[len] || 0) + 1;
    });
    return Object.entries(dist)
      .map(([length, count]) => ({ length: parseInt(length), count }))
      .sort((a, b) => a.length - b.length);
  }, [vocab]);

  // 4. Cumulative Coverage (Pareto) - вычисляем из реальных данных
  const paretoData = useMemo(() => {
    const sorted = [...vocab].sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, w) => sum + w.count, 0);
    const percentages = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    
    return percentages.map(percent => {
      const targetCount = Math.floor((percent / 100) * sorted.length);
      const topWords = sorted.slice(0, targetCount);
      const coverage = topWords.reduce((sum, w) => sum + w.count, 0) / total * 100;
      return { percent, coverage: Number(Math.min(100, coverage).toFixed(2)) };
    });
  }, [vocab]);

  // 5. Error Types by Frequency Range - используем реальные данные об ошибках
  const errorTypeData = useMemo(() => {
    const ranges = [
      { min: 1, max: 5, label: "1-5" },
      { min: 5, max: 50, label: "5-50" },
      { min: 50, max: 500, label: "50-500" },
      { min: 500, max: Infinity, label: "500+" },
    ];
    
    return ranges.map(range => {
      const rangeWords = vocab.filter(w => w.count >= range.min && w.count < range.max);
      
      // Используем реальные данные об ошибках из vocab
      const totalInsertions = rangeWords.reduce((sum, w) => sum + (w.insertions || 0), 0);
      const totalDeletions = rangeWords.reduce((sum, w) => sum + (w.deletions || 0), 0);
      const totalSubstitutions = rangeWords.reduce((sum, w) => sum + (w.substitutions || 0), 0);
      
      return {
        range: range.label,
        insertions: totalInsertions,
        deletions: totalDeletions,
        substitutions: totalSubstitutions,
      };
    });
  }, [vocab]);

  // 6. WIS Distribution - используем реальный WIS из данных
  const wisDistribution = useMemo(() => {
    // Используем реальный WIS из данных (диапазон 0-100)
    const wisValues = vocab.map(w => w.wis || 0);
    
    const ranges = [
      { min: 0, max: 30, label: "Маленький (0-30)", color: "#10B981" },
      { min: 30, max: 45, label: "Умеренный (30-45)", color: "#A3E635" },
      { min: 45, max: 60, label: "Средний (45-60)", color: "#F59E0B" },
      { min: 60, max: 75, label: "Высокий (60-75)", color: "#F97316" },
      { min: 75, max: 100, label: "Критический (75-100)", color: "#EF4444" },
    ];

    return ranges.map(range => {
      const count = wisValues.filter(w => w >= range.min && (w < range.max || (range.max === 100 && w <= range.max))).length;
      return {
        range: range.label,
        rangeShort: `${range.min}-${range.max === 100 ? "100" : range.max}`,
        count,
        percentage: vocab.length > 0 ? (count / vocab.length) * 100 : 0,
        color: range.color,
      };
    });
  }, [vocab]);

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className={`rounded-lg p-3 border shadow-lg ${
            theme === "dark"
              ? "bg-[#1A1D24] border-[#2A2D35]"
              : "bg-white border-gray-200"
          }`}
        >
          <p
            className={`text-xs mb-1 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className={`text-sm ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value}
              {entry.unit || ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get color based on value (for heatmap)
  const getHeatmapColor = (value: number) => {
    if (value === 0) return theme === "dark" ? "#1A1D24" : "#F3F4F6";
    if (value >= 80) return theme === "dark" ? "#065F46" : "#10B981";
    if (value >= 60) return theme === "dark" ? "#B45309" : "#F59E0B";
    return theme === "dark" ? "#991B1B" : "#EF4444";
  };

  // Вычисляем максимальное количество слов в бине для нормализации размера точек
  const maxBinCount = useMemo(() => {
    return Math.max(...densityData.map(d => d.count), 1);
  }, [densityData]);

  const clusterFill = theme === "dark" ? "#8B5CF6" : "#7C3AED";
  const clusterStroke = theme === "dark" ? "#A78BFA" : "#6D28D9";
  const vizCard = `reson-vocab-viz-card ${theme === "dark" ? "reson-vocab-viz-card--dark" : ""}`;
  const VIZ_CHART_HEIGHT = 150;
  const VIZ_SCATTER_HEIGHT = 220;
  const VIZ_ERRORS_HEIGHT = 120;

  return (
    <div className="reson-vocab-viz-page">
      {/* Heatmap — full width */}
      <div className={vizCard} data-tour="vocabulary-visualizations">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
            <h3
              className={`reson-vocab-panel-title ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              Тепловая карта: Качество vs Частота
            </h3>
          </div>
          <div className="flex gap-2">
            {(["recall", "precision", "f1"] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setHeatmapMetric(metric)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  heatmapMetric === metric
                    ? theme === "dark"
                      ? "bg-[#8B5CF6] text-white"
                      : "bg-purple-600 text-white"
                    : theme === "dark"
                      ? "bg-[#23262F] text-gray-400 hover:bg-[#2A2D35]"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {metric === "recall" ? "Recall" : metric === "precision" ? "Precision" : "F1-score"}
              </button>
            ))}
          </div>
        </div>
        <p
          className={`reson-vocab-panel-desc mb-2 ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Средний {heatmapMetric === "recall" ? "Recall" : heatmapMetric === "precision" ? "Precision" : "F1-score"} по типам слов и частотным диапазонам
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse reson-vocab-viz-heatmap">
            <thead>
              <tr>
                <th
                  className={`text-left ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Тип слова
                </th>
                <th
                  className={`text-center ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  1-5 вхождений
                </th>
                <th
                  className={`text-center ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  5-50 вхождений
                </th>
                <th
                  className={`text-center ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  50+ вхождений
                </th>
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, index) => {
                const suffix = heatmapMetric === "recall" ? "_recall" : heatmapMetric === "precision" ? "_precision" : "_f1";
                const range1_5 = row[`range1_5${suffix}` as keyof typeof row] as number;
                const range5_50 = row[`range5_50${suffix}` as keyof typeof row] as number;
                const range50plus = row[`range50plus${suffix}` as keyof typeof row] as number;
                
                return (
                  <tr key={index}>
                    <td
                      className={`reson-vocab-viz-heatmap-type ${
                        theme === "dark" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {row.type}
                    </td>
                    <td>
                      <div
                        className="reson-vocab-viz-heatmap-cell"
                        style={{
                          backgroundColor: getHeatmapColor(range1_5),
                          color: theme === "dark" ? "#fff" : "#000",
                        }}
                      >
                        {range1_5.toFixed(1)}%
                      </div>
                    </td>
                    <td>
                      <div
                        className="reson-vocab-viz-heatmap-cell"
                        style={{
                          backgroundColor: getHeatmapColor(range5_50),
                          color: theme === "dark" ? "#fff" : "#000",
                        }}
                      >
                        {range5_50.toFixed(1)}%
                      </div>
                    </td>
                    <td>
                      <div
                        className="reson-vocab-viz-heatmap-cell"
                        style={{
                          backgroundColor: getHeatmapColor(range50plus),
                          color: theme === "dark" ? "#fff" : "#000",
                        }}
                      >
                        {range50plus.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="reson-vocab-viz-legend">
          <div className="reson-vocab-viz-legend-item">
            <div
              className="reson-vocab-viz-legend-swatch"
              style={{
                backgroundColor: theme === "dark" ? "#065F46" : "#10B981",
              }}
            />
            <span>Отлично (&gt;80%)</span>
          </div>
          <div className="reson-vocab-viz-legend-item">
            <div
              className="reson-vocab-viz-legend-swatch"
              style={{
                backgroundColor: theme === "dark" ? "#B45309" : "#F59E0B",
              }}
            />
            <span>Средне (60–80%)</span>
          </div>
          <div className="reson-vocab-viz-legend-item">
            <div
              className="reson-vocab-viz-legend-swatch"
              style={{
                backgroundColor: theme === "dark" ? "#991B1B" : "#EF4444",
              }}
            />
            <span>Плохо (&lt;60%)</span>
          </div>
        </div>
      </div>

      {/* Row: Errors + WIS */}
      <div className="reson-vocab-viz-pair">
      <div className={vizCard}>
        <div className="flex items-center gap-2 mb-1">
          <PieChart className="w-4 h-4 text-[#8B5CF6]" />
          <h3
            className={`reson-vocab-panel-title ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Типы ошибок по частотным диапазонам
          </h3>
        </div>
        <p
          className={`reson-vocab-panel-desc mb-2 ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          INS, DEL и SUB по частоте слов
        </p>

        <div className="reson-vocab-viz-chart reson-vocab-viz-chart--compact">
          <ResponsiveContainer width="100%" height={VIZ_ERRORS_HEIGHT}>
            <BarChart data={errorTypeData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme === "dark" ? "#2A2D35" : "#E5E7EB"}
            />
            <XAxis
              dataKey="range"
              tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 9 }}
            />
            <YAxis
              tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 9 }}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: "0",
                fontSize: "9px",
              }}
              iconSize={6}
              iconType="circle"
            />
            <Bar
              dataKey="insertions"
              name="Вставки"
              fill="#3B82F6"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="deletions"
              name="Удаления"
              fill="#EF4444"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="substitutions"
              name="Замены"
              fill="#F59E0B"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* WIS Distribution */}
      <div className={vizCard}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
            <h3
              className={`reson-vocab-panel-title ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              Распределение WIS
            </h3>
          </div>
          <p
            className={`reson-vocab-panel-desc mb-2 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Word Importance Score по диапазонам
          </p>
          <div className="reson-vocab-viz-chart">
            <ResponsiveContainer width="100%" height={VIZ_CHART_HEIGHT}>
              <BarChart data={wisDistribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme === "dark" ? "#2A2D35" : "#E5E7EB"}
              />
              <XAxis
                dataKey="rangeShort"
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 9 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
                width={36}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div
                        className={`rounded-lg p-3 border shadow-lg ${
                          theme === "dark"
                            ? "bg-[#1A1D24] border-[#2A2D35]"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <p
                          className={`text-sm mb-2 font-medium ${
                            theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                          style={{ color: data.color }}
                        >
                          {data.range}
                        </p>
                        <div className="space-y-1 text-xs">
                          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                            Количество: <span style={{ color: data.color }} className="font-semibold">{data.count}</span>
                          </p>
                          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                            Процент: <span style={{ color: data.color }} className="font-semibold">{data.percentage.toFixed(1)}%</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]} 
                name="count"
              >
                {wisDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
            </ResponsiveContainer>
          </div>
      </div>
      </div>

      {/* Row: Word Length + Pareto */}
      <div className="reson-vocab-viz-pair">
        <div className={vizCard}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
            <h3
              className={`reson-vocab-panel-title ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              Распределение по длине слов
            </h3>
          </div>
          <p
            className={`reson-vocab-panel-desc mb-2 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Количество слов для каждой длины в символах
          </p>

          <div className="reson-vocab-viz-chart">
            <ResponsiveContainer width="100%" height={VIZ_CHART_HEIGHT}>
              <ComposedChart data={lengthDistribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme === "dark" ? "#2A2D35" : "#E5E7EB"}
              />
              <XAxis
                dataKey="length"
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
                width={36}
              />
              <Tooltip 
                content={({ active, payload, label }: any) => {
                  if (active && payload && payload.length) {
                    return (
                      <div
                        className={`rounded-lg p-3 border shadow-lg ${
                          theme === "dark"
                            ? "bg-[#1A1D24] border-[#2A2D35]"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <p
                          className={`text-xs mb-1 ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Длина: {label} символов
                        </p>
                        {payload.map((entry: any, index: number) => (
                          <p
                            key={index}
                            className={`text-sm ${
                              theme === "dark" ? "text-white" : "text-gray-900"
                            }`}
                            style={{ color: entry.color }}
                          >
                            {entry.name === "count" ? "Количество" : entry.name === "trend" ? "Тренд" : entry.name}: {entry.value.toFixed(entry.name === "trend" ? 1 : 0)}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="count" />
              <Line 
                type="monotone" 
                dataKey="trend" 
                stroke="#F59E0B" 
                strokeWidth={2}
                dot={false}
                name="trend"
                strokeDasharray="5 5"
              />
            </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={vizCard}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
            <h3
              className={`reson-vocab-panel-title ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              Кумулятивное покрытие словарём
            </h3>
          </div>
          <p
            className={`reson-vocab-panel-desc mb-2 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Закон Парето: какая доля слов обеспечивает большую часть вхождений
          </p>

          <div className="reson-vocab-viz-chart">
            <ResponsiveContainer width="100%" height={VIZ_CHART_HEIGHT}>
              <AreaChart data={paretoData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme === "dark" ? "#2A2D35" : "#E5E7EB"}
              />
              <XAxis
                dataKey="percent"
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 10 }}
                width={36}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (active && payload && payload.length) {
                    return (
                      <div
                        className={`rounded-lg p-3 border shadow-lg ${
                          theme === "dark"
                            ? "bg-[#1A1D24] border-[#2A2D35]"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <p
                          className={`text-xs mb-1 ${
                            theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {label}% самых частых слов
                        </p>
                        {payload.map((entry: any, index: number) => (
                          <p
                            key={index}
                            className={`text-sm ${
                              theme === "dark" ? "text-white" : "text-gray-900"
                            }`}
                            style={{ color: entry.color }}
                          >
                            {entry.name === "coverage" || entry.name === "Coverage" ? "Покрытие" : entry.name}: {entry.value.toFixed(2)}%
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="coverage"
                stroke="#8B5CF6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCoverage)"
                name="coverage"
              />
              {/* 80-20 line marker */}
              <Line
                type="monotone"
                data={[
                  { percent: 20, coverage: 0 },
                  { percent: 20, coverage: 100 },
                ]}
                dataKey="coverage"
                stroke="#EF4444"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
            </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Scatter — full width */}
      <div className={vizCard}>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-[#8B5CF6]" />
          <h3
            className={`reson-vocab-panel-title ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            График распределения слов
          </h3>
        </div>
        <p
          className={`reson-vocab-panel-desc mb-2 ${
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          Кластеры слов по частоте и Recall. Размер круга — число слов в кластере.
        </p>

        <div className="reson-vocab-viz-chart reson-vocab-viz-chart--tall relative w-full">
          <ResponsiveContainer width="100%" height={VIZ_SCATTER_HEIGHT}>
            <ScatterChart margin={{ top: 12, right: 20, bottom: 36, left: 52 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme === "dark" ? "#2A2D35" : "#E5E7EB"}
                strokeOpacity={0.6}
              />
              <XAxis
                type="number"
                dataKey="frequency"
                name="Частота"
                scale="log"
                domain={[1, "dataMax"]}
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 11 }}
                tickLine={{ stroke: theme === "dark" ? "#2A2D35" : "#E5E7EB", strokeWidth: 1 }}
                axisLine={{ stroke: theme === "dark" ? "#2A2D35" : "#E5E7EB", strokeWidth: 1.5 }}
                label={{
                  value: "Частота (log)",
                  position: "insideBottom",
                  offset: -4,
                  fill: theme === "dark" ? "#9CA3AF" : "#6B7280",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="recall"
                name="Recall"
                domain={[0, 100]}
                tick={{ fill: theme === "dark" ? "#9CA3AF" : "#6B7280", fontSize: 11 }}
                tickLine={{ stroke: theme === "dark" ? "#2A2D35" : "#E5E7EB", strokeWidth: 1 }}
                axisLine={{ stroke: theme === "dark" ? "#2A2D35" : "#E5E7EB", strokeWidth: 1.5 }}
                width={44}
                label={{
                  value: "Recall (%)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 8,
                  fill: theme === "dark" ? "#9CA3AF" : "#6B7280",
                  fontSize: 11,
                }}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload;
                    return (
                      <div
                        className={`rounded-lg p-3 border shadow-lg ${
                          theme === "dark"
                            ? "bg-[#1A1D24] border-[#2A2D35]"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <p className={`text-sm mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                          Кластер
                        </p>
                        <div className="space-y-1 text-xs">
                          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                            Частота: <span className="text-blue-500">{point.frequency.toFixed(1)}</span>
                          </p>
                          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                            Recall: <span className="text-blue-500">{point.recall.toFixed(1)}%</span>
                          </p>
                          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                            Слов в кластере: <span className="text-amber-500">{point.count}</span>
                          </p>
                          {point.sampleWords?.length > 0 && (
                            <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                              Примеры: <span className="text-gray-500">{point.sampleWords.join(", ")}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter
                data={densityData}
                fill={clusterFill}
                isAnimationActive={false}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const sizeRatio =
                    maxBinCount > 0
                      ? Math.log10(1 + (payload.count - 1) * 9) /
                        Math.log10(1 + (maxBinCount - 1) * 9)
                      : 0;
                  const radius = 4 + sizeRatio * 22;

                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={clusterFill}
                      fillOpacity={0.35 + sizeRatio * 0.45}
                      stroke={clusterStroke}
                      strokeWidth={1}
                      strokeOpacity={0.8}
                    />
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
