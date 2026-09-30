import type { HeatmapRow } from '../../types/data';

export type AnalyticsMainTab = 'dataset' | 'slice' | 'distributions';
export type DistributionView = 'wer-dist' | 'duration-dist';

const CATEGORY_LABELS = {
  insertions: 'вставки',
  deletions: 'удаления',
  substitutions: 'замены',
} as const;

const PERCENTILE_LABELS = {
  top10: 'топ-10% WER',
  p80_90: '80–90 перцентиль WER',
  below80: 'до 80 перцентиля WER',
} as const;

export type DatasetSummaryObservationVariant = 'peak' | 'duration' | 'type' | 'dataset';

export type DatasetSummaryObservation = {
  label: string;
  text: string | string[];
  variant: DatasetSummaryObservationVariant;
};

function formatCount(value: number): string {
  return String(value);
}

export interface SliceSummaryContext {
  durationLabel: string;
  werLabel: string;
  samples: number;
  avgWer: number;
  avgDuration: number;
  insertions: number;
  deletions: number;
  substitutions: number;
}

export function analyticsSubtabClass(active: boolean, isDark: boolean): string {
  if (active) {
    return 'reson-analytics-subtab-active px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm';
  }
  return `px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 border ${
    isDark
      ? 'border-[#2A2D35] bg-[#23262F] text-gray-400 hover:text-white hover:border-[#3A3D45]'
      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm'
  }`;
}

export function buildDatasetSummaryObservations(
  rows: HeatmapRow[],
  slice: SliceSummaryContext,
): DatasetSummaryObservation[] {
  if (!rows.length) {
    return [{ label: 'Данные', text: 'Нет данных для автоматических наблюдений по датасету.', variant: 'dataset' }];
  }

  const observations: DatasetSummaryObservation[] = [];
  type Cat = keyof typeof CATEGORY_LABELS;
  type Col = keyof typeof PERCENTILE_LABELS;

  let peak = 0;
  let peakMeta = { duration: '', cat: 'substitutions' as Cat, col: 'top10' as Col };

  const durationTotals = rows.map((row) => {
    let total = 0;
    (Object.keys(CATEGORY_LABELS) as Cat[]).forEach((cat) => {
      (Object.keys(PERCENTILE_LABELS) as Col[]).forEach((col) => {
        const value = row[cat][col];
        total += value;
        if (value > peak) {
          peak = value;
          peakMeta = { duration: row.duration, cat, col };
        }
      });
    });
    return { duration: row.duration, total };
  });

  const typeTotals = { insertions: 0, deletions: 0, substitutions: 0 };
  rows.forEach((row) => {
    (Object.keys(CATEGORY_LABELS) as Cat[]).forEach((cat) => {
      (Object.keys(PERCENTILE_LABELS) as Col[]).forEach((col) => {
        typeTotals[cat] += row[cat][col];
      });
    });
  });

  if (peak > 0) {
    observations.push({
      label: 'Пик ошибок на датасете',
      text: [
        `Самая «горячая» ячейка тепловой карты — ${peakMeta.duration}, ${PERCENTILE_LABELS[peakMeta.col]}.`,
        `Тип ошибки: ${CATEGORY_LABELS[peakMeta.cat]}.`,
        `Число ошибок в ячейке: ${formatCount(peak)}.`,
      ],
      variant: 'peak',
    });
  }

  const topDuration = [...durationTotals].sort((a, b) => b.total - a.total)[0];
  if (topDuration && topDuration.total > 0) {
    observations.push({
      label: 'Больше всего ошибок суммарно в категории длительности',
      text: `«${topDuration.duration}» — ${formatCount(topDuration.total)} ошибок.`,
      variant: 'duration',
    });
  }

  const dominantType = (Object.entries(typeTotals) as [Cat, number][])
    .sort((a, b) => b[1] - a[1])[0];
  if (dominantType && dominantType[1] > 0) {
    const total = typeTotals.insertions + typeTotals.deletions + typeTotals.substitutions;
    const pct = ((dominantType[1] / total) * 100).toFixed(1);
    observations.push({
      label: 'Больше всего ошибок типа',
      text: `${CATEGORY_LABELS[dominantType[0]]} — ${formatCount(dominantType[1])} (${pct}% от всех ошибок).`,
      variant: 'type',
    });
  }

  const sliceTotal = slice.insertions + slice.deletions + slice.substitutions;
  const datasetTraits: string[] = [];
  if (slice.samples === 0) {
    datasetTraits.push('Нет данных по датасету.');
  } else {
    datasetTraits.push(`${formatCount(slice.samples)} сэмплов`);
    datasetTraits.push(`Средний WER: ${slice.avgWer.toFixed(1)}%`);
    datasetTraits.push(`Средняя длительность: ${slice.avgDuration.toFixed(1)} с`);
    if (sliceTotal > 0) {
      const sliceDominant = slice.substitutions >= slice.insertions && slice.substitutions >= slice.deletions
        ? 'замены'
        : slice.insertions >= slice.deletions
          ? 'вставки'
          : 'удаления';
      datasetTraits.push(`Преобладают ${sliceDominant}`);
      datasetTraits.push(
        `Вставки: ${formatCount(slice.insertions)}, удаления: ${formatCount(slice.deletions)}, замены: ${formatCount(slice.substitutions)}`,
      );
    } else {
      datasetTraits.push('Ошибок распознавания нет');
    }
  }

  observations.push({
    label: 'Особенности датасета',
    text: datasetTraits,
    variant: 'dataset',
  });

  return observations.length > 0
    ? observations
    : [{ label: 'Наблюдения', text: 'Существенных перекосов в тепловой карте не обнаружено.', variant: 'dataset' }];
}
