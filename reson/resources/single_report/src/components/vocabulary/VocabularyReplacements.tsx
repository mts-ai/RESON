import { useState, useMemo } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { hasNormalizationDictionary } from "../../utils/normalizationDictionary";
import { FileText, Download, ChevronDown, ChevronUp, ExternalLink, ArrowRight, Tag } from "lucide-react";

interface VocabularyReplacementsProps {
  onSearchWord: (word: string) => void;
}

export function VocabularyReplacements({ onSearchWord }: VocabularyReplacementsProps) {
  const { theme } = useTheme();
  const { data } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDictionary, setShowDictionary] = useState(false);
  const [showReplacementsTable, setShowReplacementsTable] = useState(false);
  const [showAllDict, setShowAllDict] = useState(false);

  const dictReplacements = data?.dictionary?.replacements;
  const enabled = hasNormalizationDictionary(data) && Boolean(dictReplacements?.vocab?.length);
  const replacementsData = dictReplacements ?? { vocab: [], examples: [], stats: { totalReplacements: 0, byField: {} } };

  const replacements = useMemo(() => {
    if (!enabled || !dictReplacements?.vocab) return [];
    const rows: Array<{ original: string; replaced: string; freqRef: number; freqHyp: number }> = [];
    type SourceItem = { word: string; count?: number; countText?: number; countPrediction?: number };
    for (const rule of dictReplacements.vocab as Array<{ target: string; sources: SourceItem[] }>) {
      for (const src of rule.sources || []) {
        const freqRef = src.countText ?? src.count ?? 0;
        const freqHyp = src.countPrediction ?? 0;
        rows.push({
          original: src.word,
          replaced: rule.target,
          freqRef,
          freqHyp,
        });
      }
    }
    return rows;
  }, [enabled, dictReplacements]);

  const replacementDictionary = useMemo(() => {
    if (!enabled || !dictReplacements?.vocab) return {};
    const dict: Record<string, Array<{ word: string; count?: number }>> = {};
    for (const rule of dictReplacements.vocab as Array<{ target: string; sources: Array<{ word: string; count?: number }> }>) {
      dict[rule.target] = rule.sources || [];
    }
    return dict;
  }, [enabled, dictReplacements]);

  const totalReplacements = replacementsData.stats?.totalReplacements ?? 0;
  const totalRefReplacements = useMemo(() => {
    if (!enabled || !dictReplacements) return 0;
    if (dictReplacements.stats?.byField) {
      return Number(dictReplacements.stats.byField.text) || 0;
    }
    return replacements.reduce((sum, r) => sum + r.freqRef, 0);
  }, [enabled, dictReplacements, replacements]);
  const totalHypReplacements = useMemo(() => {
    if (!enabled || !dictReplacements) return 0;
    if (dictReplacements.stats?.byField) {
      return Number(dictReplacements.stats.byField.prediction) || 0;
    }
    return replacements.reduce((sum, r) => sum + r.freqHyp, 0);
  }, [enabled, dictReplacements, replacements]);

  // Фильтрация замен: по поиску и только строки с ненулевой частотой в REF или HYP
  const filteredReplacements = useMemo(() => {
    return replacements.filter(
      (r) =>
        (r.freqRef !== 0 || r.freqHyp !== 0) &&
        (r.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.replaced.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [replacements, searchTerm]);

  // Получение уникальных целевых слов для резюме
  const uniqueTargets = useMemo(() => {
    return Object.keys(replacementDictionary);
  }, [replacementDictionary]);

  // Только те целевые слова, где всего замен > 0 (сработало)
  const targetsWithReplacements = useMemo(() => {
    return uniqueTargets.filter((target) => {
      const total = replacements
        .filter((r) => r.replaced === target)
        .reduce((sum, r) => sum + r.freqRef + r.freqHyp, 0);
      return total > 0;
    });
  }, [uniqueTargets, replacements]);

  // Функция для получения цвета индикатора частоты
  const getFrequencyColor = (freq: number, max: number) => {
    const ratio = freq / max;
    if (ratio === 0) return theme === "dark" ? "bg-gray-700" : "bg-gray-200";
    if (ratio < 0.5) return theme === "dark" ? "bg-blue-900" : "bg-blue-100";
    if (ratio < 0.8) return theme === "dark" ? "bg-blue-700" : "bg-blue-300";
    return theme === "dark" ? "bg-blue-500" : "bg-blue-500";
  };

  const maxFreq = useMemo(() => {
    if (replacements.length === 0) return 1;
    return Math.max(...replacements.map(r => r.freqRef + r.freqHyp), 1);
  }, [replacements]);

  const handleExportCSV = () => {
    const headers = [
      "original_word",
      "replaced_word",
      "freq_ref",
      "freq_hyp",
      "total",
    ];
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csvRows = [headers.join(",")];

    filteredReplacements.forEach((row) => {
      csvRows.push(
        [
          escapeCsv(row.original),
          escapeCsv(row.replaced),
          row.freqRef,
          row.freqHyp,
          row.freqRef + row.freqHyp,
        ].join(","),
      );
    });

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `replacements_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!enabled) {
    return (
      <div
        className={`rounded-xl border p-12 text-center ${
          theme === "dark"
            ? "bg-[#1A1D24] border-[#2A2D35]"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <FileText
          className={`mx-auto mb-3 h-12 w-12 ${
            theme === "dark" ? "text-gray-600" : "text-gray-400"
          }`}
        />
        <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
          Словарь замен не использовался в этом прогоне
        </p>
        <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          Передайте subst-table при нормализации, чтобы увидеть правила и статистику замен REF/HYP
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          className={`p-4 rounded-xl border overflow-hidden relative ${
            theme === "dark"
              ? "bg-[#23262F] border-[#2A2D35]"
              : "bg-white border-gray-200 shadow-sm"
          }`}
        >
          {/* Фоновый градиент */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
          
          <div className="relative">
            <div className="flex items-start gap-2 mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                theme === "dark" 
                  ? "bg-gradient-to-br from-blue-500 to-blue-600" 
                  : "bg-gradient-to-br from-blue-400 to-blue-500"
              }`}>
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div
                  className={`text-sm mb-1 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Замены в оригинальном тексте
                </div>
              </div>
            </div>
            <div className="text-center mb-3">
              <div className={`text-3xl mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {totalRefReplacements}
              </div>
              <div
                className={`text-xs ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                раз отработал словарь замен на размеченном тексте
              </div>
            </div>
            {/* Прогресс бар */}
            <div className={`h-2 rounded-full overflow-hidden ${
              theme === "dark" ? "bg-[#1C1F26]" : "bg-gray-100"
            }`}>
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                style={{ width: totalReplacements > 0 ? `${(totalRefReplacements / totalReplacements) * 100}%` : '100%' }}
              />
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border overflow-hidden relative ${
            theme === "dark"
              ? "bg-[#23262F] border-[#2A2D35]"
              : "bg-white border-gray-200 shadow-sm"
          }`}
        >
          {/* Фоновый градиент */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
          
          <div className="relative">
            <div className="flex items-start gap-2 mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                theme === "dark" 
                  ? "bg-gradient-to-br from-purple-500 to-purple-600" 
                  : "bg-gradient-to-br from-purple-400 to-purple-500"
              }`}>
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div
                  className={`text-sm mb-1 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Замены в предсказанном тексте
                </div>
              </div>
            </div>
            <div className="text-center mb-3">
              <div className={`text-3xl mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {totalHypReplacements}
              </div>
              <div
                className={`text-xs ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                раз отработал словарь замен на распознанном тексте
              </div>
            </div>
            {/* Прогресс бар */}
            <div className={`h-2 rounded-full overflow-hidden ${
              theme === "dark" ? "bg-[#1C1F26]" : "bg-gray-100"
            }`}>
              <div 
                className="h-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-500"
                style={{ width: totalReplacements > 0 ? `${(totalHypReplacements / totalReplacements) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Словарь замен */}
      <div
        className={`rounded-xl border ${
          theme === "dark"
            ? "bg-[#23262F] border-[#2A2D35]"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <button
          onClick={() => setShowDictionary(!showDictionary)}
          className={`w-full p-6 flex items-center justify-between transition-colors ${
            theme === "dark" ? "hover:bg-[#2A2D35]/50" : "hover:bg-gray-50"
          }`}
        >
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <Tag className={`w-4 h-4 ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`} />
              <div
                className={`text-sm ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Словарь замен
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                theme === "dark"
                  ? "bg-purple-900/30 text-purple-300"
                  : "bg-purple-100 text-purple-700"
              }`}>
                {Object.keys(replacementDictionary).length} правил
              </span>
            </div>
            <div
              className={`text-xs ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Словарь замен, используемый при нормализации текста. Показывает целевые
              слова (target) и их варианты (variants), которые заменяются на эти
              целевые слова.
            </div>
          </div>
          {showDictionary ? (
            <ChevronUp className={`w-5 h-5 flex-shrink-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`} />
          ) : (
            <ChevronDown className={`w-5 h-5 flex-shrink-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`} />
          )}
        </button>

        {showDictionary && (
          <div className="px-6 pb-6">
            <div className="grid gap-3">
              {Object.entries(replacementDictionary)
                .slice(0, showAllDict ? undefined : 5)
                .map(([target, variants], idx) => {
                  const list = Array.isArray(variants) ? variants : [];
                  const withCounts = list.some((v: unknown) => typeof v === "object" && v !== null && "count" in v);
                  return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      theme === "dark"
                        ? "bg-[#1C1F26] border-[#2A2D35]"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${
                          theme === "dark" ? "text-blue-400" : "text-blue-600"
                        }`}>
                          {target}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                          theme === "dark"
                            ? "bg-blue-900/30 text-blue-300"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {list.length} {list.length === 1 ? "вариант" : "варианта"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {list.map((variant, vIdx) => {
                        const label = typeof variant === "string" ? variant : variant.word;
                        const count = typeof variant === "object" && variant !== null && "count" in variant ? (variant as { count?: number }).count : null;
                        return (
                        <span
                          key={vIdx}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ${
                            theme === "dark"
                              ? "bg-[#23262F] text-gray-300 border border-[#2A2D35]"
                              : "bg-white text-gray-700 border border-gray-300"
                          }`}
                        >
                          {label}
                          {withCounts && count != null && (
                            <span className={theme === "dark" ? "text-gray-500" : "text-gray-400"}>×{count}</span>
                          )}
                        </span>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
            </div>

            {Object.keys(replacementDictionary).length > 5 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowAllDict(!showAllDict)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    theme === "dark"
                      ? "bg-[#2A2D35] text-gray-300 hover:bg-[#33373F]"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {showAllDict
                    ? "Скрыть"
                    : `Показать все (${Object.keys(replacementDictionary).length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Таблица замен */}
      <div
        className={`rounded-xl border ${
          theme === "dark"
            ? "bg-[#23262F] border-[#2A2D35]"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <button
          type="button"
          onClick={() => setShowReplacementsTable(!showReplacementsTable)}
          className={`w-full p-6 flex items-center justify-between transition-colors ${
            theme === "dark" ? "hover:bg-[#2A2D35]/50" : "hover:bg-gray-50"
          }`}
        >
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <FileText
                className={`w-4 h-4 ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
              />
              <div
                className={`text-sm ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Таблица замен
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                  theme === "dark"
                    ? "bg-blue-900/30 text-blue-300"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {filteredReplacements.length} строк
              </span>
            </div>
            <div
              className={`text-xs ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Детальная статистика по каждой паре «исходное → заменённое» в REF и HYP
            </div>
          </div>
          {showReplacementsTable ? (
            <ChevronUp
              className={`w-5 h-5 flex-shrink-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            />
          ) : (
            <ChevronDown
              className={`w-5 h-5 flex-shrink-0 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            />
          )}
        </button>

        {showReplacementsTable && (
          <>
        <div className="px-6 pb-4 border-t border-gray-200 dark:border-[#2A2D35]">
          <div className="flex items-center justify-between gap-3 pt-4 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Поиск по словам..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg text-sm ${
                  theme === "dark"
                    ? "bg-[#1C1F26] border-[#2A2D35] text-white placeholder-gray-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                } border focus:outline-none focus:ring-2 focus:ring-purple-500`}
              />
            </div>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredReplacements.length === 0}
              className={`px-4 py-2 rounded-lg text-xs flex items-center gap-2 shrink-0 transition-colors ${
                filteredReplacements.length === 0
                  ? theme === "dark"
                    ? "bg-[#2A2D35] text-gray-500 cursor-not-allowed"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : theme === "dark"
                    ? "bg-[#2A2D35] text-gray-300 hover:bg-[#33373F]"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Download className="w-4 h-4" />
              Экспорт CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theme === "dark" ? "bg-[#1C1F26]" : "bg-gray-50"}>
              <tr>
                <th
                  className={`text-left py-3 px-6 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Исходное слово
                </th>
                <th
                  className={`text-left py-3 px-6 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Заменено
                </th>
                <th
                  className={`text-center py-3 px-6 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Частота в REF
                </th>
                <th
                  className={`text-center py-3 px-6 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Частота в HYP
                </th>
                <th
                  className={`text-center py-3 px-6 text-xs ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Всего
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredReplacements.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`py-8 text-center text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Ничего не найдено
                  </td>
                </tr>
              ) : (
                filteredReplacements.map((replacement, idx) => {
                  const total = replacement.freqRef + replacement.freqHyp;
                  return (
                    <tr
                      key={idx}
                      className={
                        theme === "dark"
                          ? "border-t border-[#2A2D35] hover:bg-[#1C1F26] transition-colors"
                          : "border-t border-gray-100 hover:bg-gray-50 transition-colors"
                      }
                    >
                      <td className={`py-3 px-6`}>
                        <div className="flex items-center gap-2">
                          <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                            {replacement.original}
                          </span>
                        </div>
                      </td>
                      <td className={`py-3 px-6`}>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className={theme === "dark" ? "text-blue-400" : "text-blue-600"}>
                            {replacement.replaced}
                          </span>
                        </div>
                      </td>
                      <td className={`py-3 px-6 text-center`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                            {replacement.freqRef}
                          </span>
                          <div className={`w-full h-1 rounded-full ${getFrequencyColor(replacement.freqRef, maxFreq)}`} />
                        </div>
                      </td>
                      <td className={`py-3 px-6 text-center`}>
                        <div className="flex flex-col items-center gap-1">
                          <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                            {replacement.freqHyp}
                          </span>
                          <div className={`w-full h-1 rounded-full ${getFrequencyColor(replacement.freqHyp, maxFreq)}`} />
                        </div>
                      </td>
                      <td className={`py-3 px-6 text-center`}>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          theme === "dark"
                            ? "bg-purple-900/30 text-purple-300"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {total}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredReplacements.length > 0 && (
          <div
            className={`px-6 py-3 border-t text-right text-xs ${
              theme === "dark"
                ? "border-[#2A2D35] text-gray-400"
                : "border-gray-200 text-gray-600"
            }`}
          >
            Всего замен: {filteredReplacements.length}
          </div>
        )}
          </>
        )}
      </div>

      {/* Резюме */}
      <div
        className={`rounded-xl border ${
          theme === "dark"
            ? "bg-[#23262F] border-[#2A2D35]"
            : "bg-white border-gray-200 shadow-sm"
        }`}
      >
        <div className="p-6">
          <div
            className={`text-sm mb-2 ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Резюме
          </div>
          <div
            className={`text-xs mb-4 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Целевые слова, по которым сработал словарь замен (всего замен больше нуля).
            Нажмите на иконку рядом со словом, чтобы открыть его в словаре.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {targetsWithReplacements.map((target, idx) => {
              const totalCount = replacements
                .filter((r) => r.replaced === target)
                .reduce((sum, r) => sum + r.freqRef + r.freqHyp, 0);

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border group cursor-pointer transition-all ${
                    theme === "dark"
                      ? "bg-[#1C1F26] border-[#2A2D35] hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10"
                      : "bg-gray-50 border-gray-200 hover:border-purple-400 hover:shadow-lg"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className={`text-sm ${
                        theme === "dark" ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {target}
                    </div>
                    <button
                      className={`transition-transform group-hover:scale-110 ${
                        theme === "dark" ? "text-purple-400" : "text-purple-600"
                      }`}
                      title="Открыть в словаре"
                      onClick={() => onSearchWord(target)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Всего замен:
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                      theme === "dark"
                        ? "bg-purple-900/30 text-purple-300"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {totalCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}