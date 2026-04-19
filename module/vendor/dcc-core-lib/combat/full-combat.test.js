/**
 * Full Combat Scenario Tests
 *
 * Comprehensive tests that simulate complete combat encounters including:
 * - Initiative and turn order
 * - Attack rolls (hits, misses, criticals, fumbles)
 * - Damage calculation and application
 * - Spell casting in combat
 * - Healing (magical and natural)
 * - Death and dying rules
 * - Body recovery
 *
 * These tests follow DCC rules from the core book (Chapter 4: Combat)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { 
// Initiative
rollInitiative, sortByInitiative, 
// Attack
makeAttackRoll, 
// Damage
rollDamage, 
// Crits
rollCritical, 
// Fumbles
rollFumble, 
// Death and dying
getBleedOutRounds, getVitalStatus, applyDamage, canBeSaved, createBleedingOutState, advanceBleedOutRound, stabilizeCharacter, applyBleedOutTrauma, attemptBodyRecovery, applyBodyRecovery, applyNaturalHealing, applyHealingResult, applyMagicalHealing, isAtDeathsDoor, canReceiveHealing, 
// Morale
makeMoraleCheck, checkGroupMoraleTrigger, createGroupMoraleState, isImmuneToMorale, getSuggestedModifier, formatMoraleResult, } from "./index.js";
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
function createAbilityScores(overrides = {}) {
    const defaults = { str: 10, agl: 10, sta: 10, per: 10, int: 10, lck: 10 };
    const merged = { ...defaults, ...overrides };
    return {
        str: { current: merged.str, max: merged.str },
        agl: { current: merged.agl, max: merged.agl },
        sta: { current: merged.sta, max: merged.sta },
        per: { current: merged.per, max: merged.per },
        int: { current: merged.int, max: merged.int },
        lck: { current: merged.lck, max: merged.lck },
    };
}
function createTestCharacter(name, level, hp, abilities = {}) {
    return {
        identity: {
            id: `char-${name.toLowerCase().replace(/\s/g, "-")}`,
            name,
            occupation: "Adventurer",
            alignment: "n",
            birthAugur: {
                id: "test-augur",
                name: "Test Augur",
                effect: "None",
                modifies: "none",
                multiplier: 1,
            },
            startingLuck: abilities.lck ?? 10,
            languages: ["Common"],
        },
        classInfo: level > 0 ? {
            classId: "warrior",
            level,
        } : undefined,
        state: {
            hp: { current: hp, max: hp, temp: 0 },
            abilities: createAbilityScores(abilities),
            xp: { current: 0, nextLevel: 10 },
            saves: { reflex: 1, fortitude: 1, will: 1 },
            combat: {
                attackBonus: level,
                actionDice: ["d20"],
                critDie: "d12",
                critTable: "III",
                threatRange: 20,
                ac: 12,
                speed: 30,
                initiative: 0,
            },
            currency: { pp: 0, ep: 0, gp: 10, sp: 0, cp: 0 },
            inventory: { items: [] },
            conditions: [],
        },
    };
}
// =============================================================================
// Combat Scenario Tests
// =============================================================================
describe("Full Combat Scenario", () => {
    describe("Initiative Phase", () => {
        it("should establish turn order for multiple combatants", () => {
            // Setup: 3 PCs vs 2 goblins
            const combatants = [
                { name: "Warrior", agl: 12 },
                { name: "Wizard", agl: 8 },
                { name: "Cleric", agl: 10 },
                { name: "Goblin 1", agl: 14 },
                { name: "Goblin 2", agl: 14 },
            ];
            // Roll initiative for each (simulating different rolls)
            const rolls = [15, 8, 12, 18, 10];
            const roller = createSequenceRoller(rolls);
            const initiatives = combatants.map((c) => {
                const input = {
                    initiativeDie: "d16",
                    agilityModifier: Math.floor((c.agl - 10) / 2),
                };
                const result = rollInitiative(input, roller);
                return { name: c.name, initiative: result.total };
            });
            const sorted = sortByInitiative(initiatives);
            // Goblin 1 should go first (18 + 2 = 20)
            expect(sorted[0]?.name).toBe("Goblin 1");
            // Warrior second (15 + 1 = 16)
            expect(sorted[1]?.name).toBe("Warrior");
        });
    });
    describe("Attack Phase", () => {
        it("should handle a successful melee attack", () => {
            const roller = createMockRoller(15);
            const input = {
                attackType: "melee",
                attackBonus: 2,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 2, // +2 STR
                targetAC: 12,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.total).toBe(19); // 15 + 2 + 2
            expect(result.isHit).toBe(true);
            expect(result.isCriticalThreat).toBe(false);
            expect(result.isFumble).toBe(false);
        });
        it("should handle a miss", () => {
            const roller = createMockRoller(5);
            const input = {
                attackType: "melee",
                attackBonus: 1,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 1,
                targetAC: 15,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.total).toBe(7);
            expect(result.isHit).toBe(false);
        });
        it("should handle a critical hit", () => {
            const roller = createSequenceRoller([20, 12]); // Attack roll, then crit roll
            const attackInput = {
                attackType: "melee",
                attackBonus: 3,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 2,
                targetAC: 18,
            };
            const attackResult = makeAttackRoll(attackInput, roller);
            expect(attackResult.isCriticalThreat).toBe(true);
            expect(attackResult.isHit).toBe(true); // Crits always hit
            // Now roll on crit table
            const critResult = rollCritical({ critTable: "III", critDie: "d12", luckModifier: 1 }, roller);
            expect(critResult.total).toBe(13); // 12 + 1
        });
        it("should handle a fumble", () => {
            const roller = createSequenceRoller([1, 8]); // Attack fumble, fumble table roll
            const attackInput = {
                attackType: "melee",
                attackBonus: 5,
                actionDie: "d20",
                threatRange: 20,
                abilityModifier: 3,
                targetAC: 10,
            };
            const attackResult = makeAttackRoll(attackInput, roller);
            expect(attackResult.isFumble).toBe(true);
            expect(attackResult.isHit).toBe(false); // Fumbles always miss
            // Roll on fumble table
            const fumbleResult = rollFumble({ armorType: "chainmail", luckModifier: 0 }, roller);
            expect(fumbleResult.fumbleDie).toBe("d12"); // Chainmail = d12
            expect(fumbleResult.total).toBe(8);
        });
        it("should handle warrior mighty deed attack", () => {
            const roller = createSequenceRoller([15, 4]); // Attack roll, deed die
            const input = {
                attackType: "melee",
                attackBonus: 3,
                actionDie: "d20",
                threatRange: 19,
                abilityModifier: 2,
                deedDie: "d4",
                targetAC: 14,
            };
            const result = makeAttackRoll(input, roller);
            expect(result.roll.natural).toBe(15);
            expect(result.deedRoll?.natural).toBe(4);
            expect(result.deedSuccess).toBe(true); // 4 >= 3
            expect(result.totalBonus).toBe(9); // 3 + 2 + 4
            expect(result.total).toBe(24);
            expect(result.isHit).toBe(true);
        });
    });
    describe("Damage Phase", () => {
        it("should calculate basic weapon damage", () => {
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
        it("should add deed die to warrior damage", () => {
            const roller = createMockRoller(5);
            const input = {
                damageDie: "d8",
                strengthModifier: 3,
                deedDieResult: 4,
            };
            const result = rollDamage(input, roller);
            expect(result.baseDamage).toBe(5);
            expect(result.modifierDamage).toBe(7); // 3 + 4
            expect(result.total).toBe(12);
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
    });
    describe("Death and Dying", () => {
        describe("Bleed Out Mechanics", () => {
            it("should kill 0-level characters immediately at 0 HP", () => {
                expect(getBleedOutRounds(0)).toBe(0);
                expect(getVitalStatus(0, 0)).toBe("permanently-dead");
            });
            it("should allow 1st level characters to bleed out for 1 round", () => {
                expect(getBleedOutRounds(1)).toBe(1);
                expect(getVitalStatus(0, 1)).toBe("bleeding-out");
            });
            it("should scale bleed out rounds with level", () => {
                expect(getBleedOutRounds(3)).toBe(3);
                expect(getBleedOutRounds(5)).toBe(5);
                expect(getBleedOutRounds(10)).toBe(10);
            });
            it("should track bleeding out state over combat rounds", () => {
                const level = 3;
                const state = createBleedingOutState(level, 1);
                expect(state.roundsRemaining).toBe(3);
                expect(state.maxRounds).toBe(3);
                // Round 2
                const state2 = advanceBleedOutRound(state);
                expect(state2).toBeDefined();
                expect(state2?.roundsRemaining).toBe(2);
                // Round 3
                const state3 = state2 ? advanceBleedOutRound(state2) : undefined;
                expect(state3).toBeDefined();
                expect(state3?.roundsRemaining).toBe(1);
                // Round 4 - character dies
                const state4 = state3 ? advanceBleedOutRound(state3) : undefined;
                expect(state4).toBeUndefined();
            });
        });
        describe("Applying Damage to Characters", () => {
            let warrior;
            beforeEach(() => {
                warrior = createTestCharacter("Grognard", 3, 18, { sta: 14 });
            });
            it("should reduce HP and keep character alive", () => {
                const result = applyDamage(warrior, 5);
                expect(result.newHP).toBe(13);
                expect(result.status).toBe("alive");
                expect(result.instantDeath).toBe(false);
                expect(result.startedBleedingOut).toBe(false);
            });
            it("should start bleeding out when HP reaches 0", () => {
                const result = applyDamage(warrior, 18);
                expect(result.newHP).toBe(0);
                expect(result.status).toBe("bleeding-out");
                expect(result.startedBleedingOut).toBe(true);
                expect(result.roundsUntilDeath).toBe(3); // Level 3 warrior
            });
            it("should instantly kill 0-level characters", () => {
                const peasant = createTestCharacter("Peasant", 0, 4);
                const result = applyDamage(peasant, 4);
                expect(result.newHP).toBe(0);
                expect(result.status).toBe("permanently-dead");
                expect(result.instantDeath).toBe(true);
                expect(result.startedBleedingOut).toBe(false);
            });
        });
        describe("Saving Bleeding Characters", () => {
            it("should save character with healing before time runs out", () => {
                const bleedState = createBleedingOutState(3, 1);
                const result = stabilizeCharacter(bleedState, 6); // Lay on Hands for 6 HP
                expect(result.saved).toBe(true);
                expect(result.newHP).toBe(6);
                expect(result.staminaLoss).toBe(true);
                expect(result.scar).toBeDefined();
            });
            it("should fail to save if no rounds remaining", () => {
                const initialState = createBleedingOutState(1, 1);
                const advancedState = advanceBleedOutRound(initialState); // Now at 0 rounds
                // This should fail because advancedState is undefined (character dead)
                expect(advancedState).toBeUndefined();
            });
            it("should apply permanent Stamina loss when saved", () => {
                const warrior = createTestCharacter("Grognard", 3, 0, { sta: 14 });
                const updated = applyBleedOutTrauma(warrior, 5, "Jagged scar across face");
                expect(updated.state.hp.current).toBe(5);
                expect(updated.state.abilities.sta.max).toBe(13); // Was 14
                expect(updated.state.conditions).toContain("Scar: Jagged scar across face");
            });
        });
        describe("Body Recovery (Luck Check)", () => {
            it("should allow recovery with successful Luck check", () => {
                const roller = createSequenceRoller([8, 2]); // Luck roll = 8, ability roll = 2 (AGL)
                const result = attemptBodyRecovery(12, roller);
                expect(result.success).toBe(true);
                expect(result.luckRoll).toBe(8);
                expect(result.targetDC).toBe(12);
                expect(result.newHP).toBe(1);
                expect(result.groggyDuration).toBe("1 hour (-4 to all rolls)");
                expect(result.permanentPenalty?.ability).toBe("agl"); // d3 roll of 2
                expect(result.permanentPenalty?.amount).toBe(1);
            });
            it("should fail recovery with failed Luck check", () => {
                const roller = createMockRoller(15); // Roll 15, Luck is 10
                const result = attemptBodyRecovery(10, roller);
                expect(result.success).toBe(false);
                expect(result.luckRoll).toBe(15);
                expect(result.newHP).toBeUndefined();
            });
            it("should apply recovery effects to character", () => {
                const dead = createTestCharacter("Fallen Hero", 3, 0, { str: 14, agl: 12, sta: 16 });
                const recovery = {
                    success: true,
                    luckRoll: 5,
                    targetDC: 10,
                    newHP: 1,
                    groggyDuration: "1 hour (-4 to all rolls)",
                    permanentPenalty: {
                        ability: "str",
                        amount: 1,
                    },
                };
                const recovered = applyBodyRecovery(dead, recovery);
                expect(recovered).toBeDefined();
                if (recovered) {
                    expect(recovered.state.hp.current).toBe(1);
                    expect(recovered.state.abilities.str.max).toBe(13); // Was 14
                    expect(recovered.state.conditions).toContain("Groggy: 1 hour (-4 to all rolls)");
                    expect(recovered.state.conditions).toContain("Permanent injury: -1 STR");
                }
            });
        });
    });
    describe("Healing", () => {
        describe("Natural Healing", () => {
            let wounded;
            beforeEach(() => {
                wounded = createTestCharacter("Wounded Warrior", 3, 10, { sta: 12 });
                // Reduce HP to simulate wounds
                wounded.state.hp.current = 4;
            });
            it("should heal 1 HP with active adventuring rest", () => {
                const result = applyNaturalHealing(wounded, "active-adventure");
                expect(result.hpHealed).toBe(1);
                expect(result.newHP).toBe(5);
            });
            it("should heal 2 HP with bed rest", () => {
                const result = applyNaturalHealing(wounded, "bed-rest");
                expect(result.hpHealed).toBe(2);
                expect(result.newHP).toBe(6);
            });
            it("should not exceed max HP", () => {
                wounded.state.hp.current = 9; // Only 1 below max
                const result = applyNaturalHealing(wounded, "bed-rest");
                expect(result.hpHealed).toBe(1); // Capped at max
                expect(result.newHP).toBe(10);
            });
            it("should heal ability damage except Luck", () => {
                // Simulate spellburn damage
                wounded.state.abilities.str.current = 8; // Was 10
                wounded.state.abilities.sta.current = 10; // Was 12
                const result = applyNaturalHealing(wounded, "bed-rest");
                expect(result.abilityHealed.str).toBe(2);
                expect(result.abilityHealed.sta).toBe(2);
                expect(result.abilityHealed.lck).toBeUndefined(); // Luck doesn't heal
            });
            it("should apply healing result to character", () => {
                wounded.state.abilities.str.current = 8;
                const healing = applyNaturalHealing(wounded, "bed-rest");
                const healed = applyHealingResult(wounded, healing);
                expect(healed.state.hp.current).toBe(6);
                expect(healed.state.abilities.str.current).toBe(10);
            });
        });
        describe("Magical Healing", () => {
            it("should apply magical healing up to max HP", () => {
                const wounded = createTestCharacter("Injured Cleric", 2, 12);
                wounded.state.hp.current = 3;
                const healed = applyMagicalHealing(wounded, 6);
                expect(healed.state.hp.current).toBe(9);
            });
            it("should not exceed max HP with magical healing", () => {
                const wounded = createTestCharacter("Slightly Hurt", 2, 12);
                wounded.state.hp.current = 10;
                const healed = applyMagicalHealing(wounded, 10);
                expect(healed.state.hp.current).toBe(12); // Capped at max
            });
        });
    });
    describe("Utility Functions", () => {
        it("should detect death's door (1 HP or less)", () => {
            expect(isAtDeathsDoor(1)).toBe(true);
            expect(isAtDeathsDoor(0)).toBe(true);
            expect(isAtDeathsDoor(2)).toBe(false);
        });
        it("should determine if character can receive healing", () => {
            expect(canReceiveHealing("alive")).toBe(true);
            expect(canReceiveHealing("unconscious")).toBe(true);
            expect(canReceiveHealing("bleeding-out")).toBe(true);
            expect(canReceiveHealing("dead")).toBe(false);
            expect(canReceiveHealing("permanently-dead")).toBe(false);
        });
        it("should check if character can be saved", () => {
            expect(canBeSaved(0, 0)).toBe(false); // 0-level can't be saved via healing
            expect(canBeSaved(1, 0)).toBe(true); // 1st level in round 0
            expect(canBeSaved(1, 1)).toBe(false); // 1st level after 1 round
            expect(canBeSaved(3, 2)).toBe(true); // 3rd level after 2 rounds
            expect(canBeSaved(3, 3)).toBe(false); // 3rd level after 3 rounds
        });
    });
    describe("Morale in Combat", () => {
        describe("Group Morale Triggers", () => {
            it("should trigger morale check when first ally is slain", () => {
                const goblinGroup = createGroupMoraleState(4);
                const trigger = checkGroupMoraleTrigger(goblinGroup, 1);
                expect(trigger).toBeDefined();
                expect(trigger?.trigger).toBe("first-ally-slain");
                expect(trigger?.newState.firstCasualtyChecked).toBe(true);
                expect(trigger?.newState.activeCreatures).toBe(3);
            });
            it("should trigger morale check when half the group is down", () => {
                // Start with 4 goblins, first casualty already checked
                let goblinGroup = createGroupMoraleState(4);
                goblinGroup = { ...goblinGroup, activeCreatures: 3, firstCasualtyChecked: true };
                // Kill goblin to bring to half (2 of 4)
                const trigger = checkGroupMoraleTrigger(goblinGroup, 1);
                expect(trigger).toBeDefined();
                expect(trigger?.trigger).toBe("half-allies-down");
                expect(trigger?.newState.halfDownChecked).toBe(true);
                expect(trigger?.newState.activeCreatures).toBe(2);
            });
            it("should not trigger again after checks are made", () => {
                const goblinGroup = {
                    totalCreatures: 4,
                    activeCreatures: 2,
                    firstCasualtyChecked: true,
                    halfDownChecked: true,
                };
                const trigger = checkGroupMoraleTrigger(goblinGroup, 1);
                expect(trigger).toBeUndefined();
            });
        });
        describe("Morale Check Resolution", () => {
            it("should pass morale with high Will save and good roll", () => {
                const roller = createMockRoller(12);
                const result = makeMoraleCheck({
                    entityType: "monster",
                    willSave: 3,
                    trigger: "first-ally-slain",
                }, roller);
                expect(result.roll).toBe(12);
                expect(result.total).toBe(15); // 12 + 3
                expect(result.passed).toBe(true);
                expect(result.outcome).toBe("fights");
            });
            it("should fail morale with low roll", () => {
                const roller = createMockRoller(4);
                const result = makeMoraleCheck({
                    entityType: "monster",
                    willSave: 2,
                    trigger: "half-allies-down",
                }, roller);
                expect(result.roll).toBe(4);
                expect(result.total).toBe(6); // 4 + 2
                expect(result.passed).toBe(false);
                expect(result.outcome).toBe("flees");
            });
            it("should apply situational modifiers", () => {
                const roller = createMockRoller(8);
                const result = makeMoraleCheck({
                    entityType: "monster",
                    willSave: 1,
                    trigger: "first-ally-slain",
                    situationalModifier: 4, // Defending young
                }, roller);
                expect(result.total).toBe(13); // 8 + 1 + 4
                expect(result.passed).toBe(true);
            });
            it("should automatically pass for immune creatures", () => {
                const roller = createMockRoller(1); // Would normally fail
                const result = makeMoraleCheck({
                    entityType: "monster",
                    willSave: 0,
                    trigger: "half-allies-down",
                    isImmune: true,
                }, roller);
                expect(result.immune).toBe(true);
                expect(result.passed).toBe(true);
                expect(result.outcome).toBe("immune");
            });
        });
        describe("Retainer Morale", () => {
            it("should add employer Personality modifier for retainers", () => {
                const roller = createMockRoller(8);
                const result = makeMoraleCheck({
                    entityType: "retainer",
                    willSave: 1,
                    trigger: "first-combat",
                    employerPersonalityMod: 3,
                }, roller);
                expect(result.total).toBe(12); // 8 + 1 + 3
                expect(result.passed).toBe(true);
                expect(result.modifiers.some(m => m.source === "employer")).toBe(true);
            });
            it("should format morale result for display", () => {
                const roller = createMockRoller(15);
                const result = makeMoraleCheck({
                    entityType: "monster",
                    willSave: 2,
                    trigger: "first-ally-slain",
                }, roller);
                const formatted = formatMoraleResult(result);
                expect(formatted).toContain("Morale check");
                expect(formatted).toContain("PASSES");
                expect(formatted).toContain("continues fighting");
            });
        });
        describe("Morale Immunity", () => {
            it("should identify immune creature types", () => {
                expect(isImmuneToMorale("golem")).toBe(true);
                expect(isImmuneToMorale("stone golem")).toBe(true);
                expect(isImmuneToMorale("automaton")).toBe(true);
                expect(isImmuneToMorale("mindless undead")).toBe(true);
                expect(isImmuneToMorale("ooze")).toBe(true);
                expect(isImmuneToMorale("goblin")).toBe(false);
                expect(isImmuneToMorale("orc warrior")).toBe(false);
            });
        });
        describe("Situational Modifiers", () => {
            it("should suggest appropriate modifiers for scenarios", () => {
                expect(getSuggestedModifier("defending young")).toBe(4);
                expect(getSuggestedModifier("cornered, no escape")).toBe(4);
                expect(getSuggestedModifier("defending home")).toBe(2);
                expect(getSuggestedModifier("outmatched")).toBe(-2);
                expect(getSuggestedModifier("leader slain")).toBe(-4);
                expect(getSuggestedModifier("normal combat")).toBe(0);
            });
        });
    });
});
// =============================================================================
// Integration Scenario: Full Combat Encounter
// =============================================================================
describe("Integration: Party vs Goblins Combat", () => {
    it("should simulate a complete combat encounter with morale", () => {
        // Setup: Create party and enemies
        let warrior = createTestCharacter("Krag", 3, 18, { str: 16, sta: 14, agl: 12, lck: 11 });
        const cleric = createTestCharacter("Hektor", 3, 14, { per: 16, sta: 12, lck: 10 });
        // Goblins have 4 HP and 5 HP respectively, Will save +0
        // Track combat state
        let goblin1Alive = true;
        let goblin2Alive = true;
        // Track goblin group morale
        let goblinMorale = createGroupMoraleState(2);
        // Round 1: Roll initiative
        const initRoller = createSequenceRoller([14, 10, 16, 8]);
        const combatants = [
            { name: "Krag", aglMod: 1, roll: rollInitiative({ initiativeDie: "d16", agilityModifier: 1 }, initRoller) },
            { name: "Hektor", aglMod: 0, roll: rollInitiative({ initiativeDie: "d16", agilityModifier: 0 }, initRoller) },
            { name: "Goblin 1", aglMod: 2, roll: rollInitiative({ initiativeDie: "d16", agilityModifier: 2 }, initRoller) },
            { name: "Goblin 2", aglMod: 2, roll: rollInitiative({ initiativeDie: "d16", agilityModifier: 2 }, initRoller) },
        ];
        const sorted = sortByInitiative(combatants.map(c => ({ name: c.name, initiative: c.roll.total })));
        // Expected order: Goblin 1 (18), Krag (15), Hektor (10), Goblin 2 (10)
        expect(sorted[0]?.name).toBe("Goblin 1");
        expect(sorted[1]?.name).toBe("Krag");
        // Round 1 Actions:
        // Goblin 1 attacks Krag (hits for 4 damage)
        let attackRoller = createMockRoller(15);
        const goblinAttack = makeAttackRoll({
            attackType: "melee",
            attackBonus: 1,
            actionDie: "d20",
            threatRange: 20,
            abilityModifier: 1,
            targetAC: warrior.state.combat.ac,
        }, attackRoller);
        expect(goblinAttack.isHit).toBe(true);
        const goblinDamage = rollDamage({ damageDie: "d6", strengthModifier: 0 }, createMockRoller(4));
        const kragDamageResult = applyDamage(warrior, goblinDamage.total);
        warrior = { ...warrior, state: { ...warrior.state, hp: { ...warrior.state.hp, current: kragDamageResult.newHP } } };
        expect(warrior.state.hp.current).toBe(14);
        // Krag attacks Goblin 1 with deed die (critical hit!)
        attackRoller = createSequenceRoller([20, 5]); // Nat 20, deed die 5
        const kragAttack = makeAttackRoll({
            attackType: "melee",
            attackBonus: 3,
            actionDie: "d20",
            threatRange: 19,
            abilityModifier: 3,
            deedDie: "d5",
            targetAC: 12,
        }, attackRoller);
        expect(kragAttack.isCriticalThreat).toBe(true);
        expect(kragAttack.deedSuccess).toBe(true);
        // Roll crit damage
        const critRoller = createMockRoller(14);
        const critResult = rollCritical({ critTable: "III", critDie: "d12", luckModifier: 0, level: 3 }, critRoller);
        expect(critResult.total).toBe(17); // 14 + 3 level
        // Base damage + crit bonus (assume +1d6 extra)
        const kragDamage = rollDamage({ damageDie: "d8", strengthModifier: 3, deedDieResult: 5 }, createMockRoller(7));
        // 7 + 3 + 5 = 15 damage, goblin has 4 HP - definitely dead
        expect(kragDamage.total).toBe(15);
        goblin1Alive = false;
        // MORALE CHECK: First goblin dies - check for morale trigger
        const moraleTrigger1 = checkGroupMoraleTrigger(goblinMorale, 1);
        expect(moraleTrigger1).toBeDefined();
        expect(moraleTrigger1?.trigger).toBe("first-ally-slain");
        goblinMorale = moraleTrigger1?.newState ?? goblinMorale;
        // Remaining goblin makes morale check (rolls 14, +0 Will = 14 vs DC 11 - passes!)
        const moraleRoller = createMockRoller(14);
        const goblinMoraleCheck = makeMoraleCheck({
            entityType: "monster",
            willSave: 0,
            trigger: "first-ally-slain",
        }, moraleRoller);
        expect(goblinMoraleCheck.passed).toBe(true);
        expect(goblinMoraleCheck.outcome).toBe("fights");
        // Hektor casts Bless (would need spell system, skip for now)
        // Goblin 2 attacks Hektor (fumble!)
        attackRoller = createSequenceRoller([1, 10]); // Nat 1, fumble roll
        const goblin2Attack = makeAttackRoll({
            attackType: "melee",
            attackBonus: 1,
            actionDie: "d20",
            threatRange: 20,
            abilityModifier: 1,
            targetAC: cleric.state.combat.ac,
        }, attackRoller);
        expect(goblin2Attack.isFumble).toBe(true);
        expect(goblin2Attack.isHit).toBe(false);
        const fumbleResult = rollFumble({ armorType: "leather", luckModifier: 0 }, createMockRoller(8));
        expect(fumbleResult.fumbleDie).toBe("d8");
        // Round 2: Krag finishes goblin 2
        attackRoller = createMockRoller(17);
        const finalAttack = makeAttackRoll({
            attackType: "melee",
            attackBonus: 3,
            actionDie: "d20",
            threatRange: 19,
            abilityModifier: 3,
            targetAC: 12,
        }, attackRoller);
        expect(finalAttack.isHit).toBe(true);
        const finalDamage = rollDamage({ damageDie: "d8", strengthModifier: 3 }, createMockRoller(6));
        // 6 + 3 = 9 damage, goblin has 5 HP - dead
        expect(finalDamage.total).toBe(9);
        goblin2Alive = false;
        // Combat over!
        expect(goblin1Alive).toBe(false);
        expect(goblin2Alive).toBe(false);
        expect(warrior.state.hp.current).toBe(14); // Took 4 damage
        expect(cleric.state.hp.current).toBe(14); // No damage
        // After combat: Natural healing overnight
        warrior.state.hp.current = 14;
        const healingResult = applyNaturalHealing(warrior, "active-adventure");
        const healedWarrior = applyHealingResult(warrior, healingResult);
        expect(healedWarrior.state.hp.current).toBe(15); // +1 HP
    });
    it("should handle near-death scenario with healing", () => {
        // Setup: Cleric at death's door
        const cleric = createTestCharacter("Brother Marcus", 3, 16, { per: 16, sta: 14 });
        // Cleric takes massive damage - 15 points!
        const damageResult = applyDamage(cleric, 15);
        expect(damageResult.newHP).toBe(1);
        expect(damageResult.status).toBe("alive");
        expect(isAtDeathsDoor(damageResult.newHP)).toBe(true);
        // Next round, takes 3 more damage - starts bleeding out
        const nearDeathCleric = { ...cleric, state: { ...cleric.state, hp: { ...cleric.state.hp, current: 1 } } };
        const fatalResult = applyDamage(nearDeathCleric, 3);
        expect(fatalResult.status).toBe("bleeding-out");
        expect(fatalResult.roundsUntilDeath).toBe(3);
        // Create bleeding state
        const bleedState = createBleedingOutState(3, 1);
        // Warrior gives healing potion (8 HP) in same round
        const stabilized = stabilizeCharacter(bleedState, 8);
        expect(stabilized.saved).toBe(true);
        expect(stabilized.newHP).toBe(8);
        expect(stabilized.staminaLoss).toBe(true);
        // Apply the trauma
        const recoveredCleric = applyBleedOutTrauma(nearDeathCleric, 8, "Deep wound on the chest");
        expect(recoveredCleric.state.hp.current).toBe(8);
        expect(recoveredCleric.state.abilities.sta.max).toBe(13); // Lost 1 STA
        expect(recoveredCleric.state.conditions.some(c => c.includes("Scar"))).toBe(true);
    });
    it("should handle 0-level character death correctly", () => {
        // The classic funnel scenario
        const peasant = createTestCharacter("Unlucky Farmer", 0, 3);
        // Goblin hits for 4 damage
        const result = applyDamage(peasant, 4);
        expect(result.status).toBe("permanently-dead");
        expect(result.instantDeath).toBe(true);
        expect(canBeSaved(0, 0)).toBe(false); // 0-level can't be saved via healing
        // Only hope is body recovery
        const roller = createSequenceRoller([5, 1]); // Lucky roll!
        const recovery = attemptBodyRecovery(peasant.state.abilities.lck.current, roller);
        expect(recovery.success).toBe(true);
        expect(recovery.newHP).toBe(1);
    });
    it("should end combat early when enemies fail morale", () => {
        // Setup: Party of heroes vs cowardly bandits
        const warrior = createTestCharacter("Theron", 4, 24, { str: 16, sta: 14 });
        // 4 bandits, Will save +0, not particularly motivated
        let banditMorale = createGroupMoraleState(4);
        // Warrior kills first bandit with a devastating blow
        const trigger1 = checkGroupMoraleTrigger(banditMorale, 1);
        expect(trigger1?.trigger).toBe("first-ally-slain");
        banditMorale = trigger1?.newState ?? banditMorale;
        // First morale check - bandits roll 8, +0 Will = 8 vs DC 11 - FAIL!
        const moraleRoller1 = createMockRoller(8);
        const firstMoraleCheck = makeMoraleCheck({
            entityType: "monster",
            willSave: 0,
            trigger: "first-ally-slain",
            situationalModifier: getSuggestedModifier("unwilling fighters"), // -4 for coerced
        }, moraleRoller1);
        expect(firstMoraleCheck.total).toBe(4); // 8 + 0 - 4
        expect(firstMoraleCheck.passed).toBe(false);
        expect(firstMoraleCheck.outcome).toBe("flees");
        // Format result for the GM
        const resultText = formatMoraleResult(firstMoraleCheck);
        expect(resultText).toContain("FAILS");
        expect(resultText).toContain("flee");
        // Combat ends early - 3 bandits flee, warrior and party are victorious!
        expect(warrior.state.hp.current).toBe(24); // Warrior took no damage
    });
    it("should handle golem immunity to morale", () => {
        // Setup: Party fights iron golems
        let golemMorale = createGroupMoraleState(2);
        // Check if golems are immune
        const isGolemImmune = isImmuneToMorale("iron golem");
        expect(isGolemImmune).toBe(true);
        // Party destroys one golem
        const trigger = checkGroupMoraleTrigger(golemMorale, 1);
        expect(trigger?.trigger).toBe("first-ally-slain");
        golemMorale = trigger?.newState ?? golemMorale;
        // Golem morale check - immune, so auto-passes
        const golemMoraleCheck = makeMoraleCheck({
            entityType: "monster",
            willSave: 0,
            trigger: "first-ally-slain",
            isImmune: true,
        }, createMockRoller(1)); // Would fail if not immune
        expect(golemMoraleCheck.immune).toBe(true);
        expect(golemMoraleCheck.passed).toBe(true);
        expect(golemMoraleCheck.outcome).toBe("immune");
        expect(formatMoraleResult(golemMoraleCheck)).toContain("Immune");
    });
});
//# sourceMappingURL=full-combat.test.js.map