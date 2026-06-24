import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import '../__mocks__/foundry.js'
import { migrateWorld, NEEDS_MIGRATION_VERSION } from '../migrations.js'

// migrations.js orchestration backfill (audit 2026-06-08). The pure migrationOutcome
// policy + the per-document migrateActorData/migrateItemData transforms are tested in
// isolation, but the migrateWorld integration — the per-doc catch->failures loop, the
// version-stamping gate, and the MigrationFailures warn — was not. A bug here could
// mark a partially-migrated world "done" and never retry it.

// A world actor that triggers exactly one migration (missing alignment -> 'l'), so
// migrateActorData returns non-empty updateData and migrateWorld calls .update().
const worldActor = (name, update) => ({
  name,
  system: { details: {}, class: {} },
  effects: [],
  update: update ?? vi.fn(async () => {})
})

let settingsSet, warn, info
beforeEach(() => {
  settingsSet = vi.fn()
  warn = vi.fn()
  info = vi.fn()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  // The shared foundry mock's utils bag omits isEmpty (migrateActorData gates
  // .update() on it); provide a faithful implementation.
  globalThis.foundry = globalThis.foundry || { utils: {} }
  globalThis.foundry.utils = globalThis.foundry.utils || {}
  globalThis.foundry.utils.isEmpty = (o) => !o || Object.keys(o).length === 0

  globalThis.game = {
    system: { version: '0.68.0' },
    i18n: { format: (k, data) => `${k} ${JSON.stringify(data || {})}`, localize: (k) => k },
    actors: [],
    items: [],
    scenes: [],
    packs: [], // .filter([]) -> no world compendium packs
    settings: { set: settingsSet, get: vi.fn() }
  }
  globalThis.ui = { notifications: { info, warn } }
})

afterEach(() => { vi.restoreAllMocks() })

describe('migrateWorld orchestration', () => {
  test('a clean run stamps the version and reports completion', async () => {
    const a1 = worldActor('A1')
    const a2 = worldActor('A2')
    globalThis.game.actors = [a1, a2]

    const result = await migrateWorld()

    expect(a1.update).toHaveBeenCalled()
    expect(a2.update).toHaveBeenCalled()
    expect(settingsSet).toHaveBeenCalledWith('dcc', 'systemMigrationVersion', NEEDS_MIGRATION_VERSION)
    expect(result).toEqual({ migrationComplete: true })
    // info toast for start + complete; no failure warning
    expect(warn).not.toHaveBeenCalled()
    expect(info.mock.calls.some(([m]) => m.includes('DCC.MigrationComplete'))).toBe(true)
  })

  test('a per-document update failure STILL stamps the version (forward progress) and warns', async () => {
    const ok = worldActor('Good')
    const bad = worldActor('Bad', vi.fn(async () => { throw new Error('update rejected') }))
    globalThis.game.actors = [ok, bad]

    const result = await migrateWorld()

    // The good actor still migrates; the failure is caught + accumulated, not thrown.
    expect(ok.update).toHaveBeenCalled()
    expect(bad.update).toHaveBeenCalled()
    // Forward-progress (issue #777): the version IS stamped even with a
    // failure, so `migrateWorld` is NOT re-run on the next load — a single
    // permanently-failing document can no longer re-sweep the whole world
    // every boot (the loop that, on an Item Piles world, re-corrupted a
    // freshly-restored backup).
    expect(settingsSet).toHaveBeenCalledWith('dcc', 'systemMigrationVersion', NEEDS_MIGRATION_VERSION)
    // The GM is still warned with the failure count rather than silently
    // swallowing it, and `migrationComplete` reflects that it was not clean.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('DCC.MigrationFailures')
    expect(warn.mock.calls[0][0]).toContain('"count":1')
    expect(result).toEqual({ migrationComplete: false })
  })

  test('failures across multiple documents are all counted', async () => {
    globalThis.game.actors = [
      worldActor('A', vi.fn(async () => { throw new Error('x') })),
      worldActor('B', vi.fn(async () => { throw new Error('y') }))
    ]
    const result = await migrateWorld()
    expect(result.migrationComplete).toBe(false)
    expect(warn.mock.calls[0][0]).toContain('"count":2')
  })
})
