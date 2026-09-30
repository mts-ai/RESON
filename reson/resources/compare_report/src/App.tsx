/**
 * RESON: Research Engine for Speech & Observation Notes
 * Main Application - Integrated with Real Data Support
 */

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { VocabularyComparison } from './components/VocabularyComparison';
import { AnalyticsNew } from './components/AnalyticsNew';
import { Manifest } from './components/Manifest';
import { ThemeProvider } from './components/ThemeProvider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import { GuidedTour } from './components/GuidedTour';
import { WelcomeDialog } from './components/WelcomeDialog';
import { ModelSettingsButton } from './components/ModelSettingsButton';
import { Menu, Moon, Sun } from './components/icons';
import { useTheme } from './components/ThemeProvider';
import {
  loadModels,
  loadDatasetInfo,
  loadVocabularyData,
  loadAnalyticsData,
  loadOverviewModelData,
  loadManifestData,
  loadStatisticalSignificanceData,
  loadSettings,
  loadNormalizationDictionary,
  logDataInfo,
  hasRealData
} from './utils/dataLoader';
import {
  DEFAULT_ANALYTICS_SLICE_FILTERS,
  type AnalyticsSliceFilters,
} from './utils/analyticsSlice';
import {
  readAppHashRoute,
  writeAppHashRoute,
  type AppSection,
  type VocabSubTab,
  type VocabTableFilters,
} from './utils/hashNavigation';

interface ModelInfo {
  name: string;
  displayName: string;
}

function parseCountValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const digits = value.replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }
  return 0;
}

/** Compact header shown instead of the sidebar on narrow viewports. */
function MobileTopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header
      className={`reson-mobile-topbar ${
        isDark ? 'reson-mobile-topbar--dark' : 'reson-mobile-topbar--light'
      }`}
    >
      <button
        type="button"
        onClick={onMenuOpen}
        className="reson-mobile-topbar-button"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="reson-mobile-topbar-brand">
        <span className="reson-mobile-topbar-dot" />
        <span className="reson-mobile-topbar-title">MWS AI RESON</span>
      </div>
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="reson-mobile-topbar-button"
        aria-label={isDark ? 'Светлая тема' : 'Темная тема'}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    </header>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('overview');
  const [vocabSubTab, setVocabSubTab] = useState<VocabSubTab>('summary');
  const [vocabWord, setVocabWord] = useState<string | undefined>();
  const [vocabTableFilters, setVocabTableFilters] = useState<VocabTableFilters | undefined>();
  const [manifestFilterIds, setManifestFilterIds] = useState<string[]>([]);
  const [sliceFilters, setSliceFilters] = useState<AnalyticsSliceFilters>(
    DEFAULT_ANALYTICS_SLICE_FILTERS,
  );
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isManifestFiltersPanelOpen, setIsManifestFiltersPanelOpen] = useState(false);
  const [isManifestSampleDetailOpen, setIsManifestSampleDetailOpen] = useState(false);
  const [isVocabularyWordDetailOpen, setIsVocabularyWordDetailOpen] = useState(false);
  
  // Load data on mount
  useEffect(() => {
    logDataInfo();
    if (hasRealData()) {
      console.log('✅ Running with real RESON data');
    } else {
      console.log('⚠️ Running with mock data (development mode)');
    }
  }, []);

  const applyHashRoute = useCallback(() => {
    const route = readAppHashRoute();
    if (!route) return;
    setActiveSection(route.section);
    if (route.section === 'dictionary') {
      setVocabSubTab(route.vocabSubTab ?? 'summary');
      setVocabWord(route.word);
      setVocabTableFilters(route.tableFilters);
    } else {
      setVocabWord(undefined);
      setVocabTableFilters(undefined);
    }
  }, []);

  useEffect(() => {
    applyHashRoute();
    window.addEventListener('hashchange', applyHashRoute);
    return () => window.removeEventListener('hashchange', applyHashRoute);
  }, [applyHashRoute]);

  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const openNav = useCallback(() => setIsNavOpen(true), []);

  const handleSectionChange = useCallback(
    (section: string) => {
      const nextSection = section as AppSection;
      setActiveSection(nextSection);
      setIsNavOpen(false);
      if (nextSection === 'dictionary') {
        writeAppHashRoute(
          {
            section: nextSection,
            vocabSubTab,
            word: vocabWord,
            tableFilters: vocabTableFilters,
          },
          true,
        );
      } else {
        writeAppHashRoute({ section: nextSection }, true);
      }
    },
    [vocabSubTab, vocabWord, vocabTableFilters],
  );

  const updateSliceFilters = useCallback((patch: Partial<AnalyticsSliceFilters>) => {
    setSliceFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleVocabRouteChange = useCallback(
    (subTab: VocabSubTab, word?: string, tableFilters?: VocabTableFilters) => {
      setVocabSubTab(subTab);
      setVocabWord(word);
      setVocabTableFilters(tableFilters);
      if (activeSection === 'dictionary') {
        writeAppHashRoute(
          {
            section: 'dictionary',
            vocabSubTab: subTab,
            word,
            tableFilters,
          },
          true,
        );
      }
    },
    [activeSection],
  );

  // Load models and data from dataLoader
  const availableModels: ModelInfo[] = loadModels();
  const datasetInfo = loadDatasetInfo();
  const vocabularyWords = loadVocabularyData();
  const analyticsData = loadAnalyticsData();
  const overviewModelData = loadOverviewModelData();
  const manifestDataRaw = loadManifestData();
  const statisticalSignificanceData = loadStatisticalSignificanceData();
  const settings = loadSettings();
  const normalizationDictionary = loadNormalizationDictionary();
  const datasetSummary = {
    totalHours: datasetInfo.totalDuration || '0:00:00',
    totalRecords: Number(datasetInfo.totalSamples || 0),
    vocabularySize: parseCountValue(datasetInfo.vocabSize),
    uniqueChars: parseCountValue(datasetInfo.uniqueChars),
    durationTypes: {
      normal: Number(datasetInfo.durationTypes?.normal || 0),
      short: Number(datasetInfo.durationTypes?.short || 0),
      long: Number(datasetInfo.durationTypes?.long || 0),
    },
  };
  
  // No models selected by default — user picks Base and Target in model settings.
  const [baseModel, setBaseModel] = useState<string | null>(null);
  const [targetModel, setTargetModel] = useState<string | null>(null);
  const [optionalModels, setOptionalModels] = useState<string[]>([]);
  const modelsReady = Boolean(baseModel && targetModel);

  // Generate manifest data - use real data if available, otherwise fallback to mock
  const manifestData = availableModels.map(model => {
    // Try to use real manifest data first
    const realManifestEntries = manifestDataRaw[model.name];
    if (realManifestEntries && realManifestEntries.length > 0) {
      return {
        modelName: model.name,
        displayName: model.displayName,
        samples: realManifestEntries.map(entry => ({
          id: entry.audio_filepath,
          file_path: entry.audio_filepath,
          duration: entry.duration,
          reference: entry.text,
          hypothesis: entry.prediction,
          wer: entry.wer,
          cer: entry.cer,
          insertions: entry.insertions,
          deletions: entry.deletions,
          substitutions: entry.substitutions,
          diff_tokens: entry.diff_tokens, // Preserve diff_tokens from backend
        }))
      };
    }
    
    // Fallback to mock data from analyticsData
    const modelData = analyticsData[model.name];
    if (!modelData) return { modelName: model.name, displayName: model.displayName, samples: [] };
    
    return {
      modelName: model.name,
      displayName: model.displayName,
      samples: modelData.samples.map(sample => ({
        id: sample.audio_filepath,
        file_path: sample.audio_filepath,
        duration: sample.duration,
        reference: generateMockText(Math.floor(sample.duration * 3)),
        hypothesis: generateMockHypothesis(Math.floor(sample.duration * 3), sample.wer),
        wer: sample.wer,
        cer: sample.wer * 0.4,
        insertions: sample.insertions,
        deletions: sample.deletions,
        substitutions: sample.substitutions,
      }))
    };
  });

  return (
    <ThemeProvider>
      <TooltipProvider>
        <div className="reson-app-shell bg-background text-foreground">
          <MobileTopBar onMenuOpen={openNav} />
          <div className="reson-app-body">
          <Sidebar 
            activeSection={activeSection} 
            onSectionChange={handleSectionChange}
            onTourStart={() => {
              closeNav();
              setIsTourOpen(true);
            }}
            isOpen={isNavOpen}
            onClose={closeNav}
          />
          <div
            className={`reson-nav-scrim ${isNavOpen ? 'reson-nav-scrim--open' : ''}`}
            onClick={closeNav}
            aria-hidden="true"
          />
          <main className="flex-1 overflow-auto bg-background" data-tour="overview-content">
            {activeSection === 'overview' && (
              <Overview 
                baseModel={baseModel}
                targetModel={targetModel}
                optionalModels={optionalModels}
                availableModels={availableModels}
                datasetSummary={datasetSummary}
                modelData={overviewModelData}
                statisticalSignificance={statisticalSignificanceData}
                onSectionChange={handleSectionChange}
              />
            )}
            {activeSection === 'dictionary' && (
              <VocabularyComparison
                  words={vocabularyWords}
                  availableModels={availableModels}
                  baseModel={baseModel}
                  targetModel={targetModel}
                  optionalModels={optionalModels}
                  manifestData={manifestDataRaw}
                  audioBasePath={settings?.audioBasePath}
                  normalizationDictionary={normalizationDictionary}
                  onWordDetailChange={setIsVocabularyWordDetailOpen}
                  initialSubTab={vocabSubTab}
                  initialWord={vocabWord}
                  initialTableFilters={vocabTableFilters}
                  onRouteChange={handleVocabRouteChange}
                />
            )}
            {activeSection === 'analytics' && (
              <div className="reson-section-scroll p-8">
                <AnalyticsNew
                  data={analyticsData}
                  availableModels={availableModels}
                  baseModel={baseModel}
                  targetModel={targetModel}
                  optionalModels={optionalModels}
                  sliceFilters={sliceFilters}
                  onSliceFiltersChange={updateSliceFilters}
                  onViewInManifest={(sampleIds: string[]) => {
                    setManifestFilterIds(sampleIds);
                    handleSectionChange('manifest');
                  }}
                />
              </div>
            )}
            {activeSection === 'manifest' && (
              <div className="reson-section-scroll p-8">
                <Manifest 
                  modelResults={manifestData}
                  initialFilterIds={manifestFilterIds}
                  baseModel={baseModel}
                  targetModel={targetModel}
                  optionalModels={optionalModels}
                  sliceFilters={sliceFilters}
                  onSliceFiltersChange={updateSliceFilters}
                  onFiltersPanelChange={setIsManifestFiltersPanelOpen}
                  onSampleDetailChange={setIsManifestSampleDetailOpen}
                />
              </div>
            )}
          </main>
          </div>

          {/* Floating Model Settings Button - Hidden when any detail panel is open */}
          {!isManifestFiltersPanelOpen && !isManifestSampleDetailOpen && !isVocabularyWordDetailOpen && (
            <div className="reson-model-settings-dock fixed top-6 right-6 z-[60]">
              <ModelSettingsButton
                availableModels={availableModels}
                baseModel={baseModel}
                targetModel={targetModel}
                optionalModels={optionalModels}
                onBaseModelChange={setBaseModel}
                onTargetModelChange={setTargetModel}
                onOptionalModelsChange={setOptionalModels}
              />
            </div>
          )}
        </div>
        <GuidedTour 
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
          currentSection={activeSection}
          onSectionChange={handleSectionChange}
          onNavHighlight={setIsNavOpen}
        />
        <WelcomeDialog
          modelsReady={modelsReady}
          onStartTour={() => setIsTourOpen(true)}
        />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

// Helper functions for generating mock text (used only when manifest needs to be generated)
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