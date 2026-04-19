/* global gameSettingsGetMock */
/**
 * Adapter round-trip test — Phase 3 session 6 (crit + fumble finishers).
 *
 * Dispatcher + adapter coverage:
 *   DCCActor._rollCritical →
 *     (attack went via adapter + automate on) → _rollCriticalViaAdapter
 *     (otherwise) → _rollCriticalLegacy
 *   DCCActor._rollFumble →
 *     (attack went via adapter + automate on) → _rollFumbleViaAdapter
 *     (otherwise) → _rollFumbleLegacy
 *
 * Adapter-path validation points:
 *   - `DCCRoll.createRoll` is still invoked for chat rendering (same
 *     shape as legacy).
 *   - `libCritResult` / `libFumbleResult` is populated from the lib's
 *     `rollCritical` / `rollFumble` so `rollWeaponAttack` can surface
 *     them as `dcc.libCritResult` / `dcc.libFumbleResult` chat flags.
 *
 * Note on the mock: see `adapter-weapon-damage.test.js` docstring for
 * the sync-stub rationale — the shared `__mocks__/dcc-roll.js` declares
 * `createRoll` as `static async` but production is sync. Each test
 * installs a sync stub rather than touching the shared mock.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import { buildCriticalInput, buildFumbleInput } from '../adapter/crit-fumble-input.mjs'
import { logDispatch } from '../adapter/debug.mjs'

vi.mock('../actor-level-change.js')

vi.mock('../adapter/debug.mjs', () => ({
  logDispatch: vi.fn(),
  warnIfDivergent: vi.fn()
}))

vi.mock('../utilities.js', async () => {
  const actual = await vi.importActual('../utilities.js')
  return {
    ...actual,
    getCritTableLink: vi.fn(async (name, display) => `<a>${display || name}</a>`),
    getCritTableResult: vi.fn(async () => ({ description: 'Double damage and knockdown.' })),
    getFumbleTableResult: vi.fn(async () => ({ description: 'You drop your weapon.', parent: { link: 'Fumble Table 4-2' } })),
    getNPCFumbleTableResult: vi.fn(async () => ({ description: 'You trip and fall.', parent: { link: 'Fumble Table 4-2' } }))
  }
})

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

function makeStubRoll ({ total = 7, natural = 7 } = {}) {
  return {
    total,
    _total: total,
    dice: [{ total: natural, options: {} }],
    terms: [],
    options: { dcc: {} },
    evaluate: async () => {},
    toAnchor: () => ({ outerHTML: '<a>roll</a>' })
  }
}

function withSyncCreateRoll (rollFactory) {
  const original = global.game.dcc.DCCRoll.createRoll
  global.game.dcc.DCCRoll.createRoll = vi.fn(() => rollFactory())
  return () => { global.game.dcc.DCCRoll.createRoll = original }
}

function assertDispatched (rollType, path) {
  return logDispatch.mock.calls.some(args =>
    args[0] === rollType && args[1] === path
  )
}

// ============================================================================
// Input-builder unit tests
// ============================================================================

test('buildCriticalInput normalizes Foundry-style die and records luck + table', () => {
  expect(buildCriticalInput({
    critDie: '1d10',
    luckModifier: 2,
    critTableName: 'III'
  })).toEqual({
    critTable: 'III',
    critDie: 'd10',
    luckModifier: 2
  })
})

test('buildCriticalInput falls back to crit table I when name is empty', () => {
  expect(buildCriticalInput({
    critDie: 'd14',
    luckModifier: 0,
    critTableName: ''
  })).toEqual({
    critTable: 'I',
    critDie: 'd14',
    luckModifier: 0
  })
})

test('buildFumbleInput passes the exact die through as fumbleDieOverride', () => {
  expect(buildFumbleInput({
    fumbleDie: '1d8',
    luckModifier: 1
  })).toEqual({
    armorType: 'unarmored',
    luckModifier: 1,
    fumbleDieOverride: 'd8'
  })
})

// ============================================================================
// Dispatcher gate tests
// ============================================================================

test('_canRouteCritViaAdapter rejects when the attack went through legacy', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  expect(actor._canRouteCritViaAdapter({}, {}, { automate: true })).toBe(false)
})

test('_canRouteCritViaAdapter rejects when automate is off', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const attackRollResult = { libResult: { total: 20 } }
  expect(actor._canRouteCritViaAdapter({}, attackRollResult, { automate: false })).toBe(false)
})

test('_canRouteCritViaAdapter accepts when attack was adapter + automate on', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const attackRollResult = { libResult: { total: 20 } }
  expect(actor._canRouteCritViaAdapter({}, attackRollResult, { automate: true })).toBe(true)
})

test('_canRouteFumbleViaAdapter gate mirrors crit gate', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const attackRollResult = { libResult: { total: 5 } }
  expect(actor._canRouteFumbleViaAdapter({}, {}, { automate: true })).toBe(false)
  expect(actor._canRouteFumbleViaAdapter({}, attackRollResult, { automate: false })).toBe(false)
  expect(actor._canRouteFumbleViaAdapter({}, attackRollResult, { automate: true })).toBe(true)
})

// ============================================================================
// Crit dispatcher tests
// ============================================================================

test('adapter path logs rollCritical dispatch + returns libCritResult', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 9, natural: 7 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.attributes = { critical: { die: '1d10', table: 'III' } }
  actor.system.abilities = { lck: { mod: '+2' } }
  const weapon = { name: 'longsword' }
  const attackRollResult = { libResult: { total: 18 } }

  let result
  try {
    result = await actor._rollCritical(weapon, attackRollResult, {
      automate: true,
      luckMod: '+2',
      critTableName: 'III'
    })
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('rollCritical', 'adapter')).toBe(true)
  expect(result.critRoll).toBeDefined()
  expect(result.critRollFormula).toBe('1d10+2')
  expect(result.critRollTotal).toBe(9)
  expect(result.libCritResult).toBeDefined()
  expect(result.libCritResult.natural).toBe(7)
  expect(result.libCritResult.total).toBe(9) // natural 7 + luck 2
  expect(result.libCritResult.critTable).toBe('III')
})

test('legacy crit path logs dispatch when attack went through legacy', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 5, natural: 5 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.attributes = { critical: { die: '1d10', table: 'III' } }
  actor.system.abilities = { lck: { mod: '+0' } }

  try {
    await actor._rollCritical({ name: 'sword' }, {}, {
      automate: true,
      luckMod: '+0',
      critTableName: 'III'
    })
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('rollCritical', 'legacy')).toBe(true)
  expect(assertDispatched('rollCritical', 'adapter')).toBe(false)
})

test('legacy crit path fires when automate is off even with libResult attack', async () => {
  logDispatch.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.attributes = { critical: { die: '1d10', table: 'III' } }
  actor.system.abilities = { lck: { mod: '+0' } }
  const attackRollResult = { libResult: { total: 20 } }

  const result = await actor._rollCritical({ name: 'sword' }, attackRollResult, {
    automate: false,
    luckMod: '+0',
    critTableName: 'III'
  })

  expect(assertDispatched('rollCritical', 'legacy')).toBe(true)
  expect(result.critRoll).toBeUndefined()
  expect(result.libCritResult).toBeUndefined()
})

// ============================================================================
// Fumble dispatcher tests
// ============================================================================

test('adapter path logs rollFumble dispatch + returns libFumbleResult', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 2, natural: 3 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.isPC = true
  actor.isNPC = false
  actor.system.attributes = {
    critical: { die: '1d10', table: 'III' },
    fumble: { die: '1d8' }
  }
  actor.system.abilities = { lck: { mod: '+1' } }
  const weapon = { name: 'longsword' }
  const attackRollResult = { libResult: { total: 1 } }

  let result
  try {
    result = await actor._rollFumble(weapon, attackRollResult, {
      automate: true,
      luckMod: '+1',
      inverseLuckMod: '-1',
      useNPCFumbles: true,
      fumbleTableName: 'Table 4-2: Fumbles',
      originalFumbleTableName: 'Table 4-2: Fumbles'
    })
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('rollFumble', 'adapter')).toBe(true)
  expect(result.fumbleRoll).toBeDefined()
  expect(result.fumbleRollFormula).toBe('1d8-1')
  expect(result.libFumbleResult).toBeDefined()
  expect(result.libFumbleResult.natural).toBe(3)
  expect(result.libFumbleResult.total).toBe(2) // natural 3 - luck 1
  expect(result.libFumbleResult.fumbleDie).toBe('d8')
})

test('legacy fumble path logs dispatch when automate is off', async () => {
  logDispatch.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.isPC = true
  actor.isNPC = false
  actor.system.attributes = {
    critical: { die: '1d10', table: 'III' },
    fumble: { die: '1d8' }
  }
  actor.system.abilities = { lck: { mod: '+0' } }
  const attackRollResult = { libResult: { total: 1 } }

  const result = await actor._rollFumble({ name: 'sword' }, attackRollResult, {
    automate: false,
    luckMod: '+0',
    inverseLuckMod: '+0',
    useNPCFumbles: true,
    fumbleTableName: 'Table 4-2: Fumbles',
    originalFumbleTableName: 'Table 4-2: Fumbles'
  })

  expect(assertDispatched('rollFumble', 'legacy')).toBe(true)
  expect(result.fumbleRoll).toBeUndefined()
  expect(result.libFumbleResult).toBeUndefined()
})

test('adapter fumble path swaps to NPC fumble die when actor is NPC + useNPCFumbles', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 5, natural: 5 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.isPC = false
  actor.isNPC = true
  actor.system.attributes = {
    critical: { die: '1d10', table: 'III' },
    fumble: { die: '1d4' } // would normally be used, but NPC + useNPCFumbles forces 1d10
  }
  actor.system.abilities = { lck: { mod: '+0' } }

  let result
  try {
    result = await actor._rollFumble({ name: 'claws' }, { libResult: { total: 1 } }, {
      automate: true,
      luckMod: '+0',
      inverseLuckMod: '+0',
      useNPCFumbles: true,
      fumbleTableName: 'Fumble Table Claws',
      originalFumbleTableName: 'Fumble Table Claws'
    })
  } finally {
    restore()
    restoreRoll()
  }

  expect(result.fumbleRollFormula).toBe('1d10')
  expect(result.isNPCFumble).toBe(true)
  expect(result.libFumbleResult.fumbleDie).toBe('d10')
})
