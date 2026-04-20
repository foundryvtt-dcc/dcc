/**
 * Cleric Module
 *
 * Pure functions for cleric-specific abilities:
 * - Turn Unholy: Channel divine power to turn/destroy unholy creatures
 * - Lay on Hands: Channel divine healing to restore HP and cure ailments
 * - Divine Aid: Petition deity for miraculous intervention
 *
 * @example
 * ```typescript
 * import { turnUnholy, layOnHands, divineAid } from "dcc-core-lib";
 *
 * // Turn Unholy
 * const turnResult = turnUnholy(
 *   { level: 3, personality: 16 },
 *   turnUnholyTable
 * );
 *
 * // Lay on Hands
 * const healResult = layOnHands(
 *   { level: 3, personality: 16, healingSelf: false },
 *   layOnHandsTable
 * );
 *
 * // Divine Aid
 * const aidResult = divineAid(
 *   { level: 3, personality: 16, disapprovalRange: 1 },
 *   divineAidTable
 * );
 * ```
 */
export { turnUnholy, getTurnUnholyModifier, getTurnUnholyDie, resolveHDExpression, calculateAverageHD, TURN_UNHOLY_SKILL, } from "./turn-unholy.js";
export type { TurnUnholyInput, TurnUnholyResult, TurnEffect, TurnEffectType, } from "./turn-unholy.js";
export { layOnHands, getLayOnHandsModifier, getLayOnHandsDie, LAY_ON_HANDS_SKILL, } from "./lay-on-hands.js";
export type { LayOnHandsInput, LayOnHandsResult, LayOnHandsTarget, } from "./lay-on-hands.js";
export { divineAid, getDivineAidModifier, getDivineAidDie, getMinimumCheckForSpellLevel, estimateAidSpellLevel, describePotentialAid, DIVINE_AID_SKILL, } from "./divine-aid.js";
export type { DivineAidInput, DivineAidResult, DivineAidEffect, DivineAidEffectType, AidRequestType, } from "./divine-aid.js";
//# sourceMappingURL=index.d.ts.map