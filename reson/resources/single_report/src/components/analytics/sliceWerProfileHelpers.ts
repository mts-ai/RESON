export type WerQuantilePoint = {
  label: string;
  value: number;
};

export type HeavyWerBucket = {
  label: string;
  threshold: number;
  count: number;
  percent: number;
};

export type SliceWerProfileStats = {
  quantiles: WerQuantilePoint[];
  heavyBuckets: HeavyWerBucket[];
  sampleCount: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

const HEAVY_THRESHOLDS = [
  { label: 'WER > 30%', threshold: 30 },
  { label: 'WER > 50%', threshold: 50 },
  { label: 'WER > 80%', threshold: 80 },
  { label: 'WER > 100%', threshold: 100 },
  { label: 'WER > 200%', threshold: 200 },
  { label: 'WER > 1000%', threshold: 1000 },
] as const;

export function buildSliceWerProfileStats(
  correlationData: Array<{ wer?: number }>,
): SliceWerProfileStats {
  const wers = correlationData
    .map((point) => Number(point.wer ?? NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  const sampleCount = wers.length;
  if (sampleCount === 0) {
    return {
      quantiles: [
        { label: 'P25', value: 0 },
        { label: 'P50', value: 0 },
        { label: 'P75', value: 0 },
        { label: 'P90', value: 0 },
        { label: 'P95', value: 0 },
      ],
      heavyBuckets: HEAVY_THRESHOLDS.map((bucket) => ({
        label: bucket.label,
        threshold: bucket.threshold,
        count: 0,
        percent: 0,
      })),
      sampleCount: 0,
    };
  }

  const quantiles: WerQuantilePoint[] = [
    { label: 'P25', value: percentile(wers, 0.25) },
    { label: 'P50', value: percentile(wers, 0.5) },
    { label: 'P75', value: percentile(wers, 0.75) },
    { label: 'P90', value: percentile(wers, 0.9) },
    { label: 'P95', value: percentile(wers, 0.95) },
  ];

  const heavyBuckets: HeavyWerBucket[] = HEAVY_THRESHOLDS.map((bucket) => {
    const count = wers.filter((wer) => wer > bucket.threshold).length;
    return {
      label: bucket.label,
      threshold: bucket.threshold,
      count,
      percent: (count / sampleCount) * 100,
    };
  });

  return { quantiles, heavyBuckets, sampleCount };
}
