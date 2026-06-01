'use client';

import React from 'react';

type Props = {
  theme: string; // Theme ID, e.g. 'midnight', 'notebook', etc.
};

export default function EmptyStateIllustration({ theme }: Props) {
  const isNotebook = theme === 'notebook';

  if (isNotebook) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 0',
          textAlign: 'center',
          animation: 'notebook-fade-in 0.8s ease-out',
        }}
      >
        <style>{`
          @keyframes notebook-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes float-steam {
            0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
            50% { transform: translateY(-5px) scale(1.05); opacity: 0.8; }
          }
          @keyframes twitch-tail {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(4deg); }
          }
        `}</style>

        {/* Hand-sketched Coffee Cup & Sleeping Cat SVG */}
        <svg
          width="180"
          height="120"
          viewBox="0 0 180 120"
          fill="none"
          stroke="#727068"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.85, marginBottom: '14px' }}
        >
          {/* Paper Grid background watermark in notebook */}
          <path d="M 0,20 L 180,20 M 0,50 L 180,50 M 0,80 L 180,80 M 0,110 L 180,110" stroke="#727068" strokeWidth="0.5" strokeDasharray="3 6" opacity="0.25" />
          <path d="M 40,0 L 40,120 M 120,0 L 120,120" stroke="#727068" strokeWidth="0.5" strokeDasharray="3 6" opacity="0.25" />

          {/* Sketched Coffee Cup */}
          <path d="M 30,55 L 75,55 L 70,85 C 69,92 63,98 55,98 L 50,98 C 42,98 36,92 35,85 Z" fill="#fcfcf9" />
          {/* Handle */}
          <path d="M 32,60 C 22,60 22,76 33,78" />
          {/* Plate */}
          <path d="M 24,103 L 81,103 C 81,103 84,103 84,105 C 84,107 80,107 80,107 L 25,107 C 25,107 21,107 21,105 C 21,103 24,103 24,103 Z" />
          {/* Animated Steam */}
          <path d="M 45,45 C 47,40 43,36 45,30" strokeWidth="1.5" strokeDasharray="2 2" style={{ animation: 'float-steam 3s ease-in-out infinite' }} />
          <path d="M 55,48 C 57,42 53,38 55,32" strokeWidth="1.5" strokeDasharray="2 2" style={{ animation: 'float-steam 3s ease-in-out infinite 0.7s' }} />
          <path d="M 63,46 C 65,40 61,36 63,30" strokeWidth="1.5" strokeDasharray="2 2" style={{ animation: 'float-steam 3s ease-in-out infinite 1.4s' }} />

          {/* Sleeping Cat (Curled Up) */}
          {/* Body */}
          <path d="M 120,70 C 105,70 95,80 95,95 C 95,110 110,113 130,113 C 145,113 155,105 155,95 C 155,85 145,75 130,75 C 127,75 124,76 122,77" fill="#fcfcf9" />
          {/* Head */}
          <circle cx="106" cy="85" r="13" fill="#fcfcf9" />
          {/* Ears */}
          <path d="M 96,78 L 94,66 L 102,74" fill="#fcfcf9" />
          {/* Ear 2 */}
          <path d="M 110,74 L 117,65 L 115,77" fill="#fcfcf9" />
          {/* Eyes (Sleeping curves) */}
          <path d="M 98,85 Q 101,88 103,85" strokeWidth="1.5" />
          <path d="M 109,85 Q 112,88 114,85" strokeWidth="1.5" />
          {/* Nose */}
          <path d="M 106,88 L 107,89 L 105,89 Z" strokeWidth="1" />
          {/* Tail (Curled around) */}
          <path d="M 148,103 C 155,99 157,88 152,83 C 148,79 144,83 145,88" style={{ animation: 'twitch-tail 4s ease-in-out infinite', transformOrigin: '145px 95px' }} />
          {/* Sleep Zzzs */}
          <path d="M 145,60 L 151,60 L 145,66 L 151,66" strokeWidth="1.5" strokeDasharray="1 1" opacity="0.7" />
          <path d="M 154,48 L 158,48 L 154,52 L 158,52" strokeWidth="1" strokeDasharray="1 1" opacity="0.5" />
        </svg>

        <h3
          style={{
            fontFamily: 'var(--font-notebook)',
            fontSize: '1.25rem',
            color: 'var(--text-secondary)',
            fontWeight: 'normal',
            marginBottom: '4px',
          }}
        >
          Time to relax...
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-notebook)',
            fontSize: '0.95rem',
            color: 'var(--text-muted)',
            maxWidth: '240px',
            margin: '0 auto',
          }}
        >
          No classes scheduled. Enjoy your break or study at your own pace!
        </p>
      </div>
    );
  }

  // Cyber HUD Radar Sweep (Default Theme branch)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 0',
        textAlign: 'center',
      }}
    >
      <style>{`
        @keyframes radar-sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes radar-blip {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.7; }
        }
        @keyframes scanline-slow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 40; }
        }
      `}</style>

      {/* Cybernetic HUD Radar System SVG */}
      <svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        style={{ marginBottom: '16px', filter: 'drop-shadow(0 0 8px var(--accent-glow))', opacity: 0.75 }}
      >
        {/* Outer Tech Ring */}
        <circle cx="80" cy="80" r="76" stroke="var(--border-glass)" strokeWidth="1" strokeDasharray="8 6" style={{ animation: 'scanline-slow 15s linear infinite' }} />
        <circle cx="80" cy="80" r="72" stroke="var(--border-glass)" strokeWidth="1.5" />
        <circle cx="80" cy="80" r="68" stroke="var(--border-glass)" strokeWidth="0.5" strokeDasharray="1 5" />

        {/* Radar Concentric Rings */}
        <circle cx="80" cy="80" r="54" stroke="var(--border-glass)" strokeWidth="1" />
        <circle cx="80" cy="80" r="36" stroke="var(--border-glass)" strokeWidth="0.5" strokeDasharray="4 4" />
        <circle cx="80" cy="80" r="18" stroke="var(--border-glass)" strokeWidth="0.5" />

        {/* Crosshair Guides */}
        <line x1="80" y1="4" x2="80" y2="156" stroke="var(--border-glass)" strokeWidth="0.75" />
        <line x1="4" y1="80" x2="156" y2="80" stroke="var(--border-glass)" strokeWidth="0.75" />

        {/* Angular Tech markings */}
        <path d="M 80,8 L 84,12 M 80,152 L 76,148 M 8,80 L 12,84 M 152,80 L 148,76" stroke="var(--border-glass)" strokeWidth="1.5" />

        {/* Scanning Sweep Sector */}
        <g style={{ transformOrigin: '80px 80px', animation: 'radar-sweep 5s linear infinite' }}>
          {/* Radial scanning line */}
          <line x1="80" y1="80" x2="80" y2="8" stroke="var(--accent)" strokeWidth="1.5" />
          {/* Glowing fade wedge (approx. using overlapping lines or path) */}
          <path d="M 80,80 L 80,8 A 72,72 0 0,1 116,18 Z" fill="url(#radar-gradient)" opacity="0.25" />
        </g>

        {/* Blinking Radar Blips */}
        <circle cx="110" cy="50" r="2.5" fill="var(--danger)" style={{ animation: 'radar-blip 3s ease-in-out infinite 0.3s' }} />
        <circle cx="45" cy="105" r="2" fill="var(--warning)" style={{ animation: 'radar-blip 2s ease-in-out infinite 1.2s' }} />
        <circle cx="60" cy="45" r="1.5" fill="var(--accent)" style={{ animation: 'radar-blip 4s ease-in-out infinite 0.7s' }} />

        {/* Center Target Marker */}
        <circle cx="80" cy="80" r="3" fill="var(--accent)" />
        <circle cx="80" cy="80" r="6" stroke="var(--accent)" strokeWidth="0.5" />

        {/* Definitions */}
        <defs>
          <linearGradient id="radar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          fontWeight: 800,
          color: 'var(--accent)',
          background: 'var(--accent-ghost)',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border-glass)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}
      >
        SYS: SECTOR FREE
      </span>
      <h3
        style={{
          fontSize: '0.9rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '4px',
        }}
      >
        No Classes Detected
      </h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '240px' }}>
        Scan returns zero scheduled entries for this day. Tap the button to schedule one.
      </p>
    </div>
  );
}
