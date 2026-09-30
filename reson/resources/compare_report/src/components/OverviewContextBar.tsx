import { useMemo, useState } from 'react';
import { CheckCircle2, Trophy } from './icons';
import { HeaderActionButton } from './ui/HeaderActionButton';
import { QuickSummaryModal } from './QuickSummaryModal';
import { LeaderboardModal } from './LeaderboardModal';
import { computeQuickSummary, type QuickSummaryInput } from '../utils/quickSummaryLogic';

interface WERDecomposition {
  insertions: number;
  deletions: number;
  substitutions: number;
  insertionsCount: number;
  deletionsCount: number;
  substitutionsCount: number;
}

interface ModelMetrics {
  name: string;
  displayName: string;
  wer: number;
  mwa: number;
  timestamp: string;
  checkpoint?: number;
  decomposition: WERDecomposition;
  optionalMetrics?: {
    wer_h?: number;
    ler?: number;
    cer?: number;
  };
}

interface DatasetSummary {
  totalHours: string;
  totalRecords: number;
  durationTypes: {
    normal: number;
    short: number;
    long: number;
  };
}

interface OverviewContextBarProps {
  summaryData: QuickSummaryInput;
  models: ModelMetrics[];
  datasetSummary?: DatasetSummary;
}

export function OverviewContextBar({
  summaryData,
  models,
  datasetSummary,
}: OverviewContextBarProps) {
  const [summaryPanelOpen, setSummaryPanelOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const summary = useMemo(() => computeQuickSummary(summaryData), [summaryData]);
  const showLeaderboard = models.length >= 3;

  const leaderboardStatusLabel = `${models.length} моделей · Нажмите для просмотра рейтинга`;

  return (
    <>
      <div
        className={`reson-overview-context-bar mb-5${
          showLeaderboard ? '' : ' reson-overview-context-bar--single'
        }`}
        data-tour="overview-context-bar"
      >
        <HeaderActionButton
          variant="analytics"
          title="Краткие выводы"
          hint="Нажмите для просмотра сводки сравнения"
          statusLabel={summary?.statusLabel}
          showStatus={Boolean(summary)}
          icon={<CheckCircle2 className="w-4 h-4" />}
          onClick={() => {
            setLeaderboardOpen(false);
            setSummaryPanelOpen(true);
          }}
          pressed={summaryPanelOpen}
          dataTour="quick-summary"
          ariaLabel="Краткие выводы сравнения моделей"
        />

        {showLeaderboard && (
          <HeaderActionButton
            variant="leaderboard"
            title="Подиум моделей"
            hint="Нажмите для просмотра рейтинга моделей"
            statusLabel={leaderboardStatusLabel}
            showStatus
            icon={<Trophy className="w-4 h-4" />}
            onClick={() => {
              setSummaryPanelOpen(false);
              setLeaderboardOpen(true);
            }}
            pressed={leaderboardOpen}
            dataTour="leaderboard-button"
            ariaLabel="Подиум моделей — сравнение трёх и более моделей"
          />
        )}
      </div>

      <QuickSummaryModal
        open={summaryPanelOpen}
        onOpenChange={setSummaryPanelOpen}
        data={summaryData}
      />

      {showLeaderboard && (
        <LeaderboardModal
          models={models}
          datasetSummary={datasetSummary}
          open={leaderboardOpen}
          onOpenChange={setLeaderboardOpen}
        />
      )}
    </>
  );
}
