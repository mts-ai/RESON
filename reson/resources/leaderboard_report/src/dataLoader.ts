interface ModelInfo {
  name: string;
  displayName: string;
}

interface ModelOverview {
  wer: number;
  mwa: number;
  decomposition: {
    insertions: number;
    deletions: number;
    substitutions: number;
    insertionsCount: number;
    deletionsCount: number;
    substitutionsCount: number;
  };
  optionalMetrics?: {
    wer_h?: number;
    ler?: number;
    cer?: number;
  };
  timestamp?: string;
  checkpoint?: number;
}

interface DatasetInfo {
  name: string;
  totalSamples: number;
  totalDuration: string;
  durationTypes: {
    short: number;
    normal: number;
    long: number;
  };
}

interface LeaderboardModel {
  name: string;
  displayName: string;
  wer: number;
  mwa: number;
  timestamp: string;
  checkpoint?: number;
  decomposition: ModelOverview['decomposition'];
  optionalMetrics?: ModelOverview['optionalMetrics'];
}

interface LeaderboardData {
  models: LeaderboardModel[];
  datasetSummary: {
    totalHours: string;
    totalRecords: number;
    durationTypes: DatasetInfo['durationTypes'];
  };
  datasetName: string;
}

interface RESONData {
  datasetInfo: DatasetInfo;
  models: ModelInfo[];
  overviewData: Record<string, ModelOverview>;
  settings: {
    language: string;
    defaultTheme: 'system' | 'light' | 'dark';
  };
}

declare global {
  interface Window {
    RESON_DATA?: RESONData;
  }
}

export function loadLeaderboardData(): LeaderboardData {
  const data = window.RESON_DATA;
  if (!data) {
    throw new Error('window.RESON_DATA is missing');
  }

  const models: LeaderboardModel[] = data.models.map((model) => {
    const overview = data.overviewData[model.name];
    return {
      name: model.name,
      displayName: model.displayName,
      wer: overview?.wer ?? 0,
      mwa: overview?.mwa ?? 0,
      timestamp: overview?.timestamp ?? '',
      checkpoint: overview?.checkpoint,
      decomposition: overview?.decomposition ?? {
        insertions: 0,
        deletions: 0,
        substitutions: 0,
        insertionsCount: 0,
        deletionsCount: 0,
        substitutionsCount: 0,
      },
      optionalMetrics: overview?.optionalMetrics,
    };
  });

  return {
    models,
    datasetName: data.datasetInfo.name,
    datasetSummary: {
      totalHours: data.datasetInfo.totalDuration,
      totalRecords: data.datasetInfo.totalSamples,
      durationTypes: data.datasetInfo.durationTypes,
    },
  };
}
