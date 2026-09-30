import { useMemo } from 'react';
import { useTheme } from '../ThemeProvider';
import { CompareModelErrorHeatmap } from './CompareModelErrorHeatmap';
import { DatasetSummaryObservations } from './DatasetSummaryObservations';
import {
  buildCompareDatasetObservations,
  buildFullDatasetSliceStats,
  buildModelErrorHeatmap,
} from '../../utils/analyticsHelpers';
import { ANALYTICS_MODEL_COLORS } from '../../utils/analyticsModelProfile';
import type { SampleData } from '../AnalyticsNew';

interface ModelInfo {
  name: string;
  displayName: string;
}

interface AnalyticsData {
  samples: SampleData[];
  totalSamples: number;
}

interface AnalyticsDatasetSummaryProps {
  data: Record<string, AnalyticsData>;
  selectedModels: string[];
  availableModels: ModelInfo[];
}

export function AnalyticsDatasetSummary({
  data,
  selectedModels,
  availableModels,
}: AnalyticsDatasetSummaryProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const getModelDisplayName = (modelName: string) =>
    availableModels.find((model) => model.name === modelName)?.displayName ?? modelName;

  const fullStats = useMemo(
    () => buildFullDatasetSliceStats(data, selectedModels, getModelDisplayName),
    [data, selectedModels, availableModels],
  );

  const heatmapBlocks = useMemo(
    () =>
      buildModelErrorHeatmap(
        data,
        selectedModels,
        getModelDisplayName,
        ANALYTICS_MODEL_COLORS,
      ),
    [data, selectedModels, availableModels],
  );

  const observations = useMemo(
    () => buildCompareDatasetObservations(heatmapBlocks, fullStats),
    [heatmapBlocks, fullStats],
  );

  return (
    <div className="space-y-4" data-tour="analytics-dataset-summary">
      <div className="reson-dataset-summary-grid">
        <div className="reson-dataset-heatmap-col">
          <h3 className={`reson-dataset-summary-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Ошибки по моделям и длительности
          </h3>
          <p className={`reson-dataset-summary-subtitle ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Весь датасет · INS / DEL / SUB × короткие / средние / длинные
          </p>
          <CompareModelErrorHeatmap blocks={heatmapBlocks} />
        </div>

        <DatasetSummaryObservations observations={observations} isDark={isDark} />
      </div>
    </div>
  );
}
