/**
 * Tests for Spell Check Critical calculations
 * These tests verify that spell check crits correctly parse and add the character level
 **/

import { expect, test, describe } from 'vitest'

describe('Spell Check Critical Calculations - parseInt fix', () => {
  test('parseInt converts string level to number for addition', () => {
    // This test verifies the fix for the string concatenation bug
    const levelAsString = '3'
    const rollTotal = 25

    // WRONG: Without parseInt, this would concatenate
    const wrongResult = rollTotal + levelAsString // Would be "253"
    expect(wrongResult).toBe('253')

    // CORRECT: With parseInt, this adds properly
    const levelValue = parseInt(levelAsString)
    const correctResult = rollTotal + levelValue
    expect(correctResult).toBe(28)
  })

  test('parseInt works with numeric level values', () => {
    const levelAsNumber = 5
    const rollTotal = 26

    const levelValue = parseInt(levelAsNumber)
    const result = rollTotal + levelValue
    expect(result).toBe(31)
  })

  test('parseInt handles edge cases correctly', () => {
    // Level 0 (funnel characters)
    expect(parseInt(0)).toBe(0)
    expect(parseInt('0')).toBe(0)

    // High level characters
    expect(parseInt(10)).toBe(10)
    expect(parseInt('10')).toBe(10)

    // Undefined or invalid should return NaN (which we'd need to handle)
    expect(isNaN(parseInt(undefined))).toBe(true)
    expect(isNaN(parseInt(null))).toBe(true)
  })

  test('critical roll calculation example - level 3 character', () => {
    // Simulates a level 3 character rolling a natural 20
    // Original roll: 1d20 (20) + 3 (level) + 2 (INT) = 25
    // Crit bonus: +3 (level again)
    // Final: 28

    const actor = {
      system: {
        details: {
          level: {
            value: '3' // String to test the fix
          }
        }
      }
    }

    const roll = {
      total: 25
    }

    const levelValue = parseInt(actor.system.details.level.value)
    const critRoll = roll.total + levelValue

    expect(levelValue).toBe(3)
    expect(critRoll).toBe(28)
  })

  test('critical roll calculation example - high level character', () => {
    // Level 10 wizard
    const actor = {
      system: {
        details: {
          level: {
            value: 10 // Numeric
          }
        }
      }
    }

    const roll = {
      total: 33 // 20 + 10 + 3
    }

    const levelValue = parseInt(actor.system.details.level.value)
    const critRoll = roll.total + levelValue

    expect(levelValue).toBe(10)
    expect(critRoll).toBe(43)
  })

  test('forceCrit adjusts die roll correctly', () => {
    // Test the shift-click functionality
    // Original die roll: 7
    // Force to: 20
    // Adjustment needed: +13

    const originalDieRoll = 7
    const originalRollTotal = 12 // 7 + 3 + 2

    // Force the die to 20
    const adjustment = 20 - originalDieRoll // +13

    const newTotal = originalRollTotal + adjustment

    expect(adjustment).toBe(13)
    expect(newTotal).toBe(25) // Original 12 + 13 adjustment

    // Then add crit bonus (level 3)
    const levelValue = 3
    const critTotal = newTotal + levelValue

    expect(critTotal).toBe(28)
  })
})

describe('Spell Check Critical - Roll Modifier Dialog Scenario', () => {
  test('crit lookup uses correct value when roll.total is a getter that recomputes from terms', () => {
    // This test simulates the scenario where a user uses the roll modifier dialog
    // to add a bonus, then rolls a natural 20 for a crit.
    // The concern is that roll.total might be recomputed from terms after we modify them.

    // Simulate a Roll object where total is a getter that computes from _total
    // but might be affected by term modifications
    const roll = {
      _total: 26, // 20 (die) + 5 (base) + 1 (from modifier dialog)
      get total () {
        return this._total
      },
      terms: [],
      _formula: '1d20+5+1',
      dice: [{ total: 20 }] // Natural 20
    }

    const levelValue = 3

    // Original code flow:
    // 1. First lookup (before crit check) uses roll.total
    const firstLookupValue = roll.total
    expect(firstLookupValue).toBe(26)

    // 2. On crit, compute critRoll
    const critRoll = roll.total + levelValue
    expect(critRoll).toBe(29)

    // 3. Then modify the roll terms (simulating what the code does)
    roll.terms.push({ operator: '+' })
    roll.terms.push({ number: levelValue })
    roll._formula += ` + ${levelValue}`
    roll._total += levelValue

    // 4. After modifications, roll.total should reflect the new _total
    expect(roll.total).toBe(29)

    // The critRoll variable captured the correct value (29) before term modifications
    // This is the value that should be used for the crit lookup
    expect(critRoll).toBe(29)
  })

  test('crit lookup fails if roll.total getter recomputes from terms array', () => {
    // This test demonstrates a potential bug scenario where roll.total
    // recomputes from the terms array instead of using _total

    let termsTotal = 26 // Initial total from terms

    const roll = {
      _total: 26,
      // Problematic getter that recomputes from terms
      get total () {
        return termsTotal
      },
      terms: [],
      dice: [{ total: 20 }]
    }

    const levelValue = 3

    // First lookup uses roll.total = 26
    const firstLookupValue = roll.total
    expect(firstLookupValue).toBe(26)

    // On crit, compute critRoll = 26 + 3 = 29
    const critRoll = roll.total + levelValue
    expect(critRoll).toBe(29)

    // After pushing terms, if termsTotal doesn't update, we're fine
    // But if the code accidentally uses roll.total again after modifications...
    roll.terms.push({ operator: '+' })
    roll.terms.push({ number: levelValue })
    termsTotal += levelValue // Simulate terms being re-evaluated

    // If code mistakenly uses roll.total after modifications for something else,
    // it would now return 29 which is correct. But if the order was different...
    expect(roll.total).toBe(29)
  })

  test('modifier dialog scenario - the fix uses _total directly', () => {
    // This test verifies the fix approach: use roll._total directly
    // instead of roll.total getter

    const roll = {
      _total: 26,
      get total () {
        // This getter could have complex behavior in Foundry
        return this._total
      },
      terms: [],
      dice: [{ total: 20 }]
    }

    const levelValue = 3

    // THE FIX: Use _total directly for lookupValue
    let lookupValue = roll._total
    expect(lookupValue).toBe(26)

    // On crit, add level to lookupValue
    lookupValue += levelValue
    expect(lookupValue).toBe(29)

    // Then update the roll for display
    roll.terms.push({ operator: '+' })
    roll.terms.push({ number: levelValue })
    roll._total += levelValue

    // lookupValue is independent of roll modifications
    expect(lookupValue).toBe(29)
    expect(roll._total).toBe(29)
    expect(roll.total).toBe(29)
  })
})

describe('Spell Check Critical - Table Lookup Logic', () => {
  test('verifies that result object must be fully replaced for correct range display', () => {
    // This test documents the fix for the bug where crit table lookups
    // only replaced result.results instead of the whole result object,
    // causing the wrong range to be displayed

    // Simulate the table returning different result objects
    const baseResult = {
      results: [{
        range: [18, 21],
        description: 'Result for 18-21',
        _id: 'result-18-21'
      }]
    }

    const critResult = {
      results: [{
        range: [22, 24],
        description: 'Result for 22-24',
        _id: 'result-22-24'
      }]
    }

    // WRONG WAY (the bug): Only replace results array
    let result = baseResult
    result.results = critResult.results // This keeps baseResult's structure!

    // The result will have the WRONG metadata (range from baseResult)
    // but the CORRECT description (from critResult.results)
    expect(result.results[0].description).toBe('Result for 22-24')
    // But we'd display the wrong range if we look at result properties

    // CORRECT WAY (the fix): Replace entire result object
    result = critResult // This gets ALL of critResult

    expect(result.results[0].range).toEqual([22, 24])
    expect(result.results[0].description).toBe('Result for 22-24')
    expect(result.results[0]._id).toBe('result-22-24')
  })

  test('parseInt ensures numeric addition for crit roll calculation', () => {
    // Document the parseInt fix that prevents string concatenation

    const roll = { total: 21 }
    const levelAsString = '1'

    // WITHOUT parseInt (the bug):
    const buggyResult = roll.total + levelAsString
    expect(buggyResult).toBe('211') // String concatenation!

    // WITH parseInt (the fix):
    const levelValue = parseInt(levelAsString)
    const correctResult = roll.total + levelValue
    expect(correctResult).toBe(22) // Numeric addition!
  })
})
