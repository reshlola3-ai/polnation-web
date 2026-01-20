'use client'

import Lottie from 'lottie-react'
import { useEffect, useState } from 'react'

interface LottieIconProps {
  src: string
  className?: string
  loop?: boolean
  autoplay?: boolean
}

export function LottieIcon({ src, className = '', loop = true, autoplay = true }: LottieIconProps) {
  const [animationData, setAnimationData] = useState<object | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(src)
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(() => setError(true))
  }, [src])

  if (error || !animationData) {
    return <div className={className} />
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
    />
  )
}
