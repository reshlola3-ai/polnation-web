/**
 * bake-homepage.mjs
 *
 * Pre-applies all static Polnation text replacements to polygon-clone/index.html
 * so users see the correct content immediately on page load — no JS delay.
 *
 * Run: node scripts/bake-homepage.mjs
 */

import { load } from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'public', 'polygon-clone', 'index.html')

const html = readFileSync(SRC, 'utf8')
const $ = load(html, { decodeEntities: false })

// ─── 1. TEXT_REPLACEMENTS (text-node level) ──────────────────────────────────
const TEXT_REPLACEMENTS = [
  ['Polnation Community Dividend Engine', 'Polnation Agentic AI Earning Engine'],
  ['Community Dividend Platform', 'Agentic AI Earning'],
  ['community dividend platform', 'Agentic AI earning platform'],
  ['Community Dividend', 'Agentic AI Earning'],
  ['community dividend', 'Agentic AI earning'],
  ['Community Rewards', 'Agentic AI Earning'],
  ['community rewards', 'Agentic AI Earning'],
  ['community reward distributions', 'Agentic AI earning distributions'],
  ['community reward system', 'Agentic AI earning system'],
  ['community reward weight', 'Agentic AI earning weight'],
  ['community reward', 'Agentic AI earning'],
  ['Open Money Stack', 'Reward Engine'],
  ['The Go-To Blockchain for Global Payments', 'The Non-Custodial Home for Daily USDC Reward Distributions'],
  ['Get early access', 'Get Started Now'],
  ['Contact Us', 'Join Polnation'],
  ['Contact us', 'Join Polnation'],
  ['Book a Call', 'Get Started'],
  ['Stake Pol', 'Dashboard'],
  ['Governance', 'Reward Rules'],
  ['Github', 'Updates'],
  ['Security', 'Account Safety'],
  ['Faucet', 'Reward Tracker'],
  ['Careers', 'Partner With Us'],
  ['Brand Guidelines', 'Brand Assets'],
  ['Airdrops', 'Daily Rewards'],
  ['Staking', 'Dashboard'],
  ['Portal', 'Dashboard'],
  ['Ecosystem', 'Community'],
  ["Let's build", "Let's grow"],
  ['Get started', 'Get rewarded'],
  ['Get Started', 'Get Rewarded'],
  ['Explore', 'Open'],
  ['Back', 'Menu'],
]

function applyTextReplacements(node) {
  $(node).contents().each(function () {
    if (this.type === 'text') {
      let val = this.data || ''
      if (!val.trim()) return
      let next = val
      for (const [from, to] of TEXT_REPLACEMENTS) {
        if (next.includes(from)) next = next.split(from).join(to)
      }
      if (next !== val) this.data = next
    } else if (this.type === 'tag') {
      applyTextReplacements(this)
    }
  })
}
applyTextReplacements($.root()[0])

// ─── 2. STATIC COPY (setText / setHtml equivalents) ──────────────────────────

function setText(sel, value) {
  const el = $(sel).first()
  if (el.length) el.text(value)
}
function setHtml(sel, value) {
  const el = $(sel).first()
  if (el.length) el.html(value)
}

const homepageTitle = 'Polnation - Agentic AI Earning | Earn USDC Distributions'
const homepageDescription = 'Polnation is an Agentic AI Earning platform on Polygon. Hold USDC in your own wallet and earn daily through AI-driven yield routing based on your balance tier.'

$('title').first().text(homepageTitle)
$('meta[name="description"], meta[property="og:description"], meta[property="twitter:description"]').attr('content', homepageDescription)
$('meta[property="og:title"], meta[property="twitter:title"]').attr('content', homepageTitle)

// Hero heading
setText('.section.is-hero .heading-hide', 'Agentic AI Earning')
setHtml('.section.is-hero .hero-heading-container .hero-heading', 'Agentic<br/>AI<br/>')

// Last wirechain hero-heading = "Earning"
const wirechainHeadings = $('.section.is-hero .wirechain-wrap .hero-heading')
if (wirechainHeadings.length) {
  wirechainHeadings.last().text('Earning')
}

// Hero para
setText(
  '.section.is-hero .h-hero-para .u-body-large',
  'Hold USDC in your own wallet and earn daily through Polnation Agentic AI Earning based on your balance tier.'
)

// Hero buttons
const heroButtons = $('.section.is-hero .hero-button-wrap .btn')
if (heroButtons.length > 0) {
  const label0 = heroButtons.eq(0).find('div').first()
  if (label0.length) label0.text('Earning Guide')
}
if (heroButtons.length > 1) {
  const label1 = heroButtons.eq(1).find('div').first()
  if (label1.length) label1.text('Open Dashboard')
}

// Cards heading
setText('.cards-heading-wrap .h-eyebrow-container > div', 'Polnation Stats')
setHtml('.cards-heading-wrap .u-h2', 'Serving real wallets<br/>with live onchain activity')

// OMS section
setText('.h-eyebrow .h-eyebrow-container > div:last-child', 'POLNATION REWARD ENGINE')
setHtml('.oms-what-heading-wrap .u-h2', 'One reward engine for<br/>self-custody growth')
setText(
  '.oms-what-heading-wrap .u-body-large',
  'A single place to track balance tiers, referral momentum, and daily USDC earnings powered by Polnation Agentic AI.'
)
const omsBtn = $('.oms-what-heading-wrap .btn.is-black > div').first()
if (omsBtn.length) omsBtn.text('Get Started')

// OMS lottie cards
const omsCards = $('.sec.is-blue.is-lottie .oms-lottie-card')
if (omsCards.length > 0) {
  const c = omsCards.eq(0)
  c.find('.oms-lottie-heading h3').text('Self-Custody Access')
  c.find('.oms-lottie-para-wrap .u-body-mono-medium').text('KEEP USDC IN YOUR OWN WALLET WHILE STAYING ELIGIBLE FOR DAILY REWARDS')
  c.find('.lottie-detail-para-wrap .oms-lottie-heading h3').text('Self-Custody Access')
  c.find('.lottie-detail-para-wrap .u-body-mono-medium').text('KEEP USDC IN YOUR OWN WALLET WHILE STAYING ELIGIBLE FOR DAILY REWARDS')
  c.find('.lottie-detail-para-wrap .u-body-regular').text('Your USDC stays in your wallet. No lock-up, no custody transfer, and no smart-contract deposit required to participate.')
}
if (omsCards.length > 1) {
  const c = omsCards.eq(1)
  c.find('.oms-lottie-heading h3').text('Referral Momentum')
  c.find('.oms-lottie-para-wrap .u-body-mono-medium').text('GROW YOUR TEAM TO BOOST AGENTIC AI EARNING')
  c.find('.lottie-detail-para-wrap .oms-lottie-heading h3').text('Referral Momentum')
  c.find('.lottie-detail-para-wrap .u-body-mono-medium').text('GROW YOUR TEAM TO BOOST AGENTIC AI EARNING')
  c.find('.lottie-detail-para-wrap .u-body-regular').text('Invite new wallet holders, grow team volume, and reset your momentum multiplier to strengthen daily reward output.')
}

// Use case cards
const ucEyebrows = $('.usecase-eyebrow-wrap .h-eyebrow-container.is-stat, .h-uc-mobile-wrap .h-eyebrow-container.is-stat')
ucEyebrows.each(function () {
  $(this).find('> div').last().text('WHAT POLNATION CAN DO FOR YOU')
})

const ucCardCopy = [
  { title: 'Agentic AI Earning', eyebrow: 'AGENTIC AI EARNING', body: 'Hold eligible USDC in your own wallet and earn daily through Polnation Agentic AI without moving assets into custody.' },
  { title: 'Balance Tiers', eyebrow: 'BALANCE TIERS', body: 'Higher balances unlock stronger participation weight, larger daily distributions, and more visibility in the Agentic AI earning system.' },
  { title: 'Referral Growth', eyebrow: 'REFERRAL GROWTH', body: 'Invite new members, increase team momentum, and strengthen your daily earning profile through transparent community expansion.' },
  { title: 'Treasury Visibility', eyebrow: 'TREASURY VISIBILITY', body: 'Follow treasury activity, verify recent transfers, and see how onchain pool movement supports Polnation reward distribution.' },
]
$('.h-uc-card-container').each(function (i) {
  const content = ucCardCopy[i % ucCardCopy.length]
  const title = $(this).find('.uc-heading-wrap h2')
  const eyebrow = $(this).find('.uc-detail-card-desktop .u-body-mono-small')
  const bodyLarge = $(this).find('.uc-detail-card-desktop .u-body-large')
  const bodySmall = $(this).find('.u-body-small')
  if (title.length) title.text(content.title)
  if (eyebrow.length) eyebrow.text(content.eyebrow)
  if (bodyLarge.length) bodyLarge.text(content.body)
  if (bodySmall.length) bodySmall.text(content.body)
})

// Trail section
setHtml('.trail .oms-what-heading-wrap .u-h1', 'Start earning<br/>with Polnation')
const trailCards = $('.trail .h-trail-card')
if (trailCards.length > 0) {
  const btn = trailCards.eq(0).find('.btn > div')
  if (btn.length) btn.text('VIEW GUIDE')
}
if (trailCards.length > 1) {
  const btn = trailCards.eq(1).find('.btn > div')
  if (btn.length) btn.text('JOIN COMMUNITY')
}
if (trailCards.length > 2) {
  const btn = trailCards.eq(2).find('.btn > div')
  if (btn.length) btn.text('OPEN DASHBOARD')
}
setText('.trail ~ .h-eyebrow .h-eyebrow-container > div:last-child', "Let's grow rewards")

// ─── 3. REMAP LINKS ──────────────────────────────────────────────────────────
$('a[href]').each(function () {
  const label = ($(this).text() || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const mappedHref = label.includes('earning guide') ? '/polnation-earning-guide.html' : '/dashboard'

  $(this).attr('href', mappedHref)
  $(this).removeAttr('target').removeAttr('rel')
})

// ─── 4. REMOVE ANTI-FLICKER + INTELLIMIZE ────────────────────────────────────
// Remove inline anti-flicker style
$('style').each(function () {
  if ($(this).html().includes('anti-flicker')) $(this).remove()
})

// Remove intellimize scripts
$('script').each(function () {
  const src = $(this).attr('src') || ''
  const code = $(this).html() || ''
  if (
    src.includes('intellimize') ||
    code.includes('intellimize') ||
    code.includes('anti-flicker')
  ) {
    $(this).remove()
  }
})

// Remove intellimize preconnect/preload links
$('link').each(function () {
  const href = $(this).attr('href') || ''
  if (href.includes('intellimize') || href.includes('intellimizeio')) $(this).remove()
})

// ─── 5. WRITE OUTPUT ─────────────────────────────────────────────────────────
writeFileSync(SRC, $.html(), 'utf8')
console.log('✓ Baked:', SRC)
