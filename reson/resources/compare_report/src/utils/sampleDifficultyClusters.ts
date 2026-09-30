import type { DifficultyClass } from "./manifestHelpers";

export type SampleDifficultyMetrics = {
  sampleWer: number;
  werVariance: number;
};

export type DifficultyThresholds = {
  medianSampleWer: number;
  medianVariance: number;
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeSampleDifficultyMetrics(
  wers: number[],
): SampleDifficultyMetrics | null {
  if (wers.length < 2) return null;

  const sampleWer = wers.reduce((sum, wer) => sum + wer, 0) / wers.length;
  const variance =
    wers.reduce((sum, wer) => sum + Math.pow(wer - sampleWer, 2), 0) /
    wers.length;

  return {
    sampleWer,
    werVariance: Math.sqrt(variance),
  };
}

export function computeDifficultyThresholds(
  metrics: SampleDifficultyMetrics[],
): DifficultyThresholds {
  if (metrics.length === 0) {
    return { medianSampleWer: 0, medianVariance: 0 };
  }

  return {
    medianSampleWer: median(metrics.map((point) => point.sampleWer)),
    medianVariance: median(metrics.map((point) => point.werVariance)),
  };
}

export function classifySampleDifficulty(
  metrics: SampleDifficultyMetrics,
  thresholds: DifficultyThresholds,
): DifficultyClass {
  const isHard = metrics.sampleWer > thresholds.medianSampleWer;
  const isDivergent = metrics.werVariance > thresholds.medianVariance;

  if (isHard && isDivergent) return "hard-divergent";
  if (isHard) return "hard-consensus";
  if (isDivergent) return "easy-divergent";
  return "easy-consensus";
}

export function buildSampleDifficultyClassification(
  samples: Array<{ id: string; wers: number[] }>,
): {
  thresholds: DifficultyThresholds;
  classificationById: Map<string, DifficultyClass | null>;
  classifiableCount: number;
} {
  const metricsById = new Map<string, SampleDifficultyMetrics>();

  samples.forEach(({ id, wers }) => {
    const metrics = computeSampleDifficultyMetrics(wers);
    if (metrics) {
      metricsById.set(id, metrics);
    }
  });

  const thresholds = computeDifficultyThresholds(Array.from(metricsById.values()));
  const classificationById = new Map<string, DifficultyClass | null>();

  samples.forEach(({ id }) => {
    const metrics = metricsById.get(id);
    classificationById.set(
      id,
      metrics ? classifySampleDifficulty(metrics, thresholds) : null,
    );
  });

  return {
    thresholds,
    classificationById,
    classifiableCount: metricsById.size,
  };
}
