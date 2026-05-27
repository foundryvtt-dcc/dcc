/**
 * Purple Sorcerer Parser Types
 *
 * Types for parsing character data from Purple Sorcerer's generators.
 * Supports both text format (copy-paste) and JSON format (API/export).
 */
import type { Alignment } from "../types/system.js";
import type { DieType } from "../types/dice.js";
/**
 * Generator settings from the output header
 */
export interface PSGeneratorSettings {
    source: string;
    rollMode: string;
    hpMode: string;
    hpUpMode?: string;
    augurMode: string;
}
/**
 * Parsed ability score
 */
export interface PSAbilityScore {
    score: number;
    modifier: number;
}
/**
 * Parsed ability scores (all six)
 */
export interface PSAbilityScores {
    strength: PSAbilityScore;
    agility: PSAbilityScore;
    stamina: PSAbilityScore;
    personality: PSAbilityScore;
    intelligence: PSAbilityScore;
    luck: PSAbilityScore;
}
/**
 * Parsed weapon data
 */
export interface PSWeapon {
    name: string;
    type: "melee" | "ranged";
    attackMod: string;
    damage: string;
    magicBonus?: number | undefined;
}
/**
 * Parsed armor data
 */
export interface PSArmor {
    name: string;
    acBonus: number;
    checkPenalty: number;
    fumbleDie: DieType;
    speedPenalty?: number | undefined;
}
/**
 * Parsed thief skill
 */
export interface PSThiefSkill {
    name: string;
    bonus: number;
    checkPenalty: number;
}
/**
 * Parsed spell entry
 */
export interface PSSpell {
    level: number;
    name: string;
}
/**
 * Lucky sign / birth augur
 */
export interface PSLuckySign {
    name: string;
    effect: string;
    modifier: number;
}
/**
 * Class type (lowercase, matches classId in the library)
 */
export type PSClassType = "warrior" | "wizard" | "cleric" | "thief" | "dwarf" | "elf" | "halfling";
/**
 * Complete parsed character from Purple Sorcerer
 */
export interface PSCharacter {
    settings?: PSGeneratorSettings;
    occupation: string;
    alignment?: Alignment;
    classType?: PSClassType;
    level: number;
    abilities: PSAbilityScores;
    ac: number;
    hp: number;
    speed: number;
    initiative: number;
    reflex: number;
    fortitude: number;
    will: number;
    baseAttackMod?: string;
    attackDice?: string;
    critDie?: DieType;
    critTable?: string;
    occupationWeapon?: PSWeapon;
    mainWeapon?: PSWeapon;
    secondaryWeapon?: PSWeapon;
    weapon?: PSWeapon;
    armor?: PSArmor;
    equipment: string[];
    tradeGood?: string;
    startingFunds: string;
    luckySign?: PSLuckySign;
    languages: string[];
    racialTraits?: string[];
    classTrait?: string;
    thiefSkills?: PSThiefSkill[];
    spells?: PSSpell[];
    spellCheck?: string;
    luckDie?: DieType;
    castSpellFromScrollDie?: DieType;
}
/**
 * Raw character from Purple Sorcerer JSON format (0-level)
 */
export interface PSJsonZeroLevel {
    occTitle: string;
    strengthScore: string;
    strengthMod: string;
    agilityScore: string;
    agilityMod: string;
    staminaScore: string;
    staminaMod: string;
    personalityScore: string;
    personalityMod: string;
    intelligenceScore: string;
    intelligenceMod: string;
    luckScore: string;
    luckMod: string;
    armorClass: string;
    hitPoints: string;
    weapon: string;
    attackMod: string;
    attackDamageMod: string;
    attackDamage: string;
    attackModMelee: string;
    attackDamageMelee: string;
    attackModRanged: string;
    attackDamageRanged: string;
    speed: string;
    initiative: string;
    saveReflex: string;
    saveFort: string;
    saveWill: string;
    equipment: string;
    equipment2?: string;
    equipment3?: string;
    tradeGood: string;
    startingFunds: string;
    luckySign: string;
    languages: string;
    racialTraits: string;
}
/**
 * Container for multiple JSON characters
 */
export interface PSJsonCharacterList {
    characters: PSJsonZeroLevel[];
}
/**
 * Result of parsing Purple Sorcerer data
 */
export interface PSParseResult {
    success: boolean;
    characters: PSCharacter[];
    errors: string[];
    warnings: string[];
}
//# sourceMappingURL=purple-sorcerer-types.d.ts.map