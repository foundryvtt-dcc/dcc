import { expect, vi, describe, it, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'

// We need to test the internal DCCCompoundTerm function
// Import the module to test createRollFromTerms which uses DCCCompoundTerm internally
const RollModifierModule = await import('../roll-modifier.js')

describe('Roll Modifier - Compound Term Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createRollFromTerms with Compound terms', () => {
    it('should handle simple die formula', () => {
      const terms = [
        { type: 'Compound', formula: '1d6' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, {})

      expect(roll).toBeDefined()
      expect(roll.formula).toContain('1d6')
    })

    it('should handle die formula with modifier', () => {
      const terms = [
        { type: 'Compound', formula: '1d6+2' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, {})

      expect(roll).toBeDefined()
      expect(roll.formula).toContain('1d6')
      expect(roll.formula).toContain('2')
    })

    it('should handle die formula with flavor text like [fire]', () => {
      const terms = [
        { type: 'Compound', formula: '1d6[fire]' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, {})

      expect(roll).toBeDefined()
      expect(roll.formula).toContain('1d6')
      expect(roll.formula).toContain('[fire]')
    })

    it('should handle multiple dice with flavor text', () => {
      const terms = [
        { type: 'Compound', formula: '1d6 + 1d6[fire]' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, {})

      expect(roll).toBeDefined()
      // The formula should contain both dice, not duplicate the entire formula
      const formula = roll.formula
      // Count occurrences of 1d6 - should be exactly 2
      const matches = formula.match(/1d6/g) || []
      expect(matches.length).toBe(2)
    })

    it('should handle complex damage formula with multiple flavor texts', () => {
      const terms = [
        { type: 'Compound', formula: '1d8 + 1d6[fire] + 1d4[cold]' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, {})

      expect(roll).toBeDefined()
      expect(roll.formula).toContain('1d8')
      expect(roll.formula).toContain('1d6')
      expect(roll.formula).toContain('[fire]')
      expect(roll.formula).toContain('1d4')
      expect(roll.formula).toContain('[cold]')
    })

    it('should not duplicate formula when encountering flavor text', () => {
      // This is the specific bug that was fixed
      const terms = [
        { type: 'Compound', formula: '1d6 + 1d6[fire]' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, {})

      // The bug caused the entire formula to be added again when
      // a die with flavor text was encountered
      // The formula should NOT contain "1d6+1d6[fire]" repeated
      const formula = roll.formula.replace(/\s/g, '')

      // Should have exactly 2 d6 references, not 4
      const d6Matches = formula.match(/d6/g) || []
      expect(d6Matches.length).toBe(2)
    })

    it('should handle die with negative modifier and flavor', () => {
      const terms = [
        { type: 'Compound', formula: '2d6[slashing] - 1' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, {})

      expect(roll).toBeDefined()
      expect(roll.formula).toContain('2d6')
      expect(roll.formula).toContain('[slashing]')
    })

    it('should handle formula with variable reference and flavor', () => {
      const terms = [
        { type: 'Compound', formula: '@ab + 1d6[fire]' }
      ]
      const roll = RollModifierModule.createRollFromTerms(terms, { rollData: { ab: 3 } })

      expect(roll).toBeDefined()
      expect(roll.formula).toContain('1d6')
      expect(roll.formula).toContain('[fire]')
    })
  })
})
