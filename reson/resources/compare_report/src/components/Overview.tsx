import { useMemo } from "react";
import {
  Clock,
  FileAudio,
  Type,
  Hash,
  PieChart,
  Settings,
  Sparkles,
} from "./icons";
import { Button } from "./ui/button";
import { useTheme } from "./ThemeProvider";
import { MetricCard } from "./MetricCard";
import { WERComparison } from "./WERComparison";
import { MWAComparison } from "./MWAComparison";
import { WERDecomposition } from "./WERDecomposition";
import { StatisticalSignificanceCompact } from "./StatisticalSignificanceCompact";
import { OptionalMetrics } from "./OptionalMetrics";
import { OverviewContextBar } from "./OverviewContextBar";
import { OverviewSectionLinks } from "./OverviewSectionLinks";
import { RESON_SECTION_CARD_CLASS } from "../styles/reportStyles";
import type { AppSection } from "../utils/hashNavigation";

function formatDurationHms(timeStr: string): string {
  if (!timeStr || typeof timeStr !== "string") {
    return "0:00:00";
  }

  const parts = timeStr.split(":");
  if (parts.length !== 3) {
    return timeStr;
  }

  const hours = Number.parseInt(parts[0], 10);
  const minutes = Number.parseInt(parts[1], 10);
  const seconds = Number.parseInt(parts[2], 10);

  if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) {
    return timeStr;
  }

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const datasetInfoDefaults = {
  totalHours: "0:00:00",
  totalRecords: 0,
  vocabularySize: 0,
  uniqueChars: 0,
  durationTypes: {
    normal: 0,
    short: 0,
    long: 0,
  },
};

interface ModelInfo {
  name: string;
  displayName: string;
}

interface DatasetSummary {
  totalHours: string; // Format: "HH:MM:SS"
  totalRecords: number;
  vocabularySize: number;
  uniqueChars: number;
  durationTypes: {
    normal: number;
    short: number;
    long: number;
  };
}

function parseCountValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }
  return 0;
}

function fallbackDatasetSummaryFromWindow(): DatasetSummary | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = (window as any).RESON_DATA?.datasetInfo;
  if (!raw) {
    return undefined;
  }

  return {
    totalHours: String(raw.totalDuration || "0:00:00"),
    totalRecords: Number(raw.totalSamples || 0),
    vocabularySize: parseCountValue(raw.vocabSize),
    uniqueChars: parseCountValue(raw.uniqueChars),
    durationTypes: {
      normal: Number(raw.durationTypes?.normal || 0),
      short: Number(raw.durationTypes?.short || 0),
      long: Number(raw.durationTypes?.long || 0),
    },
  };
}

interface OverviewProps {
  baseModel: string | null;
  targetModel: string | null;
  optionalModels: string[];
  availableModels: ModelInfo[];
  datasetSummary?: DatasetSummary;
  modelData?: Record<
    string,
    {
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
  >;
  statisticalSignificance?: Record<
    string,
    {
      isSignificant: boolean;
      pValue: number;
      alpha: number;
      confidenceInterval: number;
      lowerBound: number;
      upperBound: number;
    }
  >;
  onSectionChange: (section: AppSection) => void;
}

function openModelSelector() {
  const selector = document.querySelector('[data-tour="model-selector"]');
  if (selector instanceof HTMLElement) {
    selector.click();
    selector.scrollIntoView({ behavior: "smooth", block: "center" });
    selector.classList.add("ring-2", "ring-purple-500", "ring-offset-2");
    setTimeout(() => {
      selector.classList.remove("ring-2", "ring-purple-500", "ring-offset-2");
    }, 2000);
  }
}

function OverviewEmptyState() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)] p-8">
      <div className={`${RESON_SECTION_CARD_CLASS} max-w-md w-full p-8 text-center`}>
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--reson-accent)]/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-[var(--reson-accent)]" />
          </div>
          <h2 className="text-xl font-medium mb-2">Начните с выбора моделей</h2>
          <p className="text-sm text-muted-foreground">
            Чтобы увидеть сравнение метрик, выберите минимум Base и Target модели.
          </p>
        </div>
        <Button className="w-full" onClick={openModelSelector}>
          <Settings className="w-4 h-4 mr-2" />
          Открыть выбор моделей
        </Button>
      </div>
    </div>
  );
}

export function Overview({
  baseModel,
  targetModel,
  optionalModels,
  availableModels,
  datasetSummary,
  modelData,
  statisticalSignificance,
  onSectionChange,
}: OverviewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Приоритет: props -> window.RESON_DATA -> безопасные нули
  const datasetInfoToUse =
    datasetSummary || fallbackDatasetSummaryFromWindow() || datasetInfoDefaults;

  const comparisonKey =
    baseModel && targetModel ? `${baseModel}_vs_${targetModel}` : null;
  const statSigData =
    comparisonKey && statisticalSignificance
      ? statisticalSignificance[comparisonKey]
        ?? statisticalSignificance[`${targetModel}_vs_${baseModel}`]
      : null;

  const abData = useMemo(() => {
    if (
      !baseModel ||
      !targetModel ||
      !modelData ||
      !modelData[baseModel] ||
      !modelData[targetModel]
    ) {
      return null;
    }

    const baseline = modelData[baseModel];
    const candidate = modelData[targetModel];

    const werImprovement = candidate.wer - baseline.wer;
    const werImprovementPercent =
      baseline.wer !== 0
        ? (werImprovement / baseline.wer) * 100
        : 0;
    const mwaImprovement = candidate.mwa - baseline.mwa;
    const mwaImprovementPercent =
      baseline.mwa !== 0
        ? (mwaImprovement / baseline.mwa) * 100
        : 0;

    return {
      wer: {
        baseline: baseline.wer,
        candidate: candidate.wer,
        improvement: werImprovement,
        improvementPercent: werImprovementPercent,
      },
      mwa: {
        baseline: baseline.mwa,
        candidate: candidate.mwa,
        improvement: mwaImprovement,
        improvementPercent: mwaImprovementPercent,
      },
      decomposition: {
        baseline: baseline.decomposition,
        candidate: candidate.decomposition,
      },
      optionalMetrics: {
        wer_h:
          baseline.optionalMetrics?.wer_h &&
          candidate.optionalMetrics?.wer_h
            ? {
                baseline: baseline.optionalMetrics.wer_h,
                candidate: candidate.optionalMetrics.wer_h,
              }
            : undefined,
        ler:
          baseline.optionalMetrics?.ler &&
          candidate.optionalMetrics?.ler
            ? {
                baseline: baseline.optionalMetrics.ler,
                candidate: candidate.optionalMetrics.ler,
              }
            : undefined,
        cer:
          baseline.optionalMetrics?.cer &&
          candidate.optionalMetrics?.cer
            ? {
                baseline: baseline.optionalMetrics.cer,
                candidate: candidate.optionalMetrics.cer,
              }
            : undefined,
      },
    };
  }, [baseModel, targetModel, modelData]);

  // Prepare multiple models data
  const multipleModelsData = useMemo(() => {
    // Create a set of selected model names
    const selectedModelNames = new Set<string>();
    if (baseModel) selectedModelNames.add(baseModel);
    if (targetModel) selectedModelNames.add(targetModel);
    optionalModels.forEach((model) =>
      selectedModelNames.add(model),
    );

    if (!modelData) {
      return [];
    }

    // Filter by selected models and map to the required format
    return availableModels
      .filter(
        (model) =>
          selectedModelNames.has(model.name) &&
          modelData[model.name],
      )
      .map((model) => ({
        name: model.name,
        displayName: model.displayName,
        wer: modelData[model.name].wer,
        mwa: modelData[model.name].mwa,
        timestamp: modelData[model.name].timestamp || "",
        checkpoint: modelData[model.name].checkpoint || 0,
        decomposition: modelData[model.name].decomposition,
        optionalMetrics:
          modelData[model.name].optionalMetrics || {},
      }));
  }, [
    baseModel,
    targetModel,
    optionalModels,
    availableModels,
    modelData,
  ]);

  const leaderboardSummary = useMemo(
    () => ({
      totalHours: datasetInfoToUse.totalHours,
      totalRecords: datasetInfoToUse.totalRecords,
      durationTypes: datasetInfoToUse.durationTypes,
    }),
    [datasetInfoToUse],
  );

  if (!baseModel || !targetModel) {
    return <OverviewEmptyState />;
  }

  return (
    <div
      className={`reson-overview-page p-6 ${
        isDark ? "bg-[#0F1117] text-white" : "bg-[#F5F7FA] text-gray-900"
      }`}
    >
      <div className="reson-section-page-header mb-3">
        <div className="reson-section-page-header-row">
          <div className="reson-section-page-icon reson-section-page-icon--overview">
            <PieChart />
          </div>
          <h1 className="reson-section-page-title">Обзор</h1>
        </div>
        <p className="reson-section-page-desc">
          Краткий обзор основных метрик и метаинформации сравнения моделей на датасете
        </p>
      </div>

      <OverviewContextBar
        summaryData={{
          baselineWER: abData?.wer.baseline,
          candidateWER: abData?.wer.candidate,
          pValue: statSigData?.pValue,
          statAnalysisAvailable: !!statSigData,
          werDecomposition: abData?.decomposition,
        }}
        models={multipleModelsData}
        datasetSummary={leaderboardSummary}
      />

      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5"
        data-tour="dataset-info"
      >
        <MetricCard
          compact
          icon={<Clock className="w-5 h-5 text-gray-400" />}
          label="Общая длительность"
          value={formatDurationHms(datasetInfoToUse.totalHours)}
        />
        <MetricCard
          compact
          icon={<FileAudio className="w-5 h-5 text-gray-400" />}
          label="Кол-во примеров"
          value={datasetInfoToUse.totalRecords.toLocaleString()}
        />
        <MetricCard
          compact
          icon={<Type className="w-5 h-5 text-gray-400" />}
          label="Уникальных слов"
          value={`${datasetInfoToUse.vocabularySize.toLocaleString()} words`}
        />
        <MetricCard
          compact
          icon={<Hash className="w-5 h-5 text-gray-400" />}
          label="Уникальных символов"
          value={`${datasetInfoToUse.uniqueChars} chars`}
        />
      </div>

      <div id="metrics-comparison" className="reson-overview-metrics-grid" data-tour="metrics-comparison">
        <div className="reson-overview-metrics-main" data-tour="metrics">
          <WERComparison data={abData?.wer} />
          <MWAComparison data={abData?.mwa} />
        </div>

        <div className="reson-overview-metrics-side" data-tour="statistical-significance">
          <StatisticalSignificanceCompact data={statSigData} />
        </div>
      </div>

      <div id="wer-decomposition" className="mb-5" data-tour="wer-decomposition">
        <WERDecomposition data={abData?.decomposition} />
      </div>

      <OptionalMetrics data={abData?.optionalMetrics} />

      <OverviewSectionLinks onSectionChange={onSectionChange} />
    </div>
  );
}