import { useEffect, useState } from 'react';
import { summarizeWithCopilot } from '../api';
import type { Commit } from '../types';
import { parseMessage } from '../utils';

interface Props {
  commits: Commit[];
  warning: string | null;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CopilotSummary({ commits, warning, onClose }: Props) {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function runSummary() {
    setStatus('loading');
    setText('');
    setError('');
    summarizeWithCopilot(commits)
      .then(result => { setText(result); setStatus('done'); })
      .catch(err => { setError(String(err)); setStatus('error'); });
  }

  useEffect(() => { runSummary(); }, []);

  const authors = Array.from(new Set(commits.map(c => parseMessage(c.message).author ?? c.author_name))).join(', ');
  const newest = commits[0] ? formatDate(commits[0].date) : '';
  const oldest = commits[commits.length - 1] ? formatDate(commits[commits.length - 1].date) : '';
  const dateRange = newest === oldest ? newest : `${oldest} – ${newest}`;

  return (
    <div className="summary-panel">
      <div className="summary-header">
        <span className="summary-title">Copilot Summary</span>
        <button className="summary-close-btn" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="summary-context">
        {commits.length} commit{commits.length !== 1 ? 's' : ''} · {dateRange}
        {authors && <> · {authors}</>}
      </div>

      {warning && (
        <div className="summary-warning">{warning}</div>
      )}

      <div className="summary-body">
        {status === 'loading' && (
          <div className="summary-loading">
            <div className="summary-spinner" />
            Asking Copilot…
          </div>
        )}
        {status === 'done' && (
          <div className="summary-text">{text}</div>
        )}
        {status === 'error' && (
          <div className="summary-error">
            <div className="summary-error-msg">{error}</div>
            <button className="back-btn" onClick={runSummary}>Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
