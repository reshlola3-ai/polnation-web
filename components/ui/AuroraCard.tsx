'use client'

interface AuroraCardProps {
  children: React.ReactNode
  className?: string
}

export function AuroraCard({ children, className = '' }: AuroraCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[#111827] border border-white/[0.06] ${className}`}
    >
      {/* Subtle gradient top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/60 via-cyan-500/40 to-purple-500/60" />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
