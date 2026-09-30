import { useEffect, useState } from 'react';
import { COMMIT_FETCH_LIMIT, fetchCommits, fetchGroups, fetchTheme, saveTheme } from './api';
import { CommitDetail } from './components/CommitDetail';
import { CommitHeatmap } from './components/CommitHeatmap';
import { CommitList } from './components/CommitList';
import { CopilotSummary } from './components/CopilotSummary';
import type { Commit, Group } from './types';
import type { PresetId } from './components/CommitList';
import './App.css';

const DEFAULT_WINDOW_DAYS = 30;

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initialDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(today);
  from.setDate(today.getDate() - (DEFAULT_WINDOW_DAYS - 1));
  return { dateFrom: toInputDate(from), dateTo: toInputDate(today) };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>('');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable] = useState(() => !!(window as Window & { CRIBL_API_URL?: string }).CRIBL_API_URL);

  const [summaryView, setSummaryView] = useState<{ commits: Commit[]; warning: string | null } | null>(null);
  const [excludeDefault, setExcludeDefault] = useState(true);
  const [filteredCommits, setFilteredCommits] = useState<Commit[]>([]);

  const [dateFrom, setDateFrom] = useState(() => initialDateRange().dateFrom);
  const [dateTo, setDateTo] = useState(() => initialDateRange().dateTo);
  const [activePreset, setActivePreset] = useState<PresetId | null>('30d');
  const [truncationNotice, setTruncationNotice] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { return false; }
  });

  useEffect(() => {
    if (!apiAvailable) return;
    fetchTheme().then(theme => {
      if (theme) setDarkMode(theme === 'dark');
    });
  }, [apiAvailable]);

  function toggleDark() {
    setDarkMode(prev => {
      const next = !prev;
      if (apiAvailable) saveTheme(next ? 'dark' : 'light').catch(() => { /* best-effort */ });
      return next;
    });
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'nth-commit-download') return;
      const url = URL.createObjectURL(new Blob([e.data.html], { type: 'text/html' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = e.data.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!apiAvailable) return;
    fetchGroups()
      .then(gs => {
        const streamGroups = gs.filter(g => g.type === 'stream');
        setGroups(streamGroups);
        if (streamGroups.length > 0) setGroupId(streamGroups[0].id);
      })
      .catch(err => setError(String(err)));
  }, [apiAvailable]);

  useEffect(() => {
    if (!groupId) return;
    setCommits([]);
    setFilteredCommits([]);
    setSelectedCommit(null);
    setError(null);
    setTruncationNotice(null);
    setLoading(true);
    fetchCommits(groupId)
      .then(fetched => {
        setCommits(fetched);
        // Commit limit always wins over the default window: if the oldest commit
        // we got back is more recent than the window's cutoff, the limit cut us
        // off before reaching the full window, so some history within it is missing.
        const oldest = fetched[fetched.length - 1];
        if (oldest && fetched.length === COMMIT_FETCH_LIMIT) {
          const cutoff = new Date();
          cutoff.setHours(0, 0, 0, 0);
          cutoff.setDate(cutoff.getDate() - DEFAULT_WINDOW_DAYS);
          if (new Date(oldest.date) > cutoff) {
            setTruncationNotice(
              `Showing the ${COMMIT_FETCH_LIMIT} most recent commits, back to ${formatDate(oldest.date)} — fewer than ${DEFAULT_WINDOW_DAYS} days. Older commits within that window aren't loaded.`
            );
          }
        }
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [groupId]);

  const theme = darkMode ? 'dark' : 'light';
  const darkToggle = (
    <button className="dark-toggle" onClick={toggleDark} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
      {darkMode ? '☀' : '☾'}
    </button>
  );

  if (!apiAvailable) {
    return (
      <div className="app-shell" data-theme={theme}>
        <header className="app-header">
          <span className="app-title">Nth Degree Commit Explorer</span>
          {darkToggle}
        </header>
        <div className="no-api">
          <div className="no-api-box">
            <div className="no-api-icon">⚙️</div>
            <h2>Running outside Cribl</h2>
            <p>This app requires <code>CRIBL_API_URL</code> to be set by the Cribl platform. Install and open this app from within Cribl to browse commit history.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <span className="app-title">Nth Degree Commit Explorer</span>
        <div className="group-selector">
          <label htmlFor="group-select">Worker Group</label>
          <select
            id="group-select"
            className="header-select"
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            disabled={groups.length === 0}
          >
            {groups.length === 0 && <option value="">Loading…</option>}
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name || g.id}</option>
            ))}
          </select>
        </div>
        {darkToggle}
      </header>

      {error && <div className="app-error">{error}</div>}
      {truncationNotice && <div className="app-notice">{truncationNotice}</div>}

      <CommitHeatmap commits={filteredCommits} />

      <div className="app-body">
        <div className="left-pane">
          {loading
            ? <div className="empty-state">Loading commits…</div>
            : <CommitList
                commits={commits}
                selectedHash={selectedCommit?.hash ?? null}
                onSelect={commit => { setSummaryView(null); setSelectedCommit(commit); }}
                onSummarize={(commits, warning) => setSummaryView({ commits, warning })}
                groupId={groupId}
                excludeDefault={excludeDefault}
                onExcludeDefaultChange={setExcludeDefault}
                onDisplayedCommitsChange={setFilteredCommits}
                dateFrom={dateFrom}
                dateTo={dateTo}
                activePreset={activePreset}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onActivePresetChange={setActivePreset}
              />
          }
        </div>
        <div className="right-pane">
          {summaryView
            ? <CopilotSummary
                commits={summaryView.commits}
                warning={summaryView.warning}
                onClose={() => setSummaryView(null)}
              />
            : selectedCommit
              ? <CommitDetail commit={selectedCommit} groupId={groupId} commits={commits} excludeDefault={excludeDefault} onExcludeDefaultChange={setExcludeDefault} />
              : (
                <div className="no-selection">
                  <div className="no-selection-text">Select a commit to view changed files</div>
                </div>
              )
          }
        </div>
      </div>
    </div>
  );
}
