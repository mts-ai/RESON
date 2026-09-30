import { useMemo, useState, type CSSProperties } from "react";
import { LayoutGrid } from "./icons";
import { useTheme } from "./ThemeProvider";
import { AnalyticsChartHeader } from "./AnalyticsChartHeader";
import {
  RESON_ANALYTICS_INNER_CARD,
  RESON_ANALYTICS_SECTION_TITLE,
  RESON_ANALYTICS_SUBTITLE,
  RESON_CLUSTER_CARD_COUNT,
  RESON_CLUSTER_CARD_COUNT_SUFFIX,
  RESON_CLUSTER_CARD_DESC,
  RESON_CLUSTER_CARD_LABEL,
  RESON_CLUSTER_CARD_PERCENT,
  RESON_CLUSTER_MANIFEST_BTN,
} from "../styles/reportStyles";
import type { AnalyticsSliceStat } from "../utils/analyticsModelProfile";
import {
  classifySampleDifficulty,
  computeDifficultyThresholds,
  computeSampleDifficultyMetrics,
} from "../utils/sampleDifficultyClusters";
import {
  getExclusiveBestWinner,
  getModelWerEntries,
} from "../utils/analyticsSlice";

interface ModelInfo {
  name: string;
  displayName: string;
}

interface ClusterSample {
  audio_filepath: string;
  duration: number;
  wer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
}

interface ClusterSliceStat extends Omit<AnalyticsSliceStat, "samples"> {
  samples: ClusterSample[];
}

interface AnalyticsSampleDifficultyProps {
  sliceStats: ClusterSliceStat[];
  availableModels: ModelInfo[];
  baseModel: string | null;
  targetModel: string | null;
  onViewInManifest?: (sampleIds: string[]) => void;
}

interface SampleDifficultyPoint {
  sampleId: string;
  sampleWer: number;
  werVariance: number;
  modelWers: Record<string, number>;
}

type ClusterId =
  | "easy-consensus"
  | "easy-divergent"
  | "hard-consensus"
  | "hard-divergent";

type ClassifiedPoint = SampleDifficultyPoint & {
  cluster: ClusterId;
};

type ModelRole = "base" | "target";

type ModelWinStat = {
  modelName: string;
  displayName: string;
  wins: number;
  share: number;
  role?: ModelRole;
};

type BaseTargetPairStats = {
  targetWins: number;
  baseWins: number;
  ties: number;
};

type ClusterComparison = {
  modelWins: ModelWinStat[];
  bestWerTies: number;
  baseTargetPair: BaseTargetPairStats | null;
};

type ClusterStat = (typeof CLUSTER_CONFIG)[number] & {
  count: number;
  percentage: number;
  comparison: ClusterComparison | null;
};

const QUADRANT_ROWS: ClusterId[][] = [
  ["easy-divergent", "hard-divergent"],
  ["easy-consensus", "hard-consensus"],
];

const STACK_BAR_ORDER: ClusterId[] = [
  "easy-consensus",
  "easy-divergent",
  "hard-divergent",
  "hard-consensus",
];

const CLUSTER_CONFIG = [
  {
    id: "easy-consensus" as const,
    label: "Легко + Согласие",
    shortLabel: "Легко · Согласие",
    color: "#10B981",
    description:
      "WER на примере ниже медианы среза, модели согласны — базовый уровень качества.",
  },
  {
    id: "easy-divergent" as const,
    label: "Легко + Расхождение",
    shortLabel: "Легко · Расхождение",
    color: "#3B82F6",
    description:
      "WER на примере ниже медианы среза, но модели расходятся — возможны различия в архитектуре или данных.",
  },
  {
    id: "hard-consensus" as const,
    label: "Сложно + Согласие",
    shortLabel: "Сложно · Согласие",
    color: "#EF4444",
    description:
      "WER на примере выше медианы среза, модели согласны — вероятно сложные или проблемные примеры.",
  },
  {
    id: "hard-divergent" as const,
    label: "Сложно + Расхождение",
    shortLabel: "Сложно · Расхождение",
    color: "#F59E0B",
    description:
      "WER на примере выше медианы среза и модели расходятся — потенциал для ансамбля или дообучения.",
  },
];

function clusterFillOpacity(percentage: number, maxPercentage: number): number {
  if (maxPercentage <= 0) return 0.08;
  return 0.1 + 0.22 * (percentage / maxPercentage);
}

function buildClusterComparison(
  points: ClassifiedPoint[],
  clusterId: ClusterId,
  sliceStats: ClusterSliceStat[],
  baseModel: string | null,
  targetModel: string | null,
): ClusterComparison | null {
  const clusterPoints = points.filter((point) => point.cluster === clusterId);
  if (clusterPoints.length === 0) return null;

  const winCounts = new Map<string, number>();
  sliceStats.forEach((stat) => winCounts.set(stat.modelName, 0));

  let bestWerTies = 0;
  let targetWins = 0;
  let baseWins = 0;
  let pairTies = 0;
  let pairComparable = 0;

  const showBaseTargetPair =
    Boolean(baseModel && targetModel && baseModel !== targetModel) &&
    sliceStats.some((stat) => stat.modelName === baseModel) &&
    sliceStats.some((stat) => stat.modelName === targetModel);

  clusterPoints.forEach((point) => {
    const entries = getModelWerEntries(point.modelWers, sliceStats.map((s) => s.modelName));

    if (entries.length >= 2) {
      const exclusiveWinner = getExclusiveBestWinner(
        point.modelWers,
        sliceStats.map((stat) => stat.modelName),
      );
      if (exclusiveWinner) {
        winCounts.set(
          exclusiveWinner,
          (winCounts.get(exclusiveWinner) ?? 0) + 1,
        );
      } else {
        bestWerTies += 1;
      }
    }

    if (showBaseTargetPair) {
      const baseWer = point.modelWers[baseModel!];
      const targetWer = point.modelWers[targetModel!];
      if (baseWer !== undefined && targetWer !== undefined) {
        pairComparable += 1;
        if (targetWer < baseWer) targetWins += 1;
        else if (targetWer > baseWer) baseWins += 1;
        else pairTies += 1;
      }
    }
  });

  const roleFor = (modelName: string): ModelRole | undefined => {
    if (modelName === baseModel) return "base";
    if (modelName === targetModel) return "target";
    return undefined;
  };

  const modelWins = sliceStats
    .map((stat) => {
      const wins = winCounts.get(stat.modelName) ?? 0;
      return {
        modelName: stat.modelName,
        displayName: stat.displayName,
        wins,
        share: clusterPoints.length > 0 ? (wins / clusterPoints.length) * 100 : 0,
        role: roleFor(stat.modelName),
      };
    })
    .filter((entry) => entry.wins > 0)
    .sort((a, b) => b.wins - a.wins || a.displayName.localeCompare(b.displayName));

  const baseTargetPair =
    showBaseTargetPair && pairComparable > 0
      ? { targetWins, baseWins, ties: pairTies }
      : null;

  if (modelWins.length === 0 && bestWerTies === 0 && !baseTargetPair) {
    return null;
  }

  return {
    modelWins,
    bestWerTies,
    baseTargetPair,
  };
}

interface QuadrantCellProps {
  cluster: ClusterStat;
  maxPercentage: number;
  medianSampleWer: number;
  medianVariance: number;
  modelCount: number;
  baseLabel: string;
  targetLabel: string;
  disabled: boolean;
  isDark: boolean;
  onOpen: () => void;
}

function QuadrantCell({
  cluster,
  maxPercentage,
  medianSampleWer,
  medianVariance,
  modelCount,
  baseLabel,
  targetLabel,
  disabled,
  isDark,
  onOpen,
}: QuadrantCellProps) {
  const fillRatio = clusterFillOpacity(cluster.percentage, maxPercentage);
  const tintAlpha = isDark ? 0.14 + fillRatio * 0.38 : 0.08 + fillRatio * 0.2;
  const werHint =
    cluster.id === "easy-consensus" || cluster.id === "easy-divergent"
      ? `WER ≤ медианы (${medianSampleWer.toFixed(1)}%)`
      : `WER > медианы (${medianSampleWer.toFixed(1)}%)`;
  const varianceHint =
    cluster.id === "easy-consensus" || cluster.id === "hard-consensus"
      ? `σ ≤ медианы (${medianVariance.toFixed(2)})`
      : `σ > медианы (${medianVariance.toFixed(2)})`;

  const comparison = cluster.comparison;
  const topModelLines =
    comparison?.modelWins.slice(0, modelCount > 2 ? 3 : 2) ?? [];
  const showPairwise = Boolean(comparison?.baseTargetPair && modelCount > 2);

  return (
    <article
      className="reson-cluster-quadrant-cell"
      style={
        {
          "--cluster-color": cluster.color,
          "--cluster-tint": `${Math.round(tintAlpha * 100)}%`,
        } as CSSProperties
      }
      title={`${cluster.label}: ${cluster.count} примеров (${cluster.percentage.toFixed(1)}%) · ${werHint}, ${varianceHint}`}
    >
      <div className="reson-cluster-quadrant-cell-head">
        <div className="reson-cluster-quadrant-cell-title-wrap">
          <span
            className="reson-cluster-quadrant-dot"
            style={{ backgroundColor: cluster.color }}
          />
          <span className={RESON_CLUSTER_CARD_LABEL}>{cluster.shortLabel}</span>
        </div>
        <span className={RESON_CLUSTER_CARD_PERCENT}>
          {cluster.percentage.toFixed(1)}%
        </span>
      </div>

      <p className={`reson-cluster-quadrant-cell-desc ${RESON_CLUSTER_CARD_DESC}`}>
        {cluster.description}
      </p>

      <div className="reson-cluster-quadrant-cell-stats">
        <span className={RESON_CLUSTER_CARD_COUNT}>{cluster.count}</span>
        <span className={RESON_CLUSTER_CARD_COUNT_SUFFIX}>примеров</span>
      </div>

      <p className="reson-cluster-quadrant-cell-threshold">
        {werHint} · {varianceHint}
      </p>

      {comparison ? (
        <div className="reson-cluster-quadrant-comparison">
          {topModelLines.length > 0 ? (
            <>
              <p className="reson-cluster-quadrant-comparison-heading">
                {modelCount > 2 ? "Лучший WER в кластере" : "Сравнение моделей"}
              </p>
              {topModelLines.map((entry) => (
                <p
                  key={entry.modelName}
                  className={`reson-cluster-quadrant-comparison-line${
                    entry.role === "target"
                      ? " reson-cluster-quadrant-comparison-line--target"
                      : entry.role === "base"
                        ? " reson-cluster-quadrant-comparison-line--base"
                        : ""
                  }`}
                >
                  {entry.displayName}: единственный лучший на {entry.wins.toLocaleString()}{" "}
                  прим. ({entry.share.toFixed(0)}%)
                </p>
              ))}
            </>
          ) : null}

          {comparison.bestWerTies > 0 ? (
            <p className="reson-cluster-quadrant-comparison-line reson-cluster-quadrant-comparison-line--tie">
              Ничья за лучший WER: {comparison.bestWerTies.toLocaleString()}
            </p>
          ) : null}

          {showPairwise && comparison.baseTargetPair ? (
            <p className="reson-cluster-quadrant-comparison-line reson-cluster-quadrant-comparison-line--pair">
              {targetLabel} vs {baseLabel}: лучше на{" "}
              {comparison.baseTargetPair.targetWins.toLocaleString()}, хуже на{" "}
              {comparison.baseTargetPair.baseWins.toLocaleString()}
              {comparison.baseTargetPair.ties > 0
                ? `, ничья ${comparison.baseTargetPair.ties.toLocaleString()}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={RESON_CLUSTER_MANIFEST_BTN}
        disabled={disabled || cluster.count === 0}
        onClick={onOpen}
      >
        Открыть в манифесте
      </button>
    </article>
  );
}

export function AnalyticsSampleDifficulty({
  sliceStats,
  availableModels,
  baseModel,
  targetModel,
  onViewInManifest,
}: AnalyticsSampleDifficultyProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [hoveredCluster, setHoveredCluster] = useState<ClusterId | null>(null);

  const modelLabels = useMemo(() => {
    const labelFor = (modelName: string | null) =>
      availableModels.find((model) => model.name === modelName)?.displayName ??
      modelName ??
      "—";

    return {
      base: labelFor(baseModel),
      target: labelFor(targetModel),
    };
  }, [availableModels, baseModel, targetModel]);

  const { difficultyData, totalUniqueSamples } = useMemo(() => {
    if (sliceStats.length === 0) {
      return { difficultyData: [] as SampleDifficultyPoint[], totalUniqueSamples: 0 };
    }

    const sampleIds = new Set<string>();
    sliceStats.forEach((stat) => {
      stat.samples.forEach((sample) => sampleIds.add(sample.audio_filepath));
    });

    const points: SampleDifficultyPoint[] = [];

    sampleIds.forEach((sampleId) => {
      const modelWers: Record<string, number> = {};
      const wers: number[] = [];

      sliceStats.forEach((stat) => {
        const sample = stat.samples.find((s) => s.audio_filepath === sampleId);
        if (sample) {
          modelWers[stat.modelName] = sample.wer;
          wers.push(sample.wer);
        }
      });

      if (wers.length >= 2) {
        const metrics = computeSampleDifficultyMetrics(wers);
        if (!metrics) return;

        points.push({
          sampleId,
          sampleWer: metrics.sampleWer,
          werVariance: metrics.werVariance,
          modelWers,
        });
      }
    });

    return { difficultyData: points, totalUniqueSamples: sampleIds.size };
  }, [sliceStats]);

  const medians = useMemo(() => {
    if (difficultyData.length === 0) {
      return { sampleWer: 0, variance: 0 };
    }

    const thresholds = computeDifficultyThresholds(difficultyData);
    return {
      sampleWer: thresholds.medianSampleWer,
      variance: thresholds.medianVariance,
    };
  }, [difficultyData]);

  const classifiedPoints = useMemo((): ClassifiedPoint[] => {
    const thresholds = computeDifficultyThresholds(difficultyData);
    return difficultyData.map((point) => ({
      ...point,
      cluster: classifySampleDifficulty(point, thresholds),
    }));
  }, [difficultyData]);

  const clusterStats = useMemo(() => {
    return CLUSTER_CONFIG.map((cluster) => {
      const clusterPoints = classifiedPoints.filter(
        (point) => point.cluster === cluster.id,
      );
      const count = clusterPoints.length;
      const percentage =
        classifiedPoints.length > 0 ? (count / classifiedPoints.length) * 100 : 0;
      const comparison = buildClusterComparison(
        classifiedPoints,
        cluster.id,
        sliceStats,
        baseModel,
        targetModel,
      );

      return {
        ...cluster,
        count,
        percentage,
        comparison,
      };
    });
  }, [classifiedPoints, sliceStats, baseModel, targetModel]);

  const clusterStatsById = useMemo(
    () => new Map(clusterStats.map((cluster) => [cluster.id, cluster])),
    [clusterStats],
  );

  const maxClusterPercentage = useMemo(
    () => Math.max(...clusterStats.map((cluster) => cluster.percentage), 0),
    [clusterStats],
  );

  const stackSegments = useMemo(
    () =>
      STACK_BAR_ORDER.map((id) => clusterStatsById.get(id)!)
        .filter((cluster) => cluster.count > 0),
    [clusterStatsById],
  );

  const openClusterInManifest = (clusterId: ClusterId) => {
    if (!onViewInManifest) return;
    const sampleIds = classifiedPoints
      .filter((point) => point.cluster === clusterId)
      .map((point) => point.sampleId);
    onViewInManifest(sampleIds);
  };

  if (difficultyData.length === 0 && totalUniqueSamples > 0) {
    return (
      <div className={`${RESON_ANALYTICS_INNER_CARD} py-10 text-center`}>
        <p className={`text-sm ${RESON_ANALYTICS_SUBTITLE}`}>
          Нет примеров, присутствующих минимум в 2 моделях (найдено{" "}
          {totalUniqueSamples} уникальных). Попробуйте изменить фильтр среза.
        </p>
      </div>
    );
  }

  if (difficultyData.length === 0) {
    return (
      <div className={`${RESON_ANALYTICS_INNER_CARD} py-10 text-center`}>
        <p className={`text-sm ${RESON_ANALYTICS_SUBTITLE}`}>
          Нет данных для кластеризации. Выберите модели в разделе Обзор.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AnalyticsChartHeader
        icon={<LayoutGrid />}
        title="Кластеры сложности примеров"
        subtitle={`Квадранты по медианам WER на примере и σ между моделями · ${sliceStats.length} моделей · ${classifiedPoints.length} / ${totalUniqueSamples} примеров`}
        help={
          <div className={`space-y-2 ${RESON_ANALYTICS_SUBTITLE}`}>
            <p>
              Для каждого примера считаются WER на примере (по выбранным моделям)
              и разброс σ между моделями. Медианы этих величин по срезу делят
              примеры на четыре квадранта.
            </p>
            <p>
              Матрица показывает долю и число примеров в каждом квадранте.
              Пунктирные линии — границы медиан среза.
            </p>
            <p>
              Квадранты считаются по срезу длительности и выбранным моделям; фильтр
              «лучшая/худшая модель» на квадранты не влияет.
            </p>
            <p>
              В квадранте — кто чаще даёт единственный лучший WER на примерах кластера;
              при 3+ моделях дополнительно показывается сравнение Target vs Base.
            </p>
          </div>
        }
      />

      <div className={`${RESON_ANALYTICS_INNER_CARD} p-4`}>
        <div className="mb-4">
          <h4 className={`${RESON_ANALYTICS_SECTION_TITLE} text-sm`}>
            Матрица квадрантов
          </h4>
          <p className={`mt-1 ${RESON_ANALYTICS_SUBTITLE}`}>
            Пороги среза: медиана WER {medians.sampleWer.toFixed(1)}% · медиана σ{" "}
            {medians.variance.toFixed(2)}
          </p>
        </div>

        <div className="reson-cluster-quadrant-frame">
          <div className="reson-cluster-quadrant-matrix-shell">
            <div className="reson-cluster-quadrant-matrix-label-col">
              <div className="reson-cluster-quadrant-row-label">
                <span className="reson-cluster-quadrant-row-label-text">
                  ↑ Расхождение
                </span>
              </div>
              <div className="reson-cluster-quadrant-row-label">
                <span className="reson-cluster-quadrant-row-label-text">
                  ↓ Согласие
                </span>
              </div>
            </div>

            <div className="reson-cluster-quadrant-matrix-cells">
              <div className="reson-cluster-quadrant-median-lines" aria-hidden="true">
                <div className="reson-cluster-quadrant-median-v" />
                <div className="reson-cluster-quadrant-median-h" />
              </div>

              <div className="reson-cluster-quadrant-matrix-grid">
                {QUADRANT_ROWS.flat().map((clusterId) => {
                  const cluster = clusterStatsById.get(clusterId)!;
                  const isHovered = hoveredCluster === clusterId;
                  const isDimmed =
                    hoveredCluster !== null && hoveredCluster !== clusterId;

                  return (
                    <div
                      key={clusterId}
                      className={`reson-cluster-quadrant-slot${
                        isHovered ? " reson-cluster-quadrant-slot--active" : ""
                      }${isDimmed ? " reson-cluster-quadrant-slot--dimmed" : ""}`}
                      onMouseEnter={() => setHoveredCluster(clusterId)}
                      onMouseLeave={() => setHoveredCluster(null)}
                    >
                      <QuadrantCell
                        cluster={cluster}
                        maxPercentage={maxClusterPercentage}
                        medianSampleWer={medians.sampleWer}
                        medianVariance={medians.variance}
                        modelCount={sliceStats.length}
                        baseLabel={modelLabels.base}
                        targetLabel={modelLabels.target}
                        disabled={!onViewInManifest}
                        isDark={isDark}
                        onOpen={() => openClusterInManifest(clusterId)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="reson-cluster-quadrant-x-label">
            <span className="reson-cluster-quadrant-axis-caption">WER на примере</span>
            <div className="reson-cluster-quadrant-x-ends">
              <span>← ниже медианы</span>
              <span>выше медианы →</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`${RESON_ANALYTICS_INNER_CARD} p-4`}>
        <div className="mb-3">
          <h4 className={`${RESON_ANALYTICS_SECTION_TITLE} text-sm`}>Состав среза</h4>
          <p className={`mt-1 ${RESON_ANALYTICS_SUBTITLE}`}>
            Доля примеров по кластерам · всего {classifiedPoints.length}
          </p>
        </div>

        <div
          className="reson-cluster-stack-bar"
          role="img"
          aria-label="Stacked bar chart of cluster composition"
        >
          {stackSegments.map((cluster) => (
            <div
              key={cluster.id}
              className={`reson-cluster-stack-segment${
                hoveredCluster === cluster.id ? " reson-cluster-stack-segment--active" : ""
              }${hoveredCluster !== null && hoveredCluster !== cluster.id ? " reson-cluster-stack-segment--dimmed" : ""}`}
              style={{
                width: `${cluster.percentage}%`,
                backgroundColor: cluster.color,
              }}
              title={`${cluster.shortLabel}: ${cluster.count} (${cluster.percentage.toFixed(1)}%)`}
              onMouseEnter={() => setHoveredCluster(cluster.id)}
              onMouseLeave={() => setHoveredCluster(null)}
            />
          ))}
        </div>

        <div className="reson-cluster-stack-legend">
          {clusterStats.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              className={`reson-cluster-stack-legend-item${
                hoveredCluster === cluster.id ? " reson-cluster-stack-legend-item--active" : ""
              }`}
              onMouseEnter={() => setHoveredCluster(cluster.id)}
              onMouseLeave={() => setHoveredCluster(null)}
              onClick={() => openClusterInManifest(cluster.id)}
              disabled={!onViewInManifest || cluster.count === 0}
            >
              <span
                className="reson-cluster-quadrant-dot"
                style={{ backgroundColor: cluster.color }}
              />
              <span>{cluster.shortLabel}</span>
              <span className="reson-cluster-stack-legend-value">
                {cluster.percentage.toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
