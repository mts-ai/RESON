import type { TabType } from '../contexts/NavigationContext';

export type VocabSubTab =
  | 'summary'
  | 'analytics'
  | 'visualizations'
  | 'falseFriends'
  | 'replacements';

export interface AppHashRoute {
  tab: TabType;
  vocabSubTab?: VocabSubTab;
  word?: string;
}

const VOCAB_SUB_TABS = new Set<VocabSubTab>([
  'summary',
  'analytics',
  'visualizations',
  'falseFriends',
  'replacements',
]);

const TAB_ALIASES: Record<string, TabType> = {
  overview: 'overview',
  vocab: 'vocabulary',
  vocabulary: 'vocabulary',
  analytics: 'analytics',
  manifest: 'manifest',
};

function decodePart(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function parseAppHash(hash: string): AppHashRoute | null {
  const raw = hash.replace(/^#/, '').trim();
  if (!raw) return null;

  const parts = raw.split('/').filter(Boolean).map(decodePart);
  const tabKey = parts[0]?.toLowerCase();
  const tab = TAB_ALIASES[tabKey];
  if (!tab) return null;

  if (tab !== 'vocabulary') {
    return { tab };
  }

  // #vocab/word/hello  OR  #vocabulary/analytics/word/hello
  if (parts[1] === 'word' && parts[2]) {
    return { tab, vocabSubTab: 'analytics', word: parts.slice(2).join('/') };
  }

  if (parts[1] && VOCAB_SUB_TABS.has(parts[1] as VocabSubTab)) {
    const vocabSubTab = parts[1] as VocabSubTab;
    if (parts[2] === 'word' && parts[3]) {
      return { tab, vocabSubTab, word: parts.slice(3).join('/') };
    }
    return { tab, vocabSubTab };
  }

  return { tab, vocabSubTab: 'summary' };
}

export function buildAppHash(route: AppHashRoute): string {
  if (route.tab === 'overview') return '#overview';
  if (route.tab === 'analytics') return '#analytics';
  if (route.tab === 'manifest') return '#manifest';

  const sub = route.vocabSubTab ?? 'summary';
  if (route.word) {
    const encoded = encodeURIComponent(route.word);
    if (sub === 'analytics') {
      return `#vocab/word/${encoded}`;
    }
    return `#vocabulary/${sub}/word/${encoded}`;
  }
  if (sub === 'summary') return '#vocabulary';
  return `#vocabulary/${sub}`;
}

export function readAppHashRoute(): AppHashRoute | null {
  if (typeof window === 'undefined') return null;
  return parseAppHash(window.location.hash);
}

export function writeAppHashRoute(route: AppHashRoute, replace = false): void {
  if (typeof window === 'undefined') return;
  const next = buildAppHash(route);
  if (window.location.hash === next) return;
  if (replace) {
    window.history.replaceState(null, '', next);
  } else {
    window.location.hash = next.slice(1);
  }
}
