import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type { ASRReportData } from '../types/data';
import { mockASRData } from '../data/mockData';

interface DataContextType {
  data: ASRReportData | null;
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

declare global {
  interface Window {
    RESON_DATA?: ASRReportData;
  }
}

function normalizeReportData(raw: ASRReportData): ASRReportData {
  return {
    ...raw,
    manifest: raw.manifest ?? [],
    vocab: raw.vocab ?? [],
    heatmapData: raw.heatmapData ?? [],
    replacements: raw.replacements ?? {
      vocab: [],
      examples: [],
      stats: { totalReplacements: 0, byField: {} },
    },
    qualityZones: raw.qualityZones ?? {
      excellent: { count: 0, percentage: 0 },
      good: { count: 0, percentage: 0 },
      poor: { count: 0, percentage: 0 },
    },
    dictionary: raw.dictionary ?? {
      metrics: { meanRecall: 0, meanPrecision: 0, meanF1Score: 0 },
      totals: { total: 0, russian: 0, english: 0, numbers: 0, other: 0 },
    },
    topErrorWords: raw.topErrorWords ?? { insertions: [], deletions: [], substitutions: [] },
    runInfo: raw.runInfo ?? {
      runName: raw.name ?? 'ASR Report',
      createdAt: '',
      recordCount: raw.manifest?.length ?? 0,
      normalized: false,
      metricProvider: '',
      meta: {},
      manifestSchema: {},
      normalizeCfg: {},
    },
    alerts: raw.alerts ?? [],
  };
}

function loadData(): ASRReportData {
  if (typeof window !== 'undefined' && window.RESON_DATA) {
    return normalizeReportData(window.RESON_DATA);
  }
  return mockASRData;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ASRReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setData(loadData());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(mockASRData);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <DataContext.Provider value={{ data, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
