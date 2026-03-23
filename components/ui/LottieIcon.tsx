'use client'

import Lottie from 'lottie-react'
import { useEffect, useRef, useState } from 'react'

interface LottieIconProps {
  src: string
  className?: string
  loop?: boolean
  autoplay?: boolean
  hoverPlay?: boolean
}

export function LottieIcon({ src, className = '', loop = true, autoplay = true, hoverPlay = false }: LottieIconProps) {
  const [animationData, setAnimationData] = useState<object | null>(null)
  const [error, setError] = useState(false)
  const lottieRef = useRef<{ play: () => void; stop: () => void } | null>(null)

  useEffect(() => {
    fetch(src)
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(() => setError(true))
  }, [src])

  if (error || !animationData) {
    return <div className={className} />
  }

  if (hoverPlay) {
    return (
      <div
        className={className}
        onMouseEnter={() => lottieRef.current?.play()}
        onMouseLeave={() => lottieRef.current?.stop()}
      >
        <Lottie
          lottieRef={lottieRef as React.RefObject<never>}
          animationData={animationData}
          loop={loop}
          autoplay={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    )
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
