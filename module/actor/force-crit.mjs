/**
 * Apply the legacy GM-testing roll mutations to a Foundry Roll:
 *   - `options.forceCrit` (shift-click) forces a natural 20 — unless the
 *     rolled natural is already a 1 (you can't force-crit a fumble).
 *   - `options.forceFumble` (ctrl/meta+shift-click) forces a natural 1.
 *     Unconditional (a forced fumble always lands on 1); the `!== 1` guard
 *     just avoids a redundant no-op mutation.
 *
 * `fillRollOptions` makes the two flags mutually exclusive (shift =>
 * forceCrit, ctrl/meta+shift => forceFumble), but forceCrit is evaluated
 * first defensively. Mutates the Roll so chat shows the forced natural and
 * returns that value so the adapter feeds the same number to the lib's
 * roller closure. Mirrors `processSpellCheck`'s legacy force-crit /
 * force-fumble mutations so both code paths produce identical chat output.
 *
 * When neither flag applies, returns the natural unchanged.
 *
 * Shared by the skill-check and spell-check dispatchers (see
 * `actor.js` skill block + `actor/rolls-spell-mixin.mjs`), so it lives
 * here as a free function rather than inside either mixin.
 *
 * @param {Roll} foundryRoll - The evaluated Foundry Roll.
 * @param {number} natural - The pre-mutation natural die result.
 * @param {Object} options - Spell-check options bag. Reads `forceCrit` / `forceFumble`.
 * @returns {number} The natural value the lib should classify against.
 */
export function applyForceCritToFoundryRoll (foundryRoll, natural, options) {
  if (options?.forceCrit && natural !== 1) {
    const original = natural
    foundryRoll.terms[0].results[0].result = 20
    foundryRoll.terms[0]._total = 20
    foundryRoll._total += 20 - original
    return 20
  }
  if (options?.forceFumble && natural !== 1) {
    const original = natural
    foundryRoll.terms[0].results[0].result = 1
    foundryRoll.terms[0]._total = 1
    foundryRoll._total += 1 - original
    return 1
  }
  return natural
}
