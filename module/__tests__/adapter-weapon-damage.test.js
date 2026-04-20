/* global gameSettingsGetMock */
/**
 * Adapter round-trip test — weapon damage.
 *
 * Phase 3 session 19 retired `_rollDamageLegacy` + `_canRouteDamageViaAdapter`
 * + `_rollDamageViaAdapter`. `_rollDamage` is a single path whose body
 * is the former via-adapter branch, now broadened with:
 *   - Multi-type per-term flavor formulas via `parseMultiTypeFormula`
 *     (base + `extraDamageDice[]` with per-term flavors).
 *   - Dice-bearing `damageWeaponBonus: '+1d4'` via `parseWeaponMagicBonus`
 *     → `extraDamageDice[]`.
 *   - Cursed `damageWeaponBonus: '-1'` via `parseWeaponMagicBonus`
 *     → negative `DamageInput.magicBonus`.
 *   - Unparseable formulas fall back to `buildPassthroughDamageResult`.
 *
 * Adapter-path validation points:
 *   - `DCCRoll.createRoll` (or native `Roll` for per-term flavors) is
 *     invoked for chat rendering with the same shape the legacy body
 *     produced.
 *   - `libDamageResult` is populated from the lib's `rollDamage` so
 *     `rollWeaponAttack` can surface it as `dcc.libDamageResult` chat
 *     flags. For passthrough inputs, `libDamageResult.passthrough` is
 *     `true` and the breakdown is deliberately empty.
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
import {
  buildDamageInput,
  buildPassthroughDamageResult,
  parseDamageFormula,
  parseMultiTypeFormula,
  parseWeaponMagicBonus,
  peelTrailingFlavor
} from '../adapter/damage-input.mjs'
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

function makeStubRoll ({ total = 4, dice = null, natural = 4 } = {}) {
  const diceList = dice || [{ total: natural, options: {} }]
  return {
    total,
    _total: total,
    dice: diceList,
    terms: [],
    options: { dcc: {} },
    evaluate: async () => {},
    toAnchor: () => ({ outerHTML: '<a>damage</a>' })
  }
}

function withSyncCreateRoll (rollFactory) {
  const original = global.game.dcc.DCCRoll.createRoll
  global.game.dcc.DCCRoll.createRoll = vi.fn((...args) => rollFactory(...args))
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

test('parseDamageFormula sums multiple trailing integer modifiers', () => {
  // PC with strength +2 + magic weapon +1 — item.js produces `1d8+2+1`.
  expect(parseDamageFormula('1d8+2+1')).toEqual({ diceCount: 1, die: 'd8', modifier: 3 })
  // NPC with baked-in adjustment on a magic weapon: `1d6+1+3` (str +1, npc adj +3).
  expect(parseDamageFormula('1d6+1+3')).toEqual({ diceCount: 1, die: 'd6', modifier: 4 })
  // Mixed signs: `1d8-1+2` (penalty + bonus).
  expect(parseDamageFormula('1d8-1+2')).toEqual({ diceCount: 1, die: 'd8', modifier: 1 })
})

test('parseDamageFormula returns null for non-simple formulas', () => {
  expect(parseDamageFormula('1d6[fire]')).toBeNull()
  expect(parseDamageFormula('1d6+1d4')).toBeNull()
  expect(parseDamageFormula('1d6+@ab')).toBeNull()
  expect(parseDamageFormula('')).toBeNull()
  expect(parseDamageFormula(null)).toBeNull()
  expect(parseDamageFormula(undefined)).toBeNull()
})

test('peelTrailingFlavor strips a single trailing bracket, preserving the formula', () => {
  expect(peelTrailingFlavor('1d8')).toEqual({ formula: '1d8', flavor: '' })
  expect(peelTrailingFlavor('1d8[Slashing]')).toEqual({ formula: '1d8', flavor: 'Slashing' })
  expect(peelTrailingFlavor('1d6+2[Slashing]')).toEqual({ formula: '1d6+2', flavor: 'Slashing' })
  expect(peelTrailingFlavor('2d4-1[Piercing]')).toEqual({ formula: '2d4-1', flavor: 'Piercing' })
  expect(peelTrailingFlavor('1d8 [ Slashing ]')).toEqual({ formula: '1d8', flavor: ' Slashing ' })
})

test('peelTrailingFlavor returns the input unchanged when no trailing bracket', () => {
  // Per-term flavor patterns are handled by parseMultiTypeFormula, not this.
  expect(peelTrailingFlavor('1d6[fire]+1d6[cold]')).toEqual({ formula: '1d6[fire]+1d6', flavor: 'cold' })
  expect(peelTrailingFlavor('')).toEqual({ formula: '', flavor: '' })
  expect(peelTrailingFlavor(null)).toEqual({ formula: '', flavor: '' })
})

test('parseMultiTypeFormula splits per-term flavors into base + extras', () => {
  // Canonical case: two flavored dice. First becomes base, second extra.
  expect(parseMultiTypeFormula('1d6[fire]+1d6[cold]')).toEqual({
    base: { diceCount: 1, die: 'd6' },
    modifier: 0,
    extras: [{ count: 1, die: 'd6', flavor: 'cold' }]
  })
  // Base without flavor, flavored extra — common for a weapon whose
  // magic bonus happens to be flavored (`damageWeaponBonus: '+1d6[fire]'`).
  expect(parseMultiTypeFormula('1d8+2+1d6[fire]')).toEqual({
    base: { diceCount: 1, die: 'd8' },
    modifier: 2,
    extras: [{ count: 1, die: 'd6', flavor: 'fire' }]
  })
  // Three-term fire/cold/acid.
  expect(parseMultiTypeFormula('1d4[fire]+1d4[cold]+1d4[acid]')).toEqual({
    base: { diceCount: 1, die: 'd4' },
    modifier: 0,
    extras: [
      { count: 1, die: 'd4', flavor: 'cold' },
      { count: 1, die: 'd4', flavor: 'acid' }
    ]
  })
})

test('parseMultiTypeFormula returns null for non-per-term formulas + unrecognized shapes', () => {
  expect(parseMultiTypeFormula('1d8')).toBeNull()
  expect(parseMultiTypeFormula('1d8+2')).toBeNull()
  expect(parseMultiTypeFormula('1d6+2[Slashing]')).toBeNull() // trailing, not per-term
  expect(parseMultiTypeFormula('1d8+@ab[fire]')).toBeNull()
  expect(parseMultiTypeFormula('')).toBeNull()
  expect(parseMultiTypeFormula(null)).toBeNull()
})

test('parseWeaponMagicBonus parses flat integer bonuses (positive + negative)', () => {
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '+1' } })).toEqual({ kind: 'flat', value: 1 })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '+3' } })).toEqual({ kind: 'flat', value: 3 })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '2' } })).toEqual({ kind: 'flat', value: 2 })
  // Cursed — negative flat.
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '-1' } })).toEqual({ kind: 'flat', value: -1 })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '-2' } })).toEqual({ kind: 'flat', value: -2 })
})

test('parseWeaponMagicBonus returns { kind: "none" } for missing or empty bonus', () => {
  expect(parseWeaponMagicBonus({})).toEqual({ kind: 'none' })
  expect(parseWeaponMagicBonus({ system: {} })).toEqual({ kind: 'none' })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '' } })).toEqual({ kind: 'none' })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '   ' } })).toEqual({ kind: 'none' })
})

test('parseWeaponMagicBonus parses dice-bearing bonuses with optional flavor', () => {
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '+1d4' } })).toEqual({
    kind: 'dice', count: 1, die: 'd4'
  })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '1d6' } })).toEqual({
    kind: 'dice', count: 1, die: 'd6'
  })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '+2d4' } })).toEqual({
    kind: 'dice', count: 2, die: 'd4'
  })
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '+1d6[fire]' } })).toEqual({
    kind: 'dice', count: 1, die: 'd6', flavor: 'fire'
  })
})

test('parseWeaponMagicBonus returns null for unrecognized shapes', () => {
  // Mixed flat + dice — not supported as a single bonus.
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '+1+1d4' } })).toBeNull()
  // Gibberish.
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: 'wat' } })).toBeNull()
  // Negative dice count — unsupported.
  expect(parseWeaponMagicBonus({ system: { damageWeaponBonus: '-1d4' } })).toBeNull()
})

test('buildDamageInput folds the flat modifier into strengthModifier', () => {
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 3 })
})

test('buildDamageInput peels NPC adjustment off strengthModifier into bonuses', () => {
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

test('buildDamageInput peels positive magicBonus off strengthModifier', () => {
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 }, { magicBonus: 1 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 2, magicBonus: 1 })
})

test('buildDamageInput surfaces a negative magicBonus for cursed weapons', () => {
  // Cursed -1 weapon + Str +3 → formula `1d8+2` (`Roll.safeEval` flattens
  // str + cursed flat). Parsed modifier 2. To attribute correctly:
  // magicBonus: -1, strengthModifier: 2 - (-1) = 3.
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 2 }, { magicBonus: -1 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 3, magicBonus: -1 })
})

test('buildDamageInput ignores zero magicBonus (non-magical weapons)', () => {
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 }, { magicBonus: 0 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 3 })
  expect(input.magicBonus).toBeUndefined()
})

test('buildDamageInput accepts extraDamageDice[] verbatim', () => {
  const extras = [{ count: 1, die: 'd4', source: 'magic' }]
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 }, { extraDamageDice: extras })
  expect(input.extraDamageDice).toBe(extras)
})

test('buildDamageInput splits magicBonus + npcDamageAdjustment cleanly', () => {
  // NPC goblin with a +1 magic club: `1d4+1+3` (magic +1, npc adj +3).
  // Parsed modifier: 4. Expected: magicBonus 1, bonuses[+3], strength 0.
  const input = buildDamageInput(
    { diceCount: 1, die: 'd4', modifier: 4 },
    { magicBonus: 1, npcDamageAdjustment: 3 }
  )
  expect(input.strengthModifier).toBe(0)
  expect(input.magicBonus).toBe(1)
  expect(input.bonuses).toHaveLength(1)
  expect(input.bonuses[0].effect).toEqual({ type: 'modifier', value: 3 })
})

test('buildPassthroughDamageResult mirrors the parseable shape with null slots', () => {
  const result = buildPassthroughDamageResult({ total: 17 })
  expect(result).toEqual({
    damageDie: null,
    natural: null,
    baseDamage: null,
    modifierDamage: null,
    total: 17,
    breakdown: [],
    passthrough: true
  })
})

test('D2 damage retirement guard — gate + legacy + via-adapter aliases absent', () => {
  // Phase 3 session 19 collapse. `_rollDamage` is a single path; the gate
  // helper, legacy body, and via-adapter alias are all gone. Guard against
  // a regression that reintroduces the dispatcher scaffold.
  const proto = DCCActor.prototype
  expect(proto._canRouteDamageViaAdapter).toBeUndefined()
  expect(proto._rollDamageLegacy).toBeUndefined()
  expect(proto._rollDamageViaAdapter).toBeUndefined()
  // `_rollDamage` + `_buildLibDamageResult` + `_structureDamageInput`
  // remain as the single path.
  expect(typeof proto._rollDamage).toBe('function')
  expect(typeof proto._buildLibDamageResult).toBe('function')
  expect(typeof proto._structureDamageInput).toBe('function')
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
  expect(assertDispatched('legacy')).toBe(false)
  expect(result.damageRoll).toBeDefined()
  expect(result.damagePrompt).toBeDefined()
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.baseDamage).toBe(3)
  expect(result.libDamageResult.modifierDamage).toBe(2)
  expect(result.libDamageResult.total).toBe(5)
  expect(Array.isArray(result.libDamageResult.breakdown)).toBe(true)
})

test('adapter path routes regardless of attack route (single-path post-retirement)', async () => {
  // Pre-retirement, a legacy attack forced the damage side to legacy too
  // (defensive `attackRollResult?.libResult` check). Post-session-19 the
  // damage body no longer gates on that — `rollWeaponAttack` only invokes
  // `_rollDamage` when a Roll is actually produced, and that scenario
  // is covered by the existing test.
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

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
})

test('adapter path routes multi-type per-term formulas via native Roll', async () => {
  logDispatch.mockClear()
  // `1d6[fire]+1d6[cold]` → native `new Roll` (so Foundry preserves the
  // per-term flavors in chat) → lib sees base d6 + extra d6[cold].
  const attackRollResult = { libResult: { total: 18 } }

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'flamingsword' }
  actor.getRollData = () => ({})

  const originalRoll = global.Roll
  let constructedFormula = null
  class RollStub extends originalRoll {
    constructor (formula, data) {
      super(formula, data)
      constructedFormula = formula
      this.total = 7
      this.dice = [{ total: 4, options: {} }, { total: 3, options: {} }]
      this.terms = []
    }
  }
  RollStub.prototype.evaluate = async function () {}
  RollStub.prototype.toAnchor = () => ({ outerHTML: '<a>dmg</a>' })
  global.Roll = RollStub

  let result
  try {
    result = await actor._rollDamage(weapon, '1d6[fire]+1d6[cold]', attackRollResult, {})
  } finally {
    global.Roll = originalRoll
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
  expect(constructedFormula).toBe('1d6[fire]+1d6[cold]')
  // libDamageResult: base d6 rolled 4 + extra d6 cold rolled 3 → total 7.
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.baseDamage).toBe(4)
  expect(result.libDamageResult.modifierDamage).toBe(3)
  expect(result.libDamageResult.total).toBe(7)
  const coldEntry = result.libDamageResult.breakdown.find(b => b.source === 'cold')
  expect(coldEntry).toBeDefined()
  expect(coldEntry.amount).toBe(3)
})

test('adapter path routes dice-bearing magic bonus as extraDamageDice', async () => {
  logDispatch.mockClear()
  // PC with Str +3 wielding a flaming sword (`damageWeaponBonus: '+1d4'`):
  // item.js concatenates to `1d8+3+1d4` → Foundry rolls 5 on d8, 2 on d4
  // → total 10. Lib sees base d8 + extra d4, strength +3.
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({
    total: 10,
    dice: [{ total: 5, options: {} }, { total: 2, options: {} }]
  }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: '+1d4 flaming sword', system: { damageWeaponBonus: '+1d4' } }
  const attackRollResult = { libResult: { total: 19 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d8+3+1d4', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.passthrough).toBeUndefined()
  expect(result.libDamageResult.baseDamage).toBe(5)
  expect(result.libDamageResult.total).toBe(10)
  const strEntry = result.libDamageResult.breakdown.find(b => b.source === 'Strength')
  expect(strEntry).toBeDefined()
  expect(strEntry.amount).toBe(3)
  // Lib attributes extraDamageDice as `source: 'magic'` when no flavor.
  const magicEntry = result.libDamageResult.breakdown.find(b => b.source === 'magic')
  expect(magicEntry).toBeDefined()
  expect(magicEntry.amount).toBe(2)
})

test('adapter path routes cursed weapon as negative magicBonus', async () => {
  logDispatch.mockClear()
  // Cursed -1 sword + Str +3 → item.js Roll.safeEval flattens to `1d8+2`.
  // Foundry rolls 5 → total 7. Lib sees str +3, magicBonus -1.
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 7, natural: 5 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'cursed blade', system: { damageWeaponBonus: '-1' } }
  const attackRollResult = { libResult: { total: 15 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d8+2', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.passthrough).toBeUndefined()
  expect(result.libDamageResult.baseDamage).toBe(5)
  expect(result.libDamageResult.total).toBe(7)
  const strEntry = result.libDamageResult.breakdown.find(b => b.source === 'Strength')
  expect(strEntry).toBeDefined()
  expect(strEntry.amount).toBe(3)
  const cursedEntry = result.libDamageResult.breakdown.find(b => b.source === 'cursed')
  expect(cursedEntry).toBeDefined()
  expect(cursedEntry.amount).toBe(-1)
})

test('adapter path attributes NPC damage adjustment as a bonus, not Strength', async () => {
  logDispatch.mockClear()
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
  const strEntry = result.libDamageResult.breakdown.find(b => b.source === 'Strength')
  expect(strEntry).toBeUndefined()
  const bonusEntry = result.libDamageResult.breakdown.find(b => b.source === 'bonuses')
  expect(bonusEntry).toBeDefined()
  expect(bonusEntry.amount).toBe(1)
})

test('adapter path attributes +1 weapon bonus as magic, not Strength', async () => {
  logDispatch.mockClear()
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 8, natural: 5 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: '+1 longsword', system: { damageWeaponBonus: '+1' } }
  const attackRollResult = { libResult: { total: 20 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d8+2+1', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.baseDamage).toBe(5)
  expect(result.libDamageResult.modifierDamage).toBe(3)
  expect(result.libDamageResult.total).toBe(8)

  const strEntry = result.libDamageResult.breakdown.find(b => b.source === 'Strength')
  expect(strEntry).toBeDefined()
  expect(strEntry.amount).toBe(2)
  const magicEntry = result.libDamageResult.breakdown.find(b => b.source === 'magic')
  expect(magicEntry).toBeDefined()
  expect(magicEntry.amount).toBe(1)
})

test('adapter path peels trailing flavor bracket into Compound term + libDamageResult', async () => {
  logDispatch.mockClear()
  const createRollCalls = []
  const restoreRoll = (() => {
    const original = global.game.dcc.DCCRoll.createRoll
    global.game.dcc.DCCRoll.createRoll = vi.fn((termSpecs) => {
      createRollCalls.push(termSpecs)
      return makeStubRoll({ total: 6, natural: 4 })
    })
    return () => { global.game.dcc.DCCRoll.createRoll = original }
  })()
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'longsword' }
  const attackRollResult = { libResult: { total: 18 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d6+2[Slashing]', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)

  expect(createRollCalls).toHaveLength(1)
  expect(createRollCalls[0]).toMatchObject([{
    type: 'Compound',
    formula: '1d6+2',
    flavor: 'Slashing'
  }])

  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.baseDamage).toBe(4)
  expect(result.libDamageResult.modifierDamage).toBe(2)
  expect(result.libDamageResult.total).toBe(6)
})

test('adapter path falls back to passthrough libDamageResult for unparseable formulas', async () => {
  logDispatch.mockClear()
  // Lance's doubleIfMounted produces `(1d8)*2+3` — parser can't digest
  // the parens/multiplier shape → lossless passthrough.
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 13, natural: 5 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'mounted lance' }
  const attackRollResult = { libResult: { total: 18 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '(1d8)*2+3', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.passthrough).toBe(true)
  expect(result.libDamageResult.total).toBe(13)
  expect(result.libDamageResult.breakdown).toEqual([])
  expect(result.libDamageResult.damageDie).toBeNull()
  expect(result.libDamageResult.natural).toBeNull()
  expect(result.libDamageResult.baseDamage).toBeNull()
  expect(result.libDamageResult.modifierDamage).toBeNull()
})

test('adapter path falls back to passthrough when weapon magic bonus is unrecognized', async () => {
  logDispatch.mockClear()
  // Weapon with unparseable `damageWeaponBonus` (e.g. `'+1+1d4'` mixed
  // shape) can't be structured — passthrough keeps the damage rolling
  // without a lib-attributable breakdown.
  const restoreRoll = withSyncCreateRoll(() => makeStubRoll({ total: 10, natural: 5 }))
  const restore = withAutomate(true)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'weird weapon', system: { damageWeaponBonus: '+1+1d4' } }
  const attackRollResult = { libResult: { total: 15 } }

  let result
  try {
    result = await actor._rollDamage(weapon, '1d8+3+1+1d4', attackRollResult, {})
  } finally {
    restore()
    restoreRoll()
  }

  expect(assertDispatched('adapter')).toBe(true)
  expect(result.libDamageResult.passthrough).toBe(true)
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
