'use client'

// SVG fractal noise — eliminates gradient banding, adds premium film grain texture
// Technique used by Stripe, Linear, Vercel for their hero cards
const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`

interface AuroraCardProps {
  children: React.ReactNode
  className?: string
}

export function AuroraCard({ children, className = '' }: AuroraCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.07] ${className}`}
      style={{
        // Multi-stop radial gradients — soft color blooms, not a flat linear sweep
        background: [
          // Top-left: warm violet glow
          'radial-gradient(ellipse 90% 70% at 15% 0%, rgba(109, 40, 217, 0.38) 0%, transparent 65%)',
          // Bottom-right: cool indigo echo
          'radial-gradient(ellipse 70% 50% at 85% 110%, rgba(79, 70, 229, 0.22) 0%, transparent 60%)',
          // Center-right: faint cyan accent
          'radial-gradient(ellipse 40% 30% at 75% 30%, rgba(6, 182, 212, 0.10) 0%, transparent 55%)',
          // Base: brand dark
          '#0D0B21',
        ].join(', '),
        boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.08), 0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Grain overlay — the key to premium feel */}
      <div
        className="absolute inset-0 pointer-events-none z-0 rounded-xl"
        style={{
          backgroundImage: GRAIN_SVG,
          backgroundSize: '180px',
          opacity: 0.055,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Top edge: very subtle violet line */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none z-0"
        style={{
          background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.5) 30%, rgba(6,182,212,0.3) 65%, transparent 95%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
