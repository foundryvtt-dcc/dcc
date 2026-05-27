/**
 * Sample Occupation Skills
 *
 * FAN-MADE CONTENT - NOT OFFICIAL DCC RPG MATERIAL
 *
 * Example occupation skill grants for testing and demonstration.
 * These show how occupations can grant limited thief skills,
 * trade skills, and other background abilities.
 */
import type { OccupationSkillGrant } from "../types/occupation-skills.js";
/**
 * Pickpocket occupation grants limited pick pocket ability.
 */
export declare const PICKPOCKET_SKILL: OccupationSkillGrant;
/**
 * Key Maker occupation grants limited lock picking ability.
 */
export declare const KEY_MAKER_SKILL: OccupationSkillGrant;
/**
 * Sewer Worker occupation grants limited find trap ability.
 */
export declare const SEWER_WORKER_SKILL: OccupationSkillGrant;
/**
 * Contraband Runner grants limited hide in shadows ability.
 */
export declare const CONTRABAND_RUNNER_SKILL: OccupationSkillGrant;
/**
 * Village Healer grants basic healing knowledge.
 */
export declare const HEALER_SKILL: OccupationSkillGrant;
/**
 * Herb Gatherer grants plant identification.
 */
export declare const HERB_GATHERER_SKILL: OccupationSkillGrant;
/**
 * Star Reader grants fortune telling and astronomy knowledge.
 */
export declare const STAR_READER_SKILL: OccupationSkillGrant;
/**
 * Game Hunter grants tracking ability.
 */
export declare const GAME_HUNTER_SKILL: OccupationSkillGrant;
/**
 * Gem Cutter grants appraisal ability.
 */
export declare const GEM_CUTTER_SKILL: OccupationSkillGrant;
/**
 * Trader grants general appraisal and bargaining.
 */
export declare const TRADER_SKILL: OccupationSkillGrant;
/**
 * Court Fool grants performance ability.
 */
export declare const COURT_FOOL_SKILL: OccupationSkillGrant;
/**
 * Snake Oil Seller grants deception and persuasion.
 */
export declare const SNAKE_OIL_SELLER_SKILL: OccupationSkillGrant;
/**
 * Plate Smith grants metalworking ability.
 */
export declare const PLATE_SMITH_SKILL: OccupationSkillGrant;
/**
 * Barrel Maker grants woodworking ability.
 */
export declare const BARREL_MAKER_SKILL: OccupationSkillGrant;
/**
 * Map of occupation names to their granted skills.
 * This can be merged with occupation data to extend it.
 */
export declare const OCCUPATION_SKILL_MAP: Record<string, OccupationSkillGrant[]>;
/**
 * Get skills for an occupation by name.
 *
 * @param occupationName - The occupation name
 * @returns Array of skills, or empty array if none defined
 */
export declare function getSkillsForOccupation(occupationName: string): OccupationSkillGrant[];
/**
 * Check if an occupation has any special skills.
 *
 * @param occupationName - The occupation name
 * @returns True if the occupation grants skills
 */
export declare function occupationHasSkills(occupationName: string): boolean;
//# sourceMappingURL=sample-skills.d.ts.map