import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

interface SliceFilterModalProps {
  open: boolean;
  isDark: boolean;
  durationFilter: string;
  werFilter: string;
  onDurationChange: (value: string) => void;
  onWerChange: (value: string) => void;
  onClose: () => void;
}

export function SliceFilterModal({
  open,
  isDark,
  durationFilter,
  werFilter,
  onDurationChange,
  onWerChange,
  onClose,
}: SliceFilterModalProps) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <div
        className="reson-slice-filter-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="reson-slice-filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slice-filter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reson-slice-filter-modal-header">
          <div>
            <h3 id="slice-filter-title" className={isDark ? 'text-white' : 'text-gray-900'}>
              Фильтр среза
            </h3>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Фильтры применяются сразу ко всем графикам вкладки
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
                onChange={(e) => onDurationChange(e.target.value)}
                className={`reson-slice-filter-select ${isDark ? 'reson-slice-filter-select--dark' : ''}`}
              >
                <option value="all">Все длительности</option>
                <option value="short">Короткие (до 5 сек)</option>
                <option value="normal">Средние (5–30 сек)</option>
                <option value="long">Длинные (30+ сек)</option>
              </select>
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
          </div>

          <div>
            <label className={`reson-slice-filter-label ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Критерий WER
            </label>
            <div className="relative">
              <select
                value={werFilter}
                onChange={(e) => onWerChange(e.target.value)}
                className={`reson-slice-filter-select ${isDark ? 'reson-slice-filter-select--dark' : ''}`}
              >
                <option value="all">Все сэмплы</option>
                <option value="low">Низкий WER (&lt;15%)</option>
                <option value="top10">Топ-10% WER</option>
                <option value="p80-90">80-90 перцентиль WER</option>
                <option value="below80">До 80 перцентиля WER</option>
              </select>
              <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
          </div>
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
