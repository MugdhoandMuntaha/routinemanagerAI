'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { useSemester } from './SemesterContext';
import { useCourse } from './CourseContext';
import { useRoutine } from './RoutineContext';
import type {
  Attendance,
  AttendanceStatus,
  Assignment,
  Exam,
  GradeComponent,
} from '@/types';

type CourseAttendanceSummary = {
  course_id: string;
  user_id: string;
  course_name: string;
  course_code: string;
  semester_id: string;
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  cancelled_count: number;
  excused_count: number;
  attendance_percentage: number;
};

type CourseGradeSummary = {
  course_id: string;
  user_id: string;
  course_name: string;
  course_code: string;
  credit_hours: number;
  semester_id: string;
  total_weight: number;
  weighted_percentage: number | null;
  total_components: number;
  graded_components: number;
};

type AcademicContextValue = {
  attendance: Attendance[];
  assignments: Assignment[];
  exams: Exam[];
  gradeComponents: GradeComponent[];
  courseAttendanceSummaries: CourseAttendanceSummary[];
  courseGradeSummaries: CourseGradeSummary[];
  semesterGPA: number | null;
  loading: boolean;
  
  // Attendance
  markAttendance: (periodId: string, date: string, status: AttendanceStatus, note?: string) => Promise<void>;
  
  // Assignments
  addAssignment: (data: Omit<Assignment, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  toggleAssignmentComplete: (id: string, completed: boolean) => Promise<void>;
  
  // Exams
  addExam: (data: Omit<Exam, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editExam: (id: string, data: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  
  // Grade Components
  addGradeComponent: (data: Omit<GradeComponent, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editGradeComponent: (id: string, data: Partial<GradeComponent>) => Promise<void>;
  deleteGradeComponent: (id: string) => Promise<void>;
  
  refreshAll: () => Promise<void>;
};

const AcademicContext = createContext<AcademicContextValue | null>(null);

export function AcademicProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeSemester } = useSemester();
  const { courses } = useCourse();
  const { periods } = useRoutine();

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [gradeComponents, setGradeComponents] = useState<GradeComponent[]>([]);
  const [courseAttendanceSummaries, setCourseAttendanceSummaries] = useState<CourseAttendanceSummary[]>([]);
  const [courseGradeSummaries, setCourseGradeSummaries] = useState<CourseGradeSummary[]>([]);
  const [semesterGPA, setSemesterGPA] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);

  // Fetch Attendance records
  const fetchAttendance = useCallback(async () => {
    if (!user || !activeSemester) {
      setAttendance([]);
      return;
    }
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching attendance:', error);
    } else {
      // Filter attendance records by periods in active semester
      const periodIds = new Set(periods.map((p) => p.period_id));
      const filtered = (data ?? []).filter((a) => periodIds.has(a.period_id));
      setAttendance(filtered);
    }
  }, [user, activeSemester, periods]);

  // Fetch Assignments
  const fetchAssignments = useCallback(async () => {
    if (!user || !activeSemester) {
      setAssignments([]);
      return;
    }
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching assignments:', error);
    } else {
      const courseIds = new Set(courses.map((c) => c.id));
      const filtered = (data ?? []).filter((a) => courseIds.has(a.course_id));
      setAssignments(filtered);
    }
  }, [user, activeSemester, courses]);

  // Fetch Exams
  const fetchExams = useCallback(async () => {
    if (!user || !activeSemester) {
      setExams([]);
      return;
    }
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('user_id', user.id)
      .order('exam_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching exams:', error);
    } else {
      const courseIds = new Set(courses.map((c) => c.id));
      const filtered = (data ?? []).filter((e) => courseIds.has(e.course_id));
      setExams(filtered);
    }
  }, [user, activeSemester, courses]);

  // Fetch Grade Components
  const fetchGradeComponents = useCallback(async () => {
    if (!user || !activeSemester) {
      setGradeComponents([]);
      return;
    }
    const { data, error } = await supabase
      .from('grade_components')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching grade components:', error);
    } else {
      const courseIds = new Set(courses.map((c) => c.id));
      const filtered = (data ?? []).filter((g) => courseIds.has(g.course_id));
      setGradeComponents(filtered);
    }
  }, [user, activeSemester, courses]);

  // Fetch summaries and GPA
  const fetchSummariesAndGPA = useCallback(async () => {
    if (!user || !activeSemester) {
      setCourseAttendanceSummaries([]);
      setCourseGradeSummaries([]);
      setSemesterGPA(null);
      return;
    }

    // Attendance Summary
    const { data: attData, error: attErr } = await supabase
      .from('course_attendance_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('semester_id', activeSemester.id);
    if (attErr) console.error('Error fetching attendance summary view:', attErr);
    else setCourseAttendanceSummaries(attData ?? []);

    // Grade Summary
    const { data: grData, error: grErr } = await supabase
      .from('course_grade_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('semester_id', activeSemester.id);
    if (grErr) console.error('Error fetching grade summary view:', grErr);
    else setCourseGradeSummaries(grData ?? []);

    // Calculate CGPA via RPC
    const { data: gpaData, error: gpaErr } = await supabase
      .rpc('calculate_semester_gpa', {
        p_user_id: user.id,
        p_semester_id: activeSemester.id,
      });
    if (gpaErr) console.error('Error calling calculate_semester_gpa RPC:', gpaErr);
    else setSemesterGPA(gpaData !== null ? Number(gpaData) : null);
  }, [user, activeSemester]);

  // Bulk loading helper
  const loadAll = useCallback(async () => {
    if (!user || !activeSemester) {
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([
      fetchAttendance(),
      fetchAssignments(),
      fetchExams(),
      fetchGradeComponents(),
      fetchSummariesAndGPA(),
    ]);
    setLoading(false);
  }, [
    user,
    activeSemester,
    fetchAttendance,
    fetchAssignments,
    fetchExams,
    fetchGradeComponents,
    fetchSummariesAndGPA,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime replication subscriptions
  useEffect(() => {
    if (!user || !activeSemester) return;

    // We can listen to changes on all relevant tables
    const attendanceChannel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${user.id}` },
        () => {
          fetchAttendance();
          fetchSummariesAndGPA();
        }
      )
      .subscribe();

    const assignmentsChannel = supabase
      .channel('assignments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments', filter: `user_id=eq.${user.id}` },
        () => {
          fetchAssignments();
        }
      )
      .subscribe();

    const examsChannel = supabase
      .channel('exams-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exams', filter: `user_id=eq.${user.id}` },
        () => {
          fetchExams();
        }
      )
      .subscribe();

    const gradesChannel = supabase
      .channel('grades-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grade_components', filter: `user_id=eq.${user.id}` },
        () => {
          fetchGradeComponents();
          fetchSummariesAndGPA();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(assignmentsChannel);
      supabase.removeChannel(examsChannel);
      supabase.removeChannel(gradesChannel);
    };
  }, [user, activeSemester, fetchAttendance, fetchAssignments, fetchExams, fetchGradeComponents, fetchSummariesAndGPA]);

  // Attendance CRUD
  const markAttendance = useCallback(
    async (periodId: string, date: string, status: AttendanceStatus, note: string = '') => {
      if (!user) return;
      const { error } = await supabase.from('attendance').upsert(
        {
          user_id: user.id,
          period_id: periodId,
          date,
          status,
          note,
        },
        { onConflict: 'period_id,date' }
      );

      if (error) {
        console.error('Error marking attendance:', error);
      } else {
        await fetchAttendance();
        await fetchSummariesAndGPA();
      }
    },
    [user, fetchAttendance, fetchSummariesAndGPA]
  );

  // Assignments CRUD
  const addAssignment = useCallback(
    async (data: Omit<Assignment, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) return;
      const { error } = await supabase.from('assignments').insert({
        ...data,
        user_id: user.id,
      });

      if (error) console.error('Error adding assignment:', error);
      else await fetchAssignments();
    },
    [user, fetchAssignments]
  );

  const editAssignment = useCallback(
    async (id: string, data: Partial<Assignment>) => {
      const { error } = await supabase
        .from('assignments')
        .update(data)
        .eq('id', id);

      if (error) console.error('Error editing assignment:', error);
      else await fetchAssignments();
    },
    [fetchAssignments]
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);

      if (error) console.error('Error deleting assignment:', error);
      else await fetchAssignments();
    },
    [fetchAssignments]
  );

  const toggleAssignmentComplete = useCallback(
    async (id: string, completed: boolean) => {
      const { error } = await supabase
        .from('assignments')
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', id);

      if (error) console.error('Error toggling assignment completion:', error);
      else await fetchAssignments();
    },
    [fetchAssignments]
  );

  // Exams CRUD
  const addExam = useCallback(
    async (data: Omit<Exam, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) return;
      const { error } = await supabase.from('exams').insert({
        ...data,
        user_id: user.id,
      });

      if (error) console.error('Error adding exam:', error);
      else await fetchExams();
    },
    [user, fetchExams]
  );

  const editExam = useCallback(
    async (id: string, data: Partial<Exam>) => {
      const { error } = await supabase
        .from('exams')
        .update(data)
        .eq('id', id);

      if (error) console.error('Error editing exam:', error);
      else await fetchExams();
    },
    [fetchExams]
  );

  const deleteExam = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('exams').delete().eq('id', id);

      if (error) console.error('Error deleting exam:', error);
      else await fetchExams();
    },
    [fetchExams]
  );

  // Grade Components CRUD
  const addGradeComponent = useCallback(
    async (data: Omit<GradeComponent, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) return;
      const { error } = await supabase.from('grade_components').insert({
        ...data,
        user_id: user.id,
      });

      if (error) console.error('Error adding grade component:', error);
      else {
        await fetchGradeComponents();
        await fetchSummariesAndGPA();
      }
    },
    [user, fetchGradeComponents, fetchSummariesAndGPA]
  );

  const editGradeComponent = useCallback(
    async (id: string, data: Partial<GradeComponent>) => {
      const { error } = await supabase
        .from('grade_components')
        .update(data)
        .eq('id', id);

      if (error) console.error('Error editing grade component:', error);
      else {
        await fetchGradeComponents();
        await fetchSummariesAndGPA();
      }
    },
    [fetchGradeComponents, fetchSummariesAndGPA]
  );

  const deleteGradeComponent = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('grade_components').delete().eq('id', id);

      if (error) console.error('Error deleting grade component:', error);
      else {
        await fetchGradeComponents();
        await fetchSummariesAndGPA();
      }
    },
    [fetchGradeComponents, fetchSummariesAndGPA]
  );

  return (
    <AcademicContext.Provider
      value={{
        attendance,
        assignments,
        exams,
        gradeComponents,
        courseAttendanceSummaries,
        courseGradeSummaries,
        semesterGPA,
        loading,
        markAttendance,
        addAssignment,
        editAssignment,
        deleteAssignment,
        toggleAssignmentComplete,
        addExam,
        editExam,
        deleteExam,
        addGradeComponent,
        editGradeComponent,
        deleteGradeComponent,
        refreshAll: loadAll,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
}

export function useAcademic() {
  const ctx = useContext(AcademicContext);
  if (!ctx) throw new Error('useAcademic must be used within AcademicProvider');
  return ctx;
}
