/* global rollToMessageMock, ChatMessage */
/**
 * Adapter round-trip test — Phase 1 (saving throw).
 *
 * Exercises the full adapter flow for a saving throw:
 *   DCCActor._rollSavingThrowViaAdapter →
 *   actorToCharacter (with frt/ref/wil → fortitude/reflex/will remap) →
 *   libRollSavingThrow (formula mode) → new Roll(formula).evaluate() →
 *   libRollSavingThrow (evaluate mode, pre-rolled natural) →
 *   chat-renderer (builds ChatMessage, preserves legacy flags).
 *
 * Mirror of adapter-ability-check.test.js. Together they lock the
 * two-pass pattern the remaining Phase 1 migrations reuse.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import {
  actorToCharacter,
  foundrySaveIdToLib
} from '../adapter/character-accessors.mjs'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

// Build an actor. This goes through the same mock path as actor.test.js.
// noinspection JSCheckFunctionSignatures
const actor = new DCCActor()

test('actor → character maps saves (frt/ref/wil → fortitude/reflex/will)', () => {
  const character = actorToCharacter(actor)

  expect(character.state.saves.fortitude).toBe(-1)
  expect(character.state.saves.reflex).toBe(0)
  expect(character.state.saves.will).toBe(2)
})

test('foundrySaveIdToLib round-trips the three save ids', () => {
  expect(foundrySaveIdToLib('frt')).toBe('fortitude')
  expect(foundrySaveIdToLib('ref')).toBe('reflex')
  expect(foundrySaveIdToLib('wil')).toBe('will')
})

test('adapter path invokes lib and renders ChatMessage for a Reflex save', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  await actor.rollSavingThrow('ref')

  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData, toMessageOpts] = rollToMessageMock.mock.calls[0]

  expect(messageData.flavor).toBe('Reflex Save')
  expect(messageData.flags['dcc.Save']).toBe('ref')
  expect(messageData.flags['dcc.RollType']).toBe('SavingThrow')
  expect(messageData.flags['dcc.isSave']).toBe(true)

  // Lib result attached to flags (schema-free JSON). Namespaced
  // save id round-trips through the lib.
  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  expect(libResult.skillId).toBe('save:reflex')
  expect(Array.isArray(libResult.modifiers)).toBe(true)

  // toMessage called with create: false so ChatMessage.create posts it
  // — same shape as the ability-check adapter.
  expect(toMessageOpts).toEqual({ create: false })
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()
})

test('adapter path renders DC success / failure suffix', async () => {
  rollToMessageMock.mockClear()

  // Mock Roll.total is 10 — DC 5 should succeed
  await actor.rollSavingThrow('ref', { dc: 5 })
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save \u2014 Success'
    }),
    { create: false }
  )

  // DC 15 should fail
  await actor.rollSavingThrow('ref', { dc: 15 })
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save \u2014 Failure'
    }),
    { create: false }
  )

  // showDc prefixes the DC value
  await actor.rollSavingThrow('ref', { dc: 12, showDc: true })
  expect(rollToMessageMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      flavor: 'Reflex Save (DC 12) \u2014 Failure'
    }),
    { create: false }
  )
})

test('adapter path returns the Foundry Roll (preserves legacy return shape)', async () => {
  const result = await actor.rollSavingThrow('wil')
  expect(result).toBeDefined()
  expect(result.total).toBeDefined()
})

// Legacy-decom step 2: the modifier dialog is handled adapter-side (the
// former legacy saving-throw body was deleted at session 25). The
// adapter surfaces the unified
// `RollModifierDialog` via `promptRollModifierDialog`, then folds the
// user's flattened die + total into a `rollCheck` pass (bare definition
// + one `dialog-modifier` line, suppressing the lib's auto-save-value
// add since the dialog total already includes the save modifier).
test('adapter path opens RollModifierDialog when showModifierDialog is true', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  // Simulate the user submitting the dialog with a +5 total. Same Roll
  // shape the real dialog yields.
  global.dccRollCreateRollMock.mockImplementationOnce(() => ({
    formula: '1d20+5',
    total: 15,
    dice: [{ results: [10], total: 10, options: {} }],
    options: { dcc: {} },
    terms: [
      { class: 'Die', formula: '1d20', number: 1, faces: 20 },
      { class: 'OperatorTerm', operator: '+' },
      { class: 'NumericTerm', number: 5 }
    ],
    _evaluated: true
  }))

  await actor.rollSavingThrow('wil', { showModifierDialog: true })

  expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  const createCall = global.dccRollCreateRollMock.mock.calls[0]
  const termsArg = createCall[0]
  expect(Array.isArray(termsArg)).toBe(true)
  // Fixed 1d20 die + the Will save modifier term (wil = +2).
  expect(termsArg.some(t => t.type === 'Die' && t.formula === '1d20')).toBe(true)
  expect(termsArg.some(t => t.type === 'Modifier' && t.formula === '+2')).toBe(true)
  expect(createCall[2].showModifierDialog).toBe(true)

  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('SavingThrow')
  expect(messageData.flags['dcc.Save']).toBe('wil')

  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  expect(libResult.die).toBe('d20')
  // Per-source attribution collapsed to one flat `dialog-modifier` line.
  const dialogMod = libResult.modifiers.find(m => m.origin?.id === 'dialog-modifier')
  expect(dialogMod).toBeDefined()
  expect(dialogMod.kind).toBe('add')
  expect(dialogMod.value).toBe(5)
})

test('adapter dialog path still renders the DC success / failure suffix', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  // User-submitted dialog total of +0; lib formula totals 10 (mock Roll).
  global.dccRollCreateRollMock.mockImplementationOnce(() => ({
    formula: '1d20',
    total: 10,
    dice: [{ results: [10], total: 10, options: {} }],
    options: { dcc: {} },
    terms: [{ class: 'Die', formula: '1d20', number: 1, faces: 20 }],
    _evaluated: true
  }))

  await actor.rollSavingThrow('ref', { showModifierDialog: true, dc: 15 })

  const [messageData] = rollToMessageMock.mock.calls[0]
  // Mock Roll totals 10 → DC 15 fails; the suffix rides on the flavor
  // exactly as the non-dialog adapter path renders it.
  expect(messageData.flavor).toContain('Failure')
})

test('adapter path returns undefined when the saving-throw dialog is cancelled', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  global.dccRollCreateRollMock.mockImplementationOnce(() => null)

  const result = await actor.rollSavingThrow('wil', { showModifierDialog: true })

  expect(result).toBeUndefined()
  expect(rollToMessageMock).not.toHaveBeenCalled()
})

// Regression: Cheesemaker repro — sheet shows Fortitude +1, rolled
// formula must be `1d20 + 1`. Previously the lib's save definition
// auto-added the governing ability mod on top of `state.saves.*` (which
// already includes it), producing `1d20 + 2`; fixed in dcc-core-lib by
// dropping `roll.ability` from save definitions.
test('adapter formula does not double-count ability mod into save bonus', async () => {
  // Cheesemaker: sta 14 → +1, level 0 (no class bonus), saves.frt = '+1'
  // (the +1 IS the Stamina mod — there is no class component).
  const cheesemaker = new DCCActor()
  cheesemaker.system.abilities.sta.value = 14
  cheesemaker.system.saves.frt.value = '+1'
  cheesemaker.system.details.level.value = 0
  cheesemaker.prepareBaseData()

  const result = await cheesemaker.rollSavingThrow('frt')
  // Lib emits no-space form (`1d20+1`); real Foundry pretty-prints to
  // `1d20 + 1` after evaluation. Strip whitespace for a stable assertion.
  expect(result.formula.replace(/\s/g, '')).toBe('1d20+1')
})
