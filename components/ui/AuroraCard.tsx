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
          'radial-gradient(ellipse 90% 70% at 15% 0%, rgba(109, 40, 217, 0.38) 0%, transparent 65%)',
          'radial-gradient(ellipse 70% 50% at 85% 110%, rgba(79, 70, 229, 0.22) 0%, transparent 60%)',
          'radial-gradient(ellipse 40% 30% at 75% 30%, rgba(6, 182, 212, 0.10) 0%, transparent 55%)',
          '#0D0B21',
        ].join(', '),
        boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.08), 0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Top edge accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none z-0"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.5) 30%, rgba(6,182,212,0.3) 65%, transparent 95%)',
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
