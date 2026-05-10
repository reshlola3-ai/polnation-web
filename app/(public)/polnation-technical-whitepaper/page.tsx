import type { Metadata } from 'next'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { Bot, Cpu, FileCheck2, Network, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { PrintButton } from './PrintButton'
import { WhitepaperLanguageSwitcher } from './WhitepaperLanguageSwitcher'
import { ArchitectureDiagram, AuthorizationDiagram, VerificationDiagram } from './Diagrams'

const CONTRACT = '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63'
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
const OP_WALLET = '0x0ADA3111B866fF1aD0477F0C5D2e8eD35A36Eb5b'
const POLYGONSCAN = `https://polygonscan.com/address/${CONTRACT}#code`

export const metadata: Metadata = {
  title: 'Polnation - Agentic AI Earning Technical Whitepaper',
  description:
    'Agentic AI Earning architecture, verified PolnationMerkleTree contract, and PolygonScan auditability.',
  alternates: {
    canonical: '/polnation-technical-whitepaper',
  },
}

type Row = [string, string, string?]

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="whitepaper-panel relative overflow-hidden border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)] md:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/60 to-transparent" />
      {children}
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="mb-5 mt-12 border-b border-white/10 pb-3 text-2xl font-semibold leading-tight text-[#f8f4ff] md:text-4xl">
        {title}
      </h2>
      <Panel>{children}</Panel>
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: Row[] }) {
  return (
    <div className="my-5 overflow-x-auto border border-white/10">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-purple-700/20 font-mono text-[11px] uppercase tracking-[0.06em] text-[#f4efff]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/[0.055] even:bg-white/[0.018]">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top text-zinc-400">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-5 text-zinc-400">
      {items.map((item) => (
        <li key={item} className="list-disc">
          {item}
        </li>
      ))}
    </ul>
  )
}

function WhitepaperMotionStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @keyframes wp-shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
          @keyframes wp-float { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -10px, 0); } }
          @keyframes wp-pulse-border { 0%, 100% { box-shadow: 0 0 0 rgba(168,85,247,0); } 50% { box-shadow: 0 0 34px rgba(34,211,238,0.16); } }
          @keyframes wp-flow { 0% { transform: translateX(-24%); opacity: 0; } 20%, 80% { opacity: 1; } 100% { transform: translateX(24%); opacity: 0; } }
          @keyframes wp-scan { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
          .whitepaper-title { animation: wp-shimmer 7s linear infinite; }
          .whitepaper-crystal { animation: wp-float 5.5s ease-in-out infinite; }
          .whitepaper-panel, .whitepaper-diagram { animation: wp-pulse-border 6s ease-in-out infinite; }
          .whitepaper-scan { background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.11) 48%, transparent 58%); animation: wp-scan 1.8s ease-in-out infinite; }
          .whitepaper-flow { position: relative; overflow: hidden; }
          .whitepaper-flow::after { content: ""; position: absolute; left: 16%; right: 16%; top: 50%; height: 1px; background: linear-gradient(90deg, transparent, rgba(34,211,238,0.85), transparent); animation: wp-flow 2.8s ease-in-out infinite; }
          .whitepaper-icon-tile { transform: translateZ(0); transition: transform .24s ease, border-color .24s ease, background .24s ease; }
          .whitepaper-icon-tile:hover { transform: translateY(-4px); border-color: rgba(34,211,238,.45); background: rgba(255,255,255,.075); }
          @media (prefers-reduced-motion: reduce) {
            .whitepaper-title, .whitepaper-crystal, .whitepaper-panel, .whitepaper-diagram, .whitepaper-scan, .whitepaper-flow::after { animation: none; }
            .whitepaper-node, .whitepaper-icon-tile { transition: none; }
          }
        `,
      }}
    />
  )
}

function ProofStrip({ badges }: { badges: string[] }) {
  const items = [
    { icon: <Bot className="h-5 w-5" />, label: 'Agentic AI' },
    { icon: <Network className="h-5 w-5" />, label: 'Polygon' },
    { icon: <ShieldCheck className="h-5 w-5" />, label: badges[0] ?? 'Verified' },
    { icon: <FileCheck2 className="h-5 w-5" />, label: badges[1] ?? 'Source Match' },
    { icon: <WalletCards className="h-5 w-5" />, label: 'USDC' },
    { icon: <Cpu className="h-5 w-5" />, label: 'MerkleTree' },
  ]

  return (
    <div className="my-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="whitepaper-icon-tile flex min-h-24 flex-col justify-between border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-center justify-between text-cyan-200">
            <span className="grid h-9 w-9 place-items-center border border-white/15 bg-white/10">{item.icon}</span>
            <Sparkles className="h-4 w-4 text-purple-200/70" />
          </div>
          <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.06em] text-zinc-200">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

export default async function TechnicalWhitepaperPage() {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale
  const t = await getTranslations('whitepaper')

  const toc = t.raw('toc.items') as Array<{ id: string; label: string }>
  const proofRows = t.raw('tables.proof.rows') as Row[]
  const authRows = t.raw('tables.auth.rows') as Row[]
  const engineRows = t.raw('tables.engine.rows') as Row[]
  const contractRows = t.raw('tables.contracts.rows') as Row[]
  const glossaryRows = t.raw('tables.glossary.rows') as Row[]

  return (
    <main className="min-h-screen overflow-hidden bg-[#0d0b21] text-[#f8f4ff]">
      <WhitepaperMotionStyles />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="pointer-events-none fixed right-0 top-0 h-[520px] w-[520px] rounded-full bg-purple-600/20 blur-[130px]" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
        <div className="mb-4 flex justify-end print:hidden">
          <WhitepaperLanguageSwitcher currentLocale={locale} />
        </div>

        <header
          className="relative grid min-h-[560px] items-center gap-8 overflow-hidden border border-white/10 bg-[#100d29] p-7 shadow-[0_26px_80px_rgba(0,0,0,0.48)] md:grid-cols-[1.2fr_0.8fr] md:p-14"
          style={{
            clipPath:
              'polygon(0 0, calc(100% - 42px) 0, 100% 42px, 100% 100%, 42px 100%, 0 calc(100% - 42px))',
          }}
        >
          <div className="relative z-10">
            <div className="mb-7 inline-flex border border-purple-300/30 bg-purple-600/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-purple-200">
              {t('hero.docType')}
            </div>
            <h1 className="whitepaper-title max-w-3xl bg-[linear-gradient(110deg,#c084fc_0%,#fff_18%,#22d3ee_38%,#a855f7_58%,#fff_78%,#c084fc_100%)] bg-[length:200%_100%] bg-clip-text text-5xl font-bold leading-[0.9] text-transparent md:text-8xl">
              {t('hero.title')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-2xl">
              {t('hero.subtitle')}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {(t.raw('hero.badges') as string[]).map((badge) => (
                <span
                  key={badge}
                  className="border border-white/15 bg-white/[0.055] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-zinc-100"
                >
                  {badge}
                </span>
              ))}
            </div>
            <p className="mt-7 font-mono text-xs uppercase tracking-[0.06em] text-zinc-500">
              {t('hero.meta')}
            </p>
          </div>
          <div className="relative min-h-[280px]">
            <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-[60px]" />
            <Image
              src="/hero-crystal.webp"
              alt="Polnation Crystal"
              fill
              priority
              className="whitepaper-crystal object-contain drop-shadow-2xl"
            />
            <div className="whitepaper-flow absolute inset-x-8 bottom-8 h-px bg-white/10" />
          </div>
        </header>

        <ProofStrip badges={t.raw('hero.badges') as string[]} />

        <div className="my-8 text-center print:hidden">
          <PrintButton label={t('actions.savePdf')} />
        </div>

        <Panel>
          <h3 className="mb-4 text-lg font-semibold">{t('toc.title')}</h3>
          <ol className="grid gap-2 font-mono text-xs text-purple-200 md:grid-cols-2">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="hover:text-white">
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </Panel>

        <Section id="abstract" title={t('sections.abstract.title')}>
          <p className="text-zinc-400">{t('sections.abstract.p1')}</p>
          <p className="text-zinc-400">{t('sections.abstract.p2')}</p>
          <List items={t.raw('sections.abstract.bullets') as string[]} />
          <div className="mt-5 border border-emerald-300/25 bg-emerald-400/[0.055] p-5 text-zinc-300">
            <strong className="text-white">{t('labels.coreProof')}</strong> {t('sections.abstract.proof')}
          </div>
        </Section>

        <Section id="architecture" title={t('sections.architecture.title')}>
          <p className="text-zinc-400">{t('sections.architecture.p1')}</p>
          <ArchitectureDiagram labels={t.raw('diagrams.architecture') as string[]} />
          <Table headers={t.raw('tables.layers.headers') as string[]} rows={t.raw('tables.layers.rows') as Row[]} />
          <h3 className="mt-6 text-xl font-semibold">{t('sections.architecture.principlesTitle')}</h3>
          <List items={t.raw('sections.architecture.principles') as string[]} />
        </Section>

        <Section id="non-custodial" title={t('sections.auth.title')}>
          <p className="text-zinc-400">{t('sections.auth.p1')}</p>
          <div className="my-5 border border-rose-300/30 bg-rose-400/[0.06] p-5 text-zinc-300">
            <strong className="text-white">{t('labels.risk')}</strong> {t('sections.auth.risk')}
          </div>
          <AuthorizationDiagram labels={t.raw('diagrams.authorization') as string[]} />
          <Table headers={t.raw('tables.auth.headers') as string[]} rows={authRows} />
          <div className="mt-5 border border-emerald-300/25 bg-emerald-400/[0.055] p-5 text-zinc-300">
            <strong className="text-white">{t('labels.technicalProof')}</strong> {t('sections.auth.proof')}{' '}
            <a className="text-cyan-300" href={POLYGONSCAN}>
              PolygonScan
            </a>
            .
          </div>
        </Section>

        <Section id="approval-audit" title={t('sections.audit.title')}>
          <p className="text-zinc-400">{t('sections.audit.p1')}</p>
          <VerificationDiagram labels={t.raw('diagrams.verification') as string[]} />
          <h3 className="mt-6 text-xl font-semibold">{t('sections.audit.polygonscanTitle')}</h3>
          <List items={t.raw('sections.audit.polygonscanSteps') as string[]} />
          <h3 className="mt-6 text-xl font-semibold">{t('sections.audit.revokeTitle')}</h3>
          <List items={t.raw('sections.audit.revokeSteps') as string[]} />
          <pre className="mt-5 overflow-x-auto border border-white/10 bg-black/35 p-5 font-mono text-xs text-purple-200">{`allowance(
  "0xYourWalletAddress",
  "${CONTRACT}"
)`}</pre>
        </Section>

        <Section id="merkle" title={t('sections.contract.title')}>
          <p className="text-zinc-400">{t('sections.contract.p1')}</p>
          <Table headers={t.raw('tables.proof.headers') as string[]} rows={proofRows} />
          <h3 className="mt-6 text-xl font-semibold">{t('sections.contract.whyTitle')}</h3>
          <List items={t.raw('sections.contract.why') as string[]} />
        </Section>

        <Section id="merkle-verify" title={t('sections.verify.title')}>
          <p className="text-zinc-400">{t('sections.verify.p1')}</p>
          <List items={t.raw('sections.verify.steps') as string[]} />
          <div className="mt-5 border border-emerald-300/25 bg-emerald-400/[0.055] p-5 text-zinc-300">
            <strong className="text-white">{t('labels.auditClaim')}</strong> {t('sections.verify.claim')}
          </div>
        </Section>

        <Section id="revenue" title={t('sections.engine.title')}>
          <p className="text-zinc-400">{t('sections.engine.p1')}</p>
          <div className="my-5 border border-purple-300/25 bg-purple-400/[0.07] p-5 text-center font-mono text-sm text-purple-100">
            {t('sections.engine.formula')}
          </div>
          <Table headers={t.raw('tables.engine.headers') as string[]} rows={engineRows} />
          <h3 className="mt-6 text-xl font-semibold">{t('sections.engine.provesTitle')}</h3>
          <List items={t.raw('sections.engine.proves') as string[]} />
        </Section>

        <Section id="compliance" title={t('sections.risk.title')}>
          <h3 className="text-xl font-semibold">{t('sections.risk.disclosuresTitle')}</h3>
          <List items={t.raw('sections.risk.disclosures') as string[]} />
          <h3 className="mt-6 text-xl font-semibold">{t('sections.risk.protectionsTitle')}</h3>
          <List items={t.raw('sections.risk.protections') as string[]} />
        </Section>

        <Section id="contracts" title={t('sections.references.title')}>
          <Table headers={t.raw('tables.contracts.headers') as string[]} rows={contractRows} />
          <p className="mt-4 text-zinc-400">
            {t('sections.references.tools')}{' '}
            <a className="text-cyan-300" href={POLYGONSCAN}>
              PolygonScan
            </a>
            ,{' '}
            <a className="text-cyan-300" href="https://revoke.cash">
              Revoke.cash
            </a>
            , DeBank.
          </p>
        </Section>

        <Section id="glossary" title={t('sections.glossary.title')}>
          <Table headers={t.raw('tables.glossary.headers') as string[]} rows={glossaryRows} />
        </Section>

        <footer className="mt-16 border-t border-white/10 pt-8 text-center font-mono text-xs text-zinc-500">
          <p>Polnation - Agentic AI Earning Technical Whitepaper v1.1</p>
          <p>{t('footer.disclaimer')}</p>
          <p>Website: www.polnation.com</p>
          <p>Copyright 2025 Polnation. All rights reserved.</p>
          <p className="mt-4 text-[10px]">USDC: {USDC}</p>
          <p className="text-[10px]">Operational wallet: {OP_WALLET}</p>
        </footer>
      </div>
    </main>
  )
}
