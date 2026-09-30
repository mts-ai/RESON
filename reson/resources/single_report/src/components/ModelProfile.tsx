import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, X, RefreshCw, ChevronRight, ChevronDown } from "lucide-react";

interface ModelProfileProps {
  data?: {
    werAcc?: number;        // 100% - WER
    short?: number | null;  // 100% - Avg WER на коротких (1-5 сек)
    long?: number | null;   // 100% - Avg WER на длинных (30+ сек)
    robust?: number;        // Процент файлов с WER <= 15%
    insert?: number;        // 100 - (INS/ERRORS)*100
    delet?: number;         // 100 - (DEL/ERRORS)*100
    subst?: number;         // 100 - (SUB/ERRORS)*100
    insertionsCount?: number;  // Количество вставок
    deletionsCount?: number;   // Количество удалений
    substitutionsCount?: number; // Количество замен
  };
  onErrorTypeClick?: (type: 'insertions' | 'deletions' | 'substitutions') => void;
}

export function ModelProfile({ data, onErrorTypeClick }: ModelProfileProps) {
  const { theme } = useTheme();
  const [radarExpanded, setRadarExpanded] = useState(false);

  // Значения по умолчанию для демонстрации
  const defaultData = {
    werAcc: 79.2,     // 100% - 20.8% WER
    short: 85.5,      // Хорошее качество на коротких записях
    long: 72.3,       // Среднее качество на длинных
    robust: 45.2,     // 45.2% файлов с WER ≤ 15%
    insert: 83.8,     // 100 - 16.2% вставок
    delet: 65.9,      // 100 - 34.1% удалений
    subst: 50.3,      // 100 - 49.7% замен
  };

  const profileData = data || defaultData;

  // Описания осей
  const axisDescriptions: Record<string, string> = {
    "WER Acc": "Общая точность распознавания (100% - WER)",
    "Short": "Качество на коротких записях (1-5 сек)",
    "Long": "Качество на длинных записях (30+ сек)",
    "Robust": "Процент файлов с WER ≤ 15%",
    "Insert.": "Устойчивость к вставкам (100 - INS%)",
    "Delet.": "Устойчивость к удалениям (100 - DEL%)",
    "Subst.": "Устойчивость к заменам (100 - SUB%)",
  };

  // Формируем данные для радара (исключаем null значения)
  const radarData = [
    { 
      axis: "WER Acc", 
      value: profileData.werAcc || 0,
      fullMark: 100 
    },
    ...(profileData.short !== null && profileData.short !== undefined ? [{
      axis: "Short",
      value: profileData.short,
      fullMark: 100
    }] : []),
    ...(profileData.long !== null && profileData.long !== undefined ? [{
      axis: "Long",
      value: profileData.long,
      fullMark: 100
    }] : []),
    {
      axis: "Robust",
      value: profileData.robust || 0,
      fullMark: 100
    },
    {
      axis: "Insert.",
      value: profileData.insert || 0,
      fullMark: 100
    },
    {
      axis: "Delet.",
      value: profileData.delet || 0,
      fullMark: 100
    },
    {
      axis: "Subst.",
      value: profileData.subst || 0,
      fullMark: 100
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div
          className={`px-3 py-2 rounded-lg shadow-lg border ${
            theme === "dark"
              ? "bg-[#1A1D24] border-[#2A2D35]"
              : "bg-white border-gray-200"
          }`}
        >
          <p
            className={`text-xs mb-1 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {data.payload.axis}
          </p>
          <p
            className={`text-sm ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            {data.value.toFixed(1)}%
          </p>
          <p
            className={`text-xs mt-1 ${
              theme === "dark" ? "text-gray-500" : "text-gray-500"
            }`}
          >
            {axisDescriptions[data.payload.axis]}
          </p>
        </div>
      );
    }
    return null;
  };

  // Компактные карточки для профиля
  const CompactErrorCard = ({ 
    type, 
    percentage, 
    label, 
    count,
    onClick 
  }: { 
    type: 'insertions' | 'deletions' | 'substitutions';
    percentage: string;
    label: string;
    count: string;
    onClick?: () => void;
  }) => {
    const config = {
      insertions: {
        accent: 'border-l-[#4CAF50]',
        iconColor: 'text-[#4CAF50]',
        textColor: 'text-[#4CAF50]',
        icon: Plus,
        title: 'Вставки',
      },
      deletions: {
        accent: 'border-l-[#F44336]',
        iconColor: 'text-[#F44336]',
        textColor: 'text-[#F44336]',
        icon: X,
        title: 'Удаления',
      },
      substitutions: {
        accent: 'border-l-[#FFB300]',
        iconColor: 'text-[#FFB300]',
        textColor: 'text-[#FFB300]',
        icon: RefreshCw,
        title: 'Замены',
      },
    };

    const { accent, iconColor, textColor, icon: Icon, title } = config[type];

    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-lg p-3 border border-l-2 w-full text-left transition-colors cursor-pointer ${
          accent
        } ${
          theme === 'dark'
            ? 'bg-[#23262F] border-[#2A2D35] hover:bg-[#2A2D35]'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Icon className={`w-4 h-4 ${iconColor}`} />
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              {title}
            </span>
          </div>
          <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
        </div>
        <div className={`text-xl font-semibold ${textColor}`}>{percentage}</div>
        <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
          {label} · {count}
        </div>
      </button>
    );
  };

  return (
    <div
      className={`rounded-xl p-5 border ${
        theme === "dark"
          ? "bg-[#1A1D24] border-[#2A2D35]"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      <h3
        className={`reson-overview-panel-title ${
          theme === "dark" ? "text-white" : "text-gray-900"
        }`}
      >
        Структура ошибок
      </h3>
      <p
        className={`reson-overview-panel-desc ${
          theme === "dark" ? "text-gray-500" : "text-gray-500"
        }`}
      >
        Декомпозиция WER по типам ошибок — нажмите на карточку для просмотра самых частотных ошибок выбранного типа
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <CompactErrorCard
          type="insertions"
          percentage={profileData.insert !== undefined ? `${(100 - profileData.insert).toFixed(1)}%` : "н/д"}
          label="лишних слов"
          count={profileData.insertionsCount !== undefined 
            ? `${profileData.insertionsCount.toLocaleString()} случаев`
            : "н/д"}
          onClick={() => onErrorTypeClick?.('insertions')}
        />
        <CompactErrorCard
          type="deletions"
          percentage={profileData.delet !== undefined ? `${(100 - profileData.delet).toFixed(1)}%` : "н/д"}
          label="пропущенных слов"
          count={profileData.deletionsCount !== undefined
            ? `${profileData.deletionsCount.toLocaleString()} случаев`
            : "н/д"}
          onClick={() => onErrorTypeClick?.('deletions')}
        />
        <CompactErrorCard
          type="substitutions"
          percentage={profileData.subst !== undefined ? `${(100 - profileData.subst).toFixed(1)}%` : "н/д"}
          label="замененных слов"
          count={profileData.substitutionsCount !== undefined
            ? `${profileData.substitutionsCount.toLocaleString()} случаев`
            : "н/д"}
          onClick={() => onErrorTypeClick?.('substitutions')}
        />
      </div>

      <button
        type="button"
        onClick={() => setRadarExpanded((prev) => !prev)}
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
          theme === "dark"
            ? "text-[#60A5FA] hover:text-[#93C5FD]"
            : "text-[#3B82F6] hover:text-[#2563EB]"
        }`}
      >
        {radarExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {radarExpanded ? "Скрыть радар-профиль" : "Показать радар-профиль модели"}
      </button>

      {radarExpanded && (
        <div className="mt-2 pt-3 border-t border-dashed border-gray-200 dark:border-[#2A2D35]">
          <p
            className={`text-xs mb-2 ${
              theme === "dark" ? "text-gray-500" : "text-gray-500"
            }`}
          >
            Сильные и слабые стороны модели на датасете
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid
                  stroke={theme === "dark" ? "#2A2D35" : "#E5E7EB"}
                  strokeWidth={1}
                />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{
                    fill: theme === "dark" ? "#9CA3AF" : "#6B7280",
                    fontSize: 13,
                  }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{
                    fill: theme === "dark" ? "#6B7280" : "#9CA3AF",
                    fontSize: 11,
                  }}
                  tickCount={6}
                />
                <Radar
                  name="Модель"
                  dataKey="value"
                  stroke={theme === "dark" ? "#3B82F6" : "#2563EB"}
                  fill={theme === "dark" ? "#3B82F6" : "#3B82F6"}
                  fillOpacity={theme === "dark" ? 0.25 : 0.2}
                  strokeWidth={2}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
