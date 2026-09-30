import { X, Plus, X as DeleteIcon, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';

interface ErrorDetailsModalProps {
  type: 'insertions' | 'deletions' | 'substitutions';
  onClose: () => void;
}

export function ErrorDetailsModal({ type, onClose }: ErrorDetailsModalProps) {
  const { theme } = useTheme();
  const { data: reportData } = useData();

  const config = {
    insertions: {
      title: 'Топ-10 Вставок',
      icon: Plus,
      iconColor: 'text-[#4CAF50]',
      iconBg: 'bg-[#4CAF50]/10',
      borderColor: theme === 'dark' ? 'border-[#2A3D2F]' : 'border-green-200',
    },
    deletions: {
      title: 'Топ-10 Удалений',
      icon: DeleteIcon,
      iconColor: 'text-[#F44336]',
      iconBg: 'bg-[#F44336]/10',
      borderColor: theme === 'dark' ? 'border-[#3D2A2A]' : 'border-red-200',
    },
    substitutions: {
      title: 'Топ-10 Замен',
      icon: RefreshCw,
      iconColor: 'text-[#FFB300]',
      iconBg: 'bg-[#FFB300]/10',
      borderColor: theme === 'dark' ? 'border-[#3D3A2A]' : 'border-yellow-200',
    },
  };

  const { title, icon: Icon, iconColor, iconBg, borderColor } = config[type];
  const data = (reportData?.topErrorWords?.[type] ?? []).slice(0, 10);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 rounded-2xl border shadow-2xl ${
          theme === 'dark'
            ? 'bg-[#1A1D24] border-[#2A2D35]'
            : 'bg-white border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-[#2A2D35]' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`${iconBg} p-2 rounded-lg`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <h2 className={`text-xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-[#2A2D35] text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {data.length === 0 ? (
            <p className={`text-sm text-center py-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Нет данных по выбранному типу ошибок в отчёте.
            </p>
          ) : (
            <div className="space-y-2">
              {data.map((item, index) => (
                <div
                  key={`${item.word}-${index}`}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-[#23262F] border-[#2A2D35]'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        index < 3
                          ? theme === 'dark'
                            ? 'bg-[#FFB300]/20 text-[#FFB300]'
                            : 'bg-yellow-100 text-yellow-700'
                          : theme === 'dark'
                          ? 'bg-[#2A2D35] text-gray-400'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {item.word}
                    </span>
                  </div>
                  <span className={iconColor}>
                    {Number(item.count).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {data.length > 0 && (
          <div className={`px-6 py-4 border-t ${
            theme === 'dark' ? 'border-[#2A2D35]' : 'border-gray-200'
          }`}>
            <p className={`text-sm text-center ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Общее количество:{' '}
              <span className={iconColor}>
                {data.reduce((sum, item) => sum + Number(item.count), 0).toLocaleString()}
              </span>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
