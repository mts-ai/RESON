import React, { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Search,
  X,
  ChevronDown,
  FileAudio,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Download,
  ChevronRight,
  ChevronLeft,
  Copy,
  AlertCircle,
  Award,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  SlidersHorizontal,
  Trophy,
  Plus,
} from "./icons";
import { PageSizeSelect } from "./ui/PageSizeSelect";
import { HeaderActionButton } from "./ui/HeaderActionButton";
import { InlineHelpTooltip } from "./ui/HelpHint";
import { OracleManifestSummary } from "./OracleManifestSummary";
import { ManifestSampleDetail } from "./ManifestSampleDetail";
import { ManifestFiltersPanel } from "./ManifestFiltersPanel";
import {
  getDifficultyInfo,
  getModelsAtWer,
  type DifficultyClass,
} from "../utils/manifestHelpers";
import { buildSampleDifficultyClassification } from "../utils/sampleDifficultyClusters";
import {
  buildSelectedModelsList,
  computeAllowedSampleIds,
  DEFAULT_ANALYTICS_SLICE_FILTERS,
  matchesDurationFilter,
  sampleMatchesModelComparisonFilter,
  SLICE_DURATION_LABELS,
  stripModelComparisonFilters,
  type AnalyticsSliceFilters,
  type SliceDurationFilter,
  type SliceModelComparisonFilter,
} from "../utils/analyticsSlice";
import { SectionHeader } from "./SectionHeader";
import { useTheme } from "./ThemeProvider";
import {
  RESON_ANALYTICS_CHART_CARD,
  RESON_ANALYTICS_INNER_CARD,
  RESON_ANALYTICS_SECTION_TITLE,
  RESON_ANALYTICS_SUBTITLE,
  RESON_ANALYTICS_FILTER_SELECT,
  RESON_MANIFEST_ACCENT_BADGE,
  RESON_MANIFEST_ACCENT_TEXT,
  RESON_MANIFEST_ACTIVE_FILTER_TAG,
  resonManifestSubtabClass,
} from "../styles/reportStyles";

const MANIFEST_TAB_DESCRIPTIONS = {
  manifest:
    "Таблица записей с фильтрацией, сортировкой и экспортом. Клик по строке открывает детализацию с diff и аудио.",
  oracle:
    "Потолок качества ансамбля (Oracle WER) и сравнение побед моделей на том же срезе, что и интерактивный манифест.",
} as const;

function ManifestColumnToggle({
  label,
  visible,
  onShow,
  onHide,
  hideLabel,
  showLabel,
}: {
  label: string;
  visible: boolean;
  onShow: () => void;
  onHide: () => void;
  hideLabel: string;
  showLabel: string;
}) {
  if (visible) {
    return (
      <button
        type="button"
        onClick={onHide}
        className="reson-manifest-column-chip"
        aria-label={hideLabel}
        title={hideLabel}
      >
        <span>{label}</span>
        <X className="w-3 h-3 shrink-0 opacity-70" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onShow}
      className="reson-manifest-column-chip-add"
      aria-label={showLabel}
      title={showLabel}
    >
      <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

interface Sample {
  id: string;
  file_path: string;
  duration: number;
  reference: string;
  hypothesis: string;
  wer: number;
  cer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
  diff_tokens?: Array<{ word: string; type: "equal" | "ins" | "del" | "sub_del" | "sub_ins" }>;
  words?: Array<{
    word: string;
    error_type: string;
    recall: number;
    precision: number;
    f1: number;
    wis: number;
  }>;
  metadata?: {
    ler?: number;
    wer_h?: number;
    [key: string]: any;
  };
}

interface ModelResults {
  modelName: string;
  displayName: string;
  samples: Sample[];
}

interface ManifestProps {
  modelResults: ModelResults[];
  initialFilterIds?: string[];
  baseModel: string | null;
  targetModel: string | null;
  optionalModels: string[];
  sliceFilters: AnalyticsSliceFilters;
  onSliceFiltersChange: (patch: Partial<AnalyticsSliceFilters>) => void;
  onFiltersPanelChange?: (isOpen: boolean) => void;
  onSampleDetailChange?: (isOpen: boolean) => void;
}

type ErrorFilter = "all" | "with_errors" | "no_errors";

export function Manifest({ modelResults, initialFilterIds, baseModel, targetModel, optionalModels, sliceFilters, onSliceFiltersChange, onFiltersPanelChange, onSampleDetailChange }: ManifestProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { durationFilter, modelComparisonFilter, selectedModelForComparison } =
    sliceFilters;
  const [searchQuery, setSearchQuery] = useState("");
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSample, setSelectedSample] = useState<{
    samples: Map<string, Sample>;
    id: string;
    modelResults: ModelResults[];
  } | null>(null);
  const [filterIds, setFilterIds] = useState<string[]>(initialFilterIds || []);
  const [sortBy, setSortBy] = useState<string>("none");
  const [copiedIds, setCopiedIds] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyClass | "all">("all");
  const [werRange, setWerRange] = useState<[number, number] | null>(null);
  const [stdDevRange, setStdDevRange] = useState<[number, number] | null>(null);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"manifest" | "oracle">("manifest");
  const [showModelColumns, setShowModelColumns] = useState(true);
  const [showLeaderColumns, setShowLeaderColumns] = useState(true);

  useEffect(() => {
    setFilterIds(initialFilterIds || []);
  }, [initialFilterIds]);

  // Notify parent when filters panel state changes
  useEffect(() => {
    onFiltersPanelChange?.(isFiltersPanelOpen);
  }, [isFiltersPanelOpen, onFiltersPanelChange]);

  // Notify parent when sample detail state changes
  useEffect(() => {
    onSampleDetailChange?.(!!selectedSample);
  }, [selectedSample, onSampleDetailChange]);

  // Create list of selected model names
  const selectedModelNames = useMemo(() => {
    const selected = new Set<string>();
    if (baseModel) selected.add(baseModel);
    if (targetModel) selected.add(targetModel);
    optionalModels.forEach(model => selected.add(model));
    return selected;
  }, [baseModel, targetModel, optionalModels]);

  const selectedModelsList = useMemo(
    () => buildSelectedModelsList(baseModel, targetModel, optionalModels),
    [baseModel, targetModel, optionalModels],
  );

  const tableModels = useMemo(() => {
    const order: ModelResults[] = [];
    const add = (name: string | null) => {
      if (!name || !selectedModelNames.has(name)) return;
      const model = modelResults.find((entry) => entry.modelName === name);
      if (model && !order.some((entry) => entry.modelName === name)) order.push(model);
    };
    add(baseModel);
    add(targetModel);
    optionalModels.forEach(add);
    modelResults.forEach((model) => {
      if (selectedModelNames.has(model.modelName) && !order.some((entry) => entry.modelName === model.modelName)) {
        order.push(model);
      }
    });
    return order;
  }, [modelResults, selectedModelNames, baseModel, targetModel, optionalModels]);

  const hasMultiModelColumns = selectedModelNames.size >= 2;

  const tableColumnCount = useMemo(() => {
    let count = 5;
    if (hasMultiModelColumns) count += 2;
    if (showLeaderColumns) count += 2;
    if (showModelColumns) count += tableModels.length;
    return count;
  }, [hasMultiModelColumns, showLeaderColumns, showModelColumns, tableModels.length]);

  // Helper to get sort icon
  const getSortIcon = (column: string, ascValue: string, descValue: string) => {
    if (sortBy === ascValue) {
      return <ArrowUp className="w-3 h-3 text-orange-500" />;
    } else if (sortBy === descValue) {
      return <ArrowDown className="w-3 h-3 text-orange-500" />;
    } else {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground" />;
    }
  };

  // Merge samples from selected models only
  const mergedSamples = useMemo(() => {
    if (modelResults.length === 0) return [];

    const sampleMap = new Map<string, {
      id: string;
      modelData: Map<string, Sample>;
    }>();

    // Filter to only selected models
    const selectedModelResults = modelResults.filter(mr => selectedModelNames.has(mr.modelName));

    selectedModelResults.forEach((modelResult) => {
      modelResult.samples.forEach((sample) => {
        if (!sampleMap.has(sample.id)) {
          sampleMap.set(sample.id, {
            id: sample.id,
            modelData: new Map(),
          });
        }
        sampleMap.get(sample.id)!.modelData.set(modelResult.modelName, sample);
      });
    });

    return Array.from(sampleMap.values());
  }, [modelResults, selectedModelNames]);

  // Calculate WER min/max for range slider (only selected models)
  // Note: mergedSamples already contains only selected models in modelData
  const { werMin, werMax } = useMemo(() => {
    if (mergedSamples.length === 0) return { werMin: 0, werMax: 100 };
    
    const avgWers = mergedSamples.map(s => {
      // mergedSamples.modelData already contains only selected models
      const wers = Array.from(s.modelData.values()).map(sample => sample.wer);
      if (wers.length === 0) return 0;
      return wers.reduce((sum, wer) => sum + wer, 0) / wers.length;
    });
    
    return {
      werMin: Math.floor(Math.min(...avgWers)),
      werMax: Math.ceil(Math.max(...avgWers))
    };
  }, [mergedSamples]);

  // Calculate StdDev min/max for range slider (only selected models)
  // Note: mergedSamples already contains only selected models in modelData
  const { stdDevMin, stdDevMax } = useMemo(() => {
    if (mergedSamples.length === 0 || selectedModelNames.size < 2) return { stdDevMin: 0, stdDevMax: 10 };
    
    const stdDevs = mergedSamples.map(s => {
      // mergedSamples.modelData already contains only selected models
      const wers = Array.from(s.modelData.values()).map(sample => sample.wer);
      if (wers.length < 2) return 0;
      const mean = wers.reduce((sum, wer) => sum + wer, 0) / wers.length;
      const variance = wers.reduce((sum, wer) => sum + Math.pow(wer - mean, 2), 0) / wers.length;
      return Math.sqrt(variance);
    });
    
    return {
      stdDevMin: Math.floor(Math.min(...stdDevs)),
      stdDevMax: Math.ceil(Math.max(...stdDevs))
    };
  }, [mergedSamples, selectedModelNames]);

  const durationSliceSampleIds = useMemo(() => {
    if (mergedSamples.length === 0 || selectedModelNames.size < 2) {
      return null;
    }

    return computeAllowedSampleIds(
      mergedSamples.map((sample) => {
        const firstSample = Array.from(sample.modelData.values())[0];
        return {
          id: sample.id,
          duration: firstSample?.duration ?? 0,
          getWer: (modelName: string) => sample.modelData.get(modelName)?.wer,
        };
      }),
      selectedModelsList,
      stripModelComparisonFilters(sliceFilters),
    );
  }, [mergedSamples, selectedModelNames, selectedModelsList, sliceFilters]);

  // Cluster labels: duration slice only (model comparison is a separate table filter)
  const sampleDifficultyMap = useMemo(() => {
    const map = new Map<string, DifficultyClass | null>();

    if (
      mergedSamples.length === 0 ||
      selectedModelNames.size < 2 ||
      !durationSliceSampleIds ||
      durationSliceSampleIds.size === 0
    ) {
      mergedSamples.forEach((sample) => map.set(sample.id, null));
      return map;
    }

    const sliceSamples = mergedSamples.filter((sample) =>
      durationSliceSampleIds.has(sample.id),
    );

    const { classificationById } = buildSampleDifficultyClassification(
      sliceSamples.map((sample) => ({
        id: sample.id,
        wers: Array.from(sample.modelData.values()).map((entry) => entry.wer),
      })),
    );

    mergedSamples.forEach((sample) => {
      map.set(sample.id, classificationById.get(sample.id) ?? null);
    });

    return map;
  }, [mergedSamples, selectedModelNames, durationSliceSampleIds]);

  // Fast lookup for difficulty class (PERFORMANCE OPTIMIZATION)
  const getDifficultyClass = useCallback((mergedSample: { id: string; modelData: Map<string, Sample> }): DifficultyClass | null => {
    return sampleDifficultyMap.get(mergedSample.id) || null;
  }, [sampleDifficultyMap]);

  // Pre-compute stats for each sample (PERFORMANCE OPTIMIZATION) - only selected models
  const sampleStatsMap = useMemo(() => {
    const map = new Map<string, { avgWER: number; stdDev: number; duration: number; hasError: boolean }>();
    
    mergedSamples.forEach(mergedSample => {
      // mergedSamples.modelData already contains only selected models
      const samples = Array.from(mergedSample.modelData.values());
      if (samples.length === 0) {
        map.set(mergedSample.id, {
          avgWER: 0,
          stdDev: 0,
          duration: 0,
          hasError: false
        });
        return;
      }

      const firstSample = samples[0];
      const wers = samples.map(s => s.wer);

      const avgWER = wers.reduce((sum, wer) => sum + wer, 0) / wers.length;
      
      let stdDev = 0;
      if (wers.length >= 2) {
        const variance = wers.reduce((sum, wer) => sum + Math.pow(wer - avgWER, 2), 0) / wers.length;
        stdDev = Math.sqrt(variance);
      }

      const hasError = wers.some(wer => wer > 0);

      map.set(mergedSample.id, {
        avgWER,
        stdDev,
        duration: firstSample.duration,
        hasError
      });
    });

    return map;
  }, [mergedSamples, selectedModelNames]);

  // Filter samples (optimized with pre-computed stats)
  const filteredSamples = useMemo(() => {
    return mergedSamples.filter((mergedSample) => {
      // Filter by IDs
      if (filterIds.length > 0 && !filterIds.includes(mergedSample.id)) {
        return false;
      }

      // mergedSamples.modelData already contains only selected models
      const samples = Array.from(mergedSample.modelData.values());
      if (samples.length === 0) return false;
      
      const firstSample = samples[0];

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesText = 
          firstSample.reference?.toLowerCase().includes(query) ||
          firstSample.id.toLowerCase().includes(query) ||
          firstSample.file_path?.toLowerCase().includes(query);
        
        if (!matchesText) return false;
      }

      const stats = sampleStatsMap.get(mergedSample.id);
      if (!stats) return false;

      // Duration filter (shared slice with Analytics)
      if (durationFilter !== "all") {
        if (!matchesDurationFilter(stats.duration, durationFilter)) return false;
      }

      // Error filter
      if (errorFilter !== "all") {
        if (errorFilter === "with_errors" && !stats.hasError) return false;
        if (errorFilter === "no_errors" && stats.hasError) return false;
      }

      // Difficulty filter
      if (difficultyFilter !== "all" && modelResults.length >= 2) {
        const diffClass = getDifficultyClass(mergedSample);
        if (diffClass !== difficultyFilter) return false;
      }

      // WER Range filter
      if (werRange) {
        if (stats.avgWER < werRange[0] || stats.avgWER > werRange[1]) return false;
      }

      // StdDev Range filter
      if (stdDevRange && modelResults.length >= 2) {
        if (stats.stdDev < stdDevRange[0] || stats.stdDev > stdDevRange[1]) return false;
      }

      // Model Comparison filter (exclusive best / worst — same as Analytics)
      if (modelComparisonFilter !== "all" && selectedModelForComparison) {
        const modelWers = Object.fromEntries(
          selectedModelsList.map((modelName) => [
            modelName,
            mergedSample.modelData.get(modelName)?.wer,
          ]),
        ) as Record<string, number | undefined>;

        if (
          !sampleMatchesModelComparisonFilter(
            modelWers,
            selectedModelsList,
            sliceFilters,
          )
        ) {
          return false;
        }
      }

      return true;
    });
  }, [mergedSamples, filterIds, searchQuery, durationFilter, errorFilter, difficultyFilter, werRange, stdDevRange, modelComparisonFilter, selectedModelForComparison, modelResults, sampleStatsMap, getDifficultyClass, sliceFilters, selectedModelsList]);

  // Apply sorting (optimized with pre-computed stats)
  const sortedSamples = useMemo(() => {
    if (sortBy === "none") return filteredSamples;

    return [...filteredSamples].sort((a, b) => {
      const statsA = sampleStatsMap.get(a.id);
      const statsB = sampleStatsMap.get(b.id);
      
      if (!statsA || !statsB) return 0;

      if (sortBy === "wer_asc") return statsA.avgWER - statsB.avgWER;
      if (sortBy === "wer_desc") return statsB.avgWER - statsA.avgWER;
      if (sortBy === "stddev_asc") return statsA.stdDev - statsB.stdDev;
      if (sortBy === "stddev_desc") return statsB.stdDev - statsA.stdDev;
      if (sortBy === "duration_asc") return statsA.duration - statsB.duration;
      if (sortBy === "duration_desc") return statsB.duration - statsA.duration;

      return 0;
    });
  }, [filteredSamples, sortBy]);

  // Paginate
  const paginatedSamples = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedSamples.slice(startIndex, startIndex + pageSize);
  }, [sortedSamples, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedSamples.length / pageSize));

  const globalHighlightThresholds = useMemo(() => {
    const allAvgWers = mergedSamples
      .map((sample) => sampleStatsMap.get(sample.id)?.avgWER ?? 0)
      .sort((a, b) => a - b);
    const allStdDevs = mergedSamples
      .map((sample) => sampleStatsMap.get(sample.id)?.stdDev ?? 0)
      .sort((a, b) => a - b);

    return {
      highWERThreshold: allAvgWers[Math.floor(allAvgWers.length * 0.75)] ?? 0,
      highStdDevThreshold: allStdDevs[Math.floor(allStdDevs.length * 0.75)] ?? 0,
    };
  }, [mergedSamples, sampleStatsMap]);

  // Statistics (optimized with pre-computed stats)
  const stats = useMemo(() => {
    const totalSamples = filteredSamples.length;
    
    const modelStats = modelResults.map(modelResult => {
      const samplesForModel = filteredSamples.filter(s => s.modelData.has(modelResult.modelName));
      const totalWER = samplesForModel.reduce((sum, s) => {
        const sample = s.modelData.get(modelResult.modelName);
        return sum + (sample?.wer || 0);
      }, 0);
      return {
        modelName: modelResult.displayName,
        avgWER: samplesForModel.length > 0 ? totalWER / samplesForModel.length : 0,
        count: samplesForModel.length
      };
    });

    // Calculate average std dev (OPTIMIZED - use pre-computed values)
    let avgStdDev = 0;
    if (modelResults.length > 1 && filteredSamples.length > 0) {
      const stdDevsSum = filteredSamples.reduce((sum, s) => {
        const cached = sampleStatsMap.get(s.id);
        return sum + (cached?.stdDev || 0);
      }, 0);
      avgStdDev = stdDevsSum / filteredSamples.length;
    }

    // Calculate high WER threshold (75th percentile) - OPTIMIZED
    const allAvgWers = filteredSamples.map(s => {
      const cached = sampleStatsMap.get(s.id);
      return cached?.avgWER || 0;
    });
    allAvgWers.sort((a, b) => a - b);

    // Calculate high StdDev threshold (75th percentile) - OPTIMIZED
    const allStdDevs = filteredSamples.map(s => {
      const cached = sampleStatsMap.get(s.id);
      return cached?.stdDev || 0;
    });
    allStdDevs.sort((a, b) => a - b);

    // Difficulty stats (denominator = classifiable samples with 2+ models, as in Analytics)
    const difficultyStats = {
      "easy-consensus": 0,
      "easy-divergent": 0,
      "hard-consensus": 0,
      "hard-divergent": 0
    };
    let classifiableSamples = 0;
    
    if (modelResults.length >= 2) {
      filteredSamples.forEach(s => {
        const diffClass = getDifficultyClass(s);
        if (diffClass) {
          difficultyStats[diffClass]++;
          classifiableSamples++;
        }
      });
    }

    return { 
      totalSamples, 
      modelStats, 
      avgStdDev, 
      difficultyStats,
      classifiableSamples,
    };
  }, [filteredSamples, modelResults, sampleStatsMap, getDifficultyClass]);

  const activeFilterCount = useMemo(() => {
    return [
      searchQuery !== "",
      durationFilter !== "all",
      errorFilter !== "all",
      difficultyFilter !== "all",
      werRange !== null,
      stdDevRange !== null,
      modelComparisonFilter !== "all" && selectedModelForComparison !== null,
    ].filter(Boolean).length;
  }, [
    searchQuery,
    durationFilter,
    errorFilter,
    difficultyFilter,
    werRange,
    stdDevRange,
    modelComparisonFilter,
    selectedModelForComparison,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, durationFilter, errorFilter, sortBy, difficultyFilter, werRange, stdDevRange]);

  // Close panel on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFiltersPanelOpen) {
        setIsFiltersPanelOpen(false);
      }
    };
    
    if (isFiltersPanelOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when panel is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isFiltersPanelOpen]);

  const clearFilters = () => {
    setSearchQuery("");
    onSliceFiltersChange(DEFAULT_ANALYTICS_SLICE_FILTERS);
    setErrorFilter("all");
    setSortBy("none");
    setDifficultyFilter("all");
    setWerRange(null);
    setStdDevRange(null);
    setFilterIds([]);
  };

  const exportData = () => {
    // Build header with columns for each model (hypothesis and WER)
    const header = [
      "ID",
      "File Path", 
      "Duration",
      "Difficulty Class",
      "Reference",
      ...modelResults.flatMap(m => [`${m.displayName} Hypothesis`, `${m.displayName} WER`])
    ];
    
    const rows = filteredSamples.map(s => {
      const firstSample = Array.from(s.modelData.values())[0];
      const diffClass = modelResults.length >= 2 ? getDifficultyClass(s) : null;
      const diffLabel = diffClass ? getDifficultyInfo(diffClass).label : "N/A";
      
      return [
        s.id,
        firstSample?.file_path || "",
        firstSample?.duration?.toFixed(2) || "0",
        diffLabel,
        `"${(firstSample?.reference || "").replace(/"/g, '""')}"`, // Escape quotes in CSV
        ...modelResults.flatMap(m => {
          const sample = s.modelData.get(m.modelName);
          return [
            `"${(sample?.hypothesis || "N/A").replace(/"/g, '""')}"`, // Escape quotes
            sample?.wer?.toFixed(2) || "N/A"
          ];
        })
      ];
    });

    const csv = [header.join(","), ...rows.map(row => row.join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manifest_export.csv";
    a.click();
    
    // Show success toast
    toast.success("Данные экспортированы", {
      description: `Файл manifest_export.csv (${filteredSamples.length} записей)`,
    });
  };

  const exportJson = () => {
    const payload = filteredSamples.map((mergedSample) => {
      const firstSample = Array.from(mergedSample.modelData.values())[0];
      const diffClass = modelResults.length >= 2 ? getDifficultyClass(mergedSample) : null;
      const cached = sampleStatsMap.get(mergedSample.id);

      return {
        id: mergedSample.id,
        file_path: firstSample?.file_path ?? "",
        duration: firstSample?.duration ?? 0,
        reference: firstSample?.reference ?? "",
        difficulty_class: diffClass ? getDifficultyInfo(diffClass).label : null,
        avg_wer: cached?.avgWER ?? null,
        std_dev: cached?.stdDev ?? null,
        models: modelResults
          .filter((model) => selectedModelNames.has(model.modelName))
          .map((model) => {
            const sample = mergedSample.modelData.get(model.modelName);
            if (!sample) return null;
            return {
              model: model.displayName,
              model_name: model.modelName,
              wer: sample.wer,
              cer: sample.cer,
              insertions: sample.insertions,
              deletions: sample.deletions,
              substitutions: sample.substitutions,
              hypothesis: sample.hypothesis,
            };
          })
          .filter(Boolean),
      };
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "manifest_export.json";
    anchor.click();
    URL.revokeObjectURL(url);

    toast.success("JSON экспортирован", {
      description: `Файл manifest_export.json (${filteredSamples.length} записей)`,
    });
  };

  const copyFilteredAudioPaths = () => {
    const paths = filteredSamples
      .map((mergedSample) => {
        const firstSample = Array.from(mergedSample.modelData.values())[0];
        return firstSample?.file_path ?? mergedSample.id;
      })
      .join("\n");
    navigator.clipboard.writeText(paths);
    setCopiedIds(true);
    setTimeout(() => setCopiedIds(false), 2000);

    toast.success("Пути скопированы в буфер", {
      description: `${filteredSamples.length} путей к аудио текущего среза`,
    });
  };


  return (
    <>
      {/* Filters Sidebar Panel - Moved outside for proper fixed positioning */}
      {isFiltersPanelOpen && (
        <ManifestFiltersPanel
          isDark={isDark}
          onClose={() => setIsFiltersPanelOpen(false)}
          stats={stats}
          activeFilterCount={activeFilterCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          durationFilter={durationFilter}
          onDurationFilterChange={(value) =>
            onSliceFiltersChange({ durationFilter: value })
          }
          errorFilter={errorFilter}
          setErrorFilter={setErrorFilter}
          difficultyFilter={difficultyFilter}
          setDifficultyFilter={setDifficultyFilter}
          werRange={werRange}
          setWerRange={setWerRange}
          werMin={werMin}
          werMax={werMax}
          stdDevRange={stdDevRange}
          setStdDevRange={setStdDevRange}
          stdDevMin={stdDevMin}
          stdDevMax={stdDevMax}
          modelComparisonFilter={modelComparisonFilter}
          onModelComparisonFilterChange={(value) =>
            onSliceFiltersChange({ modelComparisonFilter: value })
          }
          selectedModelForComparison={selectedModelForComparison}
          onSelectedModelForComparisonChange={(value) =>
            onSliceFiltersChange({ selectedModelForComparison: value })
          }
          modelResults={modelResults}
          clearFilters={clearFilters}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <SectionHeader
          variant="manifest"
          title="Манифест"
          description="Детальный обзор всех записей в датасете с возможностью фильтрации и экспорта данных"
          icon={<FileText />}
        />

        <div
          className="reson-analytics-sticky-bar p-4 mb-4 space-y-3"
          data-tour="manifest-sticky-bar"
        >
          <div className="flex flex-wrap gap-2" data-tour="manifest-tabs">
            <button
              type="button"
              onClick={() => setActiveTab("manifest")}
              className={resonManifestSubtabClass(activeTab === "manifest", isDark)}
              data-tour="manifest-tab-interactive"
            >
              <FileText className="w-4 h-4" />
              Интерактивный манифест
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("oracle")}
              className={resonManifestSubtabClass(activeTab === "oracle", isDark)}
              data-tour="manifest-tab-oracle"
            >
              <Trophy className="w-4 h-4" />
              Oracle WER
            </button>
          </div>

          <p className="reson-analytics-tab-desc">{MANIFEST_TAB_DESCRIPTIONS[activeTab]}</p>

          <div className="reson-slice-toolbar">
            <div className="reson-slice-toolbar-left">
              <HeaderActionButton
                variant="manifest"
                compact
                title="Фильтры манифеста"
                hint="Настроить срез"
                statusLabel={
                  activeFilterCount > 0
                    ? `${activeFilterCount} активно · ${stats.totalSamples} записей`
                    : `${stats.totalSamples} записей`
                }
                showStatus
                icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                onClick={() => setIsFiltersPanelOpen(true)}
                pressed={isFiltersPanelOpen}
                ariaLabel="Фильтры манифеста"
                dataTour="manifest-filters-button"
              />
            </div>
          </div>
        </div>

        {activeTab === "oracle" ? (
          <OracleManifestSummary
            modelResults={modelResults}
            selectedModelNames={selectedModelNames}
            filteredSampleIds={filteredSamples.map((sample) => sample.id)}
            activeFilterCount={activeFilterCount}
          />
        ) : (
          <div className="space-y-4">
            {activeFilterCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs ${RESON_ANALYTICS_SUBTITLE}`}>Активные фильтры:</span>
                {searchQuery ? (
                  <button type="button" onClick={() => setSearchQuery("")} className={RESON_MANIFEST_ACTIVE_FILTER_TAG}>
                    Поиск: {searchQuery} <X className="w-3 h-3" />
                  </button>
                ) : null}
                {durationFilter !== "all" ? (
                  <button type="button" onClick={() => onSliceFiltersChange({ durationFilter: "all" })} className={RESON_MANIFEST_ACTIVE_FILTER_TAG}>
                    {durationFilter === "short" ? "Короткие" : durationFilter === "normal" ? "Средние" : "Длинные"} <X className="w-3 h-3" />
                  </button>
                ) : null}
                {errorFilter !== "all" ? (
                  <button type="button" onClick={() => setErrorFilter("all")} className={RESON_MANIFEST_ACTIVE_FILTER_TAG}>
                    {errorFilter === "with_errors" ? "С ошибками" : "Без ошибок"} <X className="w-3 h-3" />
                  </button>
                ) : null}
                {difficultyFilter !== "all" ? (
                  <button type="button" onClick={() => setDifficultyFilter("all")} className={RESON_MANIFEST_ACTIVE_FILTER_TAG}>
                    {getDifficultyInfo(difficultyFilter).label} <X className="w-3 h-3" />
                  </button>
                ) : null}
                {werRange ? (
                  <button type="button" onClick={() => setWerRange(null)} className={`${RESON_MANIFEST_ACTIVE_FILTER_TAG} tabular-nums`}>
                    WER {werRange[0].toFixed(1)}–{werRange[1].toFixed(1)}% <X className="w-3 h-3" />
                  </button>
                ) : null}
                {stdDevRange ? (
                  <button type="button" onClick={() => setStdDevRange(null)} className={`${RESON_MANIFEST_ACTIVE_FILTER_TAG} tabular-nums`}>
                    σ {stdDevRange[0].toFixed(1)}–{stdDevRange[1].toFixed(1)} <X className="w-3 h-3" />
                  </button>
                ) : null}
                {modelComparisonFilter !== "all" && selectedModelForComparison ? (
                  <button type="button" onClick={() => onSliceFiltersChange({ modelComparisonFilter: "all", selectedModelForComparison: null })} className={RESON_MANIFEST_ACTIVE_FILTER_TAG}>
                    {modelResults.find(m => m.modelName === selectedModelForComparison)?.displayName}: {modelComparisonFilter === "best" ? "лучшая" : "худшая"} <X className="w-3 h-3" />
                  </button>
                ) : null}
                <button type="button" onClick={clearFilters} className="text-xs text-orange-500 hover:underline">
                  Сбросить все
                </button>
              </div>
            ) : null}

            <div className={`${RESON_ANALYTICS_CHART_CARD} reson-manifest-table-section`} data-tour="manifest-table">
              <div className="reson-manifest-table-head">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <p className={RESON_ANALYTICS_SUBTITLE}>
                    {stats.totalSamples} записей · клик по строке открывает детализацию с diff и аудио
                  </p>
                  <div className="reson-manifest-table-toolbar shrink-0">
                    <div className="reson-manifest-column-toggles">
                      <ManifestColumnToggle
                        label="Лучшая / Худшая"
                        visible={showLeaderColumns}
                        onShow={() => setShowLeaderColumns(true)}
                        onHide={() => setShowLeaderColumns(false)}
                        hideLabel="Скрыть столбцы «Лучшая / Худшая»"
                        showLabel="Показать столбцы «Лучшая / Худшая»"
                      />
                      {tableModels.length > 0 ? (
                        <ManifestColumnToggle
                          label="WER моделей"
                          visible={showModelColumns}
                          onShow={() => setShowModelColumns(true)}
                          onHide={() => setShowModelColumns(false)}
                          hideLabel="Скрыть столбцы WER моделей"
                          showLabel="Показать столбцы WER моделей"
                        />
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyFilteredAudioPaths}
                      className={isDark ? "border-[#2A2D35] bg-[#23262F] hover:bg-[#2A2D35]" : ""}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copiedIds ? "Скопировано" : `Скопировать пути к аудио (${filteredSamples.length})`}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportData}
                      disabled={filteredSamples.length === 0}
                      className={isDark ? "border-[#2A2D35] bg-[#23262F] hover:bg-[#2A2D35]" : ""}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Экспорт CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportJson}
                      disabled={filteredSamples.length === 0}
                      className={isDark ? "border-[#2A2D35] bg-[#23262F] hover:bg-[#2A2D35]" : ""}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Экспорт JSON
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className={isDark ? "border-[#2A2D35] hover:bg-transparent" : "border-gray-200 hover:bg-transparent"}>
                <TableHead className={`w-12 ${RESON_ANALYTICS_SUBTITLE}`}>#</TableHead>
                <TableHead className={`min-w-[160px] ${RESON_ANALYTICS_SUBTITLE}`}>
                  <div className="flex items-center gap-2">
                    <span>Запись</span>
                  </div>
                </TableHead>
                <TableHead className={`w-20 ${RESON_ANALYTICS_SUBTITLE}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 hover:bg-transparent"
                    onClick={() => {
                      if (sortBy === "duration_asc") setSortBy("duration_desc");
                      else if (sortBy === "duration_desc") setSortBy("none");
                      else setSortBy("duration_asc");
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Длит.</span>
                      {getSortIcon("duration", "duration_asc", "duration_desc")}
                    </div>
                  </Button>
                </TableHead>
                <TableHead className={`w-28 ${RESON_ANALYTICS_SUBTITLE}`}>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 hover:bg-transparent"
                      onClick={() => {
                        if (sortBy === "wer_asc") setSortBy("wer_desc");
                        else if (sortBy === "wer_desc") setSortBy("none");
                        else setSortBy("wer_asc");
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>WER</span>
                        {getSortIcon("wer", "wer_asc", "wer_desc")}
                      </div>
                    </Button>
                  </div>
                </TableHead>
                {hasMultiModelColumns && (
                  <TableHead className={`w-28 ${RESON_ANALYTICS_SUBTITLE}`}>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => {
                          if (sortBy === "stddev_asc") setSortBy("stddev_desc");
                          else if (sortBy === "stddev_desc") setSortBy("none");
                          else setSortBy("stddev_asc");
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span>Расх.</span>
                          {getSortIcon("stddev", "stddev_asc", "stddev_desc")}
                        </div>
                      </Button>
                    </div>
                  </TableHead>
                )}
                {hasMultiModelColumns && (
                  <TableHead className={`w-28 ${RESON_ANALYTICS_SUBTITLE}`}>Кластер</TableHead>
                )}
                {showLeaderColumns && (
                  <>
                <TableHead className={`min-w-[120px] ${RESON_ANALYTICS_SUBTITLE}`}>Лучшая</TableHead>
                <TableHead className={`min-w-[120px] ${RESON_ANALYTICS_SUBTITLE}`}>Худшая</TableHead>
                  </>
                )}
                {showModelColumns &&
                  tableModels.map((model) => (
                    <TableHead key={model.modelName} className={`w-24 ${RESON_ANALYTICS_SUBTITLE}`} title={model.displayName}>
                      <span className="block truncate">{model.displayName}</span>
                    </TableHead>
                  ))}
                <TableHead className={`w-16 ${RESON_ANALYTICS_SUBTITLE}`}>
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSamples.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} className="py-16">
                    <div className={`${RESON_ANALYTICS_INNER_CARD} flex flex-col items-center justify-center space-y-4 text-center`}>
                      <Search className={`w-10 h-10 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                      <div className="space-y-2 max-w-md">
                        <h3 className={RESON_ANALYTICS_SECTION_TITLE}>Записи не найдены</h3>
                        <p className={RESON_ANALYTICS_SUBTITLE}>
                          {(durationFilter !== "all" || errorFilter !== "all" || difficultyFilter !== "all" || werRange || stdDevRange || searchQuery)
                            ? "Попробуйте изменить или сбросить фильтры"
                            : "Нет данных для отображения"}
                        </p>
                        {(durationFilter !== "all" || errorFilter !== "all" || difficultyFilter !== "all" || werRange || stdDevRange || searchQuery) && (
                          <div className="pt-2">
                            <p className="text-xs text-muted-foreground mb-2">Активные фильтры:</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                              {searchQuery && (
                                <Badge variant="secondary" className="text-xs">
                                  Поиск: "{searchQuery}"
                                </Badge>
                              )}
                              {durationFilter !== "all" && (
                                <Badge variant="secondary" className="text-xs">
                                  Длительность: {durationFilter === "short" ? "Короткие" : durationFilter === "normal" ? "Средние" : "Длинные"}
                                </Badge>
                              )}
                              {errorFilter !== "all" && (
                                <Badge variant="secondary" className="text-xs">
                                  {errorFilter === "with_errors" ? "С ошибками" : "Без ошибок"}
                                </Badge>
                              )}
                              {difficultyFilter !== "all" && (
                                <Badge variant="secondary" className="text-xs">
                                  Сложность: {getDifficultyInfo(difficultyFilter as DifficultyClass).label}
                                </Badge>
                              )}
                              {werRange && (
                                <Badge variant="secondary" className="text-xs">
                                  WER: {werRange[0]}-{werRange[1]}%
                                </Badge>
                              )}
                              {stdDevRange && (
                                <Badge variant="secondary" className="text-xs">
                                  StdDev: {stdDevRange[0].toFixed(1)}-{stdDevRange[1].toFixed(1)}
                                </Badge>
                              )}
                              {modelComparisonFilter !== "all" && selectedModelForComparison && (
                                <Badge variant="secondary" className="text-xs">
                                  {modelResults.find(m => m.modelName === selectedModelForComparison)?.displayName}: {modelComparisonFilter === "best" ? "Лучшая" : "Худшая"}
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                              className="mt-4"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Сбросить все фильтры
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSamples.map((mergedSample, index) => {
                  // mergedSamples.modelData already contains only selected models
                  const samples = Array.from(mergedSample.modelData.values());
                  if (samples.length === 0) return null;
                  
                  const firstSample = samples[0];

                  // Use pre-computed stats (PERFORMANCE OPTIMIZATION)
                  const stats_cached = sampleStatsMap.get(mergedSample.id);
                  if (!stats_cached) return null;
                  
                  const avgWER = stats_cached.avgWER;
                  const stdDev = stats_cached.stdDev;

                  // Still need wers array for min/max display and best/worst model lookup
                  const wers = Array.from(mergedSample.modelData.values()).map(s => s.wer);

                  const difficultyClass = selectedModelNames.size >= 2 ? getDifficultyClass(mergedSample) : null;
                  const difficultyInfo = getDifficultyInfo(difficultyClass);

                  const minWER = Math.min(...wers);
                  const maxWER = Math.max(...wers);

                  return (
                    <React.Fragment key={mergedSample.id}>
                      <TableRow 
                        className={`cursor-pointer transition-colors ${
                          isDark ? "border-[#2A2D35] hover:bg-[#23262F]" : "border-gray-100 hover:bg-gray-50"
                        } ${
                          difficultyClass === "easy-consensus" ? "border-l-2 border-l-emerald-500 bg-emerald-500/[0.03]" :
                          difficultyClass === "easy-divergent" ? "border-l-2 border-l-yellow-500 bg-yellow-500/[0.03]" :
                          difficultyClass === "hard-consensus" ? "border-l-2 border-l-orange-500 bg-orange-500/[0.03]" :
                          difficultyClass === "hard-divergent" ? "border-l-2 border-l-red-500 bg-red-500/[0.03]" : ""
                        }`}
                        onClick={() => setSelectedSample({ 
                          samples: mergedSample.modelData, 
                          id: mergedSample.id,
                          modelResults
                        })}
                      >
                        <TableCell className="tabular-nums text-muted-foreground">
                          {(currentPage - 1) * pageSize + index + 1}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                              <FileAudio className="w-4 h-4 text-muted-foreground shrink-0" />
                            <code className={`text-xs px-1.5 py-0.5 rounded ${
                              isDark ? "bg-[#23262F] text-gray-300" : "bg-gray-100 text-gray-800"
                            }`}>
                              {firstSample.file_path.split('/').pop() || firstSample.file_path.split('\\').pop() || firstSample.file_path}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {firstSample.duration.toFixed(1)}s
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-orange-500">
                                {avgWER.toFixed(2)}%
                              </span>
                              {avgWER > globalHighlightThresholds.highWERThreshold && (
                                <InlineHelpTooltip
                                  content={
                                    <p>
                                      WER выше p75 по всему датасету (
                                      {globalHighlightThresholds.highWERThreshold.toFixed(2)}%)
                                    </p>
                                  }
                                >
                                  <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30 cursor-help">
                                    высокий
                                  </Badge>
                                </InlineHelpTooltip>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {Math.min(...wers).toFixed(2)}% - {Math.max(...wers).toFixed(2)}%
                            </div>
                          </div>
                        </TableCell>
                        {hasMultiModelColumns && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`tabular-nums ${RESON_MANIFEST_ACCENT_TEXT}`}>
                                {stdDev.toFixed(2)}
                              </span>
                              {stdDev > globalHighlightThresholds.highStdDevThreshold && (
                                <InlineHelpTooltip
                                  content={
                                    <p>
                                      Расхождение выше p75 по всему датасету (
                                      {globalHighlightThresholds.highStdDevThreshold.toFixed(2)})
                                    </p>
                                  }
                                >
                                  <Badge variant="outline" className={`text-xs ${RESON_MANIFEST_ACCENT_BADGE} cursor-help`}>
                                    высокий
                                  </Badge>
                                </InlineHelpTooltip>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {hasMultiModelColumns && (
                          <TableCell>
                            {difficultyClass ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${difficultyInfo.badgeClass}`}
                                title={difficultyInfo.label}
                              >
                                <span className={`w-2 h-2 rounded-full ${difficultyInfo.dotClass}`} />
                                {difficultyInfo.shortLabel}
                              </span>
                            ) : (
                              <span className={`text-xs ${RESON_ANALYTICS_SUBTITLE}`}>—</span>
                            )}
                          </TableCell>
                        )}
                        {showLeaderColumns && (
                          <>
                        <TableCell>
                          {(() => {
                            const selectedCount = wers.length;
                            const allEqual = minWER === maxWER;

                            if (allEqual) {
                              return (
                                <div className="flex items-center gap-2">
                                  <InlineHelpTooltip
                                    content={
                                      <p>
                                        Все модели показали одинаковый WER ({minWER.toFixed(2)}%)
                                      </p>
                                    }
                                  >
                                    <span className="text-xs text-muted-foreground italic cursor-help">
                                      все равны
                                    </span>
                                  </InlineHelpTooltip>
                                  {minWER === 0 && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  )}
                                </div>
                              );
                            }

                            const bestModels = getModelsAtWer(
                              modelResults,
                              selectedModelNames,
                              mergedSample.modelData,
                              minWER,
                            );
                            const label = bestModels.map((model) => model.displayName).join(", ");
                            const isTie = bestModels.length > 1;

                            return (
                              <div className="flex items-center gap-2 min-w-0">
                                <InlineHelpTooltip
                                  content={
                                    <p>
                                      {isTie
                                        ? `Ничья за лучший результат (${bestModels.length} модели, WER ${minWER.toFixed(2)}%)`
                                        : "Лучшая модель (мин. WER)"}
                                    </p>
                                  }
                                >
                                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0 cursor-help" />
                                </InlineHelpTooltip>
                                <span className={`text-sm truncate ${isTie ? "italic" : ""}`} title={label}>
                                  {label || "—"}
                                </span>
                                {minWER === 0 && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const allEqual = minWER === maxWER;

                            if (allEqual) {
                              return (
                                <span className="text-xs text-muted-foreground italic">все равны</span>
                              );
                            }

                            const worstModels = getModelsAtWer(
                              modelResults,
                              selectedModelNames,
                              mergedSample.modelData,
                              maxWER,
                            );
                            const label = worstModels.map((model) => model.displayName).join(", ");
                            const isTie = worstModels.length > 1;

                            return isTie ? (
                              <InlineHelpTooltip
                                content={
                                  <p>
                                    Ничья за худший результат ({worstModels.length} модели, WER{" "}
                                    {maxWER.toFixed(2)}%)
                                  </p>
                                }
                              >
                                <span
                                  className={`text-sm truncate block italic cursor-help ${isTie ? "italic" : ""}`}
                                  title={label}
                                >
                                  {label || "—"}
                                </span>
                              </InlineHelpTooltip>
                            ) : (
                              <span className="text-sm truncate block" title={label}>
                                {label || "—"}
                              </span>
                            );
                          })()}
                        </TableCell>
                          </>
                        )}
                        {showModelColumns &&
                          tableModels.map((model) => {
                            const sample = mergedSample.modelData.get(model.modelName);
                            const wer = sample?.wer;
                            const isBest = wer !== undefined && wer === minWER && minWER !== maxWER;
                            const isWorst = wer !== undefined && wer === maxWER && minWER !== maxWER;
                            return (
                              <TableCell key={model.modelName} className="tabular-nums">
                                {wer !== undefined ? (
                                  <span className={
                                    isBest ? "text-emerald-600 font-semibold"
                                    : isWorst ? "text-red-600 font-semibold"
                                    : "text-orange-500"
                                  }>
                                    {wer.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className={RESON_ANALYTICS_SUBTITLE}>—</span>
                                )}
                              </TableCell>
                            );
                          })}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSample({ 
                                samples: mergedSample.modelData, 
                                id: mergedSample.id,
                                modelResults
                              });
                            }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
              </div>

              {sortedSamples.length > 0 && (
                <div className="reson-vocab-pagination px-5 py-4 border-t border-gray-200 dark:border-[#2A2D35]">
                  <PageSizeSelect
                    value={pageSize}
                    onChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    id="manifest-page-size"
                  />
                  <div className="reson-vocab-pagination-controls">
                    <button
                      type="button"
                      className="reson-vocab-page-btn"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Предыдущая
                    </button>
                    <span>
                      Страница {currentPage} из {totalPages}
                      {" · "}
                      {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sortedSamples.length)} из {sortedSamples.length}
                    </span>
                    <button
                      type="button"
                      className="reson-vocab-page-btn"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Следующая
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedSample ? (
          <ManifestSampleDetail
            selectedSample={selectedSample}
            onClose={() => setSelectedSample(null)}
            isDark={isDark}
            baseModel={baseModel}
            targetModel={targetModel}
            optionalModels={optionalModels}
            selectedModelNames={selectedModelNames}
            difficultyClass={
              selectedModelNames.size >= 2
                ? getDifficultyClass({ id: selectedSample.id, modelData: selectedSample.samples })
                : null
            }
          />
        ) : null}

      </div>
    </>
  );
}
