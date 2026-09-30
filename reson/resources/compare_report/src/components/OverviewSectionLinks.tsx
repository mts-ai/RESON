import { BarChart3, BookOpen, ChevronRight, FileText } from './icons';
import { useTheme } from './ThemeProvider';
import type { AppSection } from '../utils/hashNavigation';

type SectionLink = {
  section: Exclude<AppSection, 'overview'>;
  title: string;
  description: string;
  icon: typeof BookOpen;
  iconClass: string;
};

const SECTION_LINKS: SectionLink[] = [
  {
    section: 'dictionary',
    title: 'Словарь',
    description:
      'Сравнение recall и точности по словам между Base, Target и доп. моделями — найдите, где одна модель системно выигрывает или проигрывает',
    icon: BookOpen,
    iconClass: 'reson-overview-link-icon--vocabulary',
  },
  {
    section: 'analytics',
    title: 'Аналитика',
    description:
      'Срезы WER, распределения и параллельные координаты по всем выбранным моделям — выявите сегменты, где разрыв между моделями максимален',
    icon: BarChart3,
    iconClass: 'reson-overview-link-icon--analytics',
  },
  {
    section: 'manifest',
    title: 'Манифест',
    description:
      'Один датасет с расшифровками и метриками по каждой модели — разбор расхождений на уровне записей и Oracle WER',
    icon: FileText,
    iconClass: 'reson-overview-link-icon--manifest',
  },
];

interface OverviewSectionLinksProps {
  onSectionChange: (section: AppSection) => void;
}

export function OverviewSectionLinks({ onSectionChange }: OverviewSectionLinksProps) {
  const { theme } = useTheme();
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
          Углубите сравнение моделей — перейдите в смежный раздел
        </p>
      </div>

      <div className="reson-overview-links-grid">
        {SECTION_LINKS.map((link) => {
          const Icon = link.icon;

          return (
            <button
              key={link.section}
              type="button"
              onClick={() => onSectionChange(link.section)}
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
                <ChevronRight className="w-5 h-5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
