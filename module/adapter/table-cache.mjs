/* global Hooks */

/**
 * Module-level table caches for the four table-loading sites that walk
 * compendium packs + world tables on every call. Each cache is a `Map`
 * keyed on the natural lookup argument (table name, crit-table suffix,
 * etc.) and holds the post-conversion result the loader returns. World
 * RollTable lifecycle hooks (`createRollTable`, `updateRollTable`,
 * `deleteRollTable`) clear all caches in one shot — the events are rare
 * enough during play that the cost of dropping every cached entry on a
 * single GM edit is negligible, and the global clear keeps the
 * invalidation logic uniform (no per-cache "is this table relevant"
 * predicate).
 *
 * Cache scope: per-process. World reload starts the maps empty; pack
 * `getDocument` lookups settle into single-call cost across the
 * subsequent session. No persistence; the data is always derivable
 * from packs + world tables.
 *
 * Caches:
 *
 *   - `disapprovalTableCache: Map<tableName, libSimpleTable | null>` —
 *     for `loadDisapprovalTable(actor)` in `spell-input.mjs`. Keyed on
 *     the actor's `system.class.disapprovalTable` value.
 *   - `mercurialMagicTableCache: Map<tableName, libMercurialTable | null>` —
 *     for `loadMercurialMagicTable(classKey)`. Keyed on the resolved
 *     table name from `resolveMercurialMagicTableName(classKey)`.
 *   - `critTableLinkCache: Map<critTableSuffix, uuidPrefix | null>` —
 *     for `getCritTableLink(suffix, displayText)` in `utilities.js`.
 *     Cached value is the `@UUID[Compendium...|RollTable...]` prefix
 *     WITHOUT the trailing `{displayText}` — callers concatenate the
 *     display text per call so the same suffix can render with
 *     different labels.
 *   - `critTableDocCache: Map<critTableCanonical, FoundryRollTable | null>` —
 *     for `getCritTableResult(roll, critTableName)`. Cached value is
 *     the loaded Foundry `RollTable` document. Callers run
 *     `table.getResultsForRoll(roll.total)` per call (cheap once the
 *     doc is loaded).
 *
 * A cached `null` means "lookup ran and found nothing" — re-running
 * the walk would return null again unless a world-table CRUD event
 * fires (which is when the cache invalidates).
 *
 * See `docs/00-progress.md` "PR #720 review backlog" → "Uncached
 * compendium walks" for the surfacing context.
 */

export const disapprovalTableCache = new Map()
export const mercurialMagicTableCache = new Map()
export const critTableLinkCache = new Map()
export const critTableDocCache = new Map()

/**
 * Frozen index of all caches in this module. Keys match the cache
 * names; values are the `Map` instances. Lets test code iterate the
 * full set without redeclaring it.
 */
export const TABLE_CACHES = Object.freeze({
  disapprovalTable: disapprovalTableCache,
  mercurialMagicTable: mercurialMagicTableCache,
  critTableLink: critTableLinkCache,
  critTableDoc: critTableDocCache
})

/**
 * Clear every table cache. Called by the world-RollTable lifecycle
 * hooks below and exported so test code can reset state between cases
 * without forging hook fires.
 */
export function clearAllTableCaches () {
  for (const cache of Object.values(TABLE_CACHES)) {
    cache.clear()
  }
}

/**
 * World-RollTable lifecycle hooks that invalidate all caches. A
 * single GM edit (rename / row change / delete) can shift which world
 * table answers a name lookup or what its rows resolve to; the safest
 * + simplest response is to drop every cached entry and let the next
 * call re-walk. Each handler is exported individually so unit tests
 * can invoke them as plain functions.
 */
export function onCreateRollTableInvalidate () {
  clearAllTableCaches()
}

export function onUpdateRollTableInvalidate () {
  clearAllTableCaches()
}

export function onDeleteRollTableInvalidate () {
  clearAllTableCaches()
}

/**
 * Frozen dispatch table mapping Foundry hook name → handler. Mirrors
 * the `SETTINGS_TABLE_HOOKS` / `TABLE_LOADING_HOOKS` /
 * `CHAT_AND_HOOK_WIRING_HOOKS` pattern from Phase 7 sessions 3 / 5 / 6
 * so the wiring is testable independently of the registration call.
 */
export const TABLE_CACHE_INVALIDATION_HOOKS = Object.freeze({
  createRollTable: { handler: onCreateRollTableInvalidate, once: false },
  updateRollTable: { handler: onUpdateRollTableInvalidate, once: false },
  deleteRollTable: { handler: onDeleteRollTableInvalidate, once: false }
})

/**
 * Register every world-RollTable lifecycle hook that should drop the
 * table caches. Iterates `TABLE_CACHE_INVALIDATION_HOOKS` calling
 * `Hooks.on` per entry. Idempotent at the Foundry level — registering
 * twice just queues two handler invocations per event (the second is
 * a no-op clear).
 */
export function registerTableCacheInvalidation () {
  for (const [hookName, { handler }] of Object.entries(TABLE_CACHE_INVALIDATION_HOOKS)) {
    Hooks.on(hookName, handler)
  }
}
