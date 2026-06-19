/**
 * Unit tests for `migrationOutcome` — the pure stamp / notify policy
 * `migrateWorld` applies after accumulating per-document failures
 * (Phase 7 session 11). A clean run stamps the world version and shows
 * the "complete" toast; a run with any failure leaves the version
 * unstamped (the idempotent data-driven migrations re-run next load)
 * and warns the GM with the count instead of silently swallowing it.
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
      notify: 'complete',
      failureCount: 0
    })
  })

  test('a single failure does NOT stamp the version and notifies failures', () => {
    expect(migrationOutcome([{ type: 'Actor', name: 'Bob' }])).toEqual({
      stampVersion: false,
      notify: 'failures',
      failureCount: 1
    })
  })

  test('multiple failures report the exact count', () => {
    const failures = [
      { type: 'Actor', name: 'Bob' },
      { type: 'Item', name: 'Sword' },
      { type: 'Scene', name: 'Cave' }
    ]
    const outcome = migrationOutcome(failures)
    expect(outcome.stampVersion).toBe(false)
    expect(outcome.notify).toBe('failures')
    expect(outcome.failureCount).toBe(3)
  })

  test('defensive: a non-array argument is treated as a clean run', () => {
    // migrateWorld always passes an array, but guard against a future
    // caller passing null/undefined rather than throwing mid-migration.
    expect(migrationOutcome(undefined)).toEqual({
      stampVersion: true,
      notify: 'complete',
      failureCount: 0
    })
    expect(migrationOutcome(null).stampVersion).toBe(true)
  })
})
