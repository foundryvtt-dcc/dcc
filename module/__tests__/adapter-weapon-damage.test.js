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
import { buildDamageInput, buildPassthroughDamageResult, extractWeaponMagicBonus, parseDamageFormula, peelTrailingFlavor } from '../adapter/damage-input.mjs'
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
  // Per-term flavor patterns have the bracket MID-formula, not trailing —
  // peel leaves them alone so the gate's per-term-flavor check can reject.
  expect(peelTrailingFlavor('1d6[fire]+1d6[cold]')).toEqual({ formula: '1d6[fire]+1d6', flavor: 'cold' })
  expect(peelTrailingFlavor('')).toEqual({ formula: '', flavor: '' })
  expect(peelTrailingFlavor(null)).toEqual({ formula: '', flavor: '' })
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

test('buildDamageInput peels positive magicBonus off strengthModifier', () => {
  // PC with strength +2 wielding a +1 sword → formula `1d8+2+1`, parsed
  // `modifier: 3`. Magic bonus should attribute as `magicBonus: 1`, not
  // a fake +3 Strength.
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 }, { magicBonus: 1 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 2, magicBonus: 1 })
})

test('buildDamageInput ignores zero magicBonus (non-magical weapons)', () => {
  const input = buildDamageInput({ diceCount: 1, die: 'd8', modifier: 3 }, { magicBonus: 0 })
  expect(input).toEqual({ damageDie: 'd8', diceCount: 1, strengthModifier: 3 })
  expect(input.magicBonus).toBeUndefined()
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

test('extractWeaponMagicBonus parses positive-integer damageWeaponBonus', () => {
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '+1' } })).toBe(1)
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '+3' } })).toBe(3)
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '2' } })).toBe(2)
})

test('extractWeaponMagicBonus returns 0 for missing or empty bonus', () => {
  expect(extractWeaponMagicBonus({})).toBe(0)
  expect(extractWeaponMagicBonus({ system: {} })).toBe(0)
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '' } })).toBe(0)
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '   ' } })).toBe(0)
})

test('extractWeaponMagicBonus returns null for dice-bearing or negative bonuses', () => {
  // Dice-bearing magic bonus (e.g. `+1d4 fire damage` style) — legacy only.
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '+1d4' } })).toBeNull()
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '1d6' } })).toBeNull()
  // Cursed weapons — legacy only for this slice.
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: '-1' } })).toBeNull()
  // Unparsable.
  expect(extractWeaponMagicBonus({ system: { damageWeaponBonus: 'wat' } })).toBeNull()
})

test('buildPassthroughDamageResult mirrors the parseable shape with null slots (sub-slice a)', () => {
  // Sub-slice (a) accepts unparseable formulas as a lossless passthrough
  // so the damage gate can be broadened. The passthrough shape matches
  // the parseable case's fields so downstream consumers read uniformly.
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

test('_canRouteDamageViaAdapter rejects when the attack went through legacy', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'sword' }
  expect(actor._canRouteDamageViaAdapter(weapon, '1d8', {}, {})).toBe(false)
})

test('_canRouteDamageViaAdapter rejects per-term flavors', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'sword' }
  const attackRollResult = { libResult: { total: 15 } }

  expect(actor._canRouteDamageViaAdapter(weapon, '1d6[fire]+1d6[cold]', attackRollResult, {})).toBe(false)
})

test('_canRouteDamageViaAdapter accepts unparseable formulas as passthrough (sub-slice a)', () => {
  // Previously rejected via `parseDamageFormula === null`. Sub-slice (a)
  // drops that rejection so unparseable formulas route via adapter with
  // a lossless passthrough libDamageResult. Lance's `doubleIfMounted`
  // produces `(1d8)*2+3`; exotic multi-die weapons produce `1d8+1d4`;
  // homebrew `damageOverride` can produce arbitrary formulas.
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'mounted lance' }
  const attackRollResult = { libResult: { total: 15 } }

  expect(actor._canRouteDamageViaAdapter(weapon, '(1d8)*2+3', attackRollResult, {})).toBe(true)
  expect(actor._canRouteDamageViaAdapter(weapon, '1d8+1d4', attackRollResult, {})).toBe(true)
  expect(actor._canRouteDamageViaAdapter(weapon, 'max(1d4,2)', attackRollResult, {})).toBe(true)
})

test('_canRouteDamageViaAdapter accepts trailing bracket-flavor formulas (sub-slice b)', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'sword' }
  const attackRollResult = { libResult: { total: 15 } }

  // Single-die + flat modifier + trailing flavor — routes via adapter.
  expect(actor._canRouteDamageViaAdapter(weapon, '1d6+2[Slashing]', attackRollResult, {})).toBe(true)
  // Multi-die + modifier + trailing flavor — routes via adapter.
  expect(actor._canRouteDamageViaAdapter(weapon, '2d4-1[Piercing]', attackRollResult, {})).toBe(true)
  // Die-immediately-followed-by-bracket (`1d8[Slashing]`) still falls to
  // legacy — matches legacy's `/\d+d\d+\[/` `hasPerTermFlavors` branch
  // which routes through Foundry's native `Roll` rather than the
  // Compound term. Fold-in of that case is a separate sub-slice.
  expect(actor._canRouteDamageViaAdapter(weapon, '1d8[Slashing]', attackRollResult, {})).toBe(false)
})

test('_canRouteDamageViaAdapter accepts backstab (session 9)', () => {
  // Session 9 dropped the `options.backstab → false` gate. `rollWeaponAttack`
  // already swaps the formula to `weapon.system.backstabDamage` BEFORE
  // reaching `_rollDamage`, so by the time the adapter sees it, it's the
  // alternate die; no separate translation is needed.
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: 'dagger' }
  const attackRollResult = { libResult: { total: 15 } }

  expect(actor._canRouteDamageViaAdapter(weapon, '1d10', attackRollResult, { backstab: true })).toBe(true)
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

test('_canRouteDamageViaAdapter accepts +1 weapon with two-mod formula', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const weapon = { name: '+1 longsword', system: { damageWeaponBonus: '+1' } }
  const attackRollResult = { libResult: { total: 15 } }

  expect(actor._canRouteDamageViaAdapter(weapon, '1d8+2+1', attackRollResult, {})).toBe(true)
  expect(actor._canRouteDamageViaAdapter(weapon, '1d8+1', attackRollResult, {})).toBe(true)
})

test('_canRouteDamageViaAdapter rejects dice-bearing or cursed magic bonuses', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const attackRollResult = { libResult: { total: 15 } }
  const diceBonusWeapon = { name: 'flaming sword', system: { damageWeaponBonus: '+1d4' } }
  const cursedWeapon = { name: 'cursed blade', system: { damageWeaponBonus: '-1' } }

  expect(actor._canRouteDamageViaAdapter(diceBonusWeapon, '1d8+2+1d4', attackRollResult, {})).toBe(false)
  expect(actor._canRouteDamageViaAdapter(cursedWeapon, '1d8+2-1', attackRollResult, {})).toBe(false)
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

test('adapter path attributes +1 weapon bonus as magic, not Strength', async () => {
  logDispatch.mockClear()
  // PC with Str +2 wielding a +1 longsword — formula `1d8+2+1`, natural 5.
  // Total 5 + 2 (str) + 1 (magic) = 8. Breakdown should have separate
  // `Strength` and `magic` entries — no bogus +3 Strength.
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

  // Adapter dispatches (bracket-flavored formula no longer falls to legacy).
  expect(assertDispatched('adapter')).toBe(true)
  expect(assertDispatched('legacy')).toBe(false)

  // The Compound term fed to DCCRoll.createRoll splits the flavor off the
  // formula — chat rendering parity with the legacy path's same behavior.
  expect(createRollCalls).toHaveLength(1)
  expect(createRollCalls[0]).toMatchObject([{
    type: 'Compound',
    formula: '1d6+2',
    flavor: 'Slashing'
  }])

  // libDamageResult parses the cleaned formula: natural 4 + mod 2 = 6.
  expect(result.libDamageResult).toBeDefined()
  expect(result.libDamageResult.baseDamage).toBe(4)
  expect(result.libDamageResult.modifierDamage).toBe(2)
  expect(result.libDamageResult.total).toBe(6)
})

test('adapter path falls back to passthrough libDamageResult for unparseable formulas (sub-slice a)', async () => {
  logDispatch.mockClear()
  // Lance's doubleIfMounted produces `(1d8)*2+3`. parseDamageFormula
  // can't digest the parens / multiplier shape. Previously routed to
  // legacy via the `parseDamageFormula === null` gate rejection; now
  // routes via adapter as a lossless passthrough.
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
  // Fields the lib would populate are null — callers check `passthrough`
  // before trusting them.
  expect(result.libDamageResult.damageDie).toBeNull()
  expect(result.libDamageResult.natural).toBeNull()
  expect(result.libDamageResult.baseDamage).toBeNull()
  expect(result.libDamageResult.modifierDamage).toBeNull()
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
