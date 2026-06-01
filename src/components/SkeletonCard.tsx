'use client';

import React from 'react';

export default function SkeletonCard() {
  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        gap: '14px',
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
        animation: 'skeleton-pulse 1.8s ease-in-out infinite',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.995); }
          50% { opacity: 0.75; transform: scale(1); }
        }
      `}</style>

      {/* Mock accent bar */}
      <div
        style={{
          background: 'var(--border-glass)',
          minHeight: '100%',
          width: '3px',
          borderRadius: '2px',
        }}
      />

      {/* Mock Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Time bar */}
        <div
          style={{
            width: '80px',
            height: '10px',
            background: 'var(--border-glass)',
            borderRadius: '4px',
          }}
        />

        {/* Course name */}
        <div
          style={{
            width: '180px',
            height: '14px',
            background: 'var(--border-glass)',
            borderRadius: '4px',
          }}
        />

        {/* Code & room */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              width: '60px',
              height: '12px',
              background: 'var(--border-glass)',
              borderRadius: '4px',
            }}
          />
          <div
            style={{
              width: '40px',
              height: '12px',
              background: 'var(--border-glass)',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>
    </div>
  );
}
