import { createPortal } from 'react-dom';
import { ChevronDown, X } from '../icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  RESON_ANALYTICS_SLICE_PANEL_BOX,
  RESON_ANALYTICS_SLICE_SELECT_CONTENT,
  RESON_ANALYTICS_SLICE_SELECT_TRIGGER,
  RESON_ANALYTICS_SUBTITLE,
  resonAnalyticsComparisonChipClass,
} from '../../styles/reportStyles';
import type {
  AnalyticsSliceFilters,
  SliceDurationFilter,
} from '../../utils/analyticsSlice';

interface SliceFilterModalProps {
  open: boolean;
  isDark: boolean;
  durationFilter: SliceDurationFilter;
  modelComparisonFilter: AnalyticsSliceFilters['modelComparisonFilter'];
  selectedModelForComparison: string | null;
  selectedModels: string[];
  getModelDisplayName: (modelName: string) => string;
  onDurationChange: (value: SliceDurationFilter) => void;
  onModelComparisonChange: (patch: Partial<AnalyticsSliceFilters>) => void;
  onClose: () => void;
}

export function SliceFilterModal({
  open,
  isDark,
  durationFilter,
  modelComparisonFilter,
  selectedModelForComparison,
  selectedModels,
  getModelDisplayName,
  onDurationChange,
  onModelComparisonChange,
  onClose,
}: SliceFilterModalProps) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <div className="reson-slice-filter-overlay" onClick={onClose} aria-hidden="true" />

      <div
        className="reson-slice-filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slice-filter-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="reson-slice-filter-modal-header">
          <div>
            <h3 id="slice-filter-title" className={isDark ? 'text-white' : 'text-gray-900'}>
              Фильтр среза
            </h3>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Фильтры применяются к вкладкам «Срез» и «Кластеры сложности». Сводка по датасету не
              меняется.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`reson-slice-filter-modal-close ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="reson-slice-filter-modal-body space-y-4">
          <div>
            <label className={`reson-slice-filter-label ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Тип длительности
            </label>
            <div className="relative">
              <select
                value={durationFilter}
                onChange={(event) =>
                  onDurationChange(event.target.value as SliceDurationFilter)
                }
                className={`reson-slice-filter-select ${isDark ? 'reson-slice-filter-select--dark' : ''}`}
              >
                <option value="all">Все длительности</option>
                <option value="short">Короткие (до 5 сек)</option>
                <option value="normal">Средние (5–30 сек)</option>
                <option value="long">Длинные (30+ сек)</option>
              </select>
              <ChevronDown
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              />
            </div>
          </div>

          {selectedModels.length >= 2 && (
            <div className="space-y-3">
              <label className={`reson-slice-filter-label ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Сравнение моделей
              </label>

              <Select
                value={selectedModelForComparison || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    onModelComparisonChange({
                      selectedModelForComparison: null,
                      modelComparisonFilter: 'all',
                    });
                  } else {
                    onModelComparisonChange({ selectedModelForComparison: value });
                  }
                }}
              >
                <SelectTrigger className={RESON_ANALYTICS_SLICE_SELECT_TRIGGER}>
                  <SelectValue placeholder="Выберите модель" />
                </SelectTrigger>
                <SelectContent className={RESON_ANALYTICS_SLICE_SELECT_CONTENT}>
                  <SelectItem value="none">Не выбрано</SelectItem>
                  {selectedModels.map((modelName) => (
                    <SelectItem key={modelName} value={modelName}>
                      {getModelDisplayName(modelName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedModelForComparison && (
                <div className={`${RESON_ANALYTICS_SLICE_PANEL_BOX} p-4 space-y-3`}>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'all' as const, label: 'Все', dot: 'bg-gray-500' },
                      { id: 'best' as const, label: 'Лучшая', dot: 'bg-green-500' },
                      { id: 'worst' as const, label: 'Худшая', dot: 'bg-red-500' },
                    ]).map((option) => {
                      const isActive = modelComparisonFilter === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            onModelComparisonChange({ modelComparisonFilter: option.id })
                          }
                          className={resonAnalyticsComparisonChipClass(option.id, isActive)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${option.dot}`}
                            />
                            <span className="text-[10px] font-medium leading-tight">
                              {option.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className={`text-[11px] ${RESON_ANALYTICS_SUBTITLE}`}>
                    Лучшая — единственный минимальный WER на примере; худшая — единственный
                    максимальный. Ничьи исключаются.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="reson-slice-filter-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className={`reson-slice-filter-apply ${isDark ? 'reson-slice-filter-apply--dark' : ''}`}
          >
            Готово
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
