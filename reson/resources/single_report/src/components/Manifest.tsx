import { useState, useMemo, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useData } from "../contexts/DataContext";
import { DiffTokensView } from "./DiffTokens";
import { PageSizeSelect } from "./ui/PageSizeSelect";
import { VocabSectionHint } from "./vocabulary/VocabSectionHint";
import {
  FileText,
  Download,
  Info,
  ChevronDown,
  ChevronRight,
  Settings,
  Search,
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const MANIFEST_SUMMARY_HINT_ITEMS = [
  {
    color: "#6366F1",
    label: "Всего записей",
    range: "манифест",
    description: "Число аудиозаписей в манифесте прогона RESON.",
  },
  {
    color: "#10B981",
    label: "Отображено",
    range: "фильтр",
    description: "Записи, прошедшие текущие фильтры поиска и длительности.",
  },
  {
    color: "#F59E0B",
    label: "Средний WER",
    range: "%",
    description: "Среднее Word Error Rate по отфильтрованным записям.",
  },
  {
    color: "#EF4444",
    label: "С ошибками",
    range: "WER > 0",
    description: "Записи, где модель допустила хотя бы одну ошибку.",
  },
] as const;

const MANIFEST_RUN_HINT_ITEMS = [
  {
    color: "#8B5CF6",
    label: "WER / CER / LER",
    range: "основные",
    description: "Агрегированные метрики качества распознавания по прогону.",
  },
  {
    color: "#EF4444",
    label: "DEL",
    range: "удаления",
    description: "Слова из эталона, пропущенные моделью.",
  },
  {
    color: "#3B82F6",
    label: "INS",
    range: "вставки",
    description: "Лишние слова в гипотезе без соответствия в эталоне.",
  },
  {
    color: "#F59E0B",
    label: "SUB",
    range: "замены",
    description: "Слова эталона, заменённые на другие в гипотезе.",
  },
  {
    color: "#10B981",
    label: "EQ / LEN",
    range: "слова",
    description: "Количество слов в эталоне и длина выравнивания.",
  },
] as const;

const MANIFEST_TABLE_HINT_ITEMS = [
  {
    color: "#6366F1",
    label: "WER",
    range: "%",
    description: "Доля ошибок на уровне слов для конкретной записи.",
  },
  {
    color: "#EF4444",
    label: "DEL",
    range: "удаления",
    description: "Число пропущенных слов в записи.",
  },
  {
    color: "#3B82F6",
    label: "INS",
    range: "вставки",
    description: "Число лишних слов в гипотезе.",
  },
  {
    color: "#F59E0B",
    label: "SUB",
    range: "замены",
    description: "Число заменённых слов.",
  },
  {
    color: "#8B5CF6",
    label: "Разница",
    range: "diff",
    description:
      "Подсветка удалений, вставок и замен при включённом режиме diff.",
  },
] as const;

type SortField = "duration" | "wer" | "ins" | "del" | "sub";

function audioBasename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.split("/").pop();
  return name || path;
}

type ManifestSubTab = "manifest" | "replacements";

// Токен diff с бэкенда (выравнивание ref/hyp)
interface DiffToken {
  word: string;
  type: "equal" | "ins" | "del" | "sub_del" | "sub_ins";
}

// Типы для данных манифеста (внутренний формат компонента)
interface ManifestEntry {
  id: string;
  audioPath: string;
  duration: number;
  wer: number;
  ins: number;
  del: number;
  sub: number;
  originalText: string;
  predictedText: string;
  cer?: number;
  ler?: number;
  werH?: number;
  durationType?: "short" | "normal" | "long";
  diff_tokens?: DiffToken[];
}

const OPTIONAL_MANIFEST_METRICS = ["CER", "LER", "WER_H"] as const;

export function Manifest() {
  const { theme } = useTheme();
  const { data } = useData();

  const availableOptionalMetricNames = useMemo(() => {
    const names = new Set<string>();
    for (const metric of data?.metrics?.additional ?? []) {
      if (metric?.name) {
        names.add(String(metric.name).toUpperCase());
      }
    }
    for (const row of data?.metrics?.runTable ?? []) {
      const index = String(row.index ?? "").toUpperCase();
      if (
        index &&
        index !== "WER" &&
        OPTIONAL_MANIFEST_METRICS.includes(
          index as (typeof OPTIONAL_MANIFEST_METRICS)[number],
        )
      ) {
        names.add(index);
      }
    }
    return names;
  }, [data?.metrics?.additional, data?.metrics?.runTable]);

  const manifestEntries = useMemo((): ManifestEntry[] => {
    const raw = data?.manifest ?? [];
    return raw.map((item: { audio_filepath?: string; duration?: number; text?: string; prediction?: string; WER?: number; CER?: number; LER?: number; WER_H?: number; INS?: number; DEL?: number; SUB?: number; duration_type?: string; diff_tokens?: Array<{ word: string; type: string }> }, idx: number) => ({
      id: String(item.audio_filepath ?? idx),
      audioPath: String(item.audio_filepath ?? ""),
      duration: Number(item.duration ?? 0),
      wer: Number(item.WER ?? 0),
      ins: Number(item.INS ?? 0),
      del: Number(item.DEL ?? 0),
      sub: Number(item.SUB ?? 0),
      originalText: String(item.text ?? ""),
      predictedText: String(item.prediction ?? ""),
      cer:
        availableOptionalMetricNames.has("CER") &&
        item.CER != null &&
        !Number.isNaN(Number(item.CER))
          ? Number(item.CER)
          : undefined,
      ler:
        availableOptionalMetricNames.has("LER") &&
        item.LER != null &&
        !Number.isNaN(Number(item.LER))
          ? Number(item.LER)
          : undefined,
      werH:
        availableOptionalMetricNames.has("WER_H") &&
        item.WER_H != null &&
        !Number.isNaN(Number(item.WER_H))
          ? Number(item.WER_H)
          : undefined,
      durationType: item.duration_type as "short" | "normal" | "long" | undefined,
      diff_tokens: Array.isArray(item.diff_tokens) ? item.diff_tokens as DiffToken[] : undefined,
    }));
  }, [data?.manifest, availableOptionalMetricNames]);

  const [activeSubTab, setActiveSubTab] =
    useState<ManifestSubTab>("manifest");

  const [searchQuery, setSearchQuery] = useState("");
  const [durationType, setDurationType] = useState("all");
  const [recordsFilter, setRecordsFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [showDiff, setShowDiff] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    audio_filepath: true,
    duration: true,
    wer: true,
    ins: true,
    del: true,
    sub: true,
    text: true,
    prediction: true,
  });

  const [sortField, setSortField] = useState<SortField>("wer");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Состояние для модального окна детализации
  const [selectedEntry, setSelectedEntry] = useState<ManifestEntry | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [recordsPerPage, searchQuery, durationType, recordsFilter, sortField, sortDirection]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    durationType !== "all" ||
    recordsFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setDurationType("all");
    setRecordsFilter("all");
    setCurrentPage(1);
  };

  // Обработчик экспорта в CSV
  const handleExportCSV = () => {
    const headers = ['id', 'audio_filepath', 'duration', 'wer', 'ins', 'del', 'sub', 'text', 'prediction'];
    const csvRows = [headers.join(',')];
    
    sortedData.forEach(entry => {
      const row = [
        entry.id,
        `"${entry.audioPath}"`,
        entry.duration,
        entry.wer,
        entry.ins,
        entry.del,
        entry.sub,
        `"${entry.originalText.replace(/"/g, '""')}"`,
        `"${entry.predictedText.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `manifest_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Обработчик экспорта в JSON
  const handleExportJSON = () => {
    const jsonData = sortedData.map(entry => ({
      id: entry.id,
      audio_filepath: entry.audioPath,
      duration: entry.duration,
      wer: entry.wer,
      ins: entry.ins,
      del: entry.del,
      sub: entry.sub,
      text: entry.originalText,
      prediction: entry.predictedText
    }));
    
    const jsonContent = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `manifest_export_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    const isActive = sortField === field;
    return (
      <span
        className={`reson-vocab-sort-icon ${isActive ? "reson-vocab-sort-icon--active" : ""}`}
      >
        {isActive ? (
          sortDirection === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5" />
        )}
      </span>
    );
  };

  const sortableThProps = (
    field: SortField,
    align: "left" | "center" | "right",
  ) => ({
    onClick: () => handleSort(field),
    className: `reson-vocab-sortable-th reson-vocab-sortable-th--${align} ${
      sortField === field ? "reson-vocab-sortable-th--active" : ""
    } ${theme === "dark" ? "reson-vocab-sortable-th--dark" : ""}`,
    "aria-sort": (sortField === field
      ? sortDirection === "asc"
        ? "ascending"
        : "descending"
      : "none") as "ascending" | "descending" | "none",
  });

  const panelCard = `reson-vocab-viz-card ${theme === "dark" ? "reson-vocab-viz-card--dark" : ""}`;
  const metricCard = `reson-word-modal-metric-card ${
    theme === "dark" ? "reson-word-modal-metric-card--dark" : ""
  }`;

  const renderDiffForModal = (entry: ManifestEntry) => (
    <DiffTokensView
      tokens={entry.diff_tokens}
      reference={entry.originalText}
      prediction={entry.predictedText}
      theme={theme}
    />
  );

  const filteredData = useMemo(() => {
    let result = manifestEntries.filter((entry) => {
      if (
        searchQuery &&
        !entry.audioPath
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) &&
        !entry.originalText
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) &&
        !entry.predictedText
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (durationType !== "all") {
        if (durationType === "short" && entry.duration >= 5) return false;
        if (
          durationType === "normal" &&
          (entry.duration < 5 || entry.duration >= 30)
        ) {
          return false;
        }
        if (durationType === "long" && entry.duration < 30) return false;
      }

      if (recordsFilter === "with_errors" && entry.wer === 0) return false;
      if (recordsFilter === "without_errors" && entry.wer > 0) return false;

      return true;
    });

    if (recordsFilter === "top10") {
      const sortedByWER = [...result].sort((a, b) => b.wer - a.wer);
      const top10Count = Math.ceil(sortedByWER.length * 0.1);
      result = sortedByWER.slice(0, top10Count);
    }

    return result;
  }, [manifestEntries, searchQuery, durationType, recordsFilter]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortDirection === "desc" ? -diff : diff;
    });
    return sorted;
  }, [filteredData, sortField, sortDirection]);

  const runMetricsRows = useMemo(() => {
    const runTable = data?.metrics?.runTable as
      | Array<{
          index: string;
          VALUE?: number | null;
          mean_value?: number | null;
          sd?: number | null;
          DEL?: number | null;
          INS?: number | null;
          SUB?: number | null;
          EQ?: number | null;
          LEN?: number | null;
          NOM?: number | null;
        }>
      | undefined;
    const fmtPct = (v: number | null | undefined) =>
      v != null && !Number.isNaN(v) ? `${Number(v).toFixed(4)}%` : "—";
    const num = (v: number | null | undefined) =>
      v != null && !Number.isNaN(v) ? Number(v).toLocaleString() : "—";
    const numDot = (v: number | null | undefined) =>
      v != null && !Number.isNaN(v) ? String(Number(v)) : "—";

    if (runTable && runTable.length > 0) {
      return runTable.map((r) => ({
        metric: r.index,
        value: fmtPct(r.VALUE),
        avg: fmtPct(r.mean_value),
        std:
          r.sd != null && !Number.isNaN(r.sd)
            ? String(Number(r.sd).toFixed(4))
            : "—",
        ins: num(r.INS),
        del: num(r.DEL),
        sub: num(r.SUB),
        eq: num(r.EQ),
        len: num(r.LEN),
        nom: numDot(r.NOM),
      }));
    }

    const wer = data?.metrics?.wer;
    const additional = data?.metrics?.additional ?? [];
    const rows = [
      {
        metric: "WER",
        value: fmtPct(wer?.value),
        avg: fmtPct(wer?.mean),
        std: wer?.std != null ? String(Number(wer.std).toFixed(4)) : "—",
        ins: num(wer?.insertions),
        del: num(wer?.deletions),
        sub: num(wer?.substitutions),
        eq: num(wer?.total_words),
        len: num(wer?.total_words),
        nom: "—",
      },
      ...(
        additional as Array<{
          name: string;
          value?: number;
          mean?: number;
          std?: number;
        }>
      ).map((m) => ({
        metric: m.name,
        value: fmtPct(m.value),
        avg: fmtPct(m.mean),
        std: m.std != null ? String(Number(m.std).toFixed(4)) : "—",
        ins: "—",
        del: "—",
        sub: "—",
        eq: "—",
        len: "—",
        nom: "—",
      })),
    ];

    if (rows.length === 0) {
      return [
        {
          metric: "—",
          value: "—",
          avg: "—",
          std: "—",
          ins: "—",
          del: "—",
          sub: "—",
          eq: "—",
          len: "—",
          nom: "—",
        },
      ];
    }

    return rows;
  }, [data?.metrics]);

  const totalRecords = manifestEntries.length;
  const displayedRecords = filteredData.length;
  const avgWER =
    displayedRecords > 0
      ? filteredData.reduce((sum, entry) => sum + entry.wer, 0) /
        displayedRecords
      : 0;
  const recordsWithErrors = filteredData.filter((entry) => entry.wer > 0).length;

  const totalPages =
    displayedRecords === 0 ? 0 : Math.ceil(displayedRecords / recordsPerPage);
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage,
  );

  const tableColSpan = useMemo(() => {
    let cols = 1;
    if (visibleColumns.audio_filepath) cols++;
    if (visibleColumns.duration) cols++;
    if (visibleColumns.wer) cols++;
    if (visibleColumns.ins) cols++;
    if (visibleColumns.del) cols++;
    if (visibleColumns.sub) cols++;
    if (showDiff) {
      if (visibleColumns.text || visibleColumns.prediction) cols++;
    } else {
      if (visibleColumns.text) cols++;
      if (visibleColumns.prediction) cols++;
    }
    return cols;
  }, [visibleColumns, showDiff]);

  const columnOptions = [
    { key: "audio_filepath", label: "Путь к файлу", shortLabel: "Путь" },
    { key: "duration", label: "Длительность", shortLabel: "Длит." },
    { key: "wer", label: "WER", shortLabel: "WER" },
    { key: "ins", label: "INS", shortLabel: "INS" },
    { key: "del", label: "DEL", shortLabel: "DEL" },
    { key: "sub", label: "SUB", shortLabel: "SUB" },
    { key: "text", label: "Оригинальный текст", shortLabel: "Эталон" },
    { key: "prediction", label: "Предсказанный текст", shortLabel: "Гипотеза" },
  ] as const;

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    const visibleCount = Object.values(visibleColumns).filter(Boolean).length;
    if (visibleColumns[key] && visibleCount <= 1) return;
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedOptionalMetrics = useMemo(() => {
    if (!selectedEntry) return [];
    const items: Array<{ label: string; value: string; color: string }> = [];
    if (
      availableOptionalMetricNames.has("CER") &&
      selectedEntry.cer != null &&
      !Number.isNaN(selectedEntry.cer)
    ) {
      items.push({
        label: "CER",
        value: `${selectedEntry.cer.toFixed(2)}%`,
        color: theme === "dark" ? "text-white" : "text-gray-900",
      });
    }
    if (
      availableOptionalMetricNames.has("LER") &&
      selectedEntry.ler != null &&
      !Number.isNaN(selectedEntry.ler)
    ) {
      items.push({
        label: "LER",
        value: `${selectedEntry.ler.toFixed(2)}%`,
        color: "text-[#F59E0B]",
      });
    }
    if (
      availableOptionalMetricNames.has("WER_H") &&
      selectedEntry.werH != null &&
      !Number.isNaN(selectedEntry.werH)
    ) {
      items.push({
        label: "WER_H",
        value: `${selectedEntry.werH.toFixed(2)}%`,
        color: "text-[#10B981]",
      });
    }
    return items;
  }, [selectedEntry, theme, availableOptionalMetricNames]);

  const renderManifestTab = () => (
    <div className="reson-vocab-viz-page">
      <div className={panelCard} data-tour="manifest-summary">
        <div className="reson-vocab-section-header">
          <div className="min-w-0">
            <h3
              className={`reson-vocab-panel-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Сводка манифеста
            </h3>
            <p
              className={`reson-vocab-panel-desc mb-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Записи прогона и агрегированные показатели качества
            </p>
          </div>
          <VocabSectionHint
            isDark={theme === "dark"}
            triggerText="Что означают метрики?"
            panelTitle="Сводка манифеста"
            panelSubtitle="Кратко о числах в шапке раздела"
            panelAriaLabel="Пояснение сводки манифеста"
            items={[...MANIFEST_SUMMARY_HINT_ITEMS]}
            scrollable
          />
        </div>

        <div className="reson-word-modal-metrics">
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">Всего записей</div>
            <div
              className={`reson-word-modal-metric-value ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {totalRecords.toLocaleString()}
            </div>
            <div className="reson-word-modal-metric-sub">в манифесте</div>
          </div>
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">Отображено</div>
            <div className="reson-word-modal-metric-value text-[#10B981]">
              {displayedRecords.toLocaleString()}
            </div>
            <div className="reson-word-modal-metric-sub">после фильтров</div>
          </div>
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">Средний WER</div>
            <div className="reson-word-modal-metric-value text-[#F59E0B]">
              {avgWER.toFixed(2)}%
            </div>
            <div className="reson-word-modal-metric-sub">по выборке</div>
          </div>
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">С ошибками</div>
            <div className="reson-word-modal-metric-value text-[#EF4444]">
              {recordsWithErrors.toLocaleString()}
            </div>
            <div className="reson-word-modal-metric-sub">WER &gt; 0</div>
          </div>
        </div>
      </div>

      <div className={panelCard}>
        <div className="reson-vocab-section-header">
          <div className="min-w-0">
            <h3
              className={`reson-vocab-panel-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Метрики качества распознавания
            </h3>
            <p
              className={`reson-vocab-panel-desc mb-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Основные и дополнительные метрики из RESON Run
            </p>
          </div>
          <VocabSectionHint
            isDark={theme === "dark"}
            triggerText="Что означают столбцы?"
            panelTitle="Метрики прогона"
            panelSubtitle="Расшифровка таблицы RESON Run"
            panelAriaLabel="Пояснение метрик прогона"
            items={[...MANIFEST_RUN_HINT_ITEMS]}
            scrollable
          />
        </div>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full">
            <thead>
              <tr
                className={`border-b ${
                  theme === "dark"
                    ? "border-[#2A2D35] bg-[#23262F]"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                {["Метрика", "Значение", "Среднее", "Ст. откл.", "INS", "DEL", "SUB", "EQ", "LEN", "NOM"].map(
                  (label) => (
                    <th
                      key={label}
                      className={`text-left py-2.5 px-3 text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {runMetricsRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b ${
                    theme === "dark" ? "border-[#2A2D35]" : "border-gray-100"
                  }`}
                >
                  <td
                    className={`py-2.5 px-3 text-sm font-medium ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {row.metric}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {row.value}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {row.avg}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {row.std}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-[#3B82F6]" : "text-blue-600"
                    }`}
                  >
                    {row.ins}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-[#EF4444]" : "text-red-600"
                    }`}
                  >
                    {row.del}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-[#F59E0B]" : "text-amber-600"
                    }`}
                  >
                    {row.sub}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {row.eq}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {row.len}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-xs tabular-nums ${
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {row.nom}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        data-tour="manifest-filters"
        className={`reson-vocab-analytics-filters border ${
          theme === "dark"
            ? "bg-[#1A1D24] border-[#2A2D35]"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <div className="reson-vocab-section-header">
          <div className="min-w-0">
            <h3
              className={`reson-vocab-panel-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Фильтры манифеста
            </h3>
            <p
              className={`reson-vocab-panel-desc mb-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Поиск, длительность, отбор записей и отображение столбцов
            </p>
          </div>
          <VocabSectionHint
            isDark={theme === "dark"}
            triggerText="Что означают столбцы?"
            panelTitle="Таблица манифеста"
            panelSubtitle="Метрики и режим diff"
            panelAriaLabel="Пояснение столбцов манифеста"
            items={[...MANIFEST_TABLE_HINT_ITEMS]}
            scrollable
          />
        </div>

        <div className="reson-vocab-analytics-query-row">
          <div>
            <label
              className={`block text-xs mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Поиск по записям
            </label>
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Текст, путь к файлу..."
                className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Какие записи вывести
            </label>
            <div className="relative">
              <select
                value={recordsFilter}
                onChange={(e) => setRecordsFilter(e.target.value)}
                className={`w-full appearance-none pl-3 pr-9 py-2 rounded-lg border text-sm ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Все записи</option>
                <option value="with_errors">Только с ошибками</option>
                <option value="without_errors">Только без ошибок</option>
                <option value="top10">Топ-10% WER</option>
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label
              className={`block text-xs mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Тип длительности
            </label>
            <div className="relative">
              <select
                value={durationType}
                onChange={(e) => setDurationType(e.target.value)}
                className={`w-full appearance-none pl-3 pr-9 py-2 rounded-lg border text-sm ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Все длительности</option>
                <option value="short">Короткие (до 5 сек)</option>
                <option value="normal">Средние (5–30 сек)</option>
                <option value="long">Длинные (30+ сек)</option>
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Режим отображения текста
            </label>
            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                theme === "dark"
                  ? "bg-[#23262F] border-[#2A2D35]"
                  : "bg-white border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-sm truncate ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                >
                  Показывать разницу
                </span>
                <div className="relative group shrink-0">
                  <Info
                    className={`w-3.5 h-3.5 cursor-help ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                  />
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${
                      theme === "dark"
                        ? "bg-[#2A2D35] border border-[#3A3D45] shadow-xl"
                        : "bg-white border border-gray-200 shadow-xl"
                    }`}
                  >
                    <p
                      className={`text-xs leading-relaxed ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                    >
                      Объединяет эталон и гипотезу в одну колонку с подсветкой
                      удалений, вставок и замен.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiff(!showDiff)}
                className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                style={{
                  backgroundColor: showDiff
                    ? "#8B5CF6"
                    : theme === "dark"
                      ? "#2A2D35"
                      : "#D1D5DB",
                }}
                aria-pressed={showDiff}
              >
                <div
                  className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${
                    showDiff ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label
            className={`block text-xs mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
          >
            Столбцы таблицы
          </label>
          <div className="flex flex-wrap gap-1.5">
            {columnOptions.map(({ key, label, shortLabel }) => {
              const isOn =
                visibleColumns[key as keyof typeof visibleColumns];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    toggleColumn(key as keyof typeof visibleColumns)
                  }
                  title={label}
                  aria-pressed={isOn}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                    isOn
                      ? theme === "dark"
                        ? "bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#C4B5FD]"
                        : "bg-violet-100 border-violet-300 text-violet-800"
                      : theme === "dark"
                        ? "bg-[#23262F] border-[#2A2D35] text-gray-500 hover:text-gray-300"
                        : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="reson-vocab-analytics-toolbar">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                theme === "dark"
                  ? "bg-[#F44336]/20 text-[#F44336] hover:bg-[#F44336]/30"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
            >
              <X className="w-3.5 h-3.5" />
              Сбросить
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCSV}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
          <p
            className={`reson-vocab-analytics-count ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}
          >
            Найдено записей:{" "}
            <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
              {displayedRecords.toLocaleString()}
            </span>
            {" · "}
            с ошибками:{" "}
            <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
              {recordsWithErrors.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      <div
        data-tour="manifest-table"
        className={`rounded-xl border overflow-hidden ${
          theme === "dark"
            ? "bg-[#1A1D24] border-[#2A2D35]"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className={`border-b ${
                  theme === "dark"
                    ? "border-[#2A2D35] bg-[#23262F]"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <th
                  className={`text-left py-2.5 px-3 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Детали
                </th>
                {visibleColumns.audio_filepath && (
                  <th
                    className={`text-left py-2.5 px-3 text-xs ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Путь к файлу
                  </th>
                )}
                {visibleColumns.duration && (
                  <th {...sortableThProps("duration", "right")}>
                    <span className="reson-vocab-sort-label">
                      Длительность
                      {renderSortIcon("duration")}
                    </span>
                  </th>
                )}
                {visibleColumns.wer && (
                  <th {...sortableThProps("wer", "center")}>
                    <span className="reson-vocab-sort-label">
                      WER
                      {renderSortIcon("wer")}
                    </span>
                  </th>
                )}
                {visibleColumns.ins && (
                  <th {...sortableThProps("ins", "right")}>
                    <span className="reson-vocab-sort-label">
                      INS
                      {renderSortIcon("ins")}
                    </span>
                  </th>
                )}
                {visibleColumns.del && (
                  <th {...sortableThProps("del", "right")}>
                    <span className="reson-vocab-sort-label">
                      DEL
                      {renderSortIcon("del")}
                    </span>
                  </th>
                )}
                {visibleColumns.sub && (
                  <th {...sortableThProps("sub", "right")}>
                    <span className="reson-vocab-sort-label">
                      SUB
                      {renderSortIcon("sub")}
                    </span>
                  </th>
                )}
                {!showDiff ? (
                  <>
                    {visibleColumns.text && (
                      <th
                        className={`text-left py-2.5 px-3 text-xs ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Оригинальный текст
                      </th>
                    )}
                    {visibleColumns.prediction && (
                      <th
                        className={`text-left py-2.5 px-3 text-xs ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Предсказанный текст
                      </th>
                    )}
                  </>
                ) : (
                  (visibleColumns.text || visibleColumns.prediction) && (
                    <th
                      className={`text-left py-2.5 px-3 text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Разница
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className={`py-8 px-3 text-center text-sm ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    {manifestEntries.length === 0
                      ? "Нет данных манифеста. Сгенерируйте отчёт из JSON с манифестом."
                      : "Нет записей по текущим фильтрам."}
                  </td>
                </tr>
              ) : (
                paginatedData.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`border-b ${
                      theme === "dark"
                        ? "border-[#2A2D35]"
                        : "border-gray-100"
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className={`text-xs transition-colors ${
                          theme === "dark"
                            ? "text-[#8B5CF6] hover:text-[#A78BFA]"
                            : "text-[#8B5CF6] hover:text-[#6D28D9]"
                        }`}
                        title="Посмотреть детали"
                      >
                        Ⓘ Показать
                      </button>
                    </td>
                    {visibleColumns.audio_filepath && (
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`max-w-[200px] truncate text-sm ${
                              theme === "dark" ? "text-gray-300" : "text-gray-700"
                            }`}
                            title={entry.audioPath}
                          >
                            {entry.audioPath}
                          </span>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(entry.audioPath)
                            }
                            className={`p-1 rounded transition-colors ${
                              theme === "dark"
                                ? "hover:bg-[#2A2D35]"
                                : "hover:bg-gray-200"
                            }`}
                            title="Скопировать путь"
                          >
                            <Copy
                              className={`w-3 h-3 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                            />
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.duration && (
                      <td
                        className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        {entry.duration.toFixed(2)} с
                      </td>
                    )}
                    {visibleColumns.wer && (
                      <td
                        className={`py-2.5 px-3 text-center text-xs tabular-nums ${
                          entry.wer > 0
                            ? theme === "dark"
                              ? "text-[#F59E0B]"
                              : "text-amber-600"
                            : theme === "dark"
                              ? "text-gray-300"
                              : "text-gray-700"
                        }`}
                      >
                        {entry.wer.toFixed(2)}%
                      </td>
                    )}
                    {visibleColumns.ins && (
                      <td
                        className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                          theme === "dark" ? "text-[#3B82F6]" : "text-blue-600"
                        }`}
                      >
                        {entry.ins}
                      </td>
                    )}
                    {visibleColumns.del && (
                      <td
                        className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                          theme === "dark" ? "text-[#EF4444]" : "text-red-600"
                        }`}
                      >
                        {entry.del}
                      </td>
                    )}
                    {visibleColumns.sub && (
                      <td
                        className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                          theme === "dark" ? "text-[#F59E0B]" : "text-amber-600"
                        }`}
                      >
                        {entry.sub}
                      </td>
                    )}
                    {!showDiff ? (
                      <>
                        {visibleColumns.text && (
                          <td
                            className={`py-2.5 px-3 text-sm max-w-[280px] truncate ${
                              theme === "dark" ? "text-gray-300" : "text-gray-700"
                            }`}
                            title={entry.originalText}
                          >
                            {entry.originalText}
                          </td>
                        )}
                        {visibleColumns.prediction && (
                          <td
                            className={`py-2.5 px-3 text-sm max-w-[280px] truncate ${
                              theme === "dark" ? "text-gray-300" : "text-gray-700"
                            }`}
                            title={entry.predictedText}
                          >
                            {entry.predictedText}
                          </td>
                        )}
                      </>
                    ) : (
                      (visibleColumns.text || visibleColumns.prediction) && (
                        <td className="py-2.5 px-3 text-sm">
                          {renderDiffForModal(entry)}
                        </td>
                      )
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${
          theme === "dark" ? "text-gray-400" : "text-gray-600"
        }`}
      >
        <PageSizeSelect
          id="manifest-page-size"
          value={recordsPerPage}
          onChange={(size) => {
            setRecordsPerPage(size);
            setCurrentPage(1);
          }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1 || totalPages === 0}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Предыдущая
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span>Страница {totalPages === 0 ? 0 : currentPage}</span>
            <span>из {Math.max(totalPages, 1)}</span>
          </div>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages || totalPages === 0}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            Следующая
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );


  const renderReplacementsTab = () => (
    <div
      className={`rounded-xl border p-12 text-center ${
        theme === "dark"
          ? "bg-[#1A1D24] border-[#2A2D35]"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      <Settings
        className={`w-12 h-12 mx-auto mb-3 ${
          theme === "dark" ? "text-gray-600" : "text-gray-400"
        }`}
      />
      <p
        className={
          theme === "dark" ? "text-gray-500" : "text-gray-500"
        }
      >
        Словарь замен не настроен
      </p>
      <p
        className={`text-sm mt-2 ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`}
      >
        Эта функция опциональна и может быть добавлена при
        необходимости
      </p>
    </div>
  );

  return (
    <div
      className={`reson-manifest-page relative min-h-full p-8 max-w-[1400px] ${
        theme === "dark"
          ? "bg-[#0F1117] text-white"
          : "bg-[#F5F7FA] text-gray-900"
      }`}
    >
      {/* Заголовок с иконкой */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                theme === "dark"
                  ? "bg-gradient-to-r from-[#F59E0B] to-[#FCD34D]"
                  : "bg-gradient-to-br from-[#F59E0B] to-[#FCD34D]"
              }`}
            >
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1
              className={`text-2xl ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Манифест
            </h1>
          </div>
          <p
            className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
          >
            Информация о запуске и настройках анализа
          </p>
        </div>

        
      </div>

      {/* Вкладки */}
      <div className="flex items-center gap-2 mb-6">
        
        
      </div>

      {/* Контент вкладок */}
      {activeSubTab === "manifest" && renderManifestTab()}
      {activeSubTab === "replacements" &&
        renderReplacementsTab()}


      {/* Модальное окно детализации примера */}
      {selectedEntry && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setSelectedEntry(null)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl pointer-events-auto ${
                theme === 'dark'
                  ? 'bg-[#1A1D24] border border-[#2A2D35]'
                  : 'bg-white border border-gray-200 shadow-2xl'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`reson-word-modal-header ${theme === "dark" ? "reson-word-modal-header--dark" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <h2
                    className={`reson-vocab-panel-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                  >
                    Детализация примера
                  </h2>
                  <p
                    className={`reson-vocab-panel-desc mb-0 truncate ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    title={selectedEntry.audioPath}
                  >
                    {audioBasename(selectedEntry.audioPath)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className={`p-2 rounded-lg transition-colors shrink-0 ${
                    theme === "dark"
                      ? "hover:bg-[#2A2D35] text-gray-400"
                      : "hover:bg-gray-100 text-gray-600"
                  }`}
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="reson-word-modal-body">
                <div className="reson-word-modal-metrics">
                  <div className={metricCard}>
                    <div className="reson-word-modal-metric-label">WER</div>
                    <div className="reson-word-modal-metric-value text-[#F59E0B]">
                      {selectedEntry.wer.toFixed(2)}%
                    </div>
                    <div className="reson-word-modal-metric-sub">Word Error Rate</div>
                  </div>
                  <div className={metricCard}>
                    <div className="reson-word-modal-metric-label">Длительность</div>
                    <div
                      className={`reson-word-modal-metric-value ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {selectedEntry.duration.toFixed(2)} с
                    </div>
                    <div className="reson-word-modal-metric-sub">время записи</div>
                  </div>
                  <div className={metricCard}>
                    <div className="reson-word-modal-metric-label">Тип длительности</div>
                    <div
                      className={`reson-word-modal-metric-value ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {selectedEntry.durationType ??
                        (selectedEntry.duration < 5
                          ? "short"
                          : selectedEntry.duration < 30
                            ? "normal"
                            : "long")}
                    </div>
                    <div className="reson-word-modal-metric-sub">класс длины</div>
                  </div>
                  <div className={metricCard}>
                    <div className="reson-word-modal-metric-label">Ошибки</div>
                    <div className="reson-word-modal-metric-value text-[#EF4444]">
                      {selectedEntry.ins + selectedEntry.del + selectedEntry.sub}
                    </div>
                    <div className="reson-word-modal-metric-sub">
                      INS {selectedEntry.ins} · DEL {selectedEntry.del} · SUB{" "}
                      {selectedEntry.sub}
                    </div>
                  </div>
                </div>

                {/* Разница, REF и HYP в двухколоночном layout — та же подсветка, что в Словаре (по diff_tokens) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Левая колонка: Разница */}
                  <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-gray-50'}`}>
                    <div className={`text-sm mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Разница
                    </div>
                    <div className="text-sm leading-relaxed">
                      {renderDiffForModal(selectedEntry)}
                    </div>
                  </div>

                  {/* Правая колонка: Оригинальный и Предсказанный текст */}
                  <div className="space-y-4">
                    {/* Оригинальный текст */}
                    <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-blue-50'}`}>
                      <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Оригинальный текст
                      </div>
                      <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {selectedEntry.originalText}
                      </div>
                    </div>

                    {/* Предсказанный текст */}
                    <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-blue-50'}`}>
                      <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Предсказанный текст
                      </div>
                      <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {selectedEntry.predictedText}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Аудио проигрыватель */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Аудио проигрыватель
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={`truncate text-xs max-w-[220px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                        title={selectedEntry.audioPath}
                      >
                        {audioBasename(selectedEntry.audioPath)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(selectedEntry.audioPath)}
                        className={`shrink-0 rounded p-1.5 transition-colors ${
                          theme === 'dark' ? 'hover:bg-[#2A2D35] text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                        }`}
                        title="Скопировать полный путь к файлу"
                        aria-label="Скопировать полный путь к файлу"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-gray-50'}`}>
                    <audio
                      controls
                      preload="none"
                      className="w-full"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const errorMsg = target.parentElement?.querySelector('.audio-error-msg');
                        if (errorMsg) {
                          (errorMsg as HTMLElement).style.display = 'block';
                        }
                      }}
                      onLoadedData={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'block';
                        const errorMsg = target.parentElement?.querySelector('.audio-error-msg');
                        if (errorMsg) {
                          (errorMsg as HTMLElement).style.display = 'none';
                        }
                      }}
                    >
                      <source src={selectedEntry.audioPath} type="audio/wav" />
                      <source src={selectedEntry.audioPath} type="audio/mpeg" />
                      Ваш браузер не поддерживает аудио элемент.
                    </audio>
                    <div
                      className={`audio-error-msg text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                      style={{ display: 'none' }}
                    >
                      Не удалось загрузить аудиофайл «{audioBasename(selectedEntry.audioPath)}». Полный путь можно скопировать кнопкой выше.
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    className={`reson-word-modal-section-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                  >
                    Типы ошибок распознавания
                  </div>
                  <p
                    className={`reson-word-modal-section-desc mb-3 ${theme === "dark" ? "reson-word-modal-section-desc--dark" : ""}`}
                  >
                    Статистика ошибок для данной записи
                  </p>
                  <div className="reson-word-modal-metrics">
                    <div className={metricCard}>
                      <div className="reson-word-modal-metric-label">Удаления (DEL)</div>
                      <div className="reson-word-modal-metric-value text-[#EF4444]">
                        {selectedEntry.del}
                      </div>
                      <div className="reson-word-modal-metric-sub">
                        пропущено моделью
                      </div>
                    </div>
                    <div className={metricCard}>
                      <div className="reson-word-modal-metric-label">Вставки (INS)</div>
                      <div className="reson-word-modal-metric-value text-[#10B981]">
                        {selectedEntry.ins}
                      </div>
                      <div className="reson-word-modal-metric-sub">
                        лишние слова
                      </div>
                    </div>
                    <div className={metricCard}>
                      <div className="reson-word-modal-metric-label">Замены (SUB)</div>
                      <div className="reson-word-modal-metric-value text-[#F59E0B]">
                        {selectedEntry.sub}
                      </div>
                      <div className="reson-word-modal-metric-sub">
                        заменённые слова
                      </div>
                    </div>
                  </div>
                </div>

                {/* Детализация по словам — по выравниванию diff_tokens (ref/hyp) */}
                <div>
                  <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Детализация по словам
                  </div>
                  {(() => {
                    const tokens = selectedEntry.diff_tokens ?? [];
                    const errorRows: Array<{ word: string; type: string; bgClass: string; replacedWith?: string }> = [];
                    for (let i = 0; i < tokens.length; i++) {
                      const t = tokens[i];
                      if (t.type === 'del') {
                        errorRows.push({ word: t.word, type: 'Удаление', bgClass: 'bg-red-100 text-red-700' });
                      } else if (t.type === 'ins') {
                        errorRows.push({ word: t.word, type: 'Вставка', bgClass: 'bg-green-100 text-green-700' });
                      } else if (t.type === 'sub_del') {
                        const next = tokens[i + 1];
                        const replacedWith = next?.type === 'sub_ins' ? next.word : undefined;
                        errorRows.push({ word: t.word, type: 'Замена', bgClass: 'bg-yellow-100 text-yellow-700', replacedWith });
                      }
                    }
                    const totalErrors = errorRows.length;
                    return (
                      <>
                        <div className={`text-xs mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          Анализ слов с ошибками в текущей записи по выравниванию ref/hyp. Найдено {totalErrors} слово(в) с ошибками. Показано {totalErrors > 0 ? `1–${totalErrors}` : '0'} из {totalErrors}.
                        </div>
                        <div className={`text-xs mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          Легенда: <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">Удаление</span>
                          <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-700">Вставка</span>
                          <span className="ml-2 px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Замена</span>
                        </div>
                        <div className={`rounded-xl overflow-x-auto border ${theme === 'dark' ? 'border-[#2A2D35]' : 'border-gray-200'}`}>
                          <table className="w-full text-sm">
                            <thead className={theme === 'dark' ? 'bg-[#23262F]' : 'bg-gray-50'}>
                              <tr>
                                <th className={`text-left py-3 px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Слово</th>
                                <th className={`text-left py-3 px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Частота</th>
                                <th className={`text-left py-3 px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Ошибка</th>
                                <th className={`text-left py-3 px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Recall (%)</th>
                                <th className={`text-left py-3 px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Precision (%)</th>
                                <th className={`text-left py-3 px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>F1-score (%)</th>
                                <th className={`text-left py-3 px-4 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>WIS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {totalErrors === 0 ? (
                                <tr className={theme === 'dark' ? 'border-t border-[#2A2D35]' : 'border-t border-gray-100'}>
                                  <td colSpan={7} className={`py-6 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {tokens.length === 0 ? 'Нет данных о выравнивании для этой записи.' : 'В этой записи нет ошибок распознавания по выравниванию.'}
                                  </td>
                                </tr>
                              ) : (
                                errorRows.map((row, idx) => {
                                  const vocabWord = data?.vocab?.find((v: { word: string }) => v.word === row.word);
                                  const recall = vocabWord?.recall ?? 0;
                                  const precision = vocabWord?.precision ?? 0;
                                  const f1 = vocabWord?.f1_score ?? (recall && precision ? (2 * recall * precision) / (recall + precision) : 0);
                                  const wis = vocabWord?.wis ?? 0;
                                  const count = vocabWord?.count ?? '—';
                                  return (
                                    <tr key={idx} className={theme === 'dark' ? 'border-t border-[#2A2D35]' : 'border-t border-gray-100'}>
                                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {row.word}
                                        {row.replacedWith != null && (
                                          <span className={`ml-1 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>→ {row.replacedWith}</span>
                                        )}
                                      </td>
                                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{typeof count === 'number' ? count.toLocaleString() : count}</td>
                                      <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded text-xs ${row.bgClass}`}>{row.type}</span>
                                      </td>
                                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, recall)}%` }} />
                                          </div>
                                          <span className="text-xs w-10">{typeof recall === 'number' ? recall.toFixed(1) : '—'}</span>
                                        </div>
                                      </td>
                                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500" style={{ width: `${Math.min(100, precision)}%` }} />
                                          </div>
                                          <span className="text-xs w-10">{typeof precision === 'number' ? precision.toFixed(1) : '—'}</span>
                                        </div>
                                      </td>
                                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, f1)}%` }} />
                                          </div>
                                          <span className="text-xs w-10">{typeof f1 === 'number' ? f1.toFixed(1) : '—'}</span>
                                        </div>
                                      </td>
                                      <td className={`py-3 px-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <span className="text-orange-600">{typeof wis === 'number' ? wis.toFixed(1) : '—'}</span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {selectedOptionalMetrics.length > 0 && (
                  <div>
                    <div
                      className={`reson-word-modal-section-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      Дополнительные метрики
                    </div>
                    <p
                      className={`reson-word-modal-section-desc mb-3 ${theme === "dark" ? "reson-word-modal-section-desc--dark" : ""}`}
                    >
                      Опциональные метрики из данных RESON для этой записи
                    </p>
                    <div
                      className={`grid gap-3 ${
                        selectedOptionalMetrics.length === 1
                          ? "grid-cols-1"
                          : selectedOptionalMetrics.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      }`}
                    >
                      {selectedOptionalMetrics.map((metric) => (
                        <div key={metric.label} className={metricCard}>
                          <div className="reson-word-modal-metric-label">
                            {metric.label}
                          </div>
                          <div
                            className={`reson-word-modal-metric-value ${metric.color}`}
                          >
                            {metric.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}