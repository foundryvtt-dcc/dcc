/**
 * Thief Skill Definitions
 *
 * These define the base mechanics for each thief skill.
 * Level-specific bonuses come from class progression data.
 *
 * `BACKSTAB` lives in `enabling-skills.ts` (as the single source of
 * truth for the skill definition, since backstab is a passive enabling
 * skill in mechanics). It is re-exported here so the thief-skill
 * catalog (Table 1-7's skill list) is complete under one registry.
 */
import { BACKSTAB } from "./enabling-skills.js";
export { BACKSTAB };
/**
 * Sneak Silently - move without being heard
 */
export const SNEAK_SILENTLY = {
    id: "sneak-silently",
    name: "Sneak Silently",
    description: "The thief can move silently, avoiding detection by sound. " +
        "Roll vs. the target's opposed check or a set DC.",
    type: "check",
    roll: {
        die: "d20",
        ability: "agi",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "stealth"],
    classes: ["thief"],
};
/**
 * Hide in Shadows - conceal oneself in darkness
 */
export const HIDE_IN_SHADOWS = {
    id: "hide-in-shadows",
    name: "Hide in Shadows",
    description: "The thief can hide in shadows or areas of dim light, " +
        "becoming effectively invisible to casual observation.",
    type: "check",
    roll: {
        die: "d20",
        ability: "agi",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "stealth"],
    classes: ["thief"],
};
/**
 * Pick Pockets - steal from a target without detection
 */
export const PICK_POCKETS = {
    id: "pick-pockets",
    name: "Pick Pockets",
    description: "The thief can lift items from a target's person without " +
        "being noticed. Failure may alert the target.",
    type: "check",
    roll: {
        die: "d20",
        ability: "agi",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "stealth", "sleight-of-hand"],
    classes: ["thief"],
};
/**
 * Climb Sheer Surfaces - scale walls and cliffs
 */
export const CLIMB_SHEER_SURFACES = {
    id: "climb-sheer-surfaces",
    name: "Climb Sheer Surfaces",
    description: "The thief can climb walls, cliffs, and other surfaces that " +
        "would be impossible for untrained characters.",
    type: "check",
    roll: {
        die: "d20",
        ability: "agi",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "movement"],
    classes: ["thief"],
};
/**
 * Pick Lock - open locks without a key
 */
export const PICK_LOCK = {
    id: "pick-lock",
    name: "Pick Lock",
    description: "The thief can open locks using picks and other tools. " +
        "More complex locks have higher DCs.",
    type: "check",
    roll: {
        die: "d20",
        ability: "agi",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "security"],
    classes: ["thief"],
};
/**
 * Find Trap - locate hidden traps
 */
export const FIND_TRAP = {
    id: "find-trap",
    name: "Find Trap",
    description: "The thief can detect traps through careful observation. " +
        "This does not disarm the trap, only locate it.",
    type: "check",
    roll: {
        die: "d20",
        ability: "int",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "security", "perception"],
    classes: ["thief"],
};
/**
 * Disable Trap - safely disarm detected traps
 */
export const DISABLE_TRAP = {
    id: "disable-trap",
    name: "Disable Trap",
    description: "The thief can disarm traps that have been detected. " +
        "Failure may trigger the trap.",
    type: "check",
    roll: {
        die: "d20",
        ability: "agi",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "security"],
    classes: ["thief"],
};
/**
 * Forge Document - create fake documents
 */
export const FORGE_DOCUMENT = {
    id: "forge-document",
    name: "Forge Document",
    description: "The thief can create convincing forgeries of documents, " +
        "signatures, and official papers.",
    type: "check",
    roll: {
        die: "d20",
        ability: "int",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "deception"],
    classes: ["thief"],
};
/**
 * Disguise Self - alter appearance
 */
export const DISGUISE_SELF = {
    id: "disguise-self",
    name: "Disguise Self",
    description: "The thief can alter their appearance to impersonate others " +
        "or simply avoid recognition.",
    type: "check",
    roll: {
        die: "d20",
        ability: "per",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "deception"],
    classes: ["thief"],
};
/**
 * Read Languages - decipher unknown writings
 */
export const READ_LANGUAGES = {
    id: "read-languages",
    name: "Read Languages",
    description: "The thief can attempt to decipher writings in unfamiliar " +
        "languages, including ancient or coded texts.",
    type: "check",
    roll: {
        die: "d20",
        ability: "int",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "knowledge"],
    classes: ["thief"],
};
/**
 * Handle Poison - work with poisons safely
 */
export const HANDLE_POISON = {
    id: "handle-poison",
    name: "Handle Poison",
    description: "The thief can identify, apply, and handle poisons without " +
        "risk of accidental exposure.",
    type: "check",
    roll: {
        die: "d20",
        ability: "int",
        levelModifier: "custom",
        allowLuck: true,
    },
    tags: ["thief", "alchemy"],
    classes: ["thief"],
};
/**
 * Cast Spell from Scroll - use magical scrolls
 *
 * Unlike other thief skills, this uses a variable die based on level,
 * not a d20 with a bonus.
 */
export const CAST_SPELL_FROM_SCROLL = {
    id: "cast-spell-from-scroll",
    name: "Cast Spell from Scroll",
    description: "The thief can attempt to cast spells from scrolls. " +
        "The die used improves with level. Failure may have consequences.",
    type: "check",
    roll: {
        die: "d10", // Base die, overridden by progression
        ability: "int",
        levelModifier: "none",
        useDiceChain: true,
        allowLuck: true,
    },
    tags: ["thief", "magic"],
    classes: ["thief"],
};
/**
 * All thief skills indexed by ID
 */
export const THIEF_SKILLS = {
    backstab: BACKSTAB,
    "sneak-silently": SNEAK_SILENTLY,
    "hide-in-shadows": HIDE_IN_SHADOWS,
    "pick-pockets": PICK_POCKETS,
    "climb-sheer-surfaces": CLIMB_SHEER_SURFACES,
    "pick-lock": PICK_LOCK,
    "find-trap": FIND_TRAP,
    "disable-trap": DISABLE_TRAP,
    "forge-document": FORGE_DOCUMENT,
    "disguise-self": DISGUISE_SELF,
    "read-languages": READ_LANGUAGES,
    "handle-poison": HANDLE_POISON,
    "cast-spell-from-scroll": CAST_SPELL_FROM_SCROLL,
};
/**
 * List of thief skill IDs
 */
export const THIEF_SKILL_IDS = Object.keys(THIEF_SKILLS);
//# sourceMappingURL=thief-skills.js.map