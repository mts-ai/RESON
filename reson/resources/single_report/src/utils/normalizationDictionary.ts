import type { ASRReportData } from '../types/data';

/** Словарь нормализации (subst-table), не ASR-ошибки в ``data.replacements``. */
export function hasNormalizationDictionary(data: ASRReportData | null | undefined): boolean {
  if (!data) return false;

  if (data.runInfo?.hasNormalizationDictionary === true) return true;
  if (data.runInfo?.hasNormalizationDictionary === false) return false;

  const substTable = data.summary?.normalizationConfig?.subst_table;
  if (substTable === null || substTable === 'none' || substTable === 'None') {
    return false;
  }

  const repl = data.dictionary?.replacements;
  return Boolean(repl && Array.isArray(repl.vocab) && repl.vocab.length > 0);
}
