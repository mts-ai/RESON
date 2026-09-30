import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from './icons';
import { useTheme } from './ThemeProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { computeQuickSummary, type QuickSummaryInput } from '../utils/quickSummaryLogic';

interface QuickSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QuickSummaryInput;
}

function SummaryRow({
  question,
  children,
  isDark,
}: {
  question: string;
  children: ReactNode;
  isDark: boolean;
}) {
  return (
    <div
      className={`reson-quick-summary-row rounded-lg border px-4 py-3 ${
        isDark
          ? 'border-[#2A2D35] bg-[#23262F]'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <p
        className={`text-xs font-medium mb-2 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}
      >
        {question}
      </p>
      <div>{children}</div>
    </div>
  );
}

export function QuickSummaryModal({ open, onOpenChange, data }: QuickSummaryModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const summary = computeQuickSummary(data);

  if (!summary) {
    return null;
  }

  const {
    werChange,
    isImprovement,
    isSignificant,
    recommendation,
    recommendationText,
    subChange,
    delChange,
    insChange,
  } = summary;

  const { pValue, statAnalysisAvailable = false, werDecomposition } = data;

  let recommendationIcon: JSX.Element;
  if (recommendation === 'ready') {
    recommendationIcon = <CheckCircle2 className="w-4 h-4" />;
  } else if (recommendation === 'not-recommended') {
    recommendationIcon = <XCircle className="w-4 h-4" />;
  } else {
    recommendationIcon = <AlertTriangle className="w-4 h-4" />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="reson-dialog-surface reson-quick-summary-modal !max-w-lg !w-[min(32rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto p-0 !z-[70]"
        overlayClassName="!z-[65]"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 text-left">
          <div className="flex items-center gap-2 pr-10">
            <CheckCircle2
              className={`w-5 h-5 shrink-0 ${isDark ? 'text-[#34D399]' : 'text-[#059669]'}`}
            />
            <DialogTitle className={isDark ? 'text-white' : 'text-gray-900'}>
              Краткие выводы
            </DialogTitle>
          </div>
          <DialogDescription className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Сводка сравнения Base и Target моделей
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <SummaryRow question="Наблюдается ли улучшение?" isDark={isDark}>
            <div className="flex items-center gap-2">
              {isImprovement ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span
                className={`text-sm font-medium ${
                  isImprovement
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isImprovement ? 'Улучшение' : 'Ухудшение'} на {Math.abs(werChange).toFixed(1)}%
              </span>
            </div>
          </SummaryRow>

          <SummaryRow question="Статистически значимый результат?" isDark={isDark}>
            {!statAnalysisAvailable ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className={`text-sm leading-snug ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                  Анализ недоступен; пересоберите отчёт с явным указанием о необходимости
                  провести стат. анализ
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isSignificant ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span
                  className={`text-sm font-medium ${
                    isSignificant
                      ? 'text-green-600 dark:text-green-400'
                      : isDark
                        ? 'text-gray-400'
                        : 'text-gray-600'
                  }`}
                >
                  {isSignificant ? 'Значимо' : 'Не значимо'}
                  <span className={`ml-1.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    (p={pValue?.toFixed(3)})
                  </span>
                </span>
              </div>
            )}
          </SummaryRow>

          {werDecomposition?.baseline?.substitutionsCount !== undefined &&
            werDecomposition?.candidate?.substitutionsCount !== undefined && (
              <SummaryRow question="Улучшена лексика?" isDark={isDark}>
                <div className="flex items-center gap-2">
                  {subChange < 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : subChange > 0 ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-400 shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      subChange < 0
                        ? 'text-green-600 dark:text-green-400'
                        : subChange > 0
                          ? 'text-red-600 dark:text-red-400'
                          : isDark
                            ? 'text-gray-400'
                            : 'text-gray-600'
                    }`}
                  >
                    {subChange < 0 ? 'Да' : subChange > 0 ? 'Нет' : 'Без изменений'}, замены{' '}
                    {subChange > 0 ? '+' : ''}
                    {subChange.toLocaleString()}
                  </span>
                </div>
              </SummaryRow>
            )}

          {werDecomposition?.baseline?.deletionsCount !== undefined &&
            werDecomposition?.candidate?.deletionsCount !== undefined && (
              <SummaryRow question="Снижено количество удалений?" isDark={isDark}>
                <div className="flex items-center gap-2">
                  {delChange < 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : delChange > 0 ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-400 shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      delChange < 0
                        ? 'text-green-600 dark:text-green-400'
                        : delChange > 0
                          ? 'text-red-600 dark:text-red-400'
                          : isDark
                            ? 'text-gray-400'
                            : 'text-gray-600'
                    }`}
                  >
                    {delChange < 0 ? 'Да' : delChange > 0 ? 'Нет' : 'Без изменений'}, удаления{' '}
                    {delChange > 0 ? '+' : ''}
                    {delChange.toLocaleString()}
                  </span>
                </div>
              </SummaryRow>
            )}

          {werDecomposition?.baseline?.insertionsCount !== undefined &&
            werDecomposition?.candidate?.insertionsCount !== undefined && (
              <SummaryRow question="Снижено количество вставок?" isDark={isDark}>
                <div className="flex items-center gap-2">
                  {insChange < 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : insChange > 0 ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-400 shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      insChange < 0
                        ? 'text-green-600 dark:text-green-400'
                        : insChange > 0
                          ? 'text-red-600 dark:text-red-400'
                          : isDark
                            ? 'text-gray-400'
                            : 'text-gray-600'
                    }`}
                  >
                    {insChange < 0 ? 'Да' : insChange > 0 ? 'Нет' : 'Без изменений'}, вставки{' '}
                    {insChange > 0 ? '+' : ''}
                    {insChange.toLocaleString()}
                  </span>
                </div>
              </SummaryRow>
            )}

          <div
            className={`rounded-lg border px-4 py-3 ${
              isDark ? 'border-[#2A2D35] bg-[#23262F]' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <p
              className={`text-xs font-medium mb-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Рекомендация
            </p>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                recommendation === 'ready'
                  ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                  : recommendation === 'not-recommended'
                    ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}
            >
              <span className="w-3.5 h-3.5">{recommendationIcon}</span>
              <span className="text-sm font-medium">{recommendationText}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
