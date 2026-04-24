/**
 * Regression guard (C2, 2026-04-23): prevent pre-V14 version-gated
 * migration branches from re-appearing in `module/migrations.js`.
 *
 * Background: C2 pruned every `currentVersion <= 0.17` / `<= 0.50` /
 * `< 0.65` / `<= 0.11` / `<= 0.21` / `<= 0.22` / `< 0.51` branch. The
 * V14-era floor is `0.66` and is enforced up-front by the
 * `MINIMUM_SUPPORTED_VERSION` guard in `module/dcc.js`'s
 * `checkMigrations`, so the per-branch version gates inside
 * `migrations.js` became dead code.
 *
 * Rule: any `currentVersion` comparison against a numeric literal
 * below `0.66` (inclusive of `0.65`, since that was the last pre-V14
 * migration tier) is the forbidden pattern. Data-driven checks
 * (`typeof change.mode === 'number'`, `!actor.system?.details?.alignment`,
 * etc.) stay — they're not gated on stored version.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const MIGRATIONS_FILE = join(dirname(__filename), '..', 'migrations.js')

test('no pre-0.66 currentVersion comparisons remain in migrations.js', () => {
  // Matches `currentVersion <op> 0.NN` / `0.NN <op> currentVersion` where
  // 0.NN is any two-digit fraction below 0.66. The floor guard in
  // `checkMigrations` handles that cutover; per-branch gates below it
  // are dead code post-C2.
  const antiPattern = /currentVersion\s*(?:<=?|>=?|==|!=)\s*0\.(?:[0-5]\d|6[0-5])\b|0\.(?:[0-5]\d|6[0-5])\b\s*(?:<=?|>=?|==|!=)\s*currentVersion/
  const source = readFileSync(MIGRATIONS_FILE, 'utf8')
  const offenders = []
  source.split('\n').forEach((line, idx) => {
    if (antiPattern.test(line)) {
      offenders.push(`migrations.js:${idx + 1}: ${line.trim()}`)
    }
  })
  expect(offenders, `pre-0.66 version-gated migration branch reintroduced:\n${offenders.join('\n')}`).toEqual([])
})
