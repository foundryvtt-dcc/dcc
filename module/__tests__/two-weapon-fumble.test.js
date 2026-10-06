/* global ChatMessage, game, gameSettingsGetMock */
/**
 * Halfling two-weapon fumbles (#968): a natural 1 only fumbles when both
 * hands roll one. Covers the pairing helpers and the attack card output.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'
import {
  findTwoWeaponPartner,
  isHalflingTwoWeaponAttack,
  resolveTwoWeaponFumble,
  settleTwoWeaponPartner,
  twoWeaponFumbleNote,
  twoWeaponPairContext
} from '../two-weapon-fumble.mjs'

vi.mock('../actor-level-change.js')

const primary = { name: 'Short sword', system: { twoWeaponPrimary: true, twoWeaponSecondary: false } }
const offHand = { name: 'Dagger', system: { twoWeaponPrimary: false, twoWeaponSecondary: true } }
const halfling = { id: 'actor-1', classId: 'halfling' }

function makeCombat ({ started = true, round = 2, actorId = 'actor-1' } = {}) {
  return {
    id: 'combat-1',
    started,
    round,
    combatants: [{ id: 'combatant-1', actor: { id: actorId } }]
  }
}

function pairMessage (id, pair) {
  return {
    id,
    flags: {
      dcc: {
        twoWeaponPair: {
          combatId: 'combat-1',
          round: 2,
          combatantId: 'combatant-1',
          actorId: 'actor-1',
          role: 'primary',
          fumbled: false,
          pairedWith: null,
          ...pair
        }
      }
    }
  }
}

const offHandContext = { combatId: 'combat-1', round: 2, combatantId: 'combatant-1', actorId: 'actor-1', role: 'secondary' }

describe('isHalflingTwoWeaponAttack', () => {
  test('needs a halfling and a two-weapon hand', () => {
    expect(isHalflingTwoWeaponAttack(halfling, primary)).toBe(true)
    expect(isHalflingTwoWeaponAttack(halfling, offHand)).toBe(true)
    expect(isHalflingTwoWeaponAttack({ classId: 'warrior' }, primary)).toBe(false)
    expect(isHalflingTwoWeaponAttack(halfling, { system: {} })).toBe(false)
  })
})

describe('twoWeaponPairContext', () => {
  let originalCombat
  beforeEach(() => { originalCombat = game.combat })
  afterEach(() => { game.combat = originalCombat })

  test('keys the attack by combat, round, combatant, actor and hand', () => {
    game.combat = makeCombat()
    expect(twoWeaponPairContext(halfling, offHand)).toEqual(offHandContext)
  })

  test('is null without a started combat or a combatant for the actor', () => {
    game.combat = null
    expect(twoWeaponPairContext(halfling, primary)).toBeNull()
    game.combat = makeCombat({ started: false })
    expect(twoWeaponPairContext(halfling, primary)).toBeNull()
    game.combat = makeCombat({ round: 0 })
    expect(twoWeaponPairContext(halfling, primary)).toBeNull()
    game.combat = makeCombat({ actorId: 'someone-else' })
    expect(twoWeaponPairContext(halfling, primary)).toBeNull()
  })

  test('is null for a weapon not set up for two-weapon fighting', () => {
    game.combat = makeCombat()
    expect(twoWeaponPairContext(halfling, { system: {} })).toBeNull()
  })
})

describe('findTwoWeaponPartner', () => {
  test("finds the other hand's card from the same round", () => {
    const partner = pairMessage('m1')
    expect(findTwoWeaponPartner(offHandContext, [partner])).toBe(partner)
  })

  test('prefers the newest match', () => {
    const older = pairMessage('m1')
    const newer = pairMessage('m2')
    expect(findTwoWeaponPartner(offHandContext, [older, newer])).toBe(newer)
  })

  test('skips the same hand, other rounds, combats, combatants and actors', () => {
    const messages = [
      pairMessage('same-hand', { role: 'secondary' }),
      pairMessage('old-round', { round: 1 }),
      pairMessage('other-combat', { combatId: 'combat-2' }),
      pairMessage('other-combatant', { combatantId: 'combatant-2' }),
      pairMessage('other-actor', { actorId: 'actor-2' }),
      { id: 'plain', flags: { dcc: {} } }
    ]
    expect(findTwoWeaponPartner(offHandContext, messages)).toBeNull()
  })

  test('skips a card that is already paired, by its own flag or by another card', () => {
    const pairedByFlag = pairMessage('m1', { pairedWith: 'm0' })
    expect(findTwoWeaponPartner(offHandContext, [pairedByFlag])).toBeNull()

    const pointedAt = pairMessage('m2')
    const pointer = pairMessage('m3', { role: 'secondary', pairedWith: 'm2' })
    expect(findTwoWeaponPartner(offHandContext, [pointedAt, pointer])).toBeNull()
  })

  test('is null without a context', () => {
    expect(findTwoWeaponPartner(null, [pairMessage('m1')])).toBeNull()
  })
})

describe('resolveTwoWeaponFumble', () => {
  const partner = fumbled => pairMessage('m1', { fumbled })

  test('holds a natural 1 when the other hand is unknown', () => {
    expect(resolveTwoWeaponFumble(true, null)).toEqual({ state: 'held', partnerState: null })
    expect(resolveTwoWeaponFumble(false, null)).toEqual({ state: null, partnerState: null })
  })

  test('both natural 1s fumble on the second card', () => {
    expect(resolveTwoWeaponFumble(true, partner(true))).toEqual({ state: 'confirmed', partnerState: 'confirmedElsewhere' })
  })

  test('a single natural 1 is cleared, on whichever card rolled it', () => {
    expect(resolveTwoWeaponFumble(true, partner(false))).toEqual({ state: 'cleared', partnerState: null })
    expect(resolveTwoWeaponFumble(false, partner(true))).toEqual({ state: null, partnerState: 'cleared' })
  })

  test('no natural 1 on either hand changes nothing', () => {
    expect(resolveTwoWeaponFumble(false, partner(false))).toEqual({ state: null, partnerState: null })
  })
})

describe('twoWeaponFumbleNote', () => {
  test('maps each state to its note', () => {
    expect(twoWeaponFumbleNote('held')).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleNote'))
    expect(twoWeaponFumbleNote('cleared')).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleCleared'))
    expect(twoWeaponFumbleNote('confirmed')).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleConfirmed'))
    expect(twoWeaponFumbleNote('confirmedElsewhere')).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleConfirmedElsewhere'))
    expect(twoWeaponFumbleNote(null)).toBe('')
  })
})

describe('settleTwoWeaponPartner', () => {
  function makePartner (overrides = {}) {
    return {
      system: { twoWeaponNote: 'old', fumbleInlineRoll: '<a>1d4</a>', fumblePrompt: 'offer', fumbleRollFormula: '1d4', weaponName: 'Dagger' },
      canUserModify: vi.fn(() => true),
      update: vi.fn(async () => {}),
      ...overrides
    }
  }

  test('marks the partner paired without touching its card when its state is unchanged', async () => {
    const partner = makePartner()
    const render = vi.fn()
    await settleTwoWeaponPartner(partner, 'new-id', null, render)
    expect(partner.update).toHaveBeenCalledWith({ 'flags.dcc.twoWeaponPair.pairedWith': 'new-id' })
    expect(render).not.toHaveBeenCalled()
  })

  test('replaces the note, drops the held prompt, and re-renders the content', async () => {
    const partner = makePartner()
    const render = vi.fn(async system => `<p>${system.twoWeaponNote}|${system.weaponName}|${system.fumbleInlineRoll}</p>`)
    await settleTwoWeaponPartner(partner, 'new-id', 'cleared', render)
    const note = game.i18n.localize('DCC.HalflingTwoWeaponFumbleCleared')
    expect(partner.update).toHaveBeenCalledWith({
      'flags.dcc.twoWeaponPair.pairedWith': 'new-id',
      'flags.dcc.twoWeaponFumble': 'cleared',
      'system.twoWeaponNote': note,
      'system.fumbleInlineRoll': '',
      'system.fumblePrompt': '',
      'system.fumbleRollFormula': '',
      content: `<p>${note}|Dagger|</p>`
    })
  })

  test("leaves a card this user can't update alone", async () => {
    const partner = makePartner({ canUserModify: vi.fn(() => false) })
    await settleTwoWeaponPartner(partner, 'new-id', 'cleared', vi.fn())
    expect(partner.update).not.toHaveBeenCalled()
  })

  test('logs instead of throwing when the update fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const partner = makePartner({ update: vi.fn(async () => { throw new Error('nope') }) })
    await expect(settleTwoWeaponPartner(partner, 'new-id', null, vi.fn())).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('attack card output for a halfling two-weapon natural 1', () => {
  const actor = new DCCActor()
  const fakeRoll = () => ({ options: {}, dice: [{ faces: 16 }], render: async () => '' })
  let saved

  beforeEach(() => {
    saved = {
      find: actor.items.find,
      rollToHit: actor.rollToHit,
      rollFumble: actor._rollFumble,
      rollDamage: actor._rollDamage,
      sheetClass: actor.system.details.sheetClass,
      combat: game.combat,
      messages: game.messages
    }
    actor._rollFumble = vi.fn(async () => ({
      fumbleRollFormula: '1d4',
      fumbleInlineRoll: '<a>1d4</a>',
      fumblePrompt: game.i18n.localize('DCC.RollFumble'),
      fumbleResult: '',
      fumbleRollTotal: null,
      fumbleTableName: 'Table 4-2: Fumbles'
    }))
    actor._rollDamage = vi.fn(async () => ({ damageRoll: { total: 0, options: {} }, damageInlineRoll: '', damagePrompt: '' }))
    actor.system.details.sheetClass = 'Halfling'
    game.combat = null
    game.messages = []
  })

  afterEach(() => {
    actor.items.find = saved.find
    actor.rollToHit = saved.rollToHit
    actor._rollFumble = saved.rollFumble
    actor._rollDamage = saved.rollDamage
    actor.system.details.sheetClass = saved.sheetClass
    game.combat = saved.combat
    game.messages = saved.messages
  })

  async function attackWith (weapon, { fumble = true } = {}) {
    actor.items.find = vi.fn().mockReturnValue({ ...weapon, system: { toHit: '+0', damage: '1d6', actionDie: '1d16', equipped: true, melee: true, ...weapon.system } })
    actor.rollToHit = vi.fn(async () => ({ roll: fakeRoll(), fumble, crit: false, hitsAc: 1 }))
    ChatMessage.data = undefined
    await actor.rollWeaponAttack('weapon')
    return ChatMessage.data
  }

  test('outside combat the fumble is held behind a click-to-roll prompt, even with automation on', async () => {
    const original = gameSettingsGetMock.getMockImplementation()
    gameSettingsGetMock.mockImplementation((module, key) => {
      if (module === 'dcc' && key === 'automateDamageFumblesCrits') return true
      return original ? original(module, key) : undefined
    })
    let data
    try {
      data = await attackWith(primary)
    } finally {
      gameSettingsGetMock.mockImplementation(original)
    }
    expect(data.flags['dcc.isFumble']).toBe(false)
    expect(data.flags['dcc.twoWeaponFumble']).toBe('held')
    expect(data.flags['dcc.twoWeaponPair']).toBeUndefined()
    expect(actor._rollFumble.mock.calls[0][1].automate).toBe(false)
    expect(data.system.fumblePrompt).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleOffer'))
    expect(data.system.fumbleInlineRoll).toBe('<a>1d4</a>')
    expect(data.system.twoWeaponNote).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleNote'))
  })

  test('in combat, the first hand is held and stamped for pairing', async () => {
    game.combat = makeCombat()
    actor.id = 'actor-1'
    const data = await attackWith(primary)
    expect(data.flags['dcc.twoWeaponFumble']).toBe('held')
    expect(data.flags['dcc.twoWeaponPair']).toEqual({
      combatId: 'combat-1', round: 2, combatantId: 'combatant-1', actorId: 'actor-1', role: 'primary', fumbled: true, pairedWith: null
    })
  })

  test('in combat, a second natural 1 after a held first hand rolls the fumble', async () => {
    game.combat = makeCombat()
    actor.id = 'actor-1'
    game.messages = [pairMessage('first', { fumbled: true })]
    const data = await attackWith(offHand)
    expect(data.flags['dcc.isFumble']).toBe(true)
    expect(data.flags['dcc.twoWeaponFumble']).toBe('confirmed')
    expect(data.flags['dcc.twoWeaponPair'].pairedWith).toBe('first')
    expect(actor._rollFumble).toHaveBeenCalled()
    expect(data.system.twoWeaponNote).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleConfirmed'))
  })

  test('in combat, a natural 1 after a first hand that missed the 1 is cleared', async () => {
    game.combat = makeCombat()
    actor.id = 'actor-1'
    game.messages = [pairMessage('first', { fumbled: false })]
    const data = await attackWith(offHand)
    expect(data.flags['dcc.isFumble']).toBe(false)
    expect(data.flags['dcc.twoWeaponFumble']).toBe('cleared')
    expect(actor._rollFumble).not.toHaveBeenCalled()
    expect(data.system.fumbleInlineRoll).toBe('')
    expect(data.system.twoWeaponNote).toBe(game.i18n.localize('DCC.HalflingTwoWeaponFumbleCleared'))
  })

  test('a non-halfling two-weapon natural 1 still fumbles', async () => {
    actor.system.details.sheetClass = 'Warrior'
    const data = await attackWith(primary)
    expect(data.flags['dcc.isFumble']).toBe(true)
    expect(data.flags['dcc.twoWeaponFumble']).toBeUndefined()
    expect(data.system.twoWeaponNote).toBe('')
  })
})
