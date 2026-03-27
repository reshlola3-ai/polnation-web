'use client'

import { useEffect, useRef } from 'react'

interface ViewportVideoProps {
  src: string
  type?: string
  className?: string
  poster?: string
  preload?: 'none' | 'metadata' | 'auto'
}

export function ViewportVideo({
  src,
  type = 'video/webm',
  className,
  poster = '/hero-crystal.webp',
  preload = 'none',
}: ViewportVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!video) return

        if (entry.isIntersecting) {
          void video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.35 }
    )

    observer.observe(video)

    return () => {
      observer.disconnect()
      video.pause()
    }
  }, [])

  return (
    <video
      ref={videoRef}
      loop
      muted
      playsInline
      preload={preload}
      poster={poster}
      className={className}
    >
      <source src={src} type={type} />
    </video>
  )
}
