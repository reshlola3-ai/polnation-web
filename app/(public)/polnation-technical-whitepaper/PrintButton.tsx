'use client'

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-12 items-center justify-center border border-white/15 bg-[#f8f4ff] px-6 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#670de5] transition hover:-translate-y-0.5 hover:bg-white"
      style={{
        clipPath:
          'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
      }}
    >
      {label}
    </button>
  )
}
