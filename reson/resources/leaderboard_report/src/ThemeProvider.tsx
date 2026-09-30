import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
}

const STORAGE_KEY = 'reson-leaderboard-theme-mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readDefaultMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (file://, private mode)
  }

  const configured = window.RESON_DATA?.settings?.defaultTheme;
  if (configured === 'system' || configured === 'light' || configured === 'dark') {
    return configured;
  }

  return 'system';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light') {
    return 'light';
  }
  if (mode === 'dark') {
    return 'dark';
  }
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readDefaultMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => resolveTheme('system'));

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      setSystemTheme(media.matches ? 'dark' : 'light');
    };

    updateSystemTheme();
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  const theme = mode === 'system' ? systemTheme : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    document.body.style.backgroundColor =
      theme === 'dark' ? 'var(--reson-bg-dark)' : 'var(--reson-bg-light)';

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore persistence errors
    }
  }, [mode, theme]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      if (current === 'system') return 'light';
      if (current === 'light') return 'dark';
      return 'system';
    });
  }, []);

  const value = useMemo(
    () => ({ mode, theme, setMode, cycleMode }),
    [mode, theme, setMode, cycleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
