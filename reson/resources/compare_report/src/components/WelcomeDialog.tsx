/**
 * WelcomeDialog Component
 * Приветственный диалог для новых пользователей с предложением пройти тур
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Sparkles } from 'lucide-react';

const VISITED_STORAGE_KEY = 'reson-has-visited';

interface WelcomeDialogProps {
  onStartTour: () => void;
  /** Base и Target выбраны — минимум две модели для сравнения */
  modelsReady: boolean;
}

export function WelcomeDialog({ onStartTour, modelsReady }: WelcomeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!modelsReady) {
      return;
    }
    if (localStorage.getItem(VISITED_STORAGE_KEY)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsOpen(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [modelsReady]);

  const markVisited = () => {
    localStorage.setItem(VISITED_STORAGE_KEY, 'true');
  };

  const handleClose = () => {
    markVisited();
    setIsOpen(false);
  };

  const handleStartTour = () => {
    markVisited();
    setIsOpen(false);
    onStartTour();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <DialogTitle className="text-xl">
                Добро пожаловать в MWS AI RESON!
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-base space-y-3 pt-2">
            <div>
              <span className="font-semibold text-foreground">MWS AI RESON</span> — система для сравнительного анализа ASR моделей с интерактивными отчетами и детальной аналитикой.
            </div>
            <div className="text-sm">
              Модели для сравнения выбраны. Рекомендуем пройти{' '}
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                интерактивный тур
              </span>
              , который познакомит вас со всеми возможностями отчёта.
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-4">
          <Button
            onClick={handleStartTour}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Начать интерактивный тур
          </Button>
          <Button
            onClick={handleClose}
            variant="ghost"
            className="w-full"
          >
            Пропустить, я разберусь сам
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Вы всегда можете запустить тур позже через боковое меню
        </p>
      </DialogContent>
    </Dialog>
  );
}
