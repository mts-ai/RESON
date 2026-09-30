import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { HeaderActionButtonBase } from "../../../../report_shared/HeaderActionButtonBase";

export type HeaderActionVariant = "overview" | "analytics" | "alerts";

interface HeaderActionButtonProps {
  variant: HeaderActionVariant;
  title: string;
  /** Директивная подсказка, когда нет активного состояния */
  hint: string;
  /** Краткое описание текущего состояния (срез, имя запуска и т.д.) */
  statusLabel?: string;
  icon: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  /** Показать statusLabel вместо hint */
  showStatus?: boolean;
  pressed?: boolean;
  /** Компактный размер для sticky-панели */
  compact?: boolean;
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
      ChevronRightIcon={ChevronRight}
    />
  );
}
