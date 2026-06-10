/* global game, Hooks */

/**
 * DCC
 *
 * System entry point (the sole `esmodules` entry in `system.json`). This file
 * is a thin orchestrator: it imports the focused hook-wiring modules and
 * invokes their `register*()` entry-points. The bootstrap bodies themselves
 * live in their own modules:
 *   - `init` hook            → `module/init-hook.mjs`
 *   - `getSceneControlButtons`→ inline below (Phase 7 slice 3 target)
 *   - `ready` hook           → inline below (Phase 7 slice 2 target)
 *   - settings-table hooks   → `module/settings-table-hooks.mjs`
 *   - table-loading hooks    → `module/table-loading.mjs`
 *   - adapter table caches   → `module/adapter/table-cache.mjs`
 *   - chat + lifecycle hooks → `module/chat-and-hook-wiring.mjs`
 */

// Import Modules
import * as migrations from './migrations.js'
import ReleaseNotes from './release-notes.js'
import KeyState from './key-state.js'
import { defineStatusIcons } from './status-icons.js'

import { pubConstants, registerSystemSettings } from './settings.js'
import WelcomeDialog from './welcomeDialog.js'
import { registerInitHook } from './init-hook.mjs'
import { registerSettingsTableHooks } from './settings-table-hooks.mjs'
import { registerTableLoadingHooks, registerTables, setupCoreBookCompendiumLinks } from './table-loading.mjs'
import { registerTableCacheInvalidation } from './adapter/table-cache.mjs'
import { registerChatAndHookWiring } from './chat-and-hook-wiring.mjs'
import { registerClassProgressionsFromPacks } from './adapter/foundry-data-loader.mjs'

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
// The `init` hook body lives in `module/init-hook.mjs`; `registerInitHook()`
// wires it onto `Hooks.once('init', …)`. See that module for the bootstrap
// steps (document/data-model config, built-in registries, the `game.dcc`
// namespace, sheet registration, template + helper registration, and the
// early Fleeting Luck setting).
registerInitHook()

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
  // Await world migration before continuing the ready chain so
  // `registerTables` / `FleetingLuck.init` / `dcc.ready` listeners see a
  // fully-migrated world instead of racing the async per-document
  // mutations. The returned status is threaded onto `dcc.ready` below.
  const migrationStatus = await migrations.checkMigrations()
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

  // Let modules know the DCC system is ready. The migration status (from
  // the awaited `checkMigrations` above) is threaded onto the payload so
  // listeners can branch on whether this client left the world fully
  // migrated — see `migrations.checkMigrations`.
  Hooks.callAll('dcc.ready', { migrationComplete: migrationStatus.migrationComplete })
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

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */
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

// Adapter-side table caches for the four table-loading sites in
// spell-input.mjs and utilities.js. Hooks the same world-RollTable
// lifecycle events as table-loading.mjs above and drops all four
// caches on any mutation so the next call re-walks. See
// module/adapter/table-cache.mjs.
registerTableCacheInvalidation()

// Chat and lifecycle hook wiring (11 handlers covering hotbarDrop,
// renderChatMessageHTML / getChatMessageContextOptions, the parser
// renderActorDirectory bridge, preCreate{Actor,Item} default-image
// assignment, applyActiveEffect dice-chain bumps, preUpdateActor
// prototype-token sync, updateCombat Active Effect expiry,
// item-piles-ready integration, and the getProseMirrorMenuDropDowns
// sidebar-style menu). See module/chat-and-hook-wiring.mjs for the
// handler bodies.
registerChatAndHookWiring()
