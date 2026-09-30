import {
  Clock,
  FileAudio,
  Type,
  Hash,
  PieChart,
  Info,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { MetricCard } from "./MetricCard";
import { DataQualityAlerts } from "./DataQualityAlerts";
import { OverviewContextBar } from "./OverviewContextBar";
import { AudioDurationStats } from "./AudioDurationStats";
import { UniqueSymbols } from "./UniqueSymbols";
import { ErrorDetailsModal } from "./ErrorDetailsModal";
import { ModelProfile } from "./ModelProfile";
import { OverviewSectionLinks } from "./OverviewSectionLinks";
import { useTheme } from "../contexts/ThemeContext";
import { useData } from "../contexts/DataContext";

export function Overview() {
  const { theme } = useTheme();
  const { data } = useData();
  const [selectedErrorType, setSelectedErrorType] = useState<'insertions' | 'deletions' | 'substitutions' | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [schemaExpanded, setSchemaExpanded] = useState(true);
  const [normalizationExpanded, setNormalizationExpanded] = useState(true);

  return (
    <div
      className={`reson-overview-page p-6 ${
        theme === "dark" ? "bg-[#0F1117] text-white" : "bg-[#F5F7FA] text-gray-900"
      }`}
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`p-1.5 rounded-lg ${
              theme === "dark"
                ? "bg-gradient-to-br from-[#2D5A8F] to-[#1A1D24]"
                : "bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]"
            }`}
          >
            <PieChart className="w-5 h-5 text-white" />
          </div>
          <h1
            className={`text-2xl font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Обзор
          </h1>
        </div>
        <p
          className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
        >
          Краткий обзор основных метрик и метаинформации работы модели на датасете
        </p>
      </div>

      <OverviewContextBar
        onOpenRunInfo={() => {
          setAlertsPanelOpen(false);
          setInfoPanelOpen((prev) => !prev);
        }}
        runInfoPressed={infoPanelOpen}
        onOpenAlerts={() => {
          setInfoPanelOpen(false);
          setAlertsPanelOpen((prev) => !prev);
        }}
        alertsPressed={alertsPanelOpen}
      />

      {/* Top Stats */}
      <div
        data-tour="overview-dataset-stats"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5"
      >
        <MetricCard
          compact
          label="Общая длительность"
          value={data?.summary?.totalHours || "н/д"}
          icon={<Clock className="w-5 h-5 text-gray-400" />}
        />
        <MetricCard
          compact
          label="Кол-во примеров"
          value={data?.summary?.totalUtterances?.toLocaleString() || "0"}
          icon={<FileAudio className="w-5 h-5 text-gray-400" />}
        />
        <MetricCard
          compact
          label="Уникальных слов"
          value={data?.summary?.vocabularySize || "0 words"}
          icon={<Type className="w-5 h-5 text-gray-400" />}
        />
        <MetricCard
          compact
          label="Уникальных символов"
          value={data?.summary?.alphabetSize || "0 chars"}
          icon={<Hash className="w-5 h-5 text-gray-400" />}
        />
      </div>

      <div
        data-tour="overview-metrics"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5"
      >
        <div
          className={`rounded-xl p-5 border ${
            theme === "dark"
              ? "bg-gradient-to-br from-[#2D1810] to-[#1A1D24] border-[#3D2820]"
              : "bg-gradient-to-br from-[#FFF4ED] to-[#FFF9F5] border-orange-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <h3
              className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Word Error Rate (WER)
            </h3>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full ${
                theme === "dark"
                  ? "bg-[#F97316]/10 text-[#F97316]"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              Основная метрика
            </span>
          </div>
          <div className="mb-1">
            <span
              className={`text-3xl font-semibold ${
                theme === "dark"
                  ? "bg-gradient-to-r from-[#F97316] to-[#FB923C] bg-clip-text text-transparent"
                  : "text-orange-600"
              }`}
            >
              {data?.metrics?.wer?.value?.toFixed(2) || "0.00"}%
            </span>
            <span
              className={`text-sm ml-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              ошибок на уровне слов
            </span>
          </div>
          <p
            className={`text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}
          >
            Процент слов, которые были неправильно распознаны,
            удалены или добавлены
          </p>
        </div>

        <div
          className={`rounded-xl p-5 border ${
            theme === "dark"
              ? "bg-gradient-to-br from-[#1E1B3A] to-[#1A1D24] border-[#2E2B4A]"
              : "bg-gradient-to-br from-[#F3F0FF] to-[#F9F7FF] border-purple-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <h3
              className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
            >
              Mean Word Accuracy (MWA)
            </h3>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full ${
                theme === "dark"
                  ? "bg-[#8B5CF6]/10 text-[#8B5CF6]"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              Основная метрика
            </span>
          </div>
          <div className="mb-1">
            <span
              className={`text-3xl font-semibold ${
                theme === "dark"
                  ? "bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent"
                  : "text-purple-600"
              }`}
            >
              {data?.dictionary?.metrics?.meanRecall?.toFixed(2) || "0.00"}%
            </span>
            <span
              className={`text-sm ml-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
            >
              средняя точность распознавания слов
            </span>
          </div>
          <p
            className={`text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}
          >
            Процент правильно распознанных слов относительно
            общего количества
          </p>
        </div>
      </div>

      <div className="mb-4" data-tour="overview-model-profile">
        <ModelProfile
          data={data ? (() => {
            const wer = data.metrics?.wer;
            const manifest = data.manifest || [];
            
            // Вычисляем средний WER для коротких записей (< 5 сек)
            const shortSamples = manifest.filter(m => m.duration < 5);
            const shortAvgWer = shortSamples.length > 0
              ? shortSamples.reduce((sum, m) => sum + (m.WER || 0), 0) / shortSamples.length
              : null;
            
            // Вычисляем средний WER для длинных записей (30+ сек)
            const longSamples = manifest.filter(m => m.duration >= 30);
            const longAvgWer = longSamples.length > 0
              ? longSamples.reduce((sum, m) => sum + (m.WER || 0), 0) / longSamples.length
              : null;
            
            // Robust - процент файлов с WER <= 15% (excellent + good)
            const robust = data.qualityZones 
              ? ((data.qualityZones.excellent?.count || 0) + (data.qualityZones.good?.count || 0)) / (data.summary?.totalUtterances || 1) * 100
              : undefined;
            
            // Проценты ошибок из decomposition
            const totalErrors = (wer?.insertions || 0) + (wer?.deletions || 0) + (wer?.substitutions || 0);
            const insPct = totalErrors > 0 ? (wer?.insertions || 0) / totalErrors * 100 : 0;
            const delPct = totalErrors > 0 ? (wer?.deletions || 0) / totalErrors * 100 : 0;
            const subPct = totalErrors > 0 ? (wer?.substitutions || 0) / totalErrors * 100 : 0;
            
            return {
              werAcc: wer ? (100 - wer.value) : undefined,
              short: shortAvgWer !== null ? (100 - shortAvgWer) : undefined,
              long: longAvgWer !== null ? (100 - longAvgWer) : undefined,
              robust: robust,
              insert: 100 - insPct,
              delet: 100 - delPct,
              subst: 100 - subPct,
              insertionsCount: wer?.insertions,
              deletionsCount: wer?.deletions,
              substitutionsCount: wer?.substitutions,
            };
          })() : undefined}
          onErrorTypeClick={(type) => setSelectedErrorType(type)}
        />
      </div>

      <DataQualityAlerts
        showFloatingButton={false}
        open={alertsPanelOpen}
        onOpenChange={setAlertsPanelOpen}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        <AudioDurationStats />
        <UniqueSymbols />
      </div>

      <OverviewSectionLinks />

      {/* Error Details Modal */}
      {selectedErrorType && (
        <ErrorDetailsModal
          type={selectedErrorType}
          onClose={() => setSelectedErrorType(null)}
        />
      )}


      {/* Информационная боковая панель */}
      <div
        className={`reson-side-panel fixed top-0 right-0 h-full w-[480px] shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          infoPanelOpen ? "translate-x-0" : "translate-x-full"
        } ${
          theme === "dark"
            ? "bg-[#1A1D24] border-l border-[#2A2D35]"
            : "bg-white border-l border-gray-200"
        }`}
      >
        <div className="h-full overflow-y-auto">
          {/* Заголовок панели */}
          <div
            className={`sticky top-0 px-6 py-4 border-b ${
              theme === "dark"
                ? "bg-[#1A1D24] border-[#2A2D35]"
                : "bg-white border-gray-200"
            } z-10`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info
                  className={`w-5 h-5 ${theme === "dark" ? "text-[#60A5FA]" : "text-[#3B82F6]"}`}
                />
                <h2
                  className={`${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Информация о запуске
                </h2>
              </div>
              <button
                onClick={() => setInfoPanelOpen(false)}
                className={`p-2 rounded-lg ${
                  theme === "dark"
                    ? "hover:bg-[#23262F]"
                    : "hover:bg-gray-100"
                }`}
              >
                <X
                  className={`w-5 h-5 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                />
              </button>
            </div>
          </div>

          {/* Контент панели */}
          <div className="p-6 space-y-4">
            {/* Информация и мета-данные */}
            <div
              className={`rounded-xl border ${
                theme === "dark"
                  ? "bg-[#23262F] border-[#2A2D35]"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <button
                onClick={() => setSummaryExpanded(!summaryExpanded)}
                className={`w-full px-4 py-3 flex items-center justify-between ${
                  theme === "dark"
                    ? "hover:bg-[#2A2D35]"
                    : "hover:bg-gray-100"
                } transition-colors rounded-t-xl`}
              >
                <h3
                  className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Информация и мета-данные
                </h3>
                {summaryExpanded ? (
                  <ChevronDown
                    className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  />
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  />
                )}
              </button>

              {summaryExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <p
                      className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Имя запуска
                    </p>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {data?.runInfo?.runName ?? data?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Дата создания
                    </p>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {data?.runInfo?.createdAt || "—"}
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Количество записей
                    </p>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {(data?.runInfo?.recordCount ?? data?.manifest?.length ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Тексты нормализованы
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        data?.runInfo?.normalized
                          ? "bg-[#10B981] text-white"
                          : theme === "dark"
                            ? "bg-[#2A2D35] text-gray-400"
                            : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {data?.runInfo?.normalized ? "Да" : "Нет"}
                    </span>
                  </div>
                  <div>
                    <p
                      className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Провайдер метрик
                    </p>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {data?.runInfo?.metricProvider || "—"}
                    </p>
                  </div>
                  <div>
                    <p
                      className={`text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Мета-информация
                    </p>
                    {data?.runInfo?.meta && Object.keys(data.runInfo.meta).length > 0 ? (
                      <pre className={`text-xs overflow-x-auto rounded p-2 ${
                        theme === "dark" ? "bg-[#1A1D24] text-gray-300" : "bg-gray-100 text-gray-800"
                      }`}>
                        {JSON.stringify(data.runInfo.meta, null, 2)}
                      </pre>
                    ) : (
                      <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                        Нет данных
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Схема данных манифеста */}
            <div
              className={`rounded-xl border ${
                theme === "dark"
                  ? "bg-[#23262F] border-[#2A2D35]"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <button
                onClick={() => setSchemaExpanded(!schemaExpanded)}
                className={`w-full px-4 py-3 flex items-center justify-between ${
                  theme === "dark"
                    ? "hover:bg-[#2A2D35]"
                    : "hover:bg-gray-100"
                } transition-colors rounded-t-xl`}
              >
                <h3
                  className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Схема данных манифеста
                </h3>
                {schemaExpanded ? (
                  <ChevronDown
                    className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  />
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  />
                )}
              </button>

              {schemaExpanded && (
                <div className="px-4 pb-4">
                  <div
                    className={`rounded-lg p-3 ${
                      theme === "dark"
                        ? "bg-[#0D1117]"
                        : "bg-[#1E293B]"
                    }`}
                  >
                    <pre className="text-xs text-[#E5E7EB] overflow-x-auto">
                      {data?.runInfo?.manifestSchema && Object.keys(data.runInfo.manifestSchema).length > 0
                        ? JSON.stringify(data.runInfo.manifestSchema, null, 2)
                        : `{
  "audio_filepath": "string",
  "duration": "number",
  "text": "string",
  "prediction": "string"
}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Настройки нормализации */}
            <div
              className={`rounded-xl border ${
                theme === "dark"
                  ? "bg-[#23262F] border-[#2A2D35]"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <button
                onClick={() =>
                  setNormalizationExpanded(!normalizationExpanded)
                }
                className={`w-full px-4 py-3 flex items-center justify-between ${
                  theme === "dark"
                    ? "hover:bg-[#2A2D35]"
                    : "hover:bg-gray-100"
                } transition-colors rounded-t-xl`}
              >
                <h3
                  className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  Настройки нормализации
                </h3>
                {normalizationExpanded ? (
                  <ChevronDown
                    className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  />
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  />
                )}
              </button>

              {normalizationExpanded && (
                <div className="px-4 pb-4">
                  <div
                    className={`rounded-lg p-3 ${
                      theme === "dark"
                        ? "bg-[#0D1117]"
                        : "bg-[#1E293B]"
                    }`}
                  >
                    <pre className="text-xs text-[#E5E7EB] overflow-x-auto">
                      {data?.runInfo?.normalizeCfg && Object.keys(data.runInfo.normalizeCfg).length > 0
                        ? JSON.stringify(data.runInfo.normalizeCfg, null, 2)
                        : "{}"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay при открытой панели */}
      {infoPanelOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-md z-40"
          onClick={() => setInfoPanelOpen(false)}
        />
      )}
    </div>
  );
}