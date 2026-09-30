/** Shared class names aligned with single_report visual language */

export const RESON_TAB_TRIGGER_CLASS =
  'gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--reson-accent)] data-[state=active]:text-[var(--reson-accent-dark)] dark:data-[state=active]:text-[var(--reson-accent-light)] data-[state=active]:bg-transparent py-3';

export const RESON_TAB_TRIGGER_COMPACT_CLASS =
  'text-xs py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--reson-accent)] data-[state=active]:text-[var(--reson-accent-dark)] dark:data-[state=active]:text-[var(--reson-accent-light)] data-[state=active]:bg-transparent transition-all';

export const RESON_SECTION_CARD_CLASS =
  'rounded-xl border border-border bg-card shadow-sm dark:bg-[var(--reson-surface-dark)] dark:border-[var(--reson-border-dark)]';

/** Analytics section surfaces — see tokens.css (.reson-analytics-*) */
export const RESON_ANALYTICS_SECTION_CARD = 'reson-analytics-section-card';

export const RESON_ANALYTICS_INNER_CARD = 'reson-analytics-inner-card';

export const RESON_ANALYTICS_CHART_CARD = 'reson-analytics-chart-card';

export const RESON_ANALYTICS_TAB_TRIGGER =
  'text-xs py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#10B981] data-[state=active]:text-[#047857] dark:data-[state=active]:text-[#34D399] data-[state=active]:bg-transparent transition-all';

export const RESON_ANALYTICS_SECTION_TITLE = 'reson-analytics-section-title';

export const RESON_ANALYTICS_SUBTITLE = 'reson-analytics-subtitle';

export const RESON_ANALYTICS_FILTER_SELECT = 'reson-analytics-filter-select';
export const RESON_ANALYTICS_SLICE_FILTER_BTN = 'reson-analytics-slice-filter-btn';
export const RESON_ANALYTICS_SLICE_FILTER_BTN_LABEL = 'reson-analytics-slice-filter-btn-label';
export const RESON_ANALYTICS_SLICE_FILTER_BTN_LABEL_ACTIVE =
  'reson-analytics-slice-filter-btn-label reson-analytics-slice-filter-btn-label--active';
export const RESON_ANALYTICS_SLICE_PANEL = 'reson-analytics-slice-panel';
export const RESON_ANALYTICS_SLICE_PANEL_BOX = 'reson-analytics-slice-panel-box';
export const RESON_ANALYTICS_SLICE_CHIP = 'reson-analytics-slice-chip';
export const RESON_ANALYTICS_SLICE_CHIP_ACTIVE =
  'reson-analytics-slice-chip reson-analytics-slice-chip--active';
export const RESON_ANALYTICS_METRIC_LABEL = 'reson-analytics-metric-label';
export const RESON_ANALYTICS_METRIC_VALUE = 'reson-analytics-metric-value';
export const RESON_ANALYTICS_METRIC_DELTA = 'reson-analytics-metric-delta';
export const RESON_ANALYTICS_METRIC_DELTA_DURATION =
  'reson-analytics-metric-delta reson-analytics-metric-delta--duration';
export const RESON_ANALYTICS_METRIC_DELTA_IMPROVED =
  'reson-analytics-metric-delta reson-analytics-metric-delta--improved';
export const RESON_ANALYTICS_METRIC_DELTA_DEGRADED =
  'reson-analytics-metric-delta reson-analytics-metric-delta--degraded';
export const RESON_ANALYTICS_SLICE_PANEL_HEADER = 'reson-analytics-slice-panel-header';
export const RESON_ANALYTICS_SLICE_PANEL_TITLE = 'reson-analytics-slice-panel-title';
export const RESON_ANALYTICS_SLICE_PANEL_SECTION_TITLE =
  'reson-analytics-slice-panel-section-title';
export const RESON_ANALYTICS_SLICE_PANEL_DIVIDER = 'reson-analytics-slice-panel-divider';
export const RESON_ANALYTICS_SLICE_PANEL_LABEL = 'reson-analytics-slice-panel-label';
export const RESON_ANALYTICS_SLICE_PANEL_SUBLABEL = 'reson-analytics-slice-panel-sublabel';
export const RESON_ANALYTICS_SLICE_PANEL_FOOTER = 'reson-analytics-slice-panel-footer';
export const RESON_ANALYTICS_SLICE_PANEL_ACTION = 'reson-analytics-slice-panel-action';
export const RESON_ANALYTICS_SLICE_PANEL_CLOSE_ICON = 'reson-analytics-slice-panel-close-icon';
export const RESON_ANALYTICS_SLICE_SELECT_TRIGGER = 'reson-analytics-slice-select-trigger';
export const RESON_ANALYTICS_SLICE_SELECT_CONTENT = 'reson-analytics-slice-select-content';
export const RESON_ANALYTICS_SLICE_CHIP_DOT_ACTIVE = 'reson-analytics-slice-chip-dot-active';

export function resonAnalyticsComparisonChipClass(
  filter: 'all' | 'best' | 'worst',
  active: boolean,
): string {
  if (!active) return RESON_ANALYTICS_SLICE_CHIP;
  if (filter === 'best') {
    return 'reson-analytics-slice-chip reson-analytics-slice-chip--active-best';
  }
  if (filter === 'worst') {
    return 'reson-analytics-slice-chip reson-analytics-slice-chip--active-worst';
  }
  return 'reson-analytics-slice-chip reson-analytics-slice-chip--active-all';
}

export const RESON_CLUSTER_CARD_LABEL = 'reson-cluster-card-label';
export const RESON_CLUSTER_CARD_DESC = 'reson-cluster-card-desc';
export const RESON_CLUSTER_CARD_COUNT = 'reson-cluster-card-count';
export const RESON_CLUSTER_CARD_COUNT_SUFFIX = 'reson-cluster-card-count-suffix';
export const RESON_CLUSTER_CARD_PERCENT = 'reson-cluster-card-percent';
export const RESON_CLUSTER_MANIFEST_BTN = 'reson-cluster-manifest-btn';

export const RESON_ANALYTICS_TOGGLE_GROUP =
  'flex flex-wrap items-center gap-1 p-1 rounded-lg border bg-gray-100 border-gray-200 dark:bg-[#23262F] dark:border-[#2A2D35]';

export const RESON_PANEL_CLASS =
  'rounded-xl border bg-[var(--reson-surface-light)] border-[var(--reson-border-light)] shadow-sm dark:bg-[var(--reson-surface-dark)] dark:border-[var(--reson-border-dark)]';

export const RESON_PAGE_SUBTITLE_CLASS =
  'text-sm text-gray-600 dark:text-gray-400';

export const RESON_WER_COLOR = '#f97316';
export const RESON_MWA_COLOR = '#8b5cf6';

export const RESON_SORT_WER_ACTIVE =
  'bg-[#f97316] text-white shadow-sm';

export const RESON_SORT_MWA_ACTIVE =
  'bg-[#8b5cf6] text-white shadow-sm';

export function resonSubtabClass(active: boolean, isDark: boolean): string {
  if (active) {
    return 'reson-subtab-active px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2';
  }
  return `px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
    isDark
      ? 'bg-[var(--reson-surface-muted-dark)] text-gray-400 hover:text-white'
      : 'bg-[var(--reson-surface-muted-light)] text-gray-600 hover:text-gray-900'
  }`;
}

/** Analytics main/sub tabs — active state in green (not global purple accent). */
export function resonAnalyticsSubtabClass(active: boolean, isDark: boolean): string {
  if (active) {
    return 'reson-analytics-subtab-active px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm';
  }
  return `px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 border ${
    isDark
      ? 'border-[#2A2D35] bg-[#23262F] text-gray-400 hover:text-white hover:border-[#3A3D45]'
      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm'
  }`;
}

/** Manifest tabs — active state in amber/orange (section color). */
export function resonManifestSubtabClass(active: boolean, isDark: boolean): string {
  if (active) {
    return 'reson-manifest-subtab-active px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm';
  }
  return `px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 border ${
    isDark
      ? 'border-[#2A2D35] bg-[#23262F] text-gray-400 hover:text-white hover:border-[#3A3D45]'
      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm'
  }`;
}

export const RESON_MANIFEST_ACTIVE_FILTER_TAG = 'reson-manifest-active-filter-tag';

export const RESON_MANIFEST_FILTER_BTN = 'reson-manifest-filter-btn';
export const RESON_MANIFEST_FILTER_BTN_LABEL = 'reson-manifest-filter-btn-label';
export const RESON_MANIFEST_FILTER_BTN_LABEL_ACTIVE =
  'reson-manifest-filter-btn-label reson-manifest-filter-btn-label--active';
export const RESON_MANIFEST_SLICE_CHIP = 'reson-manifest-slice-chip';
export const RESON_MANIFEST_SLICE_CHIP_ACTIVE =
  'reson-manifest-slice-chip reson-manifest-slice-chip--active';
export const RESON_MANIFEST_SLICE_CHIP_DOT_ACTIVE = 'reson-manifest-slice-chip-dot-active';
export const RESON_MANIFEST_SLICE_PANEL_ACTION = 'reson-manifest-slice-panel-action';
export const RESON_MANIFEST_ACCENT_TEXT = 'reson-manifest-accent-text';
export const RESON_MANIFEST_ACCENT_BADGE = 'reson-manifest-accent-badge';
export const RESON_MANIFEST_DIFFICULTY_CHIP_ALL_ACTIVE =
  'reson-manifest-slice-chip reson-manifest-difficulty-chip--all-active';
export const RESON_FILTER_PANEL_TOOLTIP = 'reson-filter-panel-tooltip';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP = 'reson-overview-significance-tooltip';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_TITLE = 'reson-overview-significance-tooltip-title';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_DESC = 'reson-overview-significance-tooltip-desc';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUTS = 'reson-overview-significance-tooltip-callouts';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT = 'reson-overview-significance-tooltip-callout';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_SIGNIFICANT =
  'reson-overview-significance-tooltip-callout reson-overview-significance-tooltip-callout--significant';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_NOT_SIGNIFICANT =
  'reson-overview-significance-tooltip-callout reson-overview-significance-tooltip-callout--not-significant';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_TITLE =
  'reson-overview-significance-tooltip-callout-title';
export const RESON_OVERVIEW_SIGNIFICANCE_TOOLTIP_CALLOUT_DESC =
  'reson-overview-significance-tooltip-callout-desc';
export const RESON_MANIFEST_CHART_HEADER_ICON = 'reson-manifest-chart-header-icon';
export const RESON_MANIFEST_ORACLE_METRIC_ORACLE = 'reson-manifest-oracle-metric-oracle';
export const RESON_MANIFEST_ORACLE_METRIC_GAP = 'reson-manifest-oracle-metric-gap';
export const RESON_MANIFEST_ORACLE_CALLOUT = 'reson-manifest-oracle-callout';
export const RESON_MANIFEST_ORACLE_TABLE_HEAD = 'reson-manifest-oracle-table-head';
export const RESON_MANIFEST_ORACLE_TABLE_ROW = 'reson-manifest-oracle-table-row';
export const RESON_MANIFEST_ORACLE_TABLE_NAME = 'reson-manifest-oracle-table-name';
export const RESON_MANIFEST_ORACLE_TABLE_CELL = 'reson-manifest-oracle-table-cell';
export const RESON_MANIFEST_ORACLE_CHART_TOOLTIP = 'reson-manifest-oracle-chart-tooltip';

export function resonAnalyticsViewToggleClass(active: boolean): string {
  return active
    ? 'reson-analytics-view-toggle reson-analytics-view-toggle--active'
    : 'reson-analytics-view-toggle';
}
