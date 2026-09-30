import { useState, useMemo } from 'react';
import { AlertTriangle, Info, FileText, BookOpen, BarChart3, ExternalLink, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useNavigationOptional } from '../contexts/NavigationContext';
import type { DataQualityAlert } from '../types/data';

type FilterType = 'all' | 'errors' | 'warnings' | 'info';
type SourceType = 'all' | 'manifest' | 'dictionary' | 'metrics';

const sourceToTab = {
  manifest: 'manifest' as const,
  dictionary: 'vocabulary' as const,
  metrics: 'analytics' as const,
};

interface DataQualityAlertsProps {
  showFloatingButton?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DataQualityAlerts({
  showFloatingButton = true,
  open: controlledOpen,
  onOpenChange,
}: DataQualityAlertsProps = {}) {
  const { theme } = useTheme();
  const { data } = useData();
  const { navigateToTab } = useNavigationOptional();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange(next);
    } else {
      setInternalOpen(next);
    }
  };
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType>('all');

  const handleGoTo = (source: 'manifest' | 'dictionary' | 'metrics') => {
    const tab = sourceToTab[source];
    if (tab) {
      navigateToTab(tab);
      setIsOpen(false);
    }
  };

  const alerts: DataQualityAlert[] = useMemo(
    () => (data?.alerts ?? []).filter(
      (a): a is DataQualityAlert => Boolean(a?.id && a?.type && a?.source && a?.title)
    ),
    [data?.alerts]
  );

  const errorCount = alerts.filter(a => a.type === 'error').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;
  const infoCount = alerts.filter(a => a.type === 'info').length;
  const totalCount = errorCount + warningCount + infoCount;

  const filteredAlerts = alerts.filter(alert => {
    if (filterType !== 'all') {
      if (filterType === 'errors' && alert.type !== 'error') return false;
      if (filterType === 'warnings' && alert.type !== 'warning') return false;
      if (filterType === 'info' && alert.type !== 'info') return false;
    }
    if (sourceFilter !== 'all' && alert.source !== sourceFilter) return false;
    return true;
  });

  return (
    <>
      {showFloatingButton && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`fixed top-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all hover:shadow-xl z-30 ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-[#FFB300] to-[#FB8C00] text-white'
              : 'bg-gradient-to-r from-[#FFB300] to-[#FB8C00] text-white'
          }`}
        >
          <div className="relative">
            <AlertTriangle className="w-5 h-5" />
            {totalCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs">
                {totalCount}
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium">Алерты качества</div>
            <div className="text-xs opacity-90">{totalCount} проблем</div>
          </div>
        </button>
      )}

      {/* Slide-out Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className={`reson-side-panel reson-alerts-panel fixed top-0 right-0 h-full w-[600px] z-50 shadow-2xl overflow-hidden ${
            theme === 'dark' ? 'bg-[#1A1D24]' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`reson-alerts-header p-6 border-b ${
              theme === 'dark' ? 'border-[#2A2D35]' : 'border-gray-200'
            }`}>
              <div className="reson-alerts-header-top flex items-center justify-between mb-4">
                <div className="reson-alerts-header-title flex items-center gap-3 min-w-0">
                  <div className="bg-gradient-to-br from-[#FFB300] to-[#FB8C00] p-2.5 rounded-xl shrink-0">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className={`text-xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Алерты качества данных
                    </h2>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      Обнаружено {totalCount} проблем
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className={`p-2 rounded-lg transition-colors shrink-0 ${
                    theme === 'dark' ? 'hover:bg-[#2A2D35]' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                </button>
              </div>

              {/* Summary Badges */}
              <div className="reson-alerts-summary flex gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  theme === 'dark' ? 'bg-red-500/10' : 'bg-red-100'
                }`}>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className={`text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>
                    {errorCount} ошибок
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#FFF9E6] px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-[#FFB300]" />
                  <span className="text-sm text-[#F57F17]">{warningCount} предупреждений</span>
                </div>
                <div className="flex items-center gap-2 bg-[#E3F2FD] px-3 py-2 rounded-lg">
                  <Info className="w-4 h-4 text-[#2196F3]" />
                  <span className="text-sm text-[#1565C0]">{infoCount} информационных</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className={`reson-alerts-filters p-6 border-b ${
              theme === 'dark' ? 'border-[#2A2D35] bg-[#16181E]' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="mb-4">
                <label className={`text-xs mb-2 block ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Тип алерта
                </label>
                <div className="reson-alerts-filter-row flex gap-2">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      filterType === 'all'
                        ? theme === 'dark'
                          ? 'bg-white text-black'
                          : 'bg-black text-white'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-gray-300 border border-[#2A2D35] hover:bg-[#23262F]'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Все ({totalCount})
                  </button>
                  <button
                    onClick={() => setFilterType('errors')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors border ${
                      filterType === 'errors'
                        ? theme === 'dark'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : 'bg-red-100 text-red-700 border-red-200'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-red-400 border-red-500/30 hover:bg-[#23262F]'
                          : 'bg-white text-red-600 border-red-200 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    Ошибки ({errorCount})
                  </button>
                  <button
                    onClick={() => setFilterType('warnings')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      filterType === 'warnings'
                        ? 'bg-[#FFF9E6] text-[#F57F17] border border-[#FFB300]'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-gray-300 border border-[#2A2D35] hover:bg-[#23262F]'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Предупреждения ({warningCount})
                  </button>
                  <button
                    onClick={() => setFilterType('info')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      filterType === 'info'
                        ? 'bg-[#E3F2FD] text-[#1565C0] border border-[#2196F3]'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-gray-300 border border-[#2A2D35] hover:bg-[#23262F]'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    Информация ({infoCount})
                  </button>
                </div>
              </div>

              <div>
                <label className={`text-xs mb-2 block ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Источник
                </label>
                <div className="reson-alerts-filter-row flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSourceFilter('all')}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      sourceFilter === 'all'
                        ? theme === 'dark'
                          ? 'bg-white text-black'
                          : 'bg-black text-white'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-gray-300 border border-[#2A2D35] hover:bg-[#23262F]'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Все источники
                  </button>
                  <button
                    onClick={() => setSourceFilter('manifest')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      sourceFilter === 'manifest'
                        ? 'bg-gray-200 text-gray-900'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-gray-300 border border-[#2A2D35] hover:bg-[#23262F]'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Манифест
                  </button>
                  <button
                    onClick={() => setSourceFilter('dictionary')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      sourceFilter === 'dictionary'
                        ? 'bg-gray-200 text-gray-900'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-gray-300 border border-[#2A2D35] hover:bg-[#23262F]'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Словарь
                  </button>
                  <button
                    onClick={() => setSourceFilter('metrics')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      sourceFilter === 'metrics'
                        ? 'bg-gray-200 text-gray-900'
                        : theme === 'dark'
                          ? 'bg-[#1A1D24] text-gray-300 border border-[#2A2D35] hover:bg-[#23262F]'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Метрики
                  </button>
                </div>
              </div>
            </div>

            {/* Alerts List */}
            <div className="reson-alerts-list overflow-y-auto">
              <div className={`divide-y ${theme === 'dark' ? 'divide-[#2A2D35]' : 'divide-gray-200'}`}>
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className={`p-5 hover:bg-opacity-50 transition-colors ${
                    theme === 'dark' ? 'hover:bg-[#23262F]' : 'hover:bg-gray-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        alert.type === 'error'
                          ? theme === 'dark' ? 'bg-red-500/10' : 'bg-red-100'
                          : alert.type === 'warning'
                            ? 'bg-[#FFF9E6]'
                            : 'bg-[#E3F2FD]'
                      }`}>
                        {alert.type === 'error' ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : alert.type === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-[#FFB300]" />
                        ) : (
                          <Info className="w-4 h-4 text-[#2196F3]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {alert.source === 'manifest' ? 'Манифест' : alert.source === 'dictionary' ? 'Словарь' : 'Метрики'}
                          </span>
                          {alert.category && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              theme === 'dark' ? 'bg-[#2A2D35]' : 'bg-gray-100'
                            } ${alert.categoryColor}`}>
                              {alert.category}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm leading-snug mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {alert.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleGoTo(alert.source)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            theme === 'dark'
                              ? 'text-[#60A5FA] hover:text-[#3B82F6]'
                              : 'text-[#3B82F6] hover:text-[#2563EB]'
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {alert.source === 'manifest' ? 'Манифест' : alert.source === 'dictionary' ? 'Словарь' : 'Аналитика'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredAlerts.length === 0 && (
                <div className="p-12 text-center">
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    Нет алертов по выбранным фильтрам
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}