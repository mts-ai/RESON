const DEFAULT_OPTIONS = [10, 25, 50, 100] as const;

interface PageSizeSelectStyles {
  labelBaseClass: string;
  labelDarkClass?: string;
  selectBaseClass: string;
  selectDarkClass?: string;
}

export interface PageSizeSelectBaseProps {
  value: number;
  onChange: (size: number) => void;
  isDark: boolean;
  options?: readonly number[];
  id?: string;
  styles: PageSizeSelectStyles;
}

export function PageSizeSelectBase({
  value,
  onChange,
  isDark,
  options = DEFAULT_OPTIONS,
  id = 'page-size',
  styles,
}: PageSizeSelectBaseProps) {
  const labelClass = `${styles.labelBaseClass}${isDark && styles.labelDarkClass ? ` ${styles.labelDarkClass}` : ''}`;
  const selectClass = `${styles.selectBaseClass}${isDark && styles.selectDarkClass ? ` ${styles.selectDarkClass}` : ''}`;

  return (
    <label htmlFor={id} className={labelClass}>
      <span>На странице</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={selectClass}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
