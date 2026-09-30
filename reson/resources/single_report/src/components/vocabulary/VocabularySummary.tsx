import {
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { useState, useMemo } from "react";
import { WordDetailsModal } from "./WordDetailsModal";
import { SliceInsightsMenu } from "../analytics/SliceInsightsMenu";
import { CoverageMetricsHint } from "./CoverageMetricsHint";
import { VocabSectionHint } from "./VocabSectionHint";

const WORD_STATS_HINT_ITEMS = [
  {
    color: "#10B981",
    label: "Recall",
    range: "полнота",
    description:
      "Какая доля вхождений слова в эталоне распознана верно. Низкий recall — слово часто пропускается.",
  },
  {
    color: "#3B82F6",
    label: "Precision",
    range: "точность",
    description:
      "Какая доля распознанных вхождений слова действительно верна. Низкий precision — много лишних срабатываний.",
  },
  {
    color: "#8B5CF6",
    label: "F1-score",
    range: "баланс",
    description:
      "Сводная метрика между recall и precision. Удобна для сравнения типов слов в одной таблице.",
  },
] as const;

export function VocabularySummary() {
  const { theme } = useTheme();
  const { data } = useData();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([]);

  // Вычисляем данные из реальных данных
  const vocab = data?.vocab || [];
  
  // Топ-5 слов по частоте
  const topWords = useMemo(() => {
    const sorted = [...vocab].sort((a, b) => b.count - a.count).slice(0, 5);
    return sorted.map((word, idx) => ({
      rank: idx + 1,
      word: word.word,
      frequency: word.count,
      color: idx < 3 ? "#F59E0B" : "#6B7280",
    }));
  }, [vocab]);

  const highWisStats = useMemo(() => {
    const highWisWords = vocab
      .filter((w) => (w.wis || 0) >= 60)
      .sort((a, b) => (b.wis || 0) - (a.wis || 0));

    const count = highWisWords.length;
    const percent = vocab.length > 0 ? (count / vocab.length) * 100 : 0;

    return {
      count,
      percent,
      topWords: highWisWords.slice(0, 5),
    };
  }, [vocab]);

  // Проблемные слова (низкий recall)
  const problematicWords = useMemo(() => {
    const sorted = [...vocab]
      .filter(w => w.recall < 50)
      .sort((a, b) => a.recall - b.recall)
      .slice(0, 5);
    return sorted.map(w => ({ word: w.word, recall: w.recall }));
  }, [vocab]);

  // Данные покрытия
  const coverageData = useMemo(() => {
    const high = vocab.filter(w => w.recall >= 90).length;
    const medium = vocab.filter(w => w.recall >= 50 && w.recall < 90).length;
    const low = vocab.filter(w => w.recall < 50).length;
    const total = vocab.length;
    
    return [
    {
      label: "Высокое покрытие",
        count: high,
        percentage: total > 0 ? (high / total) * 100 : 0,
      color: "#10B981",
      description: "Recall >90%",
    },
    {
      label: "Среднее покрытие",
        count: medium,
        percentage: total > 0 ? (medium / total) * 100 : 0,
      color: "#F59E0B",
      description: "Recall 50-90%",
    },
    {
      label: "Низкое покрытие",
        count: low,
        percentage: total > 0 ? (low / total) * 100 : 0,
      color: "#EF4444",
      description: "Recall <50%",
    },
  ];
  }, [vocab]);

  // Типы слов
  const wordTypes = useMemo(() => {
    const total = vocab.length;
    const russian = vocab.filter(w => {
      const word = w.word.toLowerCase();
      return /[а-яё]/.test(word) && !/[a-z]/.test(word);
    }).length;
    const english = vocab.filter(w => {
      const word = w.word.toLowerCase();
      return /[a-z]/.test(word) && !/[а-яё]/.test(word);
    }).length;
    const numbers = vocab.filter(w => /^\d+$/.test(w.word)).length;
    const other = total - russian - english - numbers;
    
    return [
    {
      type: "Всего слов",
        count: total,
      percentage: 100,
      color: "#6366F1",
      label: "100% словаря",
    },
    {
      type: "Русские",
        count: russian,
        percentage: total > 0 ? (russian / total) * 100 : 0,
      color: "#3B82F6",
      label: "",
    },
    {
      type: "Английские",
        count: english,
        percentage: total > 0 ? (english / total) * 100 : 0,
      color: "#10B981",
      label: "",
    },
    {
      type: "Числа",
        count: numbers,
        percentage: total > 0 ? (numbers / total) * 100 : 0,
      color: "#F59E0B",
      label: "",
    },
    {
      type: "Прочие",
        count: other,
        percentage: total > 0 ? (other / total) * 100 : 0,
      color: "#8B5CF6",
      label: "",
    },
  ];
  }, [vocab]);

  // Метрики по типам
  const metricsData = useMemo(() => {
    const all = vocab;
    const russian = vocab.filter(w => {
      const word = w.word.toLowerCase();
      return /[а-яё]/.test(word) && !/[a-z]/.test(word);
    });
    const english = vocab.filter(w => {
      const word = w.word.toLowerCase();
      return /[a-z]/.test(word) && !/[а-яё]/.test(word);
    });
    const numbers = vocab.filter(w => /^\d+$/.test(w.word));
    const other = vocab.filter(w => {
      const word = w.word.toLowerCase();
      return !/[а-яё]/.test(word) && !/[a-z]/.test(word) && !/^\d+$/.test(word);
    });

    const calcAvg = (words: typeof vocab, field: 'recall' | 'precision' | 'f1_score') => {
      if (words.length === 0) return 0;
      const sum = words.reduce((acc, w) => acc + (w[field] || 0), 0);
      return sum / words.length;
    };

    return [
    {
      type: "Все данные",
        recall: calcAvg(all, 'recall'),
        precision: calcAvg(all, 'precision'),
        f1: calcAvg(all, 'f1_score'),
    },
    {
      type: "Русские",
        recall: calcAvg(russian, 'recall'),
        precision: calcAvg(russian, 'precision'),
        f1: calcAvg(russian, 'f1_score'),
    },
    {
      type: "Английские",
        recall: calcAvg(english, 'recall'),
        precision: calcAvg(english, 'precision'),
        f1: calcAvg(english, 'f1_score'),
    },
    {
        type: "Числа",
        recall: calcAvg(numbers, 'recall'),
        precision: calcAvg(numbers, 'precision'),
        f1: calcAvg(numbers, 'f1_score'),
    },
    {
        type: "Прочие",
        recall: calcAvg(other, 'recall'),
        precision: calcAvg(other, 'precision'),
        f1: calcAvg(other, 'f1_score'),
      },
    ];
  }, [vocab]);

  // Vocabulary database for search - используем реальные данные
  const vocabularyDatabase = useMemo(() => {
    return vocab.map(w => {
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
        wis: w.wis || 0, // Используем реальный WIS из данных
      };
    });
  }, [vocab]);

  // Word Cloud Data - используем реальные данные
  const wordCloudData = useMemo(() => {
    return vocab
      .sort((a, b) => b.count - a.count)
      .slice(0, 50) // Топ-50 для облака слов
      .map(w => ({
        word: w.word,
        frequency: w.count,
        recall: w.recall || 0,
      }));
  }, [vocab]);

  // Вычисляем статистику слов
  const wordStats = useMemo(() => {
    if (vocab.length === 0) {
      return {
        rareWordsCount: 0,
        longestWord: { word: "", length: 0 },
        shortestWord: { word: "", length: Infinity },
      };
    }

    // Редкие слова (встречаются менее 2 раз)
    const rareWordsCount = vocab.filter(w => w.count < 2).length;

    // Самое длинное слово
    const longestWord = vocab.reduce((longest, w) => {
      const len = w.word.length;
      return len > longest.length ? { word: w.word, length: len } : longest;
    }, { word: vocab[0].word, length: vocab[0].word.length });

    // Самое короткое слово
    const shortestWord = vocab.reduce((shortest, w) => {
      const len = w.word.length;
      return len < shortest.length ? { word: w.word, length: len } : shortest;
    }, { word: vocab[0].word, length: vocab[0].word.length });

      return {
      rareWordsCount,
      longestWord,
      shortestWord,
      };
  }, [vocab]);

  const getRecallColor = (recall: number) => {
    if (recall >= 90)
      return theme === "dark" ? "#10B981" : "#059669";
    if (recall >= 70)
      return theme === "dark" ? "#F59E0B" : "#D97706";
    return theme === "dark" ? "#EF4444" : "#DC2626";
  };

  // Dataset Health Calculation - используем реальные данные
  const health = useMemo(() => {
    const avgRecall = vocab.length > 0
      ? vocab.reduce((sum, w) => sum + (w.recall || 0), 0) / vocab.length
      : 0;
    const highCoveragePercent = coverageData[0]?.percentage || 0;
    const diversityScore = vocab.length;

    let score = 0;
    let grade = "";
    let status: "excellent" | "good" | "fair" | "poor" = "fair";

    // Recall score (0-40 points)
    if (avgRecall >= 80) score += 40;
    else if (avgRecall >= 70) score += 30;
    else if (avgRecall >= 60) score += 20;
    else score += 10;

    // Coverage score (0-35 points)
    if (highCoveragePercent >= 70) score += 35;
    else if (highCoveragePercent >= 60) score += 25;
    else if (highCoveragePercent >= 50) score += 15;
    else score += 5;

    // Diversity score (0-25 points)
    if (diversityScore >= 20000) score += 25;
    else if (diversityScore >= 10000) score += 20;
    else if (diversityScore >= 5000) score += 15;
    else score += 10;

    // Grade assignment
    if (score >= 90) {
      grade = "A";
      status = "excellent";
    } else if (score >= 80) {
      grade = "B+";
      status = "good";
    } else if (score >= 70) {
      grade = "B";
      status = "good";
    } else if (score >= 60) {
      grade = "C+";
      status = "fair";
    } else {
      grade = "C";
      status = "fair";
    }

    return { score, grade, status };
  }, [vocab, coverageData]);

  const vocabularyInsightPanels = useMemo(() => {
    const shortestLabel =
      wordStats.shortestWord.length < Infinity
        ? `${wordStats.shortestWord.length} ${
            wordStats.shortestWord.length === 1
              ? "символ"
              : wordStats.shortestWord.length < 5
                ? "символа"
                : "символов"
          }`
        : "н/д";

    return [
      {
        title: "Топ по частоте",
        subtitle: topWords.length > 0 ? `${topWords.length} слов` : "нет данных",
        popoverTitle: "Топ-5 по частоте",
        highlights:
          topWords.length > 0
            ? topWords.map(
                (item) =>
                  `${item.word} — ${item.frequency.toLocaleString()} раз`,
              )
            : ["Нет данных в словаре"],
      },
      {
        title: "Проблемные слова",
        subtitle:
          problematicWords.length > 0
            ? `${problematicWords.length} слов · recall < 50%`
            : "нет данных",
        popoverTitle: "Слова с низким recall",
        highlights:
          problematicWords.length > 0
            ? problematicWords.map(
                (item) =>
                  `${item.word} — recall ${item.recall.toFixed(1)}%`,
              )
            : ["Нет слов с recall ниже 50%"],
      },
      {
        title: "Редкие слова",
        subtitle: `${wordStats.rareWordsCount.toLocaleString()} слов`,
        popoverTitle: "Редкие слова",
        highlights: [
          `${wordStats.rareWordsCount.toLocaleString()} слов встречаются менее 2 раз в датасете`,
        ],
      },
      {
        title: "Высокий WIS (≥60)",
        subtitle:
          highWisStats.count > 0
            ? `${highWisStats.count.toLocaleString()} слов · ${highWisStats.percent.toFixed(1)}%`
            : "нет данных",
        popoverTitle: "Слова с высоким приоритетом",
        highlights:
          highWisStats.count > 0
            ? [
                `${highWisStats.count.toLocaleString()} слов (${highWisStats.percent.toFixed(1)}% словаря) требуют внимания`,
                ...highWisStats.topWords.map(
                  (item) =>
                    `${item.word} — WIS ${(item.wis || 0).toFixed(1)}`,
                ),
              ]
            : ["Нет слов с WIS ≥ 60"],
      },
      {
        title: "Самое длинное слово",
        subtitle: wordStats.longestWord.word || "н/д",
        popoverTitle: "Самое длинное слово",
        highlights: wordStats.longestWord.word
          ? [
              `${wordStats.longestWord.word} (${wordStats.longestWord.length} симв.)`,
            ]
          : ["Нет данных"],
      },
      {
        title: "Самое короткое слово",
        subtitle: wordStats.shortestWord.word || "н/д",
        popoverTitle: "Самое короткое слово",
        highlights: wordStats.shortestWord.word
          ? [`${wordStats.shortestWord.word} (${shortestLabel})`]
          : ["Нет данных"],
      },
    ];
  }, [topWords, problematicWords, wordStats, highWisStats]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setSearchResult(null);
      return;
    }
    const result = vocabularyDatabase.find(
      (item) => item.word.toLowerCase() === query.toLowerCase(),
    );
    setSearchResult(result || "not_found");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim() === "") {
      setSearchResult(null);
      setShowSuggestions(false);
      return;
    }
    const filtered = vocabularyDatabase
      .filter((item) =>
        item.word.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 5);
    setFilteredSuggestions(filtered);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (word: string) => {
    setSearchQuery(word);
    handleSearch(word);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-3">
      {/* Row 0: Mini Search + Dataset Health */}
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        {/* Mini Search */}
        <div
          className={`rounded-xl p-4 border ${
            theme === "dark"
              ? "bg-[#1A1D24] border-[#2A2D35]"
              : "bg-white border-gray-200 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-4 h-4 text-[#8B5CF6]" />
            <h3
              className={`reson-vocab-panel-title ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Быстрый поиск слова
            </h3>
          </div>
          <p
            className={`reson-vocab-panel-desc mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
          >
            Найдите метрики любого слова из словаря
          </p>

          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 ${
                theme === "dark"
                  ? "text-gray-400"
                  : "text-gray-500"
              }`}
            />
            <input
              type="text"
              placeholder="Введите слово для поиска..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchQuery.trim() !== "" && filteredSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm transition-colors ${
                theme === "dark"
                  ? "bg-[#23262F] border-[#2A2D35] text-white placeholder-gray-500 focus:border-[#8B5CF6]"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#8B5CF6]"
              } outline-none`}
            />

            {/* Suggestions Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div
                className={`absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-lg ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35]"
                    : "bg-white border-gray-200"
                }`}
              >
                {filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                      theme === "dark"
                        ? "hover:bg-[#2A2D35] text-gray-300"
                        : "hover:bg-gray-50 text-gray-700"
                    } ${
                      index !== filteredSuggestions.length - 1
                        ? theme === "dark"
                          ? "border-b border-[#2A2D35]"
                          : "border-b border-gray-100"
                        : ""
                    }`}
                    onClick={() => handleSuggestionClick(suggestion.word)}
                  >
                    <div className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-sm">{suggestion.word}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          theme === "dark"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {suggestion.type}
                      </span>
                    </div>
                    <span
                      className={`text-xs ${
                        theme === "dark" ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      {suggestion.frequency.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search Result */}
          {searchResult && (
            <div className="mt-3">
              {searchResult === "not_found" ? (
                <div
                  className={`rounded-lg p-3 ${
                    theme === "dark"
                      ? "bg-red-500/10 border border-red-500/20"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span
                      className={`text-sm ${theme === "dark" ? "text-red-400" : "text-red-700"}`}
                    >
                      Слово не найдено
                    </span>
                  </div>
                  <p
                    className={`text-xs ${theme === "dark" ? "text-red-300" : "text-red-600"}`}
                  >
                    Слово "{searchQuery}" отсутствует в словаре
                    датасета
                  </p>
                </div>
              ) : (
                <div
                  className={`rounded-lg p-3 ${
                    theme === "dark"
                      ? "bg-[#23262F]"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span
                        className={`text-base ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                      >
                        {searchResult.word}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          theme === "dark"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {searchResult.type}
                      </span>
                    </div>
                    <span
                      className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Частота:{" "}
                      {searchResult.frequency.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <div
                        className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                      >
                        Recall
                      </div>
                      <div
                        className={`text-sm ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
                      >
                        {searchResult.recall}%
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                      >
                        Precision
                      </div>
                      <div
                        className={`text-sm ${theme === "dark" ? "text-green-400" : "text-green-600"}`}
                      >
                        {searchResult.precision}%
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                      >
                        F1-score
                      </div>
                      <div
                        className={`text-sm ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`}
                      >
                        {searchResult.f1}%
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                      >
                        WIS
                      </div>
                      <div
                        className={`text-sm ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`}
                      >
                        {searchResult.wis}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedWord(searchResult.word)}
                    className={`w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                      theme === "dark"
                        ? "bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30"
                        : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Посмотреть детализацию
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dataset Health */}
        <div
          className={`rounded-xl p-4 border ${
            theme === "dark"
              ? health.status === "excellent"
                ? "bg-gradient-to-br from-[#065F46] to-[#1A1D24] border-green-500/30"
                : health.status === "good"
                  ? "bg-gradient-to-br from-[#1E40AF] to-[#1A1D24] border-blue-500/30"
                  : "bg-gradient-to-br from-[#B45309] to-[#1A1D24] border-amber-500/30"
              : health.status === "excellent"
                ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm"
                : health.status === "good"
                  ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm"
                  : "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {health.status === "excellent" ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : health.status === "good" ? (
              <CheckCircle className="w-4 h-4 text-blue-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <h3
              className={`reson-vocab-panel-title ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Здоровье датасета
            </h3>
          </div>
          <p
            className={`reson-vocab-panel-desc mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
          >
            Общая оценка качества словаря
          </p>

          <div className="flex items-center justify-center mb-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                health.status === "excellent"
                  ? theme === "dark"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-green-200 text-green-700"
                  : health.status === "good"
                    ? theme === "dark"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-blue-200 text-blue-700"
                    : theme === "dark"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-amber-200 text-amber-700"
              }`}
            >
              {health.grade}
            </div>
          </div>

          <div className="text-center mb-3">
            <div
              className={`text-sm mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Общий балл:{" "}
              <span className="font-medium">
                {health.score}/100
              </span>
            </div>
            <div
              className={`h-2 rounded-full ${theme === "dark" ? "bg-[#23262F]" : "bg-white/50"}`}
            >
              <div
                className={`h-full rounded-full ${
                  health.status === "excellent"
                    ? "bg-green-500"
                    : health.status === "good"
                      ? "bg-blue-500"
                      : "bg-amber-500"
                }`}
                style={{ width: `${health.score}%` }}
              />
            </div>
          </div>

          <div
            className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
          >
            <div className="space-y-1">
              <div>
                ✓ Средний Recall:{" "}
                <span className="font-medium">
                  {vocab.length > 0 
                    ? (vocab.reduce((sum, w) => sum + (w.recall || 0), 0) / vocab.length).toFixed(1)
                    : "0.0"}%
                </span>
              </div>
              <div>
                ✓ Высокое покрытие:{" "}
                <span className="font-medium">
                  {coverageData[0]?.percentage.toFixed(1) || "0.0"}%
                </span>
              </div>
              <div>
                ✓ Уникальные слова:{" "}
                <span className="font-medium">
                  {vocab.length.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 0.5: Word Cloud */}

      {/* Row 1: Vocabulary Composition - Full Width */}
      <div
        className={`rounded-xl p-4 border ${
          theme === "dark"
            ? "bg-[#1A1D24] border-[#2A2D35]"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <h3
          className={`reson-vocab-panel-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          Словарный состав
        </h3>
        <p className="reson-vocab-panel-desc mb-2">
          Распределение слов по типам
        </p>

        <div className="grid grid-cols-5 gap-2">
          {wordTypes.map((item, index) => {
            const isTotal = index === 0;

            return (
              <div
                key={index}
                className={`rounded-lg p-3 ${
                  theme === "dark"
                    ? isTotal
                      ? "bg-gradient-to-br from-[#2D3B5A] to-[#1A1D24]"
                      : "bg-[#23262F]"
                    : isTotal
                      ? "bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF]"
                      : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className={`text-xs ${
                      theme === "dark"
                        ? "text-gray-300"
                        : "text-gray-700"
                    }`}
                  >
                    {item.type}
                  </span>
                </div>

                <div
                  className={`reson-vocab-word-type-count mb-0.5 ${
                    theme === "dark"
                      ? "text-white"
                      : "text-gray-900"
                  }`}
                >
                  {item.count.toLocaleString()}
                </div>

                {!isTotal && (
                  <>
                    <div
                      className={`h-1.5 rounded-full mb-1 ${
                        theme === "dark"
                          ? "bg-[#1A1D24]"
                          : "bg-gray-200"
                      }`}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: item.color }}
                    >
                      {item.percentage.toFixed(1)}%
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: Statistics by Words - Full Width */}
      <div
        className={`rounded-xl p-4 border ${
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
              Статистика по словам
            </h3>
            <p className="reson-vocab-panel-desc mb-0">
              Средние метрики качества распознавания по типам слов
            </p>
          </div>
          <VocabSectionHint
            isDark={theme === "dark"}
            triggerText="Что означают метрики?"
            panelTitle="Метрики таблицы"
            panelSubtitle="Кратко о recall, precision и F1"
            panelAriaLabel="Пояснение метрик статистики по словам"
            items={[...WORD_STATS_HINT_ITEMS]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full reson-vocab-metrics-table">
            <thead>
              <tr
                className={`border-b ${
                  theme === "dark"
                    ? "border-[#2A2D35]"
                    : "border-gray-200"
                }`}
              >
                <th
                  className={`text-left ${
                    theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  Тип слова
                </th>
                <th
                  className={`text-center ${
                    theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  Recall (%)
                </th>
                <th
                  className={`text-center ${
                    theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  Precision (%)
                </th>
                <th
                  className={`text-center ${
                    theme === "dark"
                      ? "text-gray-400"
                      : "text-gray-600"
                  }`}
                >
                  F1-score (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {metricsData.map((row, index) => (
                <tr
                  key={index}
                  className={`border-b ${
                    theme === "dark"
                      ? "border-[#2A2D35]"
                      : "border-gray-100"
                  }`}
                >
                  <td
                    className={theme === "dark" ? "text-white" : "text-gray-900"}
                  >
                    {row.type}
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] ${
                        theme === "dark"
                          ? "bg-[#3B82F6]/20 text-[#3B82F6]"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {row.recall.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] ${
                        theme === "dark"
                          ? "bg-[#10B981]/20 text-[#10B981]"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {row.precision.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] ${
                        theme === "dark"
                          ? "bg-[#8B5CF6]/20 text-[#8B5CF6]"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {row.f1.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reson-vocab-coverage-layout" data-tour="vocabulary-summary-coverage">
        {/* Coverage Analysis */}
        <div
          className={`rounded-xl p-4 border ${
            theme === "dark"
              ? "bg-[#1A1D24] border-[#2A2D35]"
              : "bg-white border-gray-200 shadow-sm"
          }`}
        >
          <div className="reson-vocab-coverage-header">
            <div className="min-w-0">
              <h3
                className={`reson-vocab-panel-title mb-0.5 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                Покрытие словаря
              </h3>
              <p
                className={`reson-vocab-panel-desc mb-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
              >
                Анализ качества распознавания слов по уровню Recall
              </p>
            </div>
            <CoverageMetricsHint isDark={theme === "dark"} />
          </div>

          {/* Coverage Bars */}
          <div className="space-y-3">
            {coverageData.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className={`text-xs ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}
                    >
                      {item.description}
                    </span>
                  </div>
                  <span
                    className={`text-xs ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                  >
                    {item.count.toLocaleString()}{" "}
                    <span
                      className={
                        theme === "dark"
                          ? "text-gray-500"
                          : "text-gray-500"
                      }
                    >
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div
                  className={`h-2 rounded-full ${theme === "dark" ? "bg-[#23262F]" : "bg-gray-200"}`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reson-vocab-insights-col">
          {vocabularyInsightPanels.map((panel) => (
            <SliceInsightsMenu
              key={panel.title}
              highlights={panel.highlights}
              isDark={theme === "dark"}
              title={panel.title}
              subtitle={panel.subtitle}
              popoverTitle={panel.popoverTitle}
              layout="stacked"
            />
          ))}
        </div>
      </div>

      {/* Row 5: Word2Vec Style Visualization - Full Width */}

      {/* Word Details Modal */}
      {selectedWord && (
        <WordDetailsModal
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}