/**
 * Name Generation Tests
 */
import { describe, it, expect } from "vitest";
import { generateName, generateNameForOccupation, detectAncestryFromOccupation, DEFAULT_NAME_DATA, } from "./names.js";
import { createSeededRandomSource } from "../types/random.js";
describe("generateName", () => {
    it("generates a human name", () => {
        const random = createSeededRandomSource(12345);
        const result = generateName("human", DEFAULT_NAME_DATA, {}, random);
        expect(result.firstName).toBeTruthy();
        expect(result.ancestry).toBe("Human");
        expect(result.fullName).toBe(result.firstName);
        expect(result.epithet).toBeUndefined();
    });
    it("generates a dwarf name", () => {
        const random = createSeededRandomSource(54321);
        const result = generateName("dwarf", DEFAULT_NAME_DATA, {}, random);
        expect(result.firstName).toBeTruthy();
        expect(result.ancestry).toBe("Dwarf");
        expect(DEFAULT_NAME_DATA.dwarf.firstNames).toContain(result.firstName);
    });
    it("generates an elf name", () => {
        const random = createSeededRandomSource(11111);
        const result = generateName("elf", DEFAULT_NAME_DATA, {}, random);
        expect(result.firstName).toBeTruthy();
        expect(result.ancestry).toBe("Elf");
        expect(DEFAULT_NAME_DATA.elf.firstNames).toContain(result.firstName);
    });
    it("generates a halfling name", () => {
        const random = createSeededRandomSource(99999);
        const result = generateName("halfling", DEFAULT_NAME_DATA, {}, random);
        expect(result.firstName).toBeTruthy();
        expect(result.ancestry).toBe("Halfling");
        expect(DEFAULT_NAME_DATA.halfling.firstNames).toContain(result.firstName);
    });
    it("can include epithets", () => {
        // Use a seed that will generate epithet (random < 0.3)
        const random = createSeededRandomSource(42);
        const result = generateName("human", DEFAULT_NAME_DATA, { includeEpithet: true, epithetChance: 1.0 }, // Force epithet
        random);
        expect(result.epithet).toBeTruthy();
        expect(result.fullName).toBe(`${result.firstName} ${result.epithet ?? ""}`);
        expect(DEFAULT_NAME_DATA.human.epithets).toContain(result.epithet);
    });
    it("respects epithet chance", () => {
        const random = createSeededRandomSource(12345);
        const result = generateName("dwarf", DEFAULT_NAME_DATA, { includeEpithet: true, epithetChance: 0 }, // Never epithet
        random);
        expect(result.epithet).toBeUndefined();
        expect(result.fullName).toBe(result.firstName);
    });
    it("produces consistent results with same seed", () => {
        const random1 = createSeededRandomSource(77777);
        const random2 = createSeededRandomSource(77777);
        const result1 = generateName("elf", DEFAULT_NAME_DATA, {}, random1);
        const result2 = generateName("elf", DEFAULT_NAME_DATA, {}, random2);
        expect(result1.firstName).toBe(result2.firstName);
        expect(result1.fullName).toBe(result2.fullName);
    });
    it("produces different results with different seeds", () => {
        const results = new Set();
        for (let i = 0; i < 10; i++) {
            const random = createSeededRandomSource(i * 1000);
            const result = generateName("human", DEFAULT_NAME_DATA, {}, random);
            results.add(result.firstName);
        }
        // Should have generated multiple unique names
        expect(results.size).toBeGreaterThan(1);
    });
});
describe("detectAncestryFromOccupation", () => {
    it("detects dwarf from occupation", () => {
        expect(detectAncestryFromOccupation("Dwarven miner")).toBe("dwarf");
        expect(detectAncestryFromOccupation("Stout Tunneler")).toBe("dwarf");
        expect(detectAncestryFromOccupation("Dwarf blacksmith")).toBe("dwarf");
    });
    it("detects elf from occupation", () => {
        expect(detectAncestryFromOccupation("Elven sage")).toBe("elf");
        expect(detectAncestryFromOccupation("Fey Forester")).toBe("elf");
        expect(detectAncestryFromOccupation("Elf artisan")).toBe("elf");
    });
    it("detects halfling from occupation", () => {
        expect(detectAncestryFromOccupation("Halfling trader")).toBe("halfling");
        expect(detectAncestryFromOccupation("Smallfolk Chicken Wrangler")).toBe("halfling");
    });
    it("defaults to human for unrecognized occupations", () => {
        expect(detectAncestryFromOccupation("Farmer")).toBe("human");
        expect(detectAncestryFromOccupation("Blacksmith")).toBe("human");
        expect(detectAncestryFromOccupation("Merchant")).toBe("human");
        expect(detectAncestryFromOccupation("")).toBe("human");
    });
});
describe("generateNameForOccupation", () => {
    it("generates appropriate name for dwarven occupation", () => {
        const random = createSeededRandomSource(12345);
        const result = generateNameForOccupation("Stout Tunneler", DEFAULT_NAME_DATA, {}, random);
        expect(result.ancestry).toBe("Dwarf");
        expect(DEFAULT_NAME_DATA.dwarf.firstNames).toContain(result.firstName);
    });
    it("generates appropriate name for elven occupation", () => {
        const random = createSeededRandomSource(12345);
        const result = generateNameForOccupation("Fey Glass Smith", DEFAULT_NAME_DATA, {}, random);
        expect(result.ancestry).toBe("Elf");
        expect(DEFAULT_NAME_DATA.elf.firstNames).toContain(result.firstName);
    });
    it("generates appropriate name for halfling occupation", () => {
        const random = createSeededRandomSource(12345);
        const result = generateNameForOccupation("Smallfolk Chicken Wrangler", DEFAULT_NAME_DATA, {}, random);
        expect(result.ancestry).toBe("Halfling");
        expect(DEFAULT_NAME_DATA.halfling.firstNames).toContain(result.firstName);
    });
    it("generates human name for generic occupation", () => {
        const random = createSeededRandomSource(12345);
        const result = generateNameForOccupation("Farmer", DEFAULT_NAME_DATA, {}, random);
        expect(result.ancestry).toBe("Human");
        expect(DEFAULT_NAME_DATA.human.firstNames).toContain(result.firstName);
    });
    it("can include epithets for occupational names", () => {
        const random = createSeededRandomSource(42);
        const result = generateNameForOccupation("Stout Tunneler", DEFAULT_NAME_DATA, { includeEpithet: true, epithetChance: 1.0 }, random);
        expect(result.ancestry).toBe("Dwarf");
        expect(result.epithet).toBeTruthy();
        expect(DEFAULT_NAME_DATA.dwarf.epithets).toContain(result.epithet);
    });
});
describe("DEFAULT_NAME_DATA", () => {
    it("has names for all ancestries", () => {
        expect(DEFAULT_NAME_DATA.human.firstNames.length).toBeGreaterThan(0);
        expect(DEFAULT_NAME_DATA.dwarf.firstNames.length).toBeGreaterThan(0);
        expect(DEFAULT_NAME_DATA.elf.firstNames.length).toBeGreaterThan(0);
        expect(DEFAULT_NAME_DATA.halfling.firstNames.length).toBeGreaterThan(0);
    });
    it("has epithets for all ancestries", () => {
        expect(DEFAULT_NAME_DATA.human.epithets?.length).toBeGreaterThan(0);
        expect(DEFAULT_NAME_DATA.dwarf.epithets?.length).toBeGreaterThan(0);
        expect(DEFAULT_NAME_DATA.elf.epithets?.length).toBeGreaterThan(0);
        expect(DEFAULT_NAME_DATA.halfling.epithets?.length).toBeGreaterThan(0);
    });
    it("has reasonable name counts", () => {
        // Should have at least 20 names per ancestry for variety
        expect(DEFAULT_NAME_DATA.human.firstNames.length).toBeGreaterThanOrEqual(20);
        expect(DEFAULT_NAME_DATA.dwarf.firstNames.length).toBeGreaterThanOrEqual(20);
        expect(DEFAULT_NAME_DATA.elf.firstNames.length).toBeGreaterThanOrEqual(20);
        expect(DEFAULT_NAME_DATA.halfling.firstNames.length).toBeGreaterThanOrEqual(20);
    });
});
//# sourceMappingURL=names.test.js.map