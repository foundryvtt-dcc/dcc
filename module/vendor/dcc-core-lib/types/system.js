/**
 * System configuration types
 *
 * These types define a game system (DCC, MCC, XCrawl, etc.)
 * allowing the core library to work with different rule variants.
 */
/**
 * Standard DCC abilities
 */
export const DCC_ABILITIES = [
    { id: "str", name: "Strength", abbrev: "STR" },
    { id: "agl", name: "Agility", abbrev: "AGL" },
    { id: "sta", name: "Stamina", abbrev: "STA" },
    { id: "per", name: "Personality", abbrev: "PER" },
    { id: "int", name: "Intelligence", abbrev: "INT" },
    { id: "lck", name: "Luck", abbrev: "LCK" },
];
/**
 * Standard DCC alignments
 */
export const DCC_ALIGNMENTS = [
    { id: "l", name: "Lawful", abbrev: "L" },
    { id: "n", name: "Neutral", abbrev: "N" },
    { id: "c", name: "Chaotic", abbrev: "C" },
];
/**
 * Standard DCC saves
 */
export const DCC_SAVES = [
    { id: "reflex", name: "Reflex", abbrev: "Ref", ability: "agl" },
    { id: "fortitude", name: "Fortitude", abbrev: "Fort", ability: "sta" },
    { id: "will", name: "Will", abbrev: "Will", ability: "per" },
];
/**
 * Standard DCC ability mappings
 */
export const DCC_ABILITY_MAPPINGS = {
    meleeAttack: "str",
    meleeDamage: "str",
    missileAttack: "agl",
    armorClass: "agl",
    hitPoints: "sta",
    reflexSave: "agl",
    fortSave: "sta",
    willSave: "per",
    initiative: "agl",
    wizardSpellCheck: "int",
    clericSpellCheck: "per",
};
/**
 * Standard DCC system configuration
 */
export const DCC_SYSTEM = {
    id: "dcc",
    name: "Dungeon Crawl Classics",
    abilities: [...DCC_ABILITIES],
    abilityMappings: DCC_ABILITY_MAPPINGS,
    alignments: [...DCC_ALIGNMENTS],
    saves: [...DCC_SAVES],
    classes: [
        "warrior",
        "wizard",
        "cleric",
        "thief",
        "dwarf",
        "elf",
        "halfling",
    ],
    mechanics: {
        hasDisapproval: true,
        hasMercurial: true,
        hasLuckDie: true,
        hasFleetingLuck: true,
    },
};
/**
 * Helper to find an ability by ID
 */
export function findAbility(abilities, id) {
    return abilities.find((a) => a.id === id);
}
/**
 * Helper to find a save by ID
 */
export function findSave(saves, id) {
    return saves.find((s) => s.id === id);
}
//# sourceMappingURL=system.js.map