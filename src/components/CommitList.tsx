import { useEffect, useMemo, useState } from 'react';
import { fetchCommitFiles } from '../api';
import { generateReport, generateSummary } from '../report';
import type { Commit, FlatFile } from '../types';
import { isDefaultPath, parseMessage } from '../utils';

interface Props {
  commits: Commit[];
  selectedHash: string | null;
  onSelect: (commit: Commit) => void;
  onSummarize: (commits: Commit[], warning: string | null) => void;
  groupId: string;
  excludeDefault: boolean;
  onExcludeDefaultChange: (v: boolean) => void;
  onDisplayedCommitsChange?: (commits: Commit[]) => void;
  dateFrom: string;
  dateTo: string;
  activePreset: PresetId | null;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onActivePresetChange: (v: PresetId | null) => void;
}

interface ParsedCommit {
  commit: Commit;
  author: string;
  message: string;
}

const PRESETS = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '6mo', label: 'Last 6 months' },
] as const;
export type PresetId = typeof PRESETS[number]['id'];

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function abbrev(hash: string): string {
  return hash.slice(0, 7);
}

export function CommitList({ commits, selectedHash, onSelect, onSummarize: _onSummarize, groupId, excludeDefault, onExcludeDefaultChange, onDisplayedCommitsChange, dateFrom, dateTo, activePreset, onDateFromChange, onDateToChange, onActivePresetChange }: Props) {
  const [search, setSearch] = useState('');
  const [author, setAuthor] = useState('');
  const [reportProgress, setReportProgress] = useState<{ done: number; total: number } | null>(null);
  const [summaryProgress, setSummaryProgress] = useState<{ done: number; total: number } | null>(null);
  const [fileCache, setFileCache] = useState<Record<string, FlatFile[] | null>>({});
  const [filesFetching, setFilesFetching] = useState(false);

  const parsed = useMemo<ParsedCommit[]>(() =>
    commits.map(c => {
      const { author: parsedAuthor, message } = parseMessage(c.message);
      return { commit: c, author: parsedAuthor ?? c.author_name, message };
    }),
    [commits]
  );

  const authors = useMemo(() => {
    const set = new Set(parsed.map(p => p.author).filter(Boolean));
    return Array.from(set).sort();
  }, [parsed]);

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;

    return parsed.filter(p => {
      if (author && p.author !== author) return false;
      const ts = new Date(p.commit.date).getTime();
      if (from && ts < from) return false;
      if (to < Infinity && ts > to) return false;
      if (search && !p.message.toLowerCase().includes(searchLower) && !p.author.toLowerCase().includes(searchLower)) return false;
      return true;
    });
  }, [parsed, search, author, dateFrom, dateTo]);

  // Reset cache when the group changes so stale entries don't bleed across groups
  useEffect(() => { setFileCache({}); }, [groupId]);

  // Fetch file lists for commits not yet cached, whenever excludeDefault is on
  useEffect(() => {
    if (!excludeDefault || !groupId) {
      setFilesFetching(false);
      return;
    }
    const toFetch = filtered.filter(p => !(p.commit.hash in fileCache));
    if (toFetch.length === 0) return;

    let cancelled = false;
    setFilesFetching(true);
    Promise.all(
      toFetch.map(p =>
        fetchCommitFiles(groupId, p.commit.hash)
          .then(files => [p.commit.hash, files] as const)
          .catch(() => [p.commit.hash, null] as const)
      )
    ).then(results => {
      if (cancelled) return;
      setFileCache(prev => {
        const next = { ...prev };
        for (const [hash, files] of results) next[hash] = files;
        return next;
      });
    }).finally(() => { if (!cancelled) setFilesFetching(false); });

    return () => { cancelled = true; };
  // fileCache intentionally omitted from deps to avoid a fetch loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeDefault, filtered, groupId]);

  const displayed = useMemo(() => {
    if (!excludeDefault) return filtered;
    return filtered.filter(p => {
      const files = fileCache[p.commit.hash];
      if (files === undefined) return true; // not yet fetched — show optimistically
      if (files === null) return true;      // fetch error — don't hide
      return files.some(f => !isDefaultPath(f.path));
    });
  }, [filtered, excludeDefault, fileCache]);

  useEffect(() => {
    onDisplayedCommitsChange?.(displayed.map(p => p.commit));
  }, [displayed, onDisplayedCommitsChange]);

  function applyPreset(id: PresetId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    if (id === '7d')  from.setDate(today.getDate() - 6);
    if (id === '30d') from.setDate(today.getDate() - 29);
    if (id === '90d') from.setDate(today.getDate() - 89);
    if (id === '6mo') from.setMonth(today.getMonth() - 6);
    onDateFromChange(toInputDate(from));
    onDateToChange(toInputDate(today));
    onActivePresetChange(id);
  }

  return (
    <div className="commit-panel">
      <div className="filters">
        <input
          className="filter-input"
          type="text"
          placeholder="Search message or author…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={author}
          onChange={e => setAuthor(e.target.value)}
        >
          <option value="">All authors</option>
          {authors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="date-presets">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`preset-btn${activePreset === p.id ? ' active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="date-range">
          <input
            className="filter-input date-input"
            type="date"
            value={dateFrom}
            onChange={e => { onDateFromChange(e.target.value); onActivePresetChange(null); }}
            title="From date"
          />
          <span className="date-sep">–</span>
          <input
            className="filter-input date-input"
            type="date"
            value={dateTo}
            onChange={e => { onDateToChange(e.target.value); onActivePresetChange(null); }}
            title="To date"
          />
        </div>
        <div className="summarize-row">
          <span className="result-count">
            {displayed.length} commit{displayed.length !== 1 ? 's' : ''}
            {filesFetching && <span className="files-filtering"> · filtering…</span>}
          </span>
          <label className="toggle-label" title="Ignore Cribl-modified files in the default directories">
            <input type="checkbox" checked={excludeDefault} onChange={e => onExcludeDefaultChange(e.target.checked)} />
            Exclude default paths
          </label>
        </div>
        <div className="action-row">
          <button
            className="report-btn"
            title="Generate a commit summary in a separate window"
            disabled={displayed.length === 0 || summaryProgress !== null || reportProgress !== null}
            onClick={() => {
              const toSummarize = displayed.map(p => p.commit);
              setSummaryProgress({ done: 0, total: toSummarize.length });
              generateSummary(toSummarize, groupId, excludeDefault, (done, total) => setSummaryProgress({ done, total }))
                .finally(() => setSummaryProgress(null));
            }}
          >
            {summaryProgress
              ? `Summarizing… (${summaryProgress.done}/${summaryProgress.total})`
              : 'Generate Summary'}
          </button>
          <button
            className="report-btn"
            title="Generate an interactive report in a separate window of all selected commits"
            disabled={displayed.length === 0 || reportProgress !== null || summaryProgress !== null}
            onClick={() => {
              const toReport = displayed.map(p => p.commit);
              setReportProgress({ done: 0, total: toReport.length });
              generateReport(toReport, groupId, excludeDefault, (done, total) => setReportProgress({ done, total }))
                .finally(() => setReportProgress(null));
            }}
          >
            {reportProgress
              ? `Generating… (${reportProgress.done}/${reportProgress.total})`
              : 'Generate Report'}
          </button>
        </div>
      </div>

      <div className="commit-list">
        {displayed.length === 0 && !filesFetching && (
          <div className="empty-state">No commits match your filters.</div>
        )}
        {displayed.map(({ commit, author: parsedAuthor, message }) => (
          <div
            key={commit.hash}
            className={`commit-item${selectedHash === commit.hash ? ' selected' : ''}`}
            onClick={() => onSelect(commit)}
          >
            <div className="commit-top">
              <span className="commit-hash">{abbrev(commit.hash)}</span>
              <span className="commit-author">{parsedAuthor}</span>
              <span className="commit-date">{formatDate(commit.date)}</span>
            </div>
            <div className="commit-message">{message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
