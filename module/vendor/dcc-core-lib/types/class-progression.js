/**
 * Class Progression Types
 *
 * Defines level-by-level advancement data for character classes,
 * including alignment-specific variations.
 *
 * These types are specifically designed for loading and parsing
 * class progression data from external JSON sources.
 */
/**
 * Helper to get skill bonus for a character
 */
export function getSkillBonus(progression, level, alignment, skillId) {
    const levelData = progression.levels[level];
    if (!levelData) {
        return undefined;
    }
    const alignmentData = levelData[alignment];
    if (!alignmentData) {
        return undefined;
    }
    return alignmentData.skills[skillId];
}
//# sourceMappingURL=class-progression.js.map