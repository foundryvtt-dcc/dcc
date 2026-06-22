/* global CONFIG, foundry, game, Hooks */

/**
 * `init`-hook surface extracted from `module/dcc.js`.
 *
 * The Foundry `init` hook is the system's first bootstrap step: it wires
 * `CONFIG.*` document/data-model classes, the built-in class/sheet/variant
 * registries, the `game.dcc` extension namespace, the actor/item sheet
 * registrations, the Handlebars template + helper registration, and the
 * early Fleeting Luck setting (registered ahead of `ready` because
 * `getSceneControlButtons` reads it before `ready` fires).
 *
 * The body is split into named step functions so the unit tests can invoke
 * each concern as a plain function; `onInit()` runs them in order and
 * `registerInitHook()` wires it onto `Hooks.once('init', …)`. This mirrors
 * the `module/settings-table-hooks.mjs` / `module/chat-and-hook-wiring.mjs`
 * extraction pattern.
 */

import { logAbilityChange } from './ability-score-log.js'
import DCCActiveEffect from './active-effect.js'
import DCCActor from './actor.js'
import DCCActorSheet from './actor-sheet.js'
import * as DCCSheets from './actor-sheets-dcc.js'
import DCCCombatant from './combatant.js'
import DCCItem from './item.js'
import DCCItemSheet from './item-sheet.js'
import DCCRoll from './dcc-roll.js'
import DCC from './config.js'
import DiceChain from './dice-chain.js'
import FleetingLuck from './fleeting-luck.js'
import SpellDuel from './spell-duel.js'
import SpellResult from './spell-result.js'
import TableResult from './table-result.js'
import DCCPartySheet from './party-sheet.js'
import { getActiveVariant, registerActorSheet, registerClassDefaults, registerClassMixin, registerClassStartingItems, registerHomebrewClassForProgressionLoad, registerItemSheet, registerSheetPart, registerVariant } from './extension-api.mjs'
import { registerBuiltInClassMixins } from './built-in-class-mixins.mjs'
import { registerBuiltInClassDefaults } from './built-in-class-defaults.mjs'
import { registerBuiltInClassStartingItems } from './built-in-class-starting-items.mjs'
import { registerBuiltInClassLevelNames } from './built-in-class-level-names.mjs'
import { registerBuiltInSheetParts } from './built-in-sheet-parts.mjs'
import { registerBuiltInVariant } from './built-in-variant.mjs'
import { registerDCCHandlebarsHelpers } from './handlebars-helpers.mjs'
import { getMacroActor, getMacroOptions, rollDCCWeaponMacro } from './macros.mjs'
import { processSpellCheck } from './spell-check-processor.mjs'
import { getSkillTable } from './table-loading.mjs'
import { attachMightyDeedListeners, buildMightyDeedPrompt } from './chat.js'
import { registerClassProgression, registerClassProgressions } from './vendor/dcc-core-lib/data/classes/progression-utils.js'

// Import data models
import {
  // Actor data models
  PlayerData,
  NPCData,
  PartyData,
  // Item data models
  WeaponData,
  AmmunitionData,
  ArmorData,
  ContainerData,
  EquipmentData,
  LevelData,
  MountData,
  SpellData,
  TreasureData,
  SkillData
} from './data/_module.mjs'

/**
 * Handlebars template paths registered at init time. Kept as a module
 * constant so the unit tests can assert the set without booting Foundry.
 */
export const TEMPLATE_PATHS = Object.freeze([
  'systems/dcc/templates/actor-partial-pc-common.html',
  'systems/dcc/templates/actor-partial-npc-common.html',
  'systems/dcc/templates/actor-partial-pc-equipment.html',
  'systems/dcc/templates/actor-partial-npc-equipment.html',
  'systems/dcc/templates/actor-partial-pc-notes.html',
  'systems/dcc/templates/actor-partial-skills.html',
  'systems/dcc/templates/actor-partial-wizard-spells.html',
  'systems/dcc/templates/actor-partial-cleric-spells.html',
  'systems/dcc/templates/actor-partial-dwarf.html',
  'systems/dcc/templates/actor-partial-elf.html',
  'systems/dcc/templates/actor-partial-halfling.html',
  'systems/dcc/templates/actor-partial-thief.html',
  'systems/dcc/templates/actor-partial-warrior.html',
  'systems/dcc/templates/actor-partial-wizard.html',
  'systems/dcc/templates/item-sheet-partial-description.html',
  'systems/dcc/templates/item-sheet-partial-judge-description.html',
  'systems/dcc/templates/item-sheet-partial-tabs.html',
  'systems/dcc/templates/item-sheet-partial-values.html',
  'systems/dcc/templates/item-sheet-armor.html',
  'systems/dcc/templates/item-sheet-ammunition.html',
  'systems/dcc/templates/item-sheet-level.html',
  'systems/dcc/templates/item-sheet-mount.html',
  'systems/dcc/templates/item-sheet-treasure.html',
  'systems/dcc/templates/item-sheet-weapon.html',
  'systems/dcc/templates/item-sheet-weapon-npc.html',
  'systems/dcc/templates/item-sheet-weapon-pc.html',
  'systems/dcc/templates/roll-modifier-partial-die.html',
  'systems/dcc/templates/roll-modifier-partial-disapproval-die.html',
  'systems/dcc/templates/roll-modifier-partial-modifiers.html',
  'systems/dcc/templates/roll-modifier-partial-none.html',
  'systems/dcc/templates/roll-modifier-partial-check-penalty.html',
  'systems/dcc/templates/roll-modifier-partial-spellburn.html',
  'systems/dcc/templates/party-sheet-partial-party.html',
  'systems/dcc/templates/party-sheet-partial-tabs.html',
  'systems/dcc/templates/chat-card-attack-enhanced.html'
])

/**
 * Register the built-in DCC class / sheet / variant registries that must be
 * populated before any Player schema is first constructed or any sheet is
 * resolved.
 *
 * - Class mixins (Phase 4) relocate class-bound schema fields off the
 *   monolithic `player-data.mjs` static body onto per-class mixins. The
 *   registration table lives in `module/built-in-class-mixins.mjs` so the
 *   integration-test setup can register the same set without duplicating
 *   mixin bodies. Sibling modules contribute their own classes' mixins via
 *   `game.dcc.registerClassMixin` (see `docs/dev/EXTENSION_API.md` +
 *   `docs/dev/CLASS_DECOMPOSITION.md`).
 * - Class defaults (Phase 5 session 1) lift the per-class `_prepareContext`
 *   first-open default-write blocks off each sheet subclass onto a registry;
 *   sheets call `applyClassDefaults(actor, classId)`.
 * - Class starting items (Phase 5 session 2) lift the dwarf ShieldBash
 *   auto-create off the dwarf sheet subclass; class sheets call
 *   `applyClassStartingItems(actor, classId)` when `applyClassDefaults`
 *   returns `'initialized'`.
 * - Sheet parts (Phase 5 session 4) lift the per-class `CLASS_PARTS` +
 *   `CLASS_TABS` statics off the sheet subclasses; the shared `DCCSheet`
 *   base resolves parts + tabs via inherited static getters keyed on
 *   `this.CLASS_ID`.
 * - Class level-name prefixes (Phase 6 session 3) move the previously
 *   hardcoded `BUILT_IN_CLASS_LEVEL_NAMES` table out of
 *   `module/adapter/foundry-data-loader.mjs` onto a registry so homebrew
 *   content modules can register their own classId → itemPrefix mappings.
 * - The built-in variant (Phase 6 session 5) registers the `'dcc'` variant
 *   payload; the world-setting `dcc.activeVariant` selects which variant is
 *   live (defaults to `'dcc'`).
 */
export function registerBuiltInRegistries () {
  registerBuiltInClassMixins(registerClassMixin)
  registerBuiltInClassDefaults(registerClassDefaults)
  registerBuiltInClassStartingItems(registerClassStartingItems)
  registerBuiltInSheetParts(registerSheetPart)
  registerBuiltInClassLevelNames(registerHomebrewClassForProgressionLoad)
  registerBuiltInVariant(registerVariant)
}

/**
 * Register custom document classes, the ActiveEffect document class + V14
 * application phases + custom diceChain change type, and the DCC dice
 * fulfillment types onto `CONFIG.*`.
 */
export function registerDocumentConfig () {
  // Register custom ActiveEffect document class
  CONFIG.ActiveEffect.documentClass = DCCActiveEffect

  // Register Active Effect application phases (required for V14)
  CONFIG.ActiveEffect.phases = {
    initial: { priority: 0, label: 'Initial' },
    final: { priority: 100, label: 'Final' }
  }

  // Register custom diceChain change type for the ActiveEffect editing UI
  CONFIG.ActiveEffect.changeTypes ??= {}
  CONFIG.ActiveEffect.changeTypes.diceChain = {
    label: 'DCC.EffectChangeTypeDiceChain',
    defaultPriority: 2
  }

  // Add DCC Dice Types
  CONFIG.Dice.fulfillment.dice = CONFIG.DCC.diceTypes

  // Define custom Entity classes
  CONFIG.Actor.documentClass = DCCActor
  CONFIG.Item.documentClass = DCCItem
  CONFIG.Combatant.documentClass = DCCCombatant
}

/**
 * Register the Actor + Item TypeDataModel classes onto `CONFIG.*.dataModels`.
 */
export function registerDataModels () {
  // Register Actor data models
  CONFIG.Actor.dataModels = {
    Player: PlayerData,
    NPC: NPCData,
    Party: PartyData
  }

  // Register Item data models
  CONFIG.Item.dataModels = {
    weapon: WeaponData,
    ammunition: AmmunitionData,
    armor: ArmorData,
    container: ContainerData,
    equipment: EquipmentData,
    level: LevelData,
    mount: MountData,
    spell: SpellData,
    treasure: TreasureData,
    skill: SkillData
  }
}

/**
 * Assemble the `game.dcc` extension namespace — the Foundry-facing stable
 * surface that sibling modules and macros depend on. See
 * `docs/dev/EXTENSION_API.md` for the stability contract.
 */
export function assembleGameDccNamespace () {
  // noinspection JSUndefinedPropertyAssignment,JSUnusedGlobalSymbols
  game.dcc = {
    DCCActor,
    DCCRoll,
    DiceChain,
    FleetingLuck,
    SpellDuel,
    SpellResult,
    TableResult,
    getSkillTable,
    // Mighty Deed table prompt helpers — exposed so card-replacing modules
    // (e.g. dcc-qol) can render the prompt in their own attack card and wire
    // up the system's lookup handler. See docs/dev/EXTENSION_API.md.
    attachMightyDeedListeners,
    buildMightyDeedPrompt,
    logAbilityChange, // Exported for dependent modules (MCC glowburn, etc.)
    processSpellCheck,
    getActiveVariant, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerActorSheet, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerClassDefaults, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerClassMixin, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerClassProgression, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerClassProgressions, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerClassStartingItems, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerHomebrewClassForProgressionLoad, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerItemSheet, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerSheetPart, // Stable extension API — see docs/dev/EXTENSION_API.md
    registerVariant, // Stable extension API — see docs/dev/EXTENSION_API.md
    rollDCCWeaponMacro, // This is called from macros, don't remove
    getMacroActor, // This is called from macros, don't remove
    getMacroOptions // This is called from macros, don't remove
  }
}

/**
 * Register the actor and item sheet application classes via the stable
 * extension API we expose to modules.
 */
export function registerSheets () {
  const { Actors } = foundry.documents.collections
  const { ActorSheetV2 } = foundry.applications.sheets

  // Register sheet application classes via the stable extension API
  // we expose to modules. The legacy global `Actors.unregisterSheet`
  // remains as a one-shot statement of intent — "this system fully
  // replaces core actor sheets across every sub-type" — and stays
  // here rather than being implicitly tied to any one helper call.
  Actors.unregisterSheet('core', ActorSheetV2)

  // NPC sheets - DCCActorSheet as default, with Generic as option
  registerActorSheet('NPC', DCCActorSheet, { label: 'DCC.DCCActorSheet', makeDefault: true })
  registerActorSheet('NPC', DCCSheets.DCCActorSheetGeneric, { label: 'DCC.DCCActorSheetGeneric' })

  // PC sheets - class-specific sheets only
  registerActorSheet('Player', DCCSheets.DCCActorSheetCleric, { label: 'DCC.DCCActorSheetCleric' })
  registerActorSheet('Player', DCCSheets.DCCActorSheetThief, { label: 'DCC.DCCActorSheetThief' })
  registerActorSheet('Player', DCCSheets.DCCActorSheetHalfling, { label: 'DCC.DCCActorSheetHalfling' })
  registerActorSheet('Player', DCCSheets.DCCActorSheetWarrior, { label: 'DCC.DCCActorSheetWarrior' })
  registerActorSheet('Player', DCCSheets.DCCActorSheetWizard, { label: 'DCC.DCCActorSheetWizard' })
  registerActorSheet('Player', DCCSheets.DCCActorSheetDwarf, { label: 'DCC.DCCActorSheetDwarf' })
  registerActorSheet('Player', DCCSheets.DCCActorSheetElf, { label: 'DCC.DCCActorSheetElf' })
  registerActorSheet('Player', DCCSheets.DCCActorSheetGeneric, { label: 'DCC.DCCActorSheetGeneric' })

  registerActorSheet('Party', DCCPartySheet, { label: 'DCC.DCCPartySheet', makeDefault: true })

  // Use the stable extension API we expose to modules — folds the
  // unregister-default + register dance into a single call.
  registerItemSheet(undefined, DCCItemSheet, {
    label: 'DCC.DCCItemSheet',
    makeDefault: true
  })
}

/**
 * Load the system Handlebars templates and register the DCC Handlebars
 * helpers.
 */
export async function loadSystemTemplates () {
  const { loadTemplates } = foundry.applications.handlebars
  await loadTemplates([...TEMPLATE_PATHS])
  registerDCCHandlebarsHelpers()
}

/**
 * Register the Fleeting Luck setting early so it's available for
 * `getSceneControlButtons`, which fires before the `ready` hook where other
 * settings are registered.
 */
export function registerEarlySettings () {
  game.settings.register('dcc', 'enableFleetingLuck', {
    name: 'DCC.SettingEnableFleetingLuck',
    hint: 'DCC.SettingEnableFleetingLuckHint',
    requiresReload: true,
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })
}

/**
 * The Foundry `init` hook body. Runs the bootstrap steps in order.
 */
export async function onInit () {
  console.log(`DCC | Initializing Dungeon Crawl Classics System\n${DCC.ASCII}`)

  CONFIG.DCC = DCC

  registerBuiltInRegistries()
  registerDocumentConfig()
  registerDataModels()
  assembleGameDccNamespace()
  registerSheets()
  await loadSystemTemplates()
  registerEarlySettings()
}

/**
 * Production entry-point invoked from `module/dcc.js` in place of the inline
 * `Hooks.once('init', …)` block.
 */
export function registerInitHook () {
  Hooks.once('init', onInit)
}
