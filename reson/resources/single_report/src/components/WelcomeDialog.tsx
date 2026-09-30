import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const VISITED_STORAGE_KEY = "reson-single-report-has-visited";

interface WelcomeDialogProps {
  onStartTour: () => void;
}

export function WelcomeDialog({ onStartTour }: WelcomeDialogProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(VISITED_STORAGE_KEY)) return;
    } catch {
      return;
    }

    const timer = window.setTimeout(() => setIsOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const markVisited = () => {
    try {
      localStorage.setItem(VISITED_STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-labelledby="welcome-dialog-title"
        className={`relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
          isDark
            ? "bg-[#1A1D24] border-[#2A2D35] text-white"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        <button
          type="button"
          onClick={handleClose}
          className={`absolute right-4 top-4 rounded-lg p-1.5 transition-colors ${
            isDark
              ? "text-gray-400 hover:bg-[#2A2D35] hover:text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          }`}
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="reson-welcome-dialog-icon">
            <Sparkles
              className={`w-5 h-5 ${isDark ? "text-purple-400" : "text-purple-600"}`}
            />
          </div>
          <h2 id="welcome-dialog-title" className="text-xl font-semibold">
            Добро пожаловать в MWS AI RESON!
          </h2>
        </div>

        <div
          className={`space-y-3 text-sm leading-relaxed ${
            isDark ? "text-gray-300" : "text-gray-600"
          }`}
        >
          <p>
            <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              MWS AI RESON
            </span>{" "}
            помогает найти, почему модель ошибается: какие слова «тянут» WER,
            в каких сегментах качество падает и где послушать конкретные промахи.
          </p>
          <p>
            Короткий{" "}
            <span className={`font-semibold ${isDark ? "text-purple-400" : "text-purple-600"}`}>
              интерактивный тур
            </span>{" "}
            покажет рабочий маршрут — от общей оценки к точечным исправлениям.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleStartTour}
            className="reson-welcome-dialog-btn-primary"
          >
            <Sparkles className="w-4 h-4" />
            Начать интерактивный тур
          </button>
          <button
            type="button"
            onClick={handleClose}
            className={`w-full rounded-lg px-4 py-2.5 text-sm transition-colors ${
              isDark
                ? "text-gray-400 hover:bg-[#23262F] hover:text-gray-200"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Пропустить, я разберусь сам
          </button>
        </div>

        <p
          className={`mt-3 text-center text-xs ${
            isDark ? "text-gray-500" : "text-gray-500"
          }`}
        >
          Тур можно запустить позже из бокового меню
        </p>
      </div>
    </div>
  );
}
