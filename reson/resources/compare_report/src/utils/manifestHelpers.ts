export type DifficultyClass =
  | "easy-consensus"
  | "easy-divergent"
  | "hard-consensus"
  | "hard-divergent";

const DIFFICULTY_META: Record<
  DifficultyClass,
  { label: string; shortLabel: string; dotClass: string; badgeClass: string }
> = {
  "easy-consensus": {
    label: "Легко + Согласие",
    shortLabel: "Л · Согл.",
    dotClass: "bg-emerald-500",
    badgeClass:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  },
  "easy-divergent": {
    label: "Легко + Расхождение",
    shortLabel: "Л · Расх.",
    dotClass: "bg-yellow-500",
    badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  },
  "hard-consensus": {
    label: "Сложно + Согласие",
    shortLabel: "С · Согл.",
    dotClass: "bg-orange-500",
    badgeClass: "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400",
  },
  "hard-divergent": {
    label: "Сложно + Расхождение",
    shortLabel: "С · Расх.",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  },
};

export function getDifficultyInfo(diffClass: DifficultyClass | null) {
  if (!diffClass) return { label: "", shortLabel: "", dotClass: "", badgeClass: "" };
  return DIFFICULTY_META[diffClass];
}

export function getModelRoleBorderClass(
  modelName: string,
  baseModel: string | null,
  targetModel: string | null,
  optionalModels: string[],
): string {
  if (modelName === baseModel) return "border-l-4 !border-l-sky-500";
  if (modelName === targetModel) return "border-l-4 !border-l-emerald-500";
  if (optionalModels.includes(modelName)) return "border-l-4 !border-l-violet-500";
  return "";
}

export function getModelsAtWer<T extends { modelName: string; displayName: string }>(
  modelResults: T[],
  selectedModelNames: Set<string>,
  modelData: Map<string, { wer: number }>,
  wer: number,
): T[] {
  return modelResults.filter((modelResult) => {
    if (!selectedModelNames.has(modelResult.modelName)) return false;
    const sample = modelData.get(modelResult.modelName);
    return sample != null && sample.wer === wer;
  });
}

