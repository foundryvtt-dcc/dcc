/**
 * Tests for charged magic items (issue #500): DCCItem.attachSpell,
 * DCCItem.removeAttachedSpell, and DCCItem.castSpell.
 */

import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCItem from '../item.js'

// Mock the dice-chain module (matching item.test.js)
vi.mock('../dice-chain.js', () => ({
  default: {
    bumpDie: vi.fn((die, steps) => die)
  }
}))

// Mock the utilities module (matching item.test.js)
vi.mock('../utilities.js', () => ({
  ensurePlus: vi.fn((value) => {
    if (!value || value === '0') return '+0'
    return value.toString().startsWith('+') || value.toString().startsWith('-') ? value.toString() : `+${value}`
  }),
  getFirstDie: vi.fn((value) => {
    const match = value?.match(/\d*d\d+/)
    return match ? match[0] : null
  })
}))

describe('Charged magic items (equipment with attached spell)', () => {
  let item, actor, rollSpellCheckSpy

  const spellSnapshot = () => ({
    name: 'Magic Missile',
    type: 'spell',
    img: 'icons/magic-missile.webp',
    system: {
      config: {
        inheritActionDie: true,
        inheritSpellCheck: true,
        inheritCheckPenalty: true,
        castingMode: 'wizard'
      },
      spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
      results: { table: 'magic-missile-table', collection: '' },
      lost: false
    }
  })

  beforeEach(() => {
    global.uiNotificationsWarnMock.mockClear()

    actor = {
      name: 'Test Wizard',
      type: 'Player',
      system: {
        class: { spellCheckAbility: 'int' }
      }
    }

    item = new DCCItem({ type: 'equipment', name: 'Wand of Magic Missiles' }, {})
    item.type = 'equipment'
    item.actor = actor
    item.system = {
      spell: spellSnapshot(),
      charges: { value: 3, max: 5 },
      spellCheckOverride: ''
    }
    item.update = vi.fn().mockResolvedValue(item)

    rollSpellCheckSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)
  })

  afterEach(() => {
    rollSpellCheckSpy.mockRestore()
  })

  test('attachSpell stores a sanitized snapshot of the spell', async () => {
    const source = {
      type: 'spell',
      toObject: () => ({
        _id: 'source-spell-id',
        name: 'Magic Missile',
        type: 'spell',
        system: { lost: true, results: { table: 'magic-missile-table' } }
      })
    }

    await item.attachSpell(source)

    const snapshot = item.update.mock.calls.at(-1)[0]['system.spell']
    expect(snapshot._id).toBeUndefined()
    expect(snapshot.name).toBe('Magic Missile')
    // The charge is the cost - a magic item's spell is never 'lost'
    expect(snapshot.system.lost).toBe(false)
  })

  test('attachSpell ignores non-spell items and non-equipment hosts', async () => {
    await item.attachSpell({ type: 'weapon' })
    expect(item.update).not.toHaveBeenCalled()

    item.type = 'weapon'
    await item.attachSpell({ type: 'spell', toObject: () => ({}) })
    expect(item.update).not.toHaveBeenCalled()
  })

  test('removeAttachedSpell clears the snapshot', async () => {
    await item.removeAttachedSpell()
    expect(item.update).toHaveBeenCalledWith({ 'system.spell': null })
  })

  test('attachSpell clears an existing snapshot before storing the new one', async () => {
    // Object updates merge recursively - replacing without clearing would
    // leak the old snapshot's keys into the new one
    const source = {
      type: 'spell',
      toObject: () => ({ name: 'Sleep', type: 'spell', system: { lost: false } })
    }

    await item.attachSpell(source)

    expect(item.update).toHaveBeenCalledTimes(2)
    expect(item.update.mock.calls[0][0]).toEqual({ 'system.spell': null })
    expect(item.update.mock.calls[1][0]['system.spell'].name).toBe('Sleep')
  })

  test('castSpell rolls the attached spell and spends a charge', async () => {
    await item.castSpell()

    expect(rollSpellCheckSpy).toHaveBeenCalledTimes(1)
    // The ability comes from the owning actor's class
    expect(rollSpellCheckSpy.mock.calls[0][0]).toBe('int')

    // The ephemeral cast copy gets no failure automation - the charge is the cost
    const ephemeral = rollSpellCheckSpy.mock.contexts[0]
    expect(ephemeral).not.toBe(item)
    expect(ephemeral.system.config.castingMode).toBe('generic')
    expect(ephemeral.system.lost).toBe(false)

    // A charge is spent per cast attempt
    expect(item.update).toHaveBeenCalledWith({ 'system.charges.value': 2 })
  })

  test('castSpell is blocked at zero charges', async () => {
    item.system.charges = { value: 0, max: 5 }

    await item.castSpell()

    expect(global.uiNotificationsWarnMock).toHaveBeenCalled()
    expect(rollSpellCheckSpy).not.toHaveBeenCalled()
    expect(item.update).not.toHaveBeenCalled()
  })

  test('castSpell does not track charges when the maximum is zero', async () => {
    item.system.charges = { value: 0, max: 0 }

    await item.castSpell()

    expect(rollSpellCheckSpy).toHaveBeenCalledTimes(1)
    expect(item.update).not.toHaveBeenCalled()
  })

  test('castSpell applies the item spell check override to the cast copy', async () => {
    item.system.spellCheckOverride = '+5'

    await item.castSpell()

    const ephemeral = rollSpellCheckSpy.mock.contexts[0]
    expect(ephemeral.system.config.inheritSpellCheck).toBe(false)
    expect(ephemeral.system.spellCheck.value).toBe('+5')
  })

  test('castSpell warns when no spell is attached', async () => {
    item.system.spell = null

    await item.castSpell()

    expect(global.uiNotificationsWarnMock).toHaveBeenCalled()
    expect(rollSpellCheckSpy).not.toHaveBeenCalled()
  })

  test('castSpell warns when the attached spell has no results table', async () => {
    item.system.spell.system.results.table = ''

    await item.castSpell()

    expect(global.uiNotificationsWarnMock).toHaveBeenCalled()
    expect(rollSpellCheckSpy).not.toHaveBeenCalled()
    expect(item.update).not.toHaveBeenCalled()
  })

  test('castSpell does not spend a charge when the roll dialog is cancelled', async () => {
    // The roll modifier dialog rejects with null on cancel
    rollSpellCheckSpy.mockRejectedValue(null)

    await item.castSpell()

    expect(rollSpellCheckSpy).toHaveBeenCalledTimes(1)
    expect(item.update).not.toHaveBeenCalled()
  })

  test('castSpell rethrows real roll errors without spending a charge', async () => {
    rollSpellCheckSpy.mockRejectedValue(new Error('boom'))

    await expect(item.castSpell()).rejects.toThrow('boom')
    expect(item.update).not.toHaveBeenCalled()
  })

  test('castSpell suppresses patron taint by default but honors an explicit opt-in', async () => {
    await item.castSpell()
    expect(rollSpellCheckSpy.mock.calls[0][1].suppressPatronTaint).toBe(true)

    rollSpellCheckSpy.mockClear()
    await item.castSpell({ suppressPatronTaint: false })
    expect(rollSpellCheckSpy.mock.calls[0][1].suppressPatronTaint).toBe(false)
  })

  test('castSpell ignores a second cast while the first is awaiting its roll', async () => {
    let resolveRoll
    rollSpellCheckSpy.mockImplementation(() => new Promise(resolve => { resolveRoll = resolve }))

    const first = item.castSpell()
    const second = item.castSpell()

    await second
    expect(rollSpellCheckSpy).toHaveBeenCalledTimes(1)

    resolveRoll()
    await first

    // Only the completed cast spends a charge
    expect(item.update).toHaveBeenCalledTimes(1)
    expect(item.update).toHaveBeenCalledWith({ 'system.charges.value': 2 })
  })

  test('castSpell is a no-op for non-equipment items', async () => {
    item.type = 'spell'

    await item.castSpell()

    expect(rollSpellCheckSpy).not.toHaveBeenCalled()
    expect(global.uiNotificationsWarnMock).not.toHaveBeenCalled()
  })
})
