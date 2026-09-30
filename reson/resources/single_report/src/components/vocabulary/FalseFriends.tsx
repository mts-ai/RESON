import { useState, useMemo, useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  X,
} from "lucide-react";
import { PageSizeSelect } from "../ui/PageSizeSelect";
import { VocabSectionHint } from "./VocabSectionHint";

type ErrorType = "truncation" | "transposition" | "insertion";
type SortField = "occurrences" | "distance" | "substitutionShare";

const FALSE_FRIENDS_HINT_ITEMS = [
  {
    color: "#6366F1",
    label: "Пары",
    range: "сводка",
    description:
      "Уникальные пары «ожидалось → распознано» с расстоянием Левенштейна 1–2.",
  },
  {
    color: "#10B981",
    label: "Случаев",
    range: "частота",
    description: "Сколько раз модель допустила такую замену в датасете.",
  },
  {
    color: "#F59E0B",
    label: "Доля среди замен",
    range: "%",
    description: "Доля ложных друзей среди всех зафиксированных замен слов.",
  },
  {
    color: "#EF4444",
    label: "Доля от всех ошибок",
    range: "% WER",
    description: "Вклад таких замен в общее число ошибок (INS + DEL + SUB).",
  },
  {
    color: "#3B82F6",
    label: "Тип ошибки",
    range: "класс",
    description:
      "Усечение, перестановка/опечатка или вставка — по разнице длин и символов.",
  },
  {
    color: "#8B5CF6",
    label: "Расстояние",
    range: "1–2",
    description:
      "Редакционное расстояние между эталонным и распознанным словом.",
  },
] as const;

interface FalseFriend {
  expected: string;
  recognized: string;
  type: ErrorType;
  occurrences: number;
  distance: number;
  substitutionShare: number;
}

// Функция для вычисления расстояния Левенштейна
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

export function FalseFriends() {
  const { theme } = useTheme();
  const { data } = useData();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [distanceFilter, setDistanceFilter] = useState<string>("all");
  const [minFrequency, setMinFrequency] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortField>("occurrences");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    typeFilter,
    distanceFilter,
    minFrequency,
    searchQuery,
    sortBy,
    sortDirection,
    itemsPerPage,
  ]);

  // Вычисляем false friends из replacements (как на бэке)
  const falseFriendsData = useMemo((): FalseFriend[] => {
    const replacements = data?.replacements;
    if (!replacements || !replacements.examples || replacements.examples.length === 0) {
      return [];
    }

    // Собираем пары замен из examples
    const pairs: Record<string, { expected: string; recognized: string; count: number }> = {};
    
    replacements.examples.forEach(example => {
      const expected = (example.found || '').toString().trim().toLowerCase();
      const recognized = (example.replaced || '').toString().trim().toLowerCase();
      
      if (!expected || !recognized || expected === recognized) return;
      
      const distance = levenshteinDistance(expected, recognized);
      if (distance <= 2 && distance > 0) {
        const key = `${expected}|${recognized}`;
        if (!pairs[key]) {
          pairs[key] = { expected, recognized, count: 0 };
        }
        pairs[key].count++;
      }
    });

    if (Object.keys(pairs).length === 0) {
      return [];
    }

    // Вычисляем общее количество всех замен (из stats или суммируя examples)
    const totalReplacements = replacements.stats?.totalReplacements || 
      replacements.examples.length;
    
    return Object.values(pairs)
      .map(pair => {
        const distance = levenshteinDistance(pair.expected, pair.recognized);
        let type: ErrorType = "transposition";
        if (pair.recognized.length < pair.expected.length) {
          type = "truncation";
        } else if (pair.recognized.length > pair.expected.length) {
          type = "insertion";
        }
        
        // Доля среди всех замен (как на бэке)
        const substitutionShare = totalReplacements > 0 
          ? (pair.count / totalReplacements) * 100 
          : 0;
        
        return {
          expected: pair.expected,
          recognized: pair.recognized,
          type,
          occurrences: pair.count,
          distance,
          substitutionShare: Number(substitutionShare.toFixed(2)),
        };
      })
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 50); // Ограничиваем топ-50
  }, [data?.replacements]);

  const getTypeLabel = (type: ErrorType): string => {
    switch (type) {
      case "truncation":
        return "Усечение";
      case "transposition":
        return "Перестановка/опечатка";
      case "insertion":
        return "Добавление/вставка";
    }
  };

  const getTypeStyle = (type: ErrorType): { bg: string; color: string } => {
    switch (type) {
      case "truncation":
        return theme === "dark"
          ? { bg: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }
          : { bg: "#fef3c7", color: "#b45309" };
      case "transposition":
        return theme === "dark"
          ? { bg: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" }
          : { bg: "#dbeafe", color: "#1d4ed8" };
      case "insertion":
        return theme === "dark"
          ? { bg: "rgba(16, 185, 129, 0.2)", color: "#34d399" }
          : { bg: "#d1fae5", color: "#047857" };
    }
  };

  const getCharacterDifference = (expected: string, recognized: string): string => {
    const diff = Math.abs(expected.length - recognized.length);
    if (diff === 0) {
      // Count character differences
      let count = 0;
      for (let i = 0; i < Math.max(expected.length, recognized.length); i++) {
        if (expected[i] !== recognized[i]) count++;
      }
      return `${count} → ${count} символов`;
    }
    return `${Math.min(expected.length, recognized.length)} → ${Math.max(expected.length, recognized.length)} символов`;
  };

  // Apply filters
  const filteredData = falseFriendsData.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (distanceFilter !== "all" && item.distance !== parseInt(distanceFilter)) return false;
    if (item.occurrences < minFrequency) return false;
    if (searchQuery && !item.expected.includes(searchQuery) && !item.recognized.includes(searchQuery)) return false;
    return true;
  });

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortDirection === "desc" ? -diff : diff;
    });
    return sorted;
  }, [filteredData, sortBy, sortDirection]);

  const hasActiveFilters =
    typeFilter !== "all" ||
    distanceFilter !== "all" ||
    minFrequency > 1 ||
    searchQuery.trim() !== "";

  const clearFilters = () => {
    setTypeFilter("all");
    setDistanceFilter("all");
    setMinFrequency(1);
    setSearchQuery("");
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    const isActive = sortBy === field;
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
      sortBy === field ? "reson-vocab-sortable-th--active" : ""
    } ${theme === "dark" ? "reson-vocab-sortable-th--dark" : ""}`,
    "aria-sort": (sortBy === field
      ? sortDirection === "asc"
        ? "ascending"
        : "descending"
      : "none") as "ascending" | "descending" | "none",
  });

  const panelCard = `reson-vocab-viz-card ${theme === "dark" ? "reson-vocab-viz-card--dark" : ""}`;
  const metricCard = `reson-word-modal-metric-card ${
    theme === "dark" ? "reson-word-modal-metric-card--dark" : ""
  }`;

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Summary metrics - вычисляем из реальных данных
  const totalPairs = useMemo(() => falseFriendsData.length, [falseFriendsData]);
  const totalOccurrences = useMemo(() => {
    return falseFriendsData.reduce((sum, item) => sum + item.occurrences, 0);
  }, [falseFriendsData]);
  const substitutionShare = useMemo(() => {
    // Доля false friends среди всех замен (как на бэке)
    const totalReplacements = data?.replacements?.stats?.totalReplacements || 0;
    return totalReplacements > 0 
      ? Number(((totalOccurrences / totalReplacements) * 100).toFixed(2))
      : 0;
  }, [totalOccurrences, data?.replacements?.stats?.totalReplacements]);
  
  const totalErrorShare = useMemo(() => {
    // Доля false friends от всех ошибок (как на бэке)
    const totalErrors = (data?.metrics?.wer?.insertions || 0) + 
                       (data?.metrics?.wer?.deletions || 0) + 
                       (data?.metrics?.wer?.substitutions || 0);
    return totalErrors > 0 
      ? Number(((totalOccurrences / totalErrors) * 100).toFixed(2))
      : 0;
  }, [totalOccurrences, data?.metrics?.wer]);

  // Export functions
  const exportToCSV = () => {
    const headers = ["Ожидалось", "Распознано", "Тип", "Случаев", "Расстояние", "Доля замен (%)"];
    const csvContent = [
      headers.join(","),
      ...sortedData.map((item) =>
        [
          item.expected,
          item.recognized,
          getTypeLabel(item.type),
          item.occurrences,
          item.distance,
          item.substitutionShare,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "false_friends.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const jsonData = sortedData.map((item) => ({
      expected: item.expected,
      recognized: item.recognized,
      type: getTypeLabel(item.type),
      occurrences: item.occurrences,
      distance: item.distance,
      substitutionShare: item.substitutionShare,
    }));

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "false_friends.json");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOccurrences = filteredData.reduce(
    (sum, item) => sum + item.occurrences,
    0,
  );

  return (
    <div className="reson-vocab-viz-page" data-tour="vocabulary-false-friends">
      <div className={panelCard}>
        <div className="reson-vocab-section-header">
          <div className="min-w-0">
            <h3
              className={`reson-vocab-panel-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Сводка ложных друзей
            </h3>
            <p
              className={`reson-vocab-panel-desc mb-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Похожие пары слов, которые модель путает при замене
            </p>
          </div>
          <VocabSectionHint
            isDark={theme === "dark"}
            triggerText="Что означают метрики?"
            panelTitle="Ложные друзья"
            panelSubtitle="Кратко о сводке и столбцах таблицы"
            panelAriaLabel="Пояснение метрик ложных друзей"
            items={[...FALSE_FRIENDS_HINT_ITEMS]}
            scrollable
          />
        </div>

        <div className="reson-word-modal-metrics">
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">Пар</div>
            <div
              className={`reson-word-modal-metric-value ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              {totalPairs.toLocaleString()}
            </div>
            <div className="reson-word-modal-metric-sub">уникальных пар</div>
          </div>
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">Случаев</div>
            <div className="reson-word-modal-metric-value text-[#10B981]">
              {totalOccurrences.toLocaleString()}
            </div>
            <div className="reson-word-modal-metric-sub">всего замен</div>
          </div>
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">Доля среди замен</div>
            <div className="reson-word-modal-metric-value text-[#F59E0B]">
              {substitutionShare.toFixed(2)}%
            </div>
            <div className="reson-word-modal-metric-sub">от всех SUB</div>
          </div>
          <div className={metricCard}>
            <div className="reson-word-modal-metric-label">Доля от всех ошибок</div>
            <div className="reson-word-modal-metric-value text-[#EF4444]">
              {totalErrorShare.toFixed(2)}%
            </div>
            <div className="reson-word-modal-metric-sub">вклад в WER</div>
          </div>
        </div>
      </div>

      <div
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
              Фильтры
            </h3>
            <p
              className={`reson-vocab-panel-desc mb-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Поиск и отбор пар по типу, расстоянию и частоте
            </p>
          </div>
        </div>

        <div className="reson-vocab-analytics-query-row">
          <div>
            <label
              className={`block text-xs mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Поиск пары
            </label>
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
              <input
                type="text"
                placeholder="Например, оператор"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
              Мин. частота
            </label>
            <input
              type="number"
              min="1"
              value={minFrequency}
              onChange={(e) => setMinFrequency(parseInt(e.target.value, 10) || 1)}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                theme === "dark"
                  ? "bg-[#23262F] border-[#2A2D35] text-white"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label
              className={`block text-xs mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Тип ошибки
            </label>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`w-full appearance-none pl-3 pr-9 py-2 rounded-lg border text-sm ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Все типы</option>
                <option value="truncation">Усечение</option>
                <option value="transposition">Перестановка/опечатка</option>
                <option value="insertion">Добавление/вставка</option>
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
              Расстояние Левенштейна
            </label>
            <div className="relative">
              <select
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(e.target.value)}
                className={`w-full appearance-none pl-3 pr-9 py-2 rounded-lg border text-sm ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="all">Все расстояния</option>
                <option value="1">1 символ</option>
                <option value="2">2 символа</option>
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="reson-vocab-analytics-toolbar">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
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
            onClick={exportToCSV}
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
            onClick={exportToJSON}
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
            Найдено пар:{" "}
            <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
              {filteredData.length.toLocaleString()}
            </span>
            {" · "}
            случаев:{" "}
            <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
              {filteredOccurrences.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      <div
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
                  Ожидалось
                </th>
                <th
                  className={`text-left py-2.5 px-3 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Распознано
                </th>
                <th
                  className={`text-left py-2.5 px-3 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Тип
                </th>
                <th {...sortableThProps("occurrences", "center")}>
                  <span className="reson-vocab-sort-label">
                    Случаев
                    {renderSortIcon("occurrences")}
                  </span>
                </th>
                <th {...sortableThProps("distance", "center")}>
                  <span className="reson-vocab-sort-label">
                    Расстояние
                    {renderSortIcon("distance")}
                  </span>
                </th>
                <th {...sortableThProps("substitutionShare", "right")}>
                  <span className="reson-vocab-sort-label">
                    Доля замен
                    {renderSortIcon("substitutionShare")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`py-8 px-3 text-center text-sm ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    Нет пар, подходящих под выбранные фильтры
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const typeStyle = getTypeStyle(item.type);
                  return (
                    <tr
                      key={`${item.expected}-${item.recognized}-${index}`}
                      className={`border-b ${
                        theme === "dark"
                          ? "border-[#2A2D35]"
                          : "border-gray-100"
                      }`}
                    >
                      <td
                        className={`py-2.5 px-3 text-sm ${
                          theme === "dark" ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {item.expected}
                      </td>
                      <td className="py-2.5 px-3">
                        <div
                          className={`text-sm ${
                            theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {item.recognized}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            theme === "dark" ? "text-gray-500" : "text-gray-500"
                          }`}
                        >
                          {getCharacterDifference(item.expected, item.recognized)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: typeStyle.bg,
                            color: typeStyle.color,
                          }}
                        >
                          {getTypeLabel(item.type)}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-center text-xs tabular-nums ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        {item.occurrences.toLocaleString()}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-center text-xs tabular-nums ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        {item.distance}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                          theme === "dark" ? "text-[#F59E0B]" : "text-amber-600"
                        }`}
                      >
                        {item.substitutionShare.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 mt-4 ${
          theme === "dark" ? "text-gray-400" : "text-gray-600"
        }`}
      >
        <PageSizeSelect
          value={itemsPerPage}
          onChange={(size) => {
            setItemsPerPage(size);
            setCurrentPage(1);
          }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
            disabled={currentPage === 1 || totalPages === 0}
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            }`}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Следующая
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}