export interface OracleSample {
  id: string;
  wer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
  reference?: string;
}

export interface OracleModelInput {
  modelName: string;
  displayName: string;
  samples: OracleSample[];
}

export interface OracleModelStats {
  modelName: string;
  displayName: string;
  globalWer: number;
  avgSampleWer: number;
  wins: number;
  winPercentage: number;
  sampleCount: number;
  gapToOracle: number;
}

export interface OracleMetrics {
  oracleWer: number;
  totalSamples: number;
  totalReferenceWords: number;
  meanSampleAverageWer: number;
  bestGlobalModel: OracleModelStats | null;
  winLeaders: OracleModelStats[];
  gapBestGlobalToOracle: number;
  models: OracleModelStats[];
}

export function sampleErrorCount(sample: OracleSample): number {
  return sample.insertions + sample.deletions + sample.substitutions;
}

export function referenceWordCount(reference: string | undefined): number {
  if (!reference) return 0;
  const trimmed = reference.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function inferReferenceWords(sample: OracleSample): number {
  const fromReference = referenceWordCount(sample.reference);
  if (fromReference > 0) return fromReference;

  const errors = sampleErrorCount(sample);
  if (sample.wer > 0 && errors > 0) {
    return Math.round(errors / (sample.wer / 100));
  }

  return 0;
}

function pickOracleWinners(
  modelData: Map<string, OracleSample>,
): { sample: OracleSample; modelName: string }[] {
  if (modelData.size === 0) return [];

  let minWer = Infinity;
  modelData.forEach((sample) => {
    if (sample.wer < minWer) minWer = sample.wer;
  });

  const werCandidates: { sample: OracleSample; modelName: string }[] = [];
  modelData.forEach((sample, modelName) => {
    if (sample.wer === minWer) {
      werCandidates.push({ sample, modelName });
    }
  });

  if (werCandidates.length === 0) return [];

  let minErrors = Infinity;
  werCandidates.forEach((candidate) => {
    const errors = sampleErrorCount(candidate.sample);
    if (errors < minErrors) minErrors = errors;
  });

  return werCandidates
    .filter((candidate) => sampleErrorCount(candidate.sample) === minErrors)
    .sort((a, b) => a.modelName.localeCompare(b.modelName));
}

export function formatOracleWins(wins: number): string {
  if (Math.abs(wins - Math.round(wins)) < 1e-9) {
    return String(Math.round(wins));
  }
  return wins.toFixed(1);
}

export function computeOracleMetrics(
  modelResults: OracleModelInput[],
  selectedModelNames: Set<string>,
  filteredSampleIds?: string[],
): OracleMetrics | null {
  if (modelResults.length === 0 || selectedModelNames.size === 0) return null;

  const selectedModels = modelResults.filter((model) => selectedModelNames.has(model.modelName));
  if (selectedModels.length === 0) return null;

  const sampleMap = new Map<string, Map<string, OracleSample>>();
  const filterSet =
    filteredSampleIds !== undefined ? new Set(filteredSampleIds) : null;

  selectedModels.forEach((modelResult) => {
    modelResult.samples.forEach((sample) => {
      if (filterSet && !filterSet.has(sample.id)) return;

      if (!sampleMap.has(sample.id)) {
        sampleMap.set(sample.id, new Map());
      }
      sampleMap.get(sample.id)!.set(modelResult.modelName, sample);
    });
  });

  if (sampleMap.size === 0) return null;

  const referenceWordsBySample = new Map<string, number>();
  sampleMap.forEach((modelData, sampleId) => {
    const firstSample = modelData.values().next().value as OracleSample | undefined;
    if (!firstSample) return;
    referenceWordsBySample.set(sampleId, inferReferenceWords(firstSample));
  });

  let oracleErrors = 0;
  let totalReferenceWords = 0;
  let meanSampleAverageWerSum = 0;
  const winCounts = new Map<string, number>();
  const werSumByModel = new Map<string, number>();
  const sampleCountByModel = new Map<string, number>();
  const errorsByModel = new Map<string, number>();
  const refWordsByModel = new Map<string, number>();

  selectedModels.forEach((model) => {
    winCounts.set(model.modelName, 0);
    werSumByModel.set(model.modelName, 0);
    sampleCountByModel.set(model.modelName, 0);
    errorsByModel.set(model.modelName, 0);
    refWordsByModel.set(model.modelName, 0);
  });

  sampleMap.forEach((modelData, sampleId) => {
    if (modelData.size === 0) return;

    const refWords = referenceWordsBySample.get(sampleId) ?? 0;
    totalReferenceWords += refWords;

    let sampleWerSum = 0;
    modelData.forEach((sample, modelName) => {
      sampleWerSum += sample.wer;
      werSumByModel.set(modelName, (werSumByModel.get(modelName) ?? 0) + sample.wer);
      sampleCountByModel.set(modelName, (sampleCountByModel.get(modelName) ?? 0) + 1);

      const errors = sampleErrorCount(sample);
      errorsByModel.set(modelName, (errorsByModel.get(modelName) ?? 0) + errors);
      refWordsByModel.set(modelName, (refWordsByModel.get(modelName) ?? 0) + refWords);
    });
    meanSampleAverageWerSum += sampleWerSum / modelData.size;

    const winners = pickOracleWinners(modelData);
    if (winners.length === 0) return;

    oracleErrors += sampleErrorCount(winners[0].sample);

    const winShare = 1 / winners.length;
    winners.forEach((winner) => {
      winCounts.set(winner.modelName, (winCounts.get(winner.modelName) ?? 0) + winShare);
    });
  });

  const totalSamples = sampleMap.size;
  const oracleWer =
    totalReferenceWords > 0 ? (oracleErrors / totalReferenceWords) * 100 : 0;
  const meanSampleAverageWer = totalSamples > 0 ? meanSampleAverageWerSum / totalSamples : 0;

  const models: OracleModelStats[] = selectedModels.map((model) => {
    const sampleCount = sampleCountByModel.get(model.modelName) ?? 0;
    const werSum = werSumByModel.get(model.modelName) ?? 0;
    const modelErrors = errorsByModel.get(model.modelName) ?? 0;
    const modelRefWords = refWordsByModel.get(model.modelName) ?? 0;
    const globalWer = modelRefWords > 0 ? (modelErrors / modelRefWords) * 100 : 0;
    const wins = winCounts.get(model.modelName) ?? 0;

    return {
      modelName: model.modelName,
      displayName: model.displayName,
      globalWer,
      avgSampleWer: sampleCount > 0 ? werSum / sampleCount : 0,
      wins,
      winPercentage: totalSamples > 0 ? (wins / totalSamples) * 100 : 0,
      sampleCount,
      gapToOracle: globalWer - oracleWer,
    };
  });

  const bestGlobalModel =
    models.length > 0
      ? [...models].sort((a, b) => a.globalWer - b.globalWer || b.wins - a.wins)[0]
      : null;

  const maxWins = models.length > 0 ? Math.max(...models.map((model) => model.wins)) : 0;
  const winLeaders =
    maxWins > 0
      ? [...models]
          .filter((model) => Math.abs(model.wins - maxWins) < 1e-9)
          .sort((a, b) => a.globalWer - b.globalWer || a.displayName.localeCompare(b.displayName))
      : [];

  return {
    oracleWer,
    totalSamples,
    totalReferenceWords,
    meanSampleAverageWer,
    bestGlobalModel,
    winLeaders,
    gapBestGlobalToOracle: bestGlobalModel ? bestGlobalModel.globalWer - oracleWer : 0,
    models: [...models].sort((a, b) => a.globalWer - b.globalWer),
  };
}
