/* global Hooks, gameSettingsGetMock, dccRollCreateRollMock */
/**
 * Adapter round-trip test — Phase 3 session 2 (weapon attack).
 *
 * Dispatcher + adapter coverage:
 *   DCCActor.rollToHit →
 *     (happy path + automate on) → _rollToHitViaAdapter
 *     (showModifierDialog | backstab | two-weapon | deed die | automate off) → _rollToHitLegacy
 *
 * Adapter-path validation points:
 *   - `dcc.modifyAttackRollTerms` hook still fires with the legacy-shape
 *     terms array.
 *   - `DCCRoll.createRoll` is still invoked for chat rendering (same
 *     shape as legacy).
 *   - The result carries `libResult` populated from the lib's
 *     `makeAttackRoll` so `rollWeaponAttack` can surface it as
 *     `dcc.libResult` chat flags.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'
import { buildAttackInput } from '../adapter/attack-input.mjs'
import { logDispatch } from '../adapter/debug.mjs'

vi.mock('../actor-level-change.js')

// Mock logDispatch so tests can assert on dispatch-path selection
// deterministically (vitest's reporter intercepts console.log before
// spies see it).
vi.mock('../adapter/debug.mjs', () => ({
  logDispatch: vi.fn()
}))

function makeSimpleWeapon (overrides = {}) {
  return new DCCItem({
    name: 'longsword',
    type: 'weapon',
    system: {
      actionDie: '1d20',
      toHit: '+2',
      critRange: 20,
      damage: '1d8',
      melee: true,
      equipped: true,
      twoWeaponPrimary: false,
      twoWeaponSecondary: false,
      ...overrides
    }
  })
}

function withAutomate (enabled) {
  const original = gameSettingsGetMock.getMockImplementation()
  gameSettingsGetMock.mockImplementation((module, key) => {
    if (module === 'dcc' && key === 'automateDamageFumblesCrits') return enabled
    if (module === 'dcc' && key === 'strictCriticalHits') return false
    if (module === 'dcc' && key === 'checkWeaponEquipment') return false
    return original ? original(module, key) : undefined
  })
  return () => gameSettingsGetMock.mockImplementation(original)
}

function assertDispatched (path, rollType = 'rollWeaponAttack') {
  return logDispatch.mock.calls.some(args =>
    args[0] === rollType && args[1] === path
  )
}

test('adapter path fires for simplest weapon with automate on', async () => {
  logDispatch.mockClear()
  dccRollCreateRollMock.mockClear()
  const hookCallSpy = vi.fn(() => true)
  const originalCall = Hooks.call
  Hooks.call = hookCallSpy
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restore()
    Hooks.call = originalCall
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(
    hookCallSpy.mock.calls.some(args => args[0] === 'dcc.modifyAttackRollTerms')
  ).toBe(true)
  expect(dccRollCreateRollMock).toHaveBeenCalled()
})

test('adapter path result carries lib classification + modifier list', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  let result
  try {
    result = await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(result).toBeDefined()
  expect(result.rolled).toBe(true)
  expect(result.libResult).toBeDefined()
  expect(result.libResult.die).toBe('d20')
  expect(Array.isArray(result.libResult.modifiers)).toBe(true)
  // `natural` is populated from `attackRoll.dice[0].total` at runtime; the
  // unit mock doesn't expose `total` on the dice term, so assert only
  // that the field exists on the result object.
  expect('natural' in result.libResult).toBe(true)
  expect(typeof result.libResult.isCriticalThreat).toBe('boolean')
  expect(typeof result.libResult.isFumble).toBe('boolean')
})

test('legacy path fires when automate off', async () => {
  logDispatch.mockClear()
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  await actor.rollToHit(weapon, {})

  expect(assertDispatched('legacy')).toBe(true)
  expect(assertDispatched('adapter')).toBe(false)
})

test('legacy path fires when options.backstab is set', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  try {
    await actor.rollToHit(weapon, { backstab: true })
  } finally {
    restore()
  }

  expect(assertDispatched('legacy')).toBe(true)
  expect(assertDispatched('adapter')).toBe(false)
})

test('legacy path fires when options.showModifierDialog is set', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon()

  try {
    await actor.rollToHit(weapon, { showModifierDialog: true })
  } finally {
    restore()
  }

  expect(assertDispatched('legacy')).toBe(true)
  expect(assertDispatched('adapter')).toBe(false)
})

test('legacy path fires for two-weapon primary weapons', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ twoWeaponPrimary: true })

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(assertDispatched('legacy')).toBe(true)
  expect(assertDispatched('adapter')).toBe(false)
})

test('legacy path fires when the actor has a deed-die attackBonus', async () => {
  logDispatch.mockClear()
  const restore = withAutomate(true)
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.details.attackBonus = '+1d3'
  const weapon = makeSimpleWeapon()

  try {
    await actor.rollToHit(weapon, {})
  } finally {
    restore()
  }

  expect(assertDispatched('legacy')).toBe(true)
  expect(assertDispatched('adapter')).toBe(false)
})

test('buildAttackInput translates weapon + actor to the lib AttackInput shape', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ toHit: '+3', critRange: 19 })

  const input = buildAttackInput(actor, weapon)

  expect(input.attackType).toBe('melee')
  expect(input.actionDie).toBe('d20')
  expect(input.threatRange).toBe(19)
  expect(input.attackBonus).toBe(3)
  // Ability mod folded into attackBonus (weapon.toHit bakes it in)
  expect(input.abilityModifier).toBe(0)
})

test('buildAttackInput marks missile weapons correctly', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = makeSimpleWeapon({ melee: false, toHit: '-1' })

  const input = buildAttackInput(actor, weapon)

  expect(input.attackType).toBe('missile')
  expect(input.attackBonus).toBe(-1)
})
