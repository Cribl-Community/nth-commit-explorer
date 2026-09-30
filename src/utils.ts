import type { BlameEntry, BlameMap, Commit, DiffFile } from './types';

export function parseMessage(raw: string): { author: string | null; message: string } {
  const m = raw.match(/^([^:\n]{1,60}):\s+(.+)/s);
  return m ? { author: m[1].trim(), message: m[2].trim() } : { author: null, message: raw };
}

// A "default" path is Cribl-authored boilerplate under the default Worker Group,
// unless it's a "local" override, which is a real user customization even there.
export function isDefaultPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes('default') && !lower.includes('local');
}

function applyDiff(
  oldLines: Array<BlameEntry | null>,
  diff: DiffFile,
  entry: BlameEntry,
): Array<BlameEntry | null> {
  const newLines: Array<BlameEntry | null> = [];
  let oldCursor = 0; // 0-indexed position in oldLines

  for (const block of diff.blocks) {
    const blockOldStart = block.oldStartLine; // 1-based
    // Carry over unchanged lines before this block
    while (oldCursor < blockOldStart - 1) {
      newLines.push(oldLines[oldCursor] ?? null);
      oldCursor++;
    }
    // Apply the block lines
    for (const line of block.lines) {
      if (line.type === 'insert') {
        newLines.push(entry);
      } else if (line.type === 'delete') {
        oldCursor++; // consumed from old, not added to new
      } else {
        // context: carry old blame forward
        newLines.push(oldCursor < oldLines.length ? (oldLines[oldCursor] ?? null) : null);
        oldCursor++;
      }
    }
  }

  // Carry over remaining unchanged lines after the last block
  while (oldCursor < oldLines.length) {
    newLines.push(oldLines[oldCursor] ?? null);
    oldCursor++;
  }

  return newLines;
}

export function buildBlameMap(
  history: Array<{ commit: Commit; diffFiles: DiffFile[] }>,
): BlameMap {
  // history is chronological (oldest first)
  let lines: Array<BlameEntry | null> = [];

  for (const { commit, diffFiles } of history) {
    const file = diffFiles[0];
    if (!file || (!file.blocks.length && !file.isNew)) continue;

    const { author } = parseMessage(commit.message);
    const entry: BlameEntry = {
      hash: commit.hash,
      author: author ?? commit.author_name,
      date: commit.date,
      message: parseMessage(commit.message).message,
    };

    lines = applyDiff(lines, file, entry);
  }

  const result: BlameMap = new Map();
  lines.forEach((entry, i) => result.set(i + 1, entry));
  return result;
}

export function formatBlameDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
