'use client'

import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

interface AuroraCardProps {
  children: React.ReactNode
  className?: string
}

export function AuroraCard({ children, className = '' }: AuroraCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Mouse position for glare effect only
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const springConfig = { stiffness: 150, damping: 15 }
  const glareX = useSpring(useTransform(mouseX, [0, 1], [0, 100]), springConfig)
  const glareY = useSpring(useTransform(mouseY, [0, 1], [0, 100]), springConfig)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    mouseX.set(x)
    mouseY.set(y)
  }

  return (
    <motion.div
      ref={cardRef}
      className={`relative overflow-hidden rounded-2xl ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Aurora Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800" />
        
        {/* Aurora layers */}
        <motion.div
          className="absolute inset-0 opacity-80"
          animate={{
            background: [
              'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(147, 51, 234, 0.9) 0%, transparent 60%)',
              'radial-gradient(ellipse 80% 60% at 80% 70%, rgba(147, 51, 234, 0.9) 0%, transparent 60%)',
              'radial-gradient(ellipse 80% 60% at 40% 80%, rgba(147, 51, 234, 0.9) 0%, transparent 60%)',
              'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(147, 51, 234, 0.9) 0%, transparent 60%)',
            ],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        <motion.div
          className="absolute inset-0 opacity-70"
          animate={{
            background: [
              'radial-gradient(ellipse 70% 50% at 70% 20%, rgba(6, 182, 212, 0.8) 0%, transparent 50%)',
              'radial-gradient(ellipse 70% 50% at 30% 60%, rgba(6, 182, 212, 0.8) 0%, transparent 50%)',
              'radial-gradient(ellipse 70% 50% at 60% 90%, rgba(6, 182, 212, 0.8) 0%, transparent 50%)',
              'radial-gradient(ellipse 70% 50% at 70% 20%, rgba(6, 182, 212, 0.8) 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />

        <motion.div
          className="absolute inset-0 opacity-60"
          animate={{
            background: [
              'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(236, 72, 153, 0.7) 0%, transparent 50%)',
              'radial-gradient(ellipse 60% 40% at 20% 80%, rgba(236, 72, 153, 0.7) 0%, transparent 50%)',
              'radial-gradient(ellipse 60% 40% at 80% 30%, rgba(236, 72, 153, 0.7) 0%, transparent 50%)',
              'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(236, 72, 153, 0.7) 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        {/* Shimmer effect on mouse move */}
        <motion.div
          className="absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.2) 0%, transparent 40%)`,
          }}
        />
      </div>

      {/* Glowing border */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        animate={{
          boxShadow: isHovered
            ? [
                '0 0 20px rgba(147, 51, 234, 0.5), inset 0 0 20px rgba(147, 51, 234, 0.1)',
                '0 0 40px rgba(147, 51, 234, 0.7), inset 0 0 30px rgba(147, 51, 234, 0.2)',
                '0 0 20px rgba(147, 51, 234, 0.5), inset 0 0 20px rgba(147, 51, 234, 0.1)',
              ]
            : '0 0 15px rgba(147, 51, 234, 0.3)',
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Border gradient */}
      <div className="absolute inset-0 rounded-2xl border border-white/20" />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  )
}
