import React from 'react'
import { Img, staticFile, interpolate, useCurrentFrame } from 'remotion'
import { COLORS, BRAND } from '../theme'
import { Background, BeatWrap, FadeUp, FONT, cx } from '../ui'

// 0–3s：品牌浮现 + 每日到账余额跳动
export const Hero: React.FC = () => {
  const frame = useCurrentFrame()
  const target = 12.9
  const value = interpolate(frame, [22, 70], [0, target], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <>
      <Background />
      <BeatWrap>
        <FadeUp delay={2}>
          <Img src={staticFile('logo.svg')} style={{ width: 150, height: 150, marginBottom: 26 }} />
        </FadeUp>

        <FadeUp delay={8}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 118,
              letterSpacing: 4,
              background: `linear-gradient(100deg, ${COLORS.white}, ${COLORS.purpleLight})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {BRAND.name}
          </div>
        </FadeUp>

        <FadeUp delay={16} style={{ marginTop: 6 }}>
          <div style={{ fontFamily: FONT, fontSize: 38, color: COLORS.dim, fontWeight: 500 }}>{BRAND.tagline}</div>
        </FadeUp>

        {/* 余额卡 */}
        <FadeUp delay={26} style={{ marginTop: 70 }}>
          <div
            style={{
              padding: '38px 56px',
              borderRadius: 34,
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              boxShadow: `0 0 90px ${COLORS.greenGlow}`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: FONT, fontSize: 30, color: COLORS.faint, letterSpacing: 3, fontWeight: 600 }}>
              TODAY&apos;S EARNINGS
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 128,
                fontWeight: 800,
                color: COLORS.green,
                textShadow: `0 0 50px ${COLORS.greenGlow}`,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 6,
              }}
            >
              +${cx(value)}
            </div>
          </div>
        </FadeUp>
      </BeatWrap>
    </>
  )
}
