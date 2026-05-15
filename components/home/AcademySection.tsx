'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  GraduationCap, 
  ChevronRight,
  Play,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'

interface AcademySectionProps {
  translations: {
    title: string
    subtitle: string
    watchVideo: string
    viewFullGuide: string
    step: string
    steps: {
      wallet: {
        title: string
        description: string
        details: string[]
      }
      deposit: {
        title: string
        description: string
        details: string[]
      }
      sign: {
        title: string
        description: string
        details: string[]
      }
      earn: {
        title: string
        description: string
        details: string[]
      }
    }
  }
}

const stepMedia = [
  { image: '/wallet-logos/trust.webp', alt: 'Wallet app', fit: 'contain' },
  { image: '/usdc.webp', alt: 'USDC', fit: 'contain' },
  { image: '/logo.svg', alt: 'Polnation activation', fit: 'contain' },
  { image: '/crowdfunding.webp', alt: 'Agentic Earnings', fit: 'cover' },
]

export function AcademySection({ translations: t }: AcademySectionProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [showVideoModal, setShowVideoModal] = useState(false)

  const steps = [
    t.steps.wallet,
    t.steps.deposit,
    t.steps.sign,
    t.steps.earn,
  ]

  return (
    <section className="relative z-10 py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            <span className="text-sm text-cyan-300 font-medium">Academy</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            {t.title}
          </h2>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {steps.map((step, index) => {
            const media = stepMedia[index]
            const isExpanded = expandedStep === index

            return (
              <div
                key={index}
                className={`relative group cursor-pointer transition-all duration-300 ${
                  isExpanded ? 'md:col-span-2 lg:col-span-2' : ''
                }`}
                onClick={() => setExpandedStep(isExpanded ? null : index)}
              >
                {/* Card */}
                <div className={`
                  relative p-6 rounded-2xl border transition-all duration-300
                  ${isExpanded 
                    ? 'bg-zinc-900/80 border-cyan-500/30' 
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
                  }
                `}>
                  {/* Step Number */}
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{index + 1}</span>
                  </div>

                  {/* Connection Line (desktop only) */}
                  {index < 3 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-zinc-600 to-transparent" />
                  )}

                  {/* Icon */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-950 border border-white/10 mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Image
                      src={media.image}
                      alt={media.alt}
                      fill
                      sizes="56px"
                      className={media.fit === 'cover' ? 'object-cover' : 'object-contain p-2'}
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-bold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {step.description}
                  </p>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-zinc-800 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Details List */}
                        <div className="space-y-3">
                          {step.details.map((detail, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                              <span className="text-zinc-300 text-sm">{detail}</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Step media */}
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-zinc-700">
                          <Image
                            src={media.image}
                            alt={media.alt}
                            fill
                            sizes="(min-width: 768px) 320px, 100vw"
                            className={media.fit === 'cover' ? 'object-cover' : 'object-contain p-8'}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expand Indicator */}
                  <div className={`
                    absolute bottom-4 right-4 transition-transform duration-300
                    ${isExpanded ? 'rotate-90' : ''}
                  `}>
                    <ChevronRight className="w-5 h-5 text-zinc-500" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Watch Video Button */}
          <button
            onClick={() => setShowVideoModal(true)}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/25"
          >
            <Play className="w-5 h-5" />
            {t.watchVideo}
          </button>

          {/* Full Guide Link */}
          <Link
            href="/academy"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
          >
            {t.viewFullGuide}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowVideoModal(false)}
        >
          <div 
            className="relative w-full max-w-4xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              ✕
            </button>

            {/* YouTube Embed Placeholder */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
              <Play className="w-20 h-20 mb-4 opacity-30" />
              <p className="text-lg">YouTube Video Tutorial</p>
              <p className="text-sm opacity-50 mt-2">Video ID will be configured here</p>
              
              {/* When you have a YouTube video, replace with: */}
              {/* <iframe
                src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              /> */}
            </div>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </section>
  )
}
