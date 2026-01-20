'use client'

import { LottieIcon } from '@/components/ui/LottieIcon'

interface FeaturesSectionProps {
  translations: {
    safe: { title: string; description: string }
    stable: { title: string; description: string }
    easy: { title: string; description: string }
    verified: { title: string; description: string }
  }
}

export function FeaturesSection({ translations }: FeaturesSectionProps) {
  const features = [
    {
      key: 'safe',
      iconSrc: '/icons/Your Keys, Your Coins.json',
      bgColor: 'bg-purple-500/20',
      hoverColor: 'group-hover:bg-purple-500/30',
      title: translations.safe.title,
      description: translations.safe.description,
    },
    {
      key: 'stable',
      iconSrc: '/icons/No Price Crash Risk.json',
      bgColor: 'bg-cyan-500/20',
      hoverColor: 'group-hover:bg-cyan-500/30',
      title: translations.stable.title,
      description: translations.stable.description,
    },
    {
      key: 'easy',
      iconSrc: '/icons/One Click, Done.json',
      bgColor: 'bg-amber-500/20',
      hoverColor: 'group-hover:bg-amber-500/30',
      title: translations.easy.title,
      description: translations.easy.description,
    },
    {
      key: 'verified',
      iconSrc: '/icons/Verified On-Chain.json',
      bgColor: 'bg-green-500/20',
      hoverColor: 'group-hover:bg-green-500/30',
      title: translations.verified.title,
      description: translations.verified.description,
    },
  ]

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => (
          <div
            key={feature.key}
            className="glass-card-solid p-6 hover:border-purple-500/40 transition-all duration-300 group"
          >
            <div
              className={`w-14 h-14 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4 ${feature.hoverColor} transition-colors overflow-hidden`}
            >
              <LottieIcon
                src={feature.iconSrc}
                className="w-10 h-10"
              />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-zinc-400 text-sm">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
