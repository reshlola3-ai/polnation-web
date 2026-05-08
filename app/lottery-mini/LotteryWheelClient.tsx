'use client'

import { useEffect, useRef, type ComponentProps } from 'react'
import { LuckyWheel } from '@lucky-canvas/react'

type LuckyWheelProps = ComponentProps<typeof LuckyWheel>

type LuckyWheelHandle = {
  play: () => void
  stop: (index: number) => void
}

type WheelCommand = {
  nonce: number
  index: number
}

interface Props {
  width: string
  height: string
  blocks: NonNullable<LuckyWheelProps['blocks']>
  prizes: NonNullable<LuckyWheelProps['prizes']>
  buttons: NonNullable<LuckyWheelProps['buttons']>
  spinNonce: number
  stopCommand: WheelCommand | null
  onStart: () => void
  onEnd: () => void
}

export default function LotteryWheelClient({
  width,
  height,
  blocks,
  prizes,
  buttons,
  spinNonce,
  stopCommand,
  onStart,
  onEnd,
}: Props) {
  const wheelRef = useRef<LuckyWheelHandle | null>(null)

  useEffect(() => {
    if (spinNonce > 0) {
      wheelRef.current?.play()
    }
  }, [spinNonce])

  useEffect(() => {
    if (stopCommand) {
      wheelRef.current?.stop(stopCommand.index)
    }
  }, [stopCommand])

  return (
    <LuckyWheel
      ref={wheelRef}
      width={width}
      height={height}
      blocks={blocks}
      prizes={prizes}
      buttons={buttons}
      defaultConfig={{
        speed: 20,
        accelerationTime: 2500,
        decelerationTime: 4500,
      }}
      onStart={onStart}
      onEnd={onEnd}
    />
  )
}
