import { Award } from './icons';
import { RESON_SECTION_CARD_CLASS } from '../styles/reportStyles';

interface OptionalMetricsProps {
  data?: {
    wer_h?: { baseline: number; candidate: number };
    ler?: { baseline: number; candidate: number };
    cer?: { baseline: number; candidate: number };
  } | null;
}

export function OptionalMetrics({ data }: OptionalMetricsProps) {
  const metrics = [
    { key: 'wer_h', label: 'WER_H' },
    { key: 'ler', label: 'LER' },
    { key: 'cer', label: 'CER' },
  ];

  if (!data) {
    return null;
  }

  const availableMetrics = metrics.filter(m => data[m.key as keyof typeof data]);

  if (availableMetrics.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-medium">Дополнительные метрики</h3>
        <span className="text-xs px-3 py-1 rounded-full bg-[var(--reson-accent)]/10 border border-[var(--reson-accent)]/20 text-[var(--reson-accent-dark)] dark:text-[var(--reson-accent-light)]">
          Опциональные
        </span>
      </div>
      <div className={`${RESON_SECTION_CARD_CLASS} p-5`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-4 pr-4 font-medium">Метрика</th>
                <th className="text-center pb-4 pr-4 font-medium">Baseline</th>
                <th className="text-center pb-4 pr-4 font-medium">Target</th>
                <th className="text-center pb-4 font-medium">Изменение</th>
              </tr>
            </thead>
            <tbody>
              {availableMetrics.map(metric => {
                const metricData = data[metric.key as keyof typeof data];
                if (!metricData) return null;

                const improvement = metricData.candidate - metricData.baseline;
                const improvementPercent = (improvement / metricData.baseline) * 100;
                const isPositive = improvement < 0;

                return (
                  <tr key={metric.key} className="border-b border-border/50 last:border-0">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)]">
                          <Award className="w-4 h-4 text-[var(--reson-accent)]" />
                        </div>
                        <span className="font-medium">{metric.label}</span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-center">
                      <div className="inline-block px-3 py-1.5 rounded-lg bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)]">
                        {metricData.baseline.toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-center">
                      <div className="inline-block px-3 py-1.5 rounded-lg bg-[var(--reson-surface-muted-light)] dark:bg-[var(--reson-surface-muted-dark)]">
                        {metricData.candidate.toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                        isPositive
                          ? 'bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300'
                          : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'
                      }`}>
                        <span className="text-sm">
                          {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
                        </span>
                        <span className="text-xs opacity-70">
                          ({improvementPercent > 0 ? '+' : ''}{improvementPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
