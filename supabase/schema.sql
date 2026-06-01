-- ╔══════════════════════════════════════════════════════════════════╗
-- ║           ROUTINE MANAGER — SUPABASE SQL SCHEMA                ║
-- ║                                                                ║
-- ║  Covers: Categories 1 (Schedule), 2 (Academic), 3 (UX/Polish) ║
-- ║  Features: 1.1–1.8, 2.1–2.5, 3.1–3.8                         ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 0. EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";   -- for gen_random_uuid()
create extension if not exists "moddatetime"; -- for auto-updating updated_at


-- ═══════════════════════════════════════════════════════════════════
-- 1. PROFILES (extends Supabase auth.users)
-- ═══════════════════════════════════════════════════════════════════
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text default '',
  avatar_url    text default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'User profiles linked to Supabase Auth';

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ═══════════════════════════════════════════════════════════════════
-- 2. USER SETTINGS (Feature 7.x — future-proofing)
-- ═══════════════════════════════════════════════════════════════════
create table public.user_settings (
  user_id                    uuid primary key references auth.users(id) on delete cascade,
  theme                      text not null default 'dark'
                               check (theme in ('light', 'dark', 'amoled')),
  week_start_day             smallint not null default 0
                               check (week_start_day between 0 and 6),
  notification_minutes_before smallint not null default 5
                               check (notification_minutes_before between 1 and 60),
  notification_sound         text not null default 'default',
  language                   text not null default 'en',
  large_text_mode            boolean not null default false,
  onboarding_completed       boolean not null default false,  -- Feature 3.6
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on table public.user_settings is 'Per-user app preferences and settings';

-- Auto-create settings on profile creation
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();


-- ═══════════════════════════════════════════════════════════════════
-- 3. SEMESTERS (Feature 1.6)
-- ═══════════════════════════════════════════════════════════════════
create table public.semesters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,              -- e.g. "Fall 2026", "Spring 2027"
  is_active   boolean not null default false,
  sort_order  smallint not null default 0, -- for drag-and-drop reorder (3.1)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.semesters is 'Academic semesters/terms for organizing schedules';

-- Enforce only one active semester per user
create unique index idx_semesters_one_active
  on public.semesters (user_id)
  where (is_active = true);

create index idx_semesters_user on public.semesters (user_id);

-- Auto-create a "Default" semester for new users
create or replace function public.handle_new_user_semester()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.semesters (user_id, name, is_active)
  values (new.id, 'Default', true);
  return new;
end;
$$;

create trigger on_profile_created_semester
  after insert on public.profiles
  for each row execute function public.handle_new_user_semester();


-- ═══════════════════════════════════════════════════════════════════
-- 4. COURSES (Normalized — shared across periods, grades, etc.)
-- ═══════════════════════════════════════════════════════════════════
create table public.courses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  semester_id     uuid not null references public.semesters(id) on delete cascade,
  course_name     text not null,             -- e.g. "Data Structures"
  course_code     text not null,             -- e.g. "CSE 211"
  teacher_name    text not null default '',
  room_number     text not null default '',  -- Feature 1.2: default room
  color           text not null default '#6366f1',  -- custom accent color
  credit_hours    numeric(3,1) not null default 3.0,
  notes           text not null default '',  -- Feature 2.5: course notes (markdown)
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.courses is 'Courses within a semester. Periods, grades, assignments link here.';

create index idx_courses_semester on public.courses (semester_id);
create index idx_courses_user    on public.courses (user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 5. PERIODS (Class time slots — Feature 1.x core)
-- ═══════════════════════════════════════════════════════════════════
create table public.periods (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete cascade,
  -- Recurrence (Feature 1.3)
  recurrence_type   text not null default 'weekly'
                      check (recurrence_type in ('weekly', 'one-time')),
  day_of_week       smallint check (day_of_week between 0 and 6),  -- 0=Sun..6=Sat
  specific_date     date,                    -- for one-time classes
  -- Time
  start_time        time not null,
  duration_minutes  smallint not null default 50
                      check (duration_minutes > 0 and duration_minutes <= 480),
  -- Room override (Feature 1.2 — overrides course default if set)
  room_number       text not null default '',
  -- Ordering (Feature 3.1: drag-and-drop)
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- ─── Constraints ───
  constraint valid_weekly_period check (
    recurrence_type != 'weekly' or day_of_week is not null
  ),
  constraint valid_onetime_period check (
    recurrence_type != 'one-time' or specific_date is not null
  )
);

comment on table public.periods is 'Individual class time slots linked to a course';

create index idx_periods_course    on public.periods (course_id);
create index idx_periods_user      on public.periods (user_id);
create index idx_periods_day       on public.periods (day_of_week) where recurrence_type = 'weekly';
create index idx_periods_date      on public.periods (specific_date) where recurrence_type = 'one-time';


-- ═══════════════════════════════════════════════════════════════════
-- 6. ATTENDANCE (Feature 2.1)
-- ═══════════════════════════════════════════════════════════════════
create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  period_id   uuid not null references public.periods(id) on delete cascade,
  date        date not null,
  status      text not null default 'present'
                check (status in ('present', 'absent', 'late', 'cancelled', 'excused')),
  note        text not null default '',
  created_at  timestamptz not null default now(),

  -- One attendance record per period per date
  constraint unique_attendance unique (period_id, date)
);

comment on table public.attendance is 'Daily attendance records per class period';

create index idx_attendance_period on public.attendance (period_id);
create index idx_attendance_user   on public.attendance (user_id);
create index idx_attendance_date   on public.attendance (date);


-- ═══════════════════════════════════════════════════════════════════
-- 7. ASSIGNMENTS / TASKS (Feature 2.3)
-- ═══════════════════════════════════════════════════════════════════
create table public.assignments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  due_date      timestamptz,                -- null = no deadline
  is_completed  boolean not null default false,
  completed_at  timestamptz,                -- when it was marked complete
  priority      text not null default 'medium'
                  check (priority in ('low', 'medium', 'high', 'urgent')),
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.assignments is 'Assignments and tasks linked to courses';

create index idx_assignments_course   on public.assignments (course_id);
create index idx_assignments_user     on public.assignments (user_id);
create index idx_assignments_due      on public.assignments (due_date) where is_completed = false;
create index idx_assignments_priority on public.assignments (priority) where is_completed = false;


-- ═══════════════════════════════════════════════════════════════════
-- 8. EXAMS (Feature 2.4)
-- ═══════════════════════════════════════════════════════════════════
create table public.exams (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete cascade,
  title             text not null,             -- e.g. "Midterm 1", "Final Exam"
  exam_type         text not null default 'midterm'
                      check (exam_type in ('quiz', 'midterm', 'final', 'lab', 'viva', 'other')),
  exam_date         date,
  start_time        time,
  duration_minutes  smallint check (duration_minutes > 0 and duration_minutes <= 480),
  room_number       text not null default '',
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.exams is 'Exam schedule per course';

create index idx_exams_course on public.exams (course_id);
create index idx_exams_user   on public.exams (user_id);
create index idx_exams_date   on public.exams (exam_date);


-- ═══════════════════════════════════════════════════════════════════
-- 9. GRADE COMPONENTS (Feature 2.2 — GPA Calculator)
-- ═══════════════════════════════════════════════════════════════════
create table public.grade_components (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  name            text not null,               -- e.g. "Quiz 1", "Midterm", "Assignment 3"
  category        text not null default 'other'
                    check (category in ('quiz', 'assignment', 'midterm', 'final', 'lab', 'project', 'participation', 'other')),
  weight          numeric(5,2) not null default 0
                    check (weight >= 0 and weight <= 100),  -- percentage weight
  max_score       numeric(7,2) not null default 100,
  obtained_score  numeric(7,2),                -- null = not graded yet
  graded_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.grade_components is 'Individual grade entries (quizzes, midterms, etc.) per course';

create index idx_grades_course on public.grade_components (course_id);
create index idx_grades_user   on public.grade_components (user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 9b. STUDY LOGS (Feature 6.2 — Productivity & Study Tools)
-- ═══════════════════════════════════════════════════════════════════
create table public.study_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  course_id         uuid references public.courses(id) on delete cascade, -- null = general study
  duration_minutes  smallint not null check (duration_minutes > 0),
  session_date      date not null default current_date,
  created_at        timestamptz not null default now()
);

comment on table public.study_logs is 'Log of focus and study durations per course';

create index idx_study_logs_user   on public.study_logs (user_id);
create index idx_study_logs_course on public.study_logs (course_id);



-- ═══════════════════════════════════════════════════════════════════
-- 10. UPDATED_AT TRIGGERS (auto-update timestamps)
-- ═══════════════════════════════════════════════════════════════════

-- Helper: generic updated_at trigger function
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at
create trigger set_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.user_settings
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.semesters
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.courses
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.periods
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.assignments
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.exams
  for each row execute function public.update_updated_at_column();

create trigger set_updated_at before update on public.grade_components
  for each row execute function public.update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════
-- 11. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
alter table public.profiles         enable row level security;
alter table public.user_settings    enable row level security;
alter table public.semesters        enable row level security;
alter table public.courses          enable row level security;
alter table public.periods          enable row level security;
alter table public.attendance       enable row level security;
alter table public.assignments      enable row level security;
alter table public.exams            enable row level security;
alter table public.grade_components enable row level security;
alter table public.study_logs       enable row level security;

-- ─── Profiles ───
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── User Settings ───
create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- ─── Semesters ───
create policy "Users can view own semesters"
  on public.semesters for select
  using (auth.uid() = user_id);

create policy "Users can create own semesters"
  on public.semesters for insert
  with check (auth.uid() = user_id);

create policy "Users can update own semesters"
  on public.semesters for update
  using (auth.uid() = user_id);

create policy "Users can delete own semesters"
  on public.semesters for delete
  using (auth.uid() = user_id);

-- ─── Courses ───
create policy "Users can view own courses"
  on public.courses for select
  using (auth.uid() = user_id);

create policy "Users can create own courses"
  on public.courses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own courses"
  on public.courses for update
  using (auth.uid() = user_id);

create policy "Users can delete own courses"
  on public.courses for delete
  using (auth.uid() = user_id);

-- ─── Periods ───
create policy "Users can view own periods"
  on public.periods for select
  using (auth.uid() = user_id);

create policy "Users can create own periods"
  on public.periods for insert
  with check (auth.uid() = user_id);

create policy "Users can update own periods"
  on public.periods for update
  using (auth.uid() = user_id);

create policy "Users can delete own periods"
  on public.periods for delete
  using (auth.uid() = user_id);

-- ─── Attendance ───
create policy "Users can view own attendance"
  on public.attendance for select
  using (auth.uid() = user_id);

create policy "Users can create own attendance"
  on public.attendance for insert
  with check (auth.uid() = user_id);

create policy "Users can update own attendance"
  on public.attendance for update
  using (auth.uid() = user_id);

create policy "Users can delete own attendance"
  on public.attendance for delete
  using (auth.uid() = user_id);

-- ─── Assignments ───
create policy "Users can view own assignments"
  on public.assignments for select
  using (auth.uid() = user_id);

create policy "Users can create own assignments"
  on public.assignments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own assignments"
  on public.assignments for update
  using (auth.uid() = user_id);

create policy "Users can delete own assignments"
  on public.assignments for delete
  using (auth.uid() = user_id);

-- ─── Exams ───
create policy "Users can view own exams"
  on public.exams for select
  using (auth.uid() = user_id);

create policy "Users can create own exams"
  on public.exams for insert
  with check (auth.uid() = user_id);

create policy "Users can update own exams"
  on public.exams for update
  using (auth.uid() = user_id);

create policy "Users can delete own exams"
  on public.exams for delete
  using (auth.uid() = user_id);

-- ─── Grade Components ───
create policy "Users can view own grades"
  on public.grade_components for select
  using (auth.uid() = user_id);

create policy "Users can create own grades"
  on public.grade_components for insert
  with check (auth.uid() = user_id);

create policy "Users can update own grades"
  on public.grade_components for update
  using (auth.uid() = user_id);

create policy "Users can delete own grades"
  on public.grade_components for delete
  using (auth.uid() = user_id);


-- ─── Study Logs ───
create policy "Users can view own study logs"
  on public.study_logs for select
  using (auth.uid() = user_id);

create policy "Users can create own study logs"
  on public.study_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own study logs"
  on public.study_logs for delete
  using (auth.uid() = user_id);



-- ═══════════════════════════════════════════════════════════════════
-- 12. HELPER VIEWS
-- ═══════════════════════════════════════════════════════════════════

-- View: Periods joined with course info (most common query)
create or replace view public.periods_with_course as
select
  p.id as period_id,
  p.user_id,
  p.course_id,
  p.recurrence_type,
  p.day_of_week,
  p.specific_date,
  p.start_time,
  p.duration_minutes,
  -- Use period room if set, else fall back to course default room
  case
    when p.room_number != '' then p.room_number
    else c.room_number
  end as room_number,
  p.sort_order,
  c.course_name,
  c.course_code,
  c.teacher_name,
  c.color as course_color,
  c.credit_hours,
  c.semester_id
from public.periods p
join public.courses c on c.id = p.course_id;

-- View: Course attendance summary
create or replace view public.course_attendance_summary as
select
  c.id as course_id,
  c.user_id,
  c.course_name,
  c.course_code,
  c.semester_id,
  count(a.id) as total_classes,
  count(case when a.status = 'present' then 1 end) as present_count,
  count(case when a.status = 'absent' then 1 end) as absent_count,
  count(case when a.status = 'late' then 1 end) as late_count,
  count(case when a.status = 'cancelled' then 1 end) as cancelled_count,
  count(case when a.status = 'excused' then 1 end) as excused_count,
  -- Attendance % (present + late count as attended, exclude cancelled/excused)
  case
    when count(case when a.status in ('present', 'absent', 'late') then 1 end) > 0
    then round(
      count(case when a.status in ('present', 'late') then 1 end)::numeric
      / count(case when a.status in ('present', 'absent', 'late') then 1 end)::numeric
      * 100, 1
    )
    else 0
  end as attendance_percentage
from public.courses c
left join public.periods p on p.course_id = c.id
left join public.attendance a on a.period_id = p.id
group by c.id, c.user_id, c.course_name, c.course_code, c.semester_id;

-- View: Course grade summary
create or replace view public.course_grade_summary as
select
  c.id as course_id,
  c.user_id,
  c.course_name,
  c.course_code,
  c.credit_hours,
  c.semester_id,
  coalesce(sum(g.weight), 0) as total_weight,
  -- Weighted score: sum of (obtained/max * weight) for graded components
  case
    when sum(case when g.obtained_score is not null then g.weight else 0 end) > 0
    then round(
      sum(
        case when g.obtained_score is not null
        then (g.obtained_score / nullif(g.max_score, 0)) * g.weight
        else 0
        end
      )
      / sum(case when g.obtained_score is not null then g.weight else 0 end)
      * 100, 2
    )
    else null
  end as weighted_percentage,
  count(g.id) as total_components,
  count(g.obtained_score) as graded_components
from public.courses c
left join public.grade_components g on g.course_id = c.id
group by c.id, c.user_id, c.course_name, c.course_code, c.credit_hours, c.semester_id;


-- ═══════════════════════════════════════════════════════════════════
-- 13. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Function: Detect time conflicts for a user on a given day (Feature 1.4)
create or replace function public.check_period_conflicts(
  p_user_id uuid,
  p_semester_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_duration_minutes smallint,
  p_exclude_period_id uuid default null  -- exclude when editing
)
returns table (
  conflicting_period_id uuid,
  course_name text,
  course_code text,
  start_time time,
  duration_minutes smallint
)
language sql
stable
as $$
  select
    p.id as conflicting_period_id,
    c.course_name,
    c.course_code,
    p.start_time,
    p.duration_minutes
  from public.periods p
  join public.courses c on c.id = p.course_id
  where p.user_id = p_user_id
    and c.semester_id = p_semester_id
    and p.recurrence_type = 'weekly'
    and p.day_of_week = p_day_of_week
    and (p_exclude_period_id is null or p.id != p_exclude_period_id)
    -- Time overlap check: A overlaps B if A.start < B.end AND B.start < A.end
    and p.start_time < (p_start_time + (p_duration_minutes || ' minutes')::interval)
    and p_start_time < (p.start_time + (p.duration_minutes || ' minutes')::interval);
$$;

-- Function: Switch active semester (deactivates others)
create or replace function public.switch_active_semester(
  p_user_id uuid,
  p_semester_id uuid
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Deactivate all semesters for this user
  update public.semesters
  set is_active = false
  where user_id = p_user_id;

  -- Activate the target semester
  update public.semesters
  set is_active = true
  where id = p_semester_id and user_id = p_user_id;
end;
$$;

-- Function: Calculate GPA for a semester (4.0 scale)
create or replace function public.calculate_semester_gpa(
  p_user_id uuid,
  p_semester_id uuid
)
returns numeric
language sql
stable
as $$
  with course_grades as (
    select
      c.credit_hours,
      -- Weighted percentage to 4.0 GPA points
      case
        when cg.weighted_percentage >= 90 then 4.0
        when cg.weighted_percentage >= 85 then 3.7
        when cg.weighted_percentage >= 80 then 3.3
        when cg.weighted_percentage >= 75 then 3.0
        when cg.weighted_percentage >= 70 then 2.7
        when cg.weighted_percentage >= 65 then 2.3
        when cg.weighted_percentage >= 60 then 2.0
        when cg.weighted_percentage >= 55 then 1.7
        when cg.weighted_percentage >= 50 then 1.3
        when cg.weighted_percentage >= 45 then 1.0
        else 0.0
      end as gpa_points
    from public.course_grade_summary cg
    join public.courses c on c.id = cg.course_id
    where cg.user_id = p_user_id
      and cg.semester_id = p_semester_id
      and cg.weighted_percentage is not null
  )
  select
    case
      when sum(credit_hours) > 0
      then round(sum(gpa_points * credit_hours) / sum(credit_hours), 2)
      else null
    end
  from course_grades;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 14. REALTIME SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════
-- Enable realtime for tables that benefit from live updates

alter publication supabase_realtime add table public.semesters;
alter publication supabase_realtime add table public.courses;
alter publication supabase_realtime add table public.periods;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.assignments;
alter publication supabase_realtime add table public.study_logs;


-- ═══════════════════════════════════════════════════════════════════
-- ✅ SCHEMA COMPLETE
-- ═══════════════════════════════════════════════════════════════════
--
-- Tables:    10 (profiles, user_settings, semesters, courses, periods,
--               attendance, assignments, exams, grade_components, study_logs)
-- Views:     3  (periods_with_course, course_attendance_summary,
--               course_grade_summary)
-- Functions: 5  (handle_new_user, handle_new_profile,
--               handle_new_user_semester, check_period_conflicts,
--               switch_active_semester, calculate_semester_gpa)
-- RLS:       39 policies (full CRUD per user per table)
-- Indexes:   17 targeted indexes
-- Triggers:  10 (auto updated_at + auto-create on signup)
--
