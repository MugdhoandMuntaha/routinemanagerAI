'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSemester } from '@/context/SemesterContext';
import { useCourse } from '@/context/CourseContext';
import { useRoutine } from '@/context/RoutineContext';
import { useAcademic } from '@/context/AcademicContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { exportToICS, parseICS } from '@/lib/ical';
import { exportTimetableToImage } from '@/lib/canvasExporter';
import { triggerHapticLight, triggerHapticSuccess, triggerHapticWarning } from '@/lib/haptics';
import { ACCENT_COLORS } from '@/types';

type Props = {
  onClose: () => void;
};

type AutoBackupSlot = {
  timestamp: string;
  semesterName: string;
  data: any;
};

export default function DataManagementModal({ onClose }: Props) {
  const { user } = useAuth();
  const { semesters, activeSemester, switchSemester } = useSemester();
  const { courses } = useCourse();
  const { periods } = useRoutine();
  const { attendance, assignments, exams, gradeComponents, refreshAll } = useAcademic();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'sync' | 'export' | 'calendar' | 'ai'>('sync');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [autoBackups, setAutoBackups] = useState<AutoBackupSlot[]>([]);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importType, setImportType] = useState<'json' | 'ics' | 'pdf'>('json');
  const [parsedICSItems, setParsedICSItems] = useState<any[]>([]);
  const [parsedPDFItems, setParsedPDFItems] = useState<{ courses: any[]; periods: any[] } | null>(null);

  // Load auto backups from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('routine_manager_auto_backups');
      if (saved) {
        setAutoBackups(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load auto-backups:', e);
    }
  }, []);

  // ─── JSON Backup Exporter ─────────────────────────
  const handleExportJSON = async () => {
    if (!user) return;
    triggerHapticLight();
    setLoading(true);
    setLoadingMsg('Preparing package...');

    try {
      // Package payload
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        userEmail: user.email,
        semesters,
        courses,
        periods,
        attendance,
        assignments,
        exams,
        gradeComponents,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `routine_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      triggerHapticSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to export backup payload.');
      triggerHapticWarning();
    } finally {
      setLoading(false);
    }
  };

  // ─── JSON File Selector & Parser ─────────────────
  const handleJSONFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHapticLight();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.semesters || !parsed.courses) {
          throw new Error('Invalid schema format');
        }
        setImportType('json');
        setImportPreview(parsed);
      } catch (err) {
        alert('Failed to parse file: Not a valid Routine Manager backup JSON.');
        triggerHapticWarning();
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // clear input
  };

  // ─── JSON Database Import Logic ──────────────────
  const handleImportJSONConfirm = async () => {
    if (!user || !importPreview) return;
    triggerHapticLight();
    setLoading(true);
    setLoadingMsg('Importing database payload...');

    try {
      const idMapSemesters: Record<string, string> = {};
      const idMapCourses: Record<string, string> = {};
      const idMapPeriods: Record<string, string> = {};

      // 1. Insert Semesters
      const semestersToInsert = (importPreview.semesters ?? []).map((sem: any) => {
        const newId = crypto.randomUUID();
        idMapSemesters[sem.id] = newId;
        return {
          id: newId,
          user_id: user.id,
          name: `${sem.name} (Imported)`,
          is_active: false,
          sort_order: sem.sort_order ?? 0,
        };
      });

      if (semestersToInsert.length > 0) {
        const { error } = await supabase.from('semesters').insert(semestersToInsert);
        if (error) throw error;
      }

      // 2. Insert Courses
      const coursesToInsert = (importPreview.courses ?? []).map((c: any) => {
        const newId = crypto.randomUUID();
        idMapCourses[c.id] = newId;
        
        // Fall back to active semester if parent not found in import
        const mappedSemId = idMapSemesters[c.semester_id] || activeSemester?.id;
        if (!mappedSemId) {
          throw new Error('No active semester context available for course import.');
        }

        return {
          id: newId,
          user_id: user.id,
          semester_id: mappedSemId,
          course_name: c.course_name,
          course_code: c.course_code,
          teacher_name: c.teacher_name || '',
          room_number: c.room_number || '',
          color: c.color || '#6366f1',
          credit_hours: Number(c.credit_hours ?? 3),
          notes: c.notes || '',
          sort_order: c.sort_order ?? 0,
        };
      });

      if (coursesToInsert.length > 0) {
        const { error } = await supabase.from('courses').insert(coursesToInsert);
        if (error) throw error;
      }

      // 3. Insert Periods
      const periodsToInsert = (importPreview.periods ?? []).map((p: any) => {
        const newId = crypto.randomUUID();
        idMapPeriods[p.id || p.period_id] = newId;

        const mappedCourseId = idMapCourses[p.course_id];
        if (!mappedCourseId) return null; // Orphaned period

        return {
          id: newId,
          user_id: user.id,
          course_id: mappedCourseId,
          recurrence_type: p.recurrence_type,
          day_of_week: p.day_of_week,
          specific_date: p.specific_date,
          start_time: p.start_time,
          duration_minutes: p.duration_minutes,
          room_number: p.room_number || '',
          sort_order: p.sort_order ?? 0,
        };
      }).filter(Boolean);

      if (periodsToInsert.length > 0) {
        const { error } = await supabase.from('periods').insert(periodsToInsert);
        if (error) throw error;
      }

      // 4. Insert Attendance
      const attendanceToInsert = (importPreview.attendance ?? []).map((a: any) => {
        const mappedPeriodId = idMapPeriods[a.period_id];
        if (!mappedPeriodId) return null; // Orphaned record

        return {
          user_id: user.id,
          period_id: mappedPeriodId,
          date: a.date,
          status: a.status,
          note: a.note || '',
        };
      }).filter(Boolean);

      if (attendanceToInsert.length > 0) {
        const { error } = await supabase.from('attendance').insert(attendanceToInsert);
        if (error) throw error;
      }

      // 5. Insert Assignments
      const assignmentsToInsert = (importPreview.assignments ?? []).map((a: any) => {
        const mappedCourseId = idMapCourses[a.course_id];
        if (!mappedCourseId) return null;

        return {
          user_id: user.id,
          course_id: mappedCourseId,
          title: a.title,
          description: a.description || '',
          due_date: a.due_date,
          is_completed: a.is_completed ?? false,
          completed_at: a.completed_at,
          priority: a.priority || 'medium',
          sort_order: a.sort_order ?? 0,
        };
      }).filter(Boolean);

      if (assignmentsToInsert.length > 0) {
        const { error } = await supabase.from('assignments').insert(assignmentsToInsert);
        if (error) throw error;
      }

      // 6. Insert Exams
      const examsToInsert = (importPreview.exams ?? []).map((e: any) => {
        const mappedCourseId = idMapCourses[e.course_id];
        if (!mappedCourseId) return null;

        return {
          user_id: user.id,
          course_id: mappedCourseId,
          title: e.title,
          exam_type: e.exam_type || 'midterm',
          exam_date: e.exam_date,
          start_time: e.start_time,
          duration_minutes: e.duration_minutes,
          room_number: e.room_number || '',
          notes: e.notes || '',
        };
      }).filter(Boolean);

      if (examsToInsert.length > 0) {
        const { error } = await supabase.from('exams').insert(examsToInsert);
        if (error) throw error;
      }

      // 7. Insert Grade Components
      const gradeToInsert = (importPreview.gradeComponents ?? importPreview.grade_components ?? []).map((g: any) => {
        const mappedCourseId = idMapCourses[g.course_id];
        if (!mappedCourseId) return null;

        return {
          user_id: user.id,
          course_id: mappedCourseId,
          name: g.name,
          category: g.category || 'other',
          weight: Number(g.weight ?? 0),
          max_score: Number(g.max_score ?? 100),
          obtained_score: g.obtained_score !== null ? Number(g.obtained_score) : null,
          graded_at: g.graded_at,
        };
      }).filter(Boolean);

      if (gradeToInsert.length > 0) {
        const { error } = await supabase.from('grade_components').insert(gradeToInsert);
        if (error) throw error;
      }

      // Auto switch to first imported semester if it exists
      if (semestersToInsert.length > 0) {
        await switchSemester(semestersToInsert[0].id);
      } else {
        await refreshAll();
      }

      setImportPreview(null);
      triggerHapticSuccess();
      alert('Data import completed successfully!');
    } catch (err: any) {
      console.error(err);
      alert(`Import failed: ${err.message || 'Unknown database write error'}`);
      triggerHapticWarning();
    } finally {
      setLoading(false);
    }
  };

  // ─── Local Auto-Backup Restoration ───────────────
  const handleRestoreAutoBackup = async (slot: AutoBackupSlot) => {
    const confirm = window.confirm(`Restore auto-backup from ${new Date(slot.timestamp).toLocaleString()}? This will import the archived semesters and classes.`);
    if (!confirm) return;

    setImportType('json');
    setImportPreview(slot.data);
  };

  // ─── Clear All Database Records ───────────────────
  const handleClearAllData = async () => {
    if (!user) return;
    const confirm1 = window.confirm('WARNING: This will permanently delete all semesters, courses, attendance, grades, and exams from the cloud. Proceed?');
    if (!confirm1) return;

    const confirm2 = window.prompt('Type "DELETE EVERYTHING" in all caps to confirm deletion:');
    if (confirm2 !== 'DELETE EVERYTHING') {
      alert('Confirmation text mismatch. Deletion aborted.');
      return;
    }

    triggerHapticWarning();
    setLoading(true);
    setLoadingMsg('Expunging database records...');

    try {
      // Cascading delete: Deleting all user semesters will wipe linked courses, periods, exams, etc.
      const { error } = await supabase.from('semesters').delete().eq('user_id', user.id);
      if (error) throw error;

      await refreshAll();
      triggerHapticSuccess();
      alert('Cloud database wiped. The app has initialized a default semester.');
    } catch (err: any) {
      console.error(err);
      alert(`Failed to delete data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── Image Canvas Exporter ────────────────────────
  const handleExportImage = async () => {
    triggerHapticLight();
    setLoading(true);
    setLoadingMsg('Rendering schedule layout...');
    try {
      await exportTimetableToImage(periods, theme, activeSemester?.name || 'Default');
      triggerHapticSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to render canvas layout.');
      triggerHapticWarning();
    } finally {
      setLoading(false);
    }
  };

  // ─── Browser PDF / Print Trigger ──────────────────
  const handlePrintPDF = () => {
    triggerHapticLight();
    document.body.classList.add('is-printing');
    window.print();
    // Delay removing printing class slightly to avoid layout shifts in output
    setTimeout(() => {
      document.body.classList.remove('is-printing');
    }, 500);
  };

  // ─── Calendar ICS Exporter ────────────────────────
  const handleExportICS = () => {
    if (!periods || periods.length === 0) {
      alert('No weekly schedules found in the current semester to export.');
      return;
    }
    triggerHapticLight();
    try {
      const icsStr = exportToICS(periods);
      const blob = new Blob([icsStr], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schedule_${activeSemester?.name.toLowerCase().replace(/\s+/g, '_') || 'timetable'}.ics`;
      link.click();
      URL.revokeObjectURL(url);
      triggerHapticSuccess();
    } catch (err) {
      console.error(err);
      alert('ICS export failed.');
      triggerHapticWarning();
    }
  };

  // ─── Calendar ICS File Parser ─────────────────────
  const handleICSFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHapticLight();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseICS(reader.result as string);
        if (parsed.length === 0) {
          throw new Error('No class events found in calendar file');
        }
        setImportType('ics');
        setParsedICSItems(parsed);
        setImportPreview(parsed); // Dummy preview container trigger
      } catch (err: any) {
        alert(`Failed to parse calendar: ${err.message || 'Invalid iCalendar structure.'}`);
        triggerHapticWarning();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ─── Calendar ICS Import DB Confirm ───────────────
  const handleImportICSConfirm = async () => {
    if (!user || !activeSemester || parsedICSItems.length === 0) return;
    triggerHapticLight();
    setLoading(true);
    setLoadingMsg('Importing calendar events...');

    try {
      const importedCourses: Record<string, string> = {}; // courseName::courseCode -> courseId

      for (const item of parsedICSItems) {
        const key = `${item.courseName}::${item.courseCode}`;
        let courseId = importedCourses[key];

        if (!courseId) {
          // Check if course exists
          const { data: existing } = await supabase
            .from('courses')
            .select('id')
            .eq('user_id', user.id)
            .eq('semester_id', activeSemester.id)
            .eq('course_name', item.courseName)
            .eq('course_code', item.courseCode)
            .maybeSingle();

          if (existing) {
            courseId = existing.id;
          } else {
            // Create new course
            const randomColor = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
            const { data: newCourse, error: cErr } = await supabase
              .from('courses')
              .insert({
                user_id: user.id,
                semester_id: activeSemester.id,
                course_name: item.courseName,
                course_code: item.courseCode,
                teacher_name: item.teacherName || '',
                room_number: item.roomNumber || '',
                color: randomColor,
              })
              .select()
              .single();

            if (cErr) throw cErr;
            if (newCourse) courseId = newCourse.id;
          }
          if (courseId) {
            importedCourses[key] = courseId;
          }
        }

        if (courseId) {
          // Insert period
          const { error: pErr } = await supabase.from('periods').insert({
            user_id: user.id,
            course_id: courseId,
            recurrence_type: item.recurrenceType,
            day_of_week: item.dayOfWeek,
            specific_date: item.specificDate,
            start_time: item.startTime,
            duration_minutes: item.durationMinutes,
            room_number: item.roomNumber || '',
          });
          if (pErr) throw pErr;
        }
      }

      await refreshAll();
      setImportPreview(null);
      setParsedICSItems([]);
      triggerHapticSuccess();
      alert(`Imported ${parsedICSItems.length} calendar classes successfully!`);
    } catch (err: any) {
      console.error(err);
      alert(`Import failed: ${err.message || 'Database error'}`);
      triggerHapticWarning();
    } finally {
      setLoading(false);
    }
  };

  // ─── AI PDF File Parser ──────────────────────────
  const handlePDFFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are supported.');
      return;
    }

    triggerHapticLight();
    setLoading(true);
    setLoadingMsg('AI is analyzing routine layout...');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Str = dataUrl.split(',')[1];
          resolve(base64Str);
        };
        reader.onerror = (error) => reject(error);
      });

      const res = await fetch('/api/parse-routine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileBase64: base64 }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to parse routine PDF.');
      }

      const data = await res.json();
      if (!data.courses || !data.periods) {
        throw new Error('Invalid AI response structure. Missing courses or periods.');
      }

      setImportType('pdf');
      setParsedPDFItems(data);
      setImportPreview(data);
      triggerHapticSuccess();
    } catch (err: any) {
      console.error(err);
      alert(`AI Parsing failed: ${err.message || 'Unknown error'}`);
      triggerHapticWarning();
    } finally {
      setLoading(false);
    }
    e.target.value = '';
  };

  // ─── AI PDF Import DB Confirm ─────────────────────
  const handleImportPDFConfirm = async () => {
    if (!user || !activeSemester || !parsedPDFItems) return;
    triggerHapticLight();
    setLoading(true);
    setLoadingMsg('Importing routine items...');

    try {
      const importedCourses: Record<string, string> = {}; // courseCode/courseName -> courseId

      for (const item of parsedPDFItems.courses) {
        const key = `${item.course_code || ''}::${item.course_name || ''}`;
        let courseId = '';

        // Check if course exists
        const { data: existing } = await supabase
          .from('courses')
          .select('id')
          .eq('user_id', user.id)
          .eq('semester_id', activeSemester.id)
          .or(`course_name.eq."${item.course_name}",course_code.eq."${item.course_code}"`)
          .maybeSingle();

        if (existing) {
          courseId = existing.id;
        } else {
          // Create new course
          const randomColor = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
          const { data: newCourse, error: cErr } = await supabase
            .from('courses')
            .insert({
              user_id: user.id,
              semester_id: activeSemester.id,
              course_name: item.course_name || 'Unnamed Course',
              course_code: item.course_code || '',
              teacher_name: item.teacher_name || '',
              room_number: item.room_number || '',
              color: randomColor,
              credit_hours: item.credit_hours || 3,
            })
            .select()
            .single();

          if (cErr) throw cErr;
          if (newCourse) courseId = newCourse.id;
        }

        if (courseId) {
          importedCourses[key] = courseId;
        }
      }

      for (const item of parsedPDFItems.periods) {
        let courseId = '';

        for (const [key, id] of Object.entries(importedCourses)) {
          const [code, name] = key.split('::');
          if (
            (item.course_code && code === item.course_code) ||
            (item.course_name && name === item.course_name)
          ) {
            courseId = id;
            break;
          }
        }

        if (!courseId) {
          const { data: fallbackCourse } = await supabase
            .from('courses')
            .select('id')
            .eq('user_id', user.id)
            .eq('semester_id', activeSemester.id)
            .or(`course_name.eq."${item.course_name}",course_code.eq."${item.course_code}"`)
            .maybeSingle();

          if (fallbackCourse) {
            courseId = fallbackCourse.id;
          }
        }

        if (courseId) {
          const { error: pErr } = await supabase.from('periods').insert({
            user_id: user.id,
            course_id: courseId,
            recurrence_type: 'weekly',
            day_of_week: item.day_of_week,
            specific_date: null,
            start_time: item.start_time,
            duration_minutes: item.duration_minutes,
            room_number: item.room_number || '',
          });
          if (pErr) throw pErr;
        }
      }

      await refreshAll();
      setImportPreview(null);
      setParsedPDFItems(null);
      triggerHapticSuccess();
      alert(`Imported ${parsedPDFItems.periods.length} class periods successfully!`);
    } catch (err: any) {
      console.error(err);
      alert(`Import failed: ${err.message || 'Database error'}`);
      triggerHapticWarning();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '20px' }}>
        
        {/* Loading Overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute', inset: 0, background: 'var(--bg-elevated)',
              zIndex: 110, borderRadius: '12px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '16px',
            }}
          >
            <div className="loading-spinner" />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {loadingMsg}
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Data Management
            </h2>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Backup, synchronization, and export configuration
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '20px', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('sync')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
              fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em',
              color: activeTab === 'sync' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === 'sync' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Cloud & Backup
          </button>
          <button
            onClick={() => setActiveTab('export')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
              fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em',
              color: activeTab === 'export' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === 'export' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Print & Image
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
              fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em',
              color: activeTab === 'calendar' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === 'calendar' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Calendar Sync
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
              fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em',
              color: activeTab === 'ai' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === 'ai' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            AI PDF Import
          </button>
        </div>

        {/* TAB 1: CLOUD SYNC & JSON BACKUPS */}
        {activeTab === 'sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Sync Diagnostics */}
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Cloud Sync Status: Active
                </span>
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Account: {user?.email}
              </p>
              <button
                onClick={async () => {
                  triggerHapticLight();
                  setLoading(true);
                  setLoadingMsg('Syncing cloud database...');
                  await refreshAll();
                  setLoading(false);
                  triggerHapticSuccess();
                }}
                className="btn-secondary"
                style={{ width: '100%', padding: '6px', fontSize: '0.7rem', marginTop: '10px', textTransform: 'uppercase', fontWeight: 800 }}
              >
                Force Sync Reload
              </button>
            </div>

            {/* JSON Actions */}
            <div>
              <h3 style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Export & Import backups
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleExportJSON} className="btn-primary" style={{ flex: 1, padding: '10px', fontSize: '0.76rem' }}>
                  📥 Export JSON
                </button>
                <label className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.76rem', textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  📤 Import JSON
                  <input type="file" accept=".json" onChange={handleJSONFileChange} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* Local Storage Backups */}
            <div>
              <h3 style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Local Auto-Backups
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                {autoBackups.length === 0 ? (
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                    No local automatic backups stored yet.
                  </p>
                ) : (
                  autoBackups.map((slot, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)',
                        borderRadius: '6px', fontSize: '0.68rem',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          Snapshot #{index + 1}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.62rem' }}>
                          ({slot.semesterName})
                        </span>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.6rem', marginTop: '2px' }}>
                          {new Date(slot.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreAutoBackup(slot)}
                        className="semester-selector"
                        style={{ padding: '3px 8px', fontSize: '0.62rem', border: '1px solid var(--border-glass)', background: 'transparent' }}
                      >
                        Restore
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div style={{ marginTop: '6px', borderTop: '1px dashed var(--border-glass)', paddingTop: '14px' }}>
              <button
                onClick={handleClearAllData}
                style={{
                  width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.15)', color: 'var(--danger)',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
              >
                ☣️ WIPE ALL CLOUD DATA
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EXPORT & PRINT */}
        {activeTab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Export your weekly schedule timetable. Image output adapts visually to match your active dashboard theme colors.
            </p>

            <div
              style={{
                padding: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)',
                borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '2rem' }}>📅</div>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                Weekly Grid Timetable
              </div>

              <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                <button
                  onClick={handlePrintPDF}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print / PDF
                </button>

                <button
                  onClick={handleExportImage}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Save as Image
                </button>
              </div>
            </div>

            <div style={{ padding: '10px', background: 'var(--accent-ghost)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                💡 TIP FOR PDF EXPORTS
              </span>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-secondary)' }}>
                Set your printer destination to <b>"Save as PDF"</b> and paper layout to <b>"Landscape"</b> inside the print browser configuration overlay.
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: CALENDAR SYNC */}
        {activeTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Generate calendar event files to sync timetable schedules directly with Google Calendar, Microsoft Outlook, or Apple Calendar.
            </p>

            {/* ICS Export */}
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Export iCalendar File
              </h3>
              <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Generates a recurring weekly calendar .ics file matching the active semester's schedules.
              </p>
              <button onClick={handleExportICS} className="btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.76rem' }}>
                📅 Export Schedule (.ics)
              </button>
            </div>

            {/* ICS Import */}
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Import Classes from iCalendar
              </h3>
              <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Upload an existing calendar .ics file to extract class periods into your current semester.
              </p>
              <label className="btn-secondary" style={{ width: '100%', padding: '10px', fontSize: '0.76rem', textAlign: 'center', cursor: 'pointer', display: 'block' }}>
                📂 Select Calendar (.ics)
                <input type="file" accept=".ics" onChange={handleICSFileChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}

        {/* TAB 4: AI PDF IMPORT */}
        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Upload your routine in PDF format. Gemini 2.5 Flash will automatically analyze the layout, extract all course information, and detect the weekly schedule times.
            </p>

            <div
              style={{
                padding: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)',
                borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '2rem' }}>🤖</div>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                AI Routine Parser
              </div>
              <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '300px' }}>
                Upload a routine schedule PDF to detect courses, room numbers, teacher names, and weekly periods.
              </p>

              <label
                className="btn-primary"
                style={{
                  width: '100%', padding: '10px', fontSize: '0.76rem', textAlign: 'center', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload Routine PDF
                <input type="file" accept=".pdf" onChange={handlePDFFileChange} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ padding: '10px', background: 'var(--accent-ghost)', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                💡 HOW IT WORKS
              </span>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-secondary)' }}>
                The uploaded PDF is parsed securely via Google Gemini 2.5 Flash, which returns a structured class schedule. You can preview the detected courses and periods before importing them.
              </span>
            </div>
          </div>
        )}

        {/* ─── IMPORT CONFIRMATION PREVIEW OVERLAY ─── */}
        {importPreview && (
          <div
            style={{
              position: 'absolute', inset: 0, background: 'var(--bg-elevated)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              zIndex: 120, borderRadius: '12px', padding: '20px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Confirm Import
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Verify the items parsed from the backup file:
              </p>

              <div
                style={{
                  padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)',
                  borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px',
                  maxHeight: '240px', overflowY: 'auto',
                }}
              >
                {importType === 'json' ? (
                  <>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      📁 File Version: <b>{importPreview.version || '1.0'}</b>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      📅 Exported: <b>{importPreview.exportedAt ? new Date(importPreview.exportedAt).toLocaleDateString() : 'N/A'}</b>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Semesters:</span> <b>{importPreview.semesters?.length || 0}</b>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Courses:</span> <b>{importPreview.courses?.length || 0}</b>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Classes / Periods:</span> <b>{importPreview.periods?.length || 0}</b>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Assignments / Tasks:</span> <b>{importPreview.assignments?.length || 0}</b>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Exams:</span> <b>{importPreview.exams?.length || 0}</b>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Grade components:</span> <b>{(importPreview.gradeComponents || importPreview.grade_components)?.length || 0}</b>
                    </div>
                  </>
                ) : importType === 'ics' ? (
                  <>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 800 }}>
                      Importing into semester: "{activeSemester?.name}"
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                    {parsedICSItems.map((item, idx) => (
                      <div key={idx} style={{ fontSize: '0.66rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                        📚 <b>{item.courseName}</b> {item.courseCode && `(${item.courseCode})`}
                        <div>
                          ⏰ {item.recurrenceType === 'weekly' ? 'Weekly' : 'One-time'} • {item.startTime.substring(0, 5)} ({item.durationMinutes}m)
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 800 }}>
                      Importing PDF into semester: "{activeSemester?.name}"
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                    
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', margin: '4px 0 2px' }}>
                      Courses Detected ({parsedPDFItems?.courses.length || 0})
                    </div>
                    {parsedPDFItems?.courses.map((c: any, idx: number) => (
                      <div key={`c-${idx}`} style={{ fontSize: '0.66rem', color: 'var(--text-muted)', borderBottom: '1px dashed var(--border-glass)', paddingBottom: '4px', marginBottom: '4px' }}>
                        📚 <b>{c.course_name}</b> {c.course_code && `(${c.course_code})`}
                        {c.teacher_name && <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>Teacher: {c.teacher_name}</div>}
                      </div>
                    ))}
                    
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', margin: '12px 0 2px' }}>
                      Periods Detected ({parsedPDFItems?.periods.length || 0})
                    </div>
                    {parsedPDFItems?.periods.map((p: any, idx: number) => (
                      <div key={`p-${idx}`} style={{ fontSize: '0.66rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '4px', marginBottom: '4px' }}>
                        ⏰ <b>{p.course_name}</b> {p.course_code && `(${p.course_code})`}
                        <div>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.day_of_week] || 'Day'} • {p.start_time.substring(0, 5)} ({p.duration_minutes}m) {p.room_number && `• Rm ${p.room_number}`}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
 
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setImportPreview(null);
                  setParsedICSItems([]);
                  setParsedPDFItems(null);
                }}
                className="btn-secondary"
                style={{ flex: 1, padding: '10px', fontSize: '0.76rem' }}
              >
                Cancel
              </button>
              <button
                onClick={
                  importType === 'json'
                    ? handleImportJSONConfirm
                    : importType === 'ics'
                    ? handleImportICSConfirm
                    : handleImportPDFConfirm
                }
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '0.76rem' }}
              >
                Import Data
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
