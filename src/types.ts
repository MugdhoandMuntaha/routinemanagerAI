// ─── Database Types (aligned with Supabase schema) ───

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  user_id: string;
  theme: 'light' | 'dark' | 'amoled';
  week_start_day: number;
  notification_minutes_before: number;
  notification_sound: string;
  language: string;
  large_text_mode: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type Semester = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  user_id: string;
  semester_id: string;
  course_name: string;
  course_code: string;
  teacher_name: string;
  room_number: string;
  color: string;
  credit_hours: number;
  notes: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RecurrenceType = 'weekly' | 'one-time';

export type Period = {
  id: string;
  user_id: string;
  course_id: string;
  recurrence_type: RecurrenceType;
  day_of_week: number | null; // 0=Sun..6=Sat
  specific_date: string | null; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS" from Postgres time type
  duration_minutes: number;
  room_number: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Period joined with course info (from periods_with_course view) */
export type PeriodWithCourse = {
  period_id: string;
  user_id: string;
  course_id: string;
  recurrence_type: RecurrenceType;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  duration_minutes: number;
  room_number: string;
  sort_order: number;
  course_name: string;
  course_code: string;
  teacher_name: string;
  course_color: string;
  credit_hours: number;
  semester_id: string;
};

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'cancelled' | 'excused';

export type Attendance = {
  id: string;
  user_id: string;
  period_id: string;
  date: string;
  status: AttendanceStatus;
  note: string;
  created_at: string;
};

export type AssignmentPriority = 'low' | 'medium' | 'high' | 'urgent';

export type Assignment = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  priority: AssignmentPriority;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ExamType = 'quiz' | 'midterm' | 'final' | 'lab' | 'viva' | 'other';

export type Exam = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  exam_type: ExamType;
  exam_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  room_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type GradeCategory = 'quiz' | 'assignment' | 'midterm' | 'final' | 'lab' | 'project' | 'participation' | 'other';

export type GradeComponent = {
  id: string;
  user_id: string;
  course_id: string;
  name: string;
  category: GradeCategory;
  weight: number;
  max_score: number;
  obtained_score: number | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─── UI Constants ───

/** Accent colors for courses */
export const ACCENT_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#22d3ee', // cyan
  '#34d399', // emerald
  '#fb7185', // rose
  '#fbbf24', // amber
  '#f472b6', // pink
  '#60a5fa', // blue
  '#f97316', // orange
  '#a78bfa', // purple
  '#2dd4bf', // teal
  '#e879f9', // fuchsia
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_FULL_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DURATION_OPTIONS = [30, 40, 45, 50, 60, 75, 90, 120];
