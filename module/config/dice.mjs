// DCC dice config data.
//
// Extracted from `module/config.js` (Phase 7 — Appendix-A config.js
// shrinkage arc). Three dice-related tables: the dice-fulfillment
// label/icon map (`diceTypes`, wired into `CONFIG.Dice.fulfillment.dice` by
// `module/dcc.js`), the DCC dice-chain progression array (`DICE_CHAIN`, read
// by `module/dice-chain.js`), and the custom Active-Effect change type
// (`effectChangeTypes`, read by `module/active-effect.js`). All are consumed
// via the `DCC.*` config object onto which `config.js` re-composes them, so
// the public `CONFIG.DCC` shape is unchanged. Pure data — no behavior here.

/**
 * Dice label + icon map for the dice-configuration / fulfillment dialog.
 * Non-standard DCC dice (d3/d5/d7/d14/d16/d24/d30) use SVG art; standard
 * dice use FontAwesome glyphs.
 * @type {Object}
 */
export const diceTypes = {
  d2: { label: 'd2', icon: '<i class="fas fa-dice-two"></i>' },
  d3: {
    label: 'd3',
    icon: '<img src="systems/dcc/styles/images/dice/d3black.svg" height="14" width="14" style="border: none; vertical-align: middle">'
  },
  d4: { label: 'd4', icon: '<i class="fas fa-dice-d4"></i>' },
  d5: {
    label: 'd5',
    icon: '<img src="systems/dcc/styles/images/dice/d5black.svg" height="14" width="14" style="border: none; vertical-align: middle">'
  },
  d6: { label: 'd6', icon: '<i class="fas fa-dice-d6"></i>' },
  d7: {
    label: 'd7',
    icon: '<img src="systems/dcc/styles/images/dice/d7black.svg" height="14" width="14" style="border: none; vertical-align: middle">'
  },
  d8: { label: 'd8', icon: '<i class="fas fa-dice-d8"></i>' },
  d10: { label: 'd10', icon: '<i class="fas fa-dice-d10"></i>' },
  d12: { label: 'd12', icon: '<i class="fas fa-dice-d12"></i>' },
  d14: {
    label: 'd14',
    icon: '<img src="systems/dcc/styles/images/dice/d14black.svg" height="14" width="14" style="border: none; vertical-align: middle">'
  },
  d16: {
    label: 'd16',
    icon: '<img src="systems/dcc/styles/images/dice/d16black.svg" height="14" width="14" style="border: none; vertical-align: middle">'
  },
  d20: { label: 'd20', icon: '<i class="fas fa-dice-d20"></i>' },
  d24: {
    label: 'd24',
    icon: '<img src="systems/dcc/styles/images/dice/d24black.svg" height="14" width="14" style="border: none; vertical-align: middle">'
  },
  d30: {
    label: 'd30',
    icon: '<img src="systems/dcc/styles/images/dice/d30black.svg" height="14" width="14" style="border: none; vertical-align: middle">'
  },
  d100: { label: 'd100', icon: '<i class="fas fa-percent"></i>' }
}

/**
 * The DCC dice chain — the ordered progression of die sizes used for
 * dice-chain step-up / step-down (`module/dice-chain.js`).
 * @type {number[]}
 */
export const DICE_CHAIN = [
  3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30
]

/**
 * Custom Active-Effect change types beyond the standard Foundry types. The
 * `DICE_CHAIN` type ('diceChain') drives dice-chain-aware effect application
 * in `module/active-effect.js`.
 * @type {Object}
 */
export const effectChangeTypes = {
  DICE_CHAIN: 'diceChain'
}
