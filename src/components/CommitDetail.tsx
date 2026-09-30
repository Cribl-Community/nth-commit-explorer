import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_BLAME_DEPTH, fetchBlameHistory, fetchCommitFiles, fetchFileDiff } from '../api';
import type { BlameMap, Commit, DiffFile, FlatFile } from '../types';
import { buildBlameMap, isDefaultPath, parseMessage } from '../utils';
import { DiffViewer } from './DiffViewer';

interface Props {
  commit: Commit;
  groupId: string;
  commits: Commit[];
  excludeDefault: boolean;
  onExcludeDefaultChange: (v: boolean) => void;
}

function stateLabel(state?: string): string {
  if (!state) return '';
  const map: Record<string, string> = { A: 'added', D: 'deleted', M: 'modified', R: 'renamed' };
  return map[state.toUpperCase()] ?? state;
}

function stateClass(state?: string): string {
  if (!state) return '';
  const map: Record<string, string> = { A: 'state-added', D: 'state-deleted', M: 'state-modified', R: 'state-renamed' };
  return map[state.toUpperCase()] ?? '';
}

function extractPacks(files: FlatFile[]): string[] {
  const packs = new Set<string>();
  for (const f of files) {
    const parts = f.path.split('/');
    if (parts[0] === 'packs' && parts[1]) packs.add(parts[1]);
  }
  return Array.from(packs).sort();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CommitDetail({ commit, groupId, commits, excludeDefault, onExcludeDefaultChange }: Props) {
  const [files, setFiles] = useState<FlatFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState('');
  const [packFilter, setPackFilter] = useState('');

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const [blameMode, setBlameMode] = useState(false);
  const [blameMap, setBlameMap] = useState<BlameMap | null>(null);
  const [blameLoading, setBlameLoading] = useState(false);
  const [blameError, setBlameError] = useState<string | null>(null);
  const [blameDepth, setBlameDepth] = useState(DEFAULT_BLAME_DEPTH);

  useEffect(() => {
    setFiles([]);
    setFileSearch('');
    setPackFilter('');
    setSelectedFile(null);
    setDiffFiles([]);
    setBlameMode(false);
    setBlameMap(null);
    setError(null);
    setLoading(true);
    fetchCommitFiles(groupId, commit.hash)
      .then(setFiles)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [commit.hash, groupId]);

  const packs = useMemo(() => extractPacks(files), [files]);

  const filteredFiles = useMemo(() => {
    const searchLower = fileSearch.toLowerCase();
    return files.filter(f => {
      if (excludeDefault && isDefaultPath(f.path)) return false;
      if (packFilter && !f.path.startsWith(`packs/${packFilter}/`)) return false;
      if (fileSearch && !f.path.toLowerCase().includes(searchLower)) return false;
      return true;
    });
  }, [files, fileSearch, packFilter, excludeDefault]);

  function openFileDiff(path: string) {
    setSelectedFile(path);
    setDiffFiles([]);
    setDiffError(null);
    setBlameMode(false);
    setBlameMap(null);
    setDiffLoading(true);
    fetchFileDiff(groupId, commit.hash, path)
      .then(setDiffFiles)
      .catch(err => setDiffError(String(err)))
      .finally(() => setDiffLoading(false));
  }

  function toggleBlame() {
    if (blameMode) {
      setBlameMode(false);
      return;
    }
    setBlameMode(true);
    setBlameLoading(true);
    setBlameError(null);
    fetchBlameHistory(groupId, selectedFile!, commit.hash, blameDepth, commits)
      .then(history => {
        setBlameMap(buildBlameMap(history));
      })
      .catch(err => {
        setBlameError(String(err));
        setBlameMode(false);
      })
      .finally(() => setBlameLoading(false));
  }

  const { author: parsedAuthor, message: parsedMessage } = parseMessage(commit.message);
  const displayAuthor = parsedAuthor ?? commit.author_name;

  const diffLoaded = !diffLoading && !diffError && diffFiles.length > 0;
  const isBinary = diffFiles[0]?.isBinary ?? false;

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-hash">{commit.hash.slice(0, 7)}</div>
        <div className="detail-meta">
          <span className="detail-author">{displayAuthor}</span>
          <span className="detail-date">{formatDate(commit.date)}</span>
        </div>
        <div className="detail-message">{parsedMessage}</div>
        {commit.body && <div className="detail-body">{commit.body}</div>}
      </div>

      <div className="detail-filters">
        {selectedFile ? (
          <>
            <button className="back-btn" onClick={() => { setSelectedFile(null); setBlameMode(false); setBlameMap(null); }}>
              ← Files
            </button>
            <span className="selected-file-path">{selectedFile}</span>
            {diffLoaded && !isBinary && (
              <>
                <button
                  className={`blame-toggle-btn${blameMode ? ' active' : ''}`}
                  onClick={toggleBlame}
                  disabled={blameLoading}
                >
                  {blameLoading ? 'Loading…' : blameMode ? 'Hide blame' : 'Blame'}
                </button>
                <input
                  className="blame-depth-input"
                  type="number"
                  min={1}
                  value={blameDepth}
                  onChange={e => setBlameDepth(Math.max(1, Number(e.target.value) || 1))}
                  disabled={blameLoading}
                  title="Number of prior commits to search for blame"
                />
                <span className="blame-depth-label">commits back</span>
              </>
            )}
            {blameLoading && <span className="blame-loading">Building blame…</span>}
            {blameError && <span className="blame-error">{blameError}</span>}
          </>
        ) : (
          <>
            <input
              className="filter-input"
              type="text"
              placeholder="Filter files…"
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
            />
            {packs.length > 0 && (
              <select
                className="filter-select"
                value={packFilter}
                onChange={e => setPackFilter(e.target.value)}
              >
                <option value="">All packs</option>
                {packs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={excludeDefault}
                onChange={e => onExcludeDefaultChange(e.target.checked)}
              />
              Exclude default paths
            </label>
            {files.length > 0 && (
              <span className="result-count">{filteredFiles.length} / {files.length} file{files.length !== 1 ? 's' : ''}</span>
            )}
          </>
        )}
      </div>

      {selectedFile ? (
        <div className="diff-scroll">
          {diffLoading && <div className="empty-state">Loading diff…</div>}
          {diffError && <div className="error-state">{diffError}</div>}
          {!diffLoading && !diffError && (
            <DiffViewer
              files={diffFiles}
              blameMap={blameMode && blameMap ? blameMap : undefined}
            />
          )}
        </div>
      ) : (
        <div className="file-list">
          {loading && <div className="empty-state">Loading files…</div>}
          {error && <div className="error-state">{error}</div>}
          {!loading && !error && filteredFiles.length === 0 && files.length > 0 && (
            <div className="empty-state">No files match your filters.</div>
          )}
          {!loading && !error && filteredFiles.map(f => (
            <div key={f.path} className="file-item clickable" onClick={() => openFileDiff(f.path)}>
              <span className={`file-state ${stateClass(f.state)}`} title={stateLabel(f.state)}>
                {f.state?.slice(0, 1).toUpperCase() ?? '·'}
              </span>
              <span className="file-path">{f.path}</span>
              <span className="file-arrow">›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
