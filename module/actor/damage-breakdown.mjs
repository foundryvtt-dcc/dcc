/**
 * Build a per-flavor damage breakdown string for a multi-type damage roll.
 *
 * Phase 7 (Appendix-A actor.js shrinkage): lifted verbatim out of
 * `DCCActor._buildDamageBreakdown`. It is a pure function of the rolled terms —
 * it reads nothing off the actor (`this`) — so unlike the stateful `actor/*`
 * mixins it extracts as a free function (the same "pure-logic → free function"
 * shape the `actor-sheet/*` extractions use). `actor.js`'s `_rollDamage` calls
 * it directly.
 *
 * Sums each non-operator term's total by its flavor, and returns a
 * `"<total> <flavor> + <total> <flavor>"` string only when the roll mixes two
 * or more distinct damage types; a single-type roll returns `null` (no
 * breakdown needed). Flavorless terms contribute their bare total.
 *
 * @param {Roll} roll - The evaluated Foundry damage Roll.
 * @returns {string | null} The breakdown string, or `null` for a single type.
 */
export function buildDamageBreakdown (roll) {
  // Collect damage totals by flavor
  const damageByFlavor = new Map()

  for (const term of roll.terms) {
    // Skip operator terms
    if (term.operator) continue

    // Get the term's total and flavor
    const total = term.total ?? 0
    const flavor = term.flavor || ''

    // Accumulate damage by flavor
    damageByFlavor.set(flavor, (damageByFlavor.get(flavor) || 0) + total)
  }

  // Only show breakdown if there are multiple distinct damage types
  if (damageByFlavor.size <= 1) return null

  // Build the breakdown string
  const parts = []
  for (const [flavor, total] of damageByFlavor) {
    if (flavor) {
      parts.push(`${total} ${flavor}`)
    } else {
      parts.push(`${total}`)
    }
  }

  return parts.join(' + ')
}
