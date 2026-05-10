import type { Metadata } from 'next'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { PrintButton } from './PrintButton'
import { WhitepaperLanguageSwitcher } from './WhitepaperLanguageSwitcher'

const CONTRACT = '0x76f0d64bC0D41262aebBCc584679Ee1EBb22dd0d'
const USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
const OP_WALLET = '0x6c4C745d909B13528e638C7Aa63ABA9406fA8c63'
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
    <div className="relative overflow-hidden border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)] md:p-7">
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
            <h1 className="max-w-3xl bg-[linear-gradient(110deg,#c084fc_0%,#fff_18%,#22d3ee_38%,#a855f7_58%,#fff_78%,#c084fc_100%)] bg-[length:200%_100%] bg-clip-text text-5xl font-bold leading-[0.9] text-transparent md:text-8xl">
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
              className="object-contain drop-shadow-2xl"
            />
          </div>
        </header>

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
          <Table headers={t.raw('tables.layers.headers') as string[]} rows={t.raw('tables.layers.rows') as Row[]} />
          <h3 className="mt-6 text-xl font-semibold">{t('sections.architecture.principlesTitle')}</h3>
          <List items={t.raw('sections.architecture.principles') as string[]} />
        </Section>

        <Section id="non-custodial" title={t('sections.auth.title')}>
          <p className="text-zinc-400">{t('sections.auth.p1')}</p>
          <div className="my-5 border border-rose-300/30 bg-rose-400/[0.06] p-5 text-zinc-300">
            <strong className="text-white">{t('labels.risk')}</strong> {t('sections.auth.risk')}
          </div>
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
