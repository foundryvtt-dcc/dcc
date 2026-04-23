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

  // Adapter passes save values with the governing ability mod subtracted
  // out, to compensate for dcc-core-lib re-adding it via the save check
  // definition's `roll.ability`. Mock actor: sta 12 → mod 0, agl 8 → mod
  // -1, per 16 → mod +2; stored saves frt='-1' / ref='0' / wil='+2'.
  // After subtracting ability mod: -1−0=-1, 0−(-1)=1, 2−2=0.
  expect(character.state.saves.fortitude).toBe(-1)
  expect(character.state.saves.reflex).toBe(1)
  expect(character.state.saves.will).toBe(0)
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

// Regression: Cheesemaker repro — sheet shows Fortitude +1 but the rolled
// formula was `1d20 + 2`. The Foundry actor stores `saves.frt.value` as the
// FULL effective bonus (staMod + classBonus + otherBonus baked in by
// actor.js#computeSaves). The lib's check definition for a save also pulls
// the ability mod from `state.abilities.sta` and adds it on top of
// `state.saves.fortitude`, so passing the full Foundry value double-counts
// the ability mod. Roll bonus must equal the displayed save value.
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
