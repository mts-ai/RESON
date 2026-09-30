export interface QuickSummaryInput {
  baselineWER?: number;
  candidateWER?: number;
  pValue?: number;
  statAnalysisAvailable?: boolean;
  werDecomposition?: {
    baseline: {
      substitutionsCount?: number;
      deletionsCount?: number;
      insertionsCount?: number;
    };
    candidate: {
      substitutionsCount?: number;
      deletionsCount?: number;
      insertionsCount?: number;
    };
  };
}

export type QuickSummaryRecommendation = 'ready' | 'review' | 'not-recommended';

export interface QuickSummaryResult {
  werChange: number;
  isImprovement: boolean;
  isSignificant: boolean;
  recommendation: QuickSummaryRecommendation;
  recommendationText: string;
  subChange: number;
  delChange: number;
  insChange: number;
  statusParts: string[];
  statusLabel: string;
}

export function computeQuickSummary(input: QuickSummaryInput): QuickSummaryResult | null {
  const { baselineWER, candidateWER, pValue, statAnalysisAvailable = false, werDecomposition } =
    input;

  if (baselineWER === undefined || candidateWER === undefined) {
    return null;
  }

  const werChange = baselineWER !== 0 ? ((candidateWER - baselineWER) / baselineWER) * 100 : 0;
  const isImprovement = werChange < 0;
  const isSignificant = statAnalysisAvailable && pValue !== undefined && pValue < 0.05;

  let recommendation: QuickSummaryRecommendation;
  let recommendationText: string;

  if (isImprovement && isSignificant && Math.abs(werChange) > 10) {
    recommendation = 'ready';
    recommendationText = 'Candidate готов к продакшену';
  } else if (!isImprovement && Math.abs(werChange) > 5) {
    recommendation = 'not-recommended';
    recommendationText = 'Candidate не рекомендуется к деплою';
  } else {
    recommendation = 'review';
    recommendationText = 'Требуется дополнительный анализ';
  }

  const subChange =
    (werDecomposition?.candidate.substitutionsCount ?? 0) -
    (werDecomposition?.baseline.substitutionsCount ?? 0);
  const delChange =
    (werDecomposition?.candidate.deletionsCount ?? 0) -
    (werDecomposition?.baseline.deletionsCount ?? 0);
  const insChange =
    (werDecomposition?.candidate.insertionsCount ?? 0) -
    (werDecomposition?.baseline.insertionsCount ?? 0);

  const statusParts = [
    isImprovement ? 'Улучшение' : 'Ухудшение',
    statAnalysisAvailable ? (isSignificant ? 'Значимо' : 'Не значимо') : null,
  ].filter(Boolean) as string[];

  const statusLabel =
    statusParts.length > 0
      ? `${statusParts.join(' · ')} · Нажмите для просмотра деталей`
      : 'Нажмите для просмотра деталей';

  return {
    werChange,
    isImprovement,
    isSignificant,
    recommendation,
    recommendationText,
    subChange,
    delChange,
    insChange,
    statusParts,
    statusLabel,
  };
}
