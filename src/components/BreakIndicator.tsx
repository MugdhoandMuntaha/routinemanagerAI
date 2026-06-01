'use client';

import type { PeriodWithCourse } from '@/types';

function parseTime(t: string): number {
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min break`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h break`;
  return `${h}h ${m}m break`;
}

type Props = {
  periods: PeriodWithCourse[];
};

/**
 * Takes a sorted list of periods and returns an interleaved array
 * with break indicators between non-adjacent periods.
 */
export function getPeriodsWithBreaks(
  periods: PeriodWithCourse[]
): Array<{ type: 'period'; data: PeriodWithCourse } | { type: 'break'; minutes: number; index: number }> {
  if (periods.length === 0) return [];

  const result: Array<{ type: 'period'; data: PeriodWithCourse } | { type: 'break'; minutes: number; index: number }> = [];

  for (let i = 0; i < periods.length; i++) {
    result.push({ type: 'period', data: periods[i] });

    if (i < periods.length - 1) {
      const currentEnd = parseTime(periods[i].start_time) + periods[i].duration_minutes;
      const nextStart = parseTime(periods[i + 1].start_time);
      const gap = nextStart - currentEnd;

      if (gap > 0) {
        result.push({ type: 'break', minutes: gap, index: i });
      }
    }
  }

  return result;
}

export default function BreakIndicator({ minutes }: { minutes: number }) {
  return (
    <div className="break-indicator">
      <div className="break-line" />
      <span className="break-label">
        ☕ {formatDuration(minutes)}
      </span>
      <div className="break-line" />
    </div>
  );
}
