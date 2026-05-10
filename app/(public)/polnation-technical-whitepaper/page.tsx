import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { ArchitectureDiagram, AuthorizationDiagram, VerificationDiagram } from './Diagrams'
import { HeroMerkleIllustration } from './HeroMerkleIllustration'
import { PrintButton } from './PrintButton'
import { ReadingProgress } from './ReadingProgress'
import { RevealOnScroll } from './RevealOnScroll'
import { StickyTOC } from './StickyTOC'
import { WhitepaperLanguageSwitcher } from './WhitepaperLanguageSwitcher'
import styles from './whitepaper.module.css'

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

function sectionEyebrow(index: number, title: string) {
  const pad = String(index + 1).padStart(2, '0')
  const short = title.replace(/^\d+\.\s*/, '').trim().toUpperCase()
  return `${pad} — ${short}`
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-[68ch] space-y-4 text-[15px] leading-relaxed text-zinc-700">{children}</div>
}

function Section({
  id,
  title,
  tocIndex,
  children,
}: {
  id: string
  title: string
  tocIndex: number
  children: ReactNode
}) {
  const eyebrow = sectionEyebrow(tocIndex, title)
  return (
    <RevealOnScroll staggerMs={tocIndex * 60}>
      <section
        id={id}
        className={
          tocIndex === 0
            ? 'scroll-mt-28 pt-12'
            : 'scroll-mt-28 border-t border-zinc-200 pt-14'
        }
      >
        <header className="mb-8">
          <div
            className="font-mono text-xs tracking-[0.12em] text-[#670de5]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {eyebrow}
          </div>
          <h2 className={`mt-2 text-3xl font-medium leading-tight text-zinc-900 md:text-[2.25rem] ${styles.serifHeading}`}>
            {title}
          </h2>
          <div className="mt-5 h-px w-full max-w-[68ch] bg-zinc-200" />
        </header>
        {children}
      </section>
    </RevealOnScroll>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: Row[] }) {
  return (
    <div className="my-8 overflow-x-auto border-t border-zinc-900">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-900">
            {headers.map(h => (
              <th
                key={h}
                className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-900"
                style={{ fontFamily: 'var(--poly-font-mono)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-100 bg-white even:bg-zinc-50/60">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top text-zinc-600">
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
    <ul className="my-4 list-disc space-y-2 pl-5 marker:text-zinc-400 [&>li]:text-zinc-700">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function Callout({
  variant,
  title,
  children,
}: {
  variant: 'success' | 'risk' | 'info'
  title: string
  children: ReactNode
}) {
  const shell = {
    success: 'border-emerald-800 bg-emerald-50/65',
    risk: 'border-[#b91c1c] bg-rose-50/65',
    info: 'border-[#1d4ed8] bg-blue-50/65',
  }
  const titleTone = {
    success: 'text-emerald-900',
    risk: 'text-rose-900',
    info: 'text-blue-900',
  }
  return (
    <aside className={`my-8 border-l-[3px] px-5 py-4 ${shell[variant]}`}>
      <div
        className={`font-mono text-[11px] uppercase tracking-[0.1em] ${titleTone[variant]}`}
        style={{ fontFamily: 'var(--poly-font-mono)' }}
      >
        {title}
      </div>
      <div className="mt-2 text-[15px] leading-relaxed text-zinc-700">{children}</div>
    </aside>
  )
}

export default async function TechnicalWhitepaperPage() {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale
  const t = await getTranslations('whitepaper')

  const toc = t.raw('toc.items') as Array<{ id: string; label: string }>
  const tocIndexById = Object.fromEntries(toc.map((item, i) => [item.id, i])) as Record<string, number>

  const proofRows = t.raw('tables.proof.rows') as Row[]
  const authRows = t.raw('tables.auth.rows') as Row[]
  const engineRows = t.raw('tables.engine.rows') as Row[]
  const contractRows = t.raw('tables.contracts.rows') as Row[]
  const glossaryRows = t.raw('tables.glossary.rows') as Row[]

  return (
    <div className={styles.printSurface}>
      <ReadingProgress />
      <main className="mx-auto max-w-[1180px] px-4 pb-20 pt-8 md:px-8">
        <div className="mb-8 flex justify-end print:hidden">
          <WhitepaperLanguageSwitcher key={locale} currentLocale={locale} />
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
          <StickyTOC items={toc} title={t('toc.title')} />

          <div className="min-w-0">
            <RevealOnScroll>
              <header className="grid gap-10 border-b border-zinc-200 pb-14 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-12">
                <div className="max-w-[68ch]">
                  <div className="h-px w-14 bg-zinc-900" aria-hidden />
                  <p
                    className="mt-8 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {t('hero.docType')}
                  </p>
                  <h1
                    className={`mt-5 text-[2.75rem] font-semibold leading-[1.06] text-zinc-900 md:text-[4.25rem] md:leading-[1.02] ${styles.serifHeading}`}
                  >
                    {t('hero.title')}
                  </h1>
                  <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-zinc-600 md:text-xl">
                    {t('hero.subtitle')}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-2">
                    {(t.raw('hero.badges') as string[]).map(badge => (
                      <span
                        key={badge}
                        className="border border-zinc-300 bg-white px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-zinc-800"
                        style={{ fontFamily: 'var(--poly-font-mono)' }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <p
                    className="mt-8 font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-400"
                    style={{ fontFamily: 'var(--poly-font-mono)' }}
                  >
                    {t('hero.meta')}
                  </p>
                </div>
                <div className="flex justify-start md:justify-end md:pt-6">
                  <HeroMerkleIllustration />
                </div>
              </header>
            </RevealOnScroll>

            <div className="mt-10 print:hidden">
              <PrintButton label={t('actions.savePdf')} />
            </div>

            <Section id="abstract" title={t('sections.abstract.title')} tocIndex={tocIndexById.abstract}>
              <Prose>
                <p>{t('sections.abstract.p1')}</p>
                <p>{t('sections.abstract.p2')}</p>
              </Prose>
              <List items={t.raw('sections.abstract.bullets') as string[]} />
              <Callout variant="success" title={t('labels.coreProof')}>
                {t('sections.abstract.proof')}
              </Callout>
            </Section>

            <Section id="architecture" title={t('sections.architecture.title')} tocIndex={tocIndexById.architecture}>
              <Prose>
                <p>{t('sections.architecture.p1')}</p>
              </Prose>
              <ArchitectureDiagram labels={t.raw('diagrams.architecture') as string[]} />
              <Table headers={t.raw('tables.layers.headers') as string[]} rows={t.raw('tables.layers.rows') as Row[]} />
              <h3 className={`mt-10 text-lg font-semibold text-zinc-900 ${styles.serifHeading}`}>
                {t('sections.architecture.principlesTitle')}
              </h3>
              <List items={t.raw('sections.architecture.principles') as string[]} />
            </Section>

            <Section id="non-custodial" title={t('sections.auth.title')} tocIndex={tocIndexById['non-custodial']}>
              <Prose>
                <p>{t('sections.auth.p1')}</p>
              </Prose>
              <Callout variant="risk" title={t('labels.risk')}>
                {t('sections.auth.risk')}
              </Callout>
              <AuthorizationDiagram labels={t.raw('diagrams.authorization') as string[]} />
              <Table headers={t.raw('tables.auth.headers') as string[]} rows={authRows} />
              <Callout variant="success" title={t('labels.technicalProof')}>
                <>
                  {t('sections.auth.proof')}{' '}
                  <a className={styles.articleLink} href={POLYGONSCAN}>
                    PolygonScan
                  </a>
                  .
                </>
              </Callout>
            </Section>

            <Section id="approval-audit" title={t('sections.audit.title')} tocIndex={tocIndexById['approval-audit']}>
              <Prose>
                <p>{t('sections.audit.p1')}</p>
              </Prose>
              <VerificationDiagram labels={t.raw('diagrams.verification') as string[]} />
              <h3 className={`mt-10 text-lg font-semibold text-zinc-900 ${styles.serifHeading}`}>
                {t('sections.audit.polygonscanTitle')}
              </h3>
              <List items={t.raw('sections.audit.polygonscanSteps') as string[]} />
              <h3 className={`mt-10 text-lg font-semibold text-zinc-900 ${styles.serifHeading}`}>
                {t('sections.audit.revokeTitle')}
              </h3>
              <List items={t.raw('sections.audit.revokeSteps') as string[]} />
              <pre className={styles.codeBlock}>{`allowance(
  "0xYourWalletAddress",
  "${CONTRACT}"
)`}</pre>
            </Section>

            <Section id="merkle" title={t('sections.contract.title')} tocIndex={tocIndexById.merkle}>
              <Prose>
                <p>{t('sections.contract.p1')}</p>
              </Prose>
              <Table headers={t.raw('tables.proof.headers') as string[]} rows={proofRows} />
              <h3 className={`mt-10 text-lg font-semibold text-zinc-900 ${styles.serifHeading}`}>
                {t('sections.contract.whyTitle')}
              </h3>
              <List items={t.raw('sections.contract.why') as string[]} />
            </Section>

            <Section id="merkle-verify" title={t('sections.verify.title')} tocIndex={tocIndexById['merkle-verify']}>
              <Prose>
                <p>{t('sections.verify.p1')}</p>
              </Prose>
              <List items={t.raw('sections.verify.steps') as string[]} />
              <Callout variant="info" title={t('labels.auditClaim')}>
                {t('sections.verify.claim')}
              </Callout>
            </Section>

            <Section id="revenue" title={t('sections.engine.title')} tocIndex={tocIndexById.revenue}>
              <Prose>
                <p>{t('sections.engine.p1')}</p>
              </Prose>
              <div className={styles.formulaBox}>{t('sections.engine.formula')}</div>
              <Table headers={t.raw('tables.engine.headers') as string[]} rows={engineRows} />
              <h3 className={`mt-10 text-lg font-semibold text-zinc-900 ${styles.serifHeading}`}>
                {t('sections.engine.provesTitle')}
              </h3>
              <List items={t.raw('sections.engine.proves') as string[]} />
            </Section>

            <Section id="compliance" title={t('sections.risk.title')} tocIndex={tocIndexById.compliance}>
              <h3 className={`text-lg font-semibold text-zinc-900 ${styles.serifHeading}`}>
                {t('sections.risk.disclosuresTitle')}
              </h3>
              <List items={t.raw('sections.risk.disclosures') as string[]} />
              <h3 className={`mt-10 text-lg font-semibold text-zinc-900 ${styles.serifHeading}`}>
                {t('sections.risk.protectionsTitle')}
              </h3>
              <List items={t.raw('sections.risk.protections') as string[]} />
            </Section>

            <Section id="contracts" title={t('sections.references.title')} tocIndex={tocIndexById.contracts}>
              <Table headers={t.raw('tables.contracts.headers') as string[]} rows={contractRows} />
              <Prose>
                <p>
                  {t('sections.references.tools')}{' '}
                  <a className={styles.articleLink} href={POLYGONSCAN}>
                    PolygonScan
                  </a>
                  ,{' '}
                  <a className={styles.articleLink} href="https://revoke.cash">
                    Revoke.cash
                  </a>
                  , DeBank.
                </p>
              </Prose>
            </Section>

            <Section id="glossary" title={t('sections.glossary.title')} tocIndex={tocIndexById.glossary}>
              <Table headers={t.raw('tables.glossary.headers') as string[]} rows={glossaryRows} />
            </Section>

            <footer className="mt-20 border-t border-zinc-200 pt-10 text-center font-mono text-[11px] leading-relaxed text-zinc-500">
              <p className="text-zinc-700">Polnation - Agentic AI Earning Technical Whitepaper v1.1</p>
              <p className="mt-3 max-w-[52ch] mx-auto">{t('footer.disclaimer')}</p>
              <p className="mt-4">Website: www.polnation.com</p>
              <p>Copyright 2025—2026 Polnation. All rights reserved.</p>
              <p className="mt-4 text-[10px] text-zinc-400">USDC: {USDC}</p>
              <p className="text-[10px] text-zinc-400">Operational wallet: {OP_WALLET}</p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  )
}
