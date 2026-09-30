import { useMemo, useState } from 'react';
import { useTheme } from '../ThemeProvider';
import type { ModelHeatmapBlock } from '../../utils/analyticsHelpers';

interface CompareModelErrorHeatmapProps {
  blocks: ModelHeatmapBlock[];
}

const ERROR_CATEGORIES = [
  { key: 'insertions' as const, label: 'Вставки' },
  { key: 'deletions' as const, label: 'Удаления' },
  { key: 'substitutions' as const, label: 'Замены' },
];

const DURATION_COLUMNS = [
  { key: 'short' as const, label: 'Короткие' },
  { key: 'normal' as const, label: 'Средние' },
  { key: 'long' as const, label: 'Длинные' },
];

export function CompareModelErrorHeatmap({ blocks }: CompareModelErrorHeatmapProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(
    null,
  );

  const { minValue, maxValue } = useMemo(() => {
    const values = blocks.flatMap((block) =>
      block.rows.flatMap((row) =>
        ERROR_CATEGORIES.map((category) => row[category.key]),
      ),
    );
    if (values.length === 0) return { minValue: 0, maxValue: 1 };
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [blocks]);

  const getCellColor = (value: number) => {
    if (value === 0) {
      return isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)';
    }

    const normalized = maxValue === minValue ? 1 : (value - minValue) / (maxValue - minValue);

    if (normalized < 0.33) {
      const opacity = 0.2 + normalized * 0.6;
      return isDark
        ? `rgba(16, 185, 129, ${opacity})`
        : `rgba(16, 185, 129, ${opacity * 0.8})`;
    }
    if (normalized < 0.66) {
      const opacity = 0.3 + (normalized - 0.33) * 0.7;
      return isDark
        ? `rgba(245, 158, 11, ${opacity})`
        : `rgba(245, 158, 11, ${opacity * 0.8})`;
    }
    const opacity = 0.4 + (normalized - 0.66) * 0.6;
    return isDark
      ? `rgba(239, 68, 68, ${opacity})`
      : `rgba(239, 68, 68, ${opacity * 0.8})`;
  };

  const getTextColor = (value: number) => {
    const normalized = maxValue === minValue ? 0 : (value - minValue) / (maxValue - minValue);
    if (isDark) return normalized > 0.5 ? '#FFFFFF' : '#E5E7EB';
    return normalized > 0.5 ? '#1F2937' : '#374151';
  };

  const getRowByDuration = (block: ModelHeatmapBlock, durationKey: typeof DURATION_COLUMNS[number]['key']) =>
    block.rows.find((row) => row.durationKey === durationKey);

  if (blocks.length === 0) {
    return (
      <p className="reson-compare-heatmap-empty">
        Нет данных для построения тепловой карты
      </p>
    );
  }

  return (
    <div className="reson-compare-heatmap-wrap">
      <div className="reson-compare-heatmap-table-wrap reson-heatmap-desktop">
        <div className="reson-compare-heatmap-table">
          <div className="reson-compare-heatmap-head-row">
            <div className="reson-compare-heatmap-row-label" />
            {ERROR_CATEGORIES.map((category, idx) => (
              <div
                key={category.key}
                className={`reson-compare-heatmap-category-head ${idx < ERROR_CATEGORIES.length - 1 ? 'reson-compare-heatmap-category-head--gap' : ''}`}
              >
                <span className="reson-compare-heatmap-category-title">{category.label}</span>
              </div>
            ))}
          </div>

          <div className="reson-compare-heatmap-subhead-row">
            <div className="reson-compare-heatmap-row-label" />
            {ERROR_CATEGORIES.map((category, idx) => (
              <div
                key={category.key}
                className={`reson-compare-heatmap-subhead-group ${idx < ERROR_CATEGORIES.length - 1 ? 'reson-compare-heatmap-category-head--gap' : ''}`}
              >
                {DURATION_COLUMNS.map((duration) => (
                  <div key={duration.key} className="reson-compare-heatmap-subhead">
                    {duration.label}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {blocks.map((block, rowIndex) => (
            <div key={block.modelName} className="reson-compare-heatmap-data-row">
              <div className="reson-compare-heatmap-row-label reson-compare-heatmap-model-label">
                <span
                  className="reson-compare-heatmap-model-dot"
                  style={{ backgroundColor: block.color }}
                />
                <span>{block.displayName}</span>
              </div>

              {ERROR_CATEGORIES.map((category, catIndex) => (
                <div
                  key={category.key}
                  className={`reson-compare-heatmap-cell-group ${catIndex < ERROR_CATEGORIES.length - 1 ? 'reson-compare-heatmap-category-head--gap' : ''}`}
                >
                  {DURATION_COLUMNS.map((duration, subIndex) => {
                    const row = getRowByDuration(block, duration.key);
                    const value = row?.[category.key] ?? 0;
                    const colIndex = catIndex * DURATION_COLUMNS.length + subIndex;
                    const isHovered =
                      hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;

                    return (
                      <div
                        key={`${block.modelName}-${category.key}-${duration.key}`}
                        className={`reson-compare-heatmap-cell-tile ${isHovered ? 'reson-compare-heatmap-cell-tile--hover' : ''}`}
                        style={{
                          backgroundColor: getCellColor(value),
                          color: getTextColor(value),
                        }}
                        onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`${block.displayName} · ${category.label} · ${duration.label}: ${value}`}
                      >
                        {value > 0 ? value.toLocaleString() : '0'}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="reson-heatmap-mobile">
        {ERROR_CATEGORIES.map((category, catIndex) => (
          <div key={category.key} className="reson-heatmap-mobile-category">
            <h4 className={`reson-heatmap-mobile-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {category.label}
            </h4>
            <div className="reson-heatmap-mobile-subheads">
              <span />
              {DURATION_COLUMNS.map((duration) => (
                <span
                  key={duration.key}
                  className={isDark ? 'text-gray-400' : 'text-gray-600'}
                >
                  {duration.label}
                </span>
              ))}
            </div>
            {blocks.map((block, rowIndex) => (
              <div key={block.modelName} className="reson-heatmap-mobile-row">
                <span className="reson-heatmap-mobile-row-label reson-compare-heatmap-model-label">
                  <span
                    className="reson-compare-heatmap-model-dot"
                    style={{ backgroundColor: block.color }}
                  />
                  <span>{block.displayName}</span>
                </span>
                {DURATION_COLUMNS.map((duration, subIndex) => {
                  const row = getRowByDuration(block, duration.key);
                  const value = row?.[category.key] ?? 0;
                  const colIndex = catIndex * DURATION_COLUMNS.length + subIndex;
                  const isHovered =
                    hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;
                  return (
                    <div
                      key={`${block.modelName}-${category.key}-${duration.key}`}
                      className={`reson-compare-heatmap-cell-tile ${isHovered ? 'reson-compare-heatmap-cell-tile--hover' : ''}`}
                      style={{
                        backgroundColor: getCellColor(value),
                        color: getTextColor(value),
                      }}
                      onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={`${block.displayName} · ${category.label} · ${duration.label}: ${value}`}
                    >
                      {value > 0 ? value.toLocaleString() : '0'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="reson-compare-heatmap-legend">
        <span className="reson-compare-heatmap-legend-item">
          <span className="reson-compare-heatmap-legend-swatch reson-compare-heatmap-legend-swatch--low" />
          Мало ошибок
        </span>
        <span className="reson-compare-heatmap-legend-item">
          <span className="reson-compare-heatmap-legend-swatch reson-compare-heatmap-legend-swatch--mid" />
          Средне
        </span>
        <span className="reson-compare-heatmap-legend-item">
          <span className="reson-compare-heatmap-legend-swatch reson-compare-heatmap-legend-swatch--high" />
          Много ошибок
        </span>
      </div>
    </div>
  );
}
