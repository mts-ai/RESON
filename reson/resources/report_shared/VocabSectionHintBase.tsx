import { useEffect, useRef, useState, type ComponentType } from 'react';

export interface VocabHintItem {
  color: string;
  label: string;
  range?: string;
  description: string;
}

interface VocabSectionHintBaseProps {
  isDark: boolean;
  triggerText: string;
  panelTitle: string;
  panelSubtitle: string;
  panelAriaLabel: string;
  items: VocabHintItem[];
  compact?: boolean;
  scrollable?: boolean;
  HelpIcon: ComponentType<{ className?: string }>;
  SparklesIcon: ComponentType<{ className?: string }>;
}

export function VocabSectionHintBase({
  isDark,
  triggerText,
  panelTitle,
  panelSubtitle,
  panelAriaLabel,
  items,
  compact = false,
  scrollable = false,
  HelpIcon,
  SparklesIcon,
}: VocabSectionHintBaseProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div
      className={`reson-vocab-hint ${isDark ? 'reson-vocab-hint--dark' : ''} ${compact ? 'reson-vocab-hint--compact' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`reson-vocab-hint-trigger ${open ? 'reson-vocab-hint-trigger--open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={compact ? triggerText : undefined}
      >
        <span className="reson-vocab-hint-trigger-icon">
          <HelpIcon className="w-3.5 h-3.5" />
        </span>
        {!compact && (
          <span className="reson-vocab-hint-trigger-text">{triggerText}</span>
        )}
      </button>

      {open && (
        <>
          <div
            className="reson-vocab-hint-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`reson-vocab-hint-panel ${scrollable ? 'reson-vocab-hint-panel--scrollable' : ''}`}
            role="dialog"
            aria-label={panelAriaLabel}
          >
            <div className="reson-vocab-hint-panel-header">
              <span className="reson-vocab-hint-panel-badge">
                <SparklesIcon className="w-3 h-3" />
              </span>
              <div>
                <p className="reson-vocab-hint-panel-title">{panelTitle}</p>
                <p className="reson-vocab-hint-panel-subtitle">{panelSubtitle}</p>
              </div>
            </div>

            <ul className="reson-vocab-hint-list">
              {items.map((item) => (
                <li key={item.label} className="reson-vocab-hint-item">
                  <span
                    className="reson-vocab-hint-item-accent"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="reson-vocab-hint-item-body">
                    <div className="reson-vocab-hint-item-top">
                      <span className="reson-vocab-hint-item-label">{item.label}</span>
                      {item.range && (
                        <span className="reson-vocab-hint-item-range">{item.range}</span>
                      )}
                    </div>
                    <p className="reson-vocab-hint-item-desc">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
