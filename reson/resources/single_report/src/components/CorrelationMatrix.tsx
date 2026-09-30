import { useMemo } from 'react';

interface CorrelationMatrixProps {
  sliceData: any;
  theme: string;
  compact?: boolean;
}

export function CorrelationMatrix({ sliceData, theme, compact = false }: CorrelationMatrixProps) {
  // Вычисляем корреляции на основе данных среза
  const { heatmapData, stats } = useMemo(() => {
    // Извлекаем данные из correlationData среза
    const data = sliceData.correlationData || [];
    
    if (data.length === 0) {
      return { heatmapData: [], stats: { min: 0, max: 1, avg: 0 } };
    }

    // Функция для вычисления корреляции Пирсона
    const calculateCorrelation = (x: number[], y: number[]) => {
      const n = x.length;
      if (n === 0) return 0;
      
      const meanX = x.reduce((a, b) => a + b, 0) / n;
      const meanY = y.reduce((a, b) => a + b, 0) / n;
      
      let numerator = 0;
      let denominatorX = 0;
      let denominatorY = 0;
      
      for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        numerator += dx * dy;
        denominatorX += dx * dx;
        denominatorY += dy * dy;
      }
      
      const denominator = Math.sqrt(denominatorX * denominatorY);
      if (denominator === 0) return 0;
      
      return numerator / denominator;
    };

    // Извлекаем массивы данных
    const duration = data.map((d: any) => d.duration);
    const wer = data.map((d: any) => d.wer);
    const errors = data.map((d: any) => d.errors);
    
    // Вычисляем приблизительные значения для каждого типа ошибок
    const totalErrors = sliceData.insertions + sliceData.deletions + sliceData.substitutions;
    const insertionRatio = totalErrors > 0 ? sliceData.insertions / totalErrors : 0;
    const deletionRatio = totalErrors > 0 ? sliceData.deletions / totalErrors : 0;
    const substitutionRatio = totalErrors > 0 ? sliceData.substitutions / totalErrors : 0;
    
    const insertions = errors.map((e: number) => Math.round(e * insertionRatio));
    const deletions = errors.map((e: number) => Math.round(e * deletionRatio));
    const substitutions = errors.map((e: number) => Math.round(e * substitutionRatio));

    // Метрики
    const metrics = [
      { key: 'WER', label: 'WER', values: wer },
      { key: 'Dur', label: 'Dur', values: duration },
      { key: 'INS', label: 'INS', values: insertions },
      { key: 'DEL', label: 'DEL', values: deletions },
      { key: 'SUB', label: 'SUB', values: substitutions },
    ];

    // Вычисляем матрицу корреляций
    const matrix: { x: string; y: string; xLabel: string; yLabel: string; value: number; xIndex: number; yIndex: number }[] = [];
    const corrValues: number[] = [];
    
    for (let i = 0; i < metrics.length; i++) {
      for (let j = 0; j < metrics.length; j++) {
        const correlation = calculateCorrelation(metrics[i].values, metrics[j].values);
        matrix.push({
          x: metrics[j].key,
          y: metrics[i].key,
          xLabel: metrics[j].label,
          yLabel: metrics[i].label,
          value: correlation,
          xIndex: j,
          yIndex: i,
        });
        if (i !== j) { // Исключаем диагональ для статистики
          corrValues.push(Math.abs(correlation));
        }
      }
    }

    const minCorr = corrValues.length > 0 ? Math.min(...corrValues) : 0;
    const maxCorr = corrValues.length > 0 ? Math.max(...corrValues) : 1;
    const avgCorr = corrValues.length > 0 ? corrValues.reduce((a, b) => a + b, 0) / corrValues.length : 0;

    return { 
      heatmapData: matrix,
      stats: { min: minCorr, max: maxCorr, avg: avgCorr }
    };
  }, [sliceData]);

  // Интерполяция цвета для тепловой карты
  const getHeatmapColor = (value: number) => {
    // Нормализуем значение от -1 до 1 в диапазон 0 до 1
    const normalized = (value + 1) / 2;
    
    if (theme === 'dark') {
      // Темная тема: красный (-1) -> серый (0) -> зеленый (1)
      if (normalized < 0.5) {
        // От красного к серому
        const t = normalized * 2;
        return interpolateColor('#DC2626', '#4B5563', t);
      } else {
        // От серого к зеленому
        const t = (normalized - 0.5) * 2;
        return interpolateColor('#4B5563', '#10B981', t);
      }
    } else {
      // Светлая тема: красный (-1) -> белый (0) -> синий (1)
      if (normalized < 0.5) {
        // От красного к белому
        const t = normalized * 2;
        return interpolateColor('#DC2626', '#F3F4F6', t);
      } else {
        // От белого к синему
        const t = (normalized - 0.5) * 2;
        return interpolateColor('#F3F4F6', '#3B82F6', t);
      }
    }
  };

  // Вспомогательная функция для интерполяции цветов
  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    
    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;
    
    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const metrics = [
    { key: 'WER', ru: 'WER' },
    { key: 'Dur', ru: 'Длительность' },
    { key: 'INS', ru: 'Вставки' },
    { key: 'DEL', ru: 'Удаления' },
    { key: 'SUB', ru: 'Замены' },
  ];
  const cellSize = compact ? 48 : 80;
  const rowLabelWidth = compact ? 40 : 100;

  return (
    <div className="overflow-x-auto shrink-0">
      <div style={{ minWidth: `${rowLabelWidth + metrics.length * cellSize + metrics.length * 6}px` }}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `${rowLabelWidth}px repeat(${metrics.length}, ${cellSize}px)` }}>
          {/* Заголовок пустой ячейки */}
          <div></div>
          
          {/* Заголовки столбцов */}
          {metrics.map((metric) => (
            <div
              key={`col-${metric.key}`}
              className={`text-[10px] font-medium text-center py-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}
              title={metric.ru}
            >
              {metric.key}
            </div>
          ))}

          {/* Строки матрицы */}
          {metrics.map((rowMetric, i) => (
            <div key={`row-${rowMetric.key}`} className="contents">
              {/* Заголовок строки */}
              <div
                className={`text-[10px] font-medium py-2 pr-1 text-right flex items-center justify-end ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}
                title={rowMetric.ru}
              >
                {rowMetric.key}
              </div>
              
              {/* Ячейки корреляций */}
              {metrics.map((colMetric, j) => {
                const cell = heatmapData.find(
                  (d) => d.x === colMetric.key && d.y === rowMetric.key
                );
                const value = cell ? cell.value : 0;
                const isDiagonal = i === j;
                
                return (
                  <div
                    key={`${rowMetric.key}-${colMetric.key}`}
                    className={`relative rounded-lg flex items-center justify-center transition-all ${
                      !isDiagonal ? 'hover:scale-110 hover:z-10 cursor-pointer hover:shadow-lg' : ''
                    } ${
                      theme === 'dark' ? 'border border-[#2A2D35]' : 'border border-gray-300'
                    }`}
                    style={{
                      backgroundColor: isDiagonal 
                        ? (theme === 'dark' ? '#2A2D35' : '#E5E7EB')
                        : getHeatmapColor(value),
                      height: `${cellSize}px`,
                    }}
                    title={`${rowMetric.ru} ↔ ${colMetric.ru}: ${value.toFixed(3)}`}
                  >
                    <div className={`${compact ? 'text-xs' : 'text-sm'} text-center ${
                      isDiagonal 
                        ? (theme === 'dark' ? 'text-gray-500' : 'text-gray-400')
                        : (Math.abs(value) < 0.3 
                            ? (theme === 'dark' ? 'text-gray-300' : 'text-gray-700')
                            : 'text-white font-medium')
                    } drop-shadow-md`}>
                      {isDiagonal ? '1.00' : value.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
