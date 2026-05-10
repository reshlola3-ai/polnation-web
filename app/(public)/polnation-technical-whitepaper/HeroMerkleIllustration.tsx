/** Minimal line-art Merkle topology — accent uses brand purple */
export function HeroMerkleIllustration() {
  return (
    <svg
      viewBox="0 0 320 280"
      className="h-auto w-full max-w-[280px] text-[#670de5] md:max-w-[320px]"
      aria-hidden
    >
      <title>Merkle tree schematic</title>
      {/* Root */}
      <circle cx="160" cy="36" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Level 2 */}
      <circle cx="96" cy="112" r="9" fill="none" stroke="currentColor" strokeWidth="1.25" opacity={0.9} />
      <circle cx="224" cy="112" r="9" fill="none" stroke="currentColor" strokeWidth="1.25" opacity={0.9} />
      {/* Level 3 leaves */}
      <circle cx="48" cy="200" r="7" fill="none" stroke="#52525b" strokeWidth="1" opacity={0.85} />
      <circle cx="144" cy="200" r="7" fill="none" stroke="#52525b" strokeWidth="1" opacity={0.85} />
      <circle cx="176" cy="200" r="7" fill="none" stroke="#52525b" strokeWidth="1" opacity={0.85} />
      <circle cx="272" cy="200" r="7" fill="none" stroke="#52525b" strokeWidth="1" opacity={0.85} />
      {/* Edges */}
      <path d="M160 46 L96 103 M160 46 L224 103 M96 121 L48 193 M96 121 L144 193 M224 121 L176 193 M224 121 L272 193" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity={0.75} />
      {/* Hash brackets */}
      <path d="M28 218 H12 V248 H28" fill="none" stroke="#a1a1aa" strokeWidth="1" />
      <path d="M292 218 H308 V248 H292" fill="none" stroke="#a1a1aa" strokeWidth="1" />
      <text
        x="160"
        y="262"
        textAnchor="middle"
        fill="#71717a"
        fontSize="10"
        style={{ fontFamily: 'var(--poly-font-mono), monospace' }}
      >
        verified leaves → root commitment
      </text>
    </svg>
  )
}
