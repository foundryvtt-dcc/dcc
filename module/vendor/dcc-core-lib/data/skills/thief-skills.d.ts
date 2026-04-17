/**
 * Thief Skill Definitions
 *
 * These define the base mechanics for each thief skill.
 * Level-specific bonuses come from class progression data.
 */
import type { SkillDefinition } from "../../types/skills.js";
/**
 * Backstab - bonus damage on surprise attacks
 */
export declare const BACKSTAB: SkillDefinition;
/**
 * Sneak Silently - move without being heard
 */
export declare const SNEAK_SILENTLY: SkillDefinition;
/**
 * Hide in Shadows - conceal oneself in darkness
 */
export declare const HIDE_IN_SHADOWS: SkillDefinition;
/**
 * Pick Pockets - steal from a target without detection
 */
export declare const PICK_POCKETS: SkillDefinition;
/**
 * Climb Sheer Surfaces - scale walls and cliffs
 */
export declare const CLIMB_SHEER_SURFACES: SkillDefinition;
/**
 * Pick Lock - open locks without a key
 */
export declare const PICK_LOCK: SkillDefinition;
/**
 * Find Trap - locate hidden traps
 */
export declare const FIND_TRAP: SkillDefinition;
/**
 * Disable Trap - safely disarm detected traps
 */
export declare const DISABLE_TRAP: SkillDefinition;
/**
 * Forge Document - create fake documents
 */
export declare const FORGE_DOCUMENT: SkillDefinition;
/**
 * Disguise Self - alter appearance
 */
export declare const DISGUISE_SELF: SkillDefinition;
/**
 * Read Languages - decipher unknown writings
 */
export declare const READ_LANGUAGES: SkillDefinition;
/**
 * Handle Poison - work with poisons safely
 */
export declare const HANDLE_POISON: SkillDefinition;
/**
 * Cast Spell from Scroll - use magical scrolls
 *
 * Unlike other thief skills, this uses a variable die based on level,
 * not a d20 with a bonus.
 */
export declare const CAST_SPELL_FROM_SCROLL: SkillDefinition;
/**
 * All thief skills indexed by ID
 */
export declare const THIEF_SKILLS: Record<string, SkillDefinition>;
/**
 * List of thief skill IDs
 */
export declare const THIEF_SKILL_IDS: string[];
//# sourceMappingURL=thief-skills.d.ts.map