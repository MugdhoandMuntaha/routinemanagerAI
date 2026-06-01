'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCourse } from '@/context/CourseContext';
import { supabase } from '@/lib/supabase';
import { triggerHapticLight, triggerHapticSuccess, triggerHapticWarning } from '@/lib/haptics';
import type { Course } from '@/types';

type StudyLog = {
  id: string;
  course_id: string | null;
  duration_minutes: number;
  session_date: string;
  created_at: string;
};

export default function ProductivityHub() {
  const { user } = useAuth();
  const { courses } = useCourse();

  // Pomodoro States
  const [timerMode, setTimerMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Study Logs States
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  // Timer Reference
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize time left on mode changes
  useEffect(() => {
    if (timerMode === 'focus') setTimeLeft(focusMinutes * 60);
    else if (timerMode === 'shortBreak') setTimeLeft(shortBreakMinutes * 60);
    else if (timerMode === 'longBreak') setTimeLeft(longBreakMinutes * 60);
    setTimerActive(false);
  }, [timerMode, focusMinutes, shortBreakMinutes, longBreakMinutes]);

  // Pomodoro timer tick loop
  useEffect(() => {
    if (timerActive) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerActive, timerMode]);

  // Complete Pomodoro cycle
  const handleTimerComplete = async () => {
    setTimerActive(false);
    
    if (timerMode === 'focus') {
      triggerHapticSuccess();
      alert('Focus session complete! Take a break.');

      // Log session in Database (Feature 6.1)
      if (user) {
        try {
          const { error } = await supabase.from('study_logs').insert({
            user_id: user.id,
            course_id: selectedCourseId || null,
            duration_minutes: focusMinutes,
          });
          if (error) throw error;
          fetchStudyLogs(); // Reload logs list and charts
        } catch (err) {
          console.error('Failed to save study log:', err);
        }
      }
      
      // Auto switch to break mode
      setTimerMode('shortBreak');
    } else {
      triggerHapticLight();
      alert('Break finished! Ready to focus?');
      setTimerMode('focus');
    }
  };

  // Start / Pause timer
  const toggleTimer = () => {
    triggerHapticLight();
    setTimerActive(!timerActive);
  };

  // Reset timer
  const resetTimer = () => {
    triggerHapticLight();
    setTimerActive(false);
    if (timerMode === 'focus') setTimeLeft(focusMinutes * 60);
    else if (timerMode === 'shortBreak') setTimeLeft(shortBreakMinutes * 60);
    else if (timerMode === 'longBreak') setTimeLeft(longBreakMinutes * 60);
  };

  // ─── Fetch Weekly Study Logs (6.2) ────────────────
  const fetchStudyLogs = async () => {
    if (!user) return;
    setIsLoadingLogs(true);
    
    // Find Monday of the current week as start date
    const startOfWeek = new Date();
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    try {
      const { data, error } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('session_date', startOfWeek.toISOString().split('T')[0])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudyLogs(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchStudyLogs();
  }, [user]);

  // Delete Log
  const handleDeleteLog = async (id: string) => {
    const confirm = window.confirm('Delete this study log entry?');
    if (!confirm) return;

    triggerHapticWarning();
    const { error } = await supabase.from('study_logs').delete().eq('id', id);
    if (error) {
      alert('Failed to delete log.');
    } else {
      fetchStudyLogs();
    }
  };

  // Realtime subscription setup
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('study-logs-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_logs', filter: `user_id=eq.${user.id}` },
        () => {
          fetchStudyLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Aggregate stats for SVG Bar Chart
  const chartData = useMemo(() => {
    const stats: Record<string, { minutes: number; name: string; color: string }> = {};

    // Group study logs by course
    studyLogs.forEach((log) => {
      const courseId = log.course_id || 'general';
      
      if (!stats[courseId]) {
        let name = 'General Study';
        let color = '#64748b'; // neutral slate
        
        if (log.course_id) {
          const course = courses.find((c) => c.id === log.course_id);
          name = course?.course_name || 'Deleted Course';
          color = course?.color || '#6366f1';
        }
        
        stats[courseId] = { minutes: 0, name, color };
      }
      
      stats[courseId].minutes += log.duration_minutes;
    });

    return Object.values(stats).sort((a, b) => b.minutes - a.minutes);
  }, [studyLogs, courses]);

  // Formatting helpers
  const formatTimeLeft = () => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPercentageTime = () => {
    let total = focusMinutes * 60;
    if (timerMode === 'shortBreak') total = shortBreakMinutes * 60;
    else if (timerMode === 'longBreak') total = longBreakMinutes * 60;
    return ((total - timeLeft) / total) * 100;
  };

  // Circular progress math
  const strokeDashoffset = 2 * Math.PI * 70 * (1 - getPercentageTime() / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* ─── POMODORO TIMER PANEL ───────────────────── */}
      <section className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', alignSelf: 'flex-start', marginBottom: '14px' }}>
          ⏱ Focus Timer
        </h2>

        {/* Timer Mode Selectors */}
        <div style={{ display: 'flex', width: '100%', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '3px', marginBottom: '20px' }}>
          <button
            onClick={() => { triggerHapticLight(); setTimerMode('focus'); }}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase',
              background: timerMode === 'focus' ? 'var(--accent-ghost)' : 'transparent',
              color: timerMode === 'focus' ? 'var(--accent)' : 'var(--text-muted)',
              boxShadow: timerMode === 'focus' ? 'var(--hud-glow)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Focus
          </button>
          <button
            onClick={() => { triggerHapticLight(); setTimerMode('shortBreak'); }}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase',
              background: timerMode === 'shortBreak' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              color: timerMode === 'shortBreak' ? '#10b981' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Short Break
          </button>
          <button
            onClick={() => { triggerHapticLight(); setTimerMode('longBreak'); }}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase',
              background: timerMode === 'longBreak' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
              color: timerMode === 'longBreak' ? '#10b981' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            Long Break
          </button>
        </div>

        {/* Circular Progress Timer Ring */}
        <div style={{ position: 'relative', width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background ring */}
            <circle cx="90" cy="90" r="70" fill="none" stroke="var(--border-glass)" strokeWidth="8" />
            {/* Foreground progress ring */}
            <circle
              cx="90"
              cy="90"
              r="70"
              fill="none"
              stroke={timerMode === 'focus' ? 'var(--accent)' : '#10b981'}
              strokeWidth="8"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.5s ease',
                filter: timerMode === 'focus' ? 'drop-shadow(0 0 5px var(--accent-glow))' : 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.4))',
              }}
            />
          </svg>
          {/* Ticking Digital Time Display */}
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.02em', textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>
              {formatTimeLeft()}
            </span>
            <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
              {timerMode === 'focus' ? 'Focus Cycle' : 'Break Period'}
            </span>
          </div>
        </div>

        {/* Course Association Selector */}
        {timerMode === 'focus' && (
          <div style={{ width: '100%', marginBottom: '18px' }}>
            <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
              Link to course for study logging:
            </label>
            <select
              className="glass-select"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              style={{ width: '100%', padding: '10px' }}
            >
              <option value="">General Study / Unlinked</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_name} ({c.course_code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <button
            onClick={toggleTimer}
            className="btn-primary"
            style={{
              flex: 2, padding: '10px', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase',
              background: timerActive ? 'rgba(255,255,255,0.02)' : 'var(--accent)',
              border: timerActive ? '1px solid var(--border-glass)' : '1px solid var(--accent)',
              color: timerActive ? 'var(--text-primary)' : '#fff',
            }}
          >
            {timerActive ? '⏸ Pause' : '▶ Start focus'}
          </button>
          <button
            onClick={resetTimer}
            className="btn-secondary"
            style={{ flex: 1, padding: '10px', fontSize: '0.76rem', textTransform: 'uppercase', fontWeight: 800 }}
          >
            Reset
          </button>
        </div>

        {/* Cycle Length Adjustments */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', width: '100%', marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '14px' }}>
          <div>
            <label style={{ fontSize: '0.54rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px', textAlign: 'center' }}>Focus</label>
            <input
              className="glass-input"
              type="number"
              min="1"
              max="120"
              value={focusMinutes}
              onChange={(e) => setFocusMinutes(Math.max(1, Number(e.target.value)))}
              style={{ padding: '4px', fontSize: '0.74rem', textAlign: 'center' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.54rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px', textAlign: 'center' }}>Short Break</label>
            <input
              className="glass-input"
              type="number"
              min="1"
              max="30"
              value={shortBreakMinutes}
              onChange={(e) => setShortBreakMinutes(Math.max(1, Number(e.target.value)))}
              style={{ padding: '4px', fontSize: '0.74rem', textAlign: 'center' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.54rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px', textAlign: 'center' }}>Long Break</label>
            <input
              className="glass-input"
              type="number"
              min="1"
              max="60"
              value={longBreakMinutes}
              onChange={(e) => setLongBreakMinutes(Math.max(1, Number(e.target.value)))}
              style={{ padding: '4px', fontSize: '0.74rem', textAlign: 'center' }}
            />
          </div>
        </div>
      </section>

      {/* ─── WEEKLY STUDY TRACKER SVG BAR CHART (6.2) ─── */}
      <section className="glass-card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
          📊 Weekly Study Distribution
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Aggregate study duration logged this week.
        </p>

        {chartData.length === 0 ? (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
            No study sessions logged for the active week.
          </p>
        ) : (
          <div style={{ width: '100%' }}>
            {/* Custom SVG Bar Chart */}
            <svg viewBox={`0 0 400 ${chartData.length * 40 + 20}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {chartData.map((data, idx) => {
                const y = idx * 40 + 10;
                
                // Find maximum minutes to scale bars
                const maxMin = Math.max(...chartData.map((c) => c.minutes));
                const barWidth = Math.max(10, (data.minutes / maxMin) * 240); // Max width 240px
                const hours = (data.minutes / 60).toFixed(1);

                return (
                  <g key={idx}>
                    {/* Course Label */}
                    <text
                      x="10"
                      y={y + 18}
                      fill="var(--text-secondary)"
                      fontSize="10"
                      fontWeight="bold"
                      style={{ fontFamily: 'var(--font-sans)', textAnchor: 'start' }}
                    >
                      {data.name.length > 18 ? data.name.slice(0, 16) + '..' : data.name.toUpperCase()}
                    </text>

                    {/* Chart Bar Background track */}
                    <rect x="130" y={y + 8} width="240" height="12" rx="4" fill="rgba(255,255,255,0.01)" stroke="var(--border-glass)" strokeWidth="0.5" />
                    
                    {/* Chart Bar Fill (Pulsing glowing course-specific colors) */}
                    <rect
                      x="130"
                      y={y + 8}
                      width={barWidth}
                      height="12"
                      rx="4"
                      fill={data.color}
                      style={{
                        filter: `drop-shadow(0 0 3px ${data.color}55)`,
                        transition: 'width 0.8s ease-out',
                      }}
                    />

                    {/* Hours studied label */}
                    <text
                      x="380"
                      y={y + 18}
                      fill={data.color}
                      fontSize="10"
                      fontWeight="800"
                      style={{ fontFamily: 'var(--font-mono)', textAnchor: 'end' }}
                    >
                      {hours}H
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </section>

      {/* ─── STUDY LOGS LIST ────────────────────────── */}
      <section className="glass-card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
          📜 Study Logs
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
          {isLoadingLogs ? (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
              <div className="loading-spinner" />
            </div>
          ) : studyLogs.length === 0 ? (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '15px 0' }}>
              No study logs recorded.
            </p>
          ) : (
            studyLogs.map((log) => {
              const course = courses.find((c) => c.id === log.course_id);
              const color = course?.color || '#64748b';

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)',
                    borderRadius: '8px', fontSize: '0.7rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
                    <div>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                        {course ? course.course_name : 'General Focus Session'}
                      </span>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(log.session_date + 'T00:00:00').toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, color: color, fontFamily: 'var(--font-mono)' }}>
                      +{log.duration_minutes}m
                    </span>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

    </div>
  );
}
