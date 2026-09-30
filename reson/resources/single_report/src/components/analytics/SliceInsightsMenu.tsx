import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';

interface SliceInsightsMenuProps {
  highlights: string[];
  isDark: boolean;
  title?: string;
  subtitle?: string;
  popoverTitle?: string;
  layout?: 'inline' | 'stacked';
}

export function SliceInsightsMenu({
  highlights,
  isDark,
  title = 'Инсайты среза',
  subtitle,
  popoverTitle = 'Инсайты текущего среза',
  layout = 'inline',
}: SliceInsightsMenuProps) {
  const isStacked = layout === 'stacked';
  const subtitleText = subtitle ?? `${highlights.length} наблюдений`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || isStacked) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, isStacked]);

  return (
    <div
      className={`reson-slice-insights-menu ${isStacked ? 'reson-slice-insights-menu--stacked' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`reson-slice-insights-trigger ${open ? 'reson-slice-insights-trigger--open' : ''} ${isDark ? 'reson-slice-insights-trigger--dark' : ''} ${isStacked ? 'reson-slice-insights-trigger--stacked' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="reson-slice-insights-icon">
          <Lightbulb className="w-3.5 h-3.5" />
        </span>
        <span className="reson-slice-insights-text">
          <span className="reson-slice-insights-title">{title}</span>
          <span className="reson-slice-insights-sub">{subtitleText}</span>
        </span>
        <ChevronDown className={`reson-slice-insights-chevron ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`reson-slice-insights-popover ${isStacked ? 'reson-slice-insights-popover--stacked' : ''} ${
            isDark ? 'reson-slice-insights-popover--dark' : ''
          }`}
        >
          <p className={`reson-slice-insights-popover-title ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {popoverTitle}
          </p>
          <ul className="reson-slice-insights-list">
            {highlights.map((highlight) => (
              <li key={highlight} className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
