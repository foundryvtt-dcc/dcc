/* global Roll, CONFIG, foundry */
/**
 * Integration tests for the REAL Foundry VTT dice engine
 *
 * These tests use actual Foundry Roll, Die, RollParser, and MersenneTwister
 * classes to verify that dice evaluation works correctly.
 */
import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// =============================================================================
// Skip if dice engine is not available
// =============================================================================

const hasDiceEngine = typeof Roll !== 'undefined' && Roll?.parse

// Fail loudly if dice files exist but engine didn't load (catches broken setup)
const dicePath = path.join(import.meta.dirname, '..', '..', '.foundry-dev', 'client', 'dice')
if (fs.existsSync(dicePath) && !hasDiceEngine) {
  throw new Error(
    'Dice engine files exist in .foundry-dev/client/dice/ but Roll is not available. ' +
    'setup-dice.js likely failed during import. Check setup logs above.'
  )
}

const describeIfDice = hasDiceEngine ? describe : describe.skip

// =============================================================================
// Basic Evaluation
// =============================================================================

describeIfDice('Basic Dice Evaluation (real Foundry dice)', () => {
  test('1d20 produces integer in [1, 20]', async () => {
    for (let i = 0; i < 50; i++) {
      const roll = new Roll('1d20')
      await roll.evaluate()
      expect(roll.total).toBeGreaterThanOrEqual(1)
      expect(roll.total).toBeLessThanOrEqual(20)
      expect(Number.isInteger(roll.total)).toBe(true)
    }
  })

  test('2d6+3 produces integer in [5, 15]', async () => {
    for (let i = 0; i < 50; i++) {
      const roll = new Roll('2d6+3')
      await roll.evaluate()
      expect(roll.total).toBeGreaterThanOrEqual(5)
      expect(roll.total).toBeLessThanOrEqual(15)
      expect(Number.isInteger(roll.total)).toBe(true)
    }
  })

  test('1d4+1d8 produces integer in [2, 12]', async () => {
    for (let i = 0; i < 50; i++) {
      const roll = new Roll('1d4+1d8')
      await roll.evaluate()
      expect(roll.total).toBeGreaterThanOrEqual(2)
      expect(roll.total).toBeLessThanOrEqual(12)
      expect(Number.isInteger(roll.total)).toBe(true)
    }
  })

  test('evaluate() returns the Roll instance with numeric total', async () => {
    const roll = new Roll('1d20+5')
    const result = await roll.evaluate()
    expect(result).toBe(roll)
    expect(typeof roll.total).toBe('number')
    expect(Number.isFinite(roll.total)).toBe(true)
  })

  test('evaluate() throws if called more than once', async () => {
    const roll = new Roll('1d20')
    await roll.evaluate()
    await expect(roll.evaluate()).rejects.toThrow(/already been evaluated/)
  })

  test('evaluateSync({maximize: true}) returns max possible value', () => {
    const roll = new Roll('2d6+3')
    roll.evaluateSync({ maximize: true })
    expect(roll.total).toBe(15) // 6+6+3
  })

  test('evaluateSync({minimize: true}) returns min possible value', () => {
    const roll = new Roll('2d6+3')
    roll.evaluateSync({ minimize: true })
    expect(roll.total).toBe(5) // 1+1+3
  })
})

// =============================================================================
// DCC-Specific Dice
// =============================================================================

describeIfDice('DCC-Specific Dice (non-standard die sizes)', () => {
  const dccDice = [
    { faces: 3, formula: '1d3' },
    { faces: 5, formula: '1d5' },
    { faces: 7, formula: '1d7' },
    { faces: 14, formula: '1d14' },
    { faces: 16, formula: '1d16' },
    { faces: 24, formula: '1d24' },
    { faces: 30, formula: '1d30' }
  ]

  for (const { faces, formula } of dccDice) {
    test(`${formula} produces values in [1, ${faces}]`, async () => {
      for (let i = 0; i < 30; i++) {
        const roll = new Roll(formula)
        await roll.evaluate()
        expect(roll.total).toBeGreaterThanOrEqual(1)
        expect(roll.total).toBeLessThanOrEqual(faces)
        expect(Number.isInteger(roll.total)).toBe(true)
      }
    })
  }
})

// =============================================================================
// Formula Parsing
// =============================================================================

describeIfDice('Formula Parsing (real RollParser)', () => {
  test('1d20 parses to a single Die term', () => {
    const roll = new Roll('1d20')
    const diceTerms = roll.terms.filter(t => t instanceof foundry.dice.terms.Die)
    expect(diceTerms).toHaveLength(1)
    expect(diceTerms[0].faces).toBe(20)
    expect(diceTerms[0].number).toBe(1)
  })

  test('2d6+3 parses to Die, OperatorTerm, NumericTerm', () => {
    const roll = new Roll('2d6+3')
    expect(roll.terms).toHaveLength(3)

    const die = roll.terms[0]
    expect(die).toBeInstanceOf(foundry.dice.terms.Die)
    expect(die.faces).toBe(6)
    expect(die.number).toBe(2)

    expect(roll.terms[1]).toBeInstanceOf(foundry.dice.terms.OperatorTerm)
    expect(roll.terms[2]).toBeInstanceOf(foundry.dice.terms.NumericTerm)
    expect(roll.terms[2].number).toBe(3)
  })

  test('complex formula 1d20+1d4+5 has correct terms', () => {
    const roll = new Roll('1d20+1d4+5')
    expect(roll.terms).toHaveLength(5)
    expect(roll.terms[0]).toBeInstanceOf(foundry.dice.terms.Die)
    expect(roll.terms[0].faces).toBe(20)
    expect(roll.terms[2]).toBeInstanceOf(foundry.dice.terms.Die)
    expect(roll.terms[2].faces).toBe(4)
    expect(roll.terms[4]).toBeInstanceOf(foundry.dice.terms.NumericTerm)
    expect(roll.terms[4].number).toBe(5)
  })
})

// =============================================================================
// Variable Substitution
// =============================================================================

describeIfDice('Variable Substitution (real Roll data handling)', () => {
  test('new Roll("1d20+@mod", {mod: 5}) correctly substitutes', async () => {
    const roll = new Roll('1d20+@mod', { mod: 5 })
    await roll.evaluate()
    // The formula should contain 5 now
    expect(roll.formula).toContain('5')
    // Total should be at least 6 (1+5) and at most 25 (20+5)
    expect(roll.total).toBeGreaterThanOrEqual(6)
    expect(roll.total).toBeLessThanOrEqual(25)
  })

  test('@nested.value path traversal works', async () => {
    const roll = new Roll('1d20+@abilities.str.mod', { abilities: { str: { mod: 3 } } })
    await roll.evaluate()
    expect(roll.formula).toContain('3')
    expect(roll.total).toBeGreaterThanOrEqual(4)
    expect(roll.total).toBeLessThanOrEqual(23)
  })

  test('missing data resolves to "0"', async () => {
    const roll = new Roll('1d20+@missing', {})
    await roll.evaluate()
    // Missing data resolves to "0" by default
    expect(roll.total).toBeGreaterThanOrEqual(1)
    expect(roll.total).toBeLessThanOrEqual(20)
  })
})

// =============================================================================
// Roll.validate
// =============================================================================

describeIfDice('Roll.validate (real validation)', () => {
  test('valid formulas pass validation', () => {
    expect(Roll.validate('1d20')).toBe(true)
    expect(Roll.validate('2d6+3')).toBe(true)
    expect(Roll.validate('1d20+@mod')).toBe(true)
    expect(Roll.validate('4d6kh3')).toBe(true)
  })

  test('empty string fails validation', () => {
    expect(Roll.validate('')).toBe(false)
  })

  test('non-formula text fails validation', () => {
    expect(Roll.validate('not a formula')).toBe(false)
  })
})

// =============================================================================
// Seeded Determinism
// =============================================================================

describeIfDice('Seeded Determinism (MersenneTwister)', () => {
  test('same seed produces identical sequence of roll results', async () => {
    const MersenneTwister = foundry.dice.MersenneTwister
    const originalRandom = CONFIG.Dice.randomUniform

    try {
      // First run with seed 12345
      const twister1 = new MersenneTwister(12345)
      CONFIG.Dice.randomUniform = () => twister1.random()

      const results1 = []
      for (let i = 0; i < 20; i++) {
        const roll = new Roll('1d20')
        await roll.evaluate()
        results1.push(roll.total)
      }

      // Second run with same seed
      const twister2 = new MersenneTwister(12345)
      CONFIG.Dice.randomUniform = () => twister2.random()

      const results2 = []
      for (let i = 0; i < 20; i++) {
        const roll = new Roll('1d20')
        await roll.evaluate()
        results2.push(roll.total)
      }

      // Both sequences must be identical
      expect(results1).toEqual(results2)
      // Verify we got actual variance (not all the same)
      const unique = new Set(results1)
      expect(unique.size).toBeGreaterThan(1)
    } finally {
      CONFIG.Dice.randomUniform = originalRandom
    }
  })
})
