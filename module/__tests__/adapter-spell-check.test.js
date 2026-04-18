/* global rollToMessageMock, ChatMessage, uiNotificationsWarnMock, gameSettingsGetMock, actorUpdateMock */
/**
 * Adapter round-trip test — Phase 2 (spell check).
 *
 * Dispatcher + adapter coverage:
 *   DCCActor.rollSpellCheck →
 *     (generic item + no patron + not Cleric) → _castViaCastSpell
 *     (wizard item + no patron + not Cleric) → _castViaCalculateSpellCheck
 *     (cleric item + no patron + Cleric actor) → _castViaCalculateSpellCheck
 *     (patron-bound | naked | mismatched casting mode) → legacy
 *
 * Wizard path exercises the `calculateSpellCheck` route with a real
 * `getCasterProfile('wizard')` profile and a single-entry spellbook
 * built from the spell item. Cleric path uses `getCasterProfile('cleric')`
 * with `disapprovalRange` populated on `character.state.classState.cleric`.
 * The `onSpellLost` / `onDisapprovalIncreased` event bridges are each
 * covered by dedicated tests against `createSpellEvents` so we don't
 * need to drive the lib to those specific outcomes in the round-trip.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'
import { createSpellEvents } from '../adapter/spell-events.mjs'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

function makeGenericSpellItem (overrides = {}) {
  const spell = new DCCItem({ name: 'Generic Cantrip', type: 'spell' }, {})
  spell.system = {
    level: 1,
    config: { castingMode: 'generic', inheritCheckPenalty: true },
    spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
    results: { table: '', collection: '' },
    lost: false,
    ...overrides
  }
  return spell
}

function makeWizardSpellItem (overrides = {}) {
  const spell = new DCCItem({ name: 'Magic Missile', type: 'spell' }, {})
  spell.system = {
    level: 1,
    config: { castingMode: 'wizard', inheritCheckPenalty: true },
    spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
    results: { table: '', collection: '' },
    lost: false,
    timesPreparedOrCast: 0,
    ...overrides
  }
  spell.update = vi.fn().mockResolvedValue(undefined)
  return spell
}

function makeClericSpellItem (overrides = {}) {
  const spell = new DCCItem({ name: 'Cure Light Wounds', type: 'spell' }, {})
  spell.system = {
    level: 1,
    config: { castingMode: 'cleric', inheritCheckPenalty: true },
    spellCheck: { die: '1d20', value: '+0', penalty: '-0' },
    results: { table: '', collection: '' },
    lost: false,
    ...overrides
  }
  spell.update = vi.fn().mockResolvedValue(undefined)
  return spell
}

test('adapter path fires for a generic spell item on a non-cleric non-patron actor', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeGenericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Generic Cantrip' })

  expect(findSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('SpellCheck')
  expect(messageData.flags['dcc.isSpellCheck']).toBe(true)

  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  expect(libResult.die).toBe('d20')
  expect(Array.isArray(libResult.modifiers)).toBe(true)
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()
  findSpy.mockRestore()
})

test('adapter path fires for a wizard-castingMode item on a Wizard actor', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  expect(findSpy).toHaveBeenCalledTimes(1)
  // Wizard adapter does NOT delegate to DCCItem — that's the whole
  // point of migrating away from the legacy path.
  expect(itemSpy).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('SpellCheck')
  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  expect(libResult.die).toBe('d20')
  // Wizard profile emits the Intelligence ability mod + caster level
  // into the modifier list. We don't assert on exact values (actor
  // mock stats vary) — just that the lib ran through the real
  // calculateSpellCheck pipeline.
  expect(Array.isArray(libResult.modifiers)).toBe(true)

  itemSpy.mockRestore()
  chatMessageCreateSpy.mockRestore()
  findSpy.mockRestore()
})

test('already-lost wizard spell + automateWizardSpellLoss on → warn + early return', async () => {
  rollToMessageMock.mockClear()
  uiNotificationsWarnMock.mockClear()
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  gameSettingsGetMock.mockImplementationOnce((module, key) => {
    if (module === 'dcc' && key === 'automateWizardSpellLoss') return true
    return undefined
  })

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem({ lost: true })
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
  // Neither the adapter nor the legacy path continued with the cast.
  expect(rollToMessageMock).not.toHaveBeenCalled()
  expect(itemSpy).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('wizard-castingMode item on a patron-bound actor routes to legacy', async () => {
  rollToMessageMock.mockClear()
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Bobugbubilz'
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  expect(itemSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('generic item on a Cleric actor routes to legacy (castingMode does not claim a cleric profile)', async () => {
  rollToMessageMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.details.sheetClass = 'Cleric'

  const spellItem = makeGenericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  await actor.rollSpellCheck({ spell: 'Generic Cantrip' })

  expect(itemSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('adapter path fires for a cleric-castingMode item on a Cleric actor', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Cleric'
  actor.system.class.disapproval = 1
  actor.system.details.sheetClass = 'Cleric'

  const spellItem = makeClericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Cure Light Wounds' })

  expect(findSpy).toHaveBeenCalledTimes(1)
  // Cleric adapter drives the cast directly; legacy item delegation
  // must not fire (that's what sessions 3 migrates away from).
  expect(itemSpy).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('SpellCheck')
  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  expect(libResult.die).toBe('d20')
  expect(Array.isArray(libResult.modifiers)).toBe(true)

  itemSpy.mockRestore()
  chatMessageCreateSpy.mockRestore()
  findSpy.mockRestore()
})

test('cleric-castingMode item on a patron-bound actor routes to legacy', async () => {
  rollToMessageMock.mockClear()
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Bobugbubilz'
  actor.system.class.className = 'Cleric'
  actor.system.details.sheetClass = 'Cleric'

  const spellItem = makeClericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Cure Light Wounds' })

  expect(itemSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('cleric-castingMode item on a non-Cleric actor routes to legacy', async () => {
  rollToMessageMock.mockClear()
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeClericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Cure Light Wounds' })

  expect(itemSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('generic item on a patron-bound actor routes to legacy (taint side-effects preserved)', async () => {
  rollToMessageMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Cthulhu'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeGenericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  await actor.rollSpellCheck({ spell: 'Generic Cantrip' })

  expect(itemSpy).toHaveBeenCalledTimes(1)
  expect(rollToMessageMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('createSpellEvents onSpellLost bridges to spellItem.update({ system.lost: true })', () => {
  const actor = {}
  const spellItem = { update: vi.fn() }
  const events = createSpellEvents({ actor, spellItem })

  expect(typeof events.onSpellLost).toBe('function')
  events.onSpellLost({ spellLost: true })

  expect(spellItem.update).toHaveBeenCalledTimes(1)
  expect(spellItem.update).toHaveBeenCalledWith({ 'system.lost': true })
})

test('createSpellEvents without spellItem does not wire onSpellLost (naked path)', () => {
  const events = createSpellEvents({ actor: {}, spellItem: null })
  expect(events.onSpellLost).toBeUndefined()
})

test('createSpellEvents onDisapprovalIncreased updates system.class.disapproval', () => {
  actorUpdateMock.mockClear()
  const actor = {
    update: vi.fn(),
    isNPC: false
  }
  const events = createSpellEvents({ actor, spellItem: null })

  expect(typeof events.onDisapprovalIncreased).toBe('function')
  events.onDisapprovalIncreased({ newDisapprovalRange: 2 }, 2)

  expect(actor.update).toHaveBeenCalledWith({ 'system.class.disapproval': 2 })
})

test('createSpellEvents onDisapprovalIncreased bails early for NPC actors (mirrors applyDisapproval)', () => {
  const actor = {
    update: vi.fn(),
    isNPC: true
  }
  const events = createSpellEvents({ actor, spellItem: null })

  events.onDisapprovalIncreased({ newDisapprovalRange: 3 }, 3)

  expect(actor.update).not.toHaveBeenCalled()
})

test('createSpellEvents without actor does not wire onDisapprovalIncreased', () => {
  const events = createSpellEvents({ actor: null, spellItem: { update: vi.fn() } })
  expect(events.onDisapprovalIncreased).toBeUndefined()
})
