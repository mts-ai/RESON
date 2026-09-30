import {
  BarChart3,
  BookOpen,
  FileText,
  PieChart,
  Sun,
  Moon,
  HelpCircle,
  X,
} from "lucide-react";
import { TabType } from "../App";
import { useTheme } from "../contexts/ThemeContext";

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onTourStart?: () => void;
  /** Drawer state on narrow viewports; ignored by the desktop layout. */
  isOpen?: boolean;
  onClose?: () => void;
}

const TOUR_DATA_ATTR: Partial<Record<TabType, string>> = {
  overview: "overview-nav-button",
  vocabulary: "vocabulary-nav-button",
  analytics: "analytics-nav-button",
  manifest: "manifest-nav-button",
};

export function Sidebar({
  activeTab,
  onTabChange,
  onTourStart,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    {
      id: "overview" as TabType,
      label: "Обзор",
      icon: PieChart,
      bgLight: "bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]",
      bgLightInactive: "bg-[#E0F2FE]",
      textLight: "text-white",
      textLightInactive: "text-[#0369A1]",
      bgDark: "bg-gradient-to-r from-[#3B82F6] to-[#60A5FA]",
      shadowDark: "shadow-blue-500/30",
    },
    {
      id: "vocabulary" as TabType,
      label: "Словарь",
      icon: BookOpen,
      bgLight: "bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA]",
      bgLightInactive: "bg-[#F3F0FF]",
      textLight: "text-white",
      textLightInactive: "text-[#6D28D9]",
      bgDark: "bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]",
      shadowDark: "shadow-purple-500/30",
    },
    {
      id: "analytics" as TabType,
      label: "Аналитика",
      icon: BarChart3,
      bgLight: "bg-gradient-to-br from-[#10B981] to-[#34D399]",
      bgLightInactive: "bg-[#D1FAE5]",
      textLight: "text-white",
      textLightInactive: "text-[#047857]",
      bgDark: "bg-gradient-to-r from-[#10B981] to-[#34D399]",
      shadowDark: "shadow-green-500/30",
    },
    {
      id: "manifest" as TabType,
      label: "Манифест",
      icon: FileText,
      bgLight: "bg-gradient-to-br from-[#F59E0B] to-[#FCD34D]",
      bgLightInactive: "bg-[#FEF3C7]",
      textLight: "text-white",
      textLightInactive: "text-[#B45309]",
      bgDark: "bg-gradient-to-r from-[#F59E0B] to-[#FCD34D]",
      shadowDark: "shadow-amber-500/30",
    },
  ];

  return (
    <aside
      data-tour="sidebar"
      className={`reson-sidebar ${isOpen ? "reson-sidebar--open" : ""} ${
        theme === "dark" ? "reson-sidebar--dark" : "reson-sidebar--light"
      } w-[200px] flex flex-col ${
        theme === "dark"
          ? "bg-[#1A1D24] text-white"
          : "bg-white text-gray-900 border-r border-gray-200"
      }`}
    >
      <div className="px-3 py-2.5 border-b border-gray-200 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 shrink-0 rounded-full bg-green-500" />
            <h1
              className={`reson-sidebar-brand truncate ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              MWS AI RESON
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleTheme}
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                theme === "dark"
                  ? "hover:bg-white/10"
                  : "hover:bg-gray-100"
              }`}
              title={
                theme === "light" ? "Темная тема" : "Светлая тема"
              }
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-gray-400" />
              ) : (
                <Sun className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`reson-sidebar-close p-1.5 rounded-lg transition-colors ${
                theme === "dark" ? "hover:bg-white/10" : "hover:bg-gray-100"
              }`}
              aria-label="Закрыть меню"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        <p
          className={`text-[10px] leading-tight ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
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
          const isActive = activeTab === tab.id;
          const tourAttr = TOUR_DATA_ATTR[tab.id];

          if (theme === "dark") {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                data-tour={tourAttr}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? `${tab.bgDark} text-white shadow-lg ${tab.shadowDark}`
                    : "text-gray-300 hover:bg-[#2A2D35]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              data-tour={tourAttr}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? `${tab.bgLight} ${tab.textLight} shadow-md`
                  : `${tab.bgLightInactive} ${tab.textLightInactive} hover:shadow-sm`
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {onTourStart && (
        <div
          className={`p-3 border-t ${
            theme === "dark" ? "border-[#2A2D35]" : "border-gray-200"
          }`}
        >
          <button
            type="button"
            onClick={onTourStart}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
              theme === "dark"
                ? "text-gray-400 hover:bg-[#2A2D35] hover:text-gray-300"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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