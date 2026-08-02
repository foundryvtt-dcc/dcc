/**
 * Roll cancellation signal.
 *
 * Closing or cancelling the roll-modifier dialog is a normal user
 * decision, not a failure — but the dialog's only way to unblock the
 * `await` in its caller is to settle the promise it was constructed
 * with. It used to `reject(null)`, which made a cancel indistinguishable
 * from a crash: the roll error boundary (`adapter/debug.mjs`) caught the
 * empty rejection and showed the player a red "the roll failed
 * unexpectedly" notification with nothing in the console to explain it
 * (issue #867).
 *
 * `RollCancelledError` makes the cancel a *typed* signal instead. It
 * still unwinds the dispatcher (nothing partial gets posted to chat),
 * but every layer that catches it can tell "the user backed out" apart
 * from "something broke" and stay quiet.
 */

/**
 * Thrown by `RollModifierDialog` when the user cancels or closes the
 * dialog without submitting.
 */
export class RollCancelledError extends Error {
  constructor (message = 'DCC roll cancelled by the user') {
    super(message)
    this.name = 'RollCancelledError'
    // Duck-typing marker: `instanceof` is unreliable across the module
    // boundary when a module (dcc-qol, xcc, …) loads its own copy of
    // this file, so consumers should prefer `isRollCancellation`.
    this.isRollCancellation = true
  }
}

/**
 * Is this caught value a roll-modifier-dialog cancellation?
 *
 * Accepts a bare `null` too: that was the pre-#867 cancel signal, and
 * third-party dialogs wired to the same
 * `showRollModifier(resolve, reject)` contract may still reject that
 * way. Treating it as a cancellation keeps those quiet rather than
 * showing a contentless error.
 *
 * `undefined` is deliberately NOT accepted. Nothing has ever rejected
 * with it, and since the error boundary swallows a cancellation without
 * rethrowing, accepting it would make an accidental
 * `throw someUninitializedVar` vanish without a trace.
 *
 * @param {unknown} err - a caught value
 * @returns {boolean}
 */
export function isRollCancellation (err) {
  if (err === null) return true
  return err instanceof RollCancelledError || err?.isRollCancellation === true
}

/**
 * Await a roll-modifier-dialog-backed roll, turning a user cancel into
 * `null` instead of a rejection. Any other failure still propagates.
 *
 * For the many `const roll = await game.dcc.DCCRoll.createRoll(...)`
 * call sites that are not behind an error boundary: without this, a
 * cancel becomes an unhandled promise rejection.
 *
 * @param {Promise<any>} rollPromise - the pending `createRoll` promise
 * @returns {Promise<any|null>} the roll, or `null` if the user cancelled
 */
export async function rollOrNullOnCancel (rollPromise) {
  try {
    return await rollPromise
  } catch (err) {
    if (isRollCancellation(err)) return null
    throw err
  }
}
