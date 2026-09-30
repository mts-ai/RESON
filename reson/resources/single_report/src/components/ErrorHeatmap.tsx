import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';
import { HeatmapRow } from '../types/data';

interface ErrorHeatmapProps {
  data: HeatmapRow[];
  /** Без внешней карточки и заголовка — только таблица */
  bare?: boolean;
}

export function ErrorHeatmap({ data, bare = false }: ErrorHeatmapProps) {
  const { theme } = useTheme();
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const safeData = Array.isArray(data) ? data : [];

  const allValues = safeData.flatMap((row) => [
    row.insertions.top10,
    row.insertions.p80_90,
    row.insertions.below80,
    row.deletions.top10,
    row.deletions.p80_90,
    row.deletions.below80,
    row.substitutions.top10,
    row.substitutions.p80_90,
    row.substitutions.below80,
  ]);
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;

  const getCellColor = (value: number) => {
    if (value === 0) {
      return theme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)';
    }

    const normalized = (value - minValue) / (maxValue - minValue);

    if (normalized < 0.33) {
      const opacity = 0.2 + normalized * 0.6;
      return theme === 'dark'
        ? `rgba(16, 185, 129, ${opacity})`
        : `rgba(16, 185, 129, ${opacity * 0.8})`;
    } else if (normalized < 0.66) {
      const opacity = 0.3 + (normalized - 0.33) * 0.7;
      return theme === 'dark'
        ? `rgba(245, 158, 11, ${opacity})`
        : `rgba(245, 158, 11, ${opacity * 0.8})`;
    } else {
      const opacity = 0.4 + (normalized - 0.66) * 0.6;
      return theme === 'dark'
        ? `rgba(239, 68, 68, ${opacity})`
        : `rgba(239, 68, 68, ${opacity * 0.8})`;
    }
  };

  const getTextColor = (value: number) => {
    const normalized = (value - minValue) / (maxValue - minValue);

    if (theme === 'dark') {
      return normalized > 0.5 ? '#FFFFFF' : '#E5E7EB';
    }
    return normalized > 0.5 ? '#1F2937' : '#374151';
  };

  const categories = [
    { label: 'Вставки', key: 'insertions' as const },
    { label: 'Удаления', key: 'deletions' as const },
    { label: 'Замены', key: 'substitutions' as const },
  ];

  const subCategories = [
    { label: 'Топ-10%', key: 'top10' as const },
    { label: '80-90%', key: 'p80_90' as const },
    { label: '<80%', key: 'below80' as const },
  ];

  const renderCell = (
    value: number,
    rowIndex: number,
    colIndex: number,
    compact = false,
  ) => {
    const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;
    return (
      <div
        className={`flex-1 rounded-lg flex items-center justify-center text-sm transition-all duration-200 border ${
          compact ? 'h-14' : 'h-20'
        } ${
          isHovered
            ? theme === 'dark'
              ? 'border-white/30 scale-105 shadow-lg'
              : 'border-gray-400 scale-105 shadow-lg'
            : theme === 'dark'
              ? 'border-[#2A2D35]'
              : 'border-gray-200'
        }`}
        style={{
          backgroundColor: getCellColor(value),
          color: getTextColor(value),
        }}
        onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
        onMouseLeave={() => setHoveredCell(null)}
      >
        {value}
      </div>
    );
  };

  const table = (
      <div className={`${bare ? '' : 'flex justify-center'}`}>
        <div className="reson-error-heatmap min-w-[600px] max-w-[850px] reson-heatmap-desktop overflow-x-auto">
          <div className="flex mb-2">
            <div className="w-[100px]" />
            {categories.map((category, idx) => (
              <div
                key={category.key}
                className={`flex-1 text-center ${idx < categories.length - 1 ? 'mr-3' : ''}`}
              >
                <h4
                  className={`text-sm mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {category.label}
                </h4>
              </div>
            ))}
          </div>

          <div className="flex mb-3">
            <div className="w-[100px]" />
            {categories.map((_, idx) => (
              <div
                key={idx}
                className={`flex-1 flex ${idx < categories.length - 1 ? 'mr-3' : ''}`}
              >
                {subCategories.map((sub) => (
                  <div
                    key={sub.key}
                    className={`flex-1 text-center text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {sub.label}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {safeData.map((row, rowIndex) => (
            <div key={row.duration} className="flex mb-2">
              <div
                className={`w-[100px] flex items-center text-sm pr-4 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {row.duration}
              </div>

              {categories.map((category, catIndex) => (
                <div
                  key={category.key}
                  className={`flex-1 flex gap-1 ${catIndex < categories.length - 1 ? 'mr-3' : ''}`}
                >
                  {subCategories.map((sub, subIndex) => {
                    const value = row[category.key][sub.key];
                    const colIndex = catIndex * 3 + subIndex;
                    return (
                      <div key={sub.key} className="flex-1">
                        {renderCell(value, rowIndex, colIndex)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="reson-heatmap-mobile">
          {categories.map((category, catIndex) => (
            <div key={category.key} className="reson-heatmap-mobile-category">
              <h4
                className={`reson-heatmap-mobile-title ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {category.label}
              </h4>
              <div className="reson-heatmap-mobile-subheads">
                <span />
                {subCategories.map((sub) => (
                  <span
                    key={sub.key}
                    className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
                  >
                    {sub.label}
                  </span>
                ))}
              </div>
              {safeData.map((row, rowIndex) => (
                <div key={row.duration} className="reson-heatmap-mobile-row">
                  <span
                    className={`reson-heatmap-mobile-row-label ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {row.duration}
                  </span>
                  {subCategories.map((sub, subIndex) => (
                    <div key={sub.key}>
                      {renderCell(
                        row[category.key][sub.key],
                        rowIndex,
                        catIndex * 3 + subIndex,
                        true,
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
  );

  if (bare) {
    return table;
  }

  return (
    <div
      className={`rounded-xl p-6 border ${
        theme === 'dark'
          ? 'bg-[#1A1D24] border-[#2A2D35]'
          : 'bg-white border-gray-200 shadow-sm'
      }`}
    >
      <p
        className={`text-sm text-center mb-6 max-w-3xl mx-auto ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}
      >
        Распределение типов ошибок по длительности аудио и различным перцентилям WER по всему датасету
      </p>
      {table}
    </div>
  );
}
