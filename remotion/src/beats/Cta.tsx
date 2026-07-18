import React from 'react'
import { Img, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { COLORS, BRAND } from '../theme'
import { Background, BeatWrap, FadeUp, FONT } from '../ui'

// 16.5–20s：行动号召
export const Cta: React.FC = () => {
  const frame = useCurrentFrame()
  const pulse = 1 + Math.sin(frame / 6) * 0.03
  const glow = interpolate(Math.sin(frame / 6), [-1, 1], [40, 90])
  return (
    <>
      <Background />
      <BeatWrap>
        <FadeUp delay={2}>
          <Img src={staticFile('logo.svg')} style={{ width: 130, height: 130, marginBottom: 22 }} />
        </FadeUp>

        <FadeUp delay={8} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONT, fontSize: 44, color: COLORS.dim, fontWeight: 500, letterSpacing: 1 }}>Start earning on</div>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 128,
              letterSpacing: 3,
              marginTop: 4,
              background: `linear-gradient(100deg, ${COLORS.white}, ${COLORS.purpleLight})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {BRAND.name}
          </div>
        </FadeUp>

        {/* 脉冲按钮 */}
        <FadeUp delay={18} style={{ marginTop: 70 }}>
          <div
            style={{
              transform: `scale(${pulse})`,
              padding: '34px 84px',
              borderRadius: 999,
              background: `linear-gradient(100deg, ${COLORS.purple}, ${COLORS.purpleHover})`,
              boxShadow: `0 0 ${glow}px ${COLORS.purpleGlow}`,
              fontFamily: FONT,
              fontSize: 56,
              fontWeight: 800,
              color: COLORS.white,
            }}
          >
            Join now →
          </div>
        </FadeUp>

        <FadeUp delay={28} style={{ marginTop: 56 }}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 64,
              fontWeight: 700,
              color: COLORS.green,
              textShadow: `0 0 40px ${COLORS.greenGlow}`,
              letterSpacing: 2,
            }}
          >
            {BRAND.url}
          </div>
        </FadeUp>

        <FadeUp delay={38} style={{ marginTop: 18 }}>
          <div style={{ fontFamily: FONT, fontSize: 32, color: COLORS.faint, fontWeight: 500 }}>
            Daily USDC · No lock-up · Verifiable on-chain
          </div>
        </FadeUp>
      </BeatWrap>
    </>
  )
}
