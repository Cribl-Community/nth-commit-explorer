import { fetchCommitFiles, fetchFileDiff } from './api';
import type { Commit, DiffBlock, DiffFile, FlatFile } from './types';
import { isDefaultPath, parseMessage } from './utils';

function openInTab(html: string): void {
  const tab = window.open('about:blank');
  if (tab) { tab.document.write(html); tab.document.close(); }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function stateLabel(state?: string): string {
  const map: Record<string, string> = { A: 'Added', D: 'Deleted', M: 'Modified', R: 'Renamed' };
  return state ? (map[state.toUpperCase()] ?? state) : '';
}

function renderDiff(diffFiles: DiffFile[]): string {
  if (!diffFiles.length) return '<p class="diff-empty">No diff available.</p>';
  const parts: string[] = [];
  for (const f of diffFiles) {
    if (f.isBinary) {
      parts.push('<p class="diff-binary">Binary file — diff not shown.</p>');
      continue;
    }
    if (f.isTooBig) {
      parts.push('<p class="diff-binary">File too large — diff not shown.</p>');
      continue;
    }
    if (!f.blocks?.length) {
      parts.push('<p class="diff-empty">No changes.</p>');
      continue;
    }
    parts.push('<table class="diff-table"><tbody>');
    for (const block of f.blocks as DiffBlock[]) {
      parts.push(`<tr class="diff-hdr"><td></td><td></td><td class="diff-code">${esc(block.header)}</td></tr>`);
      for (const line of block.lines) {
        if (line.type === 'insert') {
          parts.push(`<tr class="diff-ins"><td class="diff-num"></td><td class="diff-num">${line.newNumber}</td><td class="diff-code">+${esc(line.content)}</td></tr>`);
        } else if (line.type === 'delete') {
          parts.push(`<tr class="diff-del"><td class="diff-num">${line.oldNumber}</td><td class="diff-num"></td><td class="diff-code">-${esc(line.content)}</td></tr>`);
        } else {
          parts.push(`<tr class="diff-ctx"><td class="diff-num">${line.oldNumber}</td><td class="diff-num">${line.newNumber}</td><td class="diff-code"> ${esc(line.content)}</td></tr>`);
        }
      }
    }
    parts.push('</tbody></table>');
  }
  return parts.join('\n');
}

function renderFile(f: FlatFile, diffFiles: DiffFile[], error: string | null): string {
  const stateClass = { A: 'state-a', D: 'state-d', M: 'state-m', R: 'state-r' }[f.state?.toUpperCase() ?? ''] ?? '';
  const body = error
    ? `<p class="diff-error">Error loading diff: ${esc(error)}</p>`
    : renderDiff(diffFiles);
  return `
<details class="file">
  <summary class="file-hdr">
    <span class="file-state ${stateClass}">${esc(f.state?.slice(0, 1).toUpperCase() ?? '·')}</span>
    <span class="file-path">${esc(f.path)}</span>
    <span class="file-state-label">${esc(stateLabel(f.state))}</span>
  </summary>
  <div class="file-body">${body}</div>
</details>`;
}

function renderCommit(
  commit: Commit,
  files: Array<{ file: FlatFile; diffs: DiffFile[]; error: string | null }>,
  filesError: string | null,
  counts: { a: number; d: number; m: number },
): string {
  const { author: parsedAuthor, message } = parseMessage(commit.message);
  const author = parsedAuthor ?? commit.author_name;
  const hash = commit.hash.slice(0, 7);

  const filesHtml = filesError
    ? `<p class="diff-error">Error loading files: ${esc(filesError)}</p>`
    : files.map(({ file, diffs, error }) => renderFile(file, diffs, error)).join('\n');

  return `
<details class="commit">
  <summary class="commit-hdr">
    <span class="commit-counts">${counts.a} Add/${counts.m} Mod/${counts.d} Del</span>
    <span class="commit-hash">${esc(hash)}</span>
    <span class="commit-author">${esc(author)}</span>
    <span class="commit-date">${esc(formatDate(commit.date))}</span>
    <span class="commit-msg">${esc(message)}</span>
  </summary>
  <div class="commit-body">${filesHtml}</div>
</details>`;
}

function buildHtml(
  groupId: string,
  generatedAt: string,
  totalCommits: number,
  added: number,
  deleted: number,
  changed: number,
  commitsHtml: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Commit Report — ${esc(groupId)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#24292e;background:#f6f8fa;line-height:1.5}
h1{font-size:18px;font-weight:600;margin-bottom:4px}
.meta{font-size:12px;color:#6a737d;margin-bottom:20px}
.page{max-width:1200px;margin:0 auto;padding:24px 20px}

/* summary strip */
.summary{display:flex;gap:20px;background:#fff;border:1px solid #e1e4e8;border-radius:6px;padding:16px 20px;margin-bottom:24px;flex-wrap:wrap}
.stat{display:flex;flex-direction:column;align-items:center;min-width:80px}
.stat .n{font-size:24px;font-weight:700;color:#24292e}
.stat .lbl{font-size:11px;color:#6a737d;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}

/* commits */
.commit{background:#fff;border:1px solid #e1e4e8;border-radius:6px;margin-bottom:10px;overflow:hidden}
.commit-hdr{display:flex;align-items:baseline;gap:10px;padding:10px 14px;cursor:pointer;list-style:none;user-select:none}
.commit-hdr::-webkit-details-marker{display:none}
.commit-hdr::before{content:'▶';font-size:10px;color:#6a737d;flex-shrink:0;transition:transform .15s}
details[open]>.commit-hdr::before{transform:rotate(90deg)}
.commit-counts{font-size:11px;color:#6a737d;font-family:'SFMono-Regular',Consolas,monospace;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:3px;padding:1px 6px;flex-shrink:0;white-space:nowrap}
.commit-hash{font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;background:#f1f8ff;color:#0366d6;padding:1px 5px;border-radius:3px;flex-shrink:0}
.commit-author{font-weight:600;font-size:12px;color:#24292e;flex-shrink:0}
.commit-date{font-size:11px;color:#6a737d;flex-shrink:0}
.commit-msg{font-size:13px;color:#24292e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.commit-body{padding:0 14px 12px}

/* files */
.file{border:1px solid #e1e4e8;border-radius:4px;margin-bottom:6px;overflow:hidden}
.file-hdr{display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;background:#f6f8fa;list-style:none;user-select:none}
.file-hdr::-webkit-details-marker{display:none}
.file-hdr::before{content:'▶';font-size:9px;color:#6a737d;flex-shrink:0;transition:transform .15s}
details[open]>.file-hdr::before{transform:rotate(90deg)}
.file-state{font-family:monospace;font-size:11px;font-weight:700;width:16px;text-align:center;flex-shrink:0}
.state-a{color:#22863a}.state-d{color:#cb2431}.state-m{color:#e36209}.state-r{color:#0366d6}
.file-path{font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;color:#24292e;word-break:break-all;flex:1}
.file-state-label{font-size:11px;color:#6a737d;flex-shrink:0}
.file-body{overflow-x:auto}

/* diff */
.diff-table{width:100%;border-collapse:collapse;font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;line-height:1.45}
.diff-num{width:44px;min-width:44px;padding:0 6px;text-align:right;color:#babbbd;border-right:1px solid #eaecef;user-select:none;white-space:nowrap}
.diff-code{padding:0 10px;white-space:pre;word-break:break-all;overflow-wrap:anywhere}
.diff-ins td{background:#e6ffed}.diff-ins .diff-code{color:#22863a}
.diff-ins .diff-num{background:#cdffd8}
.diff-del td{background:#ffeef0}.diff-del .diff-code{color:#cb2431}
.diff-del .diff-num{background:#ffdce0}
.diff-ctx td{background:#fff}.diff-ctx .diff-code{color:#24292e}
.diff-hdr td{background:#dbedff;color:#032f62;font-style:italic}
.diff-empty,.diff-binary,.diff-error{padding:10px 14px;font-size:12px;color:#6a737d;font-style:italic}
.diff-error{color:#cb2431}
.dl-btn{position:fixed;top:16px;right:20px;background:#0366d6;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;z-index:999;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.dl-btn:hover{background:#0256b4}
</style>
</head>
<body>
<div class="page">
  <h1>Commit Report — ${esc(groupId)}</h1>
  <p class="meta">Generated ${esc(generatedAt)}</p>

  <div class="summary">
    <div class="stat"><span class="n">${totalCommits}</span><span class="lbl">Commits</span></div>
    <div class="stat"><span class="n">${added}</span><span class="lbl">Added</span></div>
    <div class="stat"><span class="n">${deleted}</span><span class="lbl">Deleted</span></div>
    <div class="stat"><span class="n">${changed}</span><span class="lbl">Changed</span></div>
  </div>

  ${commitsHtml}
</div>
<button class="dl-btn" onclick="window.opener&&window.opener.postMessage({type:'nth-commit-download',filename:'commit-report-${esc(groupId)}.html',html:document.documentElement.outerHTML},'*')">Download</button>
</body>
</html>`;
}

function buildSummaryHtml(
  groupId: string,
  generatedAt: string,
  commitRows: Array<{ hash: string; author: string; date: string; monthLabel: string; message: string; cA: number; cD: number; cM: number }>,
  authorMap: Map<string, { commits: number; added: number; deleted: number; modified: number }>,
): string {
  const authorRows = Array.from(authorMap.entries())
    .map(([author, s]) => ({ author, ...s, total: s.added + s.deleted + s.modified }))
    .sort((a, b) => b.total - a.total);

  const authorHtml = authorRows.map((r, i) => `
  <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
    <td>${esc(r.author)}</td>
    <td class="num">${r.commits}</td>
    <td class="num added">${r.added}</td>
    <td class="num modified">${r.modified}</td>
    <td class="num deleted">${r.deleted}</td>
    <td class="num total">${r.total}</td>
  </tr>`).join('');

  let lastMonth = '';
  let rowIndex = 0;
  const commitHtml = commitRows.map(r => {
    const parts: string[] = [];
    if (r.monthLabel !== lastMonth) {
      parts.push(`<tr class="month-divider"><td colspan="7">${esc(r.monthLabel)}</td></tr>`);
      lastMonth = r.monthLabel;
      rowIndex = 0;
    }
    parts.push(`
  <tr class="${rowIndex % 2 === 0 ? 'even' : 'odd'}">
    <td class="hash">${esc(r.hash)}</td>
    <td>${esc(r.author)}</td>
    <td class="date">${esc(r.date)}</td>
    <td class="msg">${esc(r.message)}</td>
    <td class="num added">${r.cA}</td>
    <td class="num modified">${r.cM}</td>
    <td class="num deleted">${r.cD}</td>
  </tr>`);
    rowIndex++;
    return parts.join('');
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Commit Summary — ${esc(groupId)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#24292e;background:#f6f8fa;line-height:1.5}
.page{max-width:1100px;margin:0 auto;padding:24px 20px}
h1{font-size:18px;font-weight:600;margin-bottom:4px}
h2{font-size:14px;font-weight:600;margin:24px 0 8px;color:#24292e}
.meta{font-size:12px;color:#6a737d;margin-bottom:4px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e1e4e8;border-radius:6px;overflow:hidden;margin-bottom:8px}
th{text-align:left;padding:8px 12px;font-size:11px;font-weight:600;color:#6a737d;text-transform:uppercase;letter-spacing:.4px;background:#f6f8fa;border-bottom:1px solid #e1e4e8}
td{padding:7px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top}
tr.even td{background:#fff}
tr.odd td{background:#fafbfc}
tr:last-child td{border-bottom:none}
.num{text-align:right;font-family:'SFMono-Regular',Consolas,monospace;font-size:12px;white-space:nowrap}
.added{color:#22863a}.modified{color:#e36209}.deleted{color:#cb2431}
.total{font-weight:600;color:#24292e}
.hash{font-family:'SFMono-Regular',Consolas,monospace;font-size:11px;color:#0366d6;white-space:nowrap}
.date{white-space:nowrap;color:#6a737d;font-size:12px}
.msg{color:#24292e;max-width:480px}
.month-divider td{background:#f0f4f8;font-weight:600;font-size:12px;color:#444d56;padding:6px 12px;border-top:2px solid #d0d7de;border-bottom:1px solid #e1e4e8}
.dl-btn{position:fixed;top:16px;right:20px;background:#0366d6;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;z-index:999;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.dl-btn:hover{background:#0256b4}
</style>
</head>
<body>
<div class="page">
  <h1>Commit Summary — ${esc(groupId)}</h1>
  <p class="meta">Generated ${esc(generatedAt)} &middot; ${commitRows.length} commit${commitRows.length !== 1 ? 's' : ''}</p>

  <h2>By Author</h2>
  <table>
    <thead><tr><th>Author</th><th>Commits</th><th>Added</th><th>Modified</th><th>Deleted</th><th>Total Files</th></tr></thead>
    <tbody>${authorHtml}</tbody>
  </table>

  <h2>All Commits</h2>
  <table>
    <thead><tr><th>Hash</th><th>Author</th><th>Date</th><th>Message</th><th>+Added</th><th>~Modified</th><th>−Deleted</th></tr></thead>
    <tbody>${commitHtml}</tbody>
  </table>
</div>
<button class="dl-btn" onclick="window.opener&&window.opener.postMessage({type:'nth-commit-download',filename:'commit-summary-${esc(groupId)}.html',html:document.documentElement.outerHTML},'*')">Download</button>
</body>
</html>`;
}

export async function generateSummary(
  commits: Commit[],
  groupId: string,
  excludeDefault: boolean,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const authorMap = new Map<string, { commits: number; added: number; deleted: number; modified: number }>();
  const commitRows: Array<{ hash: string; author: string; date: string; monthLabel: string; message: string; cA: number; cD: number; cM: number }> = [];

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    let commitFiles: FlatFile[] = [];

    try {
      commitFiles = await fetchCommitFiles(groupId, commit.hash);
    } catch { /* skip on error */ }

    const filtered = excludeDefault
      ? commitFiles.filter(f => !isDefaultPath(f.path))
      : commitFiles;

    if (filtered.length === 0) {
      onProgress(i + 1, commits.length);
      continue;
    }

    const cA = filtered.filter(f => f.state?.toUpperCase() === 'A').length;
    const cD = filtered.filter(f => f.state?.toUpperCase() === 'D').length;
    const cM = filtered.filter(f => {
      const s = f.state?.toUpperCase();
      return s === 'M' || s === 'R';
    }).length;

    const { author: parsedAuthor, message } = parseMessage(commit.message);
    const author = parsedAuthor ?? commit.author_name;

    const existing = authorMap.get(author);
    if (existing) {
      existing.commits++;
      existing.added += cA;
      existing.deleted += cD;
      existing.modified += cM;
    } else {
      authorMap.set(author, { commits: 1, added: cA, deleted: cD, modified: cM });
    }

    const d = new Date(commit.date);
    const monthLabel = isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    commitRows.push({
      hash: commit.hash.slice(0, 7),
      author,
      date: formatDate(commit.date),
      monthLabel,
      message,
      cA,
      cD,
      cM,
    });

    onProgress(i + 1, commits.length);
  }

  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = buildSummaryHtml(groupId, generatedAt, commitRows, authorMap);
  openInTab(html);
}

export async function generateReport(
  commits: Commit[],
  groupId: string,
  excludeDefault: boolean,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  let added = 0, deleted = 0, changed = 0, includedCount = 0;
  const commitBlocks: string[] = [];

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    let commitFiles: FlatFile[] = [];
    let filesError: string | null = null;

    try {
      commitFiles = await fetchCommitFiles(groupId, commit.hash);
    } catch (err) {
      filesError = String(err);
    }

    const filtered = commitFiles.filter(f => {
      if (excludeDefault && isDefaultPath(f.path)) return false;
      return true;
    });

    // Skip commits with no files (unless there was a fetch error)
    if (filtered.length === 0 && !filesError) {
      onProgress(i + 1, commits.length);
      continue;
    }

    // Per-commit counts
    const cA = filtered.filter(f => f.state?.toUpperCase() === 'A').length;
    const cD = filtered.filter(f => f.state?.toUpperCase() === 'D').length;
    const cM = filtered.filter(f => f.state?.toUpperCase() === 'M' || f.state?.toUpperCase() === 'R').length;

    // Accumulate report totals
    added += cA;
    deleted += cD;
    changed += cM;
    includedCount++;

    // Fetch diffs in parallel for this commit's files
    const fileResults = await Promise.all(
      filtered.map(async file => {
        try {
          const diffs = await fetchFileDiff(groupId, commit.hash, file.path);
          return { file, diffs, error: null };
        } catch (err) {
          return { file, diffs: [] as DiffFile[], error: String(err) };
        }
      })
    );

    commitBlocks.push(renderCommit(commit, fileResults, filesError, { a: cA, d: cD, m: cM }));
    onProgress(i + 1, commits.length);
  }

  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = buildHtml(
    groupId,
    generatedAt,
    includedCount,
    added,
    deleted,
    changed,
    commitBlocks.join('\n'),
  );

  openInTab(html);
}
