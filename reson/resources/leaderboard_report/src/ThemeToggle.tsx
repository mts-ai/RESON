import type { SVGProps } from 'react';
import { Moon, Sun } from '@compare/components/icons';
import { useTheme, type ThemeMode } from './ThemeProvider';

function MonitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

const MODE_LABELS: Record<ThemeMode, string> = {
  system: 'Системная тема',
  light: 'Светлая тема',
  dark: 'Темная тема',
};

export function ThemeToggle() {
  const { mode, theme, cycleMode } = useTheme();

  return (
    <button
      type="button"
      onClick={cycleMode}
      className={`rounded-lg border p-2 transition-colors ${
        theme === 'dark'
          ? 'border-[var(--reson-border-dark)] bg-[var(--reson-surface-dark)] hover:bg-white/5'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
      title={MODE_LABELS[mode]}
      aria-label={MODE_LABELS[mode]}
    >
      {mode === 'system' ? (
        <MonitorIcon className="h-4 w-4 text-muted-foreground" />
      ) : mode === 'light' ? (
        <Sun className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}
