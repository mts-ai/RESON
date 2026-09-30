export type SliceDurationFilter = "all" | "short" | "normal" | "long";
export type SliceModelComparisonFilter = "all" | "best" | "worst";

export interface AnalyticsSliceFilters {
  durationFilter: SliceDurationFilter;
  modelComparisonFilter: SliceModelComparisonFilter;
  selectedModelForComparison: string | null;
}

export const DEFAULT_ANALYTICS_SLICE_FILTERS: AnalyticsSliceFilters = {
  durationFilter: "all",
  modelComparisonFilter: "all",
  selectedModelForComparison: null,
};

export function stripModelComparisonFilters(
  filters: AnalyticsSliceFilters,
): AnalyticsSliceFilters {
  return {
    ...filters,
    modelComparisonFilter: "all",
    selectedModelForComparison: null,
  };
}

export function getModelWerEntries(
  modelWers: Record<string, number | undefined>,
  selectedModels: string[],
): Array<{ modelName: string; wer: number }> {
  return selectedModels
    .map((modelName) => ({
      modelName,
      wer: modelWers[modelName],
    }))
    .filter(
      (entry): entry is { modelName: string; wer: number } =>
        entry.wer !== undefined,
    );
}

export function getExclusiveBestWinner(
  modelWers: Record<string, number | undefined>,
  selectedModels: string[],
): string | null {
  const entries = getModelWerEntries(modelWers, selectedModels);
  if (entries.length < 2) return null;

  const minWer = Math.min(...entries.map((entry) => entry.wer));
  const winners = entries.filter((entry) => entry.wer === minWer);
  return winners.length === 1 ? winners[0].modelName : null;
}

export function getExclusiveWorstModel(
  modelWers: Record<string, number | undefined>,
  selectedModels: string[],
): string | null {
  const entries = getModelWerEntries(modelWers, selectedModels);
  if (entries.length < 2) return null;

  const maxWer = Math.max(...entries.map((entry) => entry.wer));
  const losers = entries.filter((entry) => entry.wer === maxWer);
  return losers.length === 1 ? losers[0].modelName : null;
}

export function sampleMatchesModelComparisonFilter(
  modelWers: Record<string, number | undefined>,
  selectedModels: string[],
  filters: AnalyticsSliceFilters,
): boolean {
  if (
    filters.modelComparisonFilter === "all" ||
    !filters.selectedModelForComparison
  ) {
    return true;
  }

  if (filters.modelComparisonFilter === "best") {
    return (
      getExclusiveBestWinner(modelWers, selectedModels) ===
      filters.selectedModelForComparison
    );
  }

  if (filters.modelComparisonFilter === "worst") {
    return (
      getExclusiveWorstModel(modelWers, selectedModels) ===
      filters.selectedModelForComparison
    );
  }

  return true;
}

export const SLICE_DURATION_LABELS: Record<SliceDurationFilter, string> = {
  all: "Все длительности",
  short: "Короткие (до 5 с)",
  normal: "Средние (5–30 с)",
  long: "Длинные (30+ с)",
};

export interface SliceSampleRef {
  id: string;
  duration: number;
  durationType?: "short" | "normal" | "long";
}

export function resolveSampleDurationType(sample: {
  duration: number;
  durationType?: string;
}): Exclude<SliceDurationFilter, "all"> {
  if (sample.durationType === "short" || sample.duration < 5) return "short";
  if (sample.durationType === "long" || sample.duration > 30) return "long";
  return "normal";
}

export function matchesDurationFilter(
  duration: number,
  durationFilter: SliceDurationFilter,
  durationType?: string,
): boolean {
  if (durationFilter === "all") return true;
  return resolveSampleDurationType({ duration, durationType }) === durationFilter;
}

interface ComparisonSampleRef {
  id: string;
  getWer: (modelName: string) => number | undefined;
}

export function computeAllowedSampleIds(
  samples: ComparisonSampleRef[],
  selectedModels: string[],
  filters: AnalyticsSliceFilters,
): Set<string> {
  let ids = new Set(samples.map((sample) => sample.id));

  if (filters.durationFilter !== "all") {
    ids = new Set(
      samples
        .filter((sample) =>
          matchesDurationFilter(
            sample.duration,
            filters.durationFilter,
            sample.durationType,
          ),
        )
        .map((sample) => sample.id),
    );
  }

  if (
    filters.modelComparisonFilter !== "all" &&
    filters.selectedModelForComparison &&
    selectedModels.length >= 2
  ) {
    const comparisonIds = new Set<string>();

    for (const sampleId of ids) {
      const sample = samples.find((entry) => entry.id === sampleId);
      if (!sample) continue;

      const modelWers = Object.fromEntries(
        selectedModels.map((modelName) => [
          modelName,
          sample.getWer(modelName),
        ]),
      ) as Record<string, number | undefined>;

      if (
        sampleMatchesModelComparisonFilter(
          modelWers,
          selectedModels,
          filters,
        )
      ) {
        comparisonIds.add(sampleId);
      }
    }

    ids = comparisonIds;
  }

  return ids;
}

export function buildSelectedModelsList(
  baseModel: string | null,
  targetModel: string | null,
  optionalModels: string[],
): string[] {
  const models: string[] = [];
  if (baseModel) models.push(baseModel);
  optionalModels.forEach((modelName) => {
    if (modelName !== baseModel && modelName !== targetModel) {
      models.push(modelName);
    }
  });
  if (targetModel && targetModel !== baseModel) {
    models.push(targetModel);
  }
  return models;
}

export interface SliceWinRateEntry {
  modelName: string;
  displayName: string;
  wins: number;
  winRate: number;
}

export interface SlicePairWinRate {
  baseModelName: string;
  targetModelName: string;
  baseDisplayName: string;
  targetDisplayName: string;
  targetWins: number;
  baseWins: number;
  ties: number;
  comparableSamples: number;
  targetWinRate: number;
  baseWinRate: number;
}

export interface SliceWinRateStats {
  totalSamples: number;
  decisiveSamples: number;
  exclusiveTies: number;
  entries: SliceWinRateEntry[];
  pairComparison: SlicePairWinRate | null;
}

export function computeSliceWinRates(
  sampleIds: Iterable<string>,
  selectedModels: string[],
  getModelWers: (sampleId: string) => Record<string, number | undefined>,
  getDisplayName: (modelName: string) => string,
  baseModel: string | null,
  targetModel: string | null,
): SliceWinRateStats {
  const winCounts = new Map<string, number>();
  selectedModels.forEach((modelName) => winCounts.set(modelName, 0));

  let totalSamples = 0;
  let decisiveSamples = 0;
  let exclusiveTies = 0;

  let targetWins = 0;
  let baseWins = 0;
  let pairTies = 0;
  let comparableSamples = 0;

  const showPairComparison =
    Boolean(baseModel && targetModel && baseModel !== targetModel) &&
    selectedModels.includes(baseModel) &&
    selectedModels.includes(targetModel);

  for (const sampleId of sampleIds) {
    totalSamples += 1;
    const modelWers = getModelWers(sampleId);

    const exclusiveWinner = getExclusiveBestWinner(modelWers, selectedModels);
    if (exclusiveWinner) {
      decisiveSamples += 1;
      winCounts.set(exclusiveWinner, (winCounts.get(exclusiveWinner) ?? 0) + 1);
    } else if (getModelWerEntries(modelWers, selectedModels).length >= 2) {
      exclusiveTies += 1;
    }

    if (showPairComparison) {
      const baseWer = modelWers[baseModel!];
      const targetWer = modelWers[targetModel!];
      if (baseWer !== undefined && targetWer !== undefined) {
        comparableSamples += 1;
        if (targetWer < baseWer) targetWins += 1;
        else if (targetWer > baseWer) baseWins += 1;
        else pairTies += 1;
      }
    }
  }

  const entries = selectedModels
    .map((modelName) => {
      const wins = winCounts.get(modelName) ?? 0;
      return {
        modelName,
        displayName: getDisplayName(modelName),
        wins,
        winRate: decisiveSamples > 0 ? (wins / decisiveSamples) * 100 : 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || a.displayName.localeCompare(b.displayName));

  return {
    totalSamples,
    decisiveSamples,
    exclusiveTies,
    entries,
    pairComparison:
      showPairComparison && comparableSamples > 0
        ? {
            baseModelName: baseModel!,
            targetModelName: targetModel!,
            baseDisplayName: getDisplayName(baseModel!),
            targetDisplayName: getDisplayName(targetModel!),
            targetWins,
            baseWins,
            ties: pairTies,
            comparableSamples,
            targetWinRate: (targetWins / comparableSamples) * 100,
            baseWinRate: (baseWins / comparableSamples) * 100,
          }
        : null,
  };
}
