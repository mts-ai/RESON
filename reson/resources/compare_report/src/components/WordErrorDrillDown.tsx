import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, Copy, FileText, Search, X } from './icons';
import { DiffTokensView } from './DiffTokens';
import type { ErrorExamplesUi } from './VocabularyComparison';
import { resolveAudioPath } from '../utils/audioPathHelper';
import {
  buildSubstitutionTargets,
  buildWordContexts,
  CompareManifestEntry,
  findManifestEntry,
  getDisplayErrorCounts,
  getDisplayUtteranceCounts,
  getExamplesForErrorType,
  getExamplesForSubstitutionTarget,
  getSubstitutionStats,
  sumContextCounts,
  SubstitutionTargetSummary,
  WordErrorContext,
} from '../utils/wordErrorHelpers';

type DrillErrorType = 'deletion' | 'insertion' | 'substitution';

type DrillPanel =
  | {
      kind: 'examples';
      errorType: 'deletion' | 'insertion';
      examples: WordErrorContext[];
    }
  | {
      kind: 'substitutions';
      selectedSubstitution: string | null;
    };

interface WordErrorDrillDownProps {
  word: string;
  modelName: string;
  modelDisplayName: string;
  errorExamples?: ErrorExamplesUi;
  manifestEntries: CompareManifestEntry[];
  audioBasePath?: string;
  onPanelOpenChange?: (isOpen: boolean) => void;
}

function audioBasename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function ErrorTypeCards({
  counts,
  utteranceCounts,
  onSelect,
}: {
  counts: { deletions: number; insertions: number; substitutions: number };
  utteranceCounts: { deletions: number; insertions: number; substitutions: number };
  onSelect: (type: DrillErrorType) => void;
}) {
  const formatHint = (errors: number, utterances: number, suffix: string) => {
    if (errors === 0) return suffix;
    if (utterances === errors || utterances <= 1) {
      return `${errors} ${errors === 1 ? 'ошибка' : errors < 5 ? 'ошибки' : 'ошибок'}`;
    }
    return `${errors} ${errors === 1 ? 'ошибка' : errors < 5 ? 'ошибки' : 'ошибок'} · ${utterances} ${utterances === 1 ? 'пример' : utterances < 5 ? 'примера' : 'примеров'}`;
  };

  return (
    <div className="reson-word-error-cards">
      <button
        type="button"
        className="reson-word-error-card reson-word-error-card--del"
        disabled={counts.deletions === 0}
        onClick={() => onSelect('deletion')}
      >
        <span className="reson-word-error-card-label">Удаления</span>
        <strong>{counts.deletions}</strong>
        <span className="reson-word-error-card-hint">
          {formatHint(counts.deletions, utteranceCounts.deletions, 'Слово пропущено моделью')}
        </span>
      </button>
      <button
        type="button"
        className="reson-word-error-card reson-word-error-card--ins"
        disabled={counts.insertions === 0}
        onClick={() => onSelect('insertion')}
      >
        <span className="reson-word-error-card-label">Вставки</span>
        <strong>{counts.insertions}</strong>
        <span className="reson-word-error-card-hint">
          {formatHint(counts.insertions, utteranceCounts.insertions, 'Лишние вхождения в hypothesis')}
        </span>
      </button>
      <button
        type="button"
        className="reson-word-error-card reson-word-error-card--sub"
        disabled={counts.substitutions === 0}
        onClick={() => onSelect('substitution')}
      >
        <span className="reson-word-error-card-label">Замены</span>
        <strong>{counts.substitutions}</strong>
        <span className="reson-word-error-card-hint">
          {formatHint(counts.substitutions, utteranceCounts.substitutions, 'Слово распознано как другое')}
        </span>
      </button>
    </div>
  );
}

function DrillDownShell({
  wide = false,
  onClose,
  header,
  children,
  footer,
}: {
  wide?: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const openedAtRef = useRef(Date.now());
  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  return (
    <div
      className="reson-word-drill-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (Date.now() - openedAtRef.current < 250) return;
        onClose();
      }}
    >
      <div
        className={`reson-word-drill-modal ${wide ? 'reson-word-drill-modal--wide' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        {header}
        <div className="reson-word-drill-content">
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

function ExamplesListContent({
  errorType,
  examples,
  onShowDetail,
}: {
  errorType: 'deletion' | 'insertion';
  examples: WordErrorContext[];
  onShowDetail: (entry: CompareManifestEntry) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const errorTypeLabel = errorType === 'deletion' ? 'Удаления' : 'Вставки';

  const filteredExamples = useMemo(() => {
    if (!searchQuery) return examples;
    const query = searchQuery.toLowerCase();
    return examples.filter(
      (example) =>
        example.file.toLowerCase().includes(query) ||
        example.reference.toLowerCase().includes(query) ||
        example.hypothesis.toLowerCase().includes(query),
    );
  }, [examples, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExamples.length / itemsPerPage));
  const paginatedExamples = filteredExamples.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="reson-word-drill-list-layout">
      <div className="reson-word-drill-search-wrap">
        <Search className="reson-word-drill-search-icon" />
        <input
          type="text"
          className="reson-word-drill-search"
          placeholder="Поиск по тексту..."
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      <div className="reson-word-drill-body">
        {paginatedExamples.length === 0 ? (
          <div className="reson-word-empty-note">
            <span>Примеры не найдены</span>
          </div>
        ) : (
          paginatedExamples.map((example) => (
            <div key={example.id} className="reson-word-drill-example">
              <div className="reson-word-drill-example-main">
                <div className="reson-word-drill-example-meta">
                  <span className={`reson-word-drill-badge reson-word-drill-badge--${errorType}`}>
                    {errorTypeLabel}
                  </span>
                  {example.count > 1 && (
                    <span className="reson-word-drill-count">{example.count}×</span>
                  )}
                  <span className="reson-word-drill-time">{example.time}</span>
                </div>
                <div className="reson-word-drill-example-text">
                  <span><strong>REF:</strong> {example.reference.slice(0, 140)}{example.reference.length > 140 ? '…' : ''}</span>
                  <span><strong>HYP:</strong> {example.hypothesis.slice(0, 140)}{example.hypothesis.length > 140 ? '…' : ''}</span>
                </div>
              </div>
              <button
                type="button"
                className="reson-word-drill-detail-btn"
                onClick={() => onShowDetail({
                  audio_filepath: example.file,
                  duration: Number.parseFloat(example.time) || 0,
                  text: example.reference,
                  prediction: example.hypothesis,
                  wer: 0,
                  insertions: 0,
                  deletions: 0,
                  substitutions: 0,
                })}
              >
                Показать детали
              </button>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="reson-word-drill-footer">
          <span className="reson-word-drill-page-info">
            Страница {currentPage} из {totalPages}
          </span>
          <div className="reson-word-drill-page-actions">
            <button
              type="button"
              className="reson-word-drill-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Назад
            </button>
            <button
              type="button"
              className="reson-word-drill-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubstitutionsListContent({
  substitutions,
  selectedSubstitution,
  onSelectSubstitution,
  examples,
  onShowDetail,
}: {
  substitutions: SubstitutionTargetSummary[];
  selectedSubstitution: string | null;
  onSelectSubstitution: (word: string | null) => void;
  examples: WordErrorContext[];
  onShowDetail: (entry: CompareManifestEntry) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredExamples = useMemo(() => {
    if (!searchQuery) return examples;
    const query = searchQuery.toLowerCase();
    return examples.filter(
      (example) =>
        example.file.toLowerCase().includes(query) ||
        example.reference.toLowerCase().includes(query) ||
        example.hypothesis.toLowerCase().includes(query),
    );
  }, [examples, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExamples.length / itemsPerPage));
  const paginatedExamples = filteredExamples.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="reson-word-sub-modal-layout">
      <div className="reson-word-sub-targets">
        {substitutions.map((target) => (
          <button
            key={target.word}
            type="button"
            className={`reson-word-sub-target ${
              selectedSubstitution === target.word ? 'reson-word-sub-target--active' : ''
            }`}
            onClick={() => {
              onSelectSubstitution(target.word);
              setCurrentPage(1);
              setSearchQuery('');
            }}
          >
            <span>→ {target.word}</span>
            <span className="reson-word-sub-target-meta">
              {target.count}× · {target.percent}%
            </span>
          </button>
        ))}
      </div>

      <div className="reson-word-sub-examples">
        {!selectedSubstitution ? (
          <div className="reson-word-empty-note">
            <span>Выберите вариант замены слева</span>
          </div>
        ) : (
          <>
            <div className="reson-word-drill-search-wrap">
              <Search className="reson-word-drill-search-icon" />
              <input
                type="text"
                className="reson-word-drill-search"
                placeholder="Поиск по тексту..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="reson-word-drill-body">
              {paginatedExamples.map((example) => (
                <div key={example.id} className="reson-word-drill-example">
                  <div className="reson-word-drill-example-main">
                    <div className="reson-word-drill-example-meta">
                      <span className="reson-word-drill-badge reson-word-drill-badge--substitution">
                        → {selectedSubstitution}
                      </span>
                      {example.count > 1 && (
                        <span className="reson-word-drill-count">{example.count}×</span>
                      )}
                      <span className="reson-word-drill-time">{example.time}</span>
                    </div>
                    <div className="reson-word-drill-example-text">
                      <span><strong>REF:</strong> {example.reference.slice(0, 140)}{example.reference.length > 140 ? '…' : ''}</span>
                      <span><strong>HYP:</strong> {example.hypothesis.slice(0, 140)}{example.hypothesis.length > 140 ? '…' : ''}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="reson-word-drill-detail-btn"
                    onClick={() => onShowDetail({
                      audio_filepath: example.file,
                      duration: Number.parseFloat(example.time) || 0,
                      text: example.reference,
                      prediction: example.hypothesis,
                      wer: 0,
                      insertions: 0,
                      deletions: 0,
                      substitutions: 0,
                    })}
                  >
                    Показать детали
                  </button>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="reson-word-drill-footer">
                <span className="reson-word-drill-page-info">
                  Страница {currentPage} из {totalPages}
                </span>
                <div className="reson-word-drill-page-actions">
                  <button
                    type="button"
                    className="reson-word-drill-page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    className="reson-word-drill-page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ExampleDetailContent({
  entry,
  audioBasePath,
}: {
  entry: CompareManifestEntry;
  audioBasePath?: string;
}) {
  const audioUrl = resolveAudioPath(entry.audio_filepath, audioBasePath);
  const audioFileName = audioBasename(entry.audio_filepath);
  const durationType = entry.duration < 5 ? 'short' : entry.duration <= 30 ? 'normal' : 'long';

  return (
    <div className="reson-word-detail-body">
      <div className="reson-word-detail-metrics">
        <div className="reson-word-kpi">
          <span className="reson-word-kpi-label">WER</span>
          <span className="reson-word-kpi-value">{entry.wer.toFixed(2)}%</span>
        </div>
        <div className="reson-word-kpi">
          <span className="reson-word-kpi-label">Длительность</span>
          <span className="reson-word-kpi-value">{entry.duration.toFixed(2)}с</span>
        </div>
        <div className="reson-word-kpi">
          <span className="reson-word-kpi-label">Тип</span>
          <span className="reson-word-kpi-value">{durationType}</span>
        </div>
      </div>

      <div className="reson-word-detail-grid">
        <div className="reson-word-detail-panel">
          <div className="reson-word-section-title">Разница</div>
          <DiffTokensView
            tokens={entry.diff_tokens}
            reference={entry.text}
            prediction={entry.prediction}
          />
        </div>
        <div className="reson-word-detail-stack">
          <div className="reson-word-detail-panel">
            <div className="reson-word-section-title">Reference</div>
            <p className="reson-word-detail-text">{entry.text || '—'}</p>
          </div>
          <div className="reson-word-detail-panel">
            <div className="reson-word-section-title">Hypothesis</div>
            <p className="reson-word-detail-text">{entry.prediction || '—'}</p>
          </div>
        </div>
      </div>

      <div className="reson-word-detail-panel">
        <div className="reson-word-detail-audio-head">
          <div className="reson-word-section-title">Аудио</div>
          <div className="reson-word-detail-audio-path">
            <span title={entry.audio_filepath}>{audioFileName}</span>
            <button
              type="button"
              className="reson-word-drill-copy"
              onClick={() => navigator.clipboard.writeText(entry.audio_filepath)}
              aria-label="Скопировать путь"
            >
              <Copy />
            </button>
          </div>
        </div>
        <audio controls preload="none" className="reson-word-detail-audio" src={audioUrl}>
          Ваш браузер не поддерживает аудио элемент.
        </audio>
      </div>

      <div className="reson-word-error-cards reson-word-error-cards--compact">
        <div className="reson-word-error-card reson-word-error-card--del reson-word-error-card--static">
          <span className="reson-word-error-card-label">DEL</span>
          <strong>{entry.deletions}</strong>
        </div>
        <div className="reson-word-error-card reson-word-error-card--ins reson-word-error-card--static">
          <span className="reson-word-error-card-label">INS</span>
          <strong>{entry.insertions}</strong>
        </div>
        <div className="reson-word-error-card reson-word-error-card--sub reson-word-error-card--static">
          <span className="reson-word-error-card-label">SUB</span>
          <strong>{entry.substitutions}</strong>
        </div>
      </div>
    </div>
  );
}

export function WordErrorDrillDown({
  word,
  modelName,
  modelDisplayName,
  errorExamples,
  manifestEntries,
  audioBasePath,
  onPanelOpenChange,
}: WordErrorDrillDownProps) {
  const [panel, setPanel] = useState<DrillPanel | null>(null);
  const [detailEntry, setDetailEntry] = useState<CompareManifestEntry | null>(null);

  const notifyPanelOpenChange = useCallback((isOpen: boolean) => {
    onPanelOpenChange?.(isOpen);
  }, [onPanelOpenChange]);

  useEffect(() => {
    notifyPanelOpenChange(panel !== null);
  }, [panel, notifyPanelOpenChange]);

  const openPanel = useCallback((nextPanel: DrillPanel) => {
    notifyPanelOpenChange(true);
    setDetailEntry(null);
    setPanel(nextPanel);
  }, [notifyPanelOpenChange]);

  const counts = useMemo(() => getDisplayErrorCounts(errorExamples), [errorExamples]);
  const utteranceCounts = useMemo(() => getDisplayUtteranceCounts(errorExamples), [errorExamples]);
  const substitutionStats = useMemo(
    () => getSubstitutionStats(errorExamples?.substitutions),
    [errorExamples?.substitutions],
  );
  const wordContexts = useMemo(() => buildWordContexts(errorExamples), [errorExamples]);
  const substitutionTargets = useMemo(
    () => buildSubstitutionTargets(errorExamples?.substitutions),
    [errorExamples?.substitutions],
  );

  const selectedSubstitution = panel?.kind === 'substitutions' ? panel.selectedSubstitution : null;
  const substitutionExamples = useMemo(
    () => (selectedSubstitution
      ? getExamplesForSubstitutionTarget(errorExamples?.substitutions, selectedSubstitution)
      : []),
    [errorExamples?.substitutions, selectedSubstitution],
  );

  const resolveManifestEntry = useCallback((partial: CompareManifestEntry): CompareManifestEntry | null => {
    const found = findManifestEntry({ [modelName]: manifestEntries }, modelName, partial.audio_filepath);
    return found ?? partial;
  }, [manifestEntries, modelName]);

  const closePanel = useCallback(() => {
    setPanel(null);
    setDetailEntry(null);
    notifyPanelOpenChange(false);
  }, [notifyPanelOpenChange]);

  const handleShowDetail = useCallback((partial: CompareManifestEntry) => {
    const resolved = resolveManifestEntry(partial);
    if (!resolved) return;
    setDetailEntry(resolved);
  }, [resolveManifestEntry]);

  if (!errorExamples) {
    return (
      <div className="reson-word-empty-note">
        <span>Примеры ошибок недоступны для этой модели</span>
      </div>
    );
  }

  const panelHeader = (() => {
    if (detailEntry) {
      return (
        <div className="reson-word-drill-header">
          <div className="reson-word-drill-header-main">
            <button
              type="button"
              className="reson-word-drill-back"
              onClick={() => setDetailEntry(null)}
              aria-label="Назад к списку"
            >
              <ChevronLeft />
            </button>
            <div className="reson-word-drill-header-icon">
              <FileText />
            </div>
            <div>
              <h3 className="reson-word-drill-title">Детализация примера</h3>
              <p className="reson-word-drill-subtitle">Полный diff, тексты и аудио</p>
            </div>
          </div>
          <button type="button" className="reson-word-modal-close" onClick={closePanel} aria-label="Закрыть">
            <X />
          </button>
        </div>
      );
    }

    if (panel?.kind === 'examples') {
      const label = panel.errorType === 'deletion' ? 'удаления' : 'вставки';
      const totalErrors = sumContextCounts(panel.examples);
      return (
        <div className="reson-word-drill-header">
          <div>
            <h3 className="reson-word-drill-title">Примеры {label}</h3>
            <p className="reson-word-drill-subtitle">
              «{word}» · {modelDisplayName} · {totalErrors} {totalErrors === 1 ? 'ошибка' : totalErrors < 5 ? 'ошибки' : 'ошибок'} · {panel.examples.length} {panel.examples.length === 1 ? 'пример' : panel.examples.length < 5 ? 'примера' : 'примеров'}
            </p>
          </div>
          <button type="button" className="reson-word-modal-close" onClick={closePanel} aria-label="Закрыть">
            <X />
          </button>
        </div>
      );
    }

    if (panel?.kind === 'substitutions') {
      const { totalReplacements, utterances, variants } = substitutionStats;
      return (
        <div className="reson-word-drill-header">
          <div>
            <h3 className="reson-word-drill-title">Анализ замен</h3>
            <p className="reson-word-drill-subtitle">
              «{word}» · {modelDisplayName} · {totalReplacements} {totalReplacements === 1 ? 'замена' : totalReplacements < 5 ? 'замены' : 'замен'} · {utterances} {utterances === 1 ? 'пример' : utterances < 5 ? 'примера' : 'примеров'} · {variants} {variants === 1 ? 'вариант' : variants < 5 ? 'варианта' : 'вариантов'}
            </p>
          </div>
          <button type="button" className="reson-word-modal-close" onClick={closePanel} aria-label="Закрыть">
            <X />
          </button>
        </div>
      );
    }

    return null;
  })();

  return (
    <>
      <ErrorTypeCards
        counts={counts}
        utteranceCounts={utteranceCounts}
        onSelect={(errorType) => {
          if (errorType === 'substitution') {
            openPanel({
              kind: 'substitutions',
              selectedSubstitution: substitutionTargets[0]?.word ?? null,
            });
            return;
          }
          openPanel({
            kind: 'examples',
            errorType,
            examples: getExamplesForErrorType(wordContexts, errorType),
          });
        }}
      />

      {panel && (
        <DrillDownShell
          wide={panel.kind === 'substitutions' && !detailEntry}
          onClose={closePanel}
          header={panelHeader}
        >
          {detailEntry ? (
            <ExampleDetailContent entry={detailEntry} audioBasePath={audioBasePath} />
          ) : panel.kind === 'examples' ? (
            <ExamplesListContent
              errorType={panel.errorType}
              examples={panel.examples}
              onShowDetail={handleShowDetail}
            />
          ) : (
            <SubstitutionsListContent
              substitutions={substitutionTargets}
              selectedSubstitution={panel.selectedSubstitution}
              onSelectSubstitution={(value) => {
                setPanel({ kind: 'substitutions', selectedSubstitution: value });
              }}
              examples={substitutionExamples}
              onShowDetail={handleShowDetail}
            />
          )}
        </DrillDownShell>
      )}
    </>
  );
}
