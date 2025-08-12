import { describe, expect, it } from 'vitest'
import '../__mocks__/foundry.js'
import DiceChain from '../dice-chain.js'

describe('DiceChain', () => {
  describe('calculateCritAdjustment', () => {
    it('calculates adjustment for die size increases', () => {
      expect(DiceChain.calculateCritAdjustment('1d20', '1d24')).toBe(4)
      expect(DiceChain.calculateCritAdjustment('1d20', '1d16')).toBe(-4)
      expect(DiceChain.calculateCritAdjustment('1d20', '1d20')).toBe(0)
    })

    it('handles complex formulas', () => {
      expect(DiceChain.calculateCritAdjustment('1d20+5', '1d24+5')).toBe(4)
      expect(DiceChain.calculateCritAdjustment('2d16+3', '2d20+3')).toBe(4)
    })

    it('returns 0 for invalid formulas', () => {
      expect(DiceChain.calculateCritAdjustment('invalid', '1d20')).toBe(0)
      expect(DiceChain.calculateCritAdjustment('1d20', 'invalid')).toBe(0)
    })
  })

  describe('calculateProportionalCritRange', () => {
    it('calculates proportional crit range for normal 20 crit', () => {
      // Normal d20: crit on 20 (1 number)
      // On d24: should crit on 24 (1 number)
      expect(DiceChain.calculateProportionalCritRange(20, 20, 24)).toBe(24)

      // On d16: should crit on 16 (1 number)
      expect(DiceChain.calculateProportionalCritRange(20, 20, 16)).toBe(16)
    })

    it('calculates proportional crit range for warrior 18-20 crit', () => {
      // Warrior d20: crit on 18-20 (3 numbers)
      // On d24: should crit on 22-24 (3 numbers)
      expect(DiceChain.calculateProportionalCritRange(18, 20, 24)).toBe(22)

      // On d16: should crit on 14-16 (3 numbers)
      expect(DiceChain.calculateProportionalCritRange(18, 20, 16)).toBe(14)
    })

    it('calculates proportional crit range for extended crit ranges', () => {
      // Hypothetical 16-20 crit range (5 numbers)
      // On d24: should crit on 20-24 (5 numbers)
      expect(DiceChain.calculateProportionalCritRange(16, 20, 24)).toBe(20)

      // On d30: should crit on 26-30 (5 numbers)
      expect(DiceChain.calculateProportionalCritRange(16, 20, 30)).toBe(26)
    })

    it('handles edge cases correctly', () => {
      // Crit on everything (crit range 1 = crit on 1-20, 20 numbers)
      // On d24: should crit on 1-24 (24 numbers), but constrained to 5-24 (20 numbers)
      expect(DiceChain.calculateProportionalCritRange(1, 20, 24)).toBe(5)

      // Only crit on max (same as normal)
      expect(DiceChain.calculateProportionalCritRange(20, 20, 20)).toBe(20)
    })
  })
})
