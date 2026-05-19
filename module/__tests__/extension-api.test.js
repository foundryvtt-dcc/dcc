/**
 * Unit coverage for the stable `game.dcc.*` extension API helpers.
 *
 * The helpers themselves are pure (modulo the Foundry collection they
 * delegate to). Tests inject a mock `Items` collection + a sentinel
 * `ItemSheetV2` so we can assert call shape without booting Foundry.
 */

import { expect, test, vi } from 'vitest'
import { applyClassDefaults, applyClassMixins, applyClassStartingItems, registerActorSheet, registerClassDefaults, registerClassMixin, registerClassStartingItems, registerItemSheet, registerSheetPart } from '../extension-api.mjs'

class FakeSheet {}
class FakeDefaultItemSheetV2 {}
class FakeDefaultActorSheetV2 {}

function makeMockItems () {
  return {
    registerSheet: vi.fn(),
    unregisterSheet: vi.fn()
  }
}

function makeMockActors () {
  return {
    registerSheet: vi.fn(),
    unregisterSheet: vi.fn()
  }
}

test('registerItemSheet calls Items.registerSheet with normalized options', () => {
  const Items = makeMockItems()
  registerItemSheet('weapon', FakeSheet, { label: 'TEST.Sheet' }, { Items, ItemSheetV2: FakeDefaultItemSheetV2 })

  expect(Items.registerSheet).toHaveBeenCalledTimes(1)
  expect(Items.registerSheet).toHaveBeenCalledWith('dcc', FakeSheet, {
    label: 'TEST.Sheet',
    makeDefault: false,
    types: ['weapon']
  })
  expect(Items.unregisterSheet).not.toHaveBeenCalled()
})

test('registerItemSheet accepts an array of types', () => {
  const Items = makeMockItems()
  registerItemSheet(['weapon', 'armor'], FakeSheet, {}, { Items, ItemSheetV2: FakeDefaultItemSheetV2 })

  expect(Items.registerSheet.mock.calls[0][2].types).toEqual(['weapon', 'armor'])
})

test('registerItemSheet omits `types` when undefined (registers across all sub-types)', () => {
  const Items = makeMockItems()
  registerItemSheet(undefined, FakeSheet, { label: 'TEST.Sheet' }, { Items, ItemSheetV2: FakeDefaultItemSheetV2 })

  const opts = Items.registerSheet.mock.calls[0][2]
  expect(opts).not.toHaveProperty('types')
})

test('registerItemSheet with makeDefault unregisters core ItemSheetV2 first', () => {
  const Items = makeMockItems()
  registerItemSheet('weapon', FakeSheet, { makeDefault: true, label: 'TEST.Sheet' }, { Items, ItemSheetV2: FakeDefaultItemSheetV2 })

  expect(Items.unregisterSheet).toHaveBeenCalledTimes(1)
  expect(Items.unregisterSheet).toHaveBeenCalledWith('core', FakeDefaultItemSheetV2, { types: ['weapon'] })
  expect(Items.registerSheet).toHaveBeenCalledWith('dcc', FakeSheet, {
    label: 'TEST.Sheet',
    makeDefault: true,
    types: ['weapon']
  })
  // Order matters — unregister has to land before register, otherwise
  // Foundry's default-pick races us.
  expect(Items.unregisterSheet.mock.invocationCallOrder[0])
    .toBeLessThan(Items.registerSheet.mock.invocationCallOrder[0])
})

test('registerItemSheet with makeDefault and no types unregisters globally', () => {
  const Items = makeMockItems()
  registerItemSheet(undefined, FakeSheet, { makeDefault: true }, { Items, ItemSheetV2: FakeDefaultItemSheetV2 })

  expect(Items.unregisterSheet).toHaveBeenCalledWith('core', FakeDefaultItemSheetV2, undefined)
})

test('registerItemSheet honors a custom scope', () => {
  const Items = makeMockItems()
  registerItemSheet('weapon', FakeSheet, { scope: 'xcc', label: 'XCC.Sheet' }, { Items, ItemSheetV2: FakeDefaultItemSheetV2 })

  expect(Items.registerSheet.mock.calls[0][0]).toBe('xcc')
})

test('registerItemSheet throws on missing SheetClass', () => {
  const Items = makeMockItems()
  expect(() => registerItemSheet('weapon', null, {}, { Items, ItemSheetV2: FakeDefaultItemSheetV2 }))
    .toThrow(/SheetClass is required/)
})

test('registerItemSheet throws when Foundry Items collection is unavailable', () => {
  expect(() => registerItemSheet('weapon', FakeSheet, {}, { Items: undefined, ItemSheetV2: FakeDefaultItemSheetV2 }))
    .toThrow(/Items` collection unavailable/)
})

test('registerItemSheet skips unregister when makeDefault is true but ItemSheetV2 is absent', () => {
  // Defensive: if a future Foundry release removes ItemSheetV2 from the
  // expected path, the helper still proceeds with the register so the
  // module isn't worse off than before. We never want to throw here —
  // module init should be tolerant of missing-default conditions.
  const Items = makeMockItems()
  registerItemSheet('weapon', FakeSheet, { makeDefault: true }, { Items, ItemSheetV2: undefined })

  expect(Items.unregisterSheet).not.toHaveBeenCalled()
  expect(Items.registerSheet).toHaveBeenCalledTimes(1)
})

// ── registerActorSheet ──────────────────────────────────────────────

test('registerActorSheet calls Actors.registerSheet with normalized options', () => {
  const Actors = makeMockActors()
  registerActorSheet('Player', FakeSheet, { label: 'TEST.ActorSheet' }, { Actors, ActorSheetV2: FakeDefaultActorSheetV2 })

  expect(Actors.registerSheet).toHaveBeenCalledTimes(1)
  expect(Actors.registerSheet).toHaveBeenCalledWith('dcc', FakeSheet, {
    label: 'TEST.ActorSheet',
    makeDefault: false,
    types: ['Player']
  })
  expect(Actors.unregisterSheet).not.toHaveBeenCalled()
})

test('registerActorSheet accepts an array of types', () => {
  const Actors = makeMockActors()
  registerActorSheet(['Player', 'NPC'], FakeSheet, {}, { Actors, ActorSheetV2: FakeDefaultActorSheetV2 })

  expect(Actors.registerSheet.mock.calls[0][2].types).toEqual(['Player', 'NPC'])
})

test('registerActorSheet with makeDefault unregisters core ActorSheetV2 first for the same types', () => {
  const Actors = makeMockActors()
  registerActorSheet('NPC', FakeSheet, { makeDefault: true, label: 'TEST.NpcSheet' }, { Actors, ActorSheetV2: FakeDefaultActorSheetV2 })

  expect(Actors.unregisterSheet).toHaveBeenCalledTimes(1)
  expect(Actors.unregisterSheet).toHaveBeenCalledWith('core', FakeDefaultActorSheetV2, { types: ['NPC'] })
  // Order: unregister has to land before register so Foundry's
  // default-pick doesn't race us.
  expect(Actors.unregisterSheet.mock.invocationCallOrder[0])
    .toBeLessThan(Actors.registerSheet.mock.invocationCallOrder[0])
})

test('registerActorSheet honors a custom scope (sibling-module use)', () => {
  // XCC + MCC + dcc-crawl-classes call this with their own scopes
  // ('xcc', 'mcc-healer', 'dcc-crawl-classes-bard', etc.) so the
  // resulting sheet ids are per-module unique.
  const Actors = makeMockActors()
  registerActorSheet('Player', FakeSheet, { scope: 'xcc', label: 'XCC.AthleteSheet' }, { Actors, ActorSheetV2: FakeDefaultActorSheetV2 })

  expect(Actors.registerSheet.mock.calls[0][0]).toBe('xcc')
})

test('registerActorSheet throws on missing SheetClass', () => {
  const Actors = makeMockActors()
  expect(() => registerActorSheet('Player', null, {}, { Actors, ActorSheetV2: FakeDefaultActorSheetV2 }))
    .toThrow(/SheetClass is required/)
})

test('registerActorSheet throws when Foundry Actors collection is unavailable', () => {
  expect(() => registerActorSheet('Player', FakeSheet, {}, { Actors: undefined, ActorSheetV2: FakeDefaultActorSheetV2 }))
    .toThrow(/Actors` collection unavailable/)
})

test('registerActorSheet skips unregister when makeDefault is true but ActorSheetV2 is absent', () => {
  // Defensive: if a future Foundry release moves ActorSheetV2 from
  // the expected path, the helper still proceeds with the register.
  const Actors = makeMockActors()
  registerActorSheet('Player', FakeSheet, { makeDefault: true }, { Actors, ActorSheetV2: undefined })

  expect(Actors.unregisterSheet).not.toHaveBeenCalled()
  expect(Actors.registerSheet).toHaveBeenCalledTimes(1)
})

// ---------------------------------------------------------------------
// registerClassMixin / applyClassMixins (Phase 4 session 1)
// ---------------------------------------------------------------------

function makeMockConfig () {
  return { DCC: { classMixins: {} } }
}

test('registerClassMixin stores the mixin under the classId key on CONFIG.DCC.classMixins', () => {
  const CONFIG = makeMockConfig()
  const mixin = vi.fn()
  registerClassMixin('halfling', mixin, { CONFIG })

  expect(CONFIG.DCC.classMixins.halfling).toBe(mixin)
})

test('registerClassMixin initializes CONFIG.DCC.classMixins when missing', () => {
  // A fresh world / mid-init call site can land before
  // module/config.js seeds the registry — the helper must self-heal.
  const CONFIG = { DCC: {} }
  registerClassMixin('halfling', () => {}, { CONFIG })

  expect(CONFIG.DCC.classMixins).toBeDefined()
  expect(typeof CONFIG.DCC.classMixins.halfling).toBe('function')
})

test('registerClassMixin overwrites a prior registration for the same classId', () => {
  // Last-write-wins matches the mercurial-magic registry's semantic.
  // Lets a sibling module ship a halfling-variant mixin that fully
  // replaces the DCC built-in, instead of having to additively patch.
  const CONFIG = makeMockConfig()
  const first = vi.fn()
  const second = vi.fn()
  registerClassMixin('halfling', first, { CONFIG })
  registerClassMixin('halfling', second, { CONFIG })

  expect(CONFIG.DCC.classMixins.halfling).toBe(second)
})

test('registerClassMixin throws on an empty / non-string classId', () => {
  const CONFIG = makeMockConfig()
  expect(() => registerClassMixin('', () => {}, { CONFIG })).toThrow(/non-empty string/)
  expect(() => registerClassMixin(null, () => {}, { CONFIG })).toThrow(/non-empty string/)
})

test('registerClassMixin throws when the mixin is not a function', () => {
  const CONFIG = makeMockConfig()
  expect(() => registerClassMixin('halfling', null, { CONFIG })).toThrow(/must be a function/)
  expect(() => registerClassMixin('halfling', { skills: {} }, { CONFIG })).toThrow(/must be a function/)
})

test('registerClassMixin throws when CONFIG.DCC is unavailable', () => {
  expect(() => registerClassMixin('halfling', () => {}, { CONFIG: {} })).toThrow(/CONFIG\.DCC unavailable/)
})

test('applyClassMixins runs each registered mixin against the supplied schema', () => {
  const CONFIG = makeMockConfig()
  const schema = { skills: { fields: {} } }
  const halflingMixin = vi.fn((s) => { s.skills.fields.sneakAndHide = { kind: 'SchemaField' } })
  const thiefMixin = vi.fn((s) => { s.skills.fields.sneakSilently = { kind: 'SchemaField' } })
  registerClassMixin('halfling', halflingMixin, { CONFIG })
  registerClassMixin('thief', thiefMixin, { CONFIG })

  applyClassMixins(schema, { CONFIG })

  expect(halflingMixin).toHaveBeenCalledTimes(1)
  expect(halflingMixin).toHaveBeenCalledWith(schema)
  expect(thiefMixin).toHaveBeenCalledTimes(1)
  expect(thiefMixin).toHaveBeenCalledWith(schema)
  expect(schema.skills.fields.sneakAndHide).toEqual({ kind: 'SchemaField' })
  expect(schema.skills.fields.sneakSilently).toEqual({ kind: 'SchemaField' })
})

test('applyClassMixins visits classIds in sorted order for deterministic schema shape', () => {
  // Registration order shouldn't influence the final schema. Future
  // slices may key behavior on mixin ordering (e.g. an `'elf'` mixin
  // overriding a `'player'` baseline detectSecretDoors override),
  // and a sort makes the resulting shape reproducible regardless of
  // load-order across sibling modules.
  const CONFIG = makeMockConfig()
  const visited = []
  registerClassMixin('warrior', () => visited.push('warrior'), { CONFIG })
  registerClassMixin('halfling', () => visited.push('halfling'), { CONFIG })
  registerClassMixin('cleric', () => visited.push('cleric'), { CONFIG })

  applyClassMixins({}, { CONFIG })

  expect(visited).toEqual(['cleric', 'halfling', 'warrior'])
})

test('applyClassMixins is a no-op when no mixins are registered', () => {
  const CONFIG = makeMockConfig()
  const schema = { skills: { fields: {} } }
  expect(() => applyClassMixins(schema, { CONFIG })).not.toThrow()
  expect(schema.skills.fields).toEqual({})
})

test('applyClassMixins is a no-op when CONFIG.DCC.classMixins is missing', () => {
  // Defensive: if module/config.js's seed regresses or a test
  // tear-down stripped it, mixin application must stay quiet, not
  // raise — `defineSchema()` is on the boot-critical path.
  const schema = { skills: { fields: {} } }
  expect(() => applyClassMixins(schema, { CONFIG: { DCC: {} } })).not.toThrow()
  expect(() => applyClassMixins(schema, { CONFIG: {} })).not.toThrow()
})

test('applyClassMixins skips registry entries that are not functions', () => {
  // Defensive against malformed registrations (someone bypassing
  // registerClassMixin's type check and writing directly to the
  // registry). Calling a non-function would crash schema definition.
  const CONFIG = { DCC: { classMixins: { halfling: 'not-a-function', warrior: () => {} } } }
  expect(() => applyClassMixins({}, { CONFIG })).not.toThrow()
})

// ---------------------------------------------------------------------
// registerClassDefaults / applyClassDefaults (Phase 5 session 1)
// ---------------------------------------------------------------------

function makeMockConfigDefaults () {
  return { DCC: { classDefaults: {} } }
}

function makeMockI18n (overrides = {}) {
  return {
    localize: vi.fn((key) => overrides[key] ?? `LOCALIZED:${key}`)
  }
}

function makeMockTextEditor () {
  return {
    enrichHTML: vi.fn(async (content) => `ENRICHED(${content})`)
  }
}

function makeMockActor (overrides = {}) {
  const system = {
    details: { sheetClass: null },
    class: { classLink: null },
    ...overrides
  }
  return {
    system,
    update: vi.fn(async () => {})
  }
}

const HALFLING_ENTRY = {
  sheetClass: 'Halfling',
  localize: { 'class.className': 'DCC.Halfling' },
  enrichHtml: { 'class.classLink': 'DCC.HalflingClassLink' },
  literal: {
    'details.critRange': 20,
    'config.attackBonusMode': 'flat',
    'skills.shieldBash.useDeed': false
  }
}

test('registerClassDefaults stores the entry under the classId key', () => {
  const CONFIG = makeMockConfigDefaults()
  registerClassDefaults('halfling', HALFLING_ENTRY, { CONFIG })

  expect(CONFIG.DCC.classDefaults.halfling).toBe(HALFLING_ENTRY)
})

test('registerClassDefaults initializes CONFIG.DCC.classDefaults when missing', () => {
  // Mirrors registerClassMixin's self-healing behavior — a mid-init
  // call site can land before module/config.js seeds the registry.
  const CONFIG = { DCC: {} }
  registerClassDefaults('halfling', HALFLING_ENTRY, { CONFIG })

  expect(CONFIG.DCC.classDefaults).toBeDefined()
  expect(CONFIG.DCC.classDefaults.halfling).toBe(HALFLING_ENTRY)
})

test('registerClassDefaults overwrites a prior registration (last-write-wins)', () => {
  const CONFIG = makeMockConfigDefaults()
  const first = { sheetClass: 'Halfling', literal: { 'details.critRange': 18 } }
  const second = { sheetClass: 'Halfling', literal: { 'details.critRange': 20 } }
  registerClassDefaults('halfling', first, { CONFIG })
  registerClassDefaults('halfling', second, { CONFIG })

  expect(CONFIG.DCC.classDefaults.halfling).toBe(second)
})

test('registerClassDefaults throws on empty / non-string classId', () => {
  const CONFIG = makeMockConfigDefaults()
  expect(() => registerClassDefaults('', HALFLING_ENTRY, { CONFIG })).toThrow(/non-empty string/)
  expect(() => registerClassDefaults(null, HALFLING_ENTRY, { CONFIG })).toThrow(/non-empty string/)
})

test('registerClassDefaults throws on non-object defaults', () => {
  const CONFIG = makeMockConfigDefaults()
  expect(() => registerClassDefaults('halfling', null, { CONFIG })).toThrow(/must be an object/)
  expect(() => registerClassDefaults('halfling', 'not-an-object', { CONFIG })).toThrow(/must be an object/)
})

test('registerClassDefaults throws on missing sheetClass', () => {
  // sheetClass is load-bearing — applyClassDefaults uses it as the
  // initial-setup dispatch sentinel. Reject early rather than letting
  // a malformed entry silently no-op every sheet open.
  const CONFIG = makeMockConfigDefaults()
  expect(() => registerClassDefaults('halfling', { localize: {} }, { CONFIG })).toThrow(/sheetClass must be a non-empty string/)
  expect(() => registerClassDefaults('halfling', { sheetClass: '' }, { CONFIG })).toThrow(/sheetClass must be a non-empty string/)
})

test('registerClassDefaults throws when CONFIG.DCC is unavailable', () => {
  expect(() => registerClassDefaults('halfling', HALFLING_ENTRY, { CONFIG: {} })).toThrow(/CONFIG\.DCC unavailable/)
})

test('applyClassDefaults runs the initial-setup branch when sheetClass does not match', async () => {
  const CONFIG = makeMockConfigDefaults()
  registerClassDefaults('halfling', HALFLING_ENTRY, { CONFIG })
  const i18n = makeMockI18n({ 'DCC.Halfling': 'Halfling', 'DCC.HalflingClassLink': '@UUID[…]{Halfling}' })
  const TextEditor = makeMockTextEditor()
  const actor = makeMockActor({ details: { sheetClass: null }, class: { classLink: null } })

  const result = await applyClassDefaults(actor, 'halfling', { CONFIG, i18n, TextEditor })

  expect(result).toBe('initialized')
  expect(actor.update).toHaveBeenCalledTimes(1)
  expect(actor.update).toHaveBeenCalledWith({
    'system.details.sheetClass': 'Halfling',
    'system.class.className': 'Halfling',
    'system.class.classLink': 'ENRICHED(@UUID[…]{Halfling})',
    'system.details.critRange': 20,
    'system.config.attackBonusMode': 'flat',
    'system.skills.shieldBash.useDeed': false
  })
})

test('applyClassDefaults runs the maintenance branch when classLink is missing and sheetClass matches', async () => {
  // Mirrors the legacy `else if (!classLink)` guard — happens when a
  // user opens the sheet before the compendium link target is
  // available (e.g. dcc-core-book installed after first character
  // creation). Should re-run enrichHTML so the link resolves, leaving
  // the literal mechanical defaults untouched.
  const CONFIG = makeMockConfigDefaults()
  registerClassDefaults('halfling', HALFLING_ENTRY, { CONFIG })
  const i18n = makeMockI18n({ 'DCC.HalflingClassLink': '@UUID[…]{Halfling}' })
  const TextEditor = makeMockTextEditor()
  const actor = makeMockActor({ details: { sheetClass: 'Halfling' }, class: { classLink: '' } })

  const result = await applyClassDefaults(actor, 'halfling', { CONFIG, i18n, TextEditor })

  expect(result).toBe('regenerated')
  expect(actor.update).toHaveBeenCalledTimes(1)
  expect(actor.update).toHaveBeenCalledWith({
    'system.class.classLink': 'ENRICHED(@UUID[…]{Halfling})'
  })
})

test('applyClassDefaults regenerates every enrichHtml path on the maintenance branch (warrior mightyDeedsLink)', async () => {
  // Warrior carries an extra `mightyDeedsLink` enriched-HTML slot
  // alongside classLink. Legacy code regenerated BOTH when classLink
  // was missing — preserve that.
  const CONFIG = makeMockConfigDefaults()
  registerClassDefaults('warrior', {
    sheetClass: 'Warrior',
    enrichHtml: {
      'class.classLink': 'DCC.WarriorClassLink',
      'class.mightyDeedsLink': 'DCC.MightyDeedsLink'
    }
  }, { CONFIG })
  const i18n = makeMockI18n()
  const TextEditor = makeMockTextEditor()
  const actor = makeMockActor({ details: { sheetClass: 'Warrior' }, class: { classLink: null } })

  await applyClassDefaults(actor, 'warrior', { CONFIG, i18n, TextEditor })

  expect(actor.update).toHaveBeenCalledWith({
    'system.class.classLink': 'ENRICHED(LOCALIZED:DCC.WarriorClassLink)',
    'system.class.mightyDeedsLink': 'ENRICHED(LOCALIZED:DCC.MightyDeedsLink)'
  })
})

test('applyClassDefaults returns "unchanged" when sheetClass matches and classLink is present', async () => {
  const CONFIG = makeMockConfigDefaults()
  registerClassDefaults('halfling', HALFLING_ENTRY, { CONFIG })
  const actor = makeMockActor({
    details: { sheetClass: 'Halfling' },
    class: { classLink: 'ENRICHED(prior-render)' }
  })

  const result = await applyClassDefaults(actor, 'halfling', {
    CONFIG, i18n: makeMockI18n(), TextEditor: makeMockTextEditor()
  })

  expect(result).toBe('unchanged')
  expect(actor.update).not.toHaveBeenCalled()
})

test('applyClassDefaults returns "unchanged" and never throws for an unregistered classId', async () => {
  // Sibling modules registering homebrew classes may load after the
  // built-in sheets render once — the helper must degrade to a no-op
  // when the classId isn't registered yet, not crash the sheet open.
  const CONFIG = makeMockConfigDefaults()
  const actor = makeMockActor()

  const result = await applyClassDefaults(actor, 'unknown-class', {
    CONFIG, i18n: makeMockI18n(), TextEditor: makeMockTextEditor()
  })

  expect(result).toBe('unchanged')
  expect(actor.update).not.toHaveBeenCalled()
})

test('applyClassDefaults handles entries with no localize / enrichHtml / literal sub-bags', async () => {
  // Defensive against partial registrations. An entry with only
  // sheetClass should still successfully transition the actor — just
  // writing the sheetClass sentinel.
  const CONFIG = makeMockConfigDefaults()
  registerClassDefaults('halfling', { sheetClass: 'Halfling' }, { CONFIG })
  const actor = makeMockActor({ details: { sheetClass: null }, class: { classLink: null } })

  const result = await applyClassDefaults(actor, 'halfling', {
    CONFIG, i18n: makeMockI18n(), TextEditor: makeMockTextEditor()
  })

  expect(result).toBe('initialized')
  expect(actor.update).toHaveBeenCalledWith({ 'system.details.sheetClass': 'Halfling' })
})

// ---------------------------------------------------------------------
// registerClassStartingItems / applyClassStartingItems (Phase 5 session 2)
// ---------------------------------------------------------------------

function makeMockConfigStartingItems () {
  return { DCC: { classStartingItems: {} } }
}

function makeMockActorWithItems (existingItems = []) {
  return {
    items: existingItems,
    createEmbeddedDocuments: vi.fn(async (collection, docs) => docs.map((d, i) => ({ ...d, id: `created-${i}` })))
  }
}

const DWARF_STARTING_ITEMS = [{
  nameKey: 'DCC.ShieldBash',
  type: 'weapon',
  img: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
  system: { melee: true, damage: '1d3', config: { actionDieOverride: '1d14' } }
}]

test('registerClassStartingItems stores the items array under the classId key', () => {
  const CONFIG = makeMockConfigStartingItems()
  registerClassStartingItems('dwarf', DWARF_STARTING_ITEMS, { CONFIG })

  expect(CONFIG.DCC.classStartingItems.dwarf).toBe(DWARF_STARTING_ITEMS)
})

test('registerClassStartingItems initializes CONFIG.DCC.classStartingItems when missing', () => {
  const CONFIG = { DCC: {} }
  registerClassStartingItems('dwarf', DWARF_STARTING_ITEMS, { CONFIG })

  expect(CONFIG.DCC.classStartingItems).toBeDefined()
  expect(CONFIG.DCC.classStartingItems.dwarf).toBe(DWARF_STARTING_ITEMS)
})

test('registerClassStartingItems overwrites a prior registration (last-write-wins)', () => {
  const CONFIG = makeMockConfigStartingItems()
  const first = [{ nameKey: 'DCC.OldItem', type: 'weapon' }]
  const second = [{ nameKey: 'DCC.NewItem', type: 'weapon' }]
  registerClassStartingItems('dwarf', first, { CONFIG })
  registerClassStartingItems('dwarf', second, { CONFIG })

  expect(CONFIG.DCC.classStartingItems.dwarf).toBe(second)
})

test('registerClassStartingItems throws on empty / non-string classId', () => {
  const CONFIG = makeMockConfigStartingItems()
  expect(() => registerClassStartingItems('', DWARF_STARTING_ITEMS, { CONFIG })).toThrow(/non-empty string/)
  expect(() => registerClassStartingItems(null, DWARF_STARTING_ITEMS, { CONFIG })).toThrow(/non-empty string/)
})

test('registerClassStartingItems throws on non-array items', () => {
  const CONFIG = makeMockConfigStartingItems()
  expect(() => registerClassStartingItems('dwarf', null, { CONFIG })).toThrow(/must be an array/)
  expect(() => registerClassStartingItems('dwarf', { nameKey: 'X' }, { CONFIG })).toThrow(/must be an array/)
})

test('registerClassStartingItems throws when CONFIG.DCC is unavailable', () => {
  expect(() => registerClassStartingItems('dwarf', DWARF_STARTING_ITEMS, { CONFIG: {} })).toThrow(/CONFIG\.DCC unavailable/)
})

test('applyClassStartingItems creates missing items as embedded documents', async () => {
  const CONFIG = makeMockConfigStartingItems()
  registerClassStartingItems('dwarf', DWARF_STARTING_ITEMS, { CONFIG })
  const i18n = makeMockI18n({ 'DCC.ShieldBash': 'Shield Bash' })
  const actor = makeMockActorWithItems([])

  const created = await applyClassStartingItems(actor, 'dwarf', { CONFIG, i18n })

  expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
  expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
    name: 'Shield Bash',
    type: 'weapon',
    img: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
    system: { melee: true, damage: '1d3', config: { actionDieOverride: '1d14' } }
  }])
  expect(created).toHaveLength(1)
  expect(created[0].name).toBe('Shield Bash')
})

test('applyClassStartingItems skips items the actor already has (idempotent on second open)', async () => {
  // The "already-have-it" check matches (type, localized-name). Once the
  // shield bash exists on the actor, subsequent sheet opens with the
  // 'initialized' branch shouldn't duplicate it. This matters because
  // the dispatch trigger fires whenever `sheetClass` doesn't match —
  // e.g., a class-change flip would re-fire the branch on a dwarf with
  // an existing ShieldBash.
  const CONFIG = makeMockConfigStartingItems()
  registerClassStartingItems('dwarf', DWARF_STARTING_ITEMS, { CONFIG })
  const i18n = makeMockI18n({ 'DCC.ShieldBash': 'Shield Bash' })
  const actor = makeMockActorWithItems([{ type: 'weapon', name: 'Shield Bash' }])

  const created = await applyClassStartingItems(actor, 'dwarf', { CONFIG, i18n })

  expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
  expect(created).toEqual([])
})

test('applyClassStartingItems partial-creates only the missing items (mixed-state actor)', async () => {
  // Multi-item registration where the actor already has one but not the
  // other. The single createEmbeddedDocuments call should batch only
  // the missing ones — matches Foundry's preferred API shape (one bulk
  // create over multiple per-doc creates).
  const CONFIG = makeMockConfigStartingItems()
  registerClassStartingItems('squire', [
    { nameKey: 'DCC.Longsword', type: 'weapon' },
    { nameKey: 'DCC.Shield', type: 'armor' }
  ], { CONFIG })
  const i18n = makeMockI18n({ 'DCC.Longsword': 'Longsword', 'DCC.Shield': 'Shield' })
  const actor = makeMockActorWithItems([{ type: 'weapon', name: 'Longsword' }])

  const created = await applyClassStartingItems(actor, 'squire', { CONFIG, i18n })

  expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
    { name: 'Shield', type: 'armor' }
  ])
  expect(created).toHaveLength(1)
})

test('applyClassStartingItems returns [] and never throws for an unregistered classId', async () => {
  // Sibling modules registering homebrew starting items may load after
  // the built-in sheets first render. The helper must degrade to a
  // no-op when the classId isn't registered yet (matches the
  // applyClassDefaults convention).
  const CONFIG = makeMockConfigStartingItems()
  const actor = makeMockActorWithItems([])

  const created = await applyClassStartingItems(actor, 'unknown-class', {
    CONFIG, i18n: makeMockI18n()
  })

  expect(created).toEqual([])
  expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
})

test('applyClassStartingItems returns [] when the registered list is empty', async () => {
  const CONFIG = makeMockConfigStartingItems()
  registerClassStartingItems('dwarf', [], { CONFIG })
  const actor = makeMockActorWithItems([])

  const created = await applyClassStartingItems(actor, 'dwarf', {
    CONFIG, i18n: makeMockI18n()
  })

  expect(created).toEqual([])
  expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
})

test('applyClassStartingItems skips entries missing nameKey or type', async () => {
  // Defensive against malformed registrations. A partial entry would
  // create an embedded doc with `name: 'DCC.SomeKey'` (the literal i18n
  // key, since localize returns the key when not found) or
  // `name: undefined`, neither of which is helpful — drop the entry
  // entirely rather than create garbage.
  const CONFIG = makeMockConfigStartingItems()
  registerClassStartingItems('dwarf', [
    { nameKey: 'DCC.ShieldBash', type: 'weapon' },
    { type: 'weapon' }, // missing nameKey
    { nameKey: 'DCC.Other' }, // missing type
    null // garbage entry
  ], { CONFIG })
  const i18n = makeMockI18n({ 'DCC.ShieldBash': 'Shield Bash' })
  const actor = makeMockActorWithItems([])

  await applyClassStartingItems(actor, 'dwarf', { CONFIG, i18n })

  // Only the well-formed entry should reach createEmbeddedDocuments.
  expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
    { name: 'Shield Bash', type: 'weapon' }
  ])
})

test('applyClassStartingItems omits img/system when not provided in the entry', async () => {
  // Lean payload: an entry with only nameKey + type should produce a
  // create doc with only name + type, not `img: undefined` or
  // `system: undefined` (Foundry's validator can choke on undefined).
  const CONFIG = makeMockConfigStartingItems()
  registerClassStartingItems('squire', [{ nameKey: 'DCC.Longsword', type: 'weapon' }], { CONFIG })
  const i18n = makeMockI18n({ 'DCC.Longsword': 'Longsword' })
  const actor = makeMockActorWithItems([])

  await applyClassStartingItems(actor, 'squire', { CONFIG, i18n })

  const callArgs = actor.createEmbeddedDocuments.mock.calls[0][1][0]
  expect(callArgs).toEqual({ name: 'Longsword', type: 'weapon' })
  expect(callArgs).not.toHaveProperty('img')
  expect(callArgs).not.toHaveProperty('system')
})

// ---------------------------------------------------------------------
// registerSheetPart (Phase 5 session 4)
// ---------------------------------------------------------------------

function makeMockConfigSheetParts () {
  return { DCC: { sheetParts: {} } }
}

const CLERIC_SHEET_PARTS = {
  parts: {
    character: { id: 'character', template: 'systems/dcc/templates/actor-partial-pc-common.html' },
    cleric: { id: 'cleric', template: 'systems/dcc/templates/actor-partial-cleric.html' }
  },
  tabs: {
    sheet: {
      tabs: [
        { id: 'character', group: 'sheet', label: 'DCC.Character' },
        { id: 'cleric', group: 'sheet', label: 'DCC.Cleric' }
      ]
    }
  }
}

test('registerSheetPart stores the descriptor under the classId key', () => {
  const CONFIG = makeMockConfigSheetParts()
  registerSheetPart('cleric', CLERIC_SHEET_PARTS, { CONFIG })

  expect(CONFIG.DCC.sheetParts.cleric).toBe(CLERIC_SHEET_PARTS)
})

test('registerSheetPart initializes CONFIG.DCC.sheetParts when missing', () => {
  // Mirrors the self-healing pattern from registerClassMixin /
  // registerClassDefaults — mid-init callers may land before
  // module/config.js seeds the registry.
  const CONFIG = { DCC: {} }
  registerSheetPart('cleric', CLERIC_SHEET_PARTS, { CONFIG })

  expect(CONFIG.DCC.sheetParts).toBeDefined()
  expect(CONFIG.DCC.sheetParts.cleric).toBe(CLERIC_SHEET_PARTS)
})

test('registerSheetPart overwrites a prior registration (last-write-wins)', () => {
  const CONFIG = makeMockConfigSheetParts()
  const first = { parts: { x: { id: 'x', template: 'a.html' } } }
  const second = { parts: { x: { id: 'x', template: 'b.html' } } }
  registerSheetPart('cleric', first, { CONFIG })
  registerSheetPart('cleric', second, { CONFIG })

  expect(CONFIG.DCC.sheetParts.cleric).toBe(second)
})

test('registerSheetPart throws on empty / non-string classId', () => {
  const CONFIG = makeMockConfigSheetParts()
  expect(() => registerSheetPart('', CLERIC_SHEET_PARTS, { CONFIG })).toThrow(/non-empty string/)
  expect(() => registerSheetPart(null, CLERIC_SHEET_PARTS, { CONFIG })).toThrow(/non-empty string/)
})

test('registerSheetPart throws on non-object descriptor', () => {
  const CONFIG = makeMockConfigSheetParts()
  expect(() => registerSheetPart('cleric', null, { CONFIG })).toThrow(/must be an object/)
  expect(() => registerSheetPart('cleric', 'not-an-object', { CONFIG })).toThrow(/must be an object/)
})

test('registerSheetPart throws when CONFIG.DCC is unavailable', () => {
  expect(() => registerSheetPart('cleric', CLERIC_SHEET_PARTS, { CONFIG: {} })).toThrow(/CONFIG\.DCC unavailable/)
})

// ---------------------------------------------------------------------
// Lib re-exports — registerClassProgression / registerClassProgressions
// (Phase 6 session 1)
// ---------------------------------------------------------------------

test('registerClassProgression + registerClassProgressions are importable from the vendored lib', async () => {
  // The DCC system re-exports the lib's registration helpers via
  // `game.dcc.*` in `module/dcc.js`'s init hook. This unit test
  // confirms the import path resolves and the imports are functions.
  // Sibling content modules (e.g., a future `dcc-core-book` update)
  // load their class progression payload through these helpers.
  //
  // The actual class progression payload (level-by-level saves,
  // crit dies, action dice, etc.) is copyrighted Goodman Games
  // material and lives in the private `dcc-official-data` repo —
  // the open-source DCC system ships only the registration surface.
  const mod = await import('../vendor/dcc-core-lib/data/classes/progression-utils.js')
  expect(typeof mod.registerClassProgression).toBe('function')
  expect(typeof mod.registerClassProgressions).toBe('function')
  expect(typeof mod.clearClassProgressions).toBe('function')
  expect(typeof mod.getClassProgression).toBe('function')
})

test('registerClassProgression round-trips a fictional minimal progression', async () => {
  // End-to-end confirmation that the re-exported registration path
  // actually populates the registry. Uses an entirely fictional
  // class ("p6s1-test-tinker") with arbitrary placeholder numbers,
  // NOT any data from `dcc-official-data` or DCC RAW. Clears the
  // registry afterward so the assertion stays isolated from any
  // other test that might load real class data.
  const mod = await import('../vendor/dcc-core-lib/data/classes/progression-utils.js')
  const probeProgression = {
    classId: 'p6s1-test-tinker',
    name: 'Test Tinker',
    skills: [],
    levels: {
      1: {
        attackBonus: 0,
        criticalDie: 'd4',
        criticalTable: 'I',
        actionDice: ['1d20'],
        hitDie: 'd6',
        saves: { ref: 1, frt: 1, wil: 0 }
      }
    }
  }
  mod.registerClassProgression(probeProgression)
  const fetched = mod.getClassProgression('p6s1-test-tinker')
  expect(fetched).toBeDefined()
  expect(fetched.name).toBe('Test Tinker')
  expect(fetched.levels[1].saves.ref).toBe(1)
  // Cleanup so the registry doesn't leak into other tests.
  mod.clearClassProgressions()
  expect(mod.getClassProgression('p6s1-test-tinker')).toBeUndefined()
})
