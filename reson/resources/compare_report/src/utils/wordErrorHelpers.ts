import type { ErrorExamplesUi, WordErrorExample, WordMetrics } from '../components/VocabularyComparison';

export type DiffTokenType = 'equal' | 'ins' | 'del' | 'sub_del' | 'sub_ins';

export interface DiffToken {
  word: string;
  type: DiffTokenType;
}

export interface CompareManifestEntry {
  audio_filepath: string;
  duration: number;
  text: string;
  prediction: string;
  wer: number;
  cer?: number;
  insertions: number;
  deletions: number;
  substitutions: number;
  diff_tokens?: DiffToken[];
}

export interface WordErrorContext {
  id: string | number;
  file: string;
  time: string;
  reference: string;
  hypothesis: string;
  errorType: 'deletion' | 'insertion' | 'substitution';
  count: number;
}

export interface SubstitutionTargetSummary {
  word: string;
  count: number;
  utteranceCount: number;
  percent: number;
}

export function sumErrorExampleCounts(items?: WordErrorExample[]): number {
  return (items || []).reduce((acc, item) => acc + (item.count || 1), 0);
}

export function getErrorUtteranceCounts(errorExamples?: ErrorExamplesUi) {
  if (!errorExamples) {
    return { deletions: 0, insertions: 0, substitutions: 0 };
  }
  return {
    deletions: errorExamples.deletions?.length ?? 0,
    insertions: errorExamples.insertions?.length ?? 0,
    substitutions: errorExamples.substitutions?.length ?? 0,
  };
}

export function sumContextCounts(contexts: WordErrorContext[]): number {
  return contexts.reduce((acc, ctx) => acc + (ctx.count || 1), 0);
}

export function getErrorCounts(errorExamples?: ErrorExamplesUi) {
  if (!errorExamples) {
    return { deletions: 0, insertions: 0, substitutions: 0 };
  }
  return {
    deletions: sumErrorExampleCounts(errorExamples.deletions),
    insertions: sumErrorExampleCounts(errorExamples.insertions),
    substitutions: sumErrorExampleCounts(errorExamples.substitutions),
  };
}

export function buildWordContexts(errorExamples?: ErrorExamplesUi): WordErrorContext[] {
  if (!errorExamples) return [];

  const contexts: WordErrorContext[] = [];

  errorExamples.deletions?.forEach((example, idx) => {
    contexts.push({
      id: `del-${idx}`,
      file: example.audio_filepath,
      time: `${Math.round(example.duration || 0)} с`,
      reference: example.text,
      hypothesis: example.prediction,
      errorType: 'deletion',
      count: example.count || 1,
    });
  });

  errorExamples.insertions?.forEach((example, idx) => {
    contexts.push({
      id: `ins-${idx}`,
      file: example.audio_filepath,
      time: `${Math.round(example.duration || 0)} с`,
      reference: example.text,
      hypothesis: example.prediction,
      errorType: 'insertion',
      count: example.count || 1,
    });
  });

  errorExamples.substitutions?.forEach((example, idx) => {
    contexts.push({
      id: `sub-${idx}`,
      file: example.audio_filepath,
      time: `${Math.round(example.duration || 0)} с`,
      reference: example.text,
      hypothesis: example.prediction,
      errorType: 'substitution',
      count: example.count || 1,
    });
  });

  return contexts;
}

export function getExamplesForErrorType(
  contexts: WordErrorContext[],
  errorType: WordErrorContext['errorType'],
): WordErrorContext[] {
  return contexts.filter((ctx) => ctx.errorType === errorType);
}

export function getExamplesForSubstitutionTarget(
  substitutions: WordErrorExample[] | undefined,
  targetWord: string,
): WordErrorContext[] {
  const contexts: WordErrorContext[] = [];

  (substitutions || []).forEach((example, idx) => {
    const match = (example.replacement_targets || []).find(
      (target) => target.word.toLowerCase() === targetWord.toLowerCase(),
    );
    if (!match || (match.count || 0) <= 0) return;

    contexts.push({
      id: `sub-${targetWord}-${idx}`,
      file: example.audio_filepath,
      time: `${Math.round(example.duration || 0)} с`,
      reference: example.text,
      hypothesis: example.prediction,
      errorType: 'substitution',
      count: match.count,
    });
  });

  return contexts;
}

export function buildSubstitutionTargets(
  substitutions: WordErrorExample[] | undefined,
): SubstitutionTargetSummary[] {
  const totals = new Map<string, number>();
  const utterances = new Map<string, number>();

  for (const example of substitutions || []) {
    for (const target of example.replacement_targets || []) {
      const word = target.word;
      const count = target.count ?? 0;
      if (!word || count <= 0) continue;
      totals.set(word, (totals.get(word) ?? 0) + count);
      utterances.set(word, (utterances.get(word) ?? 0) + 1);
    }
  }

  const grandTotal = [...totals.values()].reduce((sum, count) => sum + count, 0);

  return [...totals.entries()]
    .map(([word, count]) => ({
      word,
      count,
      utteranceCount: utterances.get(word) ?? 0,
      percent: grandTotal > 0 ? Math.round((count / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function sumSubstitutionTargetCounts(substitutions?: WordErrorExample[]): number {
  return buildSubstitutionTargets(substitutions).reduce((sum, target) => sum + target.count, 0);
}

export function countSubstitutionUtterances(substitutions?: WordErrorExample[]): number {
  return (substitutions || []).filter((example) =>
    (example.replacement_targets || []).some((target) => (target.count ?? 0) > 0),
  ).length;
}

export function getSubstitutionStats(substitutions?: WordErrorExample[]) {
  const targets = buildSubstitutionTargets(substitutions);
  const totalReplacements = targets.reduce((sum, target) => sum + target.count, 0);
  const utterances = countSubstitutionUtterances(substitutions);
  return {
    targets,
    totalReplacements,
    utterances,
    variants: targets.length,
  };
}

export function getDisplayErrorCounts(errorExamples?: ErrorExamplesUi) {
  const base = getErrorCounts(errorExamples);
  if (!errorExamples) return base;
  return {
    ...base,
    substitutions: sumSubstitutionTargetCounts(errorExamples.substitutions),
  };
}

export function getDisplayUtteranceCounts(errorExamples?: ErrorExamplesUi) {
  const base = getErrorUtteranceCounts(errorExamples);
  if (!errorExamples) return base;
  return {
    ...base,
    substitutions: countSubstitutionUtterances(errorExamples.substitutions),
  };
}

export function findManifestEntry(
  manifestData: Record<string, CompareManifestEntry[]>,
  modelName: string,
  audioFilepath: string,
): CompareManifestEntry | undefined {
  return manifestData[modelName]?.find((entry) => entry.audio_filepath === audioFilepath);
}

export function hasErrorExamples(metrics?: WordMetrics): boolean {
  if (!metrics?.errorExamples) return false;
  const counts = getDisplayErrorCounts(metrics.errorExamples);
  return counts.deletions + counts.insertions + counts.substitutions > 0;
}
