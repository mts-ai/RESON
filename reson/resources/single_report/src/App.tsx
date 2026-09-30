import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Overview } from './components/Overview';
import { Vocabulary } from './components/Vocabulary';
import { Sidebar } from './components/Sidebar';
import { GuidedTour } from './components/GuidedTour';
import { WelcomeDialog } from './components/WelcomeDialog';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { DataProvider, useData } from './contexts/DataContext';
import { NavigationProvider, type TabType } from './contexts/NavigationContext';
import {
  readAppHashRoute,
  writeAppHashRoute,
  type VocabSubTab,
} from './utils/hashNavigation';
import { Loader2, AlertCircle, Menu, Moon, Sun } from 'lucide-react';

const Analytics = lazy(() =>
  import('./components/Analytics').then((m) => ({ default: m.Analytics })),
);
const Manifest = lazy(() =>
  import('./components/Manifest').then((m) => ({ default: m.Manifest })),
);

export type { TabType } from './contexts/NavigationContext';

function TabFallback() {
  const { theme } = useTheme();
  return (
    <div
      className={`flex flex-1 items-center justify-center p-12 ${
        theme === 'dark' ? 'bg-[#0F1117]' : 'bg-[#F5F7FA]'
      }`}
    >
      <Loader2
        className={`h-8 w-8 animate-spin ${theme === 'dark' ? 'text-violet-400' : 'text-violet-600'}`}
      />
    </div>
  );
}

/** Compact header shown instead of the sidebar on narrow viewports. */
function MobileTopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { theme, toggleTheme } = useTheme();
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
        onClick={toggleTheme}
        className="reson-mobile-topbar-button"
        aria-label={isDark ? 'Светлая тема' : 'Темная тема'}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    </header>
  );
}

function MainInterface({
  activeTab,
  setActiveTab,
  vocabSubTab,
  vocabWord,
  onVocabRouteChange,
  onTourStart,
  isNavOpen,
  onNavOpen,
  onNavClose,
}: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  vocabSubTab: VocabSubTab;
  vocabWord?: string;
  onVocabRouteChange: (subTab: VocabSubTab, word?: string) => void;
  onTourStart: () => void;
  isNavOpen: boolean;
  onNavOpen: () => void;
  onNavClose: () => void;
}) {
  const { theme } = useTheme();

  return (
    <>
      <MobileTopBar onMenuOpen={onNavOpen} />
      <div className="reson-app-body">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onTourStart={onTourStart}
          isOpen={isNavOpen}
          onClose={onNavClose}
        />
        <div
          className={`reson-nav-scrim ${isNavOpen ? 'reson-nav-scrim--open' : ''}`}
          onClick={onNavClose}
          aria-hidden="true"
        />
        <main
          className={`flex min-h-0 flex-1 flex-col overflow-auto ${
            theme === 'dark' ? 'bg-[#0F1117]' : 'bg-[#F5F7FA]'
          }`}
        >
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'vocabulary' && (
            <Vocabulary
              initialSubTab={vocabSubTab}
              initialWord={vocabWord}
              onRouteChange={onVocabRouteChange}
            />
          )}
          {activeTab === 'analytics' && (
            <Suspense fallback={<TabFallback />}>
              <Analytics />
            </Suspense>
          )}
          {activeTab === 'manifest' && (
            <Suspense fallback={<TabFallback />}>
              <Manifest />
            </Suspense>
          )}
        </main>
      </div>
    </>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [vocabSubTab, setVocabSubTab] = useState<VocabSubTab>('summary');
  const [vocabWord, setVocabWord] = useState<string | undefined>();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { data, loading, error } = useData();

  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const openNav = useCallback(() => setIsNavOpen(true), []);

  const applyHashRoute = useCallback(() => {
    const route = readAppHashRoute();
    if (!route) return;
    setActiveTab(route.tab);
    if (route.tab === 'vocabulary') {
      setVocabSubTab(route.vocabSubTab ?? 'summary');
      setVocabWord(route.word);
    } else {
      setVocabWord(undefined);
    }
  }, []);

  useEffect(() => {
    applyHashRoute();
    window.addEventListener('hashchange', applyHashRoute);
    return () => window.removeEventListener('hashchange', applyHashRoute);
  }, [applyHashRoute]);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      setIsNavOpen(false);
      if (tab === 'vocabulary') {
        writeAppHashRoute({ tab, vocabSubTab, word: vocabWord }, true);
      } else {
        writeAppHashRoute({ tab }, true);
      }
    },
    [vocabSubTab, vocabWord],
  );

  const handleVocabRouteChange = useCallback(
    (subTab: VocabSubTab, word?: string) => {
      setVocabSubTab(subTab);
      setVocabWord(word);
      if (activeTab === 'vocabulary') {
        writeAppHashRoute({ tab: 'vocabulary', vocabSubTab: subTab, word }, true);
      }
    },
    [activeTab],
  );

  if (loading) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${
          theme === 'dark' ? 'bg-[var(--reson-bg-dark)]' : 'bg-[var(--reson-bg-light)]'
        }`}
      >
        <div className="text-center">
          <Loader2
            className={`mx-auto mb-4 h-12 w-12 animate-spin ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}
          />
          <p className={`reson-body text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Загрузка данных...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${
          theme === 'dark' ? 'bg-[var(--reson-bg-dark)]' : 'bg-[var(--reson-bg-light)]'
        }`}
      >
        <div
          className={`max-w-md rounded-xl border p-6 ${
            theme === 'dark' ? 'border-red-900/50 bg-[#1A1D24]' : 'border-red-200 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-6 w-6 flex-shrink-0 text-red-500" />
            <div>
              <h3 className={`reson-section-title mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Ошибка загрузки данных
              </h3>
              <p className={`reson-body mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                {error}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={`flex h-screen items-center justify-center ${
          theme === 'dark' ? 'bg-[var(--reson-bg-dark)]' : 'bg-[var(--reson-bg-light)]'
        }`}
      >
        <p className={`reson-body text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          Данные не найдены
        </p>
      </div>
    );
  }

  return (
    <div
      className={`reson-app-shell ${theme === 'dark' ? 'bg-[var(--reson-bg-dark)]' : 'bg-[var(--reson-bg-light)]'}`}
    >
      <NavigationProvider navigateToTab={handleTabChange}>
        <MainInterface
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          vocabSubTab={vocabSubTab}
          vocabWord={vocabWord}
          onVocabRouteChange={handleVocabRouteChange}
          onTourStart={() => {
            closeNav();
            setIsTourOpen(true);
          }}
          isNavOpen={isNavOpen}
          onNavOpen={openNav}
          onNavClose={closeNav}
        />
        <GuidedTour
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
          onSectionChange={handleTabChange}
          onNavHighlight={setIsNavOpen}
        />
        <WelcomeDialog onStartTour={() => setIsTourOpen(true)} />
      </NavigationProvider>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </ThemeProvider>
  );
}
