/* global game */

/**
 * Module-integration guards.
 *
 * Transitional coexistence layer for folding the dcc-qol module's combat
 * automation into the system (see `docs/dev/DCC_QOL_INTEGRATION.md`). While the
 * dcc-qol module is installed and active it remains the authority for the
 * overlapping combat features, and the system stands down so the two never
 * double-act (double penalties / cards / damage). dcc-qol shipped first and we
 * cannot change installed copies, so the *system* is the side that yields.
 *
 * The guard is deliberately all-or-nothing at the module level: dcc-qol
 * registers all of its hook handlers unconditionally (checking its own
 * per-feature settings internally), so the system cannot safely take over a
 * subset. When dcc-qol is eventually retired, `qolHandlingCombat()` returns
 * false and the system's combat features take over — flipping the guard is a
 * one-line change here, by design.
 */

/** The dcc-qol module id. */
export const DCC_QOL_MODULE_ID = 'dcc-qol'

/**
 * Whether the dcc-qol module is installed and active, and therefore the
 * authority for the combat features the system is absorbing.
 *
 * When this is true, the system must not register its own overlapping combat
 * hooks or render its own enhanced attack cards — dcc-qol drives them. When it
 * is false (module absent, disabled, or eventually retired), the system's own
 * combat features take over.
 *
 * Safe to read at `init` / `ready` and cache for the session: enabling or
 * disabling a module forces a Foundry reload, so the value cannot change
 * mid-session.
 *
 * @returns {boolean} true if dcc-qol is active and should drive combat
 */
export function qolHandlingCombat () {
  return game.modules.get(DCC_QOL_MODULE_ID)?.active ?? false
}
