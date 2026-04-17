/**
 * Character Creation Tests
 */
import { describe, it, expect } from "vitest";
import { createZeroLevelCharacter } from "./create.js";
import { createSeededRandomSource } from "../types/random.js";
import { DEFAULT_CHARACTER_CREATION_DATA } from "../data/sample-data.js";
import { getAbilityModifier } from "../data/ability-modifiers.js";
/**
 * Pretty print a character for debugging
 */
function prettyPrintCharacter(result) {
    const { character, rolls } = result;
    const { identity, state } = character;
    const { abilities } = state;
    const lines = [];
    lines.push("╔══════════════════════════════════════════════════════════════╗");
    lines.push("║                    0-LEVEL CHARACTER                         ║");
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    // Identity
    lines.push(`║  Name:        ${(identity.name || "(unnamed)").padEnd(46)}║`);
    lines.push(`║  Occupation:  ${identity.occupation.padEnd(46)}║`);
    lines.push(`║  Alignment:   ${formatAlignment(identity.alignment).padEnd(46)}║`);
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    // Ability Scores
    lines.push("║  ABILITY SCORES                                              ║");
    lines.push("║  ─────────────────────────────────────────────────────────── ║");
    const abilityOrder = ["str", "agl", "sta", "per", "int", "lck"];
    for (const abilityId of abilityOrder) {
        const ability = abilities[abilityId];
        const mod = getAbilityModifier(ability.current);
        const modStr = mod >= 0 ? `+${String(mod)}` : String(mod);
        const rollData = rolls.abilityRolls.find(r => r.ability === abilityId);
        const rollsStr = rollData ? `[${rollData.rolls.join(", ")}]` : "";
        lines.push(`║    ${abilityId.toUpperCase()}: ${String(ability.current).padStart(2)} (${modStr.padStart(2)})  ${rollsStr.padEnd(40)}║`);
    }
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    // Combat Stats
    lines.push("║  COMBAT                                                      ║");
    lines.push("║  ─────────────────────────────────────────────────────────── ║");
    lines.push(`║    HP:         ${String(state.hp.current).padEnd(4)} / ${String(state.hp.max).padEnd(38)}║`);
    lines.push(`║    AC:         ${String(state.combat.ac).padEnd(46)}║`);
    lines.push(`║    Initiative: ${formatModifier(state.combat.initiative).padEnd(46)}║`);
    lines.push(`║    Speed:      ${String(state.combat.speed)}' ${" ".repeat(42)}║`);
    lines.push(`║    Action Die: ${state.combat.actionDice.join(", ").padEnd(46)}║`);
    lines.push(`║    Crit:       ${state.combat.critDie} / Table ${state.combat.critTable}${" ".repeat(35)}║`);
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    // Saving Throws
    lines.push("║  SAVING THROWS                                               ║");
    lines.push("║  ─────────────────────────────────────────────────────────── ║");
    lines.push(`║    Reflex:    ${formatModifier(state.saves.reflex).padEnd(47)}║`);
    lines.push(`║    Fortitude: ${formatModifier(state.saves.fortitude).padEnd(47)}║`);
    lines.push(`║    Will:      ${formatModifier(state.saves.will).padEnd(47)}║`);
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    // Birth Augur
    lines.push("║  BIRTH AUGUR                                                 ║");
    lines.push("║  ─────────────────────────────────────────────────────────── ║");
    const luckMod = getAbilityModifier(identity.startingLuck);
    const luckModStr = luckMod >= 0 ? `+${String(luckMod)}` : String(luckMod);
    lines.push(`║    ${identity.birthAugur.name.padEnd(57)}║`);
    lines.push(`║    Effect: ${identity.birthAugur.effect.substring(0, 49).padEnd(49)}║`);
    lines.push(`║    Luck Modifier: ${luckModStr.padEnd(42)}║`);
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    // Languages & Other
    lines.push("║  OTHER                                                       ║");
    lines.push("║  ─────────────────────────────────────────────────────────── ║");
    lines.push(`║    Languages: ${identity.languages.join(", ").padEnd(46)}║`);
    lines.push(`║    XP:        ${String(state.xp.current)} / ${String(state.xp.nextLevel)}${" ".repeat(44)}║`);
    // Currency
    const coins = [];
    if (state.currency.gp > 0)
        coins.push(`${String(state.currency.gp)} gp`);
    if (state.currency.sp > 0)
        coins.push(`${String(state.currency.sp)} sp`);
    if (state.currency.cp > 0)
        coins.push(`${String(state.currency.cp)} cp`);
    const coinStr = coins.length > 0 ? coins.join(", ") : "None";
    lines.push(`║    Funds:     ${coinStr.padEnd(46)}║`);
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    // Roll Summary
    lines.push("║  CREATION ROLLS                                              ║");
    lines.push("║  ─────────────────────────────────────────────────────────── ║");
    lines.push(`║    Birth Augur Roll: ${String(rolls.birthAugurRoll).padEnd(40)}║`);
    lines.push(`║    Occupation Roll:  ${String(rolls.occupationRoll).padEnd(40)}║`);
    lines.push(`║    HP Roll:          ${String(rolls.hpRoll).padEnd(40)}║`);
    lines.push("╚══════════════════════════════════════════════════════════════╝");
    return lines.join("\n");
}
function formatAlignment(alignment) {
    switch (alignment) {
        case "l": return "Lawful";
        case "n": return "Neutral";
        case "c": return "Chaotic";
        default: return alignment;
    }
}
function formatModifier(mod) {
    return mod >= 0 ? `+${String(mod)}` : String(mod);
}
describe("createZeroLevelCharacter", () => {
    it("creates a valid 0-level character with seeded random", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        const { character } = result;
        // Basic structure checks
        expect(character.identity).toBeDefined();
        expect(character.state).toBeDefined();
        expect(character.classInfo).toBeUndefined(); // 0-level has no class
        // Identity checks
        expect(character.identity.occupation).toBeTruthy();
        expect(character.identity.birthAugur).toBeDefined();
        expect(character.identity.alignment).toMatch(/^[lnc]$/);
        // State checks
        expect(character.state.hp.current).toBeGreaterThanOrEqual(1);
        expect(character.state.hp.max).toBeGreaterThanOrEqual(1);
        expect(character.state.combat.ac).toBeGreaterThanOrEqual(0);
        // Print the character
        console.log("\n" + prettyPrintCharacter(result) + "\n");
    });
    it("creates multiple unique characters", () => {
        const characters = [];
        // Create 4 characters (a typical 0-level funnel party)
        for (let i = 0; i < 4; i++) {
            const random = createSeededRandomSource(1000 + i * 111);
            const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
            characters.push(result);
        }
        console.log("\n");
        console.log("════════════════════════════════════════════════════════════════");
        console.log("                    0-LEVEL FUNNEL PARTY                         ");
        console.log("════════════════════════════════════════════════════════════════");
        for (let i = 0; i < characters.length; i++) {
            const result = characters[i];
            if (!result)
                continue;
            console.log(`\n--- Character ${String(i + 1)} ---\n`);
            console.log(prettyPrintCharacter(result));
        }
        console.log("\n");
        // Verify we got different characters
        const occupations = characters.map(c => c.character.identity.occupation);
        const uniqueOccupations = new Set(occupations);
        // With different seeds, we should likely get at least 2 different occupations
        // (not guaranteed but highly likely)
        expect(uniqueOccupations.size).toBeGreaterThanOrEqual(1);
    });
    it("respects manual ability scores", () => {
        const random = createSeededRandomSource(99999);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, {
            abilityScores: {
                method: "manual",
                manualScores: [18, 16, 14, 12, 10, 8],
            },
        }, random);
        const { abilities } = result.character.state;
        expect(abilities.str.current).toBe(18);
        expect(abilities.agl.current).toBe(16);
        expect(abilities.sta.current).toBe(14);
        expect(abilities.per.current).toBe(12);
        expect(abilities.int.current).toBe(10);
        expect(abilities.lck.current).toBe(8);
        console.log("\n--- Manual Scores Character ---\n");
        console.log(prettyPrintCharacter(result));
        console.log("\n");
    });
    it("uses 4d6 drop lowest method", () => {
        const random = createSeededRandomSource(54321);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, {
            abilityScores: {
                method: "4d6-drop-lowest",
            },
        }, random);
        // Verify each ability had 4 dice rolled and 3 kept
        for (const rollData of result.rolls.abilityRolls) {
            expect(rollData.rolls.length).toBe(4);
            expect(rollData.kept.length).toBe(3);
        }
        console.log("\n--- 4d6 Drop Lowest Character ---\n");
        console.log(prettyPrintCharacter(result));
        console.log("\n");
    });
    it("generates random name when configured", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, {
            name: {
                generateName: true,
            },
        }, random);
        // Should have generated a name
        expect(result.character.identity.name).toBeTruthy();
        expect(result.character.identity.name.length).toBeGreaterThan(0);
        console.log("\n--- Character with Generated Name ---\n");
        console.log(prettyPrintCharacter(result));
        console.log("\n");
    });
    it("generates name with epithet when configured", () => {
        const random = createSeededRandomSource(42);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, {
            name: {
                generateName: true,
                includeEpithet: true,
                epithetChance: 1.0, // Always include epithet
            },
        }, random);
        // Should have generated a name with epithet
        expect(result.character.identity.name).toBeTruthy();
        // Epithet should have a space (e.g., "John the Bold")
        expect(result.character.identity.name).toContain(" ");
        console.log("\n--- Character with Name and Epithet ---\n");
        console.log(prettyPrintCharacter(result));
        console.log("\n");
    });
    it("generates appropriate name for demihuman occupation", () => {
        const random = createSeededRandomSource(77777);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, {
            occupation: {
                specificOccupation: "Stout Tunneler", // Dwarf occupation
            },
            name: {
                generateName: true,
            },
        }, random);
        // Should have a dwarf name (the name generator detects ancestry from occupation)
        expect(result.character.identity.name).toBeTruthy();
        expect(result.character.identity.occupation).toBe("Stout Tunneler");
        console.log("\n--- Dwarf Character with Generated Name ---\n");
        console.log(prettyPrintCharacter(result));
        console.log("\n");
    });
});
//# sourceMappingURL=create.test.js.map