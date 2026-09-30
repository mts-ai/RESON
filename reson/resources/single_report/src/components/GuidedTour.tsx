import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import type { TabType } from "../contexts/NavigationContext";

const TOUR_STORAGE_KEY = "reson-single-report-tour-completed";

interface TourStep {
  target: string;
  title: string;
  content: string;
  section?: TabType;
  position?: "top" | "bottom" | "left" | "right";
  highlightPadding?: number;
}

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onSectionChange?: (section: TabType) => void;
  /** Opens the mobile navigation drawer while a step points at the sidebar. */
  onNavHighlight?: (open: boolean) => void;
}

const SIDEBAR_TOUR_TARGET = '[data-tour="sidebar"]';

/** Steps pointing at the sidebar or its nav buttons need the drawer open on mobile. */
function targetsSidebar(target: string): boolean {
  return target === SIDEBAR_TOUR_TARGET || target.endsWith('-nav-button"]');
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "body",
    title: "Добро пожаловать в MWS AI RESON!",
    content:
      "MWS AI RESON помогает понять, почему ASR-модель ошибается: какие слова пропускает, в каких сегментах растёт WER и где слушать конкретные промахи. Тур займёт пару минут и покажет рабочий маршрут от общей картины к точечным исправлениям.",
  },
  {
    target: '[data-tour="sidebar"]',
    title: "С чего начать",
    content:
      "Логика простая: Обзор — оценить качество в целом, Словарь — найти проблемные слова, Аналитика — проверить гипотезы по сегментам, Манифест — разобрать отдельные записи. Тур можно перезапустить внизу меню.",
    position: "right",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="overview-nav-button"]',
    title: "Первый взгляд на модель",
    content:
      "После каждого прогона начинайте здесь: за минуту видно, приемлемо ли качество и куда копать дальше — в словарь, срезы или конкретные примеры.",
    section: "overview",
    position: "right",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="overview-dataset-stats"]',
    title: "Масштаб датасета",
    content:
      "WER 8% на 500 часах и на 5 часах — разные выводы. Размер словаря и алфавита подсказывают, насколько модель «видела» редкие слова и имена в обучении.",
    section: "overview",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="overview-metrics"]',
    title: "WER и MWA",
    content:
      "WER — общая доля ошибок: чем ниже, тем лучше. MWA — насколько хорошо распознаётся словарь. Большой разрыв между ними намекает: проблема не только в отдельных словах, но и в фонетике или сегментации.",
    section: "overview",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="overview-model-profile"]',
    title: "Где модель слабее",
    content:
      "Профиль показывает типичные сценарии провала: короткие команды, длинные записи, шумные условия. Доминируют удаления — модель «молчит»; замены — путает похожие слова. Это подсказка, что менять в данных или постобработке.",
    section: "overview",
    position: "top",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="overview-section-links"]',
    title: "Быстрый старт расследования",
    content:
      "Карточки ведут сразу к нужному срезу — без ручной настройки фильтров. Удобно, когда уже видите аномалию в обзоре и хотите сразу перейти к словам, графикам или примерам.",
    section: "overview",
    position: "top",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-nav-button"]',
    title: "Диагностика на уровне слов",
    content:
      "Большинство улучшений ASR начинается со слов: какие добавить в обучение, какие вынести в словарь или нормализацию. Здесь видно, что именно «тянет» WER вниз.",
    section: "vocabulary",
    position: "right",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-subtabs"]',
    title: "Разные углы на одни данные",
    content:
      "Сводка — тренды и категории, интерактивный словарь — поиск конкретных слов, визуализация — закономерности, ложные друзья — типичные путаницы. Выбирайте инструмент под задачу, а не листайте всё подряд.",
    section: "vocabulary",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-summary-coverage"]',
    title: "Покрытие по типам слов",
    content:
      "Низкий recall у частых слов бьёт по WER сильнее всего. Здесь видно, проваливается ли целая категория — имена, числа, OOV — и можно сразу найти слово и открыть его детализацию.",
    section: "vocabulary",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="vocabulary-analytics-filters"]',
    title: "Приоритетный список исправлений",
    content:
      "Отсортируйте по WIS — получите топ слов, которые стоит чинить первыми: они частые и с серьёзными ошибками. Фильтры помогают собрать выборку для доразметки или дообучения.",
    section: "vocabulary",
    position: "top",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="vocabulary-visualizations"]',
    title: "Системные паттерны",
    content:
      "Графики отвечают на вопрос «это единичные сбои или закономерность?»: короткие слова падают чаще, редкие кластеризуются в зоне низкого recall, Парето показывает, сколько слов дают большую часть ошибок.",
    section: "vocabulary",
    position: "top",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="vocabulary-false-friends"]',
    title: "Ложные друзья",
    content:
      "Пары вроде «пол → пал» не ловятся обычной нормализацией. Список готовых кандидатов для точечного дообучения, работы с правилами или постобработки.",
    section: "vocabulary",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="analytics-nav-button"]',
    title: "От средних к сегментам",
    content:
      "Когда общий WER «нормальный», ошибки часто прячутся в хвосте — длинные звонки, топ-10% WER, определённая длительность. Аналитика помогает найти такие когорты и проверить гипотезу цифрами.",
    section: "analytics",
    position: "right",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="analytics-sticky-bar"]',
    title: "Три режима анализа",
    content:
      "Сводка — базовая линия по всему датасету, не зависит от фильтров. Срез — ваш кастомный набор записей. Распределения — форма ошибок: есть ли «хвост» проблемных сэмплов.",
    section: "analytics",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="analytics-dataset-summary"]',
    title: "Где концентрируются ошибки",
    content:
      "Heatmap сразу показывает сочетания «длительность × перцентиль WER»: например, много удалений в длинных записях с высоким WER. Текстовые инсайты подскажут, куда перейти дальше.",
    section: "analytics",
    position: "bottom",
    highlightPadding: 16,
  },
  {
    target: '[data-tour="analytics-slice-filters"]',
    title: "Проверка гипотез",
    content:
      "Сузьте срез: «длинные + топ-10% WER» или «короткие без ошибок». Счётчики сэмплов и средний WER обновляются мгновенно — видно, подтверждается ли предположение, не выгружая данные.",
    section: "analytics",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="analytics-slice-content"]',
    title: "Доказательства для решения",
    content:
      "Графики среза показывают, какой тип ошибок доминирует и связан ли WER с длительностью. Используйте перед изменением пайплайна: есть цифры — проще обосновать правку данных или модели.",
    section: "analytics",
    position: "top",
    highlightPadding: 16,
  },
  {
    target: '[data-tour="manifest-nav-button"]',
    title: "От метрики к примеру",
    content:
      "Манифест замыкает цикл: нашли аномалию в цифрах — смотрите разницу, копируете пример в тикет или экспортируете выборку команде!",
    section: "manifest",
    position: "right",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="manifest-summary"]',
    title: "Контроль выборки",
    content:
      "Перед разбором записей проверьте масштаб: сколько строк в фильтре, какой у них средний WER, какая доля с ошибками. Метрики RESON Run ниже — эталон для сравнения с отдельными примерами.",
    section: "manifest",
    position: "bottom",
    highlightPadding: 12,
  },
  {
    target: '[data-tour="manifest-filters"]',
    title: "Быстрый поиск экземпляров",
    content:
      "Ищите по тексту или пути, отберите топ WER или только ошибочные, включите отображение разницы в тексте — сразу видно цепочку замен. Настройка столбцов экономит время при регулярном аудите одних и тех же полей.",
    section: "manifest",
    position: "bottom",
    highlightPadding: 8,
  },
  {
    target: '[data-tour="manifest-table"]',
    title: "Разбор и экспорт",
    content:
      "Откройте запись — аудио, эталон, гипотеза и разбивка INS/DEL/SUB в одном месте. Сортировка по WER находит худшие кейсы; CSV/JSON — для отчёта или передачи в дообучение.",
    section: "manifest",
    position: "top",
    highlightPadding: 16,
  },
];

async function findElement(
  selector: string,
  maxAttempts = 24,
): Promise<HTMLElement | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const el = document.querySelector(selector) as HTMLElement;
    // `offsetParent` is always null for fixed elements (the mobile nav drawer),
    // so fall back to client rects to detect that they are rendered.
    if (el && (el.offsetParent !== null || el.getClientRects().length > 0)) {
      return el;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}

const TOOLTIP_MAX_WIDTH = 400;
const TOOLTIP_HEIGHT_ESTIMATE = 300;
const TOOLTIP_GAP = 20;
const TOOLTIP_PADDING = 16;

/** Card shrinks with the viewport so it never overflows a phone screen. */
function tooltipWidth(): number {
  if (typeof window === "undefined") return TOOLTIP_MAX_WIDTH;
  return Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - TOOLTIP_PADDING * 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function rectsOverlap(
  a: { top: number; left: number; width: number; height: number },
  b: DOMRect,
) {
  return !(
    a.left + a.width <= b.left ||
    a.left >= b.right ||
    a.top + a.height <= b.top ||
    a.top >= b.bottom
  );
}

function calculatePosition(
  target: HTMLElement,
  pos: string = "bottom",
  tooltipHeight = TOOLTIP_HEIGHT_ESTIMATE,
): { top: number; left: number } {
  const rect = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = tooltipWidth();

  const placements: Record<string, { top: number; left: number }> = {
    bottom: {
      top: rect.bottom + TOOLTIP_GAP,
      left: rect.left + rect.width / 2 - width / 2,
    },
    top: {
      top: rect.top - tooltipHeight - TOOLTIP_GAP,
      left: rect.left + rect.width / 2 - width / 2,
    },
    right: {
      top: rect.top + rect.height / 2 - tooltipHeight / 2,
      left: rect.right + TOOLTIP_GAP,
    },
    left: {
      top: rect.top + rect.height / 2 - tooltipHeight / 2,
      left: rect.left - width - TOOLTIP_GAP,
    },
  };

  const positions = [pos, "top", "bottom", "right", "left"].filter(
    (p, i, arr) => arr.indexOf(p) === i,
  );

  for (const position of positions) {
    const raw = placements[position];
    if (!raw) continue;

    const left = clamp(raw.left, TOOLTIP_PADDING, vw - width - TOOLTIP_PADDING);
    const top = clamp(
      raw.top,
      TOOLTIP_PADDING,
      vh - tooltipHeight - TOOLTIP_PADDING,
    );

    const tooltipRect = {
      top,
      left,
      width,
      height: tooltipHeight,
    };

    if (!rectsOverlap(tooltipRect, rect)) {
      return { top, left };
    }
  }

  return {
    top: clamp(
      (vh - tooltipHeight) / 2,
      TOOLTIP_PADDING,
      vh - tooltipHeight - TOOLTIP_PADDING,
    ),
    left: clamp(
      (vw - width) / 2,
      TOOLTIP_PADDING,
      vw - width - TOOLTIP_PADDING,
    ),
  };
}

export function GuidedTour({
  isOpen,
  onClose,
  onSectionChange,
  onNavHighlight,
}: GuidedTourProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [step, setStep] = useState(0);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  const cleanupElement = (el: HTMLElement | null) => {
    if (!el) return;
    if ((el as HTMLElement & { __tourOriginalZIndex?: string }).__tourOriginalZIndex !== undefined) {
      el.style.zIndex = (el as HTMLElement & { __tourOriginalZIndex?: string }).__tourOriginalZIndex ?? "";
    }
    if ((el as HTMLElement & { __tourOriginalPosition?: string }).__tourOriginalPosition !== undefined) {
      el.style.position = (el as HTMLElement & { __tourOriginalPosition?: string }).__tourOriginalPosition ?? "";
    }
  };

  const clickTourTab = async (selector: string) => {
    const tabButton = document.querySelector(selector) as HTMLElement;
    if (tabButton?.tagName === "BUTTON") {
      tabButton.click();
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  };

  const updateTargetElement = async () => {
    if (!currentStep) return;

    setIsTransitioning(true);

    if (currentStep.section && onSectionChange) {
      onSectionChange(currentStep.section);
      await new Promise((resolve) => setTimeout(resolve, currentStep.section === "analytics" || currentStep.section === "manifest" ? 600 : 400));
    }

    if (onNavHighlight) {
      onNavHighlight(targetsSidebar(currentStep.target));
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (currentStep.section === "vocabulary") {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (currentStep.target.includes("vocabulary-summary")) {
        await clickTourTab('[data-tour="vocabulary-tab-summary"]');
      } else if (currentStep.target.includes("vocabulary-analytics")) {
        await clickTourTab('[data-tour="vocabulary-tab-analytics"]');
      } else if (currentStep.target.includes("vocabulary-visualizations")) {
        await clickTourTab('[data-tour="vocabulary-tab-visualizations"]');
      } else if (currentStep.target.includes("vocabulary-false-friends")) {
        await clickTourTab('[data-tour="vocabulary-tab-false-friends"]');
      }
    }

    if (currentStep.section === "analytics") {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (currentStep.target.includes("analytics-dataset")) {
        await clickTourTab('[data-tour="analytics-tab-dataset"]');
      } else if (
        currentStep.target.includes("analytics-slice-filters") ||
        currentStep.target.includes("analytics-slice-content")
      ) {
        await clickTourTab('[data-tour="analytics-tab-slice"]');
      }
    }

    const target = await findElement(currentStep.target);

    if (!target || currentStep.target === "body") {
      setElement(null);
      setPosition({
        top: Math.max(
          TOOLTIP_PADDING,
          (window.innerHeight - TOOLTIP_HEIGHT_ESTIMATE) / 2,
        ),
        left: Math.max(
          TOOLTIP_PADDING,
          (window.innerWidth - tooltipWidth()) / 2,
        ),
      });
      setIsTransitioning(false);
      return;
    }

    setElement(target);

    const originalZIndex = target.style.zIndex;
    const originalPosition = target.style.position;
    const computedStyle = window.getComputedStyle(target);
    const isFixedOrAbsolute =
      computedStyle.position === "fixed" ||
      computedStyle.position === "absolute";

    target.style.zIndex = isFixedOrAbsolute ? "10000" : "1001";
    if (!originalPosition || originalPosition === "static") {
      target.style.position = "relative";
    }

    (target as HTMLElement & { __tourOriginalZIndex?: string }).__tourOriginalZIndex = originalZIndex;
    (target as HTMLElement & { __tourOriginalPosition?: string }).__tourOriginalPosition = originalPosition;

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    setPosition(calculatePosition(target, currentStep.position || "bottom"));
    setIsTransitioning(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    cleanupElement(element);
    updateTargetElement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step]);

  useLayoutEffect(() => {
    if (!isOpen || !element || !tooltipRef.current || currentStep.target === "body") {
      return;
    }

    const tooltipHeight = tooltipRef.current.offsetHeight;
    setPosition(
      calculatePosition(
        element,
        currentStep.position || "bottom",
        tooltipHeight,
      ),
    );
  }, [isOpen, step, element, isTransitioning, currentStep]);

  useEffect(() => {
    if (!isOpen) {
      cleanupElement(element);
      setStep(0);
      setElement(null);
      setIsTransitioning(false);
      onNavHighlight?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const finishTour = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
    onClose();
  };

  const handleNext = () => {
    if (isLast) finishTour();
    else setStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (!isFirst) setStep((s) => s - 1);
  };

  if (!isOpen || !currentStep) return null;

  const hasSpotlight = element && currentStep.target !== "body";
  const padding = currentStep.highlightPadding || 8;

  const cardTheme = isDark
    ? "reson-guided-tour-card--dark"
    : "reson-guided-tour-card--light";
  const bodyTheme = isDark
    ? "reson-guided-tour-body--dark"
    : "reson-guided-tour-body--light";
  const ghostTheme = isDark
    ? "reson-guided-tour-btn-ghost--dark"
    : "reson-guided-tour-btn-ghost--light";
  const outlineTheme = isDark
    ? "reson-guided-tour-btn-outline--dark"
    : "reson-guided-tour-btn-outline--light";

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 transition-all duration-500"
        style={{ zIndex: 998 }}
      />

      {hasSpotlight &&
        (() => {
          const rect = element.getBoundingClientRect();
          const top = rect.top - padding;
          const left = rect.left - padding;

          return (
            <>
              <div
                className="fixed pointer-events-none transition-all duration-500 rounded-xl"
                style={{
                  top: top - 4,
                  left: left - 4,
                  width: element.offsetWidth + padding * 2 + 8,
                  height: element.offsetHeight + padding * 2 + 8,
                  border: "4px solid rgba(99, 102, 241, 0.8)",
                  boxShadow:
                    "0 0 0 2px rgba(255, 255, 255, 0.3), 0 0 30px rgba(99, 102, 241, 0.6), inset 0 0 0 2px rgba(255, 255, 255, 0.2)",
                  zIndex: 10001,
                }}
              />
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

      <div
        ref={tooltipRef}
        className={`reson-guided-tour-card fixed transition-all duration-500 ${cardTheme} ${
          isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        style={{
          top: position.top,
          left: position.left,
          zIndex: 10002,
          maxHeight: `calc(100vh - ${TOOLTIP_PADDING * 2}px)`,
          overflowY: "auto",
        }}
      >
        <div className="reson-guided-tour-header">
          <button
            type="button"
            onClick={finishTour}
            className="reson-guided-tour-close"
            aria-label="Закрыть тур"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="pr-10">
            <div className="reson-guided-tour-step">
              Шаг {step + 1} из {TOUR_STEPS.length}
            </div>
            <h3 className="reson-guided-tour-title">{currentStep.title}</h3>
          </div>
        </div>

        <div className="reson-guided-tour-progress-track">
          <div
            className="reson-guided-tour-progress-fill"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className={`reson-guided-tour-body ${bodyTheme}`}>
          <p>{currentStep.content}</p>
        </div>

        <div className="reson-guided-tour-footer">
          <button
            type="button"
            onClick={finishTour}
            className={`reson-guided-tour-btn-ghost ${ghostTheme}`}
          >
            Пропустить
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                className={`reson-guided-tour-btn-outline ${outlineTheme}`}
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="reson-guided-tour-btn-primary"
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
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
