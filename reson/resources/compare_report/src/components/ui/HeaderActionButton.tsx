import type { ReactNode } from 'react';
import { ChevronRight } from '../icons';
import { HeaderActionButtonBase } from '../../../../report_shared/HeaderActionButtonBase';

export type HeaderActionVariant = 'analytics' | 'manifest' | 'leaderboard';

interface HeaderActionButtonProps {
  variant: HeaderActionVariant;
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
}

export function HeaderActionButton({
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
}: HeaderActionButtonProps) {
  return (
    <HeaderActionButtonBase
      variant={variant}
      title={title}
      hint={hint}
      statusLabel={statusLabel}
      icon={icon}
      onClick={onClick}
      ariaLabel={ariaLabel}
      showStatus={showStatus}
      pressed={pressed}
      compact={compact}
      dataTour={dataTour}
      ChevronRightIcon={ChevronRight}
    />
  );
}
