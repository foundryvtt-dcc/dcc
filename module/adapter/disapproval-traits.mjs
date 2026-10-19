/**
 * Class traits that tune cleric disapproval for homebrew and sibling-module
 * classes (#1001). Built-in clerics register neither, so they keep the core
 * rule: a d4 per point of the natural roll, and every failed check widens
 * the range by one.
 */

import { getClassTrait } from '../extension-api.mjs'

/**
 * Faces of the actor's disapproval die, from the `disapprovalDie` class
 * trait (`'d4'`, `'d10'`, …). Anything that isn't a `dN` die falls back to 4.
 *
 * @param {Object} actor - DCCActor (or anything with `classId`).
 * @returns {number}
 */
export function disapprovalDieFaces (actor) {
  const match = String(getClassTrait(actor, 'disapprovalDie') ?? '').trim().match(/^d(\d+)$/i)
  const faces = match ? Number(match[1]) : 0
  return faces > 0 ? faces : 4
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
