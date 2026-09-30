import { ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface MetricCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  compact?: boolean;
}

export function MetricCard({ label, value, icon, compact = false }: MetricCardProps) {
  const { theme } = useTheme();
  
  return (
    <div className={`rounded-xl border ${
      compact ? 'reson-overview-metric-card' : 'p-4'
    } ${
      theme === 'dark'
        ? 'bg-[var(--reson-surface-dark)] border-[var(--reson-border-dark)]'
        : 'bg-[var(--reson-surface-light)] border-[var(--reson-border-light)] shadow-sm'
    }`}>
      <div className={`flex items-center gap-1.5 ${compact ? 'mb-1' : 'mb-2'} reson-body ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      }`}>
        {icon}
        <span>{label}</span>
      </div>
      <div className={`reson-metric-value ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}