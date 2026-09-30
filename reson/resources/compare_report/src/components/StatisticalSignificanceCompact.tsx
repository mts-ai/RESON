import { CheckCircle2, XCircle, AlertCircle, HelpCircle } from './icons';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP,
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_DESC,
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_NOT_SIGNIFICANT,
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_SIGNIFICANT,
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_TITLE,
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUTS,
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_DESC,
  RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_TITLE,
  RESON_PANEL_CLASS,
} from '../styles/reportStyles';

interface StatisticalSignificanceCompactProps {
  data: {
    isSignificant: boolean;
    pValue: number;
    alpha: number;
    confidenceInterval: number;
    lowerBound: number;
    upperBound: number;
  } | null | undefined;
}

export function StatisticalSignificanceCompact({ data }: StatisticalSignificanceCompactProps) {
  if (!data) {
    return (
      <div className={`${RESON_PANEL_CLASS} p-6 flex flex-col items-center justify-center flex-1 w-full min-h-[280px]`}>
        <AlertCircle className="w-10 h-10 text-gray-400 mb-3" />
        <h3 className="text-sm font-medium text-center mb-2">Анализ недоступен</h3>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 max-w-xs">
          Для выбранной пары моделей данные статистического анализа отсутствуют
        </p>
        <p className="text-xs text-center text-gray-400 mt-4 pt-4 border-t border-border w-full">
          Статистический анализ выполняется на бэкэнде
        </p>
      </div>
    );
  }

  const accent = data.isSignificant
    ? 'border-l-green-500'
    : 'border-l-red-500';

  return (
    <div className={`${RESON_PANEL_CLASS} p-6 flex flex-col flex-1 w-full min-h-[280px] border-l-4 ${accent}`}>
      <div className="flex flex-col items-center mb-6">
        <div className="mb-4">
          {data.isSignificant ? (
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          ) : (
            <XCircle className="w-12 h-12 text-red-500" />
          )}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium text-center">
            {data.isSignificant
              ? 'Статистически значимо'
              : 'Статистически незначимо'}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="p-1 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors focus:outline-none"
                aria-label="Подробнее о статистической значимости"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="left"
              sideOffset={6}
              className="border-0 bg-transparent p-0 shadow-none max-w-md text-inherit [&>svg]:hidden"
            >
              <div className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP}>
                <p className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_TITLE}>
                  Статистическая значимость
                </p>
                <p className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_DESC}>
                  Показывает, являются ли различия между моделями реальными или случайными.
                </p>
                <div className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUTS}>
                  <div className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_SIGNIFICANT}>
                    <p className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_TITLE}>
                      Значимо (p &lt; 0.05)
                    </p>
                    <p className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_DESC}>
                      Изменения достоверны с 95% уверенностью.
                    </p>
                  </div>
                  <div className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_NOT_SIGNIFICANT}>
                    <p className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_TITLE}>
                      Не значимо (p ≥ 0.05)
                    </p>
                    <p className={RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_DESC}>
                      Различия могут быть случайными.
                    </p>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <p className="text-sm text-center text-gray-500 dark:text-gray-400 max-w-xs">
          {data.isSignificant
            ? 'Изменения в метриках не случайны'
            : 'Изменения могут быть случайными'}
        </p>
      </div>

      <div className="space-y-3 flex-1">
        <div className="p-3 rounded-lg bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)] border border-border">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">p-value</div>
          <div className="text-xl font-medium">
            {data.pValue < 0.001 ? '<0.001' : data.pValue.toFixed(4)}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)] border border-border">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">95% доверительный интервал</div>
          <div className="text-lg font-medium">
            [{data.lowerBound.toFixed(1)}, {data.upperBound.toFixed(1)}]
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)] border border-border">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">α (уровень значимости)</div>
          <div className="text-xl font-medium">{data.alpha.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
