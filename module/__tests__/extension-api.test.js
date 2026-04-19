/**
 * Unit coverage for the stable `game.dcc.*` extension API helpers.
 *
 * The helpers themselves are pure (modulo the Foundry collection they
 * delegate to). Tests inject a mock `Items` collection + a sentinel
 * `ItemSheetV2` so we can assert call shape without booting Foundry.
 */

import { expect, test, vi } from 'vitest'
import { registerActorSheet, registerItemSheet } from '../extension-api.mjs'

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
