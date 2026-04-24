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
import { buildSpellCheckArgs, loadPatronTaintTable } from '../adapter/spell-input.mjs'
import { promptSpellburnCommitment } from '../adapter/roll-dialog.mjs'
import { calculateSpellCheck as libCalcSpellCheckMock, rollSpellFumble, rollSpellFumbleWithModifier } from '../vendor/dcc-core-lib/index.js'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

// Mock the dialog-adapter so the dispatcher's showModifierDialog branch
// can drive the code path deterministically. Tests override the return
// value per-case via `promptSpellburnCommitment.mockResolvedValue(...)`.
vi.mock('../adapter/roll-dialog.mjs', () => ({
  promptSpellburnCommitment: vi.fn()
}))

// Passthrough mock over the vendor lib so a single test can force
// `calculateSpellCheck` into the error path on demand. Every other
// test still exercises the real lib behavior via the passthrough
// default — `libMocks.actualCalc` holds the genuine implementation.
const libMocks = vi.hoisted(() => ({ actualCalc: null }))
vi.mock('../vendor/dcc-core-lib/index.js', async (importOriginal) => {
  const actual = await importOriginal()
  libMocks.actualCalc = actual.calculateSpellCheck
  return {
    ...actual,
    calculateSpellCheck: vi.fn((...args) => libMocks.actualCalc(...args))
  }
})

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

// ── partial-failure rollback for _castViaCalculateSpellCheck pass 2 ─────
// Pass 2 is run twice: a probe (no events wired) to detect
// `result.error`, then a commit (events wired) only when the probe
// is clean. The probe absorbs the error before `onSpellburnApplied`
// / `onSpellLost` / `onDisapprovalIncreased` can mutate actor+item
// state. The roller is deterministic (pre-rolled Foundry values), so
// the two passes return identical results with no double-rolling.

function makeProbeErrorResult () {
  return {
    spellId: 'Magic Missile',
    die: 'd20',
    formula: '',
    modifiers: [],
    critical: false,
    fumble: false,
    spellLost: false,
    corruptionTriggered: false,
    disapprovalIncrease: 0,
    luckBurned: 0,
    error: 'test probe error'
  }
}

function isProbeCall (options, events) {
  return options?.mode === 'evaluate' && (!events || Object.keys(events).length === 0)
}

test('pass-2 probe error aborts before spellburn / spell-lost mutations', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()
  uiNotificationsWarnMock.mockClear()
  libCalcSpellCheckMock.mockClear()
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

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

  // Formula pass (mode === 'formula') + commit pass (mode ==='evaluate'
  // with events) pass through. Probe pass returns an error.
  libCalcSpellCheckMock.mockImplementation((character, input, options, events) => {
    if (isProbeCall(options, events)) {
      return makeProbeErrorResult()
    }
    return libMocks.actualCalc(character, input, options, events)
  })

  try {
    await actor.rollSpellCheck({
      spell: 'Magic Missile',
      spellburn: { str: 2, agl: 0, sta: 1 }
    })

    // User-facing warn with the lib-surfaced error text.
    expect(uiNotificationsWarnMock).toHaveBeenCalledTimes(1)
    expect(uiNotificationsWarnMock).toHaveBeenCalledWith('test probe error')
    // Diagnostic console.error is still useful signal.
    expect(consoleErrorSpy).toHaveBeenCalled()

    // Crucial: no mutations, no chat. The probe caught the error
    // BEFORE onSpellburnApplied / onSpellLost fired.
    expect(actorUpdateMock).not.toHaveBeenCalled()
    expect(spellItem.update).not.toHaveBeenCalled()
    expect(rollToMessageMock).not.toHaveBeenCalled()

    // Call pattern: pass 1 formula + pass 2 probe = 2 calls; commit
    // is never reached because the probe returned error.
    expect(libCalcSpellCheckMock).toHaveBeenCalledTimes(2)
  } finally {
    libCalcSpellCheckMock.mockImplementation((...args) => libMocks.actualCalc(...args))
    consoleErrorSpy.mockRestore()
    findSpy.mockRestore()
  }
})

test('pass-2 probe clean → commit pass fires events and posts chat', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()
  uiNotificationsWarnMock.mockClear()
  // Reset call count so we can assert probe+commit=3 total calls.
  libCalcSpellCheckMock.mockClear()

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
    spellburn: { str: 1, agl: 0, sta: 0 }
  })

  // No error path — warn does not fire.
  expect(uiNotificationsWarnMock).not.toHaveBeenCalled()
  // Normal post-cast flow: chat posts + spellburn commits adapter-side.
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  expect(actorUpdateMock).toHaveBeenCalledWith({
    'system.abilities.str.value': 13
  })
  // Call pattern: pass 1 formula + pass 2 probe + pass 2 commit = 3.
  expect(libCalcSpellCheckMock).toHaveBeenCalledTimes(3)

  findSpy.mockRestore()
})

// ---------------------------------------------------------------------------
// D3b — patron-taint manifestation table loader
// ---------------------------------------------------------------------------

function makePatronTaintActor (patron) {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.class.patron = patron
  actor.system.class.className = 'Wizard'
  actor.system.details.sheetClass = 'Wizard'
  return actor
}

test('loadPatronTaintTable returns null when actor has no patron', async () => {
  expect(await loadPatronTaintTable(makePatronTaintActor(''))).toBeNull()
  expect(await loadPatronTaintTable(makePatronTaintActor(null))).toBeNull()
  expect(await loadPatronTaintTable(makePatronTaintActor('   '))).toBeNull()
})

test('loadPatronTaintTable returns null when nothing resolves', async () => {
  const originalPacks = CONFIG.DCC.patronTaintPacks
  const originalTables = game.tables
  CONFIG.DCC.patronTaintPacks = { packs: [] }
  game.tables = { find: () => null }

  expect(await loadPatronTaintTable(makePatronTaintActor('Bobugbubilz'))).toBeNull()

  CONFIG.DCC.patronTaintPacks = originalPacks
  game.tables = originalTables
})

test('loadPatronTaintTable resolves an exact-name match from a compendium pack', async () => {
  const originalPacks = CONFIG.DCC.patronTaintPacks
  const originalGamePacks = game.packs
  const fakeTable = {
    id: 'bob-taint',
    name: 'Patron Taint: Bobugbubilz',
    results: [{ range: [1, 1], description: 'Buzzing flies' }]
  }
  const fakePack = {
    index: [{ _id: 'e1', name: 'Patron Taint: Bobugbubilz' }],
    getDocument: vi.fn().mockResolvedValue(fakeTable)
  }
  CONFIG.DCC.patronTaintPacks = { packs: ['dcc-core-book.dcc-core-spell-side-effect-tables'] }
  game.packs = {
    get: (name) => (name === 'dcc-core-book.dcc-core-spell-side-effect-tables' ? fakePack : null)
  }

  const libTable = await loadPatronTaintTable(makePatronTaintActor('Bobugbubilz'))

  expect(libTable).toMatchObject({
    name: 'Patron Taint: Bobugbubilz',
    entries: [{ min: 1, max: 1, text: 'Buzzing flies' }]
  })
  expect(fakePack.getDocument).toHaveBeenCalledWith('e1')

  CONFIG.DCC.patronTaintPacks = originalPacks
  game.packs = originalGamePacks
})

test('loadPatronTaintTable case-insensitive fallback resolves "The King of Elfland" against lowercase "the"', async () => {
  // The official dcc-core-book table is named
  // "Patron Taint: the King of Elfland" (lowercase "the"), but actors
  // commonly record "The King of Elfland" (capitalized). The loader's
  // second-pass scan normalizes case so both spellings resolve.
  const originalPacks = CONFIG.DCC.patronTaintPacks
  const originalGamePacks = game.packs
  const fakeTable = {
    id: 'elfland-taint',
    name: 'Patron Taint: the King of Elfland',
    results: [{ range: [1, 1], description: 'Fey antlers sprout' }]
  }
  const fakePack = {
    index: [{ _id: 'e2', name: 'Patron Taint: the King of Elfland' }],
    getDocument: vi.fn().mockResolvedValue(fakeTable)
  }
  CONFIG.DCC.patronTaintPacks = { packs: ['dcc-core-book.dcc-core-spell-side-effect-tables'] }
  game.packs = {
    get: () => fakePack
  }

  const libTable = await loadPatronTaintTable(makePatronTaintActor('The King of Elfland'))

  expect(libTable?.name).toBe('Patron Taint: the King of Elfland')
  expect(libTable?.entries).toHaveLength(1)

  CONFIG.DCC.patronTaintPacks = originalPacks
  game.packs = originalGamePacks
})

test('loadPatronTaintTable falls back to world tables when compendium lookup misses', async () => {
  const originalPacks = CONFIG.DCC.patronTaintPacks
  const originalTables = game.tables
  const originalGamePacks = game.packs
  CONFIG.DCC.patronTaintPacks = { packs: ['not-installed.not-installed'] }
  game.packs = { get: () => null }
  const worldTable = {
    id: 'world-sezrekan',
    name: 'Patron Taint: Sezrekan',
    results: [{ range: [1, 6], description: 'Withered hand' }]
  }
  game.tables = {
    find: (predicate) => (predicate(worldTable) ? worldTable : null)
  }

  const libTable = await loadPatronTaintTable(makePatronTaintActor('Sezrekan'))

  expect(libTable?.name).toBe('Patron Taint: Sezrekan')
  expect(libTable?.entries[0]).toMatchObject({ min: 1, max: 6, text: 'Withered hand' })

  CONFIG.DCC.patronTaintPacks = originalPacks
  game.packs = originalGamePacks
  game.tables = originalTables
})

test('loadPatronTaintTable continues pack walk when one pack throws', async () => {
  const originalPacks = CONFIG.DCC.patronTaintPacks
  const originalGamePacks = game.packs
  const brokenPack = {
    index: [{ _id: 'broken', name: 'Patron Taint: Bobugbubilz' }],
    getDocument: vi.fn().mockRejectedValue(new Error('socket dropped'))
  }
  const goodTable = {
    id: 'bob-taint',
    name: 'Patron Taint: Bobugbubilz',
    results: [{ range: [1, 1], description: 'Flies' }]
  }
  const goodPack = {
    index: [{ _id: 'good', name: 'Patron Taint: Bobugbubilz' }],
    getDocument: vi.fn().mockResolvedValue(goodTable)
  }
  CONFIG.DCC.patronTaintPacks = { packs: ['broken.pack', 'good.pack'] }
  game.packs = {
    get: (name) => (name === 'broken.pack' ? brokenPack : goodPack)
  }
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  const libTable = await loadPatronTaintTable(makePatronTaintActor('Bobugbubilz'))

  expect(libTable?.name).toBe('Patron Taint: Bobugbubilz')
  expect(warnSpy).toHaveBeenCalled()

  warnSpy.mockRestore()
  CONFIG.DCC.patronTaintPacks = originalPacks
  game.packs = originalGamePacks
})

// ---------------------------------------------------------------------------
// D3c — SpellFumbleResult.patronTaint flag retired (dcc-core-lib@0.8.0)
// ---------------------------------------------------------------------------

test('D3c: SpellFumbleResult no longer carries a patronTaint flag', () => {
  // Construct a fumble table whose roll-1 entry is tagged with the old
  // `patron-taint` effect type + the legacy `data.patronTaint: true`
  // flag. Pre-0.8.0 the lib used these tags to set `result.patronTaint
  // = true`. Post-0.8.0 the lib ignores them entirely and the flag is
  // absent from the result shape. This regression guard keeps the
  // vendor sync honest: if the old parsing sneaks back in, this test
  // fails immediately.
  const fumbleTable = {
    id: 'd3c-guard',
    name: 'D3c Fumble Guard',
    entries: [
      {
        min: 1,
        max: 1,
        text: 'Tagged taint outcome',
        effect: { type: 'patron-taint', data: { patronTaint: true } }
      }
    ]
  }

  const result = rollSpellFumble(1, fumbleTable, { roller: () => 1 })
  expect('patronTaint' in result).toBe(false)
  expect(result.misfire).toBe(false)
  expect(result.corruption).toBe(false)

  const modResult = rollSpellFumbleWithModifier(1, 0, fumbleTable, { roller: () => 1 })
  expect('patronTaint' in modResult).toBe(false)
})

// ---------------------------------------------------------------------------

test('adapter wizard patron-cast with a resolvable taint table posts manifestation chat on acquisition', async () => {
  rollToMessageMock.mockClear()
  actorUpdateMock.mockClear()
  CONFIG.ChatMessage.documentClass.create.mockClear()

  // Configure a world-scoped taint table the loader can resolve. One
  // entry covering 1-6 so any d6 hits it. Starting chance 100%
  // guarantees creeping-chance acquisition (d100 1..100 all qualify
  // since roll <= chance).
  const originalPacks = CONFIG.DCC.patronTaintPacks
  const originalTables = game.tables
  const originalGamePacks = game.packs
  CONFIG.DCC.patronTaintPacks = { packs: [] }
  game.packs = { get: () => null }
  // Roll mock fixes `total = 10` for every Roll; widen the range so
  // the d6 manifestation lookup ([1..6] in RAW) hits this entry in
  // the mock env even though the pre-rolled d6 is synthetically 10.
  const taintTable = {
    id: 'world-bob-taint',
    name: 'Patron Taint: Bobugbubilz',
    results: [{ range: [1, 100], description: 'Buzzing, biting flies appear when the caster casts any spell.' }]
  }
  game.tables = {
    find: (predicate) => (predicate(taintTable) ? taintTable : null)
  }

  const actor = makePatronTaintActor('Bobugbubilz')
  actor.system.class.patronTaintChance = '100%'

  const spellItem = makeWizardSpellItem({ associatedPatron: 'Bobugbubilz' })
  const findSpy = vi.spyOn(actor.items, 'find').mockReturnValue(spellItem)

  await actor.rollSpellCheck({ spell: 'Magic Missile' })

  // Main spell-check chat fires; the patron-taint manifestation
  // message is posted via `CONFIG.ChatMessage.documentClass.create`
  // from the `onPatronTaint` event bridge (not through
  // `rollToMessage`) — see `spell-events.mjs`. Its content carries
  // the manifestation text the lib's `rollPatronTaint` pulled off
  // the table entry.
  const chatCalls = CONFIG.ChatMessage.documentClass.create.mock.calls
  const taintCall = chatCalls.find(([data]) => data?.flags?.['dcc.isPatronTaint'] === true)
  expect(taintCall).toBeDefined()
  expect(taintCall[0].content).toContain('Buzzing, biting flies')

  // Per RAW, acquisition resets the chance to 1%.
  expect(actorUpdateMock).toHaveBeenCalledWith({ 'system.class.patronTaintChance': '1%' })

  CONFIG.DCC.patronTaintPacks = originalPacks
  game.packs = originalGamePacks
  game.tables = originalTables
  findSpy.mockRestore()
})
