export interface AnalyticsSample {
  duration: number;
  wer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
}

export interface AnalyticsSliceStat {
  modelName: string;
  displayName: string;
  samplesCount: number;
  avgWER: number;
  avgDuration: number;
  totalInsertions: number;
  totalDeletions: number;
  totalSubstitutions: number;
  samples: AnalyticsSample[];
}

export interface ModelProfileMetrics {
  werAcc: number;
  short: number | null;
  long: number | null;
  robust: number;
  insert: number;
  delet: number;
  subst: number;
  insertionsCount: number;
  deletionsCount: number;
  substitutionsCount: number;
}

export const ANALYTICS_MODEL_COLORS = [
  "hsl(200, 80%, 55%)",
  "hsl(142, 76%, 50%)",
  "hsl(280, 80%, 60%)",
  "hsl(25, 95%, 53%)",
  "hsl(0, 76%, 55%)",
  "hsl(180, 70%, 50%)",
  "hsl(320, 75%, 55%)",
  "hsl(45, 90%, 55%)",
];

export const PROFILE_AXIS_DESCRIPTIONS: Record<string, string> = {
  "WER Acc": "Общая точность распознавания (100% - WER)",
  Short: "Качество на коротких записях (1-5 сек)",
  Long: "Качество на длинных записях (30+ сек)",
  Robust: "Процент файлов с WER ≤ 15%",
  "Insert.": "Устойчивость к вставкам (100 - INS%)",
  "Delet.": "Устойчивость к удалениям (100 - DEL%)",
  "Subst.": "Устойчивость к заменам (100 - SUB%)",
};

export function computeModelProfile(stat: AnalyticsSliceStat): ModelProfileMetrics {
  const shortSamples = stat.samples.filter((s) => s.duration < 5);
  const longSamples = stat.samples.filter((s) => s.duration >= 30);

  const shortAvgWer =
    shortSamples.length > 0
      ? shortSamples.reduce((sum, s) => sum + s.wer, 0) / shortSamples.length
      : null;
  const longAvgWer =
    longSamples.length > 0
      ? longSamples.reduce((sum, s) => sum + s.wer, 0) / longSamples.length
      : null;

  const robustSamples = stat.samples.filter((s) => s.wer <= 15);
  const robust =
    stat.samples.length > 0
      ? (robustSamples.length / stat.samples.length) * 100
      : 0;

  const totalErrors =
    stat.totalInsertions + stat.totalDeletions + stat.totalSubstitutions;
  const insPct =
    totalErrors > 0 ? (stat.totalInsertions / totalErrors) * 100 : 0;
  const delPct =
    totalErrors > 0 ? (stat.totalDeletions / totalErrors) * 100 : 0;
  const subPct =
    totalErrors > 0 ? (stat.totalSubstitutions / totalErrors) * 100 : 0;

  return {
    werAcc: Math.max(0, 100 - stat.avgWER),
    short: shortAvgWer !== null ? Math.max(0, 100 - shortAvgWer) : null,
    long: longAvgWer !== null ? Math.max(0, 100 - longAvgWer) : null,
    robust,
    insert: 100 - insPct,
    delet: 100 - delPct,
    subst: 100 - subPct,
    insertionsCount: stat.totalInsertions,
    deletionsCount: stat.totalDeletions,
    substitutionsCount: stat.totalSubstitutions,
  };
}

type ProfileAxisKey = keyof Pick<
  ModelProfileMetrics,
  "werAcc" | "short" | "long" | "robust" | "insert" | "delet" | "subst"
>;

const PROFILE_AXIS_DEFS: Array<{ key: ProfileAxisKey; axis: string }> = [
  { key: "werAcc", axis: "WER Acc" },
  { key: "short", axis: "Short" },
  { key: "long", axis: "Long" },
  { key: "robust", axis: "Robust" },
  { key: "insert", axis: "Insert." },
  { key: "delet", axis: "Delet." },
  { key: "subst", axis: "Subst." },
];

export function buildMultiModelRadarData(
  profiles: Array<{ displayName: string; metrics: ModelProfileMetrics }>,
) {
  return PROFILE_AXIS_DEFS.filter((def) => {
    if (def.key === "short" || def.key === "long") {
      return profiles.some((profile) => profile.metrics[def.key] !== null);
    }
    return true;
  }).map((def) => {
    const row: Record<string, string | number> = {
      axis: def.axis,
      fullMark: 100,
    };

    profiles.forEach((profile) => {
      const value = profile.metrics[def.key];
      if (typeof value === "number") {
        row[profile.displayName] = value;
      }
    });

    return row;
  });
}

export function normalizeAcrossModels(
  stats: AnalyticsSliceStat[],
  getValue: (stat: AnalyticsSliceStat) => number,
): Map<string, number> {
  const entries = stats.map((stat) => ({
    name: stat.displayName,
    value: getValue(stat),
  }));
  const min = Math.min(...entries.map((entry) => entry.value));
  const max = Math.max(...entries.map((entry) => entry.value));
  const range = max - min;

  return new Map(
    entries.map(({ name, value }) => [
      name,
      range === 0 ? 50 : ((value - min) / range) * 100,
    ]),
  );
}
