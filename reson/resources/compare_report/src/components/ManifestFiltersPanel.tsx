import React from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown } from "./icons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { RangeSlider } from "./ui/range-slider";
import { HelpHint } from "./ui/HelpHint";
import {
  RESON_ANALYTICS_INNER_CARD,
  RESON_ANALYTICS_METRIC_VALUE,
  RESON_ANALYTICS_SLICE_PANEL_BOX,
  RESON_ANALYTICS_SLICE_PANEL_DIVIDER,
  RESON_ANALYTICS_SLICE_PANEL_LABEL,
  RESON_ANALYTICS_SLICE_PANEL_SECTION_TITLE,
  RESON_ANALYTICS_SLICE_PANEL_SUBLABEL,
  RESON_ANALYTICS_SLICE_SELECT_CONTENT,
  RESON_ANALYTICS_SLICE_SELECT_TRIGGER,
  RESON_ANALYTICS_SUBTITLE,
  RESON_ANALYTICS_FILTER_SELECT,
  RESON_ANALYTICS_SLICE_CHIP_DOT_ACTIVE,
  RESON_MANIFEST_ACTIVE_FILTER_TAG,
  RESON_MANIFEST_SLICE_CHIP,
  RESON_MANIFEST_DIFFICULTY_CHIP_ALL_ACTIVE,
  RESON_MANIFEST_SLICE_PANEL_ACTION,
  resonAnalyticsComparisonChipClass,
} from "../styles/reportStyles";
import { type DifficultyClass } from "../utils/manifestHelpers";
import {
  type SliceDurationFilter,
  type SliceModelComparisonFilter,
} from "../utils/analyticsSlice";

type ErrorFilter = "all" | "with_errors" | "no_errors";

interface ModelResults {
  modelName: string;
  displayName: string;
}

interface ManifestFiltersPanelProps {
  isDark: boolean;
  onClose: () => void;
  stats: {
    totalSamples: number;
    classifiableSamples: number;
    difficultyStats: Record<DifficultyClass, number>;
  };
  activeFilterCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  durationFilter: SliceDurationFilter;
  onDurationFilterChange: (value: SliceDurationFilter) => void;
  errorFilter: ErrorFilter;
  setErrorFilter: (value: ErrorFilter) => void;
  difficultyFilter: DifficultyClass | "all";
  setDifficultyFilter: (value: DifficultyClass | "all") => void;
  werRange: [number, number] | null;
  setWerRange: (value: [number, number] | null) => void;
  werMin: number;
  werMax: number;
  stdDevRange: [number, number] | null;
  setStdDevRange: (value: [number, number] | null) => void;
  stdDevMin: number;
  stdDevMax: number;
  modelComparisonFilter: SliceModelComparisonFilter;
  onModelComparisonFilterChange: (value: SliceModelComparisonFilter) => void;
  selectedModelForComparison: string | null;
  onSelectedModelForComparisonChange: (value: string | null) => void;
  modelResults: ModelResults[];
  clearFilters: () => void;
}

const DIFFICULTY_CLUSTERS: {
  id: DifficultyClass;
  label: string;
  subtitle: string;
  dot: string;
}[] = [
  { id: "easy-consensus", label: "Легко + Консенсус", subtitle: "WER ≤ медианы, модели согласны", dot: "bg-green-500" },
  { id: "easy-divergent", label: "Легко + Расхождение", subtitle: "WER ≤ медианы, модели расходятся", dot: "bg-yellow-500" },
  { id: "hard-consensus", label: "Сложно + Консенсус", subtitle: "WER > медианы, модели согласны", dot: "bg-orange-500" },
  { id: "hard-divergent", label: "Сложно + Расхождение", subtitle: "WER > медианы, модели расходятся", dot: "bg-red-500" },
];

const SLICE_DIFFICULTY_CARDS: {
  key: DifficultyClass;
  label: string;
  dot: string;
}[] = [
  { key: "easy-consensus", label: "Легко + Согласие", dot: "bg-green-500" },
  { key: "easy-divergent", label: "Легко + Расхождение", dot: "bg-yellow-500" },
  { key: "hard-consensus", label: "Сложно + Согласие", dot: "bg-orange-500" },
  { key: "hard-divergent", label: "Сложно + Расхождение", dot: "bg-red-500" },
];

const ACTIVE_FILTER_TAG = RESON_MANIFEST_ACTIVE_FILTER_TAG;

const DIFFICULTY_ACTIVE_CLASS: Record<DifficultyClass, string> = {
  "easy-consensus": "reson-manifest-slice-chip reson-manifest-difficulty-chip--active reson-manifest-difficulty-chip--easy-consensus",
  "easy-divergent": "reson-manifest-slice-chip reson-manifest-difficulty-chip--active reson-manifest-difficulty-chip--easy-divergent",
  "hard-consensus": "reson-manifest-slice-chip reson-manifest-difficulty-chip--active reson-manifest-difficulty-chip--hard-consensus",
  "hard-divergent": "reson-manifest-slice-chip reson-manifest-difficulty-chip--active reson-manifest-difficulty-chip--hard-divergent",
};

function difficultyChipClass(id: DifficultyClass | "all", active: boolean): string {
  if (!active) return RESON_MANIFEST_SLICE_CHIP;
  if (id === "all") return RESON_MANIFEST_DIFFICULTY_CHIP_ALL_ACTIVE;
  return DIFFICULTY_ACTIVE_CLASS[id];
}

export function ManifestFiltersPanel({
  isDark,
  onClose,
  stats,
  activeFilterCount,
  searchQuery,
  setSearchQuery,
  durationFilter,
  onDurationFilterChange,
  errorFilter,
  setErrorFilter,
  difficultyFilter,
  setDifficultyFilter,
  werRange,
  setWerRange,
  werMin,
  werMax,
  stdDevRange,
  setStdDevRange,
  stdDevMin,
  stdDevMax,
  modelComparisonFilter,
  onModelComparisonFilterChange,
  selectedModelForComparison,
  onSelectedModelForComparisonChange,
  modelResults,
  clearFilters,
}: ManifestFiltersPanelProps) {
  const hasActiveSliceFilters =
    durationFilter !== "all" ||
    errorFilter !== "all" ||
    difficultyFilter !== "all" ||
    werRange ||
    stdDevRange;

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div
        className="reson-slice-filter-overlay animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="reson-manifest-filter-modal animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manifest-filter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reson-slice-filter-modal-header">
          <div>
            <h3 id="manifest-filter-title" className={isDark ? "text-white" : "text-gray-900"}>
              Фильтры манифеста
            </h3>
            <p className={isDark ? "text-gray-400" : "text-gray-600"}>
              Настройте срез для интерактивного манифеста и Oracle WER. Закрыть —{" "}
              <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-gray-200 dark:border-[#2A2D35] bg-gray-50 dark:bg-[#23262F]">
                ESC
              </kbd>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`reson-slice-filter-modal-close ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="reson-manifest-filter-modal-body">
          <div className="space-y-5" data-tour="manifest-filters">
              <div className="flex items-center justify-between">
                <h4 className={RESON_ANALYTICS_SLICE_PANEL_SECTION_TITLE}>Параметры среза</h4>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-orange-500 hover:underline"
                >
                  Сбросить все
                </button>
              </div>

              <div>
                <Label className={RESON_ANALYTICS_SLICE_PANEL_LABEL}>Поиск</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
                  <Input
                    placeholder="Текст, ID или путь..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-9 h-10 ${RESON_ANALYTICS_SLICE_SELECT_TRIGGER}`}
                  />
                </div>
              </div>

              <div>
                <Label className={RESON_ANALYTICS_SLICE_PANEL_LABEL}>Длительность</Label>
                <div className="relative">
                  <select
                    value={durationFilter}
                    onChange={(e) =>
                      onDurationFilterChange(e.target.value as SliceDurationFilter)
                    }
                    className={RESON_ANALYTICS_FILTER_SELECT}
                  >
                    <option value="all">Все длительности</option>
                    <option value="short">Короткие (до 5 сек)</option>
                    <option value="normal">Средние (5–30 сек)</option>
                    <option value="long">Длинные (30+ сек)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" />
                </div>
              </div>

              <div>
                <Label className={RESON_ANALYTICS_SLICE_PANEL_LABEL}>Записи</Label>
                <div className="relative">
                  <select
                    value={errorFilter}
                    onChange={(e) => setErrorFilter(e.target.value as ErrorFilter)}
                    className={RESON_ANALYTICS_FILTER_SELECT}
                  >
                    <option value="all">Все записи</option>
                    <option value="with_errors">С ошибками</option>
                    <option value="no_errors">Без ошибок</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-60" />
                </div>
              </div>

              {modelResults.length >= 2 && (
                <div className="space-y-3" data-tour="manifest-difficulty-filter">
                  <div className="flex items-center gap-2">
                    <Label className={RESON_ANALYTICS_SLICE_PANEL_LABEL}>Класс сложности</Label>
                    <HelpHint ariaLabel="Что такое класс сложности" side="left" align="start">
                      <p>
                        Каждый пример относится к одному из четырёх квадрантов по двум осям:
                        средний WER на примере и σ (расхождение WER между моделями). Пороги —
                        медианы по текущему срезу (выбранные модели и фильтр длительности).
                      </p>
                      <p className="mt-2">
                        <strong>Легко + Консенсус:</strong> WER ≤ медианы, σ ≤ медианы.
                        <br />
                        <strong>Легко + Расхождение:</strong> WER ≤ медианы, σ &gt; медианы.
                        <br />
                        <strong>Сложно + Консенсус:</strong> WER &gt; медианы, σ ≤ медианы.
                        <br />
                        <strong>Сложно + Расхождение:</strong> WER &gt; медианы, σ &gt; медианы.
                      </p>
                    </HelpHint>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDifficultyFilter("all")}
                    className={`w-full ${difficultyChipClass("all", difficultyFilter === "all")}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          difficultyFilter === "all" ? "bg-amber-500" : "bg-gray-400"
                        }`}
                      />
                      <span className="text-xs font-medium">Все классы сложности</span>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {DIFFICULTY_CLUSTERS.map((option) => {
                      const isActive = difficultyFilter === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setDifficultyFilter(option.id)}
                          className={difficultyChipClass(option.id, isActive)}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${option.dot}`} />
                            <span className="text-[10px] font-medium leading-tight">{option.label}</span>
                          </div>
                          <p className={`text-[9px] leading-tight ${isActive ? "opacity-90" : RESON_ANALYTICS_SUBTITLE}`}>
                            {option.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <p className={`text-[11px] ${RESON_ANALYTICS_SUBTITLE}`}>
                    Классификация совпадает с квадрантами «Кластеры сложности» в Аналитике
                    (медианы WER на примере и σ между моделями).
                  </p>
                </div>
              )}

              {modelResults.length >= 1 && (
                <div className="space-y-3">
                  <Label className={RESON_ANALYTICS_SLICE_PANEL_LABEL}>Диапазонные фильтры</Label>

                  <div className={`${RESON_ANALYTICS_SLICE_PANEL_BOX} p-4 space-y-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`${RESON_ANALYTICS_SLICE_PANEL_SUBLABEL} mb-0`}>WER</span>
                        <HelpHint ariaLabel="Как считается WER в фильтре" side="top" align="start">
                          <p>
                            Фильтр оставляет только те примеры, у которых средний WER по
                            выбранным моделям попадает в заданный диапазон.
                          </p>
                          <p className="mt-2">
                            <strong>Формула:</strong> WER<sub>пример</sub> = (WER₁ + WER₂ + … +
                            WER<sub>n</sub>) / n, где n — число выбранных моделей с результатом
                            на этом примере.
                          </p>
                        </HelpHint>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs tabular-nums font-medium px-2 py-1 rounded-md ${RESON_ANALYTICS_SLICE_PANEL_BOX}`}>
                          {werRange
                            ? `${werRange[0].toFixed(1)}% – ${werRange[1].toFixed(1)}%`
                            : `${werMin.toFixed(1)}% – ${werMax.toFixed(1)}%`}
                        </span>
                        {werRange && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setWerRange(null)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <RangeSlider
                      min={werMin}
                      max={werMax}
                      step={0.1}
                      value={werRange || [werMin, werMax]}
                      onValueChange={(value) => setWerRange(value)}
                      className="py-1"
                    />
                    <p className={`text-[11px] ${RESON_ANALYTICS_SUBTITLE}`}>
                      Среднее WER по всем выбранным моделям на каждом примере; ползунок задаёт
                      допустимый интервал значений.
                    </p>
                  </div>

                  {modelResults.length >= 2 && (
                    <div className={`${RESON_ANALYTICS_SLICE_PANEL_BOX} p-4 space-y-3`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`${RESON_ANALYTICS_SLICE_PANEL_SUBLABEL} mb-0`}>
                            Расхождение (σ)
                          </span>
                          <HelpHint ariaLabel="Как считается расхождение" side="top" align="start">
                            <p>
                              Фильтр оставляет примеры, у которых σ — стандартное отклонение WER
                              между выбранными моделями — попадает в диапазон.
                            </p>
                            <p className="mt-2">
                              <strong>Формула:</strong> σ = √(Σ(WER<sub>i</sub> −
                              WER<sub>сред</sub>)² / n). Чем выше σ, тем сильнее модели расходятся
                              на этом примере.
                            </p>
                          </HelpHint>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs tabular-nums font-medium px-2 py-1 rounded-md ${RESON_ANALYTICS_SLICE_PANEL_BOX}`}>
                            {stdDevRange
                              ? `${stdDevRange[0].toFixed(1)}% – ${stdDevRange[1].toFixed(1)}%`
                              : `${stdDevMin.toFixed(1)}% – ${stdDevMax.toFixed(1)}%`}
                          </span>
                          {stdDevRange && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setStdDevRange(null)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <RangeSlider
                        min={stdDevMin}
                        max={stdDevMax}
                        step={0.1}
                        value={stdDevRange || [stdDevMin, stdDevMax]}
                        onValueChange={(value) => setStdDevRange(value)}
                        className="py-1"
                      />
                      <p className={`text-[11px] ${RESON_ANALYTICS_SUBTITLE}`}>
                        σ показывает разброс WER между моделями на одном примере; доступно при
                        двух и более выбранных моделях.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {modelResults.length >= 2 && (
                <div className="space-y-3">
                  <Label className={RESON_ANALYTICS_SLICE_PANEL_LABEL}>Сравнение моделей</Label>

                  <div className={`${RESON_ANALYTICS_SLICE_PANEL_BOX} p-4 space-y-3`}>
                    <Label className={RESON_ANALYTICS_SLICE_PANEL_SUBLABEL}>Выберите модель</Label>
                    <Select
                      value={selectedModelForComparison || "none"}
                      onValueChange={(value) => {
                        if (value === "none") {
                          onSelectedModelForComparisonChange(null);
                          onModelComparisonFilterChange("all");
                        } else {
                          onSelectedModelForComparisonChange(value);
                        }
                      }}
                    >
                      <SelectTrigger className={RESON_ANALYTICS_SLICE_SELECT_TRIGGER}>
                        <SelectValue placeholder="Выберите модель" />
                      </SelectTrigger>
                      <SelectContent className={RESON_ANALYTICS_SLICE_SELECT_CONTENT}>
                        <SelectItem value="none">Не выбрано</SelectItem>
                        {modelResults.map((model) => (
                          <SelectItem key={model.modelName} value={model.modelName}>
                            {model.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedModelForComparison && (
                    <div className={`${RESON_ANALYTICS_SLICE_PANEL_BOX} p-4 space-y-3`}>
                      <Label className={RESON_ANALYTICS_SLICE_PANEL_SUBLABEL}>Тип сравнения</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: "all" as const, label: "Все примеры", dot: "bg-gray-500" },
                            { id: "best" as const, label: "Лучшая модель", dot: "bg-green-500" },
                            { id: "worst" as const, label: "Худшая модель", dot: "bg-red-500" },
                          ] as const
                        ).map((option) => {
                          const isActive = modelComparisonFilter === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => onModelComparisonFilterChange(option.id)}
                              className={resonAnalyticsComparisonChipClass(option.id, isActive)}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isActive ? RESON_ANALYTICS_SLICE_CHIP_DOT_ACTIVE : option.dot
                                  }`}
                                />
                                <span className="text-[10px] font-medium leading-tight">{option.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className={`text-[11px] ${RESON_ANALYTICS_SUBTITLE}`}>
                        Лучшая — единственный минимальный WER; худшая — единственный
                        максимальный WER; ничьи исключаются
                      </p>
                    </div>
                  )}
                </div>
              )}

              {modelResults.length >= 2 && (
                <div className={`space-y-3 pt-2 ${RESON_ANALYTICS_SLICE_PANEL_DIVIDER}`}>
                  <h4 className={RESON_ANALYTICS_SLICE_PANEL_SECTION_TITLE}>Результаты среза</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {SLICE_DIFFICULTY_CARDS.map((card) => (
                      <div key={card.key} className={`${RESON_ANALYTICS_INNER_CARD} p-3`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`w-2 h-2 rounded-full ${card.dot}`} />
                          <span className={`text-xs ${RESON_ANALYTICS_SUBTITLE}`}>{card.label}</span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-xl font-semibold tabular-nums ${RESON_ANALYTICS_METRIC_VALUE}`}>
                            {stats.difficultyStats[card.key]}
                          </span>
                          <span className={`text-xs tabular-nums ${RESON_ANALYTICS_SUBTITLE}`}>
                            (
                            {stats.classifiableSamples > 0
                              ? ((stats.difficultyStats[card.key] / stats.classifiableSamples) * 100).toFixed(1)
                              : 0}
                            %)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasActiveSliceFilters && (
                    <div className="space-y-2">
                      <Label className={RESON_ANALYTICS_SLICE_PANEL_SUBLABEL}>Активные фильтры</Label>
                      <div className="flex flex-wrap gap-2">
                        {durationFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => onDurationFilterChange("all")}
                            className={ACTIVE_FILTER_TAG}
                          >
                            {durationFilter === "short" && "Короткие"}
                            {durationFilter === "normal" && "Средние"}
                            {durationFilter === "long" && "Длинные"}
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {errorFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => setErrorFilter("all")}
                            className={ACTIVE_FILTER_TAG}
                          >
                            {errorFilter === "with_errors" ? "С ошибками" : "Без ошибок"}
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {difficultyFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => setDifficultyFilter("all")}
                            className={ACTIVE_FILTER_TAG}
                          >
                            {DIFFICULTY_CLUSTERS.find((d) => d.id === difficultyFilter)?.label ?? difficultyFilter}
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {werRange && (
                          <button
                            type="button"
                            onClick={() => setWerRange(null)}
                            className={`${ACTIVE_FILTER_TAG} tabular-nums`}
                          >
                            WER {werRange[0].toFixed(1)}–{werRange[1].toFixed(1)}%
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {stdDevRange && (
                          <button
                            type="button"
                            onClick={() => setStdDevRange(null)}
                            className={`${ACTIVE_FILTER_TAG} tabular-nums`}
                          >
                            σ {stdDevRange[0].toFixed(1)}–{stdDevRange[1].toFixed(1)}%
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        <div className="reson-slice-filter-modal-footer">
          <div className="flex items-center justify-between gap-3 mb-3">
            <Badge variant="outline" className="reson-analytics-slice-panel-box">
              {stats.totalSamples} записей
            </Badge>
            {activeFilterCount > 0 && (
              <span className={`text-xs ${RESON_ANALYTICS_SUBTITLE}`}>
                {activeFilterCount} активных фильтров
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className={RESON_MANIFEST_SLICE_PANEL_ACTION}>
            Готово
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
