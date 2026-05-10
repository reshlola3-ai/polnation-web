'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './whitepaper.module.css'

export function RevealOnScroll({
  children,
  className,
  staggerMs = 0,
}: {
  children: ReactNode
  className?: string
  staggerMs?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -32px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${styles.reveal} ${visible ? styles.revealVisible : ''} ${className ?? ''}`}
      style={staggerMs ? { transitionDelay: `${staggerMs}ms` } : undefined}
    >
      {children}
    </div>
  )
}
