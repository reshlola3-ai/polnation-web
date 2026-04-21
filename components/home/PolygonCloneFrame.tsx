'use client'

import { useEffect, useRef } from 'react'

const TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['Polygon | The Go-To Blockchain for Global Payments', 'Polnation | Non-Custodial USDC Community Rewards'],
  [
    'Polygon is the chosen blockchain infrastructure for enterprises and institutions to move assets instantly at scale with low fees, enterprise tooling, and proven reliability.',
    'Polnation is a non-custodial community dividend platform on Polygon. Hold USDC in your own wallet and receive promotional reward distributions based on your balance tier.',
  ],
  [
    'Polygon is the go-to blockchain for global payments. Build with the Open Money Stack for stablecoin transfers, cross-border settlement, and wallet infrastructure trusted by Stripe, Revolut, and Mastercard.',
    'Polnation helps community members hold USDC in self-custody, unlock transparent reward tiers, and participate in promotional distributions powered by Polygon.',
  ],
  ['Polygon Labs', 'Polnation'],
  ['Polygon Open Money Stack', 'Polnation Reward Engine'],
  ['Polygon Chain', 'Polnation Vault'],
  ['Crosschain Interop', 'Balance Tiers'],
  ['Wallet Infrastructure', 'Self-Custody Flow'],
  ['Payments', 'Community Rewards'],
  ['Stablecoins', 'USDC Rewards'],
  ['About Polygon', 'About Polnation'],
  ['Use Polygon', 'Use Polnation'],
  ['Polygon Scan', 'Polnation Dashboard'],
  ['Polygon', 'Polnation'],
  ['The Go-To Blockchain for Global Payments', 'The Non-Custodial Home For USDC Community Rewards'],
  [
    'The enterprise-ready stack for regulated on-ramps, compliant wallets, and blockchain settlement. Get early access',
    'A transparent reward experience for USDC holders with self-custody, balance tiers, and community-first distribution logic.',
  ],
  ['The go-to settlement layer to move money globally', 'A transparent reward layer for community-first USDC participation'],
  ['1-click cross-chain transactions', 'Balance-based participation with simple qualification rules'],
  ['Seamless enterprise-grade wallets for any use case', 'Keep your assets in your own wallet while staying eligible for rewards'],
  ['Choose faster, lower-cost, next-gen rails with Polygon', 'Join a USDC-first community reward system built on Polygon infrastructure'],
  ['Polygon brings unmatched reach and depth in stablecoin integrations for apps, issuers, and users', 'USDC sits at the center of Polnation participation, qualification, and transparent reward distribution'],
]

function replaceTextContent(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    const original = node.textContent ?? ''

    if (original.trim()) {
      let nextValue = original

      for (const [from, to] of TEXT_REPLACEMENTS) {
        if (nextValue.includes(from)) {
          nextValue = nextValue.split(from).join(to)
        }
      }

      if (nextValue !== original) {
        node.textContent = nextValue
      }
    }

    current = walker.nextNode()
  }
}

function isTopLevelNavigationHref(href: string) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false
  }

  return (
    href.startsWith('/') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    href.startsWith('https://www.polnation.com') ||
    href.startsWith('https://polnation.com') ||
    href.startsWith('http://www.polnation.com') ||
    href.startsWith('http://polnation.com')
  )
}

function rewriteNavigationTargets(doc: Document) {
  doc.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') ?? ''
    if (!isTopLevelNavigationHref(href)) {
      return
    }

    link.setAttribute('target', '_top')

    const element = link as HTMLAnchorElement
    element.addEventListener('click', (event) => {
      event.preventDefault()
      window.location.href = element.href
    })
  })
}

function customizeCloneDocument(doc: Document) {
  if (doc.documentElement.dataset.polnationCustomized === 'true') {
    return
  }

  doc.documentElement.dataset.polnationCustomized = 'true'

  const style = doc.createElement('style')
  style.textContent = `
    .nav-wrapper {
      display: none !important;
    }

    .page_wrap {
      padding-top: 0 !important;
    }

    html, body {
      background: #05070d !important;
    }
  `
  doc.head.appendChild(style)

  replaceTextContent(doc.body)
  rewriteNavigationTargets(doc)

  const title = doc.querySelector('title')
  if (title) {
    let nextTitle = title.textContent ?? ''
    for (const [from, to] of TEXT_REPLACEMENTS) {
      if (nextTitle.includes(from)) {
        nextTitle = nextTitle.split(from).join(to)
      }
    }
    title.textContent = nextTitle
  }

  doc.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="twitter:title"], meta[property="twitter:description"], meta[property="og:site_name"]').forEach((meta) => {
    const content = meta.getAttribute('content')
    if (!content) {
      return
    }

    let nextContent = content
    for (const [from, to] of TEXT_REPLACEMENTS) {
      if (nextContent.includes(from)) {
        nextContent = nextContent.split(from).join(to)
      }
    }

    if (nextContent !== content) {
      meta.setAttribute('content', nextContent)
    }
  })
}

export function PolygonCloneFrame() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }

    let resizeObserver: ResizeObserver | null = null

    const syncHeight = () => {
      const doc = iframe.contentDocument
      if (!doc) {
        return
      }

      const bodyHeight = doc.body?.scrollHeight ?? 0
      const documentHeight = doc.documentElement?.scrollHeight ?? 0
      const nextHeight = Math.max(bodyHeight, documentHeight, window.innerHeight)

      iframe.style.height = `${nextHeight}px`
    }

    const attach = () => {
      const doc = iframe.contentDocument
      const frameWindow = iframe.contentWindow

      if (!doc || !frameWindow) {
        return
      }

      customizeCloneDocument(doc)
      syncHeight()

      resizeObserver = new ResizeObserver(() => {
        syncHeight()
      })

      if (doc.body) {
        resizeObserver.observe(doc.body)
      }

      frameWindow.addEventListener('resize', syncHeight)
      window.addEventListener('resize', syncHeight)

      setTimeout(syncHeight, 100)
      setTimeout(syncHeight, 500)
      setTimeout(syncHeight, 1200)
    }

    iframe.addEventListener('load', attach)

    return () => {
      iframe.removeEventListener('load', attach)
      resizeObserver?.disconnect()

      const frameWindow = iframe.contentWindow
      frameWindow?.removeEventListener('resize', syncHeight)
      window.removeEventListener('resize', syncHeight)
    }
  }, [])

  return (
    <iframe
      ref={iframeRef}
      src="/polygon-clone/index.html"
      title="Polnation homepage experience"
      className="block w-full border-0 bg-black"
    />
  )
}
