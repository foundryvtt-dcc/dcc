/**
 * Guard against CSS custom properties that are referenced but never declared
 * (issue #861).
 *
 * An undefined `var()` fails *silently and asymmetrically*: the declaration is
 * invalid at computed-value time, which does NOT fall back to the previous rule
 * in the cascade — the declaration still wins and computes to `unset`. For an
 * inherited property like `color` that looks like `inherit` and is easy to miss;
 * for a `border` / `outline` / `background` shorthand it means the border or
 * outline **does not render at all**.
 *
 * This has bitten the system repeatedly: a `--system-primrary-text` typo (#856),
 * a `--system-light-bg` that was never declared (#856), and the whole
 * `--color-border-light-*` family, which Foundry V14 declares only under
 * `body.game .app` — the AppV1 selector, and V14 has no AppV1 windows, so
 * `document.querySelectorAll('.app').length === 0` (#861).
 *
 * The test parses every stylesheet system.json loads (variables.css plus the
 * nested-CSS partials — exactly what the browser gets). A
 * reference is safe when it either resolves to a DCC declaration or supplies a
 * fallback (`var(--x, #999)`), which renders predictably even when `--x` is
 * missing.
 *
 * What this CANNOT catch: a name that is declared somewhere but on a selector
 * the using element never sits inside — which is exactly how the V14 breakage
 * happened, from Foundry's side. Static analysis cannot resolve scope; only
 * `getComputedStyle` in a live world can. Treat a green run as "no missing
 * declarations", not "every variable resolves".
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Custom properties Foundry V14 declares on a scope that DCC selectors actually
 * sit inside (`body`, `:root`, or the element itself). Verified against the V14
 * client stylesheet — to add a name here, confirm core declares it OUTSIDE the
 * legacy `body.game .app` block, e.g. by reading it in a live world:
 *
 *   getComputedStyle(document.querySelector('.dcc.sheet')).getPropertyValue('--x')
 *
 * An empty string means the variable does not resolve there and the reference
 * needs a fallback or a DCC-owned replacement.
 */
const CORE_PROVIDED = [
  '--font-size-12',
  '--input-text-color'
]

/** The stylesheets system.json loads, in load order. */
const STYLESHEETS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'system.json'), 'utf8')
).styles.map(({ src }) => src)

/**
 * Read a stylesheet with comments stripped and strings masked. Comments go
 * because these files discuss variable names in prose (why a name was dropped,
 * what it used to hold), and a `var(--x)` inside a comment is not a reference.
 * Strings are masked (one pass with comments, so a `/*` inside a string is not
 * a comment) because a quoted `;`, `{` or `}` — `content: ';'`, a data: URL —
 * would otherwise throw off the block walker in `declarations`.
 */
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
  .replace(/\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g,
    m => m[0] === '/' ? '' : `${m[0]}str${m[0]}`)

/** Every custom property DCC declares, across all stylesheets. */
function declaredProperties () {
  const css = STYLESHEETS.map(read).join('\n')
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]))
}

/**
 * Walk a (possibly nested) stylesheet and yield each declaration with the
 * selector of the block it sits in. A flat `selector { decls }` regex is not
 * enough: in nested CSS a block's own declarations can sit alongside nested
 * rules, and the regex would read them as part of the child's selector.
 */
function * declarations (css) {
  const selectors = []
  let text = ''
  for (const char of css) {
    if (char === '{') {
      selectors.push(text.replace(/\s+/g, ' ').trim())
      text = ''
    } else if (char === ';' || char === '}') {
      if (text.trim()) yield { selector: selectors.at(-1) ?? '', declaration: text.trim() }
      text = ''
      if (char === '}') selectors.pop()
    } else {
      text += char
    }
  }
}

/**
 * The `var()` references in one declaration value that supply no fallback.
 *
 * A reference inside another `var()`'s fallback degrades safely — if it is
 * invalid, the outer fallback is simply unused — so each fallback is skipped
 * up to its balancing `)`. References outside any fallback are all checked:
 * `box-shadow: 0 0 var(--a, 1px) var(--typo)` still reports `--typo`.
 */
function * unguardedVars (value) {
  const call = /var\(\s*(--[\w-]+)\s*([,)])/g
  let use
  while ((use = call.exec(value))) {
    if (use[2] === ')') { yield use[1]; continue }
    // Has a fallback: resume scanning after the call's closing paren.
    let depth = 1
    let i = call.lastIndex
    for (; i < value.length && depth; i++) {
      if (value[i] === '(') depth++
      else if (value[i] === ')') depth--
    }
    call.lastIndex = i
  }
}

/**
 * Every `var(--x)` reference that supplies NO fallback, mapped to the sites
 * using it (for a readable failure message).
 *
 * Includes variables.css: a custom property whose own value contains an
 * invalid `var()` becomes guaranteed-invalid, taking every consumer with it —
 * one indirection away from the rules that use it and therefore easy to miss.
 */
function referencesWithoutFallback () {
  const uses = new Map()
  for (const file of STYLESHEETS) {
    for (const { selector, declaration } of declarations(read(file))) {
      for (const name of unguardedVars(declaration)) {
        const site = `${file}: ${selector} { ${declaration} }`
        uses.set(name, [...(uses.get(name) || []), site])
      }
    }
  }
  return uses
}

describe('CSS custom properties', () => {
  const declared = declaredProperties()
  const uses = referencesWithoutFallback()

  test('every fallback-less var() resolves to a declared property', () => {
    const unresolved = [...uses.keys()]
      .filter(name => !declared.has(name))
      .filter(name => !CORE_PROVIDED.includes(name))
      .sort()

    const detail = unresolved
      .map(name => `  ${name}\n${uses.get(name).map(s => `      ${s}`).join('\n')}`)
      .join('\n')

    expect(
      unresolved,
      'These custom properties are referenced with no fallback and declared nowhere.\n' +
      'The declaration will be invalid at computed-value time: a color becomes\n' +
      '`inherit`, and a border / outline / background shorthand renders as NOTHING.\n' +
      'Declare it in styles/variables.css (light AND dark), give the reference a\n' +
      'fallback, or — if Foundry declares it outside `body.game .app` — add it to\n' +
      `CORE_PROVIDED in this test.\n\n${detail}\n`
    ).toEqual([])
  })

  test('the CORE_PROVIDED allowlist has no stale entries', () => {
    // An allowlisted name that nothing references without a fallback is dead
    // weight — and a stale entry is exactly how a future dead variable would
    // slip through, since the guard trusts this list unconditionally.
    const stale = CORE_PROVIDED.filter(name => !uses.has(name))
    expect(
      stale,
      `Nothing references these without a fallback — drop from CORE_PROVIDED: ${stale.join(', ')}`
    ).toEqual([])
  })
})
