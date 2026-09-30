import { BarChart3, BookOpen, FileText, PieChart, HelpCircle, Sun, Moon, X } from './icons';
import { useTheme } from './ThemeProvider';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onTourStart?: () => void;
  /** Drawer state on narrow viewports; ignored by the desktop layout. */
  isOpen?: boolean;
  onClose?: () => void;
}

type TabId = 'overview' | 'dictionary' | 'analytics' | 'manifest';

const tabs: Array<{
  id: TabId;
  label: string;
  icon: typeof PieChart;
}> = [
  { id: 'overview', label: 'Обзор', icon: PieChart },
  { id: 'dictionary', label: 'Словарь', icon: BookOpen },
  { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
  { id: 'manifest', label: 'Манифест', icon: FileText },
];

function navClassName(tabId: TabId, isActive: boolean, isDark: boolean): string {
  const base = 'reson-sidebar-nav';
  if (isDark) {
    return isActive
      ? `${base} reson-sidebar-nav-dark-active reson-sidebar-nav-dark-active--${tabId}`
      : `${base} reson-sidebar-nav-dark-inactive`;
  }
  return isActive
    ? `${base} reson-sidebar-nav-light-active reson-sidebar-nav-light-active--${tabId}`
    : `${base} reson-sidebar-nav-light-inactive reson-sidebar-nav-light-inactive--${tabId}`;
}

export function Sidebar({
  activeSection,
  onSectionChange,
  onTourStart,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <aside
      className={`reson-sidebar ${isOpen ? 'reson-sidebar--open' : ''} ${
        isDark ? 'reson-sidebar--dark' : 'reson-sidebar--light'
      } w-[200px] flex flex-col ${
        isDark
          ? 'bg-[#1A1D24] text-white'
          : 'bg-white text-gray-900 border-r border-gray-200'
      }`}
      data-tour="sidebar"
    >
      <div className="px-3 py-2.5 border-b border-gray-200 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 shrink-0 rounded-full bg-green-500" />
            <h1 className={`reson-sidebar-brand truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
              MWS AI RESON
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
              title={isDark ? 'Светлая тема' : 'Темная тема'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-gray-400" />
              ) : (
                <Moon className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`reson-sidebar-close p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
              aria-label="Закрыть меню"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        <p
          className={`text-[10px] leading-tight ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
          title="Research Engine for Speech & Observation Notes"
        >
          Research Engine for
          <br />
          Speech &amp; Observation Notes
        </p>
      </div>

      <nav className="flex flex-col gap-2 p-3 flex-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSectionChange(tab.id)}
              className={navClassName(tab.id, isActive, isDark)}
              data-tour={
                tab.id === 'dictionary'
                  ? 'vocabulary-nav-button'
                  : tab.id === 'overview'
                    ? 'overview-nav-button'
                    : tab.id === 'analytics'
                      ? 'analytics-nav-button'
                      : 'manifest-nav-button'
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {onTourStart && (
        <div className="p-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onTourStart}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
              isDark
                ? 'text-gray-400 hover:bg-[#2A2D35] hover:text-gray-300'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Запустить тур
          </button>
        </div>
      )}
    </aside>
  );
}
