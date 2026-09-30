import type { ComponentType, ReactNode } from 'react';

export interface HeaderActionButtonBaseProps {
  variant: string;
  title: string;
  hint: string;
  statusLabel?: string;
  icon: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  showStatus?: boolean;
  pressed?: boolean;
  compact?: boolean;
  dataTour?: string;
  ChevronRightIcon: ComponentType<{ className?: string }>;
}

export function HeaderActionButtonBase({
  variant,
  title,
  hint,
  statusLabel,
  icon,
  onClick,
  ariaLabel,
  showStatus = false,
  pressed = false,
  compact = false,
  dataTour,
  ChevronRightIcon,
}: HeaderActionButtonBaseProps) {
  const secondaryText = showStatus && statusLabel ? statusLabel : hint;
  const isHint = !(showStatus && statusLabel);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`reson-header-action reson-header-action--${variant}${
        compact ? ' reson-header-action--compact' : ''
      }${pressed ? ' reson-header-action--pressed' : ''}`}
      aria-label={ariaLabel ?? `${title}. ${secondaryText}`}
      aria-pressed={pressed}
      {...(dataTour ? { 'data-tour': dataTour } : {})}
    >
      <span className="reson-header-action-icon">{icon}</span>
      <span className="reson-header-action-content">
        <span className="reson-header-action-title">{title}</span>
        <span
          className={`reson-header-action-label${
            isHint ? ' reson-header-action-label--hint' : ' reson-header-action-label--active'
          }`}
        >
          {secondaryText}
        </span>
      </span>
      <span className="reson-header-action-chevron" aria-hidden="true">
        <ChevronRightIcon className="w-4 h-4" />
      </span>
    </button>
  );
}
