import type { Commit, DiffFile, FlatFile, Group } from './types';
import { parseMessage } from './utils';

function apiUrl(): string {
  const url = (window as Window & { CRIBL_API_URL?: string }).CRIBL_API_URL;
  if (!url) throw new Error('CRIBL_API_URL is not available');
  return url;
}

const THEME_KV_KEY = 'theme';

export async function fetchTheme(): Promise<'light' | 'dark' | null> {
  try {
    const res = await fetch(`${apiUrl()}/kvstore/${THEME_KV_KEY}`);
    if (!res.ok) return null;
    const value = (await res.text()).trim();
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export async function saveTheme(theme: 'light' | 'dark'): Promise<void> {
  await fetch(`${apiUrl()}/kvstore/${THEME_KV_KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: theme,
  });
}

export async function summarizeWithCopilot(commits: Commit[]): Promise<string> {
  const lines = commits.map((c, i) => {
    const { message } = parseMessage(c.message);
    const date = new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${i + 1}. [${c.hash.slice(0, 7)}] by ${c.author_name} on ${date}: ${message}`;
  });
  const userQuery = `Summarize the following git commits. Describe overall themes, notable changes, and any patterns:\n\n${lines.join('\n')}`;

  const base = apiUrl();
  let org = '';
  let isCloud = false;
  try {
    const hostname = new URL(base).hostname;
    if (hostname.endsWith('cribl.cloud')) {
      isCloud = true;
      // hostname pattern: main-{org}.cribl.cloud
      org = hostname.split('.')[0].replace(/^main-/, '');
    }
  } catch { /* leave defaults */ }

  const payload = {
    org,
    product: isCloud ? 'saas-stream' : 'stream',
    environment: isCloud ? 'saas' : 'self-hosted',
    uiMode: 'stream',
    isCloud,
    clientTimestamp: Date.now(),
    guid: '',
    copyVersion: 1,
    isDev: false,
    version: '',
    conversationId: crypto.randomUUID(),
    eventType: 'UserQuery',
    eventClass: 'submit',
    surface: 'modalChatbot',
    userQuery,
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: userQuery,
        type: 'agent',
      },
    ],
  };

  const res = await fetch(`${base}/ai/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Copilot request failed (${res.status}): ${errBody}`);
  }
  const raw = await res.text();
  throw new Error(`RAW RESPONSE (${res.status}): ${raw.slice(0, 2000)}`);
}

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${apiUrl()}/master/groups`);
  if (!res.ok) throw new Error(`Failed to fetch groups: ${res.status}`);
  const data = await res.json() as { items?: Group[] };
  return data.items ?? [];
}

export const COMMIT_FETCH_LIMIT = 100;

export async function fetchCommits(groupId: string, count = COMMIT_FETCH_LIMIT): Promise<Commit[]> {
  const res = await fetch(`${apiUrl()}/m/${groupId}/version?count=${count}`);
  if (!res.ok) throw new Error(`Failed to fetch commits: ${res.status}`);
  const data = await res.json() as { items?: Commit[] };
  return data.items ?? [];
}

export async function fetchCommitFiles(groupId: string, commitHash: string): Promise<FlatFile[]> {
  const res = await fetch(`${apiUrl()}/m/${groupId}/version/files?commit=${commitHash}`);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
  const data = await res.json() as { items?: Array<{ items?: import('./types').GitFile[] }> };
  const tree = data.items?.[0]?.items ?? [];
  return flattenTree(tree, '');
}

export async function fetchFileDiff(groupId: string, commitHash: string, filename: string): Promise<DiffFile[]> {
  const url = `${apiUrl()}/m/${groupId}/version/show?commit=${commitHash}&filename=${encodeURIComponent(filename)}&diffLineLimit=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch diff: ${res.status}`);
  const data = await res.json() as { items?: Array<{ diffJson?: DiffFile[] }> };
  return data.items?.[0]?.diffJson ?? [];
}

export const DEFAULT_BLAME_DEPTH = 50;

export async function fetchBlameHistory(
  groupId: string,
  filePath: string,
  currentCommitHash: string,
  depth: number,
  loadedCommits: Commit[],
): Promise<Array<{ commit: Commit; diffFiles: DiffFile[] }>> {
  const loadedIdx = loadedCommits.findIndex(c => c.hash === currentCommitHash);
  const idx = Math.max(loadedIdx, 0);

  // loadedCommits is a prefix of full history from HEAD. If it's not deep enough
  // to cover the requested look-back, re-fetch that same prefix, just deeper —
  // blame's reach is independent of however many commits the group list loaded.
  const pool = loadedIdx >= 0 && loadedCommits.length >= idx + depth
    ? loadedCommits
    : await fetchCommits(groupId, idx + depth);

  // pool is newest-first; take from idx forward (older) up to the requested depth
  const slice = pool.slice(idx, idx + depth);
  // reverse to chronological (oldest first)
  const chronological = [...slice].reverse();

  const results = await Promise.all(
    chronological.map(async commit => {
      try {
        const diffFiles = await fetchFileDiff(groupId, commit.hash, filePath);
        return { commit, diffFiles };
      } catch {
        return { commit, diffFiles: [] as DiffFile[] };
      }
    })
  );
  return results;
}

function flattenTree(nodes: import('./types').GitFile[], prefix: string): FlatFile[] {
  const result: FlatFile[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, path));
    } else {
      result.push({ path, state: node.state });
    }
  }
  return result;
}
