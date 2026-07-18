import React from 'react'
import { useCurrentFrame, spring, interpolate, useVideoConfig } from 'remotion'
import { COLORS } from '../theme'
import { Background, BeatWrap, FadeUp, Pill, FONT } from '../ui'

const Node: React.FC<{ x: number; y: number; size: number; delay: number; label?: string; color?: string }> = ({
  x,
  y,
  size,
  delay,
  label,
  color = COLORS.purple,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } })
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${color}, ${COLORS.bg2})`,
        border: `2px solid ${COLORS.border}`,
        boxShadow: `0 0 40px ${COLORS.purpleGlow}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${s})`,
        opacity: s,
        fontSize: size * 0.42,
      }}
    >
      👤
      {label && (
        <div
          style={{
            position: 'absolute',
            top: -46,
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.green,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

// 13–16.5s：拉团队一起赚（裂变 + 佣金）
export const Team: React.FC = () => {
  const frame = useCurrentFrame()
  const cx = 540
  const rootY = 720
  const childY = 980
  const children = [
    { x: 180, label: '+10%' },
    { x: 380, label: '+5%' },
    { x: 700, label: '+5%' },
    { x: 900, label: '+10%' },
  ]
  return (
    <>
      <Background />
      <BeatWrap>
        <FadeUp delay={2}>
          <Pill color={COLORS.green}>👥 TEAM REWARDS</Pill>
        </FadeUp>
        <FadeUp delay={8} style={{ marginTop: 30, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT, fontSize: 84, fontWeight: 800, color: COLORS.white, lineHeight: 1.06 }}>
            Grow your team.
            <br />
            <span style={{ color: COLORS.green, textShadow: `0 0 40px ${COLORS.greenGlow}` }}>Earn together.</span>
          </div>
        </FadeUp>

        {/* 裂变图（绝对定位画布） */}
        <div style={{ position: 'absolute', inset: 0 }}>
          {children.map((c, i) => {
            const s = interpolate(frame, [26 + i * 4, 40 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return (
              <svg key={i} style={{ position: 'absolute', inset: 0 }} width={1080} height={1920}>
                <line
                  x1={cx}
                  y1={rootY}
                  x2={c.x}
                  y2={childY}
                  stroke={COLORS.purpleLight}
                  strokeWidth={3}
                  strokeOpacity={0.5 * s}
                  strokeDasharray="6 8"
                />
              </svg>
            )
          })}
          <Node x={cx} y={rootY} size={130} delay={20} color={COLORS.purple} />
          {children.map((c, i) => (
            <Node key={i} x={c.x} y={childY} size={92} delay={30 + i * 4} label={c.label} color={COLORS.purpleHover} />
          ))}
        </div>

        <div style={{ position: 'absolute', bottom: 140, width: '100%', textAlign: 'center' }}>
          <FadeUp delay={54}>
            <div style={{ fontFamily: FONT, fontSize: 40, color: COLORS.dim, fontWeight: 500 }}>
              Referral commission up to <span style={{ color: COLORS.white, fontWeight: 700 }}>6 levels deep</span>
            </div>
          </FadeUp>
        </div>
      </BeatWrap>
    </>
  )
}
