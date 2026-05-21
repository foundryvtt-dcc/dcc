/* global CONFIG, foundry, game, Hooks, ui */

/**
 * DCC
 */

// Import Modules
import DCCActiveEffect from './active-effect.js'
import DCCActor from './actor.js'
import DCCActorSheet from './actor-sheet.js'
import * as DCCSheets from './actor-sheets-dcc.js'
import DCCCombatant from './combatant.js'
import DCCItem from './item.js'
import DCCItemSheet from './item-sheet.js'
import DCCRoll from './dcc-roll.js'
import DCC from './config.js'
import * as chat from './chat.js'
import * as migrations from './migrations.js'
import DiceChain from './dice-chain.js'
import FleetingLuck from './fleeting-luck.js'
import SpellDuel from './spell-duel.js'
import parser from './parser.js'
import EntityImages from './entity-images.js'
import SpellResult from './spell-result.js'
import TableResult from './table-result.js'
import ReleaseNotes from './release-notes.js'
import KeyState from './key-state.js'
import { defineStatusIcons } from './status-icons.js'

import { pubConstants, registerSystemSettings } from './settings.js'
import WelcomeDialog from './welcomeDialog.js'
import DCCPartySheet from './party-sheet.js'
import { getActiveVariant, registerActorSheet, registerClassDefaults, registerClassMixin, registerClassStartingItems, registerHomebrewClassForProgressionLoad, registerItemSheet, registerSheetPart, registerVariant } from './extension-api.mjs'
import { registerBuiltInClassMixins } from './built-in-class-mixins.mjs'
import { registerBuiltInClassDefaults } from './built-in-class-defaults.mjs'
import { registerBuiltInClassStartingItems } from './built-in-class-starting-items.mjs'
import { registerBuiltInClassLevelNames } from './built-in-class-level-names.mjs'
import { registerBuiltInSheetParts } from './built-in-sheet-parts.mjs'
import { registerBuiltInVariant } from './built-in-variant.mjs'
import { registerDCCHandlebarsHelpers } from './handlebars-helpers.mjs'
import { createDCCMacro, getMacroActor, getMacroOptions, rollDCCWeaponMacro } from './macros.mjs'
import { registerSettingsTableHooks } from './settings-table-hooks.mjs'
import { processSpellCheck } from './spell-check-processor.mjs'
import { getSkillTable, registerTableLoadingHooks, registerTables, setupCoreBookCompendiumLinks } from './table-loading.mjs'
import { registerClassProgression, registerClassProgressions } from './vendor/dcc-core-lib/data/classes/progression-utils.js'
import { registerClassProgressionsFromPacks } from './adapter/foundry-data-loader.mjs'

import { setupItemPilesForDCC } from './item-piles-support.js'

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

const { Actors } = foundry.documents.collections
const { ActorSheetV2 } = foundry.applications.sheets
const { loadTemplates } = foundry.applications.handlebars

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once('init', async function () {
  console.log(`DCC | Initializing Dungeon Crawl Classics System\n${DCC.ASCII}`)

  CONFIG.DCC = DCC

  // Register built-in DCC class mixins before the Player schema is
  // first constructed. Phase 4 sessions 1+ relocate class-bound
  // fields off the monolithic `module/data/actor/player-data.mjs`
  // static body and onto their respective class mixins. The
  // registration table lives in `module/built-in-class-mixins.mjs`
  // so the integration-test setup can register the same set without
  // duplicating mixin bodies. Sibling modules contribute their own
  // classes' mixins via `game.dcc.registerClassMixin` (see
  // `docs/dev/EXTENSION_API.md` + `docs/dev/CLASS_DECOMPOSITION.md`).
  registerBuiltInClassMixins(registerClassMixin)

  // Register built-in DCC class defaults. Phase 5 session 1 lifts the
  // per-class `_prepareContext` first-open default-write blocks off
  // each sheet subclass in `module/actor-sheets-dcc.js` and onto this
  // registry; the sheets call `applyClassDefaults(actor, classId)`
  // instead. See `module/built-in-class-defaults.mjs` for the table.
  registerBuiltInClassDefaults(registerClassDefaults)

  // Register built-in DCC class starting items. Phase 5 session 2 lifts
  // the dwarf ShieldBash auto-create off the dwarf sheet subclass and
  // onto this registry; class sheets call
  // `applyClassStartingItems(actor, classId)` when `applyClassDefaults`
  // returns `'initialized'`. See `module/built-in-class-starting-items.mjs`
  // for the table.
  registerBuiltInClassStartingItems(registerClassStartingItems)

  // Register built-in DCC sheet parts. Phase 5 session 4 lifts the
  // per-class `CLASS_PARTS` + `CLASS_TABS` statics off the sheet
  // subclasses in `module/actor-sheets-dcc.js` and onto this registry;
  // the shared `DCCSheet` base resolves parts + tabs via inherited
  // static getters keyed on `this.CLASS_ID`. See
  // `module/built-in-sheet-parts.mjs` for the table.
  registerBuiltInSheetParts(registerSheetPart)

  // Register built-in DCC class level-name prefixes. Phase 6 session 3
  // lifted the previously hardcoded `BUILT_IN_CLASS_LEVEL_NAMES` table
  // out of `module/adapter/foundry-data-loader.mjs` and onto this
  // registry so homebrew content modules can register their own
  // classId → itemPrefix mappings without editing system code. The
  // loader at `registerClassProgressionsFromPacks` reads from
  // `CONFIG.DCC.classLevelNames` at `dcc.ready` time. See
  // `module/built-in-class-level-names.mjs` for the table.
  registerBuiltInClassLevelNames(registerHomebrewClassForProgressionLoad)

  // Register the built-in DCC variant. Phase 6 session 5 added
  // `game.dcc.registerVariant` as the stable extension surface for
  // variant ruleset modules (XCC, MCC, future homebrew variants); the
  // world-setting `dcc.activeVariant` selects which variant is live
  // (defaults to `'dcc'`). See `module/built-in-variant.mjs` for the
  // built-in payload and `docs/dev/EXTENSION_API.md` for the API.
  registerBuiltInVariant(registerVariant)

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

  // Add DCC Dice Types
  CONFIG.Dice.fulfillment.dice = CONFIG.DCC.diceTypes

  // Define custom Entity classes
  CONFIG.Actor.documentClass = DCCActor
  CONFIG.Item.documentClass = DCCItem
  CONFIG.Combatant.documentClass = DCCCombatant

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

  // Register template paths
  const templatePaths = [
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
    'systems/dcc/templates/party-sheet-partial-tabs.html'
  ]
  await loadTemplates(templatePaths)

  registerDCCHandlebarsHelpers()

  // Register Fleeting Luck setting early so it's available for getSceneControlButtons
  // which fires before the ready hook where other settings are registered
  game.settings.register('dcc', 'enableFleetingLuck', {
    name: 'DCC.SettingEnableFleetingLuck',
    hint: 'DCC.SettingEnableFleetingLuckHint',
    requiresReload: true,
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })
})

/* --------------------------------------------- */
/*  Initialize Scene Control Buttons             */
/* --------------------------------------------- */
Hooks.on('getSceneControlButtons', (controls) => {
  // Only add Fleeting Luck button if the setting is enabled
  try {
    if (game.settings.get('dcc', 'enableFleetingLuck')) {
      controls.tokens.tools.fleetingLuck = {
        name: 'fleetingLuck',
        title: 'DCC.FleetingLuck',
        icon: 'fas fa-balance-scale-left',
        onChange: (event, active) => {
          game.dcc.FleetingLuck.show()
        },
        button: true,
        active: true
      }
    }
  } catch (e) {
    console.error('DCC | Error adding Fleeting Luck button:', e)
  }

  controls.tokens.tools.spellDuel = {
    name: 'spellDuel',
    title: 'DCC.SpellDuel',
    icon: 'fas fa-hat-wizard',
    onChange: (event, active) => {
      game.dcc.SpellDuel.show()
    },
    button: true,
    active: true
  }
})

/* -------------------------------------------- */
/*  Post initialization hook                    */
/* -------------------------------------------- */
Hooks.once('ready', async function () {
  // Register system settings - needs to happen after packs are initialised
  await registerSystemSettings()

  // Turn Map Notes on by default
  game.settings.settings.get('core.notesDisplayToggle').default = true

  // Register the KeyState tracker
  game.dcc.KeyState = new KeyState()

  checkReleaseNotes()
  checkMigrations()
  registerTables()

  // Initialise Fleeting Luck
  game.dcc.FleetingLuck.init()

  // Initialise Spell Duel
  game.dcc.SpellDuel.init()

  // Add status icons
  defineStatusIcons()

  // Apply dark theme icon filter settings
  if (game.settings.get('dcc', 'disableDarkThemeIconFilter')) {
    document.body.classList.add('disable-dark-theme-icon-filter')
  }

  // Apply chat cards theme settings
  if (!game.settings.get('dcc', 'chatCardsUseAppTheme')) {
    document.body.classList.add('chat-cards-use-ui-theme')
  }

  // Show welcome dialog if enabled
  if (game.user.isGM && game.settings.get(pubConstants.name, 'showWelcomeDialog')) {
    new WelcomeDialog().render(true)
  }

  // Set up compendium links for the equipment tab if dcc-core-book is active
  setupCoreBookCompendiumLinks()

  // Load class progressions from registered level-data packs and
  // register them with the lib so consumer APIs (`getSavingThrows`,
  // `getCritDie`, `getSaveBonus`, `getClassProgression`) return
  // non-zero values for actors. Reads from `CONFIG.DCC.levelDataPacks`
  // (populated by dcc-core-book and similar content modules). Safe
  // no-op when no packs are configured. Runs BEFORE `dcc.ready`
  // fires so sibling-module listeners see the populated registry.
  // See `module/adapter/foundry-data-loader.mjs`.
  try {
    await registerClassProgressionsFromPacks()
  } catch (err) {
    console.error('DCC | Failed to load class progressions from level-data packs', err)
  }

  // Let modules know the DCC system is ready
  Hooks.callAll('dcc.ready')
})

function checkReleaseNotes () {
  // Determine if we should show the Release Notes/Credits chat card per user
  const lastSeenVersion = game.user.getFlag('dcc', 'lastSeenSystemVersion')
  const currentVersion = game.system.version

  if (lastSeenVersion !== currentVersion) {
    ReleaseNotes.addChatCard()
    game.user.setFlag('dcc', 'lastSeenSystemVersion', currentVersion)
  }

  // Register listeners for the buttons
  document.addEventListener('click', (event) => {
    const action = event.target.dataset.action
    if (action === 'dcc-release-notes') {
      _onShowURI('https://github.com/foundryvtt-dcc/dcc/releases')
    } else if (action === 'dcc-credits') {
      _onShowJournal('dcc.dcc-userguide', 'Credits')
    } else if (action === 'dcc-user-guide') {
      _onShowURI('https://foundryvtt-dungeon-crawl-classics-user-guide.readthedocs.io/en/latest/')
    }
  })
}

async function _onShowJournal (packName, journalName) {
  const pack = game.packs.get(packName)
  const metadata = await pack.index.getName(journalName)
  const doc = await pack.getDocument(metadata._id)
  await doc.sheet.render(true)
}

async function _onShowURI (uri) {
  window.open(uri)
}

function checkMigrations () {
  if (!game.user.isGM) return
  const currentVersion = game.settings.get('dcc', 'systemMigrationVersion')
  const decision = migrations.classifyMigrationDecision(currentVersion)
  if (decision === 'skip') return
  if (decision === 'block') {
    // Toggles to a dot-separated string so the decimal separator doesn't
    // drift between interpolated and literal tokens in locales that format
    // numbers with a comma.
    ui.notifications.error(
      game.i18n.format('DCC.MigrationUnsupportedVersion', {
        currentVersion: currentVersion.toFixed(2),
        minimumVersion: migrations.MINIMUM_SUPPORTED_VERSION.toFixed(2)
      }),
      { permanent: true }
    )
    return
  }
  migrations.migrateWorld()
}

// `setupCoreBookCompendiumLinks` / `registerTables` / `getSkillTable` /
// the `diceSoNiceReady` + `importAdventure` hooks + the three
// world-RollTable lifecycle hooks (`createRollTable` / `deleteRollTable`
// / `updateRollTable` that keep `CONFIG.DCC.disapprovalTables` in sync)
// live in `module/table-loading.mjs` — imported above; the ready-hook
// callbacks invoke `setupCoreBookCompendiumLinks` / `registerTables`
// directly and `registerTableLoadingHooks()` wires the five hooks. The
// `game.dcc.getSkillTable` re-publication at init time is the
// Foundry-facing stable surface (see `docs/dev/EXTENSION_API.md`).

// `processSpellCheck` lives in `module/spell-check-processor.mjs` —
// imported above and re-exported on `game.dcc.*` at the init hook
// (stable extension surface; see `docs/dev/EXTENSION_API.md`).

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */
// Create a macro when a rollable is dropped on the hotbar
Hooks.on('hotbarDrop', (bar, data, slot) => {
  return createDCCMacro(data, slot)
})

// Highlight 1's and 20's for all regular rolls, special spell check handling
Hooks.on('renderChatMessageHTML', async (message, html, data) => {
  if (!message.isRoll || !message.isContentVisible || !message.rolls.length) return

  if (game.user.isGM) {
    message.setFlag('core', 'canPopout', true)
  }
  chat.highlightCriticalSuccessFailure(message, html, data)
  chat.enforceMinimumDamage(message, html)
  SpellResult.processChatMessage(message, html, data)

  // Add data-item-id for modules that want to use it
  const itemId = message.getFlag('dcc', 'ItemId')
  if (itemId !== undefined) {
    const messageContent = html.querySelector('.message-content')
    if (messageContent) {
      messageContent.setAttribute('data-item-id', itemId)
    }
  }

  let emoteRolls = false
  try {
    emoteRolls = game.settings.get('dcc', 'emoteRolls')
  } catch {
    if (message.getFlag('dcc', 'emoteRoll') === true) {
      emoteRolls = true
    }
  }

  let automateDamageFumblesCrits
  try {
    automateDamageFumblesCrits = game.settings.get('dcc', 'automateDamageFumblesCrits')
  } catch {
    automateDamageFumblesCrits = false
  }

  if (emoteRolls === true) {
    if (game.user.isGM) {
      message.setFlag('dcc', 'emoteRoll', true)
    }
    chat.emoteAbilityRoll(message, html, data)
    chat.emoteApplyDamageRoll(message, html, data)
    chat.emoteAttackRoll(message, html, data)
    chat.emoteCritRoll(message, html, data)
    chat.emoteFumbleRoll(message, html, data)
    chat.emoteDamageRoll(message, html, data)
    chat.emoteInitiativeRoll(message, html, data)
    chat.emoteSavingThrowRoll(message, html, data)
    chat.emoteSkillCheckRoll(message, html, data)
  }

  // Show spell check pass/fail result for non-emote messages (emote path handles this in emoteSkillCheckRoll)
  if (emoteRolls === false) {
    const spellResult = message.getFlag('dcc', 'spellResult')
    if (spellResult) {
      const messageContent = html.querySelector('.message-content')
      if (messageContent) {
        messageContent.innerHTML += spellResult
      }
    }
  }

  if (emoteRolls === false || (emoteRolls === true && automateDamageFumblesCrits === false)) {
    // Await these async functions so the DOM is modified before we attach event listeners
    await chat.lookupCriticalRoll(message, html)
    await chat.lookupFumbleRoll(message, html, data)
  }

  // Process table result navigation AFTER emote/lookup functions have modified the HTML
  // This ensures event listeners are attached to the final DOM elements
  TableResult.processChatMessage(message, html, data)
})

// Support context menu on chat cards
Hooks.on('getChatMessageContextOptions', chat.addChatMessageContextOptions)

// Quick import for actors
Hooks.on('renderActorDirectory', (app, html) => {
  parser.onRenderActorDirectory(app, html)
})

// Settings-table hooks (9 handlers covering disapproval / critical hit
// packs, divine aid / fumble / lay on hands / turn unholy tables, level
// data packs, and the mercurial-magic per-class registry + legacy default
// setter). See module/settings-table-hooks.mjs for the handler bodies.
registerSettingsTableHooks()

// Table-loading hooks (5 handlers covering diceSoNiceReady,
// importAdventure, and the three world-RollTable lifecycle hooks
// — createRollTable / deleteRollTable / updateRollTable — that keep
// CONFIG.DCC.disapprovalTables in sync as world tables are added /
// renamed / removed). See module/table-loading.mjs for the handler
// bodies.
registerTableLoadingHooks()

// Entity pre-creation hooks - set default images before creation to avoid race conditions
Hooks.on('preCreateActor', (document, data, options) => {
  // Assign an appropriate DCC actor image if not set
  if (game.user.isGM && !data.img) {
    const img = EntityImages.imageForActor(document.type)
    if (img) {
      document.updateSource({ img })
    }
  }

  // Set Player actor prototype tokens to Link Actor Data by default
  // Only for brand-new actors (not duplicates or imports)
  if (!options.keepId && document.type === 'Player' && !document.name.includes('Item Pile')) {
    document.updateSource({ 'prototypeToken.actorLink': true })
  }
})

Hooks.on('preCreateItem', (document, data, options) => {
  if (!game.user.isGM || data.img) { return }

  // Assign an appropriate DCC item image
  const img = EntityImages.imageForItem(document.type)
  if (img) {
    document.updateSource({ img })
  }
})

Hooks.on('applyActiveEffect', (actor, change) => {
  const { key, value } = change
  let update = null
  // We're only interested in strings (dice expressions)
  const current = foundry.utils.getProperty(actor, key) ?? null
  if (typeof (current) === 'string') {
    // If this is a dice chain pattern (e.g. +1d) then we're interested
    const diceChainPattern = /([+-]?\d+)[dD]/
    const match = value.match(diceChainPattern)
    if (match) {
      update = game.dcc.DiceChain.bumpDie(current, parseInt(match[1]))
      foundry.utils.setProperty(actor, key, update)
    }
  }
  return update
})

// Sync prototype token image with actor image when actor image is changed
Hooks.on('preUpdateActor', async (actor, changes, options, userId) => {
  // Only process if this client initiated the change
  if (userId !== game.user.id) return

  // Check if the actor image is being changed
  if (!changes.img) return

  // Get the current prototype token texture
  const currentTokenImg = actor.prototypeToken?.texture?.src || ''

  // Define default images that should be replaced
  const defaultImages = [
    'icons/svg/mystery-man.svg',
    EntityImages.imageForActor(actor.type),
    EntityImages.imageForActor('default')
  ]

  // Only update token if it's using a default image or is empty
  if (!currentTokenImg || defaultImages.includes(currentTokenImg)) {
    // Update the prototype token image to match the new actor image
    changes['prototypeToken.texture.src'] = changes.img
  }
})

// Handle Active Effect duration automation
Hooks.on('updateCombat', async (combat, changed, options, userId) => {
  // Only process on the GM's client to avoid duplicates
  if (!game.user.isGM) return

  // Only process when round changes
  if (!('round' in changed)) return

  console.log(`DCC | Combat advanced to round ${combat.round}, checking for expired Active Effects...`)

  // Check all actors for expired effects
  for (const actor of game.actors) {
    if (actor.effects.size === 0) continue

    const expiredEffects = []

    for (const effect of actor.effects) {
      // Skip effects with no duration
      if (!effect.duration) continue

      // For round-based effects
      if (effect.duration.rounds && effect.duration.startRound !== undefined) {
        const startRound = effect.duration.startRound
        const durationRounds = effect.duration.rounds
        const endRound = startRound + durationRounds

        console.log(`DCC | Effect "${effect.name}": start=${startRound}, duration=${durationRounds}, end=${endRound}, current=${combat.round}`)

        if (combat.round >= endRound) {
          expiredEffects.push(effect.id)
          console.log(`DCC | Effect "${effect.name}" on ${actor.name} has expired (round ${combat.round} >= ${endRound})`)
        }
      } else if (effect.duration.seconds && effect.isExpired) {
        // For time-based effects, use Foundry's built-in expiration check
        expiredEffects.push(effect.id)
        console.log(`DCC | Time-based effect "${effect.name}" on ${actor.name} has expired`)
      }
    }

    // Remove expired effects
    if (expiredEffects.length > 0) {
      // Get effect names before deletion
      const effectNames = expiredEffects.map(id => {
        const effect = actor.effects.get(id)
        return effect?.name || 'Unknown'
      }).join(', ')

      await actor.deleteEmbeddedDocuments('ActiveEffect', expiredEffects)

      // Notify about expired effects
      ui.notifications.info(game.i18n.format('DCC.EffectsExpired', {
        actor: actor.name,
        effects: effectNames
      }))
    }
  }
})

// Set up Item Piles module compatibility
Hooks.once('item-piles-ready', setupItemPilesForDCC)

// Add custom ProseMirror menu dropdown for sidebar style
Hooks.on('getProseMirrorMenuDropDowns', (menu, items) => {
  if ('format' in items) {
    items.format.entries.push({
      action: 'dcc-custom',
      title: 'DCC.CustomStyles',
      active: (state) => {
        const { $from } = state.selection
        const preserveAttrs = $from.parent.attrs._preserve || {}
        return preserveAttrs.class?.includes('sidebar') || false
      },
      children: [
        {
          action: 'sidebar',
          title: 'DCC.SidebarText',
          node: menu.schema.nodes.paragraph,
          active: (state) => {
            const { $from } = state.selection
            const preserveAttrs = $from.parent.attrs._preserve || {}
            return preserveAttrs.class?.includes('sidebar') || false
          },
          cmd: () => {
            const { state, dispatch } = menu.view
            const { $from } = state.selection
            const currentNode = $from.parent
            const preserveAttrs = currentNode.attrs._preserve || {}
            const hasSidebarClass = preserveAttrs.class?.includes('sidebar')

            let newClass
            if (hasSidebarClass) {
              // Remove sidebar class
              newClass = preserveAttrs.class.split(' ').filter(c => c !== 'sidebar').join(' ') || null
            } else {
              // Add sidebar class
              newClass = preserveAttrs.class ? `${preserveAttrs.class} sidebar` : 'sidebar'
            }

            const newPreserve = { ...preserveAttrs }
            if (newClass) newPreserve.class = newClass
            else delete newPreserve.class

            return foundry.prosemirror.commands.setBlockType(menu.schema.nodes.paragraph, {
              ...currentNode.attrs,
              _preserve: newPreserve
            })(state, dispatch)
          }
        }
      ]
    })
  }
})
