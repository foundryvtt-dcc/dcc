/* global game, Hooks */

/**
 * `ready`-hook surface extracted from `module/dcc.js`.
 *
 * The Foundry `ready` hook is the system's post-pack bootstrap step: it
 * registers the world settings (which need the packs initialised), seeds the
 * KeyState tracker, posts the per-user release-notes chat card, awaits world
 * migration, registers the world tables, initialises Fleeting Luck + Spell
 * Duel, applies the theme body classes, optionally shows the welcome dialog,
 * loads class progressions from level-data packs, and finally fires the
 * `dcc.ready` hook (threading the migration status onto the payload).
 *
 * The body lives in `onReady()`; `checkReleaseNotes()` is split out so the
 * unit tests can exercise the version-flag branch as a plain function;
 * `registerReadyHook()` wires `onReady` onto `Hooks.once('ready', …)`. This
 * mirrors the `module/init-hook.mjs` extraction pattern.
 */

import * as migrations from './migrations.js'
import ReleaseNotes from './release-notes.js'
import KeyState from './key-state.js'
import { defineStatusIcons } from './status-icons.js'
import { pubConstants, registerSystemSettings } from './settings.js'
import WelcomeDialog from './welcomeDialog.js'
import { registerTables, setupCoreBookCompendiumLinks } from './table-loading.mjs'
import { registerClassProgressionsFromPacks } from './adapter/foundry-data-loader.mjs'
import { registerSocket } from './socket.mjs'

/**
 * Determine whether to show the Release Notes/Credits chat card for this user,
 * and register the click listeners for the card's action buttons.
 */
export function checkReleaseNotes () {
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

/**
 * The Foundry `ready` hook body.
 */
export async function onReady () {
  // Register system settings - needs to happen after packs are initialised
  await registerSystemSettings()

  // Turn Map Notes on by default
  game.settings.settings.get('core.notesDisplayToggle').default = true

  // Register the KeyState tracker
  game.dcc.KeyState = new KeyState()

  // Wire the system socket (game.socket is available at ready). Lets player
  // clients request GM-side actions (damage/status application) — registered
  // handlers run only on the active GM. See module/socket.mjs.
  registerSocket()

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
}

/**
 * Production entry-point invoked from `module/dcc.js` in place of the inline
 * `Hooks.once('ready', …)` block.
 */
export function registerReadyHook () {
  Hooks.once('ready', onReady)
}
