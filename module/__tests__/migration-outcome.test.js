/**
 * Unit tests for `migrationOutcome` — the pure stamp / notify policy
 * `migrateWorld` applies after accumulating per-document failures
 * (Phase 7 session 11).
 *
 * Forward-progress policy (issue #777): a completed run ALWAYS stamps the
 * version — `stampVersion` is `true` whether the run was clean or hit
 * failures — so a partially-failing world is swept exactly once instead of
 * re-running every boot. `clean` distinguishes the two: a clean run also
 * notifies "complete"; a run with failures stamps anyway, notifies
 * "failures" with the count, and (in `migrateWorld`) logs the offenders for
 * manual repair. Previously a single permanently-failing document left the
 * version unstamped and re-swept the whole world on every load — see the
 * issue for the Item Piles re-corruption loop this prevents.
 *
 * The function takes no Foundry globals, so it's unit-testable in
 * isolation — same pattern as `classifyMigrationDecision`.
 */

import { describe, expect, test } from 'vitest'
import { migrationOutcome } from '../migrations.js'

describe('migrationOutcome', () => {
  test('clean run (no failures) stamps the version and notifies complete', () => {
    expect(migrationOutcome([])).toEqual({
      stampVersion: true,
      clean: true,
      notify: 'complete',
      failureCount: 0
    })
  })

  test('a single failure STILL stamps the version (forward progress) and notifies failures', () => {
    expect(migrationOutcome([{ type: 'Actor', name: 'Bob' }])).toEqual({
      stampVersion: true,
      clean: false,
      notify: 'failures',
      failureCount: 1
    })
  })

  test('multiple failures stamp the version and report the exact count', () => {
    const failures = [
      { type: 'Actor', name: 'Bob' },
      { type: 'Item', name: 'Sword' },
      { type: 'Scene', name: 'Cave' }
    ]
    const outcome = migrationOutcome(failures)
    expect(outcome.stampVersion).toBe(true)
    expect(outcome.clean).toBe(false)
    expect(outcome.notify).toBe('failures')
    expect(outcome.failureCount).toBe(3)
  })

  test('the version is always stamped — a failing world is never re-swept on the next load', () => {
    // Forward-progress guarantee (issue #777): regardless of how many
    // documents fail, `migrateWorld` advances the stored version so
    // `classifyMigrationDecision` returns 'skip' next boot.
    expect(migrationOutcome([]).stampVersion).toBe(true)
    expect(migrationOutcome([{ type: 'Actor', name: 'X' }]).stampVersion).toBe(true)
    expect(migrationOutcome(Array.from({ length: 50 }, (_, i) => ({ type: 'Item', name: `I${i}` }))).stampVersion).toBe(true)
  })

  test('defensive: a non-array argument is treated as a clean run', () => {
    // migrateWorld always passes an array, but guard against a future
    // caller passing null/undefined rather than throwing mid-migration.
    expect(migrationOutcome(undefined)).toEqual({
      stampVersion: true,
      clean: true,
      notify: 'complete',
      failureCount: 0
    })
    expect(migrationOutcome(null).clean).toBe(true)
  })
})
