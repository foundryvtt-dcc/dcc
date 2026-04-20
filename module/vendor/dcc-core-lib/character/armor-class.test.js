/**
 * Armor Class Calculation Tests
 */
import { describe, it, expect } from "vitest";
import { calculateAC, calculateSimpleAC, createArmorStats, createMagicArmorStats, createShieldStats, getArmorACBonus, getArmorDetails, getAllArmorStats, BASE_AC, ARMOR_AC_BONUS, SHIELD_AC_BONUS, } from "./armor-class.js";
describe("AC Constants", () => {
    it("has correct base AC", () => {
        expect(BASE_AC).toBe(10);
    });
    it("has correct shield AC bonus", () => {
        expect(SHIELD_AC_BONUS).toBe(1);
    });
    it("has correct armor AC bonuses", () => {
        expect(ARMOR_AC_BONUS.unarmored).toBe(0);
        expect(ARMOR_AC_BONUS.padded).toBe(1);
        expect(ARMOR_AC_BONUS.leather).toBe(2);
        expect(ARMOR_AC_BONUS.hide).toBe(3);
        expect(ARMOR_AC_BONUS.scale).toBe(4);
        expect(ARMOR_AC_BONUS.chainmail).toBe(5);
        expect(ARMOR_AC_BONUS.banded).toBe(6);
        expect(ARMOR_AC_BONUS["half-plate"]).toBe(7);
        expect(ARMOR_AC_BONUS["full-plate"]).toBe(8);
    });
});
describe("calculateSimpleAC", () => {
    it("calculates unarmored AC with positive agility", () => {
        const ac = calculateSimpleAC(2);
        expect(ac).toBe(12); // 10 + 2
    });
    it("calculates unarmored AC with negative agility", () => {
        const ac = calculateSimpleAC(-2);
        expect(ac).toBe(8); // 10 - 2
    });
    it("calculates leather armor AC", () => {
        const ac = calculateSimpleAC(1, "leather");
        expect(ac).toBe(13); // 10 + 1 + 2
    });
    it("calculates chainmail AC", () => {
        const ac = calculateSimpleAC(0, "chainmail");
        expect(ac).toBe(15); // 10 + 0 + 5
    });
    it("calculates full plate AC", () => {
        const ac = calculateSimpleAC(-1, "full-plate");
        expect(ac).toBe(17); // 10 - 1 + 8
    });
    it("adds shield bonus", () => {
        const ac = calculateSimpleAC(1, "leather", true);
        expect(ac).toBe(14); // 10 + 1 + 2 + 1
    });
    it("calculates max AC (full plate, shield, good agility)", () => {
        const ac = calculateSimpleAC(3, "full-plate", true);
        expect(ac).toBe(22); // 10 + 3 + 8 + 1
    });
    it("allows very low AC with negative agility", () => {
        const ac = calculateSimpleAC(-3);
        expect(ac).toBe(7); // 10 - 3
    });
});
describe("calculateAC", () => {
    it("calculates basic unarmored AC", () => {
        const result = calculateAC({ agilityModifier: 0 });
        expect(result.total).toBe(10);
        expect(result.base).toBe(10);
        expect(result.agilityBonus).toBe(0);
        expect(result.armorBonus).toBe(0);
        expect(result.shieldBonus).toBe(0);
        expect(result.otherBonuses).toBe(0);
    });
    it("includes agility modifier", () => {
        const result = calculateAC({ agilityModifier: 3 });
        expect(result.total).toBe(13);
        expect(result.agilityBonus).toBe(3);
        expect(result.breakdown).toContainEqual({ source: "Agility", value: 3 });
    });
    it("includes negative agility modifier", () => {
        const result = calculateAC({ agilityModifier: -2 });
        expect(result.total).toBe(8);
        expect(result.agilityBonus).toBe(-2);
        expect(result.breakdown).toContainEqual({ source: "Agility", value: -2 });
    });
    it("includes armor bonus", () => {
        const armor = createArmorStats("chainmail");
        const result = calculateAC({
            agilityModifier: 1,
            armor,
        });
        expect(result.total).toBe(16); // 10 + 1 + 5
        expect(result.armorBonus).toBe(5);
        expect(result.breakdown).toContainEqual({ source: "Chainmail", value: 5 });
    });
    it("includes shield bonus", () => {
        const shield = createShieldStats();
        const result = calculateAC({
            agilityModifier: 0,
            shield,
        });
        expect(result.total).toBe(11); // 10 + 0 + 0 + 1
        expect(result.shieldBonus).toBe(1);
        expect(result.breakdown).toContainEqual({ source: "Shield", value: 1 });
    });
    it("combines armor and shield", () => {
        const armor = createArmorStats("leather");
        const shield = createShieldStats();
        const result = calculateAC({
            agilityModifier: 2,
            armor,
            shield,
        });
        expect(result.total).toBe(15); // 10 + 2 + 2 + 1
        expect(result.armorBonus).toBe(2);
        expect(result.shieldBonus).toBe(1);
    });
    it("includes magic armor bonus", () => {
        const armor = createMagicArmorStats("leather", 2);
        const result = calculateAC({
            agilityModifier: 1,
            armor,
        });
        // 10 + 1 + 2 (base leather) + 2 (magic) = 15
        expect(result.total).toBe(15);
        expect(result.armorBonus).toBe(4); // 2 base + 2 magic
        expect(result.breakdown).toContainEqual({
            source: "+2 Leather Armor (magic)",
            value: 2,
        });
    });
    it("includes magic shield bonus", () => {
        const shield = createShieldStats("Shield", 1);
        const result = calculateAC({
            agilityModifier: 0,
            shield,
        });
        // 10 + 0 + 1 (base shield) + 1 (magic) = 12
        expect(result.total).toBe(12);
        expect(result.shieldBonus).toBe(2); // 1 base + 1 magic
    });
    it("includes spell bonuses", () => {
        const result = calculateAC({
            agilityModifier: 0,
            bonuses: [
                {
                    value: 2,
                    source: { name: "Shield spell", category: "spell" },
                },
            ],
        });
        expect(result.total).toBe(12); // 10 + 0 + 0 + 0 + 2
        expect(result.otherBonuses).toBe(2);
        expect(result.breakdown).toContainEqual({
            source: "Shield spell",
            value: 2,
        });
    });
    it("combines all bonuses", () => {
        const armor = createMagicArmorStats("chainmail", 1);
        const shield = createShieldStats("Tower Shield", 1);
        const result = calculateAC({
            agilityModifier: 2,
            armor,
            shield,
            bonuses: [
                {
                    value: 1,
                    source: { name: "Ring of Protection", category: "equipment" },
                },
            ],
        });
        // 10 + 2 (agi) + 5 (chainmail) + 1 (magic armor) + 1 (shield) + 1 (magic shield) + 1 (ring) = 21
        expect(result.total).toBe(21);
        expect(result.breakdown.length).toBeGreaterThan(0);
    });
    it("provides complete breakdown", () => {
        const armor = createArmorStats("scale");
        const shield = createShieldStats();
        const result = calculateAC({
            agilityModifier: 1,
            armor,
            shield,
        });
        expect(result.breakdown).toContainEqual({ source: "Base", value: 10 });
        expect(result.breakdown).toContainEqual({ source: "Agility", value: 1 });
        expect(result.breakdown).toContainEqual({ source: "Scale Mail", value: 4 });
        expect(result.breakdown).toContainEqual({ source: "Shield", value: 1 });
    });
    it("does not add agility to breakdown when zero", () => {
        const result = calculateAC({ agilityModifier: 0 });
        const agilityEntry = result.breakdown.find((b) => b.source === "Agility");
        expect(agilityEntry).toBeUndefined();
    });
});
describe("createArmorStats", () => {
    it("creates correct stats for each armor type", () => {
        const types = [
            "unarmored",
            "padded",
            "leather",
            "studded-leather",
            "hide",
            "scale",
            "chainmail",
            "banded",
            "half-plate",
            "full-plate",
        ];
        for (const type of types) {
            const armor = createArmorStats(type);
            expect(armor.type).toBe(type);
            expect(armor.acBonus).toBe(ARMOR_AC_BONUS[type]);
            expect(armor.checkPenalty).toBeLessThanOrEqual(0);
            expect(armor.speedPenalty).toBeLessThanOrEqual(0);
            expect(armor.fumbleDie).toBeTruthy();
        }
    });
    it("allows custom name", () => {
        const armor = createArmorStats("leather", "Worn Leather Jerkin");
        expect(armor.name).toBe("Worn Leather Jerkin");
        expect(armor.type).toBe("leather");
        expect(armor.acBonus).toBe(2);
    });
    it("has default names", () => {
        expect(createArmorStats("unarmored").name).toBe("Unarmored");
        expect(createArmorStats("chainmail").name).toBe("Chainmail");
        expect(createArmorStats("full-plate").name).toBe("Full Plate");
    });
});
describe("createMagicArmorStats", () => {
    it("creates +1 armor", () => {
        const armor = createMagicArmorStats("leather", 1);
        expect(armor.name).toBe("+1 Leather Armor");
        expect(armor.type).toBe("leather");
        expect(armor.acBonus).toBe(2);
        expect(armor.magicBonus).toBe(1);
    });
    it("creates +3 armor", () => {
        const armor = createMagicArmorStats("chainmail", 3);
        expect(armor.name).toBe("+3 Chainmail");
        expect(armor.magicBonus).toBe(3);
    });
    it("reduces check penalty", () => {
        // Chainmail has -5 check penalty
        const normalChainmail = createArmorStats("chainmail");
        expect(normalChainmail.checkPenalty).toBe(-5);
        // +2 chainmail reduces penalty to -3
        const magicChainmail = createMagicArmorStats("chainmail", 2);
        expect(magicChainmail.checkPenalty).toBe(-3);
    });
    it("check penalty cannot go above 0", () => {
        // Leather has -1 check penalty (Table 3-3)
        const normalLeather = createArmorStats("leather");
        expect(normalLeather.checkPenalty).toBe(-1);
        // +3 leather would be +2, but capped at 0
        const magicLeather = createMagicArmorStats("leather", 3);
        expect(magicLeather.checkPenalty).toBe(0);
    });
    it("allows custom name for magic armor", () => {
        const armor = createMagicArmorStats("chainmail", 2, "Elven Chain");
        expect(armor.name).toBe("Elven Chain");
        expect(armor.magicBonus).toBe(2);
    });
});
describe("createShieldStats", () => {
    it("creates basic shield", () => {
        const shield = createShieldStats();
        expect(shield.name).toBe("Shield");
        expect(shield.acBonus).toBe(1);
        expect(shield.magicBonus).toBeUndefined();
    });
    it("creates named shield", () => {
        const shield = createShieldStats("Buckler");
        expect(shield.name).toBe("Buckler");
        expect(shield.acBonus).toBe(1);
    });
    it("creates magic shield", () => {
        const shield = createShieldStats("Shield", 2);
        expect(shield.name).toBe("+2 Shield");
        expect(shield.acBonus).toBe(1);
        expect(shield.magicBonus).toBe(2);
    });
});
describe("getArmorACBonus", () => {
    it("returns correct bonus for each armor type", () => {
        expect(getArmorACBonus("unarmored")).toBe(0);
        expect(getArmorACBonus("padded")).toBe(1);
        expect(getArmorACBonus("leather")).toBe(2);
        expect(getArmorACBonus("hide")).toBe(3);
        expect(getArmorACBonus("scale")).toBe(4);
        expect(getArmorACBonus("chainmail")).toBe(5);
        expect(getArmorACBonus("banded")).toBe(6);
        expect(getArmorACBonus("half-plate")).toBe(7);
        expect(getArmorACBonus("full-plate")).toBe(8);
    });
});
describe("getArmorDetails", () => {
    it("returns all stats for armor type", () => {
        const details = getArmorDetails("chainmail");
        expect(details.acBonus).toBe(5);
        expect(details.checkPenalty).toBe(-5);
        expect(details.speedPenalty).toBe(-5);
        expect(details.fumbleDie).toBe("d12");
    });
    it("returns correct stats for unarmored", () => {
        const details = getArmorDetails("unarmored");
        expect(details.acBonus).toBe(0);
        expect(details.checkPenalty).toBe(0);
        expect(details.speedPenalty).toBe(0);
        expect(details.fumbleDie).toBe("d4");
    });
    it("returns correct stats for full plate", () => {
        const details = getArmorDetails("full-plate");
        expect(details.acBonus).toBe(8);
        expect(details.checkPenalty).toBe(-8);
        expect(details.speedPenalty).toBe(-10);
        expect(details.fumbleDie).toBe("d16");
    });
});
describe("getAllArmorStats", () => {
    it("returns all 10 armor types (Table 3-3 incl. studded leather)", () => {
        const all = getAllArmorStats();
        expect(all.length).toBe(10);
    });
    it("returns armor types in order", () => {
        const all = getAllArmorStats();
        expect(all[0]?.type).toBe("unarmored");
        expect(all[9]?.type).toBe("full-plate");
    });
    it("includes all required properties", () => {
        const all = getAllArmorStats();
        for (const armor of all) {
            expect(armor.type).toBeTruthy();
            expect(armor.name).toBeTruthy();
            expect(typeof armor.acBonus).toBe("number");
            expect(typeof armor.checkPenalty).toBe("number");
            expect(typeof armor.speedPenalty).toBe("number");
            expect(armor.fumbleDie).toBeTruthy();
        }
    });
    it("AC bonus increases with armor heaviness", () => {
        const all = getAllArmorStats();
        let prevBonus = -1;
        for (const armor of all) {
            expect(armor.acBonus).toBeGreaterThanOrEqual(prevBonus);
            prevBonus = armor.acBonus;
        }
    });
});
describe("AC calculation edge cases", () => {
    it("handles extreme negative agility", () => {
        const result = calculateAC({ agilityModifier: -5 });
        expect(result.total).toBe(5); // 10 - 5
    });
    it("handles extreme positive agility", () => {
        const result = calculateAC({ agilityModifier: 5 });
        expect(result.total).toBe(15); // 10 + 5
    });
    it("allows AC below 0 (theoretically)", () => {
        const result = calculateAC({ agilityModifier: -15 });
        expect(result.total).toBe(-5); // 10 - 15
    });
    it("handles multiple bonuses from different sources", () => {
        const result = calculateAC({
            agilityModifier: 1,
            bonuses: [
                { value: 1, source: { name: "Mage Armor", category: "spell" } },
                { value: 2, source: { name: "Shield of Faith", category: "spell" } },
                { value: 1, source: { name: "Ring of Protection", category: "equipment" } },
            ],
        });
        // 10 + 1 + 4 (bonuses) = 15
        expect(result.total).toBe(15);
        expect(result.otherBonuses).toBe(4);
    });
    it("ignores zero-value bonuses in calculation", () => {
        const result = calculateAC({
            agilityModifier: 1,
            bonuses: [
                { value: 0, source: { name: "Expired Buff", category: "spell" } },
            ],
        });
        // Zero bonus still gets added to breakdown but doesn't change total
        expect(result.total).toBe(11);
    });
});
describe("Real-world AC scenarios", () => {
    it("typical 0-level peasant", () => {
        const ac = calculateSimpleAC(0);
        expect(ac).toBe(10);
    });
    it("agile unarmored thief", () => {
        const ac = calculateSimpleAC(3);
        expect(ac).toBe(13);
    });
    it("warrior in chainmail with shield", () => {
        const ac = calculateSimpleAC(1, "chainmail", true);
        expect(ac).toBe(17); // 10 + 1 + 5 + 1
    });
    it("clumsy knight in full plate", () => {
        const ac = calculateSimpleAC(-1, "full-plate", true);
        expect(ac).toBe(18); // 10 - 1 + 8 + 1
    });
    it("wizard with mage armor spell", () => {
        const result = calculateAC({
            agilityModifier: 1,
            bonuses: [
                { value: 4, source: { name: "Mage Armor", category: "spell" } },
            ],
        });
        expect(result.total).toBe(15); // 10 + 1 + 4
    });
    it("dwarf with +2 chainmail", () => {
        const armor = createMagicArmorStats("chainmail", 2);
        const result = calculateAC({
            agilityModifier: 0,
            armor,
        });
        expect(result.total).toBe(17); // 10 + 0 + 5 + 2
        expect(armor.checkPenalty).toBe(-3); // -5 + 2 = -3
    });
    it("halfling with leather and magic shield", () => {
        const armor = createArmorStats("leather");
        const shield = createShieldStats("Small Shield", 1);
        const result = calculateAC({
            agilityModifier: 2,
            armor,
            shield,
        });
        expect(result.total).toBe(16); // 10 + 2 + 2 + 1 + 1
    });
});
//# sourceMappingURL=armor-class.test.js.map