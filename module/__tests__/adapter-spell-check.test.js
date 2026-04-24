/* global rollToMessageMock, ChatMessage, uiNotificationsWarnMock, gameSettingsGetMock, actorUpdateMock, CONFIG, game */
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
import { buildSpellCheckArgs } from '../adapter/spell-input.mjs'
import { promptSpellburnCommitment } from '../adapter/roll-dialog.mjs'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

// Mock the dialog-adapter so the dispatcher's showModifierDialog branch
// can drive the code path deterministically. Tests override the return
// value per-case via `promptSpellburnCommitment.mockResolvedValue(...)`.
vi.mock('../adapter/roll-dialog.mjs', () => ({
  promptSpellburnCommitment: vi.fn()
}))

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

test('wizard-castingMode item on a patron-bound wizard routes to adapter (session 4)', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Bobugbubilz'
  actor.system.class.patronTaintChance = '1%'
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  // Spell name without 'Patron' and no associatedPatron — adapter
  // routes through but the legacy taint helper is a no-op.
  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  // Adapter took over; legacy item delegation must not fire.
  expect(itemSpy).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  // Spell isn't patron-related → no patronTaintChance bump.
  expect(actorUpdateMock).not.toHaveBeenCalledWith(
    expect.objectContaining({ 'system.class.patronTaintChance': expect.anything() })
  )

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('patron-related spell (name contains Patron) bumps patronTaintChance adapter-side', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Bobugbubilz'
  actor.system.class.patronTaintChance = '3%'
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  spellItem.name = 'Patron Bond'
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Patron Bond' })

  // Adapter ran the cast (one chat) AND bumped the chance via the
  // legacy verbatim helper.
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  expect(actorUpdateMock).toHaveBeenCalledWith({ 'system.class.patronTaintChance': '4%' })

  findSpy.mockRestore()
})

test('spell with system.associatedPatron set bumps patronTaintChance adapter-side', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Cthulhu'
  actor.system.class.patronTaintChance = '1%'
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem({ associatedPatron: 'Cthulhu' })
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  expect(actorUpdateMock).toHaveBeenCalledWith({ 'system.class.patronTaintChance': '2%' })

  findSpy.mockRestore()
})

test('non-patron-related spell on patron-bound wizard does not bump patronTaintChance', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Bobugbubilz'
  actor.system.class.patronTaintChance = '5%'
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  expect(actorUpdateMock).not.toHaveBeenCalledWith(
    expect.objectContaining({ 'system.class.patronTaintChance': expect.anything() })
  )

  findSpy.mockRestore()
})

test('wizard-castingMode item on a patron-bound elf routes to adapter (session 4)', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = 'Sezrekan'
  actor.system.class.patronTaintChance = '2%'
  actor.system.class.className = 'Elf'
  actor.system.details.sheetClass = 'Elf'

  const spellItem = makeWizardSpellItem({ associatedPatron: 'Sezrekan' })
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  // Elf profile + patron flows through the adapter and bumps chance.
  expect(itemSpy).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  expect(actorUpdateMock).toHaveBeenCalledWith({ 'system.class.patronTaintChance': '3%' })

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

test('adapter path fires for a cleric-castingMode item on a className-only Cleric (no sheetClass)', async () => {
  // Regression: pre-fix the dispatcher gated `isCleric` on
  // `details.sheetClass` alone, so a PC created with
  // `class.className: 'Cleric'` but no `sheetClass` (anything other than
  // the level-change dialog) fell through to the legacy path — which
  // silently no-ops for cleric-castingMode items on
  // non-sheetClass-Cleric actors (DCCItem.rollSpellCheck delegates back
  // with no handler).
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Cleric'
  actor.system.class.disapproval = 1
  // Intentionally leave details.sheetClass unset (undefined / not 'Cleric').
  actor.system.details.sheetClass = ''

  const spellItem = makeClericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Cure Light Wounds' })

  // Adapter path — not the silent-no-op legacy delegate.
  expect(itemSpy).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('SpellCheck')

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

// ---- Session 5 — spellburn + mercurial magic ----

test('createSpellEvents onSpellburnApplied subtracts burn amounts from physical abilities', () => {
  const actor = {
    update: vi.fn(),
    isNPC: false,
    system: {
      abilities: {
        str: { value: 14 },
        agl: { value: 12 },
        sta: { value: 13 }
      }
    }
  }
  const events = createSpellEvents({ actor, spellItem: null })

  expect(typeof events.onSpellburnApplied).toBe('function')
  events.onSpellburnApplied({ str: 2, agl: 0, sta: 3 })

  expect(actor.update).toHaveBeenCalledTimes(1)
  expect(actor.update).toHaveBeenCalledWith({
    'system.abilities.str.value': 12,
    'system.abilities.sta.value': 10
  })
})

test('createSpellEvents onSpellburnApplied clamps ability scores at 1', () => {
  const actor = {
    update: vi.fn(),
    isNPC: false,
    system: { abilities: { str: { value: 3 }, agl: { value: 5 }, sta: { value: 5 } } }
  }
  const events = createSpellEvents({ actor, spellItem: null })

  // Burn 5 from str (would go to -2) — expect clamp to 1.
  events.onSpellburnApplied({ str: 5, agl: 0, sta: 0 })

  expect(actor.update).toHaveBeenCalledWith({ 'system.abilities.str.value': 1 })
})

test('createSpellEvents onSpellburnApplied bails early for NPC actors', () => {
  const actor = {
    update: vi.fn(),
    isNPC: true,
    system: { abilities: { str: { value: 10 }, agl: { value: 10 }, sta: { value: 10 } } }
  }
  const events = createSpellEvents({ actor, spellItem: null })

  events.onSpellburnApplied({ str: 2, agl: 1, sta: 0 })

  expect(actor.update).not.toHaveBeenCalled()
})

test('createSpellEvents onSpellburnApplied with zero commitment does not update', () => {
  const actor = {
    update: vi.fn(),
    isNPC: false,
    system: { abilities: { str: { value: 10 }, agl: { value: 10 }, sta: { value: 10 } } }
  }
  const events = createSpellEvents({ actor, spellItem: null })

  events.onSpellburnApplied({ str: 0, agl: 0, sta: 0 })

  expect(actor.update).not.toHaveBeenCalled()
})

test('createSpellEvents without actor does not wire onSpellburnApplied', () => {
  const events = createSpellEvents({ actor: null, spellItem: { update: vi.fn() } })
  expect(events.onSpellburnApplied).toBeUndefined()
})

test('renderMercurialEffect posts a chat with the mercurial flag payload', async () => {
  rollToMessageMock.mockClear()
  const { renderMercurialEffect } = await import('../adapter/chat-renderer.mjs')
  const actor = { name: 'Wiz' }
  const spellItem = { id: 'Magic Missile' }

  await renderMercurialEffect({
    actor,
    spellItem,
    effect: { rollValue: 55, summary: 'Blue sparks', description: 'Blue sparks accompany the cast.', displayOnCast: true }
  })

  expect(rollToMessageMock).toHaveBeenCalled()
  const [messageData] = rollToMessageMock.mock.calls[rollToMessageMock.mock.calls.length - 1]
  expect(messageData.flags['dcc.RollType']).toBe('MercurialMagic')
  expect(messageData.flags['dcc.libMercurial']).toMatchObject({ rollValue: 55, summary: 'Blue sparks' })
  expect(messageData.flags['dcc.ItemId']).toBe('Magic Missile')
})

test('buildSpellCheckArgs threads options.spellburn into input.spellburn', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const args = buildSpellCheckArgs(actor, spellItem, {
    spellburn: { str: 2, agl: 0, sta: 1 }
  })

  expect(args.input.spellburn).toEqual({ str: 2, agl: 0, sta: 1 })
})

test('buildSpellCheckArgs drops an all-zero spellburn commitment', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const args = buildSpellCheckArgs(actor, spellItem, {
    spellburn: { str: 0, agl: 0, sta: 0 }
  })

  // Avoids a no-op modifier surfacing in the lib's result — matches
  // the lib's `totalSpellburn > 0` gate in `cast.js`.
  expect(args.input.spellburn).toBeUndefined()
})

test('buildSpellCheckArgs populates spellbookEntry.mercurialEffect from existing Foundry item', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem({
    mercurialEffect: {
      value: 42,
      summary: 'Blue aura',
      description: 'Spell is surrounded by a shimmering blue aura.',
      displayInChat: true
    }
  })

  const args = buildSpellCheckArgs(actor, spellItem, {})
  const spellbookEntry = args.character.state.classState.wizard.spellbook.spells[0]

  expect(spellbookEntry.mercurialEffect).toEqual({
    rollValue: 42,
    summary: 'Blue aura',
    description: 'Spell is surrounded by a shimmering blue aura.',
    displayOnCast: true
  })
})

test('buildSpellCheckArgs omits mercurialEffect when the Foundry item has no rolled value', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  // No mercurial on the item — spellbook entry should not carry one,
  // so `_rollMercurialIfNeeded` in the adapter picks it up for the
  // first-cast pre-roll path.
  const spellItem = makeWizardSpellItem()
  const args = buildSpellCheckArgs(actor, spellItem, {})
  const spellbookEntry = args.character.state.classState.wizard.spellbook.spells[0]

  expect(spellbookEntry.mercurialEffect).toBeUndefined()
})

test('adapter wizard first-cast pre-rolls mercurial magic when the item has none', async () => {
  rollToMessageMock.mockClear()

  // Configure a world mercurial-magic table the adapter's
  // `loadMercurialMagicTable` can resolve. One entry spans the full
  // d100 + luck-mod range so the lookup always succeeds.
  const originalTable = CONFIG.DCC.mercurialMagicTable
  const originalTables = game.tables
  CONFIG.DCC.mercurialMagicTable = 'Mercurial Magic'
  const fakeTable = {
    id: 'merc-magic',
    name: 'Mercurial Magic',
    results: [
      {
        range: [-20, 130],
        description: 'Blue aura. The spell is surrounded by a shimmering blue aura.'
      }
    ]
  }
  game.tables = {
    getName: (name) => (name === 'Mercurial Magic' ? fakeTable : null),
    find: () => null
  }

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  // Item updated with the rolled mercurial effect so later casts
  // display it without rolling again. Summary is the leading
  // sentence-fragment of the table row (split on '.').
  expect(spellItem.update).toHaveBeenCalledWith(expect.objectContaining({
    'system.mercurialEffect.value': expect.any(Number),
    'system.mercurialEffect.summary': 'Blue aura',
    'system.mercurialEffect.description': expect.stringContaining('Blue aura')
  }))

  // Main spell-check chat + mercurial display chat (two toMessage
  // calls in evaluate order).
  expect(rollToMessageMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  const mercurialCall = rollToMessageMock.mock.calls.find(([data]) =>
    data?.flags?.['dcc.RollType'] === 'MercurialMagic'
  )
  expect(mercurialCall).toBeDefined()

  // Cleanup test state so other tests aren't affected.
  CONFIG.DCC.mercurialMagicTable = originalTable
  game.tables = originalTables
  findSpy.mockRestore()
})

test('adapter wizard cast on a spell item that already has mercurial does not re-roll', async () => {
  rollToMessageMock.mockClear()

  // Provide a table even though we expect NOT to load it — proves the
  // "already-rolled" short-circuit, not a missing-table early return.
  const originalTable = CONFIG.DCC.mercurialMagicTable
  const originalTables = game.tables
  CONFIG.DCC.mercurialMagicTable = 'Mercurial Magic'
  game.tables = {
    getName: () => ({ id: 'm', name: 'Mercurial Magic', results: [] }),
    find: () => null
  }

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem({
    mercurialEffect: {
      value: 60,
      summary: 'Existing',
      description: 'Pre-rolled effect',
      displayInChat: true
    }
  })
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  // spellItem.update NOT called for mercurial re-roll (no keys
  // matching `system.mercurialEffect.*`).
  const mercurialUpdates = spellItem.update.mock.calls.filter(([data]) =>
    Object.keys(data || {}).some((k) => k.startsWith('system.mercurialEffect'))
  )
  expect(mercurialUpdates).toHaveLength(0)

  // The existing mercurial effect still fires the display-chat bridge.
  const mercurialCall = rollToMessageMock.mock.calls.find(([data]) =>
    data?.flags?.['dcc.RollType'] === 'MercurialMagic'
  )
  expect(mercurialCall).toBeDefined()
  expect(mercurialCall[0].flags['dcc.libMercurial'].rollValue).toBe(60)

  CONFIG.DCC.mercurialMagicTable = originalTable
  game.tables = originalTables
  findSpy.mockRestore()
})

test('adapter wizard cast with options.spellburn reduces ability scores adapter-side', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'
  actor.system.abilities.str.value = 14
  actor.system.abilities.agl.value = 12
  actor.system.abilities.sta.value = 13

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({
    spell: 'Magic Missile',
    spellburn: { str: 2, agl: 0, sta: 1 }
  })

  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  // The onSpellburnApplied bridge updated the actor's physical stats
  // post-cast. Exact values: 14-2=12, 13-1=12 (agl unchanged so dropped).
  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.abilities.str.value': 12,
    'system.abilities.sta.value': 12
  })

  findSpy.mockRestore()
})

test('wizard cast with showModifierDialog prompts spellburn and forwards the commitment', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()
  promptSpellburnCommitment.mockReset()
  promptSpellburnCommitment.mockResolvedValue({ str: 1, agl: 0, sta: 2 })

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'
  actor.system.abilities.str.value = 14
  actor.system.abilities.agl.value = 12
  actor.system.abilities.sta.value = 13

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({
    spell: 'Magic Missile',
    showModifierDialog: true
  })

  expect(promptSpellburnCommitment).toHaveBeenCalledTimes(1)
  expect(promptSpellburnCommitment).toHaveBeenCalledWith(actor, spellItem)
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  // The prompted commitment reaches the onSpellburnApplied bridge:
  // 14-1=13 (str), 13-2=11 (sta); agl unchanged so dropped.
  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.abilities.str.value': 13,
    'system.abilities.sta.value': 11
  })

  findSpy.mockRestore()
})

test('wizard cast with showModifierDialog aborts when the dialog is canceled', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()
  promptSpellburnCommitment.mockReset()
  promptSpellburnCommitment.mockResolvedValue(null)
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({
    spell: 'Magic Missile',
    showModifierDialog: true
  })

  expect(promptSpellburnCommitment).toHaveBeenCalledTimes(1)
  // Neither the adapter nor the legacy path continued with the cast.
  expect(rollToMessageMock).not.toHaveBeenCalled()
  expect(itemSpy).not.toHaveBeenCalled()
  expect(actorUpdateMock).not.toHaveBeenCalled()

  itemSpy.mockRestore()
  findSpy.mockRestore()
})

test('wizard cast with preset options.spellburn bypasses the dialog', async () => {
  rollToMessageMock.mockClear()
  promptSpellburnCommitment.mockReset()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'
  actor.system.abilities.str.value = 14
  actor.system.abilities.agl.value = 12
  actor.system.abilities.sta.value = 13

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({
    spell: 'Magic Missile',
    showModifierDialog: true,
    spellburn: { str: 0, agl: 0, sta: 1 }
  })

  expect(promptSpellburnCommitment).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  findSpy.mockRestore()
})

test('wizard cast on an NPC actor bypasses the spellburn dialog', async () => {
  rollToMessageMock.mockClear()
  promptSpellburnCommitment.mockReset()

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.type = 'NPC'
  actor.isNPC = true
  actor.isPC = false
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({
    spell: 'Magic Missile',
    showModifierDialog: true
  })

  expect(promptSpellburnCommitment).not.toHaveBeenCalled()
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  findSpy.mockRestore()
})

// ── dispatch-log reason codes for silent adapter→legacy fallbacks ─────────
// These assert the `reason=<tag>` telemetry emitted at otherwise-silent
// fallback sites. The Playwright dispatch spec mirrors each case
// end-to-end against a live Foundry; both are the regression net for
// the observability contract.

test('wizard-castingMode item on a class the lib does not know → legacy log carries reason=noCasterProfile', async () => {
  rollToMessageMock.mockClear()
  const itemSpy = vi.spyOn(DCCItem.prototype, 'rollSpellCheck').mockResolvedValue(undefined)
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  // Warrior isn't in `getCasterProfile`'s registry → buildSpellCheckArgs
  // returns null → dispatcher falls back to _rollSpellCheckLegacy.
  actor.system.class.className = 'Warrior'
  actor.system.details.sheetClass = 'Warrior'

  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  // Legacy delegation (the fallback actually happened) + reason log.
  expect(itemSpy).toHaveBeenCalledTimes(1)

  const legacyLog = consoleSpy.mock.calls.find(([line]) =>
    typeof line === 'string' &&
    line.includes('[DCC adapter] rollSpellCheck') &&
    line.includes('LEGACY path') &&
    line.includes('reason=noCasterProfile')
  )
  expect(legacyLog, `expected reason=noCasterProfile legacy log; got:\n${consoleSpy.mock.calls.map(c => c[0]).join('\n')}`).toBeDefined()

  itemSpy.mockRestore()
  findSpy.mockRestore()
  consoleSpy.mockRestore()
})

test('cleric cast without a configured disapproval table emits reason=noDisapprovalTable', async () => {
  rollToMessageMock.mockClear()
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Cleric'
  actor.system.class.disapproval = 1
  // Intentionally no `class.disapprovalTable` — loadDisapprovalTable
  // returns null on the empty-tableName guard.
  actor.system.details.sheetClass = 'Cleric'

  const spellItem = makeClericSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Cure Light Wounds' })

  // The cleric cast still runs via the adapter — this is a degradation,
  // not a legacy fallback.
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)

  const reasonLog = consoleSpy.mock.calls.find(([line]) =>
    typeof line === 'string' &&
    line.includes('[DCC adapter] rollSpellCheck') &&
    line.includes('via adapter') &&
    line.includes('reason=noDisapprovalTable')
  )
  expect(reasonLog, `expected reason=noDisapprovalTable log; got:\n${consoleSpy.mock.calls.map(c => c[0]).join('\n')}`).toBeDefined()

  findSpy.mockRestore()
  consoleSpy.mockRestore()
})

test('wizard first-cast without a configured mercurial table emits reason=noMercurialTable', async () => {
  rollToMessageMock.mockClear()
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  // Foundry unit-test config defaults `CONFIG.DCC.mercurialMagicTable`
  // to `null`, so `loadMercurialMagicTable` early-returns. Defensive
  // assertion in case that default drifts.
  const originalTable = CONFIG.DCC.mercurialMagicTable
  CONFIG.DCC.mercurialMagicTable = null

  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = ''
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'

  // Spell item with no mercurial effect → _rollMercurialIfNeeded runs,
  // loadMercurialMagicTable returns null, reason log fires.
  const spellItem = makeWizardSpellItem()
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  // Spell item update was NOT called with mercurial keys (no roll happened).
  const mercurialUpdates = spellItem.update.mock.calls.filter(([data]) =>
    Object.keys(data || {}).some((k) => k.startsWith('system.mercurialEffect'))
  )
  expect(mercurialUpdates).toHaveLength(0)

  const reasonLog = consoleSpy.mock.calls.find(([line]) =>
    typeof line === 'string' &&
    line.includes('[DCC adapter] rollSpellCheck') &&
    line.includes('via adapter') &&
    line.includes('reason=noMercurialTable')
  )
  expect(reasonLog, `expected reason=noMercurialTable log; got:\n${consoleSpy.mock.calls.map(c => c[0]).join('\n')}`).toBeDefined()

  CONFIG.DCC.mercurialMagicTable = originalTable
  findSpy.mockRestore()
  consoleSpy.mockRestore()
})
