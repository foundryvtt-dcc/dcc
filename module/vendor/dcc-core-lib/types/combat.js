/**
 * Combat System Types
 *
 * Types for attack rolls, damage calculations, critical hits, fumbles,
 * and initiative in DCC.
 */
/**
 * Fumble die by armor type
 */
export const FUMBLE_DICE = {
    unarmored: "d4",
    padded: "d8",
    leather: "d8",
    "studded-leather": "d8",
    hide: "d12",
    scale: "d12",
    chainmail: "d12",
    banded: "d16",
    "half-plate": "d16",
    "full-plate": "d16",
};
/**
 * AC bonus by armor type (DCC core rules Table 3-3)
 */
export const ARMOR_AC_BONUS = {
    unarmored: 0,
    padded: 1,
    leather: 2,
    "studded-leather": 3,
    hide: 3,
    scale: 4,
    chainmail: 5,
    banded: 6,
    "half-plate": 7,
    "full-plate": 8,
};
/**
 * Shield AC bonus
 */
export const SHIELD_AC_BONUS = 1;
/**
 * Base AC without any armor or modifiers
 */
export const BASE_AC = 10;
/**
 * Common weapon stats
 */
export const COMMON_WEAPONS = {
    dagger: {
        name: "Dagger",
        damageDie: "d4",
        isMelee: true,
        isRanged: true,
        range: 10,
        backstabDamage: { damageDie: "d10" },
    },
    blackjack: {
        name: "Blackjack",
        damageDie: "d3",
        isMelee: true,
        isRanged: false,
        backstabDamage: { damageDie: "d6", diceCount: 2 },
    },
    blowgun: {
        name: "Blowgun",
        damageDie: "d3",
        isMelee: false,
        isRanged: true,
        range: 20,
        backstabDamage: { damageDie: "d5" },
    },
    garrote: {
        name: "Garrote",
        // RAW: normal damage is a flat 1. Modeled as d1 so the dice
        // pipeline can roll it uniformly (1d1 always yields 1).
        damageDie: "d1",
        isMelee: true,
        isRanged: false,
        backstabDamage: { damageDie: "d4", diceCount: 3 },
    },
    shortSword: {
        name: "Short Sword",
        damageDie: "d6",
        isMelee: true,
        isRanged: false,
    },
    longsword: {
        name: "Longsword",
        damageDie: "d8",
        isMelee: true,
        isRanged: false,
    },
    battleaxe: {
        name: "Battleaxe",
        damageDie: "d8",
        isMelee: true,
        isRanged: false,
    },
    twoHandedSword: {
        name: "Two-Handed Sword",
        damageDie: "d10",
        isMelee: true,
        isRanged: false,
        twoHanded: true,
    },
    mace: {
        name: "Mace",
        damageDie: "d6",
        isMelee: true,
        isRanged: false,
    },
    staff: {
        name: "Staff",
        damageDie: "d4",
        isMelee: true,
        isRanged: false,
        twoHanded: true,
    },
    shortbow: {
        name: "Shortbow",
        damageDie: "d6",
        isMelee: false,
        isRanged: true,
        range: 50,
        twoHanded: true,
    },
    longbow: {
        name: "Longbow",
        damageDie: "d6",
        isMelee: false,
        isRanged: true,
        range: 70,
        twoHanded: true,
    },
    crossbow: {
        name: "Crossbow",
        damageDie: "d6",
        isMelee: false,
        isRanged: true,
        range: 80,
        twoHanded: true,
    },
    club: {
        name: "Club",
        damageDie: "d4",
        isMelee: true,
        isRanged: false,
    },
    spear: {
        name: "Spear",
        damageDie: "d8",
        isMelee: true,
        isRanged: true,
        range: 30,
    },
    handaxe: {
        name: "Handaxe",
        damageDie: "d6",
        isMelee: true,
        isRanged: true,
        range: 10,
    },
    flail: {
        name: "Flail",
        damageDie: "d6",
        isMelee: true,
        isRanged: false,
    },
    polearm: {
        name: "Polearm",
        damageDie: "d10",
        isMelee: true,
        isRanged: false,
        twoHanded: true,
    },
};
//# sourceMappingURL=combat.js.map