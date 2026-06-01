'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'signup') {
      if (!fullName.trim()) { setError('Please enter your name'); setLoading(false); return; }
      const { error: err } = await signUp(email, password, fullName);
      if (err) { setError(err); } else {
        setSuccess('Account created! Check your email to verify, or sign in if email confirmation is disabled.');
        setMode('login');
      }
    } else {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div
            style={{
              width: '64px', height: '64px', borderRadius: '18px',
              background: 'var(--gradient-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
              boxShadow: '0 8px 32px var(--accent-glow)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 800,
            background: 'var(--gradient-accent)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.2, marginBottom: '8px',
          }}>
            Routine Manager
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        {/* Card */}
        <div
          className="glass-card"
          style={{ padding: '24px 22px', cursor: 'default' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'none'}
        >
          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: '3px', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-glass)', marginBottom: '20px' }}>
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{
                flex: 1, padding: '9px', borderRadius: '6px', border: 'none',
                background: mode === 'login' ? 'var(--gradient-accent)' : 'transparent',
                color: mode === 'login' ? 'white' : 'var(--text-muted)',
                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)', fontFamily: 'inherit',
                boxShadow: mode === 'login' ? 'var(--hud-glow)' : 'none',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
              style={{
                flex: 1, padding: '9px', borderRadius: '6px', border: 'none',
                background: mode === 'signup' ? 'var(--gradient-accent)' : 'transparent',
                color: mode === 'signup' ? 'white' : 'var(--text-muted)',
                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)', fontFamily: 'inherit',
                boxShadow: mode === 'signup' ? 'var(--hud-glow)' : 'none',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: '6px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '16px',
              fontFamily: 'var(--font-sans)',
            }}>{error}</div>
          )}
          {success && (
            <div style={{
              padding: '10px 12px', borderRadius: '6px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              color: 'var(--success)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '16px',
              fontFamily: 'var(--font-sans)',
            }}>{success}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mode === 'signup' && (
              <div>
                <label className="form-label">Full Name</label>
                <input className="glass-input" type="text" placeholder="e.g. Junaid Ahmed" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
              </div>
            )}
            <div>
              <label className="form-label">Email</label>
              <input className="glass-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={mode === 'login'} />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input className="glass-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}
              style={{ marginTop: '6px', opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  Syncing…
                </span>
              ) : (mode === 'login' ? 'Establish Session' : 'Register Profile')}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginTop: '20px', fontFamily: 'var(--font-mono)' }}>
          SECURE PROTOCOL ACTIVE // RUT-MGR ✨
        </p>
      </div>
    </div>
  );
}
