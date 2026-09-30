import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "./ui/button";
import { X, ChevronRight, ChevronLeft, Check } from "./icons";

interface TourStep {
  target: string;
  title: string;
  content: string;
  section?: string;
  position?: "top" | "bottom" | "left" | "right";
  highlightPadding?: number;
}

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onSectionChange?: (section: string) => void;
  /** Opens the mobile navigation drawer while a step points at the sidebar. */
  onNavHighlight?: (open: boolean) => void;
}

const SIDEBAR_TOUR_TARGET = '[data-tour="sidebar"]';
const TOOLTIP_MAX_WIDTH = 400;
const TOOLTIP_PADDING = 20;

/** Steps pointing at the sidebar or its nav buttons need the drawer open on mobile. */
function targetsSidebar(target: string): boolean {
  return target === SIDEBAR_TOUR_TARGET || target.endsWith('-nav-button"]');
}

/** Card shrinks with the viewport so it never overflows a phone screen. */
function tooltipWidthFor(viewportWidth: number): number {
  return Math.min(TOOLTIP_MAX_WIDTH, viewportWidth - TOOLTIP_PADDING * 2);
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "body",
    title: "Добро пожаловать в MWS AI RESON!",
    content: "Интерактивный отчет для сравнения ASR моделей. Давайте пройдемся по основным возможностям.",
  },
  {
    target: '[data-tour="model-selector"]',
    title: "Выбор моделей",
    content: "Выберите Base и Target модели для сравнения. Добавьте дополнительные модели для расширенного анализа.",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="sidebar"]',
    title: "Навигация по разделам",
    content: "Четыре основных раздела: Обзор (метрики), Словарь (анализ слов), Аналитика (графики и срезы), Манифест (детали записей и Oracle WER).",
    position: "right",
    highlightPadding: 12,
  },

  // Overview
  {
    target: '[data-tour="overview-nav-button"]',
    title: "Раздел: Обзор",
    content: "Основные метрики качества моделей и быстрая оценка изменений.",
    section: "overview",
    position: "right",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="quick-summary"]',
    title: "Краткие выводы",
    content: "Сводка сравнения Base vs Target: улучшение или ухудшение, статистическая значимость и рекомендация по деплою.",
    section: "overview",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="dataset-info"]',
    title: "Информация о датасете",
    content: "Характеристики датасета: длительность, количество записей, размер словаря. Контекст для интерпретации метрик.",
    section: "overview",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="metrics"]',
    title: "Метрики WER и MWA",
    content: "WER (Word Error Rate) — процент ошибок распознавания. MWA (Match Word Accuracy) — точность на словах из оттекстовок. Визуальные индикаторы показывают изменения.",
    section: "overview",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="statistical-significance"]',
    title: "Статистическая значимость",
    content: "Подтверждает, что различия между моделями статистически значимы, а не случайны.",
    section: "overview",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="wer-decomposition"]',
    title: "Декомпозиция ошибок",
    content: "WER разбит на три типа: вставки (лишние слова), удаления (пропущенные), замены (неверно распознанные).",
    section: "overview",
    position: "top",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="leaderboard-button"]',
    title: "Leaderboard моделей",
    content: "Открывает полный рейтинг всех выбранных моделей с подробными метриками, подиумом топ-3 и детальной разбивкой показателей.",
    section: "overview",
    position: "left",
    highlightPadding: 12,
  },

  // Vocabulary
  {
    target: '[data-tour="vocabulary-nav-button"]',
    title: "Раздел: Словарь",
    content: "Анализ качества распознавания на уровне отдельных слов. Критически важен для понимания слабых мест модели.",
    section: "dictionary",
    position: "right",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-impact-summary"]',
    title: "Обзор словаря",
    content: "Поиск слов, распределение по типам (русские, английские, числа), топ улучшений и ухудшений.",
    section: "dictionary",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-metrics-by-type"]',
    title: "Метрики по типам",
    content: "Сравнение Recall, Precision и F1-score между моделями для разных категорий слов.",
    section: "dictionary",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-detail-card-table"]',
    title: "Интерактивный словарь",
    content: "Интерактивная таблица всех слов: Target с mini-bar, дельты, ошибки INS/DEL/SUB. Клик на слово открывает детальный просмотр.",
    section: "dictionary",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-quality-heatmap"]',
    title: "Тепловая карта качества",
    content: "Средние метрики по типам слов и частотным диапазонам. Цвет — качество Target, подпись Δ — разница с Base.",
    section: "dictionary",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-replacements"]',
    title: "Словарь замен",
    content: "Сравнение срабатываний словаря нормализации REF/HYP по моделям. Вкладка видна только если subst-table использовался в прогоне.",
    section: "dictionary",
    position: "bottom",
    highlightPadding: 8,
  },

  // Analytics
  {
    target: '[data-tour="analytics-nav-button"]',
    title: "Раздел: Аналитика",
    content: "Глубокий анализ через интерактивные визуализации. Исследуйте срезы данных и зависимости.",
    section: "analytics",
    position: "right",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="analytics-dataset-summary"]',
    title: "Сводка по датасету",
    content: "Тепловая карта ошибок по моделям и длительности на всём датасете (без фильтра среза) и автоматические наблюдения, включая сравнение моделей.",
    section: "analytics",
    position: "top",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="analytics-slice-stats"]',
    title: "Срез",
    content: "Аналитика текущего среза: распределение WER, параллельные координаты, радарный профиль и распределение по длительности.",
    section: "analytics",
    position: "top",
    highlightPadding: 16,
  },
  {
    target: '[data-tour="analytics-profile"]',
    title: "Профиль моделей",
    content: "Recharts-профиль как в single_report: карточки ошибок и радар по WER Acc, Short/Long, Robust и типам ошибок для выбранных моделей.",
    section: "analytics",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="analytics-filters-button"]',
    title: "Фильтр среза",
    content: "Модальное окно «Фильтр среза»: тип длительности и сравнение моделей (единственный лучший или худший WER на примере). Не влияет на вкладку «Сводка».",
    section: "analytics",
    position: "top",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="analytics-visualizations"]',
    title: "Распределение WER",
    content: "Главный график вкладки «Срез» — плотность распределения WER по моделям на текущем фильтре.",
    section: "analytics",
    position: "top",
    highlightPadding: 16,
  },
  {
    target: '[data-tour="analytics-classes"]',
    title: "Кластеры сложности",
    content: "Квадранты примеров по медианам WER на записи и σ между моделями (легко/сложно × консенсус/расхождение). Те же классы доступны в фильтрах манифеста.",
    section: "analytics",
    position: "top",
    highlightPadding: 16,
  },

  // Manifest
  {
    target: '[data-tour="manifest-nav-button"]',
    title: "Раздел: Манифест",
    content: "Детальный обзор всех записей датасета на уровне аудио. Исследуйте каждую запись индивидуально.",
    section: "manifest",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="manifest-tabs"]',
    title: "Вкладки манифеста",
    content: "«Интерактивный манифест» — таблица записей с фильтрами и экспортом. «Oracle WER» — ансамблевый потолок качества на том же срезе данных, что и таблица.",
    section: "manifest",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="manifest-filters-button"]',
    title: "Фильтры манифеста",
    content: "Открывает боковую панель среза: поиск, длительность, класс сложности (медианы WER и σ), диапазоны среднего WER и расхождения, сравнение моделей. Счётчик показывает число активных фильтров и записей в срезе.",
    section: "manifest",
    position: "left",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="manifest-table"]',
    title: "Таблица записей",
    content: "WER по моделям, σ между моделями, класс сложности (квадранты по медианам). Подсветка высокого WER и расхождения. Клик по строке — детализация: аудио, diff, метрики каждой модели.",
    section: "manifest",
    position: "top",
    highlightPadding: 16,
  },
  {
    target: '[data-tour="manifest-oracle-summary"]',
    title: "Oracle WER",
    content: "Минимально достижимый Global WER при выборе лучшей модели на каждой записи среза. Сравнение с лидером по Global WER, лидером по победам (ничья — доля 1/N) и запасом до Oracle. Учитывает все фильтры манифеста.",
    section: "manifest",
    position: "top",
    highlightPadding: 16,
  },
];

export function GuidedTour({ isOpen, onClose, onSectionChange, onNavHighlight }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  /*
   * `calculatePosition` works from an estimated card height. On narrow screens
   * the copy wraps into a taller card than estimated, so pull it back up once
   * the real height is known.
   */
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const overflow =
      card.getBoundingClientRect().bottom - (window.innerHeight - TOOLTIP_PADDING);
    if (overflow <= 0) return;

    setPosition((prev) => {
      const top = Math.max(window.scrollY + TOOLTIP_PADDING, prev.top - overflow);
      return top === prev.top ? prev : { ...prev, top };
    });
  }, [step, position]);

  const currentStep = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  // Find element with retry logic
  const findElement = async (selector: string, maxAttempts = 20): Promise<HTMLElement | null> => {
    for (let i = 0; i < maxAttempts; i++) {
      const el = document.querySelector(selector) as HTMLElement;
      // `offsetParent` is always null for fixed elements (the mobile nav drawer),
      // so fall back to client rects to detect that they are rendered.
      if (el && (el.offsetParent !== null || el.getClientRects().length > 0)) {
        return el;
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    return null;
  };

  // Calculate tooltip position
  const calculatePosition = (target: HTMLElement, pos: string = "bottom") => {
    const rect = target.getBoundingClientRect();
    const isFixed = window.getComputedStyle(target).position === "fixed";
    
    const tooltipWidth = tooltipWidthFor(window.innerWidth);
    const tooltipHeight = 250;
    const gap = 24;
    const padding = TOOLTIP_PADDING;

    // Helper to check if tooltip would overlap with target
    const checkOverlap = (tooltipRect: { top: number; left: number; width: number; height: number }) => {
      const targetTop = isFixed ? rect.top : rect.top + window.scrollY;
      const targetLeft = isFixed ? rect.left : rect.left + window.scrollX;
      
      return !(
        tooltipRect.left > targetLeft + rect.width ||
        tooltipRect.left + tooltipRect.width < targetLeft ||
        tooltipRect.top > targetTop + rect.height ||
        tooltipRect.top + tooltipRect.height < targetTop
      );
    };

    // Try positions in order of preference
    const positions = [pos, "bottom", "top", "right", "left"].filter((p, i, arr) => arr.indexOf(p) === i);
    
    for (const position of positions) {
      let top = 0;
      let left = 0;

      switch (position) {
        case "bottom":
          top = (isFixed ? rect.bottom : rect.bottom + window.scrollY) + gap;
          left = (isFixed ? rect.left : rect.left + window.scrollX) + rect.width / 2 - tooltipWidth / 2;
          break;
        case "top":
          top = (isFixed ? rect.top : rect.top + window.scrollY) - tooltipHeight - gap;
          left = (isFixed ? rect.left : rect.left + window.scrollX) + rect.width / 2 - tooltipWidth / 2;
          break;
        case "right":
          top = (isFixed ? rect.top : rect.top + window.scrollY) + rect.height / 2 - tooltipHeight / 2;
          left = (isFixed ? rect.right : rect.right + window.scrollX) + gap;
          break;
        case "left":
          top = (isFixed ? rect.top : rect.top + window.scrollY) + rect.height / 2 - tooltipHeight / 2;
          left = (isFixed ? rect.left : rect.left + window.scrollX) - tooltipWidth - gap;
          break;
      }

      // Keep in viewport
      const maxLeft = window.innerWidth - tooltipWidth - padding;
      const maxTop = window.scrollY + window.innerHeight - tooltipHeight - padding;
      
      const clampedLeft = Math.max(padding, Math.min(left, maxLeft));
      const clampedTop = Math.max(window.scrollY + padding, Math.min(top, maxTop));

      // Check if this position works (no overlap)
      const tooltipRect = {
        top: clampedTop,
        left: clampedLeft,
        width: tooltipWidth,
        height: tooltipHeight
      };

      if (!checkOverlap(tooltipRect)) {
        return { top: clampedTop, left: clampedLeft };
      }
    }

    // Fallback: position to the right side of viewport
    return {
      top: Math.max(window.scrollY + padding, Math.min(
        (isFixed ? rect.top : rect.top + window.scrollY),
        window.scrollY + window.innerHeight - tooltipHeight - padding
      )),
      left: window.innerWidth - tooltipWidth - padding
    };
  };

  // Update target element and position
  const updateTargetElement = async () => {
    if (!currentStep) return;

    setIsTransitioning(true);

    // Handle section change
    if (currentStep.section && onSectionChange) {
      onSectionChange(currentStep.section);
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    if (onNavHighlight) {
      onNavHighlight(targetsSidebar(currentStep.target));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Handle vocabulary tab clicks
    if (currentStep.section === "dictionary") {
      const tabTarget = currentStep.target;
      if (tabTarget.includes("vocabulary-")) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const tabButton = document.querySelector(tabTarget) as HTMLElement;
        if (tabButton && tabButton.tagName === "BUTTON") {
          tabButton.click();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // Handle analytics main tab clicks
    if (currentStep.section === "analytics") {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const tourId of ["analytics-slice-stats", "analytics-visualizations", "analytics-classes"]) {
        if (currentStep.target.includes(tourId)) {
          const tabButton = document.querySelector(`[data-tour="${tourId}"]`) as HTMLElement;
          if (tabButton?.tagName === "BUTTON") {
            tabButton.click();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          break;
        }
      }
    }

    // Handle manifest sub-tab clicks
    if (currentStep.section === "manifest") {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (currentStep.target.includes("manifest-oracle-summary")) {
        const oracleTab = document.querySelector('[data-tour="manifest-tab-oracle"]') as HTMLElement;
        oracleTab?.click();
        await new Promise(resolve => setTimeout(resolve, 350));
      } else if (
        currentStep.target.includes("manifest-table") ||
        currentStep.target.includes("manifest-filters-button")
      ) {
        const manifestTab = document.querySelector('[data-tour="manifest-tab-interactive"]') as HTMLElement;
        manifestTab?.click();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Find target element
    const target = await findElement(currentStep.target);
    
    if (!target || currentStep.target === "body") {
      // Center tooltip for body or missing elements
      setElement(null);
      setPosition({
        top: window.innerHeight / 2 - 125 + window.scrollY,
        left: (window.innerWidth - tooltipWidthFor(window.innerWidth)) / 2,
      });
      setIsTransitioning(false);
      return;
    }

    setElement(target);

    // Boost z-index of target element - MUCH HIGHER for fixed position elements
    const originalZIndex = target.style.zIndex;
    const originalPosition = target.style.position;
    const computedStyle = window.getComputedStyle(target);
    const isFixedOrAbsolute = computedStyle.position === "fixed" || computedStyle.position === "absolute";
    
    // Use very high z-index for fixed/absolute elements to be above overlay
    target.style.zIndex = isFixedOrAbsolute ? "10000" : "1001";
    if (!originalPosition || originalPosition === "static") {
      target.style.position = "relative";
    }

    // Store original values for cleanup
    (target as any).__tourOriginalZIndex = originalZIndex;
    (target as any).__tourOriginalPosition = originalPosition;

    // Scroll into view
    target.scrollIntoView({ 
      behavior: "smooth", 
      block: "center",
      inline: "center"
    });

    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Calculate and set position
    const pos = calculatePosition(target, currentStep.position || "bottom");
    setPosition(pos);
    
    setIsTransitioning(false);
  };

  // Update on step change
  useEffect(() => {
    if (!isOpen) return;
    
    // Cleanup previous element
    if (element) {
      const prevElement = element;
      if ((prevElement as any).__tourOriginalZIndex !== undefined) {
        prevElement.style.zIndex = (prevElement as any).__tourOriginalZIndex;
      }
      if ((prevElement as any).__tourOriginalPosition !== undefined) {
        prevElement.style.position = (prevElement as any).__tourOriginalPosition;
      }
    }
    
    updateTargetElement();
  }, [isOpen, step]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      // Cleanup element styles
      if (element) {
        if ((element as any).__tourOriginalZIndex !== undefined) {
          element.style.zIndex = (element as any).__tourOriginalZIndex;
        }
        if ((element as any).__tourOriginalPosition !== undefined) {
          element.style.position = (element as any).__tourOriginalPosition;
        }
      }
      
      setStep(0);
      setElement(null);
      setIsTransitioning(false);
      onNavHighlight?.(false);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem("asr-tour-completed", "true");
      onClose();
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  const handleSkip = () => {
    localStorage.setItem("asr-tour-completed", "true");
    onClose();
  };

  if (!isOpen || !currentStep) return null;

  const hasSpotlight = element && currentStep.target !== "body";
  const padding = currentStep.highlightPadding || 8;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 transition-all duration-500"
        style={{ zIndex: 998 }}
      />

      {/* Spotlight */}
      {hasSpotlight && (() => {
        const rect = element.getBoundingClientRect();
        const isFixed = window.getComputedStyle(element).position === "fixed";
        const top = (isFixed ? rect.top : rect.top + window.scrollY) - padding;
        const left = (isFixed ? rect.left : rect.left + window.scrollX) - padding;

        return (
          <>
            {/* Bright highlight border */}
            <div
              className="fixed pointer-events-none transition-all duration-500 rounded-xl"
              style={{
                top: top - 4,
                left: left - 4,
                width: element.offsetWidth + padding * 2 + 8,
                height: element.offsetHeight + padding * 2 + 8,
                border: "4px solid rgba(99, 102, 241, 0.8)",
                boxShadow: `
                  0 0 0 2px rgba(255, 255, 255, 0.3),
                  0 0 30px rgba(99, 102, 241, 0.6),
                  inset 0 0 0 2px rgba(255, 255, 255, 0.2)
                `,
                zIndex: 10001,
              }}
            />
            {/* Pulse glow effect */}
            <div
              className="fixed pointer-events-none animate-pulse rounded-xl"
              style={{
                top: top - 8,
                left: left - 8,
                width: element.offsetWidth + padding * 2 + 16,
                height: element.offsetHeight + padding * 2 + 16,
                border: "2px solid rgba(99, 102, 241, 0.4)",
                boxShadow: "0 0 40px rgba(99, 102, 241, 0.5)",
                zIndex: 10000,
              }}
            />
          </>
        );
      })()}

      {/* Tooltip */}
      <div
        ref={cardRef}
        className={`
          reson-guided-tour-card fixed w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl 
          border-2 border-indigo-500/30 overflow-hidden
          transition-all duration-500
          ${isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}
        `}
        style={{
          top: position.top,
          left: position.left,
          zIndex: 10002,
        }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 p-5 text-white">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Закрыть тур"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="pr-10">
            <div className="text-xs uppercase tracking-wide opacity-90 mb-1.5">
              Шаг {step + 1} из {TOUR_STEPS.length}
            </div>
            <h3 className="text-xl font-semibold leading-tight">
              {currentStep.title}
            </h3>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-indigo-100 dark:bg-indigo-950">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            {currentStep.content}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Пропустить
          </Button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg"
            >
              {isLast ? (
                <>
                  Завершить
                  <Check className="w-4 h-4" />
                </>
              ) : (
                <>
                  Далее
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}