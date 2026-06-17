/**
 * Unit coverage for the *data-driven* migration branches inside
 * `migrateActorData` / `migrateItemData` (PR #720 test-coverage gap,
 * severity ≥ 6). These branches run on every world load against actual
 * document data rather than gating on a stored version, so before this
 * suite they were only exercised when Foundry booted a real world. The
 * V14 ActiveEffect numeric-mode → string-type converter is V14-critical:
 * a missed conversion silently breaks every effect on the document.
 *
 * The two helpers are exported from `migrations.js` for testing only
 * (they are internal migration helpers, not Foundry-facing API). Globals
 * (`game` / `foundry` / `fetch`) are stubbed per-test in the same style
 * as `check-migrations.test.js`; no live Foundry boot. Each fixture is
 * shaped to exercise exactly one branch so the asserted `updateData` keys
 * stay focused.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { migrateActorData, migrateItemData } from '../migrations.js'

let originalGame
let originalFoundry
let originalFetch

/**
 * A minimal `foundry.utils` surface the migration helpers touch:
 * - `deepClone` — fallback path when an effect has no `toObject()`
 * - `isEmpty` — gates the owned-item recursion in `migrateActorData`
 * - `mergeObject` — folds a non-empty owned-item update back onto the item
 */
function stubFoundry () {
  return {
    utils: {
      deepClone: (o) => structuredClone(o),
      isEmpty: (o) => o == null || (typeof o === 'object' && Object.keys(o).length === 0),
      mergeObject: (orig, upd) => Object.assign({}, orig, upd)
    }
  }
}

/**
 * A fully-migrated ("clean") actor whose every data-driven branch is a
 * no-op: alignment set, critRange / disapproval already numeric,
 * sheetClass present (so the className → sheetClass branch is skipped),
 * no effects, no items, no `_source` speed (so the #739 seed can't fire).
 * Each test clones this and perturbs exactly one field.
 */
function cleanActor () {
  return {
    system: {
      details: { alignment: 'n', critRange: 20, sheetClass: 'Warrior' },
      class: { className: 'Warrior', disapproval: 1 }
    }
  }
}

/** Build an ActiveEffect-like object exposing `toObject()` with the given changes. */
function effectWithChanges (changes) {
  return { toObject: () => ({ changes }) }
}

beforeEach(() => {
  originalGame = globalThis.game
  originalFoundry = globalThis.foundry
  originalFetch = globalThis.fetch
  globalThis.game = { i18n: { localize: vi.fn((k) => k) } }
  globalThis.foundry = stubFoundry()
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.foundry = originalFoundry
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('migrateActorData — no-op baseline', () => {
  test('a fully-migrated actor produces an empty updateData', async () => {
    expect(await migrateActorData(cleanActor())).toEqual({})
  })
})

describe('migrateActorData — luckyRoll → birthAugur', () => {
  test('copies a legacy luckyRoll into birthAugur', async () => {
    const actor = cleanActor()
    actor.system.details.luckyRoll = 'Born on the battlefield'
    expect(await migrateActorData(actor)).toEqual({
      'system.details.birthAugur': 'Born on the battlefield'
    })
  })

  test('a falsy luckyRoll is left alone', async () => {
    const actor = cleanActor()
    actor.system.details.luckyRoll = ''
    expect(await migrateActorData(actor)).toEqual({})
  })
})

describe('migrateActorData — default alignment', () => {
  test('seeds lawful when alignment is missing', async () => {
    const actor = cleanActor()
    delete actor.system.details.alignment
    expect(await migrateActorData(actor)).toEqual({
      'system.details.alignment': 'l'
    })
  })

  test('an existing alignment is preserved', async () => {
    const actor = cleanActor()
    actor.system.details.alignment = 'c'
    expect(await migrateActorData(actor)).toEqual({})
  })
})

describe('migrateActorData — critRange string → number', () => {
  test('parses a numeric string', async () => {
    const actor = cleanActor()
    actor.system.details.critRange = '18'
    expect(await migrateActorData(actor)).toEqual({
      'system.details.critRange': 18
    })
  })

  test('falls back to 20 for an unparseable string', async () => {
    const actor = cleanActor()
    actor.system.details.critRange = 'not-a-number'
    expect(await migrateActorData(actor)).toEqual({
      'system.details.critRange': 20
    })
  })

  test('a numeric critRange is left alone', async () => {
    const actor = cleanActor()
    actor.system.details.critRange = 18
    expect(await migrateActorData(actor)).toEqual({})
  })
})

describe('migrateActorData — disapproval string → number', () => {
  test('parses a numeric string', async () => {
    const actor = cleanActor()
    actor.system.class.disapproval = '5'
    expect(await migrateActorData(actor)).toEqual({
      'system.class.disapproval': 5
    })
  })

  test('falls back to 1 for an unparseable string', async () => {
    const actor = cleanActor()
    actor.system.class.disapproval = 'broken'
    expect(await migrateActorData(actor)).toEqual({
      'system.class.disapproval': 1
    })
  })
})

describe('migrateActorData — sheetClass from className', () => {
  test('quick check 1: an English/internal class key maps to itself', async () => {
    const actor = cleanActor()
    delete actor.system.details.sheetClass
    actor.system.class.className = 'Wizard'
    expect(await migrateActorData(actor)).toEqual({
      'system.details.sheetClass': 'Wizard'
    })
    // The locale lookup is never consulted for an English key.
    expect(globalThis.game.i18n.localize).not.toHaveBeenCalled()
  })

  test('quick check 2: a localized class name resolves to its internal key', async () => {
    // Only DCC.Cleric localizes to the stored className → only Cleric matches.
    globalThis.game.i18n.localize = vi.fn((key) =>
      key === 'DCC.Cleric' ? 'Kleriker' : key
    )
    const actor = cleanActor()
    delete actor.system.details.sheetClass
    actor.system.class.className = 'Kleriker'
    expect(await migrateActorData(actor)).toEqual({
      'system.details.sheetClass': 'Cleric'
    })
  })

  test('edge case: an unknown third-party class falls back to its own name', async () => {
    // Force the buildClassNameLookup path: not an English key, no locale
    // match. Stub fetch so the lang-file loads add no extra mappings, so
    // the lookup contains only the English keys and the third-party name
    // falls through to itself.
    globalThis.fetch = vi.fn(async () => ({ json: async () => ({}) }))
    const actor = cleanActor()
    delete actor.system.details.sheetClass
    actor.system.class.className = 'Necromancer'
    expect(await migrateActorData(actor)).toEqual({
      'system.details.sheetClass': 'Necromancer'
    })
  })

  test('an actor that already has sheetClass is not re-derived', async () => {
    const actor = cleanActor()
    actor.system.details.sheetClass = 'Thief'
    actor.system.class.className = 'Wizard'
    expect(await migrateActorData(actor)).toEqual({})
  })
})

describe('migrateActorData — V14 ActiveEffect numeric mode → string type', () => {
  test.each([
    [0, 'custom'],
    [1, 'multiply'],
    [2, 'add'],
    [3, 'downgrade'],
    [4, 'upgrade'],
    [5, 'override']
  ])('converts numeric mode %i to type "%s" and deletes mode', async (mode, type) => {
    const actor = cleanActor()
    actor.effects = [effectWithChanges([{ key: 'system.abilities.str.value', mode, value: '2' }])]

    const updateData = await migrateActorData(actor)

    expect(updateData.effects).toHaveLength(1)
    const change = updateData.effects[0].changes[0]
    expect(change.type).toBe(type)
    expect(change).not.toHaveProperty('mode')
    // The non-mode fields are carried through untouched.
    expect(change.key).toBe('system.abilities.str.value')
    expect(change.value).toBe('2')
  })

  test('an unknown numeric mode falls back to "add"', async () => {
    const actor = cleanActor()
    actor.effects = [effectWithChanges([{ key: 'k', mode: 99, value: '1' }])]

    const updateData = await migrateActorData(actor)

    expect(updateData.effects[0].changes[0].type).toBe('add')
    expect(updateData.effects[0].changes[0]).not.toHaveProperty('mode')
  })

  test('a change already carrying a string type is left untouched (no effects update)', async () => {
    const actor = cleanActor()
    actor.effects = [effectWithChanges([{ key: 'k', type: 'add', value: '1' }])]

    expect(await migrateActorData(actor)).toEqual({})
  })

  test('a numeric mode is NOT converted when a type already coexists', async () => {
    // The guard requires `change.type === undefined`; a change that somehow
    // carries both is left alone rather than double-converted.
    const actor = cleanActor()
    actor.effects = [effectWithChanges([{ key: 'k', mode: 2, type: 'override', value: '1' }])]

    expect(await migrateActorData(actor)).toEqual({})
  })

  test('falls back to deepClone for an effect lacking toObject()', async () => {
    const actor = cleanActor()
    // Plain effect object (no toObject) → migration deepClones it.
    actor.effects = [{ changes: [{ key: 'k', mode: 5, value: '1' }] }]

    const updateData = await migrateActorData(actor)

    expect(updateData.effects[0].changes[0].type).toBe('override')
  })
})

describe('migrateActorData — #739 speed.base seed', () => {
  test('seeds base from the displayed value when base is the 30 default', async () => {
    const actor = cleanActor()
    actor._source = { system: { attributes: { speed: { base: '30', value: "40'" } } } }
    expect(await migrateActorData(actor)).toEqual({
      'system.attributes.speed.base': '40'
    })
  })

  test('seeds base from the displayed value when base is unset', async () => {
    const actor = cleanActor()
    actor._source = { system: { attributes: { speed: { value: '25' } } } }
    expect(await migrateActorData(actor)).toEqual({
      'system.attributes.speed.base': '25'
    })
  })

  test('a custom (non-30) base is preserved', async () => {
    const actor = cleanActor()
    actor._source = { system: { attributes: { speed: { base: '25', value: "40'" } } } }
    expect(await migrateActorData(actor)).toEqual({})
  })

  test('does not seed when the displayed value matches the base default', async () => {
    const actor = cleanActor()
    actor._source = { system: { attributes: { speed: { base: '30', value: '30' } } } }
    expect(await migrateActorData(actor)).toEqual({})
  })
})

describe('migrateActorData — owned item recursion', () => {
  test('folds a migrated owned item into updateData.items', async () => {
    const actor = cleanActor()
    actor.items = [{
      _id: 'item1',
      effects: [effectWithChanges([{ key: 'k', mode: 2, value: '1' }])]
    }]

    const updateData = await migrateActorData(actor)

    expect(updateData.items).toHaveLength(1)
    expect(updateData.items[0].effects[0].changes[0].type).toBe('add')
  })

  test('owned items needing no migration are not included', async () => {
    const actor = cleanActor()
    actor.items = [{ _id: 'item1', effects: [] }]
    expect(await migrateActorData(actor)).toEqual({})
  })
})

describe('migrateItemData — V14 ActiveEffect numeric mode → string type', () => {
  test('converts a numeric mode to a string type and deletes mode', () => {
    const item = { effects: [effectWithChanges([{ key: 'k', mode: 4, value: '1' }])] }

    const updateData = migrateItemData(item)

    expect(updateData.effects).toHaveLength(1)
    const change = updateData.effects[0].changes[0]
    expect(change.type).toBe('upgrade')
    expect(change).not.toHaveProperty('mode')
  })

  test('an item with no effects produces an empty updateData', () => {
    expect(migrateItemData({ effects: [] })).toEqual({})
    expect(migrateItemData({})).toEqual({})
  })

  test('an item whose effect changes are already string-typed is a no-op', () => {
    const item = { effects: [effectWithChanges([{ key: 'k', type: 'add', value: '1' }])] }
    expect(migrateItemData(item)).toEqual({})
  })

  test('an unknown numeric mode falls back to "add"', () => {
    const item = { effects: [effectWithChanges([{ key: 'k', mode: 42, value: '1' }])] }
    expect(migrateItemData(item).effects[0].changes[0].type).toBe('add')
  })
})
