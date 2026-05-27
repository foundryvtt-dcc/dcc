/**
 * Built-in variant registration for the canonical DCC ruleset.
 *
 * Phase 6 session 5 added `game.dcc.registerVariant` as the stable
 * extension surface for variant ruleset modules (XCC, MCC, future).
 * The DCC system dogfoods its own helper by registering the `'dcc'`
 * variant from this single entry point at `init` time. Sibling variant
 * modules register their own entry from their own `init` hook; the
 * world-setting `dcc.activeVariant` selects which variant is live.
 *
 * `sheetTheme` is intentionally omitted for the core `'dcc'` variant —
 * the base CSS is already the DCC theme. Variants like XCC declare a
 * `sheetTheme` (e.g., `'theme-xcc'`) so their styles can scope under a
 * single root selector without each per-class sheet subclass having to
 * remember the class.
 */

export const BUILT_IN_VARIANT = {
  id: 'dcc',
  label: 'DCC.VariantDCC',
  classes: ['cleric', 'dwarf', 'elf', 'halfling', 'thief', 'warrior', 'wizard']
}

/**
 * Register the built-in DCC variant through the supplied registration
 * helper (production wires this to `registerVariant`). Kept as a thin
 * wrapper so `module/dcc.js`'s init hook reads as a list of `register…`
 * calls without inlining the built-in payload.
 *
 * @param {(descriptor: object) => void} register
 */
export function registerBuiltInVariant (register) {
  register(BUILT_IN_VARIANT)
}
