'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCourse } from '@/context/CourseContext';
import { useSemester } from '@/context/SemesterContext';
import { useRoutine } from '@/context/RoutineContext';
import type { PeriodWithCourse } from '@/types';
import { DAY_NAMES, DURATION_OPTIONS, ACCENT_COLORS } from '@/types';

type Props = {
  onClose: () => void;
  onSave: (data: {
    course_id: string;
    recurrence_type: 'weekly' | 'one-time';
    day_of_week: number | null;
    specific_date: string | null;
    start_time: string;
    duration_minutes: number;
    room_number: string;
  }) => void;
  editingPeriod?: PeriodWithCourse | null;
  defaultDay: number;
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

export default function AddPeriodModal({
  onClose,
  onSave,
  editingPeriod,
  defaultDay,
}: Props) {
  const { courses, addCourse } = useCourse();
  const { activeSemester } = useSemester();
  const { periods } = useRoutine();

  // Course selection
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [showNewCourse, setShowNewCourse] = useState(false);

  // New course fields
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [courseRoom, setCourseRoom] = useState('');
  const [courseColor, setCourseColor] = useState(ACCENT_COLORS[0]);

  // Period fields
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'one-time'>('weekly');
  // Multi-day selection (Feature 1.7)
  const [selectedDays, setSelectedDays] = useState<number[]>([defaultDay]);
  const [specificDate, setSpecificDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [roomNumber, setRoomNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (editingPeriod) {
      setSelectedCourseId(editingPeriod.course_id);
      setRecurrenceType(editingPeriod.recurrence_type);
      setSelectedDays(editingPeriod.day_of_week !== null ? [editingPeriod.day_of_week] : [defaultDay]);
      setSpecificDate(editingPeriod.specific_date ?? '');
      setStartTime(editingPeriod.start_time.substring(0, 5));
      setDurationMinutes(editingPeriod.duration_minutes);
      setRoomNumber(editingPeriod.room_number);
    }
  }, [editingPeriod, defaultDay]);

  // Auto-select first course or show new course form
  useEffect(() => {
    if (!selectedCourseId && courses.length > 0 && !editingPeriod) {
      setSelectedCourseId(courses[0].id);
    } else if (courses.length === 0 && !editingPeriod) {
      setShowNewCourse(true);
    }
  }, [courses, selectedCourseId, editingPeriod]);

  // ─── Conflict Detection (Feature 1.4) ───
  const conflicts = useMemo(() => {
    if (recurrenceType !== 'weekly') return [];

    const newStart = parseTime(startTime);
    const newEnd = newStart + durationMinutes;
    const editingId = editingPeriod?.period_id;

    return periods.filter((p) => {
      if (p.period_id === editingId) return false;
      if (p.recurrence_type !== 'weekly') return false;
      if (!selectedDays.includes(p.day_of_week ?? -1)) return false;

      const pStart = parseTime(p.start_time);
      const pEnd = pStart + p.duration_minutes;

      return newStart < pEnd && pStart < newEnd;
    });
  }, [periods, selectedDays, startTime, durationMinutes, recurrenceType, editingPeriod]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let courseId = selectedCourseId;

    // Create new course if in "new course" mode
    if (showNewCourse) {
      if (!courseName.trim() || !courseCode.trim()) { setSaving(false); return; }
      if (!activeSemester) { setSaving(false); return; }

      const newCourse = await addCourse({
        semester_id: activeSemester.id,
        course_name: courseName.trim(),
        course_code: courseCode.trim(),
        teacher_name: teacherName.trim(),
        room_number: courseRoom.trim(),
        color: courseColor,
        credit_hours: 3.0,
        notes: '',
        sort_order: courses.length,
      });

      if (!newCourse) { setSaving(false); return; }
      courseId = newCourse.id;
    }

    if (!courseId) { setSaving(false); return; }

    if (recurrenceType === 'weekly' && !editingPeriod) {
      // Multi-day: create one period per selected day (Feature 1.7)
      for (const day of selectedDays) {
        await onSave({
          course_id: courseId,
          recurrence_type: 'weekly',
          day_of_week: day,
          specific_date: null,
          start_time: startTime,
          duration_minutes: durationMinutes,
          room_number: roomNumber.trim(),
        });
      }
    } else {
      onSave({
        course_id: courseId,
        recurrence_type: recurrenceType,
        day_of_week: recurrenceType === 'weekly' ? selectedDays[0] : null,
        specific_date: recurrenceType === 'one-time' ? specificDate : null,
        start_time: startTime,
        duration_minutes: durationMinutes,
        room_number: roomNumber.trim(),
      });
    }

    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              background: 'var(--gradient-accent)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {editingPeriod ? 'Edit Class Schedule' : 'Initialize Class'}
          </h2>
          <button
            onClick={onClose}
            className="modal-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Conflict Warning (Feature 1.4) */}
        {conflicts.length > 0 && (
          <div className="conflict-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Conflict Detected
              </span>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                Overlaps with {conflicts.map((c) => c.course_name).join(', ')} ({conflicts.map((c) => formatTime12(c.start_time)).join(', ')})
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* ─── Course Selection ─── */}
          {!showNewCourse ? (
            <div>
              <label className="form-label">Course *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  className="glass-select"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  style={{ flex: 1 }}
                  disabled={courses.length === 0}
                >
                  {courses.length === 0 && <option value="">No courses yet</option>}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.course_code} — {c.course_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCourse(true)}
                  className="btn-primary"
                  style={{ padding: '10px 14px', fontSize: '0.78rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  + New
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                position: 'relative',
              }}
            >
              {/* Corner decor lines for sub-box */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '4px', borderTop: '1.5px solid var(--accent)', borderLeft: '1.5px solid var(--accent)' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '4px', borderTop: '1.5px solid var(--accent)', borderRight: '1.5px solid var(--accent)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '4px', height: '4px', borderBottom: '1.5px solid var(--accent)', borderLeft: '1.5px solid var(--accent)' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '4px', height: '4px', borderBottom: '1.5px solid var(--accent)', borderRight: '1.5px solid var(--accent)' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Register Course
                </span>
                {courses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowNewCourse(false); setSelectedCourseId(courses[0]?.id || ''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textTransform: 'uppercase', letterSpacing: '0.02em' }}
                  >
                    Select existing
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.62rem' }}>Name *</label>
                  <input className="glass-input" type="text" placeholder="Data Structures" value={courseName} onChange={(e) => setCourseName(e.target.value)} required={showNewCourse} autoFocus style={{ padding: '8px 12px', fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.62rem' }}>Code *</label>
                  <input className="glass-input" type="text" placeholder="CSE 211" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required={showNewCourse} style={{ padding: '8px 12px', fontSize: '0.82rem' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.62rem' }}>Teacher</label>
                  <input className="glass-input" type="text" placeholder="Dr. Ahmed" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} style={{ padding: '8px 12px', fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.62rem' }}>Room</label>
                  <input className="glass-input" type="text" placeholder="Room 302" value={courseRoom} onChange={(e) => setCourseRoom(e.target.value)} style={{ padding: '8px 12px', fontSize: '0.82rem' }} />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="form-label" style={{ fontSize: '0.62rem' }}>Interface Accent</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCourseColor(c)}
                      style={{
                        width: '22px', height: '22px', borderRadius: '4px', background: c,
                        border: courseColor === c ? '1.5px solid var(--text-primary)' : '1.5px solid transparent',
                        cursor: 'pointer', transition: 'all 0.25s ease',
                        transform: courseColor === c ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: courseColor === c ? `0 0 8px ${c}88` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Schedule Type Toggle ─── */}
          <div>
            <label className="form-label">Schedule Type</label>
            <div style={{ display: 'flex', gap: '2px', padding: '2px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <button type="button" onClick={() => setRecurrenceType('weekly')} className={`recurrence-tab ${recurrenceType === 'weekly' ? 'active' : ''}`}>
                🔁 Weekly
              </button>
              <button type="button" onClick={() => setRecurrenceType('one-time')} className={`recurrence-tab ${recurrenceType === 'one-time' ? 'active' : ''}`}>
                📅 One-time
              </button>
            </div>
          </div>

          {/* ─── Day Selection (Multi-day for weekly, Feature 1.7) ─── */}
          {recurrenceType === 'weekly' ? (
            <div>
              <label className="form-label">
                {editingPeriod ? 'Day' : 'Days'} *
                {!editingPeriod && (
                  <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.65rem', textTransform: 'lowercase' }}>
                    (select multiple)
                  </span>
                )}
              </label>
              {editingPeriod ? (
                // Single day selector when editing
                <select className="glass-select" value={selectedDays[0]} onChange={(e) => setSelectedDays([Number(e.target.value)])}>
                  {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
                </select>
              ) : (
                // Multi-day checkboxes when adding new
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`day-checkbox ${selectedDays.includes(i) ? 'selected' : ''}`}
                    >
                      <span className="day-checkbox-dot">
                        {selectedDays.includes(i) && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="form-label">Date</label>
              <input className="glass-input" type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} required={recurrenceType === 'one-time'} />
            </div>
          )}

          {/* ─── Time + Duration ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="form-label">Start Time</label>
              <input className="glass-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Duration</label>
              <select className="glass-select" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* ─── Room Override ─── */}
          <div>
            <label className="form-label">
              Room
              <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.65rem', textTransform: 'lowercase' }}>
                (overrides default)
              </span>
            </label>
            <input className="glass-input" type="text" placeholder="Leave blank to use course room" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
          </div>

          {/* ─── Actions ─── */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || (recurrenceType === 'weekly' && selectedDays.length === 0)}
              style={{
                flex: 1,
                opacity: saving || (recurrenceType === 'weekly' && selectedDays.length === 0) ? 0.5 : 1,
              }}
            >
              {saving ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Syncing…
                </span>
              ) : editingPeriod ? 'Update Record' : (
                selectedDays.length > 1 && recurrenceType === 'weekly'
                  ? `Write ${selectedDays.length} slots`
                  : 'Establish slot'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
