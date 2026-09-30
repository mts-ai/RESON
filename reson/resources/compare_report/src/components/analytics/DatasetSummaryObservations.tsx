import { AlertTriangle, Clock, GitCompare, PieChart } from '../icons';
import type {
  DatasetSummaryObservation,
  DatasetSummaryObservationVariant,
} from '../../utils/analyticsHelpers';

interface DatasetSummaryObservationsProps {
  observations: DatasetSummaryObservation[];
  isDark: boolean;
}

const VARIANT_ICONS: Record<DatasetSummaryObservationVariant, typeof AlertTriangle> = {
  peak: AlertTriangle,
  duration: Clock,
  type: PieChart,
  compare: GitCompare,
};

export function DatasetSummaryObservations({
  observations,
  isDark,
}: DatasetSummaryObservationsProps) {
  return (
    <div className="reson-dataset-summary-col">
      <h3 className={`reson-dataset-summary-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Ключевые наблюдения
      </h3>
      <p className={`reson-dataset-summary-subtitle ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        Автоматически по всему датасету · не зависит от фильтра среза
      </p>
      <ul className="reson-dataset-observations-list">
        {observations.map((observation) => {
          const Icon = VARIANT_ICONS[observation.variant];
          return (
            <li
              key={observation.label}
              className={`reson-dataset-observation reson-dataset-observation--${observation.variant}`}
            >
              <div className="reson-dataset-observation-head">
                <Icon className="reson-dataset-observation-icon" aria-hidden="true" />
                <span className="reson-dataset-observation-label">{observation.label}</span>
              </div>
              {Array.isArray(observation.text) ? (
                <ul
                  className={`reson-dataset-observation-bullets ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {observation.text.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p
                  className={`reson-dataset-observation-text ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {observation.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
