/**
 * Tests for Miscellaneous Combat Rules
 */
import { describe, it, expect } from "vitest";
import { 
// Ability loss
getAbilityLossEffect, checkAbilityLoss, 
// Fire
createOnFireState, processFireRound, 
// Charge
getChargeModifiers, isValidCharge, 
// Torch
checkDroppedTorch, 
// Falling
calculateFallingDamage, formatFallingDamage, 
// Firing into melee
checkFiringIntoMelee, 
// Grappling
getGrappleSizeBonus, getGrappleModifier, resolveGrapple, formatGrappleResult, 
// Equipment recovery
checkArmorRecovery, checkMissileRecovery, 
// Subdual
canDealSubdualDamage, rollSubdualDamage, rollUnarmedDamage, SUBDUAL_CAPABLE_WEAPONS, 
// Melee against grappled
checkMeleeAgainstGrappled, 
// Withdrawal
processWithdrawal, isEngagedInMelee, formatWithdrawalResult, 
// Mounted combat
createMountState, getMountedCombatBonuses, getMountedInitiativeModifier, checkHorseSpooked, checkHorseAttackSpook, makeStayMountedCheck, isLanceOrSpear, getMountedChargeDamageMultiplier, formatStayMountedResult, formatMountedBonuses, } from "./misc-rules.js";
// =============================================================================
// Test Helpers
// =============================================================================
function createMockRoller(value) {
    return () => value;
}
function createSequenceRoller(values) {
    let index = 0;
    return () => {
        const value = values[index] ?? 10;
        index = (index + 1) % values.length;
        return value;
    };
}
// =============================================================================
// Ability Loss Tests
// =============================================================================
describe("Ability Loss", () => {
    describe("getAbilityLossEffect", () => {
        it("should return babbling idiot effect for 0 Personality", () => {
            const result = getAbilityLossEffect("per");
            expect(result.effect).toBe("babbling-idiot");
            expect(result.incapacitated).toBe(true);
            expect(result.description).toContain("communication");
        });
        it("should return babbling idiot effect for 0 Intelligence", () => {
            const result = getAbilityLossEffect("int");
            expect(result.effect).toBe("babbling-idiot");
            expect(result.incapacitated).toBe(true);
            expect(result.description).toContain("feeding");
        });
        it("should return immobile effect for 0 Strength", () => {
            const result = getAbilityLossEffect("str");
            expect(result.effect).toBe("immobile");
            expect(result.incapacitated).toBe(true);
            expect(result.description).toContain("movement");
        });
        it("should return immobile effect for 0 Agility", () => {
            const result = getAbilityLossEffect("agl");
            expect(result.effect).toBe("immobile");
            expect(result.incapacitated).toBe(true);
            expect(result.description).toContain("coordination");
        });
        it("should return unconscious effect for 0 Stamina", () => {
            const result = getAbilityLossEffect("sta");
            expect(result.effect).toBe("unconscious");
            expect(result.incapacitated).toBe(true);
            expect(result.description).toContain("unconscious");
        });
        it("should return constant mishaps effect for 0 Luck", () => {
            const result = getAbilityLossEffect("lck");
            expect(result.effect).toBe("constant-mishaps");
            expect(result.incapacitated).toBe(true);
            expect(result.description).toContain("mishaps");
        });
    });
    describe("checkAbilityLoss", () => {
        it("should return empty array when no abilities at 0", () => {
            const abilities = { str: 10, agl: 12, sta: 14, per: 8, int: 11, lck: 9 };
            const result = checkAbilityLoss(abilities);
            expect(result).toHaveLength(0);
        });
        it("should detect single ability at 0", () => {
            const abilities = { str: 0, agl: 12, sta: 14, per: 8, int: 11, lck: 9 };
            const result = checkAbilityLoss(abilities);
            expect(result).toHaveLength(1);
            expect(result[0]?.ability).toBe("str");
            expect(result[0]?.effect).toBe("immobile");
        });
        it("should detect multiple abilities at 0", () => {
            const abilities = { str: 0, agl: 0, sta: 14, per: 8, int: 11, lck: 9 };
            const result = checkAbilityLoss(abilities);
            expect(result).toHaveLength(2);
        });
        it("should treat negative values as 0", () => {
            const abilities = { str: -2, agl: 12, sta: 14, per: 8, int: 11, lck: 9 };
            const result = checkAbilityLoss(abilities);
            expect(result).toHaveLength(1);
        });
    });
});
// =============================================================================
// Catching Fire Tests
// =============================================================================
describe("Catching Fire", () => {
    describe("createOnFireState", () => {
        it("should create default fire state", () => {
            const state = createOnFireState();
            expect(state.damageDie).toBe("1d6");
            expect(state.extinguishDC).toBe(10);
            expect(state.roundsOnFire).toBe(0);
        });
        it("should allow custom fire parameters", () => {
            const state = createOnFireState({
                damageDie: "2d6",
                extinguishDC: 15,
                source: "dragon breath",
            });
            expect(state.damageDie).toBe("2d6");
            expect(state.extinguishDC).toBe(15);
            expect(state.source).toBe("dragon breath");
        });
    });
    describe("processFireRound", () => {
        it("should deal fire damage each round", () => {
            const state = createOnFireState();
            const roller = createMockRoller(4);
            const result = processFireRound(state, false, 0, roller);
            expect(result.damage).toBe(4);
            expect(result.attemptedExtinguish).toBe(false);
            expect(result.extinguished).toBe(false);
            expect(result.newState?.roundsOnFire).toBe(1);
        });
        it("should allow extinguishing with successful Reflex save", () => {
            const state = createOnFireState();
            const roller = createSequenceRoller([3, 12]); // 3 damage, then 12 reflex roll
            const result = processFireRound(state, true, 0, roller);
            expect(result.damage).toBe(3);
            expect(result.attemptedExtinguish).toBe(true);
            expect(result.reflexRoll).toBe(12);
            expect(result.extinguished).toBe(true);
            expect(result.newState).toBeUndefined();
        });
        it("should fail to extinguish with low roll", () => {
            const state = createOnFireState();
            const roller = createSequenceRoller([4, 5]); // 4 damage, then 5 reflex roll
            const result = processFireRound(state, true, 2, roller);
            expect(result.attemptedExtinguish).toBe(true);
            expect(result.reflexRoll).toBe(5);
            expect(result.extinguished).toBe(false); // 5 + 2 = 7 < DC 10
            expect(result.newState).toBeDefined();
        });
        it("should respect custom extinguish DC", () => {
            const state = createOnFireState({ extinguishDC: 15 });
            const roller = createSequenceRoller([2, 12]); // 2 damage, 12 reflex
            const result = processFireRound(state, true, 2, roller);
            expect(result.extinguished).toBe(false); // 12 + 2 = 14 < DC 15
        });
    });
});
// =============================================================================
// Charge Tests
// =============================================================================
describe("Charge", () => {
    describe("getChargeModifiers", () => {
        it("should return +2 attack and -2 AC", () => {
            const mods = getChargeModifiers(30);
            expect(mods.attackBonus).toBe(2);
            expect(mods.acPenalty).toBe(-2);
        });
        it("should calculate minimum distance as half speed", () => {
            expect(getChargeModifiers(30).minDistance).toBe(15);
            expect(getChargeModifiers(40).minDistance).toBe(20);
            expect(getChargeModifiers(25).minDistance).toBe(12);
        });
    });
    describe("isValidCharge", () => {
        it("should validate charge with sufficient movement", () => {
            expect(isValidCharge(15, 30)).toBe(true);
            expect(isValidCharge(20, 30)).toBe(true);
        });
        it("should invalidate charge with insufficient movement", () => {
            expect(isValidCharge(10, 30)).toBe(false);
            expect(isValidCharge(14, 30)).toBe(false);
        });
    });
});
// =============================================================================
// Dropping Torch Tests
// =============================================================================
describe("Dropping Torch", () => {
    it("should extinguish torch 50% of the time", () => {
        const roller1 = createMockRoller(25);
        const result1 = checkDroppedTorch(roller1);
        expect(result1.extinguished).toBe(true);
        expect(result1.roll).toBe(25);
        const roller2 = createMockRoller(75);
        const result2 = checkDroppedTorch(roller2);
        expect(result2.extinguished).toBe(false);
        expect(result2.roll).toBe(75);
    });
    it("should extinguish at exactly 50", () => {
        const roller = createMockRoller(50);
        const result = checkDroppedTorch(roller);
        expect(result.extinguished).toBe(true);
    });
    it("should not extinguish at 51", () => {
        const roller = createMockRoller(51);
        const result = checkDroppedTorch(roller);
        expect(result.extinguished).toBe(false);
    });
});
// =============================================================================
// Falling Damage Tests
// =============================================================================
describe("Falling Damage", () => {
    describe("calculateFallingDamage", () => {
        it("should deal no damage for falls under 10 feet", () => {
            const result = calculateFallingDamage(5);
            expect(result.damage).toBe(0);
            expect(result.brokenBones).toBe(0);
        });
        it("should deal 1d6 per 10 feet fallen", () => {
            const roller = createMockRoller(4);
            const result = calculateFallingDamage(30, roller);
            expect(result.diceResults).toHaveLength(3);
            expect(result.damage).toBe(12); // 3 * 4
        });
        it("should count broken bones on rolls of 6", () => {
            const roller = createSequenceRoller([3, 6, 6, 4]);
            const result = calculateFallingDamage(40, roller);
            expect(result.brokenBones).toBe(2);
            expect(result.permanentLoss).toBe(2);
        });
        it("should handle partial 10-foot increments", () => {
            const roller = createMockRoller(5);
            const result = calculateFallingDamage(25, roller);
            expect(result.diceResults).toHaveLength(2); // 25/10 = 2
        });
    });
    describe("formatFallingDamage", () => {
        it("should format no-damage falls", () => {
            const result = calculateFallingDamage(5);
            const text = formatFallingDamage(result);
            expect(text).toContain("No falling damage");
        });
        it("should format damage without broken bones", () => {
            const roller = createMockRoller(4);
            const result = calculateFallingDamage(20, roller);
            const text = formatFallingDamage(result);
            expect(text).toContain("20'");
            expect(text).toContain("8 damage");
            expect(text).not.toContain("broken");
        });
        it("should format damage with broken bones", () => {
            const roller = createSequenceRoller([6, 6]);
            const result = calculateFallingDamage(20, roller);
            const text = formatFallingDamage(result);
            expect(text).toContain("2 broken bones");
            expect(text).toContain("STR or AGL");
        });
    });
});
// =============================================================================
// Firing Into Melee Tests
// =============================================================================
describe("Firing Into Melee", () => {
    it("should not hit ally if roll is over 50", () => {
        const roller = createMockRoller(75);
        const result = checkFiringIntoMelee(2, [12, 14], 3, roller);
        expect(result.hitAlly).toBe(false);
        expect(result.chanceRoll).toBe(75);
    });
    it("should potentially hit ally if roll is 50 or under", () => {
        const roller = createSequenceRoller([25, 1, 15]); // 25% chance, ally 1, attack 15
        const result = checkFiringIntoMelee(2, [12, 14], 3, roller);
        expect(result.hitAlly).toBe(true);
        expect(result.allyIndex).toBe(0);
        expect(result.allyAttackRoll).toBe(18); // 15 + 3
    });
    it("should determine if ally is actually hit based on AC", () => {
        // Low attack roll - miss ally
        const roller1 = createSequenceRoller([25, 1, 5]); // chance, ally, attack
        const result1 = checkFiringIntoMelee(2, [12, 14], 2, roller1);
        expect(result1.allyWasHit).toBe(false); // 5 + 2 = 7 < 12
        // High attack roll - hit ally
        const roller2 = createSequenceRoller([25, 1, 15]); // chance, ally, attack
        const result2 = checkFiringIntoMelee(2, [12, 14], 2, roller2);
        expect(result2.allyWasHit).toBe(true); // 15 + 2 = 17 >= 12
    });
    it("should return no hit if no allies in melee", () => {
        const result = checkFiringIntoMelee(0, [], 3);
        expect(result.hitAlly).toBe(false);
    });
});
// =============================================================================
// Grappling Tests
// =============================================================================
describe("Grappling", () => {
    describe("getGrappleSizeBonus", () => {
        it("should return 0 for equal sizes", () => {
            expect(getGrappleSizeBonus(2, 2)).toBe(0);
        });
        it("should return +4 for double size", () => {
            expect(getGrappleSizeBonus(4, 2)).toBe(4);
        });
        it("should return +8 for triple size", () => {
            expect(getGrappleSizeBonus(6, 2)).toBe(8);
        });
        it("should return +16 for quadruple size or more", () => {
            expect(getGrappleSizeBonus(8, 2)).toBe(16);
            expect(getGrappleSizeBonus(16, 2)).toBe(16);
        });
        it("should return 0 for smaller attacker", () => {
            expect(getGrappleSizeBonus(1, 2)).toBe(0);
        });
    });
    describe("getGrappleModifier", () => {
        it("should use higher of STR or AGL for characters", () => {
            expect(getGrappleModifier({ attackBonus: 0, strengthMod: 3, agilityMod: 1, sizeCategory: 2 })).toBe(3);
            expect(getGrappleModifier({ attackBonus: 0, strengthMod: 1, agilityMod: 4, sizeCategory: 2 })).toBe(4);
        });
        it("should use hit dice for monsters", () => {
            expect(getGrappleModifier({ attackBonus: 0, strengthMod: 3, agilityMod: 1, sizeCategory: 2, hitDice: 8 })).toBe(8);
        });
    });
    describe("resolveGrapple", () => {
        it("should resolve in favor of higher total", () => {
            const attacker = { attackBonus: 2, strengthMod: 3, agilityMod: 1, sizeCategory: 2 };
            const defender = { attackBonus: 1, strengthMod: 1, agilityMod: 2, sizeCategory: 2 };
            const roller = createSequenceRoller([15, 10]); // attacker 15, defender 10
            const result = resolveGrapple(attacker, defender, roller);
            // Attacker: 15 + 2 + 3 = 20, Defender: 10 + 1 + 2 = 13
            expect(result.attackerTotal).toBe(20);
            expect(result.defenderTotal).toBe(13);
            expect(result.attackerWins).toBe(true);
            expect(result.targetPinned).toBe(true);
        });
        it("should apply size bonus", () => {
            const attacker = { attackBonus: 0, strengthMod: 2, agilityMod: 0, sizeCategory: 4 }; // Large
            const defender = { attackBonus: 0, strengthMod: 2, agilityMod: 0, sizeCategory: 2 }; // Medium
            const roller = createSequenceRoller([10, 10]); // Equal rolls
            const result = resolveGrapple(attacker, defender, roller);
            // Attacker: 10 + 0 + 2 + 4 = 16, Defender: 10 + 0 + 2 = 12
            expect(result.attackerTotal).toBe(16);
            expect(result.defenderTotal).toBe(12);
            expect(result.attackerWins).toBe(true);
        });
        it("should allow defender to win", () => {
            const attacker = { attackBonus: 1, strengthMod: 1, agilityMod: 0, sizeCategory: 2 };
            const defender = { attackBonus: 3, strengthMod: 4, agilityMod: 2, sizeCategory: 2 };
            const roller = createSequenceRoller([8, 15]); // attacker low, defender high
            const result = resolveGrapple(attacker, defender, roller);
            expect(result.attackerWins).toBe(false);
            expect(result.targetPinned).toBe(false);
        });
    });
    describe("formatGrappleResult", () => {
        it("should format successful grapple", () => {
            const result = {
                attackerRoll: 15,
                attackerTotal: 20,
                defenderRoll: 10,
                defenderTotal: 13,
                attackerWins: true,
                targetPinned: true,
                modifiers: [],
            };
            const text = formatGrappleResult(result, "Ogre", "Fighter");
            expect(text).toContain("Ogre");
            expect(text).toContain("Fighter");
            expect(text).toContain("pins");
            expect(text).toContain("20");
            expect(text).toContain("13");
        });
        it("should format failed grapple", () => {
            const result = {
                attackerRoll: 8,
                attackerTotal: 12,
                defenderRoll: 15,
                defenderTotal: 18,
                attackerWins: false,
                targetPinned: false,
                modifiers: [],
            };
            const text = formatGrappleResult(result, "Thief", "Guard");
            expect(text).toContain("resists");
        });
    });
});
// =============================================================================
// Equipment Recovery Tests
// =============================================================================
describe("Equipment Recovery", () => {
    describe("checkArmorRecovery", () => {
        it("should mark armor usable 75% of the time", () => {
            const roller1 = createMockRoller(30);
            const result1 = checkArmorRecovery(false, roller1);
            expect(result1.usable).toBe(true);
            const roller2 = createMockRoller(20);
            const result2 = checkArmorRecovery(false, roller2);
            expect(result2.usable).toBe(false);
        });
        it("should check human-sized when requested", () => {
            const roller = createSequenceRoller([50, 60]); // Usable, human-sized
            const result = checkArmorRecovery(true, roller);
            expect(result.usable).toBe(true);
            expect(result.humanSized).toBe(true);
        });
        it("should mark non-human sized 25% of time", () => {
            const roller = createSequenceRoller([50, 90]); // Usable, not human-sized
            const result = checkArmorRecovery(true, roller);
            expect(result.humanSized).toBe(false);
        });
    });
    describe("checkMissileRecovery", () => {
        it("should recover some missiles", () => {
            const roller = createSequenceRoller([30, 70, 40, 80]); // destroyed, recovered, destroyed, recovered
            const result = checkMissileRecovery(4, roller);
            expect(result.recovered).toBe(2);
            expect(result.destroyed).toBe(2);
        });
        it("should track individual roll results", () => {
            const roller = createSequenceRoller([25, 75]);
            const result = checkMissileRecovery(2, roller);
            expect(result.rolls).toHaveLength(2);
            expect(result.rolls[0]?.destroyed).toBe(true);
            expect(result.rolls[1]?.destroyed).toBe(false);
        });
    });
});
// =============================================================================
// Subdual Damage Tests
// =============================================================================
describe("Subdual Damage", () => {
    describe("canDealSubdualDamage", () => {
        it("should allow subdual with proper weapons", () => {
            expect(canDealSubdualDamage("longsword")).toBe(true);
            expect(canDealSubdualDamage("battle axe")).toBe(true);
            expect(canDealSubdualDamage("club")).toBe(true);
            expect(canDealSubdualDamage("spear")).toBe(true);
            expect(canDealSubdualDamage("staff")).toBe(true);
        });
        it("should not allow subdual with improper weapons", () => {
            expect(canDealSubdualDamage("dagger")).toBe(false);
            expect(canDealSubdualDamage("crossbow")).toBe(false);
            expect(canDealSubdualDamage("flail")).toBe(false);
        });
        it("should be case insensitive", () => {
            expect(canDealSubdualDamage("LONGSWORD")).toBe(true);
            expect(canDealSubdualDamage("Battle Axe")).toBe(true);
        });
    });
    describe("rollSubdualDamage", () => {
        it("should step down the damage die", () => {
            const roller = createMockRoller(4);
            const result = rollSubdualDamage("1d8", 2, roller);
            expect(result.originalDie).toBe("1d8");
            expect(result.damageDie).toBe("1d7"); // DCC dice chain: d8 -> d7
            expect(result.isSubdual).toBe(true);
        });
        it("should add strength modifier", () => {
            const roller = createMockRoller(3);
            const result = rollSubdualDamage("1d8", 3, roller);
            expect(result.damage).toBe(6); // 3 + 3
        });
        it("should enforce minimum 1 damage", () => {
            const roller = createMockRoller(1);
            const result = rollSubdualDamage("1d4", -5, roller);
            expect(result.damage).toBe(1);
        });
    });
    describe("rollUnarmedDamage", () => {
        it("should deal 1d3 + STR subdual damage", () => {
            const roller = createMockRoller(2);
            const result = rollUnarmedDamage(3, roller);
            expect(result.damageDie).toBe("1d3");
            expect(result.damage).toBe(5); // 2 + 3
            expect(result.isSubdual).toBe(true);
        });
        it("should enforce minimum 1 damage", () => {
            const roller = createMockRoller(1);
            const result = rollUnarmedDamage(-5, roller);
            expect(result.damage).toBe(1);
        });
    });
    describe("SUBDUAL_CAPABLE_WEAPONS", () => {
        it("should include all specified weapon types", () => {
            expect(SUBDUAL_CAPABLE_WEAPONS).toContain("sword");
            expect(SUBDUAL_CAPABLE_WEAPONS).toContain("axe");
            expect(SUBDUAL_CAPABLE_WEAPONS).toContain("club");
            expect(SUBDUAL_CAPABLE_WEAPONS).toContain("spear");
            expect(SUBDUAL_CAPABLE_WEAPONS).toContain("staff");
        });
    });
});
// =============================================================================
// Melee Against Grappled Tests
// =============================================================================
describe("Melee Against Grappled", () => {
    it("should have 50% chance to hit grappler on miss", () => {
        const roller1 = createMockRoller(30);
        const result1 = checkMeleeAgainstGrappled(14, 3, roller1);
        expect(result1.hitAlly).toBe(true);
        const roller2 = createMockRoller(70);
        const result2 = checkMeleeAgainstGrappled(14, 3, roller2);
        expect(result2.hitAlly).toBe(false);
    });
    it("should re-roll attack against grappler AC", () => {
        const roller = createSequenceRoller([25, 18]); // chance roll, attack roll
        const result = checkMeleeAgainstGrappled(15, 2, roller);
        expect(result.hitAlly).toBe(true);
        expect(result.allyAttackRoll).toBe(20); // 18 + 2
        expect(result.allyWasHit).toBe(true); // 20 >= 15
    });
});
// =============================================================================
// Withdrawal Tests
// =============================================================================
describe("Withdrawal", () => {
    describe("isEngagedInMelee", () => {
        it("should return true when enemies are adjacent", () => {
            expect(isEngagedInMelee(1)).toBe(true);
            expect(isEngagedInMelee(3)).toBe(true);
        });
        it("should return false when no enemies adjacent", () => {
            expect(isEngagedInMelee(0)).toBe(false);
        });
    });
    describe("processWithdrawal", () => {
        it("should give each opponent a free attack", () => {
            const opponents = [
                { name: "Goblin 1", attackBonus: 2, damageDie: "1d6", strengthMod: 0 },
                { name: "Goblin 2", attackBonus: 2, damageDie: "1d6", strengthMod: 0 },
            ];
            const roller = createSequenceRoller([15, 4, 8, 3]); // attacks: 15 hit, 8 miss; damage: 4
            const result = processWithdrawal(14, opponents, roller);
            expect(result.numOpponents).toBe(2);
            expect(result.attacks).toHaveLength(2);
            expect(result.attacks[0]?.hit).toBe(true); // 15 + 2 = 17 >= 14
            expect(result.attacks[0]?.damage).toBe(4);
            expect(result.attacks[1]?.hit).toBe(false); // 8 + 2 = 10 < 14
        });
        it("should calculate total damage from all hits", () => {
            const opponents = [
                { name: "Orc 1", attackBonus: 3, damageDie: "1d8", strengthMod: 2 },
                { name: "Orc 2", attackBonus: 3, damageDie: "1d8", strengthMod: 2 },
            ];
            const roller = createSequenceRoller([18, 5, 15, 6]); // Both hit: 18+3=21, 15+3=18; damage: 5+2=7, 6+2=8
            const result = processWithdrawal(15, opponents, roller);
            expect(result.attacks[0]?.damage).toBe(7);
            expect(result.attacks[1]?.damage).toBe(8);
            expect(result.totalDamage).toBe(15);
        });
        it("should return no attacks if no opponents", () => {
            const result = processWithdrawal(14, []);
            expect(result.numOpponents).toBe(0);
            expect(result.attacks).toHaveLength(0);
            expect(result.totalDamage).toBe(0);
        });
        it("should handle single opponent", () => {
            const opponents = [
                { name: "Troll", attackBonus: 6, damageDie: "2d6", strengthMod: 4 },
            ];
            const roller = createSequenceRoller([12, 8]); // Attack 12+6=18, damage 8+4=12
            const result = processWithdrawal(16, opponents, roller);
            expect(result.numOpponents).toBe(1);
            expect(result.attacks[0]?.hit).toBe(true);
            expect(result.attacks[0]?.damage).toBe(12);
            expect(result.totalDamage).toBe(12);
        });
    });
    describe("formatWithdrawalResult", () => {
        it("should format safe withdrawal", () => {
            const result = { numOpponents: 0, attacks: [], totalDamage: 0 };
            const text = formatWithdrawalResult(result);
            expect(text).toContain("safely");
            expect(text).toContain("not engaged");
        });
        it("should format single opponent withdrawal", () => {
            const result = {
                numOpponents: 1,
                attacks: [{
                        opponentName: "Goblin",
                        attackRoll: 15,
                        attackTotal: 17,
                        hit: true,
                        damage: 4,
                    }],
                totalDamage: 4,
            };
            const text = formatWithdrawalResult(result);
            expect(text).toContain("1 attack of opportunity");
            expect(text).toContain("Goblin");
            expect(text).toContain("HIT");
            expect(text).toContain("4 damage");
        });
        it("should format multiple opponents withdrawal", () => {
            const result = {
                numOpponents: 2,
                attacks: [
                    { opponentName: "Orc 1", attackRoll: 18, attackTotal: 21, hit: true, damage: 7 },
                    { opponentName: "Orc 2", attackRoll: 8, attackTotal: 11, hit: false },
                ],
                totalDamage: 7,
            };
            const text = formatWithdrawalResult(result);
            expect(text).toContain("2 attacks of opportunity");
            expect(text).toContain("Orc 1");
            expect(text).toContain("HIT");
            expect(text).toContain("Orc 2");
            expect(text).toContain("miss");
            expect(text).toContain("Total damage: 7");
        });
    });
});
// =============================================================================
// Mounted Combat Tests
// =============================================================================
describe("Mounted Combat", () => {
    describe("createMountState", () => {
        it("should create warhorse with combat stats", () => {
            const mount = createMountState("warhorse", 20);
            expect(mount.horseType).toBe("warhorse");
            expect(mount.combatTrained).toBe(true);
            expect(mount.currentHP).toBe(20);
            expect(mount.maxHP).toBe(20);
            expect(mount.halfHPChecked).toBe(false);
            expect(mount.speed).toBe(50);
            expect(mount.ac).toBe(13);
            expect(mount.attackBonus).toBe(2);
            expect(mount.damageDie).toBe("1d6");
        });
        it("should create riding horse without combat stats", () => {
            const mount = createMountState("riding-horse", 12);
            expect(mount.horseType).toBe("riding-horse");
            expect(mount.combatTrained).toBe(false);
            expect(mount.speed).toBe(60);
            expect(mount.ac).toBe(12);
            expect(mount.attackBonus).toBeUndefined();
            expect(mount.damageDie).toBeUndefined();
        });
        it("should allow custom stat overrides", () => {
            const mount = createMountState("warhorse", 25, {
                speed: 55,
                ac: 14,
                attackBonus: 4,
                damageDie: "1d8",
            });
            expect(mount.speed).toBe(55);
            expect(mount.ac).toBe(14);
            expect(mount.attackBonus).toBe(4);
            expect(mount.damageDie).toBe("1d8");
        });
    });
    describe("getMountedCombatBonuses", () => {
        it("should return standard mounted bonuses", () => {
            const bonuses = getMountedCombatBonuses();
            expect(bonuses.acBonus).toBe(1);
            expect(bonuses.attackBonusVsUnmounted).toBe(1);
            expect(bonuses.lanceDamageDoubled).toBe(false);
        });
        it("should double lance damage when charging with lance", () => {
            const bonuses = getMountedCombatBonuses(true, true);
            expect(bonuses.lanceDamageDoubled).toBe(true);
        });
        it("should not double damage without lance", () => {
            const bonuses = getMountedCombatBonuses(true, false);
            expect(bonuses.lanceDamageDoubled).toBe(false);
        });
        it("should not double damage without charging", () => {
            const bonuses = getMountedCombatBonuses(false, true);
            expect(bonuses.lanceDamageDoubled).toBe(false);
        });
    });
    describe("getMountedInitiativeModifier", () => {
        it("should use worse of rider and mount initiative", () => {
            expect(getMountedInitiativeModifier(2, 0)).toBe(0);
            expect(getMountedInitiativeModifier(-1, 1)).toBe(-1);
            expect(getMountedInitiativeModifier(3, 3)).toBe(3);
            expect(getMountedInitiativeModifier(0, -2)).toBe(-2);
        });
    });
    describe("checkHorseSpooked", () => {
        it("should spook normal horse on any damage", () => {
            const mount = createMountState("riding-horse", 12);
            const { result, newState } = checkHorseSpooked(mount, 3);
            expect(result.spooked).toBe(true);
            expect(result.requiresStayMountedCheck).toBe(true);
            expect(result.reason).toContain("non-warhorse");
            expect(newState.currentHP).toBe(9);
        });
        it("should not spook normal horse with no damage", () => {
            const mount = createMountState("riding-horse", 12);
            const { result } = checkHorseSpooked(mount, 0);
            expect(result.spooked).toBe(false);
            expect(result.requiresStayMountedCheck).toBe(false);
        });
        it("should only spook warhorse at half HP", () => {
            const mount = createMountState("warhorse", 20);
            // Light wound - no spook
            const { result: result1, newState: state1 } = checkHorseSpooked(mount, 5);
            expect(result1.spooked).toBe(false);
            expect(state1.currentHP).toBe(15);
            // Crossing half HP threshold - spooked!
            const { result: result2, newState: state2 } = checkHorseSpooked(state1, 6);
            expect(result2.spooked).toBe(true);
            expect(result2.reason).toContain("below half HP");
            expect(state2.halfHPChecked).toBe(true);
            expect(state2.currentHP).toBe(9);
            // Further damage - no spook (already checked)
            const { result: result3 } = checkHorseSpooked(state2, 3);
            expect(result3.spooked).toBe(false);
            expect(result3.reason).toContain("already checked");
        });
    });
    describe("checkHorseAttackSpook", () => {
        it("should not spook combat-trained horse", () => {
            const mount = createMountState("warhorse", 20);
            const result = checkHorseAttackSpook(mount);
            expect(result.spooked).toBe(false);
            expect(result.requiresStayMountedCheck).toBe(false);
        });
        it("should spook untrained horse when attacking", () => {
            const mount = createMountState("riding-horse", 12);
            const result = checkHorseAttackSpook(mount);
            expect(result.spooked).toBe(true);
            expect(result.requiresStayMountedCheck).toBe(true);
        });
    });
    describe("makeStayMountedCheck", () => {
        it("should use d20 for trained riders", () => {
            const roller = createMockRoller(15);
            const result = makeStayMountedCheck(12, true, "horse spooked", 10, roller);
            expect(result.dieUsed).toBe("1d20");
            expect(result.roll).toBe(16); // 15 + 1 (AGL mod for 12)
            expect(result.stayedMounted).toBe(true);
            expect(result.isProne).toBe(false);
        });
        it("should use d10 for untrained riders", () => {
            const roller = createMockRoller(8);
            const result = makeStayMountedCheck(10, false, "horse wounded", 10, roller);
            expect(result.dieUsed).toBe("1d10");
            expect(result.roll).toBe(8); // 8 + 0 (AGL mod for 10)
            expect(result.stayedMounted).toBe(false);
            expect(result.isProne).toBe(true);
        });
        it("should apply Agility modifier", () => {
            const roller = createMockRoller(7);
            const result = makeStayMountedCheck(16, true, "test", 10, roller);
            // 16 AGL = +3 modifier
            expect(result.roll).toBe(10); // 7 + 3
            expect(result.stayedMounted).toBe(true);
        });
        it("should handle negative Agility modifier", () => {
            const roller = createMockRoller(10);
            const result = makeStayMountedCheck(6, true, "test", 10, roller);
            // 6 AGL = -2 modifier
            expect(result.roll).toBe(8); // 10 - 2
            expect(result.stayedMounted).toBe(false);
        });
    });
    describe("isLanceOrSpear", () => {
        it("should identify lance weapons", () => {
            expect(isLanceOrSpear("lance")).toBe(true);
            expect(isLanceOrSpear("heavy lance")).toBe(true);
            expect(isLanceOrSpear("jousting lance")).toBe(true);
        });
        it("should identify spear weapons", () => {
            expect(isLanceOrSpear("spear")).toBe(true);
            expect(isLanceOrSpear("long spear")).toBe(true);
            expect(isLanceOrSpear("boar spear")).toBe(true);
        });
        it("should identify javelin", () => {
            expect(isLanceOrSpear("javelin")).toBe(true);
        });
        it("should not match other weapons", () => {
            expect(isLanceOrSpear("sword")).toBe(false);
            expect(isLanceOrSpear("longsword")).toBe(false);
            expect(isLanceOrSpear("axe")).toBe(false);
        });
    });
    describe("getMountedChargeDamageMultiplier", () => {
        it("should double damage for lance charge", () => {
            expect(getMountedChargeDamageMultiplier(true, "lance")).toBe(2);
            expect(getMountedChargeDamageMultiplier(true, "spear")).toBe(2);
        });
        it("should not double without charge", () => {
            expect(getMountedChargeDamageMultiplier(false, "lance")).toBe(1);
        });
        it("should not double without lance/spear", () => {
            expect(getMountedChargeDamageMultiplier(true, "sword")).toBe(1);
        });
    });
    describe("formatStayMountedResult", () => {
        it("should format successful trained check", () => {
            const result = {
                dieUsed: "1d20",
                roll: 15,
                dc: 10,
                stayedMounted: true,
                isProne: false,
                reason: "horse spooked",
            };
            const text = formatStayMountedResult(result);
            expect(text).toContain("trained");
            expect(text).toContain("STAYS MOUNTED");
            expect(text).toContain("15");
            expect(text).toContain("DC 10");
        });
        it("should format failed untrained check", () => {
            const result = {
                dieUsed: "1d10",
                roll: 7,
                dc: 10,
                stayedMounted: false,
                isProne: true,
                reason: "horse wounded",
            };
            const text = formatStayMountedResult(result);
            expect(text).toContain("untrained");
            expect(text).toContain("THROWN FROM HORSE");
            expect(text).toContain("prone");
        });
    });
    describe("formatMountedBonuses", () => {
        it("should format standard bonuses", () => {
            const bonuses = getMountedCombatBonuses();
            const text = formatMountedBonuses(bonuses);
            expect(text).toContain("+1 AC");
            expect(text).toContain("+1 attack vs unmounted");
            expect(text).not.toContain("doubled");
        });
        it("should include lance damage when applicable", () => {
            const bonuses = getMountedCombatBonuses(true, true);
            const text = formatMountedBonuses(bonuses);
            expect(text).toContain("lance/spear damage doubled");
        });
    });
});
// =============================================================================
// Integration Tests
// =============================================================================
describe("Integration: Combat Scenarios", () => {
    it("should handle wizard catching fire from dragon breath", () => {
        // Wizard catches fire from dragon breath (more dangerous fire)
        const fireState = createOnFireState({
            damageDie: "2d6",
            extinguishDC: 15,
            source: "dragon breath",
        });
        // Round 1: Takes damage, doesn't try to extinguish (casting spell)
        const roller1 = createMockRoller(5);
        const round1 = processFireRound(fireState, false, 2, roller1);
        expect(round1.damage).toBe(5);
        expect(round1.extinguished).toBe(false);
        expect(round1.newState).toBeDefined();
        // Round 2: Stop, drop, roll - fails
        const roller2 = createSequenceRoller([4, 10]); // 4 damage, 10 + 2 = 12 < DC 15
        const round2 = round1.newState ? processFireRound(round1.newState, true, 2, roller2) : undefined;
        expect(round2).toBeDefined();
        expect(round2?.extinguished).toBe(false);
        expect(round2?.newState).toBeDefined();
        // Round 3: Stop, drop, roll - succeeds
        const roller3 = createSequenceRoller([3, 15]); // 3 damage, 15 + 2 = 17 >= DC 15
        const round3 = round2?.newState ? processFireRound(round2.newState, true, 2, roller3) : undefined;
        expect(round3?.extinguished).toBe(true);
    });
    it("should handle fighter falling down pit trap", () => {
        // 30' pit trap
        const roller = createSequenceRoller([4, 6, 3]); // Two dice with one 6
        const result = calculateFallingDamage(30, roller);
        expect(result.damage).toBe(13); // 4 + 6 + 3
        expect(result.brokenBones).toBe(1);
        expect(result.permanentLoss).toBe(1); // -1 STR or AGL
    });
    it("should handle archer firing at goblin engaged with ally", () => {
        // Archer misses goblin, checks if ally is hit
        const roller = createSequenceRoller([35, 1, 12]); // 35% hits ally, ally index 1, attack roll 12
        const result = checkFiringIntoMelee(2, [14, 12], 4, roller);
        expect(result.hitAlly).toBe(true);
        expect(result.allyIndex).toBe(0);
        expect(result.allyAttackRoll).toBe(16); // 12 + 4
        expect(result.allyWasHit).toBe(true); // 16 >= 14
    });
    it("should handle ogre grappling a warrior", () => {
        const ogre = {
            attackBonus: 4,
            strengthMod: 4,
            agilityMod: 0,
            sizeCategory: 3, // Large
            hitDice: 4,
        };
        const warrior = {
            attackBonus: 3,
            strengthMod: 3,
            agilityMod: 1,
            sizeCategory: 2, // Medium
        };
        // Ogre rolls 12, warrior rolls 15
        const roller = createSequenceRoller([12, 15]);
        const result = resolveGrapple(ogre, warrior, roller);
        // Ogre: 12 + 4 (attack) + 4 (HD) = 20
        // Warrior: 15 + 3 (attack) + 3 (STR) = 21
        expect(result.attackerWins).toBe(false);
        expect(result.targetPinned).toBe(false);
    });
    it("should handle thief trying to knock out guard", () => {
        const roller = createMockRoller(5);
        // Dagger can't do subdual, but club can
        expect(canDealSubdualDamage("dagger")).toBe(false);
        expect(canDealSubdualDamage("club")).toBe(true);
        // Using club (d4 -> d3 subdual)
        const clubResult = rollSubdualDamage("1d4", 2, roller);
        expect(clubResult.damageDie).toBe("1d3");
        expect(clubResult.damage).toBe(7); // 5 + 2
        expect(clubResult.isSubdual).toBe(true);
    });
});
//# sourceMappingURL=misc-rules.test.js.map