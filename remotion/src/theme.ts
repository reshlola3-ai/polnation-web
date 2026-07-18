// Polnation 品牌令牌（取自 app/globals.css 与 layout 元数据）
export const COLORS = {
  purple: '#670de5',
  purpleHover: '#721fe5',
  purpleLight: '#A855F7',
  purpleGlow: 'rgba(103,13,229,0.55)',
  green: '#00e28a',
  greenGlow: 'rgba(0,226,138,0.45)',
  bg: '#07060d',
  bg2: '#0d0b17',
  white: '#ffffff',
  dim: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.28)',
  panel: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.10)',
}

export const BRAND = {
  name: 'POLNATION',
  tagline: 'Agentic AI Earning on Polygon',
  url: 'polnation.com',
}

// 20s @ 30fps = 600 帧；各镜头起止（帧）
export const FPS = 30
export const DURATION = 600
export const BEATS = {
  hero: { from: 0, durationInFrames: 90 },        // 0.0 – 3.0s
  bots: { from: 90, durationInFrames: 120 },       // 3.0 – 7.0s（含 verifiable）
  noLock: { from: 210, durationInFrames: 90 },     // 7.0 – 10.0s
  stake: { from: 300, durationInFrames: 90 },      // 10.0 – 13.0s
  team: { from: 390, durationInFrames: 105 },      // 13.0 – 16.5s
  cta: { from: 495, durationInFrames: 105 },       // 16.5 – 20.0s
}
