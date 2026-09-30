import type { AnalyticsSliceStat } from './analyticsModelProfile';
import type { AnalyticsSliceFilters } from './analyticsSlice';

export type AnalyticsMainTab = 'summary' | 'slice' | 'classes';

export const ANALYTICS_TAB_DESCRIPTIONS: Record<AnalyticsMainTab, string> = {
  summary:
    'Обзор всего датасета: тепловая карта ошибок по моделям и длительности. Не зависит от фильтра среза.',
  slice:
    'Аналитика текущего среза: распределение WER, параллельные координаты, профиль моделей и длительность.',
  classes:
    'Квадранты сложности примеров по медианам WER и разбросу между моделями. Зависят только от длительности и набора моделей.',
};

export type DatasetSummaryObservationVariant =
  | 'peak'
  | 'duration'
  | 'type'
  | 'compare';

export type DatasetSummaryObservation = {
  label: string;
  text: string | string[];
  variant: DatasetSummaryObservationVariant;
};

export interface ModelHeatmapRow {
  durationKey: 'short' | 'normal' | 'long';
  durationLabel: string;
  insertions: number;
  deletions: number;
  substitutions: number;
}

export interface ModelHeatmapBlock {
  modelName: string;
  displayName: string;
  color: string;
  rows: ModelHeatmapRow[];
}

const DURATION_ROWS: Array<{ key: ModelHeatmapRow['durationKey']; label: string }> = [
  { key: 'short', label: 'Короткие' },
  { key: 'normal', label: 'Средние' },
  { key: 'long', label: 'Длинные' },
];

const ERROR_LABELS = {
  insertions: 'вставки',
  deletions: 'удаления',
  substitutions: 'замены',
} as const;

type ErrorKey = keyof typeof ERROR_LABELS;

interface SampleLike {
  audio_filepath: string;
  durationType: 'short' | 'normal' | 'long';
  wer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
  duration: number;
}

interface AnalyticsDataLike {
  samples: SampleLike[];
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function hasSliceSamples(sliceStats: AnalyticsSliceStat[] | null): boolean {
  return Boolean(sliceStats?.some((stat) => stat.samplesCount > 0));
}

export interface SliceKpi {
  samples: number;
  avgWer: number;
  avgDuration: number;
  werDelta: number | null;
}

export function getSliceKpi(
  sliceStats: AnalyticsSliceStat[],
  baseModel: string | null,
  targetModel: string | null,
): SliceKpi | null {
  if (sliceStats.length === 0) return null;

  const base = sliceStats.find((stat) => stat.modelName === baseModel) ?? sliceStats[0];
  const target =
    sliceStats.find((stat) => stat.modelName === targetModel) ?? base;

  if (!base || base.samplesCount === 0) return null;

  const werDelta =
    base && target && base.modelName !== target.modelName
      ? target.avgWER - base.avgWER
      : null;

  return {
    samples: base.samplesCount,
    avgWer: target.avgWER,
    avgDuration: target.avgDuration,
    werDelta,
  };
}

export function buildFullDatasetSliceStats(
  data: Record<string, AnalyticsDataLike>,
  selectedModels: string[],
  getModelDisplayName: (modelName: string) => string,
): AnalyticsSliceStat[] {
  return selectedModels
    .map((modelName) => {
      const modelData = data[modelName];
      if (!modelData?.samples.length) return null;

      const samples = modelData.samples;
      const avgWER = samples.reduce((sum, sample) => sum + sample.wer, 0) / samples.length;
      const avgDuration =
        samples.reduce((sum, sample) => sum + sample.duration, 0) / samples.length;

      return {
        modelName,
        displayName: getModelDisplayName(modelName),
        samplesCount: samples.length,
        avgWER,
        avgDuration,
        totalInsertions: samples.reduce((sum, sample) => sum + sample.insertions, 0),
        totalDeletions: samples.reduce((sum, sample) => sum + sample.deletions, 0),
        totalSubstitutions: samples.reduce(
          (sum, sample) => sum + sample.substitutions,
          0,
        ),
        samples,
      };
    })
    .filter((entry): entry is AnalyticsSliceStat => entry !== null);
}

export function buildModelErrorHeatmap(
  data: Record<string, AnalyticsDataLike>,
  selectedModels: string[],
  getModelDisplayName: (modelName: string) => string,
  modelColors: string[],
): ModelHeatmapBlock[] {
  return selectedModels.map((modelName, index) => {
    const samples = data[modelName]?.samples ?? [];

    const rows = DURATION_ROWS.map(({ key, label }) => {
      const bucket = samples.filter((sample) => sample.durationType === key);
      return {
        durationKey: key,
        durationLabel: label,
        insertions: bucket.reduce((sum, sample) => sum + sample.insertions, 0),
        deletions: bucket.reduce((sum, sample) => sum + sample.deletions, 0),
        substitutions: bucket.reduce(
          (sum, sample) => sum + sample.substitutions,
          0,
        ),
      };
    });

    return {
      modelName,
      displayName: getModelDisplayName(modelName),
      color: modelColors[index % modelColors.length],
      rows,
    };
  });
}

export function buildCompareDatasetObservations(
  heatmapBlocks: ModelHeatmapBlock[],
  fullStats: AnalyticsSliceStat[],
): DatasetSummaryObservation[] {
  if (!heatmapBlocks.length || !fullStats.length) {
    return [
      {
        label: 'Данные',
        text: 'Нет данных для автоматических наблюдений по датасету.',
        variant: 'type',
      },
    ];
  }

  const observations: DatasetSummaryObservation[] = [];

  let peak = 0;
  let peakMeta = {
    model: '',
    duration: '',
    errorType: 'substitutions' as ErrorKey,
  };

  const durationTotals = new Map<string, number>();
  const typeTotals = { insertions: 0, deletions: 0, substitutions: 0 };

  heatmapBlocks.forEach((block) => {
    block.rows.forEach((row) => {
      (Object.keys(ERROR_LABELS) as ErrorKey[]).forEach((errorType) => {
        const value = row[errorType];
        typeTotals[errorType] += value;
        durationTotals.set(
          row.durationLabel,
          (durationTotals.get(row.durationLabel) ?? 0) + value,
        );
        if (value > peak) {
          peak = value;
          peakMeta = {
            model: block.displayName,
            duration: row.durationLabel,
            errorType,
          };
        }
      });
    });
  });

  if (peak > 0) {
    observations.push({
      label: 'Пик ошибок на датасете',
      text: [
        `Самая «горячая» ячейка — ${peakMeta.model}, ${peakMeta.duration.toLowerCase()}.`,
        `Тип ошибки: ${ERROR_LABELS[peakMeta.errorType]}.`,
        `Число ошибок в ячейке: ${formatCount(peak)}.`,
      ],
      variant: 'peak',
    });
  }

  const topDuration = [...durationTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topDuration && topDuration[1] > 0) {
    observations.push({
      label: 'Больше всего ошибок по длительности',
      text: `«${topDuration[0]}» — ${formatCount(topDuration[1])} ошибок суммарно по всем моделям.`,
      variant: 'duration',
    });
  }

  const dominantType = (Object.entries(typeTotals) as [ErrorKey, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (dominantType && dominantType[1] > 0) {
    const total = typeTotals.insertions + typeTotals.deletions + typeTotals.substitutions;
    observations.push({
      label: 'Преобладающий тип ошибок',
      text: `${ERROR_LABELS[dominantType[0]]} — ${formatCount(dominantType[1])} (${((dominantType[1] / total) * 100).toFixed(1)}% от всех ошибок).`,
      variant: 'type',
    });
  }

  const sortedByWer = [...fullStats].sort((a, b) => a.avgWER - b.avgWER);
  observations.push({
    label: 'Лучший / худший средний WER',
    text: [
      `Лучший: ${sortedByWer[0].displayName} (${sortedByWer[0].avgWER.toFixed(2)}%)`,
      `Худший: ${sortedByWer[sortedByWer.length - 1].displayName} (${sortedByWer[sortedByWer.length - 1].avgWER.toFixed(2)}%)`,
    ],
    variant: 'compare',
  });

  return observations;
}

export function buildSliceFilterLabel(
  filters: AnalyticsSliceFilters,
  getModelDisplayName: (modelName: string) => string,
): string {
  const parts = [];
  const durationLabels: Record<string, string> = {
    all: 'Все длительности',
    short: 'Короткие',
    normal: 'Средние',
    long: 'Длинные',
  };
  parts.push(durationLabels[filters.durationFilter] ?? 'Все длительности');

  if (filters.modelComparisonFilter !== 'all' && filters.selectedModelForComparison) {
    const modelName = getModelDisplayName(filters.selectedModelForComparison);
    parts.push(
      filters.modelComparisonFilter === 'best'
        ? `Лучшая: ${modelName}`
        : `Худшая: ${modelName}`,
    );
  } else {
    parts.push('Все сэмплы');
  }

  return parts.join(' • ');
}
