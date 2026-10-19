/* global ChatMessage, foundry, game */
/**
 * Luck burn in the Roll Modifier dialog (#963): the helper in
 * module/luck-burn.mjs and the dialog's LuckBurn term.
 *
 * Mocks for Foundry Classes/Functions are found in __mocks__/foundry.js
 **/

import { beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import { logAbilityChange } from '../ability-score-log.js'
import * as luckBurn from '../luck-burn.mjs'

// The Luck write itself (log entry, announcement) is covered in
// ability-score-log.test.js; here we only check what the term hands it.
vi.mock('../ability-score-log.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logAbilityChange: vi.fn()
}))

const { buildLuckBurnTerm, luckBurnDescriptor, luckBurnFormula } = luckBurn
globalThis.__luckBurn = luckBurn
const { RollModifierDialog } = await import('../roll-modifier.js')
const proto = RollModifierDialog.prototype

function makeActor (classId, lck = 12) {
  return foundry.utils.mergeObject({
    name: 'Burner',
    type: 'Player',
    classId,
    system: { abilities: { lck: { value: lck } }, class: { luckDie: '1d4' } }
  }, {})
}

beforeEach(() => {
  vi.mocked(logAbilityChange).mockClear()
})

describe('luckBurnDescriptor', () => {
  test('a warrior burns +1 per point, a halfling +2, a thief rolls their luck die', () => {
    expect(luckBurnDescriptor(makeActor('warrior'))).toEqual({ lck: 12, luckDie: null, multiplier: 1 })
    expect(luckBurnDescriptor(makeActor('halfling'))).toEqual({ lck: 12, luckDie: null, multiplier: 2 })
    expect(luckBurnDescriptor(makeActor('thief'))).toEqual({ lck: 12, luckDie: 'd4', multiplier: 1 })
  })

  test('NPCs and PCs with no Luck left get no term', () => {
    expect(luckBurnDescriptor({ ...makeActor('warrior'), type: 'NPC' })).toBeNull()
    expect(buildLuckBurnTerm(makeActor('warrior', 0))).toBeNull()
  })
})

test('luckBurnFormula', () => {
  expect(luckBurnFormula(0, { multiplier: 2 })).toBe('+0')
  expect(luckBurnFormula(3, { multiplier: 2 })).toBe('+6')
  expect(luckBurnFormula(2, { luckDie: 'd3' })).toBe('+2d3')
})

describe('LuckBurn dialog term', () => {
  // A dialog `this` with a fake DOM holding the term's bonus and Luck fields.
  function openDialog (actor) {
    const t = { options: {}, _state: 1, getTermByIndex: proto.getTermByIndex }
    t._terms = t.terms = proto._constructTermsFromArray.call(t, [
      { type: 'Die', formula: '1d20' },
      buildLuckBurnTerm(actor, { source: 'Longsword' })
    ])
    const fields = {
      '#term-0': { value: '1d20' },
      '#term-1': { value: '+0' },
      '#luck-burn-lck-1': { value: '' }
    }
    t.element = { querySelector: (selector) => fields[selector] ?? null }
    const click = (mod) => RollModifierDialog.DEFAULT_OPTIONS.actions.modifyLuckBurn.call(
      t, { preventDefault () {} }, { dataset: { term: '1', mod } })
    return { t, fields, click }
  }

  beforeEach(() => {
    globalThis.foundry.applications.api.ApplicationV2.RENDER_STATES = { NONE: 0 }
    globalThis.Roll = class {
      constructor (formula) { this.formula = String(formula) }
      evaluateSync () { this.total = 5; return this }
    }
  })

  test('opening spends nothing; submitting a 2-point halfling burn adds +4 and spends 2 Luck', async () => {
    const { t, fields, click } = openDialog(makeActor('halfling'))
    proto._constructRoll.call(t)
    expect(logAbilityChange).not.toHaveBeenCalled()

    await click('+1')
    await click('+1')
    expect(fields['#term-1'].value).toBe('+4')
    expect(fields['#luck-burn-lck-1'].value).toBe(10)

    const roll = proto._constructRoll.call(t)
    expect(roll.formula).toBe(`1d20+4[${game.i18n.localize('DCC.RollModifierLuckBurnTerm')}]`)
    expect(logAbilityChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Burner' }),
      { ability: 'lck', change: -2, type: 'luckSpend', source: 'Longsword' },
      { announce: true }
    )
  })

  test('a thief rolls the luck dice on submit and the roll carries the flat total', async () => {
    const { t, click } = openDialog(makeActor('thief'))
    await click('+1')
    await click('+1')
    const roll = proto._constructRoll.call(t)
    expect(roll.formula).toBe(`1d20+5[${game.i18n.localize('DCC.RollModifierLuckBurnTerm')} 2d4]`)
  })

  test('the burn cannot go below 0 or above the Luck score', async () => {
    const { t, fields, click } = openDialog(makeActor('warrior', 1))
    await click('-1')
    expect(fields['#term-1'].value).toBe('+0')
    await click('+1')
    await click('+1')
    expect(fields['#term-1'].value).toBe('+1')
    expect(t.terms[1].points).toBe(1)
  })
})

describe('burning Luck after the roll', () => {
  const card = (actor, flags) => ({
    id: 'msg1',
    flavor: 'Fortitude Save',
    rolls: [{ total: 13 }],
    speaker: { actor: 'a1' },
    getFlag: (_scope, key) => flags[key]
  })

  beforeEach(() => {
    ChatMessage.create = vi.fn()
  })

  test('is offered on an owned PC check card, not on other cards or unowned actors', () => {
    const actor = { ...makeActor('warrior'), isOwner: true }
    ChatMessage.getSpeakerActor = vi.fn(() => actor)
    const { luckBurnMessageActor } = globalThis.__luckBurn
    expect(luckBurnMessageActor(card(actor, { RollType: 'SavingThrow' }))).toBe(actor)
    expect(luckBurnMessageActor(card(actor, { isToHit: true }))).toBe(actor)
    expect(luckBurnMessageActor(card(actor, { RollType: 'HitDice' }))).toBeNull()
    actor.isOwner = false
    expect(luckBurnMessageActor(card(actor, { RollType: 'SavingThrow' }))).toBeNull()
  })

  test('spends the Luck once and posts the new total', async () => {
    const actor = { ...makeActor('halfling'), isOwner: true }
    ChatMessage.getSpeakerActor = vi.fn(() => actor)
    // Stand in for the dialog: the player burns 2 points and submits
    game.dcc.DCCRoll = {
      createRoll: vi.fn(async ([term]) => {
        term.points = 2
        term.bonus = 4
        term.callback('+4', term)
        return {}
      })
    }
    const format = vi.spyOn(game.i18n, 'format')
    await globalThis.__luckBurn.burnLuckAfterRoll(card(actor, { RollType: 'SavingThrow' }))
    expect(logAbilityChange).toHaveBeenCalledTimes(1)
    expect(logAbilityChange).toHaveBeenCalledWith(actor,
      { ability: 'lck', change: -2, type: 'luckSpend', source: 'Fortitude Save' }, { announce: false })
    expect(ChatMessage.create).toHaveBeenCalledTimes(1)
    expect(format).toHaveBeenCalledWith('DCC.LuckBurnAfterRoll',
      { name: 'Burner', points: 2, bonus: '+4', before: 13, after: 17 })
    format.mockRestore()
  })
})
