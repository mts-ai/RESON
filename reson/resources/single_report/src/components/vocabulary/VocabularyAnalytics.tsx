import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Download,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { DualRangeSlider } from "./DualRangeSlider";
import { WordDetailsModal } from "./WordDetailsModal";
import { PageSizeSelect } from "../ui/PageSizeSelect";
import { VocabSectionHint } from "./VocabSectionHint";

const INTERACTIVE_DICT_HINT_ITEMS = [
  {
    color: "#10B981",
    label: "Recall",
    range: "полнота",
    description:
      "Доля вхождений слова в эталоне, которые модель распознала верно.",
  },
  {
    color: "#3B82F6",
    label: "Precision",
    range: "точность",
    description:
      "Доля верных распознаваний среди всех случаев, когда слово появилось в гипотезе.",
  },
  {
    color: "#8B5CF6",
    label: "F1-score",
    range: "баланс",
    description: "Сводная метрика между recall и precision для быстрого сравнения слов.",
  },
  {
    color: "#EF4444",
    label: "Удаления",
    range: "DEL",
    description: "Сколько раз слово из эталона было пропущено в распознавании.",
  },
  {
    color: "#F59E0B",
    label: "Замены",
    range: "SUB",
    description: "Сколько раз слово эталона было заменено на другое в гипотезе.",
  },
  {
    color: "#6366F1",
    label: "Вставки",
    range: "INS",
    description: "Сколько раз слово лишний раз появилось в гипотезе без эталона.",
  },
  {
    color: "#F97316",
    label: "WIS",
    range: "0–100",
    description:
      "Приоритет слова для улучшения модели: учитывает частоту и серьёзность ошибок.",
  },
] as const;

type SortField =
  | "frequency"
  | "recall"
  | "precision"
  | "f1"
  | "deletions"
  | "substitutions"
  | "insertions"
  | "wis";
type SortDirection = "asc" | "desc";

interface VocabularyAnalyticsProps {
  initialSearchTerm?: string;
  initialSelectedWord?: string;
  onWordOpen?: (word: string) => void;
  onWordClose?: () => void;
}

export function VocabularyAnalytics({
  initialSearchTerm = "",
  initialSelectedWord,
  onWordOpen,
  onWordClose,
}: VocabularyAnalyticsProps) {
  const { theme } = useTheme();
  const { data } = useData();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [wordTypeFilter, setWordTypeFilter] = useState("Все");
  const [frequencyRange, setFrequencyRange] = useState([0, 0]);
  const [recallRange, setRecallRange] = useState([0, 100]);
  const [lengthRange, setLengthRange] = useState<[number, number]>([0, 1]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setSelectedWord(initialSelectedWord ?? null);
  }, [initialSelectedWord]);

  // Update search term when initialSearchTerm changes
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, searchTerm, wordTypeFilter, sortBy, sortDirection]);

  // Преобразуем данные словаря в формат для аналитики
  const vocabularyData = useMemo(() => {
    if (!data?.vocab) return [];
    
    return data.vocab.map(w => {
      const word = w.word.toLowerCase();
      let type = "OTHER";
      if (/[а-яё]/.test(word) && !/[a-z]/.test(word)) type = "RU";
      else if (/[a-z]/.test(word) && !/[а-яё]/.test(word)) type = "EN";
      else if (/^\d+$/.test(word)) type = "NUM";
      
      return {
        word: w.word,
        type,
        frequency: w.count,
        recall: w.recall || 0,
        precision: w.precision || 0,
        f1: w.f1_score || 0,
        deletions: w.deletions ?? 0,
        substitutions: w.substitutions ?? 0,
        insertions: w.insertions ?? 0,
        wis: w.wis || 0,
      };
    });
  }, [data?.vocab]);


  // Пороги WIS (согласованы с WordDetailsModal):
  // Маленький: < 30
  // Умеренный: 30-45
  // Средний: 45-60
  // Высокий: 60-75
  // Критический: >= 75
  const getWISColor = (wis: number) => {
    if (wis < 30)
      return theme === "dark"
        ? "text-[#10B981]"
        : "text-green-600";
    if (wis < 45)
      return theme === "dark"
        ? "text-[#A3E635]"
        : "text-lime-600";
    if (wis < 60)
      return theme === "dark"
        ? "text-[#F59E0B]"
        : "text-yellow-600";
    if (wis < 75)
    return theme === "dark"
      ? "text-[#F97316]"
      : "text-orange-600";
    return theme === "dark"
      ? "text-[#EF4444]"
      : "text-red-600";
  };

  const getWISBgColor = (wis: number) => {
    if (wis < 30)
      return theme === "dark"
        ? "bg-[#10B981]/20"
        : "bg-green-100";
    if (wis < 45)
      return theme === "dark"
        ? "bg-[#A3E635]/20"
        : "bg-lime-100";
    if (wis < 60)
      return theme === "dark"
        ? "bg-[#F59E0B]/20"
        : "bg-yellow-100";
    if (wis < 75)
    return theme === "dark"
      ? "bg-[#F97316]/20"
      : "bg-orange-100";
    return theme === "dark"
      ? "bg-[#EF4444]/20"
      : "bg-red-100";
  };

  // Вычисляем максимальные значения для фильтров
  const maxFrequency = useMemo(() => {
    if (!vocabularyData.length) return 6400;
    return Math.max(...vocabularyData.map(w => w.frequency));
  }, [vocabularyData]);

  const maxLength = useMemo(() => {
    if (!vocabularyData.length) return 24;
    return Math.max(...vocabularyData.map(w => w.word.length));
  }, [vocabularyData]);

  // Синхронизируем диапазоны с данными — иначе слайдер «Длина слова» может вылезать за границы
  useEffect(() => {
    if (!vocabularyData.length) return;
    setFrequencyRange([0, maxFrequency]);
    setLengthRange([0, maxLength]);
  }, [maxFrequency, maxLength, vocabularyData.length]);

  const hasActiveFilters =
    searchTerm ||
    wordTypeFilter !== "Все" ||
    frequencyRange[0] !== 0 ||
    frequencyRange[1] !== maxFrequency ||
    recallRange[0] !== 0 ||
    recallRange[1] !== 100 ||
    lengthRange[0] !== 0 ||
    lengthRange[1] !== maxLength;

  const clearFilters = () => {
    setSearchTerm("");
    setWordTypeFilter("Все");
    setFrequencyRange([0, maxFrequency]);
    setRecallRange([0, 100]);
    setLengthRange([0, maxLength]);
  };

  // Apply filters
  const filteredData = useMemo(() => {
    return vocabularyData.filter((item) => {
      // Search filter
      if (
        searchTerm &&
        !item.word.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Word type filter
      if (wordTypeFilter !== "Все") {
        if (wordTypeFilter === "Русские" && item.type !== "RU") return false;
        if (wordTypeFilter === "Английские" && item.type !== "EN")
          return false;
        if (wordTypeFilter === "Числа" && item.type !== "NUM") return false;
        if (wordTypeFilter === "Прочие" && item.type !== "OTHER")
          return false;
      }

      // Frequency filter
      if (
        item.frequency < frequencyRange[0] ||
        item.frequency > frequencyRange[1]
      ) {
        return false;
      }

      // Recall filter
      if (item.recall < recallRange[0] || item.recall > recallRange[1]) {
        return false;
      }

      // Length filter
      if (
        item.word.length < lengthRange[0] ||
        item.word.length > lengthRange[1]
      ) {
        return false;
      }

      return true;
    });
  }, [
    vocabularyData,
    searchTerm,
    wordTypeFilter,
    frequencyRange,
    recallRange,
    lengthRange
  ]);

  // Sort data
  const sortedData = filteredData.sort((a, b) => {
    if (!sortBy) return 0;
    const valueA = a[sortBy];
    const valueB = b[sortBy];
    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }
    return 0;
  });

  // Pagination
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to desc
      setSortBy(field);
      setSortDirection("desc");
    }
    setCurrentPage(1); // Reset to first page
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

  // Export to CSV
  const exportToCSV = () => {
    // Create CSV header
    const headers = [
      "Слово",
      "Тип",
      "Частота",
      "Recall (%)",
      "Precision (%)",
      "F1-score (%)",
      "Удаления",
      "Замены",
      "Вставки",
      "WIS",
    ];

    const rows = sortedData.map((row) => [
      row.word,
      row.type,
      row.frequency,
      row.recall,
      row.precision,
      row.f1,
      row.deletions,
      row.substitutions,
      row.insertions,
      row.wis,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `vocabulary_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const exportToJSON = () => {
    const jsonData = {
      exportDate: new Date().toISOString(),
      totalWords: sortedData.length,
      data: sortedData,
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `vocabulary_data_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Filters */}
      <div
        data-tour="vocabulary-analytics-filters"
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
              Фильтры словаря
            </h3>
            <p
              className={`reson-vocab-panel-desc mb-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              Поиск, тип слова и диапазоны метрик
            </p>
          </div>
          <VocabSectionHint
            isDark={theme === "dark"}
            triggerText="Что означают эти метрики?"
            panelTitle="Столбцы таблицы"
            panelSubtitle="Кратко о числовых метриках"
            panelAriaLabel="Пояснение метрик интерактивного словаря"
            items={[...INTERACTIVE_DICT_HINT_ITEMS]}
            scrollable
          />
        </div>

        <div className="reson-vocab-analytics-query-row">
          <div>
            <label
              className={`block text-xs mb-1.5 ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Поиск слова
            </label>
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
              <input
                type="text"
                placeholder="Введите слово..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm transition-colors ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs mb-1.5 ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Тип слова
            </label>
            <div className="relative">
              <select
                value={wordTypeFilter}
                onChange={(e) => setWordTypeFilter(e.target.value)}
                className={`w-full appearance-none pl-3 pr-9 py-2 rounded-lg border text-sm transition-colors ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option>Все</option>
                <option>Русские</option>
                <option>Английские</option>
                <option>Числа</option>
                <option>Прочие</option>
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="reson-vocab-analytics-sliders">
          <div className="min-w-0 overflow-hidden reson-vocab-analytics-slider--wide">
            <label
              className={`block text-xs mb-1.5 ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Частота: {frequencyRange[0]} – {frequencyRange[1]}
            </label>
            <DualRangeSlider
              min={0}
              max={maxFrequency}
              value={frequencyRange}
              onChange={setFrequencyRange}
            />
          </div>
          <div className="min-w-0 overflow-hidden">
            <label
              className={`block text-xs mb-1.5 ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Recall: {recallRange[0]}% – {recallRange[1]}%
            </label>
            <DualRangeSlider
              min={0}
              max={100}
              value={recallRange}
              onChange={setRecallRange}
            />
          </div>
          <div className="min-w-0 overflow-hidden">
            <label
              className={`block text-xs mb-1.5 ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Длина слова: {lengthRange[0]} – {lengthRange[1]}
            </label>
            <DualRangeSlider
              min={0}
              max={maxLength}
              value={lengthRange}
              onChange={setLengthRange}
            />
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={exportToCSV}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={exportToJSON}
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>

          <p
            className={`reson-vocab-analytics-count ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}
          >
            Найдено слов:{" "}
            <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
              {filteredData.length.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      {/* Table */}
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
                    theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  Слово
                </th>
                <th
                  className={`text-center py-2.5 px-3 text-xs ${
                    theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  Тип
                </th>
                <th {...sortableThProps("frequency", "right")}>
                  <span className="reson-vocab-sort-label">
                    Частота
                    {renderSortIcon("frequency")}
                  </span>
                </th>
                <th {...sortableThProps("recall", "center")}>
                  <span className="reson-vocab-sort-label">
                    Recall (%)
                    {renderSortIcon("recall")}
                  </span>
                </th>
                <th {...sortableThProps("precision", "center")}>
                  <span className="reson-vocab-sort-label">
                    Precision (%)
                    {renderSortIcon("precision")}
                  </span>
                </th>
                <th {...sortableThProps("f1", "center")}>
                  <span className="reson-vocab-sort-label">
                    F1-score (%)
                    {renderSortIcon("f1")}
                  </span>
                </th>
                <th {...sortableThProps("deletions", "right")}>
                  <span className="reson-vocab-sort-label">
                    Удаления
                    {renderSortIcon("deletions")}
                  </span>
                </th>
                <th {...sortableThProps("substitutions", "right")}>
                  <span className="reson-vocab-sort-label">
                    Замены
                    {renderSortIcon("substitutions")}
                  </span>
                </th>
                <th {...sortableThProps("insertions", "right")}>
                  <span className="reson-vocab-sort-label">
                    Вставки
                    {renderSortIcon("insertions")}
                  </span>
                </th>
                <th {...sortableThProps("wis", "center")}>
                  <span className="reson-vocab-sort-label">
                    ⚡ WIS
                    {renderSortIcon("wis")}
                  </span>
                </th>
                <th
                  className={`text-center py-2.5 px-3 text-xs ${
                    theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  Детали
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={`border-b ${
                    theme === "dark"
                      ? "border-[#2A2D35]"
                      : "border-gray-100"
                  }`}
                >
                  <td
                    className={`py-2.5 px-3 text-sm ${
                      theme === "dark"
                        ? "text-white"
                        : "text-gray-900"
                    }`}
                  >
                    {row.word}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        theme === "dark"
                          ? "bg-[#3B82F6]/20 text-[#3B82F6]"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right text-xs ${
                      theme === "dark"
                        ? "text-gray-300"
                        : "text-gray-700"
                    }`}
                  >
                    {row.frequency.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 h-1 rounded-full ${
                          theme === "dark"
                            ? "bg-[#23262F]"
                            : "bg-gray-200"
                        }`}
                      >
                        <div
                          className="h-full rounded-full bg-[#3B82F6]"
                          style={{ width: `${row.recall}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs w-8 text-right ${
                          theme === "dark"
                            ? "text-gray-400"
                            : "text-gray-600"
                        }`}
                      >
                        {row.recall}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 h-1 rounded-full ${
                          theme === "dark"
                            ? "bg-[#23262F]"
                            : "bg-gray-200"
                        }`}
                      >
                        <div
                          className="h-full rounded-full bg-[#10B981]"
                          style={{ width: `${row.precision}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs w-8 text-right ${
                          theme === "dark"
                            ? "text-gray-400"
                            : "text-gray-600"
                        }`}
                      >
                        {row.precision}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 h-1 rounded-full ${
                          theme === "dark"
                            ? "bg-[#23262F]"
                            : "bg-gray-200"
                        }`}
                      >
                        <div
                          className="h-full rounded-full bg-[#8B5CF6]"
                          style={{ width: `${row.f1}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs w-8 text-right ${
                          theme === "dark"
                            ? "text-gray-400"
                            : "text-gray-600"
                        }`}
                      >
                        {row.f1}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                      theme === "dark" ? "text-[#EF4444]" : "text-red-600"
                    }`}
                  >
                    {row.deletions.toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                      theme === "dark" ? "text-[#F59E0B]" : "text-amber-600"
                    }`}
                  >
                    {row.substitutions.toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right text-xs tabular-nums ${
                      theme === "dark" ? "text-[#3B82F6]" : "text-blue-600"
                    }`}
                  >
                    {row.insertions.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${getWISColor(row.wis)} ${getWISBgColor(row.wis)}`}
                    >
                      {row.wis}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => {
                        setSelectedWord(row.word);
                        onWordOpen?.(row.word);
                      }}
                      className={`text-xs transition-colors ${
                        theme === "dark"
                          ? "text-[#8B5CF6] hover:text-[#A78BFA]"
                          : "text-[#8B5CF6] hover:text-[#6D28D9]"
                      }`}
                    >
                      Ⓘ Показать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 mt-4 ${
          theme === "dark"
            ? "text-gray-400"
            : "text-gray-600"
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
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Предыдущая
        </button>
        <div className="flex items-center gap-2">
          <p>Страница {currentPage}</p>
          <p>из {totalPages}</p>
        </div>
        <button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(prev + 1, totalPages)
            )
          }
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
            theme === "dark"
              ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          }`}
          disabled={currentPage === totalPages}
        >
          Следующая
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        </div>
      </div>

      {/* Word Details Modal */}
      {selectedWord && (
        <WordDetailsModal
          word={selectedWord}
          onClose={() => {
            setSelectedWord(null);
            onWordClose?.();
          }}
        />
      )}
    </div>
  );
}