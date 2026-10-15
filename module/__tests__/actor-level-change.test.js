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
import DCCActorLevelChange, { levelChangeHitPoints, levelChangeHitPointTotal } from '../actor-level-change.js'

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

/**
 * Level-change hit points (#983): one hit die + Stamina modifier per level
 * gained or lost, minimum 1 per level (the lib's rollHPForLevel).
 */
describe('levelChangeHitPoints', () => {
  // The issue's table: Stamina +2, d6 hit die
  test.each([
    ['1 -> 3', 1, 3, '1d6+2 + 1d6+2'],
    ['0 -> 1', 0, 1, '1d6+2'],
    ['0 -> 2 (0 -> 1 is a gained level too)', 0, 2, '1d6+2 + 1d6+2'],
    ['0 -> 3', 0, 3, '1d6+2 + 1d6+2 + 1d6+2'],
    ['2 -> 1 (Stamina sign kept)', 2, 1, '-(1d6+2)'],
    ['3 -> 1 (one die per level lost)', 3, 1, '-(1d6+2 + 1d6+2)']
  ])('%s', (_label, oldLevel, newLevel, formula) => {
    expect(levelChangeHitPoints('1d6', 2, oldLevel, newLevel).formula).toBe(formula)
  })

  test('no level change means no roll', () => {
    expect(levelChangeHitPoints('1d6', 2, 2, 2)).toBeNull()
  })

  test('a negative Stamina modifier keeps each level at 1 or more', () => {
    expect(levelChangeHitPoints('1d8', -2, 1, 3).formula).toBe('max(1, 1d8-2) + max(1, 1d8-2)')
  })

  test('a zero modifier rolls the bare die', () => {
    expect(levelChangeHitPoints('1d12', 0, 4, 5).formula).toBe('1d12')
  })

  test('reports the die and modifier for the lib', () => {
    expect(levelChangeHitPoints('1d10', '1', 3, 1)).toEqual({ formula: '-(1d10+1 + 1d10+1)', sign: -1, levels: 2, faces: 10, staMod: 1 })
  })
})

describe('levelChangeHitPointTotal', () => {
  const rollOf = (...results) => ({ dice: [{ results: results.map(result => ({ result, active: true })) }] })

  test('adds the Stamina modifier to each die', () => {
    const hp = levelChangeHitPoints('1d6', 2, 1, 3)
    expect(levelChangeHitPointTotal(hp, rollOf(3, 5))).toBe(12)
  })

  test('each level is worth at least 1', () => {
    const hp = levelChangeHitPoints('1d6', -2, 1, 3)
    // 1 - 2 -> 1 (minimum), 5 - 2 -> 3
    expect(levelChangeHitPointTotal(hp, rollOf(1, 5))).toBe(4)
  })

  test('a level drop subtracts', () => {
    const hp = levelChangeHitPoints('1d6', 2, 3, 1)
    expect(levelChangeHitPointTotal(hp, rollOf(3, 5))).toBe(-12)
  })
})
