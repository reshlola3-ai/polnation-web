import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
// 竖屏推广片，H.264 高质量
Config.setCodec('h264')
Config.setCrf(18)
