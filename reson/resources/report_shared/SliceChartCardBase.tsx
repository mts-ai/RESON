import type { ReactNode } from 'react';

export interface SliceChartCardBaseProps {
  icon: ReactNode;
  title: string;
  description?: string;
  isDark: boolean;
  children: ReactNode;
  className?: string;
}

export function SliceChartCardBase({
  icon,
  title,
  description,
  isDark,
  children,
  className = '',
}: SliceChartCardBaseProps) {
  return (
    <div className={`reson-slice-chart-card ${isDark ? 'reson-slice-chart-card--dark' : ''} ${className}`}>
      <div className="reson-slice-chart-head">
        <span className="reson-slice-chart-head-icon">{icon}</span>
        <div className="reson-slice-chart-head-text">
          <h4>{title}</h4>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
