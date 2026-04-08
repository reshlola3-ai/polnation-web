'use client'

interface AuroraCardProps {
  children: React.ReactNode
  className?: string
}

export function AuroraCard({ children, className = '' }: AuroraCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.07] ${className}`}
      style={{
        background: [
          'radial-gradient(ellipse 100% 80% at 10% -10%, rgba(124, 58, 237, 0.55) 0%, transparent 60%)',
          'radial-gradient(ellipse 80% 60% at 90% 120%, rgba(79, 70, 229, 0.40) 0%, transparent 55%)',
          'radial-gradient(ellipse 50% 40% at 70% 25%, rgba(6, 182, 212, 0.20) 0%, transparent 50%)',
          'radial-gradient(ellipse 60% 50% at 30% 80%, rgba(139, 92, 246, 0.18) 0%, transparent 55%)',
          '#0D0B21',
        ].join(', '),
        boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.12), 0 4px 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Animated aurora blobs */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="aurora-blob-1 absolute rounded-full"
          style={{
            width: '55%',
            height: '120%',
            top: '-30%',
            left: '-10%',
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.28) 0%, transparent 70%)',
            filter: 'blur(32px)',
          }}
        />
        <div
          className="aurora-blob-2 absolute rounded-full"
          style={{
            width: '50%',
            height: '100%',
            bottom: '-20%',
            right: '-5%',
            background: 'radial-gradient(ellipse, rgba(6,182,212,0.20) 0%, transparent 70%)',
            filter: 'blur(28px)',
          }}
        />
        <div
          className="aurora-blob-3 absolute rounded-full"
          style={{
            width: '35%',
            height: '70%',
            top: '20%',
            left: '40%',
            background: 'radial-gradient(ellipse, rgba(79,70,229,0.16) 0%, transparent 70%)',
            filter: 'blur(24px)',
          }}
        />
      </div>

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[1] opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Top edge accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none z-[2]"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.6) 30%, rgba(6,182,212,0.4) 65%, transparent 95%)',
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
          0%   { transform: translate(0%, 0%) scale(1); opacity: 0.8; }
          50%  { transform: translate(6%, 8%) scale(1.08); opacity: 1; }
          100% { transform: translate(-4%, 4%) scale(0.95); opacity: 0.7; }
        }
        @keyframes aurora-drift-2 {
          0%   { transform: translate(0%, 0%) scale(1); opacity: 0.7; }
          50%  { transform: translate(-8%, -6%) scale(1.1); opacity: 0.9; }
          100% { transform: translate(5%, -3%) scale(0.92); opacity: 0.6; }
        }
        @keyframes aurora-drift-3 {
          0%   { transform: translate(0%, 0%) scale(1); opacity: 0.6; }
          50%  { transform: translate(4%, -8%) scale(1.12); opacity: 0.85; }
          100% { transform: translate(-6%, 6%) scale(0.9); opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}
