/* global gameSettingsGetMock */
/**
 * Adapter round-trip test — Phase 3 session 5 (weapon damage).
 *
 * Dispatcher + adapter coverage:
 *   DCCActor._rollDamage →
 *     (attack went via adapter + simple single-die formula + no backstab
 *      + no per-term flavors) → _rollDamageViaAdapter
 *     (otherwise) → _rollDamageLegacy
 *
 * Adapter-path validation points:
 *   - `DCCRoll.createRoll` is still invoked for chat rendering (same
 *     shape as legacy).
 *   - `libDamageResult` is populated from the lib's `rollDamage` so
 *     `rollWeaponAttack` can surface it as `dcc.libDamageResult` chat
 *     flags.
 *
 * Note on the mock: `__mocks__/dcc-roll.js` declares `createRoll` as
 * `static async`, but production `module/dcc-roll.js:17` is sync (returns
 * the Roll directly). The `rollWeaponAttack` damage block uses
 * `damageRoll = DCCRoll.createRoll(...)` without awaiting, relying on
 * production's sync behavior. Rather than touch the shared mock, each
 * test that exercises the damage path installs a sync stub on
 * `game.dcc.DCCRoll.createRoll` that mirrors the production contract.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import { buildDamageInput, parseDamageFormula } from '../adapter/damage-input.mjs'
import { logDispatch } from '../adapter/debug.mjs'

vi.mock('../actor-level-change.js')

vi.mock('../adapter/debug.mjs', () => ({
  logDispatch: vi.fn(),
  warnIfDivergent: vi.fn()
}))

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

function makeStubRoll ({ total = 4, natural = 4 } = {}) {
  return {
    total,
    _total: total,
    dice: [{ total: natural, options: {} }],
    terms: [],
    options: { dcc: {} },
    evaluate: async () => {},
    toAnchor: () => ({ outerHTML: '<a>damage</a>' })
  }
}

function withSyncCreateRoll (rollFactory) {
  const original = global.game.dcc.DCCRoll.createRoll
  global.game.dcc.DCCRoll.createRoll = vi.fn(() => rollFactory())
  return () => { global.game.dcc.DCCRoll.createRoll = original }
}

function assertDispatched (path, rollType = 'rollDamage') {
  return logDispatch.mock.calls.some(args =>
    args[0] === rollType && args[1] === path
  )
}

test('parseDamageFormula extracts die + modifier from simple formulas', () => {
  expect(parseDamageFormula('1d8')).toEqual({ diceCount: 1, die: 'd8', modifier: 0 })
  expect(parseDamageFormula('d8')).toEqual({ diceCount: 1, die: 'd8', modifier: 0 })
  expect(parseDamageFormula('1d6+2')).toEqual({ diceCount: 1, die: 'd6', modifier: 2 })
  expect(parseDamageFormula('2d4-1')).toEqual({ diceCount: 2, die: 'd4', modifier: -1 })
  expect(parseDamageFormula('1d6 + 3')).toEqual({ diceCount: 1, die: 'd6', modifier: 3 })
})

test('parseDamageFormula returns null for non-simple formulas', () => {
  expect(parseDamageFormula('1d6[fire]')).toBeNull()
  expect(parseDamageFormula('1d6+1d4')).toBeNull()
  expect(parseDamageFormula('1d6+@ab')).toBeNull()
  expect(parseDamageFormula('')).toBeNull()
  expect(parseDamageFormula(null)).toBeNull()
  expect(parseDamageFormula(undefined)).toBeNull()
})

test('buildDamageInput folds the flat modifier into strengthModifier', () => {
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 3 })
})

test('buildDamageInput peels NPC adjustment off strengthModifier into bonuses', () => {
  // Goblin's `1d4` weapon with +2 NPC adjustment → formula `1d4+2`,
  // parsed `modifier: 2`. The +2 belongs to the NPC adjustment, not
  // Strength; the lib breakdown should show that.
  const input = buildDamageInput({ diceCount: 1, die: 'd4', modifier: 2 }, { npcDamageAdjustment: 2 })
  expect(input.strengthModifier).toBe(0)
  expect(input.bonuses).toHaveLength(1)
  expect(input.bonuses[0]).toMatchObject({
    id: 'npc:attack-damage-bonus',
    label: 'NPC attack damage bonus',
    source: { type: 'other', id: 'npc-attack-damage-bonus' },
    category: 'inherent',
    effect: { type: 'modifier', value: 2 }
  })
})

test('buildDamageInput surfaces a negative NPC adjustment as a negative bonus', () => {
  const input = buildDamageInput({ diceCount: 1, die: 'd6', modifier: -1 }, { npcDamageAdjustment: -1 })
  expect(input.strengthModifier).toBe(0)
  expect(input.bonuses[0].effect).toEqual({ type: 'modifier', value: -1 })
})

test('buildDamageInput leaves strengthModifier intact when no NPC adjustment', () => {
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 }, { npcDamageAdjustment: 0 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 3 })
  expect(input.bonuses).toBeUndefined()
})

test('_canRouteDamageViaAdapter rejects when the attack went through legacy', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'sword' }
  expect(actor._canRouteDamageViaAdapter(weapon, '1d8', {}, {})).toBe(false)
})

test('_canRouteDamageViaAdapter rejects on backstab + per-term flavors', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'sword' }
  const attackRollResult = { libResult: { total: 15 } }

  expect(actor._canRouteDamageViaAdapter(weapon, '1d8', attackRollResult, { backstab: true })).toBe(false)
  expect(actor._canRouteDamageViaAdapter(weapon, '1d6[fire]+1d6[cold]', attackRollResult, {})).toBe(false)
  expect(actor._canRouteDamageViaAdapter(weapon, '1d6+1d4', attackRollResult, {})).toBe(false)
})

test('_canRouteDamageViaAdapter accepts simple formulas when attack was adapter', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'sword' }
  const attackRollResult = { libResult: { total: 15 } }

  expect(actor._canRouteDamageViaAdapter(weapon, '1d8', attackRollResult, {})).toBe(true)
  expect(actor._canRouteDamageViaAdapter(weapon, '1d6+2', attackRollResult, {})).toBe(true)
  expect(actor._canRouteDamageViaAdapter(weapon, 'd8-1', attackRollResult, {})).toBe(true)
})

test('adapter path logs rollDamage dispatch + returns libDamageResult', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 5, natural: 3 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'longsword' }
  const attackRollResult = { libResult: { total: 18 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d8+2', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(result.damageRoll).toBeDefined()
  expect(result.damagePrompt).toBeDefined()
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.baseDamage).toBe(3)
  expect(result.libDamageResult.modifierDamage).toBe(2)
  expect(result.libDamageResult.total).toBe(5)
  expect(Array.isArray(result.libDamageResult.breakdown)).toBe(true)
})

test('legacy path logs rollDamage dispatch when attack went through legacy', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 4, natural: 4 }))

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'longsword' }

  try {
    await actor._rollDamage(weapon, '1d8', {}, {})
  } finally {
    restoreRoll()
  }

  expect(assertDispatched('legacy')).toBe(true)
  expect(assertDispatched('adapter')).toBe(false)
})

test('legacy path fires for multi-damage-type (per-term flavors) formulas', async () => {
  logDispatch.mockClear()
  const attackRollResult = { libResult: { total: 18 } }

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'flamingsword' }
  actor.getRollData = () => ({})

  const originalRoll = global.Roll
  class RollStub extends originalRoll {
    constructor (formula, data) {
      super(formula, data)
      this.total = 7
      this.dice = [{ total: 4, options: {} }, { total: 3, options: {} }]
      this.terms = []
    }
  }
  RollStub.prototype.evaluate = async function () {}
  RollStub.prototype.toAnchor = () => ({ outerHTML: '<a>dmg</a>' })
  global.Roll = RollStub

  try {
    await actor._rollDamage(weapon, '1d6[fire]+1d6[cold]', attackRollResult, {})
  } finally {
    global.Roll = originalRoll
  }

  expect(assertDispatched('legacy')).toBe(true)
  expect(assertDispatched('adapter')).toBe(false)
})

test('adapter path attributes NPC damage adjustment as a bonus, not Strength', async () => {
  logDispatch.mockClear()
  // Goblin's club rolls a natural 3 on `1d4`; +1 NPC adjustment baked
  // into `1d4+1` → Foundry total 4. The lib result should attribute
  // the +1 to the NPC bonus breakdown, not Strength.
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 4, natural: 3 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'goblin club' }
  const attackRollResult = { libResult: { total: 12 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d4+1', attackRollResult, { npcDamageAdjustment: 1 })
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.baseDamage).toBe(3)
  expect(result.libDamageResult.modifierDamage).toBe(1)
  expect(result.libDamageResult.total).toBe(4)
  // Breakdown should NOT credit Strength (NPC has no rolled-up STR mod
  // baked in by computeMeleeAndMissileAttackAndDamage); the +1 should
  // ride on the bonuses entry.
  const strEntry = result.libDamageResult.breakdown.find(b => b.source === 'Strength')
  expect(strEntry).toBeUndefined()
  const bonusEntry = result.libDamageResult.breakdown.find(b => b.source === 'bonuses')
  expect(bonusEntry).toBeDefined()
  expect(bonusEntry.amount).toBe(1)
})

test('adapter path clamps damage minimum to 1', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: -2, natural: 1 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'club' }
  const attackRollResult = { libResult: { total: 12 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d4-5', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(result.damageRoll._total).toBe(1)
})
