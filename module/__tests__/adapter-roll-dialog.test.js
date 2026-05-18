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
