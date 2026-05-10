'use client'

import { useEffect, useRef } from 'react'
import styles from './whitepaper.module.css'

export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const h = document.documentElement
        const denom = Math.max(1, h.scrollHeight - h.clientHeight)
        const p = Math.min(1, Math.max(0, h.scrollTop / denom))
        bar.style.transform = `scaleX(${p})`
      })
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      className={`${styles.readingProgress} fixed left-0 right-0 top-0 z-[60] h-[2px] bg-transparent print:hidden`}
      aria-hidden
    >
      <div
        ref={barRef}
        className="h-full origin-left scale-x-0 bg-[#670de5]"
        style={{ willChange: 'transform' }}
      />
    </div>
  )
}
