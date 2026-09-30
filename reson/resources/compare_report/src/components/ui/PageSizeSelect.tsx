import { useTheme } from "../ThemeProvider";
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
  id = "page-size",
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
        labelBaseClass: 'reson-vocab-page-select-label',
        labelDarkClass: 'reson-vocab-page-select-label--dark',
        selectBaseClass: 'reson-vocab-page-select',
        selectDarkClass: 'reson-vocab-page-select--dark',
      }}
    />
  );
}
