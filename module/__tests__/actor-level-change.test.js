/**
 * Unit coverage for `DCCActorLevelChange._lookupLevelItem`'s world-item
 * fallback (`module/actor-level-change.js`).
 *
 * The level-up dialog resolves a `{class}-{level}` level item from the
 * registered `CONFIG.DCC.levelDataPacks` compendiums first, then falls
 * back to an unregistered `level`-type Item sitting in the world — the
 * same "just drop it in the sidebar" convenience the crit/fumble table
 * resolvers in `utilities.js` already provide via `game.tables`. These
 * tests pin that fallback and its priority ordering.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActorLevelChange from '../actor-level-change.js'

describe('DCCActorLevelChange._lookupLevelItem world fallback', () => {
  let savedGame, savedConfig

  // `_lookupLevelItem` only reaches into `this` for the non-English
  // translation branch (skipped here since lang === 'en'), so a bare
  // prototype-backed object is a sufficient receiver.
  const lookup = (className, level) =>
    DCCActorLevelChange.prototype._lookupLevelItem.call(
      Object.create(DCCActorLevelChange.prototype), className, level
    )

  beforeEach(() => {
    savedGame = globalThis.game
    savedConfig = globalThis.CONFIG
    globalThis.game = {
      i18n: { lang: 'en', localize: (k) => k },
      packs: { get: vi.fn(() => undefined) },
      items: []
    }
    globalThis.CONFIG = { DCC: { levelDataPacks: null } }
  })

  afterEach(() => {
    globalThis.game = savedGame
    globalThis.CONFIG = savedConfig
  })

  test('resolves an unregistered world level item named {class}-{level}', async () => {
    const worldItem = {
      type: 'level',
      name: 'blood-witch-1',
      system: { levelData: 'system.attributes.hitDice.value=1d6' }
    }
    globalThis.game.items = [worldItem]

    const found = await lookup('blood-witch', 1)

    expect(found).toBe(worldItem)
  })

  test('normalizes spaces in the class name to hyphens for the world lookup', async () => {
    const worldItem = { type: 'level', name: 'blood-witch-2', system: { levelData: '' } }
    globalThis.game.items = [worldItem]

    const found = await lookup('blood witch', 2)

    expect(found).toBe(worldItem)
  })

  test('ignores world items of other types with the same name', async () => {
    globalThis.game.items = [{ type: 'weapon', name: 'blood-witch-1', system: {} }]

    const found = await lookup('blood-witch', 1)

    expect(found).toEqual({})
  })

  test('a registered pack match wins over a same-named world item', async () => {
    const packItem = { type: 'level', name: 'warrior-1', system: { levelData: 'pack' } }
    const worldItem = { type: 'level', name: 'warrior-1', system: { levelData: 'world' } }
    globalThis.game.items = [worldItem]
    globalThis.CONFIG.DCC.levelDataPacks = { packs: ['dcc-core-book.levels'] }
    globalThis.game.packs.get = vi.fn(() => ({
      getIndex: async () => {},
      index: [{ _id: 'x', name: 'warrior-1' }],
      getDocument: async () => packItem
    }))

    const found = await lookup('warrior', 1)

    expect(found).toBe(packItem)
  })

  test('returns {} when neither a pack nor a world item matches', async () => {
    globalThis.game.items = [{ type: 'level', name: 'wizard-3', system: {} }]

    const found = await lookup('cleric', 1)

    expect(found).toEqual({})
  })
})
