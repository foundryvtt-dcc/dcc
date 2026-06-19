/**
 * Unit coverage for the Foundry compendium → dcc-core-lib data-registry
 * loader at `module/adapter/foundry-data-loader.mjs`.
 *
 * Phase 6 session 2 wired this module to walk
 * `CONFIG.DCC.levelDataPacks` at `dcc.ready` time, parse each
 * `{ClassName}-{level}` item's `system.levelData` text, map the
 * Foundry-system-paths into the lib's `ProgressionLevelData` shape,
 * and call `registerClassProgressions(...)`.
 *
 * All test data here is **fictional placeholder content** with
 * arbitrary numbers — no class progression values from any official
 * source are reproduced. The mock pack contains a made-up "Tinker"
 * class with two arbitrary levels. The production loader at
 * runtime reads from whatever content module the user has
 * installed (typically dcc-core-book); this test exercises the
 * parser + mapper logic only.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  buildProgressionLevelFromParsed,
  parseLevelDataText,
  registerClassProgressionsFromPacks
} from '../adapter/foundry-data-loader.mjs'
import {
  clearClassProgressions,
  getClassProgression
} from '../vendor/dcc-core-lib/data/classes/progression-utils.js'

describe('parseLevelDataText', () => {
  test('splits newline-separated key=value pairs and numeric-coerces values', () => {
    const parsed = parseLevelDataText(
      'system.saves.ref.value=2\n' +
      'system.saves.frt.value=4\n' +
      'system.details.critTable=II'
    )
    expect(parsed).toEqual({
      'system.saves.ref.value': 2,
      'system.saves.frt.value': 4,
      'system.details.critTable': 'II'
    })
  })

  test('returns {} for empty or non-string input', () => {
    expect(parseLevelDataText('')).toEqual({})
    expect(parseLevelDataText(null)).toEqual({})
    expect(parseLevelDataText(undefined)).toEqual({})
    expect(parseLevelDataText(42)).toEqual({})
  })

  test('trims keys and values and skips lines without an "=" sign', () => {
    const parsed = parseLevelDataText(
      '  system.foo  =  bar  \n' +
      'no-equals-here\n' +
      'baz=qux'
    )
    expect(parsed).toEqual({ 'system.foo': 'bar', baz: 'qux' })
  })

  test('preserves empty-rhs values as empty strings rather than coercing to 0', () => {
    // `isNaN('')` is false (treats empty as 0). Without an explicit
    // empty-string guard, `key=` would land as 0 — a subtle bug for
    // string-valued fields like `system.details.critTable` that the
    // pack author left empty.
    const parsed = parseLevelDataText('system.details.critTable=')
    expect(parsed['system.details.critTable']).toBe('')
    expect(parsed['system.details.critTable']).not.toBe(0)
  })

  test('keeps dice notation as string (not coerced to NaN)', () => {
    const parsed = parseLevelDataText('system.attributes.hitDice.value=1d8')
    expect(parsed['system.attributes.hitDice.value']).toBe('1d8')
  })
})

describe('buildProgressionLevelFromParsed', () => {
  test('maps Foundry system paths onto lib ProgressionLevelData fields', () => {
    // Fictional placeholder values — arbitrary numbers for a made-up
    // class. Not data from any official DCC source.
    const parsed = {
      'system.saves.ref.value': 2,
      'system.saves.frt.value': 1,
      'system.saves.wil.value': 3,
      'system.details.attackHitBonus': 4,
      'system.details.critDie': 'd12',
      'system.details.critTable': 'III',
      'system.details.critRange': 19,
      'system.attributes.actionDice.value': '1d20,1d14',
      'system.attributes.hitDice.value': '1d8',
      'system.class.luckDie': 'd5'
    }
    const out = buildProgressionLevelFromParsed(parsed)
    expect(out.saves).toEqual({ ref: 2, frt: 1, wil: 3 })
    expect(out.attackBonus).toBe(4)
    expect(out.criticalDie).toBe('d12')
    expect(out.criticalTable).toBe('III')
    expect(out.critRange).toBe(19)
    expect(out.actionDice).toEqual(['1d20', '1d14'])
    expect(out.hitDie).toBe('d8')
    expect(out.luckDie).toBe('d5')
  })

  test('strips the level-count prefix when the hit-dice value carries one (LdN → dN)', () => {
    // Higher-level level items carry the rolled-total hit dice
    // (e.g., `5d8` at level 5). The class hit die is just `d8`. The
    // loader strips the count.
    const parsed = { 'system.attributes.hitDice.value': '7d6' }
    expect(buildProgressionLevelFromParsed(parsed).hitDie).toBe('d6')
  })

  test('treats numeric actionDice as a single 1dN die (`20` → `["1d20"]`)', () => {
    expect(buildProgressionLevelFromParsed({ 'system.attributes.actionDice.value': 20 })
      .actionDice).toEqual(['1d20'])
  })

  test('omits fields that are not present in the parsed input', () => {
    expect(buildProgressionLevelFromParsed({})).toEqual({})
    expect(buildProgressionLevelFromParsed({ 'system.details.critDie': 'd8' }))
      .toEqual({ criticalDie: 'd8' })
  })

  test('coerces saves to zero when only some sub-keys are present', () => {
    // Defensive against a pack item that only carries one save value
    // (e.g., a homebrew levelup item that only bumps Will). The lib's
    // `ProgressionLevelData.saves` requires all three, so the mapper
    // fills the missing slots with zero rather than emitting an
    // invalid partial shape.
    const out = buildProgressionLevelFromParsed({ 'system.saves.wil.value': 5 })
    expect(out.saves).toEqual({ ref: 0, frt: 0, wil: 5 })
  })

  test('drops non-numeric critRange so the lib does not see a stringly typed field', () => {
    const out = buildProgressionLevelFromParsed({ 'system.details.critRange': 'always' })
    expect(out.critRange).toBeUndefined()
  })

  test('filters empty action-dice tokens out of the split', () => {
    const out = buildProgressionLevelFromParsed({
      'system.attributes.actionDice.value': '1d20, ,1d14'
    })
    expect(out.actionDice).toEqual(['1d20', '1d14'])
  })
})

describe('registerClassProgressionsFromPacks', () => {
  beforeEach(() => {
    clearClassProgressions()
  })

  afterEach(() => {
    clearClassProgressions()
  })

  function makeMockPackWithTestData () {
    // Test fixture using unambiguously fake placeholder values
    // (saves like 7/9/11, crit die `d13`, crit table 'TEST') — no
    // numbers from any official progression are reproduced here.
    // The class-name prefix is 'Cleric' because the loader's
    // `BUILT_IN_CLASS_LEVEL_NAMES` mapping currently looks for
    // canonical class prefixes; that's just the dispatch key, not a
    // claim about which progression the values describe.
    const level1 = {
      _id: 'doc-test-1',
      system: {
        levelData:
          'system.saves.ref.value=7\n' +
          'system.saves.frt.value=9\n' +
          'system.saves.wil.value=11\n' +
          'system.attributes.actionDice.value=1d13\n' +
          'system.attributes.hitDice.value=1d13\n' +
          'system.details.critDie=d13\n' +
          'system.details.critTable=TEST'
      }
    }
    const level2 = {
      _id: 'doc-test-2',
      system: {
        levelData:
          'system.saves.ref.value=8\n' +
          'system.saves.frt.value=10\n' +
          'system.saves.wil.value=12\n' +
          'system.attributes.actionDice.value=1d13\n' +
          'system.attributes.hitDice.value=2d13\n' +
          'system.details.critDie=d13\n' +
          'system.details.critTable=TEST'
      }
    }
    const indexEntries = [
      { _id: 'doc-test-1', name: 'cleric-1' },
      { _id: 'doc-test-2', name: 'cleric-2' }
    ]
    const docs = {
      'doc-test-1': level1,
      'doc-test-2': level2
    }
    return {
      packName: 'test.placeholder-pack',
      pack: {
        index: indexEntries,
        async getIndex () { /* no-op — index already populated */ },
        async getDocument (id) { return docs[id] ?? null }
      }
    }
  }

  test('registers per-class progressions and the lib registry sees them', async () => {
    // Mocks `CONFIG.DCC.levelDataPacks` + `CONFIG.DCC.classLevelNames`
    // + `game.packs.get(packName)` and asserts the registered
    // progression has the expected sparse-level shape. The item-name
    // prefix is `'cleric'` (the classId → itemPrefix mapping from
    // `CONFIG.DCC.classLevelNames`); every value in the fixture is
    // unambiguously placeholder (`d13` / save bonuses 7-12 /
    // `TEST` crit table).
    const { packName, pack } = makeMockPackWithTestData()
    const CONFIG = {
      DCC: {
        levelDataPacks: { packs: [packName] },
        classLevelNames: { cleric: 'cleric' }
      }
    }
    const gameImpl = {
      packs: { get: (name) => (name === packName ? pack : null) }
    }

    const registered = await registerClassProgressionsFromPacks({ CONFIG, game: gameImpl })

    expect(registered).toContain('cleric')
    const progression = getClassProgression('cleric')
    expect(progression).toBeDefined()
    expect(progression.classId).toBe('cleric')
    expect(progression.name).toBe('Cleric')
    expect(progression.levels[1]).toBeDefined()
    expect(progression.levels[1].saves).toEqual({ ref: 7, frt: 9, wil: 11 })
    expect(progression.levels[1].hitDie).toBe('d13')
    expect(progression.levels[1].criticalTable).toBe('TEST')
    expect(progression.levels[2].saves).toEqual({ ref: 8, frt: 10, wil: 12 })
    expect(progression.levels[2].hitDie).toBe('d13')
    // Level 3 wasn't in the mock pack — should be sparse.
    expect(progression.levels[3]).toBeUndefined()
  })

  test('returns [] and registers nothing when no level packs are configured', async () => {
    const registered = await registerClassProgressionsFromPacks({
      CONFIG: { DCC: { classLevelNames: { cleric: 'cleric' } } },
      game: { packs: { get: () => null } }
    })
    expect(registered).toEqual([])
  })

  test('returns [] when levelDataPacks is set but contains no matching items', async () => {
    const emptyPack = {
      index: [],
      async getIndex () { },
      async getDocument () { return null }
    }
    const registered = await registerClassProgressionsFromPacks({
      CONFIG: {
        DCC: {
          levelDataPacks: { packs: ['test.empty-pack'] },
          classLevelNames: { cleric: 'cleric' }
        }
      },
      game: { packs: { get: () => emptyPack } }
    })
    expect(registered).toEqual([])
  })

  test('only walks classIds that are present in CONFIG.DCC.classLevelNames', async () => {
    // The loader is opted-in per classId: a pack that ships level data
    // for an unregistered classId is silently skipped. Phase 6 session 3
    // moved the seven canonical classes onto the
    // `registerHomebrewClassForProgressionLoad` registry; homebrew
    // packs whose classId isn't registered shouldn't surprise users
    // by auto-registering against the lib.
    const { packName, pack } = makeMockPackWithTestData()
    const CONFIG = {
      DCC: {
        levelDataPacks: { packs: [packName] },
        // Cleric *items* exist in the pack but classLevelNames only
        // exposes "wizard" — the loader should not pick the cleric
        // items up.
        classLevelNames: { wizard: 'wizard' }
      }
    }
    const gameImpl = {
      packs: { get: (name) => (name === packName ? pack : null) }
    }

    const registered = await registerClassProgressionsFromPacks({ CONFIG, game: gameImpl })

    expect(registered).toEqual([])
    expect(getClassProgression('cleric')).toBeUndefined()
    expect(getClassProgression('wizard')).toBeUndefined()
  })

  test('returns [] when CONFIG.DCC.classLevelNames is unset (registry not yet seeded)', async () => {
    // Defensive against system init wiring drifting — if the built-in
    // seed call ever stops running, the loader should no-op rather
    // than crash.
    const { packName, pack } = makeMockPackWithTestData()
    const CONFIG = { DCC: { levelDataPacks: { packs: [packName] } } }
    const gameImpl = {
      packs: { get: (name) => (name === packName ? pack : null) }
    }

    const registered = await registerClassProgressionsFromPacks({ CONFIG, game: gameImpl })

    expect(registered).toEqual([])
  })

  test('respects a homebrew classId → distinct itemPrefix mapping', async () => {
    // The classId → itemPrefix indirection lets a homebrew classId
    // like `'my-druid'` map onto a pack that ships its items under
    // a different prefix (`'druid-1'`, `'druid-2'`). The mock pack
    // here uses the `'cleric-…'` items; we register classId
    // `'my-druid'` mapped to itemPrefix `'cleric'` to prove the
    // dispatch reads from the registry, not from the classId.
    const { packName, pack } = makeMockPackWithTestData()
    const CONFIG = {
      DCC: {
        levelDataPacks: { packs: [packName] },
        classLevelNames: { 'my-druid': 'cleric' }
      }
    }
    const gameImpl = {
      packs: { get: (name) => (name === packName ? pack : null) }
    }

    const registered = await registerClassProgressionsFromPacks({ CONFIG, game: gameImpl })

    expect(registered).toEqual(['my-druid'])
    const progression = getClassProgression('my-druid')
    expect(progression).toBeDefined()
    expect(progression.name).toBe('My-druid')
    expect(progression.levels[1].hitDie).toBe('d13')
  })
})
