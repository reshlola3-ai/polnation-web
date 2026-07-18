import React from 'react'
import { useCurrentFrame, interpolate } from 'remotion'
import { COLORS } from '../theme'
import { Background, BeatWrap, FadeUp, Pill, FONT } from '../ui'

// 3–7s：Alpha Trading bots 24/7 + 可核对交易（信任点）
const TRADES = [
  { hash: '0x035cf4…f096ef', pnl: '+$512.40' },
  { hash: '0x8a1b90…2c7d11', pnl: '+$338.90' },
  { hash: '0xf2fe51…ccfa02', pnl: '+$1,204.00' },
]

export const Bots: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <>
      <Background />
      <BeatWrap>
        <FadeUp delay={2}>
          <Pill>⚡ 24/7 · ALPHA TRADING</Pill>
        </FadeUp>

        <FadeUp delay={8} style={{ marginTop: 34, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT, fontSize: 84, fontWeight: 800, color: COLORS.white, lineHeight: 1.05 }}>
            Alpha Trading bots
            <br />
            run <span style={{ color: COLORS.purpleLight }}>24/7</span>
          </div>
        </FadeUp>

        {/* 可核对交易卡 —— 每笔真实上链、可查 */}
        <FadeUp delay={20} style={{ marginTop: 54, width: 900 }}>
          <div
            style={{
              borderRadius: 30,
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '20px 30px',
                borderBottom: `1px solid ${COLORS.border}`,
                color: COLORS.green,
                fontFamily: FONT,
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              ✓ Every trade verifiable on-chain
            </div>
            {TRADES.map((t, i) => {
              const appear = interpolate(frame, [26 + i * 10, 36 + i * 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
              return (
                <div
                  key={t.hash}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '22px 30px',
                    opacity: appear,
                    transform: `translateX(${interpolate(appear, [0, 1], [30, 0])}px)`,
                    borderTop: i === 0 ? 'none' : `1px solid rgba(255,255,255,0.05)`,
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: 34, color: COLORS.dim, letterSpacing: 0.5 }}>
                    🔗 {t.hash}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 36, color: COLORS.green, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {t.pnl}
                  </span>
                </div>
              )
            })}
          </div>
        </FadeUp>

        <FadeUp delay={40} style={{ marginTop: 44, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT, fontSize: 36, color: COLORS.dim, fontWeight: 500 }}>
            Merkle-Tree quant model → <span style={{ color: COLORS.white, fontWeight: 700 }}>real on-chain yield</span>
          </div>
        </FadeUp>
      </BeatWrap>
    </>
  )
}
