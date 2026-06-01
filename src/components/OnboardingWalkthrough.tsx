'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { triggerHapticSuccess, triggerHapticLight } from '@/lib/haptics';

export default function OnboardingWalkthrough() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkOnboarding = async () => {
      // Check local storage first to avoid flashing
      const localCompleted = localStorage.getItem(`onboarding_completed_${user.id}`);
      if (localCompleted === 'true') {
        return;
      }

      // Check database
      const { data, error } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching onboarding status:', error);
      } else if (data && !data.onboarding_completed) {
        setOpen(true);
      }
    };

    checkOnboarding();
  }, [user]);

  const handleNext = () => {
    triggerHapticLight();
    if (currentSlide < 2) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    triggerHapticLight();
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    triggerHapticSuccess();

    try {
      // Update database
      const { error } = await supabase
        .from('user_settings')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error saving onboarding completion:', error);
      }

      // Set local storage
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 999 }} // On top of everything
    >
      <style>{`
        @keyframes pop-up {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
      <div
        className="modal-content slide-in-bottom"
        style={{
          maxWidth: '400px',
          padding: '24px 20px',
          textAlign: 'center',
          animation: 'pop-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          position: 'relative',
        }}
      >
        {/* Decorative corner brackets for HUD theme */}
        <div className="hud-corner hud-top-left" />
        <div className="hud-corner hud-top-right" />
        <div className="hud-corner hud-bottom-left" />
        <div className="hud-corner hud-bottom-right" />

        {/* Progress Indicator dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px' }}>
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              style={{
                width: idx === currentSlide ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: idx === currentSlide ? 'var(--accent)' : 'var(--border-glass)',
                boxShadow: idx === currentSlide ? '0 0 6px var(--accent-glow)' : 'none',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Slide 1: Welcome & Classes */}
        {currentSlide === 0 && (
          <div className="slide-content">
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--accent-ghost)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: 'var(--accent)',
                boxShadow: 'var(--hud-glow)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Schedule Manager
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '10px' }}>
              Log and track your weekly lectures, classrooms, and teacher names in a unified timetable grid or chronological feed.
            </p>
          </div>
        )}

        {/* Slide 2: Academic Core */}
        {currentSlide === 1 && (
          <div className="slide-content">
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--accent-ghost)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: 'var(--accent)',
                boxShadow: 'var(--hud-glow)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Academic Tracker
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '10px' }}>
              Track attendance scores per class, log quizzes or midterms, verify weighted course percentages, and review real-time exam countdown clocks.
            </p>
          </div>
        )}

        {/* Slide 3: Notifications & Themes */}
        {currentSlide === 2 && (
          <div className="slide-content">
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--accent-ghost)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: 'var(--accent)',
                boxShadow: 'var(--hud-glow)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Smart Alarms & Themes
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '10px' }}>
              Receive push notifications before class starts. Personalize the HUD design with 8 unique glowing modes, including custom handwritten notebook themes.
            </p>
          </div>
        )}

        {/* Buttons Row */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          {currentSlide > 0 ? (
            <button
              onClick={handleBack}
              className="btn-secondary"
              style={{ flex: 1 }}
              disabled={saving}
            >
              Back
            </button>
          ) : (
            <button
              onClick={() => {
                triggerHapticLight();
                setOpen(false);
              }}
              className="btn-secondary"
              style={{ flex: 1 }}
              disabled={saving}
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={saving}
          >
            {currentSlide === 2 ? (saving ? 'Saving...' : 'Get Started') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
