'use client';

import { useMemo } from 'react';
import type { PeriodWithCourse } from '@/types';
import { DAY_NAMES } from '@/types';
import { useSettings } from '@/context/SettingsContext';

type Props = {
  periods: PeriodWithCourse[];
  onViewPeriod: (p: PeriodWithCourse) => void;
  friendPeriods?: PeriodWithCourse[];
  compareMode?: boolean;
};

function parseTime(t: string): number {
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12} ${ampm}`;
}

export default function WeeklyGridView({ periods, onViewPeriod, friendPeriods = [], compareMode = false }: Props) {
  const { settings, t } = useSettings();
  const today = new Date().getDay();

  // Create ordered day indices (Feature 7.4)
  const orderedDays = useMemo(() => {
    const start = settings.week_start_day || 0;
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push((start + i) % 7);
    }
    return days;
  }, [settings.week_start_day]);

  // Calculate combined time range (user + friend)
  const { startHour, endHour, weeklyPeriods, friendWeeklyPeriods } = useMemo(() => {
    const weekly = periods.filter((p) => p.recurrence_type === 'weekly');
    const friendWeekly = compareMode
      ? friendPeriods.filter((p) => p.recurrence_type === 'weekly')
      : [];

    if (weekly.length === 0 && friendWeekly.length === 0) {
      return { startHour: 8, endHour: 18, weeklyPeriods: [], friendWeeklyPeriods: [] };
    }

    let minTime = 24 * 60;
    let maxTime = 0;

    const recordTime = (p: PeriodWithCourse) => {
      const start = parseTime(p.start_time);
      const end = start + p.duration_minutes;
      if (start < minTime) minTime = start;
      if (end > maxTime) maxTime = end;
    };

    weekly.forEach(recordTime);
    friendWeekly.forEach(recordTime);

    const sh = Math.max(0, Math.floor(minTime / 60) - 1);
    const eh = Math.min(24, Math.ceil(maxTime / 60) + 1);

    return { startHour: sh, endHour: eh, weeklyPeriods: weekly, friendWeeklyPeriods: friendWeekly };
  }, [periods, friendPeriods, compareMode]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const ROW_HEIGHT = 60; // pixels per hour (heightened slightly to fit side-by-side elements nicely)

  // Group user periods by day
  const periodsByDay = useMemo(() => {
    const map: Record<number, PeriodWithCourse[]> = {};
    for (let d = 0; d < 7; d++) map[d] = [];
    weeklyPeriods.forEach((p) => {
      if (p.day_of_week !== null) {
        map[p.day_of_week].push(p);
      }
    });
    return map;
  }, [weeklyPeriods]);

  // Group friend periods by day
  const friendPeriodsByDay = useMemo(() => {
    const map: Record<number, PeriodWithCourse[]> = {};
    for (let d = 0; d < 7; d++) map[d] = [];
    friendWeeklyPeriods.forEach((p) => {
      if (p.day_of_week !== null) {
        map[p.day_of_week].push(p);
      }
    });
    return map;
  }, [friendWeeklyPeriods]);

  // Calculate common free times in 15-minute intervals
  const commonFreePeriods = useMemo(() => {
    if (!compareMode || friendWeeklyPeriods.length === 0) return [];

    const freeSlots: { day: number; start: number; end: number }[] = [];

    for (let day = 0; day < 7; day++) {
      let isFreeStreak = false;
      let streakStart = 0;

      for (let min = startHour * 60; min < endHour * 60; min += 15) {
        const userBusy = weeklyPeriods.some((p) => {
          if (p.day_of_week !== day) return false;
          const start = parseTime(p.start_time);
          const end = start + p.duration_minutes;
          return min >= start && min < end;
        });

        const friendBusy = friendWeeklyPeriods.some((p) => {
          if (p.day_of_week !== day) return false;
          const start = parseTime(p.start_time);
          const end = start + p.duration_minutes;
          return min >= start && min < end;
        });

        const bothFree = !userBusy && !friendBusy;

        if (bothFree) {
          if (!isFreeStreak) {
            isFreeStreak = true;
            streakStart = min;
          }
        } else {
          if (isFreeStreak) {
            isFreeStreak = false;
            // Record streaks of at least 30 minutes
            if (min - streakStart >= 30) {
              freeSlots.push({ day, start: streakStart, end: min });
            }
          }
        }
      }

      // Flush last streak
      if (isFreeStreak && (endHour * 60 - streakStart >= 30)) {
        freeSlots.push({ day, start: streakStart, end: endHour * 60 });
      }
    }

    return freeSlots;
  }, [weeklyPeriods, friendWeeklyPeriods, compareMode, startHour, endHour]);

  if (weeklyPeriods.length === 0 && friendWeeklyPeriods.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '40px 20px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '60px', height: '60px' }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          No classes registered on this timetable
        </h3>
      </div>
    );
  }

  return (
    <div className="week-grid-container" style={{ border: '1px solid var(--border-glass)', background: 'var(--bg-card)' }}>
      <div className="week-grid" style={{ gridTemplateRows: `auto repeat(${hours.length}, ${ROW_HEIGHT}px)` }}>
        {/* Header row */}
        <div className="week-grid-header-cell" style={{ borderRight: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)' }}>
          ⏰
        </div>
        {orderedDays.map((dayIdx, i) => {
          const name = DAY_NAMES[dayIdx];
          return (
            <div
              key={dayIdx}
              className={`week-grid-header-cell ${dayIdx === today ? 'today' : ''}`}
              style={{
                borderRight: i < 6 ? '1px solid var(--border-glass)' : 'none',
                borderBottom: '1px solid var(--border-glass)',
              }}
            >
              {t(name.toLowerCase())}
            </div>
          );
        })}

        {/* Time rows */}
        {hours.map((hour) => (
          <div key={`row-${hour}`} style={{ display: 'contents' }}>
            {/* Time label */}
            <div className="week-grid-time-cell" style={{ borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-glass)' }}>
              {formatHour(hour)}
            </div>

            {/* Day cells */}
            {orderedDays.map((dayIdx, i) => (
              <div
                key={`${hour}-${dayIdx}`}
                className="week-grid-day-cell"
                style={{
                  borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  position: 'relative',
                }}
              >
                {/* ─── 1. Render Common Free Time Background Glows ─── */}
                {commonFreePeriods
                  .filter((fp) => fp.day === dayIdx && Math.floor(fp.start / 60) === hour)
                  .map((fp, fIdx) => {
                    const offsetMin = fp.start - hour * 60;
                    const top = (offsetMin / 60) * ROW_HEIGHT;
                    const height = ((fp.end - fp.start) / 60) * ROW_HEIGHT;

                    return (
                      <div
                        key={`free-${dayIdx}-${hour}-${fIdx}`}
                        style={{
                          position: 'absolute',
                          left: '4%',
                          width: '92%',
                          top: `${top + 1}px`,
                          height: `${Math.max(height - 2, 8)}px`,
                          background: 'rgba(16, 185, 129, 0.04)',
                          border: '1.5px dashed rgba(16, 185, 129, 0.3)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#10b981',
                          fontWeight: 800,
                          fontSize: '0.52rem',
                          fontFamily: 'var(--font-sans)',
                          letterSpacing: '0.04em',
                          pointerEvents: 'none',
                          zIndex: 1,
                          boxShadow: 'inset 0 0 10px rgba(16, 185, 129, 0.03)',
                        }}
                      >
                        {height > 35 && '🟢 FREE TIME'}
                      </div>
                    );
                  })}

                {/* ─── 2. Render User Periods ─── */}
                {periodsByDay[dayIdx]
                  .filter((p) => {
                    const startMin = parseTime(p.start_time);
                    return Math.floor(startMin / 60) === hour;
                  })
                  .map((p) => {
                    const startMin = parseTime(p.start_time);
                    const offsetMin = startMin - hour * 60;
                    const top = (offsetMin / 60) * ROW_HEIGHT;
                    const height = (p.duration_minutes / 60) * ROW_HEIGHT;
                    const color = p.course_color || '#6366f1';

                    return (
                      <div
                        key={`user-p-${p.period_id}`}
                        className="week-grid-event"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPeriod(p);
                        }}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height - 2, 22)}px`,
                          background: `${color}18`,
                          border: `1px solid ${color}40`,
                          borderLeft: `3px solid ${color}`,
                          color: color,
                          boxShadow: `0 2px 8px ${color}20`,
                          fontFamily: 'var(--font-sans)',
                          fontSize: '0.58rem',
                          padding: '3px 4px',
                          // Side-by-side positioning in compare mode
                          left: compareMode ? '2%' : '3%',
                          width: compareMode ? '45%' : '94%',
                          zIndex: 5,
                        }}
                      >
                        <div className="week-grid-event-title" style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.course_name}
                        </div>
                        {height > 35 && (
                          <div className="week-grid-event-sub" style={{ fontSize: '0.5rem', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                            {p.course_code}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* ─── 3. Render Friend Periods (Compare Mode Only) ─── */}
                {compareMode &&
                  friendPeriodsByDay[dayIdx]
                    .filter((p) => {
                      const startMin = parseTime(p.start_time);
                      return Math.floor(startMin / 60) === hour;
                    })
                    .map((p) => {
                      const startMin = parseTime(p.start_time);
                      const offsetMin = startMin - hour * 60;
                      const top = (offsetMin / 60) * ROW_HEIGHT;
                      const height = (p.duration_minutes / 60) * ROW_HEIGHT;
                      const color = p.course_color || '#10b981';

                      return (
                        <div
                          key={`friend-p-${p.period_id}`}
                          className="week-grid-event"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height - 2, 22)}px`,
                            background: `repeating-linear-gradient(45deg, ${color}05, ${color}05 4px, ${color}12 4px, ${color}12 8px)`,
                            border: `1px dashed ${color}70`,
                            borderLeft: `3px solid ${color}`,
                            color: color,
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.58rem',
                            padding: '3px 4px',
                            // Side-by-side right track
                            left: '52%',
                            width: '45%',
                            zIndex: 5,
                            cursor: 'default',
                          }}
                        >
                          <div className="week-grid-event-title" style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.course_name}
                          </div>
                          <div style={{ fontSize: '0.45rem', fontWeight: 800, opacity: 0.9 }}>
                            (Friend)
                          </div>
                        </div>
                      );
                    })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
