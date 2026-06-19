/* global Hooks */

/**
 * Fire the `dcc.afterSpellCheckResult` post-result extension hook for an
 * adapter-routed spell check, mirroring the emission the legacy
 * `processSpellCheck` path does for item-bound casts (see
 * `module/spell-check-processor.mjs`).
 *
 * The Phase 0–7 refactor routes naked-actor casts (`actor.rollSpellCheck()`
 * with no spell item) and macro / generic / wizard / cleric casts through
 * the dcc-core-lib adapter rather than `processSpellCheck`, so without this
 * the seam would only fire for `DCCItem.rollSpellCheck`. This restores
 * parity so variant modules (e.g. MCC) observe every spell-check outcome
 * regardless of cast path.
 *
 * Payload keys match the `processSpellCheck` contract so a single listener
 * works for both paths. Two fields are necessarily adapter-path-specific:
 *   - `result` is `null`: the adapter renders via `renderSpellCheck` and has
 *     no Foundry `TableResult` (the lib classifies tiers internally). The
 *     verdict lives in `crit` / `fumble` / `success` / `total`.
 *   - `patronTaint` is `null`: the adapter routes patron taint through the
 *     lib's RAW pipeline (`onPatronTaint` in `adapter/spell-events.mjs`), so
 *     there is no Foundry-side taint object to surface here. A listener that
 *     keys off a natural 1 (the MCC patron-taint trigger) uses `naturalRoll`.
 *
 * @param {Actor} actor - The casting actor.
 * @param {Object} ctx
 * @param {Roll} ctx.foundryRoll - The evaluated Foundry Roll.
 * @param {Object} ctx.result - The lib SpellCheckResult
 *   (`total` / `natural` / `critical` / `fumble` / `tier`).
 * @param {Object|null} [ctx.spellItem=null] - The cast spell item, or null
 *   for a naked check.
 * @param {string} ctx.castingMode - `'wizard'` / `'cleric'` / `'elf'` /
 *   `'generic'`.
 * @param {boolean} [ctx.suppressPatronTaint=false] - Whether the caller
 *   opted out of the built-in patron-taint roll for this cast.
 * @param {number} [ctx.spellburn=0] - Total ability points burned this cast.
 */
const SUCCESS_TIERS = ['success', 'success-minor', 'success-major', 'success-critical']

export function emitAfterSpellCheckResult (actor, {
  foundryRoll,
  result,
  spellItem = null,
  castingMode,
  suppressPatronTaint = false,
  spellburn = 0
} = {}) {
  const naturalRoll = result?.natural ?? foundryRoll?.dice?.[0]?.total ?? foundryRoll?.total

  Hooks.callAll('dcc.afterSpellCheckResult', actor, {
    roll: foundryRoll,
    item: spellItem,
    naturalRoll,
    total: result?.total ?? foundryRoll?.total,
    result: null,
    crit: !!result?.critical,
    fumble: !!result?.fumble,
    success: !!(result?.tier && SUCCESS_TIERS.includes(result.tier)),
    castingMode,
    patronTaint: null,
    suppressPatronTaint: !!suppressPatronTaint,
    spellburn: spellburn || 0
  })
}

/**
 * Sum the ability points burned this cast from a lib `input.spellburn`
 * descriptor (`{ str, agl, sta }`), for the `spellburn` payload field.
 * Returns 0 when no spellburn was allocated.
 *
 * @param {{str?: number, agl?: number, sta?: number}} [burn]
 * @returns {number}
 */
export function sumSpellburn (burn) {
  if (!burn || typeof burn !== 'object') return 0
  return (Number(burn.str) || 0) + (Number(burn.agl) || 0) + (Number(burn.sta) || 0)
}
