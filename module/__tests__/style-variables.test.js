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
 * The test parses the compiled stylesheet (what the browser loads), plus
 * variables.css and the SCSS partials (see `referencesWithoutFallback`). A
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

const STYLES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles')

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

/**
 * Read a stylesheet with comments stripped. Both forms have to go: these files
 * discuss variable names in prose (why a name was dropped, what it used to
 * hold), and a `var(--x)` inside a comment is not a reference.
 */
const read = (file) => fs.readFileSync(path.join(STYLES_DIR, file), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '') // CSS block comments
  .replace(/^\s*\/\/.*$/gm, '') //     SCSS line comments

/** Every custom property DCC declares, across the compiled sheet and variables. */
function declaredProperties () {
  const css = read('dcc.css') + read('variables.css')
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]))
}

/**
 * Every `var(--x)` reference that supplies NO fallback, mapped to the sites
 * using it (for a readable failure message).
 *
 * Scans variables.css and the SCSS partials as well as the compiled sheet.
 * variables.css matters because a custom property whose own value contains an
 * invalid `var()` becomes guaranteed-invalid, taking every consumer with it —
 * one indirection away from the compiled output and therefore easy to miss. The
 * partials matter because dcc.css is a build artifact: without them a stale
 * compile would leave this test green while the shipped stylesheet is broken.
 */
function referencesWithoutFallback () {
  const uses = new Map()
  for (const file of ['dcc.css', 'variables.css', ...scssPartials()]) {
    const css = read(file)
    for (const rule of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const selector = rule[1].replace(/\s+/g, ' ').trim()
      for (const declaration of rule[2].split(';')) {
        // A nested `var(--a, var(--b))` degrades safely, so only the OUTERMOST
        // reference of each declaration decides — take the first `var(` and
        // check whether it supplies a comma before its closing paren.
        for (const use of declaration.matchAll(/var\((--[\w-]+)\s*([,)])/g)) {
          if (use[2] === ',') break // has a fallback — this declaration is safe
          const site = `${file}: ${selector} { ${declaration.trim()} }`
          uses.set(use[1], [...(uses.get(use[1]) || []), site])
        }
      }
    }
  }
  return uses
}

/** The SCSS partials, so the guard checks source and not only the artifact. */
function scssPartials () {
  return fs.readdirSync(STYLES_DIR).filter(f => f.startsWith('_') && f.endsWith('.scss'))
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
