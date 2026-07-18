import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Inter'
import { COLORS } from './theme'

const { fontFamily } = loadFont()
export const FONT = fontFamily

// 深色玻璃拟态背景 + 缓慢漂移的紫/绿光晕
export const Background: React.FC = () => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 45) * 40
  const drift2 = Math.cos(frame / 60) * 50
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at ${50 + drift / 20}% 22%, ${COLORS.purpleGlow}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(50% 35% at ${40 - drift2 / 20}% 82%, ${COLORS.greenGlow}, transparent 70%)`,
        }}
      />
      {/* 细网格 */}
      <AbsoluteFill
        style={{
          opacity: 0.06,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(70% 60% at 50% 45%, black, transparent 85%)',
        }}
      />
    </AbsoluteFill>
  )
}

// 从下方淡入上浮；delay 单位为帧
export const FadeUp: React.FC<{ delay?: number; children: React.ReactNode; y?: number; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  y = 60,
  style,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.7 } })
  return (
    <div
      style={{
        transform: `translateY(${interpolate(s, [0, 1], [y, 0])}px)`,
        opacity: interpolate(s, [0, 1], [0, 1]),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// 小标签（品牌胶囊）
export const Pill: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = COLORS.purpleLight }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 24px',
      borderRadius: 999,
      background: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
      color,
      fontSize: 34,
      fontWeight: 600,
      fontFamily: FONT,
      letterSpacing: 0.5,
    }}
  >
    {children}
  </div>
)

export const cx = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

// 整段镜头的柔和进出淡入淡出（避免硬切），基于 Sequence 内的本地帧与时长。
export const BeatWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const opacity = interpolate(
    frame,
    [0, 8, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  return (
    <AbsoluteFill style={{ opacity, alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      {children}
    </AbsoluteFill>
  )
}
