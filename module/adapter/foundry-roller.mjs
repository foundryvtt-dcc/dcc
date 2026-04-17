/**
 * Foundry-backed custom roller for dcc-core-lib.
 *
 * The library's `evaluateRoll(formula, { roller })` (see
 * `@moonloch/dcc-core-lib` `dice/roll.ts`) accepts an injected roller so that
 * integrations can plug in their platform's dice pipeline. For Foundry, that
 * means Foundry's `Roll` class — so dice operator (DSN), replay, and the
 * whole Foundry chat flow still work.
 *
 * Responsibilities (to be implemented during Phase 1+):
 *   - Wrap `DCCRoll.createRoll(terms, data, options)` as a `CustomRoller`
 *   - Translate library-side modifiers into Foundry roll `terms`
 *   - Preserve the existing DCC roll-modifier dialog flow when user interaction
 *     is needed (roll-modifier.js is the UI over this)
 *   - Return the lib's expected `RollResult` shape so pure lib code downstream
 *     is unaffected
 *
 * Phase 0: stub. No implementation yet.
 */

export {}