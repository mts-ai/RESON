import type { ReactNode } from 'react';
import {
  RESON_ANALYTICS_SECTION_TITLE,
  RESON_ANALYTICS_SUBTITLE,
  RESON_MANIFEST_CHART_HEADER_ICON,
} from '../styles/reportStyles';
import { HelpHint } from './ui/HelpHint';

interface AnalyticsChartHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  help?: ReactNode;
  variant?: 'analytics' | 'manifest';
}

export function AnalyticsChartHeader({
  icon,
  title,
  subtitle,
  help,
  variant = 'analytics',
}: AnalyticsChartHeaderProps) {
  const isManifest = variant === 'manifest';

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <span
          className={
            isManifest
              ? `shrink-0 ${RESON_MANIFEST_CHART_HEADER_ICON} [&>svg]:w-4 [&>svg]:h-4`
              : 'shrink-0 text-emerald-600 dark:text-emerald-400 [&>svg]:w-4 [&>svg]:h-4'
          }
        >
          {icon}
        </span>
        <h4 className={RESON_ANALYTICS_SECTION_TITLE}>{title}</h4>
        {help ? (
          <HelpHint ariaLabel="Подробнее" side="right" align="start">
            {help}
          </HelpHint>
        ) : null}
      </div>
      {subtitle ? (
        <p className={`mt-1 ${RESON_ANALYTICS_SUBTITLE}`}>{subtitle}</p>
      ) : null}
    </div>
  );
}
