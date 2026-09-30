import type { ReactNode } from 'react';
import { useTheme } from './ThemeProvider';

export type SectionVariant = 'overview' | 'dictionary' | 'analytics' | 'manifest';

interface SectionHeaderProps {
  title: string;
  description: string;
  icon: ReactNode;
  variant: SectionVariant;
  actions?: ReactNode;
}

export function SectionHeader({ title, description, icon, variant, actions }: SectionHeaderProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const isAnalytics = variant === 'analytics';

  return (
    <div className={`flex flex-col ${isAnalytics ? 'mb-6' : 'mb-8'}`}>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-3">
          <div className={`reson-section-icon reson-section-icon--${variant} ${isDark ? 'dark' : 'light'}`}>
            {icon}
          </div>
          <h1 className={`${isAnalytics ? 'text-2xl' : 'text-3xl'} ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h1>
        </div>
        {actions ? <div className="shrink-0 pt-1">{actions}</div> : null}
      </div>
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {description}
      </p>
    </div>
  );
}
