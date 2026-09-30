import { Trophy } from './icons';
import { useTheme } from './ThemeProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Leaderboard } from './Leaderboard';

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

interface LeaderboardModalProps {
  models: ModelMetrics[];
  datasetSummary?: DatasetSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaderboardModal({
  models,
  datasetSummary,
  open,
  onOpenChange,
}: LeaderboardModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (models.length < 3) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`reson-leaderboard-modal reson-dialog-surface max-h-[92vh] overflow-hidden p-0 gap-0 !z-[70] ${
          isDark ? 'dark' : ''
        }`}
        overlayClassName="!z-[65]"
      >
        <DialogHeader className="reson-leaderboard-modal-header">
          <div className="flex items-start justify-between gap-4 pr-10">
            <div className="flex items-start gap-3 min-w-0">
              <div className="reson-leaderboard-modal-icon">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="reson-leaderboard-modal-title">
                  Подиум моделей
                </DialogTitle>
                <DialogDescription className="reson-leaderboard-modal-desc">
                  Рейтинг и детальное сравнение выбранных моделей
                  {datasetSummary
                    ? ` · ${datasetSummary.totalRecords.toLocaleString()} записей`
                    : ''}
                </DialogDescription>
              </div>
            </div>
            <span className="reson-leaderboard-modal-badge shrink-0">
              {models.length} моделей
            </span>
          </div>
        </DialogHeader>

        <div className="reson-leaderboard-modal-body">
          <Leaderboard
            models={models}
            datasetSummary={datasetSummary}
            variant="modal"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
