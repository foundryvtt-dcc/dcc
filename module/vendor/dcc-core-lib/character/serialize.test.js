/**
 * Character Serialization Tests
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { exportCharacter, exportCharacterRaw, importCharacter, peekExportedCharacter, CHARACTER_FORMAT_VERSION, } from "./serialize.js";
import { createZeroLevelCharacter } from "./create.js";
import { createSeededRandomSource } from "../types/random.js";
import { DEFAULT_CHARACTER_CREATION_DATA } from "../data/sample-data.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, "__fixtures__");
describe("exportCharacter", () => {
    it("exports character with metadata", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        const json = exportCharacter(result.character);
        const parsed = JSON.parse(json);
        expect(parsed.version).toBe(CHARACTER_FORMAT_VERSION);
        expect(parsed.format).toBe("dcc-core-lib");
        expect(parsed.exportedAt).toBeDefined();
        expect(parsed.character).toEqual(result.character);
        console.log("\n--- Exported Character JSON ---");
        console.log(json);
        console.log("");
    });
    it("exports compact JSON when pretty is false", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        const prettyJson = exportCharacter(result.character, { pretty: true });
        const compactJson = exportCharacter(result.character, { pretty: false });
        expect(compactJson.length).toBeLessThan(prettyJson.length);
        expect(compactJson).not.toContain("\n");
    });
});
describe("exportCharacterRaw", () => {
    it("exports character without metadata wrapper", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        const json = exportCharacterRaw(result.character);
        const parsed = JSON.parse(json);
        // Should not have wrapper fields
        expect(parsed.version).toBeUndefined();
        expect(parsed.format).toBeUndefined();
        // Should have character fields directly
        expect(parsed.identity).toBeDefined();
        expect(parsed.state).toBeDefined();
    });
});
describe("importCharacter", () => {
    it("imports wrapped format", () => {
        const random = createSeededRandomSource(54321);
        const original = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        const json = exportCharacter(original.character);
        const result = importCharacter(json);
        expect(result.success).toBe(true);
        expect(result.character).toEqual(original.character);
        expect(result.error).toBeUndefined();
    });
    it("imports raw format", () => {
        const random = createSeededRandomSource(54321);
        const original = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        const json = exportCharacterRaw(original.character);
        const result = importCharacter(json);
        expect(result.success).toBe(true);
        expect(result.character).toEqual(original.character);
    });
    it("round-trips character data", () => {
        const random = createSeededRandomSource(99999);
        const original = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        // Export and import
        const json = exportCharacter(original.character);
        const imported = importCharacter(json);
        expect(imported.success).toBe(true);
        if (!imported.character)
            throw new Error("Expected character to be defined");
        // Re-export and compare
        const reExported = exportCharacterRaw(imported.character);
        const originalRaw = exportCharacterRaw(original.character);
        expect(reExported).toBe(originalRaw);
    });
    it("fails on invalid JSON", () => {
        const result = importCharacter("not valid json");
        expect(result.success).toBe(false);
        expect(result.error).toBe("Invalid JSON");
    });
    it("fails on non-object JSON", () => {
        const result = importCharacter('"just a string"');
        expect(result.success).toBe(false);
        expect(result.error).toBe("JSON must be an object");
    });
    it("fails on unrecognized format", () => {
        const result = importCharacter('{"foo": "bar"}');
        expect(result.success).toBe(false);
        expect(result.error).toContain("Unrecognized format");
    });
    it("fails on missing identity", () => {
        // This gets caught as unrecognized format since it lacks both
        // the "format" field and the identity+state structure
        const result = importCharacter('{"state": {}}');
        expect(result.success).toBe(false);
        expect(result.error).toContain("Unrecognized format");
    });
    it("warns on version mismatch", () => {
        const json = JSON.stringify({
            version: "0.1",
            format: "dcc-core-lib",
            character: {
                identity: {
                    id: "test",
                    name: "Test",
                    occupation: "Test",
                    alignment: "n",
                    birthAugur: { id: "1", name: "Test", effect: "Test", modifies: "test", multiplier: 1 },
                    startingLuck: 10,
                    languages: ["Common"],
                },
                state: {
                    hp: { current: 4, max: 4, temp: 0 },
                    abilities: {
                        str: { current: 10, max: 10 },
                        agl: { current: 10, max: 10 },
                        sta: { current: 10, max: 10 },
                        per: { current: 10, max: 10 },
                        int: { current: 10, max: 10 },
                        lck: { current: 10, max: 10 },
                    },
                    xp: { current: 0, nextLevel: 10 },
                    saves: { reflex: 0, fortitude: 0, will: 0 },
                    combat: {
                        attackBonus: 0,
                        actionDice: ["d20"],
                        critDie: "d4",
                        critTable: "I",
                        threatRange: 20,
                        ac: 10,
                        speed: 30,
                        initiative: 0,
                    },
                    currency: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 },
                    conditions: [],
                },
            },
        });
        const result = importCharacter(json);
        expect(result.success).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.[0]).toContain("Version mismatch");
    });
});
describe("peekExportedCharacter", () => {
    it("peeks at wrapped format metadata", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        result.character.identity.name = "Test Hero";
        const json = exportCharacter(result.character);
        const peek = peekExportedCharacter(json);
        expect(peek.valid).toBe(true);
        expect(peek.version).toBe(CHARACTER_FORMAT_VERSION);
        expect(peek.format).toBe("dcc-core-lib");
        expect(peek.exportedAt).toBeDefined();
        expect(peek.characterName).toBe("Test Hero");
        expect(peek.occupation).toBe(result.character.identity.occupation);
    });
    it("peeks at raw format", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        result.character.identity.name = "Raw Hero";
        const json = exportCharacterRaw(result.character);
        const peek = peekExportedCharacter(json);
        expect(peek.valid).toBe(true);
        expect(peek.format).toBe("raw");
        expect(peek.characterName).toBe("Raw Hero");
    });
    it("returns error for invalid JSON", () => {
        const peek = peekExportedCharacter("not json");
        expect(peek.valid).toBe(false);
        expect(peek.error).toBe("Invalid JSON");
    });
});
/**
 * Regression tests for importing from fixture files.
 * These ensure backwards compatibility as the format evolves.
 */
describe("fixture import regression", () => {
    it("imports v1.0 wrapped format fixture", () => {
        const json = readFileSync(join(FIXTURES_DIR, "v1.0-wrapped.json"), "utf-8");
        const result = importCharacter(json);
        expect(result.success).toBe(true);
        expect(result.character).toBeDefined();
        expect(result.character?.identity.name).toBe("Grimtoe the Unlucky");
        expect(result.character?.identity.occupation).toBe("Stout Tunneler");
        expect(result.character?.state.hp.current).toBe(4);
        expect(result.character?.state.abilities.str.current).toBe(14);
    });
    it("imports v1.0 raw format fixture", () => {
        const json = readFileSync(join(FIXTURES_DIR, "v1.0-raw.json"), "utf-8");
        const result = importCharacter(json);
        expect(result.success).toBe(true);
        expect(result.character).toBeDefined();
        expect(result.character?.identity.name).toBe("Whisper of the Meadow");
        expect(result.character?.identity.occupation).toBe("Smallfolk Chicken Wrangler");
        expect(result.character?.state.hp.current).toBe(2);
        expect(result.character?.state.xp.current).toBe(5);
    });
    it("imports v1.0 in-play fixture with damage and conditions", () => {
        const json = readFileSync(join(FIXTURES_DIR, "v1.0-in-play.json"), "utf-8");
        const result = importCharacter(json);
        expect(result.success).toBe(true);
        expect(result.character).toBeDefined();
        expect(result.character?.identity.name).toBe("Blackthorn");
        // Check damage state (current < max)
        expect(result.character?.state.hp.current).toBe(1);
        expect(result.character?.state.hp.max).toBe(3);
        // Check ability damage (sta current < max)
        expect(result.character?.state.abilities.sta.current).toBe(9);
        expect(result.character?.state.abilities.sta.max).toBe(11);
        // Check conditions
        expect(result.character?.state.conditions).toContain("poisoned");
        // Check currency
        expect(result.character?.state.currency.gp).toBe(15);
    });
    it("peeks at v1.0 wrapped fixture metadata", () => {
        const json = readFileSync(join(FIXTURES_DIR, "v1.0-wrapped.json"), "utf-8");
        const peek = peekExportedCharacter(json);
        expect(peek.valid).toBe(true);
        expect(peek.version).toBe("1.0");
        expect(peek.format).toBe("dcc-core-lib");
        expect(peek.characterName).toBe("Grimtoe the Unlucky");
        expect(peek.occupation).toBe("Stout Tunneler");
    });
    it("peeks at v1.0 raw fixture", () => {
        const json = readFileSync(join(FIXTURES_DIR, "v1.0-raw.json"), "utf-8");
        const peek = peekExportedCharacter(json);
        expect(peek.valid).toBe(true);
        expect(peek.format).toBe("raw");
        expect(peek.characterName).toBe("Whisper of the Meadow");
    });
});
describe("v1.0 → v1.1 migration", () => {
    it("strips legacy thief.backstabMultiplier from imported characters", () => {
        const random = createSeededRandomSource(12345);
        const result = createZeroLevelCharacter(DEFAULT_CHARACTER_CREATION_DATA, undefined, random);
        // Simulate a v1.0 export that persisted the removed field.
        const char = result.character;
        char.state.classState = { thief: { luckDie: "d3", backstabMultiplier: 3 } };
        const exported = exportCharacter(result.character);
        // Downgrade the wrapper version so it looks like a v1.0 export.
        const downgraded = exported.replace(`"version": "${CHARACTER_FORMAT_VERSION}"`, '"version": "1.0"');
        const imported = importCharacter(downgraded);
        expect(imported.success).toBe(true);
        const thief = imported.character?.state.classState?.thief;
        expect(thief).toBeDefined();
        expect(thief?.["luckDie"]).toBe("d3");
        expect(thief?.["backstabMultiplier"]).toBeUndefined();
    });
});
//# sourceMappingURL=serialize.test.js.map