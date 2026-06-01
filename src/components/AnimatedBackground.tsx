'use client';

export default function AnimatedBackground() {
  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
      <div className="bg-grid" />
      
      {/* HUD Vector overlay */}
      <svg
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          opacity: 0.15,
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Top-right corner radar ring */}
        <circle
          cx="90"
          cy="10"
          r="25"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.1"
          strokeDasharray="1 3"
          style={{
            transformOrigin: '90px 10px',
            animation: 'spin 80s linear infinite',
          }}
        />
        <circle
          cx="90"
          cy="10"
          r="15"
          fill="none"
          stroke="var(--accent-2)"
          strokeWidth="0.05"
          strokeDasharray="4 2"
          style={{
            transformOrigin: '90px 10px',
            animation: 'spin 40s linear infinite reverse',
          }}
        />
        
        {/* Bottom-left corner tech lines */}
        <path
          d="M 10 90 L 30 90 L 35 85 L 60 85"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.12"
          strokeDasharray="3 1.5"
        />
        <circle cx="60" cy="85" r="0.4" fill="var(--accent)" />
        <circle cx="10" cy="90" r="0.4" fill="var(--accent)" />
        
        {/* Top edge lines */}
        <path
          d="M 20 5 L 80 5"
          fill="none"
          stroke="var(--border-active)"
          strokeWidth="0.06"
          strokeDasharray="12 4 2 4"
        />
        
        {/* Grid micro-crosshairs */}
        <g stroke="var(--accent)" strokeWidth="0.08" opacity="0.6">
          <path d="M 10 20 L 12 20 M 11 19 L 11 21" />
          <path d="M 85 80 L 87 80 M 86 79 L 86 81" />
          <path d="M 25 50 L 27 50 M 26 49 L 26 51" />
        </g>
      </svg>
    </div>
  );
}
