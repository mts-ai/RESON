import { useTheme } from './ThemeProvider';
import { VocabSectionHint } from './vocabulary/VocabSectionHint';

const IMPACT_SUMMARY_HINT_ITEMS = [
  {
    color: '#10B981',
    label: 'Улучшено',
    range: 'F1-score',
    description:
      'Слово считается улучшенным, если F1-score Target выше Base более чем на 0.5 п.п.',
  },
  {
    color: '#EF4444',
    label: 'Ухудшено',
    range: 'F1-score',
    description:
      'Слово считается ухудшенным, если F1-score Target ниже Base более чем на 0.5 п.п.',
  },
  {
    color: '#10B981',
    label: 'Recall',
    range: 'полнота',
    description:
      'Доля вхождений слова в эталоне, которые модель распознала верно. Низкий recall — слово часто пропускается.',
  },
  {
    color: '#3B82F6',
    label: 'Precision',
    range: 'точность',
    description:
      'Доля верных распознаваний среди всех случаев, когда слово появилось в гипотезе.',
  },
  {
    color: '#8B5CF6',
    label: 'F1-score',
    range: 'баланс',
    description:
      'Сводная метрика между recall и precision. Удобна для сравнения качества по словам.',
  },
  {
    color: '#F97316',
    label: 'WIS',
    range: '0–100',
    description:
      'Word Impact Score — насколько ошибки по слову влияют на общий WER. Чем выше, тем критичнее слово для качества.',
  },
] as const;

interface ImpactSummary {
  improved: number;
  worsened: number;
  unchanged: number;
  avgF1Delta: number;
  avgWisDelta: number;
  avgRecallDelta: number;
  avgPrecisionDelta: number;
  baseModel: string;
  targetModel: string;
}

interface ImpactSummaryCardProps {
  impactSummary: ImpactSummary;
}

function DeltaLine({
  label,
  value,
  invert = false,
  suffix = 'п.п.',
}: {
  label: string;
  value: number;
  invert?: boolean;
  suffix?: string;
}) {
  const positive = invert ? value <= 0 : value >= 0;
  return (
    <div className="reson-vocab-impact-stat-line">
      <span className="reson-vocab-impact-stat-label">{label}</span>
      <span className={positive ? 'reson-vocab-impact-stat-good' : 'reson-vocab-impact-stat-bad'}>
        {value >= 0 ? '+' : ''}
        {value.toFixed(2)}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}

export function ImpactSummaryCard({ impactSummary }: ImpactSummaryCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const total = impactSummary.improved + impactSummary.worsened + impactSummary.unchanged;
  const improvedPct = total > 0 ? (impactSummary.improved / total) * 100 : 0;
  const worsenedPct = total > 0 ? (impactSummary.worsened / total) * 100 : 0;
  const unchangedPct = total > 0 ? (impactSummary.unchanged / total) * 100 : 0;

  return (
    <div className="reson-vocab-card reson-vocab-summary-col h-full">
      <div className="reson-vocab-section-header mb-2">
        <div className="min-w-0">
          <h3
            className={`reson-vocab-panel-title reson-vocab-panel-title--sm mb-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Сводка изменений
          </h3>
          <p className="reson-vocab-panel-desc mb-0">Target vs Base по F1-score словаря</p>
        </div>
        <VocabSectionHint
          isDark={isDark}
          triggerText="Что означают метрики?"
          panelTitle="Метрики сводки"
          panelSubtitle="Критерии сравнения и определения метрик"
          panelAriaLabel="Пояснение метрик сводки изменений"
          items={[...IMPACT_SUMMARY_HINT_ITEMS]}
          scrollable
        />
      </div>

      <div className="space-y-2.5 mb-3">
        {[
          {
            key: 'improved',
            label: 'Улучшено',
            count: impactSummary.improved,
            percentage: improvedPct,
            color: '#10B981',
          },
          {
            key: 'worsened',
            label: 'Ухудшено',
            count: impactSummary.worsened,
            percentage: worsenedPct,
            color: '#EF4444',
          },
          {
            key: 'unchanged',
            label: 'Без изменений',
            count: impactSummary.unchanged,
            percentage: unchangedPct,
            color: isDark ? '#6B7280' : '#9CA3AF',
          },
        ].map((item) => (
          <div key={item.key}>
            <div className="reson-vocab-impact-bar-head">
              <div className="reson-vocab-impact-bar-label">
                <span
                  className="reson-vocab-impact-bar-dot"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
              <span className="reson-vocab-impact-bar-value">
                {item.count.toLocaleString()}{' '}
                <span className="reson-vocab-impact-bar-percent">
                  ({item.percentage.toFixed(1)}%)
                </span>
              </span>
            </div>
            <div className={`reson-vocab-impact-bar-track ${isDark ? 'reson-vocab-impact-bar-track--dark' : ''}`}>
              <div
                className="reson-vocab-impact-bar-fill"
                style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={`reson-vocab-impact-stats ${isDark ? 'reson-vocab-impact-stats--dark' : ''}`}>
        <DeltaLine label="F1-score" value={impactSummary.avgF1Delta} />
        <DeltaLine label="Recall" value={impactSummary.avgRecallDelta} />
        <DeltaLine label="Precision" value={impactSummary.avgPrecisionDelta} />
        <DeltaLine label="WIS" value={impactSummary.avgWisDelta} invert suffix="" />
      </div>
    </div>
  );
}
