export { detectPreCex }        from './pre-cex'
export { detectBridgeBuy }     from './bridge-buy'
export { detectLpPosition }    from './lp-position'
export { detectStableRotation } from './stable-rotation'
export { detectConvergence }   from './convergence'
export { detectDcaDump }       from './dca-dump'
export { detectPreGovernance } from './pre-governance'

import type { PatternId } from '../types'

export const PATTERN_META: Record<PatternId, { emoji: string; name: string; strengthScore: number }> = {
  pre_cex:        { emoji: '🎯', name: 'Pre-CEX Accumulation',    strengthScore: 22 },
  bridge_buy:     { emoji: '🌉', name: 'Bridge-then-Buy',          strengthScore: 20 },
  lp_position:    { emoji: '💧', name: 'LP Positioning',           strengthScore: 16 },
  stable_rotation:{ emoji: '🔄', name: 'Stable → Token Rotation',  strengthScore: 19 },
  convergence:    { emoji: '⚡', name: 'Convergence',               strengthScore: 25 },
  dca_dump:       { emoji: '🩸', name: 'Smart DCA on Dump',         strengthScore: 18 },
  pre_gov:        { emoji: '🗳️', name: 'Pre-Governance Accum.',     strengthScore: 15 },
}
