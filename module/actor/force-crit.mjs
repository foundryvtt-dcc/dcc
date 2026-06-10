/**
 * Apply the legacy `options.forceCrit` shift-click GM-testing mutation
 * to a Foundry Roll. When forceCrit is set and the rolled natural is
 * not a 1 (can't force-crit a fumble), mutates the Roll so chat shows
 * a natural 20 and returns 20 so the adapter feeds the same value to
 * the lib's roller closure. Mirrors `processSpellCheck:605-611`'s
 * legacy mutation so both code paths produce identical chat output.
 *
 * When forceCrit is unset or the natural is 1, returns the natural
 * unchanged.
 *
 * Shared by the skill-check and spell-check dispatchers (see
 * `actor.js` skill block + `actor/rolls-spell-mixin.mjs`), so it lives
 * here as a free function rather than inside either mixin.
 *
 * @param {Roll} foundryRoll - The evaluated Foundry Roll.
 * @param {number} natural - The pre-mutation natural die result.
 * @param {Object} options - Spell-check options bag. Reads `forceCrit`.
 * @returns {number} The natural value the lib should classify against.
 */
export function applyForceCritToFoundryRoll (foundryRoll, natural, options) {
  if (!options?.forceCrit || natural === 1) return natural
  const original = natural
  foundryRoll.terms[0].results[0].result = 20
  foundryRoll.terms[0]._total = 20
  foundryRoll._total += 20 - original
  return 20
}
