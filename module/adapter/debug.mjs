/* global game, ui */

/**
 * Adapter dispatch logging.
 *
 * Emits a single-line console log at every adapter / legacy dispatch
 * so each code path is identifiable in the Foundry console. Centralized
 * here so the tag stays consistent across every dispatcher branch.
 *
 * Permanent infrastructure: `browser-tests/e2e/adapter-dispatch.spec.js`
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
 * NOT redundant computation: Foundry rolls the dice once and the lib
 * re-classifies those same naturals via a sequenced roller (see the
 * `sequencedRoller` closures in `actor/rolls-weapon-mixin.mjs` /
 * `rolls-spell-mixin.mjs`). This check just compares the two totals —
 * it is one integer comparison per roll, not a second roll.
 *
 * Exit criterion (when to delete these calls): once `@moonloch/dcc-core-lib`
 * is version-pinned and has shipped ≥2 consecutive vendor syncs with zero
 * `[DCC adapter] … total divergence` warnings observed in real play / the
 * e2e run, the safety net has served its purpose and each `warnIfDivergent`
 * call can be removed (the surrounding two-pass stays — it is the adapter's
 * design, not scaffolding). Until then, keep them: a silent lib bump that
 * shifts a total is exactly what this is here to catch. Tracked against
 * ARCHITECTURE_REIMAGINED.md §8.6.
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

/**
 * Fail-loud error boundary for the public roll dispatchers.
 *
 * The observational refactor deliberately removes legacy fallbacks so
 * lib bugs surface instead of being silently masked. The failure mode
 * that leaves behind, though, is bad: an uncaught throw inside an
 * `_xxxViaAdapter` (or `_xxxLegacy`) path becomes an unhandled promise
 * rejection, so the player's click just does nothing with no feedback.
 *
 * This boundary keeps the surface-bugs philosophy (it does NOT swallow
 * the error or fall back to legacy) while making the failure visible:
 * on a throw it logs the full error to the console and shows a
 * `ui.notifications.error`, then **rethrows** so the rejection still
 * propagates (and any caller / test still sees it). Wrap the body of
 * each public dispatcher with `return await withRollErrorBoundary(...)`.
 *
 * `await` matters: returning the inner promise without awaiting would
 * let the rejection escape the try/catch. The wrapped `fn` may itself
 * be sync (e.g. `getInitiativeRoll` returns a `Roll`) — awaiting a
 * non-promise is a harmless no-op.
 *
 * @param {string} rollType - dispatcher name, e.g. 'rollAbilityCheck'
 * @param {string} label - already-localized human label for the
 *   notification (e.g. the result of `game.i18n.localize('DCC.Roll')`)
 * @param {() => any} fn - the dispatcher body to run
 * @returns {Promise<any>} whatever `fn` returns
 */
export async function withRollErrorBoundary (rollType, label, fn) {
  try {
    return await fn()
  } catch (err) {
    notifyRollError(rollType, label, err)
    throw err
  }
}

/**
 * Synchronous sibling of {@link withRollErrorBoundary}, for the one
 * dispatcher that must stay sync: `getInitiativeRoll` overrides Foundry
 * core's synchronous `Combatant.getInitiativeRoll` contract (the combat
 * tracker expects a `Roll`, not a Promise). Same fail-loud behavior —
 * log + notify + rethrow — without turning the return value into a
 * promise. Do NOT use this for paths whose `fn` is async: an async `fn`
 * here would resolve its rejection outside the try, defeating the
 * boundary. The init path is sync end-to-end, so this is safe.
 *
 * @param {string} rollType - dispatcher name, e.g. 'getInitiativeRoll'
 * @param {string} label - already-localized human label for the notification
 * @param {() => any} fn - the synchronous dispatcher body to run
 * @returns {any} whatever `fn` returns
 */
export function withRollErrorBoundarySync (rollType, label, fn) {
  try {
    return fn()
  } catch (err) {
    notifyRollError(rollType, label, err)
    throw err
  }
}

/**
 * Shared fail-loud reporting for the roll error boundaries: log the full
 * error to the console and show a localized `ui.notifications.error`.
 * @private
 */
function notifyRollError (rollType, label, err) {
  console.error(`[DCC adapter] ${rollType} threw — surfacing to the user`, err)
  ui.notifications.error(
    game.i18n.format('DCC.RollErrorNotification', { rollType: label })
  )
}
