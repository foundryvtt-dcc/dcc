/* Tests for the extracted dice config data
 * (Phase 7 — Appendix-A config.js shrinkage arc).
 *
 * Guards the contract that matters after the extraction:
 *  1. the extracted module exports the three dice tables with known values;
 *  2. config.js re-composes the SAME object references onto DCC, so the
 *     public CONFIG.DCC shape is unchanged and the consumers keep working
 *     (dcc.js CONFIG.Dice.fulfillment.dice, dice-chain.js, active-effect.js).
 */

import { expect, describe, it } from 'vitest'
import DCC from '../config.js'
import {
  diceTypes,
  DICE_CHAIN,
  effectChangeTypes
} from '../config/dice.mjs'

describe('config/dice.mjs', () => {
  describe('extracted table values', () => {
    it('diceTypes covers the DCC die set with label + icon', () => {
      expect(Object.keys(diceTypes)).toHaveLength(15)
      // Standard die → FontAwesome glyph.
      expect(diceTypes.d20).toEqual({ label: 'd20', icon: '<i class="fas fa-dice-d20"></i>' })
      // Non-standard DCC die → SVG art.
      expect(diceTypes.d3.label).toBe('d3')
      expect(diceTypes.d3.icon).toContain('d3black.svg')
      expect(diceTypes.d30.icon).toContain('d30black.svg')
      // Every entry has both a label and an icon.
      for (const entry of Object.values(diceTypes)) {
        expect(typeof entry.label).toBe('string')
        expect(typeof entry.icon).toBe('string')
        expect(entry.icon.length).toBeGreaterThan(0)
      }
    })

    it('DICE_CHAIN is the ordered DCC die progression', () => {
      expect(DICE_CHAIN).toEqual([3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30])
      // Strictly ascending (the dice-chain step logic relies on order).
      for (let i = 1; i < DICE_CHAIN.length; i++) {
        expect(DICE_CHAIN[i]).toBeGreaterThan(DICE_CHAIN[i - 1])
      }
    })

    it('effectChangeTypes exposes the diceChain custom AE change type', () => {
      expect(effectChangeTypes).toEqual({ DICE_CHAIN: 'diceChain' })
    })
  })

  describe('config.js composition', () => {
    it('re-composes the SAME object references onto DCC (shape unchanged)', () => {
      expect(DCC.diceTypes).toBe(diceTypes)
      expect(DCC.DICE_CHAIN).toBe(DICE_CHAIN)
      expect(DCC.effectChangeTypes).toBe(effectChangeTypes)
    })
  })
})
