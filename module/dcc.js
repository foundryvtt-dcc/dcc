/**
 * DCC
 *
 * System entry point (the sole `esmodules` entry in `system.json`). This file
 * is a thin orchestrator: it imports the focused hook-wiring modules and
 * invokes their `register*()` entry-points. The hook bodies themselves live
 * in their own modules:
 *   - `init` hook             → `module/init-hook.mjs`
 *   - `getSceneControlButtons` → `module/scene-control-hooks.mjs`
 *   - `ready` hook            → `module/ready-hook.mjs`
 *   - settings-table hooks    → `module/settings-table-hooks.mjs`
 *   - table-loading hooks     → `module/table-loading.mjs`
 *   - adapter table caches    → `module/adapter/table-cache.mjs`
 *   - chat + lifecycle hooks  → `module/chat-and-hook-wiring.mjs`
 */

// Import Modules
import { registerInitHook } from './init-hook.mjs'
import { registerSceneControlHooks } from './scene-control-hooks.mjs'
import { registerReadyHook } from './ready-hook.mjs'
import { registerSettingsTableHooks } from './settings-table-hooks.mjs'
import { registerTableLoadingHooks } from './table-loading.mjs'
import { registerTableCacheInvalidation } from './adapter/table-cache.mjs'
import { registerChatAndHookWiring } from './chat-and-hook-wiring.mjs'

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
// The `getSceneControlButtons` handler lives in
// `module/scene-control-hooks.mjs`; `registerSceneControlHooks()` wires it
// onto `Hooks.on(…)`. Adds the token-layer Fleeting Luck (setting-gated) and
// Spell Duel scene-control buttons.
registerSceneControlHooks()

/* -------------------------------------------- */
/*  Post initialization hook                    */
/* -------------------------------------------- */
// The `ready` hook body lives in `module/ready-hook.mjs`; `registerReadyHook()`
// wires it onto `Hooks.once('ready', …)`. See that module for the post-pack
// bootstrap (system settings, KeyState, release-notes card, world migration,
// table registration, Fleeting Luck / Spell Duel init, theme body classes,
// welcome dialog, class-progression loading, and the `dcc.ready` broadcast).
registerReadyHook()

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
