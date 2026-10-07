import { didSpellCheckSucceed } from './vendor/dcc-core-lib/index.js'

/**
 * The spell level used for the success threshold. Items without a usable
 * level (spell-like skills, a level-0 or blank field) count as level 1, which
 * is also what the lib's default tiers assume.
 *
 * @param {*} level - The item's `system.level`, if any.
 * @returns {number}
 */
export function normalizeSpellLevel (level) {
  const n = Number(level)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/**
 * DCC RAW spell-check verdict, shared by every cast path so the failure
 * automation, the chat card and the `dcc.afterSpellCheckResult` payload agree
 * (#979). A check succeeds when its total meets the lib threshold
 * (`didSpellCheckSucceed`, 10 + 2 × spell level), unless it is a fumble
 * (natural 1, whatever the modifiers) or a natural inside the cleric's
 * disapproval range.
 *
 * @param {Object} check
 * @param {number} check.total - The check total.
 * @param {*} [check.level] - The spell level; normalized by `normalizeSpellLevel`.
 * @param {boolean} [check.fumble=false] - Natural 1.
 * @param {boolean} [check.disapprovalFailure=false] - Natural inside the
 *   disapproval range.
 * @returns {boolean}
 */
export function spellCheckSucceeded ({ total, level, fumble = false, disapprovalFailure = false }) {
  return !fumble && !disapprovalFailure && didSpellCheckSucceed(total, normalizeSpellLevel(level))
}
