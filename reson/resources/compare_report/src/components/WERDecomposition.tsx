import { Plus, Minus, RefreshCw, Info, HelpCircle } from './icons';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { RESON_SECTION_CARD_CLASS } from '../styles/reportStyles';

interface WERDecompositionProps {
  data?: {
    baseline: {
      insertions: number;
      deletions: number;
      substitutions: number;
      insertionsCount: number;
      deletionsCount: number;
      substitutionsCount: number;
    };
    candidate: {
      insertions: number;
      deletions: number;
      substitutions: number;
      insertionsCount: number;
      deletionsCount: number;
      substitutionsCount: number;
    };
  } | null;
}

interface ErrorTypeRowProps {
  icon: React.ReactNode;
  title: string;
  baselineCount: number;
  candidateCount: number;
  color: string;
  maxValue: number;
}

function ErrorTypeRow({
  icon,
  title,
  baselineCount,
  candidateCount,
  color,
  maxValue,
}: ErrorTypeRowProps) {
  const countDiff = candidateCount - baselineCount;
  const isImprovement = countDiff < 0;

  const baselineIsBetter = baselineCount < candidateCount;
  const baselineOpacity = baselineIsBetter ? 1.0 : 0.35;
  const candidateOpacity = baselineIsBetter ? 0.35 : 1.0;

  return (
    <div className="reson-wer-decomp-row grid grid-cols-[auto_1fr_auto] gap-6 items-center">
      <div className="reson-wer-decomp-label flex items-center gap-3 w-40">
        <div className="p-1.5 rounded" style={{ backgroundColor: `${color}30` }}>
          {icon}
        </div>
        <span>{title}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className={`text-xs w-16 ${baselineIsBetter ? '' : 'text-muted-foreground'}`}>
            Baseline
          </span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(baselineCount / maxValue) * 100}%`,
                backgroundColor: color,
                opacity: baselineOpacity,
              }}
            />
          </div>
          <span
            className={`text-sm w-28 text-right ${baselineIsBetter ? '' : 'text-muted-foreground'}`}
            style={baselineIsBetter ? { color } : {}}
          >
            {baselineCount.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs w-16 ${!baselineIsBetter ? '' : 'text-muted-foreground'}`}>
            Candidate
          </span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(candidateCount / maxValue) * 100}%`,
                backgroundColor: color,
                opacity: candidateOpacity,
              }}
            />
          </div>
          <span
            className={`text-sm w-28 text-right ${!baselineIsBetter ? '' : 'text-muted-foreground'}`}
            style={!baselineIsBetter ? { color } : {}}
          >
            {candidateCount.toLocaleString()}
          </span>
        </div>
      </div>

      <div className={`reson-wer-decomp-delta px-2.5 py-1 rounded text-xs whitespace-nowrap ${
        isImprovement
          ? 'bg-green-200/80 dark:bg-green-500/10 text-green-800 dark:text-green-400'
          : 'bg-red-200/80 dark:bg-red-500/10 text-red-800 dark:text-red-400'
      }`}>
        {isImprovement ? '↓' : '↑'} {Math.abs(countDiff).toLocaleString()}
      </div>
    </div>
  );
}

export function WERDecomposition({ data }: WERDecompositionProps) {
  if (!data) {
    return (
      <div className={`${RESON_SECTION_CARD_CLASS} p-6 mb-8`}>
        <h3 className="text-sm font-medium mb-4">Декомпозиция WER по типам ошибок</h3>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm py-8">
          <Info className="w-4 h-4" />
          <p>Выберите модели для просмотра декомпозиции ошибок</p>
        </div>
      </div>
    );
  }

  const maxAbsolute = Math.max(
    data.baseline.insertionsCount,
    data.baseline.deletionsCount,
    data.baseline.substitutionsCount,
    data.candidate.insertionsCount,
    data.candidate.deletionsCount,
    data.candidate.substitutionsCount,
  );

  return (
    <div className={`${RESON_SECTION_CARD_CLASS} p-6 mb-8`}>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium">Декомпозиция WER по типам ошибок</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="focus:outline-none focus:ring-2 focus:ring-purple-500 rounded">
                <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-help transition-colors" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-md p-4 bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-800 shadow-xl" side="left">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Типы ошибок распознавания:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Plus className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">Вставки (Insertions)</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Модель добавила лишние слова, которых нет в референсе.
                      </p>
                      <div className="mt-1 p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] font-mono">
                        <span className="text-slate-700 dark:text-slate-300">Референс: "привет мир"</span><br/>
                        <span className="text-slate-700 dark:text-slate-300">Гипотеза: "привет <span className="text-blue-500">дорогой</span> мир"</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Minus className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">Удаления (Deletions)</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Модель пропустила слова, которые есть в референсе.
                      </p>
                      <div className="mt-1 p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] font-mono">
                        <span className="text-slate-700 dark:text-slate-300">Референс: "привет <span className="text-orange-500">дорогой</span> мир"</span><br/>
                        <span className="text-slate-700 dark:text-slate-300">Гипотеза: "привет мир"</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <RefreshCw className="w-3 h-3 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">Замены (Substitutions)</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Модель заменила слова на другие.
                      </p>
                      <div className="mt-1 p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] font-mono">
                        <span className="text-slate-700 dark:text-slate-300">Референс: "привет <span className="text-purple-500">мир</span>"</span><br/>
                        <span className="text-slate-700 dark:text-slate-300">Гипотеза: "привет <span className="text-purple-500">свет</span>"</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">
          Сравнение абсолютного количества ошибок по типам
        </p>
      </div>

      <div className="space-y-6">
        <ErrorTypeRow
          icon={<Plus className="w-4 h-4" />}
          title="Вставки"
          baselineCount={data.baseline.insertionsCount}
          candidateCount={data.candidate.insertionsCount}
          color="hsl(200 95% 45%)"
          maxValue={maxAbsolute}
        />
        <ErrorTypeRow
          icon={<Minus className="w-4 h-4" />}
          title="Удаления"
          baselineCount={data.baseline.deletionsCount}
          candidateCount={data.candidate.deletionsCount}
          color="hsl(25 95% 53%)"
          maxValue={maxAbsolute}
        />
        <ErrorTypeRow
          icon={<RefreshCw className="w-4 h-4" />}
          title="Замены"
          baselineCount={data.baseline.substitutionsCount}
          candidateCount={data.candidate.substitutionsCount}
          color="hsl(280 70% 50%)"
          maxValue={maxAbsolute}
        />
      </div>
    </div>
  );
}
