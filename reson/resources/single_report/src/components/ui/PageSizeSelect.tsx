import { useTheme } from '../../contexts/ThemeContext';
import { PageSizeSelectBase } from '../../../../report_shared/PageSizeSelectBase';

interface PageSizeSelectProps {
  value: number;
  onChange: (size: number) => void;
  options?: readonly number[];
  id?: string;
}

export function PageSizeSelect({
  value,
  onChange,
  options,
  id = 'page-size',
}: PageSizeSelectProps) {
  const { theme } = useTheme();

  return (
    <PageSizeSelectBase
      value={value}
      onChange={onChange}
      options={options}
      id={id}
      isDark={theme === 'dark'}
      styles={{
        labelBaseClass: 'reson-caption flex items-center gap-2 text-gray-600',
        labelDarkClass: 'text-gray-400',
        selectBaseClass: 'rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800',
        selectDarkClass: 'border-[#2A2D35] bg-[#23262F] text-gray-200',
      }}
    />
  );
}
