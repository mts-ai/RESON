import { VocabSectionHint } from "./VocabSectionHint";

const COVERAGE_HINT_ITEMS = [
  {
    color: "#10B981",
    label: "Высокое покрытие",
    range: "Recall >90%",
    description: "Слова распознаются отлично",
  },
  {
    color: "#F59E0B",
    label: "Среднее покрытие",
    range: "Recall 50–90%",
    description: "Слова распознаются нестабильно",
  },
  {
    color: "#EF4444",
    label: "Низкое покрытие",
    range: "Recall <50%",
    description: "Слова распознаются плохо",
  },
] as const;

interface CoverageMetricsHintProps {
  isDark: boolean;
}

export function CoverageMetricsHint({ isDark }: CoverageMetricsHintProps) {
  return (
    <VocabSectionHint
      isDark={isDark}
      triggerText="Что означают эти метрики?"
      panelTitle="Уровни покрытия"
      panelSubtitle="Как читать распределение по Recall"
      panelAriaLabel="Пояснение уровней покрытия"
      items={[...COVERAGE_HINT_ITEMS]}
    />
  );
}
