// Namespace DCC Configuration Values
// noinspection HtmlRequiredAltAttribute,HtmlUnknownTarget

import {
  giants,
  giantsNotGiants,
  humanoidHints,
  monsterCriticalHits
} from './config/monster-data.mjs'
import {
  defaultActorImages,
  defaultItemImages,
  macroImages
} from './config/images.mjs'
import {
  diceTypes,
  DICE_CHAIN,
  effectChangeTypes
} from './config/dice.mjs'
import { activeEffectKeys } from './config/active-effect-keys.mjs'
import {
  actorImporterItemPacks,
  actorImporterNameMap,
  actorImporterPromptThreshold,
  birthAugurEffectsPack,
  importTypes
} from './config/actor-importer.mjs'

const DCC = {}

// ASCII Artwork
DCC.ASCII = `_______________________________
______  _____  _____
|  _  \\/  __ \\/  __ \\
| | | || /  \\/| /  \\/
| | | || |    | |
| |/ / | \\__/\\| \\__/\\
|___/   \\____/ \\____/
_______________________________`

/**
 * The set of Ability Scores used within the system
 * @type {Object}
 */
DCC.abilities = {
  str: 'DCC.AbilityStr',
  agl: 'DCC.AbilityAgl',
  sta: 'DCC.AbilitySta',
  per: 'DCC.AbilityPer',
  int: 'DCC.AbilityInt',
  lck: 'DCC.AbilityLck'
}

/**
 * The set of Ability Score Modifiers used within the system
 * @type {Object}
 */
DCC.abilityModifiers = {
  0: -4,
  1: -4,
  2: -3,
  3: -3,
  4: -2,
  5: -2,
  6: -1,
  7: -1,
  8: -1,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 1,
  14: 1,
  15: 1,
  16: 2,
  17: 2,
  18: 3,
  19: 3,
  20: 4,
  21: 4,
  22: 5,
  23: 5,
  24: 6
}

/* -------------------------------------------- */

/**
 * Character alignment options
 * @type {Object}
 */
DCC.alignments = {
  l: 'DCC.AlignmentL',
  n: 'DCC.AlignmentN',
  c: 'DCC.AlignmentC'
}

/**
 * Character critical hit ranges
 * @type {Object}
 */
DCC.critRanges = {
  30: '30+',
  29: '29+',
  28: '28+',
  27: '27+',
  26: '26+',
  25: '25+',
  24: '24+',
  23: '23+',
  22: '22+',
  21: '21+',
  20: '20+',
  19: '19+',
  18: '18+',
  17: '17+',
  16: '16+',
  15: '15+',
  14: '14+',
  13: '13+',
  12: '12+',
  11: '11+',
  10: '10+',
  9: '9+',
  8: '8+',
  7: '7+',
  6: '6+',
  5: '5+',
  4: '4+',
  3: '3+',
  2: '2+',
  1: '1+'
}

/**
 * Warrior critical hit ranges by level
 * @type {Object}
 */
DCC.warriorCritRangeByLevel = {
  1: 19,
  2: 19,
  3: 19,
  4: 19,
  5: 18,
  6: 18,
  7: 18,
  8: 18,
  9: 17,
  10: 17
}

/**
 * Character disapproval ranges
 * @type {Object}
 */
DCC.disapprovalRanges = {
  1: '1 - 1',
  2: '1 - 2',
  3: '1 - 3',
  4: '1 - 4',
  5: '1 - 5',
  6: '1 - 6',
  7: '1 - 7',
  8: '1 - 8',
  9: '1 - 9',
  10: '1 - 10',
  11: '1 - 11',
  12: '1 - 12',
  13: '1 - 13',
  14: '1 - 14',
  15: '1 - 15',
  16: '1 - 16',
  17: '1 - 17',
  18: '1 - 18',
  19: '1 - 19',
  20: '1 - 20'
}

/* -------------------------------------------- */

/**
 * Character saving throws
 * @type {Object}
 */
DCC.saves = {
  ref: 'DCC.SavesReflex',
  frt: 'DCC.SavesFortitude',
  wil: 'DCC.SavesWill'
}

/* -------------------------------------------- */

/**
 * Item entity types
 * @type {Object}
 */
DCC.items = {
  weapon: 'DCC.Weapon',
  ammunition: 'DCC.Ammunition',
  armor: 'DCC.Armor',
  container: 'DCC.Container',
  level: 'DCC.Level',
  equipment: 'DCC.Equipment',
  mount: 'DCC.Mount',
  spell: 'DCC.Spell',
  skill: 'DCC.Skill',
  treasure: 'DCC.Treasure'
}

/**
 * Spell casting modes
 */
DCC.castingModes = {
  generic: 'DCC.SpellCastingModeGeneric',
  wizard: 'DCC.SpellCastingModeWizard',
  cleric: 'DCC.SpellCastingModeCleric'
}

/**
 * Spell check abilities - which ability modifier to use for spell checks
 */
DCC.spellCheckAbilities = {
  int: 'DCC.AbilityInt',
  per: 'DCC.AbilityPer',
  sta: 'DCC.AbilitySta'
}

/**
 * Attack Bonus modes
 */
DCC.attackBonusModes = {
  flat: 'DCC.AttackBonusConfigModeFlat',
  autoPerAttack: 'DCC.AttackBonusConfigModeAutoPerAttack'
}

/**
 * The valid currency denominations supported by the DCC system
 * @type {Object}
 */
DCC.currencies = {
  pp: 'DCC.CurrencyPP',
  ep: 'DCC.CurrencyEP',
  gp: 'DCC.CurrencyGP',
  sp: 'DCC.CurrencySP',
  cp: 'DCC.CurrencyCP'
}

/**
 * The currencies supported by the DCC system ranked by value from low to high
 * @type {Array}
 */
DCC.currencyRank = [
  'cp', 'sp', 'gp', 'ep', 'pp'
]

/**
 * The currencies supported by the DCC system expressed in terms of the lowest denomination
 * @type {Object}
 */
DCC.currencyValue = {
  pp: 10000,
  ep: 1000,
  gp: 100,
  sp: 10,
  cp: 1
}

// Active Effect attribute-key reference table is extracted into
// ./config/active-effect-keys.mjs and re-composed onto DCC here so the public
// CONFIG.DCC.activeEffectKeys surface is unchanged. (No runtime code consumer;
// retained as a documented reference — see that module's header.)
DCC.activeEffectKeys = activeEffectKeys

// Dice config (diceTypes / DICE_CHAIN / effectChangeTypes) is extracted into
// ./config/dice.mjs and re-composed onto DCC here so the public CONFIG.DCC
// shape is unchanged. Consumed by module/dcc.js (CONFIG.Dice.fulfillment.dice),
// module/dice-chain.js, and module/active-effect.js.
DCC.diceTypes = diceTypes

// Hit Die Per Class
DCC.hitDiePerClass = {
  cleric: '1d8',
  thief: '1d6',
  halfling: '1d6',
  warrior: '1d12',
  wizard: '1d4',
  dwarf: '1d10',
  elf: '1d6'
}

// Monster-classification data (humanoidHints / giants / giantsNotGiants /
// monsterCriticalHits) is extracted into ./config/monster-data.mjs and
// re-composed onto DCC here so the public CONFIG.DCC shape is unchanged.
// Consumed by module/npc-parser.js.
DCC.giants = giants
DCC.giantsNotGiants = giantsNotGiants
DCC.humanoidHints = humanoidHints
DCC.monsterCriticalHits = monsterCriticalHits

// Actor-importer config (importTypes / actorImporterPromptThreshold /
// actorImporterItemPacks / birthAugurEffectsPack / actorImporterNameMap) is
// extracted into ./config/actor-importer.mjs and re-composed onto DCC here so
// the public CONFIG.DCC shape is unchanged. Consumed by module/parser.js
// (+ its import dialog template).
DCC.importTypes = importTypes

// Languages
DCC.languages = {
  common: 'DCC.LanguagesCommon',
  draconic: 'DCC.LanguagesDraconic',
  dwarvish: 'DCC.LanguagesDwarvish',
  elvish: 'DCC.LanguagesElvish',
  giant: 'DCC.LanguagesGiant',
  goblin: 'DCC.LanguagesGoblin',
  gnoll: 'DCC.LanguagesGnoll',
  halfling: 'DCC.LanguagesHalfling',
  orc: 'DCC.LanguagesOrc',
  cant: 'DCC.LanguagesThievesCant'
}

// The dice chain + custom effect-change types (extracted into ./config/dice.mjs)
DCC.DICE_CHAIN = DICE_CHAIN
DCC.effectChangeTypes = effectChangeTypes

// Critical Hit and Disapproval Compendiums, Fumble table, and Mercurial Magic table
// Updated at runtime from settings
DCC.criticalHitPacks = null
DCC.disapprovalPacks = null
DCC.divineAidTable = null
DCC.levelDataPacks = null
DCC.fumbleTable = null
DCC.layOnHandsTable = null
DCC.mercurialMagicTable = null

// Per-class mercurial magic table registry, keyed by lowercase
// `system.details.sheetClass` (e.g. `'wizard'`, `'elf'`, `'blaster'`,
// `'gnome'`). The `'default'` key carries the world-setting value and
// stays mirrored in `mercurialMagicTable` above for back-compat
// readers. Populated via the `dcc.registerMercurialMagicTable` hook.
DCC.mercurialMagicTables = {}

// Per-class schema-mixin registry, keyed by lowercase canonical class
// identifier (`'halfling'`, `'warrior'`, `'cleric'`, …). Each entry is
// a mutator function invoked during `PlayerData.defineSchema()` to
// contribute class-specific fields onto the schema (typically into
// `schema.skills.fields` or `schema.class.fields`). Populated via the
// `game.dcc.registerClassMixin` extension helper. Phase 4 §2.1 — the
// long-term direction is for every class-bound field on the monolithic
// Player schema to relocate to its class mixin; session 1 ships the
// infrastructure plus a built-in `'halfling'` mixin for `sneakAndHide`.
DCC.classMixins = {}

// Per-class identity + mechanical defaults registry, keyed by lowercase
// canonical class identifier (`'halfling'`, `'warrior'`, `'cleric'`, …).
// Each entry packages the `system.*` writes that the legacy class-sheet
// subclasses inlined into their `_prepareContext` first-open block:
// localized `class.className` / `details.sheetClass`, enriched-HTML
// `classLink` (and optional `mightyDeedsLink` / `spellcastingLink` /
// `spellburnLink`), plus scalar mechanical defaults (critRange,
// attackBonusMode, addClassLevelToInitiative, etc.). Applied via the
// `applyClassDefaults` helper exported alongside the registration hook.
// Populated by the `game.dcc.registerClassDefaults` extension helper.
// Phase 5 §2.11 — the long-term direction is to collapse per-class sheet
// subclasses into a single composable `DCCSheet`; this registry is the
// data-side half of that collapse.
DCC.classDefaults = {}

// Per-class starting-items registry, keyed by lowercase canonical class
// identifier. Each entry is an array of `{ nameKey, type, img?, system? }`
// item-data descriptors auto-created on a Player document the first time
// its class sheet opens (gated on `applyClassDefaults` returning
// `'initialized'`). Today only `dwarf` has an entry (the ShieldBash
// weapon); the registry exists for homebrew classes that need
// auto-created starting equipment. Populated by the
// `game.dcc.registerClassStartingItems` extension helper.
DCC.classStartingItems = {}

// Per-class sheet-parts registry, keyed by lowercase canonical class
// identifier. Each entry packages the per-class Handlebars part
// definitions (CLASS_PARTS-shaped: `partKey → { id, template }`) and
// tab declarations (CLASS_TABS-shaped: `group → { tabs: [...] }`) that
// the class sheet renders. The shared `DCCSheet` base class consumes
// this registry via inherited static getters keyed on
// `this.CLASS_ID`, so the per-class subclasses in
// `module/actor-sheets-dcc.js` collapse to thin stubs that just pin
// `static CLASS_ID`. Populated by the `game.dcc.registerSheetPart`
// extension helper. Phase 5 §2.11 — sheet markup composition.
DCC.sheetParts = {}

// Per-class level-data-pack item-name prefix registry, keyed by
// lowercase canonical class identifier (`'cleric'`, `'warrior'`, …).
// Each value is the capitalized-or-lowercase prefix that appears on
// the `{prefix}-{level}` items inside the level-data compendium
// packs registered via `CONFIG.DCC.levelDataPacks.addPack(...)`.
// Phase 6 session 3 added this registry so the
// `registerClassProgressionsFromPacks` loader at
// `module/adapter/foundry-data-loader.mjs` knows which classIds to
// walk; homebrew content modules contribute their own entries via
// `game.dcc.registerHomebrewClassForProgressionLoad(classId, itemPrefix)`.
DCC.classLevelNames = {}

// Variant ruleset registry, keyed by lowercase variant id (`'dcc'`,
// `'xcc'`, `'mcc'`). Each entry is `{ id, label, classes,
// sheetTheme? }` — declarative metadata for the named set of classes
// active in a world. Phase 6 session 5 added this registry so variant
// modules (XCC, MCC, future homebrew variants) can ship as Foundry
// modules rather than overriding `CONFIG.Actor.documentClass`
// globally. The `dcc.activeVariant` world setting (defaults to
// `'dcc'`) selects which entry is live; the DCC system dogfoods the
// helper by seeding the canonical `'dcc'` variant via
// `module/built-in-variant.mjs` at `init`. Sibling variants register
// via `game.dcc.registerVariant({...})` from their own `init` hook.
DCC.variants = {}

DCC.turnUnholyTable = null

// List of available disapproval tables for the cleric sheet, generated from disapprovalPacks
DCC.disapprovalTables = {}

// Registry for skills that use a table lookup - maps skill name to config property
// System defaults defined here, modules can register their own
DCC.skillTables = {
  divineAid: 'divineAidTable',
  layOnHands: 'layOnHandsTable',
  turnUnholy: 'turnUnholyTable'
}

// Maps skill names to their i18n label keys for world table lookup by localized name
DCC.skillTableLabels = {
  divineAid: 'DCC.DivineAid',
  layOnHands: 'DCC.LayOnHands',
  turnUnholy: 'DCC.TurnUnholy'
}

// Default actor / item / macro image lookup tables are extracted into
// ./config/images.mjs and re-composed onto DCC here so the public CONFIG.DCC
// shape is unchanged. Consumed by module/entity-images.js.
DCC.defaultActorImages = defaultActorImages
DCC.defaultItemImages = defaultItemImages
DCC.macroImages = macroImages

// Remaining actor-importer tables (threshold / item packs / birth-augur pack /
// name map) extracted into ./config/actor-importer.mjs and re-composed onto DCC
// here so the public CONFIG.DCC shape is unchanged. Consumed by
// module/parser.js.
DCC.actorImporterPromptThreshold = actorImporterPromptThreshold
DCC.actorImporterItemPacks = actorImporterItemPacks
DCC.birthAugurEffectsPack = birthAugurEffectsPack
DCC.actorImporterNameMap = actorImporterNameMap

export default DCC
