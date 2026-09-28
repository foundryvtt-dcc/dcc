/**
 * Structural guards for styles/ (#928). The stylesheets are native nested CSS
 * loaded straight from system.json, with no Sass build in between, so two
 * mistakes that used to be harmless (or impossible) now fail silently:
 *
 * - A stray comma in a selector list (`.a th, {`). Sass dropped the empty
 *   entry; the browser invalidates the WHOLE selector list and discards the
 *   rule. The conversion shipped two of these, caught only by a computed-style
 *   diff. Stylelint does not flag them.
 * - A new `styles/*.css` file that is never added to system.json's `styles`
 *   array, so it is never loaded.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const STYLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'system.json'), 'utf8')).styles

describe('system stylesheets', () => {
  test('every styles/*.css file is listed in system.json', () => {
    const listed = new Set(STYLES.map(s => s.src))
    const unlisted = fs.readdirSync(path.join(ROOT, 'styles'))
      .filter(f => f.endsWith('.css'))
      .map(f => `styles/${f}`)
      .filter(f => !listed.has(f))
    expect(unlisted, 'Add these to the `styles` array in system.json (layer "system")').toEqual([])
  })

  test('every listed stylesheet exists', () => {
    const missing = STYLES.map(s => s.src).filter(src => !fs.existsSync(path.join(ROOT, src)))
    expect(missing).toEqual([])
  })

  test('no selector list has an empty entry', () => {
    const problems = []
    for (const { src } of STYLES) {
      // Mask comments and strings (keeping line numbers) so prose and
      // `content: ','` cannot trip the check. Strings become `x`, not blank,
      // so a list like `Palatino, 'Palatino Linotype', serif` keeps its entry.
      const css = fs.readFileSync(path.join(ROOT, src), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
        .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, m => m.replace(/[^\n]/g, 'x'))
      for (const m of css.matchAll(/,\s*[{,]|[{};]\s*,/g)) {
        problems.push(`${src}:${css.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(problems, 'Empty selector-list entry — the browser drops the whole rule').toEqual([])
  })
})
