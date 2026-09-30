import type { ReactNode } from 'react';
import { HelpCircle } from '../icons';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { RESON_FILTER_PANEL_TOOLTIP } from '../../styles/reportStyles';

type HelpSide = 'top' | 'right' | 'bottom' | 'left';

interface HelpHintProps {
  ariaLabel: string;
  children: ReactNode;
  side?: HelpSide;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function HelpHint({
  ariaLabel,
  children,
  side = 'top',
  align = 'center',
  className = '',
}: HelpHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`reson-help-hint-trigger ${className}`.trim()}
          aria-label={ariaLabel}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={6}
        className={RESON_FILTER_PANEL_TOOLTIP}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

interface InlineHelpTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: HelpSide;
  align?: 'start' | 'center' | 'end';
}

export function InlineHelpTooltip({
  content,
  children,
  side = 'top',
  align = 'center',
}: InlineHelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={6}
        className={RESON_FILTER_PANEL_TOOLTIP}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
