import { useMemo, useState } from 'react';
import type { Commit } from '../types';
import { parseMessage } from '../utils';

interface DayData {
  dateKey: string;
  date: Date;
  count: number;
  commits: Commit[];
}

interface Props {
  commits: Commit[];
}

const CELL = 11;
const GAP = 2;
const STRIDE = CELL + GAP;
const LEFT_OFFSET = 22;
const TOP_OFFSET = 20;
const MIN_WEEKS = 8;
const MAX_WEEKS = 104;

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function snapToSunday(d: Date, direction: 'floor' | 'ceil'): Date {
  const day = d.getDay(); // 0=Sun
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  if (direction === 'floor') {
    result.setDate(result.getDate() - day);
  } else {
    result.setDate(result.getDate() + (day === 0 ? 0 : 7 - day));
  }
  return result;
}

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function formatTooltipDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function abbrev(hash: string): string {
  return hash.slice(0, 7);
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) + '…' : s;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_LABELS: [number, string][] = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']];

export function CommitHeatmap({ commits }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: DayData } | null>(null);

  const { weeks, svgWidth } = useMemo(() => {
    if (commits.length === 0) return { weeks: [], svgWidth: 0 };

    const dayMap = new Map<string, DayData>();
    let minTs = Infinity;
    let maxTs = -Infinity;

    for (const c of commits) {
      const d = new Date(c.date);
      if (isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const key = toDateKey(d);
      const ts = d.getTime();
      if (ts < minTs) minTs = ts;
      if (ts > maxTs) maxTs = ts;
      const existing = dayMap.get(key);
      if (existing) {
        existing.count++;
        existing.commits.push(c);
      } else {
        dayMap.set(key, { dateKey: key, date: new Date(d), count: 1, commits: [c] });
      }
    }

    if (minTs === Infinity) return { weeks: [], svgWidth: 0 };

    let start = snapToSunday(new Date(minTs), 'floor');
    let end = snapToSunday(new Date(maxTs), 'ceil');

    // Clamp to min/max week range
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekCount = Math.round((end.getTime() - start.getTime()) / msPerWeek);
    if (weekCount < MIN_WEEKS) {
      end = new Date(start.getTime() + MIN_WEEKS * msPerWeek);
    } else if (weekCount > MAX_WEEKS) {
      start = new Date(end.getTime() - MAX_WEEKS * msPerWeek);
    }

    const totalWeeks = Math.round((end.getTime() - start.getTime()) / msPerWeek);
    const weekCols: (DayData | null)[][] = [];

    for (let w = 0; w < totalWeeks; w++) {
      const col: (DayData | null)[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(start.getTime() + (w * 7 + dow) * 24 * 60 * 60 * 1000);
        const key = toDateKey(d);
        col.push(dayMap.get(key) ?? { dateKey: key, date: new Date(d), count: 0, commits: [] });
      }
      weekCols.push(col);
    }

    return {
      weeks: weekCols,
      svgWidth: LEFT_OFFSET + totalWeeks * STRIDE,
    };
  }, [commits]);

  if (commits.length === 0 || weeks.length === 0) {
    return <div className="heatmap-container" style={{ height: 56, display: 'flex', alignItems: 'center' }} />;
  }

  const svgHeight = TOP_OFFSET + 7 * STRIDE;

  // Build month labels: place at first cell of each new month
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((col, wi) => {
    const month = col[0]!.date.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ x: LEFT_OFFSET + wi * STRIDE, label: MONTH_NAMES[month] });
      lastMonth = month;
    }
  });

  return (
    <div className="heatmap-container">
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: 'block', fontFamily: 'inherit' }}
      >
        {/* Day-of-week labels */}
        {DOW_LABELS.map(([dow, label]) => (
          <text
            key={dow}
            x={LEFT_OFFSET - 4}
            y={TOP_OFFSET + dow * STRIDE + CELL - 1}
            fontSize={9}
            fill="var(--text-muted)"
            textAnchor="end"
          >
            {label}
          </text>
        ))}

        {/* Month labels */}
        {monthLabels.map(({ x, label }) => (
          <text
            key={label + x}
            x={x}
            y={TOP_OFFSET - 6}
            fontSize={9}
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ))}

        {/* Day cells */}
        {weeks.map((col, wi) =>
          col.map((day, dow) => {
            if (!day) return null;
            const level = getLevel(day.count);
            return (
              <rect
                key={day.dateKey}
                x={LEFT_OFFSET + wi * STRIDE}
                y={TOP_OFFSET + dow * STRIDE}
                width={CELL}
                height={CELL}
                rx={2}
                fill={`var(--heat-${level})`}
                style={{ cursor: day.count > 0 ? 'pointer' : 'default' }}
                onMouseEnter={day.count > 0 ? (e) => {
                  setTooltip({ x: e.clientX, y: e.clientY, day });
                } : undefined}
                onMouseMove={day.count > 0 ? (e) => {
                  setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                } : undefined}
                onMouseLeave={day.count > 0 ? () => setTooltip(null) : undefined}
              />
            );
          })
        )}
      </svg>

      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{
            left: tooltip.x > window.innerWidth * 0.65
              ? tooltip.x - 320
              : tooltip.x + 12,
            top: tooltip.y + 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
            {formatTooltipDate(tooltip.day.date)}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
              {tooltip.day.count} commit{tooltip.day.count !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
            {tooltip.day.commits.slice(0, 5).map(c => {
              const { author, message } = parseMessage(c.message);
              return (
                <div key={c.hash} style={{ display: 'flex', gap: 6, color: 'var(--text-secondary)', marginTop: 2 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{abbrev(c.hash)}</span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{truncate(author ?? c.author_name, 16)}</span>
                  <span>{truncate(message, 40)}</span>
                </div>
              );
            })}
            {tooltip.day.commits.length > 5 && (
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                +{tooltip.day.commits.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
