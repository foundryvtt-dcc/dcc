/* global gameSettingsGetMock, uiNotificationsWarnMock */
/**
 * Tests for the ability score edit dialog (module/ability-score-config.js)
 *
 * The dialog itself needs a rendered ApplicationV2; these tests exercise the
 * form submit handler contract via DEFAULT_OPTIONS.form.handler with a fake
 * dialog context. Mocks for Foundry Classes/Functions are found in
 * __mocks__/foundry.js
 **/

import { beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'

import AbilityScoreConfig from '../ability-score-config.js'

const submitHandler = AbilityScoreConfig.DEFAULT_OPTIONS.form.handler

/**
 * Build a minimal Player actor for the submit handler
 */
function makeActor (overrides = {}) {
  const actor = {
    id: 'testactor',
    name: 'Test Character',
    type: 'Player',
    system: {
      abilities: {
        str: { value: 12, max: 12 },
        agl: { value: 12, max: 12 },
        sta: { value: 12, max: 12 },
        per: { value: 12, max: 12 },
        int: { value: 12, max: 12 },
        lck: { value: 8, max: 12 }
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
 * Build the fake dialog context and submit arguments for the handler
 */
function submit (actor, data) {
  const dialog = { actor, abilityId: 'lck', options: {} }
  const event = { preventDefault: vi.fn() }
  const form = {}
  const formData = { object: data }
  return submitHandler.call(dialog, event, form, formData)
}

beforeEach(() => {
  vi.clearAllMocks()
  gameSettingsGetMock.mockImplementation((module, key) => {
    if (module === 'dcc' && key === 'enableAbilityScoreLog') return true
    return undefined
  })
})

/**
 * Render context for a dialog on the given actor/ability and return the
 * preselected reason key
 */
async function defaultReasonFor (actor, abilityId) {
  const dialog = new AbilityScoreConfig({ document: actor, abilityId })
  const context = await dialog._prepareContext()
  return context.reasons.find(r => r.checked)?.key
}

/**
 * Build an actor whose class dispatch resolves to the given sheetClass
 */
function actorWithClass (sheetClass) {
  const actor = makeActor()
  actor.system.details.sheetClass = sheetClass
  return actor
}

describe('AbilityScoreConfig default reason (issue #860)', () => {
  test('physical stats default to spellburn for spellburning casters', async () => {
    for (const sheetClass of ['Wizard', 'Elf']) {
      const actor = actorWithClass(sheetClass)
      expect(await defaultReasonFor(actor, 'str')).toBe('spellburn')
      expect(await defaultReasonFor(actor, 'agl')).toBe('spellburn')
      expect(await defaultReasonFor(actor, 'sta')).toBe('spellburn')
    }
  })

  test('physical stats default to ability damage for non-casters', async () => {
    const actor = actorWithClass('Warrior')
    expect(await defaultReasonFor(actor, 'str')).toBe('damage')
    expect(await defaultReasonFor(actor, 'agl')).toBe('damage')
    expect(await defaultReasonFor(actor, 'sta')).toBe('damage')
  })

  test('clerics cannot spellburn and default to ability damage', async () => {
    const actor = actorWithClass('Cleric')
    expect(await defaultReasonFor(actor, 'str')).toBe('damage')
  })

  test('mental stats and Luck are class-independent', async () => {
    for (const sheetClass of ['Wizard', 'Warrior']) {
      const actor = actorWithClass(sheetClass)
      expect(await defaultReasonFor(actor, 'int')).toBe('damage')
      expect(await defaultReasonFor(actor, 'per')).toBe('damage')
      expect(await defaultReasonFor(actor, 'lck')).toBe('luckSpend')
    }
  })

  test('an actor without class data (e.g. NPC) defaults to ability damage', async () => {
    const actor = actorWithClass('')
    expect(await defaultReasonFor(actor, 'str')).toBe('damage')
  })
})

describe('AbilityScoreConfig submit', () => {
  test('a note-required reason with an empty note warns and applies nothing', async () => {
    const actor = makeActor()
    await expect(submit(actor, {
      newValue: '11',
      reason: 'otherPermanent',
      note: '',
      adjustMax: true
    })).rejects.toThrow()

    expect(uiNotificationsWarnMock).toHaveBeenCalled()
    expect(actor.update).not.toHaveBeenCalled()
  })

  test('a note-required reason with a note applies the change with value, max, and log entry', async () => {
    const actor = makeActor()
    await submit(actor, {
      newValue: '11',
      reason: 'otherPermanent',
      note: 'Quest reward',
      adjustMax: true
    })

    expect(uiNotificationsWarnMock).not.toHaveBeenCalled()
    expect(actor.update).toHaveBeenCalledTimes(1)
    const [update] = actor.update.mock.calls[0]
    expect(update['system.abilities.lck.value']).toEqual(11)
    expect(update['system.abilities.lck.max']).toEqual(15)
    expect(update['system.abilityLog']).toHaveLength(1)
    expect(update['system.abilityLog'][0]).toMatchObject({
      ability: 'lck',
      change: 3,
      maxChange: 3,
      type: 'otherPermanent',
      source: 'Quest reward',
      newValue: 11
    })
  })

  test('a reason without the note requirement applies with an empty note', async () => {
    const actor = makeActor()
    await submit(actor, {
      newValue: '6',
      reason: 'luckSpend',
      note: ''
    })

    expect(uiNotificationsWarnMock).not.toHaveBeenCalled()
    expect(actor.update).toHaveBeenCalledTimes(1)
    const [update] = actor.update.mock.calls[0]
    expect(update['system.abilities.lck.value']).toEqual(6)
    expect(update['system.abilityLog'][0]).toMatchObject({
      ability: 'lck',
      change: -2,
      type: 'luckSpend',
      source: ''
    })
  })
})
