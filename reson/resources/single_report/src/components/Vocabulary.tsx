import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  BarChart3,
  TrendingUp,
  Users,
  RefreshCw,
} from "lucide-react";
import { VocabularySummary } from "./vocabulary/VocabularySummary";
import { VocabularyAnalytics } from "./vocabulary/VocabularyAnalytics";
import { VocabularyVisualizations } from "./vocabulary/VocabularyVisualizations";
import { FalseFriends } from "./vocabulary/FalseFriends";
import { VocabularyReplacements } from "./vocabulary/VocabularyReplacements";
import { useTheme } from "../contexts/ThemeContext";
import { useData } from "../contexts/DataContext";
import { hasNormalizationDictionary } from "../utils/normalizationDictionary";
import {
  VOCAB_SUBTAB_DESCRIPTIONS,
  vocabularySubtabClass,
} from "./vocabulary/vocabularyHelpers";
import type { VocabSubTab } from "../utils/hashNavigation";

interface VocabularyProps {
  initialSubTab?: VocabSubTab;
  initialWord?: string;
  onRouteChange?: (subTab: VocabSubTab, word?: string) => void;
}

export function Vocabulary({
  initialSubTab = "summary",
  initialWord,
  onRouteChange,
}: VocabularyProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { data } = useData();
  const showReplacementsTab = hasNormalizationDictionary(data);
  const [activeSubTab, setActiveSubTab] = useState<VocabSubTab>(initialSubTab);
  const [searchWordInAnalytics, setSearchWordInAnalytics] = useState("");

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (!showReplacementsTab && activeSubTab === "replacements") {
      setActiveSubTab("summary");
      onRouteChange?.("summary");
    }
  }, [showReplacementsTab, activeSubTab, onRouteChange]);

  const changeSubTab = (sub: VocabSubTab) => {
    setActiveSubTab(sub);
    onRouteChange?.(
      sub,
      sub === "analytics" ? searchWordInAnalytics || initialWord : undefined
    );
  };

  const handleSearchWord = (word: string) => {
    setSearchWordInAnalytics(word);
    setActiveSubTab("analytics");
    onRouteChange?.("analytics", word);
  };

  return (
    <div
      className={`reson-vocabulary-page min-h-full p-6 max-w-[1400px] ${
        isDark ? "bg-[#0F1117] text-white" : "bg-[#F5F7FA] text-gray-900"
      }`}
    >
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`p-1.5 rounded-lg ${
              isDark
                ? "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9]"
                : "bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA]"
            }`}
          >
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1
            className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Словарь
          </h1>
        </div>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          Анализ словарного состава и метрики распознавания на уровне слов
        </p>
      </div>

      <div
        className="reson-vocabulary-sticky-bar p-3 mb-4 space-y-2"
        data-tour="vocabulary-subtabs"
      >
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => changeSubTab("summary")}
            data-tour="vocabulary-tab-summary"
            className={vocabularySubtabClass(activeSubTab === "summary", isDark)}
          >
            <Search className="w-3.5 h-3.5" />
            Сводка
          </button>
          <button
            type="button"
            onClick={() => changeSubTab("analytics")}
            data-tour="vocabulary-tab-analytics"
            className={vocabularySubtabClass(activeSubTab === "analytics", isDark)}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Интерактивный словарь
          </button>
          <button
            type="button"
            onClick={() => changeSubTab("visualizations")}
            data-tour="vocabulary-tab-visualizations"
            className={vocabularySubtabClass(activeSubTab === "visualizations", isDark)}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Визуализация
          </button>
          <button
            type="button"
            onClick={() => changeSubTab("falseFriends")}
            data-tour="vocabulary-tab-false-friends"
            className={vocabularySubtabClass(activeSubTab === "falseFriends", isDark)}
          >
            <Users className="w-3.5 h-3.5" />
            Ложные друзья
          </button>
          {showReplacementsTab && (
            <button
              type="button"
              onClick={() => changeSubTab("replacements")}
              className={vocabularySubtabClass(activeSubTab === "replacements", isDark)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Словарь замен
            </button>
          )}
        </div>

        <p
          className={`text-xs leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}
        >
          {VOCAB_SUBTAB_DESCRIPTIONS[activeSubTab]}
        </p>
      </div>

      <div className="reson-vocabulary-section-card p-4">
        {activeSubTab === "summary" && <VocabularySummary />}
        {activeSubTab === "analytics" && (
          <VocabularyAnalytics
            initialSearchTerm={searchWordInAnalytics}
            initialSelectedWord={initialWord}
            onWordOpen={(word) => onRouteChange?.("analytics", word)}
            onWordClose={() =>
              onRouteChange?.("analytics", searchWordInAnalytics || undefined)
            }
          />
        )}
        {activeSubTab === "visualizations" && <VocabularyVisualizations />}
        {activeSubTab === "falseFriends" && <FalseFriends />}
        {showReplacementsTab && activeSubTab === "replacements" && (
          <VocabularyReplacements onSearchWord={handleSearchWord} />
        )}
      </div>
    </div>
  );
}
