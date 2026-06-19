/**
 * Unit coverage for the table-loading surface extracted from
 * `module/dcc.js`. Each handler is exercised in isolation against a
 * stubbed `CONFIG` / `game` / `foundry` / `Hooks`; no live Foundry boot.
 * Mirrors the pattern in `settings-table-hooks.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  TABLE_LOADING_HOOKS,
  getSkillTable,
  onCreateRollTable,
  onDeleteRollTable,
  onDiceSoNiceReady,
  onImportAdventure,
  onUpdateRollTable,
  registerTableLoadingHooks,
  registerTables,
  setupCoreBookCompendiumLinks
} from '../table-loading.mjs'

let originalCONFIG
let originalGame
let originalFoundry
let originalHooks

beforeEach(() => {
  originalCONFIG = globalThis.CONFIG
  originalGame = globalThis.game
  originalFoundry = globalThis.foundry
  originalHooks = globalThis.Hooks
  globalThis.CONFIG = { DCC: {} }
  globalThis.game = {
    modules: { get: vi.fn() },
    settings: { get: vi.fn(), set: vi.fn() },
    packs: { get: vi.fn() },
    tables: Object.assign([], { getName: vi.fn() }),
    scenes: [],
    i18n: { localize: (key) => key }
  }
})

afterEach(() => {
  globalThis.CONFIG = originalCONFIG
  globalThis.game = originalGame
  globalThis.foundry = originalFoundry
  globalThis.Hooks = originalHooks
})

describe('setupCoreBookCompendiumLinks', () => {
  test('writes the seven compendium-link slots when dcc-core-book is active', () => {
    globalThis.game.modules.get.mockReturnValue({ active: true })

    setupCoreBookCompendiumLinks()

    expect(globalThis.game.modules.get).toHaveBeenCalledWith('dcc-core-book')
    const links = globalThis.CONFIG.DCC.coreBookCompendiumLinks
    expect(links).toMatchObject({
      weapons: 'dcc-core-book.dcc-core-weapons',
      armor: 'dcc-core-book.dcc-core-armor',
      equipment: 'dcc-core-book.dcc-core-equipment',
      ammunition: 'dcc-core-book.dcc-core-ammunition',
      mounts: 'dcc-core-book.dcc-core-mounts'
    })
    expect(links.wizardSpells).toHaveLength(5)
    expect(links.wizardSpells[0]).toBe('dcc-core-book.dcc-core-spells-wizard-1')
    expect(links.wizardSpells[4]).toBe('dcc-core-book.dcc-core-spells-wizard-5')
    expect(links.clericSpells).toHaveLength(5)
    expect(links.clericSpells[0]).toBe('dcc-core-book.dcc-core-spells-cleric-1')
    expect(links.clericSpells[4]).toBe('dcc-core-book.dcc-core-spells-cleric-5')
  })

  test('writes null when dcc-core-book module is not active', () => {
    globalThis.game.modules.get.mockReturnValue({ active: false })

    setupCoreBookCompendiumLinks()

    expect(globalThis.CONFIG.DCC.coreBookCompendiumLinks).toBeNull()
  })

  test('writes null when dcc-core-book module is not installed', () => {
    globalThis.game.modules.get.mockReturnValue(undefined)

    setupCoreBookCompendiumLinks()

    expect(globalThis.CONFIG.DCC.coreBookCompendiumLinks).toBeNull()
  })
})

describe('registerTables', () => {
  beforeEach(() => {
    // No compendium configured for the optional-table scalars by default
    globalThis.game.settings.get = vi.fn((scope, key) => {
      const map = {
        disapprovalCompendium: null,
        critsCompendium: null,
        divineAidTable: null,
        fumbleTable: null,
        layOnHandsTable: null,
        mercurialMagicTable: null,
        turnUnholyTable: null
      }
      return map[key]
    })
  })

  test('seeds the three TablePackManager registries (disapproval / criticalHit / patronTaint)', () => {
    registerTables()

    expect(globalThis.CONFIG.DCC.disapprovalPacks).toBeDefined()
    expect(globalThis.CONFIG.DCC.disapprovalPacks._updateHook).toBeTypeOf('function')
    expect(globalThis.CONFIG.DCC.criticalHitPacks).toBeDefined()
    expect(globalThis.CONFIG.DCC.patronTaintPacks).toBeDefined()
    // Patron-taint registry seeded with both core + xcc side-effect packs
    expect(globalThis.CONFIG.DCC.patronTaintPacks.packs).toContain('dcc-core-book.dcc-core-spell-side-effect-tables')
    expect(globalThis.CONFIG.DCC.patronTaintPacks.packs).toContain('xcc-core-book.xcc-core-spell-side-effect-tables')
  })

  test('seeds the disapproval-pack registry from the disapprovalCompendium system setting when present', () => {
    globalThis.game.settings.get = vi.fn((scope, key) => {
      if (key === 'disapprovalCompendium') return 'module.firstDisapprovalPack'
      return null
    })

    registerTables()

    expect(globalThis.CONFIG.DCC.disapprovalPacks.packs).toContain('module.firstDisapprovalPack')
  })

  test('runs disapprovalPacks._updateHook against the empty registry when no compendium is configured (still scans world tables)', () => {
    globalThis.game.tables = Object.assign(
      [{ name: 'World Disapproval Custom' }],
      { getName: vi.fn() }
    )

    registerTables()

    expect(globalThis.CONFIG.DCC.disapprovalTables).toBeDefined()
    expect(globalThis.CONFIG.DCC.disapprovalTables['World Disapproval Custom']).toEqual({
      name: 'World Disapproval Custom',
      path: 'World Disapproval Custom'
    })
  })

  test('copies the four per-table scalar settings onto CONFIG.DCC when present', () => {
    globalThis.game.settings.get = vi.fn((scope, key) => {
      const map = {
        disapprovalCompendium: null,
        critsCompendium: null,
        divineAidTable: 'mod.divine',
        fumbleTable: 'mod.fumble',
        layOnHandsTable: 'mod.loh',
        mercurialMagicTable: 'mod.mercurial',
        turnUnholyTable: 'mod.turn'
      }
      return map[key]
    })

    registerTables()

    expect(globalThis.CONFIG.DCC.divineAidTable).toBe('mod.divine')
    expect(globalThis.CONFIG.DCC.fumbleTable).toBe('mod.fumble')
    expect(globalThis.CONFIG.DCC.layOnHandsTable).toBe('mod.loh')
    expect(globalThis.CONFIG.DCC.mercurialMagicTable).toBe('mod.mercurial')
    expect(globalThis.CONFIG.DCC.turnUnholyTable).toBe('mod.turn')
  })

  test('leaves the per-table scalars unset when the matching system setting is falsy', () => {
    registerTables()

    expect(globalThis.CONFIG.DCC.divineAidTable).toBeUndefined()
    expect(globalThis.CONFIG.DCC.fumbleTable).toBeUndefined()
    expect(globalThis.CONFIG.DCC.layOnHandsTable).toBeUndefined()
    expect(globalThis.CONFIG.DCC.mercurialMagicTable).toBeUndefined()
    expect(globalThis.CONFIG.DCC.turnUnholyTable).toBeUndefined()
  })

  test('disapprovalPacks._updateHook populates CONFIG.DCC.disapprovalTables from a pack index, with world tables taking precedence', async () => {
    globalThis.game.tables = Object.assign(
      [
        { name: 'Cleric Disapproval' }, // world copy wins for same name
        { name: 'Local Disapproval Variant' } // world-only
      ],
      { getName: vi.fn() }
    )
    const packIndex = new Map([
      ['c1', { name: 'Cleric Disapproval' }],
      ['c2', { name: 'Lawful Cleric Disapproval' }]
    ])
    globalThis.game.packs.get = vi.fn(() => ({
      index: { values: () => packIndex.values() }
    }))

    registerTables()
    globalThis.CONFIG.DCC.disapprovalPacks.addPack('module.cleric-disapproval')
    await globalThis.CONFIG.DCC.disapprovalPacks._updateHook(globalThis.CONFIG.DCC.disapprovalPacks)

    const tables = globalThis.CONFIG.DCC.disapprovalTables
    // World table overwrites the same-name compendium entry
    expect(tables['Cleric Disapproval']).toEqual({
      name: 'Cleric Disapproval',
      path: 'Cleric Disapproval'
    })
    // World-only disapproval table is included
    expect(tables['Local Disapproval Variant']).toEqual({
      name: 'Local Disapproval Variant',
      path: 'Local Disapproval Variant'
    })
    // Compendium-only entry retains the dotted path
    expect(tables['Lawful Cleric Disapproval']).toEqual({
      name: 'Lawful Cleric Disapproval',
      path: 'module.cleric-disapproval.Lawful Cleric Disapproval'
    })
  })

  test('disapprovalPacks._updateHook ignores world tables whose names contain neither "Disapproval" nor the localized term', async () => {
    globalThis.game.tables = Object.assign(
      [
        { name: 'Random Encounter Table' },
        { name: 'Disapproval — Custom' }
      ],
      { getName: vi.fn() }
    )
    globalThis.game.packs.get = vi.fn(() => null)

    registerTables()
    await globalThis.CONFIG.DCC.disapprovalPacks._updateHook(globalThis.CONFIG.DCC.disapprovalPacks)

    expect(globalThis.CONFIG.DCC.disapprovalTables['Random Encounter Table']).toBeUndefined()
    expect(globalThis.CONFIG.DCC.disapprovalTables['Disapproval — Custom']).toEqual({
      name: 'Disapproval — Custom',
      path: 'Disapproval — Custom'
    })
  })

  test('disapprovalPacks._updateHook detects the localized "Disapproval" term in non-English worlds', async () => {
    globalThis.game.i18n.localize = (key) => (key === 'DCC.Disapproval' ? 'Missbilligung' : key)
    globalThis.game.tables = Object.assign(
      [{ name: 'Missbilligung — Klerikaler' }],
      { getName: vi.fn() }
    )
    globalThis.game.packs.get = vi.fn(() => null)

    registerTables()
    await globalThis.CONFIG.DCC.disapprovalPacks._updateHook(globalThis.CONFIG.DCC.disapprovalPacks)

    expect(globalThis.CONFIG.DCC.disapprovalTables['Missbilligung — Klerikaler']).toEqual({
      name: 'Missbilligung — Klerikaler',
      path: 'Missbilligung — Klerikaler'
    })
  })
})

describe('getSkillTable', () => {
  beforeEach(() => {
    globalThis.CONFIG.DCC.skillTables = {
      turnUnholy: 'turnUnholyTable',
      divineAid: 'divineAidTable'
    }
    globalThis.CONFIG.DCC.skillTableLabels = {
      turnUnholy: 'DCC.SkillTurnUnholy'
    }
  })

  test('returns null when the skill is not in the skillTables index', async () => {
    const result = await getSkillTable('notARealSkill')
    expect(result).toBeNull()
  })

  test('returns null when skillTables maps the skill but the CONFIG.DCC.<table> scalar is unset', async () => {
    const result = await getSkillTable('turnUnholy')
    expect(result).toBeNull()
  })

  test('resolves a compendium-pack path of the form "pack.module.tableName"', async () => {
    globalThis.CONFIG.DCC.turnUnholyTable = 'dcc-core-book.dcc-core-tables.Turn Unholy'
    const tableDoc = { id: 'tt1', name: 'Turn Unholy' }
    globalThis.game.packs.get = vi.fn(() => ({
      index: {
        find: vi.fn((predicate) => predicate({ _id: 'tt1', name: 'Turn Unholy' }) ? { _id: 'tt1', name: 'Turn Unholy' } : null)
      },
      getDocument: vi.fn().mockResolvedValue(tableDoc)
    }))

    const result = await getSkillTable('turnUnholy')

    expect(globalThis.game.packs.get).toHaveBeenCalledWith('dcc-core-book.dcc-core-tables')
    expect(result).toBe(tableDoc)
  })

  test('falls back to a world table when the configured compendium pack is missing', async () => {
    globalThis.CONFIG.DCC.turnUnholyTable = 'missing.module.Turn Unholy'
    globalThis.game.packs.get = vi.fn(() => null)
    const worldTable = { id: 'wt1', name: 'Turn Unholy' }
    globalThis.game.tables.getName = vi.fn(() => worldTable)

    const result = await getSkillTable('turnUnholy')

    expect(globalThis.game.tables.getName).toHaveBeenCalledWith('Turn Unholy')
    expect(result).toBe(worldTable)
  })

  test('falls back to a world table by localized skill label when neither pack nor named world table resolves', async () => {
    globalThis.CONFIG.DCC.turnUnholyTable = null
    globalThis.game.i18n.localize = (key) => (key === 'DCC.SkillTurnUnholy' ? 'Wendegen Untote' : key)
    const localizedWorldTable = { id: 'wt2', name: 'Wendegen Untote' }
    globalThis.game.tables.getName = vi.fn((name) => name === 'Wendegen Untote' ? localizedWorldTable : null)

    const result = await getSkillTable('turnUnholy')

    expect(globalThis.game.tables.getName).toHaveBeenCalledWith('Wendegen Untote')
    expect(result).toBe(localizedWorldTable)
  })

  test('falls back to a world table by raw scalar value when it does not contain dots', async () => {
    globalThis.CONFIG.DCC.turnUnholyTable = 'My World Table'
    globalThis.game.packs.get = vi.fn(() => null)
    const worldTable = { id: 'wt3', name: 'My World Table' }
    globalThis.game.tables.getName = vi.fn(() => worldTable)

    const result = await getSkillTable('turnUnholy')

    expect(globalThis.game.tables.getName).toHaveBeenCalledWith('My World Table')
    expect(result).toBe(worldTable)
  })
})

describe('onDiceSoNiceReady', () => {
  test('asks the dice3d instance to show extra dice by default', () => {
    const dice3d = { showExtraDiceByDefault: vi.fn() }

    onDiceSoNiceReady(dice3d)

    expect(dice3d.showExtraDiceByDefault).toHaveBeenCalledWith(true)
  })
})

describe('onImportAdventure', () => {
  beforeEach(() => {
    globalThis.foundry = {
      canvas: { layers: { NotesLayer: { TOGGLE_SETTING: 'core.notesDisplayToggle' } } }
    }
  })

  test('toggles map-note display on and regenerates a thumbnail per scene from its Level', async () => {
    const sceneA = {
      name: 'Scene A',
      initialLevel: { id: 'level-a' },
      createThumbnail: vi.fn().mockResolvedValue({ thumb: 'thumb-a' }),
      update: vi.fn().mockResolvedValue(undefined)
    }
    const sceneB = {
      name: 'Scene B',
      initialLevel: { id: 'level-b' },
      createThumbnail: vi.fn().mockResolvedValue({ thumb: 'thumb-b' }),
      update: vi.fn().mockResolvedValue(undefined)
    }
    globalThis.game.scenes = [sceneA, sceneB]

    await onImportAdventure()

    expect(globalThis.game.settings.set).toHaveBeenCalledWith('core', 'core.notesDisplayToggle', true)
    // v14: createThumbnail renders from a Level id, never the deprecated `img` param
    expect(sceneA.createThumbnail).toHaveBeenCalledWith({ level: 'level-a' })
    expect(sceneB.createThumbnail).toHaveBeenCalledWith({ level: 'level-b' })
    expect(sceneA.update).toHaveBeenCalledWith({ thumb: 'thumb-a' })
    expect(sceneB.update).toHaveBeenCalledWith({ thumb: 'thumb-b' })
  })

  test('skips the update for scenes whose createThumbnail returns no thumb', async () => {
    const scene = {
      name: 'Empty',
      initialLevel: { id: 'level-empty' },
      createThumbnail: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined)
    }
    globalThis.game.scenes = [scene]

    await onImportAdventure()

    expect(scene.update).not.toHaveBeenCalled()
  })

  test('skips level-less scenes entirely rather than calling createThumbnail (v14 would throw)', async () => {
    const scene = {
      name: 'No Level',
      initialLevel: undefined,
      createThumbnail: vi.fn().mockResolvedValue({ thumb: 'never' }),
      update: vi.fn().mockResolvedValue(undefined)
    }
    globalThis.game.scenes = [scene]

    await onImportAdventure()

    expect(scene.createThumbnail).not.toHaveBeenCalled()
    expect(scene.update).not.toHaveBeenCalled()
  })
})

describe('onCreateRollTable', () => {
  beforeEach(() => {
    globalThis.CONFIG.DCC.disapprovalTables = {}
    globalThis.CONFIG.DCC.mightyDeedsTables = {}
  })

  test('adds the table to mightyDeedsTables when the name contains "Deed" (issue #319)', () => {
    onCreateRollTable({ name: 'Mighty Deed: Disarm' })

    expect(globalThis.CONFIG.DCC.mightyDeedsTables['Mighty Deed: Disarm']).toEqual({
      name: 'Mighty Deed: Disarm',
      path: 'Mighty Deed: Disarm'
    })
  })

  test('adds the table to disapprovalTables when the name contains "Disapproval"', () => {
    onCreateRollTable({ name: 'Custom Disapproval' })

    expect(globalThis.CONFIG.DCC.disapprovalTables['Custom Disapproval']).toEqual({
      name: 'Custom Disapproval',
      path: 'Custom Disapproval'
    })
  })

  test('adds the table when its name contains the localized "Disapproval" term', () => {
    globalThis.game.i18n.localize = (key) => (key === 'DCC.Disapproval' ? 'Missbilligung' : key)

    onCreateRollTable({ name: 'Kleriker Missbilligung' })

    expect(globalThis.CONFIG.DCC.disapprovalTables['Kleriker Missbilligung']).toBeDefined()
  })

  test('ignores tables whose name contains neither "Disapproval" nor the localized term', () => {
    onCreateRollTable({ name: 'Random Encounter Table' })

    expect(globalThis.CONFIG.DCC.disapprovalTables['Random Encounter Table']).toBeUndefined()
  })
})

describe('onDeleteRollTable', () => {
  test('removes the table from disapprovalTables by name', () => {
    globalThis.CONFIG.DCC.disapprovalTables = {
      'Cleric Disapproval': { name: 'Cleric Disapproval', path: 'Cleric Disapproval' },
      'Other Table': { name: 'Other Table', path: 'Other Table' }
    }
    globalThis.CONFIG.DCC.mightyDeedsTables = {}

    onDeleteRollTable({ name: 'Cleric Disapproval' })

    expect(globalThis.CONFIG.DCC.disapprovalTables['Cleric Disapproval']).toBeUndefined()
    expect(globalThis.CONFIG.DCC.disapprovalTables['Other Table']).toBeDefined()
  })

  test('removes the table from mightyDeedsTables by name (issue #319)', () => {
    globalThis.CONFIG.DCC.disapprovalTables = {}
    globalThis.CONFIG.DCC.mightyDeedsTables = {
      'Mighty Deed': { name: 'Mighty Deed', path: 'Mighty Deed' },
      'Other Deed': { name: 'Other Deed', path: 'Other Deed' }
    }

    onDeleteRollTable({ name: 'Mighty Deed' })

    expect(globalThis.CONFIG.DCC.mightyDeedsTables['Mighty Deed']).toBeUndefined()
    expect(globalThis.CONFIG.DCC.mightyDeedsTables['Other Deed']).toBeDefined()
  })

  test('is a no-op when the named table is not currently tracked', () => {
    globalThis.CONFIG.DCC.disapprovalTables = {}
    globalThis.CONFIG.DCC.mightyDeedsTables = {}

    expect(() => onDeleteRollTable({ name: 'Not Present' })).not.toThrow()
  })
})

describe('onUpdateRollTable', () => {
  test('does nothing when the change does not include a name field', () => {
    globalThis.CONFIG.DCC.disapprovalTables = {
      'Cleric Disapproval': { name: 'Cleric Disapproval', path: 'Cleric Disapproval' }
    }
    globalThis.CONFIG.DCC.mightyDeedsTables = {}
    globalThis.game.tables = Object.assign([], { getName: vi.fn() })

    onUpdateRollTable({ name: 'Cleric Disapproval' }, { description: 'changed' })

    expect(globalThis.CONFIG.DCC.disapprovalTables['Cleric Disapproval']).toBeDefined()
  })

  test('preserves compendium entries (dotted paths) and rebuilds the world half on rename', () => {
    globalThis.CONFIG.DCC.disapprovalTables = {
      'Cleric Disapproval': { name: 'Cleric Disapproval', path: 'dcc-core.dcc-tables.Cleric Disapproval' },
      'Old World Name': { name: 'Old World Name', path: 'Old World Name' }
    }
    globalThis.CONFIG.DCC.mightyDeedsTables = {}
    globalThis.game.tables = Object.assign(
      [{ name: 'New World Disapproval' }],
      { getName: vi.fn() }
    )

    onUpdateRollTable(
      { name: 'New World Disapproval' },
      { name: 'New World Disapproval' }
    )

    // Compendium entry survives (its path contains a dot)
    expect(globalThis.CONFIG.DCC.disapprovalTables['Cleric Disapproval']).toEqual({
      name: 'Cleric Disapproval',
      path: 'dcc-core.dcc-tables.Cleric Disapproval'
    })
    // Stale world entry is gone after rebuild
    expect(globalThis.CONFIG.DCC.disapprovalTables['Old World Name']).toBeUndefined()
    // New world entry from game.tables walk is present
    expect(globalThis.CONFIG.DCC.disapprovalTables['New World Disapproval']).toEqual({
      name: 'New World Disapproval',
      path: 'New World Disapproval'
    })
  })

  test('drops world tables that no longer match the disapproval predicate', () => {
    globalThis.CONFIG.DCC.disapprovalTables = {
      'Stale Disapproval': { name: 'Stale Disapproval', path: 'Stale Disapproval' }
    }
    globalThis.CONFIG.DCC.mightyDeedsTables = {}
    globalThis.game.tables = Object.assign(
      [{ name: 'Renamed Random Table' }],
      { getName: vi.fn() }
    )

    onUpdateRollTable(
      { name: 'Renamed Random Table' },
      { name: 'Renamed Random Table' }
    )

    expect(globalThis.CONFIG.DCC.disapprovalTables['Stale Disapproval']).toBeUndefined()
    expect(globalThis.CONFIG.DCC.disapprovalTables['Renamed Random Table']).toBeUndefined()
  })

  test('preserves compendium deed entries and rebuilds the world half on rename (issue #319)', () => {
    globalThis.CONFIG.DCC.disapprovalTables = {}
    globalThis.CONFIG.DCC.mightyDeedsTables = {
      'Core Deed': { name: 'Core Deed', path: 'dcc-core-book.dcc-tables.Core Deed' },
      'Old Deed Name': { name: 'Old Deed Name', path: 'Old Deed Name' }
    }
    globalThis.game.tables = Object.assign(
      [{ name: 'New World Deed' }],
      { getName: vi.fn() }
    )

    onUpdateRollTable(
      { name: 'New World Deed' },
      { name: 'New World Deed' }
    )

    // Compendium deed entry survives (its path contains a dot)
    expect(globalThis.CONFIG.DCC.mightyDeedsTables['Core Deed']).toEqual({
      name: 'Core Deed',
      path: 'dcc-core-book.dcc-tables.Core Deed'
    })
    // Stale world deed entry is gone after rebuild
    expect(globalThis.CONFIG.DCC.mightyDeedsTables['Old Deed Name']).toBeUndefined()
    // New world deed entry from game.tables walk is present
    expect(globalThis.CONFIG.DCC.mightyDeedsTables['New World Deed']).toEqual({
      name: 'New World Deed',
      path: 'New World Deed'
    })
  })
})

describe('TABLE_LOADING_HOOKS dispatch table', () => {
  test('routes each hook name to its matching handler', () => {
    expect(TABLE_LOADING_HOOKS.diceSoNiceReady.handler).toBe(onDiceSoNiceReady)
    expect(TABLE_LOADING_HOOKS.importAdventure.handler).toBe(onImportAdventure)
    expect(TABLE_LOADING_HOOKS.createRollTable.handler).toBe(onCreateRollTable)
    expect(TABLE_LOADING_HOOKS.deleteRollTable.handler).toBe(onDeleteRollTable)
    expect(TABLE_LOADING_HOOKS.updateRollTable.handler).toBe(onUpdateRollTable)
  })

  test('covers exactly the five documented hook names', () => {
    expect(Object.keys(TABLE_LOADING_HOOKS).sort()).toEqual([
      'createRollTable',
      'deleteRollTable',
      'diceSoNiceReady',
      'importAdventure',
      'updateRollTable'
    ])
  })

  test('flags only `importAdventure` as a once-only registration', () => {
    expect(TABLE_LOADING_HOOKS.importAdventure.once).toBe(true)
    expect(TABLE_LOADING_HOOKS.diceSoNiceReady.once).toBe(false)
    expect(TABLE_LOADING_HOOKS.createRollTable.once).toBe(false)
    expect(TABLE_LOADING_HOOKS.deleteRollTable.once).toBe(false)
    expect(TABLE_LOADING_HOOKS.updateRollTable.once).toBe(false)
  })
})

describe('registerTableLoadingHooks', () => {
  beforeEach(() => {
    globalThis.Hooks = { on: vi.fn(), once: vi.fn() }
  })

  test('wires every Hooks.on handler with the matching dispatch-table entry', () => {
    registerTableLoadingHooks()

    const onCalls = Object.fromEntries(globalThis.Hooks.on.mock.calls)
    expect(onCalls.diceSoNiceReady).toBe(onDiceSoNiceReady)
    expect(onCalls.createRollTable).toBe(onCreateRollTable)
    expect(onCalls.deleteRollTable).toBe(onDeleteRollTable)
    expect(onCalls.updateRollTable).toBe(onUpdateRollTable)
  })

  test('wires the once-only importAdventure handler via Hooks.once', () => {
    registerTableLoadingHooks()

    expect(globalThis.Hooks.once).toHaveBeenCalledWith('importAdventure', onImportAdventure)
  })

  test('registers exactly four Hooks.on listeners and one Hooks.once listener', () => {
    registerTableLoadingHooks()

    expect(globalThis.Hooks.on).toHaveBeenCalledTimes(4)
    expect(globalThis.Hooks.once).toHaveBeenCalledTimes(1)
  })
})
