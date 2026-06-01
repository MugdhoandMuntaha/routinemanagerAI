'use client';

import { useState, useEffect } from 'react';
import type { PeriodWithCourse } from '@/types';
import { DAY_FULL_NAMES } from '@/types';
import { useCourse } from '@/context/CourseContext';

function renderMarkdown(text: string) {
  if (!text.trim()) {
    return (
      <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        No course notes saved yet. Click 'Edit Notes' to begin writing.
      </p>
    );
  }

  return text.split('\n').map((line, i) => {
    if (line.startsWith('# ')) {
      return (
        <h1 key={i} style={{ fontSize: '1rem', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--accent)' }}>
          {line.slice(2)}
        </h1>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} style={{ fontSize: '0.9rem', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--accent-2)' }}>
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: '6px', marginLeft: '8px', margin: '2px 0', fontSize: '0.8rem' }}>
          <span>•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    return (
      <p key={i} style={{ margin: '4px 0', minHeight: line.trim() === '' ? '8px' : 'auto', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.4' }}>
        {line}
      </p>
    );
  });
}

function formatTime(t: string): string {
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
  onClose: () => void;
};

export default function PeriodDetailModal({ period, onClose }: Props) {
  const { courses, editCourse } = useCourse();
  const course = courses.find((c) => c.id === period.course_id);

  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState('');

  // Sync state with course data
  useEffect(() => {
    if (course) {
      setNotes(course.notes || '');
    }
  }, [course]);

  const handleSaveNotes = async () => {
    if (course) {
      await editCourse(course.id, { notes });
      setIsEditing(false);
    }
  };

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
  const isUpcoming = isToday && currentMin < startMin;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px' }}
      >
        {/* Close button */}
        {/* Close button */}
        <button
          onClick={onClose}
          className="modal-close-btn"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
          }}
        >
          ✕
        </button>

        {/* Accent header band */}
        <div
          style={{
            height: '3px',
            borderRadius: '4px',
            background: `linear-gradient(90deg, ${accent}, ${accent}55, transparent)`,
            marginBottom: '20px',
            width: '80px',
            boxShadow: `0 0 10px ${accent}66`,
          }}
        />

        {/* Status badge */}
        <div style={{ marginBottom: '16px' }}>
          {isOngoing && (
            <span className="status-badge status-ongoing" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
              <span className="pulse-dot" />
              Ongoing Now
            </span>
          )}
          {isUpcoming && (
            <span className="status-badge status-upcoming" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Upcoming Today
            </span>
          )}
          {!isOngoing && !isUpcoming && (
            <span className="status-badge status-scheduled" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
              Scheduled
            </span>
          )}
        </div>

        {/* Course Name */}
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '4px',
            lineHeight: 1.25,
            textTransform: 'uppercase',
            letterSpacing: '0.01em',
          }}
        >
          {period.course_name}
        </h2>

        {/* Course Code */}
        <span
          className="detail-code-badge"
          style={{
            color: accent,
            background: `${accent}15`,
            borderColor: `${accent}25`,
          }}
        >
          {period.course_code}
        </span>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--border-glass), transparent)',
            margin: '18px 0',
          }}
        />

        {/* Info Grid */}
        <div className="detail-grid">
          {/* Teacher */}
          {period.teacher_name && (
            <div className="detail-item">
              <div className="detail-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <span className="detail-label">Teacher</span>
                <span className="detail-value">{period.teacher_name}</span>
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="detail-item">
            <div className="detail-icon" style={{ background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <span className="detail-label">Schedule</span>
              <span className="detail-value">
                {period.recurrence_type === 'weekly'
                  ? `Every ${DAY_FULL_NAMES[period.day_of_week ?? 0]}`
                  : period.specific_date
                  ? new Date(period.specific_date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'One-time'}
              </span>
            </div>
          </div>

          {/* Time */}
          <div className="detail-item">
            <div className="detail-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <span className="detail-label">Time</span>
              <span className="detail-value">{formatTime(period.start_time)} – {formatTime(end)}</span>
            </div>
          </div>

          {/* Duration */}
          <div className="detail-item">
            <div className="detail-icon" style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 22h14" />
                <path d="M5 2h14" />
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
              </svg>
            </div>
            <div>
              <span className="detail-label">Duration</span>
              <span className="detail-value">{period.duration_minutes} minutes</span>
            </div>
          </div>

          {/* Room */}
          {period.room_number && (
            <div className="detail-item">
              <div className="detail-icon" style={{ background: 'rgba(244, 114, 182, 0.12)', color: '#f472b6' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <span className="detail-label">Room</span>
                <span className="detail-value">{period.room_number}</span>
              </div>
            </div>
          )}
        </div>

        {/* Course Notes Section */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px dashed var(--border-glass)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3
              style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Course Notes
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveNotes}
                    style={{
                      fontSize: '0.65rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setNotes(course?.notes || '');
                      setIsEditing(false);
                    }}
                    style={{
                      fontSize: '0.65rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    fontSize: '0.65rem',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    background: 'transparent',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Edit Notes
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '12px',
              minHeight: '100px',
              maxHeight: '160px',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            {isEditing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write notes here... (Supports # headers and - bullet points)"
                style={{
                  width: '100%',
                  height: '100px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                }}
              />
            ) : (
              <div style={{ fontFamily: 'inherit' }}>
                {renderMarkdown(notes)}
              </div>
            )}
          </div>
        </div>

        {/* Close action */}
        <button
          className="btn-secondary"
          onClick={onClose}
          style={{ width: '100%', marginTop: '24px' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
