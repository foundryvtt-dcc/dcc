import { describe, test, expect } from 'vitest'
/**
 * Tests for TypeDataModel logic - pure functions that don't depend on Foundry's actual behavior
 *
 * Note: migrateData tests require the full Foundry mock environment which is complex to set up.
 * The real validation happens in Playwright E2E tests against a live Foundry instance.
 */

// Import pure utility function directly (no Foundry dependency)
import { isValidDiceNotation } from '../data/fields/dice-utils.mjs'

describe('isValidDiceNotation', () => {
  describe('valid dice notation', () => {
    test.each([
      ['1d20', 'standard dice'],
      ['d20', 'dice without count'],
      ['2d6', 'multiple dice'],
      ['1d4+1', 'dice with positive modifier'],
      ['2d6-2', 'dice with negative modifier'],
      ['1d20+1d4', 'compound dice'],
      ['1d20+1d4+2', 'compound dice with modifier'],
      ['3d6+1d4-1', 'complex compound'],
      ['1d3', 'small dice'],
      ['1d30', 'large dice'],
      ['10d10', 'many dice'],
      ['1D20', 'uppercase D'],
      ['2D6+2', 'uppercase with modifier']
    ])('%s (%s)', (input) => {
      expect(isValidDiceNotation(input)).toBe(true)
    })
  })

  describe('invalid dice notation', () => {
    test.each([
      ['', 'empty string'],
      [null, 'null'],
      [undefined, 'undefined'],
      ['0', 'just zero'],
      ['abc', 'random text'],
      ['1d', 'incomplete dice'],
      ['d', 'just d'],
      ['++1d20', 'double plus prefix'],
      ['1d20++1', 'double plus modifier'],
      ['1d20+', 'trailing plus'],
      ['+1d20', 'leading plus without dice'],
      ['1d20+abc', 'text modifier'],
      ['twenty', 'word'],
      ['1d20 + 2', 'spaces in notation'],
      ['-', 'just dash'],
      ['1d-20', 'negative die size']
    ])('%s (%s)', (input) => {
      expect(isValidDiceNotation(input)).toBe(false)
    })
  })

  describe('performance - no catastrophic backtracking', () => {
    test('handles pathological input quickly', () => {
      const start = Date.now()
      // This would cause exponential backtracking with the old regex
      const pathological = '1d201d201d201d201d201d20xxxxxxx'
      isValidDiceNotation(pathological)
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(100) // Should complete in under 100ms
    })

    test('handles long invalid string quickly', () => {
      const start = Date.now()
      const longInvalid = 'd'.repeat(100) + '!'
      isValidDiceNotation(longInvalid)
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(100)
    })
  })
})
