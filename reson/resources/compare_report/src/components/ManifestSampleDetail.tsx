import { useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { CheckCircle2, FileAudio, PlayCircle, X } from "./icons";
import { AnalyticsChartHeader } from "./AnalyticsChartHeader";
import { VisuallyHidden } from "./VisuallyHidden";
import { resolveAudioPath } from "../utils/audioPathHelper";
import {
  getDifficultyInfo,
  getModelRoleBorderClass,
  type DifficultyClass,
} from "../utils/manifestHelpers";
import {
  RESON_ANALYTICS_SUBTITLE,
  RESON_MANIFEST_ACCENT_TEXT,
} from "../styles/reportStyles";

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
}

interface ModelResults {
  modelName: string;
  displayName: string;
  samples: Sample[];
}

interface ManifestSampleDetailProps {
  selectedSample: {
    samples: Map<string, Sample>;
    id: string;
    modelResults: ModelResults[];
  };
  onClose: () => void;
  isDark: boolean;
  baseModel: string | null;
  targetModel: string | null;
  optionalModels: string[];
  selectedModelNames: Set<string>;
  difficultyClass: DifficultyClass | null;
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath.split("\\").pop() || filePath;
}

export function ManifestSampleDetail({
  selectedSample,
  onClose,
  baseModel,
  targetModel,
  optionalModels,
  selectedModelNames,
  difficultyClass,
}: ManifestSampleDetailProps) {
  const firstSample = Array.from(selectedSample.samples.values())[0];
  const diffInfo = getDifficultyInfo(difficultyClass);

  const metricSamples = useMemo(() => {
    const order: string[] = [];
    if (baseModel) order.push(baseModel);
    if (targetModel) order.push(targetModel);
    optionalModels.forEach((modelName) => order.push(modelName));

    return order
      .filter((modelName) => selectedModelNames.has(modelName) && selectedSample.samples.has(modelName))
      .map((modelName) => {
        const sample = selectedSample.samples.get(modelName)!;
        const modelResult = selectedSample.modelResults.find((entry) => entry.modelName === modelName);
        return {
          modelName,
          sample,
          displayName: modelResult?.displayName || modelName,
        };
      });
  }, [baseModel, targetModel, optionalModels, selectedModelNames, selectedSample]);

  const selectedWers = metricSamples.map(({ sample }) => sample.wer);
  const avgWER =
    selectedWers.length > 0
      ? selectedWers.reduce((sum, wer) => sum + wer, 0) / selectedWers.length
      : 0;
  const minWER = selectedWers.length > 0 ? Math.min(...selectedWers) : 0;
  const maxWER = selectedWers.length > 0 ? Math.max(...selectedWers) : 0;
  let stdDev = 0;
  if (selectedWers.length >= 2) {
    const variance =
      selectedWers.reduce((sum, wer) => sum + Math.pow(wer - avgWER, 2), 0) / selectedWers.length;
    stdDev = Math.sqrt(variance);
  }

  const audioBasePath = (window as any).RESON_DATA?.settings?.audioBasePath;
  const resolvedAudioUrl = firstSample?.file_path
    ? resolveAudioPath(firstSample.file_path, audioBasePath)
    : "";
  const fileName = firstSample?.file_path ? getFileName(firstSample.file_path) : selectedSample.id;

  const wers = metricSamples.map((entry) => entry.sample.wer);
  const cers = metricSamples.map((entry) => entry.sample.cer);
  const insertions = metricSamples.map((entry) => entry.sample.insertions);
  const deletions = metricSamples.map((entry) => entry.sample.deletions);
  const substitutions = metricSamples.map((entry) => entry.sample.substitutions);
  const minWer = Math.min(...wers);
  const maxWer = Math.max(...wers);
  const modelsAtMinWer = metricSamples.filter(({ sample }) => sample.wer === minWer).length;
  const modelsAtMaxWer = metricSamples.filter(({ sample }) => sample.wer === maxWer).length;
  const minCer = Math.min(...cers);
  const maxCer = Math.max(...cers);
  const minIns = Math.min(...insertions);
  const maxIns = Math.max(...insertions);
  const minDel = Math.min(...deletions);
  const maxDel = Math.max(...deletions);
  const minSub = Math.min(...substitutions);
  const maxSub = Math.max(...substitutions);

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="reson-manifest-detail-overlay" />
        <DialogPrimitive.Content
          className="reson-manifest-detail-modal"
          data-tour="manifest-sample-detail"
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Детализация записи {selectedSample.id}</DialogPrimitive.Title>
          </VisuallyHidden>
          <VisuallyHidden>
            <DialogPrimitive.Description>
              Подробный просмотр записи, метрик моделей и diff распознавания.
            </DialogPrimitive.Description>
          </VisuallyHidden>

          <div className="reson-manifest-detail-header">
            <div className="reson-manifest-detail-header-main">
              <div className="reson-manifest-detail-header-icon">
                <FileAudio />
              </div>
              <div className="min-w-0">
                <h2 className="reson-manifest-detail-title">{fileName}</h2>
              </div>
            </div>
            <DialogPrimitive.Close className="reson-manifest-detail-close" aria-label="Закрыть">
              <X />
            </DialogPrimitive.Close>
          </div>

          <div className="reson-manifest-detail-body">
            {firstSample?.file_path ? (
              <div className="reson-manifest-detail-panel">
                <div className="reson-manifest-detail-audio-row">
                  <div className="reson-manifest-detail-audio-meta">
                    <AnalyticsChartHeader
                      variant="manifest"
                      icon={<PlayCircle />}
                      title="Аудиозапись"
                      subtitle="Прослушайте исходный файл записи"
                    />
                    <p className="reson-manifest-detail-audio-path" title={firstSample.file_path}>
                      {firstSample.file_path}
                    </p>
                  </div>
                  <audio controls className="reson-manifest-detail-audio-player" src={resolvedAudioUrl}>
                    Ваш браузер не поддерживает аудио элемент.
                  </audio>
                </div>
              </div>
            ) : null}

            <div className="reson-manifest-detail-kpi-grid">
              <div className="reson-manifest-detail-kpi">
                <p className="reson-manifest-detail-kpi-label">Длительность</p>
                <p className="reson-manifest-detail-kpi-value">{firstSample?.duration.toFixed(2)} с</p>
              </div>
              <div className="reson-manifest-detail-kpi">
                <p className="reson-manifest-detail-kpi-label">Средний WER</p>
                <p className={`reson-manifest-detail-kpi-value ${RESON_MANIFEST_ACCENT_TEXT}`}>
                  {avgWER.toFixed(2)}%
                </p>
                <p className="reson-manifest-detail-kpi-hint">
                  {minWER.toFixed(2)}% – {maxWER.toFixed(2)}%
                </p>
              </div>
              <div className="reson-manifest-detail-kpi">
                <p className="reson-manifest-detail-kpi-label">Расхождение</p>
                <p className="reson-manifest-detail-kpi-value">
                  {selectedWers.length >= 2 ? stdDev.toFixed(2) : "—"}
                </p>
                <p className="reson-manifest-detail-kpi-hint">
                  {selectedWers.length >= 2 ? "σ между моделями" : "Нужно 2+ модели"}
                </p>
              </div>
              <div className="reson-manifest-detail-kpi">
                <p className="reson-manifest-detail-kpi-label">Кластер</p>
                {difficultyClass ? (
                  <>
                    <p className="reson-manifest-detail-kpi-value">{diffInfo.label}</p>
                    <p className="reson-manifest-detail-kpi-hint">{diffInfo.shortLabel}</p>
                  </>
                ) : (
                  <>
                    <p className="reson-manifest-detail-kpi-value">—</p>
                    <p className="reson-manifest-detail-kpi-hint">Недоступен для среза</p>
                  </>
                )}
              </div>
            </div>

            <div className="reson-manifest-detail-panel">
              <AnalyticsChartHeader
                variant="manifest"
                icon={<CheckCircle2 />}
                title="Эталонный текст"
              />
              <p className="reson-manifest-detail-reference">{firstSample?.reference || "—"}</p>
            </div>

            <div className="reson-manifest-detail-metrics-wrap">
              <div className="reson-manifest-detail-metrics-head">
                <AnalyticsChartHeader
                  variant="manifest"
                  icon={<CheckCircle2 />}
                  title="Сравнение метрик моделей"
                  subtitle="Подсветка лучших и худших значений среди выбранных моделей"
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-gray-200 dark:border-[#2A2D35]">
                      <TableHead className={RESON_ANALYTICS_SUBTITLE}>Модель</TableHead>
                      <TableHead className={`text-center ${RESON_ANALYTICS_SUBTITLE}`}>WER</TableHead>
                      <TableHead className={`text-center ${RESON_ANALYTICS_SUBTITLE}`}>CER</TableHead>
                      <TableHead className={`text-center ${RESON_ANALYTICS_SUBTITLE}`}>Ins</TableHead>
                      <TableHead className={`text-center ${RESON_ANALYTICS_SUBTITLE}`}>Del</TableHead>
                      <TableHead className={`text-center ${RESON_ANALYTICS_SUBTITLE}`}>Sub</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricSamples.map(({ modelName, sample, displayName }) => {
                      const isBest = sample.wer === minWer && minWer !== maxWer;
                      const isWorst = sample.wer === maxWer && minWer !== maxWer;
                      return (
                        <TableRow
                          key={modelName}
                          className={`${getModelRoleBorderClass(modelName, baseModel, targetModel, optionalModels)} border-gray-100 dark:border-[#2A2D35]`}
                        >
                          <TableCell>
                            <div className="font-medium">{displayName}</div>
                            {isBest || isWorst ? (
                              <span
                                className={`reson-manifest-detail-rank-badge mt-1 ${
                                  isBest
                                    ? "reson-manifest-detail-rank-badge--best"
                                    : "reson-manifest-detail-rank-badge--worst"
                                }`}
                              >
                                {isBest
                                  ? modelsAtMinWer > 1
                                    ? "Лучшая · ничья"
                                    : "Лучшая"
                                  : modelsAtMaxWer > 1
                                    ? "Худшая · ничья"
                                    : "Худшая"}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            <MetricValue value={sample.wer.toFixed(2)} best={isBest} worst={isWorst} accent />
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            <MetricValue
                              value={sample.cer.toFixed(2)}
                              best={sample.cer === minCer && minCer !== maxCer}
                              worst={sample.cer === maxCer && minCer !== maxCer}
                            />
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            <MetricValue
                              value={String(sample.insertions)}
                              best={sample.insertions === minIns && minIns !== maxIns}
                              worst={sample.insertions === maxIns && minIns !== maxIns}
                            />
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            <MetricValue
                              value={String(sample.deletions)}
                              best={sample.deletions === minDel && minDel !== maxDel}
                              worst={sample.deletions === maxDel && minDel !== maxDel}
                            />
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            <MetricValue
                              value={String(sample.substitutions)}
                              best={sample.substitutions === minSub && minSub !== maxSub}
                              worst={sample.substitutions === maxSub && minSub !== maxSub}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="reson-manifest-detail-panel">
              <AnalyticsChartHeader
                variant="manifest"
                title="Сравнение гипотез с референсом"
              />
              <div className="reson-manifest-detail-hypothesis-grid">
                {metricSamples.map(({ modelName, sample, displayName }) => {
                  const isBest = sample.wer === minWer && minWer !== maxWer;
                  const isWorst = sample.wer === maxWer && minWer !== maxWer;

                  return (
                    <div
                      key={modelName}
                      className={`reson-manifest-detail-model-card ${getModelRoleBorderClass(
                        modelName,
                        baseModel,
                        targetModel,
                        optionalModels,
                      )}`}
                    >
                      <div className="reson-manifest-detail-model-head">
                        <h4 className="reson-manifest-detail-model-name">{displayName}</h4>
                        <span
                          className={`text-xs tabular-nums font-medium ${
                            isBest
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isWorst
                                ? "text-red-600 dark:text-red-400"
                                : RESON_MANIFEST_ACCENT_TEXT
                          }`}
                        >
                          WER {sample.wer.toFixed(2)}%
                        </span>
                      </div>
                      {sample.wer === 0 ? (
                        <div className="reson-manifest-detail-perfect">
                          <CheckCircle2 />
                          <span>Идеальное распознавание</span>
                        </div>
                      ) : (
                        <div className="reson-manifest-detail-diff-box">
                          <p className="reson-manifest-detail-diff-label">Разница с эталоном</p>
                          <DiffText
                            reference={sample.reference}
                            hypothesis={sample.hypothesis}
                            diffTokens={sample.diff_tokens}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function MetricValue({
  value,
  best,
  worst,
  accent = false,
}: {
  value: string;
  best: boolean;
  worst: boolean;
  accent?: boolean;
}) {
  const className = best
    ? "text-emerald-600 dark:text-emerald-400 font-semibold"
    : worst
      ? "text-red-600 dark:text-red-400 font-semibold"
      : accent
        ? RESON_MANIFEST_ACCENT_TEXT
        : "";
  return <span className={className}>{value}</span>;
}

function getOpcodes(
  refWords: string[],
  hypWords: string[],
): Array<["equal" | "delete" | "insert" | "replace", number, number, number, number]> {
  const m = refWords.length;
  const n = hypWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const opcodes: Array<["equal" | "delete" | "insert" | "replace", number, number, number, number]> = [];
  let i = m;
  let j = n;
  const ops: Array<{ op: "equal" | "delete" | "insert" | "replace"; i1: number; i2: number; j1: number; j2: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refWords[i - 1] === hypWords[j - 1]) {
      ops.push({ op: "equal", i1: i - 1, i2: i, j1: j - 1, j2: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ op: "insert", i1: i, i2: i, j1: j - 1, j2: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      ops.push({ op: "delete", i1: i - 1, i2: i, j1: j, j2: j });
      i--;
    } else {
      ops.push({ op: "replace", i1: i - 1, i2: i, j1: j - 1, j2: j });
      i--;
      j--;
    }
  }

  ops.reverse();
  if (ops.length === 0) return opcodes;

  let current = { ...ops[0] };
  for (let k = 1; k < ops.length; k++) {
    const next = ops[k];
    if (current.op === next.op) {
      current.i2 = next.i2;
      current.j2 = next.j2;
    } else {
      opcodes.push([current.op, current.i1, current.i2, current.j1, current.j2]);
      current = { ...next };
    }
  }
  opcodes.push([current.op, current.i1, current.i2, current.j1, current.j2]);
  return opcodes;
}

function DiffText({
  reference,
  hypothesis,
  diffTokens,
}: {
  reference: string;
  hypothesis: string;
  diffTokens?: Array<{ word: string; type: "equal" | "ins" | "del" | "sub_del" | "sub_ins" }>;
}) {
  let tokens: Array<{ word: string; type: "equal" | "ins" | "del" | "sub_del" | "sub_ins" }>;

  if (diffTokens && diffTokens.length > 0) {
    tokens = diffTokens;
  } else {
    const refWords = reference ? reference.trim().split(/\s+/) : [];
    const hypWords = hypothesis ? hypothesis.trim().split(/\s+/) : [];
    const opcodeList = getOpcodes(refWords, hypWords);
    tokens = [];
    for (const [tag, i1, i2, j1, j2] of opcodeList) {
      if (tag === "equal") {
        for (let idx = i1; idx < i2; idx++) tokens.push({ word: refWords[idx], type: "equal" });
      } else if (tag === "delete") {
        for (let idx = i1; idx < i2; idx++) tokens.push({ word: refWords[idx], type: "del" });
      } else if (tag === "insert") {
        for (let idx = j1; idx < j2; idx++) tokens.push({ word: hypWords[idx], type: "ins" });
      } else {
        for (let idx = i1; idx < i2; idx++) tokens.push({ word: refWords[idx], type: "sub_del" });
        for (let idx = j1; idx < j2; idx++) tokens.push({ word: hypWords[idx], type: "sub_ins" });
      }
    }
  }

  const classMap: Record<(typeof tokens)[number]["type"], string> = {
    equal: "reson-manifest-detail-diff-token reson-manifest-detail-diff-token--equal",
    ins: "reson-manifest-detail-diff-token reson-manifest-detail-diff-token--ins",
    del: "reson-manifest-detail-diff-token reson-manifest-detail-diff-token--del",
    sub_del: "reson-manifest-detail-diff-token reson-manifest-detail-diff-token--sub-del",
    sub_ins: "reson-manifest-detail-diff-token reson-manifest-detail-diff-token--sub-ins",
  };

  return (
    <span className="reson-manifest-detail-diff-tokens">
      {tokens.map((item, idx) => (
        <span key={`diff-${idx}-${item.word}-${item.type}`} className={classMap[item.type]}>
          {item.word}
        </span>
      ))}
    </span>
  );
}
