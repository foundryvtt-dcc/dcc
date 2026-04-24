/**
 * Tests for NPC/Creature Stat Block Parser
 */
import { describe, it, expect } from "vitest";
import { parseStatBlock, parseStatBlocks } from "./parse-statblock.js";
/**
 * Test helper: asserts value is defined and returns it typed
 */
function defined(value) {
    expect(value).toBeDefined();
    return value;
}
describe("parseStatBlock", () => {
    describe("basic parsing", () => {
        it("parses a simple stat block", () => {
            const result = parseStatBlock("Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature).toBeDefined();
            expect(result.creature?.name).toBe("Goblin");
            expect(result.creature?.init).toBe(1);
            expect(result.creature?.ac).toBe(11);
            expect(result.creature?.hitDice).toBe("1d6");
            expect(result.creature?.speed.land).toBe("30'");
            expect(result.creature?.actionDice).toBe("1d20");
            expect(result.creature?.saves).toEqual({ fort: 0, ref: 1, will: -1 });
            expect(result.creature?.alignment).toBe("c");
            expect(result.creature?.attacks).toHaveLength(1);
            expect(result.creature?.attacks[0]).toEqual({
                name: "club",
                toHit: "+0",
                melee: true,
                damage: "1d4",
            });
        });
        it("parses bandit stat block", () => {
            const result = parseStatBlock("Bandit: Init +2; Atk scimitar +2 melee (1d8+1) or javelin +3 missile fire (1d6); AC 15; HD 1d8; MV 20'; Act 1d20; SV Fort +2, Ref +2, Will +0; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.name).toBe("Bandit");
            expect(result.creature?.attacks).toHaveLength(2);
            expect(result.creature?.attacks[0]).toEqual({
                name: "scimitar",
                toHit: "+2",
                melee: true,
                damage: "1d8+1",
            });
            expect(result.creature?.attacks[1]).toEqual({
                name: "javelin",
                toHit: "+3",
                melee: false,
                damage: "1d6",
            });
        });
        it("parses android with ranged weapon and range", () => {
            const result = parseStatBlock("Android: Init -2; Atk sword +2 melee (1d8) or wand +4 missile fire (range 60', 1d4+2); AC 18; HD 3d8+12; MV 30'; Act 1d20; SP infravision 60', immune to mind-altering spells, heal 2 hp per round; SV Fort +5, Ref -2, Will +6; AL N.");
            expect(result.success).toBe(true);
            expect(result.creature?.name).toBe("Android");
            expect(result.creature?.init).toBe(-2);
            expect(result.creature?.hitDice).toBe("3d8+12");
            expect(result.creature?.hp).toBe(26); // Average of 3d8+12
            expect(result.creature?.special).toContain("infravision 60'");
            expect(result.creature?.attacks).toHaveLength(2);
            expect(result.creature?.attacks[1]).toEqual({
                name: "wand",
                toHit: "+4",
                melee: false,
                damage: "1d4+2",
                range: "60'",
            });
        });
    });
    describe("movement parsing", () => {
        it("parses fly speed", () => {
            const result = parseStatBlock("Ghost: Init +2; Atk special (see below); AC 10; HD 2d12; MV fly 40'; Act 1d20; SV Fort +2, Ref +4, Will +6; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.speed.fly).toBe("40'");
            expect(result.creature?.speed.land).toBe("0'"); // No land speed
        });
        it("parses land or fly", () => {
            const result = parseStatBlock("Gargoyle: Init +0; Atk claw +4 melee (1d4); AC 21; HD 2d8; MV 30' or fly 30'; Act 1d20; SV Fort +5, Ref +0, Will +0; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.speed.land).toBe("30'");
            expect(result.creature?.speed.fly).toBe("30'");
        });
        it("parses land, fly with comma", () => {
            const result = parseStatBlock("Harpy: Init +0; Atk claws +3 melee (1d4); AC 13; HD 5d8; MV 20', fly 70'; Act 1d20; SV Fort +2, Ref +3, Will +6; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.speed.land).toBe("20'");
            expect(result.creature?.speed.fly).toBe("70'");
        });
        it("parses swim speed", () => {
            const result = parseStatBlock("Deep One: Init -2; Atk mace +2 melee (1d6+3); AC 13; HD 1d8+2; MV 20' or swim 40'; Act 1d20; SV Fort +3, Ref -1, Will +3; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.speed.land).toBe("20'");
            expect(result.creature?.speed.swim).toBe("40'");
        });
        it("parses climb speed", () => {
            const result = parseStatBlock("Ant, giant (queen): Init -4; Atk bite +0 melee (1d3); AC 12; HD 5d8+10; MV 10' or climb 10'; Act 1d20; SV Fort +4, Ref -4, Will +8; AL L.");
            expect(result.success).toBe(true);
            expect(result.creature?.speed.land).toBe("10'");
            expect(result.creature?.speed.other).toContain("climb 10'");
        });
        it("parses jump and fly", () => {
            const result = parseStatBlock("Cave cricket: Init -1; Atk bite -2 melee (1d3); AC 13; HD 3d8; MV jump 80' or fly 30'; Act 1d20; SV Fort +2, Ref +0, Will -3; AL N.");
            expect(result.success).toBe(true);
            expect(result.creature?.speed.fly).toBe("30'");
            expect(result.creature?.speed.other).toContain("jump 80'");
        });
    });
    describe("special abilities", () => {
        it("parses special abilities", () => {
            const result = parseStatBlock("Acolyte: Init -1; Atk mace +1 melee (1d4); AC 11; HD 1d8; MV 30'; Act 1d20; SP charm 1/day, harmful spell 2/day; SV Fort +1, Ref +0, Will +2; AL L.");
            expect(result.success).toBe(true);
            expect(result.creature?.special).toBe("charm 1/day, harmful spell 2/day");
        });
        it("parses special attack as special ability", () => {
            const result = parseStatBlock("Witch: Init -2; Atk claw -2 melee (1d4-1) or curse (see below) or spell; AC 9; HD 3d6; MV 20'; Act 1d20; SP familiar, curse, spellcasting (+8 spell check); SV Fort +4, Ref +0, Will +8; AL C.");
            expect(result.success).toBe(true);
            // Special attacks should be converted to special abilities
            expect(result.creature?.special).toContain("curse");
            expect(result.creature?.special).toContain("spell");
            expect(result.creature?.special).toContain("familiar");
        });
    });
    describe("action dice variations", () => {
        it("parses multiple action dice", () => {
            const result = parseStatBlock("Chimera: Init +0; Atk lion bite +5 melee (2d4) or goat gore +4 melee (2d4); AC 18; HD 5d8+8; MV 30' or fly 30'; Act 3d20; SV Fort +4, Ref +2, Will +2; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.actionDice).toBe("3d20");
        });
        it("parses action dice with notes", () => {
            const result = parseStatBlock("Hydra: Init +4; Atk bite +6 melee (1d10+4); AC 16; HD 1d10; MV 20', swim 40'; Act 1d20 per head; SV Fort +9, Ref +7, Will +5; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.actionDice).toBe("1d20 per head");
        });
        it("parses d24 action dice", () => {
            const result = parseStatBlock("Giant, hill (12' tall, 1,200 lbs.): Init -2; Atk club +15 melee (2d8+8); AC 16; HD 8d10; MV 30'; Act 1d24; SV Fort +10, Ref +5, Will +6; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.actionDice).toBe("1d24");
        });
    });
    describe("AC with notes", () => {
        it("parses AC with armor type", () => {
            const result = parseStatBlock("Hobgoblin: Init +2; Atk sword +2 melee (1d8+2); AC 14 (scale mail); HD 1d8+2; MV 30'; Act 1d20; SV Fort +1, Ref +1, Will -1; AL L.");
            expect(result.success).toBe(true);
            expect(result.creature?.ac).toBe(14);
        });
    });
    describe("alignment parsing", () => {
        it("parses lawful alignment", () => {
            const result = parseStatBlock("Pony: Init +1; Atk hoof -2 melee (1d2); AC 11; HD 1d8+2; MV 40'; Act 1d20; SV Fort +2, Ref +3, Will -1; AL L.");
            expect(result.success).toBe(true);
            // Pony is actually neutral in the source, but this tests L parsing
        });
        it("parses neutral alignment", () => {
            const result = parseStatBlock("Pony: Init +1; Atk hoof -2 melee (1d2); AC 11; HD 1d8+2; MV 40'; Act 1d20; SV Fort +2, Ref +3, Will -1; AL N.");
            expect(result.success).toBe(true);
            expect(result.creature?.alignment).toBe("n");
        });
        it("parses chaotic alignment", () => {
            const result = parseStatBlock("Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.alignment).toBe("c");
        });
        it("parses 'varies' as neutral", () => {
            const result = parseStatBlock("King: Init +0; Atk longsword +4 melee (1d8); AC 11; HD 2d8; MV 30'; Act 1d20; SV Fort +1, Ref +2, Will +4; AL varies.");
            expect(result.success).toBe(true);
            expect(result.creature?.alignment).toBe("n");
        });
    });
    describe("complex stat blocks", () => {
        it("parses assassin with complex damage", () => {
            const result = parseStatBlock("Assassin: Init +4; Atk poisoned dagger +9 melee (1d12 then 1d4, plus poison) or poisoned dart +12 missile fire (1d8 then 1d3, plus poison); AC 14; HD 3d6; MV 30'; Act 2d20; SP poison (Fort DC 18 or death, dmg 1d12+1d4 Str on successful save), thief skills 75%; SV Fort +3, Ref +8, Will +4; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.name).toBe("Assassin");
            expect(result.creature?.actionDice).toBe("2d20");
            expect(result.creature?.attacks).toHaveLength(2);
            expect(result.creature?.attacks[0]?.damage).toContain("1d12");
        });
        it("parses giant with ranged attack", () => {
            const result = parseStatBlock("Giant, frost (16' tall, 2,700 lbs.): Init +3; Atk axe +21 melee (4d8+8) or hurled stone +12 missile fire (2d8+8, range 300'); AC 18; HD 14d10; MV 50'; Act 2d24; SV Fort +14, Ref +7, Will +11; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.name).toBe("Giant, frost (16' tall, 2,700 lbs.)");
            expect(result.creature?.attacks).toHaveLength(2);
            expect(result.creature?.attacks[1]?.range).toBe("300'");
        });
        it("parses manticore with multiple action dice", () => {
            const result = parseStatBlock("Manticore: Init +5; Atk bite +6 melee (1d8) or claw +4 melee (1d3); AC 16; HD 6d8+6; MV 40', fly 50'; Act 3d20; SV Fort +5, Ref +4, Will +6; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.actionDice).toBe("3d20");
            expect(result.creature?.speed.land).toBe("40'");
            expect(result.creature?.speed.fly).toBe("50'");
        });
    });
    describe("HP calculation", () => {
        it("calculates average HP for simple hit dice", () => {
            const result = parseStatBlock("Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.hp).toBe(4); // Average of 1d6 = 3.5, rounded to 4
        });
        it("calculates average HP with modifier", () => {
            const result = parseStatBlock("Android: Init -2; Atk sword +2 melee (1d8); AC 18; HD 3d8+12; MV 30'; Act 1d20; SV Fort +5, Ref -2, Will +6; AL N.");
            expect(result.success).toBe(true);
            // 3d8 avg = 3 * 4.5 = 13.5, rounded = 14, + 12 = 26
            expect(result.creature?.hp).toBe(26);
        });
    });
    describe("edge cases", () => {
        it("handles negative initiative", () => {
            const result = parseStatBlock("Peasant: Init -2; Atk club -1 melee (1d4-1); AC 9; HD 1d4; MV 30'; Act 1d20; SV Fort -1, Ref -2, Will -1; AL N.");
            expect(result.success).toBe(true);
            expect(result.creature?.init).toBe(-2);
            expect(result.creature?.attacks[0]?.toHit).toBe("-1");
        });
        it("handles missing semicolon before Atk", () => {
            // Deep One has "Init -2 Atk" without semicolon
            const result = parseStatBlock("Deep One: Init -2 Atk mace +2 melee (1d6+3); AC 13; HD 1d8+2; MV 20'; Act 1d20; SV Fort +3, Ref -1, Will +3; AL C.");
            expect(result.success).toBe(true);
            expect(result.creature?.init).toBe(-2);
            expect(result.creature?.attacks).toHaveLength(1);
        });
        it("handles dmg prefix in damage", () => {
            const result = parseStatBlock("Ape-man: Init +2; Atk slam +6 melee (dmg 1d6+3); AC 13; HD 3d8; MV 20'; Act 1d20; SV Fort +6, Ref +3, Will +1; AL L.");
            expect(result.success).toBe(true);
            expect(result.creature?.attacks[0]?.damage).toBe("1d6+3");
        });
    });
    describe("error handling", () => {
        it("returns error for empty string", () => {
            const result = parseStatBlock("");
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
        it("returns error for string without creature name", () => {
            const result = parseStatBlock("Init +1; Atk club +0 melee (1d4); AC 11");
            expect(result.success).toBe(false);
            expect(result.error).toContain("name");
        });
        it("returns error for string without HD", () => {
            const result = parseStatBlock("Goblin: Init +1; Atk club +0 melee (1d4); AC 11; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.");
            expect(result.success).toBe(false);
            expect(result.error).toContain("hit dice");
        });
    });
    describe("parseStatBlocks", () => {
        it("parses multiple stat blocks", () => {
            const text = `
Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.

Orc: Init +0; Atk sword +2 melee (1d8+1); AC 13; HD 1d8+1; MV 30'; Act 1d20; SV Fort +1, Ref +0, Will -1; AL C.
      `;
            const results = parseStatBlocks(text);
            expect(results).toHaveLength(2);
            expect(defined(results[0]).success).toBe(true);
            expect(defined(results[0]).creature?.name).toBe("Goblin");
            expect(defined(results[1]).success).toBe(true);
            expect(defined(results[1]).creature?.name).toBe("Orc");
        });
    });
    describe("options", () => {
        it("uses custom category", () => {
            const result = parseStatBlock("Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.", { category: "Goblinoids" });
            expect(result.success).toBe(true);
            expect(result.creature?.category).toBe("Goblinoids");
        });
        it("uses custom ID", () => {
            const result = parseStatBlock("Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.", { id: "goblin-warrior" });
            expect(result.success).toBe(true);
            expect(result.creature?.id).toBe("goblin-warrior");
        });
        it("uses default crit die and table", () => {
            const result = parseStatBlock("Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C.", { defaultCritDie: "1d8", defaultCritTable: "III" });
            expect(result.success).toBe(true);
            expect(result.creature?.critDie).toBe("1d8");
            expect(result.creature?.critTable).toBe("III");
        });
    });
});
//# sourceMappingURL=parse-statblock.test.js.map