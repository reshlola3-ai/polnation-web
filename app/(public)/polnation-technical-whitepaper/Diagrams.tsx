import { BarChart3, Calculator, Database, FileSearch, Globe2, KeyRound, ScanSearch, ShieldCheck, Wallet } from 'lucide-react'

function Box({
  title,
  subtitle,
  tone = 'purple',
  icon,
}: {
  title: string
  subtitle: string
  tone?: 'purple' | 'cyan' | 'green' | 'red'
  icon: React.ReactNode
}) {
  const tones = {
    purple: 'border-purple-400/40 bg-purple-500/10 text-purple-100',
    cyan: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100',
    green: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
    red: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  }

  return (
    <div className={`min-h-24 border p-4 ${tones[tone]}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      <p className="m-0 text-xs text-zinc-400">{subtitle}</p>
    </div>
  )
}

export function ArchitectureDiagram({ labels }: { labels: string[] }) {
  return (
    <div className="my-6 overflow-hidden border border-white/10 bg-black/25 p-4">
      <div className="mb-4 text-center font-mono text-xs uppercase tracking-[0.08em] text-purple-200">{labels[0]}</div>
      <div className="grid gap-3 md:grid-cols-4">
        <Box title={labels[1]} subtitle={labels[2]} icon={<Wallet className="h-4 w-4" />} />
        <Box title={labels[3]} subtitle={labels[4]} icon={<Globe2 className="h-4 w-4" />} />
        <Box title={labels[5]} subtitle={labels[6]} icon={<BarChart3 className="h-4 w-4" />} />
        <Box title={labels[7]} subtitle={labels[8]} icon={<Database className="h-4 w-4" />} />
      </div>
      <div className="my-4 text-center text-xs text-zinc-500">↓</div>
      <div className="grid gap-3 md:grid-cols-3">
        <Box tone="cyan" title={labels[9]} subtitle={labels[10]} icon={<ScanSearch className="h-4 w-4" />} />
        <Box tone="cyan" title={labels[11]} subtitle={labels[12]} icon={<Calculator className="h-4 w-4" />} />
        <Box tone="cyan" title={labels[13]} subtitle={labels[14]} icon={<ShieldCheck className="h-4 w-4" />} />
      </div>
      <div className="my-4 text-center text-xs text-zinc-500">↓</div>
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
    <div className="my-6 grid gap-4 border border-white/10 bg-black/25 p-4 md:grid-cols-2">
      <div className="border border-rose-400/30 bg-rose-500/[0.06] p-5">
        <div className="mb-4 font-mono text-xs uppercase text-rose-200">{labels[0]}</div>
        <div className="space-y-3">
          <Box tone="red" title={labels[1]} subtitle={labels[2]} icon={<Wallet className="h-4 w-4" />} />
          <Box tone="red" title={labels[3]} subtitle={labels[4]} icon={<KeyRound className="h-4 w-4" />} />
          <Box tone="red" title={labels[5]} subtitle={labels[6]} icon={<Database className="h-4 w-4" />} />
        </div>
      </div>
      <div className="border border-emerald-400/30 bg-emerald-500/[0.06] p-5">
        <div className="mb-4 font-mono text-xs uppercase text-emerald-200">{labels[7]}</div>
        <div className="space-y-3">
          <Box tone="green" title={labels[8]} subtitle={labels[9]} icon={<Wallet className="h-4 w-4" />} />
          <Box tone="green" title={labels[10]} subtitle={labels[11]} icon={<ShieldCheck className="h-4 w-4" />} />
          <Box tone="green" title={labels[12]} subtitle={labels[13]} icon={<FileSearch className="h-4 w-4" />} />
        </div>
      </div>
    </div>
  )
}

export function VerificationDiagram({ labels }: { labels: string[] }) {
  return (
    <div className="my-6 grid gap-3 border border-white/10 bg-black/25 p-4 md:grid-cols-3">
      <Box title={labels[0]} subtitle={labels[1]} icon={<ScanSearch className="h-4 w-4" />} />
      <Box tone="cyan" title={labels[2]} subtitle={labels[3]} icon={<ShieldCheck className="h-4 w-4" />} />
      <Box tone="green" title={labels[4]} subtitle={labels[5]} icon={<FileSearch className="h-4 w-4" />} />
    </div>
  )
}
