/* global game, gameSettingsGetMock */
/**
 * Tests for the Ability Score Change Log (module/ability-score-log.js)
 * Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js
 **/

import { beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'

import {
  abilityLogPreUpdateActor,
  deleteAbilityLogEntry,
  getRecoveryClass,
  getRecoveryText,
  healAbilityLogEntry,
  isHealable,
  logAbilityChange,
  logSpellburn,
  nightsRestButtonState,
  recoverLuckOvernight,
  requiresNote,
  staminaHpDelta,
  staminaHpDeltaForLevel
} from '../ability-score-log.js'

/**
 * Build a minimal Player actor for the helper functions
 */
function makeActor (overrides = {}) {
  const actor = {
    id: 'testactor',
    name: 'Test Character',
    type: 'Player',
    system: {
      abilities: {
        str: { value: 12, max: 12 },
        agl: { value: 14, max: 14 },
        sta: { value: 13, max: 13 },
        per: { value: 10, max: 10 },
        int: { value: 10, max: 10 },
        lck: { value: 11, max: 11 }
      },
      attributes: {
        hp: { value: 8, max: 10 }
      },
      details: {
        level: { value: 2 },
        sheetClass: 'Wizard'
      },
      abilityLog: []
    },
    update: vi.fn()
  }
  return Object.assign(actor, overrides)
}

/**
 * Enable or disable the enableAbilityScoreLog world setting
 */
function setLogEnabled (enabled) {
  gameSettingsGetMock.mockImplementation((module, key) => {
    if (module === 'dcc' && key === 'enableAbilityScoreLog') return enabled
    return undefined
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setLogEnabled(true)
  game.user.id = 'user1'
  game.user.isGM = true
})

/* -------------------------------------------- */
/*  logAbilityChange                            */
/* -------------------------------------------- */

describe('logAbilityChange', () => {
  test('appends a well-formed entry and applies the value change in one update', async () => {
    const actor = makeActor()
    const entry = await logAbilityChange(actor, {
      ability: 'str',
      change: -3,
      type: 'spellburn',
      source: 'Invoke Patron'
    }, { announce: false })

    expect(entry).toMatchObject({
      ability: 'str',
      change: -3,
      type: 'spellburn',
      source: 'Invoke Patron',
      newValue: 9,
      maxChange: 0,
      hpChange: 0,
      healedAmount: 0,
      healedTimestamp: null
    })
    expect(entry.id).toBeTruthy()
    expect(entry.timestamp).toBeGreaterThan(0)

    expect(actor.update).toHaveBeenCalledTimes(1)
    const [update, options] = actor.update.mock.calls[0]
    expect(update['system.abilities.str.value']).toEqual(9)
    expect(update['system.abilityLog']).toEqual([entry])
    expect(options).toEqual({ dcc: { abilityLogged: true } })
  })

  test('gains can also raise max via maxChange', async () => {
    const actor = makeActor()
    const entry = await logAbilityChange(actor, {
      ability: 'str',
      change: 2,
      type: 'otherPermanent',
      source: 'Blessed by Gorhan',
      maxChange: 2
    }, { announce: false })

    const [update] = actor.update.mock.calls[0]
    expect(update['system.abilities.str.value']).toEqual(14)
    expect(update['system.abilities.str.max']).toEqual(14)
    expect(entry.maxChange).toEqual(2)
  })

  test('records hpChange and adjusts hit points with clamping', async () => {
    const actor = makeActor()
    // Stamina 13 -> 11 crosses +1 -> 0 at level 2: ΔHP = -2
    const entry = await logAbilityChange(actor, {
      ability: 'sta',
      change: -2,
      type: 'damage',
      hpChange: -2
    }, { announce: false })

    const [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toEqual(6)
    expect(update['system.attributes.hp.max']).toEqual(8)
    expect(entry.hpChange).toEqual(-2)
  })

  test('hit points clamp at 0', async () => {
    const actor = makeActor()
    actor.system.attributes.hp = { value: 1, max: 6 }
    await logAbilityChange(actor, {
      ability: 'sta',
      change: -6,
      type: 'damage',
      hpChange: -4
    }, { announce: false })

    const [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toEqual(0)
    expect(update['system.attributes.hp.max']).toEqual(5)
  })

  test('max hit points clamp at level + 1, one per hit point roll (#983)', async () => {
    // Level 2: the 0-level roll plus two class levels, each worth at least 1
    // (the lib's calculateMinimumHP)
    const actor = makeActor()
    actor.system.attributes.hp = { value: 2, max: 4 }
    await logAbilityChange(actor, {
      ability: 'sta',
      change: -6,
      type: 'damage',
      hpChange: -4
    }, { announce: false })

    const [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toEqual(1)
    expect(update['system.attributes.hp.max']).toEqual(3)
  })

  test('setting off applies the value change without logging', async () => {
    setLogEnabled(false)
    const actor = makeActor()
    const entry = await logAbilityChange(actor, {
      ability: 'lck',
      change: -1,
      type: 'luckSpend'
    })

    expect(entry).toBeNull()
    expect(actor.update).toHaveBeenCalledTimes(1)
    const [update, options] = actor.update.mock.calls[0]
    expect(update).toEqual({ 'system.abilities.lck.value': 10 })
    expect(options).toBeUndefined()
  })

  test('zero change is a no-op', async () => {
    const actor = makeActor()
    const entry = await logAbilityChange(actor, { ability: 'str', change: 0, type: 'damage' })
    expect(entry).toBeNull()
    expect(actor.update).not.toHaveBeenCalled()
  })
})

/* -------------------------------------------- */
/*  logSpellburn                                */
/* -------------------------------------------- */

describe('logSpellburn', () => {
  test('logs one entry per burned ability in a single update', async () => {
    const actor = makeActor()
    await logSpellburn(actor, { str: 10, agl: 14, sta: 12 }, 'Magic Missile')

    expect(actor.update).toHaveBeenCalledTimes(1)
    const [update, options] = actor.update.mock.calls[0]
    expect(update['system.abilities.str.value']).toEqual(10)
    expect(update['system.abilities.agl.value']).toBeUndefined() // unburned, omitted
    expect(update['system.abilities.sta.value']).toEqual(12)
    expect(options).toEqual({ dcc: { abilityLogged: true } })

    const log = update['system.abilityLog']
    expect(log).toHaveLength(2)
    expect(log[0]).toMatchObject({ ability: 'str', change: -2, type: 'spellburn', source: 'Magic Missile', newValue: 10 })
    expect(log[1]).toMatchObject({ ability: 'sta', change: -1, type: 'spellburn', source: 'Magic Missile', newValue: 12 })
  })

  test('setting off applies the plain update with no log or flag', async () => {
    setLogEnabled(false)
    const actor = makeActor()
    await logSpellburn(actor, { str: 10, agl: 14, sta: 13 }, 'Magic Missile')

    const [update, options] = actor.update.mock.calls[0]
    expect(update).toEqual({ 'system.abilities.str.value': 10 })
    expect(options).toBeUndefined()
  })

  test('no update at all when nothing was burned', async () => {
    const actor = makeActor()
    await logSpellburn(actor, { str: 12, agl: 14, sta: 13 }, 'Magic Missile')
    expect(actor.update).not.toHaveBeenCalled()
  })

  test('leaves hit points alone unless adjustHP is asked for (#921)', async () => {
    const actor = makeActor()
    await logSpellburn(actor, { str: 12, agl: 14, sta: 11 }, 'Magic Missile')

    const [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toBeUndefined()
    expect(update['system.attributes.hp.max']).toBeUndefined()
    expect(update['system.abilityLog'][0].hpChange).toEqual(0)
  })

  test('adjustHP applies the Stamina threshold ΔHP and records it on the Stamina entry (#921)', async () => {
    const actor = makeActor()
    // sta 13 (mod +1) -> 11 (mod 0): Δmod = -1, level 2 is three hit point
    // rolls (0-level + 2 levels) -> -3 HP (#983)
    await logSpellburn(actor, { str: 10, agl: 14, sta: 11 }, 'Magic Missile', { adjustHP: true })

    expect(actor.update).toHaveBeenCalledTimes(1)
    const [update, options] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toEqual(5) // 8 - 3
    expect(update['system.attributes.hp.max']).toEqual(7) // 10 - 3
    expect(options).toEqual({ dcc: { abilityLogged: true } })

    const log = update['system.abilityLog']
    // Only the Stamina entry owns the HP delta, so healing it back is what
    // restores the hit points
    expect(log[0]).toMatchObject({ ability: 'str', hpChange: 0 })
    expect(log[1]).toMatchObject({ ability: 'sta', hpChange: -3 })
  })

  test('adjustHP is a no-op when the burn crosses no modifier threshold (#921)', async () => {
    const actor = makeActor()
    actor.system.abilities.sta.value = 12
    // sta 12 -> 11 stays inside the same modifier band (9-12 is all mod 0)
    await logSpellburn(actor, { sta: 11 }, 'Magic Missile', { adjustHP: true })

    const [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toBeUndefined()
    expect(update['system.attributes.hp.max']).toBeUndefined()
    expect(update['system.abilityLog'][0].hpChange).toEqual(0)
  })

  test('adjustHP still moves hit points with the log setting off (#921)', async () => {
    setLogEnabled(false)
    const actor = makeActor()
    await logSpellburn(actor, { sta: 11 }, 'Magic Missile', { adjustHP: true })

    const [update, options] = actor.update.mock.calls[0]
    expect(update).toEqual({
      'system.abilities.sta.value': 11,
      'system.attributes.hp.value': 5,
      'system.attributes.hp.max': 7
    })
    // No log entry written, so nothing to heal the hit points back from
    expect(update['system.abilityLog']).toBeUndefined()
    expect(options).toBeUndefined()
  })

  test('records only the hit points actually lost when the character cannot afford them (#921)', async () => {
    // Clamping the endpoints independently used to record the full computed
    // loss while applying less, so healing handed back more than was taken
    const actor = makeActor()
    actor.system.details.level.value = 5
    actor.system.attributes.hp = { value: 3, max: 20 }
    // sta 13 (mod +1) -> 8 (mod -1): Δmod = -2, level 5 -> -10 computed
    await logSpellburn(actor, { sta: 8 }, 'Magic Missile', { adjustHP: true })

    const [update] = actor.update.mock.calls[0]
    // Only 3 hit points were there to lose, so that is what moves - and both
    // endpoints move together so the round trip stays exact
    expect(update['system.attributes.hp.value']).toEqual(0)
    expect(update['system.attributes.hp.max']).toEqual(17)
    expect(update['system.abilityLog'][0].hpChange).toEqual(-3)
  })

  test('a clamped burn heals back to exactly where it started (#921)', async () => {
    const actor = makeActor()
    actor.system.details.level.value = 5
    actor.system.attributes.hp = { value: 3, max: 20 }
    await logSpellburn(actor, { sta: 8 }, 'Magic Missile', { adjustHP: true })
    const [burnUpdate] = actor.update.mock.calls[0]

    actor.system.abilities.sta.value = 8
    actor.system.attributes.hp = { value: 0, max: 17 }
    actor.system.abilityLog = burnUpdate['system.abilityLog']
    actor.update.mockClear()

    await healAbilityLogEntry(actor, actor.system.abilityLog[0].id, { healAll: true })
    const [healUpdate] = actor.update.mock.calls[0]
    expect(healUpdate['system.abilities.sta.value']).toEqual(13)
    // Back to 3/20 - never more than was taken
    expect(healUpdate['system.attributes.hp.value']).toEqual(3)
    expect(healUpdate['system.attributes.hp.max']).toEqual(20)
  })

  test('an out-of-table Stamina score clamps instead of reading as modifier 0 (#921)', async () => {
    // CONFIG.DCC.abilityModifiers spans 0-24; a raw `[score] || 0` lookup made
    // a burn from 25 compute a POSITIVE ΔHP, granting hit points for burning
    const actor = makeActor()
    actor.system.abilities.sta = { value: 25, max: 25 }
    actor.system.details.level.value = 3

    expect(staminaHpDeltaForLevel(3, 25, 23).hpChange).toBeLessThanOrEqual(0)

    await logSpellburn(actor, { sta: 23 }, 'Magic Missile', { adjustHP: true })
    const [update] = actor.update.mock.calls[0]
    const hpChange = update['system.abilityLog'][0].hpChange
    expect(hpChange).toBeLessThanOrEqual(0)
    expect(update['system.attributes.hp.value'] ?? 8).toBeLessThanOrEqual(8)
  })

  test('announces the hit point cost even with the log setting off (#921)', async () => {
    // No entry means no Heal button, so the chat card is the only record the
    // player gets - a silent hit point drop is worse than no log
    setLogEnabled(false)
    const actor = makeActor()
    await logSpellburn(actor, { sta: 11 }, 'Magic Missile', { adjustHP: true })

    expect(actor.update).toHaveBeenCalledTimes(1)
    const [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toEqual(5)
    expect(update['system.abilityLog']).toBeUndefined()
    expect(global.CONFIG.ChatMessage.documentClass.create).toHaveBeenCalled()
  })

  test('stays silent with the log off when no hit points moved (#921)', async () => {
    setLogEnabled(false)
    const actor = makeActor()
    await logSpellburn(actor, { str: 10 }, 'Magic Missile', { adjustHP: true })
    expect(global.CONFIG.ChatMessage.documentClass.create).not.toHaveBeenCalled()
  })

  test('healing the spellburn entry restores the hit points it cost (#921)', async () => {
    const actor = makeActor()
    await logSpellburn(actor, { sta: 11 }, 'Magic Missile', { adjustHP: true })
    const [burnUpdate] = actor.update.mock.calls[0]

    // Re-seed the actor with the post-burn state the update would have written
    actor.system.abilities.sta.value = 11
    actor.system.attributes.hp = { value: 5, max: 7 }
    actor.system.abilityLog = burnUpdate['system.abilityLog']
    actor.update.mockClear()

    const entry = actor.system.abilityLog[0]
    const healed = await healAbilityLogEntry(actor, entry.id, { healAll: true })

    const [healUpdate] = actor.update.mock.calls[0]
    expect(healUpdate['system.abilities.sta.value']).toEqual(13)
    expect(healUpdate['system.attributes.hp.value']).toEqual(8)
    expect(healUpdate['system.attributes.hp.max']).toEqual(10)
    expect(healed.hpChange).toEqual(0)
  })
})

/* -------------------------------------------- */
/*  Recovery class derivation                   */
/* -------------------------------------------- */

describe('recovery class derivation', () => {
  test('spellburn and damage heal with rest', () => {
    const actor = makeActor()
    expect(getRecoveryClass('spellburn', actor)).toEqual('rest')
    expect(getRecoveryClass('damage', actor)).toEqual('rest')
    expect(getRecoveryClass('otherTemporary', actor)).toEqual('rest')
  })

  test('luck spend regenerates for thieves and halflings, permanent for others', () => {
    const wizard = makeActor()
    expect(getRecoveryClass('luckSpend', wizard)).toEqual('permanent')

    const thief = makeActor()
    thief.system.details.sheetClass = 'Thief'
    expect(getRecoveryClass('luckSpend', thief)).toEqual('luckRegen')

    const halfling = makeActor()
    halfling.system.details.sheetClass = 'Halfling'
    expect(getRecoveryClass('luckSpend', halfling)).toEqual('luckRegen')
  })

  test('permanent types do not heal', () => {
    const actor = makeActor()
    for (const type of ['rollTheBody', 'bleedOut', 'corruption', 'otherPermanent']) {
      expect(getRecoveryClass(type, actor)).toEqual('permanent')
    }
  })

  test('unknown and manual types derive unknown', () => {
    const actor = makeActor()
    expect(getRecoveryClass('manual', actor)).toEqual('unknown')
    expect(getRecoveryClass('somethingElse', actor)).toEqual('unknown')
  })

  test('recovery text for thief luck includes the level', () => {
    const thief = makeActor()
    thief.system.details.sheetClass = 'Thief'
    thief.system.details.level.value = 3
    const text = getRecoveryText({ type: 'luckSpend' }, thief)
    expect(text).toContain('3')
  })
})

/* -------------------------------------------- */
/*  Healability                                 */
/* -------------------------------------------- */

describe('isHealable', () => {
  test('rest-class losses are healable', () => {
    const actor = makeActor()
    expect(isHealable({ change: -3, type: 'spellburn', healedAmount: 0 }, actor)).toBe(true)
  })

  test('permanent-class entries are not healable', () => {
    const actor = makeActor()
    expect(isHealable({ change: -1, type: 'rollTheBody', healedAmount: 0 }, actor)).toBe(false)
    expect(isHealable({ change: -2, type: 'luckSpend', healedAmount: 0 }, actor)).toBe(false)
  })

  test('luck spend is healable for a thief', () => {
    const thief = makeActor()
    thief.system.details.sheetClass = 'Thief'
    expect(isHealable({ change: -2, type: 'luckSpend', healedAmount: 0 }, thief)).toBe(true)
  })

  test('positive entries are not healable', () => {
    const actor = makeActor()
    expect(isHealable({ change: 2, type: 'heal', healedAmount: 0 }, actor)).toBe(false)
  })

  test('fully healed entries are not healable', () => {
    const actor = makeActor()
    expect(isHealable({ change: -3, type: 'spellburn', healedAmount: 3 }, actor)).toBe(false)
  })
})

/* -------------------------------------------- */
/*  Heal button                                 */
/* -------------------------------------------- */

describe('healAbilityLogEntry', () => {
  function actorWithEntry (entryOverrides = {}, actorOverrides = {}) {
    const actor = makeActor(actorOverrides)
    actor.system.abilities.str.value = 9
    actor.system.abilityLog = [{
      id: 'entry1',
      timestamp: 1000,
      ability: 'str',
      change: -3,
      maxChange: 0,
      type: 'spellburn',
      source: 'Invoke Patron',
      newValue: 9,
      hpChange: 0,
      healedAmount: 0,
      healedTimestamp: null,
      ...entryOverrides
    }]
    return actor
  }

  test('each click restores exactly 1 point and increments healedAmount', async () => {
    const actor = actorWithEntry()
    const updated = await healAbilityLogEntry(actor, 'entry1')

    expect(updated.healedAmount).toEqual(1)
    expect(updated.healedTimestamp).toBeGreaterThan(0)
    const [update, options] = actor.update.mock.calls[0]
    expect(update['system.abilities.str.value']).toEqual(10)
    expect(update['system.abilityLog'][0].healedAmount).toEqual(1)
    expect(options).toEqual({ dcc: { abilityLogged: true } })
  })

  test('shift-click heals the full remainder', async () => {
    const actor = actorWithEntry({ healedAmount: 1 })
    actor.system.abilities.str.value = 10
    const updated = await healAbilityLogEntry(actor, 'entry1', { healAll: true })

    expect(updated.healedAmount).toEqual(3)
    const [update] = actor.update.mock.calls[0]
    expect(update['system.abilities.str.value']).toEqual(12)
  })

  test('restores clamp to the ability max', async () => {
    const actor = actorWithEntry()
    actor.system.abilities.str.value = 12 // already back at max via other means
    const updated = await healAbilityLogEntry(actor, 'entry1')

    expect(updated.healedAmount).toEqual(1)
    const [update] = actor.update.mock.calls[0]
    expect(update['system.abilities.str.value']).toEqual(12)
  })

  test('no further healing once healedAmount equals the loss', async () => {
    const actor = actorWithEntry({ healedAmount: 3 })
    const result = await healAbilityLogEntry(actor, 'entry1')
    expect(result).toBeNull()
    expect(actor.update).not.toHaveBeenCalled()
  })

  test('permanent entries cannot be healed', async () => {
    const actor = actorWithEntry({ type: 'rollTheBody' })
    const result = await healAbilityLogEntry(actor, 'entry1')
    expect(result).toBeNull()
    expect(actor.update).not.toHaveBeenCalled()
  })

  test('stamina heal restores HP symmetrically when the step crosses a threshold', async () => {
    const actor = makeActor()
    // Stamina dropped 13 -> 11 (mod +1 -> 0) at level 2 with -2 HP recorded
    actor.system.abilities.sta.value = 11
    actor.system.abilityLog = [{
      id: 'entry1',
      timestamp: 1000,
      ability: 'sta',
      change: -2,
      maxChange: 0,
      type: 'damage',
      source: '',
      newValue: 11,
      hpChange: -2,
      healedAmount: 0,
      healedTimestamp: null
    }]

    // First heal: 11 -> 12, mod 0 -> 0, no threshold crossing
    let updated = await healAbilityLogEntry(actor, 'entry1')
    expect(updated.hpChange).toEqual(-2)
    let [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toBeUndefined()

    // Second heal: 12 -> 13, mod 0 -> +1 crosses back: ΔHP = +2
    actor.system.abilities.sta.value = 12
    actor.system.abilityLog = [updated]
    actor.update.mockClear()
    updated = await healAbilityLogEntry(actor, 'entry1')

    expect(updated.hpChange).toEqual(0)
    ;[update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toEqual(10)
    expect(update['system.attributes.hp.max']).toEqual(12)
  })

  test('no HP restore when the entry recorded no hpChange', async () => {
    const actor = makeActor()
    // Same threshold crossing but the judge unchecked the HP adjustment
    actor.system.abilities.sta.value = 12
    actor.system.abilityLog = [{
      id: 'entry1',
      timestamp: 1000,
      ability: 'sta',
      change: -1,
      maxChange: 0,
      type: 'damage',
      source: '',
      newValue: 12,
      hpChange: 0,
      healedAmount: 0,
      healedTimestamp: null
    }]

    const updated = await healAbilityLogEntry(actor, 'entry1')
    expect(updated.hpChange).toEqual(0)
    const [update] = actor.update.mock.calls[0]
    expect(update['system.attributes.hp.value']).toBeUndefined()
  })
})

/* -------------------------------------------- */
/*  Delete                                      */
/* -------------------------------------------- */

describe('deleteAbilityLogEntry', () => {
  test('GM can delete an entry without changing the ability score', async () => {
    const actor = makeActor()
    actor.system.abilityLog = [{ id: 'entry1' }, { id: 'entry2' }]
    await deleteAbilityLogEntry(actor, 'entry1')

    const [update, options] = actor.update.mock.calls[0]
    expect(update).toEqual({ 'system.abilityLog': [{ id: 'entry2' }] })
    expect(options).toEqual({ dcc: { abilityLogged: true } })
  })

  test('non-GM cannot delete', async () => {
    game.user.isGM = false
    const actor = makeActor()
    actor.system.abilityLog = [{ id: 'entry1' }]
    await deleteAbilityLogEntry(actor, 'entry1')
    expect(actor.update).not.toHaveBeenCalled()
  })
})

/* -------------------------------------------- */
/*  recoverLuckOvernight (#1064)                */
/* -------------------------------------------- */

describe('recoverLuckOvernight', () => {
  function luckSpend (id, timestamp, change, healedAmount = 0) {
    return { id, timestamp, ability: 'lck', change, type: 'luckSpend', source: '', healedAmount, healedTimestamp: null }
  }

  function thief ({ level = 2, value = 6, max = 11, log } = {}) {
    const actor = makeActor()
    actor.system.details = { level: { value: level }, sheetClass: 'Thief' }
    actor.system.abilities.lck = { value, max }
    actor.system.abilityLog = log ?? [
      luckSpend('newer', 2000, -3),
      luckSpend('older', 1000, -2, 1),
      { id: 'damage', timestamp: 500, ability: 'lck', change: -4, type: 'damage', healedAmount: 0 }
    ]
    return actor
  }

  test('heals one point per level against the oldest unrecovered Luck spends', async () => {
    const actor = thief()
    const result = await recoverLuckOvernight(actor)

    expect(result).toEqual({ status: 'recovered', restored: 2, remaining: 2 })
    const [update, options] = actor.update.mock.calls[0]
    expect(update['system.abilities.lck.value']).toEqual(8)
    const byId = Object.fromEntries(update['system.abilityLog'].map(e => [e.id, e]))
    expect(byId.older.healedAmount).toEqual(2) // finished first
    expect(byId.newer.healedAmount).toEqual(1)
    expect(byId.damage.healedAmount).toEqual(0) // only Luck spends recover
    expect(options).toEqual({ dcc: { abilityLogged: true } })
    expect(global.CONFIG.ChatMessage.documentClass.create).toHaveBeenCalledTimes(1)
  })

  test('never restores more than was spent or past the natural maximum', async () => {
    const owedLess = thief({ level: 5, log: [luckSpend('a', 1000, -2)] })
    expect((await recoverLuckOvernight(owedLess)).restored).toEqual(2)

    const nearMax = thief({ level: 5, value: 10 })
    expect((await recoverLuckOvernight(nearMax)).restored).toEqual(1)

    // An unset (schema default 0) level recovers as level 1, matching the log text
    const unsetLevel = thief({ level: 0 })
    expect((await recoverLuckOvernight(unsetLevel)).restored).toEqual(1)

    const atMax = thief({ value: 11 })
    expect(await recoverLuckOvernight(atMax)).toEqual({ status: 'nothingToRecover', restored: 0, remaining: 4 })
    expect(atMax.update).not.toHaveBeenCalled()
  })

  test('does nothing for classes without luckRecovers, or with the log off', async () => {
    const wizard = thief()
    wizard.system.details.sheetClass = 'Wizard'
    expect((await recoverLuckOvernight(wizard)).status).toEqual('notEligible')

    setLogEnabled(false)
    const unlogged = thief()
    expect((await recoverLuckOvernight(unlogged)).status).toEqual('logDisabled')

    expect(wizard.update).not.toHaveBeenCalled()
    expect(unlogged.update).not.toHaveBeenCalled()
  })

  test('a second click while a rest is running is refused, so only one card posts', async () => {
    const actor = thief()
    const [first, second] = await Promise.all([recoverLuckOvernight(actor), recoverLuckOvernight(actor)])
    expect(first.status).toEqual('recovered')
    expect(second.status).toEqual('busy')
    expect(actor.update).toHaveBeenCalledTimes(1)
    expect(global.CONFIG.ChatMessage.documentClass.create).toHaveBeenCalledTimes(1)
    // The guard is released afterwards
    expect((await recoverLuckOvernight(actor)).status).not.toEqual('busy')
  })

  test('button is disabled with a reason when nothing is owed or Luck is at max', () => {
    expect(nightsRestButtonState(thief())).toEqual({ disabled: false, hint: expect.stringContaining('AbilityLogNightsRestHint') })
    expect(nightsRestButtonState(thief({ value: 11 }))).toEqual({ disabled: true, hint: expect.stringContaining('AbilityLogNightsRestAtMaxHint') })
    expect(nightsRestButtonState(thief({ log: [] }))).toEqual({ disabled: true, hint: expect.stringContaining('AbilityLogNightsRestNothingHint') })
  })
})

/* -------------------------------------------- */
/*  Stamina ΔHP                                 */
/* -------------------------------------------- */

describe('staminaHpDelta', () => {
  test('ΔHP = Δmod × (level + 1) (#983)', () => {
    const actor = makeActor()
    actor.system.details.level.value = 3
    // 13 (mod +1) -> 8 (mod -1): Δmod = -2, level 3 is four hit point rolls
    // (0-level + 3 levels) -> -8
    expect(staminaHpDelta(actor, 13, 8)).toEqual({ hpChange: -8, oldMod: 1, newMod: -1 })
  })

  test('level 1 counts the 0-level roll too (#983)', () => {
    const actor = makeActor()
    actor.system.details.level.value = 1
    expect(staminaHpDelta(actor, 13, 11).hpChange).toEqual(-2)
  })

  test('level 0 is the single 0-level roll', () => {
    const actor = makeActor()
    actor.system.details.level.value = 0
    expect(staminaHpDelta(actor, 13, 11).hpChange).toEqual(-1)
  })

  test('no threshold crossing means no HP change', () => {
    const actor = makeActor()
    expect(staminaHpDelta(actor, 12, 10).hpChange).toEqual(0)
  })

  test('the bare-level form the spellburn dialog previews with matches (#921)', () => {
    // The roll modifier dialog has the term's level, not the actor document
    expect(staminaHpDeltaForLevel(3, 13, 8)).toEqual({ hpChange: -8, oldMod: 1, newMod: -1 })
    expect(staminaHpDeltaForLevel(0, 13, 11).hpChange).toEqual(-1)
    expect(staminaHpDeltaForLevel(2, 12, 10).hpChange).toEqual(0)
  })
})

/* -------------------------------------------- */
/*  Note requirement                            */
/* -------------------------------------------- */

describe('requiresNote', () => {
  test('the generic temporary and permanent reasons require a note', () => {
    expect(requiresNote('otherTemporary')).toBe(true)
    expect(requiresNote('otherPermanent')).toBe(true)
  })

  test('rule-specific reasons do not', () => {
    for (const type of ['spellburn', 'damage', 'luckSpend', 'rollTheBody', 'bleedOut', 'corruption', 'heal', 'manual']) {
      expect(requiresNote(type)).toBe(false)
    }
  })
})

/* -------------------------------------------- */
/*  Fallback preUpdateActor hook                */
/* -------------------------------------------- */

describe('abilityLogPreUpdateActor', () => {
  test('injects a manual entry for direct ability edits', () => {
    const actor = makeActor()
    const changes = { system: { abilities: { str: { value: 9 } } } }
    abilityLogPreUpdateActor(actor, changes, {}, 'user1')

    const log = changes.system.abilityLog
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ ability: 'str', change: -3, type: 'manual', newValue: 9 })
  })

  test('handles flattened update keys', () => {
    const actor = makeActor()
    const changes = { 'system.abilities.lck.value': 9 }
    abilityLogPreUpdateActor(actor, changes, {}, 'user1')

    const log = changes.system.abilityLog
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ ability: 'lck', change: -2, type: 'manual', newValue: 9 })
  })

  test('skips when the abilityLogged flag is present', () => {
    const actor = makeActor()
    const changes = { system: { abilities: { str: { value: 9 } } } }
    abilityLogPreUpdateActor(actor, changes, { dcc: { abilityLogged: true } }, 'user1')
    expect(changes.system.abilityLog).toBeUndefined()
  })

  test('setting off means no hook writes', () => {
    setLogEnabled(false)
    const actor = makeActor()
    const changes = { system: { abilities: { str: { value: 9 } } } }
    abilityLogPreUpdateActor(actor, changes, {}, 'user1')
    expect(changes.system.abilityLog).toBeUndefined()
  })

  test('ignores other users\' updates', () => {
    const actor = makeActor()
    const changes = { system: { abilities: { str: { value: 9 } } } }
    abilityLogPreUpdateActor(actor, changes, {}, 'someoneElse')
    expect(changes.system.abilityLog).toBeUndefined()
  })

  test('ignores NPC actors', () => {
    const actor = makeActor({ type: 'NPC' })
    const changes = { system: { abilities: { str: { value: 9 } } } }
    abilityLogPreUpdateActor(actor, changes, {}, 'user1')
    expect(changes.system.abilityLog).toBeUndefined()
  })

  test('ignores max-only edits and unchanged values', () => {
    const actor = makeActor()
    const changes = { system: { abilities: { str: { max: 14 }, agl: { value: 14 } } } }
    abilityLogPreUpdateActor(actor, changes, {}, 'user1')
    expect(changes.system.abilityLog).toBeUndefined()
  })
})
