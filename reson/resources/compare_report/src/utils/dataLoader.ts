/**
 * Data Loader for RESON Reports
 * Загружает данные из window.RESON_DATA или использует mock данные для разработки
 */

interface ModelInfo {
  name: string;
  displayName: string;
}

interface VocabularyWord {
  word: string;
  frequency: number;
  type: 'russian' | 'english' | 'number' | 'other';
  modelMetrics: Record<string, {
    recall: number;
    precision: number;
    f1Score: number;
    wis: number;
    wisComponents?: {
      frequency?: { value: number; weight: number };
      errorSeverity?: { value: number; weight: number };
      errorCriticality?: { value: number; weight: number };
      substitutionVariability?: { value: number; weight: number };
      frequencyScore?: number;
      errorSeverity?: number;
      errorCriticality?: number;
      substitutionDiversity?: number;
    };
    insertions?: number;
    deletions?: number;
    substitutions?: number;
    substitutedBy?: Record<string, number>;
  }>;
}

interface AnalyticsSample {
  audio_filepath: string;
  duration: number;
  durationType: "short" | "normal" | "long";
  wer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
}

interface ManifestEntry {
  audio_filepath: string;
  duration: number;
  text: string;
  prediction: string;
  wer: number;
  cer: number;
  insertions: number;
  deletions: number;
  substitutions: number;
  diff_tokens?: Array<{ word: string; type: "equal" | "ins" | "del" | "sub_del" | "sub_ins" }>;
}

interface DatasetInfo {
  name: string;
  totalSamples: number;
  totalDuration: string;
  vocabSize: string;
  uniqueChars?: number;
  normalized: boolean;
  durationTypes: Record<string, number>;
  durationInfo: Record<string, number>;
}

interface ModelData {
  wer: number;
  mwa: number;
  decomposition: {
    insertions: number;
    deletions: number;
    substitutions: number;
    insertionsCount: number;
    deletionsCount: number;
    substitutionsCount: number;
  };
  optionalMetrics: {
    wer_h?: number;
    ler?: number;
    cer?: number;
  };
}

interface StatisticalSignificanceData {
  isSignificant: boolean;
  pValue: number;
  alpha: number;
  confidenceInterval: number;
  lowerBound: number;
  upperBound: number;
}

interface RESONData {
  datasetInfo: DatasetInfo;
  models: ModelInfo[];
  baselineIndex: number;
  defaultBaseModel?: string;
  defaultTargetModel?: string;
  werData: Record<string, any>;
  cerData: Record<string, number>;
  vocabularyData: VocabularyWord[];
  analyticsData: Record<string, { samples: AnalyticsSample[]; totalSamples: number }>;
  manifestData: Record<string, ManifestEntry[]>;
  overviewData?: Record<string, ModelData>;  // Данные overview с правильным MWA из бэкенда
  statisticalSignificanceData?: Record<string, StatisticalSignificanceData>;  // Данные статистической значимости
  normalizationDictionary?: {
    hasNormalizationDictionary: boolean;
    byModel: Record<string, {
      vocab: Array<{
        target: string;
        sources: Array<{
          word: string;
          count?: number;
          countText?: number;
          countPrediction?: number;
        }>;
      }>;
      stats?: {
        totalReplacements?: number;
        byField?: Record<string, number>;
      };
    }>;
  };
  settings: {
    language: string;
    defaultTheme: string;
  };
}

declare global {
  interface Window {
    RESON_DATA?: RESONData;
  }
}

/**
 * Проверяет наличие реальных данных
 */
export function hasRealData(): boolean {
  return typeof window !== 'undefined' && window.RESON_DATA !== undefined;
}

/**
 * Загружает информацию о моделях
 */
export function loadModels(): ModelInfo[] {
  if (hasRealData()) {
    console.log('✓ Loading models from RESON_DATA');
    return window.RESON_DATA!.models;
  }
  
  // Mock данные для разработки
  console.log('⚠️ Using mock models data');
  return [
    { name: 'baseline', displayName: 'Baseline v1.0' },
    { name: 'candidate_v1', displayName: 'Candidate v1.5' },
    { name: 'candidate_v2', displayName: 'Candidate v2.0' },
    { name: 'candidate_v3', displayName: 'Candidate v3.0' },
    { name: 'candidate_v4', displayName: 'Candidate v4.0' },
  ];
}

/**
 * Загружает информацию о датасете
 */
export function loadDatasetInfo(): DatasetInfo {
  if (hasRealData()) {
    console.log('✓ Loading dataset info from RESON_DATA');
    return window.RESON_DATA!.datasetInfo;
  }
  
  // Mock данные для разработки
  console.log('⚠️ Using mock dataset info');
  return {
    name: 'Development Dataset',
    totalSamples: 500,
    totalDuration: '10:43:17',
    vocabSize: '2443 words',
    uniqueChars: 45,
    normalized: true,
    durationTypes: {
      normal: 400,
      short: 80,
      long: 20
    },
    durationInfo: {
      mean: 7.98,
      std: 4.44,
      min: 1.07,
      '25%': 5.51,
      '50%': 6.95,
      '75%': 9.21,
      max: 61.02
    }
  };
}

/**
 * Загружает данные словаря
 */
export function loadVocabularyData(): VocabularyWord[] {
  if (hasRealData()) {
    console.log('✓ Loading vocabulary data from RESON_DATA');
    return window.RESON_DATA!.vocabularyData;
  }
  
  // Mock данные для разработки
  console.log('⚠️ Using mock vocabulary data');
  return generateMockVocabularyData(loadModels().map(m => m.name));
}

/**
 * Загружает данные аналитики
 */
export function loadAnalyticsData(): Record<string, { samples: AnalyticsSample[]; totalSamples: number }> {
  if (hasRealData()) {
    console.log('✓ Loading analytics data from RESON_DATA');
    return window.RESON_DATA!.analyticsData;
  }
  
  // Mock данные для разработки
  console.log('⚠️ Using mock analytics data');
  return generateMockAnalyticsData(loadModels().map(m => m.name));
}

/**
 * Загружает данные манифеста
 */
export function loadManifestData(): Record<string, ManifestEntry[]> {
  if (hasRealData()) {
    console.log('✓ Loading manifest data from RESON_DATA');
    return window.RESON_DATA!.manifestData;
  }
  
  // Mock данные для разработки
  console.log('⚠️ Using mock manifest data');
  return generateMockManifestData(loadModels().map(m => m.name));
}

/**
 * Загружает данные моделей для раздела Overview
 */
export function loadOverviewModelData(): Record<string, ModelData> {
  if (hasRealData()) {
    console.log('✓ Loading overview model data from RESON_DATA');
    const data = window.RESON_DATA!;
    
    // Если есть overviewData из бэкенда, используем его (MWA уже правильно вычислен)
    if (data.overviewData) {
      const overviewData = data.overviewData;
      const result: Record<string, ModelData> = {};
      
      data.models.forEach(model => {
        const overview = overviewData[model.name];
        if (overview) {
          result[model.name] = {
            wer: overview.wer || 0,
            mwa: overview.mwa || 0,  // MWA из бэкенда (средний recall из vocab.mean_recall)
            decomposition: overview.decomposition || {
              insertions: 0,
              deletions: 0,
              substitutions: 0,
              insertionsCount: 0,
              deletionsCount: 0,
              substitutionsCount: 0,
            },
            optionalMetrics: overview.optionalMetrics || {},
          };
        }
      });
      
      return result;
    }
    
    // Fallback: вычисляем из werData и vocabularyData
    const result: Record<string, ModelData> = {};
    
    data.models.forEach(model => {
      const werData = data.werData[model.name];
      if (!werData) return;
      
      const totalErrors = werData.ins + werData.del + werData.sub;
      const insertionsPercent = totalErrors > 0 ? (werData.ins / totalErrors) * 100 : 0;
      const deletionsPercent = totalErrors > 0 ? (werData.del / totalErrors) * 100 : 0;
      const substitutionsPercent = totalErrors > 0 ? (werData.sub / totalErrors) * 100 : 0;
      
      // MWA = средний recall по всем словам из словаря
      let mwa = 0;
      if (data.vocabularyData && data.vocabularyData.length > 0) {
        const recalls: number[] = [];
        data.vocabularyData.forEach(word => {
          const modelMetrics = word.modelMetrics[model.name];
          if (modelMetrics && typeof modelMetrics.recall === 'number') {
            recalls.push(modelMetrics.recall);
          }
        });
        if (recalls.length > 0) {
          mwa = recalls.reduce((sum, r) => sum + r, 0) / recalls.length;
        }
      }
      // Fallback: если нет данных словаря, используем упрощенный расчет
      if (mwa === 0) {
        mwa = Math.max(0, 100 - werData.value);
      }
      
      result[model.name] = {
        wer: werData.value,
        mwa: mwa,
        decomposition: {
          insertions: insertionsPercent,
          deletions: deletionsPercent,
          substitutions: substitutionsPercent,
          insertionsCount: werData.ins,
          deletionsCount: werData.del,
          substitutionsCount: werData.sub,
        },
        optionalMetrics: {
          cer: data.cerData[model.name] || 0,
        }
      };
    });
    
    return result;
  }
  
  // Mock данные для разработки
  console.log('⚠️ Using mock overview model data');
  return {
    baseline: {
      wer: 15.4,
      mwa: 75.8,
      decomposition: {
        insertions: 25.3,
        deletions: 38.1,
        substitutions: 36.6,
        insertionsCount: 467,
        deletionsCount: 813,
        substitutionsCount: 966,
      },
      optionalMetrics: {
        wer_h: 14.2,
        ler: 8.3,
        cer: 5.1,
      },
    },
    candidate_v1: {
      wer: 14.2,
      mwa: 77.3,
      decomposition: {
        insertions: 23.5,
        deletions: 36.8,
        substitutions: 39.7,
        insertionsCount: 421,
        deletionsCount: 742,
        substitutionsCount: 895,
      },
      optionalMetrics: {
        wer_h: 13.1,
        ler: 7.6,
        cer: 4.7,
      },
    },
    candidate_v2: {
      wer: 12.8,
      mwa: 78.9,
      decomposition: {
        insertions: 21.2,
        deletions: 35.3,
        substitutions: 43.5,
        insertionsCount: 378,
        deletionsCount: 681,
        substitutionsCount: 824,
      },
      optionalMetrics: {
        wer_h: 12.0,
        ler: 7.1,
        cer: 4.3,
      },
    },
    candidate_v3: {
      wer: 11.5,
      mwa: 80.2,
      decomposition: {
        insertions: 19.8,
        deletions: 34.1,
        substitutions: 46.1,
        insertionsCount: 342,
        deletionsCount: 615,
        substitutionsCount: 753,
      },
      optionalMetrics: {
        wer_h: 10.8,
        ler: 6.4,
        cer: 3.9,
      },
    },
    candidate_v4: {
      wer: 10.2,
      mwa: 82.5,
      decomposition: {
        insertions: 18.1,
        deletions: 32.5,
        substitutions: 49.4,
        insertionsCount: 298,
        deletionsCount: 547,
        substitutionsCount: 681,
      },
      optionalMetrics: {
        wer_h: 9.5,
        ler: 5.8,
        cer: 3.5,
      },
    },
  };
}

/**
 * Получает настройки
 */
export function loadSettings(): { language: string; defaultTheme: string } {
  if (hasRealData()) {
    return window.RESON_DATA!.settings;
  }
  
  return {
    language: 'ru',
    defaultTheme: 'dark'
  };
}

// ============================================================================
// Mock Data Generators (для режима разработки)
// ============================================================================

function generateMockVocabularyData(modelNames: string[]): VocabularyWord[] {
  const russianWords = ['с', 'оператором', 'да', 'оператор', 'мне', 'нет', 'не', 'меня', 'соедините', 'я'];
  const words = russianWords.map(w => ({ word: w, type: 'russian' as const }));

  return words.map((item) => {
    const frequency = Math.floor(Math.random() * 2000) + 100;
    const baseRecall = 85 + Math.random() * 10;
    const basePrecision = 87 + Math.random() * 10;

    const modelMetrics: Record<string, any> = {};
    modelNames.forEach((model) => {
      const recall = Math.min(99.9, Math.max(70, baseRecall + (Math.random() - 0.5) * 5));
      const precision = Math.min(99.9, Math.max(70, basePrecision + (Math.random() - 0.5) * 5));
      const f1Score = (recall + precision) / 2;
      const wis = frequency * (100 - f1Score) / 100;
      modelMetrics[model] = { recall, precision, f1Score, wis };
    });

    return { word: item.word, frequency, type: item.type, modelMetrics };
  });
}

function generateMockAnalyticsData(modelNames: string[]): Record<string, { samples: AnalyticsSample[]; totalSamples: number }> {
  const result: Record<string, any> = {};
  const totalSamples = 500;

  modelNames.forEach((modelName) => {
    const samples: AnalyticsSample[] = [];
    for (let i = 0; i < totalSamples; i++) {
      const duration = Math.random() * 60 + 1;
      const wer = Math.random() * 15 + 2;
      const totalWords = Math.floor(duration * 3);
      const totalErrors = Math.floor((totalWords * wer) / 100);
      const insertions = Math.floor(totalErrors * 0.2);
      const deletions = Math.floor(totalErrors * 0.36);
      const substitutions = totalErrors - insertions - deletions;

      samples.push({
        audio_filepath: `sample-${i}.wav`,
        duration,
        durationType: duration < 5 ? "short" : duration <= 30 ? "normal" : "long",
        wer,
        insertions,
        deletions,
        substitutions
      });
    }
    result[modelName] = { samples, totalSamples };
  });

  return result;
}

function generateMockText(wordCount: number): string {
  const words = ['здравствуйте', 'да', 'нет', 'спасибо', 'пожалуйста', 'хорошо', 'оператор', 'соедините'];
  const result: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    result.push(words[Math.floor(Math.random() * words.length)]);
  }
  return result.join(' ');
}

function generateMockHypothesis(wordCount: number, wer: number): string {
  const reference = generateMockText(wordCount);
  const refWords = reference.split(' ');
  const errorCount = Math.floor((refWords.length * wer) / 100);
  
  if (errorCount === 0) return reference;
  
  const result = [...refWords];
  const errorWords = ['да', 'нет', 'хорошо', 'плохо'];
  
  for (let i = 0; i < Math.min(errorCount, refWords.length); i++) {
    const idx = Math.floor(Math.random() * refWords.length);
    const errorType = Math.random();
    if (errorType < 0.33) {
      result[idx] = result[idx] + ' ' + errorWords[Math.floor(Math.random() * errorWords.length)];
    } else if (errorType < 0.66) {
      result[idx] = '';
    } else {
      result[idx] = errorWords[Math.floor(Math.random() * errorWords.length)];
    }
  }
  
  return result.filter(w => w !== '').join(' ');
}

function generateMockManifestData(modelNames: string[]): Record<string, ManifestEntry[]> {
  const result: Record<string, ManifestEntry[]> = {};
  const numSamples = 100;
  
  modelNames.forEach(modelName => {
    const entries: ManifestEntry[] = [];
    for (let i = 0; i < numSamples; i++) {
      const duration = Math.random() * 60 + 1;
      const wordCount = Math.floor(duration * 3);
      const wer = Math.random() * 25;
      const text = generateMockText(wordCount);
      const prediction = generateMockHypothesis(wordCount, wer);
      
      const totalWords = text.split(' ').length;
      const totalErrors = Math.floor((totalWords * wer) / 100);
      const insertions = Math.floor(totalErrors * 0.2);
      const deletions = Math.floor(totalErrors * 0.36);
      const substitutions = totalErrors - insertions - deletions;
      
      entries.push({
        audio_filepath: `sample-${i}.wav`,
        duration: parseFloat(duration.toFixed(2)),
        text,
        prediction,
        wer: parseFloat(wer.toFixed(2)),
        cer: parseFloat((wer * 0.6).toFixed(2)),
        insertions,
        deletions,
        substitutions
      });
    }
    result[modelName] = entries;
  });
  
  return result;
}

/**
 * Загружает данные статистической значимости
 */
export function loadStatisticalSignificanceData(): Record<string, StatisticalSignificanceData> {
  if (hasRealData()) {
    console.log('✓ Loading statistical significance data from RESON_DATA');
    const data = window.RESON_DATA!.statisticalSignificanceData || {};
    console.log('  Statistical significance pairs:', Object.keys(data));
    return data;
  }
  
  // Mock данные для разработки
  console.log('⚠️ Using mock statistical significance data');
  return {
    'baseline_vs_candidate_v4': {
      isSignificant: true,
      pValue: 0.0023,
      alpha: 0.05,
      confidenceInterval: 95,
      lowerBound: -5.2,
      upperBound: -3.8,
    },
    'baseline_vs_candidate_v3': {
      isSignificant: true,
      pValue: 0.0031,
      alpha: 0.05,
      confidenceInterval: 95,
      lowerBound: -4.8,
      upperBound: -3.2,
    },
  };
}

/**
 * Загружает словарь замен (нормализация) для compare
 */
export function loadNormalizationDictionary() {
  if (hasRealData()) {
    return window.RESON_DATA!.normalizationDictionary ?? null;
  }
  return null;
}

/**
 * Выводит информацию о загруженных данных
 */
export function logDataInfo() {
  if (hasRealData()) {
    const data = window.RESON_DATA!;
    console.group('📊 RESON Data Loaded');
    console.log('Dataset:', data.datasetInfo.name);
    console.log('Models:', data.models.length, data.models.map(m => m.name));
    console.log('Vocabulary words:', data.vocabularyData.length);
    console.log('Statistical significance pairs:', data.statisticalSignificanceData ? Object.keys(data.statisticalSignificanceData) : 'none');
    console.log('Settings:', data.settings);
    console.groupEnd();
  } else {
    console.log('⚠️ Running in development mode with mock data');
  }
}
