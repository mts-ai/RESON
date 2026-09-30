/**
 * TypeScript типы для данных ASR отчета
 */

export interface WERMetrics {
  value: number;
  mean: number;
  std: number;
  deletions: number;
  insertions: number;
  substitutions: number;
  total_words: number;
}

export interface AdditionalMetric {
  name: string;
  value: number;
  mean: number;
  std: number;
}

export interface Metrics {
  wer: WERMetrics;
  additional: AdditionalMetric[];
}

export interface DurationTypes {
  short: number;
  normal: number;
  long: number;
}

export interface DurationStats {
  mean: number;
  std: number;
  min: number;
  '25%': number;
  '50%': number;
  '75%': number;
  max: number;
}

export interface NormalizationConfig {
  remove_punct: boolean;
  lowercase: boolean;
  replace_yo: boolean;
  subst_table: string | null;
}

export interface Summary {
  totalHours: string;
  totalUtterances: number;
  durationTypes: DurationTypes;
  durationStats: DurationStats;
  vocabularySize: string;
  alphabetSize: string;
  uniqueChars: string[];
  normalized: boolean;
  normalizationConfig: NormalizationConfig;
  replacementsTotal: number;
}

export interface HeatmapCell {
  top10: number;
  p80_90: number;
  below80: number;
}

export interface HeatmapRow {
  duration: string;
  insertions: HeatmapCell;
  deletions: HeatmapCell;
  substitutions: HeatmapCell;
}

export interface WisComponentBar {
  value: number;
  weight: number;
}

export interface WisComponentsUi {
  frequency: WisComponentBar;
  errorSeverity: WisComponentBar;
  errorCriticality: WisComponentBar;
  substitutionVariability: WisComponentBar;
}

export interface WordErrorExample {
  audio_filepath: string;
  text: string;
  prediction: string;
  duration: number;
  WER: number;
  CER?: number;
  LER?: number;
  WER_H?: number;
  INS: number;
  DEL: number;
  SUB: number;
  count: number;  // Количество ошибок этого типа в примере
  replacement_targets?: Array<{ word: string; count: number }>;  // Для substitutions (ref→hyp)
}

export interface VocabWord {
  rank: number;
  word: string;
  count: number;
  recall: number;
  precision: number;
  f1_score: number;
  wis?: number;
  wisComponents?: WisComponentsUi;
  insertions?: number;
  deletions?: number;
  substitutions?: number;
  /** ASR ref→hyp targets (derived from substitution examples). */
  asrSubstitutionTargets?: Array<{ word: string; count: number; share: number }>;
  error_examples?: {
    deletions: WordErrorExample[];
    insertions: WordErrorExample[];
    substitutions: WordErrorExample[];
  };
}

export interface ReplacementVocabItem {
  original: string;
  variants: string[];
  variantsWithCounts?: Array<{ word: string; count: number }>;  // Детальная информация о количестве замен
  count: number;
}

export interface ReplacementExample {
  sampleId: string;
  field: string;
  found: string;
  replaced: string;
}

export interface ReplacementsData {
  vocab: ReplacementVocabItem[];
  examples: ReplacementExample[];
  stats: {
    totalReplacements: number;
    byField: Record<string, number>;
  };
}

export interface QualityZone {
  count: number;
  percentage: number;
}

export interface QualityZones {
  excellent: QualityZone;
  good: QualityZone;
  poor: QualityZone;
}

export interface DiffToken {
  word: string;
  type: "equal" | "ins" | "del" | "sub_del" | "sub_ins";
}

export interface ManifestItem {
  audio_filepath: string;
  duration: number;
  text: string;
  prediction: string;
  WER: number;
  CER?: number;
  LER?: number;
  WER_H?: number;
  INS: number;
  DEL: number;
  SUB: number;
  duration_type: 'short' | 'normal' | 'long';
  diff_tokens?: DiffToken[];  // Токены для diff (генерируются на бэкенде)
}

export interface NormalizationSource {
  word: string;
  count: number;
}

export interface NormalizationRule {
  target: string;
  sources: NormalizationSource[];
  count: number;
}

export interface NormalizationData {
  vocab: NormalizationRule[];
  examples: ReplacementExample[];
  stats: {
    totalReplacements: number;
    byField: Record<string, number>;
  };
}

export interface DictionaryData {
  metrics: {
    meanRecall: number;
    meanPrecision: number;
    meanF1Score: number;
  };
  totals: {
    total: number;
    russian: number;
    english: number;
    numbers: number;
    other: number;
  };
  replacements?: NormalizationData;
}

/** Топ слов по типу ошибки (для модалки «Профиль модели» → Вставки/Удаления/Замены) */
export interface TopErrorWords {
  insertions: Array<{ word: string; count: number }>;
  deletions: Array<{ word: string; count: number }>;
  substitutions: Array<{ word: string; count: number }>;
}

/** Один алерт качества данных для UI */
export interface DataQualityAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  source: 'manifest' | 'dictionary' | 'metrics';
  category: string;
  categoryColor: string;
  title: string;
  description: string;
  details: string;
  payload?: Record<string, unknown>;
  payloadSummary?: string;
}

/** Информация о запуске для панели «Информация о запуске» */
export interface RunInfo {
  runName: string;
  createdAt: string;
  recordCount: number;
  normalized: boolean;
  /** True when a normalization subst-table was configured for the run. */
  hasNormalizationDictionary?: boolean;
  metricProvider: string;
  meta: Record<string, unknown>;
  manifestSchema: Record<string, string>;
  normalizeCfg: Record<string, unknown>;
}

export interface ASRReportData {
  name: string;
  metrics: Metrics;
  summary: Summary;
  heatmapData: HeatmapRow[];
  vocab: VocabWord[];
  dictionary?: DictionaryData;
  replacements: ReplacementsData;
  qualityZones: QualityZones;
  manifest: ManifestItem[];
  /** Топ слов по вставкам/удалениям/заменам (реальные данные с бэкенда) */
  topErrorWords?: TopErrorWords;
  /** Информация о запуске (имя, дата, манифест, нормализация и т.д.) */
  runInfo?: RunInfo;
  /** Алерты качества данных (реальные с бэкенда) */
  alerts?: DataQualityAlert[];
}
