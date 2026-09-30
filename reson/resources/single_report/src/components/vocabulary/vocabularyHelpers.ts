import type { VocabSubTab } from '../../utils/hashNavigation';

export const VOCAB_SUBTAB_DESCRIPTIONS: Record<VocabSubTab, string> = {
  summary:
    'Обзор словарного состава: покрытие recall, топ и проблемные слова, быстрый поиск по словарю.',
  analytics:
    'Таблица всех слов с фильтрами по типу, частоте, recall и длине. Клик по строке открывает детализацию ошибок.',
  visualizations:
    'Графики качества распознавания: heatmap, распределения частоты и WIS по словарю.',
  falseFriends:
    'Похожие пары слов, которые модель путает (усечение, перестановка, вставка), на основе замен в данных.',
  replacements:
    'Правила нормализации текста и статистика срабатываний замен в REF и HYP.',
};

export function vocabularySubtabClass(active: boolean, isDark: boolean): string {
  if (active) {
    return 'reson-vocabulary-subtab-active px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 shadow-sm';
  }
  return `px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 border ${
    isDark
      ? 'border-[#2A2D35] bg-[#23262F] text-gray-400 hover:text-white hover:border-[#3A3D45]'
      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm'
  }`;
}
