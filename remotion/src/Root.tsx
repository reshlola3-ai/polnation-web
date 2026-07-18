import React from 'react'
import { Composition } from 'remotion'
import { PromoVideo } from './PromoVideo'
import { DURATION, FPS } from './theme'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PolnationPromo"
      component={PromoVideo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  )
}
