import { createServerClient } from '@/lib/supabase-server'
import { getTranslations } from 'next-intl/server'
import { HomepageNavbar } from '@/components/layout/HomepageNavbar'
import { PolygonCloneFrame } from '@/components/home/PolygonCloneFrame'

// JSON-LD 结构化数据
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Polnation',
  alternateName: ['Polnation Staking', 'Polnation Crypto'],
  url: 'https://www.polnation.com',
  description: 'Polnation is a non-custodial community dividend platform on Polygon. Hold USDC in your own wallet and receive promotional reward distributions based on your balance tier.',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.polnation.com/search?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Polnation',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.polnation.com/logo.svg',
    },
  },
  sameAs: [
    'https://twitter.com/polnation',
    'https://t.me/polnation',
  ],
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Polnation',
  url: 'https://www.polnation.com',
  logo: 'https://www.polnation.com/logo.svg',
  description: 'Non-custodial community dividend platform on Polygon blockchain',
  foundingDate: '2024',
  sameAs: [
    'https://twitter.com/polnation',
    'https://t.me/polnation',
  ],
}

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const tNav = await getTranslations('nav')

  return (
    <>
      {/* JSON-LD 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      
      <div className="min-h-screen bg-[#05070d]">
        <HomepageNavbar
          user={user}
          signInLabel={tNav('signIn')}
          getStartedLabel={tNav('getStarted')}
          dashboardLabel={tNav('dashboard')}
        />
        <div className="-mt-[88px] pt-[88px]">
          <PolygonCloneFrame />
        </div>
      </div>
    </>
  )
}
