'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSemester } from '@/context/SemesterContext';
import { useRoutine } from '@/context/RoutineContext';
import { useTheme } from '@/context/ThemeContext';
import { useCourse } from '@/context/CourseContext';
import PeriodCard from '@/components/PeriodCard';
import AddPeriodModal from '@/components/AddPeriodModal';
import PeriodDetailModal from '@/components/PeriodDetailModal';
import NotificationManager from '@/components/NotificationManager';
import AuthScreen from '@/components/AuthScreen';
import SemesterManager from '@/components/SemesterManager';
import AnimatedBackground from '@/components/AnimatedBackground';
import AgendaWidget from '@/components/AgendaWidget';
import WeeklyGridView from '@/components/WeeklyGridView';
import SettingsModal from '@/components/SettingsModal';
import { useSettings } from '@/context/SettingsContext';
import BreakIndicator, { getPeriodsWithBreaks } from '@/components/BreakIndicator';
import { DAY_NAMES, DAY_FULL_NAMES } from '@/types';
import type { PeriodWithCourse } from '@/types';
import AcademicDashboard from '@/components/AcademicDashboard';
import { useAcademic } from '@/context/AcademicContext';
import SkeletonCard from '@/components/SkeletonCard';
import EmptyStateIllustration from '@/components/EmptyStateIllustration';
import OnboardingWalkthrough from '@/components/OnboardingWalkthrough';
import { triggerHapticLight, triggerHapticSuccess } from '@/lib/haptics';
import DataManagementModal from '@/components/DataManagementModal';
import SocialHub from '@/components/SocialHub';
import SharedScheduleView from '@/components/SharedScheduleView';
import ProductivityHub from '@/components/ProductivityHub';

type ViewMode = 'list' | 'grid';

export default function HomePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { activeSemester } = useSemester();
  const { getPeriodsForDay, getPeriodsForDate, addPeriod, editPeriod, removePeriod, periods, reorderPeriods, loading: routineLoading } =
    useRoutine();
  const { refreshAll } = useAcademic();
  const { themeInfo } = useTheme();
  const { t } = useSettings();

  const today = new Date().getDay();
  const [activeDay, setActiveDay] = useState(today);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PeriodWithCourse | null>(null);
  const [viewingPeriod, setViewingPeriod] = useState<PeriodWithCourse | null>(null);
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'academic' | 'social' | 'productivity'>('schedule');

  // Focus / DND States (Feature 6.5)
  const [focusPeriod, setFocusPeriod] = useState<PeriodWithCourse | null>(null);
  const [focusSnoozed, setFocusSnoozed] = useState(false);
  const [focusTimeLeft, setFocusTimeLeft] = useState<number>(0);

  // Social & Comparison states
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [friendPeriods, setFriendPeriods] = useState<any[] | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [friendName, setFriendName] = useState('');

  // Drag & Drop Sorting States
  const [reorderMode, setReorderMode] = useState(false);
  const [localPeriodList, setLocalPeriodList] = useState<PeriodWithCourse[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchDraggedIndex, setTouchDraggedIndex] = useState<number | null>(null);
  const [touchY, setTouchY] = useState(0);

  // Pull to Refresh (PTR) States
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullActive, setPullActive] = useState(false);

  // Check shared URL parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const share = params.get('share');
      if (share) {
        setActiveShareId(share);
      }
    }
  }, []);

  // Focus Mode Active Period Checking Hook (Do Not Disturb 6.5)
  useEffect(() => {
    function checkFocusMode() {
      const rightNow = new Date();
      const day = rightNow.getDay();
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayStr = `${rightNow.getFullYear()}-${pad(rightNow.getMonth() + 1)}-${pad(rightNow.getDate())}`;
      const currentSeconds = rightNow.getHours() * 3600 + rightNow.getMinutes() * 60 + rightNow.getSeconds();

      const active = periods.find((p) => {
        const isClassToday =
          p.recurrence_type === 'weekly'
            ? p.day_of_week === day
            : p.specific_date === todayStr;

        if (!isClassToday) return false;

        const [h, m] = p.start_time.split(':').map(Number);
        const startSeconds = h * 3600 + m * 60;
        const endSeconds = startSeconds + p.duration_minutes * 60;

        return currentSeconds >= startSeconds && currentSeconds < endSeconds;
      });

      if (active) {
        setFocusPeriod((prev) => {
          if (!prev || prev.period_id !== active.period_id) {
            setFocusSnoozed(false);
          }
          return active;
        });

        const [h, m] = active.start_time.split(':').map(Number);
        const endSeconds = h * 3600 + m * 60 + active.duration_minutes * 60;
        setFocusTimeLeft(endSeconds - currentSeconds);
      } else {
        setFocusPeriod(null);
        setFocusSnoozed(false);
      }
    }

    checkFocusMode();
    const interval = setInterval(checkFocusMode, 1000);
    return () => clearInterval(interval);
  }, [periods]);

  // Monitor battery level for HUD decoration
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        const onLevelChange = () => setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', onLevelChange);
        return () => battery.removeEventListener('levelchange', onLevelChange);
      }).catch(() => {});
    }
  }, []);

  const dayPeriods = useMemo(() => {
    const todayDate = new Date();
    if (activeDay === today) return getPeriodsForDate(todayDate);
    return getPeriodsForDay(activeDay);
  }, [activeDay, today, periods, getPeriodsForDay, getPeriodsForDate]);

  const periodsWithBreaks = useMemo(() => getPeriodsWithBreaks(dayPeriods), [dayPeriods]);

  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      counts[i] = periods.filter((p) => p.recurrence_type === 'weekly' && p.day_of_week === i).length;
    }
    return counts;
  }, [periods]);

  const todayPeriods = useMemo(() => getPeriodsForDate(new Date()), [periods, getPeriodsForDate]);

  // Sync local period list for Drag & Drop sorting
  useEffect(() => {
    setLocalPeriodList(dayPeriods);
  }, [dayPeriods, reorderMode]);

  const { loading: academicLoading, attendance, assignments, exams, gradeComponents } = useAcademic();
  const { courses } = useCourse();

  // Background Auto-Backup Hook
  useEffect(() => {
    if (routineLoading || academicLoading || !user || !activeSemester) return;
    if (periods.length === 0 && courses.length === 0) return; // avoid backup on completely empty initialization state

    const timer = setTimeout(() => {
      try {
        const backupData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          userEmail: user.email,
          semesters: [activeSemester],
          courses,
          periods,
          attendance,
          assignments,
          exams,
          gradeComponents,
        };

        const saved = localStorage.getItem('routine_manager_auto_backups');
        let slots: any[] = [];
        if (saved) {
          slots = JSON.parse(saved);
        }

        // Check if data is identical to the last backup to prevent duplicate slots
        if (slots.length > 0) {
          const lastSlot = slots[0];
          const lastCourseCount = lastSlot.data.courses?.length;
          const lastPeriodCount = lastSlot.data.periods?.length;
          if (lastCourseCount === courses.length && lastPeriodCount === periods.length) {
            const currentCoursesStr = JSON.stringify(courses);
            const lastCoursesStr = JSON.stringify(lastSlot.data.courses);
            const currentPeriodsStr = JSON.stringify(periods);
            const lastPeriodsStr = JSON.stringify(lastSlot.data.periods);
            if (currentCoursesStr === lastCoursesStr && currentPeriodsStr === lastPeriodsStr) {
              return;
            }
          }
        }

        const newSlot = {
          timestamp: new Date().toISOString(),
          semesterName: activeSemester.name,
          data: backupData,
        };

        const newSlots = [newSlot, ...slots].slice(0, 5);
        localStorage.setItem('routine_manager_auto_backups', JSON.stringify(newSlots));
      } catch (err) {
        console.error('Failed to run auto-backup:', err);
      }
    }, 3000); // 3-second debounce on modification triggers

    return () => clearTimeout(timer);
  }, [periods, courses, attendance, assignments, exams, gradeComponents, routineLoading, academicLoading, user, activeSemester]);

  // Desktop HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    triggerHapticLight();
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newList = [...localPeriodList];
    const draggedItem = newList[draggedIndex];
    newList.splice(draggedIndex, 1);
    newList.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setLocalPeriodList(newList);
    triggerHapticLight();
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    triggerHapticSuccess();
    const orderedIds = localPeriodList.map((p) => p.period_id);
    await reorderPeriods(orderedIds);
  };

  // Mobile Touch Drag & Drop handlers
  const handleTouchStartReorder = (e: React.TouchEvent, index: number) => {
    setTouchDraggedIndex(index);
    setTouchY(e.touches[0].clientY);
    triggerHapticLight();
  };

  const handleTouchMoveReorder = (e: React.TouchEvent) => {
    if (touchDraggedIndex === null) return;
    const currentY = e.touches[0].clientY;
    const diffY = currentY - touchY;

    // Detect moves over card height steps (approx 85px)
    const step = Math.round(diffY / 85);
    if (step !== 0) {
      const targetIndex = touchDraggedIndex + step;
      if (targetIndex >= 0 && targetIndex < localPeriodList.length) {
        const newList = [...localPeriodList];
        const item = newList[touchDraggedIndex];
        newList.splice(touchDraggedIndex, 1);
        newList.splice(targetIndex, 0, item);

        setTouchDraggedIndex(targetIndex);
        setTouchY(currentY);
        setLocalPeriodList(newList);
        triggerHapticLight();
      }
    }
  };

  const handleTouchEndReorder = async () => {
    if (touchDraggedIndex === null) return;
    setTouchDraggedIndex(null);
    triggerHapticSuccess();

    const orderedIds = localPeriodList.map((p) => p.period_id);
    await reorderPeriods(orderedIds);
  };

  // Pull-To-Refresh (PTR) touch event handlers
  const handleTouchStartPTR = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing && activeTab === 'schedule' && !reorderMode) {
      setPullStartY(e.touches[0].clientY);
      setPullActive(true);
    }
  };

  const handleTouchMovePTR = (e: React.TouchEvent) => {
    if (!pullActive || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diffY = currentY - pullStartY;

    if (diffY > 0) {
      // Elastic log-dampening for drag offsets
      const dampY = Math.min(85, diffY * 0.35);
      setPullY(dampY);

      if (dampY >= 35 && pullY < 35) {
        triggerHapticLight();
      }
    }
  };

  const handleTouchEndPTR = async () => {
    if (!pullActive) return;
    setPullActive(false);

    if (pullY >= 35) {
      setIsRefreshing(true);
      setPullY(35);
      triggerHapticLight();

      try {
        await refreshAll();
      } catch (err) {
        console.error('Re-sync pull error:', err);
      } finally {
        setTimeout(() => {
          setPullY(0);
          setIsRefreshing(false);
          triggerHapticSuccess();
        }, 850);
      }
    } else {
      setPullY(0);
    }
  };

  const handleSave = async (data: {
    course_id: string; recurrence_type: 'weekly' | 'one-time';
    day_of_week: number | null; specific_date: string | null;
    start_time: string; duration_minutes: number; room_number: string;
  }) => {
    if (editingPeriod) {
      await editPeriod(editingPeriod.period_id, data);
    } else {
      await addPeriod(data);
    }
    setModalOpen(false);
    setEditingPeriod(null);
  };

  const handleEdit = (p: PeriodWithCourse) => { setEditingPeriod(p); setModalOpen(true); };
  const handleDelete = async (id: string) => { await removePeriod(id); };
  const openAdd = () => { setEditingPeriod(null); setModalOpen(true); };

  // Loading
  if (authLoading) {
    return (
      <>
        <AnimatedBackground />
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" />
        </div>
      </>
    );
  }

  // Auth gate
  if (!user) {
    return (
      <>
        <AnimatedBackground />
        <AuthScreen />
      </>
    );
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <AnimatedBackground />
      <NotificationManager />

      {/* Pull To Refresh Y-offset wrapper */}
      <div
        style={{
          transform: `translateY(${pullY}px)`,
          transition: pullActive ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          minHeight: '100dvh',
          position: 'relative',
        }}
        onTouchStart={handleTouchStartPTR}
        onTouchMove={handleTouchMovePTR}
        onTouchEnd={handleTouchEndPTR}
      >
        {/* Pull To Refresh Indicator */}
        {(pullY > 0 || isRefreshing) && (
          <div
            style={{
              position: 'absolute',
              top: `-${pullY + 25}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              zIndex: 100,
              pointerEvents: 'none',
              opacity: Math.min(1, pullY / 30),
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '2px solid var(--accent)',
                borderTopColor: 'transparent',
                animation: isRefreshing ? 'skeleton-spin 0.8s linear infinite' : 'none',
                transform: isRefreshing ? 'none' : `rotate(${pullY * 6}deg)`,
                transition: isRefreshing ? 'none' : 'transform 0.1s ease',
              }}
            />
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {isRefreshing ? 'Syncing...' : 'Pull to Sync'}
            </span>
          </div>
        )}

        <div
          style={{
            maxWidth: '540px', margin: '0 auto', padding: '0 16px',
            width: '100%', paddingBottom: '110px', position: 'relative', zIndex: 1,
          }}
        >
          {/* ─── macOS-style Header ───────────────────────── */}
          <header style={{ paddingTop: '20px', paddingBottom: '8px' }}>
            {/* Top diagnostic line */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div className="hud-status-bar">
                <span className="hud-status-dot" />
                <span>{t('sync_online')}</span>
              </div>
              {batteryLevel !== null && (
                <div className="hud-status-bar" style={{ borderColor: 'var(--border-glass)' }}>
                  <span>{t('power')} {batteryLevel}%</span>
                </div>
              )}
              <div className="hud-status-bar" style={{ borderColor: 'var(--border-glass)' }}>
                <span>{t('security_enabled')}</span>
              </div>
            </div>

            {/* Top bar with greeting */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {dateStr}
                </p>
                <h1
                  className="cyber-glitch-text"
                  style={{
                    fontSize: '1.75rem', fontWeight: 800,
                    background: 'var(--gradient-accent)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t('routine_manager')}
                </h1>
              </div>

              {/* Right controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px' }}>
                {/* Theme button */}
                <button
                  onClick={() => setThemeModalOpen(true)}
                  title={`Theme: ${themeInfo.name}`}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'var(--accent-ghost)', border: '1px solid var(--border-glass)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.25s ease',
                    color: 'var(--accent)',
                    boxShadow: 'var(--hud-glow)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-glass)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </button>

                {/* Semester */}
                <button onClick={() => setSemesterModalOpen(true)} className="semester-selector">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeSemester?.name || 'No Semester'}
                  </span>
                </button>

                {/* User avatar */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: 'var(--gradient-accent)', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'white', fontWeight: 800, fontSize: '0.78rem',
                      transition: 'all 0.25s ease',
                      boxShadow: showUserMenu ? '0 0 15px var(--accent-glow)' : 'none',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                  </button>

                  {showUserMenu && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowUserMenu(false)} />
                      <div
                        className="slide-in-right"
                        style={{
                          position: 'absolute', top: '38px', right: 0,
                          background: 'var(--bg-elevated)',
                          backdropFilter: 'blur(40px) saturate(1.8)',
                          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                          border: '1px solid var(--border-glass)', borderRadius: '12px',
                          padding: '12px', minWidth: '200px', zIndex: 95,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                      >
                        {/* User info */}
                        <div style={{ padding: '4px 8px', marginBottom: '6px' }}>
                          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1px' }}>
                            {user.user_metadata?.full_name || 'User'}
                          </p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{user.email}</p>
                        </div>

                        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

                        <button
                          onClick={() => { setDataModalOpen(true); setShowUserMenu(false); }}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '8px', border: 'none',
                            background: 'transparent', color: 'var(--text-primary)',
                            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'inherit', transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            textTransform: 'uppercase', letterSpacing: '0.02em',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-ghost)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                          </svg>
                          Data Settings
                        </button>

                        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

                        <button
                          onClick={async () => { await signOut(); setShowUserMenu(false); }}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '8px', border: 'none',
                            background: 'transparent', color: 'var(--danger)',
                            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'inherit', transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            textTransform: 'uppercase', letterSpacing: '0.02em',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ─── View Toggle + Class Count ────────────────── */}
          {activeTab === 'schedule' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--accent-ghost)', borderRadius: '8px',
                  padding: '6px 12px', border: '1px solid var(--border-glass)',
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {dayPeriods.length} {dayPeriods.length === 1 ? t('class_single') : t('class_plural')}
                </span>
              </div>

              <div className="view-toggle">
                <button className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  List
                </button>
                <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                  Grid
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Academic Hub
              </span>
            </div>
          )}

          {/* Tab Content rendering */}
          {activeTab === 'schedule' ? (
            viewMode === 'list' ? (
              <div className="fade-in-up-container" key={`${activeDay}-${reorderMode}`}>
                {/* Agenda Widget */}
                {activeDay === today && !reorderMode && <AgendaWidget periods={todayPeriods} />}

                {/* Day Tabs */}
                {!reorderMode && (
                  <nav style={{ display: 'flex', gap: '6px', padding: '4px', marginBottom: '22px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {DAY_NAMES.map((name, i) => (
                      <button key={i} className={`day-tab ${activeDay === i ? 'active' : ''}`} onClick={() => { triggerHapticLight(); setActiveDay(i); }}>
                        <span className="day-name">{name}</span>
                        {dayCounts[i] > 0 && activeDay !== i && (
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 4px var(--accent)' }} />
                        )}
                        {activeDay === i && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                            {dayCounts[i]}
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                )}

                {/* Day Title / Sorting Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {reorderMode ? 'Reorder Classes' : DAY_FULL_NAMES[activeDay]}
                    {activeDay === today && !reorderMode && (
                      <span
                        className="status-badge status-ongoing"
                        style={{
                          marginLeft: '8px',
                          fontSize: '0.58rem',
                          padding: '2px 8px',
                          verticalAlign: 'middle',
                        }}
                      >
                        <span className="pulse-dot" style={{ width: '4px', height: '4px' }} />
                        Today
                      </span>
                    )}
                  </h2>

                  {/* Reorder Toggle Button */}
                  {dayPeriods.length > 1 && (
                    <button
                      onClick={() => {
                        triggerHapticLight();
                        setReorderMode(!reorderMode);
                      }}
                      style={{
                        background: reorderMode ? 'var(--accent-ghost)' : 'transparent',
                        border: '1px solid',
                        borderColor: reorderMode ? 'var(--accent)' : 'var(--border-glass)',
                        borderRadius: '6px',
                        padding: '3px 10px',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        color: reorderMode ? 'var(--accent)' : 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {reorderMode ? '✓ Done' : '⇅ Sort'}
                    </button>
                  )}
                </div>

                {/* Reorder Sorting Drag List */}
                {reorderMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {localPeriodList.map((period, i) => (
                      <div
                        key={period.period_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => handleTouchStartReorder(e, i)}
                        onTouchMove={handleTouchMoveReorder}
                        onTouchEnd={handleTouchEndReorder}
                        style={{
                          opacity: draggedIndex === i || touchDraggedIndex === i ? 0.45 : 1,
                          transform: draggedIndex === i || touchDraggedIndex === i ? 'scale(0.97)' : 'scale(1)',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          cursor: 'grab',
                        }}
                      >
                        <PeriodCard
                          period={period} index={i}
                          onEdit={() => {}} onDelete={() => {}} onView={() => {}}
                        />
                        {/* Drag grip indicator */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '24px',
                            height: '24px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            zIndex: 10,
                            pointerEvents: 'none',
                          }}
                        >
                          ☰
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Standard Period List View with skeleton and empty states */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {routineLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    ) : dayPeriods.length === 0 ? (
                      <EmptyStateIllustration theme={themeInfo.id} />
                    ) : (
                      periodsWithBreaks.map((item, i) =>
                        item.type === 'period' ? (
                          <div key={item.data.period_id} style={{ marginBottom: '2px' }}>
                            <PeriodCard
                              period={item.data} index={i}
                              onEdit={handleEdit} onDelete={handleDelete}
                              onView={(p) => setViewingPeriod(p)}
                            />
                          </div>
                        ) : (
                          <BreakIndicator key={`break-${item.index}`} minutes={item.minutes} />
                        )
                      )
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="fade-in-up-container" key="grid">
                {routineLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                ) : (
                  <WeeklyGridView
                    periods={periods}
                    onViewPeriod={(p) => setViewingPeriod(p)}
                    friendPeriods={friendPeriods || []}
                    compareMode={compareMode}
                  />
                )}
              </div>
            )
          ) : activeTab === 'academic' ? (
            <div className="fade-in-up-container" key="academic">
              <AcademicDashboard />
            </div>
          ) : activeTab === 'social' ? (
            <div className="fade-in-up-container" key="social">
              <SocialHub
                activeFriendPeriods={friendPeriods}
                setFriendPeriods={setFriendPeriods}
                compareMode={compareMode}
                setCompareMode={setCompareMode}
              />
            </div>
          ) : (
            <div className="fade-in-up-container" key="productivity">
              <ProductivityHub />
            </div>
          )}
        </div>
      </div>

      {/* FAB - Adjusted position to float cleanly above Bottom Nav Bar */}
      {activeTab === 'schedule' && !reorderMode && (
        <button className="fab" onClick={openAdd} aria-label="Add period" style={{ bottom: '92px', zIndex: 75 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Floating macOS-style Bottom Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '460px',
          background: 'var(--bg-elevated)',
          backdropFilter: 'blur(35px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(35px) saturate(1.8)',
          border: '1px solid var(--border-glass)',
          borderRadius: '16px',
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          zIndex: 80,
        }}
      >
        <button
          onClick={() => { triggerHapticLight(); setActiveTab('schedule'); }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'schedule' ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontSize: '0.66rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            transition: 'all 0.25s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginBottom: '2px', opacity: activeTab === 'schedule' ? 1 : 0.6 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {t('schedule')}
        </button>

        <button
          onClick={() => { triggerHapticLight(); setActiveTab('academic'); }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'academic' ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontSize: '0.66rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            transition: 'all 0.25s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginBottom: '2px', opacity: activeTab === 'academic' ? 1 : 0.6 }}>
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
          </svg>
          {t('academic')}
        </button>

        <button
          onClick={() => { triggerHapticLight(); setActiveTab('social'); }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'social' ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontSize: '0.66rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            transition: 'all 0.25s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginBottom: '2px', opacity: activeTab === 'social' ? 1 : 0.6 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {t('social')}
        </button>

        <button
          onClick={() => { triggerHapticLight(); setActiveTab('productivity'); }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'productivity' ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px 0',
            fontSize: '0.66rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            transition: 'all 0.25s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginBottom: '2px', opacity: activeTab === 'productivity' ? 1 : 0.6 }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {t('focus')}
        </button>
      </nav>

      {/* Onboarding walkthrough slideshow */}
      <OnboardingWalkthrough />

      {/* Styles for transition page entry animations */}
      <style>{`
        .fade-in-up-container {
          animation: fadeInUpTransition 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInUpTransition {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes skeleton-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Modals */}
      {modalOpen && (
        <AddPeriodModal
          onClose={() => { setModalOpen(false); setEditingPeriod(null); }}
          onSave={handleSave} editingPeriod={editingPeriod} defaultDay={activeDay}
        />
      )}

      {viewingPeriod && <PeriodDetailModal period={viewingPeriod} onClose={() => setViewingPeriod(null)} />}
      {semesterModalOpen && <SemesterManager onClose={() => setSemesterModalOpen(false)} />}
      {themeModalOpen && <SettingsModal onClose={() => setThemeModalOpen(false)} />}
      {dataModalOpen && <DataManagementModal onClose={() => setDataModalOpen(false)} />}

      {/* Focus Mode Fullscreen Overlay (Do Not Disturb 6.5) */}
      {focusPeriod && !focusSnoozed && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(5, 7, 15, 0.95)',
            backdropFilter: 'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '24px',
            textAlign: 'center',
          }}
        >
          {/* Pulsing warning border scan grid */}
          <div
            style={{
              position: 'absolute', inset: '10px',
              border: '2px dashed rgba(244, 63, 94, 0.2)',
              borderRadius: '16px', pointerEvents: 'none',
              animation: 'dnd-pulse 2s ease-in-out infinite',
            }}
          />

          <div style={{ maxWidth: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 10 }}>
            {/* Class status indicator */}
            <div className="status-badge status-ongoing" style={{ fontSize: '0.64rem', padding: '4px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
              {t('dnd_active')}
            </div>

            <div style={{ margin: '14px 0' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '1.2' }}>
                {focusPeriod.course_name}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                {focusPeriod.course_code}
              </p>
            </div>

            {/* Room teacher metadata */}
            <div style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.74rem' }}>
              {focusPeriod.teacher_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{t('teacher')}</span> <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{focusPeriod.teacher_name}</span>
                </div>
              )}
              {focusPeriod.room_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{t('location')}</span> <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{focusPeriod.room_number}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{t('scheduled_room')}</span> <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{focusPeriod.room_number || 'TBA'}</span>
              </div>
            </div>

            {/* Live digital time counter */}
            <div style={{ margin: '16px 0' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.02em', textShadow: '0 0 10px rgba(255,255,255,0.05)' }}>
                {(() => {
                  const h = Math.floor(focusTimeLeft / 3600);
                  const m = Math.floor((focusTimeLeft % 3600) / 60);
                  const s = focusTimeLeft % 60;
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
                })()}
              </span>
              <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginTop: '2px' }}>
                {t('remaining_session')}
              </span>
            </div>

            {/* Snooze bypass link */}
            <button
              onClick={() => { triggerHapticLight(); setFocusSnoozed(true); }}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
                letterSpacing: '0.04em', textDecoration: 'underline', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {t('dismiss_focus')}
            </button>
          </div>

          <style>{`
            @keyframes dnd-pulse {
              0%, 100% { border-color: rgba(244, 63, 94, 0.2); transform: scale(1); }
              50% { border-color: rgba(244, 63, 94, 0.4); transform: scale(1.002); }
            }
          `}</style>
        </div>
      )}

      {activeShareId && (
        <SharedScheduleView
          shareId={activeShareId}
          onClose={() => {
            setActiveShareId(null);
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/');
            }
          }}
          onStartCompare={(fPeriods, fName) => {
            setFriendPeriods(fPeriods);
            setCompareMode(true);
            setFriendName(fName);
            setActiveShareId(null);
            setActiveTab('schedule');
            setViewMode('grid');
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/');
            }
          }}
        />
      )}
    </>
  );
}
