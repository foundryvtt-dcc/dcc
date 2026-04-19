/**
 * Adapter dispatch logging.
 *
 * Emits a single-line console log at every adapter / legacy dispatch
 * so each code path is identifiable in the Foundry console. Centralized
 * here so the tag stays consistent across every dispatcher branch.
 *
 * Permanent infrastructure: `browser-tests/e2e/phase1-adapter-dispatch.spec.js`
 * captures these lines via Playwright and asserts every dispatcher
 * branch end-to-end. Every new `_xxxViaAdapter` / `_xxxLegacy` method
 * in later phases must call `logDispatch` as its first line.
 */

/**
 * @param {string} rollType - e.g. 'rollSavingThrow', 'rollAbilityCheck'
 * @param {'adapter'|'legacy'} path - which branch the dispatcher chose
 * @param {Object} [details] - small extra context (serialized inline)
 */
export function logDispatch (rollType, path, details = {}) {
  const tag = path === 'adapter' ? 'via adapter' : 'LEGACY path'
  const extras = Object.entries(details)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  console.log(
    `[DCC adapter] ${rollType} \u2192 ${tag}${extras ? ' ' + extras : ''}`
  )
}

/**
 * Observational divergence check for the adapter two-pass pattern.
 * When the lib's classification total disagrees with the Foundry
 * Roll's total, emit a console warn so a lib-version bump or a
 * silently-dropped hook term is caught immediately instead of
 * drifting undetected into chat flags. The PR body for Phase 3
 * claims "no divergence with the displayed total"; this enforces
 * it observationally.
 *
 * @param {string} rollType - e.g. 'rollToHit', 'rollDamage', 'rollCritical'
 * @param {number} foundryTotal - Foundry Roll's final total
 * @param {number} libTotal - lib result's total
 * @param {Object} [context] - small extra context (actor, weapon, etc.)
 */
export function warnIfDivergent (rollType, foundryTotal, libTotal, context = {}) {
  if (foundryTotal === libTotal) return
  console.warn(
    `[DCC adapter] ${rollType} lib/foundry total divergence`,
    { foundry: foundryTotal, lib: libTotal, ...context }
  )
}
