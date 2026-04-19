/**
 * Purple Sorcerer Parser Tests
 */
import { describe, it, expect } from "vitest";
import { parsePurpleSorcerer, parsePurpleSorcererText, parsePurpleSorcererJson, convertPSCharacter, convertPSCharacters, } from "./index.js";
/**
 * Test helper: asserts value is defined and returns it typed
 */
function defined(value) {
    expect(value).toBeDefined();
    return value;
}
// =============================================================================
// Test Data
// =============================================================================
const ZERO_LEVEL_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | Augur: normal

0-level Occupation: Dwarven stonemason
Strength: 8 (-1)
Agility: 13 (+1)
Stamina: 10 (0)
Personality: 5 (-2)
Intelligence: 8 (-1)
Luck: 5 (-2)

AC: 11; HP: 1
Weapon: Hammer (as club) -1 (1d4-1)
Speed: 10; Init: 1; Ref: 1; Fort: 0; Will: -2

Equipment: Lantern (10 gp)
Trade good: Fine stone (10 lbs)
Starting Funds: 26 cp
Lucky sign: Wild child (Speed, each +1 = +5' speed) (-2)
Languages: Common, Dwarf
Racial Traits: Dwarven ability: Infravision`;
const MULTIPLE_ZERO_LEVELS_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | Augur: normal

0-level Occupation: Dwarven stonemason
Strength: 8 (-1)
Agility: 13 (+1)
Stamina: 10 (0)
Personality: 5 (-2)
Intelligence: 8 (-1)
Luck: 5 (-2)

AC: 11; HP: 1
Weapon: Hammer (as club) -1 (1d4-1)
Speed: 10; Init: 1; Ref: 1; Fort: 0; Will: -2

Equipment: Lantern (10 gp)
Trade good: Fine stone (10 lbs)
Starting Funds: 26 cp
Lucky sign: Wild child (Speed, each +1 = +5' speed) (-2)
Languages: Common, Dwarf
Racial Traits: Dwarven ability: Infravision

0-level Occupation: Hunter
Strength: 8 (-1)
Agility: 8 (-1)
Stamina: 12 (0)
Personality: 11 (0)
Intelligence: 12 (0)
Luck: 8 (-1)

AC: 9; HP: 2
Weapon: Shortbow -1 (1d6-1)
Speed: 30; Init: -1; Ref: -1; Fort: 0; Will: 0

Equipment: Crowbar (2 gp)
Trade good: Deer pelt
Starting Funds: 31 cp
Lucky sign: Born on the battlefield (Damage rolls) (-1)
Languages: Common`;
const WARRIOR_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Warrior (1st level)
Occupation: Hunter
Strength: 14 (+1)
Agility: 10 (0)
Stamina: 8 (-1)
Personality: 10 (0)
Intelligence: 7 (-1)
Luck: 9 (0)

HP: 11; Speed: 30; Init: 1
Ref: 1; Fort: 0; Will: 0

Base Attack Mod: d3
Attack Dice: 1d20; Crit Die/Table: 1d12/III
Occupation Weapon: Shortbow ranged d3 (dmg 1d6+deed)
Main Weapon: Longsword melee d3+1 (dmg 1d8+1+deed)
Secondary Weapon: Longbow ranged d3 (dmg 1d6+deed)

AC: (12) (Leather (+2) Check penalty (-1) Fumble die (d8))
Equipment: Chain 10' (30 gp)
Trade good: Deer pelt
Starting Funds: 37 cp + 33 gp
Lucky sign: Lucky sign (Saving throws) (+0)
Languages: Common

Warrior trait: Lucky weapon - choose one weapon that you apply your luck mod to`;
const THIEF_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Thief (5th level)
Occupation: Potato Farmer
Strength: 12 (0)
Agility: 12 (0)
Stamina: 12 (0)
Personality: 11 (0)
Intelligence: 11 (0)
Luck: 10 (0)

HP: 24; Speed: 30; Init: 0
Ref: 3; Fort: 2; Will: 1

Base Attack Mod: 3
Attack Dice: 1d20; Crit Die/Table: 1d20/II
Occupation Weapon: Spear melee +3 (dmg 1d8)
Main Weapon: +2 Short sword melee +5 (dmg 1d6+2)
Secondary Weapon: Blowgun ranged +3 (dmg 1d3)

AC: (13) (Studded Leather (+3) Check penalty (-2) Fumble die (d8))
Equipment: Chalk - 1 piece (1 cp)
Trade good: Mule
Starting Funds: 36 cp + 1421 gp
Lucky sign: Path of the bear (Melee damage rolls) (+0)
Languages: Common, Thieves' Cant

Thief Ability: When expending luck, roll d7 for each point expended

Thief Skills:
Backstab: 4 (0)
Sneak Silently: 7 (-2)
Hide In Shadows: 6 (-2)
Pick Pocket: 7 (-2)
Climb Sheer Surfaces: 7 (-2)
Pick Lock: 6 (-2)
Find Trap: 8 (0)
Disable Trap: 6 (-2)
Forge Document: 7 (-2)
Disguise Self: 3 (0)
Read Languages: 4 (0)
Handle Poison: 3 (0)
Cast Spell From Scroll (d16)`;
const WIZARD_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Lawful Wizard (5th level)
Occupation: Squire
Strength: 5 (-2)
Agility: 12 (0)
Stamina: 12 (0)
Personality: 13 (+1)
Intelligence: 12 (0)
Luck: 17 (+2)

HP: 15; Speed: 30; Init: 0
Ref: 2; Fort: 1; Will: 4

Base Attack Mod: 2
Attack Dice: 1d20+1d14; Crit Die/Table: 1d10/I
Occupation Weapon: Longsword melee +0 (dmg 1d8-2)
Main Weapon: +1 Dagger melee +1 (dmg 1d4-1)
Secondary Weapon: Dart ranged +2 (dmg 1d4-2)

AC: (10) (Unarmored (+0) Check penalty (0) Fumble die (d4))
Equipment: Mirror - hand-sized (10 gp)
Trade good: Steel helmet
Starting Funds: 28 cp + 1017 gp
Lucky sign: Birdsong (Number of languages) (+2)
Languages: Common, Centaur, Bear

Spells: (Spell Check: d20+5)
1) Cantrip
1) Choking Cloud
1) Find Familiar
1) Ropework
1) Ward Portal
2) Nythuul's Porcupine Coat
2) Wizard Staff
3) Transference`;
const CLERIC_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Lawful Cleric (5th level)
Occupation: Tax collector
Strength: 16 (+2)
Agility: 9 (0)
Stamina: 13 (+1)
Personality: 11 (0)
Intelligence: 12 (0)
Luck: 15 (+1)

HP: 27; Speed: 20; Init: 0
Ref: 1; Fort: 3; Will: 3

Base Attack Mod: 3
Attack Dice: 1d20; Crit Die/Table: 1d12/III
Occupation Weapon: Longsword melee +5 (dmg 1d8+2)
Main Weapon: +2 Mace melee +7 (dmg 1d6+4)
Secondary Weapon: Crossbow ranged +3 (dmg 1d6)

AC: (18) (Full Plate (+8) Check penalty (-8) Fumble die (d16) Speed (-10))
Equipment: Backpack (2 gp)
Trade good: 100 cp
Starting Funds: 44 cp + 1335 gp
Lucky sign: Guardian angel (Savings throws to escape traps) (+1)
Languages: Common

Spells: (Spell Check: d20+5)
1) Darkness
1) Detect Evil
1) Food of the Gods
1) Holy Sanctuary
1) Second Sight
1) Word of Command
2) Banish
2) Binding
2) Divine Symbol
2) Neutralize Poison/Disease
2) Restore Vitality
3) Animate Dead
3) Bolt from the Blue`;
const ELF_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Chaotic Elf (5th level)
Occupation: Elven barrister
Strength: 7 (-1)
Agility: 8 (-1)
Stamina: 13 (+1)
Personality: 5 (-2)
Intelligence: 14 (+1)
Luck: 7 (-1)

HP: 32; Speed: 25; Init: -1
Ref: 0; Fort: 3; Will: 1

Base Attack Mod: 3
Attack Dice: 1d20+1d14; Crit Die/Table: 1d10/II
Occupation Weapon: Dart ranged +2 (dmg 1d4-1)
Main Weapon: +3 Longsword melee +5 (dmg 1d8+2)
Secondary Weapon: Shortbow ranged +2 (dmg 1d6)

AC: (14) (Chainmail (+5) Check penalty (-5) Fumble die (d12) Speed (-5))
Equipment: Flask - empty (3 cp)
Trade good: Book
Starting Funds: 37 cp + 2024 gp
Lucky sign: Struck by lightning (Reflex saving throws) (-1)
Languages: Common, Elf, Demonic, Horse

Racial Traits: Elven traits: Heightened senses, iron vulnerability, Infravision
Elf trait: Lucky spell - choose one spell that you apply your luck mod to

Spells: (Spell Check: d20+6)
1) Patron Bond
1) Invoke Patron
1) Charm Person
1) Ekim's Mystical Mask
1) Enlarge
1) Ropework
2) Phantasm
2) Wizard Staff
3) Slow`;
const DWARF_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Dwarf (5th level)
Occupation: Dwarven apothecarist
Strength: 13 (+1)
Agility: 6 (-1)
Stamina: 12 (0)
Personality: 7 (-1)
Intelligence: 12 (0)
Luck: 10 (0)

HP: 23; Speed: 15; Init: -1
Ref: 1; Fort: 3; Will: 1

Base Attack Mod: d7
Attack Dice: 1d20+1d14; Crit Die/Table: 1d20/IV
Occupation Weapon: Staff melee d7+1 (dmg 1d4+1+deed)
Main Weapon: +5 Battleaxe melee d7+6 (dmg 1d10+6+deed)
Secondary Weapon: Crossbow ranged d7-1 (dmg 1d6+deed)

AC: (15) (Banded Mail (+6) Check penalty (-6) Fumble die (d16) Speed (-5))
Equipment: Grappling hook (1 gp)
Trade good: Steel vial
Starting Funds: 20 cp + 2050 gp
Lucky sign: Struck by lightning (Reflex saving throws) (+0)
Languages: Common, Dwarf, Alignment

Racial Traits: Dwarven ability: Infravision
Dwarf skill: Shield bash - make an extra d14 attack with your shield. (1d3 damage)`;
const HALFLING_TEXT = `Generator Settings
Source: Rulebook | Roll Mode: 3d6 | HP: normal | HP-up: normal | Augur: normal

Neutral Halfling (5th level)
Occupation: Halfling trader
Strength: 13 (+1)
Agility: 15 (+1)
Stamina: 10 (0)
Personality: 14 (+1)
Intelligence: 6 (-1)
Luck: 12 (0)

HP: 15; Speed: 20; Init: 1
Ref: 4; Fort: 2; Will: 4

Base Attack Mod: 4
Attack Dice: 1d20; Crit Die/Table: 1d12/III
Occupation Weapon: Short sword melee +5 (dmg 1d6+1)
Main Weapon: +2 Short sword melee +7 (dmg 1d6+3)
Secondary Weapon: +1 Short sword melee +6 (dmg 1d6+2)

AC: (14) (Studded Leather (+3) Check penalty (-2) Fumble die (d8))
Equipment: Oil - 1 flask (2 sp)
Trade good: 20 sp
Starting Funds: 30 cp + 1539 gp
Lucky sign: Struck by lightning (Reflex saving throws) (+0)
Languages: Common, Kobold

Racial Traits: Halfling ability: Infravision
Halfling skills: Two weapon fighting, Good luck charm, Stealth

Thief Skills:
Sneak Silently: 8 (-1)
Hide In Shadows: 8 (-1)`;
const JSON_ZERO_LEVELS = `{
"characters" : [
  {
  "occTitle": "Halfling haberdasher",
  "strengthScore": "13",
  "strengthMod": "1",
  "agilityScore": "12",
  "agilityMod": "0",
  "staminaScore": "12",
  "staminaMod": "0",
  "personalityScore": "11",
  "personalityMod": "0",
  "intelligenceScore": "13",
  "intelligenceMod": "1",
  "luckScore": "13",
  "luckMod": "1",
  "armorClass": "10",
  "hitPoints": "4",
  "weapon": "Scissors (as dagger)",
  "attackMod": "1",
  "attackDamageMod": "1",
  "attackDamage": "1d4+1",
  "attackModMelee": "1",
  "attackDamageMelee": "1",
  "attackModRanged": "0",
  "attackDamageRanged": "0",
  "speed": "20",
  "initiative": "0",
  "saveReflex": "0",
  "saveFort": "0",
  "saveWill": "0",
  "equipment": "Holy symbol (25 gp)",
  "equipment2": "",
  "equipment3": "Water skin",
  "tradeGood": "Fine suits (3 sets)",
  "startingFunds": "44 cp",
  "luckySign": "The Broken Star (Fumbles) (+1)",
  "languages": "Common/Halfling/Hobgoblin",
  "racialTraits": "Halfling ability: Infravision"
},
  {
  "occTitle": "Herder",
  "strengthScore": "10",
  "strengthMod": "0",
  "agilityScore": "10",
  "agilityMod": "0",
  "staminaScore": "10",
  "staminaMod": "0",
  "personalityScore": "4",
  "personalityMod": "-2",
  "intelligenceScore": "10",
  "intelligenceMod": "0",
  "luckScore": "15",
  "luckMod": "1",
  "armorClass": "10",
  "hitPoints": "4",
  "weapon": "Staff",
  "attackMod": "0",
  "attackDamageMod": "0",
  "attackDamage": "1d4",
  "attackModMelee": "0",
  "attackDamageMelee": "0",
  "attackModRanged": "0",
  "attackDamageRanged": "0",
  "speed": "30",
  "initiative": "0",
  "saveReflex": "0",
  "saveFort": "0",
  "saveWill": "-2",
  "equipment": "Torch (1 cp)",
  "equipment2": "",
  "equipment3": "Water skin",
  "tradeGood": "Herding dog",
  "startingFunds": "34 cp",
  "luckySign": "Bountiful harvest (Hit points, applies each level) (+1)",
  "languages": "Common",
  "racialTraits": ""
}
]
}`;
// =============================================================================
// Text Parser Tests
// =============================================================================
describe("parsePurpleSorcererText", () => {
    describe("0-level characters", () => {
        it("parses a single 0-level character", () => {
            const result = parsePurpleSorcererText(ZERO_LEVEL_TEXT);
            expect(result.success).toBe(true);
            expect(result.characters).toHaveLength(1);
            expect(result.errors).toHaveLength(0);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(0);
            expect(char.occupation).toBe("Dwarven stonemason");
            expect(char.abilities.strength.score).toBe(8);
            expect(char.abilities.strength.modifier).toBe(-1);
            expect(char.abilities.agility.score).toBe(13);
            expect(char.abilities.luck.score).toBe(5);
            expect(char.ac).toBe(11);
            expect(char.hp).toBe(1);
            expect(char.speed).toBe(10);
            expect(char.initiative).toBe(1);
            expect(char.reflex).toBe(1);
            expect(char.fortitude).toBe(0);
            expect(char.will).toBe(-2);
            expect(char.weapon?.name).toBe("Hammer (as club)");
            expect(char.weapon?.attackMod).toBe("-1");
            expect(char.weapon?.damage).toBe("1d4-1");
            expect(char.tradeGood).toBe("Fine stone (10 lbs)");
            expect(char.startingFunds).toBe("26 cp");
            expect(char.luckySign?.name).toBe("Wild child");
            expect(char.luckySign?.modifier).toBe(-2);
            expect(char.languages).toContain("Common");
            expect(char.languages).toContain("Dwarf");
            expect(char.racialTraits).toContain("Dwarven ability: Infravision");
        });
        it("parses multiple 0-level characters", () => {
            const result = parsePurpleSorcererText(MULTIPLE_ZERO_LEVELS_TEXT);
            expect(result.success).toBe(true);
            expect(result.characters).toHaveLength(2);
            expect(defined(result.characters[0]).occupation).toBe("Dwarven stonemason");
            expect(defined(result.characters[1]).occupation).toBe("Hunter");
            expect(defined(result.characters[1]).weapon?.name).toBe("Shortbow");
            expect(defined(result.characters[1]).weapon?.type).toBe("ranged");
        });
        it("parses generator settings", () => {
            const result = parsePurpleSorcererText(ZERO_LEVEL_TEXT);
            const char = defined(result.characters[0]);
            expect(char.settings).toBeDefined();
            expect(char.settings?.source).toBe("Rulebook");
            expect(char.settings?.rollMode).toBe("3d6");
            expect(char.settings?.hpMode).toBe("normal");
            expect(char.settings?.augurMode).toBe("normal");
        });
    });
    describe("Warrior", () => {
        it("parses a warrior character", () => {
            const result = parsePurpleSorcererText(WARRIOR_TEXT);
            expect(result.success).toBe(true);
            expect(result.characters).toHaveLength(1);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(1);
            expect(char.classType).toBe("warrior");
            expect(char.alignment).toBe("neutral");
            expect(char.occupation).toBe("Hunter");
            expect(char.baseAttackMod).toBe("d3");
            expect(char.attackDice).toBe("1d20");
            expect(char.critDie).toBe("1d12");
            expect(char.critTable).toBe("III");
            expect(char.mainWeapon?.name).toBe("Longsword");
            expect(char.mainWeapon?.attackMod).toBe("d3+1");
            expect(char.armor?.name).toBe("Leather");
            expect(char.armor?.acBonus).toBe(2);
            expect(char.armor?.checkPenalty).toBe(-1);
            expect(char.armor?.fumbleDie).toBe("d8");
            expect(char.classTrait).toContain("Lucky weapon");
        });
    });
    describe("Thief", () => {
        it("parses a thief character with skills", () => {
            const result = parsePurpleSorcererText(THIEF_TEXT);
            expect(result.success).toBe(true);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(5);
            expect(char.classType).toBe("thief");
            expect(char.baseAttackMod).toBe("3");
            expect(char.critDie).toBe("1d20");
            expect(char.critTable).toBe("II");
            expect(char.luckDie).toBe("d7");
            expect(char.thiefSkills).toBeDefined();
            expect(char.thiefSkills).toHaveLength(12);
            const backstab = char.thiefSkills?.find((s) => s.name === "Backstab");
            expect(backstab?.bonus).toBe(4);
            const sneak = char.thiefSkills?.find((s) => s.name === "Sneak Silently");
            expect(sneak?.bonus).toBe(7);
            expect(sneak?.checkPenalty).toBe(-2);
            expect(char.castSpellFromScrollDie).toBe("d16");
            // Check magic weapon parsing
            expect(char.mainWeapon?.name).toBe("Short sword");
            expect(char.mainWeapon?.magicBonus).toBe(2);
        });
    });
    describe("Wizard", () => {
        it("parses a wizard character with spells", () => {
            const result = parsePurpleSorcererText(WIZARD_TEXT);
            expect(result.success).toBe(true);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(5);
            expect(char.classType).toBe("wizard");
            expect(char.alignment).toBe("lawful");
            expect(char.attackDice).toBe("1d20+1d14");
            expect(char.spellCheck).toBe("d20+5");
            expect(char.spells).toBeDefined();
            expect(char.spells).toHaveLength(8);
            const level1Spells = char.spells?.filter((s) => s.level === 1);
            expect(level1Spells).toHaveLength(5);
            const level2Spells = char.spells?.filter((s) => s.level === 2);
            expect(level2Spells).toHaveLength(2);
            const level3Spells = char.spells?.filter((s) => s.level === 3);
            expect(level3Spells).toHaveLength(1);
            expect(level3Spells?.[0]?.name).toBe("Transference");
        });
    });
    describe("Cleric", () => {
        it("parses a cleric character with spells", () => {
            const result = parsePurpleSorcererText(CLERIC_TEXT);
            expect(result.success).toBe(true);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(5);
            expect(char.classType).toBe("cleric");
            expect(char.alignment).toBe("lawful");
            expect(char.spells).toHaveLength(13);
            expect(char.armor?.name).toBe("Full Plate");
            expect(char.armor?.acBonus).toBe(8);
            expect(char.armor?.speedPenalty).toBe(-10);
            expect(char.speed).toBe(20);
        });
    });
    describe("Elf", () => {
        it("parses an elf character", () => {
            const result = parsePurpleSorcererText(ELF_TEXT);
            expect(result.success).toBe(true);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(5);
            expect(char.classType).toBe("elf");
            expect(char.alignment).toBe("chaotic");
            expect(char.attackDice).toBe("1d20+1d14");
            expect(char.spells).toHaveLength(9);
            expect(char.languages).toContain("Elf");
            expect(char.languages).toContain("Demonic");
            expect(char.racialTraits).toBeDefined();
        });
    });
    describe("Dwarf", () => {
        it("parses a dwarf character with deed die", () => {
            const result = parsePurpleSorcererText(DWARF_TEXT);
            expect(result.success).toBe(true);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(5);
            expect(char.classType).toBe("dwarf");
            expect(char.baseAttackMod).toBe("d7");
            expect(char.critDie).toBe("1d20");
            expect(char.critTable).toBe("IV");
            expect(char.mainWeapon?.magicBonus).toBe(5);
        });
    });
    describe("Halfling", () => {
        it("parses a halfling character with thief skills", () => {
            const result = parsePurpleSorcererText(HALFLING_TEXT);
            expect(result.success).toBe(true);
            const char = defined(result.characters[0]);
            expect(char.level).toBe(5);
            expect(char.classType).toBe("halfling");
            expect(char.thiefSkills).toHaveLength(2);
            const sneak = char.thiefSkills?.find((s) => s.name === "Sneak Silently");
            expect(sneak?.bonus).toBe(8);
        });
    });
    describe("error handling", () => {
        it("returns error for empty input", () => {
            const result = parsePurpleSorcererText("");
            expect(result.success).toBe(false);
            expect(result.errors).toContain("Empty input");
        });
        it("returns error for invalid input", () => {
            const result = parsePurpleSorcererText("This is not a character");
            expect(result.success).toBe(false);
            expect(result.errors).toContain("No character data found in input");
        });
    });
});
// =============================================================================
// JSON Parser Tests
// =============================================================================
describe("parsePurpleSorcererJson", () => {
    it("parses JSON format with multiple characters", () => {
        const result = parsePurpleSorcererJson(JSON_ZERO_LEVELS);
        expect(result.success).toBe(true);
        expect(result.characters).toHaveLength(2);
        const halfling = defined(result.characters[0]);
        expect(halfling.occupation).toBe("Halfling haberdasher");
        expect(halfling.abilities.strength.score).toBe(13);
        expect(halfling.abilities.personality.modifier).toBe(0);
        expect(halfling.ac).toBe(10);
        expect(halfling.hp).toBe(4);
        expect(halfling.speed).toBe(20);
        expect(halfling.weapon?.name).toBe("Scissors (as dagger)");
        expect(halfling.luckySign?.name).toBe("The Broken Star");
        expect(halfling.luckySign?.modifier).toBe(1);
        expect(halfling.languages).toContain("Common");
        expect(halfling.languages).toContain("Halfling");
        expect(halfling.racialTraits).toContain("Halfling ability: Infravision");
        const herder = defined(result.characters[1]);
        expect(herder.occupation).toBe("Herder");
        expect(herder.speed).toBe(30);
        expect(herder.will).toBe(-2);
    });
    it("returns error for invalid JSON", () => {
        const result = parsePurpleSorcererJson("not json");
        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain("Invalid JSON");
    });
    it("returns error for empty input", () => {
        const result = parsePurpleSorcererJson("");
        expect(result.success).toBe(false);
        expect(result.errors).toContain("Empty input");
    });
});
// =============================================================================
// Unified Parser Tests
// =============================================================================
describe("parsePurpleSorcerer", () => {
    it("auto-detects text format", () => {
        const result = parsePurpleSorcerer(ZERO_LEVEL_TEXT);
        expect(result.success).toBe(true);
        expect(defined(result.characters[0]).occupation).toBe("Dwarven stonemason");
    });
    it("auto-detects JSON format", () => {
        const result = parsePurpleSorcerer(JSON_ZERO_LEVELS);
        expect(result.success).toBe(true);
        expect(defined(result.characters[0]).occupation).toBe("Halfling haberdasher");
    });
});
// =============================================================================
// Converter Tests
// =============================================================================
describe("convertPSCharacter", () => {
    it("converts 0-level character to Character type", () => {
        const result = parsePurpleSorcerer(ZERO_LEVEL_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar, { defaultName: "Grimjaw" });
        expect(character.identity.name).toBe("Grimjaw");
        expect(character.identity.occupation).toBe("Dwarven stonemason");
        expect(character.identity.alignment).toBe("n"); // "n" is the library's neutral alignment
        expect(character.identity.startingLuck).toBe(5);
        expect(character.identity.languages).toContain("Dwarf");
        expect(character.identity.birthAugur.name).toBe("Wild child");
        expect(character.classInfo).toBeUndefined();
        expect(character.state.hp.current).toBe(1);
        expect(character.state.hp.max).toBe(1);
        expect(character.state.abilities.str.current).toBe(8);
        expect(character.state.abilities.lck.current).toBe(5);
        expect(character.state.saves.reflex).toBe(1);
        expect(character.state.combat.ac).toBe(11);
        expect(character.state.combat.speed).toBe(10);
        expect(character.state.currency.cp).toBe(26);
        // Check inventory
        const weapons = character.state.inventory.items.filter((i) => i.category === "weapon");
        expect(weapons).toHaveLength(1);
        expect(defined(weapons[0]).name).toBe("Hammer (as club)");
    });
    it("converts leveled warrior to Character type", () => {
        const result = parsePurpleSorcerer(WARRIOR_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar, { defaultName: "Ragnar" });
        expect(character.identity.name).toBe("Ragnar");
        expect(character.identity.alignment).toBe("n"); // "n" is the library's neutral alignment
        expect(character.classInfo?.classId).toBe("warrior");
        expect(character.classInfo?.level).toBe(1);
        expect(character.state.classState?.warrior?.deedDie).toBe("d3");
        expect(character.state.currency.cp).toBe(37);
        expect(character.state.currency.gp).toBe(33);
    });
    it("converts thief with class state", () => {
        const result = parsePurpleSorcerer(THIEF_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar);
        expect(character.classInfo?.classId).toBe("thief");
        expect(character.classInfo?.level).toBe(5);
        expect(character.state.classState?.thief?.luckDie).toBe("d7");
    });
    it("converts wizard with spellbook", () => {
        const result = parsePurpleSorcerer(WIZARD_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar);
        expect(character.classInfo?.classId).toBe("wizard");
        expect(character.state.classState?.wizard?.spellbook?.spells).toHaveLength(8);
        expect(character.state.classState?.wizard?.corruption).toEqual([]);
    });
    it("converts cleric with spellbook", () => {
        const result = parsePurpleSorcerer(CLERIC_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar);
        expect(character.classInfo?.classId).toBe("cleric");
        expect(character.state.classState?.cleric?.disapprovalRange).toBe(1);
        expect(character.state.classState?.cleric?.spellbook?.spells).toHaveLength(13);
    });
    it("converts elf with spellbook", () => {
        const result = parsePurpleSorcerer(ELF_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar);
        expect(character.classInfo?.classId).toBe("elf");
        expect(character.state.classState?.elf?.spellbook?.spells).toHaveLength(9);
    });
    it("converts dwarf with deed die", () => {
        const result = parsePurpleSorcerer(DWARF_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar);
        expect(character.classInfo?.classId).toBe("dwarf");
        expect(character.state.classState?.dwarf?.deedDie).toBe("d7");
    });
    it("converts halfling with two-weapon fighting", () => {
        const result = parsePurpleSorcerer(HALFLING_TEXT);
        const psChar = defined(result.characters[0]);
        const character = convertPSCharacter(psChar);
        expect(character.classInfo?.classId).toBe("halfling");
        expect(character.state.classState?.halfling?.twoWeaponFighting).toBe(true);
    });
    it("uses custom ID generator", () => {
        const result = parsePurpleSorcerer(ZERO_LEVEL_TEXT);
        const psChar = defined(result.characters[0]);
        let counter = 0;
        const character = convertPSCharacter(psChar, {
            generateId: () => `custom-${String(++counter)}`,
        });
        expect(character.identity.id).toBe("custom-1");
    });
});
describe("convertPSCharacters", () => {
    it("converts multiple characters", () => {
        const result = parsePurpleSorcerer(MULTIPLE_ZERO_LEVELS_TEXT);
        const characters = convertPSCharacters(result.characters, {
            defaultName: "Unnamed Peasant",
        });
        expect(characters).toHaveLength(2);
        expect(defined(characters[0]).identity.occupation).toBe("Dwarven stonemason");
        expect(defined(characters[1]).identity.occupation).toBe("Hunter");
    });
});
//# sourceMappingURL=purple-sorcerer.test.js.map