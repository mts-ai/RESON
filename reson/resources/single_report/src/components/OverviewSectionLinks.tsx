import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BarChart3, BookOpen, FileText } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigationOptional, type TabType } from '../contexts/NavigationContext';

type SectionLink = {
  tab: TabType;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
};

const SECTION_LINKS: SectionLink[] = [
  {
    tab: 'vocabulary',
    title: 'Словарь',
    description:
      'Покрытие слов, recall по лексике и ложные друзья — поможет найти системные пропуски и слабые места распознавания',
    icon: BookOpen,
    iconClass: 'reson-overview-link-icon--vocabulary',
  },
  {
    tab: 'analytics',
    title: 'Аналитика',
    description:
      'Сводка датасета, срезы по WER и длительности, распределения — для поиска паттернов и проблемных сегментов',
    icon: BarChart3,
    iconClass: 'reson-overview-link-icon--analytics',
  },
  {
    tab: 'manifest',
    title: 'Манифест',
    description:
      'Каждый пример с аудио, расшифровкой и метриками — для разбора конкретных ошибок и проверки гипотез',
    icon: FileText,
    iconClass: 'reson-overview-link-icon--manifest',
  },
];

export function OverviewSectionLinks() {
  const { theme } = useTheme();
  const { navigateToTab } = useNavigationOptional();
  const isDark = theme === 'dark';

  return (
    <section className="reson-overview-links mt-8" data-tour="overview-section-links">
      <div className="reson-overview-links-header">
        <h2
          className={`reson-overview-links-title ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Разделы отчёта
        </h2>
        <p
          className={`reson-overview-links-subtitle ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Продолжите анализ — перейдите в смежный раздел
        </p>
      </div>

      <div className="reson-overview-links-grid">
        {SECTION_LINKS.map((link) => {
          const Icon = link.icon;

          return (
            <button
              key={link.tab}
              type="button"
              onClick={() => navigateToTab(link.tab)}
              className={`reson-overview-link-card group ${
                isDark
                  ? 'reson-overview-link-card--dark'
                  : 'reson-overview-link-card--light'
              }`}
            >
              <div className={`reson-overview-link-icon ${link.iconClass}`}>
                <Icon className="w-5 h-5" strokeWidth={2} aria-hidden />
              </div>

              <h3
                className={`reson-overview-link-title ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {link.title}
              </h3>

              <p
                className={`reson-overview-link-desc ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {link.description}
              </p>

              <span
                className={`reson-overview-link-arrow ${
                  isDark
                    ? 'text-gray-500 group-hover:text-gray-300'
                    : 'text-gray-400 group-hover:text-gray-600'
                }`}
                aria-hidden
              >
                <ArrowRight className="w-5 h-5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
