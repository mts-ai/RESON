import { ReactNode } from 'react';
import { useTheme } from './ThemeProvider';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  compact?: boolean;
}

export function MetricCard({ icon, label, value, compact = false }: MetricCardProps) {
  const { theme } = useTheme();

  return (
    <div
      className={`rounded-xl border ${
        compact ? 'reson-overview-metric-card' : 'p-5'
      } ${
        theme === 'dark'
          ? 'bg-[var(--reson-surface-dark)] border-[var(--reson-border-dark)]'
          : 'bg-[var(--reson-surface-light)] border-[var(--reson-border-light)] shadow-sm'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 ${compact ? 'mb-1' : 'mb-3'} reson-body ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div className={`reson-metric-value ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}
