'use client'

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center bg-zinc-900 px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-zinc-800 print:hidden"
    >
      {label}
    </button>
  )
}
