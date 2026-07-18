import React from 'react'
import { Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import { COLORS } from '../theme'
import { Background, BeatWrap, FadeUp, Pill, FONT } from '../ui'

// 7–10s：持有 USDC，每日到账，无锁仓，随时提
export const NoLock: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  return (
    <>
      <Background />
      <BeatWrap>
        <FadeUp delay={2}>
          <Pill color={COLORS.green}>💵 DAILY USDC</Pill>
        </FadeUp>

        <FadeUp delay={8} style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 24 }}>
          <Img src={staticFile('usdc.png')} style={{ width: 96, height: 96 }} />
          <div style={{ fontFamily: FONT, fontSize: 92, fontWeight: 800, color: COLORS.white }}>Hold USDC.</div>
        </FadeUp>

        <FadeUp delay={16} style={{ marginTop: 4 }}>
          <div style={{ fontFamily: FONT, fontSize: 92, fontWeight: 800, color: COLORS.green, textShadow: `0 0 40px ${COLORS.greenGlow}` }}>
            Paid daily.
          </div>
        </FadeUp>

        {/* 每天到账打钩 */}
        <div style={{ display: 'flex', gap: 18, marginTop: 60 }}>
          {days.map((d, i) => {
            const s = spring({ frame: frame - (26 + i * 5), fps, config: { damping: 200 } })
            return (
              <div
                key={d}
                style={{
                  width: 108,
                  height: 128,
                  borderRadius: 22,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
                  opacity: s,
                }}
              >
                <div style={{ fontFamily: FONT, fontSize: 24, color: COLORS.faint, fontWeight: 700 }}>{d}</div>
                <div style={{ fontSize: 44, color: COLORS.green }}>✓</div>
              </div>
            )
          })}
        </div>

        <FadeUp delay={54} style={{ marginTop: 56 }}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 46,
              fontWeight: 700,
              color: COLORS.white,
              padding: '18px 40px',
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panel,
            }}
          >
            No lock-up — withdraw anytime
          </div>
        </FadeUp>
      </BeatWrap>
    </>
  )
}
