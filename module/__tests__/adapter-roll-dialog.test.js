/* global game */
/**
 * Unit tests for the adapter-side roll-modifier dialog scaffold.
 *
 * Phase 3 session 26 (open question #7) — these cover the lightweight
 * parsing helper that turns a Foundry Roll (from the legacy
 * `RollModifierDialog` submit step) into the `actionDie` +
 * `modifierTotal` pair the adapter feeds into the lib pass.
 *
 * `promptRollModifierDialog` itself is just a thin wrapper around
 * `game.dcc.DCCRoll.createRoll({ showModifierDialog: true })`; the
 * round-trip integration test lives in
 * `adapter-skill-check.test.js`. This file unit-tests the parser.
 */

import { expect, test, describe, vi } from 'vitest'
import '../__mocks__/foundry.js'
import {
  parseRollIntoDieAndModifier,
  promptRollModifierDialog
} from '../adapter/roll-dialog.mjs'

describe('parseRollIntoDieAndModifier', () => {
  test('extracts the action die from the first Die term', () => {
    const roll = {
      formula: '1d20',
      terms: [{ class: 'Die', formula: '1d20', number: 1, faces: 20 }]
    }
    const result = parseRollIntoDieAndModifier(roll)
    expect(result.actionDie).toBe('1d20')
    expect(result.modifierTotal).toBe(0)
  })

  test('sums positive numeric terms', () => {
    const roll = {
      formula: '1d20+3+2',
      terms: [
        { class: 'Die', formula: '1d20' },
        { class: 'OperatorTerm', operator: '+' },
        { class: 'NumericTerm', number: 3 },
        { class: 'OperatorTerm', operator: '+' },
        { class: 'NumericTerm', number: 2 }
      ]
    }
    const result = parseRollIntoDieAndModifier(roll)
    expect(result.actionDie).toBe('1d20')
    expect(result.modifierTotal).toBe(5)
  })

  test('honors signed numeric terms', () => {
    // 1d20 + 5 - 2 should net to +3.
    const roll = {
      formula: '1d20+5-2',
      terms: [
        { class: 'Die', formula: '1d20' },
        { class: 'OperatorTerm', operator: '+' },
        { class: 'NumericTerm', number: 5 },
        { class: 'OperatorTerm', operator: '-' },
        { class: 'NumericTerm', number: 2 }
      ]
    }
    const result = parseRollIntoDieAndModifier(roll)
    expect(result.modifierTotal).toBe(3)
  })

  test('returns null actionDie when no Die term present', () => {
    const roll = {
      formula: '5',
      terms: [{ class: 'NumericTerm', number: 5 }]
    }
    const result = parseRollIntoDieAndModifier(roll)
    expect(result.actionDie).toBeNull()
    expect(result.modifierTotal).toBe(5)
  })

  test('handles falsy / missing terms array', () => {
    expect(parseRollIntoDieAndModifier({ terms: [] })).toEqual({
      actionDie: null,
      modifierTotal: 0
    })
    expect(parseRollIntoDieAndModifier({})).toEqual({
      actionDie: null,
      modifierTotal: 0
    })
  })

  test('falls back to number/faces when term has no formula field', () => {
    const roll = {
      terms: [{ class: 'Die', number: 2, faces: 10 }]
    }
    const result = parseRollIntoDieAndModifier(roll)
    expect(result.actionDie).toBe('2d10')
  })
})

describe('promptRollModifierDialog', () => {
  test('forwards terms + rollData and requests showModifierDialog', async () => {
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce(() => ({
      formula: '1d20+4',
      terms: [
        { class: 'Die', formula: '1d20' },
        { class: 'OperatorTerm', operator: '+' },
        { class: 'NumericTerm', number: 4 }
      ]
    }))

    const terms = [{ type: 'Die', formula: '1d20' }]
    const result = await promptRollModifierDialog(terms, {
      rollData: { foo: 'bar' },
      title: 'Test Title',
      rollLabel: 'Roll It'
    })

    expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(1)
    const [termsArg, rollData, opts] = global.dccRollCreateRollMock.mock.calls[0]
    expect(termsArg).toBe(terms)
    expect(rollData).toEqual({ foo: 'bar' })
    expect(opts.showModifierDialog).toBe(true)
    expect(opts.title).toBe('Test Title')
    expect(opts.rollLabel).toBe('Roll It')

    expect(result).not.toBeNull()
    expect(result.actionDie).toBe('1d20')
    expect(result.modifierTotal).toBe(4)
    expect(result.formula).toBe('1d20+4')
  })

  test('returns null when DCCRoll.createRoll resolves with null (user cancelled)', async () => {
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce(() => null)

    const result = await promptRollModifierDialog([], {})
    expect(result).toBeNull()
  })

  test('returns null when DCCRoll.createRoll throws', async () => {
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await promptRollModifierDialog([], {})
    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('defaults rollData to {} when omitted', async () => {
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce(() => ({
      formula: '1d20',
      terms: [{ class: 'Die', formula: '1d20' }]
    }))

    await promptRollModifierDialog([])
    const [, rollData] = global.dccRollCreateRollMock.mock.calls[0]
    expect(rollData).toEqual({})
    // Reference `game` to keep the global import contract documented;
    // the dialog adapter relies on it being available.
    expect(game).toBeDefined()
  })
})

describe('promptRollModifierDialog spellburn descriptor (Q7-phase2)', () => {
  test('appends a Spellburn term and returns the zero commitment when callback is never invoked', async () => {
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce(() => ({
      formula: '1d20',
      terms: [{ class: 'Die', formula: '1d20' }]
    }))

    const result = await promptRollModifierDialog([{ type: 'Die', formula: '1d20' }], {
      spellburn: { str: 14, agl: 12, sta: 13 }
    })

    expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(1)
    const [termsArg] = global.dccRollCreateRollMock.mock.calls[0]
    expect(termsArg).toHaveLength(2)
    expect(termsArg[1]).toMatchObject({
      type: 'Spellburn',
      str: 14,
      agl: 12,
      sta: 13
    })
    expect(typeof termsArg[1].callback).toBe('function')

    // No callback fired → spellburn capture stays at the original
    // values → burn computed as zeros.
    expect(result.spellburn).toEqual({ str: 0, agl: 0, sta: 0 })
  })

  test('returns the chosen burn amounts and subtracts them from modifierTotal', async () => {
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce((terms) => {
      // The Spellburn term carries a callback the dialog's submit step
      // invokes with the final str/agl/sta on `term`. Simulate the user
      // burning 1 str and 2 sta (14→13, 13→11) and adding the resulting
      // `+3` to the rolled formula.
      const spellburnTerm = terms[terms.length - 1]
      spellburnTerm.callback('+3', { str: 13, agl: 12, sta: 11 })
      return {
        formula: '1d20+5+3',
        terms: [
          { class: 'Die', formula: '1d20' },
          { class: 'OperatorTerm', operator: '+' },
          { class: 'NumericTerm', number: 5 },
          { class: 'OperatorTerm', operator: '+' },
          { class: 'NumericTerm', number: 3 }
        ]
      }
    })

    const result = await promptRollModifierDialog([{ type: 'Die', formula: '1d20' }], {
      spellburn: { str: 14, agl: 12, sta: 13 }
    })

    expect(result.spellburn).toEqual({ str: 1, agl: 0, sta: 2 })
    // Raw modifierTotal would be 5 + 3 = 8; subtracting the 3 of
    // spellburn contribution yields 5 (the spell-check bonus the user
    // didn't change).
    expect(result.modifierTotal).toBe(5)
  })

  test('returns spellburn: null when no descriptor is requested', async () => {
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce(() => ({
      formula: '1d20+4',
      terms: [
        { class: 'Die', formula: '1d20' },
        { class: 'OperatorTerm', operator: '+' },
        { class: 'NumericTerm', number: 4 }
      ]
    }))

    const result = await promptRollModifierDialog([{ type: 'Die', formula: '1d20' }])
    expect(result.spellburn).toBeNull()
    // No spellburn descriptor → no term appended.
    const [termsArg] = global.dccRollCreateRollMock.mock.calls[0]
    expect(termsArg).toHaveLength(1)
  })

  test('clamps negative burn amounts to zero (lib never sees a partial restoration)', async () => {
    // A buggy/edge-case dialog could theoretically hand back a final
    // ability score HIGHER than the original (e.g. the user added
    // points instead of burning them). The promptRollModifierDialog
    // wrapper clamps each burn at zero so the lib's spellburn modifier
    // can't go negative.
    global.dccRollCreateRollMock.mockClear()
    global.dccRollCreateRollMock.mockImplementationOnce((terms) => {
      const spellburnTerm = terms[terms.length - 1]
      spellburnTerm.callback('+0', { str: 16, agl: 12, sta: 13 }) // str went UP
      return {
        formula: '1d20',
        terms: [{ class: 'Die', formula: '1d20' }]
      }
    })

    const result = await promptRollModifierDialog([{ type: 'Die', formula: '1d20' }], {
      spellburn: { str: 14, agl: 12, sta: 13 }
    })
    expect(result.spellburn).toEqual({ str: 0, agl: 0, sta: 0 })
  })
})
