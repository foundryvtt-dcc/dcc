/* global Roll */

/**
 * Foundry-backed async roller for dcc-core-lib.
 *
 * The lib's async pipeline (`evaluateRollAsync`, `resolveSkillCheckAsync`,
 * `rollCheckAsync` and siblings — see dcc-core-lib/docs/MODIFIERS.md)
 * accepts an async custom roller with the signature
 *   (expression: string) => Promise<number>
 *
 * We create a Foundry `Roll` from the expression, await `.evaluate()`,
 * and return `roll.total`. The Foundry Roll instance itself is stashed
 * on a context object supplied by the caller, so downstream adapter
 * code (chat-renderer) can attach the same Roll to the ChatMessage
 * for DSN animation and breakdown display.
 *
 * This single integration point keeps the lib's "what formula?"
 * calculation pure, while Foundry's async dice pipeline stays the
 * source of truth for actual dice rolls.
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
