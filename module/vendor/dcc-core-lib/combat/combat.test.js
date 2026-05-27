/**
 * Combat System Tests
 *
 * Tests for attack rolls, damage, critical hits, fumbles, and initiative
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { COMMON_WEAPONS } from "../types/combat.js";
import { registerClassProgression, clearClassProgressions, } from "../data/classes/progression-utils.js";
function makeLevel(overrides) {
    return {
        attackBonus: 0,
        criticalDie: "1d4",
        criticalTable: "I",
        actionDice: ["1d20"],
        hitDie: "d4",
        saves: { ref: 0, frt: 0, wil: 0 },
        ...overrides,
    };
}
import { 
// Attack
makeAttackRoll, calculateAttackBonus, doesAttackHit, getAttackAbility, getTwoWeaponDice, rollTwoWeaponAttack, isDeedSuccessful, 
// Damage
rollDamage, getTwoHandedDamageDie, getWeaponDamage, buildDamageFormula, applyMinimumDamage, 
// Crits
rollCritical, determineCritTable, getCritTable, getCritDie, buildCritFormula, parseCritExtraDamage, 
// Fumbles
rollFumble, buildFumbleFormula, isFumble, getFumbleDie, getArmorType, getArmorCheckPenalty, getArmorSpeedPenalty, 
// Initiative
rollInitiative, calculateInitiativeModifier, buildInitiativeFormula, getInitiativeDie, sortByInitiative, isInitiativeTied, } from "./index.js";
// =============================================================================
// Test Helpers
// =============================================================================
/**
 * Create a deterministic roller that returns a specific value
 */
function createMockRoller(value) {
    return (_expression) => value;
}
/**
 * Create a roller that returns values from a sequence
 */
function createSequenceRoller(values) {
    let index = 0;
    return (_expression) => {
        const value = values[index] ?? 10;
        index = (index + 1) % values.length;
        return value;
    };
}
/**
 * Look up a weapon from the common catalog, failing loudly if missing.
 */
function getWeapon(key) {
    const weapon = COMMON_WEAPONS[key];
    if (!weapon)
        throw new Error(`${key} missing from COMMON_WEAPONS`);
    return weapon;
}
// =============================================================================
// Attack Roll Tests
// =============================================================================
describe("Attack System", () => {
    describe("makeAttackRoll", () => {
        it("should roll a basic melee attack", () => {
            const roller = createMockRoller(15);
            const input = {
                attackType: "melee",
                attackBonus: 2,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 3,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.roll.natural).toBe(15);
            expect(result.totalBonus).toBe(5); // 2 + 3
            expect(result.total).toBe(20); // 15 + 5
            expect(result.isCriticalThreat).toBe(false);
            expect(result.isFumble).toBe(false);
        });
        it("should detect critical threat when roll meets threat range", () => {
            const roller = createMockRoller(19);
            const input = {
                attackType: "melee",
                attackBonus: 3,
                actionDie: "d20",
                threatRange: 19,
                abilityModifier: 2,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isCriticalThreat).toBe(true);
            expect(result.isFumble).toBe(false);
        });
        it("should detect fumble on natural 1", () => {
            const roller = createMockRoller(1);
            const input = {
                attackType: "melee",
                attackBonus: 5,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 3,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isFumble).toBe(true);
            expect(result.isCriticalThreat).toBe(false);
        });
        it("should handle deed die for warriors", () => {
            const roller = createSequenceRoller([15, 4]); // Attack roll, deed roll
            const input = {
                attackType: "melee",
                attackBonus: 3,
                actionDie: "d20",
                threatRange: 19,
                abilityModifier: 2,
                deedDie: "d4",
            };
            const result = makeAttackRoll(input, roller);
            expect(result.roll.natural).toBe(15);
            expect(result.deedRoll).toBeDefined();
            expect(result.deedRoll?.natural).toBe(4);
            expect(result.deedSuccess).toBe(true); // 4 >= 3
            expect(result.totalBonus).toBe(9); // 3 + 2 + 4 deed
        });
        it("should detect failed deed when deed die < 3", () => {
            const roller = createSequenceRoller([15, 2]); // Attack roll, deed roll
            const input = {
                attackType: "melee",
                attackBonus: 3,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 2,
                deedDie: "d4",
            };
            const result = makeAttackRoll(input, roller);
            expect(result.deedSuccess).toBe(false); // 2 < 3
        });
        it("should determine hit when target AC is provided", () => {
            const roller = createMockRoller(10);
            const input = {
                attackType: "melee",
                attackBonus: 2,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 3,
                targetAC: 15,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.total).toBe(15); // 10 + 2 + 3
            expect(result.isHit).toBe(true); // 15 >= 15
        });
        it("should miss when total is below target AC", () => {
            const roller = createMockRoller(8);
            const input = {
                attackType: "melee",
                attackBonus: 2,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 3,
                targetAC: 15,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.total).toBe(13); // 8 + 2 + 3
            expect(result.isHit).toBe(false);
        });
        it("should always miss on natural 1 regardless of total", () => {
            const roller = createMockRoller(1);
            const input = {
                attackType: "melee",
                attackBonus: 10,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 5,
                targetAC: 10,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isHit).toBe(false); // Fumble always misses
        });
        it("should always hit on natural 20 regardless of AC", () => {
            const roller = createMockRoller(20);
            const input = {
                attackType: "melee",
                attackBonus: -5,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: -3,
                targetAC: 50,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isHit).toBe(true); // Natural 20 always hits
            expect(result.isCriticalThreat).toBe(true); // Also a crit since it hit
        });
        it("should NOT auto-hit on threat range roll that misses AC", () => {
            // Warrior with 19-20 threat range rolls 19, but doesn't beat AC
            const roller = createSequenceRoller([19, 1]); // Attack roll 19, deed roll 1
            const input = {
                attackType: "melee",
                attackBonus: 0,
                actionDie: "d20",
                threatRange: 19, // 19-20 threat range
                abilityModifier: 0,
                deedDie: "d3",
                targetAC: 21, // AC is 21, total attack is 19 + 0 + 1 = 20
            };
            const result = makeAttackRoll(input, roller);
            expect(result.roll.natural).toBe(19);
            expect(result.total).toBe(20); // 19 + 1 deed
            expect(result.isHit).toBe(false); // 20 < 21 AC, so miss
            expect(result.isCriticalThreat).toBe(false); // NOT a crit because it missed!
        });
        it("should crit on threat range roll that hits AC", () => {
            // Warrior with 19-20 threat range rolls 19, and beats AC
            const roller = createSequenceRoller([19, 3]); // Attack roll 19, deed roll 3
            const input = {
                attackType: "melee",
                attackBonus: 0,
                actionDie: "d20",
                threatRange: 19, // 19-20 threat range
                abilityModifier: 0,
                deedDie: "d3",
                targetAC: 21, // AC is 21, total attack is 19 + 0 + 3 = 22
            };
            const result = makeAttackRoll(input, roller);
            expect(result.roll.natural).toBe(19);
            expect(result.total).toBe(22); // 19 + 3 deed
            expect(result.isHit).toBe(true); // 22 >= 21 AC
            expect(result.isCriticalThreat).toBe(true); // Crit because 19 is in range AND it hit
        });
        it("should auto-crit on a backstab hit regardless of threat range", () => {
            // Thief rolls 12 (well outside any threat range), hits AC, so per
            // RAW this is an automatic critical hit on Crit Table II.
            const roller = createMockRoller(12);
            const input = {
                attackType: "melee",
                attackBonus: 1,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 2,
                targetAC: 13,
                isBackstab: true,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.roll.natural).toBe(12);
            expect(result.isHit).toBe(true); // 12 + 1 + 2 = 15 >= 13
            expect(result.isCriticalThreat).toBe(true);
        });
        it("should NOT auto-crit on a backstab miss", () => {
            // Backstab that misses AC is still a miss; no crit.
            const roller = createMockRoller(2);
            const input = {
                attackType: "melee",
                attackBonus: 0,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 0,
                targetAC: 15,
                isBackstab: true,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isHit).toBe(false);
            expect(result.isCriticalThreat).toBe(false);
            expect(result.critSource).toBeUndefined();
        });
        it("should NOT auto-crit on a natural 1 backstab (fumble wins)", () => {
            // A natural 1 is always a fumble and never a crit, even when
            // isBackstab is set. Regression test for the silent-failure
            // path where missing targetAC + nat 1 used to crit+fumble both.
            const roller = createMockRoller(1);
            const input = {
                attackType: "melee",
                attackBonus: 5,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 3,
                targetAC: 10,
                isBackstab: true,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isFumble).toBe(true);
            expect(result.isHit).toBe(false);
            expect(result.isCriticalThreat).toBe(false);
            expect(result.critSource).toBeUndefined();
        });
        it("should NOT auto-crit on nat 1 backstab even without targetAC", () => {
            // Same invariant when the caller omits targetAC — we cannot let
            // "unknown hit" upgrade a fumble into a crit.
            const roller = createMockRoller(1);
            const input = {
                attackType: "melee",
                attackBonus: 0,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 0,
                isBackstab: true,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isFumble).toBe(true);
            expect(result.isCriticalThreat).toBe(false);
            expect(result.critSource).toBeUndefined();
        });
        it("tags the critSource as 'backstab-auto' on a backstab auto-crit", () => {
            const roller = createMockRoller(12);
            const input = {
                attackType: "melee",
                attackBonus: 1,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 2,
                targetAC: 13,
                isBackstab: true,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isCriticalThreat).toBe(true);
            expect(result.critSource).toBe("backstab-auto");
        });
        it("tags the critSource as 'threat-range' on a normal threat-range crit", () => {
            const roller = createMockRoller(19);
            const input = {
                attackType: "melee",
                attackBonus: 3,
                actionDie: "d20",
                threatRange: 19,
                abilityModifier: 2,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isCriticalThreat).toBe(true);
            expect(result.critSource).toBe("threat-range");
        });
        it("tags the critSource as 'natural-max' on a natural-20 auto-hit crit", () => {
            const roller = createMockRoller(20);
            const input = {
                attackType: "melee",
                attackBonus: 0,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 0,
                targetAC: 50,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.isCriticalThreat).toBe(true);
            expect(result.critSource).toBe("natural-max");
        });
        it("applies a precomputed backstab RollBonus end-to-end (Table 1-9 wiring)", () => {
            // Regression test for the full backstab contract: the caller
            // precomputes the Table 1-9 bonus (L3 Chaotic = +7), passes it
            // as a full RollBonus, and sets isBackstab: true — the bonus
            // lands in totalBonus AND the hit auto-crits.
            const roller = createMockRoller(10);
            const input = {
                attackType: "melee",
                attackBonus: 1,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 2,
                targetAC: 20,
                isBackstab: true,
                bonuses: [
                    {
                        id: "class:backstab",
                        label: "Backstab (Table 1-9)",
                        source: { type: "class", id: "thief" },
                        category: "inherent",
                        effect: { type: "modifier", value: 7 },
                    },
                ],
            };
            const result = makeAttackRoll(input, roller);
            expect(result.totalBonus).toBe(10); // 1 attack + 2 abil + 7 backstab
            expect(result.total).toBe(20); // 10 + 10
            expect(result.isHit).toBe(true); // 20 >= 20
            expect(result.isCriticalThreat).toBe(true);
            expect(result.critSource).toBe("backstab-auto");
        });
        // Tests for larger dice (d24, etc.)
        describe("larger dice critical hits", () => {
            it("should crit on natural 24 with d24 (threat 20)", () => {
                const roller = createMockRoller(24);
                const input = {
                    attackType: "melee",
                    attackBonus: 0,
                    actionDie: "d24",
                    threatRange: 20, // Only max on d20, so only 24 on d24
                    abilityModifier: 0,
                    targetAC: 15,
                };
                const result = makeAttackRoll(input, roller);
                expect(result.roll.natural).toBe(24);
                expect(result.isHit).toBe(true); // 24 is auto-hit
                expect(result.isCriticalThreat).toBe(true); // 24 is in threat range
            });
            it("should NOT crit on natural 23 with d24 when threat is 20", () => {
                const roller = createMockRoller(23);
                const input = {
                    attackType: "melee",
                    attackBonus: 0,
                    actionDie: "d24",
                    threatRange: 20, // Only 24 crits on d24
                    abilityModifier: 0,
                    targetAC: 15,
                };
                const result = makeAttackRoll(input, roller);
                expect(result.roll.natural).toBe(23);
                expect(result.isHit).toBe(true); // 23 >= 15
                expect(result.isCriticalThreat).toBe(false); // 23 is not in threat range for threat 20
            });
            it("should crit on 23-24 with d24 when threat is 19-20", () => {
                // Warrior with 19-20 threat using d24 should crit on 23-24
                const roller23 = createMockRoller(23);
                const roller24 = createMockRoller(24);
                const input = {
                    attackType: "melee",
                    attackBonus: 0,
                    actionDie: "d24",
                    threatRange: 19, // 19-20 on d20 = 23-24 on d24
                    abilityModifier: 0,
                    targetAC: 15,
                };
                const result23 = makeAttackRoll(input, roller23);
                const result24 = makeAttackRoll(input, roller24);
                expect(result23.isCriticalThreat).toBe(true); // 23 is in range
                expect(result24.isCriticalThreat).toBe(true); // 24 is in range
            });
            it("should NOT auto-hit on 23 with d24 even if in threat range", () => {
                // 23 on d24 with threat 19-20 is a crit IF it hits
                // But 23 is NOT an auto-hit (only 24 is)
                const roller = createMockRoller(23);
                const input = {
                    attackType: "melee",
                    attackBonus: 0,
                    actionDie: "d24",
                    threatRange: 19,
                    abilityModifier: 0,
                    targetAC: 30, // Higher than 23
                };
                const result = makeAttackRoll(input, roller);
                expect(result.roll.natural).toBe(23);
                expect(result.isHit).toBe(false); // 23 < 30 AC, and 23 is NOT auto-hit
                expect(result.isCriticalThreat).toBe(false); // Can't crit on a miss
            });
            it("should auto-hit on natural 24 with d24 regardless of AC", () => {
                const roller = createMockRoller(24);
                const input = {
                    attackType: "melee",
                    attackBonus: -10,
                    actionDie: "d24",
                    threatRange: 20,
                    abilityModifier: -5,
                    targetAC: 100, // Impossibly high AC
                };
                const result = makeAttackRoll(input, roller);
                expect(result.roll.natural).toBe(24);
                expect(result.isHit).toBe(true); // Natural max always hits
                expect(result.isCriticalThreat).toBe(true);
            });
        });
    });
    describe("calculateAttackBonus", () => {
        it("should sum base attack bonus and ability modifier", () => {
            const bonus = calculateAttackBonus(3, 2);
            expect(bonus).toBe(5);
        });
        it("should handle negative modifiers", () => {
            const bonus = calculateAttackBonus(2, -1);
            expect(bonus).toBe(1);
        });
    });
    describe("doesAttackHit", () => {
        it("should return true when total >= AC", () => {
            expect(doesAttackHit(15, 15, false, false)).toBe(true);
            expect(doesAttackHit(16, 15, false, false)).toBe(true);
        });
        it("should return false when total < AC", () => {
            expect(doesAttackHit(14, 15, false, false)).toBe(false);
        });
        it("should always return false on natural 1", () => {
            expect(doesAttackHit(25, 15, true, false)).toBe(false);
        });
        it("should always return true on natural max (auto-hit)", () => {
            // isNaturalMax = true means the die rolled its maximum value
            expect(doesAttackHit(5, 15, false, true)).toBe(true);
        });
    });
    describe("getAttackAbility", () => {
        it("should return str for melee", () => {
            expect(getAttackAbility("melee")).toBe("str");
        });
        it("should return agl for missile", () => {
            expect(getAttackAbility("missile")).toBe("agl");
        });
        it("should return str for special", () => {
            expect(getAttackAbility("special")).toBe("str");
        });
    });
    describe("getTwoWeaponDice (Table 4-3)", () => {
        it("Agl 8 or less: -3/-4 dice, no crits", () => {
            const cfg = getTwoWeaponDice(8);
            expect(cfg.primaryDieReduction).toBe(3);
            expect(cfg.offHandDieReduction).toBe(4);
            expect(cfg.primaryCanCrit).toBe(false);
            expect(cfg.offHandCanCrit).toBe(false);
        });
        it("Agl 9-11: -2/-3 dice, no crits", () => {
            const cfg = getTwoWeaponDice(10);
            expect(cfg.primaryDieReduction).toBe(2);
            expect(cfg.offHandDieReduction).toBe(3);
            expect(cfg.primaryCanCrit).toBe(false);
        });
        it("Agl 12-15: -1/-2 dice, no crits", () => {
            const cfg = getTwoWeaponDice(13);
            expect(cfg.primaryDieReduction).toBe(1);
            expect(cfg.offHandDieReduction).toBe(2);
            expect(cfg.primaryCanCrit).toBe(false);
        });
        it("Agl 16-17: -1/-1 dice; primary crits on max die that beats AC (no auto-hit)", () => {
            const cfg = getTwoWeaponDice(17);
            expect(cfg.primaryDieReduction).toBe(1);
            expect(cfg.offHandDieReduction).toBe(1);
            expect(cfg.primaryCanCrit).toBe(true);
            expect(cfg.offHandCanCrit).toBe(false);
            expect(cfg.primaryCritRequiresBeatAC).toBe(true);
            expect(cfg.halflingAutoCritOnMax).toBe(false);
        });
        it("Agl 18+: 0/-1 dice; primary crits as normal", () => {
            const cfg = getTwoWeaponDice(18);
            expect(cfg.primaryDieReduction).toBe(0);
            expect(cfg.offHandDieReduction).toBe(1);
            expect(cfg.primaryCanCrit).toBe(true);
            expect(cfg.offHandCanCrit).toBe(false);
            expect(cfg.primaryCritRequiresBeatAC).toBe(false);
        });
        describe("halfling overrides", () => {
            it("clamps Agl ≤ 16 to the 16-17 row", () => {
                const cfg = getTwoWeaponDice(8, { isHalfling: true });
                expect(cfg.primaryDieReduction).toBe(1);
                expect(cfg.offHandDieReduction).toBe(1);
            });
            it("uses normal 18+ row when natural Agl ≥ 18", () => {
                const cfg = getTwoWeaponDice(18, { isHalfling: true });
                expect(cfg.primaryDieReduction).toBe(0);
                expect(cfg.offHandDieReduction).toBe(1);
            });
            it("clamped Agl: auto-crit on natural max replaces beat-AC requirement (both hands)", () => {
                const cfg = getTwoWeaponDice(12, { isHalfling: true });
                expect(cfg.halflingAutoCritOnMax).toBe(true);
                expect(cfg.primaryCritRequiresBeatAC).toBe(false);
                expect(cfg.primaryCanCrit).toBe(true);
                expect(cfg.offHandCanCrit).toBe(true);
            });
            it("always sets the both-1s fumble rule", () => {
                expect(getTwoWeaponDice(8, { isHalfling: true }).halflingFumbleRequiresBoth1s).toBe(true);
                expect(getTwoWeaponDice(20, { isHalfling: true }).halflingFumbleRequiresBoth1s).toBe(true);
            });
        });
    });
    describe("rollTwoWeaponAttack", () => {
        it("Agl 18+: primary rolls full d20, off-hand rolls d16", () => {
            const roller = createSequenceRoller([15, 12]); // primary, off-hand
            const result = rollTwoWeaponAttack({
                agility: 18,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 1, threatRange: 20, abilityModifier: 0, targetAC: 13 },
                offHand: { attackType: "melee", attackBonus: 1, threatRange: 20, abilityModifier: 0, targetAC: 13 },
            }, roller);
            expect(result.primary.roll.die).toBe("d20");
            expect(result.offHand.roll.die).toBe("d16");
            expect(result.primary.isHit).toBe(true);
            expect(result.offHand.isHit).toBe(true);
        });
        it("Agl ≤ 15: rolls cannot crit (strips crit threat)", () => {
            // Agl 13 → primary -1 (d20 → d16), off -2 (d20 → d14).
            // Roll natural max on the primary d16 — which would normally crit but should be stripped.
            const roller = createSequenceRoller([16, 1]);
            const result = rollTwoWeaponAttack({
                agility: 13,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0 },
                offHand: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0 },
            }, roller);
            expect(result.primary.roll.die).toBe("d16");
            expect(result.offHand.roll.die).toBe("d14");
            expect(result.primary.isCriticalThreat).toBe(false);
        });
        it("warriors lose improved threat range when two-weapon fighting", () => {
            // Warrior with 19-20 threat (normally crits on 19 or 20).
            // Two-weapon Agl 18+: primary still on d20, but threat range clamped to 20.
            const roller = createSequenceRoller([19, 1]);
            const result = rollTwoWeaponAttack({
                agility: 18,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 0, threatRange: 19, abilityModifier: 0, targetAC: 15 },
                offHand: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0 },
            }, roller);
            expect(result.primary.isCriticalThreat).toBe(false); // 19 no longer threats
            expect(result.primary.isHit).toBe(true); // still hits AC 15
        });
        it("Agl 16-17 non-halfling: natural max requires beating AC to crit (no auto-hit)", () => {
            // d16 natural 16: max die. With targetAC 25, total is 16 < 25 → no hit, no crit.
            const roller = createSequenceRoller([16, 1]);
            const result = rollTwoWeaponAttack({
                agility: 16,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0, targetAC: 25 },
                offHand: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0, targetAC: 25 },
            }, roller);
            expect(result.primary.roll.natural).toBe(16);
            expect(result.primary.isHit).toBe(false); // no auto-hit on natural max
            expect(result.primary.isCriticalThreat).toBe(false);
        });
        it("Agl 16-17 non-halfling: natural max that beats AC crits", () => {
            const roller = createSequenceRoller([16, 1]);
            const result = rollTwoWeaponAttack({
                agility: 17,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0, targetAC: 12 },
                offHand: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0, targetAC: 12 },
            }, roller);
            expect(result.primary.isHit).toBe(true);
            expect(result.primary.isCriticalThreat).toBe(true);
            expect(result.primary.critSource).toBe("natural-max");
        });
        it("halfling: natural max on reduced die auto-hits + auto-crits regardless of AC", () => {
            const roller = createSequenceRoller([16, 1]);
            const result = rollTwoWeaponAttack({
                agility: 12,
                isHalfling: true,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0, targetAC: 30 },
                offHand: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0, targetAC: 30 },
            }, roller);
            expect(result.primary.isHit).toBe(true);
            expect(result.primary.isCriticalThreat).toBe(true);
        });
        it("halfling: single natural 1 is NOT a fumble", () => {
            const roller = createSequenceRoller([1, 8]); // primary 1, off-hand 8
            const result = rollTwoWeaponAttack({
                agility: 14,
                isHalfling: true,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0 },
                offHand: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0 },
            }, roller);
            expect(result.primary.isFumble).toBe(false);
            expect(result.offHand.isFumble).toBe(false);
        });
        it("halfling: both natural 1s IS a fumble", () => {
            const roller = createSequenceRoller([1, 1]);
            const result = rollTwoWeaponAttack({
                agility: 14,
                isHalfling: true,
                baseActionDie: "d20",
                primary: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0 },
                offHand: { attackType: "melee", attackBonus: 0, threatRange: 20, abilityModifier: 0 },
            }, roller);
            expect(result.primary.isFumble).toBe(true);
            expect(result.offHand.isFumble).toBe(true);
        });
    });
    describe("isDeedSuccessful", () => {
        it("should return true for rolls >= 3", () => {
            expect(isDeedSuccessful(3)).toBe(true);
            expect(isDeedSuccessful(4)).toBe(true);
            expect(isDeedSuccessful(6)).toBe(true);
        });
        it("should return false for rolls < 3", () => {
            expect(isDeedSuccessful(1)).toBe(false);
            expect(isDeedSuccessful(2)).toBe(false);
        });
    });
});
// =============================================================================
// Damage Tests
// =============================================================================
describe("Damage System", () => {
    describe("rollDamage", () => {
        it("should roll basic damage", () => {
            const roller = createMockRoller(6);
            const input = {
                damageDie: "d8",
                strengthModifier: 2,
            };
            const result = rollDamage(input, roller);
            expect(result.baseDamage).toBe(6);
            expect(result.modifierDamage).toBe(2);
            expect(result.total).toBe(8);
        });
        it("should add deed die result to damage", () => {
            const roller = createMockRoller(5);
            const input = {
                damageDie: "d8",
                strengthModifier: 2,
                deedDieResult: 4,
            };
            const result = rollDamage(input, roller);
            expect(result.baseDamage).toBe(5);
            expect(result.modifierDamage).toBe(6); // 2 + 4
            expect(result.total).toBe(11);
        });
        it("should add magic bonus to damage", () => {
            const roller = createMockRoller(4);
            const input = {
                damageDie: "d6",
                strengthModifier: 1,
                magicBonus: 2,
            };
            const result = rollDamage(input, roller);
            expect(result.modifierDamage).toBe(3); // 1 + 2
            expect(result.total).toBe(7);
        });
        it("should enforce minimum 1 damage", () => {
            const roller = createMockRoller(1);
            const input = {
                damageDie: "d4",
                strengthModifier: -3,
            };
            const result = rollDamage(input, roller);
            expect(result.total).toBe(1); // Minimum 1 (1 - 3 would be -2)
        });
        it("should subtract cursed magic bonus and label breakdown 'cursed'", () => {
            const roller = createMockRoller(6);
            const input = {
                damageDie: "d8",
                strengthModifier: 1,
                magicBonus: -1,
            };
            const result = rollDamage(input, roller);
            expect(result.baseDamage).toBe(6);
            expect(result.modifierDamage).toBe(0); // 1 + (-1)
            expect(result.total).toBe(6);
            expect(result.breakdown).toEqual([
                { source: "weapon", amount: 6 },
                { source: "Strength", amount: 1 },
                { source: "cursed", amount: -1 },
            ]);
        });
        it("should still label positive magic bonus 'magic'", () => {
            const roller = createMockRoller(4);
            const input = {
                damageDie: "d6",
                strengthModifier: 0,
                magicBonus: 1,
            };
            const result = rollDamage(input, roller);
            const magicEntry = result.breakdown.find((b) => b.source === "magic");
            expect(magicEntry?.amount).toBe(1);
        });
        it("should skip magic bonus breakdown entry when zero", () => {
            const roller = createMockRoller(3);
            const input = {
                damageDie: "d6",
                strengthModifier: 0,
                magicBonus: 0,
            };
            const result = rollDamage(input, roller);
            expect(result.breakdown.some((b) => b.source === "magic" || b.source === "cursed")).toBe(false);
        });
        it("should roll extra damage dice and add a per-term breakdown entry", () => {
            // Base d8 rolls 5; extra 1d4 rolls 3.
            const roller = createSequenceRoller([5, 3]);
            const input = {
                damageDie: "d8",
                strengthModifier: 2,
                extraDamageDice: [
                    { count: 1, die: "d4", source: "magic" },
                ],
            };
            const result = rollDamage(input, roller);
            expect(result.baseDamage).toBe(5);
            expect(result.modifierDamage).toBe(5); // 2 (str) + 3 (extra)
            expect(result.total).toBe(10);
            expect(result.breakdown).toEqual([
                { source: "weapon", amount: 5 },
                { source: "Strength", amount: 2 },
                { source: "magic", amount: 3 },
            ]);
        });
        it("should label extra dice by flavor when source is absent", () => {
            // Base d6 rolls 2; extra 1d6 rolls 4.
            const roller = createSequenceRoller([2, 4]);
            const input = {
                damageDie: "d6",
                strengthModifier: 0,
                extraDamageDice: [
                    { count: 1, die: "d6", flavor: "cold" },
                ],
            };
            const result = rollDamage(input, roller);
            expect(result.breakdown).toEqual([
                { source: "weapon", amount: 2 },
                { source: "cold", amount: 4 },
            ]);
        });
        it("should fall back to 'extra' label when neither source nor flavor given", () => {
            const roller = createSequenceRoller([3, 2]);
            const input = {
                damageDie: "d4",
                strengthModifier: 0,
                extraDamageDice: [
                    { count: 1, die: "d4" },
                ],
            };
            const result = rollDamage(input, roller);
            expect(result.breakdown).toEqual([
                { source: "weapon", amount: 3 },
                { source: "extra", amount: 2 },
            ]);
        });
        it("should roll multiple extra dice terms independently", () => {
            // Base d6 rolls 3; first extra 1d6 rolls 4; second extra 1d6 rolls 1.
            const roller = createSequenceRoller([3, 4, 1]);
            const input = {
                damageDie: "d6",
                strengthModifier: 0,
                extraDamageDice: [
                    { count: 1, die: "d6", flavor: "fire" },
                    { count: 1, die: "d6", flavor: "cold" },
                ],
            };
            const result = rollDamage(input, roller);
            expect(result.total).toBe(8); // 3 + 4 + 1
            expect(result.breakdown).toEqual([
                { source: "weapon", amount: 3 },
                { source: "fire", amount: 4 },
                { source: "cold", amount: 1 },
            ]);
        });
    });
    describe("getWeaponDamage (backstab-friendly weapons)", () => {
        it("returns normal damage when isBackstab is false", () => {
            expect(getWeaponDamage(getWeapon("dagger"), false)).toEqual({
                damageDie: "d4",
                diceCount: 1,
            });
        });
        it("returns alternate damage when isBackstab is true and weapon has backstabDamage", () => {
            expect(getWeaponDamage(getWeapon("dagger"), true)).toEqual({
                damageDie: "d10",
                diceCount: 1,
            });
        });
        it("returns normal damage on backstab when weapon has no backstabDamage", () => {
            expect(getWeaponDamage(getWeapon("longsword"), true)).toEqual({
                damageDie: "d8",
                diceCount: 1,
            });
        });
        it("honors multi-dice backstab expressions", () => {
            expect(getWeaponDamage(getWeapon("blackjack"), true)).toEqual({
                damageDie: "d6",
                diceCount: 2,
            });
            expect(getWeaponDamage(getWeapon("garrote"), true)).toEqual({
                damageDie: "d4",
                diceCount: 3,
            });
        });
        it("encodes the 4 Table 3-1 backstab weapons", () => {
            expect(getWeapon("dagger").backstabDamage).toEqual({ damageDie: "d10" });
            expect(getWeapon("blackjack").backstabDamage).toEqual({
                damageDie: "d6",
                diceCount: 2,
            });
            expect(getWeapon("blowgun").backstabDamage).toEqual({ damageDie: "d5" });
            expect(getWeapon("garrote").backstabDamage).toEqual({
                damageDie: "d4",
                diceCount: 3,
            });
        });
    });
    describe("getTwoHandedDamageDie", () => {
        it("should return two-handed die when wielding two-handed", () => {
            expect(getTwoHandedDamageDie("d8", "d10", true)).toBe("d10");
        });
        it("should return base die when not wielding two-handed", () => {
            expect(getTwoHandedDamageDie("d8", "d10", false)).toBe("d8");
        });
        it("should return base die when no two-handed die specified", () => {
            expect(getTwoHandedDamageDie("d8", undefined, true)).toBe("d8");
        });
    });
    describe("buildDamageFormula", () => {
        it("should build formula with positive modifier", () => {
            const formula = buildDamageFormula("d8", 1, [
                { source: "str", value: 3 },
            ]);
            expect(formula).toBe("1d8+3");
        });
        it("should build formula with negative modifier", () => {
            const formula = buildDamageFormula("d6", 1, [
                { source: "str", value: -1 },
            ]);
            expect(formula).toBe("1d6-1");
        });
        it("should build formula without modifier when zero", () => {
            const formula = buildDamageFormula("d4", 2, []);
            expect(formula).toBe("2d4");
        });
    });
    describe("applyMinimumDamage", () => {
        it("should return damage when positive", () => {
            expect(applyMinimumDamage(5)).toBe(5);
        });
        it("should return 1 when damage is zero or negative", () => {
            expect(applyMinimumDamage(0)).toBe(1);
            expect(applyMinimumDamage(-2)).toBe(1);
        });
    });
});
// =============================================================================
// Critical Hit Tests
// =============================================================================
describe("Critical Hit System", () => {
    describe("rollCritical", () => {
        it("should roll basic crit", () => {
            const roller = createMockRoller(8);
            const input = {
                critTable: "III",
                critDie: "d12",
                luckModifier: 2,
            };
            const result = rollCritical(input, roller);
            expect(result.roll.natural).toBe(8);
            expect(result.total).toBe(10); // 8 + 2
            expect(result.critTable).toBe("III");
        });
        it("should add level to crit roll when provided", () => {
            const roller = createMockRoller(10);
            const input = {
                critTable: "III",
                critDie: "d14",
                luckModifier: 1,
                level: 3,
            };
            const result = rollCritical(input, roller);
            expect(result.total).toBe(14); // 10 + 1 + 3
        });
        it("should enforce minimum crit roll of 1", () => {
            const roller = createMockRoller(1);
            const input = {
                critTable: "II",
                critDie: "d10",
                luckModifier: -5,
            };
            const result = rollCritical(input, roller);
            expect(result.total).toBe(1); // Minimum 1
        });
    });
    describe("getCritTable / getCritDie (registry-backed)", () => {
        // Minimal synthetic progression to exercise the registry delegation.
        // Real class data lives in dcc-official-data and is registered by apps
        // at startup; tests use synthetic classes to stay hermetic.
        const TEST_CLASS = {
            classId: "test-fighter",
            name: "Test Fighter",
            skills: [],
            levels: {
                1: makeLevel({ criticalDie: "1d12", criticalTable: "III" }),
                2: makeLevel({ criticalDie: "1d14", criticalTable: "III" }),
                3: makeLevel({ criticalDie: "1d16", criticalTable: "IV" }),
                8: makeLevel({ criticalDie: "2d20", criticalTable: "V" }),
                9: makeLevel({ criticalDie: "1d30+2", criticalTable: "V" }),
            },
        };
        beforeAll(() => {
            registerClassProgression(TEST_CLASS);
        });
        afterAll(() => {
            clearClassProgressions();
        });
        it("returns the registered crit table at the requested level", () => {
            expect(getCritTable("test-fighter", 1)).toBe("III");
            expect(getCritTable("test-fighter", 3)).toBe("IV");
            expect(getCritTable("test-fighter", 8)).toBe("V");
        });
        it("returns bare dice for single-die formulas and full formulas otherwise", () => {
            expect(getCritDie("test-fighter", 1)).toBe("d12");
            expect(getCritDie("test-fighter", 8)).toBe("2d20");
            expect(getCritDie("test-fighter", 9)).toBe("1d30+2");
        });
        it("falls back to defaults when no progression is registered", () => {
            expect(getCritTable("unknown-class", 1)).toBe("I");
            expect(getCritDie("unknown-class", 1)).toBe("d4");
        });
    });
    describe("determineCritTable", () => {
        it("should use weapon table when provided", () => {
            expect(determineCritTable("wizard", "IV")).toBe("IV");
        });
        it("falls back to the registry-backed class table otherwise", () => {
            expect(determineCritTable("unknown-class")).toBe("I");
        });
    });
    describe("buildCritFormula", () => {
        it("should build formula with positive modifier", () => {
            expect(buildCritFormula("d12", 2, 3)).toBe("1d12+5");
        });
        it("should build formula with negative modifier", () => {
            expect(buildCritFormula("d10", -2)).toBe("1d10-2");
        });
    });
    describe("parseCritExtraDamage", () => {
        it("should parse extra dice", () => {
            expect(parseCritExtraDamage("+1d6 extra damage")).toEqual({ dice: "1d6" });
            expect(parseCritExtraDamage("Deal +2d8 damage")).toEqual({ dice: "2d8" });
        });
        it("should parse extra modifier", () => {
            expect(parseCritExtraDamage("+3 damage")).toEqual({ modifier: 3 });
            expect(parseCritExtraDamage("+5")).toEqual({ modifier: 5 });
        });
        it("should return undefined for no match", () => {
            expect(parseCritExtraDamage("Enemy is stunned")).toBeUndefined();
        });
    });
});
// =============================================================================
// Fumble Tests
// =============================================================================
describe("Fumble System", () => {
    describe("rollFumble", () => {
        it("should roll fumble based on armor", () => {
            const roller = createMockRoller(10);
            const input = {
                armorType: "chainmail",
                luckModifier: 2,
            };
            const result = rollFumble(input, roller);
            expect(result.roll.natural).toBe(10);
            expect(result.fumbleDie).toBe("d12"); // Chainmail uses d12
            expect(result.total).toBe(8); // 10 - 2 luck
        });
        it("should handle negative luck (worse fumbles)", () => {
            const roller = createMockRoller(5);
            const input = {
                armorType: "unarmored",
                luckModifier: -2,
            };
            const result = rollFumble(input, roller);
            expect(result.total).toBe(7); // 5 - (-2) = 5 + 2
        });
        it("should enforce minimum fumble of 0", () => {
            const roller = createMockRoller(1);
            const input = {
                armorType: "unarmored",
                luckModifier: 5,
            };
            const result = rollFumble(input, roller);
            expect(result.total).toBe(0); // 1 - 5 = -4, clamped to 0
        });
        it("should allow fumble die override", () => {
            const roller = createMockRoller(8);
            const input = {
                armorType: "unarmored", // Would normally be d4
                luckModifier: 0,
                fumbleDieOverride: "d20",
            };
            const result = rollFumble(input, roller);
            expect(result.fumbleDie).toBe("d20");
        });
    });
    describe("getFumbleDie", () => {
        it("should return correct die for each armor type", () => {
            expect(getFumbleDie("unarmored")).toBe("d4");
            expect(getFumbleDie("padded")).toBe("d8");
            expect(getFumbleDie("leather")).toBe("d8");
            expect(getFumbleDie("studded-leather")).toBe("d8");
            expect(getFumbleDie("hide")).toBe("d12");
            expect(getFumbleDie("scale")).toBe("d12");
            expect(getFumbleDie("chainmail")).toBe("d12");
            expect(getFumbleDie("banded")).toBe("d16");
            expect(getFumbleDie("half-plate")).toBe("d16");
            expect(getFumbleDie("full-plate")).toBe("d16");
        });
    });
    describe("getArmorType", () => {
        it("should detect armor types from names", () => {
            expect(getArmorType("Full Plate Mail")).toBe("full-plate");
            expect(getArmorType("Half-Plate Armor")).toBe("half-plate");
            expect(getArmorType("Chain Mail")).toBe("chainmail");
            expect(getArmorType("Chainmail")).toBe("chainmail");
            expect(getArmorType("Scale Armor")).toBe("scale");
            expect(getArmorType("Hide Armor")).toBe("hide");
            expect(getArmorType("Studded Leather Armor")).toBe("studded-leather");
            expect(getArmorType("Leather Armor")).toBe("leather");
            expect(getArmorType("Padded Armor")).toBe("padded");
            expect(getArmorType("Robes")).toBe("unarmored");
        });
    });
    describe("isFumble", () => {
        it("should return true for natural 1", () => {
            expect(isFumble(1)).toBe(true);
        });
        it("should return false for other values", () => {
            expect(isFumble(2)).toBe(false);
            expect(isFumble(20)).toBe(false);
        });
    });
    describe("buildFumbleFormula", () => {
        it("should show luck subtraction correctly", () => {
            expect(buildFumbleFormula("d4", 2)).toBe("1d4-2");
            expect(buildFumbleFormula("d12", -1)).toBe("1d12+1");
            expect(buildFumbleFormula("d8", 0)).toBe("1d8");
        });
    });
    describe("armor penalties", () => {
        it("should return correct check penalties (Table 3-3)", () => {
            expect(getArmorCheckPenalty("unarmored")).toBe(0);
            expect(getArmorCheckPenalty("padded")).toBe(0);
            expect(getArmorCheckPenalty("leather")).toBe(-1);
            expect(getArmorCheckPenalty("studded-leather")).toBe(-2);
            expect(getArmorCheckPenalty("hide")).toBe(-3);
            expect(getArmorCheckPenalty("chainmail")).toBe(-5);
            expect(getArmorCheckPenalty("full-plate")).toBe(-8);
        });
        it("should return correct speed penalties", () => {
            expect(getArmorSpeedPenalty("unarmored")).toBe(0);
            expect(getArmorSpeedPenalty("leather")).toBe(0);
            expect(getArmorSpeedPenalty("studded-leather")).toBe(0);
            expect(getArmorSpeedPenalty("chainmail")).toBe(-5);
            expect(getArmorSpeedPenalty("full-plate")).toBe(-10);
        });
    });
});
// =============================================================================
// Initiative Tests
// =============================================================================
describe("Initiative System", () => {
    describe("rollInitiative", () => {
        it("should roll basic initiative on d20", () => {
            const roller = createMockRoller(12);
            const input = {
                initiativeDie: "d20",
                agilityModifier: 2,
            };
            const result = rollInitiative(input, roller);
            expect(result.roll.natural).toBe(12);
            expect(result.total).toBe(14); // 12 + 2
        });
        it("should add warrior class level via classModifier", () => {
            const roller = createMockRoller(10);
            const input = {
                initiativeDie: "d20",
                agilityModifier: 1,
                classModifier: 3, // warrior level 3
            };
            const result = rollInitiative(input, roller);
            expect(result.total).toBe(14); // 10 + 1 + 3
        });
        it("should roll d16 when wielding a two-handed weapon", () => {
            const roller = createMockRoller(8);
            const input = {
                initiativeDie: "d16",
                agilityModifier: 2,
            };
            const result = rollInitiative(input, roller);
            expect(result.roll.natural).toBe(8);
            expect(result.total).toBe(10); // 8 + 2
        });
        it("should stack two-handed d16 with warrior class level", () => {
            const roller = createMockRoller(8);
            const input = {
                initiativeDie: "d16",
                agilityModifier: 1,
                classModifier: 5, // warrior level 5, two-handing
            };
            const result = rollInitiative(input, roller);
            expect(result.total).toBe(14); // 8 + 1 + 5
        });
    });
    describe("getInitiativeDie", () => {
        it("should return d20 by default", () => {
            expect(getInitiativeDie()).toBe("d20");
            expect(getInitiativeDie(false)).toBe("d20");
        });
        it("should return d16 when wielding a two-handed weapon", () => {
            expect(getInitiativeDie(true)).toBe("d16");
        });
    });
    describe("calculateInitiativeModifier", () => {
        it("should sum all modifiers", () => {
            expect(calculateInitiativeModifier(2)).toBe(2);
            expect(calculateInitiativeModifier(2, 1)).toBe(3);
            expect(calculateInitiativeModifier(2, 5)).toBe(7); // warrior lvl 5 + agl 2
        });
    });
    describe("buildInitiativeFormula", () => {
        it("should build formula correctly", () => {
            expect(buildInitiativeFormula("d20", 2, 1)).toBe("1d20+3");
            expect(buildInitiativeFormula("d20", -1, 0)).toBe("1d20-1");
            expect(buildInitiativeFormula("d16", 0, 0)).toBe("1d16");
        });
    });
    describe("sortByInitiative", () => {
        it("should sort highest first", () => {
            const combatants = [
                { name: "A", initiative: 10 },
                { name: "B", initiative: 15 },
                { name: "C", initiative: 5 },
            ];
            const sorted = sortByInitiative(combatants);
            expect(sorted[0]?.name).toBe("B");
            expect(sorted[1]?.name).toBe("A");
            expect(sorted[2]?.name).toBe("C");
        });
        it("should not mutate original array", () => {
            const combatants = [
                { name: "A", initiative: 10 },
                { name: "B", initiative: 15 },
            ];
            sortByInitiative(combatants);
            expect(combatants[0]?.name).toBe("A");
        });
    });
    describe("isInitiativeTied", () => {
        it("should detect tied initiatives", () => {
            const a = { roll: { formula: "1d20", die: "d20", diceCount: 1, modifiers: [] }, total: 15, modifiers: [] };
            const b = { roll: { formula: "1d20", die: "d20", diceCount: 1, modifiers: [] }, total: 15, modifiers: [] };
            const c = { roll: { formula: "1d20", die: "d20", diceCount: 1, modifiers: [] }, total: 12, modifiers: [] };
            expect(isInitiativeTied(a, b)).toBe(true);
            expect(isInitiativeTied(a, c)).toBe(false);
        });
    });
});
// =============================================================================
// Event Callback Tests
// =============================================================================
describe("Combat Events", () => {
    it("should call onAttackRoll when attack is made", () => {
        const roller = createMockRoller(15);
        const spy = { called: false };
        const events = { onAttackRoll: () => { spy.called = true; } };
        const input = {
            attackType: "melee",
            attackBonus: 2,
            actionDie: "d20",
            threatRange: 20,
            abilityModifier: 2,
        };
        makeAttackRoll(input, roller, events);
        expect(spy.called).toBe(true);
    });
    it("should call onCriticalThreat when crit is threatened", () => {
        const roller = createMockRoller(20);
        const spy = { called: false };
        const events = { onCriticalThreat: () => { spy.called = true; } };
        const input = {
            attackType: "melee",
            attackBonus: 2,
            actionDie: "d20",
            threatRange: 20,
            abilityModifier: 2,
        };
        makeAttackRoll(input, roller, events);
        expect(spy.called).toBe(true);
    });
    it("should call onFumbleRoll when fumble occurs", () => {
        const roller = createMockRoller(1);
        const spy = { called: false };
        const events = { onFumbleRoll: () => { spy.called = true; } };
        const input = {
            attackType: "melee",
            attackBonus: 2,
            actionDie: "d20",
            threatRange: 20,
            abilityModifier: 2,
        };
        makeAttackRoll(input, roller, events);
        expect(spy.called).toBe(true);
    });
    it("should call onDeedAttempt for warrior attacks", () => {
        const roller = createSequenceRoller([15, 4]);
        const spy = { called: false, success: false };
        const events = {
            onDeedAttempt: (_roll, success) => {
                spy.called = true;
                spy.success = success;
            },
        };
        const input = {
            attackType: "melee",
            attackBonus: 3,
            actionDie: "d20",
            threatRange: 19,
            abilityModifier: 2,
            deedDie: "d4",
        };
        makeAttackRoll(input, roller, events);
        expect(spy.called).toBe(true);
        expect(spy.success).toBe(true);
    });
});
//# sourceMappingURL=combat.test.js.map