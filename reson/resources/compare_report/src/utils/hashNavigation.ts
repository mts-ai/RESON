export type AppSection = 'overview' | 'dictionary' | 'analytics' | 'manifest';

export type VocabSubTab = 'summary' | 'metrics' | 'table' | 'replacements';

export type VocabChangeFilter = 'all' | 'improved' | 'worsened' | 'unchanged';

export interface VocabTableFilters {
  q?: string;
  change?: VocabChangeFilter;
  type?: string;
  page?: number;
  size?: number;
}

export interface AppHashRoute {
  section: AppSection;
  vocabSubTab?: VocabSubTab;
  word?: string;
  tableFilters?: VocabTableFilters;
}

const VOCAB_SUB_TABS = new Set<VocabSubTab>([
  'summary',
  'metrics',
  'table',
  'replacements',
]);

const SECTION_ALIASES: Record<string, AppSection> = {
  overview: 'overview',
  dictionary: 'dictionary',
  dict: 'dictionary',
  vocabulary: 'dictionary',
  vocab: 'dictionary',
  analytics: 'analytics',
  manifest: 'manifest',
};

const CHANGE_FILTERS = new Set<VocabChangeFilter>([
  'all',
  'improved',
  'worsened',
  'unchanged',
]);

function decodePart(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function parseTableFilters(params: URLSearchParams): VocabTableFilters | undefined {
  const filters: VocabTableFilters = {};
  const q = params.get('q');
  const change = params.get('change');
  const type = params.get('type');
  const page = params.get('page');
  const size = params.get('size');

  if (q) filters.q = q;
  if (change && CHANGE_FILTERS.has(change as VocabChangeFilter)) {
    filters.change = change as VocabChangeFilter;
  }
  if (type) filters.type = type;
  if (page) {
    const pageNum = Number(page);
    if (Number.isFinite(pageNum) && pageNum > 1) filters.page = pageNum;
  }
  if (size) {
    const sizeNum = Number(size);
    if (Number.isFinite(sizeNum) && sizeNum > 0) filters.size = sizeNum;
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function parseAppHash(hash: string): AppHashRoute | null {
  const raw = hash.replace(/^#/, '').trim();
  if (!raw) return null;

  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodePart);
  const sectionKey = parts[0]?.toLowerCase();
  const section = SECTION_ALIASES[sectionKey];
  if (!section) return null;

  const params = new URLSearchParams(queryPart || '');
  const tableFilters = parseTableFilters(params);

  if (section !== 'dictionary') {
    return { section, tableFilters };
  }

  // #dict/word/hello  OR  #dictionary/table/word/hello
  if (parts[1] === 'word' && parts[2]) {
    const word = parts.slice(2).join('/');
    return {
      section,
      vocabSubTab: 'table',
      word,
      tableFilters,
    };
  }

  if (parts[1] === 'visualization') {
    return { section, vocabSubTab: 'metrics', tableFilters };
  }

  if (parts[1] && VOCAB_SUB_TABS.has(parts[1] as VocabSubTab)) {
    const vocabSubTab = parts[1] as VocabSubTab;
    if (parts[2] === 'word' && parts[3]) {
      const word = parts.slice(3).join('/');
      return {
        section,
        vocabSubTab,
        word,
        tableFilters,
      };
    }
    return { section, vocabSubTab, tableFilters };
  }

  return { section, vocabSubTab: 'summary', tableFilters };
}

export function buildAppHash(route: AppHashRoute): string {
  if (route.section === 'overview') return '#overview';
  if (route.section === 'analytics') return '#analytics';
  if (route.section === 'manifest') return '#manifest';

  const sub = route.vocabSubTab ?? 'summary';
  let path =
    sub === 'summary'
      ? '#dictionary'
      : `#dictionary/${sub}`;

  if (route.word && sub === 'table') {
    path = `#dictionary/table/word/${encodeURIComponent(route.word)}`;
  }

  const params = new URLSearchParams();
  const filters = route.tableFilters;

  if (filters) {
    if (filters.q && filters.q !== route.word) params.set('q', filters.q);
    if (filters.change && filters.change !== 'all') params.set('change', filters.change);
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters.page && filters.page > 1) params.set('page', String(filters.page));
    if (filters.size && filters.size !== 25) params.set('size', String(filters.size));
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
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
