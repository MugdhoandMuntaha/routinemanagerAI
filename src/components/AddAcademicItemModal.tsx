'use client';

import React, { useState, useEffect } from 'react';
import { useCourse } from '@/context/CourseContext';
import { useAcademic } from '@/context/AcademicContext';
import type { Assignment, Exam, GradeComponent, AssignmentPriority, ExamType, GradeCategory } from '@/types';

type Props = {
  type: 'assignment' | 'exam' | 'grade_component';
  onClose: () => void;
  editingItem?: any | null; // Can be Assignment, Exam, or GradeComponent
};

export default function AddAcademicItemModal({ type, onClose, editingItem }: Props) {
  const { courses } = useCourse();
  const {
    addAssignment,
    editAssignment,
    addExam,
    editExam,
    addGradeComponent,
    editGradeComponent,
  } = useAcademic();

  const [courseId, setCourseId] = useState('');
  const [saving, setSaving] = useState(false);

  // Assignment fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<AssignmentPriority>('medium');

  // Exam fields
  const [examTitle, setExamTitle] = useState('');
  const [examTypeSelect, setExamTypeSelect] = useState<ExamType>('midterm');
  const [examDate, setExamDate] = useState('');
  const [examStartTime, setExamStartTime] = useState('09:00');
  const [examDuration, setExamDuration] = useState('120');
  const [examRoom, setExamRoom] = useState('');
  const [examNotes, setExamNotes] = useState('');

  // Grade fields
  const [gradeName, setGradeName] = useState('');
  const [gradeCategory, setGradeCategory] = useState<GradeCategory>('quiz');
  const [gradeWeight, setGradeWeight] = useState('10');
  const [gradeMaxScore, setGradeMaxScore] = useState('100');
  const [gradeObtainedScore, setGradeObtainedScore] = useState('');
  const [isGraded, setIsGraded] = useState(false);

  // Initialize form fields
  useEffect(() => {
    if (courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses]);

  useEffect(() => {
    if (editingItem) {
      setCourseId(editingItem.course_id);

      if (type === 'assignment') {
        const item = editingItem as Assignment;
        setTaskTitle(item.title);
        setTaskDescription(item.description || '');
        if (item.due_date) {
          // Format ISO date to YYYY-MM-DDTHH:MM for datetime-local
          const d = new Date(item.due_date);
          const offset = d.getTimezoneOffset();
          const local = new Date(d.getTime() - offset * 60 * 1000);
          setTaskDueDate(local.toISOString().slice(0, 16));
        } else {
          setTaskDueDate('');
        }
        setTaskPriority(item.priority);
      } else if (type === 'exam') {
        const item = editingItem as Exam;
        setExamTitle(item.title);
        setExamTypeSelect(item.exam_type);
        setExamDate(item.exam_date ?? '');
        setExamStartTime(item.start_time ? item.start_time.substring(0, 5) : '09:00');
        setExamDuration(item.duration_minutes ? String(item.duration_minutes) : '120');
        setExamRoom(item.room_number || '');
        setExamNotes(item.notes || '');
      } else if (type === 'grade_component') {
        const item = editingItem as GradeComponent;
        setGradeName(item.name);
        setGradeCategory(item.category);
        setGradeWeight(String(item.weight));
        setGradeMaxScore(String(item.max_score));
        if (item.obtained_score !== null) {
          setGradeObtainedScore(String(item.obtained_score));
          setIsGraded(true);
        } else {
          setGradeObtainedScore('');
          setIsGraded(false);
        }
      }
    }
  }, [editingItem, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setSaving(true);

    try {
      if (type === 'assignment') {
        const data = {
          course_id: courseId,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
          priority: taskPriority,
          is_completed: editingItem ? editingItem.is_completed : false,
          completed_at: editingItem ? editingItem.completed_at : null,
          sort_order: editingItem ? editingItem.sort_order : 0,
        };

        if (editingItem) {
          await editAssignment(editingItem.id, data);
        } else {
          await addAssignment(data);
        }
      } else if (type === 'exam') {
        const data = {
          course_id: courseId,
          title: examTitle.trim(),
          exam_type: examTypeSelect,
          exam_date: examDate ? examDate : null,
          start_time: examStartTime ? `${examStartTime}:00` : null,
          duration_minutes: examDuration ? Number(examDuration) : null,
          room_number: examRoom.trim(),
          notes: examNotes.trim(),
        };

        if (editingItem) {
          await editExam(editingItem.id, data);
        } else {
          await addExam(data);
        }
      } else if (type === 'grade_component') {
        const data = {
          course_id: courseId,
          name: gradeName.trim(),
          category: gradeCategory,
          weight: Number(gradeWeight),
          max_score: Number(gradeMaxScore),
          obtained_score: isGraded && gradeObtainedScore ? Number(gradeObtainedScore) : null,
          graded_at: isGraded ? new Date().toISOString() : null,
        };

        if (editingItem) {
          await editGradeComponent(editingItem.id, data);
        } else {
          await addGradeComponent(data);
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getTitle = () => {
    const prefix = editingItem ? 'Edit' : 'Add';
    if (type === 'assignment') return `${prefix} Assignment`;
    if (type === 'exam') return `${prefix} Exam`;
    return `${prefix} Grade Component`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', position: 'relative' }}
      >
        {/* Header corner elements for Futuristic style */}
        <div className="hud-corner hud-top-left" />
        <div className="hud-corner hud-top-right" />
        <div className="hud-corner hud-bottom-left" />
        <div className="hud-corner hud-bottom-right" />

        <button onClick={onClose} className="modal-close-btn" aria-label="Close">
          ✕
        </button>

        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            background: 'var(--gradient-accent)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {getTitle()}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Course Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Linked Course
            </label>
            {courses.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                Please create a course before logging items.
              </p>
            ) : (
              <select
                className="glass-select"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                    {course.course_code} - {course.course_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Type-Specific Fields: ASSIGNMENT */}
          {type === 'assignment' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Task Title
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Read Chapter 5 / Project Draft"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  className="glass-input"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Priority
                </label>
                <select
                  className="glass-select"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as AssignmentPriority)}
                >
                  <option value="low" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Low Priority</option>
                  <option value="medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Medium Priority</option>
                  <option value="high" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>High Priority</option>
                  <option value="urgent" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Urgent Priority</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Description / Notes
                </label>
                <textarea
                  className="glass-input"
                  placeholder="Optional details, links, or instructions..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  style={{ height: '80px', resize: 'none', padding: '8px 12px' }}
                />
              </div>
            </>
          )}

          {/* Type-Specific Fields: EXAM */}
          {type === 'exam' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Exam Title
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Midterm 1 / Semester Final"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Exam Type
                  </label>
                  <select
                    className="glass-select"
                    value={examTypeSelect}
                    onChange={(e) => setExamTypeSelect(e.target.value as ExamType)}
                  >
                    <option value="quiz" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Quiz</option>
                    <option value="midterm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Midterm</option>
                    <option value="final" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Final</option>
                    <option value="lab" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Lab Exam</option>
                    <option value="viva" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Viva / Oral</option>
                    <option value="other" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Other</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Exam Date
                  </label>
                  <input
                    type="date"
                    className="glass-input"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="glass-input"
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    className="glass-input"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                    min="10"
                    max="480"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Room Number
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Lab 3 / Room 402"
                  value={examRoom}
                  onChange={(e) => setExamRoom(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Notes / Syllabus
                </label>
                <textarea
                  className="glass-input"
                  placeholder="Syllabus, chapters covered, or requirements..."
                  value={examNotes}
                  onChange={(e) => setExamNotes(e.target.value)}
                  style={{ height: '70px', resize: 'none', padding: '8px 12px' }}
                />
              </div>
            </>
          )}

          {/* Type-Specific Fields: GRADE COMPONENT */}
          {type === 'grade_component' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Component Name
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Quiz 1 / Assignment 2 / Midterm"
                  value={gradeName}
                  onChange={(e) => setGradeName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Category
                  </label>
                  <select
                    className="glass-select"
                    value={gradeCategory}
                    onChange={(e) => setGradeCategory(e.target.value as GradeCategory)}
                  >
                    <option value="quiz" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Quiz</option>
                    <option value="assignment" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Assignment</option>
                    <option value="midterm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Midterm</option>
                    <option value="final" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Final Exam</option>
                    <option value="lab" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Lab / Practical</option>
                    <option value="project" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Project</option>
                    <option value="participation" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Participation</option>
                    <option value="other" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>Other</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Weight (% of Course)
                  </label>
                  <input
                    type="number"
                    className="glass-input"
                    value={gradeWeight}
                    onChange={(e) => setGradeWeight(e.target.value)}
                    min="0"
                    max="100"
                    step="0.5"
                    required
                  />
                </div>
              </div>

              {/* Graded Toggle Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <input
                  type="checkbox"
                  id="isGraded"
                  checked={isGraded}
                  onChange={(e) => setIsGraded(e.target.checked)}
                  style={{
                    cursor: 'pointer',
                    width: '14px',
                    height: '14px',
                    accentColor: 'var(--accent)',
                  }}
                />
                <label htmlFor="isGraded" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Mark as Graded (Has obtained score)
                </label>
              </div>

              {/* Score Inputs (visible only if Graded checkbox is checked) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', opacity: isGraded ? 1 : 0.4, transition: 'all 0.25s ease' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Obtained Score
                  </label>
                  <input
                    type="number"
                    className="glass-input"
                    placeholder="e.g. 85"
                    value={gradeObtainedScore}
                    onChange={(e) => setGradeObtainedScore(e.target.value)}
                    min="0"
                    step="0.1"
                    disabled={!isGraded}
                    required={isGraded}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Max Total Score
                  </label>
                  <input
                    type="number"
                    className="glass-input"
                    value={gradeMaxScore}
                    onChange={(e) => setGradeMaxScore(e.target.value)}
                    min="1"
                    step="0.1"
                    disabled={!isGraded}
                    required={isGraded}
                  />
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={saving || courses.length === 0}
            >
              {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
