/**
 * Bonus System Tests
 */
import { describe, it, expect } from "vitest";
import { createAbilityBonus, createLevelBonus, createLuckBonus, createEquipmentBonus, createSpellBonus, createAssistBonus, createJudgeBonus, createDiceChainBonus, computeBonuses, mergeBonuses, getTotalModifier, getDiceChainSteps, createEmptyBonusList, } from "./bonuses.js";
describe("Bonus Builders", () => {
    describe("createAbilityBonus", () => {
        it("creates a strength bonus", () => {
            const bonus = createAbilityBonus("str", "Strength", 2);
            expect(bonus.id).toBe("ability:str");
            expect(bonus.label).toBe("Strength");
            expect(bonus.source.type).toBe("ability");
            expect(bonus.source.id).toBe("str");
            expect(bonus.category).toBe("inherent");
            expect(bonus.effect).toEqual({ type: "modifier", value: 2 });
        });
        it("creates a negative modifier", () => {
            const bonus = createAbilityBonus("int", "Intelligence", -1);
            expect(bonus.effect).toEqual({ type: "modifier", value: -1 });
        });
    });
    describe("createLevelBonus", () => {
        it("creates a level bonus with default label", () => {
            const bonus = createLevelBonus("thief", 3, 5);
            expect(bonus.id).toBe("class:thief:level");
            expect(bonus.label).toBe("Level 3");
            expect(bonus.source.type).toBe("class");
            expect(bonus.category).toBe("inherent");
            expect(bonus.effect).toEqual({ type: "modifier", value: 5 });
        });
        it("creates a level bonus with custom label", () => {
            const bonus = createLevelBonus("thief", 3, 5, "Thief skill bonus");
            expect(bonus.label).toBe("Thief skill bonus");
        });
    });
    describe("createLuckBonus", () => {
        it("creates a simple luck burn bonus", () => {
            const bonus = createLuckBonus(3);
            expect(bonus.id).toBe("luck:burn");
            expect(bonus.label).toBe("Luck (3 burned)");
            expect(bonus.source.type).toBe("luck");
            expect(bonus.category).toBe("luck");
            expect(bonus.effect).toEqual({ type: "modifier", value: 3 });
        });
        it("creates a multiplied luck bonus (for lucky signs)", () => {
            const bonus = createLuckBonus(2, 2);
            expect(bonus.label).toBe("Luck (2 × 2)");
            expect(bonus.effect).toEqual({ type: "modifier", value: 4 });
        });
    });
    describe("createEquipmentBonus", () => {
        it("creates an equipment bonus", () => {
            const bonus = createEquipmentBonus("ring-of-protection-1", "Ring of Protection +1", 1);
            expect(bonus.id).toBe("item:ring-of-protection-1");
            expect(bonus.label).toBe("Ring of Protection +1");
            expect(bonus.source.type).toBe("item");
            expect(bonus.category).toBe("equipment");
            expect(bonus.effect).toEqual({ type: "modifier", value: 1 });
        });
    });
    describe("createSpellBonus", () => {
        it("creates a spell modifier bonus", () => {
            const bonus = createSpellBonus("enlarge", "Enlarge", {
                type: "modifier",
                value: 2,
            });
            expect(bonus.id).toBe("spell:enlarge");
            expect(bonus.source.type).toBe("spell");
            expect(bonus.category).toBe("spell");
            expect(bonus.effect).toEqual({ type: "modifier", value: 2 });
        });
        it("creates a spell dice chain bonus", () => {
            const bonus = createSpellBonus("strengthen", "Strengthen", {
                type: "dice-chain",
                steps: 1,
            });
            expect(bonus.effect).toEqual({ type: "dice-chain", steps: 1 });
        });
    });
    describe("createAssistBonus", () => {
        it("creates an assist bonus with default value", () => {
            const bonus = createAssistBonus("Grimgor");
            expect(bonus.id).toBe("assist:grimgor");
            expect(bonus.label).toBe("Assist (Grimgor)");
            expect(bonus.source.type).toBe("assist");
            expect(bonus.category).toBe("circumstance");
            expect(bonus.effect).toEqual({ type: "modifier", value: 2 });
        });
        it("creates an assist bonus with custom value", () => {
            const bonus = createAssistBonus("The Party", 4);
            expect(bonus.effect).toEqual({ type: "modifier", value: 4 });
        });
    });
    describe("createJudgeBonus", () => {
        it("creates a judge modifier bonus", () => {
            const bonus = createJudgeBonus("High ground", {
                type: "modifier",
                value: 2,
            });
            expect(bonus.id).toBe("judge:high-ground");
            expect(bonus.label).toBe("High ground");
            expect(bonus.source.type).toBe("judge");
            expect(bonus.category).toBe("circumstance");
        });
        it("creates a judge dice chain bonus", () => {
            const bonus = createJudgeBonus("Favorable conditions", {
                type: "dice-chain",
                steps: 1,
            });
            expect(bonus.effect).toEqual({ type: "dice-chain", steps: 1 });
        });
    });
    describe("createDiceChainBonus", () => {
        it("creates a dice chain bump with high priority", () => {
            const bonus = createDiceChainBonus({ type: "spell", id: "haste" }, 2, "Haste");
            expect(bonus.effect).toEqual({ type: "dice-chain", steps: 2 });
            expect(bonus.priority).toBe(10);
        });
    });
});
describe("computeBonuses", () => {
    it("computes total modifier from multiple bonuses", () => {
        const bonuses = [
            createAbilityBonus("str", "Strength", 2),
            createLevelBonus("warrior", 3, 3),
            createLuckBonus(2),
        ];
        const result = computeBonuses(bonuses);
        expect(result.totalModifier).toBe(7); // 2 + 3 + 2
        expect(result.appliedBonuses).toHaveLength(3);
    });
    it("computes dice chain steps", () => {
        const bonuses = [
            createJudgeBonus("High ground", { type: "dice-chain", steps: 1 }),
            createSpellBonus("haste", "Haste", { type: "dice-chain", steps: 1 }),
        ];
        const result = computeBonuses(bonuses);
        expect(result.diceChainSteps).toBe(2);
    });
    it("handles negative dice chain steps", () => {
        const bonuses = [
            createJudgeBonus("Difficult terrain", { type: "dice-chain", steps: -1 }),
            createSpellBonus("slow", "Slow", { type: "dice-chain", steps: -1 }),
        ];
        const result = computeBonuses(bonuses);
        expect(result.diceChainSteps).toBe(-2);
    });
    it("collects additional dice", () => {
        const bonuses = [
            createSpellBonus("bless", "Bless", { type: "die", die: "d4" }),
        ];
        const result = computeBonuses(bonuses);
        expect(result.additionalDice).toEqual([{ die: "d4", count: 1 }]);
    });
    it("handles set-die effect", () => {
        const bonus = {
            id: "special",
            label: "Special Die",
            source: { type: "other" },
            category: "circumstance",
            effect: { type: "set-die", die: "d30" },
        };
        const result = computeBonuses([bonus]);
        expect(result.forcedDie).toBe("d30");
    });
    it("handles reroll effect", () => {
        const bonus = {
            id: "advantage",
            label: "Advantage",
            source: { type: "other" },
            category: "circumstance",
            effect: { type: "reroll", mode: "take-higher" },
        };
        const result = computeBonuses([bonus]);
        expect(result.hasReroll).toBe(true);
        expect(result.rerollMode).toBe("take-higher");
    });
    it("filters by condition", () => {
        const bonuses = [
            {
                ...createAbilityBonus("str", "Strength", 2),
                condition: "melee-attack",
            },
            createAbilityBonus("agl", "Agility", 1),
        ];
        // With matching condition
        const meleeResult = computeBonuses(bonuses, "melee-attack");
        expect(meleeResult.totalModifier).toBe(3); // Both apply
        // With non-matching condition
        const rangedResult = computeBonuses(bonuses, "ranged-attack");
        expect(rangedResult.totalModifier).toBe(1); // Only unconditional applies
        // With no condition filter
        const anyResult = computeBonuses(bonuses);
        expect(anyResult.totalModifier).toBe(1); // Only unconditional applies
    });
    it("sorts by priority", () => {
        const bonuses = [
            { ...createAbilityBonus("str", "Strength", 2), priority: 0 },
            { ...createDiceChainBonus({ type: "spell", id: "haste" }, 1, "Haste"), priority: 10 },
            { ...createLuckBonus(3), priority: 5 },
        ];
        const result = computeBonuses(bonuses);
        // Verify order by checking appliedBonuses
        expect(result.appliedBonuses[0]?.id).toBe("chain:spell:haste"); // priority 10
        expect(result.appliedBonuses[1]?.id).toBe("luck:burn"); // priority 5
        expect(result.appliedBonuses[2]?.id).toBe("ability:str"); // priority 0
    });
});
describe("BonusList utilities", () => {
    describe("createEmptyBonusList", () => {
        it("creates an empty list", () => {
            const list = createEmptyBonusList();
            expect(list.inherent).toEqual([]);
            expect(list.situational).toEqual([]);
        });
    });
    describe("mergeBonuses", () => {
        it("merges inherent and situational bonuses", () => {
            const list = {
                inherent: [createAbilityBonus("str", "Strength", 2)],
                situational: [createLuckBonus(3)],
            };
            const merged = mergeBonuses(list);
            expect(merged).toHaveLength(2);
            expect(merged[0]?.id).toBe("ability:str");
            expect(merged[1]?.id).toBe("luck:burn");
        });
    });
    describe("getTotalModifier", () => {
        it("sums only modifier-type bonuses", () => {
            const bonuses = [
                createAbilityBonus("str", "Strength", 2),
                createLuckBonus(3),
                createDiceChainBonus({ type: "judge" }, 1, "Bump"),
            ];
            const total = getTotalModifier(bonuses);
            expect(total).toBe(5); // 2 + 3, ignoring dice chain
        });
    });
    describe("getDiceChainSteps", () => {
        it("sums only dice-chain-type bonuses", () => {
            const bonuses = [
                createAbilityBonus("str", "Strength", 2),
                createDiceChainBonus({ type: "spell", id: "haste" }, 1, "Haste"),
                createDiceChainBonus({ type: "judge" }, 1, "Favorable"),
            ];
            const steps = getDiceChainSteps(bonuses);
            expect(steps).toBe(2); // 1 + 1, ignoring modifier
        });
    });
});
describe("Real-world scenarios", () => {
    it("handles a typical strength check", () => {
        // Strength check with:
        // - STR 16 (+2 modifier)
        // - Level 3 warrior (no skill bonus for ability checks)
        // - Burning 2 luck
        // - Assist from another character
        const bonuses = [
            createAbilityBonus("str", "Strength", 2),
            createLuckBonus(2),
            createAssistBonus("Grimgor"),
        ];
        const result = computeBonuses(bonuses);
        expect(result.totalModifier).toBe(6); // 2 + 2 + 2
        expect(result.diceChainSteps).toBe(0);
        expect(result.appliedBonuses).toHaveLength(3);
    });
    it("handles a thief skill check with progression", () => {
        // Backstab check with:
        // - AGI 14 (+1 modifier)
        // - Level 3 thief (+5 backstab bonus for chaotic)
        // - Magic dagger (+1)
        const bonuses = [
            createAbilityBonus("agl", "Agility", 1),
            createLevelBonus("thief", 3, 5, "Backstab bonus"),
            createEquipmentBonus("magic-dagger", "Dagger +1", 1),
        ];
        const result = computeBonuses(bonuses);
        expect(result.totalModifier).toBe(7); // 1 + 5 + 1
    });
    it("handles spell effects with dice chain", () => {
        // Attack roll with:
        // - STR 12 (0 modifier)
        // - Enlarge spell (+2 to hit, bump die up)
        // - Bless spell (+1d4)
        const bonuses = [
            createAbilityBonus("str", "Strength", 0),
            createSpellBonus("enlarge", "Enlarge", { type: "modifier", value: 2 }),
            createSpellBonus("enlarge-chain", "Enlarge", { type: "dice-chain", steps: 1 }),
            createSpellBonus("bless", "Bless", { type: "die", die: "d4" }),
        ];
        const result = computeBonuses(bonuses);
        expect(result.totalModifier).toBe(2);
        expect(result.diceChainSteps).toBe(1);
        expect(result.additionalDice).toEqual([{ die: "d4", count: 1 }]);
    });
    it("handles stacking penalties", () => {
        // Attack roll with multiple penalties:
        // - Prone (-2)
        // - Darkness (-2)
        // - Exhausted (-1)
        const bonuses = [
            {
                id: "condition:prone",
                label: "Prone",
                source: { type: "condition", id: "prone" },
                category: "circumstance",
                effect: { type: "modifier", value: -2 },
            },
            {
                id: "condition:darkness",
                label: "Darkness",
                source: { type: "condition", id: "darkness" },
                category: "circumstance",
                effect: { type: "modifier", value: -2 },
            },
            {
                id: "condition:exhausted",
                label: "Exhausted",
                source: { type: "condition", id: "exhausted" },
                category: "circumstance",
                effect: { type: "modifier", value: -1 },
            },
        ];
        const result = computeBonuses(bonuses);
        expect(result.totalModifier).toBe(-5); // All stack
    });
});
//# sourceMappingURL=bonuses.test.js.map