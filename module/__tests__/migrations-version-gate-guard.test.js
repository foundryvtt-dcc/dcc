/**
 * Regression guard: prevent pre-V14 version-gated migration branches
 * from reappearing in `module/migrations.js`. The V14-era floor is 0.66
 * and is enforced up-front by `classifyMigrationDecision` / the
 * `MINIMUM_SUPPORTED_VERSION` guard in `module/dcc.js`'s
 * `checkMigrations`, so per-branch `currentVersion <op> 0.NN` gates
 * below that floor are dead code.
 *
 * Rule: any `currentVersion` comparison against a numeric literal
 * below 0.66 (inclusive of 0.65, the last pre-V14 migration tier) is
 * the forbidden pattern. Data-driven checks (`typeof change.mode ===
 * 'number'`, `!actor.system?.details?.alignment`, etc.) stay — they
 * aren't gated on stored version.
 *
 * Coverage:
 * - Behavioral: `classifyMigrationDecision` for fresh / pre-V14 / V14
 *   era inputs (includes the Foundry `default: 0` case).
 * - Source-scan: the anti-pattern regex must catch every deleted
 *   branch's operator style (`<=`, `<`, `===`, `!==`) and must not
 *   false-positive on `0.66+` comparisons. Meta-tests on the regex
 *   keep it honest under future edits.
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

// Exported so the meta-tests below can exercise the same regex we
// apply to `migrations.js`.
const antiPattern = /currentVersion\s*(?:<=?|>=?|===?|!==?)\s*0\.(?:[0-5]\d|6[0-5])\b|0\.(?:[0-5]\d|6[0-5])\b\s*(?:<=?|>=?|===?|!==?)\s*currentVersion/

describe('classifyMigrationDecision', () => {
  test('exported floor + ceiling constants', () => {
    expect(MINIMUM_SUPPORTED_VERSION).toBe(0.66)
    expect(NEEDS_MIGRATION_VERSION).toBe(0.67)
  })

  test('fresh world (default: 0) runs migrateWorld', () => {
    // Foundry's `game.settings.get` returns the registered default,
    // which is 0 for `systemMigrationVersion`. Treat that as "never
    // migrated" — same bucket as null — and let data-driven fixes run.
    expect(classifyMigrationDecision(0)).toBe('run')
  })

  test('null currentVersion (never stored) runs migrateWorld', () => {
    expect(classifyMigrationDecision(null)).toBe('run')
  })

  test('pre-V14 world (0.30) is blocked', () => {
    expect(classifyMigrationDecision(0.30)).toBe('block')
  })

  test('last pre-V14 tier (0.65) is blocked', () => {
    expect(classifyMigrationDecision(0.65)).toBe('block')
  })

  test('V14 floor (0.66) runs migrateWorld for data-driven fixes', () => {
    expect(classifyMigrationDecision(0.66)).toBe('run')
  })

  test('already migrated (0.67) skips', () => {
    expect(classifyMigrationDecision(0.67)).toBe('skip')
  })

  test('above ceiling skips', () => {
    expect(classifyMigrationDecision(0.99)).toBe('skip')
  })
})

describe('version-gate anti-pattern regex', () => {
  const knownBad = [
    'if (currentVersion <= 0.17)',
    'if (currentVersion <= 0.50)',
    'if (currentVersion < 0.65)',
    'if (currentVersion <= 0.11)',
    'if (currentVersion <= 0.21)',
    'if (currentVersion <= 0.22)',
    'if (currentVersion < 0.51)',
    'if (currentVersion === 0.50)',
    'if (currentVersion !== 0.22)',
    'if (currentVersion == 0.30)',
    'if (0.17 >= currentVersion)'
  ]

  const knownGood = [
    'if (currentVersion < 0.66)', // the floor itself is not a gate
    'if (currentVersion < 0.67)', // ceiling check, allowed
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

test('no pre-0.66 currentVersion comparisons remain in migrations.js', () => {
  const source = readFileSync(MIGRATIONS_FILE, 'utf8')
  const offenders = []
  source.split('\n').forEach((line, idx) => {
    if (antiPattern.test(line)) {
      offenders.push(`migrations.js:${idx + 1}: ${line.trim()}`)
    }
  })
  expect(offenders, `pre-0.66 version-gated migration branch reintroduced:\n${offenders.join('\n')}`).toEqual([])
})
