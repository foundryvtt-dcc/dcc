/**
 * Occupation Module
 *
 * Occupation-based skills and abilities for DCC characters.
 * Includes:
 * - Weapon training from occupations
 * - Trade skills (background knowledge)
 * - Limited thief skill access
 */
export { DEFAULT_TRADE_SKILL_DIE, DEFAULT_THIEF_SKILL_DIE, DEFAULT_WEAPON_TRAINING_BONUS, MIN_EFFECTIVE_LEVEL, parseWeaponTraining, isTrainedWeapon, getTrainedWeaponBonus, calculateEffectiveLevel, getOccupationThiefSkill, hasOccupationThiefSkill, buildOccupationSkillModifiers, resolveOccupationSkillCheck, getTradeSkills, getKnowledgeSkills, getLimitedThiefSkills, isOccupationSkillSuccess, getOccupationSkillSummary, } from "./skills.js";
export { PICKPOCKET_SKILL, KEY_MAKER_SKILL, SEWER_WORKER_SKILL, CONTRABAND_RUNNER_SKILL, HEALER_SKILL, HERB_GATHERER_SKILL, STAR_READER_SKILL, GAME_HUNTER_SKILL, GEM_CUTTER_SKILL, TRADER_SKILL, COURT_FOOL_SKILL, SNAKE_OIL_SELLER_SKILL, PLATE_SMITH_SKILL, BARREL_MAKER_SKILL, OCCUPATION_SKILL_MAP, getSkillsForOccupation, occupationHasSkills, } from "./sample-skills.js";
export type { OccupationSkillCategory, ThiefSkillId, OccupationSkillGrant, OccupationWeaponTraining, OccupationWithSkills, OccupationSkillCheckInput, OccupationSkillCheckResult, OccupationSkillEvents, } from "../types/occupation-skills.js";
//# sourceMappingURL=index.d.ts.map