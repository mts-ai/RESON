import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, FileText, Copy, Search, Filter, ArrowLeft } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { DiffTokensView } from "../DiffTokens";
import { WordWisDetailsPanel } from "./WordWisDetailsPanel";
import type { WisComponentsUi } from "../../types/data";

interface WordDetailsModalProps {
  word: string | null;
  onClose: () => void;
}

const EMPTY_WIS_COMPONENTS: WisComponentsUi = {
  frequency: { value: 0, weight: 25 },
  errorSeverity: { value: 0, weight: 35 },
  errorCriticality: { value: 0, weight: 25 },
  substitutionVariability: { value: 0, weight: 15 },
};

function audioBasename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.split("/").pop();
  return name || path;
}

function sumErrorExampleCounts(items?: Array<{ count?: number }>): number {
  return (items || []).reduce((acc, item) => acc + (item.count || 1), 0);
}

function OverlayPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

export function WordDetailsModal({ word, onClose }: WordDetailsModalProps) {
  const { theme } = useTheme();
  const { data } = useData();
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const [selectedSubstitution, setSelectedSubstitution] = useState<string | null>(null);
  const [selectedManifestEntry, setSelectedManifestEntry] = useState<{
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
    diff_tokens?: Array<{ word: string; type: "equal" | "ins" | "del" | "sub_del" | "sub_ins" }>;
  } | null>(null);
  
  // Состояние для модального окна со всеми примерами замены
  const [replacementExamplesModal, setReplacementExamplesModal] = useState<{
    sourceWord: string;
    targetWord: string;
    examples: Array<{
    id: number;
    file: string;
    time: string;
    reference: string;
    hypothesis: string;
    errorType: string;
    }>;
  } | null>(null);

  // Состояние для модального окна с примерами ошибок (deletions/insertions)
  const [errorExamplesModal, setErrorExamplesModal] = useState<{
    errorType: "deletion" | "insertion";
    examples: Array<{
      id: number;
      file: string;
      time: string;
      reference: string;
      hypothesis: string;
      errorType: string;
    }>;
  } | null>(null);
  
  // Состояние для модального окна с заменами (двухуровневое)
  const [substitutionsModal, setSubstitutionsModal] = useState<{
    sourceWord: string;
    substitutions: Array<{ word: string; count: number; percent: number; utteranceCount?: number }>;
  } | null>(null);
  
  // Состояние для выбранной замены в модальном окне замен
  const [selectedSubstitutionInModal, setSelectedSubstitutionInModal] = useState<string | null>(null);
  
  // Состояние для навигации (отслеживание текущего вида)
  const [navigationState, setNavigationState] = useState<{
    view: 'main' | 'errorList' | 'exampleDetail';
    errorType?: 'deletion' | 'insertion' | 'substitution';
    previousView?: 'main' | 'errorList';
  }>({ view: 'main' });

  if (!word || word.trim() === "") return null;

  // Получаем данные о слове из vocab
  const vocabWord = useMemo(() => {
    return data?.vocab?.find(w => w.word.toLowerCase() === word.toLowerCase());
  }, [data?.vocab, word]);

  // Цели замен: сумма count по replacement_targets в примерах (токен-уровень)
  const substitutionTargetsFromExamples = useMemo(() => {
    const subs = vocabWord?.error_examples?.substitutions ?? [];
    const totals = new Map<string, number>();
    const utterances = new Map<string, number>();
    for (const ex of subs) {
      for (const t of ex.replacement_targets ?? []) {
        const target = t.word;
        const cnt = t.count ?? 0;
        if (!target || cnt <= 0) continue;
        totals.set(target, (totals.get(target) ?? 0) + cnt);
        utterances.set(target, (utterances.get(target) ?? 0) + 1);
      }
    }
    const grand = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .map(([w, count]) => ({
        word: w,
        count,
        utteranceCount: utterances.get(w) ?? 0,
        percent: grand > 0 ? Math.round((count / grand) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [vocabWord?.error_examples?.substitutions]);

  // Получаем контексты из бэкенда (error_examples из vocabWord)
  // Это обеспечивает согласованность с бэкендом
  const wordContexts = useMemo(() => {
    if (!vocabWord?.error_examples) {
      return [];
    }
    
    const contexts: Array<{
      id: string | number;
      file: string;
      time: string;
      reference: string;
      hypothesis: string;
      errorType: string;
      count: number; // Количество операций этого типа в примере
    }> = [];
    
    // Используем данные из бэкенда
    const errorExamples = vocabWord.error_examples;
    
    // Добавляем примеры удалений
    errorExamples.deletions?.forEach((example, idx) => {
      contexts.push({
        id: `del-${idx}`,
        file: example.audio_filepath,
        time: `${Math.round(example.duration || 0)} с`,
        reference: example.text,
        hypothesis: example.prediction,
        errorType: "deletion",
        count: example.count || 1,
      });
    });
    
    // Добавляем примеры вставок
    errorExamples.insertions?.forEach((example, idx) => {
      contexts.push({
        id: `ins-${idx}`,
        file: example.audio_filepath,
        time: `${Math.round(example.duration || 0)} с`,
        reference: example.text,
        hypothesis: example.prediction,
        errorType: "insertion",
        count: example.count || 1,
      });
    });
    
    // Добавляем примеры замен
    errorExamples.substitutions?.forEach((example, idx) => {
      contexts.push({
        id: `sub-${idx}`,
        file: example.audio_filepath,
        time: `${Math.round(example.duration || 0)} с`,
        reference: example.text,
        hypothesis: example.prediction,
        errorType: "substitution",
        count: example.count || 1,
      });
    });
    
    return contexts;
  }, [vocabWord]);
  
  const getExamplesForErrorType = (errorType: "deletion" | "insertion" | "substitution") =>
    wordContexts.filter((ctx) => ctx.errorType === errorType);

  const getExamplesForSubstitutionTarget = useCallback(
    (targetWord: string) => {
      const subs = vocabWord?.error_examples?.substitutions || [];
      const contexts: Array<{
        id: string | number;
        file: string;
        time: string;
        reference: string;
        hypothesis: string;
        errorType: string;
        count: number;
      }> = [];
      subs.forEach((example, idx) => {
        const targets = example.replacement_targets || [];
        const match = targets.find(
          (t) => t.word.toLowerCase() === targetWord.toLowerCase()
        );
        if (!match || (match.count || 0) <= 0) return;
        contexts.push({
          id: `sub-${targetWord}-${idx}`,
          file: example.audio_filepath,
          time: `${Math.round(example.duration || 0)} с`,
          reference: example.text,
          hypothesis: example.prediction,
          errorType: "substitution",
          count: match.count,
        });
      });
      return contexts;
    },
    [vocabWord?.error_examples?.substitutions]
  );

  // Счётчики должны совпадать с compare_report:
  // DEL/INS — сумма count по примерам, SUB — сумма count по replacement_targets.
  const errors = useMemo(() => {
    const ex = vocabWord?.error_examples;
    if (!ex) {
      return { deletions: 0, insertions: 0, substitutions: 0 };
    }
    const substitutionsFromTargets = substitutionTargetsFromExamples.reduce(
      (acc, item) => acc + (item.count || 0),
      0
    );
    return {
      deletions: sumErrorExampleCounts(ex.deletions),
      insertions: sumErrorExampleCounts(ex.insertions),
      substitutions: substitutionsFromTargets,
    };
  }, [vocabWord?.error_examples, substitutionTargetsFromExamples]);

  // Формируем данные о слове
  const wordData = useMemo(() => {
    if (!vocabWord) {
      return {
        wis: 0,
        frequency: 0,
        recall: 0,
        precision: 0,
        f1: 0,
        wisComponents: EMPTY_WIS_COMPONENTS,
        errors: { deletions: 0, insertions: 0, substitutions: 0 },
        substitutionTargetsFromExamples: [],
      };
    }

    const f1Score = vocabWord.f1_score || 0;
    const wisComponents = vocabWord.wisComponents ?? EMPTY_WIS_COMPONENTS;

    return {
      wis: vocabWord.wis || 0,
      frequency: vocabWord.count || 0,
      recall: vocabWord.recall || 0,
      precision: vocabWord.precision || 0,
      f1: f1Score,
      wisComponents,
      errors,
      substitutionTargetsFromExamples,
    };
  }, [vocabWord, substitutionTargetsFromExamples, errors]);

  // Пороги WIS:
  // Маленький: < 30
  // Умеренный: 30-45
  // Средний: 45-60
  // Высокий: 60-75
  // Критический: >= 75
  const getWISColor = (wis: number) => {
    if (wis < 30) return "#10B981";      // Маленький - зеленый
    if (wis < 45) return "#A3E635";      // Умеренный - салатовый
    if (wis < 60) return "#F59E0B";      // Средний - желтый/оранжевый
    if (wis < 75) return "#F97316";      // Высокий - оранжевый
    return "#EF4444";                    // Критический - красный
  };

  const getWISBgColor = (wis: number) => {
    if (wis < 30)
      return theme === "dark" ? "bg-[#10B981]/10" : "bg-green-50";
    if (wis < 45)
      return theme === "dark" ? "bg-[#A3E635]/10" : "bg-lime-50";
    if (wis < 60)
      return theme === "dark" ? "bg-[#F59E0B]/10" : "bg-yellow-50";
    if (wis < 75)
    return theme === "dark" ? "bg-[#F97316]/10" : "bg-orange-50";
    return theme === "dark" ? "bg-[#EF4444]/10" : "bg-red-50";
  };

  const getWISLabel = (wis: number) => {
    if (wis < 30) return "Маленький";
    if (wis < 45) return "Умеренный";
    if (wis < 60) return "Средний";
    if (wis < 75) return "Высокий";
    return "Критический";
  };


  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
          theme === "dark" ? "bg-[#1A1D24]" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`reson-word-modal-header ${
            theme === "dark"
              ? "reson-word-modal-header--dark bg-[#1A1D24]"
              : "bg-white"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm">📝</span>
            </div>
            <div className="min-w-0">
              <h3
                className={`reson-vocab-panel-title ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                Детализация слова:{" "}
                <span className="text-[#8B5CF6]">{word}</span>
              </h3>
              <p
                className={`reson-vocab-panel-desc ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
              >
                Полный анализ распознавания и типичных ошибок
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === "dark"
                ? "hover:bg-[#2A2D35] text-gray-400"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="reson-word-modal-body">
          {/* WIS Score */}
          <div
            className={`reson-word-wis-hero ${getWISBgColor(wordData.wis)} ${
              theme === "dark" ? "reson-word-wis-hero--dark" : ""
            }`}
          >
            <div className="reson-word-wis-hero-top">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${getWISColor(wordData.wis)}20` }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: getWISColor(wordData.wis) }}
                  />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-sm font-semibold mb-0.5 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                  >
                    Word Importance Score (WIS)
                  </div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getWISColor(wordData.wis) }}
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: getWISColor(wordData.wis) }}
                    >
                      {getWISLabel(wordData.wis)}
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-relaxed ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Комплексная метрика важности слова для улучшения модели
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div
                  className="text-3xl font-bold leading-none"
                  style={{ color: getWISColor(wordData.wis) }}
                >
                  {wordData.wis.toFixed(2)}
                </div>
                <div
                  className={`text-xs mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                >
                  из 100
                </div>
              </div>
            </div>

            <WordWisDetailsPanel
              isDark={theme === "dark"}
              wisComponents={wordData.wisComponents}
            />
          </div>

          {/* Metrics Cards */}
          <div className="reson-word-modal-metrics">
            <div
              className={`reson-word-modal-metric-card ${
                theme === "dark" ? "reson-word-modal-metric-card--dark" : ""
              }`}
            >
              <div className="reson-word-modal-metric-label">Частота встречаемости</div>
              <div
                className={`reson-word-modal-metric-value ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                {wordData.frequency.toLocaleString()}
              </div>
              <div className="reson-word-modal-metric-sub">раз в датасете</div>
            </div>

            <div
              className={`reson-word-modal-metric-card ${
                theme === "dark" ? "reson-word-modal-metric-card--dark" : ""
              }`}
            >
              <div className="reson-word-modal-metric-label">Recall</div>
              <div className="reson-word-modal-metric-value text-[#10B981]">
                {wordData.recall}%
              </div>
              <div className="reson-word-modal-metric-sub">полнота распознавания</div>
            </div>

            <div
              className={`reson-word-modal-metric-card ${
                theme === "dark" ? "reson-word-modal-metric-card--dark" : ""
              }`}
            >
              <div className="reson-word-modal-metric-label">Precision</div>
              <div className="reson-word-modal-metric-value text-[#F59E0B]">
                {wordData.precision}%
              </div>
              <div className="reson-word-modal-metric-sub">точность распознавания</div>
            </div>

            <div
              className={`reson-word-modal-metric-card ${
                theme === "dark" ? "reson-word-modal-metric-card--dark" : ""
              }`}
            >
              <div className="reson-word-modal-metric-label">F1-Score</div>
              <div className="reson-word-modal-metric-value text-[#8B5CF6]">
                {wordData.f1}%
              </div>
              <div className="reson-word-modal-metric-sub">гармоническое среднее</div>
            </div>
          </div>

          {/* Error Types */}
          <div>
            <div
              className={`reson-word-modal-section-title ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
            >
              Типы ошибок распознавания
            </div>
            <div
              className={`reson-word-modal-section-desc ${
                theme === "dark" ? "reson-word-modal-section-desc--dark" : ""
              }`}
            >
              Статистика различных типов ошибок для данного слова
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Удаления - кликабельная карточка */}
              <button
                onClick={() => {
                  const examples = getExamplesForErrorType("deletion");
                  setErrorExamplesModal({
                    errorType: "deletion",
                    examples,
                  });
                  setNavigationState({ view: 'errorList', errorType: 'deletion', previousView: 'main' });
                }}
                disabled={wordData.errors.deletions === 0}
                className={`rounded-lg p-3 border transition-all ${
                  wordData.errors.deletions === 0
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:shadow-md hover:scale-[1.02]"
                } ${
                  theme === "dark"
                    ? "bg-[#EF4444]/5 border-[#EF4444]/20 hover:border-[#EF4444]/40"
                    : "bg-red-50 border-red-200 hover:border-red-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#EF4444]/20 flex items-center justify-center">
                    <span className="text-sm">🔴</span>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Удаления
                    </div>
                    <div className="text-lg text-[#EF4444]">
                      {wordData.errors.deletions}
                    </div>
                  </div>
                </div>
                <p
                  className={`text-xs text-left ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}
                >
                  Слово было пропущено ASR моделью
                </p>
              </button>

              {/* Вставки - кликабельная карточка */}
              <button
                onClick={() => {
                  const examples = getExamplesForErrorType("insertion");
                  setErrorExamplesModal({
                    errorType: "insertion",
                    examples,
                  });
                  setNavigationState({ view: 'errorList', errorType: 'insertion', previousView: 'main' });
                }}
                disabled={wordData.errors.insertions === 0}
                className={`rounded-lg p-3 border transition-all ${
                  wordData.errors.insertions === 0
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:shadow-md hover:scale-[1.02]"
                } ${
                  theme === "dark"
                    ? "bg-[#3B82F6]/5 border-[#3B82F6]/20 hover:border-[#3B82F6]/40"
                    : "bg-blue-50 border-blue-200 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/20 flex items-center justify-center">
                    <span className="text-sm">🔵</span>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Вставки
                    </div>
                    <div className="text-lg text-[#3B82F6]">
                      {wordData.errors.insertions}
                    </div>
                  </div>
                </div>
                <p
                  className={`text-xs text-left ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}
                >
                  Лишние вхождения в hypothesis (вставки)
                </p>
              </button>

              {/* Замены - кликабельная карточка */}
              <button
                onClick={() => {
                  setSubstitutionsModal({
                    sourceWord: word || "",
                    substitutions: wordData.substitutionTargetsFromExamples,
                  });
                  setSelectedSubstitutionInModal(null);
                  setNavigationState({ view: 'errorList', errorType: 'substitution', previousView: 'main' });
                }}
                disabled={wordData.errors.substitutions === 0}
                className={`rounded-lg p-3 border transition-all ${
                  wordData.errors.substitutions === 0
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:shadow-md hover:scale-[1.02]"
                } ${
                  theme === "dark"
                    ? "bg-[#F59E0B]/5 border-[#F59E0B]/20 hover:border-[#F59E0B]/40"
                    : "bg-orange-50 border-orange-200 hover:border-orange-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                    <span className="text-sm">🟠</span>
                  </div>
                  <div>
                    <div
                      className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Замены
                    </div>
                    <div className="text-lg text-[#F59E0B]">
                      {wordData.errors.substitutions}
                    </div>
                  </div>
                </div>
                <p
                  className={`text-xs text-left ${theme === "dark" ? "text-gray-500" : "text-gray-600"}`}
                >
                  Слово в эталоне заменено на другое (число = сумма по target-заменам)
                </p>
              </button>
            </div>
          </div>
          
          <div
            className={`reson-word-modal-tip ${
              theme === "dark" ? "reson-word-modal-tip--dark" : ""
            }`}
          >
            <span className="reson-word-modal-tip-badge">💡</span>
            <div>
              <div
                className={`text-xs font-medium mb-0.5 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
              >
                Интерактивные бейджи
              </div>
              <div
                className={`text-xs leading-relaxed ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
              >
                Нажмите на любой бейдж выше, чтобы просмотреть все примеры ошибок этого
                типа. В каждом примере — детальная информация и разница между эталоном и
                гипотезой.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Examples Modal - для удалений и вставок */}
      {errorExamplesModal && (
        <ErrorExamplesModal
          errorType={errorExamplesModal.errorType}
          examples={errorExamplesModal.examples}
          word={word || ""}
          onClose={() => setErrorExamplesModal(null)}
          onShowDetail={(manifestEntry) => setSelectedManifestEntry(manifestEntry)}
          manifestData={data?.manifest || []}
        />
      )}

      {/* Substitutions Modal - двухуровневое модальное окно для замен */}
      {substitutionsModal && (
        <SubstitutionsModal
          sourceWord={substitutionsModal.sourceWord}
          substitutions={substitutionsModal.substitutions}
          selectedSubstitution={selectedSubstitutionInModal}
          onSelectSubstitution={setSelectedSubstitutionInModal}
          onClose={() => {
            setSubstitutionsModal(null);
            setSelectedSubstitutionInModal(null);
            setNavigationState({ view: 'main' });
          }}
          onShowDetail={(manifestEntry) => {
            setSelectedManifestEntry(manifestEntry);
            setNavigationState({ view: 'exampleDetail', errorType: 'substitution', previousView: 'errorList' });
          }}
          onBack={() => {
            setSubstitutionsModal(null);
            setSelectedSubstitutionInModal(null);
            setNavigationState({ view: 'main' });
          }}
          getExamplesForReplacement={getExamplesForSubstitutionTarget}
          manifestData={data?.manifest || []}
        />
      )}

      {/* Replacement Examples Modal - показывает все примеры замены */}
      {replacementExamplesModal && (
        <ReplacementExamplesModal
          sourceWord={replacementExamplesModal.sourceWord}
          targetWord={replacementExamplesModal.targetWord}
          examples={replacementExamplesModal.examples}
          onClose={() => setReplacementExamplesModal(null)}
          onShowDetail={(manifestEntry) => setSelectedManifestEntry(manifestEntry)}
          manifestData={data?.manifest || []}
        />
      )}

      {/* Manifest Entry Detail Modal */}
      {selectedManifestEntry && (
        <ManifestEntryDetailModal
          entry={selectedManifestEntry}
          onClose={() => setSelectedManifestEntry(null)}
        />
      )}
    </div>
  );
}

function ManifestEntryDetailModal({
  entry,
  onClose,
  onBack,
}: {
  entry: {
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
    diff_tokens?: Array<{ word: string; type: "equal" | "ins" | "del" | "sub_del" | "sub_ins" }>;
  };
  onClose: () => void;
  onBack?: () => void;
}) {
  const { theme } = useTheme();
  const audioFileName = audioBasename(entry.audio_filepath);

  const durationType = entry.duration < 5 ? 'short' : entry.duration <= 30 ? 'normal' : 'long';
  const ins = entry.INS || 0;
  const del = entry.DEL || 0;
  const sub = entry.SUB || 0;

  return (
    <OverlayPortal>
    <div
      className="reson-overlay-layer fixed inset-0 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`reson-overlay-sheet w-full max-w-3xl overflow-hidden rounded-2xl pointer-events-auto flex flex-col ${
            theme === 'dark'
              ? 'bg-[#1A1D24] border border-[#2A2D35]'
              : 'bg-white border border-gray-200 shadow-2xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${theme === 'dark' ? 'border-[#2A2D35]' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Детализация примера
                  </h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Полный анализ распознавания и типичных ошибок
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-[#2A2D35] text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="reson-overlay-sheet-scroll p-6 space-y-6">
            {/* Основные метрики */}
            <div>
              <div className={`text-sm mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Основные метрики
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-gray-50'}`}>
                  <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    WER
                  </div>
                  <div className={`text-2xl mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {entry.WER.toFixed(2)}%
                  </div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    Word Error Rate
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-gray-50'}`}>
                  <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Длительность
                  </div>
                  <div className={`text-2xl mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {entry.duration.toFixed(2)}с
                  </div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    время записи
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-gray-50'}`}>
                  <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Тип длительности
                  </div>
                  <div className={`text-2xl mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {durationType}
                  </div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    тип измерения
                  </div>
                </div>
              </div>
            </div>

            {/* Разница, REF и HYP в двухколоночном layout */}
            <div className="reson-overlay-detail-grid grid grid-cols-2 gap-4">
              {/* Левая колонка: Разница */}
              <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-gray-50'}`}>
                <div className={`text-sm mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Разница
                </div>
                <div className="text-sm leading-relaxed">
                  <DiffTokensView
                    tokens={entry.diff_tokens}
                    reference={entry.text}
                    prediction={entry.prediction}
                    theme={theme}
                  />
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
                    {entry.text}
                  </div>
                </div>

                {/* Предсказанный текст */}
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#23262F]' : 'bg-blue-50'}`}>
                  <div className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Предсказанный текст
                  </div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {entry.prediction}
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
                    title={entry.audio_filepath}
                  >
                    {audioFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(entry.audio_filepath)}
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
                  <source src={entry.audio_filepath} type="audio/wav" />
                  <source src={entry.audio_filepath} type="audio/mpeg" />
                  Ваш браузер не поддерживает аудио элемент.
                </audio>
                <div
                  className={`audio-error-msg text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}
                  style={{ display: 'none' }}
                >
                  Не удалось загрузить аудиофайл «{audioFileName}». Полный путь можно скопировать кнопкой выше.
                </div>
              </div>
            </div>

            {/* Типы ошибок распознавания */}
            <div>
              <div className={`text-sm mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Типы ошибок распознавания
              </div>
              <div className={`text-xs mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Статистика различных типов ошибок для данного примера
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">D</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-red-600 mb-1">Удаления</div>
                      <div className="text-2xl text-red-700">{del}</div>
                      <div className="text-xs text-red-600 mt-1">
                        Слово было пропущено ASR моделью
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[rgb(239,255,245)] border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">I</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-green-600 mb-1">Вставки</div>
                      <div className="text-2xl text-green-700">{ins}</div>
                      <div className="text-xs text-green-600 mt-1">
                        Слово было добавлено ошибочно
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">S</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-yellow-600 mb-1">Замены</div>
                      <div className="text-2xl text-yellow-700">{sub}</div>
                      <div className="text-xs text-yellow-600 mt-1">
                        Слово было заменено на другое
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}

// Модальное окно для примеров ошибок (удаления/вставки)
function ErrorExamplesModal({
  errorType,
  examples,
  word,
  onClose,
  onShowDetail,
  onBack,
  manifestData,
}: {
  errorType: "deletion" | "insertion";
  examples: Array<{
    id: number;
    file: string;
    time: string;
    reference: string;
    hypothesis: string;
    errorType: string;
  }>;
  word: string;
  onClose: () => void;
  onShowDetail: (manifestEntry: {
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
  }) => void;
  onBack?: () => void;
  manifestData: Array<{
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
  }>;
}) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const errorTypeLabel = errorType === "deletion" ? "Удаления" : "Вставки";
  const errorTypeColor = errorType === "deletion" 
    ? (theme === "dark" ? "bg-[#EF4444]/20 text-[#EF4444]" : "bg-red-100 text-red-700")
    : (theme === "dark" ? "bg-[#3B82F6]/20 text-[#3B82F6]" : "bg-blue-100 text-blue-700");

  // Фильтрация примеров
  const filteredExamples = useMemo(() => {
    if (!searchQuery) return examples;
    const query = searchQuery.toLowerCase();
    return examples.filter(
      (ex) =>
        ex.file.toLowerCase().includes(query) ||
        ex.reference.toLowerCase().includes(query) ||
        ex.hypothesis.toLowerCase().includes(query)
    );
  }, [examples, searchQuery]);

  // Пагинация
  const totalPages = Math.ceil(filteredExamples.length / itemsPerPage);
  const paginatedExamples = filteredExamples.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <OverlayPortal>
    <div
      className="reson-overlay-layer fixed inset-0 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`reson-overlay-sheet w-full max-w-4xl overflow-hidden rounded-2xl pointer-events-auto flex flex-col ${
            theme === "dark"
              ? "bg-[#1A1D24] border border-[#2A2D35]"
              : "bg-white border border-gray-200 shadow-2xl"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button
                    onClick={onBack}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === "dark"
                        ? "hover:bg-[#2A2D35] text-gray-400"
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    Примеры {errorTypeLabel.toLowerCase()}
                  </h2>
                  <p className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Слово "{word}" • {filteredExamples.length} примеров
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  theme === "dark"
                    ? "hover:bg-[#2A2D35] text-gray-400"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Поиск */}
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Поиск по тексту..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white placeholder-gray-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                } border focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50`}
              />
            </div>
          </div>

          {/* Content */}
          <div className="reson-overlay-sheet-scroll flex-1 overflow-y-auto p-6">
            {paginatedExamples.length === 0 ? (
              <div className={`text-center py-12 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                <p>Примеры не найдены</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className={`mt-2 text-sm ${theme === "dark" ? "text-[#8B5CF6]" : "text-purple-600"} hover:underline`}
                  >
                    Сбросить поиск
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedExamples.map((example) => (
                  <div
                    key={example.id}
                    className={`rounded-lg border p-4 transition-all hover:shadow-md ${
                      theme === "dark"
                        ? "bg-[#23262F] border-[#2A2D35] hover:border-[#8B5CF6]/40"
                        : "bg-white border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${errorTypeColor}`}>
                            {errorTypeLabel}
                          </span>
                          {example.count > 1 && (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              theme === "dark" ? "bg-[#8B5CF6]/20 text-[#8B5CF6]" : "bg-purple-100 text-purple-700"
                            }`}>
                              {example.count} раз
                            </span>
                          )}
                          <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                            {example.time}
                          </span>
                        </div>
                        <div className={`text-sm mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          <span className="font-medium">Reference:</span> {example.reference.substring(0, 100)}
                          {example.reference.length > 100 && "..."}
                        </div>
                        <div className={`text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          <span className="font-medium">Hypothesis:</span> {example.hypothesis.substring(0, 100)}
                          {example.hypothesis.length > 100 && "..."}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const manifestEntry = manifestData.find(
                            (item) => item.audio_filepath === example.file
                          );
                          if (manifestEntry) {
                            onShowDetail(manifestEntry);
                          }
                        }}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                          theme === "dark"
                            ? "bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30"
                            : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                        }`}
                      >
                        Показать детали
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer с пагинацией */}
          {totalPages > 1 && (
            <div className={`p-4 border-t ${theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Показано {paginatedExamples.length} из {filteredExamples.length} примеров
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      currentPage === 1
                        ? theme === "dark"
                          ? "bg-[#23262F] text-gray-600 cursor-not-allowed"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : theme === "dark"
                          ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Назад
                  </button>
                  <span className={`text-sm px-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Страница {currentPage} из {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      currentPage === totalPages
                        ? theme === "dark"
                          ? "bg-[#23262F] text-gray-600 cursor-not-allowed"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : theme === "dark"
                          ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Вперед
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}

// Двухуровневое модальное окно для замен
function SubstitutionsModal({
  sourceWord,
  substitutions,
  selectedSubstitution,
  onSelectSubstitution,
  onClose,
  onShowDetail,
  onBack,
  getExamplesForReplacement,
  manifestData,
}: {
  sourceWord: string;
  substitutions: Array<{ word: string; count: number; percent: number; utteranceCount?: number }>;
  selectedSubstitution: string | null;
  onSelectSubstitution: (word: string | null) => void;
  onClose: () => void;
  onShowDetail: (manifestEntry: {
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
  }) => void;
  onBack?: () => void;
  getExamplesForReplacement: (targetWord: string) => Array<{
    id: number;
    file: string;
    time: string;
    reference: string;
    hypothesis: string;
    errorType: string;
  }>;
  manifestData: Array<{
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
  }>;
}) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const examples = selectedSubstitution ? getExamplesForReplacement(selectedSubstitution) : [];
  const totalSubstitutionOps = examples.reduce((sum, ex) => sum + (ex.count || 0), 0);

  // Фильтрация примеров
  const filteredExamples = useMemo(() => {
    if (!searchQuery) return examples;
    const query = searchQuery.toLowerCase();
    return examples.filter(
      (ex) =>
        ex.file.toLowerCase().includes(query) ||
        ex.reference.toLowerCase().includes(query) ||
        ex.hypothesis.toLowerCase().includes(query)
    );
  }, [examples, searchQuery]);

  // Пагинация
  const totalPages = Math.ceil(filteredExamples.length / itemsPerPage);
  const paginatedExamples = filteredExamples.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <OverlayPortal>
    <div
      className="reson-overlay-layer fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`reson-overlay-sheet w-full max-w-6xl overflow-hidden rounded-2xl pointer-events-auto flex flex-col animate-in slide-in-from-bottom-4 duration-300 ${
            theme === "dark"
              ? "bg-[#1A1D24] border border-[#2A2D35]"
              : "bg-white border border-gray-200 shadow-2xl"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button
                    onClick={onBack}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === "dark"
                        ? "hover:bg-[#2A2D35] text-gray-400"
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    Анализ замен
                  </h2>
                  <p className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Слово "{sourceWord}" • {substitutions.length} вариантов замены
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  theme === "dark"
                    ? "hover:bg-[#2A2D35] text-gray-400"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content - компактный sidebar слева, основная область справа */}
          <div className="reson-modal-split flex-1 overflow-hidden flex min-h-0">
            {/* Левая колонка: список замен */}
            <div
              className={`reson-modal-split-nav w-52 shrink-0 border-r overflow-y-auto ${
                theme === "dark" ? "border-[#2A2D35] bg-[#16181E]/40" : "border-gray-200 bg-gray-50/60"
              }`}
            >
              <div className="p-3">
                <div className={`text-xs font-medium mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Варианты замены
                </div>
                <div className="space-y-1.5">
                  {substitutions.map((sub, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onSelectSubstitution(selectedSubstitution === sub.word ? null : sub.word);
                        setCurrentPage(1);
                        setSearchQuery("");
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                        selectedSubstitution === sub.word
                          ? theme === "dark"
                            ? "bg-[#8B5CF6]/10 border-[#8B5CF6]"
                            : "bg-purple-50 border-purple-300"
                          : theme === "dark"
                            ? "bg-[#23262F] border-[#2A2D35] hover:border-[#8B5CF6]/40"
                            : "bg-white border-gray-200 hover:border-purple-200"
                      }`}
                    >
                      <div
                        className={`text-xs font-medium truncate mb-1 ${
                          theme === "dark" ? "text-white" : "text-gray-900"
                        }`}
                        title={`${sourceWord} → ${sub.word}`}
                      >
                        {sourceWord} → {sub.word}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] leading-none ${
                            theme === "dark"
                              ? "bg-[#8B5CF6]/20 text-[#8B5CF6]"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {sub.count}
                        </span>
                        <span className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                          {sub.percent}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Правая колонка: примеры выбранной замены */}
            <div className="reson-modal-split-body flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              {selectedSubstitution ? (
                <>
                  {/* Header с поиском */}
                  <div className={`p-4 border-b ${theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                          Примеры замены "{sourceWord}" → "{selectedSubstitution}"
                        </div>
                        <div className={`text-xs mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                          {filteredExamples.length} {filteredExamples.length === 1 ? "запись" : "записей"}
                          {" · "}
                          {totalSubstitutionOps}{" "}
                          {totalSubstitutionOps === 1 ? "замена" : "замен"} всего
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`} />
                      <input
                        type="text"
                        placeholder="Поиск по тексту..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                          theme === "dark"
                            ? "bg-[#23262F] border-[#2A2D35] text-white placeholder-gray-500"
                            : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                        } border focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50`}
                      />
                    </div>
                  </div>

                  {/* Список примеров */}
                  <div className="reson-modal-split-scroll flex-1 overflow-y-auto p-4">
                    {paginatedExamples.length === 0 ? (
                      <div className={`text-center py-12 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                        <p>Примеры не найдены</p>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className={`mt-2 text-sm ${theme === "dark" ? "text-[#8B5CF6]" : "text-purple-600"} hover:underline`}
                          >
                            Сбросить поиск
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {paginatedExamples.map((example) => (
                          <div
                            key={example.id}
                            className={`rounded-lg border p-4 transition-all hover:shadow-md ${
                              theme === "dark"
                                ? "bg-[#23262F] border-[#2A2D35] hover:border-[#8B5CF6]/40"
                                : "bg-white border-gray-200 hover:border-purple-300"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    theme === "dark"
                                      ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}>
                                    Замена
                                  </span>
                                  {(example.count ?? 0) > 0 && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      theme === "dark"
                                        ? "bg-[#8B5CF6]/20 text-[#8B5CF6]"
                                        : "bg-purple-100 text-purple-700"
                                    }`}>
                                      ×{example.count}
                                    </span>
                                  )}
                                  <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                                    {example.time}
                                  </span>
                                </div>
                                <div className={`text-sm mb-1 break-words ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                                  <span className="font-medium">Reference:</span> {example.reference}
                                </div>
                                <div className={`text-sm break-words ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                                  <span className="font-medium">Hypothesis:</span> {example.hypothesis}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const manifestEntry = manifestData.find(
                                    (item) => item.audio_filepath === example.file
                                  );
                                  if (manifestEntry) {
                                    onShowDetail(manifestEntry);
                                    onClose();
                                  }
                                }}
                                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                                  theme === "dark"
                                    ? "bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30"
                                    : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                }`}
                              >
                                Показать детали
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer с пагинацией */}
                  {totalPages > 1 && (
                    <div className={`p-4 border-t ${theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"}`}>
                      <div className="flex items-center justify-between">
                        <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                          Показано {paginatedExamples.length} из {filteredExamples.length} записей
                          {totalSubstitutionOps > 0 && ` (${totalSubstitutionOps} замен)`}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              currentPage === 1
                                ? theme === "dark"
                                  ? "bg-[#23262F] text-gray-600 cursor-not-allowed"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : theme === "dark"
                                  ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            Назад
                          </button>
                          <span className={`text-sm px-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                            Страница {currentPage} из {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              currentPage === totalPages
                                ? theme === "dark"
                                  ? "bg-[#23262F] text-gray-600 cursor-not-allowed"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : theme === "dark"
                                  ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            Вперед
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className={`text-center ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    <p className="text-sm">Выберите замену для просмотра примеров</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}

// Компонент модального окна со всеми примерами замены
function ReplacementExamplesModal({
  sourceWord,
  targetWord,
  examples,
  onClose,
  onShowDetail,
  manifestData,
}: {
  sourceWord: string;
  targetWord: string;
  examples: Array<{
    id: number;
    file: string;
    time: string;
    reference: string;
    hypothesis: string;
    errorType: string;
  }>;
  onClose: () => void;
  onShowDetail: (manifestEntry: {
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
  }) => void;
  manifestData: Array<{
    audio_filepath: string;
    duration: number;
    text: string;
    prediction: string;
    WER: number;
    CER?: number;
    INS?: number;
    DEL?: number;
    SUB?: number;
  }>;
}) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [errorTypeFilter, setErrorTypeFilter] = useState<"all" | "deletion" | "insertion" | "substitution">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Фильтрация примеров
  const filteredExamples = useMemo(() => {
    let filtered = examples;

    // Фильтр по поисковому запросу
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ex) =>
          ex.file.toLowerCase().includes(query) ||
          ex.reference.toLowerCase().includes(query) ||
          ex.hypothesis.toLowerCase().includes(query)
      );
    }

    // Фильтр по типу ошибки
    if (errorTypeFilter !== "all") {
      filtered = filtered.filter((ex) => ex.errorType === errorTypeFilter);
    }

    return filtered;
  }, [examples, searchQuery, errorTypeFilter]);

  // Пагинация
  const totalPages = Math.ceil(filteredExamples.length / itemsPerPage);
  const paginatedExamples = filteredExamples.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case "deletion":
        return "Удаление";
      case "insertion":
        return "Вставка";
      case "substitution":
        return "Замена";
      default:
        return type;
    }
  };

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case "deletion":
        return theme === "dark"
          ? "bg-[#EF4444]/20 text-[#EF4444]"
          : "bg-red-100 text-red-700";
      case "insertion":
        return theme === "dark"
          ? "bg-[#10B981]/20 text-[#10B981]"
          : "bg-green-100 text-green-700";
      case "substitution":
        return theme === "dark"
          ? "bg-[#F59E0B]/20 text-[#F59E0B]"
          : "bg-yellow-100 text-yellow-700";
      default:
        return theme === "dark"
          ? "bg-gray-500/20 text-gray-400"
          : "bg-gray-100 text-gray-700";
    }
  };

  return (
    <OverlayPortal>
    <div
      className="reson-overlay-layer fixed inset-0 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`reson-overlay-sheet w-full max-w-4xl overflow-hidden rounded-2xl pointer-events-auto flex flex-col ${
            theme === "dark"
              ? "bg-[#1A1D24] border border-[#2A2D35]"
              : "bg-white border border-gray-200 shadow-2xl"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-6 border-b ${theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  Все примеры замены
                </h2>
                <p className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  "{sourceWord}" → "{targetWord}" • {filteredExamples.length} из {examples.length} примеров
                </p>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  theme === "dark"
                    ? "hover:bg-[#2A2D35] text-gray-400"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Фильтры */}
            <div className="flex items-center gap-3">
              {/* Поиск */}
              <div className="flex-1 relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`} />
                <input
                  type="text"
                  placeholder="Поиск по тексту..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                    theme === "dark"
                      ? "bg-[#23262F] border-[#2A2D35] text-white placeholder-gray-500"
                      : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                  } border focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50`}
                />
              </div>

              {/* Фильтр по типу ошибки */}
              <select
                value={errorTypeFilter}
                onChange={(e) => {
                  setErrorTypeFilter(e.target.value as typeof errorTypeFilter);
                  setCurrentPage(1);
                }}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  theme === "dark"
                    ? "bg-[#23262F] border-[#2A2D35] text-white"
                    : "bg-gray-50 border-gray-200 text-gray-900"
                } focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50`}
              >
                <option value="all">Все типы</option>
                <option value="deletion">Удаления</option>
                <option value="insertion">Вставки</option>
                <option value="substitution">Замены</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="reson-overlay-sheet-scroll flex-1 overflow-y-auto p-6">
            {paginatedExamples.length === 0 ? (
              <div className={`text-center py-12 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                <p>Примеры не найдены</p>
                {(searchQuery || errorTypeFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setErrorTypeFilter("all");
                    }}
                    className={`mt-2 text-sm ${theme === "dark" ? "text-[#8B5CF6]" : "text-purple-600"} hover:underline`}
                  >
                    Сбросить фильтры
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedExamples.map((example) => (
                  <div
                    key={example.id}
                    className={`rounded-lg border p-4 transition-all hover:shadow-md ${
                      theme === "dark"
                        ? "bg-[#23262F] border-[#2A2D35] hover:border-[#8B5CF6]/40"
                        : "bg-white border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${getErrorTypeColor(example.errorType)}`}>
                            {getErrorTypeLabel(example.errorType)}
                          </span>
                          <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                            {example.time}
                          </span>
                        </div>
                        <div className={`text-sm mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          <span className="font-medium">Reference:</span> {example.reference.substring(0, 100)}
                          {example.reference.length > 100 && "..."}
                        </div>
                        <div className={`text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          <span className="font-medium">Hypothesis:</span> {example.hypothesis.substring(0, 100)}
                          {example.hypothesis.length > 100 && "..."}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const manifestEntry = manifestData.find(
                            (item) => item.audio_filepath === example.file
                          );
                          if (manifestEntry) {
                            onShowDetail(manifestEntry);
                            onClose(); // Закрываем модальное окно со списком
                          }
                        }}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                          theme === "dark"
                            ? "bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30"
                            : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                        }`}
                      >
                        Показать детали
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer с пагинацией */}
          {totalPages > 1 && (
            <div className={`p-4 border-t ${theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  Показано {paginatedExamples.length} из {filteredExamples.length} примеров
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      currentPage === 1
                        ? theme === "dark"
                          ? "bg-[#23262F] text-gray-600 cursor-not-allowed"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : theme === "dark"
                          ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Назад
                  </button>
                  <span className={`text-sm px-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    Страница {currentPage} из {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      currentPage === totalPages
                        ? theme === "dark"
                          ? "bg-[#23262F] text-gray-600 cursor-not-allowed"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : theme === "dark"
                          ? "bg-[#23262F] text-gray-300 hover:bg-[#2A2D35]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Вперед
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}