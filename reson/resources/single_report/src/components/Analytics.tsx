import { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CorrelationMatrix } from './CorrelationMatrix';
import { ErrorHeatmap } from './ErrorHeatmap';
import type { HeatmapRow } from '../types/data';
import { ChevronRight, BarChart3, PieChart as PieChartIcon, Clock, SlidersHorizontal, TrendingUp, Layers, Activity, LayoutGrid } from 'lucide-react';
import { HeaderActionButton } from './ui/HeaderActionButton';
import { DatasetSummaryObservations } from './analytics/DatasetSummaryObservations';
import { SliceFilterModal } from './analytics/SliceFilterModal';
import { SliceInsightsMenu } from './analytics/SliceInsightsMenu';
import { SliceChartCard } from './analytics/SliceChartCard';
import { SliceWerProfilePanel } from './analytics/SliceWerProfilePanel';
import {
  analyticsSubtabClass,
  buildDatasetSummaryObservations,
  type AnalyticsMainTab,
  type DistributionView,
} from './analytics/analyticsHelpers';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ZAxis,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';

const DURATION_LABELS: Record<string, string> = {
  short: 'Короткие (0-5s)',
  normal: 'Нормальные (5-30s)',
  long: 'Длинные (>30s)',
};

function emptySliceData(heatmapData: HeatmapRow[] = []) {
  return {
    samples: 0,
    avgDuration: 0,
    insertions: 0,
    deletions: 0,
    substitutions: 0,
    avgWer: 0,
    heatmapData,
    errorsByDuration: [
      { range: DURATION_LABELS.short, insertions: 0, deletions: 0, substitutions: 0 },
      { range: DURATION_LABELS.normal, insertions: 0, deletions: 0, substitutions: 0 },
      { range: DURATION_LABELS.long, insertions: 0, deletions: 0, substitutions: 0 },
    ],
    werByDuration: [
      { range: 'Короткие', wer: 0 },
      { range: 'Нормальные', wer: 0 },
      { range: 'Длинные', wer: 0 },
    ],
    correlationData: [] as Array<{
      duration: number;
      wer: number;
      errors: number;
      insertions: number;
      deletions: number;
      substitutions: number;
      filePath: string;
      trendWer?: number;
      werDisplay?: number;
    }>,
    werDistribution: [] as Array<{
      range: string;
      density: number;
      insertions: number;
      deletions: number;
      substitutions: number;
      samples: number;
    }>,
    durationDistribution: [] as Array<{
      range: string;
      samples: number;
      insertions: number;
      deletions: number;
      substitutions: number;
    }>,
    werByDurationBins: [] as Array<{
      range: string;
      durationCenter: number;
      count: number;
      meanWer: number;
      q25: number;
      q75: number;
    }>,
  };
}


// Названия фильтров для отображения
const filterLabels: Record<string, string> = {
  all: 'Все',
  short: 'Короткие (до 5 с)',
  normal: 'Средние (5–30 с)',
  medium: 'Нормальные (5-30с)',
  long: 'Длинные (30+ с)',
  low: 'Низкий WER',
  top10: 'Топ-10% WER',
  'p80-90': '80-90 перцентиль',
  below80: 'До 80 перцентиля',
};

function getDurationType(duration: number): 'short' | 'normal' | 'long' {
  if (duration < 5) return 'short';
  if (duration < 30) return 'normal';
  return 'long';
}

function useIsMobile(maxWidth = 767) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [maxWidth]);
  return isMobile;
}

export function Analytics() {
  const { theme } = useTheme();
  const { data, loading, error } = useData();
  const isMobile = useIsMobile();
  const [durationFilter, setDurationFilter] = useState('all');
  const [werFilter, setWerFilter] = useState('all');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showWerErrors, setShowWerErrors] = useState({
    insertions: false,
    deletions: false,
    substitutions: false,
  });
  const [showDurationErrors, setShowDurationErrors] = useState({
    insertions: false,
    deletions: false,
    substitutions: false,
  });
  const [activeMainTab, setActiveMainTab] = useState<AnalyticsMainTab>('dataset');
  const [distributionView, setDistributionView] = useState<DistributionView>('wer-dist');

  // Реальные данные из манифеста и метрик
  const sliceData = useMemo(() => {
    const manifest = (data?.manifest ?? []) as Array<{ duration?: number; WER?: number; INS?: number; DEL?: number; SUB?: number; audio_filepath?: string; duration_type?: string }>;
    if (manifest.length === 0) {
      return emptySliceData(data?.heatmapData ?? []);
    }

    let list = manifest.map((m) => ({
      duration: Number(m.duration ?? 0),
      WER: Number(m.WER ?? 0),
      INS: Number(m.INS ?? 0),
      DEL: Number(m.DEL ?? 0),
      SUB: Number(m.SUB ?? 0),
      audio_filepath: String(m.audio_filepath ?? ''),
      durationType: getDurationType(Number(m.duration ?? 0)),
    }));

    if (durationFilter !== 'all') {
      if (durationFilter === 'short') list = list.filter((r) => r.duration < 5);
      else if (durationFilter === 'normal' || durationFilter === 'medium') list = list.filter((r) => r.duration >= 5 && r.duration < 30);
      else if (durationFilter === 'long') list = list.filter((r) => r.duration >= 30);
    }

    if (werFilter !== 'all') {
      const sorted = [...list].sort((a, b) => b.WER - a.WER);
      const n = sorted.length;
      if (werFilter === 'low') list = list.filter((r) => r.WER < 15);
      else if (werFilter === 'top10') {
        const idx = Math.max(1, Math.ceil(n * 0.1));
        const threshold = sorted[idx - 1]?.WER ?? 100;
        list = list.filter((r) => r.WER >= threshold);
      } else if (werFilter === 'p80-90') {
        const p90 = sorted[Math.floor(n * 0.1)]?.WER ?? 100;
        const p80 = sorted[Math.floor(n * 0.2)]?.WER ?? 0;
        list = list.filter((r) => r.WER >= p80 && r.WER <= p90);
      } else if (werFilter === 'below80') {
        const p80 = sorted[Math.floor(n * 0.2)]?.WER ?? 100;
        list = list.filter((r) => r.WER <= p80);
      }
    }

    const samples = list.length;
    const insertions = list.reduce((s, r) => s + r.INS, 0);
    const deletions = list.reduce((s, r) => s + r.DEL, 0);
    const substitutions = list.reduce((s, r) => s + r.SUB, 0);
    const avgDuration = samples ? list.reduce((s, r) => s + r.duration, 0) / samples : 0;
    const avgWer = samples ? list.reduce((s, r) => s + r.WER, 0) / samples : 0;

    const byDur = { short: [] as typeof list, normal: [] as typeof list, long: [] as typeof list };
    list.forEach((r) => byDur[r.durationType].push(r));

    const errorsByDuration = [
      { range: DURATION_LABELS.short, insertions: byDur.short.reduce((s, r) => s + r.INS, 0), deletions: byDur.short.reduce((s, r) => s + r.DEL, 0), substitutions: byDur.short.reduce((s, r) => s + r.SUB, 0) },
      { range: DURATION_LABELS.normal, insertions: byDur.normal.reduce((s, r) => s + r.INS, 0), deletions: byDur.normal.reduce((s, r) => s + r.DEL, 0), substitutions: byDur.normal.reduce((s, r) => s + r.SUB, 0) },
      { range: DURATION_LABELS.long, insertions: byDur.long.reduce((s, r) => s + r.INS, 0), deletions: byDur.long.reduce((s, r) => s + r.DEL, 0), substitutions: byDur.long.reduce((s, r) => s + r.SUB, 0) },
    ];

    const avgWerShort = byDur.short.length ? byDur.short.reduce((s, r) => s + r.WER, 0) / byDur.short.length : 0;
    const avgWerNormal = byDur.normal.length ? byDur.normal.reduce((s, r) => s + r.WER, 0) / byDur.normal.length : 0;
    const avgWerLong = byDur.long.length ? byDur.long.reduce((s, r) => s + r.WER, 0) / byDur.long.length : 0;
    const werByDuration = [
      { range: 'Короткие', wer: avgWerShort },
      { range: 'Нормальные', wer: avgWerNormal },
      { range: 'Длинные', wer: avgWerLong },
    ];

    // Все сэмплы, отсортированные по длительности (для корректной линии тренда по оси X)
    const sortedByDuration = [...list].sort((a, b) => a.duration - b.duration);
    const rawCorrelation = sortedByDuration.map((r) => ({
      duration: r.duration,
      wer: r.WER,
      errors: r.INS + r.DEL + r.SUB,
      insertions: r.INS,
      deletions: r.DEL,
      substitutions: r.SUB,
      filePath: r.audio_filepath,
    }));

    // Тренд считаем только по точкам с WER ≤ 100%, чтобы выбросы не искажали линию
    const forTrend = rawCorrelation.filter((p) => p.wer <= 100);
    let trendA = 0;
    let trendB = 0;
    if (forTrend.length >= 2) {
      const n = forTrend.length;
      const sumX = forTrend.reduce((s, p) => s + p.duration, 0);
      const sumY = forTrend.reduce((s, p) => s + p.wer, 0);
      const sumXY = forTrend.reduce((s, p) => s + p.duration * p.wer, 0);
      const sumX2 = forTrend.reduce((s, p) => s + p.duration * p.duration, 0);
      const denom = n * sumX2 - sumX * sumX;
      trendA = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      trendB = (sumY - trendA * sumX) / n;
    }
    const correlationData = rawCorrelation.map((p) => {
      const trendWer = Math.min(100, Math.max(0, trendA * p.duration + trendB));
      const werDisplay = Math.min(100, p.wer); // для отрисовки: ось Y 0–100%, выбросы на уровне 100%
      return { ...p, trendWer, werDisplay };
    });

    const bins = Array.from({ length: 20 }, (_, i) => ({ min: i * 5, max: (i + 1) * 5, range: `${i * 5}-${(i + 1) * 5}`, density: 0, insertions: 0, deletions: 0, substitutions: 0, samples: 0 }));
    list.forEach((r) => {
      const binIdx = Math.min(19, Math.floor(r.WER / 5));
      if (binIdx >= 0) {
        bins[binIdx].samples += 1;
        bins[binIdx].insertions += r.INS;
        bins[binIdx].deletions += r.DEL;
        bins[binIdx].substitutions += r.SUB;
      }
    });
    const totalSamples = list.length;
    bins.forEach((b) => {
      b.density = totalSamples > 0 ? b.samples / totalSamples : 0;
    });
    const werDistribution = bins;

    const heatmapData = (data?.heatmapData ?? []).length > 0
      ? (data.heatmapData as Array<{ duration: string; insertions: { top10: number; p80_90: number; below80: number }; deletions: { top10: number; p80_90: number; below80: number }; substitutions: { top10: number; p80_90: number; below80: number } }>)
      : [
          { duration: DURATION_LABELS.short, insertions: { top10: 0, p80_90: 0, below80: errorsByDuration[0].insertions }, deletions: { top10: 0, p80_90: 0, below80: errorsByDuration[0].deletions }, substitutions: { top10: 0, p80_90: 0, below80: errorsByDuration[0].substitutions } },
          { duration: DURATION_LABELS.normal, insertions: { top10: 0, p80_90: 0, below80: errorsByDuration[1].insertions }, deletions: { top10: 0, p80_90: 0, below80: errorsByDuration[1].deletions }, substitutions: { top10: 0, p80_90: 0, below80: errorsByDuration[1].substitutions } },
          { duration: DURATION_LABELS.long, insertions: { top10: 0, p80_90: 0, below80: errorsByDuration[2].insertions }, deletions: { top10: 0, p80_90: 0, below80: errorsByDuration[2].deletions }, substitutions: { top10: 0, p80_90: 0, below80: errorsByDuration[2].substitutions } },
        ];

    // Распределение длительности аудио: бины по длительности (сек), в каждом — число сэмплов и суммы ошибок
    const BIN_DURATION_SEC = 5;
    const maxDurationSec = Math.max(0, ...list.map((r) => r.duration));
    const maxBinEnd = Math.min(500, Math.ceil(maxDurationSec / BIN_DURATION_SEC) * BIN_DURATION_SEC || BIN_DURATION_SEC);
    const numDurationBins = Math.max(1, Math.ceil(maxBinEnd / BIN_DURATION_SEC));
    const durationBins = Array.from({ length: numDurationBins }, (_, i) => {
      const min = i * BIN_DURATION_SEC;
      const max = (i + 1) * BIN_DURATION_SEC;
      return { min, max, range: `${min}-${max}`, samples: 0, insertions: 0, deletions: 0, substitutions: 0 };
    });
    list.forEach((r) => {
      const d = r.duration;
      const binIdx = d >= maxBinEnd ? numDurationBins - 1 : Math.min(numDurationBins - 1, Math.floor(d / BIN_DURATION_SEC));
      if (binIdx >= 0) {
        durationBins[binIdx].samples += 1;
        durationBins[binIdx].insertions += r.INS;
        durationBins[binIdx].deletions += r.DEL;
        durationBins[binIdx].substitutions += r.SUB;
      }
    });
    const durationDistribution = durationBins.map((b) => ({
      range: b.range,
      samples: b.samples,
      insertions: b.insertions,
      deletions: b.deletions,
      substitutions: b.substitutions,
    }));

    // Агрегат по бинам длительности для графика без scatter: средний WER, q25, q75, число сэмплов
    const werByDurationBins = durationBins.map((b) => {
      const min = b.min;
      const max = b.max;
      const center = (min + max) / 2;
      const inBin = list.filter((r) => r.duration >= min && (r.duration < max || (r.duration === max && max >= maxBinEnd)));
      const wers = inBin.map((r) => r.WER).filter((w) => Number.isFinite(w));
      const n = wers.length;
      if (n === 0) return { range: `${min}-${max}`, durationCenter: center, count: 0, meanWer: 0, q25: 0, q75: 0 };
      const sorted = [...wers].sort((a, b) => a - b);
      const meanWer = wers.reduce((s, w) => s + w, 0) / n;
      const q25 = sorted[Math.floor((n - 1) * 0.25)] ?? sorted[0];
      const q75 = sorted[Math.min(n - 1, Math.ceil((n - 1) * 0.75))] ?? sorted[n - 1];
      return {
        range: `${min}-${max}`,
        durationCenter: center,
        count: n,
        meanWer: Math.min(100, meanWer),
        q25: Math.min(100, q25),
        q75: Math.min(100, q75),
      };
    }).filter((b) => b.count > 0);

    return {
      samples,
      avgDuration,
      insertions,
      deletions,
      substitutions,
      avgWer,
      heatmapData,
      errorsByDuration,
      werByDuration,
      correlationData,
      werDistribution,
      durationDistribution,
      werByDurationBins,
    };
  }, [data?.manifest, data?.heatmapData, durationFilter, werFilter]);

  const datasetHeatmapData = useMemo(
    () => (data?.heatmapData ?? []) as HeatmapRow[],
    [data?.heatmapData],
  );

  const datasetSummaryObservations = useMemo(
    () => buildDatasetSummaryObservations(datasetHeatmapData, {
      durationLabel: durationFilter === 'all' ? 'Все длительности' : (filterLabels[durationFilter] || 'Все длительности'),
      werLabel: werFilter === 'all' ? 'Все сэмплы' : (filterLabels[werFilter] || 'Все сэмплы'),
      samples: sliceData.samples,
      avgWer: sliceData.avgWer,
      avgDuration: sliceData.avgDuration,
      insertions: sliceData.insertions,
      deletions: sliceData.deletions,
      substitutions: sliceData.substitutions,
    }),
    [datasetHeatmapData, durationFilter, werFilter, sliceData],
  );

  const isDark = theme === 'dark';

  // Вычисляем метрики на основе текущего среза
  const totalErrors = useMemo(() => {
    return sliceData.insertions + sliceData.deletions + sliceData.substitutions;
  }, [sliceData]);

  // Вычисляем распределение ошибок
  const errorDistribution = useMemo(() => {
    const total = sliceData.insertions + sliceData.deletions + sliceData.substitutions;
    if (total <= 0) {
      return [
        { name: 'Вставки', value: 0, color: '#3B82F6', percent: 0 },
        { name: 'Удаления', value: 0, color: '#EF4444', percent: 0 },
        { name: 'Замены', value: 0, color: '#F59E0B', percent: 0 },
      ];
    }
    return [
      { name: 'Вставки', value: sliceData.insertions, color: '#3B82F6', percent: (sliceData.insertions / total) * 100 },
      { name: 'Удаления', value: sliceData.deletions, color: '#EF4444', percent: (sliceData.deletions / total) * 100 },
      { name: 'Замены', value: sliceData.substitutions, color: '#F59E0B', percent: (sliceData.substitutions / total) * 100 },
    ];
  }, [sliceData]);

  const highlights = useMemo(() => {
    const h: string[] = [];
    if (sliceData.samples === 0) {
      h.push('По выбранному фильтру нет данных для анализа.');
      return h;
    }
    h.push(`Сэмплов в срезе: ${sliceData.samples}`);
    h.push(`Средний WER: ${sliceData.avgWer.toFixed(1)}%`);
    h.push(`Средняя длительность: ${sliceData.avgDuration.toFixed(1)} с`);
    const total = totalErrors;
    if (total > 0) {
      const insPct = (sliceData.insertions / total * 100).toFixed(1);
      const delPct = (sliceData.deletions / total * 100).toFixed(1);
      const subPct = (sliceData.substitutions / total * 100).toFixed(1);
      const maxType = sliceData.substitutions >= sliceData.insertions && sliceData.substitutions >= sliceData.deletions
        ? 'замены'
        : sliceData.insertions >= sliceData.deletions
          ? 'вставки'
          : 'удаления';
      const maxPct = maxType === 'замены' ? subPct : maxType === 'вставки' ? insPct : delPct;
      h.push(`Преобладают ${maxType} (${maxPct}% ошибок)`);
      h.push(`Вставки: ${insPct}%, удаления: ${delPct}%, замены: ${subPct}%`);
    } else {
      h.push('Ошибок распознавания в срезе нет');
    }
    const byDur = sliceData.errorsByDuration ?? [];
    if (byDur.length > 0) {
      const withTotal = byDur.map((d: { range: string; insertions: number; deletions: number; substitutions: number }) => ({
        ...d,
        total: (d.insertions ?? 0) + (d.deletions ?? 0) + (d.substitutions ?? 0),
      }));
      const maxDur = withTotal.reduce((a, b) => (a.total >= b.total ? a : b), withTotal[0]);
      if (maxDur && maxDur.total > 0) {
        h.push(`Больше всего ошибок: ${maxDur.range} (${maxDur.total})`);
      }
    }
    const werByDur = sliceData.werByDuration ?? [];
    if (werByDur.length >= 3) {
      const [shortW, normalW, longW] = [werByDur[0]?.wer ?? 0, werByDur[1]?.wer ?? 0, werByDur[2]?.wer ?? 0];
      if (longW > normalW && normalW > shortW) {
        h.push('WER растёт с увеличением длительности аудио');
      } else if (shortW > normalW && normalW > longW) {
        h.push('WER выше на коротких сэмплах');
      }
    }
    return h.length > 0 ? h : ['Нет дополнительных инсайтов по срезу'];
  }, [sliceData, totalErrors]);

  // Состояние загрузки
  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${
        theme === 'dark' ? 'bg-[#0F1117]' : 'bg-[#F5F7FA]'
      }`}>
        <div className="text-center">
          <div className={`text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Загрузка данных...
          </div>
        </div>
      </div>
    );
  }

  // Состояние ошибки
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${
        theme === 'dark' ? 'bg-[#0F1117]' : 'bg-[#F5F7FA]'
      }`}>
        <div className={`max-w-md p-6 rounded-xl border ${
          theme === 'dark' 
            ? 'bg-[#1A1D24] border-red-900/50' 
            : 'bg-white border-red-200'
        }`}>
          <div className="text-center">
            <h3 className={`text-lg mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Ошибка загрузки данных
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Нет данных
  if (!data) {
    return (
      <div className={`flex items-center justify-center h-full ${
        theme === 'dark' ? 'bg-[#0F1117]' : 'bg-[#F5F7FA]'
      }`}>
        <div className="text-center">
          <p className={`text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Данные не найдены
          </p>
        </div>
      </div>
    );
  }

  const toggleErrorType = (type: 'insertions' | 'deletions' | 'substitutions') => {
    setShowWerErrors(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const toggleDurationErrorType = (type: 'insertions' | 'deletions' | 'substitutions') => {
    setShowDurationErrors(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Текущий срез для кнопки
  const currentSliceLabel = `${filterLabels[durationFilter] || 'Все'} • ${filterLabels[werFilter] || 'Все сэмплы'}`;

  return (
    <div
      className={`reson-analytics-page min-h-full p-8 max-w-[1400px] ${
        theme === 'dark'
          ? 'bg-[#0F1117] text-white'
          : 'bg-[#F5F7FA] text-gray-900'
      }`}
    >
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            theme === 'dark' 
              ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]' 
              : 'bg-gradient-to-br from-[#10B981] to-[#34D399]'
          }`}>
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className={`text-2xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Аналитика
          </h1>
        </div>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Интерактивные срезы данных и подробная статистика ошибок распознавания
        </p>
      </div>

      {/* Липкая панель: вкладки + срез */}
      <div
        className="reson-analytics-sticky-bar p-4 mb-6 space-y-3"
        data-tour="analytics-sticky-bar"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('dataset')}
            data-tour="analytics-tab-dataset"
            className={analyticsSubtabClass(activeMainTab === 'dataset', isDark)}
          >
            <Layers className="w-4 h-4" />
            Сводка
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('slice')}
            data-tour="analytics-tab-slice"
            className={analyticsSubtabClass(activeMainTab === 'slice', isDark)}
          >
            <Activity className="w-4 h-4" />
            Срез
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('distributions')}
            className={analyticsSubtabClass(activeMainTab === 'distributions', isDark)}
          >
            <LayoutGrid className="w-4 h-4" />
            Распределения
          </button>
        </div>

        {activeMainTab === 'dataset' && (
          <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Сводка на основе распределения типов ошибок по длительности аудио и различным перцентилям WER.
            Рассчитывается один раз по всему датасету — изменение среза для анализа на этот раздел не влияет.
          </p>
        )}

        {activeMainTab === 'slice' && (
          <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Детальная аналитика по выбранному срезу данных. Все графики и метрики пересчитываются
            при изменении фильтров длительности и WER.
          </p>
        )}

        {activeMainTab === 'distributions' && (
          <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Распределения WER и длительности аудио на текущем срезе. Фильтры длительности и WER
            применяются ко всем графикам вкладки.
          </p>
        )}

        {activeMainTab !== 'dataset' && (
          <div className="reson-slice-toolbar" data-tour="analytics-slice-filters">
            <div className="reson-slice-toolbar-left">
              <HeaderActionButton
                variant="analytics"
                compact
                title="Фильтр среза"
                hint="Настроить срез"
                statusLabel={currentSliceLabel}
                showStatus
                icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                onClick={() => setIsPanelOpen(true)}
                pressed={isPanelOpen}
                ariaLabel="Фильтр среза"
              />
              <div className={`flex flex-wrap items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className={`px-2 py-1 rounded-md ${isDark ? 'bg-[#23262F]' : 'bg-gray-100'}`}>
                  Сэмплов: <strong className={isDark ? 'text-white' : 'text-gray-900'}>{sliceData.samples}</strong>
                </span>
                <span className={`px-2 py-1 rounded-md ${isDark ? 'bg-[#23262F]' : 'bg-gray-100'}`}>
                  Ср. WER: <strong className={isDark ? 'text-white' : 'text-gray-900'}>{sliceData.avgWer.toFixed(1)}%</strong>
                </span>
                <span className={`px-2 py-1 rounded-md ${isDark ? 'bg-[#23262F]' : 'bg-gray-100'}`}>
                  Ср. длит.: <strong className={isDark ? 'text-white' : 'text-gray-900'}>{sliceData.avgDuration.toFixed(1)} с</strong>
                </span>
              </div>
            </div>
            {(activeMainTab === 'slice' || activeMainTab === 'distributions') && sliceData.samples > 0 && (
              <SliceInsightsMenu highlights={highlights} isDark={isDark} layout={isMobile ? 'stacked' : 'inline'} />
            )}
          </div>
        )}
      </div>

      <div className="reson-analytics-section-card p-5 mb-6">
        {activeMainTab === 'dataset' && (
          <div className="space-y-5">
            <div className="reson-dataset-summary-grid" data-tour="analytics-dataset-summary">
              <div className="reson-dataset-heatmap-col">
                <ErrorHeatmap data={datasetHeatmapData} bare />
              </div>
              <DatasetSummaryObservations
                observations={datasetSummaryObservations}
                isDark={isDark}
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveMainTab('slice')}
              className="reson-analytics-slice-cta"
            >
              Перейти к анализу среза
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeMainTab === 'slice' && (
          <>
        {sliceData.samples === 0 ? (
          <div
            className={`rounded-xl py-12 px-6 text-center border ${
              theme === 'dark'
                ? 'bg-[#1E2028] border-[#2A2D35] text-gray-400'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <p className="text-base">
              По заданному фильтру нет данных для анализа.
            </p>
            <p className="text-sm mt-2 opacity-80">
              Измените фильтры длительности или WER, чтобы увидеть статистику среза.
            </p>
          </div>
        ) : (
          <>
        <div className="space-y-5" data-tour="analytics-slice-content">
          {/* График 1 & 2: Гистограмма и Круговая */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SliceChartCard
              icon={<BarChart3 className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />}
              title="Ошибки по типам длительности"
              description="Сумма INS / DEL / SUB по коротким, средним и длинным сэмплам"
              isDark={isDark}
            >
              <div className="reson-chart-h-220">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sliceData.errorsByDuration}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme === 'dark' ? '#2A2D35' : '#E5E7EB'}
                  />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1A1D24' : '#FFFFFF',
                      border: `1px solid ${theme === 'dark' ? '#2A2D35' : '#E5E7EB'}`,
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="circle"
                  />
                  <Bar dataKey="insertions" name="Вставки" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deletions" name="Удаления" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="substitutions" name="Замены" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
              </div>
            </SliceChartCard>

            <SliceChartCard
              icon={<PieChartIcon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />}
              title="Распределение типов ошибок"
              description="Доли вставок, удалений и замен в текущем срезе"
              isDark={isDark}
            >
              <div className="reson-chart-h-240 reson-slice-pie-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                  <Pie
                    data={errorDistribution}
                    cx="50%"
                    cy={isMobile ? '42%' : '50%'}
                    labelLine={false}
                    label={
                      isMobile
                        ? false
                        : ({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(1)}%`
                    }
                    outerRadius={isMobile ? 62 : 76}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {errorDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1A1D24' : '#FFFFFF',
                      border: `1px solid ${theme === 'dark' ? '#2A2D35' : '#E5E7EB'}`,
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="circle"
                    formatter={(value, entry) => {
                      const raw = Number((entry.payload as { percent?: number } | undefined)?.percent ?? 0);
                      const pct = raw <= 1 ? raw * 100 : raw;
                      return `${value} ${pct.toFixed(1)}%`;
                    }}
                  />
                </PieChart>
                </ResponsiveContainer>
              </div>
            </SliceChartCard>
          </div>

          {/* Квантили, тяжёлые сэмплы и матрица корреляций */}
          <div className="reson-slice-bottom-grid">
            <SliceWerProfilePanel
              correlationData={sliceData.correlationData ?? []}
              isDark={isDark}
              part="quantiles"
            />
            <SliceWerProfilePanel
              correlationData={sliceData.correlationData ?? []}
              isDark={isDark}
              part="heavy"
            />
            <SliceChartCard
              icon={<TrendingUp className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />}
              title="Матрица корреляций"
              description="Линейные корреляции метрик среза"
              isDark={isDark}
              className="reson-slice-chart-card--fill reson-slice-chart-card--corr"
            >
              <div className="reson-slice-corr-matrix-wrap">
                <CorrelationMatrix sliceData={sliceData} theme={theme} compact />
              </div>
            </SliceChartCard>
          </div>

        </div>
          </>
        )}
          </>
        )}

        {activeMainTab === 'distributions' && (
          sliceData.samples === 0 ? (
            <div className={`rounded-xl py-12 px-6 text-center border ${
              isDark ? 'bg-[#1E2028] border-[#2A2D35] text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}>
              <p className="text-base">По заданному фильтру нет данных для распределений.</p>
              <p className="text-sm mt-2 opacity-80">Измените фильтры среза, чтобы увидеть графики.</p>
            </div>
          ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDistributionView('wer-dist')}
                className={analyticsSubtabClass(distributionView === 'wer-dist', isDark)}
              >
                <TrendingUp className="w-4 h-4" />
                Плотность WER
              </button>
              <button
                type="button"
                onClick={() => setDistributionView('duration-dist')}
                className={analyticsSubtabClass(distributionView === 'duration-dist', isDark)}
              >
                <Clock className="w-4 h-4" />
                Длительность аудио
              </button>
            </div>

            {distributionView === 'wer-dist' ? (
          <div>
            <div className="flex items-center justify-between mb-3 reson-wer-error-toggles">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingUp className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                <h4 className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Плотность распределения по WER
                </h4>
              </div>
              
              {/* Переключатели типов ошибок */}
              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border flex-wrap ${
                theme === 'dark' ? 'bg-[#23262F] border-[#2A2D35]' : 'bg-gray-50 border-gray-200'
              }`}>
                <button
                  onClick={() => toggleErrorType('insertions')}
                  className={`px-3 py-1.5 rounded text-xs transition-all ${
                    showWerErrors.insertions
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Вставки
                </button>
                <button
                  onClick={() => toggleErrorType('deletions')}
                  className={`px-3 py-1.5 rounded text-xs transition-all ${
                    showWerErrors.deletions
                      ? 'bg-[#EF4444] text-white shadow-sm'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Удаления
                </button>
                <button
                  onClick={() => toggleErrorType('substitutions')}
                  className={`px-3 py-1.5 rounded text-xs transition-all ${
                    showWerErrors.substitutions
                      ? 'bg-[#F59E0B] text-white shadow-sm'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Замены
                </button>
              </div>
            </div>

            <div className="reson-chart-h-280">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                data={sliceData.werDistribution}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorDensity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorInsertions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorDeletions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorSubstitutions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#2A2D35' : '#E5E7EB'} />
                <XAxis
                  dataKey="range"
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 10 }}
                  label={{ value: 'WER (%)', position: 'insideBottom', offset: -5, fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
                />
                <YAxis
                  yAxisId="left"
                  width={80}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{ 
                    value: 'Плотность', 
                    angle: -90, 
                    position: 'insideLeft',
                    offset: 10,
                    style: { textAnchor: 'middle' },
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' 
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={80}
                  domain={[0, 'auto']}
                  allowDataOverflow
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{ 
                    value: 'Количество ошибок', 
                    angle: 90, 
                    position: 'insideRight',
                    offset: 10,
                    style: { textAnchor: 'middle' },
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' 
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload as {
                        range: string;
                        density: number;
                        samples: number;
                        insertions: number;
                        deletions: number;
                        substitutions: number;
                      };
                      const hasSelectedErrors = showWerErrors.insertions || showWerErrors.deletions || showWerErrors.substitutions;
                      
                      return (
                        <div className={`rounded-lg p-3 border shadow-lg ${
                          theme === 'dark' 
                            ? 'bg-[#1A1D24] border-[#2A2D35]' 
                            : 'bg-white border-gray-200'
                        }`}>
                          <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            WER: {data.range}%
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                  Плотность:
                                </span>
                              </div>
                              <span className={`text-xs ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {data.density.toFixed(3)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-500" />
                                <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                  Сэмплов:
                                </span>
                              </div>
                              <span className={`text-xs ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {data.samples}
                              </span>
                            </div>
                            {hasSelectedErrors && (
                              <div className={`border-t my-1.5 ${theme === 'dark' ? 'border-[#2A2D35]' : 'border-gray-200'}`} />
                            )}
                            {showWerErrors.insertions && (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Вставки:
                                  </span>
                                </div>
                                <span className={`text-xs ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {data.insertions}
                                </span>
                              </div>
                            )}
                            {showWerErrors.deletions && (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Удаления:
                                  </span>
                                </div>
                                <span className={`text-xs ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {data.deletions}
                                </span>
                              </div>
                            )}
                            {showWerErrors.substitutions && (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Замены:
                                  </span>
                                </div>
                                <span className={`text-xs ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {data.substitutions}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Базовая плотность - всегда показывается */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="density"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDensity)"
                  name="Плотность"
                />
                {/* Типы ошибок поверх плотности */}
                {showWerErrors.insertions && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="insertions"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorInsertions)"
                    name="Вставки"
                  />
                )}
                {showWerErrors.deletions && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="deletions"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorDeletions)"
                    name="Удаления"
                  />
                )}
                {showWerErrors.substitutions && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="substitutions"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSubstitutions)"
                    name="Замены"
                  />
                )}
              </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
            ) : (
          <div>
            <div className="flex items-center justify-between mb-3 reson-wer-error-toggles">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                <h4 className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Распределение длительности аудио
                </h4>
              </div>
              
              {/* Переключатели типов ошибок */}
              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border flex-wrap ${
                theme === 'dark' ? 'bg-[#23262F] border-[#2A2D35]' : 'bg-gray-50 border-gray-200'
              }`}>
                <button
                  onClick={() => toggleDurationErrorType('insertions')}
                  className={`px-3 py-1.5 rounded text-xs transition-all ${
                    showDurationErrors.insertions
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Вставки
                </button>
                <button
                  onClick={() => toggleDurationErrorType('deletions')}
                  className={`px-3 py-1.5 rounded text-xs transition-all ${
                    showDurationErrors.deletions
                      ? 'bg-[#EF4444] text-white shadow-sm'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Удаления
                </button>
                <button
                  onClick={() => toggleDurationErrorType('substitutions')}
                  className={`px-3 py-1.5 rounded text-xs transition-all ${
                    showDurationErrors.substitutions
                      ? 'bg-[#F59E0B] text-white shadow-sm'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Замены
                </button>
              </div>
            </div>

            <div className="reson-chart-h-280">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart
                  data={sliceData.durationDistribution}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#2A2D35' : '#E5E7EB'} />
                <XAxis
                  dataKey="range"
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  width={80}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{
                    value: 'Количество сэмплов',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: { textAnchor: 'middle' },
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280'
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={80}
                  domain={[0, 'auto']}
                  allowDataOverflow
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{
                    value: 'Количество ошибок',
                    angle: 90,
                    position: 'insideRight',
                    offset: 10,
                    style: { textAnchor: 'middle' },
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280'
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1A1D24' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#2A2D35' : '#E5E7EB'}`,
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar 
                  yAxisId="left"
                  dataKey="samples" 
                  name="Количество сэмплов" 
                  fill="#10B981" 
                  radius={[4, 4, 0, 0]} 
                />
                {showDurationErrors.insertions && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="insertions"
                    name="Вставки"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    dot={{ fill: '#3B82F6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
                {showDurationErrors.deletions && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="deletions"
                    name="Удаления"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    dot={{ fill: '#EF4444', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
                {showDurationErrors.substitutions && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="substitutions"
                    name="Замены"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ fill: '#F59E0B', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>
            )}
          </div>
          )
        )}
      </div>

      <SliceFilterModal
        open={isPanelOpen}
        isDark={isDark}
        durationFilter={durationFilter}
        werFilter={werFilter}
        onDurationChange={setDurationFilter}
        onWerChange={setWerFilter}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}