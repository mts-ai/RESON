import type { DiffToken } from '../types/data';

type ThemeMode = 'light' | 'dark';

const TOKEN_CLASS: Record<string, Record<ThemeMode, string>> = {
  equal: {
    light: 'text-sm text-gray-700',
    dark: 'text-sm text-gray-200',
  },
  ins: {
    light:
      'text-sm text-green-700 bg-green-100/80 border border-green-300 rounded px-1.5 py-0.5 font-medium',
    dark:
      'text-sm text-green-400 bg-green-900/30 border border-green-700/60 rounded px-1.5 py-0.5 font-medium',
  },
  del: {
    light:
      'text-sm text-red-700 bg-red-100/80 border border-red-300 rounded px-1.5 py-0.5 line-through font-medium',
    dark:
      'text-sm text-red-400 bg-red-900/30 border border-red-700/60 rounded px-1.5 py-0.5 line-through font-medium',
  },
  sub_del: {
    light:
      'text-sm text-yellow-600 bg-yellow-200/90 border border-yellow-400 rounded px-1.5 py-0.5 line-through font-medium',
    dark:
      'text-sm text-yellow-600 bg-yellow-200/90 border border-yellow-400 rounded px-1.5 py-0.5 line-through font-medium',
  },
  sub_ins: {
    light:
      'text-sm text-blue-700 bg-blue-100/80 border border-blue-300 rounded px-1.5 py-0.5 font-medium',
    dark:
      'text-sm text-blue-700 bg-blue-100/80 border border-blue-300 rounded px-1.5 py-0.5 font-medium',
  },
};

export interface DiffTokensViewProps {
  tokens?: DiffToken[];
  reference?: string;
  prediction?: string;
  theme?: ThemeMode;
}

function tokenClass(type: string, theme: ThemeMode): string {
  return TOKEN_CLASS[type]?.[theme] ?? TOKEN_CLASS.equal[theme];
}

/** Renders backend diff_tokens; without tokens shows REF/HYP as plain text. */
export function DiffTokensView({
  tokens,
  reference = '',
  prediction = '',
  theme = 'light',
}: DiffTokensViewProps) {
  if (tokens && tokens.length > 0) {
    return (
      <span className="inline-flex flex-wrap gap-1 leading-relaxed">
        {tokens.map((item, idx) => (
          <span
            key={`diff-${idx}-${item.word}-${item.type}`}
            className={tokenClass(item.type, theme)}
          >
            {item.word}
          </span>
        ))}
      </span>
    );
  }

  const refTextClass =
    theme === 'dark' ? 'mt-1 text-gray-200' : 'mt-1 text-gray-800';
  const labelClass =
    theme === 'dark'
      ? 'text-xs font-medium text-gray-400'
      : 'text-xs font-medium text-gray-500';

  return (
    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      <div>
        <span className={labelClass}>REF</span>
        <p className={refTextClass}>{reference || '—'}</p>
      </div>
      <div>
        <span className={labelClass}>HYP</span>
        <p className={refTextClass}>{prediction || '—'}</p>
      </div>
    </div>
  );
}
