'use client'

interface AuroraCardProps {
  children: React.ReactNode
  className?: string
}

export function AuroraCard({ children, className = '' }: AuroraCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#E4E4E7] ${className}`}
      style={{
        background: '#FFFFFF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Top edge accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none z-0"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(22,163,74,0.4) 30%, rgba(22,163,74,0.2) 65%, transparent 95%)',
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
