'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAcademic } from '@/context/AcademicContext';
import { useCourse } from '@/context/CourseContext';
import AddAcademicItemModal from './AddAcademicItemModal';
import type { Assignment, Exam, GradeComponent } from '@/types';

// Helper to format due date
function formatDueDate(isoStr: string | null): string {
  if (!isoStr) return 'No due date';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper to format exam date/time
function formatExamDateTime(dateStr: string | null, timeStr: string | null): string {
  if (!dateStr) return 'Undecided Date';
  const d = new Date(`${dateStr}T00:00:00`);
  const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  if (!timeStr) return dayStr;

  const parts = timeStr.split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${dayStr} @ ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Live ticking countdown for Exams
function ExamCountdown({ examDate, startTime }: { examDate: string | null; startTime: string | null }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!examDate) return;
    const timeStr = startTime ? startTime.substring(0, 5) : '00:00';
    const examDateTime = new Date(`${examDate}T${timeStr}:00`);

    const updateTimer = () => {
      const now = new Date();
      const diff = examDateTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Completed / Ongoing');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${mins}m`);
      parts.push(`${secs}s`);

      setTimeLeft(parts.join(' '));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [examDate, startTime]);

  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.02em',
      }}
    >
      {timeLeft || 'Calculating...'}
    </span>
  );
}

// Attendance Circular Progress Ring Component
function AttendanceRing({ percentage, size = 52, strokeWidth = 5, color = 'var(--accent)' }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border-glass)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease-in-out' }}
        />
      </svg>
      <span style={{ position: 'absolute', fontSize: '0.66rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

// Map grade percentage to letter grades
function getGradeLetter(percent: number | null): string {
  if (percent === null) return 'N/A';
  if (percent >= 90) return 'A';
  if (percent >= 85) return 'A-';
  if (percent >= 80) return 'B+';
  if (percent >= 75) return 'B';
  if (percent >= 70) return 'B-';
  if (percent >= 65) return 'C+';
  if (percent >= 60) return 'C';
  if (percent >= 55) return 'C-';
  if (percent >= 50) return 'D';
  return 'F';
}

export default function AcademicDashboard() {
  const { courses } = useCourse();
  const {
    assignments,
    exams,
    gradeComponents,
    courseAttendanceSummaries,
    courseGradeSummaries,
    semesterGPA,
    loading: academicLoading,
    toggleAssignmentComplete,
    deleteAssignment,
    deleteExam,
    deleteGradeComponent,
  } = useAcademic();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'tasks' | 'grades' | 'exams'>('overview');
  const [modalType, setModalType] = useState<'assignment' | 'exam' | 'grade_component' | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  
  // Grade View course selection filter
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Auto-select course for grades filter
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Assignments filter logic (Split completed / incomplete)
  const sortedAssignments = useMemo(() => {
    const incomplete = assignments.filter((a) => !a.is_completed);
    const completed = assignments.filter((a) => a.is_completed);

    const now = new Date();
    const isDueSoon = (a: Assignment) => {
      if (!a.due_date) return false;
      const due = new Date(a.due_date);
      const diffMs = due.getTime() - now.getTime();
      return diffMs > 0 && diffMs <= 48 * 60 * 60 * 1000; // 48 hours
    };

    const isOverdue = (a: Assignment) => {
      if (!a.due_date) return false;
      const due = new Date(a.due_date);
      return due.getTime() < now.getTime();
    };

    return {
      incomplete,
      completed,
      isDueSoon,
      isOverdue,
    };
  }, [assignments]);

  // Exams sorted by date
  const upcomingExams = useMemo(() => {
    const now = new Date();
    return exams.filter((e) => {
      if (!e.exam_date) return true;
      const timeStr = e.start_time ? e.start_time.substring(0, 5) : '00:00';
      const examDateTime = new Date(`${e.exam_date}T${timeStr}:00`);
      return examDateTime.getTime() >= now.getTime();
    });
  }, [exams]);

  const pastExams = useMemo(() => {
    const now = new Date();
    return exams.filter((e) => {
      if (!e.exam_date) return false;
      const timeStr = e.start_time ? e.start_time.substring(0, 5) : '00:00';
      const examDateTime = new Date(`${e.exam_date}T${timeStr}:00`);
      return examDateTime.getTime() < now.getTime();
    });
  }, [exams]);

  // Grade components filtered by selected course
  const filteredGrades = useMemo(() => {
    return gradeComponents.filter((g) => g.course_id === selectedCourseId);
  }, [gradeComponents, selectedCourseId]);

  const activeCourseSummary = useMemo(() => {
    return courseGradeSummaries.find((s) => s.course_id === selectedCourseId);
  }, [courseGradeSummaries, selectedCourseId]);

  if (academicLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      
      {/* ─── GPA / CGPA Header HUD widget ───────────────────────── */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(20,25,45,0.2) 100%)',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--hud-glow)',
          borderRadius: '16px',
        }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Academic Core Metrics
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', letterSpacing: '-0.01em' }}>
            SEMESTER STATUS
          </h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Current GPA
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.8rem',
                fontWeight: 900,
                color: semesterGPA !== null ? 'var(--accent)' : 'var(--text-muted)',
                lineHeight: 1,
                textShadow: semesterGPA !== null ? '0 0 10px var(--accent-glow)' : 'none',
              }}
            >
              {semesterGPA !== null ? semesterGPA.toFixed(2) : 'N/A'}
            </span>
          </div>
          <div
            style={{
              width: '4px',
              height: '32px',
              background: 'var(--border-glass)',
              borderRadius: '2px',
            }}
          />
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Scale
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              4.00
            </span>
          </div>
        </div>
      </div>

      {/* ─── Segmented Navigation Controls ─────────────────────── */}
      <div className="view-toggle" style={{ display: 'flex', width: '100%', padding: '3px' }}>
        <button
          className={`view-toggle-btn ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
          style={{ flex: 1, textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.02em', padding: '8px' }}
        >
          Overview
        </button>
        <button
          className={`view-toggle-btn ${activeSubTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tasks')}
          style={{ flex: 1, textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.02em', padding: '8px' }}
        >
          Tasks
        </button>
        <button
          className={`view-toggle-btn ${activeSubTab === 'grades' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('grades')}
          style={{ flex: 1, textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.02em', padding: '8px' }}
        >
          Grades
        </button>
        <button
          className={`view-toggle-btn ${activeSubTab === 'exams' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('exams')}
          style={{ flex: 1, textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.02em', padding: '8px' }}
        >
          Exams
        </button>
      </div>

      {/* ─── SUB-TAB VIEW: OVERVIEW ────────────────────────────── */}
      {activeSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {courses.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No courses defined in this semester.</p>
            </div>
          ) : (
            courses.map((course) => {
              const attSummary = courseAttendanceSummaries.find((s) => s.course_id === course.id);
              const grSummary = courseGradeSummaries.find((s) => s.course_id === course.id);
              const attPercent = attSummary ? attSummary.attendance_percentage : 0;
              const gradePercent = grSummary ? grSummary.weighted_percentage : null;
              
              return (
                <div
                  key={course.id}
                  className="glass-card card-enter"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    {/* Accent Color Band */}
                    <div style={{ width: '3px', height: '36px', background: course.color, borderRadius: '2px', boxShadow: `0 0 8px ${course.color}55` }} />
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: course.color, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                        {course.course_code}
                      </span>
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {course.course_name}
                      </h3>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {course.credit_hours} Credits • {course.teacher_name || 'No Teacher'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    {/* Grade indicator */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                        Grade
                      </span>
                      <span
                        style={{
                          fontSize: '1rem',
                          fontWeight: 900,
                          color: gradePercent !== null ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {getGradeLetter(gradePercent)}
                      </span>
                      {gradePercent !== null && (
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
                          {gradePercent.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {/* Circular Attendance Ring */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <AttendanceRing percentage={attPercent} color={course.color} size={48} strokeWidth={4} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── SUB-TAB VIEW: TASKS / ASSIGNMENT MANAGER ──────────── */}
      {activeSubTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <button
            className="btn-primary"
            onClick={() => {
              setEditingItem(null);
              setModalType('assignment');
            }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Assignment
          </button>

          {/* Incomplete Tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
              Active Tasks ({sortedAssignments.incomplete.length})
            </h4>

            {sortedAssignments.incomplete.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                All caught up! No pending tasks.
              </p>
            ) : (
              sortedAssignments.incomplete.map((task) => {
                const course = courses.find((c) => c.id === task.course_id);
                const color = course?.color || 'var(--accent)';
                const dueSoon = sortedAssignments.isDueSoon(task);
                const overdue = sortedAssignments.isOverdue(task);

                return (
                  <div
                    key={task.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px 14px',
                      alignItems: 'center',
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      onChange={() => toggleAssignmentComplete(task.id, true)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: color,
                      }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
                          {course?.course_code || 'TASK'}
                        </span>
                        
                        {/* Priority Badge */}
                        <span
                          style={{
                            fontSize: '0.55rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            border: '1px solid',
                            background:
                              task.priority === 'urgent'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : task.priority === 'high'
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(255,255,255,0.03)',
                            color:
                              task.priority === 'urgent'
                                ? '#ef4444'
                                : task.priority === 'high'
                                ? '#f59e0b'
                                : 'var(--text-muted)',
                            borderColor:
                              task.priority === 'urgent'
                                ? '#ef4444'
                                : task.priority === 'high'
                                ? '#f59e0b'
                                : 'var(--border-glass)',
                          }}
                        >
                          {task.priority}
                        </span>

                        {/* Due Soon Badge */}
                        {dueSoon && (
                          <span className="status-badge status-upcoming" style={{ fontSize: '0.55rem', padding: '1px 5px' }}>
                            Due Soon
                          </span>
                        )}

                        {/* Overdue Badge */}
                        {overdue && (
                          <span
                            style={{
                              fontSize: '0.55rem',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.16)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              boxShadow: '0 0 8px rgba(239,68,68,0.2)',
                            }}
                          >
                            Overdue
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {task.title}
                      </h4>
                      
                      {task.description && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {task.description}
                        </p>
                      )}

                      <span style={{ fontSize: '0.68rem', color: overdue ? '#ef4444' : 'var(--text-muted)', display: 'block', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        📅 {formatDueDate(task.due_date)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn-action btn-edit"
                        onClick={() => {
                          setEditingItem(task);
                          setModalType('assignment');
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="btn-action btn-delete-action"
                        onClick={() => deleteAssignment(task.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Completed Tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.65 }}>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ✓ Completed Tasks ({sortedAssignments.completed.length})
            </h4>

            {sortedAssignments.completed.map((task) => {
              const course = courses.find((c) => c.id === task.course_id);
              return (
                <div
                  key={task.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '10px 14px',
                    alignItems: 'center',
                    borderLeft: '3px solid var(--border-glass)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={task.is_completed}
                    onChange={() => toggleAssignmentComplete(task.id, false)}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent)',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {course?.course_code || 'TASK'}
                    </span>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                      {task.title}
                    </h4>
                  </div>
                  <button
                    className="btn-action btn-delete-action"
                    onClick={() => deleteAssignment(task.id)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── SUB-TAB VIEW: GRADES CALCULATOR ───────────────────── */}
      {activeSubTab === 'grades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Select Course Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Select Course
            </label>
            <select
              className="glass-select"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>
          </div>

          {selectedCourseId && (
            <>
              {/* Course Grade summary metrics */}
              <div
                className="glass-card"
                style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.01)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Weighted Average</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {activeCourseSummary?.weighted_percentage !== null && activeCourseSummary?.weighted_percentage !== undefined
                      ? `${activeCourseSummary.weighted_percentage.toFixed(1)}%`
                      : 'Unrated'}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Letter Grade: <strong style={{ color: 'var(--text-primary)' }}>{getGradeLetter(activeCourseSummary?.weighted_percentage ?? null)}</strong>
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Graded weight</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    {activeCourseSummary?.total_weight || 0}%
                  </span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    of 100% Syllabus weight
                  </span>
                </div>
              </div>

              {/* Add Grade Item Button */}
              <button
                className="btn-primary"
                onClick={() => {
                  setEditingItem(null);
                  setModalType('grade_component');
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Grade Item
              </button>

              {/* List of grade components */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Weightage Breakdown
                </h4>

                {filteredGrades.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                    No grade entries added yet. Log quizzes/assignments to start calculating.
                  </p>
                ) : (
                  filteredGrades.map((grade) => {
                    const gradePercent =
                      grade.obtained_score !== null && grade.max_score > 0
                        ? (grade.obtained_score / grade.max_score) * 100
                        : null;

                    return (
                      <div
                        key={grade.id}
                        className="glass-card"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          gap: '12px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', letterSpacing: '0.03em' }}>
                            {grade.category} • Weight: {grade.weight}%
                          </span>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {grade.name}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ textAlign: 'right' }}>
                            {grade.obtained_score !== null ? (
                              <>
                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                  {grade.obtained_score} / {grade.max_score}
                                </span>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block', fontFamily: 'var(--font-mono)' }}>
                                  ({gradePercent !== null ? gradePercent.toFixed(1) : 0}%)
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Not graded yet
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn-action btn-edit"
                              onClick={() => {
                                setEditingItem(grade);
                                setModalType('grade_component');
                              }}
                            >
                              ✎
                            </button>
                            <button
                              className="btn-action btn-delete-action"
                              onClick={() => deleteGradeComponent(grade.id)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── SUB-TAB VIEW: EXAMS SCHEDULE ─────────────────────── */}
      {activeSubTab === 'exams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <button
            className="btn-primary"
            onClick={() => {
              setEditingItem(null);
              setModalType('exam');
            }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Upcoming Exam
          </button>

          {/* Upcoming Exams */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning)', boxShadow: '0 0 6px var(--warning)' }} />
              Upcoming Exams ({upcomingExams.length})
            </h4>

            {upcomingExams.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                No upcoming exams scheduled. Keep it up!
              </p>
            ) : (
              upcomingExams.map((exam) => {
                const course = courses.find((c) => c.id === exam.course_id);
                const color = course?.color || 'var(--accent)';

                return (
                  <div
                    key={exam.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '12px 16px',
                      borderLeft: `3px solid ${color}`,
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
                          {course?.course_code || 'EXAM'} • {exam.exam_type.toUpperCase()}
                        </span>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '1px' }}>
                          {exam.title}
                        </h4>
                      </div>

                      {/* Ticking Monospace Countdown Timer */}
                      <div
                        style={{
                          background: 'var(--accent-ghost)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--accent)',
                        }}
                      >
                        <span style={{ fontSize: '0.62rem', fontWeight: 800 }}>T-MINUS:</span>
                        <ExamCountdown examDate={exam.exam_date} startTime={exam.start_time} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>📅</span>
                        <span>{formatExamDateTime(exam.exam_date, exam.start_time)}</span>
                      </div>
                      {exam.room_number && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>🚪</span>
                          <span>Room: {exam.room_number}</span>
                        </div>
                      )}
                    </div>

                    {exam.notes && (
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-glass)',
                        }}
                      >
                        {exam.notes}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end', marginTop: '4px' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setEditingItem(exam);
                          setModalType('exam');
                        }}
                        style={{ padding: '3px 10px', fontSize: '0.68rem', borderRadius: '4px' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => deleteExam(exam.id)}
                        style={{ padding: '3px 10px', fontSize: '0.68rem', borderRadius: '4px', color: 'var(--danger)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Past Exams */}
          {pastExams.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.6 }}>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Past Exams ({pastExams.length})
              </h4>
              {pastExams.map((exam) => {
                const course = courses.find((c) => c.id === exam.course_id);
                return (
                  <div
                    key={exam.id}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        {course?.course_code} • {exam.exam_type}
                      </span>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {exam.title}
                      </h4>
                    </div>
                    <button
                      className="btn-action btn-delete-action"
                      onClick={() => deleteExam(exam.id)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Item Modals */}
      {modalType && (
        <AddAcademicItemModal
          type={modalType}
          editingItem={editingItem}
          onClose={() => {
            setModalType(null);
            setEditingItem(null);
          }}
        />
      )}

    </div>
  );
}
