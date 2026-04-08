'use client'

interface AuroraCardProps {
  children: React.ReactNode
  className?: string
}

export function AuroraCard({ children, className = '' }: AuroraCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{
        // C: glassmorphism — semi-transparent so page bg bleeds through
        background: 'rgba(13, 11, 33, 0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(139, 92, 246, 0.18)',
        boxShadow: [
          '0 0 0 1px rgba(139, 92, 246, 0.10)',
          '0 8px 40px rgba(0,0,0,0.55)',
          'inset 0 1px 0 rgba(255,255,255,0.06)',
        ].join(', '),
      }}
    >
      {/* Animated aurora blobs — B */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="aurora-blob-1 absolute rounded-full"
          style={{
            width: '60%',
            height: '130%',
            top: '-35%',
            left: '-15%',
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.45) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="aurora-blob-2 absolute rounded-full"
          style={{
            width: '55%',
            height: '110%',
            bottom: '-25%',
            right: '-10%',
            background: 'radial-gradient(ellipse, rgba(6,182,212,0.30) 0%, transparent 70%)',
            filter: 'blur(36px)',
          }}
        />
        <div
          className="aurora-blob-3 absolute rounded-full"
          style={{
            width: '40%',
            height: '80%',
            top: '15%',
            left: '38%',
            background: 'radial-gradient(ellipse, rgba(79,70,229,0.25) 0%, transparent 70%)',
            filter: 'blur(28px)',
          }}
        />
      </div>

      {/* D: diagonal grid lines */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(45deg, rgba(139,92,246,0.04) 0px, rgba(139,92,246,0.04) 1px, transparent 1px, transparent 28px)',
            'repeating-linear-gradient(-45deg, rgba(6,182,212,0.03) 0px, rgba(6,182,212,0.03) 1px, transparent 1px, transparent 28px)',
          ].join(', '),
        }}
      />

      {/* A: grain texture */}
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
          opacity: 0.055,
        }}
      />

      {/* Top edge accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none z-[3]"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.7) 30%, rgba(6,182,212,0.5) 65%, transparent 95%)',
        }}
      />

      <div className="relative z-10">
        {children}
      </div>

      <style>{`
        .aurora-blob-1 {
          animation: aurora-drift-1 12s ease-in-out infinite alternate;
        }
        .aurora-blob-2 {
          animation: aurora-drift-2 15s ease-in-out infinite alternate;
        }
        .aurora-blob-3 {
          animation: aurora-drift-3 10s ease-in-out infinite alternate;
        }
        @keyframes aurora-drift-1 {
          0%   { transform: translate(0%, 0%) scale(1); opacity: 0.9; }
          50%  { transform: translate(7%, 10%) scale(1.1); opacity: 1; }
          100% { transform: translate(-5%, 5%) scale(0.93); opacity: 0.75; }
        }
        @keyframes aurora-drift-2 {
          0%   { transform: translate(0%, 0%) scale(1); opacity: 0.8; }
          50%  { transform: translate(-9%, -7%) scale(1.12); opacity: 1; }
          100% { transform: translate(6%, -4%) scale(0.9); opacity: 0.65; }
        }
        @keyframes aurora-drift-3 {
          0%   { transform: translate(0%, 0%) scale(1); opacity: 0.7; }
          50%  { transform: translate(5%, -9%) scale(1.15); opacity: 0.95; }
          100% { transform: translate(-7%, 7%) scale(0.88); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
