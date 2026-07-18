import React from 'react'
import { useCurrentFrame, interpolate } from 'remotion'
import { COLORS } from '../theme'
import { Background, BeatWrap, FadeUp, Pill, FONT } from '../ui'

// 10–13s：质押拿更高日利率
export const Stake: React.FC = () => {
  const frame = useCurrentFrame()
  const rate = interpolate(frame, [24, 66], [1.1, 1.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const barW = interpolate(rate, [1.1, 1.5], [46, 100])
  return (
    <>
      <Background />
      <BeatWrap>
        <FadeUp delay={2}>
          <Pill>🚀 ALPHASTAKE</Pill>
        </FadeUp>

        <FadeUp delay={8} style={{ marginTop: 30, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT, fontSize: 92, fontWeight: 800, color: COLORS.white }}>
            Stake to <span style={{ color: COLORS.purpleLight }}>earn more</span>
          </div>
        </FadeUp>

        {/* 日利率上跳 */}
        <FadeUp delay={16} style={{ marginTop: 66, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT, fontSize: 32, color: COLORS.faint, letterSpacing: 3, fontWeight: 600 }}>DAILY RATE</div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 176,
              fontWeight: 800,
              color: COLORS.green,
              textShadow: `0 0 60px ${COLORS.greenGlow}`,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {rate.toFixed(1)}%
          </div>
        </FadeUp>

        {/* 进度条 */}
        <FadeUp delay={22} style={{ marginTop: 40, width: 760 }}>
          <div style={{ height: 26, borderRadius: 999, background: COLORS.panel, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${barW}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.green})`,
              }}
            />
          </div>
        </FadeUp>

        <FadeUp delay={40} style={{ marginTop: 44 }}>
          <div style={{ fontFamily: FONT, fontSize: 40, color: COLORS.dim, fontWeight: 500 }}>
            Higher daily rate on <span style={{ color: COLORS.white, fontWeight: 700 }}>AlphaStake</span>
          </div>
        </FadeUp>
      </BeatWrap>
    </>
  )
}
