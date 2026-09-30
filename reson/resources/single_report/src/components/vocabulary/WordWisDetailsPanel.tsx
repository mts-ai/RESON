import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { WisComponentsUi } from "../../types/data";

const WIS_THRESHOLDS = [
  {
    color: "#10B981",
    label: "Маленький",
    range: "0–30",
    description: "Слово распознаётся хорошо, минимальный приоритет",
  },
  {
    color: "#A3E635",
    label: "Умеренный",
    range: "30–45",
    description: "Слово распознаётся удовлетворительно, низкий приоритет",
  },
  {
    color: "#F59E0B",
    label: "Средний",
    range: "45–60",
    description: "Слово требует внимания, средний приоритет",
  },
  {
    color: "#F97316",
    label: "Высокий",
    range: "60–75",
    description: "Значительные проблемы, высокий приоритет",
  },
  {
    color: "#EF4444",
    label: "Критический",
    range: "75–100",
    description: "Критично для модели, требует немедленного внимания",
  },
] as const;

const WIS_COMPONENT_META = [
  {
    key: "frequency" as const,
    color: "#3B82F6",
    title: "Частота",
    code: "frequency_score",
    description:
      "Логарифмическая нормализация частоты слова (log₁₀(freq+1) / log₁₀(max_freq+1))",
  },
  {
    key: "errorSeverity" as const,
    color: "#EF4444",
    title: "Серьёзность ошибок",
    code: "error_severity",
    description: "100 − F1-score (обратная величина качества)",
  },
  {
    key: "errorCriticality" as const,
    color: "#F59E0B",
    title: "Критичность ошибок",
    code: "error_criticality",
    description:
      "Взвешенная оценка ошибок (удаления × 2.0 + замены × 1.5 + вставки × 1.0)",
  },
  {
    key: "substitutionVariability" as const,
    color: "#8B5CF6",
    title: "Вариативность замен",
    code: "substitution_diversity",
    description:
      "Уникальные замены × 12 + log₁₀(общее_количество_замен) × 8",
  },
] as const;

interface WordWisDetailsPanelProps {
  isDark: boolean;
  wisComponents: WisComponentsUi;
}

export function WordWisDetailsPanel({
  isDark,
  wisComponents,
}: WordWisDetailsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`reson-word-wis-details ${isDark ? "reson-word-wis-details--dark" : ""}`}>
      <button
        type="button"
        className={`reson-word-wis-details-trigger ${open ? "reson-word-wis-details-trigger--open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="reson-word-wis-details-trigger-icon">
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <span>Подробности WIS</span>
        <ChevronDown
          className={`reson-word-wis-details-chevron ${open ? "reson-word-wis-details-chevron--open" : ""}`}
        />
      </button>

      {open && (
        <div className="reson-word-wis-details-panel">
          <section className="reson-word-wis-details-section">
            <h4 className="reson-word-wis-details-heading">Что означает эта метрика?</h4>
            <p className="reson-word-wis-details-text">
              <strong>Word Importance Score (WIS)</strong> — комплексная метрика важности
              слова для улучшения модели ASR. WIS учитывает четыре фактора с весами:
              частоту слова (25%), серьёзность ошибок (35%), критичность типов ошибок
              (25%) и вариативность замен (15%). Чем выше балл, тем важнее это слово
              для анализа и улучшения модели.
            </p>
          </section>

          <section className="reson-word-wis-details-section">
            <h4 className="reson-word-wis-details-heading">Пороги важности</h4>
            <ul className="reson-word-wis-threshold-list">
              {WIS_THRESHOLDS.map((item) => (
                <li key={item.label} className="reson-word-wis-threshold-item">
                  <span
                    className="reson-word-wis-threshold-accent"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="reson-word-wis-threshold-body">
                    <div className="reson-word-wis-threshold-top">
                      <span className="reson-word-wis-threshold-label">{item.label}</span>
                      <span className="reson-word-wis-threshold-range">{item.range}</span>
                    </div>
                    <p className="reson-word-wis-threshold-desc">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="reson-word-wis-details-section">
            <h4 className="reson-word-wis-details-heading">Формула расчёта</h4>
            <div className="reson-word-wis-formula">
              <div>base_wis = frequency_score × 0.25 + error_severity × 0.35 +</div>
              <div className="reson-word-wis-formula-indent">
                error_criticality × 0.25 + substitution_diversity × 0.15
              </div>
              <div className="reson-word-wis-formula-result">
                wis = base_wis × type_multiplier × length_multiplier
              </div>
            </div>
          </section>

          <section className="reson-word-wis-details-section">
            <h4 className="reson-word-wis-details-heading">Компоненты формулы</h4>
            <ul className="reson-word-wis-component-list">
              {WIS_COMPONENT_META.map((item) => (
                <li key={item.key} className="reson-word-wis-component-desc-item">
                  <span
                    className="reson-word-wis-threshold-accent"
                    style={{ backgroundColor: item.color }}
                  />
                  <p className="reson-word-wis-details-text">
                    <strong>
                      {item.title} ({item.code})
                    </strong>
                    : {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="reson-word-wis-details-section">
            <h4 className="reson-word-wis-details-heading">Декомпозиция оценки</h4>
            <div className="reson-word-wis-decomp-grid">
              {WIS_COMPONENT_META.map((item) => {
                const component = wisComponents[item.key];
                return (
                  <div key={item.key} className="reson-word-wis-decomp-card">
                    <div className="reson-word-wis-decomp-top">
                      <span className="reson-word-wis-decomp-label">
                        <span
                          className="reson-word-wis-decomp-dot"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.title} (вес {component.weight}%)
                      </span>
                      <span className="reson-word-wis-decomp-value">
                        {component.value.toFixed(1)}
                      </span>
                    </div>
                    <div className="reson-word-wis-decomp-track">
                      <div
                        className="reson-word-wis-decomp-fill"
                        style={{
                          width: `${component.value}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
