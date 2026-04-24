/**
 * Regression guard (C3, 2026-04-20): prevent the
 * `X === game.i18n.localize('DCC.Class')` dispatch anti-pattern from
 * reappearing in module source.
 *
 * Background: `system.class.className` is populated with the *localized*
 * class label at sheet-init time (`module/actor-sheets-dcc.js`), so any
 * dispatch like `className === game.i18n.localize('DCC.Halfling')`
 * silently breaks when the user's locale isn't English. The historical
 * bug (`actor.js:1725` per `ARCHITECTURE_REIMAGINED.md §2`) was fixed
 * pre-refactor; C3 audits the codebase to confirm no residuals and
 * plants this guard so a future bug can't drift back in.
 *
 * Rule: `=== game.i18n.localize` / `!== game.i18n.localize` (localize on
 * the RIGHT) is the forbidden pattern. The inverse-direction helper in
 * `module/migrations.js` (localize on the LEFT — mapping localized data
 * back to internal class IDs) is legitimate and not caught by this
 * regex.
 *
 * Correct dispatch: use internal class IDs (e.g. `'halfling'`,
 * `'warrior'`) via `system.details.sheetClass` or the lib's class-ID
 * registry. See `EXTENSION_API.md` "Class dispatch convention".
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const MODULE_DIR = join(dirname(__filename), '..')

function walk (dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === '__mocks__' || entry === 'vendor') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.m?js$/.test(entry)) acc.push(full)
  }
  return acc
}

test('no module source uses `=== game.i18n.localize(...)` for class dispatch', () => {
  const antiPattern = /(?:===|!==|==|!=)\s*game\.i18n\.localize\s*\(/
  const offenders = []
  for (const file of walk(MODULE_DIR)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, idx) => {
      if (antiPattern.test(line)) {
        offenders.push(`${file.replace(MODULE_DIR, 'module')}:${idx + 1}: ${line.trim()}`)
      }
    })
  }
  expect(offenders, `forbidden dispatch pattern reintroduced:\n${offenders.join('\n')}`).toEqual([])
})
