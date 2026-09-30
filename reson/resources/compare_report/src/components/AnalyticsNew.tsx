import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import {
  BarChart3,
  Activity,
  Target,
  Layers,
  Filter,
  LayoutGrid,
  SlidersHorizontal,
  Check,
  TrendingUp,
  Clock,
} from "./icons";
import { AnalyticsWERDistribution } from "./AnalyticsWERDistribution";
import { AnalyticsDurationDistribution } from "./AnalyticsDurationDistribution";
import { AnalyticsParallelCoordinates } from "./AnalyticsParallelCoordinates";
import { AnalyticsRadarChart } from "./AnalyticsRadarChart";
import { AnalyticsSampleDifficulty } from "./AnalyticsSampleDifficulty";
import { SectionHeader } from "./SectionHeader";
import { HeaderActionButton } from "./ui/HeaderActionButton";
import { SliceChartCard } from "./analytics/SliceChartCard";
import { AnalyticsDatasetSummary } from "./analytics/AnalyticsDatasetSummary";
import { SliceFilterModal } from "./analytics/SliceFilterModal";
import { SliceWinRatePanel } from "./analytics/SliceWinRatePanel";
import { useTheme } from "./ThemeProvider";
import {
  ANALYTICS_TAB_DESCRIPTIONS,
  buildSliceFilterLabel,
  getSliceKpi,
  hasSliceSamples,
  type AnalyticsMainTab,
} from "../utils/analyticsHelpers";
import {
  RESON_ANALYTICS_SECTION_CARD,
  RESON_ANALYTICS_SUBTITLE,
  resonAnalyticsSubtabClass,
} from "../styles/reportStyles";
import { ANALYTICS_MODEL_COLORS } from "../utils/analyticsModelProfile";
import {
  buildSelectedModelsList,
  computeAllowedSampleIds,
  computeSliceWinRates,
  stripModelComparisonFilters,
  type AnalyticsSliceFilters,
} from "../utils/analyticsSlice";

export interface SampleData {
  audio_filepath: string;
  duration: number;
  durationType: "short" | "normal" | "long";
  wer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
}

interface ModelInfo {
  name: string;
  displayName: string;
}

interface AnalyticsData {
  samples: SampleData[];
  totalSamples: number;
}

interface AnalyticsNewProps {
  data: Record<string, AnalyticsData>;
  availableModels: ModelInfo[];
  baseModel: string | null;
  targetModel: string | null;
  optionalModels: string[];
  sliceFilters: AnalyticsSliceFilters;
  onSliceFiltersChange: (patch: Partial<AnalyticsSliceFilters>) => void;
  onViewInManifest?: (sampleIds: string[]) => void;
}

export function AnalyticsNew({
  data: rawData,
  availableModels,
  baseModel,
  targetModel,
  optionalModels,
  sliceFilters,
  onSliceFiltersChange,
  onViewInManifest,
}: AnalyticsNewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const data = rawData;
  const [activeMainTab, setActiveMainTab] = useState<AnalyticsMainTab>("summary");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedChartModels, setSelectedChartModels] = useState<Set<string>>(new Set());

  const closeSettings = () => setIsSettingsOpen(false);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSettingsOpen]);

  const getModelDisplayName = (modelName: string) =>
    availableModels.find((model) => model.name === modelName)?.displayName ?? modelName;

  const selectedModels = useMemo(
    () => buildSelectedModelsList(baseModel, targetModel, optionalModels),
    [baseModel, targetModel, optionalModels],
  );

  useEffect(() => {
    setSelectedChartModels(
      new Set(selectedModels.map((modelName) => getModelDisplayName(modelName))),
    );
  }, [selectedModels, availableModels]);

  const toggleChartModel = (displayName: string) => {
    setSelectedChartModels((prev) => {
      const next = new Set(prev);
      if (next.has(displayName)) next.delete(displayName);
      else next.add(displayName);
      return next;
    });
  };

  const referenceModelName = useMemo(() => {
    if (baseModel && data[baseModel]) return baseModel;
    return selectedModels[0] ?? null;
  }, [baseModel, data, selectedModels]);

  const referenceSamples = useMemo(() => {
    if (!referenceModelName || !data[referenceModelName]) return null;
    return data[referenceModelName].samples;
  }, [referenceModelName, data]);

  const sliceSampleRefs = useMemo(() => {
    if (!referenceSamples) return null;
    return referenceSamples.map((sample) => ({
      id: sample.audio_filepath,
      duration: sample.duration,
      durationType: sample.durationType,
      getWer: (modelName: string) =>
        data[modelName]?.samples.find(
          (entry) => entry.audio_filepath === sample.audio_filepath,
        )?.wer,
    }));
  }, [referenceSamples, data]);

  const durationSliceSampleIds = useMemo(() => {
    if (!sliceSampleRefs) return null;
    return computeAllowedSampleIds(
      sliceSampleRefs,
      selectedModels,
      stripModelComparisonFilters(sliceFilters),
    );
  }, [sliceSampleRefs, selectedModels, sliceFilters]);

  const allowedSampleIds = useMemo(() => {
    if (!sliceSampleRefs) return null;
    return computeAllowedSampleIds(sliceSampleRefs, selectedModels, sliceFilters);
  }, [sliceSampleRefs, selectedModels, sliceFilters]);

  const buildSliceStats = useCallback(
    (sampleIds: Set<string> | null) => {
      if (selectedModels.length === 0 || !sampleIds) return null;

      const stats = selectedModels.map((modelName) => {
        const modelData = data[modelName];
        if (!modelData) return null;

        const filteredSamples = modelData.samples.filter((sample) =>
          sampleIds.has(sample.audio_filepath),
        );

        if (filteredSamples.length === 0) {
          return {
            modelName,
            displayName: getModelDisplayName(modelName),
            samplesCount: 0,
            avgWER: 0,
            avgDuration: 0,
            totalInsertions: 0,
            totalDeletions: 0,
            totalSubstitutions: 0,
            samples: [],
          };
        }

        return {
          modelName,
          displayName: getModelDisplayName(modelName),
          samplesCount: filteredSamples.length,
          avgWER:
            filteredSamples.reduce((sum, sample) => sum + sample.wer, 0) /
            filteredSamples.length,
          avgDuration:
            filteredSamples.reduce((sum, sample) => sum + sample.duration, 0) /
            filteredSamples.length,
          totalInsertions: filteredSamples.reduce(
            (sum, sample) => sum + sample.insertions,
            0,
          ),
          totalDeletions: filteredSamples.reduce(
            (sum, sample) => sum + sample.deletions,
            0,
          ),
          totalSubstitutions: filteredSamples.reduce(
            (sum, sample) => sum + sample.substitutions,
            0,
          ),
          samples: filteredSamples,
        };
      });

      return stats.filter((entry) => entry !== null);
    },
    [selectedModels, data, availableModels],
  );

  const sliceStats = useMemo(
    () => buildSliceStats(allowedSampleIds),
    [buildSliceStats, allowedSampleIds],
  );

  const clusterSliceStats = useMemo(
    () => buildSliceStats(durationSliceSampleIds),
    [buildSliceStats, durationSliceSampleIds],
  );

  const sliceSampleCount = useMemo(
    () => getSliceKpi(sliceStats ?? [], baseModel, targetModel)?.samples ?? null,
    [sliceStats, baseModel, targetModel],
  );

  const sliceWinRateStats = useMemo(() => {
    if (!referenceSamples || !allowedSampleIds || selectedModels.length < 2) {
      return null;
    }

    const sampleIds = referenceSamples
      .filter((sample) => allowedSampleIds.has(sample.audio_filepath))
      .map((sample) => sample.audio_filepath);

    return computeSliceWinRates(
      sampleIds,
      selectedModels,
      (sampleId) => {
        const modelWers: Record<string, number | undefined> = {};
        selectedModels.forEach((modelName) => {
          modelWers[modelName] = data[modelName]?.samples.find(
            (entry) => entry.audio_filepath === sampleId,
          )?.wer;
        });
        return modelWers;
      },
      getModelDisplayName,
      baseModel,
      targetModel,
    );
  }, [
    referenceSamples,
    allowedSampleIds,
    selectedModels,
    data,
    availableModels,
    baseModel,
    targetModel,
  ]);

  const currentSliceLabel = useMemo(
    () => buildSliceFilterLabel(sliceFilters, getModelDisplayName),
    [sliceFilters, availableModels],
  );

  const mainTabs: Array<{
    id: AnalyticsMainTab;
    label: string;
    icon: ReactNode;
    tour?: string;
  }> = [
    {
      id: "summary",
      label: "Сводка",
      icon: <LayoutGrid className="w-4 h-4" />,
      tour: "analytics-dataset-summary",
    },
    {
      id: "slice",
      label: "Срез",
      icon: <Activity className="w-4 h-4" />,
      tour: "analytics-slice-stats",
    },
    {
      id: "classes",
      label: "Кластеры сложности примеров",
      icon: <Target className="w-4 h-4" />,
      tour: "analytics-classes",
    },
  ];

  const renderModelToggles = () => {
    if (!sliceStats || sliceStats.length === 0) return null;

    return (
      <div className="flex flex-col gap-2 sm:items-end">
        <span className="reson-analytics-model-toggle-hint">
          Показать на графиках — нажмите для вкл/выкл
        </span>
        <div
          className="reson-analytics-model-toggle-group"
          role="group"
          aria-label="Выбор моделей для графиков"
        >
          {sliceStats.map((stat, index) => {
            const isSelected = selectedChartModels.has(stat.displayName);
            const color = ANALYTICS_MODEL_COLORS[index % ANALYTICS_MODEL_COLORS.length];

            return (
              <button
                key={stat.modelName}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleChartModel(stat.displayName)}
                className={`reson-analytics-model-toggle ${
                  isSelected
                    ? "reson-analytics-model-toggle--on"
                    : "reson-analytics-model-toggle--off"
                }`}
              >
                <span className="reson-analytics-model-toggle-check" aria-hidden="true">
                  {isSelected ? <Check className="w-3 h-3" /> : null}
                </span>
                <span
                  className="reson-analytics-model-toggle-dot"
                  style={{ backgroundColor: color }}
                />
                <span>{stat.displayName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const showSliceToolbar = activeMainTab === "slice" || activeMainTab === "classes";

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" data-tour="analytics">
      <SectionHeader
        variant="analytics"
        title="Аналитика"
        description="Интерактивные срезы данных и подробная статистика ошибок распознавания"
        icon={<BarChart3 />}
      />

      {selectedModels.length === 0 ? (
        <div className={`${RESON_ANALYTICS_SECTION_CARD} py-12 px-6 text-center`}>
          <p className={`text-base ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Выберите модели для анализа в разделе Обзор.
          </p>
          <p className={`text-sm mt-2 ${RESON_ANALYTICS_SUBTITLE}`}>
            После выбора base и target моделей здесь появится сравнительная аналитика.
          </p>
        </div>
      ) : (
        <>
          <div
            className="reson-analytics-sticky-bar p-4 mb-4 space-y-3"
            data-tour="analytics-sticky-bar"
          >
            <div className="flex flex-wrap gap-2">
              {mainTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveMainTab(tab.id)}
                  className={resonAnalyticsSubtabClass(activeMainTab === tab.id, isDark)}
                  data-tour={tab.tour}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="reson-analytics-tab-desc">
              {ANALYTICS_TAB_DESCRIPTIONS[activeMainTab]}
            </p>

            {showSliceToolbar && (
              <div className="reson-slice-toolbar">
                <div className="reson-slice-toolbar-left">
                  <HeaderActionButton
                    variant="analytics"
                    compact
                    title="Фильтр среза"
                    hint="Настроить срез"
                    statusLabel={currentSliceLabel}
                    showStatus
                    icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                    onClick={() => setIsSettingsOpen(true)}
                    pressed={isSettingsOpen}
                    ariaLabel="Фильтр среза"
                    dataTour="analytics-filters-button"
                  />

                  {activeMainTab === "slice" && sliceSampleCount != null && (
                    <span className="reson-slice-kpi-badge">
                      Сэмплов в срезе: <strong>{sliceSampleCount}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeMainTab === "slice" && renderModelToggles()}
          </div>

          <div className={RESON_ANALYTICS_SECTION_CARD}>
            {activeMainTab === "summary" && (
              <AnalyticsDatasetSummary
                data={data}
                selectedModels={selectedModels}
                availableModels={availableModels}
              />
            )}

            {activeMainTab === "slice" && (
              <>
                {!hasSliceSamples(sliceStats) ? (
                  <div className="reson-analytics-slice-empty">
                    <p className="reson-analytics-slice-empty-title">
                      По заданному фильтру нет данных для анализа
                    </p>
                    <p className="reson-analytics-slice-empty-desc">
                      Измените тип длительности или сравнение моделей в фильтре среза.
                    </p>
                  </div>
                ) : (
                  sliceStats && (
                    <div className="reson-analytics-slice-layout" data-tour="analytics-slice-content">
                      {sliceWinRateStats && sliceWinRateStats.totalSamples > 0 && (
                        <SliceWinRatePanel
                          stats={sliceWinRateStats}
                          modelOrder={selectedModels}
                          isDark={isDark}
                        />
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                        <SliceChartCard
                          icon={<Filter className="w-3.5 h-3.5" />}
                          title="Параллельные координаты"
                          description="INS, DEL, SUB и WER на одном срезе"
                          isDark={isDark}
                        >
                          <div data-tour="analytics-parallel">
                            <AnalyticsParallelCoordinates
                              sliceStats={sliceStats}
                              selectedRadarModels={selectedChartModels}
                              embedded
                              compact
                            />
                          </div>
                        </SliceChartCard>

                        <SliceChartCard
                          icon={<Layers className="w-3.5 h-3.5" />}
                          title="Профиль моделей"
                          description="Радарный профиль по метрикам среза"
                          isDark={isDark}
                        >
                          <div data-tour="analytics-profile">
                            <AnalyticsRadarChart
                              sliceStats={sliceStats}
                              selectedRadarModels={selectedChartModels}
                              embedded
                              compact
                            />
                          </div>
                        </SliceChartCard>
                      </div>

                      <div className="flex flex-col gap-3">
                        <SliceChartCard
                          icon={<TrendingUp className="w-3.5 h-3.5" />}
                          title="Распределение WER"
                          description="Плотность WER на текущем срезе"
                          isDark={isDark}
                          className="reson-slice-chart-card--wer-highlight"
                        >
                          <div data-tour="analytics-visualizations">
                            <AnalyticsWERDistribution
                              sliceStats={sliceStats}
                              selectedModels={selectedChartModels}
                              embedded
                              highlight
                            />
                          </div>
                        </SliceChartCard>

                        <SliceChartCard
                          icon={<Clock className="w-3.5 h-3.5" />}
                          title="Распределение по длительности"
                          description="Ошибки по бинам · тип и режим ниже"
                          isDark={isDark}
                        >
                          <AnalyticsDurationDistribution
                            sliceStats={sliceStats}
                            selectedModels={selectedChartModels}
                            embedded
                            singleChart
                          />
                        </SliceChartCard>
                      </div>
                    </div>
                  )
                )}
              </>
            )}

            {activeMainTab === "classes" && clusterSliceStats && (
              <AnalyticsSampleDifficulty
                sliceStats={clusterSliceStats}
                availableModels={availableModels}
                baseModel={baseModel}
                targetModel={targetModel}
                onViewInManifest={onViewInManifest}
              />
            )}
          </div>

          <SliceFilterModal
            open={isSettingsOpen}
            isDark={isDark}
            durationFilter={sliceFilters.durationFilter}
            modelComparisonFilter={sliceFilters.modelComparisonFilter}
            selectedModelForComparison={sliceFilters.selectedModelForComparison}
            selectedModels={selectedModels}
            getModelDisplayName={getModelDisplayName}
            onDurationChange={(value) => onSliceFiltersChange({ durationFilter: value })}
            onModelComparisonChange={onSliceFiltersChange}
            onClose={closeSettings}
          />
        </>
      )}
    </div>
  );
}
