import type { VocabSubTab } from './hashNavigation';
import type { VocabHintItem } from '../components/vocabulary/VocabSectionHint';

export const WORD_STATS_HINT_ITEMS: VocabHintItem[] = [
  {
    color: '#10B981',
    label: 'Recall',
    range: 'полнота',
    description:
      'Какая доля вхождений слова в эталоне распознана верно. Низкий recall — слово часто пропускается.',
  },
  {
    color: '#3B82F6',
    label: 'Precision',
    range: 'точность',
    description:
      'Какая доля распознанных вхождений слова действительно верна. Низкий precision — много лишних срабатываний.',
  },
  {
    color: '#8B5CF6',
    label: 'F1-score',
    range: 'баланс',
    description:
      'Сводная метрика между recall и precision. Удобна для сравнения типов слов в одной таблице.',
  },
];

export const INTERACTIVE_DICT_HINT_ITEMS: VocabHintItem[] = [
  {
    color: '#10B981',
    label: 'Recall',
    range: 'полнота',
    description: 'Доля вхождений слова в эталоне, которые модель распознала верно.',
  },
  {
    color: '#3B82F6',
    label: 'Precision',
    range: 'точность',
    description:
      'Доля верных распознаваний среди всех случаев, когда слово появилось в гипотезе.',
  },
  {
    color: '#8B5CF6',
    label: 'F1-score',
    range: 'баланс',
    description: 'Сводная метрика между recall и precision для быстрого сравнения слов.',
  },
  {
    color: '#EF4444',
    label: 'Удаления',
    range: 'DEL',
    description: 'Сколько раз слово из эталона было пропущено в распознавании.',
  },
  {
    color: '#F59E0B',
    label: 'Замены',
    range: 'SUB',
    description: 'Сколько раз слово эталона было заменено на другое в гипотезе.',
  },
  {
    color: '#6366F1',
    label: 'Вставки',
    range: 'INS',
    description: 'Сколько раз слово лишний раз появилось в гипотезе без эталона.',
  },
  {
    color: '#F97316',
    label: 'WIS',
    range: '0–100',
    description:
      'Приоритет слова для улучшения модели: учитывает частоту и серьёзность ошибок.',
  },
];

export const REPLACEMENTS_HINT_ITEMS: VocabHintItem[] = [
  {
    color: '#2563EB',
    label: 'REF',
    range: 'эталон',
    description: 'Сколько раз правило сработало в размеченном (эталонном) тексте.',
  },
  {
    color: '#7C3AED',
    label: 'HYP',
    range: 'гипотеза',
    description: 'Сколько раз правило сработало в распознанном тексте модели.',
  },
  {
    color: '#2563EB',
    label: 'Целевое слово',
    range: 'заменено',
    description: 'Слово, на которое нормализуются варианты по правилу словаря замен.',
  },
  {
    color: '#6B7280',
    label: 'Исходная форма',
    range: 'вариант',
    description:
      'Вариант написания, который заменяется на целевое слово при нормализации текста.',
  },
];

export const VOCAB_SUBTAB_DESCRIPTIONS: Record<VocabSubTab, string> = {
  summary:
    'Сводка сравнения словаря: улучшения и ухудшения Target vs Base, состав лексики и топ изменений по моделям.',
  metrics:
    'Метрики recall, precision и F1 по типам слов — сравнение Base и Target и heatmap качества на одном датасете.',
  table:
    'Интерактивная таблица всех слов с фильтрами и дельтами между моделями. Клик открывает детализацию ошибок.',
  replacements:
    'Правила нормализации и статистика замен в REF/HYP — как они влияют на сравнение моделей.',
};

export function vocabularySubtabClass(active: boolean, isDark: boolean): string {
  if (active) {
    return 'reson-vocabulary-subtab reson-vocabulary-subtab-active rounded-lg transition-colors flex items-center gap-1 shadow-sm';
  }
  return `reson-vocabulary-subtab rounded-lg transition-colors flex items-center gap-1 border ${
    isDark
      ? 'border-[#2A2D35] bg-[#23262F] text-gray-400 hover:text-white hover:border-[#3A3D45]'
      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm'
  }`;
}
