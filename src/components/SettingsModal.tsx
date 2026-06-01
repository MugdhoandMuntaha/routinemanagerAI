'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTheme, THEMES, type ThemeId } from '@/context/ThemeContext';
import { useCourse } from '@/context/CourseContext';
import { playSynthSound } from '@/lib/synthSounds';
import { ACCENT_COLORS } from '@/types';
import type { Course } from '@/types';

type Props = {
  onClose: () => void;
};

export default function SettingsModal({ onClose }: Props) {
  const { settings, customAccent, updateSettings, updateCustomAccent, t } = useSettings();
  const { theme, setTheme } = useTheme();
  const { courses, editCourse } = useCourse();

  // Active Preferences Section: 'general' | 'timing' | 'courses'
  const [activePanel, setActivePanel] = useState<'general' | 'timing' | 'courses'>('general');

  // Local state for sound & timing preview
  const [selectedSound, setSelectedSound] = useState(settings.notification_sound);
  
  // Local state for Course customizer
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [courseColor, setCourseColor] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);

  // Sync selected course info when selection changes
  useEffect(() => {
    if (selectedCourseId) {
      const course = courses.find((c) => c.id === selectedCourseId);
      if (course) {
        setCourseName(course.course_name);
        setCourseCode(course.course_code);
        setTeacherName(course.teacher_name || '');
        setRoomNumber(course.room_number || '');
        setCourseColor(course.color);
      }
    } else {
      setCourseName('');
      setCourseCode('');
      setTeacherName('');
      setRoomNumber('');
      setCourseColor('');
    }
  }, [selectedCourseId, courses]);

  // Set default selected course on mount
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Handle saving customized course details (Feature 7.3)
  const handleSaveCourse = async () => {
    if (!selectedCourseId) return;
    setCourseSaving(true);
    try {
      await editCourse(selectedCourseId, {
        course_name: courseName.trim(),
        course_code: courseCode.trim(),
        teacher_name: teacherName.trim(),
        room_number: roomNumber.trim(),
        color: courseColor,
      });
      alert(t('save_changes') + ' - ' + t('done_btn'));
    } catch (err) {
      console.error(err);
    } finally {
      setCourseSaving(false);
    }
  };

  const handleSoundChange = (val: string) => {
    setSelectedSound(val);
    updateSettings({ notification_sound: val });
    playSynthSound(val);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '460px',
          padding: '20px 18px 24px',
          position: 'relative',
        }}
      >
        {/* macOS-style tech corners */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '6px', borderTop: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '6px', height: '6px', borderTop: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '6px', height: '6px', borderBottom: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '6px', height: '6px', borderBottom: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ⚙️ {t('choose_theme')}
            </h2>
            <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
              {t('personalize')}
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label={t('cancel')}>
            ✕
          </button>
        </div>

        {/* macOS-style Sidebar/Header Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', paddingBottom: '2px', marginBottom: '16px', gap: '4px' }}>
          <button
            onClick={() => setActivePanel('general')}
            style={{
              padding: '6px 12px', border: 'none', background: 'transparent',
              fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase',
              color: activePanel === 'general' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activePanel === 'general' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            {t('theme_mode')} & UI
          </button>
          <button
            onClick={() => setActivePanel('timing')}
            style={{
              padding: '6px 12px', border: 'none', background: 'transparent',
              fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase',
              color: activePanel === 'timing' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activePanel === 'timing' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            {t('notification_timing')}
          </button>
          <button
            onClick={() => setActivePanel('courses')}
            style={{
              padding: '6px 12px', border: 'none', background: 'transparent',
              fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase',
              color: activePanel === 'courses' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activePanel === 'courses' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
          >
            {t('course_customizer')}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* ─── PANEL 1: GENERAL UI & THEMES ─── */}
          {activePanel === 'general' && (
            <>
              {/* Theme Mode Selector (7.1) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  🎨 {t('theme_mode')}
                </label>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '3px' }}>
                  {(['light', 'dark', 'amoled'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateSettings({ theme: m })}
                      style={{
                        flex: 1, padding: '7px 0', border: 'none', borderRadius: '6px', fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase',
                        background: settings.theme === m ? 'var(--accent-ghost)' : 'transparent',
                        color: settings.theme === m ? 'var(--accent)' : 'var(--text-muted)',
                        boxShadow: settings.theme === m ? 'var(--hud-glow)' : 'none',
                        cursor: 'pointer', transition: 'all 0.2s ease',
                      }}
                    >
                      {m === 'light' ? '☀️ Light' : m === 'dark' ? '🌙 Dark' : '⬛ AMOLED'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Presets (7.1) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  🎨 Cyber-HUD Styles
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {THEMES.map((tInfo) => (
                    <button
                      key={tInfo.id}
                      onClick={() => setTheme(tInfo.id)}
                      style={{
                        padding: '10px 12px', borderRadius: '8px',
                        border: theme === tInfo.id ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
                        background: theme === tInfo.id ? 'var(--accent-ghost)' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        boxShadow: theme === tInfo.id ? 'var(--hud-glow)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {tInfo.preview.slice(0, 2).map((c, i) => (
                          <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {tInfo.emoji} {tInfo.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Accent Overrides (7.1) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  ✨ {t('accent_color')}
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Default/Reset Option */}
                  <button
                    onClick={() => updateCustomAccent(null)}
                    style={{
                      padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-glass)',
                      background: customAccent === null ? 'var(--accent-ghost)' : 'transparent',
                      color: customAccent === null ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
                    }}
                  >
                    🎨 Reset Accent
                  </button>

                  {/* Preset Accents */}
                  {ACCENT_COLORS.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      onClick={() => updateCustomAccent(c)}
                      style={{
                        width: '20px', height: '20px', borderRadius: '4px', background: c,
                        border: customAccent === c ? '1.5px solid var(--text-primary)' : '1.5px solid transparent',
                        cursor: 'pointer', transform: customAccent === c ? 'scale(1.15)' : 'scale(1)',
                        boxShadow: customAccent === c ? `0 0 8px ${c}aa` : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  ))}

                  {/* HTML Hex Color Picker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>Hex:</span>
                    <input
                      type="color"
                      value={customAccent || '#6366f1'}
                      onChange={(e) => updateCustomAccent(e.target.value)}
                      style={{
                        width: '24px', height: '20px', border: 'none', background: 'transparent',
                        cursor: 'pointer', padding: 0,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Language Selector (7.5) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  🌐 {t('language')}
                </label>
                <select
                  className="glass-select"
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                >
                  <option value="en" style={{ background: 'var(--bg-primary)' }}>English</option>
                  <option value="bn" style={{ background: 'var(--bg-primary)' }}>বাংলা (Bengali)</option>
                  <option value="ar" style={{ background: 'var(--bg-primary)' }}>العربية (Arabic)</option>
                  <option value="ur" style={{ background: 'var(--bg-primary)' }}>اردو (Urdu)</option>
                </select>
              </div>

              {/* Week Start Day Selector (7.4) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  📅 {t('week_start')}
                </label>
                <select
                  className="glass-select"
                  value={settings.week_start_day}
                  onChange={(e) => updateSettings({ week_start_day: Number(e.target.value) })}
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                >
                  <option value={0} style={{ background: 'var(--bg-primary)' }}>Sunday</option>
                  <option value={1} style={{ background: 'var(--bg-primary)' }}>Monday</option>
                  <option value={6} style={{ background: 'var(--bg-primary)' }}>Saturday</option>
                </select>
              </div>
            </>
          )}

          {/* ─── PANEL 2: TIMINGS & NOTIFICATION SOUNDS ─── */}
          {activePanel === 'timing' && (
            <>
              {/* Notification Timing Picker (7.2) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  ⏱ {t('notification_timing')}
                </label>
                <select
                  className="glass-select"
                  value={settings.notification_minutes_before}
                  onChange={(e) => updateSettings({ notification_minutes_before: Number(e.target.value) })}
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                >
                  <option value={5} style={{ background: 'var(--bg-primary)' }}>{t('minutes_before', { mins: 5 })}</option>
                  <option value={10} style={{ background: 'var(--bg-primary)' }}>{t('minutes_before', { mins: 10 })}</option>
                  <option value={15} style={{ background: 'var(--bg-primary)' }}>{t('minutes_before', { mins: 15 })}</option>
                  <option value={30} style={{ background: 'var(--bg-primary)' }}>{t('minutes_before', { mins: 30 })}</option>
                </select>
                <p style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Reschedules database class reminders to trigger at the selected offset interval.
                </p>
              </div>

              {/* Notification Sound Picker (7.6) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  🔊 {t('notification_sound')}
                </label>
                <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                  {(['default', 'chime', 'bubble', 'techno', 'digital'] as const).map((snd) => (
                    <button
                      key={snd}
                      onClick={() => handleSoundChange(snd)}
                      style={{
                        padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)',
                        background: selectedSound === snd ? 'var(--accent-ghost)' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.2s ease', textTransform: 'uppercase', letterSpacing: '0.02em',
                        fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 700,
                      }}
                    >
                      <span>{snd === 'default' ? '🔊 System Standard' : snd === 'chime' ? '🔔 Crystal Chime' : snd === 'bubble' ? '🫧 Aquatic Bubble' : snd === 'techno' ? '⚡ Cyber Radar' : '📟 Digital Alarm'}</span>
                      {selectedSound === snd && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ─── PANEL 3: COURSE COLORS CUSTOMIZER ─── */}
          {activePanel === 'courses' && (
            <>
              {courses.length === 0 ? (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
                  No courses registered in this semester.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Select Course Dropdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('select_course')}
                    </label>
                    <select
                      className="glass-select"
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id} style={{ background: 'var(--bg-primary)' }}>
                          {c.course_code} - {c.course_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Course Details Inputs */}
                  {selectedCourseId && (
                    <div
                      style={{
                        padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)',
                        borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('course_name')}</label>
                          <input className="glass-input" value={courseName} onChange={(e) => setCourseName(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.78rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('course_code')}</label>
                          <input className="glass-input" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.78rem' }} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('teacher')}</label>
                          <input className="glass-input" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.78rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{t('room_number')}</label>
                          <input className="glass-input" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.78rem' }} />
                        </div>
                      </div>

                      {/* Course Accent Palette */}
                      <div>
                        <label style={{ fontSize: '0.58rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Course Color Accent</label>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {ACCENT_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setCourseColor(c)}
                              style={{
                                width: '18px', height: '18px', borderRadius: '3px', background: c,
                                border: courseColor === c ? '1.5px solid var(--text-primary)' : '1.5px solid transparent',
                                cursor: 'pointer', transform: courseColor === c ? 'scale(1.1)' : 'scale(1)',
                                transition: 'all 0.15s ease',
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={handleSaveCourse}
                        disabled={courseSaving}
                        className="btn-primary"
                        style={{ padding: '8px', fontSize: '0.68rem', marginTop: '6px' }}
                      >
                        {courseSaving ? 'Saving...' : t('save_changes')}
                      </button>
                    </div>
                  )}

                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
