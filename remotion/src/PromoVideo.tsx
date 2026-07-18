import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { BEATS, COLORS } from './theme'
import { Hero } from './beats/Hero'
import { Bots } from './beats/Bots'
import { NoLock } from './beats/NoLock'
import { Stake } from './beats/Stake'
import { Team } from './beats/Team'
import { Cta } from './beats/Cta'

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Sequence from={BEATS.hero.from} durationInFrames={BEATS.hero.durationInFrames}>
        <Hero />
      </Sequence>
      <Sequence from={BEATS.bots.from} durationInFrames={BEATS.bots.durationInFrames}>
        <Bots />
      </Sequence>
      <Sequence from={BEATS.noLock.from} durationInFrames={BEATS.noLock.durationInFrames}>
        <NoLock />
      </Sequence>
      <Sequence from={BEATS.stake.from} durationInFrames={BEATS.stake.durationInFrames}>
        <Stake />
      </Sequence>
      <Sequence from={BEATS.team.from} durationInFrames={BEATS.team.durationInFrames}>
        <Team />
      </Sequence>
      <Sequence from={BEATS.cta.from} durationInFrames={BEATS.cta.durationInFrames}>
        <Cta />
      </Sequence>

      {/* 若要加 BGM：把 music.mp3 放进 remotion/public/，取消下面注释
      <Audio src={staticFile('music.mp3')} />
      （记得在文件顶部 import { Audio, staticFile } from 'remotion'） */}
    </AbsoluteFill>
  )
}
