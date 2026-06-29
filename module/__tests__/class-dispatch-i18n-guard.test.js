/**
 * Regression guard (C3, 2026-04-20): prevent the
 * `X === game.i18n.localize('DCC.Class')` dispatch anti-pattern from
 * reappearing in module source.
 *
 * Background: `system.class.className` is populated with the *localized*
 * class label at sheet-init time (`module/actor-sheets-dcc.js`), so any
 * dispatch like `className === game.i18n.localize('DCC.Halfling')`
 * silently breaks when the user's locale isn't English. The historical
 * bug (`actor.js:1725`) was fixed
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

/**
 * Regression guard (Phase 5 session 5, 2026-05-19): prevent the
 * `system.details.sheetClass === '<CapitalizedClass>'` dispatch
 * anti-pattern from reappearing.
 *
 * Background: `sheetClass` is the capitalized sentinel that
 * `registerClassDefaults` writes on first sheet open. It's a presentation
 * detail of the writer side — readers should dispatch on
 * `actor.classId` (the lowercase canonical identifier introduced at
 * Phase 4 session 7). The capitalized-string comparison reappearing in
 * code is a regression: it makes the code brittle to future
 * sheetClass-shape shifts (e.g., if a homebrew class capitalizes
 * differently, or if the registry rewrites sheetClass to lowercase),
 * and it diverges from the lib's `character.classInfo.classId`
 * convention.
 *
 * Correct dispatch:
 *   if (this.classId === 'cleric') { … }
 *
 * Anti-pattern:
 *   if (this.system.details.sheetClass === 'Cleric') { … }
 *
 * Exceptions: writer-side code that LITERALLY sets
 * `system.details.sheetClass` (the `applyClassDefaults` helper, the
 * Generic sheet's first-open block) is legitimate — those compare
 * sheetClass to drive an initial-setup branch, not to dispatch on
 * class. The Generic sheet specifically can't use `classId` (Generic
 * isn't on the class registries). The regex below matches comparisons
 * (`===`, `!==`) but not assignments.
 */
test('no module source dispatches on capitalized `system.details.sheetClass === \'<Class>\'`', () => {
  const builtInClasses = ['Cleric', 'Thief', 'Halfling', 'Warrior', 'Wizard', 'Dwarf', 'Elf']
  const allowedFiles = new Set([
    // Generic sheet keeps its `sheetClass !== 'Generic'` first-open
    // check — Generic isn't class-bound and uses 'Generic' as its
    // initial-setup sentinel. Not a class-dispatch reader.
    join(MODULE_DIR, 'actor-sheets-dcc.js'),
    // The migration helper that maps localized className → English
    // sheetClass writes the capitalized value; comparisons inside it
    // are part of the writer plumbing.
    join(MODULE_DIR, 'migrations.js')
  ])

  const offenders = []
  for (const file of walk(MODULE_DIR)) {
    if (allowedFiles.has(file)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, idx) => {
      for (const cls of builtInClasses) {
        const antiPattern = new RegExp(`sheetClass\\s*(?:===|!==|==|!=)\\s*['"]${cls}['"]`)
        if (antiPattern.test(line)) {
          offenders.push(`${file.replace(MODULE_DIR, 'module')}:${idx + 1}: ${line.trim()}`)
          break
        }
      }
    })
  }
  expect(offenders, `forbidden capitalized-sheetClass dispatch reintroduced — use \`this.classId === '<lowercase>'\` instead:\n${offenders.join('\n')}`).toEqual([])
})
