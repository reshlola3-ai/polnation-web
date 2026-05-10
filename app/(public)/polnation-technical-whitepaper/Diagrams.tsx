import type { ReactNode } from 'react'
import {
  BarChart3,
  Calculator,
  CheckCircle2,
  Database,
  FileSearch,
  Fingerprint,
  Globe2,
  KeyRound,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Wallet,
} from 'lucide-react'

const accentBar = {
  purple: 'border-l-[#670de5]',
  cyan: 'border-l-[#0891b2]',
  green: 'border-l-[#047857]',
  red: 'border-l-[#b91c1c]',
} as const

function Box({
  title,
  subtitle,
  tone = 'purple',
  icon,
}: {
  title: string
  subtitle: string
  tone?: keyof typeof accentBar
  icon: ReactNode
}) {
  return (
    <div
      className={`group relative min-h-[5.5rem] overflow-hidden border border-zinc-200 bg-white p-4 transition-[border-color] duration-150 hover:border-[#670de5] ${accentBar[tone]} border-l-[3px]`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <span className="grid h-8 w-8 shrink-0 place-items-center border border-zinc-200 bg-zinc-50 text-zinc-700 transition-colors duration-150 group-hover:border-[#670de5]/35">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      <p className="m-0 text-xs leading-snug text-zinc-600">{subtitle}</p>
    </div>
  )
}

function FlowLine() {
  return (
    <div className="my-4 flex items-center gap-2 text-zinc-300">
      <span className="h-px flex-1 bg-zinc-200" />
      <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
      <span className="h-px flex-1 bg-zinc-200" />
    </div>
  )
}

export function ArchitectureDiagram({ labels }: { labels: string[] }) {
  return (
    <div className="my-6 overflow-hidden border border-zinc-200 bg-zinc-50/40 p-4">
      <div className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500">{labels[0]}</div>
      <div className="grid gap-3 md:grid-cols-4">
        <Box title={labels[1]} subtitle={labels[2]} tone="purple" icon={<Wallet className="h-4 w-4" />} />
        <Box title={labels[3]} subtitle={labels[4]} tone="purple" icon={<Globe2 className="h-4 w-4" />} />
        <Box title={labels[5]} subtitle={labels[6]} tone="purple" icon={<BarChart3 className="h-4 w-4" />} />
        <Box title={labels[7]} subtitle={labels[8]} tone="purple" icon={<Database className="h-4 w-4" />} />
      </div>
      <FlowLine />
      <div className="grid gap-3 md:grid-cols-3">
        <Box tone="cyan" title={labels[9]} subtitle={labels[10]} icon={<ScanSearch className="h-4 w-4" />} />
        <Box tone="cyan" title={labels[11]} subtitle={labels[12]} icon={<Calculator className="h-4 w-4" />} />
        <Box tone="cyan" title={labels[13]} subtitle={labels[14]} icon={<ShieldCheck className="h-4 w-4" />} />
      </div>
      <FlowLine />
      <div className="grid gap-3 md:grid-cols-3">
        <Box tone="green" title={labels[15]} subtitle={labels[16]} icon={<Database className="h-4 w-4" />} />
        <Box tone="green" title={labels[17]} subtitle={labels[18]} icon={<ShieldCheck className="h-4 w-4" />} />
        <Box tone="green" title={labels[19]} subtitle={labels[20]} icon={<FileSearch className="h-4 w-4" />} />
      </div>
    </div>
  )
}

export function AuthorizationDiagram({ labels }: { labels: string[] }) {
  return (
    <div className="my-6 grid gap-4 border border-zinc-200 bg-white p-4 md:grid-cols-2">
      <div className="border border-zinc-200 bg-rose-50/40 p-5">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.06em] text-rose-900">{labels[0]}</div>
        <div className="space-y-3">
          <Box tone="red" title={labels[1]} subtitle={labels[2]} icon={<Wallet className="h-4 w-4" />} />
          <Box tone="red" title={labels[3]} subtitle={labels[4]} icon={<KeyRound className="h-4 w-4" />} />
          <Box tone="red" title={labels[5]} subtitle={labels[6]} icon={<Database className="h-4 w-4" />} />
        </div>
      </div>
      <div className="border border-zinc-200 bg-emerald-50/35 p-5">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.06em] text-emerald-900">{labels[7]}</div>
        <div className="space-y-3">
          <Box tone="green" title={labels[8]} subtitle={labels[9]} icon={<Fingerprint className="h-4 w-4" />} />
          <Box tone="green" title={labels[10]} subtitle={labels[11]} icon={<LockKeyhole className="h-4 w-4" />} />
          <Box tone="green" title={labels[12]} subtitle={labels[13]} icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>
      </div>
    </div>
  )
}

export function VerificationDiagram({ labels }: { labels: string[] }) {
  return (
    <div className="my-6 grid gap-3 border border-zinc-200 bg-zinc-50/40 p-4 md:grid-cols-3">
      <Box title={labels[0]} subtitle={labels[1]} tone="purple" icon={<ScanSearch className="h-4 w-4" />} />
      <Box tone="cyan" title={labels[2]} subtitle={labels[3]} icon={<ShieldCheck className="h-4 w-4" />} />
      <Box tone="green" title={labels[4]} subtitle={labels[5]} icon={<FileSearch className="h-4 w-4" />} />
    </div>
  )
}
