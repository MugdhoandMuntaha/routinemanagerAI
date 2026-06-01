'use client';

import { useState, useEffect } from 'react';
import type { PeriodWithCourse } from '@/types';

type Props = {
  periods: PeriodWithCourse[];
};

function parseTime(t: string): number {
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function formatTime12(t: string): string {
  const parts = t.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function AgendaWidget({ periods }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (periods.length === 0) return null;

  const currentMin = now.getHours() * 60 + now.getMinutes();

  // Find ongoing class
  const ongoing = periods.find((p) => {
    const start = parseTime(p.start_time);
    const end = start + p.duration_minutes;
    return currentMin >= start && currentMin < end;
  });

  // Find next upcoming class
  const upcoming = periods
    .filter((p) => parseTime(p.start_time) > currentMin)
    .sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time))[0];

  const target = ongoing || upcoming;
  if (!target) return null;

  // Calculate time remaining
  let diffMin: number;
  let label: string;

  if (ongoing) {
    const endMin = parseTime(ongoing.start_time) + ongoing.duration_minutes;
    diffMin = endMin - currentMin;
    label = 'ends in';
  } else {
    diffMin = parseTime(upcoming.start_time) - currentMin;
    label = 'starts in';
  }

  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  const secs = 59 - now.getSeconds();

  // Calculate progress percentage
  let percent = 0;
  if (ongoing) {
    const start = parseTime(ongoing.start_time);
    const elapsedSeconds = (currentMin - start) * 60 + now.getSeconds();
    const totalSeconds = ongoing.duration_minutes * 60;
    percent = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100));
  } else if (upcoming) {
    const gapMin = parseTime(upcoming.start_time) - currentMin;
    const gapSec = gapMin * 60 - now.getSeconds();
    const maxWindow = 60 * 60; // 1 hour countdown window
    percent = Math.min(100, Math.max(0, 100 - (gapSec / maxWindow) * 100));
  }

  return (
    <div
      className="agenda-widget"
      style={{
        animation: 'countdownPulse 4s ease-in-out infinite',
        border: '1px solid var(--border-glass)',
        position: 'relative',
      }}
    >
      {/* HUD corner bracket overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '6px', borderTop: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '6px', height: '6px', borderTop: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '6px', height: '6px', borderBottom: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '6px', height: '6px', borderBottom: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' }} />

      {/* Decorative background aura */}
      <div
        style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${target.course_color || '#6366f1'}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            {ongoing ? (
              <span className="status-badge status-ongoing" style={{ fontSize: '0.6rem' }}>
                <span className="pulse-dot" style={{ width: '4px', height: '4px' }} />
                Ongoing
              </span>
            ) : (
              <span className="status-badge status-upcoming" style={{ fontSize: '0.6rem' }}>
                Up Next
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              SYS: OK
            </span>
          </div>

          {/* Course Name */}
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em',
            }}
          >
            {target.course_name}
          </h3>

          {/* Time & Room */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: target.course_color || 'var(--accent)' }}>
              {formatTime12(target.start_time)}
            </span>
            {target.room_number && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {target.room_number}
              </span>
            )}
          </div>
        </div>

        {/* Circular Timer & Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Circular SVG Ring */}
          <svg width="38" height="38" viewBox="0 0 38 38" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            {/* Base track */}
            <circle
              cx="19"
              cy="19"
              r="16"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="2.5"
            />
            {/* Progress track */}
            <circle
              cx="19"
              cy="19"
              r="16"
              fill="none"
              stroke={target.course_color || 'var(--accent)'}
              strokeWidth="2.5"
              strokeDasharray="100.5"
              strokeDashoffset={100.5 - (percent / 100) * 100.5}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.8s ease',
                filter: `drop-shadow(0 0 3px ${target.course_color || 'var(--accent)'}50)`,
              }}
            />
          </svg>

          {/* Numeric timer */}
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
              {label}
            </span>
            <div className="agenda-countdown">
              {hours > 0 && <span>{hours}h </span>}
              <span>{mins.toString().padStart(2, '0')}:</span>
              <span>{secs.toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
