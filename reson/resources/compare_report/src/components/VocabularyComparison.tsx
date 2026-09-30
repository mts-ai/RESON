import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  BookOpen,
  Activity,
  Search as SearchIcon,
  BarChart3,
  RefreshCw,
} from "./icons";
import { VocabularyComparisonTable } from "./VocabularyComparisonTable";
import { WordDetailModal } from "./WordDetailModal";
import { VocabularyMetricsComparison } from "./VocabularyMetricsComparison";
import { VocabularyReplacementsCompare } from "./VocabularyReplacementsCompare";
import { VocabularyCompositionCard } from "./VocabularyCompositionCard";
import { ImpactSummaryCard } from "./ImpactSummaryCard";
import { VocabularyTopChanges } from "./VocabularyTopChanges";
import { VocabularyQuickSearch } from "./VocabularyQuickSearch";
import { useTheme } from "./ThemeProvider";
import { RESON_PANEL_CLASS } from "../styles/reportStyles";
import type { VocabSubTab, VocabTableFilters } from "../utils/hashNavigation";
import type { CompareNormalizationDictionary } from "../utils/normalizationDictionary";
import { hasCompareNormalizationDictionary } from "../utils/normalizationDictionary";
import {
  VOCAB_SUBTAB_DESCRIPTIONS,
  vocabularySubtabClass,
} from "../utils/vocabularyHelpers";

export interface WisComponentBar {
  value: number;
  weight: number;
}

export interface WisComponentsUi {
  frequency: WisComponentBar;
  errorSeverity: WisComponentBar;
  errorCriticality: WisComponentBar;
  substitutionVariability: WisComponentBar;
}

export interface WordErrorExample {
  audio_filepath: string;
  text: string;
  prediction: string;
  duration: number;
  WER: number;
  CER?: number;
  LER?: number;
  WER_H?: number;
  INS: number;
  DEL: number;
  SUB: number;
  count: number;
  replacement_targets?: Array<{ word: string; count: number }>;
}

export interface ErrorExamplesUi {
  deletions: WordErrorExample[];
  insertions: WordErrorExample[];
  substitutions: WordErrorExample[];
}

export interface WordMetrics {
  recall: number;
  precision: number;
  f1Score: number;
  wis: number;
  wisComponents?: WisComponentsUi;
  errorExamples?: ErrorExamplesUi;
  insertions?: number;
  deletions?: number;
  substitutions?: number;
  substitutedBy?: Record<string, number>;
}

export interface VocabularyWord {
  word: string;
  frequency: number;
  type: "russian" | "english" | "number" | "other";
  modelMetrics: Record<string, WordMetrics>;
}

interface ModelInfo {
  name: string;
  displayName: string;
}

interface VocabularyComparisonProps {
  words: VocabularyWord[];
  availableModels: ModelInfo[];
  baseModel: string | null;
  targetModel: string | null;
  optionalModels: string[];
  manifestData?: Record<string, import("../utils/wordErrorHelpers").CompareManifestEntry[]>;
  audioBasePath?: string;
  normalizationDictionary?: CompareNormalizationDictionary | null;
  onWordDetailChange?: (isOpen: boolean) => void;
  initialSubTab?: VocabSubTab;
  initialWord?: string;
  initialTableFilters?: VocabTableFilters;
  onRouteChange?: (
    subTab: VocabSubTab,
    word?: string,
    tableFilters?: VocabTableFilters,
  ) => void;
}

type VocabularyTab = VocabSubTab;

export function VocabularyComparison({
  words,
  availableModels,
  baseModel,
  targetModel,
  optionalModels,
  manifestData,
  audioBasePath,
  normalizationDictionary,
  onWordDetailChange,
  initialSubTab = "summary",
  initialWord,
  initialTableFilters,
  onRouteChange,
}: VocabularyComparisonProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedWord, setSelectedWord] =
    useState<VocabularyWord | null>(null);
  const [activeTab, setActiveTab] = useState<VocabularyTab>(initialSubTab);
  const [tableFilters, setTableFilters] = useState<VocabTableFilters | undefined>(
    initialTableFilters,
  );

  const showReplacementsTab = hasCompareNormalizationDictionary(normalizationDictionary);

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    setTableFilters(initialTableFilters);
  }, [initialTableFilters]);

  useEffect(() => {
    if (!initialWord) return;
    const match = words.find(
      (word) => word.word.toLowerCase() === initialWord.toLowerCase(),
    );
    if (match) {
      setSelectedWord(match);
    }
  }, [initialWord, words]);

  useEffect(() => {
    onWordDetailChange?.(!!selectedWord);
  }, [selectedWord, onWordDetailChange]);

  useEffect(() => {
    if (activeTab === "replacements" && !showReplacementsTab) {
      setActiveTab("summary");
      onRouteChange?.("summary");
    }
  }, [activeTab, showReplacementsTab, onRouteChange]);

  const changeTab = useCallback(
    (tab: VocabularyTab) => {
      setActiveTab(tab);
      onRouteChange?.(
        tab,
        undefined,
        tab === "table" ? tableFilters : undefined,
      );
    },
    [onRouteChange, tableFilters],
  );

  const handleOpenInTable = useCallback(
    (word: string) => {
      const nextFilters: VocabTableFilters = {
        ...tableFilters,
        q: word,
        page: undefined,
      };
      setTableFilters(nextFilters);
      setActiveTab("table");
      onRouteChange?.("table", undefined, nextFilters);
    },
    [onRouteChange, tableFilters],
  );

  const handleTableRouteChange = useCallback(
    (filters: VocabTableFilters) => {
      setTableFilters(filters);
      onRouteChange?.("table", undefined, filters);
    },
    [onRouteChange],
  );

  const handleWordClick = useCallback(
    (word: VocabularyWord) => {
      setSelectedWord(word);
      if (activeTab === "table") {
        onRouteChange?.("table", word.word, tableFilters);
      }
    },
    [activeTab, onRouteChange, tableFilters],
  );

  const handleWordModalClose = useCallback(() => {
    setSelectedWord(null);
    onWordDetailChange?.(false);
    if (activeTab === "table") {
      onRouteChange?.("table", undefined, tableFilters);
    }
  }, [activeTab, onRouteChange, onWordDetailChange, tableFilters]);

  const selectedModels = useMemo(() => {
    const models = [];
    if (baseModel) models.push(baseModel);
    optionalModels.forEach((m) => models.push(m));
    if (targetModel && targetModel !== baseModel)
      models.push(targetModel);
    return models;
  }, [baseModel, targetModel, optionalModels]);

  const impactSummary = useMemo(() => {
    if (!baseModel || !targetModel) return null;

    const baseModelName = baseModel;
    const targetModelName = targetModel;

    let improved = 0;
    let worsened = 0;
    let unchanged = 0;
    let totalF1Delta = 0;
    let totalWisDelta = 0;
    let totalRecallDelta = 0;
    let totalPrecisionDelta = 0;

    words.forEach((word) => {
      const baseMetrics = word.modelMetrics[baseModelName];
      const targetMetrics = word.modelMetrics[targetModelName];

      if (!baseMetrics || !targetMetrics) return;

      const f1Delta =
        targetMetrics.f1Score - baseMetrics.f1Score;
      const wisDelta = targetMetrics.wis - baseMetrics.wis;
      const recallDelta =
        targetMetrics.recall - baseMetrics.recall;
      const precisionDelta =
        targetMetrics.precision - baseMetrics.precision;

      totalF1Delta += f1Delta;
      totalWisDelta += wisDelta;
      totalRecallDelta += recallDelta;
      totalPrecisionDelta += precisionDelta;

      if (f1Delta > 0.5) improved++;
      else if (f1Delta < -0.5) worsened++;
      else unchanged++;
    });

    return {
      improved,
      worsened,
      unchanged,
      avgF1Delta: totalF1Delta / words.length,
      avgWisDelta: totalWisDelta / words.length,
      avgRecallDelta: totalRecallDelta / words.length,
      avgPrecisionDelta: totalPrecisionDelta / words.length,
      baseModel: baseModelName,
      targetModel: targetModelName,
    };
  }, [words, baseModel, targetModel]);

  const subTabs: Array<{
    id: VocabularyTab;
    label: string;
    icon: JSX.Element;
    tour?: string;
  }> = useMemo(() => {
    const tabs = [
      {
        id: "summary" as const,
        label: "Сводка",
        icon: <SearchIcon className="w-3 h-3" />,
        tour: "vocabulary-impact-summary",
      },
      {
        id: "metrics" as const,
        label: "Метрики",
        icon: <Activity className="w-3 h-3" />,
        tour: "vocabulary-metrics-by-type",
      },
      {
        id: "table" as const,
        label: "Интерактивный словарь",
        icon: <BarChart3 className="w-3 h-3" />,
        tour: "vocabulary-detail-card-table",
      },
    ];
    if (showReplacementsTab) {
      tabs.push({
        id: "replacements",
        label: "Словарь замен",
        icon: <RefreshCw className="w-3 h-3" />,
        tour: "vocabulary-replacements",
      });
    }
    return tabs;
  }, [showReplacementsTab]);

  return (
    <div
      className={`reson-vocabulary-page min-h-full p-6 max-w-[1400px] mx-auto ${
        isDark ? "bg-[#0F1117] text-white" : "bg-[#F5F7FA] text-gray-900"
      }`}
      data-tour="vocabulary"
    >
      <div className="reson-section-page-header">
        <div className="reson-section-page-header-row">
          <div className="reson-section-page-icon reson-section-page-icon--vocabulary">
            <BookOpen />
          </div>
          <h1 className="reson-section-page-title">Словарь</h1>
        </div>
        <p className="reson-section-page-desc">
          Сравнение лексики и метрик распознавания слов между выбранными моделями на одном датасете
        </p>
      </div>

      {(!baseModel || !targetModel) && (
        <div className={`p-5 mb-4 ${RESON_PANEL_CLASS}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium mb-1">Выберите модели для сравнения</p>
              <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Используйте настройки моделей, чтобы выбрать Base и Target для сравнения словаря
              </p>
            </div>
          </div>
        </div>
      )}

      {baseModel && targetModel && impactSummary && (
        <>
          <div
            className="reson-vocabulary-sticky-bar p-3 mb-4 space-y-2"
            data-tour="vocabulary-subtabs"
          >
            <div className="flex flex-wrap gap-1.5">
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => changeTab(tab.id)}
                  className={vocabularySubtabClass(activeTab === tab.id, isDark)}
                  data-tour={tab.tour}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <p
              className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              {VOCAB_SUBTAB_DESCRIPTIONS[activeTab]}
            </p>
          </div>

          <div className="reson-vocabulary-section-card p-4">
            {activeTab === "summary" && (
              <div className="space-y-3">
                <div className="reson-vocab-summary-row" data-tour="vocabulary-summary">
                  <VocabularyQuickSearch
                    words={words}
                    onWordClick={setSelectedWord}
                    onOpenInTable={handleOpenInTable}
                    baseModel={baseModel}
                    targetModel={targetModel}
                  />
                  <ImpactSummaryCard impactSummary={impactSummary} />
                </div>

                <VocabularyCompositionCard words={words} />

                <VocabularyTopChanges
                  words={words}
                  baseModel={baseModel}
                  targetModel={targetModel}
                  onWordClick={setSelectedWord}
                />
              </div>
            )}

            {activeTab === "metrics" && (
              <VocabularyMetricsComparison
                words={words}
                baseModel={baseModel}
                targetModel={targetModel}
                availableModels={availableModels}
              />
            )}

            {activeTab === "replacements" && normalizationDictionary && (
              <VocabularyReplacementsCompare
                normalizationDictionary={normalizationDictionary}
                selectedModels={selectedModels}
                availableModels={availableModels}
                onSearchWord={handleOpenInTable}
              />
            )}

            {activeTab === "table" && (
              <VocabularyComparisonTable
                words={words}
                selectedModels={selectedModels}
                availableModels={availableModels}
                onWordClick={handleWordClick}
                initialSearchQuery={tableFilters?.q || initialTableFilters?.q}
                initialTableFilters={tableFilters ?? initialTableFilters}
                onTableRouteChange={handleTableRouteChange}
              />
            )}
          </div>
        </>
      )}

      {selectedWord && (
        <WordDetailModal
          word={selectedWord}
          selectedModels={selectedModels}
          availableModels={availableModels}
          manifestData={manifestData}
          audioBasePath={audioBasePath}
          onClose={handleWordModalClose}
        />
      )}
    </div>
  );
}
