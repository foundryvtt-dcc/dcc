/* global game */

/**
 * Foundry compendium → dcc-core-lib data-registry loader.
 *
 * Phase 6 session 2 (2026-05-19) wired this module to walk
 * `CONFIG.DCC.levelDataPacks` at `dcc.ready` time, parse each
 * `{ClassName}-{level}` item's `system.levelData` text, map the
 * Foundry-system-paths into the lib's `ProgressionLevelData` shape,
 * and call `registerClassProgressions(...)` so the lib's consumer
 * APIs (`getSavingThrows`, `getCritDie`, `getSaveBonus`,
 * `getClassProgression`) return non-zero values for actors.
 *
 * The level-data items are the existing extensibility mechanism for
 * class progressions — they were originally designed so content
 * creators could ship their own compendium packs of level data
 * (registered via `CONFIG.DCC.levelDataPacks.addPack(...)`). This
 * loader uses the same mechanism: dcc-core-book's level pack
 * populates the seven built-in classes; homebrew packs adding their
 * own `{ClassName}-{level}` items get loaded too — just add the
 * className to `BUILT_IN_CLASS_LEVEL_NAMES` (or extend later via a
 * registerHomebrewClassForProgressionLoad-style helper).
 *
 * The open-source DCC system ships only this loader — no class
 * progression *data*. The data lives in user-installed content
 * modules (dcc-core-book, sibling content packs).
 *
 * For domain-specific loaders (disapproval, mercurial-magic,
 * patron-taint tables), see the per-domain input modules:
 * `spell-input.mjs` has `loadDisapprovalTable` +
 * `loadMercurialMagicTable`; crit / fumble lookups go through
 * `module/utilities.js`'s `getCritTableResult` /
 * `getFumbleTableResult`. This module handles cross-domain
 * registry sync only.
 */

import { registerClassProgressions } from '../vendor/dcc-core-lib/data/classes/progression-utils.js'

/**
 * Lowercase canonical classId → item-name prefix used in the level
 * packs. The pack convention is lowercase: `warrior-1`, `cleric-3`,
 * `dwarf-7`, etc. — matching the lowercase classId 1:1 today. The
 * mapping is kept as a separate table so a future homebrew pack
 * with a non-classId prefix can override (e.g., classId
 * `'my-druid'` → item-prefix `'druid'`).
 */
const BUILT_IN_CLASS_LEVEL_NAMES = {
  cleric: 'cleric',
  dwarf: 'dwarf',
  elf: 'elf',
  halfling: 'halfling',
  thief: 'thief',
  warrior: 'warrior',
  wizard: 'wizard'
}

/**
 * Maximum level to attempt loading. DCC tops out at 10 (the lib's
 * `ProgressionLevelData` map is sparse — missing levels are
 * silently skipped).
 */
const MAX_LEVEL = 10

/**
 * Parse the `system.levelData` text format (newline-separated
 * `key=value` pairs) into a plain object. Values are coerced to
 * `Number` when they parse cleanly, otherwise kept as the raw
 * string. Mirrors the parser in
 * `module/actor-level-change.js:_getLevelDataFromItem` so format
 * changes stay in sync.
 *
 * @param {string} text - raw `system.levelData` from a level item.
 * @returns {Object<string, number|string>} parsed key/value object.
 */
export function parseLevelDataText (text) {
  if (typeof text !== 'string' || !text.trim()) return {}
  return text
    .trim()
    .split('\n')
    .reduce((acc, line) => {
      const eq = line.indexOf('=')
      if (eq < 0) return acc
      const key = line.slice(0, eq).trim()
      const rawValue = line.slice(eq + 1).trim()
      if (!key) return acc
      // isNaN('') is false (treats empty string as 0). Guard against
      // empty rhs to avoid coercing `key=` to 0.
      acc[key] = rawValue !== '' && !isNaN(rawValue) ? Number(rawValue) : rawValue
      return acc
    }, {})
}

/**
 * Map a parsed level-data object onto the lib's `ProgressionLevelData`
 * shape. Every field is optional — missing slots are skipped (the
 * lib's consumer APIs return zero/default in that case).
 *
 * Path → field mapping (Foundry-system-path on the left, lib field on
 * the right):
 *
 * - `system.saves.ref.value` → `saves.ref`
 * - `system.saves.frt.value` → `saves.frt`
 * - `system.saves.wil.value` → `saves.wil`
 * - `system.details.attackHitBonus` → `attackBonus`
 *   (number for flat-mode classes; dice notation like `d3` for
 *    warrior deeds)
 * - `system.details.critDie` → `criticalDie`
 * - `system.details.critTable` → `criticalTable`
 * - `system.details.critRange` → `critRange` (warriors only)
 * - `system.attributes.actionDice.value` → `actionDice`
 *   (comma-separated string → array)
 * - `system.attributes.hitDice.value` → `hitDie`
 *   (the level-1 item carries `1dN`; higher-level items carry
 *    `LdN` rolled-total; strip the count to recover the class hit
 *    die)
 * - `system.class.luckDie` → `luckDie` (thieves / halflings)
 *
 * @param {Object<string, number|string>} parsed - output of
 *   `parseLevelDataText`.
 * @returns {object} a `ProgressionLevelData`-shaped object (possibly
 *   sparse).
 */
export function buildProgressionLevelFromParsed (parsed) {
  const out = {}

  const ref = parsed['system.saves.ref.value']
  const frt = parsed['system.saves.frt.value']
  const wil = parsed['system.saves.wil.value']
  if (ref !== undefined || frt !== undefined || wil !== undefined) {
    out.saves = {
      ref: typeof ref === 'number' ? ref : 0,
      frt: typeof frt === 'number' ? frt : 0,
      wil: typeof wil === 'number' ? wil : 0
    }
  }

  const atk = parsed['system.details.attackHitBonus']
  if (atk !== undefined) out.attackBonus = atk

  const critDie = parsed['system.details.critDie']
  if (critDie !== undefined) out.criticalDie = String(critDie)

  const critTable = parsed['system.details.critTable']
  if (critTable !== undefined) out.criticalTable = String(critTable)

  const critRange = parsed['system.details.critRange']
  if (typeof critRange === 'number') out.critRange = critRange

  const actionDice = parsed['system.attributes.actionDice.value']
  if (typeof actionDice === 'string' && actionDice) {
    out.actionDice = actionDice.split(',').map(s => s.trim()).filter(s => s)
  } else if (typeof actionDice === 'number') {
    out.actionDice = [`1d${actionDice}`]
  }

  const hitDice = parsed['system.attributes.hitDice.value']
  if (typeof hitDice === 'string' && hitDice) {
    const match = hitDice.match(/^\d*d(\d+)$/i)
    if (match) out.hitDie = `d${match[1]}`
    else out.hitDie = hitDice
  }

  const luckDie = parsed['system.class.luckDie']
  if (luckDie !== undefined) out.luckDie = String(luckDie)

  return out
}

/**
 * Walk every registered level-data pack for the `{className}-{level}`
 * items for a single class. Returns a level-keyed object suitable
 * for `ClassProgression.levels`, or `null` if no items were found.
 *
 * @param {string} className - capitalized item-name prefix.
 * @param {object} [deps] - dependency injection for tests.
 * @returns {Promise<Object<number, object>|null>}
 */
async function loadLevelsForClass (className, deps = {}) {
  const CONFIG = deps.CONFIG ?? globalThis.CONFIG
  const gameImpl = deps.game ?? game
  const packsManager = CONFIG?.DCC?.levelDataPacks
  if (!packsManager?.packs) return null

  const levels = {}
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const itemName = `${className}-${level}`
    let item = null
    for (const packName of packsManager.packs) {
      const pack = gameImpl?.packs?.get?.(packName)
      if (!pack) continue
      // eslint-disable-next-line no-await-in-loop
      await pack.getIndex()
      const entry = pack.index.find(e => e.name === itemName)
      if (!entry) continue
      // eslint-disable-next-line no-await-in-loop
      item = await pack.getDocument(entry._id)
      break
    }
    if (!item) continue
    const text = item.system?.levelData ?? ''
    const parsed = parseLevelDataText(text)
    const progression = buildProgressionLevelFromParsed(parsed)
    if (Object.keys(progression).length === 0) continue
    levels[level] = progression
  }
  return Object.keys(levels).length > 0 ? levels : null
}

/**
 * Top-level entry: walk `CONFIG.DCC.levelDataPacks`, assemble a
 * `ClassProgression` per built-in DCC class that has at least one
 * level item discoverable in the packs, and register each via
 * `registerClassProgressions(...)`. Safe to call when no packs are
 * configured (returns `[]`, no-op).
 *
 * Called from `module/dcc.js`'s `dcc.ready` hook handler *before*
 * `Hooks.callAll('dcc.ready')` so sibling modules listening on
 * `dcc.ready` see the populated registry.
 *
 * @param {object} [deps] - dependency injection for tests.
 * @returns {Promise<Array<string>>} array of registered classIds.
 */
export async function registerClassProgressionsFromPacks (deps = {}) {
  const progressions = []
  for (const [classId, itemPrefix] of Object.entries(BUILT_IN_CLASS_LEVEL_NAMES)) {
    // eslint-disable-next-line no-await-in-loop
    const levels = await loadLevelsForClass(itemPrefix, deps)
    if (!levels) continue
    // Display name capitalizes the first letter of the classId
    // (`'warrior'` → `'Warrior'`). The lib uses `name` for chat /
    // UI strings; item-prefix is the lookup key.
    const name = classId.charAt(0).toUpperCase() + classId.slice(1)
    progressions.push({ classId, name, skills: [], levels })
  }
  if (progressions.length === 0) return []
  registerClassProgressions(progressions)
  return progressions.map(p => p.classId)
}
