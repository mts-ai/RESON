export interface NormalizationReplacementRule {
  target: string;
  sources: Array<{
    word: string;
    count?: number;
    countText?: number;
    countPrediction?: number;
  }>;
  count?: number;
}

export interface NormalizationDictionaryModel {
  vocab: NormalizationReplacementRule[];
  examples?: Array<{
    sampleId: string;
    field: string;
    found: string;
    replaced: string;
  }>;
  stats?: {
    totalReplacements?: number;
    byField?: Record<string, number>;
  };
}

export interface CompareNormalizationDictionary {
  hasNormalizationDictionary: boolean;
  byModel: Record<string, NormalizationDictionaryModel>;
}

export function hasCompareNormalizationDictionary(
  data: CompareNormalizationDictionary | null | undefined,
): boolean {
  if (!data?.hasNormalizationDictionary) return false;
  return Object.values(data.byModel ?? {}).some(
    (modelData) => Array.isArray(modelData.vocab) && modelData.vocab.length > 0,
  );
}
