import { ThemeProvider, useTheme } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { Leaderboard } from '@compare/components/Leaderboard';
import { loadLeaderboardData } from './dataLoader';

function LeaderboardPage() {
  const { theme } = useTheme();
  const { models, datasetSummary, datasetName } = loadLeaderboardData();

  return (
    <div
      className={`min-h-screen ${
        theme === 'dark' ? 'dark bg-[var(--reson-bg-dark)]' : 'bg-[var(--reson-bg-light)]'
      }`}
    >
      <div className="reson-leaderboard-page mx-auto max-w-6xl px-4 py-8">
        <header className="reson-leaderboard-page-header mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">MWS AI RESON</p>
            <h1 className="text-2xl font-semibold">{datasetName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {datasetSummary.totalRecords.toLocaleString()} записей · {datasetSummary.totalHours}
            </p>
          </div>
          <ThemeToggle />
        </header>
        <Leaderboard models={models} datasetSummary={datasetSummary} variant="standalone" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LeaderboardPage />
    </ThemeProvider>
  );
}
