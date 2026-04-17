/**
 * Combat System Tests
 *
 * Tests for attack rolls, damage, critical hits, fumbles, and initiative
 */
import { describe, it, expect } from "vitest";
import { 
// Attack
makeAttackRoll, calculateAttackBonus, doesAttackHit, getAttackAbility, getTwoWeaponPenalty, isDeedSuccessful, 
// Damage
rollDamage, getBackstabMultiplier, getTwoHandedDamageDie, buildDamageFormula, applyMinimumDamage, 
// Crits
rollCritical, determineCritTable, getCritTable, getCritDie, buildCritFormula, parseCritExtraDamage, 
// Fumbles
rollFumble, buildFumbleFormula, isFumble, getFumbleDie, getArmorType, getArmorCheckPenalty, getArmorSpeedPenalty, 
// Initiative
rollInitiative, calculateInitiativeModifier, buildInitiativeFormula, getInitiativeDie, sortByInitiative, isInitiativeTied, getTwoWeaponInitiativeBonus, } from "./index.js";
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
        it("should apply two-weapon fighting penalty", () => {
            const roller = createMockRoller(15);
            const input = {
                attackType: "melee",
                attackBonus: 3,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 2,
                twoWeaponPenalty: -2,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.totalBonus).toBe(3); // 3 + 2 - 2
            expect(result.total).toBe(18); // 15 + 3
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
    describe("getTwoWeaponPenalty", () => {
        it("should return -2 for non-halflings", () => {
            expect(getTwoWeaponPenalty(false)).toBe(-2);
        });
        it("should return -1 for halflings", () => {
            expect(getTwoWeaponPenalty(true)).toBe(-1);
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
            expect(result.multiplier).toBe(1);
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
        it("should apply backstab multiplier", () => {
            const roller = createMockRoller(4);
            const input = {
                damageDie: "d6",
                strengthModifier: 2,
                backstabMultiplier: 3,
            };
            const result = rollDamage(input, roller);
            expect(result.subtotal).toBe(6); // 4 + 2
            expect(result.multiplier).toBe(3);
            expect(result.total).toBe(18); // 6 * 3
        });
        it("should enforce minimum 1 damage", () => {
            const roller = createMockRoller(1);
            const input = {
                damageDie: "d4",
                strengthModifier: -3,
            };
            const result = rollDamage(input, roller);
            expect(result.subtotal).toBe(-2); // 1 - 3
            expect(result.total).toBe(1); // Minimum 1
        });
    });
    describe("getBackstabMultiplier", () => {
        it("should return correct multipliers by level", () => {
            expect(getBackstabMultiplier(0)).toBe(1);
            expect(getBackstabMultiplier(1)).toBe(2);
            expect(getBackstabMultiplier(2)).toBe(2);
            expect(getBackstabMultiplier(3)).toBe(3);
            expect(getBackstabMultiplier(4)).toBe(3);
            expect(getBackstabMultiplier(5)).toBe(4);
            expect(getBackstabMultiplier(6)).toBe(4);
            expect(getBackstabMultiplier(7)).toBe(5);
            expect(getBackstabMultiplier(10)).toBe(5);
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
    describe("getCritTable", () => {
        it("should return correct table for each class", () => {
            expect(getCritTable("warrior")).toBe("III");
            expect(getCritTable("dwarf")).toBe("III");
            expect(getCritTable("thief")).toBe("II");
            expect(getCritTable("elf")).toBe("II");
            expect(getCritTable("cleric")).toBe("II");
            expect(getCritTable("wizard")).toBe("I");
            expect(getCritTable("halfling")).toBe("II");
        });
        it("should default to I for unknown classes", () => {
            expect(getCritTable("unknown")).toBe("I");
        });
    });
    describe("getCritDie", () => {
        it("should return correct warrior crit die by level", () => {
            expect(getCritDie("warrior", 1)).toBe("d12");
            expect(getCritDie("warrior", 2)).toBe("d14");
            expect(getCritDie("warrior", 3)).toBe("d16");
            expect(getCritDie("warrior", 4)).toBe("d20");
        });
        it("should return correct thief crit die by level", () => {
            expect(getCritDie("thief", 1)).toBe("d10");
            expect(getCritDie("thief", 2)).toBe("d12");
            expect(getCritDie("thief", 5)).toBe("d20");
        });
        it("should return default die for other classes", () => {
            expect(getCritDie("wizard", 1)).toBe("d8");
            expect(getCritDie("cleric", 3)).toBe("d10");
        });
    });
    describe("determineCritTable", () => {
        it("should use weapon table when provided", () => {
            expect(determineCritTable("wizard", "IV")).toBe("IV");
        });
        it("should use class table when no weapon table", () => {
            expect(determineCritTable("warrior")).toBe("III");
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
        it("should return correct check penalties", () => {
            expect(getArmorCheckPenalty("unarmored")).toBe(0);
            expect(getArmorCheckPenalty("leather")).toBe(-2);
            expect(getArmorCheckPenalty("chainmail")).toBe(-5);
            expect(getArmorCheckPenalty("full-plate")).toBe(-8);
        });
        it("should return correct speed penalties", () => {
            expect(getArmorSpeedPenalty("unarmored")).toBe(0);
            expect(getArmorSpeedPenalty("leather")).toBe(0);
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
        it("should roll basic initiative", () => {
            const roller = createMockRoller(12);
            const input = {
                initiativeDie: "d16",
                agilityModifier: 2,
            };
            const result = rollInitiative(input, roller);
            expect(result.roll.natural).toBe(12);
            expect(result.total).toBe(14); // 12 + 2
        });
        it("should add class modifier", () => {
            const roller = createMockRoller(10);
            const input = {
                initiativeDie: "d16",
                agilityModifier: 1,
                classModifier: 2,
            };
            const result = rollInitiative(input, roller);
            expect(result.total).toBe(13); // 10 + 1 + 2
        });
        it("should add two-weapon bonus", () => {
            const roller = createMockRoller(8);
            const input = {
                initiativeDie: "d16",
                agilityModifier: 2,
                twoWeaponBonus: 1,
            };
            const result = rollInitiative(input, roller);
            expect(result.total).toBe(11); // 8 + 2 + 1
        });
    });
    describe("getInitiativeDie", () => {
        it("should return correct warrior initiative die by level", () => {
            expect(getInitiativeDie("warrior", 1)).toBe("d16");
            expect(getInitiativeDie("warrior", 5)).toBe("d20");
            expect(getInitiativeDie("warrior", 8)).toBe("d24");
        });
        it("should return d16 for non-warrior classes", () => {
            expect(getInitiativeDie("wizard", 5)).toBe("d16");
            expect(getInitiativeDie("thief", 10)).toBe("d16");
        });
    });
    describe("calculateInitiativeModifier", () => {
        it("should sum all modifiers", () => {
            expect(calculateInitiativeModifier(2)).toBe(2);
            expect(calculateInitiativeModifier(2, 1)).toBe(3);
            expect(calculateInitiativeModifier(2, 1, 1)).toBe(4);
        });
    });
    describe("buildInitiativeFormula", () => {
        it("should build formula correctly", () => {
            expect(buildInitiativeFormula("d16", 2, 1)).toBe("1d16+3");
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
            const a = { roll: { formula: "1d16", die: "d16", diceCount: 1, modifiers: [] }, total: 15, modifiers: [] };
            const b = { roll: { formula: "1d16", die: "d16", diceCount: 1, modifiers: [] }, total: 15, modifiers: [] };
            const c = { roll: { formula: "1d16", die: "d16", diceCount: 1, modifiers: [] }, total: 12, modifiers: [] };
            expect(isInitiativeTied(a, b)).toBe(true);
            expect(isInitiativeTied(a, c)).toBe(false);
        });
    });
    describe("getTwoWeaponInitiativeBonus", () => {
        it("should return +1 for halflings with two weapons", () => {
            expect(getTwoWeaponInitiativeBonus(true, true)).toBe(1);
        });
        it("should return 0 for non-halflings", () => {
            expect(getTwoWeaponInitiativeBonus(false, true)).toBe(0);
        });
        it("should return 0 when not two-weapon fighting", () => {
            expect(getTwoWeaponInitiativeBonus(true, false)).toBe(0);
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