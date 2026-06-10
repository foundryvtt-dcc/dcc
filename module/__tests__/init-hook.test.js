/**
 * Unit coverage for the `init`-hook surface extracted from `module/dcc.js`.
 * Each bootstrap step is exported as a plain function; the assertions stub
 * `CONFIG` / `game` / `Hooks` / `foundry` per-test and `vi.mock` every
 * sibling module so the steps can be invoked without a live Foundry boot.
 *
 * Mirrors the pattern in `settings-table-hooks.test.js` /
 * `chat-and-hook-wiring.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// --- Mock every sibling import as a lightweight sentinel ------------------
vi.mock('../active-effect.js', () => ({ default: { name: 'DCCActiveEffect' } }))
vi.mock('../actor.js', () => ({ default: { name: 'DCCActor' } }))
vi.mock('../actor-sheet.js', () => ({ default: { name: 'DCCActorSheet' } }))
vi.mock('../actor-sheets-dcc.js', () => ({
  DCCActorSheetCleric: { name: 'Cleric' },
  DCCActorSheetThief: { name: 'Thief' },
  DCCActorSheetHalfling: { name: 'Halfling' },
  DCCActorSheetWarrior: { name: 'Warrior' },
  DCCActorSheetWizard: { name: 'Wizard' },
  DCCActorSheetDwarf: { name: 'Dwarf' },
  DCCActorSheetElf: { name: 'Elf' },
  DCCActorSheetGeneric: { name: 'Generic' }
}))
vi.mock('../combatant.js', () => ({ default: { name: 'DCCCombatant' } }))
vi.mock('../item.js', () => ({ default: { name: 'DCCItem' } }))
vi.mock('../item-sheet.js', () => ({ default: { name: 'DCCItemSheet' } }))
vi.mock('../dcc-roll.js', () => ({ default: { name: 'DCCRoll' } }))
vi.mock('../config.js', () => ({ default: { ASCII: '<ascii>', diceTypes: ['d3', 'd4', 'd5'] } }))
vi.mock('../dice-chain.js', () => ({ default: { name: 'DiceChain' } }))
vi.mock('../fleeting-luck.js', () => ({ default: { name: 'FleetingLuck' } }))
vi.mock('../spell-duel.js', () => ({ default: { name: 'SpellDuel' } }))
vi.mock('../spell-result.js', () => ({ default: { name: 'SpellResult' } }))
vi.mock('../table-result.js', () => ({ default: { name: 'TableResult' } }))
vi.mock('../party-sheet.js', () => ({ default: { name: 'DCCPartySheet' } }))
vi.mock('../extension-api.mjs', () => ({
  getActiveVariant: vi.fn(),
  registerActorSheet: vi.fn(),
  registerClassDefaults: vi.fn(),
  registerClassMixin: vi.fn(),
  registerClassStartingItems: vi.fn(),
  registerHomebrewClassForProgressionLoad: vi.fn(),
  registerItemSheet: vi.fn(),
  registerSheetPart: vi.fn(),
  registerVariant: vi.fn()
}))
vi.mock('../built-in-class-mixins.mjs', () => ({ registerBuiltInClassMixins: vi.fn() }))
vi.mock('../built-in-class-defaults.mjs', () => ({ registerBuiltInClassDefaults: vi.fn() }))
vi.mock('../built-in-class-starting-items.mjs', () => ({ registerBuiltInClassStartingItems: vi.fn() }))
vi.mock('../built-in-class-level-names.mjs', () => ({ registerBuiltInClassLevelNames: vi.fn() }))
vi.mock('../built-in-sheet-parts.mjs', () => ({ registerBuiltInSheetParts: vi.fn() }))
vi.mock('../built-in-variant.mjs', () => ({ registerBuiltInVariant: vi.fn() }))
vi.mock('../handlebars-helpers.mjs', () => ({ registerDCCHandlebarsHelpers: vi.fn() }))
vi.mock('../macros.mjs', () => ({ getMacroActor: vi.fn(), getMacroOptions: vi.fn(), rollDCCWeaponMacro: vi.fn() }))
vi.mock('../spell-check-processor.mjs', () => ({ processSpellCheck: vi.fn() }))
vi.mock('../table-loading.mjs', () => ({ getSkillTable: vi.fn() }))
vi.mock('../vendor/dcc-core-lib/data/classes/progression-utils.js', () => ({
  registerClassProgression: vi.fn(),
  registerClassProgressions: vi.fn()
}))
vi.mock('../data/_module.mjs', () => ({
  PlayerData: { name: 'PlayerData' },
  NPCData: { name: 'NPCData' },
  PartyData: { name: 'PartyData' },
  WeaponData: { name: 'WeaponData' },
  AmmunitionData: { name: 'AmmunitionData' },
  ArmorData: { name: 'ArmorData' },
  ContainerData: { name: 'ContainerData' },
  EquipmentData: { name: 'EquipmentData' },
  LevelData: { name: 'LevelData' },
  MountData: { name: 'MountData' },
  SpellData: { name: 'SpellData' },
  TreasureData: { name: 'TreasureData' },
  SkillData: { name: 'SkillData' }
}))

const extensionApi = await import('../extension-api.mjs')
const builtInMixins = await import('../built-in-class-mixins.mjs')
const builtInDefaults = await import('../built-in-class-defaults.mjs')
const builtInStartingItems = await import('../built-in-class-starting-items.mjs')
const builtInLevelNames = await import('../built-in-class-level-names.mjs')
const builtInSheetParts = await import('../built-in-sheet-parts.mjs')
const builtInVariant = await import('../built-in-variant.mjs')
const handlebarsHelpers = await import('../handlebars-helpers.mjs')
const dataModels = await import('../data/_module.mjs')

const {
  TEMPLATE_PATHS,
  registerBuiltInRegistries,
  registerDocumentConfig,
  registerDataModels,
  assembleGameDccNamespace,
  registerSheets,
  loadSystemTemplates,
  registerEarlySettings,
  onInit,
  registerInitHook
} = await import('../init-hook.mjs')

let original

beforeEach(() => {
  original = {
    CONFIG: globalThis.CONFIG,
    game: globalThis.game,
    Hooks: globalThis.Hooks,
    foundry: globalThis.foundry,
    log: console.log
  }
  globalThis.CONFIG = {
    DCC: {},
    ActiveEffect: {},
    Dice: { fulfillment: {} },
    Actor: {},
    Item: {},
    Combatant: {}
  }
  globalThis.game = { settings: { register: vi.fn() } }
  globalThis.Hooks = { once: vi.fn() }
  globalThis.foundry = {
    documents: { collections: { Actors: { unregisterSheet: vi.fn() } } },
    applications: {
      sheets: { ActorSheetV2: class ActorSheetV2 {} },
      handlebars: { loadTemplates: vi.fn().mockResolvedValue(undefined) }
    }
  }
  console.log = vi.fn()
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.CONFIG = original.CONFIG
  globalThis.game = original.game
  globalThis.Hooks = original.Hooks
  globalThis.foundry = original.foundry
  console.log = original.log
})

describe('registerBuiltInRegistries', () => {
  test('wires each built-in registry to its matching extension-api register fn', () => {
    registerBuiltInRegistries()
    expect(builtInMixins.registerBuiltInClassMixins).toHaveBeenCalledWith(extensionApi.registerClassMixin)
    expect(builtInDefaults.registerBuiltInClassDefaults).toHaveBeenCalledWith(extensionApi.registerClassDefaults)
    expect(builtInStartingItems.registerBuiltInClassStartingItems).toHaveBeenCalledWith(extensionApi.registerClassStartingItems)
    expect(builtInSheetParts.registerBuiltInSheetParts).toHaveBeenCalledWith(extensionApi.registerSheetPart)
    expect(builtInLevelNames.registerBuiltInClassLevelNames).toHaveBeenCalledWith(extensionApi.registerHomebrewClassForProgressionLoad)
    expect(builtInVariant.registerBuiltInVariant).toHaveBeenCalledWith(extensionApi.registerVariant)
  })
})

describe('registerDocumentConfig', () => {
  beforeEach(() => { globalThis.CONFIG.DCC = { diceTypes: ['d7', 'd14'] } })

  test('registers the custom document classes', () => {
    registerDocumentConfig()
    expect(globalThis.CONFIG.Actor.documentClass.name).toBe('DCCActor')
    expect(globalThis.CONFIG.Item.documentClass.name).toBe('DCCItem')
    expect(globalThis.CONFIG.Combatant.documentClass.name).toBe('DCCCombatant')
    expect(globalThis.CONFIG.ActiveEffect.documentClass.name).toBe('DCCActiveEffect')
  })

  test('registers the V14 ActiveEffect application phases', () => {
    registerDocumentConfig()
    expect(globalThis.CONFIG.ActiveEffect.phases).toEqual({
      initial: { priority: 0, label: 'Initial' },
      final: { priority: 100, label: 'Final' }
    })
  })

  test('registers the custom diceChain ActiveEffect change type', () => {
    registerDocumentConfig()
    expect(globalThis.CONFIG.ActiveEffect.changeTypes.diceChain).toEqual({
      label: 'DCC.EffectChangeTypeDiceChain',
      defaultPriority: 2
    })
  })

  test('feeds the DCC dice types into the dice fulfillment config', () => {
    registerDocumentConfig()
    expect(globalThis.CONFIG.Dice.fulfillment.dice).toEqual(['d7', 'd14'])
  })
})

describe('registerDataModels', () => {
  test('registers the three Actor data models', () => {
    registerDataModels()
    expect(globalThis.CONFIG.Actor.dataModels).toEqual({
      Player: dataModels.PlayerData,
      NPC: dataModels.NPCData,
      Party: dataModels.PartyData
    })
  })

  test('registers all ten Item data models keyed by item type', () => {
    registerDataModels()
    expect(Object.keys(globalThis.CONFIG.Item.dataModels).sort()).toEqual([
      'ammunition', 'armor', 'container', 'equipment', 'level',
      'mount', 'skill', 'spell', 'treasure', 'weapon'
    ])
    expect(globalThis.CONFIG.Item.dataModels.weapon).toBe(dataModels.WeaponData)
    expect(globalThis.CONFIG.Item.dataModels.skill).toBe(dataModels.SkillData)
  })
})

describe('assembleGameDccNamespace', () => {
  test('exposes the documented stable extension-API surface on game.dcc', () => {
    assembleGameDccNamespace()
    const keys = Object.keys(globalThis.game.dcc)
    for (const expected of [
      'DCCActor', 'DCCRoll', 'DiceChain', 'FleetingLuck', 'SpellDuel', 'SpellResult', 'TableResult',
      'getSkillTable', 'processSpellCheck', 'getActiveVariant',
      'registerActorSheet', 'registerClassDefaults', 'registerClassMixin',
      'registerClassProgression', 'registerClassProgressions', 'registerClassStartingItems',
      'registerHomebrewClassForProgressionLoad', 'registerItemSheet', 'registerSheetPart', 'registerVariant',
      'rollDCCWeaponMacro', 'getMacroActor', 'getMacroOptions'
    ]) {
      expect(keys).toContain(expected)
    }
  })

  test('re-publishes the extension-api register fns by identity', () => {
    assembleGameDccNamespace()
    expect(globalThis.game.dcc.registerClassMixin).toBe(extensionApi.registerClassMixin)
    expect(globalThis.game.dcc.registerVariant).toBe(extensionApi.registerVariant)
    expect(globalThis.game.dcc.getActiveVariant).toBe(extensionApi.getActiveVariant)
  })
})

describe('registerSheets', () => {
  test('unregisters the core actor sheet exactly once', () => {
    registerSheets()
    const { Actors } = globalThis.foundry.documents.collections
    const { ActorSheetV2 } = globalThis.foundry.applications.sheets
    expect(Actors.unregisterSheet).toHaveBeenCalledTimes(1)
    expect(Actors.unregisterSheet).toHaveBeenCalledWith('core', ActorSheetV2)
  })

  test('registers 11 actor sheets (2 NPC + 8 Player + 1 Party)', () => {
    registerSheets()
    expect(extensionApi.registerActorSheet).toHaveBeenCalledTimes(11)
    const types = extensionApi.registerActorSheet.mock.calls.map(c => c[0])
    expect(types.filter(t => t === 'NPC')).toHaveLength(2)
    expect(types.filter(t => t === 'Player')).toHaveLength(8)
    expect(types.filter(t => t === 'Party')).toHaveLength(1)
  })

  test('registers the item sheet as the makeDefault for all item types', () => {
    registerSheets()
    expect(extensionApi.registerItemSheet).toHaveBeenCalledTimes(1)
    expect(extensionApi.registerItemSheet).toHaveBeenCalledWith(undefined, expect.anything(), {
      label: 'DCC.DCCItemSheet',
      makeDefault: true
    })
  })
})

describe('loadSystemTemplates', () => {
  test('loads the template paths and registers the Handlebars helpers', async () => {
    await loadSystemTemplates()
    const { loadTemplates } = globalThis.foundry.applications.handlebars
    expect(loadTemplates).toHaveBeenCalledWith([...TEMPLATE_PATHS])
    expect(handlebarsHelpers.registerDCCHandlebarsHelpers).toHaveBeenCalledTimes(1)
  })
})

describe('TEMPLATE_PATHS', () => {
  test('is a frozen, non-empty list of systems/dcc/templates paths', () => {
    expect(Object.isFrozen(TEMPLATE_PATHS)).toBe(true)
    expect(TEMPLATE_PATHS.length).toBeGreaterThan(0)
    expect(TEMPLATE_PATHS.every(p => p.startsWith('systems/dcc/templates/'))).toBe(true)
  })
})

describe('registerEarlySettings', () => {
  test('registers the enableFleetingLuck world setting with a reload requirement', () => {
    registerEarlySettings()
    expect(globalThis.game.settings.register).toHaveBeenCalledWith('dcc', 'enableFleetingLuck', expect.objectContaining({
      scope: 'world',
      type: Boolean,
      default: false,
      requiresReload: true,
      config: true
    }))
  })
})

describe('onInit', () => {
  test('sets CONFIG.DCC from the config module and runs the bootstrap steps', async () => {
    await onInit()
    // CONFIG.DCC is replaced by the (mocked) config default export
    expect(globalThis.CONFIG.DCC.ASCII).toBe('<ascii>')
    // Document + data-model config landed
    expect(globalThis.CONFIG.Actor.documentClass.name).toBe('DCCActor')
    expect(globalThis.CONFIG.Actor.dataModels.Player).toBe(dataModels.PlayerData)
    // Namespace + sheets + templates + early settings ran
    expect(globalThis.game.dcc).toBeDefined()
    expect(extensionApi.registerActorSheet).toHaveBeenCalledTimes(11)
    expect(globalThis.foundry.applications.handlebars.loadTemplates).toHaveBeenCalledTimes(1)
    expect(globalThis.game.settings.register).toHaveBeenCalledWith('dcc', 'enableFleetingLuck', expect.any(Object))
  })
})

describe('registerInitHook', () => {
  test('wires onInit onto Hooks.once(\'init\')', () => {
    registerInitHook()
    expect(globalThis.Hooks.once).toHaveBeenCalledTimes(1)
    expect(globalThis.Hooks.once).toHaveBeenCalledWith('init', onInit)
  })
})
