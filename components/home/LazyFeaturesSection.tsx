'use client'

import dynamic from 'next/dynamic'

interface FeaturesSectionProps {
  translations: {
    safe: { title: string; description: string }
    stable: { title: string; description: string }
    easy: { title: string; description: string }
    verified: { title: string; description: string }
  }
}

const FeaturesSection = dynamic(
  () => import('@/components/home/FeaturesSection').then(m => m.FeaturesSection),
  {
    ssr: false,
    loading: () => (
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </section>
    ),
  }
)

export function LazyFeaturesSection({ translations }: FeaturesSectionProps) {
  return <FeaturesSection translations={translations} />
}
