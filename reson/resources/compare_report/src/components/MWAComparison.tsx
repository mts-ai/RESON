import { Info } from "./icons";
import { useTheme } from './ThemeProvider';
import { RESON_PANEL_CLASS } from '../styles/reportStyles';

interface MWAComparisonProps {
  data?: {
    baseline: number;
    candidate: number;
    improvement: number;
    improvementPercent: number;
  } | null;
}

export function MWAComparison({ data }: MWAComparisonProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!data) {
    return (
      <div className={`${RESON_PANEL_CLASS} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`reson-body ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Mean Word Accuracy (MWA)
          </h3>
          <span className={`text-xs px-3 py-1 rounded-full reson-metric-badge--mwa ${isDark ? 'dark' : 'light'}`}>
            Основная метрика
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Info className="w-4 h-4" />
          <p>Выберите модели для сравнения</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`reson-metric-card reson-metric-card--mwa ${isDark ? 'dark' : 'light'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`reson-body ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Mean Word Accuracy (MWA)
        </h3>
        <span className={`text-xs px-3 py-1 rounded-full reson-metric-badge--mwa ${isDark ? 'dark' : 'light'}`}>
          Основная метрика
        </span>
      </div>

      <div className="flex items-baseline gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Baseline</div>
          <div className="text-2xl text-muted-foreground line-through">
            {data.baseline.toFixed(1)}%
          </div>
        </div>
        <div className="text-2xl text-muted-foreground">→</div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Candidate</div>
          <div className={`text-4xl font-normal reson-metric-value--mwa ${isDark ? 'dark' : 'light'}`}>
            {data.candidate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="mb-3">
        {data.improvement > 0 ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-600 dark:text-green-400">
              Улучшение на {data.improvement.toFixed(1)} п.п. ({data.improvementPercent.toFixed(1)}%)
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm text-red-600 dark:text-red-400">
              Ухудшение на {Math.abs(data.improvement).toFixed(1)} п.п. ({Math.abs(data.improvementPercent).toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
        Среднее качество распознавания слов из оттекстовок (ошибки вставок не учитываются при
        формировании данной метрики). Чем выше результат, тем лучше; идеальное распознавание
        (без учёта ошибок вставок) достигается при 100%.
      </p>
    </div>
  );
}
