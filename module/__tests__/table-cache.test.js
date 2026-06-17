/* global Hooks */

/**
 * Unit coverage for the adapter-side table caches extracted in Phase 7
 * session 9 from the four uncached pack walks in `spell-input.mjs`
 * (`loadDisapprovalTable`, `loadMercurialMagicTable`) and `utilities.js`
 * (`getCritTableLink`, `getCritTableResult`).
 *
 * The cache module owns no business logic — it's four `Map` instances,
 * a clear-all helper, three invalidation handlers, the dispatch table,
 * and the `registerTableCacheInvalidation()` wiring. These tests cover
 * the shape, the invariants, and the Foundry-hook wiring; the
 * cache-hit / cache-miss behavior on the loaders themselves is
 * covered in `utilities.test.js` and `adapter-spell-check.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  TABLE_CACHE_INVALIDATION_HOOKS,
  TABLE_CACHES,
  clearAllTableCaches,
  critTableDocCache,
  critTableLinkCache,
  disapprovalTableCache,
  mercurialMagicTableCache,
  onCreateRollTableInvalidate,
  onDeleteRollTableInvalidate,
  onUpdateRollTableInvalidate,
  registerTableCacheInvalidation
} from '../adapter/table-cache.mjs'

let originalHooks

beforeEach(() => {
  originalHooks = globalThis.Hooks
  globalThis.Hooks = { on: vi.fn() }
  // Reset every cache so cross-test pollution can't mask a bug.
  clearAllTableCaches()
})

afterEach(() => {
  if (originalHooks === undefined) delete globalThis.Hooks
  else globalThis.Hooks = originalHooks
})

describe('TABLE_CACHES index', () => {
  test('exposes the four named caches', () => {
    expect(Object.keys(TABLE_CACHES).sort()).toEqual([
      'critTableDoc',
      'critTableLink',
      'disapprovalTable',
      'mercurialMagicTable'
    ])
  })

  test('each entry is the same Map instance as the named export', () => {
    expect(TABLE_CACHES.disapprovalTable).toBe(disapprovalTableCache)
    expect(TABLE_CACHES.mercurialMagicTable).toBe(mercurialMagicTableCache)
    expect(TABLE_CACHES.critTableLink).toBe(critTableLinkCache)
    expect(TABLE_CACHES.critTableDoc).toBe(critTableDocCache)
  })

  test('TABLE_CACHES is frozen so callers cannot reassign entries', () => {
    expect(Object.isFrozen(TABLE_CACHES)).toBe(true)
  })
})

describe('clearAllTableCaches', () => {
  test('empties every cache in TABLE_CACHES', () => {
    disapprovalTableCache.set('A', { rows: [] })
    mercurialMagicTableCache.set('B', { rows: [] })
    critTableLinkCache.set('III', '@UUID[Compendium.x.y]')
    critTableDocCache.set('Crit Table III', { id: 'doc-1' })

    clearAllTableCaches()

    expect(disapprovalTableCache.size).toBe(0)
    expect(mercurialMagicTableCache.size).toBe(0)
    expect(critTableLinkCache.size).toBe(0)
    expect(critTableDocCache.size).toBe(0)
  })

  test('is safe to call when caches are already empty', () => {
    expect(() => clearAllTableCaches()).not.toThrow()
  })
})

describe('invalidation handlers', () => {
  beforeEach(() => {
    disapprovalTableCache.set('A', { rows: [] })
    mercurialMagicTableCache.set('B', { rows: [] })
    critTableLinkCache.set('III', '@UUID[Compendium.x.y]')
    critTableDocCache.set('Crit Table III', { id: 'doc-1' })
  })

  test('onCreateRollTableInvalidate drops every cache entry', () => {
    onCreateRollTableInvalidate({ name: 'Some Table' })
    expect(disapprovalTableCache.size).toBe(0)
    expect(mercurialMagicTableCache.size).toBe(0)
    expect(critTableLinkCache.size).toBe(0)
    expect(critTableDocCache.size).toBe(0)
  })

  test('onUpdateRollTableInvalidate drops every cache entry', () => {
    onUpdateRollTableInvalidate({ name: 'Some Table' }, { name: 'Renamed' })
    expect(disapprovalTableCache.size).toBe(0)
    expect(mercurialMagicTableCache.size).toBe(0)
    expect(critTableLinkCache.size).toBe(0)
    expect(critTableDocCache.size).toBe(0)
  })

  test('onDeleteRollTableInvalidate drops every cache entry', () => {
    onDeleteRollTableInvalidate({ name: 'Some Table' })
    expect(disapprovalTableCache.size).toBe(0)
    expect(mercurialMagicTableCache.size).toBe(0)
    expect(critTableLinkCache.size).toBe(0)
    expect(critTableDocCache.size).toBe(0)
  })

  test('invalidation handlers ignore their argument shapes', () => {
    // They don't read .name, changes, or any field — the policy is
    // "any world-table CRUD invalidates everything".
    expect(() => onCreateRollTableInvalidate()).not.toThrow()
    expect(() => onUpdateRollTableInvalidate()).not.toThrow()
    expect(() => onDeleteRollTableInvalidate()).not.toThrow()
    expect(() => onCreateRollTableInvalidate(null, undefined, false)).not.toThrow()
  })
})

describe('TABLE_CACHE_INVALIDATION_HOOKS dispatch table', () => {
  test('covers exactly the three world-RollTable lifecycle hooks', () => {
    expect(Object.keys(TABLE_CACHE_INVALIDATION_HOOKS).sort()).toEqual([
      'createRollTable',
      'deleteRollTable',
      'updateRollTable'
    ])
  })

  test('routes each hook name to the matching invalidation handler', () => {
    expect(TABLE_CACHE_INVALIDATION_HOOKS.createRollTable.handler).toBe(onCreateRollTableInvalidate)
    expect(TABLE_CACHE_INVALIDATION_HOOKS.updateRollTable.handler).toBe(onUpdateRollTableInvalidate)
    expect(TABLE_CACHE_INVALIDATION_HOOKS.deleteRollTable.handler).toBe(onDeleteRollTableInvalidate)
  })

  test('every entry is `once: false` — invalidation must fire for every world-table mutation', () => {
    for (const { once } of Object.values(TABLE_CACHE_INVALIDATION_HOOKS)) {
      expect(once).toBe(false)
    }
  })

  test('dispatch table is frozen so callers cannot rebind handlers', () => {
    expect(Object.isFrozen(TABLE_CACHE_INVALIDATION_HOOKS)).toBe(true)
  })
})

describe('registerTableCacheInvalidation', () => {
  test('wires every entry in the dispatch table via Hooks.on', () => {
    registerTableCacheInvalidation()
    expect(Hooks.on).toHaveBeenCalledTimes(3)
    expect(Hooks.on).toHaveBeenCalledWith('createRollTable', onCreateRollTableInvalidate)
    expect(Hooks.on).toHaveBeenCalledWith('updateRollTable', onUpdateRollTableInvalidate)
    expect(Hooks.on).toHaveBeenCalledWith('deleteRollTable', onDeleteRollTableInvalidate)
  })

  test('does not call Hooks.once for any entry — every handler is reusable', () => {
    Hooks.once = vi.fn()
    registerTableCacheInvalidation()
    expect(Hooks.once).not.toHaveBeenCalled()
  })
})
