/**
 * Spellbook Management Tests
 */
import { describe, it, expect } from "vitest";
import { findSpellEntry, knowsSpell, isSpellLost, getSpellCountAtLevel, getSpellsAtLevel, getLostSpells, getCastableSpells, canLearnSpell, addSpellToSpellbook, removeSpellFromSpellbook, markSpellLost, markSpellRecovered, recoverAllSpells, updateSpellLastResult, updateSpellNotes, setSpellLimits, updateMercurialEffect, } from "./spellbook.js";
import { createEmptySpellbook } from "../types/spells.js";
// Test fixtures
const testSpells = [
    {
        id: "magic-missile",
        name: "Magic Missile",
        level: 1,
        casterTypes: ["wizard", "elf"],
    },
    {
        id: "sleep",
        name: "Sleep",
        level: 1,
        casterTypes: ["wizard", "elf"],
    },
    {
        id: "fireball",
        name: "Fireball",
        level: 3,
        casterTypes: ["wizard", "elf"],
    },
    {
        id: "bless",
        name: "Bless",
        level: 1,
        casterTypes: ["cleric"],
    },
];
const testMercurial = {
    rollValue: 75,
    summary: "Bright flash of light",
    description: "When cast, a bright flash of light accompanies the spell.",
    displayOnCast: true,
};
/**
 * Helper to get a test spell by ID (throws if not found for better test errors)
 */
function getTestSpell(id) {
    const spell = testSpells.find((s) => s.id === id);
    if (!spell) {
        throw new Error(`Test spell "${id}" not found in fixtures`);
    }
    return spell;
}
describe("Spellbook Queries", () => {
    describe("findSpellEntry", () => {
        it("should find an existing spell", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: false },
                ],
            };
            const entry = findSpellEntry(spellbook, "magic-missile");
            expect(entry).toBeDefined();
            expect(entry?.spellId).toBe("magic-missile");
            expect(entry?.lost).toBe(false);
        });
        it("should return undefined for unknown spell", () => {
            const spellbook = createEmptySpellbook();
            const entry = findSpellEntry(spellbook, "unknown");
            expect(entry).toBeUndefined();
        });
        it("should include mercurial effect when present", () => {
            const spellbook = {
                spells: [
                    {
                        spellId: "magic-missile",
                        lost: false,
                        mercurialEffect: testMercurial,
                    },
                ],
            };
            const entry = findSpellEntry(spellbook, "magic-missile");
            expect(entry?.mercurialEffect).toBeDefined();
            expect(entry?.mercurialEffect?.rollValue).toBe(75);
        });
    });
    describe("knowsSpell", () => {
        it("should return true for known spell", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            expect(knowsSpell(spellbook, "magic-missile")).toBe(true);
        });
        it("should return false for unknown spell", () => {
            const spellbook = createEmptySpellbook();
            expect(knowsSpell(spellbook, "magic-missile")).toBe(false);
        });
    });
    describe("isSpellLost", () => {
        it("should return true for lost spell", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: true }],
            };
            expect(isSpellLost(spellbook, "magic-missile")).toBe(true);
        });
        it("should return false for available spell", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            expect(isSpellLost(spellbook, "magic-missile")).toBe(false);
        });
        it("should return false for unknown spell", () => {
            const spellbook = createEmptySpellbook();
            expect(isSpellLost(spellbook, "unknown")).toBe(false);
        });
    });
    describe("getSpellCountAtLevel", () => {
        it("should count spells at specific level", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: false },
                    { spellId: "sleep", lost: false },
                    { spellId: "fireball", lost: false },
                ],
            };
            expect(getSpellCountAtLevel(spellbook, testSpells, 1)).toBe(2);
            expect(getSpellCountAtLevel(spellbook, testSpells, 3)).toBe(1);
            expect(getSpellCountAtLevel(spellbook, testSpells, 2)).toBe(0);
        });
    });
    describe("getSpellsAtLevel", () => {
        it("should return all spells at specific level", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: false },
                    { spellId: "sleep", lost: true },
                    { spellId: "fireball", lost: false },
                ],
            };
            const level1Spells = getSpellsAtLevel(spellbook, testSpells, 1);
            expect(level1Spells).toHaveLength(2);
            expect(level1Spells.map((s) => s.spellId)).toContain("magic-missile");
            expect(level1Spells.map((s) => s.spellId)).toContain("sleep");
        });
    });
    describe("getLostSpells", () => {
        it("should return only lost spells", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: true },
                    { spellId: "sleep", lost: false },
                    { spellId: "fireball", lost: true },
                ],
            };
            const lost = getLostSpells(spellbook);
            expect(lost).toHaveLength(2);
            expect(lost.map((s) => s.spellId)).toContain("magic-missile");
            expect(lost.map((s) => s.spellId)).toContain("fireball");
        });
    });
    describe("getCastableSpells", () => {
        it("should return only castable (not lost) spells", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: true },
                    { spellId: "sleep", lost: false },
                    { spellId: "fireball", lost: false },
                ],
            };
            const available = getCastableSpells(spellbook);
            expect(available).toHaveLength(2);
            expect(available.map((s) => s.spellId)).toContain("sleep");
            expect(available.map((s) => s.spellId)).toContain("fireball");
        });
    });
});
describe("Spell Learning Validation", () => {
    describe("canLearnSpell", () => {
        it("should allow learning a new valid spell", () => {
            const spellbook = createEmptySpellbook();
            const spell = getTestSpell("magic-missile");
            const result = canLearnSpell(spellbook, spell, "wizard", testSpells);
            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });
        it("should reject already known spell", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            const spell = getTestSpell("magic-missile");
            const result = canLearnSpell(spellbook, spell, "wizard", testSpells);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("already known");
        });
        it("should reject spell for wrong caster type", () => {
            const spellbook = createEmptySpellbook();
            const spell = getTestSpell("bless");
            const result = canLearnSpell(spellbook, spell, "wizard", testSpells);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("wizard cannot learn");
        });
        it("should allow elf to learn wizard spell", () => {
            const spellbook = createEmptySpellbook();
            const spell = getTestSpell("magic-missile");
            const result = canLearnSpell(spellbook, spell, "elf", testSpells);
            expect(result.allowed).toBe(true);
        });
        it("should enforce spell limits per level", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
                maxSpellsPerLevel: { 1: 1 },
            };
            const spell = getTestSpell("sleep");
            const result = canLearnSpell(spellbook, spell, "wizard", testSpells);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Maximum spells at level 1");
        });
        it("should allow learning if under limit", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
                maxSpellsPerLevel: { 1: 3 },
            };
            const spell = getTestSpell("sleep");
            const result = canLearnSpell(spellbook, spell, "wizard", testSpells);
            expect(result.allowed).toBe(true);
        });
    });
});
describe("Spellbook Mutations", () => {
    describe("addSpellToSpellbook", () => {
        it("should add a spell to an empty spellbook", () => {
            const spellbook = createEmptySpellbook();
            const spell = getTestSpell("magic-missile");
            const newBook = addSpellToSpellbook(spellbook, spell);
            expect(newBook.spells).toHaveLength(1);
            expect(newBook.spells[0]?.spellId).toBe("magic-missile");
            expect(newBook.spells[0]?.lost).toBe(false);
            expect(newBook.spells[0]?.learnedAt).toBeDefined();
        });
        it("should not mutate original spellbook", () => {
            const spellbook = createEmptySpellbook();
            const spell = getTestSpell("magic-missile");
            addSpellToSpellbook(spellbook, spell);
            expect(spellbook.spells).toHaveLength(0);
        });
        it("should include mercurial effect when provided", () => {
            const spellbook = createEmptySpellbook();
            const spell = getTestSpell("magic-missile");
            const newBook = addSpellToSpellbook(spellbook, spell, testMercurial);
            expect(newBook.spells[0]?.mercurialEffect).toBeDefined();
            expect(newBook.spells[0]?.mercurialEffect?.rollValue).toBe(75);
        });
        it("should include manifestation when provided", () => {
            const spellbook = createEmptySpellbook();
            const spell = getTestSpell("magic-missile");
            const newBook = addSpellToSpellbook(spellbook, spell, undefined, "Glowing blue arrows");
            expect(newBook.spells[0]?.manifestation).toBe("Glowing blue arrows");
        });
        it("should preserve maxSpellsPerLevel", () => {
            const spellbook = {
                spells: [],
                maxSpellsPerLevel: { 1: 3, 2: 2 },
            };
            const spell = getTestSpell("magic-missile");
            const newBook = addSpellToSpellbook(spellbook, spell);
            expect(newBook.maxSpellsPerLevel).toEqual({ 1: 3, 2: 2 });
        });
    });
    describe("removeSpellFromSpellbook", () => {
        it("should remove an existing spell", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: false },
                    { spellId: "sleep", lost: false },
                ],
            };
            const newBook = removeSpellFromSpellbook(spellbook, "magic-missile");
            expect(newBook.spells).toHaveLength(1);
            expect(newBook.spells[0]?.spellId).toBe("sleep");
        });
        it("should not mutate original spellbook", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            removeSpellFromSpellbook(spellbook, "magic-missile");
            expect(spellbook.spells).toHaveLength(1);
        });
        it("should handle removing non-existent spell gracefully", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            const newBook = removeSpellFromSpellbook(spellbook, "unknown");
            expect(newBook.spells).toHaveLength(1);
        });
    });
    describe("markSpellLost", () => {
        it("should mark a spell as lost", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            const newBook = markSpellLost(spellbook, "magic-missile");
            expect(newBook.spells[0]?.lost).toBe(true);
        });
        it("should not affect other spells", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: false },
                    { spellId: "sleep", lost: false },
                ],
            };
            const newBook = markSpellLost(spellbook, "magic-missile");
            expect(newBook.spells.find((s) => s.spellId === "sleep")?.lost).toBe(false);
        });
    });
    describe("markSpellRecovered", () => {
        it("should mark a lost spell as recovered", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: true }],
            };
            const newBook = markSpellRecovered(spellbook, "magic-missile");
            expect(newBook.spells[0]?.lost).toBe(false);
        });
    });
    describe("recoverAllSpells", () => {
        it("should recover all lost spells", () => {
            const spellbook = {
                spells: [
                    { spellId: "magic-missile", lost: true },
                    { spellId: "sleep", lost: true },
                    { spellId: "fireball", lost: false },
                ],
            };
            const newBook = recoverAllSpells(spellbook);
            expect(newBook.spells.every((s) => !s.lost)).toBe(true);
        });
    });
    describe("updateSpellLastResult", () => {
        it("should update the last result", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            const newBook = updateSpellLastResult(spellbook, "magic-missile", 18);
            expect(newBook.spells[0]?.lastResult).toBe(18);
        });
    });
    describe("updateSpellNotes", () => {
        it("should update notes", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            const newBook = updateSpellNotes(spellbook, "magic-missile", "Good for crowds");
            expect(newBook.spells[0]?.notes).toBe("Good for crowds");
        });
        it("should remove notes when undefined", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false, notes: "Some notes" }],
            };
            const newBook = updateSpellNotes(spellbook, "magic-missile", undefined);
            expect(newBook.spells[0]?.notes).toBeUndefined();
        });
    });
    describe("setSpellLimits", () => {
        it("should set spell limits", () => {
            const spellbook = createEmptySpellbook();
            const newBook = setSpellLimits(spellbook, { 1: 4, 2: 3, 3: 2 });
            expect(newBook.maxSpellsPerLevel).toEqual({ 1: 4, 2: 3, 3: 2 });
        });
    });
    describe("updateMercurialEffect", () => {
        it("should add mercurial effect", () => {
            const spellbook = {
                spells: [{ spellId: "magic-missile", lost: false }],
            };
            const newBook = updateMercurialEffect(spellbook, "magic-missile", testMercurial);
            expect(newBook.spells[0]?.mercurialEffect).toBeDefined();
            expect(newBook.spells[0]?.mercurialEffect?.rollValue).toBe(75);
        });
        it("should remove mercurial effect when undefined", () => {
            const spellbook = {
                spells: [{
                        spellId: "magic-missile",
                        lost: false,
                        mercurialEffect: testMercurial,
                    }],
            };
            const newBook = updateMercurialEffect(spellbook, "magic-missile", undefined);
            expect(newBook.spells[0]?.mercurialEffect).toBeUndefined();
        });
    });
});
//# sourceMappingURL=spellbook.test.js.map