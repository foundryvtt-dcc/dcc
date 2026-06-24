/**
 * Migration version-policy guard for `module/migrations.js`.
 *
 * Policy (issue #774): the data-model floor is `MINIMUM_SUPPORTED_VERSION`
 * = 0.22 — the pre-V14 lines (0.65.x / 0.66.x) only run their own migration
 * for worlds stamped `<= 0.22`, so those are the only worlds a pre-V14
 * release can actually carry forward. Worlds in the `[0.22, 0.68)` band are
 * migrated in place here, by the data-driven checks plus a small set of
 * version-gated fixups (e.g. the 0.50 attackHitBonus split). Worlds below
 * 0.22 are blocked and referred to a pre-V14 release first.
 *
 * Rule: version-gated branches at/above the 0.22 floor are allowed (they
 * fire for real worlds in the band). Gated branches BELOW the floor are the
 * forbidden pattern — those worlds are blocked before `migrateActorData`
 * runs, so a `currentVersion <op> 0.NN` for NN < 0.22 is dead code. Data-
 * driven checks (`typeof change.mode === 'number'`, `!actor.system?.details
 * ?.alignment`, etc.) stay — they aren't gated on stored version.
 *
 * Coverage:
 * - Behavioral: `classifyMigrationDecision` for fresh / ancient / in-band /
 *   migrated inputs (includes the Foundry `default: 0` case).
 * - Source-scan: the anti-pattern regex must catch sub-floor gated branches
 *   across operator styles (`<=`, `<`, `===`, `!==`) and must not false-
 *   positive on `0.22+` comparisons. Meta-tests on the regex keep it honest.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  MINIMUM_SUPPORTED_VERSION,
  NEEDS_MIGRATION_VERSION,
  classifyMigrationDecision
} from '../migrations.js'

const __filename = fileURLToPath(import.meta.url)
const MIGRATIONS_FILE = join(dirname(__filename), '..', 'migrations.js')

// Sub-floor (< 0.22) currentVersion comparisons are dead code — those worlds
// are blocked before migrateActorData runs. Matches 0.00–0.21 only. Exported
// shape so the meta-tests below exercise the same regex we apply to source.
const antiPattern = /currentVersion\s*(?:<=?|>=?|===?|!==?)\s*0\.(?:0\d|1\d|2[01])\b|0\.(?:0\d|1\d|2[01])\b\s*(?:<=?|>=?|===?|!==?)\s*currentVersion/

describe('classifyMigrationDecision', () => {
  test('exported floor + ceiling constants', () => {
    expect(MINIMUM_SUPPORTED_VERSION).toBe(0.22)
    expect(NEEDS_MIGRATION_VERSION).toBe(0.68)
  })

  test('fresh world (default: 0) runs migrateWorld', () => {
    // Foundry's `game.settings.get` returns the registered default, which is
    // 0 for `systemMigrationVersion`. Treat that as "never migrated" — same
    // bucket as null — and let the migrations run.
    expect(classifyMigrationDecision(0)).toBe('run')
  })

  test('null currentVersion (never stored) runs migrateWorld', () => {
    expect(classifyMigrationDecision(null)).toBe('run')
  })

  test('ancient world (0.10) is blocked', () => {
    expect(classifyMigrationDecision(0.10)).toBe('block')
  })

  test('just below the floor (0.21) is blocked', () => {
    expect(classifyMigrationDecision(0.21)).toBe('block')
  })

  test('floor itself (0.22) runs migrateWorld', () => {
    expect(classifyMigrationDecision(0.22)).toBe('run')
  })

  test('in-band world (0.34 — the issue #774 case) runs migrateWorld', () => {
    expect(classifyMigrationDecision(0.34)).toBe('run')
  })

  test('last pre-V14 tier (0.65) runs migrateWorld in place', () => {
    expect(classifyMigrationDecision(0.65)).toBe('run')
  })

  test('already migrated (0.68) skips', () => {
    expect(classifyMigrationDecision(0.68)).toBe('skip')
  })

  test('above ceiling skips', () => {
    expect(classifyMigrationDecision(0.99)).toBe('skip')
  })
})

describe('version-gate anti-pattern regex', () => {
  // Sub-floor (< 0.22) gates — dead code, must be caught.
  const knownBad = [
    'if (currentVersion <= 0.17)',
    'if (currentVersion <= 0.11)',
    'if (currentVersion <= 0.21)',
    'if (currentVersion <= 0.20)',
    'if (currentVersion < 0.05)',
    'if (currentVersion === 0.10)',
    'if (currentVersion !== 0.21)',
    'if (currentVersion == 0.15)',
    'if (0.17 >= currentVersion)'
  ]

  // At/above the floor — allowed (these fire for real in-band worlds).
  const knownGood = [
    'if (currentVersion <= 0.22)', // the floor itself is migratable in place
    'if (currentVersion <= 0.50)', // re-added attackHitBonus split (#774)
    'if (currentVersion < 0.65)',
    'if (currentVersion < 0.67)',
    'if (currentVersion >= 0.66)',
    'if (currentVersion === null)',
    'if (currentVersion == null)',
    'const needsMigration = (currentVersion == null) || (currentVersion < NEEDS_MIGRATION_VERSION)'
  ]

  for (const sample of knownBad) {
    test(`catches: ${sample}`, () => {
      expect(sample).toMatch(antiPattern)
    })
  }

  for (const sample of knownGood) {
    test(`ignores: ${sample}`, () => {
      expect(sample).not.toMatch(antiPattern)
    })
  }
})

test('no sub-floor (<0.22) currentVersion comparisons remain in migrations.js', () => {
  const source = readFileSync(MIGRATIONS_FILE, 'utf8')
  const offenders = []
  source.split('\n').forEach((line, idx) => {
    if (antiPattern.test(line)) {
      offenders.push(`migrations.js:${idx + 1}: ${line.trim()}`)
    }
  })
  expect(offenders, `sub-floor version-gated migration branch (dead code) found:\n${offenders.join('\n')}`).toEqual([])
})
