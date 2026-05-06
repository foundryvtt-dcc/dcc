/**
 * Morale System Tests
 *
 * Tests for morale checks, triggers, and state management.
 */
import { describe, it, expect } from "vitest";
import { 
// Functions
makeMoraleCheck, calculateMoraleModifier, checkGroupMoraleTrigger, checkCreatureMoraleTrigger, checkRetainerMoraleTrigger, createGroupMoraleState, createCreatureMoraleState, createRetainerMoraleState, resetRetainerMoraleForNewAdventure, isImmuneToMorale, hasImmuneTraits, getSuggestedModifier, formatMoraleResult, 
// Constants
DEFAULT_MORALE_DC, } from "./morale.js";
// =============================================================================
// Test Helpers
// =============================================================================
function createMockRoller(value) {
    return () => value;
}
// =============================================================================
// Morale Check Tests
// =============================================================================
describe("Morale System", () => {
    describe("makeMoraleCheck", () => {
        it("should pass morale check when roll + modifiers >= DC", () => {
            const roller = createMockRoller(10);
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: 2,
                trigger: "half-hp-lost",
            }, roller);
            expect(result.roll).toBe(10);
            expect(result.total).toBe(12); // 10 + 2
            expect(result.dc).toBe(DEFAULT_MORALE_DC);
            expect(result.passed).toBe(true);
            expect(result.outcome).toBe("fights");
        });
        it("should fail morale check when roll + modifiers < DC", () => {
            const roller = createMockRoller(5);
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: 2,
                trigger: "first-ally-slain",
            }, roller);
            expect(result.roll).toBe(5);
            expect(result.total).toBe(7); // 5 + 2
            expect(result.passed).toBe(false);
            expect(result.outcome).toBe("flees");
        });
        it("should pass on exactly DC 11", () => {
            const roller = createMockRoller(9);
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: 2,
                trigger: "half-hp-lost",
            }, roller);
            expect(result.total).toBe(11);
            expect(result.passed).toBe(true);
        });
        it("should fail on DC 10", () => {
            const roller = createMockRoller(8);
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: 2,
                trigger: "half-hp-lost",
            }, roller);
            expect(result.total).toBe(10);
            expect(result.passed).toBe(false);
        });
        it("should add employer Personality modifier for retainers", () => {
            const roller = createMockRoller(7);
            const result = makeMoraleCheck({
                entityType: "retainer",
                willSave: 1,
                trigger: "first-combat",
                employerPersonalityMod: 2,
            }, roller);
            expect(result.total).toBe(10); // 7 + 1 + 2
            expect(result.modifiers).toHaveLength(2);
            expect(result.modifiers.some(m => m.source === "employer")).toBe(true);
        });
        it("should apply situational modifiers", () => {
            const roller = createMockRoller(8);
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: 1,
                trigger: "half-allies-down",
                situationalModifier: 4, // Mother defending cubs
            }, roller);
            expect(result.total).toBe(13); // 8 + 1 + 4
            expect(result.passed).toBe(true);
            expect(result.modifiers.some(m => m.source === "situational")).toBe(true);
        });
        it("should clamp situational modifier to -4 to +4", () => {
            const roller = createMockRoller(10);
            // Test +10 clamped to +4
            const resultHigh = makeMoraleCheck({
                entityType: "monster",
                willSave: 0,
                trigger: "half-hp-lost",
                situationalModifier: 10,
            }, roller);
            expect(resultHigh.total).toBe(14); // 10 + 0 + 4 (clamped)
            // Test -10 clamped to -4
            const resultLow = makeMoraleCheck({
                entityType: "monster",
                willSave: 0,
                trigger: "half-hp-lost",
                situationalModifier: -10,
            }, roller);
            expect(resultLow.total).toBe(6); // 10 + 0 + (-4) (clamped)
        });
        it("should respect custom DC", () => {
            const roller = createMockRoller(12);
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: 2,
                trigger: "magical-effect",
                dc: 15,
            }, roller);
            expect(result.dc).toBe(15);
            expect(result.total).toBe(14);
            expect(result.passed).toBe(false); // 14 < 15
        });
        it("should auto-pass for immune creatures", () => {
            const roller = createMockRoller(1); // Even a natural 1 doesn't matter
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: -5,
                trigger: "half-hp-lost",
                isImmune: true,
            }, roller);
            expect(result.immune).toBe(true);
            expect(result.passed).toBe(true);
            expect(result.outcome).toBe("immune");
            expect(result.roll).toBe(0); // No roll made
        });
        it("should track the trigger type", () => {
            const roller = createMockRoller(15);
            const result = makeMoraleCheck({
                entityType: "monster",
                willSave: 0,
                trigger: "first-ally-slain",
            }, roller);
            expect(result.trigger).toBe("first-ally-slain");
        });
    });
    describe("calculateMoraleModifier", () => {
        it("should sum all modifiers", () => {
            expect(calculateMoraleModifier(3, 2, 1)).toBe(6);
        });
        it("should handle negative modifiers", () => {
            expect(calculateMoraleModifier(2, -4, 0)).toBe(-2);
        });
        it("should clamp situational modifier", () => {
            expect(calculateMoraleModifier(0, 10, 0)).toBe(4); // 10 clamped to 4
            expect(calculateMoraleModifier(0, -10, 0)).toBe(-4); // -10 clamped to -4
        });
    });
});
// =============================================================================
// Group Morale Trigger Tests
// =============================================================================
describe("Group Morale Triggers", () => {
    describe("checkGroupMoraleTrigger", () => {
        it("should trigger on first casualty", () => {
            const state = createGroupMoraleState(5);
            const result = checkGroupMoraleTrigger(state, 1);
            expect(result).toBeDefined();
            expect(result?.trigger).toBe("first-ally-slain");
            expect(result?.newState.activeCreatures).toBe(4);
            expect(result?.newState.firstCasualtyChecked).toBe(true);
        });
        it("should not trigger first casualty again", () => {
            let state = createGroupMoraleState(5);
            // First casualty
            const firstResult = checkGroupMoraleTrigger(state, 1);
            state = firstResult?.newState ?? state;
            // Second casualty - should not trigger first casualty again
            const secondResult = checkGroupMoraleTrigger(state, 1);
            // Might trigger half-down, but not first casualty
            if (secondResult) {
                expect(secondResult.trigger).not.toBe("first-ally-slain");
            }
        });
        it("should trigger when half are down", () => {
            let state = createGroupMoraleState(6);
            // Kill first one (triggers first casualty)
            const firstResult = checkGroupMoraleTrigger(state, 1);
            state = firstResult?.newState ?? state;
            // Kill two more (now 3 active out of 6 = half down)
            const halfResult = checkGroupMoraleTrigger(state, 2);
            expect(halfResult).toBeDefined();
            expect(halfResult?.trigger).toBe("half-allies-down");
            expect(halfResult?.newState.activeCreatures).toBe(3);
            expect(halfResult?.newState.halfDownChecked).toBe(true);
        });
        it("should not trigger half-down again", () => {
            let state = createGroupMoraleState(4);
            // Kill first (triggers first casualty)
            const first = checkGroupMoraleTrigger(state, 1);
            state = first?.newState ?? state;
            // Kill another (triggers half down at 2/4)
            const half = checkGroupMoraleTrigger(state, 1);
            state = half?.newState ?? state;
            // Kill another - should not trigger anything
            const third = checkGroupMoraleTrigger(state, 1);
            expect(third).toBeUndefined();
        });
        it("should handle mass casualties triggering both checks", () => {
            const state = createGroupMoraleState(4);
            // Kill 3 at once - should trigger first casualty first
            const result = checkGroupMoraleTrigger(state, 3);
            expect(result).toBeDefined();
            expect(result?.trigger).toBe("first-ally-slain");
            // Second call with 0 casualties - half-down check happens later
            // The half-down would need to be checked separately after first casualty
            expect(result?.newState.activeCreatures).toBe(1);
        });
    });
    describe("createGroupMoraleState", () => {
        it("should initialize correctly", () => {
            const state = createGroupMoraleState(8);
            expect(state.totalCreatures).toBe(8);
            expect(state.activeCreatures).toBe(8);
            expect(state.firstCasualtyChecked).toBe(false);
            expect(state.halfDownChecked).toBe(false);
        });
    });
});
// =============================================================================
// Single Creature Morale Trigger Tests
// =============================================================================
describe("Single Creature Morale Triggers", () => {
    describe("checkCreatureMoraleTrigger", () => {
        it("should trigger when HP drops below half", () => {
            const state = createCreatureMoraleState(20);
            const result = checkCreatureMoraleTrigger(state, 11); // 20 -> 9 HP
            expect(result).toBeDefined();
            expect(result?.trigger).toBe("half-hp-lost");
            expect(result?.newState.currentHP).toBe(9);
            expect(result?.newState.halfHPChecked).toBe(true);
        });
        it("should trigger when HP drops to exactly half", () => {
            const state = createCreatureMoraleState(20);
            const result = checkCreatureMoraleTrigger(state, 10); // 20 -> 10 HP = half
            expect(result).toBeDefined();
            expect(result?.trigger).toBe("half-hp-lost");
        });
        it("should not trigger if damage leaves HP above half", () => {
            const state = createCreatureMoraleState(20);
            const result = checkCreatureMoraleTrigger(state, 5); // 20 -> 15 HP
            expect(result).toBeUndefined();
        });
        it("should not trigger half-HP check again", () => {
            let state = createCreatureMoraleState(20);
            // First hit below half
            const first = checkCreatureMoraleTrigger(state, 11);
            state = first?.newState ?? state;
            // Second hit - should not trigger again
            const second = checkCreatureMoraleTrigger(state, 5);
            expect(second).toBeUndefined();
        });
    });
    describe("createCreatureMoraleState", () => {
        it("should initialize correctly", () => {
            const state = createCreatureMoraleState(30);
            expect(state.maxHP).toBe(30);
            expect(state.currentHP).toBe(30);
            expect(state.halfHPChecked).toBe(false);
        });
    });
});
// =============================================================================
// Retainer Morale Trigger Tests
// =============================================================================
describe("Retainer Morale Triggers", () => {
    describe("checkRetainerMoraleTrigger", () => {
        it("should trigger on first combat", () => {
            const state = createRetainerMoraleState();
            const result = checkRetainerMoraleTrigger(state, "combat");
            expect(result).toBeDefined();
            expect(result?.trigger).toBe("first-combat");
            expect(result?.newState.firstCombatChecked).toBe(true);
        });
        it("should trigger on first danger (trap, etc.)", () => {
            const state = createRetainerMoraleState();
            const result = checkRetainerMoraleTrigger(state, "danger");
            expect(result).toBeDefined();
            expect(result?.trigger).toBe("first-danger");
            expect(result?.newState.firstDangerChecked).toBe(true);
        });
        it("should not trigger first combat again", () => {
            let state = createRetainerMoraleState();
            const first = checkRetainerMoraleTrigger(state, "combat");
            state = first?.newState ?? state;
            const second = checkRetainerMoraleTrigger(state, "combat");
            expect(second).toBeUndefined();
        });
        it("should always trigger at end of adventure", () => {
            const state = createRetainerMoraleState();
            // First end of adventure
            const first = checkRetainerMoraleTrigger(state, "end-of-adventure");
            expect(first).toBeDefined();
            expect(first?.trigger).toBe("end-of-adventure");
            // Second end of adventure (same state since it doesn't change)
            const second = checkRetainerMoraleTrigger(state, "end-of-adventure");
            expect(second).toBeDefined();
        });
        it("should allow combat and danger to trigger separately", () => {
            let state = createRetainerMoraleState();
            // Combat first
            const combat = checkRetainerMoraleTrigger(state, "combat");
            state = combat?.newState ?? state;
            // Danger should still trigger
            const danger = checkRetainerMoraleTrigger(state, "danger");
            expect(danger).toBeDefined();
            expect(danger?.trigger).toBe("first-danger");
        });
    });
    describe("resetRetainerMoraleForNewAdventure", () => {
        it("should reset all checks", () => {
            const oldState = {
                firstCombatChecked: true,
                firstDangerChecked: true,
            };
            const newState = resetRetainerMoraleForNewAdventure(oldState);
            expect(newState.firstCombatChecked).toBe(false);
            expect(newState.firstDangerChecked).toBe(false);
        });
    });
});
// =============================================================================
// Immunity Tests
// =============================================================================
describe("Morale Immunity", () => {
    describe("isImmuneToMorale", () => {
        it("should identify immune creature types", () => {
            expect(isImmuneToMorale("automaton")).toBe(true);
            expect(isImmuneToMorale("construct")).toBe(true);
            expect(isImmuneToMorale("golem")).toBe(true);
            expect(isImmuneToMorale("animated statue")).toBe(true);
            expect(isImmuneToMorale("mindless zombie")).toBe(true);
            expect(isImmuneToMorale("ooze")).toBe(true);
        });
        it("should not mark normal creatures as immune", () => {
            expect(isImmuneToMorale("goblin")).toBe(false);
            expect(isImmuneToMorale("orc")).toBe(false);
            expect(isImmuneToMorale("dragon")).toBe(false);
            expect(isImmuneToMorale("skeleton")).toBe(false); // Not mindless by default
        });
        it("should be case-insensitive", () => {
            expect(isImmuneToMorale("GOLEM")).toBe(true);
            expect(isImmuneToMorale("Construct")).toBe(true);
        });
    });
    describe("hasImmuneTraits", () => {
        it("should detect immune traits", () => {
            expect(hasImmuneTraits(["mindless"])).toBe(true);
            expect(hasImmuneTraits(["fearless"])).toBe(true);
            expect(hasImmuneTraits(["immune to fear"])).toBe(true);
            expect(hasImmuneTraits(["immune to morale"])).toBe(true);
        });
        it("should handle multiple traits", () => {
            expect(hasImmuneTraits(["fast", "mindless", "tough"])).toBe(true);
            expect(hasImmuneTraits(["fast", "tough", "scary"])).toBe(false);
        });
        it("should be case-insensitive", () => {
            expect(hasImmuneTraits(["MINDLESS"])).toBe(true);
            expect(hasImmuneTraits(["Fearless"])).toBe(true);
        });
    });
});
// =============================================================================
// Situational Modifier Tests
// =============================================================================
describe("Situational Modifiers", () => {
    describe("getSuggestedModifier", () => {
        it("should suggest +4 for strong fight motivation", () => {
            expect(getSuggestedModifier("defending cubs")).toBe(4);
            expect(getSuggestedModifier("mother defending young")).toBe(4);
            expect(getSuggestedModifier("sacred shrine")).toBe(4);
            expect(getSuggestedModifier("cornered with no escape")).toBe(4);
        });
        it("should suggest +2 for moderate fight motivation", () => {
            expect(getSuggestedModifier("defending home")).toBe(2);
            expect(getSuggestedModifier("outnumber the enemy")).toBe(2);
            expect(getSuggestedModifier("clearly winning")).toBe(2);
        });
        it("should suggest -2 for moderate flee motivation", () => {
            expect(getSuggestedModifier("outmatched")).toBe(-2);
            expect(getSuggestedModifier("clearly losing")).toBe(-2);
            expect(getSuggestedModifier("wounded leader")).toBe(-2);
        });
        it("should suggest -4 for strong flee motivation", () => {
            expect(getSuggestedModifier("slave forced to fight")).toBe(-4);
            expect(getSuggestedModifier("unwilling combatant")).toBe(-4);
            expect(getSuggestedModifier("coerced into battle")).toBe(-4);
            expect(getSuggestedModifier("just hungry for food")).toBe(-4);
            expect(getSuggestedModifier("leader slain")).toBe(-4);
        });
        it("should return 0 for neutral scenarios", () => {
            expect(getSuggestedModifier("normal combat")).toBe(0);
            expect(getSuggestedModifier("random encounter")).toBe(0);
        });
    });
});
// =============================================================================
// Format Result Tests
// =============================================================================
describe("formatMoraleResult", () => {
    it("should format passing result", () => {
        const result = {
            roll: 15,
            total: 18,
            dc: 11,
            passed: true,
            immune: false,
            modifiers: [{ source: "will", value: 3, label: "Will save" }],
            trigger: "half-hp-lost",
            outcome: "fights",
        };
        const formatted = formatMoraleResult(result);
        expect(formatted).toContain("15");
        expect(formatted).toContain("18");
        expect(formatted).toContain("11");
        expect(formatted).toContain("PASSES");
        expect(formatted).toContain("fighting");
    });
    it("should format failing result", () => {
        const result = {
            roll: 5,
            total: 7,
            dc: 11,
            passed: false,
            immune: false,
            modifiers: [{ source: "will", value: 2, label: "Will save" }],
            trigger: "first-ally-slain",
            outcome: "flees",
        };
        const formatted = formatMoraleResult(result);
        expect(formatted).toContain("FAILS");
        expect(formatted).toContain("flee");
    });
    it("should format immune result", () => {
        const result = {
            roll: 0,
            total: 0,
            dc: 11,
            passed: true,
            immune: true,
            modifiers: [],
            trigger: "half-hp-lost",
            outcome: "immune",
        };
        const formatted = formatMoraleResult(result);
        expect(formatted).toContain("Immune");
        expect(formatted).toContain("mindless");
    });
});
// =============================================================================
// Integration Tests
// =============================================================================
describe("Morale Integration", () => {
    it("should handle a complete group combat scenario", () => {
        // 5 goblins vs party
        let groupState = createGroupMoraleState(5);
        const goblinWillSave = 1;
        // Party kills first goblin
        const firstCasualty = checkGroupMoraleTrigger(groupState, 1);
        expect(firstCasualty?.trigger).toBe("first-ally-slain");
        groupState = firstCasualty?.newState ?? groupState;
        // Make morale check (roll 8 + 1 = 9, fails)
        const firstCheck = makeMoraleCheck({
            entityType: "monster",
            willSave: goblinWillSave,
            trigger: "first-ally-slain",
        }, createMockRoller(8));
        expect(firstCheck.passed).toBe(false);
        // Goblins would flee after first casualty!
        // If they had passed, continue...
        // Kill another goblin
        const secondCasualty = checkGroupMoraleTrigger(groupState, 1);
        // Should not trigger (not at half yet)
        expect(secondCasualty).toBeUndefined();
        // Kill one more (now 2 active out of 5 - past half)
        groupState = { ...groupState, activeCreatures: 3 };
        const thirdCasualty = checkGroupMoraleTrigger(groupState, 1);
        expect(thirdCasualty?.trigger).toBe("half-allies-down");
    });
    it("should handle retainer morale through an adventure", () => {
        let retainerState = createRetainerMoraleState();
        const retainerWillSave = 2;
        const employerPersonalityMod = 1;
        // Enter dungeon, encounter trap (first danger)
        const trapTrigger = checkRetainerMoraleTrigger(retainerState, "danger");
        expect(trapTrigger?.trigger).toBe("first-danger");
        retainerState = trapTrigger?.newState ?? retainerState;
        // Morale check for trap (roll 10 + 2 + 1 = 13, passes)
        const trapCheck = makeMoraleCheck({
            entityType: "retainer",
            willSave: retainerWillSave,
            trigger: "first-danger",
            employerPersonalityMod,
        }, createMockRoller(10));
        expect(trapCheck.passed).toBe(true);
        // First combat encounter
        const combatTrigger = checkRetainerMoraleTrigger(retainerState, "combat");
        expect(combatTrigger?.trigger).toBe("first-combat");
        retainerState = combatTrigger?.newState ?? retainerState;
        // End of adventure check
        const endTrigger = checkRetainerMoraleTrigger(retainerState, "end-of-adventure");
        expect(endTrigger?.trigger).toBe("end-of-adventure");
        // New adventure - reset state
        retainerState = resetRetainerMoraleForNewAdventure(retainerState);
        expect(retainerState.firstCombatChecked).toBe(false);
        expect(retainerState.firstDangerChecked).toBe(false);
    });
    it("should handle immune creatures correctly", () => {
        const creatureState = createCreatureMoraleState(50);
        // Iron golem takes heavy damage
        const damageTrigger = checkCreatureMoraleTrigger(creatureState, 30);
        expect(damageTrigger?.trigger).toBe("half-hp-lost");
        // But it's immune!
        const moraleCheck = makeMoraleCheck({
            entityType: "monster",
            willSave: 0,
            trigger: "half-hp-lost",
            isImmune: true,
        }, createMockRoller(1));
        expect(moraleCheck.immune).toBe(true);
        expect(moraleCheck.passed).toBe(true);
        expect(moraleCheck.outcome).toBe("immune");
    });
});
//# sourceMappingURL=morale.test.js.map