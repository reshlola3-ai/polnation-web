declare module '@lucky-canvas/react' {
  import { ComponentType, RefObject } from 'react'

  interface FontConfig {
    text: string
    top?: string
    fontSize?: string
    fontColor?: string
    fontWeight?: string
  }

  interface BlockConfig {
    padding?: string
    background?: string
  }

  interface PrizeConfig {
    fonts?: FontConfig[]
    background?: string
    range?: number
  }

  interface ButtonConfig {
    radius?: string
    background?: string
    pointer?: boolean
    fonts?: FontConfig[]
  }

  interface DefaultConfig {
    speed?: number
    accelerationTime?: number
    decelerationTime?: number
  }

  interface LuckyWheelProps {
    ref?: RefObject<any>
    width?: string
    height?: string
    blocks?: BlockConfig[]
    prizes?: PrizeConfig[]
    buttons?: ButtonConfig[]
    defaultConfig?: DefaultConfig
    onStart?: () => void
    onEnd?: (prize: any) => void
  }

  export const LuckyWheel: ComponentType<LuckyWheelProps>
  export const LuckyGrid: ComponentType<any>
  export const SlotMachine: ComponentType<any>
}
