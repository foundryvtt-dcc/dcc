/**
 * Class traits that tune cleric disapproval for homebrew and sibling-module
 * classes (#1001). Built-in clerics register neither, so they keep the core
 * rule: a d4 per point of the natural roll, and every failed check widens
 * the range by one.
 */

import { DISAPPROVAL_DIE_PATTERN, getClassTrait } from '../extension-api.mjs'

/**
 * Faces of the actor's disapproval die, from the `disapprovalDie` class
 * trait (`'d4'`, `'d10'`, `'1d10'`, …). Registration rejects anything else;
 * a missing trait means the core d4.
 *
 * @param {Object} actor - DCCActor (or anything with `classId`).
 * @returns {number}
 */
export function disapprovalDieFaces (actor) {
  const match = String(getClassTrait(actor, 'disapprovalDie') ?? '').trim().match(DISAPPROVAL_DIE_PATTERN)
  return match ? Number(match[1]) : 4
}

/**
 * Does a failed check widen the actor's disapproval range? True unless the
 * class registers `disapprovalIncreasesOnFailure: false`. Explicit drains
 * (Divine Aid's +10, the sheet button) are not failures and ignore this.
 *
 * @param {Object} actor - DCCActor (or anything with `classId`).
 * @returns {boolean}
 */
export function disapprovalIncreasesOnFailure (actor) {
  return getClassTrait(actor, 'disapprovalIncreasesOnFailure') !== false
}
