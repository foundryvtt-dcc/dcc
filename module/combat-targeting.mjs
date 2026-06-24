/**
 * Shared combat-targeting helpers.
 *
 * Small, Foundry-data-shaped utilities used by the dcc-qol integration combat
 * rules. Kept pure (no module-level Foundry globals) so they unit-test against
 * plain token-like objects.
 */

/**
 * Highest Luck modifier among the PC (`Player`) tokens in a target set.
 *
 * Used by the monster-vs-PC Luck rules: a defending PC's Luck alters an
 * incoming monster critical hit (RAW) and, under the optional Monster Fumbles
 * rule, the monster's fumble die. When a monster attacks several PCs the
 * highest Luck among them applies (DCC Yearbook #8); non-PC targets are
 * ignored.
 *
 * @param {Iterable<{actor?: object}>} targets - the targeted tokens (e.g. `game.user.targets`)
 * @returns {number|null} the highest PC Luck modifier, or null if no PC is targeted
 */
export function highestPcTargetLuckMod (targets) {
  if (!targets || typeof targets[Symbol.iterator] !== 'function') return null
  let highest = null
  for (const token of targets) {
    const actor = token?.actor
    if (actor?.type !== 'Player') continue
    const mod = parseInt(actor.system?.abilities?.lck?.mod) || 0
    if (highest === null || mod > highest) highest = mod
  }
  return highest
}
