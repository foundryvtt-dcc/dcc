import { vi } from 'vitest'
import Roll from './roll.js'

/**
 * Mocks for DCCRoll
 */
global.dccRollCreateRollMock = vi.fn((formula, data, options) => {
  if (formula instanceof String) {
    return new Roll(formula, data)
  } else {
    return new Roll('1d20')
  }
})
global.dccRollCleanFormulaMock = vi.fn((terms) => {})
global.dccRollCleanTermsMock = vi.fn((terms) => {})
class DCCRoll {
  // SYNCHRONOUS to match production `DCCRoll.createRoll`
  // (module/dcc-roll.js:17), which returns the Roll synchronously rather
  // than a Promise. The mock previously declared this `static async`, so
  // adapter dispatch paths that consume `createRoll(...)` synchronously
  // (`_rollDamage` / `_rollCritical` / `_rollFumble`) saw a Promise under
  // test and each test had to install its own local sync override. The
  // shared `withSyncCreateRoll` helper below now owns that override so the
  // per-file copies can go away.
  static createRoll (formula, data = {}, options = {}) {
    return global.dccRollCreateRollMock(formula, data, options)
  }

  static cleanFormula (terms) {
    return global.dccRollCleanFormulaMock(terms)
  }

  static cleanTerms (terms) {
    return global.dccRollCleanTermsMock(terms)
  }
}

/**
 * Install a synchronous `createRoll` on the live mock `DCCRoll` for the
 * duration of one test, returning whatever `rollFactory(...args)` yields
 * (so a test can supply a specific stub Roll instead of the generic
 * `new Roll('1d20')` the default mock returns). Mirrors production's sync
 * `createRoll` contract. Returns a restore function that reinstates the
 * original method — call it in a `finally` / `afterEach`.
 *
 * Shared replacement for the per-file `withSyncCreateRoll` copies that
 * previously lived in `adapter-weapon-damage.test.js` /
 * `adapter-weapon-crit-fumble.test.js`. Operates on
 * `globalThis.game.dcc.DCCRoll` (the same mock class, wired through the
 * Foundry mock) so it overrides the instance the adapter code actually
 * calls.
 *
 * @param {(...args: any[]) => any} rollFactory  Produces the Roll the
 *   adapter path will consume; receives the `createRoll` arguments.
 * @returns {() => void}  Restore function.
 */
export function withSyncCreateRoll (rollFactory) {
  const dccRoll = globalThis.game?.dcc?.DCCRoll ?? DCCRoll
  const original = dccRoll.createRoll
  dccRoll.createRoll = vi.fn((...args) => rollFactory(...args))
  return () => { dccRoll.createRoll = original }
}

export default DCCRoll
