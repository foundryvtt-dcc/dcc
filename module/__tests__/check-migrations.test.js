/**
 * Unit coverage for `checkMigrations` — the migration entry point the
 * system's `ready` hook awaits before firing `dcc.ready` (PR #720
 * "`migrateWorld` fire-and-forget from a sync ready hook" fix). The
 * function was relocated out of `module/dcc.js` into `migrations.js` so
 * its decide-then-await orchestration is unit-testable in isolation,
 * matching the `classifyMigrationDecision` / `migrationOutcome` pattern.
 *
 * The four paths it can take, and the `{ migrationComplete }` flag each
 * returns (threaded onto the `dcc.ready` payload):
 *   - non-GM client      → `true`,  never runs migrateWorld
 *   - already migrated    → `true`,  skips (no migrateWorld)
 *   - ancient world (<0.22) → `false`, error toast, no migrateWorld
 *   - V14-era / fresh    → awaits migrateWorld; `true` on a clean run
 *
 * Globals (`game` / `ui` / `foundry`) are stubbed per-test in the same
 * style as `table-loading.test.js`; no live Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { checkMigrations, NEEDS_MIGRATION_VERSION } from '../migrations.js'

let originalGame
let originalUi
let originalFoundry

/**
 * Build a stub `game` for a GM (or non-GM) client whose
 * `systemMigrationVersion` setting reads as `storedVersion`. World
 * collections default to empty so the `'run'` path produces a clean run.
 */
function stubGame ({ isGM = true, storedVersion = NEEDS_MIGRATION_VERSION } = {}) {
  return {
    user: { isGM },
    system: { version: '1.0.0' },
    settings: {
      get: vi.fn(() => storedVersion),
      set: vi.fn()
    },
    i18n: { format: vi.fn((key) => key) },
    actors: [],
    items: [],
    scenes: [],
    packs: Object.assign([], { filter: Array.prototype.filter })
  }
}

beforeEach(() => {
  originalGame = globalThis.game
  originalUi = globalThis.ui
  originalFoundry = globalThis.foundry
  globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
  globalThis.foundry = { utils: { isEmpty: vi.fn(() => true) } }
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.ui = originalUi
  globalThis.foundry = originalFoundry
})

describe('checkMigrations', () => {
  test('non-GM client is a no-op and reports complete', async () => {
    globalThis.game = stubGame({ isGM: false })

    const result = await checkMigrations()

    expect(result).toEqual({ migrationComplete: true })
    // Never consults the stored version or runs migrateWorld.
    expect(globalThis.game.settings.get).not.toHaveBeenCalled()
    expect(globalThis.ui.notifications.info).not.toHaveBeenCalled()
    expect(globalThis.game.settings.set).not.toHaveBeenCalled()
  })

  test('already-migrated world (>= ceiling) skips and reports complete', async () => {
    globalThis.game = stubGame({ storedVersion: NEEDS_MIGRATION_VERSION })

    const result = await checkMigrations()

    expect(result).toEqual({ migrationComplete: true })
    expect(globalThis.game.settings.get).toHaveBeenCalledWith('dcc', 'systemMigrationVersion')
    // Skip path never enters migrateWorld (no MigrationInfo toast / no stamp).
    expect(globalThis.ui.notifications.info).not.toHaveBeenCalled()
    expect(globalThis.game.settings.set).not.toHaveBeenCalled()
  })

  test('ancient world (<0.22) is blocked: error toast, no migration, reports incomplete', async () => {
    globalThis.game = stubGame({ storedVersion: 0.20 })

    const result = await checkMigrations()

    expect(result).toEqual({ migrationComplete: false })
    expect(globalThis.ui.notifications.error).toHaveBeenCalledTimes(1)
    expect(globalThis.ui.notifications.error).toHaveBeenCalledWith(
      'DCC.MigrationUnsupportedVersion',
      { permanent: true }
    )
    // Blocked before migrateWorld runs.
    expect(globalThis.ui.notifications.info).not.toHaveBeenCalled()
    expect(globalThis.game.settings.set).not.toHaveBeenCalled()
  })

  test('V14-era world runs migrateWorld to completion and stamps the version', async () => {
    // storedVersion 0 == Foundry's default for a never-stamped setting →
    // 'run'. Empty world collections make it a clean run.
    globalThis.game = stubGame({ storedVersion: 0 })

    const result = await checkMigrations()

    expect(result).toEqual({ migrationComplete: true })
    // migrateWorld actually ran: it announced (MigrationInfo) and, on a
    // clean run, stamped the version at the ceiling + announced complete.
    // (The stubbed `i18n.format` returns the key verbatim; `info` receives
    // only that string — the `{ permanent: true }` literal in production is
    // passed to `format`, not to `info`.)
    expect(globalThis.ui.notifications.info).toHaveBeenCalledWith('DCC.MigrationInfo')
    expect(globalThis.game.settings.set).toHaveBeenCalledWith('dcc', 'systemMigrationVersion', NEEDS_MIGRATION_VERSION)
    expect(globalThis.ui.notifications.info).toHaveBeenCalledWith('DCC.MigrationComplete')
    // A clean run never warns about failures.
    expect(globalThis.ui.notifications.warn).not.toHaveBeenCalled()
  })
})
