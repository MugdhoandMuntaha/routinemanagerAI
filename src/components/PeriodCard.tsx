'use client';

import { useState, useEffect } from 'react';
import type { PeriodWithCourse } from '@/types';
import { useAcademic } from '@/context/AcademicContext';
import { triggerHapticLight, triggerHapticSuccess, triggerHapticWarning } from '@/lib/haptics';

function formatTime(t: string): string {
  // Handle both "HH:MM" and "HH:MM:SS" formats
  const parts = t.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function endTime(start: string, dur: number): string {
  const parts = start.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  const total = h * 60 + m + dur;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
}

type Props = {
  period: PeriodWithCourse;
  index: number;
  onEdit: (p: PeriodWithCourse) => void;
  onDelete: (id: string) => void;
  onView: (p: PeriodWithCourse) => void;
};

export default function PeriodCard({ period, index, onEdit, onDelete, onView }: Props) {
  const { attendance, markAttendance } = useAcademic();
  const accent = period.course_color || '#6366f1';
  const end = endTime(period.start_time, period.duration_minutes);

  // Check if class is currently happening
  const now = new Date();
  const isToday =
    period.recurrence_type === 'weekly'
      ? now.getDay() === period.day_of_week
      : period.specific_date === now.toISOString().split('T')[0];
  const parts = period.start_time.split(':').map(Number);
  const startMin = parts[0] * 60 + parts[1];
  const endMin = startMin + period.duration_minutes;
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const isOngoing = isToday && currentMin >= startMin && currentMin < endMin;

  const [countdownText, setCountdownText] = useState('');

  // Ticker for Class Countdown Widget (6.3)
  useEffect(() => {
    function tick() {
      const rightNow = new Date();
      const isCardToday =
        period.recurrence_type === 'weekly'
          ? rightNow.getDay() === period.day_of_week
          : period.specific_date === rightNow.toISOString().split('T')[0];

      if (!isCardToday) {
        setCountdownText('');
        return;
      }

      const timeParts = period.start_time.split(':').map(Number);
      const startMinutes = timeParts[0] * 60 + timeParts[1];
      const endMinutes = startMinutes + period.duration_minutes;
      const currentMinutes = rightNow.getHours() * 60 + rightNow.getMinutes();

      if (currentMinutes < startMinutes) {
        const diff = startMinutes - currentMinutes;
        if (diff < 60) {
          setCountdownText(`Starts in ${diff}m`);
        } else {
          setCountdownText(`Starts in ${Math.floor(diff / 60)}h ${diff % 60}m`);
        }
      } else if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        const rem = endMinutes - currentMinutes;
        setCountdownText(`Ongoing (${rem}m left)`);
      } else {
        const diff = currentMinutes - endMinutes;
        if (diff < 120) {
          setCountdownText(`Ended ${diff}m ago`);
        } else {
          setCountdownText('');
        }
      }
    }

    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [period]);

  const timezoneOffset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (timezoneOffset * 60 * 1000));
  const todayStr = localDate.toISOString().split('T')[0];

  const attRecord = attendance.find(
    (a) => a.period_id === period.period_id && a.date === todayStr
  );

  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasVibrated, setHasVibrated] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
    setHasVibrated(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - startX;

    // Dampen drag past 80px limit
    let newOffset = diffX;
    if (newOffset > 85) newOffset = 85 + (newOffset - 85) * 0.15;
    if (newOffset < -85) newOffset = -85 + (newOffset + 85) * 0.15;

    setOffsetX(newOffset);

    // Tick haptic when crossing the threshold
    if (Math.abs(newOffset) >= 70 && !hasVibrated) {
      triggerHapticLight();
      setHasVibrated(true);
    } else if (Math.abs(newOffset) < 70 && hasVibrated) {
      setHasVibrated(false);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    if (offsetX >= 70) {
      triggerHapticSuccess();
      onEdit(period);
    } else if (offsetX <= -70) {
      triggerHapticWarning();
      onDelete(period.period_id);
    }

    setOffsetX(0);
    setHasVibrated(false);
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        width: '100%',
        marginBottom: '2px',
      }}
    >
      {/* Background Swipe Actions Panel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '12px',
          zIndex: 0,
          background: 'rgba(255,255,255,0.01)',
          pointerEvents: 'none',
        }}
      >
        {/* Swipe Right Edit Reveal */}
        <div
          style={{
            height: '100%',
            width: '80px',
            background: 'var(--accent-ghost)',
            borderRight: '1px solid var(--accent)',
            borderRadius: '12px 0 0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            fontSize: '0.78rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            opacity: Math.min(1, Math.max(0, offsetX / 60)),
            transition: 'opacity 0.2s ease',
          }}
        >
          ✎ Edit
        </div>

        {/* Swipe Left Delete Reveal */}
        <div
          style={{
            height: '100%',
            width: '80px',
            background: 'rgba(239,68,68,0.12)',
            borderLeft: '1px solid var(--danger)',
            borderRadius: '0 12px 12px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--danger)',
            fontSize: '0.78rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            opacity: Math.min(1, Math.max(0, -offsetX / 60)),
            transition: 'opacity 0.2s ease',
          }}
        >
          ✕ Delete
        </div>
      </div>

      <div
        className="glass-card card-enter"
        style={{
          display: 'flex',
          gap: '14px',
          padding: '16px 18px',
          animationDelay: `${index * 0.05}s`,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1)',
          zIndex: 5,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onView(period)}
      >
      {/* Subtle top-right gradient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Accent bar */}
      <div
        className="period-accent"
        style={{
          background: `linear-gradient(180deg, ${accent}, ${accent}33)`,
          minHeight: '100%',
          width: '3px',
          boxShadow: `0 0 8px ${accent}66`,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: time + ongoing badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: accent,
              letterSpacing: '0.02em',
            }}
          >
            {formatTime(period.start_time)} – {formatTime(end)}
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.03)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {period.duration_minutes}M
          </span>
          {isOngoing && (
            <span className="status-badge status-ongoing" style={{ fontSize: '0.58rem', padding: '1px 6px' }}>
              <span className="pulse-dot" style={{ width: '4px', height: '4px' }} />
              Live
            </span>
          )}
          {/* One-time badge */}
          {period.recurrence_type === 'one-time' && period.specific_date && (
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.15)',
                padding: '1px 6px',
                borderRadius: '4px',
                letterSpacing: '0.02em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              📅 {new Date(period.specific_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {countdownText && (
            <span
              style={{
                fontSize: '0.6rem',
                fontWeight: 800,
                color: isOngoing ? 'var(--accent)' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {countdownText}
            </span>
          )}
        </div>

        {/* Course name */}
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em',
          }}
        >
          {period.course_name}
        </h3>

        {/* Course code + teacher + room */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              color: accent,
              fontWeight: 700,
              background: `${accent}15`,
              padding: '2px 8px',
              borderRadius: '4px',
              border: `1px solid ${accent}25`,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {period.course_code}
          </span>
          {period.teacher_name && (
            <span
              style={{
                fontSize: '0.74rem',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {period.teacher_name}
            </span>
          )}
          {period.room_number && (
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {period.room_number}
            </span>
          )}
        </div>

        {isToday && (
          <div
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              flexWrap: 'wrap',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Attendance:
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => markAttendance(period.period_id, todayStr, 'present')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid',
                  background: attRecord?.status === 'present' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: attRecord?.status === 'present' ? '#10b981' : 'var(--text-muted)',
                  borderColor: attRecord?.status === 'present' ? '#10b981' : 'var(--border-glass)',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Attended
              </button>
              <button
                onClick={() => markAttendance(period.period_id, todayStr, 'absent')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid',
                  background: attRecord?.status === 'absent' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  color: attRecord?.status === 'absent' ? '#ef4444' : 'var(--text-muted)',
                  borderColor: attRecord?.status === 'absent' ? '#ef4444' : 'var(--border-glass)',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Missed
              </button>
              <button
                onClick={() => markAttendance(period.period_id, todayStr, 'cancelled')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid',
                  background: attRecord?.status === 'cancelled' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  color: attRecord?.status === 'cancelled' ? '#f59e0b' : 'var(--text-muted)',
                  borderColor: attRecord?.status === 'cancelled' ? '#f59e0b' : 'var(--border-glass)',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Cancelled
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          alignSelf: 'center',
        }}
      >
        {/* Edit button */}
        <button
          className="btn-action btn-edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(period);
          }}
          title="Edit period"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          className="btn-action btn-delete-action"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(period.period_id);
          }}
          title="Remove period"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  </div>
  );
}
