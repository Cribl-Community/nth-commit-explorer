import { useState } from 'react';
import type { BlameMap, DiffFile, DiffLine } from '../types';
import { formatBlameDate } from '../utils';

interface Props {
  files: DiffFile[];
  blameMap?: BlameMap;
}

function lineClass(line: DiffLine): string {
  if (line.type === 'insert') return 'diff-line-insert';
  if (line.type === 'delete') return 'diff-line-delete';
  return 'diff-line-context';
}

function linePrefix(line: DiffLine): string {
  if (line.type === 'insert') return '+';
  if (line.type === 'delete') return '-';
  return ' ';
}

function oldNum(line: DiffLine): string {
  if (line.type === 'delete' || line.type === 'context') return String(line.oldNumber);
  return '';
}

function newNum(line: DiffLine): string {
  if (line.type === 'insert' || line.type === 'context') return String(line.newNumber);
  return '';
}

function BlameCell({ line, blameMap }: { line: DiffLine; blameMap: BlameMap }) {
  if (line.type === 'delete') {
    return <td className="diff-blame" />;
  }

  const lineNo = line.newNumber;
  const entry = blameMap.get(lineNo);

  if (!entry) {
    return <td className="diff-blame diff-blame-unknown">···</td>;
  }

  const author = entry.author.length > 14 ? entry.author.slice(0, 13) + '…' : entry.author;
  return (
    <td className="diff-blame" title={`${entry.hash}\n${entry.author}\n${entry.date}\n${entry.message}`}>
      <span className="blame-hash">{entry.hash.slice(0, 7)}</span>
      {' '}
      <span className="blame-author">{author}</span>
      {' '}
      <span className="blame-date">{formatBlameDate(entry.date)}</span>
    </td>
  );
}

export function DiffViewer({ files, blameMap }: Props) {
  const showBlame = !!blameMap;
  const [blameWidth, setBlameWidth] = useState(190);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = blameWidth;
    const onMove = (ev: MouseEvent) =>
      setBlameWidth(Math.max(80, Math.min(450, startW + ev.clientX - startX)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  if (files.length === 0) {
    return <div className="diff-empty">No diff available.</div>;
  }

  return (
    <div
      className="diff-viewer"
      style={{ '--blame-width': `${blameWidth}px` } as React.CSSProperties}
    >
      {showBlame && (
        <div
          className="blame-resizer"
          style={{ left: blameWidth }}
          onMouseDown={startResize}
        />
      )}
      {files.map((file, fi) => (
        <div key={fi} className="diff-file-section">
          <div className="diff-file-header">
            {file.isNew
              ? `+ ${file.newName}`
              : file.isDeleted
              ? `- ${file.oldName}`
              : file.newName !== file.oldName
              ? `${file.oldName} → ${file.newName}`
              : file.newName}
          </div>

          {file.isBinary && (
            <div className="diff-binary">Binary file — diff not shown</div>
          )}
          {file.isTooBig && (
            <div className="diff-binary">File too large — diff truncated</div>
          )}

          {!file.isBinary && file.blocks.map((block, bi) => (
            <table key={bi} className="diff-table">
              <tbody>
                <tr className="diff-line-header">
                  {showBlame && <td className="diff-blame" />}
                  <td className="diff-line-num" />
                  <td className="diff-line-num" />
                  <td className="diff-content">{block.header}</td>
                </tr>
                {block.lines.map((line, li) => (
                  <tr key={li} className={lineClass(line)}>
                    {showBlame && blameMap && <BlameCell line={line} blameMap={blameMap} />}
                    <td className="diff-line-num">{oldNum(line)}</td>
                    <td className="diff-line-num">{newNum(line)}</td>
                    <td className="diff-content">{linePrefix(line)}{line.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ))}
    </div>
  );
}
