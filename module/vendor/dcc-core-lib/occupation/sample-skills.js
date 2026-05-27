/**
 * Sample Occupation Skills
 *
 * FAN-MADE CONTENT - NOT OFFICIAL DCC RPG MATERIAL
 *
 * Example occupation skill grants for testing and demonstration.
 * These show how occupations can grant limited thief skills,
 * trade skills, and other background abilities.
 */
// =============================================================================
// Limited Thief Skills (from relevant occupations)
// =============================================================================
/**
 * Pickpocket occupation grants limited pick pocket ability.
 */
export const PICKPOCKET_SKILL = {
    id: "pickpocket-trade",
    name: "Pickpocket",
    description: "From your time on the streets, you've learned to lift items from " +
        "unsuspecting marks. You can attempt to pick pockets at an effective " +
        "level 2 lower than your actual level (minimum 0).",
    category: "limited-thief",
    thiefSkillId: "pick-pocket",
    effectiveLevel: -2,
    abilityId: "agl",
    tags: ["criminal", "stealth"],
};
/**
 * Key Maker occupation grants limited lock picking ability.
 */
export const KEY_MAKER_SKILL = {
    id: "key-maker-locks",
    name: "Lock Knowledge",
    description: "Your experience crafting locks gives you insight into their mechanisms. " +
        "You can attempt to pick locks at an effective level 2 lower than your " +
        "actual level (minimum 0).",
    category: "limited-thief",
    thiefSkillId: "pick-lock",
    effectiveLevel: -2,
    abilityId: "agl",
    tags: ["craft", "mechanical"],
};
/**
 * Sewer Worker occupation grants limited find trap ability.
 */
export const SEWER_WORKER_SKILL = {
    id: "sewer-worker-traps",
    name: "Trap Awareness",
    description: "Navigating the treacherous sewers has taught you to spot hazards. " +
        "You can attempt to find traps at an effective level 2 lower than your " +
        "actual level (minimum 0).",
    category: "limited-thief",
    thiefSkillId: "find-trap",
    effectiveLevel: -2,
    abilityId: "int",
    tags: ["survival", "underground"],
};
/**
 * Contraband Runner grants limited hide in shadows ability.
 */
export const CONTRABAND_RUNNER_SKILL = {
    id: "contraband-runner-hide",
    name: "Furtive Movement",
    description: "Years of evading authorities have taught you how to avoid detection. " +
        "You can attempt to hide in shadows at an effective level 2 lower than " +
        "your actual level (minimum 0).",
    category: "limited-thief",
    thiefSkillId: "hide-in-shadows",
    effectiveLevel: -2,
    abilityId: "agl",
    tags: ["criminal", "stealth"],
};
// =============================================================================
// Trade Skills (background knowledge and abilities)
// =============================================================================
/**
 * Village Healer grants basic healing knowledge.
 */
export const HEALER_SKILL = {
    id: "village-healer-knowledge",
    name: "Healing Lore",
    description: "You know how to identify medicinal herbs and treat common ailments. " +
        "You can attempt to stabilize dying characters and identify poisons " +
        "with an INT check (DC 10).",
    category: "knowledge",
    abilityId: "int",
    bonus: 2,
    baseDC: 10,
    tags: ["healing", "herbs"],
};
/**
 * Herb Gatherer grants plant identification.
 */
export const HERB_GATHERER_SKILL = {
    id: "herb-gatherer-plants",
    name: "Plant Lore",
    description: "You can identify plants and their properties, including edible and " +
        "poisonous varieties. INT check (DC 10) to identify, or find useful " +
        "herbs in the wild.",
    category: "knowledge",
    abilityId: "int",
    bonus: 2,
    baseDC: 10,
    tags: ["nature", "survival"],
};
/**
 * Star Reader grants fortune telling and astronomy knowledge.
 */
export const STAR_READER_SKILL = {
    id: "star-reader-augury",
    name: "Star Reading",
    description: "You can read the stars for navigation and interpret celestial omens. " +
        "INT check (DC 12) to navigate at night or interpret astrological signs.",
    category: "knowledge",
    abilityId: "int",
    bonus: 2,
    baseDC: 12,
    tags: ["mystical", "navigation"],
};
/**
 * Game Hunter grants tracking ability.
 */
export const GAME_HUNTER_SKILL = {
    id: "game-hunter-tracking",
    name: "Tracking",
    description: "You can track animals and people through wilderness terrain. " +
        "INT check (DC varies by terrain and age of tracks) to follow trails.",
    category: "trade-skill",
    abilityId: "int",
    bonus: 2,
    baseDC: 12,
    tags: ["wilderness", "survival"],
};
/**
 * Gem Cutter grants appraisal ability.
 */
export const GEM_CUTTER_SKILL = {
    id: "gem-cutter-appraise",
    name: "Gem Appraisal",
    description: "You can accurately identify and value gems and jewelry. " +
        "INT check (DC 10) to determine the value of gems and detect fakes.",
    category: "trade-skill",
    abilityId: "int",
    bonus: 4,
    baseDC: 10,
    tags: ["merchant", "craft"],
};
/**
 * Trader grants general appraisal and bargaining.
 */
export const TRADER_SKILL = {
    id: "trader-bargain",
    name: "Merchant's Eye",
    description: "You can assess the value of goods and negotiate prices. " +
        "PER check (DC 10) to get fair prices when buying or selling.",
    category: "social",
    abilityId: "per",
    bonus: 2,
    baseDC: 10,
    tags: ["merchant", "social"],
};
/**
 * Court Fool grants performance ability.
 */
export const COURT_FOOL_SKILL = {
    id: "court-fool-perform",
    name: "Performance",
    description: "You can perform to entertain, distract, or manipulate crowds. " +
        "PER check (DC varies) to perform convincingly.",
    category: "social",
    abilityId: "per",
    bonus: 2,
    baseDC: 10,
    tags: ["performance", "social"],
};
/**
 * Snake Oil Seller grants deception and persuasion.
 */
export const SNAKE_OIL_SELLER_SKILL = {
    id: "snake-oil-seller-deceive",
    name: "Silver Tongue",
    description: "You've mastered the art of selling worthless goods and convincing " +
        "marks of anything. PER check (DC varies) to deceive or persuade.",
    category: "social",
    abilityId: "per",
    bonus: 3,
    baseDC: 12,
    tags: ["deception", "social"],
};
// =============================================================================
// Craft Skills
// =============================================================================
/**
 * Plate Smith grants metalworking ability.
 */
export const PLATE_SMITH_SKILL = {
    id: "plate-smith-metalwork",
    name: "Metalworking",
    description: "You can work metal to repair armor and weapons, or craft simple items. " +
        "STR check (DC varies) to perform smithing tasks.",
    category: "craft",
    abilityId: "str",
    bonus: 2,
    baseDC: 12,
    tags: ["craft", "armor", "weapons"],
};
/**
 * Barrel Maker grants woodworking ability.
 */
export const BARREL_MAKER_SKILL = {
    id: "barrel-maker-woodwork",
    name: "Woodworking",
    description: "You can work wood to build and repair containers, furniture, and " +
        "simple structures. STR check (DC varies) to perform carpentry.",
    category: "craft",
    abilityId: "str",
    bonus: 2,
    baseDC: 10,
    tags: ["craft", "construction"],
};
// =============================================================================
// Occupation Skill Mappings
// =============================================================================
/**
 * Map of occupation names to their granted skills.
 * This can be merged with occupation data to extend it.
 */
export const OCCUPATION_SKILL_MAP = {
    Pickpocket: [PICKPOCKET_SKILL],
    "Key Maker": [KEY_MAKER_SKILL],
    "Sewer Worker": [SEWER_WORKER_SKILL],
    "Contraband Runner": [CONTRABAND_RUNNER_SKILL],
    "Village Healer": [HEALER_SKILL],
    "Herb Gatherer": [HERB_GATHERER_SKILL],
    "Star Reader": [STAR_READER_SKILL],
    "Game Hunter": [GAME_HUNTER_SKILL],
    "Gem Cutter": [GEM_CUTTER_SKILL],
    Trader: [TRADER_SKILL],
    "Court Fool": [COURT_FOOL_SKILL],
    "Snake Oil Seller": [SNAKE_OIL_SELLER_SKILL],
    "Plate Smith": [PLATE_SMITH_SKILL],
    "Barrel Maker": [BARREL_MAKER_SKILL],
};
/**
 * Get skills for an occupation by name.
 *
 * @param occupationName - The occupation name
 * @returns Array of skills, or empty array if none defined
 */
export function getSkillsForOccupation(occupationName) {
    return OCCUPATION_SKILL_MAP[occupationName] ?? [];
}
/**
 * Check if an occupation has any special skills.
 *
 * @param occupationName - The occupation name
 * @returns True if the occupation grants skills
 */
export function occupationHasSkills(occupationName) {
    const skills = OCCUPATION_SKILL_MAP[occupationName];
    return skills !== undefined && skills.length > 0;
}
//# sourceMappingURL=sample-skills.js.map