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
 * The test parses the COMPILED stylesheet, because that is what the browser
 * loads. A reference is considered safe when it either resolves to a DCC
 * declaration or supplies a fallback (`var(--x, #999)`), which renders
 * predictably even when `--x` is missing.
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
  '--color-level-error',
  '--color-level-success',
  '--color-shadow-primary',
  '--font-awesome',
  '--font-size-12',
  '--input-height',
  '--input-text-color'
]

/**
 * Known-dead references awaiting the rest of #861. The `--color-*` ones and
 * `--system-heading-color` / `--system-secondary-text` compute to `inherit` or
 * `transparent`: legible, but the intended visual hierarchy is gone. They are
 * listed rather than mechanically translated because each wants a deliberate
 * dark-theme value.
 *
 * Shrink this list as #861 lands; do NOT add to it.
 */
const KNOWN_DEAD_PENDING_861 = [
  '--color-border-light-highlight',
  '--color-text-dark-primary',
  '--color-text-dark-secondary',
  '--color-text-negative',
  '--system-heading-color',
  '--system-secondary-text'
]

const read = (file) => fs.readFileSync(path.join(STYLES_DIR, file), 'utf8')

/** Every custom property DCC declares, across the compiled sheet and variables. */
function declaredProperties () {
  const css = read('dcc.css') + read('variables.css')
  return new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]))
}

/**
 * Every `var(--x)` reference in the compiled sheet that supplies NO fallback,
 * mapped to the declarations that use it (for a readable failure message).
 */
function referencesWithoutFallback () {
  const css = read('dcc.css')
  const uses = new Map()
  // Capture the declaration each reference sits in, so a failure names the
  // property rather than only the variable.
  for (const rule of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = rule[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()
    for (const declaration of rule[2].split(';')) {
      for (const use of declaration.matchAll(/var\((--[a-z0-9-]+)\s*([,)])/g)) {
        if (use[2] === ',') continue // has a fallback — degrades predictably
        const site = `${selector} { ${declaration.trim()} }`
        uses.set(use[1], [...(uses.get(use[1]) || []), site])
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
      .filter(name => !KNOWN_DEAD_PENDING_861.includes(name))
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

  test('the #861 pending list stays accurate and does not grow', () => {
    // A name that no longer appears means it was fixed — drop it from the list
    // so the guard keeps its teeth.
    const stale = KNOWN_DEAD_PENDING_861.filter(name => !uses.has(name) || declared.has(name))
    expect(
      stale,
      `Fixed or now-declared — remove from KNOWN_DEAD_PENDING_861: ${stale.join(', ')}`
    ).toEqual([])
  })
})
