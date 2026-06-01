'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSemester } from '@/context/SemesterContext';
import { supabase } from '@/lib/supabase';
import WeeklyGridView from './WeeklyGridView';
import { triggerHapticLight, triggerHapticSuccess, triggerHapticWarning } from '@/lib/haptics';
import { ACCENT_COLORS } from '@/types';

type Props = {
  shareId: string;
  onClose: () => void;
  onStartCompare: (friendPeriods: any[], friendName: string) => void;
};

export default function SharedScheduleView({ shareId, onClose, onStartCompare }: Props) {
  const { user } = useAuth();
  const { activeSemester } = useSemester();

  const [loading, setLoading] = useState(true);
  const [friendName, setFriendName] = useState('');
  const [friendPeriods, setFriendPeriods] = useState<any[]>([]);
  const [friendCourses, setFriendCourses] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    async function loadSharedData() {
      setLoading(true);
      try {
        // 1. Fetch share metadata (and join profile name)
        const { data: share, error: sErr } = await supabase
          .from('shared_schedules')
          .select('user_id, semester_id, profiles(full_name)')
          .eq('id', shareId)
          .single();

        if (sErr || !share) {
          throw new Error('This shared schedule link is invalid or has been deactivated.');
        }

        const name = (share.profiles as any)?.full_name || 'Classmate';
        setFriendName(name);

        // 2. Fetch periods
        const { data: periodsData, error: pErr } = await supabase
          .from('periods_with_course')
          .select('*')
          .eq('user_id', share.user_id)
          .eq('semester_id', share.semester_id);

        if (pErr) throw pErr;

        // 3. Fetch raw courses (needed for cloning references)
        const { data: coursesData, error: cErr } = await supabase
          .from('courses')
          .select('*')
          .eq('user_id', share.user_id)
          .eq('semester_id', share.semester_id);

        if (cErr) throw cErr;

        setFriendPeriods(periodsData ?? []);
        setFriendCourses(coursesData ?? []);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Failed to retrieve shared schedule data.');
      } finally {
        setLoading(false);
      }
    }

    loadSharedData();
  }, [shareId]);

  // Clone/Import schedule logic
  const handleImportSchedule = async () => {
    if (!user) {
      alert('Sign in to import this schedule to your profile.');
      return;
    }
    if (!activeSemester) {
      alert('Initialize an active semester first before importing schedules.');
      return;
    }

    const confirm = window.confirm(`Import ${friendName}'s schedule? This will create these courses and classes in your active semester "${activeSemester.name}".`);
    if (!confirm) return;

    triggerHapticLight();
    setIsCloning(true);

    try {
      const courseIdMap: Record<string, string> = {};

      // 1. Clone Courses
      for (const course of friendCourses) {
        const newCourseId = crypto.randomUUID();
        courseIdMap[course.id] = newCourseId;

        const { error: cErr } = await supabase.from('courses').insert({
          id: newCourseId,
          user_id: user.id,
          semester_id: activeSemester.id,
          course_name: course.course_name,
          course_code: course.course_code,
          teacher_name: course.teacher_name || '',
          room_number: course.room_number || '',
          color: course.color || ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
          credit_hours: Number(course.credit_hours ?? 3),
          notes: course.notes || '',
        });

        if (cErr) throw cErr;
      }

      // 2. Clone Periods
      const periodsToInsert = friendPeriods.map((p) => {
        const mappedCourseId = courseIdMap[p.course_id];
        if (!mappedCourseId) return null;

        return {
          user_id: user.id,
          course_id: mappedCourseId,
          recurrence_type: p.recurrence_type,
          day_of_week: p.day_of_week,
          specific_date: p.specific_date,
          start_time: p.start_time,
          duration_minutes: p.duration_minutes,
          room_number: p.room_number || '',
        };
      }).filter((p): p is NonNullable<typeof p> => p !== null);

      if (periodsToInsert.length > 0) {
        const { error: pErr } = await supabase.from('periods').insert(periodsToInsert);
        if (pErr) throw pErr;
      }

      triggerHapticSuccess();
      alert('Schedule imported successfully! All classes are added.');
      window.location.href = '/'; // Reload cleanly
    } catch (err: any) {
      console.error(err);
      alert(`Import failed: ${err.message || 'Database write error'}`);
      triggerHapticWarning();
    } finally {
      setIsCloning(false);
    }
  };

  const handleCompareTrigger = () => {
    if (!user) {
      alert('Sign in to compare this schedule with your own.');
      return;
    }
    triggerHapticSuccess();
    onStartCompare(friendPeriods, friendName);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg-base)',
        zIndex: 200, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '16px', width: '100%', paddingBottom: '40px' }}>
        
        {/* Header */}
        <header style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-glass)', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <p style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shared Schedule View
              </p>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '2px' }}>
                {loading ? 'Loading...' : `${friendName}'s Calendar`}
              </h1>
            </div>
            <button
              onClick={onClose}
              className="semester-selector"
              style={{ padding: '6px 12px', fontSize: '0.72rem', border: '1px solid var(--border-glass)', background: 'transparent' }}
            >
              Exit View
            </button>
          </div>

          {/* Action buttons (only show if data loaded successfully) */}
          {!loading && !errorMsg && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={handleImportSchedule}
                disabled={isCloning}
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                📥 {isCloning ? 'Importing...' : 'Import to My Schedule'}
              </button>
              <button
                onClick={handleCompareTrigger}
                className="btn-secondary"
                style={{ flex: 1, padding: '10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                ⇅ Compare with Mine
              </button>
            </div>
          )}
        </header>

        {/* Content body */}
        <main>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <div className="loading-spinner" />
            </div>
          ) : errorMsg ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>⚠️</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase' }}>
                {errorMsg}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Weekly Timetable Grid
                </span>
              </div>
              <WeeklyGridView periods={friendPeriods} onViewPeriod={() => {}} />
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
