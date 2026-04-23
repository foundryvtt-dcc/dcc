/* global rollToMessageMock, ChatMessage */
/**
 * Adapter round-trip test — Phase 1.
 *
 * Exercises the full adapter flow for a non-legacy ability check:
 *   DCCActor._rollAbilityCheckViaAdapter →
 *   actorToCharacter →
 *   rollAbilityCheckAsync (lib) →
 *   foundry-roller (awaits Roll.evaluate) →
 *   chat-renderer (builds ChatMessage).
 *
 * Locks the contract between the Foundry adapter and dcc-core-lib
 * before the next check/save/init migrations reuse the pattern.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import { actorToCharacter } from '../adapter/character-accessors.mjs'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

// Build an actor. This goes through the same mock path as actor.test.js.
// noinspection JSCheckFunctionSignatures
const actor = new DCCActor()

test('actor → character accessor shape', () => {
  const character = actorToCharacter(actor)

  // Ability scores flow through
  expect(character.state.abilities.str.current).toBe(6)
  expect(character.state.abilities.lck.current).toBe(18)
  expect(character.state.abilities.per.current).toBe(16)

  // Save ids are remapped frt/ref/wil → fortitude/reflex/will
  expect(character.state.saves.fortitude).toBe(-1)
  expect(character.state.saves.reflex).toBe(0)
  expect(character.state.saves.will).toBe(2)

  // Level + classInfo
  expect(character.classInfo.level).toBe(1)
})

test('adapter path invokes lib and renders ChatMessage', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // Luck check (not str/agl, no dialog, no rollUnder) → adapter path
  await actor.rollAbilityCheck('lck')

  // Chat-renderer called toMessage with adapter-produced data
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData, toMessageOpts] = rollToMessageMock.mock.calls[0]

  expect(messageData.flavor).toBe('Luck Check')
  expect(messageData.flags['dcc.Ability']).toBe('lck')
  expect(messageData.flags['dcc.RollType']).toBe('AbilityCheck')
  expect(messageData.flags['dcc.isAbilityCheck']).toBe(true)
  // lck is not str/agl, so checkPenaltyCouldApply must NOT be set
  expect(messageData.flags.checkPenaltyCouldApply).toBeUndefined()

  // Lib result attached in flags (schema-free JSON). system.* is
  // schema-constrained and would drop unknown keys; flags accept
  // arbitrary module namespaces like 'dcc.libResult'.
  expect(messageData.flags['dcc.libResult']).toBeDefined()
  expect(messageData.flags['dcc.libResult'].skillId).toBe('ability:lck')
  expect(Array.isArray(messageData.flags['dcc.libResult'].modifiers)).toBe(true)

  // toMessage called with create: false so we can inject into messageData.rolls[]
  expect(toMessageOpts).toEqual({ create: false })

  // ChatMessage.create is called at the end to actually post
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()
})

test('adapter path skipped when options.rollUnder is true', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // rollUnder forces the legacy code path — exercised by the existing
  // legacy test suite, but confirm here that it still works alongside
  // the adapter wiring.
  await actor.rollAbilityCheck('lck', { rollUnder: true })

  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('AbilityCheckRollUnder')

  chatMessageCreateSpy.mockRestore()
})
