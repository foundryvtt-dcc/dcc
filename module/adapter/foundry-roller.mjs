/* global Roll */

/**
 * Foundry-backed async roller for dcc-core-lib.
 *
 * Reserved infrastructure — wraps Foundry's `Roll` as the lib's
 * async `RollOptionsAsync.roller` shape `(expression) => Promise<number>`.
 *
 * Not consumed by any adapter path in Phases 0-3: dispatchers use the
 * two-pass sync formula / evaluate pattern (`{mode:'formula'}` →
 * Foundry `Roll.evaluate()` → `{mode:'evaluate', roller: () => natural}`)
 * in `actor.js` instead, so Foundry owns the dice engine and the lib
 * stays pure. Kept because later phases (wave-3 modifier migration,
 * attack-modifier dialog) may prefer the lib's async roller entry points.
 */

/**
 * Create an async custom roller that wraps Foundry's `Roll` class.
 *
 * @param {Object} context - Shared context object. On each invocation
 *   the created Foundry Roll is pushed onto `context.rolls`, so callers
 *   can collect all Foundry Rolls produced during a lib call.
 * @returns {(expression: string) => Promise<number>} An async roller
 *   suitable for `RollOptionsAsync.roller`.
 */
export function createFoundryRoller (context) {
  if (context && !Array.isArray(context.rolls)) {
    context.rolls = []
  }

  return async (expression) => {
    const roll = new Roll(String(expression))
    await roll.evaluate()
    if (context && Array.isArray(context.rolls)) {
      context.rolls.push(roll)
    }
    return roll.total
  }
}
