'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useMotionValue, SpringOptions } from 'framer-motion'

export interface BubbleColors {
  first?: string
  second?: string
  third?: string
  fourth?: string
  fifth?: string
  sixth?: string
}

export interface BubbleBackgroundProps extends React.ComponentProps<'div'> {
  interactive?: boolean
  transition?: SpringOptions
  colors?: BubbleColors
}

const defaultColors: BubbleColors = {
  first: '147, 51, 234',   // Purple
  second: '139, 92, 246',  // Light Purple
  third: '6, 182, 212',    // Cyan
  fourth: '168, 85, 247',  // Purple accent
  fifth: '34, 211, 238',   // Bright Cyan
  sixth: '124, 58, 237',   // Violet
}

export function BubbleBackground({
  interactive = true,
  transition = { stiffness: 100, damping: 20 },
  colors = defaultColors,
  className,
  ...props
}: BubbleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springX = useSpring(mouseX, transition)
  const springY = useSpring(mouseY, transition)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!interactive || !mounted) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      mouseX.set(x)
      mouseY.set(y)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [interactive, mounted, mouseX, mouseY])

  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className={`fixed inset-0 overflow-hidden bg-[#0D0B21] ${className || ''}`}
        {...props}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 overflow-hidden ${className || ''}`}
      style={{
        background: `linear-gradient(135deg, #0D0B21 0%, #1A1333 50%, #0D0B21 100%)`,
      }}
      {...props}
    >
      {/* SVG Filter for blur effect */}
      <svg className="hidden">
        <defs>
          <filter id="bubble-blur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      {/* Gradient container */}
      <div 
        className="absolute inset-0"
        style={{ filter: 'url(#bubble-blur) blur(60px)' }}
      >
        {/* First bubble - large, top right */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-60"
          style={{
            background: `radial-gradient(circle at center, rgba(${colors.first}, 0.8) 0%, rgba(${colors.first}, 0) 70%)`,
            top: '-10%',
            right: '-10%',
          }}
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -40, 30, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Second bubble - medium, bottom left */}
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-50"
          style={{
            background: `radial-gradient(circle at center, rgba(${colors.second}, 0.7) 0%, rgba(${colors.second}, 0) 70%)`,
            bottom: '-5%',
            left: '-5%',
          }}
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -50, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />

        {/* Third bubble - small, center */}
        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full opacity-40"
          style={{
            background: `radial-gradient(circle at center, rgba(${colors.third}, 0.6) 0%, rgba(${colors.third}, 0) 70%)`,
            top: '40%',
            left: '30%',
          }}
          animate={{
            x: [0, 60, -40, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.2, 0.85, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />

        {/* Fourth bubble - top left */}
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full opacity-35"
          style={{
            background: `radial-gradient(circle at center, rgba(${colors.fourth}, 0.5) 0%, rgba(${colors.fourth}, 0) 70%)`,
            top: '10%',
            left: '15%',
          }}
          animate={{
            x: [0, 30, -50, 0],
            y: [0, 50, -30, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 3,
          }}
        />

        {/* Fifth bubble - bottom right */}
        <motion.div
          className="absolute w-[450px] h-[450px] rounded-full opacity-45"
          style={{
            background: `radial-gradient(circle at center, rgba(${colors.fifth}, 0.6) 0%, rgba(${colors.fifth}, 0) 70%)`,
            bottom: '10%',
            right: '10%',
          }}
          animate={{
            x: [0, -50, 30, 0],
            y: [0, 40, -40, 0],
            scale: [1, 0.95, 1.1, 1],
          }}
          transition={{
            duration: 16,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        />

        {/* Interactive bubble - follows mouse */}
        {interactive && (
          <motion.div
            className="absolute w-[250px] h-[250px] rounded-full opacity-60 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, rgba(${colors.sixth}, 0.7) 0%, rgba(${colors.sixth}, 0) 70%)`,
              x: springX,
              y: springY,
              translateX: '-50%',
              translateY: '-50%',
            }}
          />
        )}
      </div>

      {/* Noise overlay for texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
