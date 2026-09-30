export interface Group {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

export interface Commit {
  hash: string;
  author_name: string;
  author_email: string;
  date: string;
  message: string;
  body?: string;
  refs?: string;
}

export interface GitFile {
  name: string;
  state?: string;
  children?: GitFile[];
}

export interface FlatFile {
  path: string;
  state?: string;
}

export interface DiffLineDelete  { type: 'delete';  oldNumber: number; content: string }
export interface DiffLineInsert  { type: 'insert';  newNumber: number; content: string }
export interface DiffLineContext { type: 'context'; oldNumber: number; newNumber: number; content: string }
export type DiffLine = DiffLineDelete | DiffLineInsert | DiffLineContext;

export interface DiffBlock { header: string; lines: DiffLine[]; newStartLine: number; oldStartLine: number }
export interface DiffFile  { newName: string; oldName: string; blocks: DiffBlock[]; isBinary?: boolean; isNew?: boolean; isDeleted?: boolean; isTooBig?: boolean }

export interface BlameEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}
export type BlameMap = Map<number, BlameEntry | null>;
