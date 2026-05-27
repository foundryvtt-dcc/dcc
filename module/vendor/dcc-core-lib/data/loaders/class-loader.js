/**
 * Class Progression Data Loader
 *
 * Loads and parses class progression data from external JSON sources.
 * Supports loading from file paths, URLs, or raw JSON objects.
 */
/**
 * Parse a key=value string into a record
 */
function parseKeyValueString(data) {
    const result = {};
    const lines = data.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1)
            continue;
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1);
        result[key] = value;
    }
    return result;
}
/**
 * Parse a skill value string to number or die type
 */
function parseSkillValue(value) {
    // Check if it's a die (starts with 'd')
    if (value.startsWith("d") || value.startsWith("+d") || value.startsWith("-d")) {
        const dieMatch = /d\d+/.exec(value);
        if (dieMatch) {
            return dieMatch[0];
        }
    }
    // Otherwise parse as number
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
}
/**
 * Parse alignment-specific level data
 */
function parseAlignmentData(data) {
    if (!data)
        return undefined;
    const parsed = parseKeyValueString(data);
    const skills = {};
    let title = "";
    for (const [key, value] of Object.entries(parsed)) {
        if (key === "system.details.title.value") {
            title = value;
        }
        else if (key.startsWith("system.skills.")) {
            // Extract skill name: system.skills.sneakSilently.value -> sneakSilently
            const match = /system\.skills\.(\w+)\.(?:value|die)/.exec(key);
            if (match?.[1]) {
                const skillId = camelToKebab(match[1]);
                skills[skillId] = parseSkillValue(value);
            }
        }
        else if (key === "system.class.backstab") {
            skills["backstab"] = parseSkillValue(value);
        }
    }
    return { title, skills };
}
/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
/**
 * Parse base level data
 */
function parseBaseLevelData(data) {
    const parsed = parseKeyValueString(data);
    const result = {
        saves: { ref: 0, frt: 0, wil: 0 },
        actionDice: [],
    };
    for (const [key, value] of Object.entries(parsed)) {
        switch (key) {
            case "system.details.attackBonus":
                result.attackBonus = parseSkillValue(value);
                break;
            case "system.attributes.critical.die":
                result.criticalDie = value;
                break;
            case "system.attributes.critical.table":
                result.criticalTable = value;
                break;
            case "system.attributes.actionDice.value":
                result.actionDice = value.split(",").map((d) => d.trim());
                break;
            case "system.attributes.hitDice.value":
                result.hitDie = value;
                break;
            case "system.class.luckDie":
                result.luckDie = value;
                break;
            case "system.details.critRange":
                result.critRange = parseInt(value, 10);
                break;
            case "system.saves.ref.classBonus":
                if (result.saves)
                    result.saves.ref = parseSkillValue(value);
                break;
            case "system.saves.frt.classBonus":
                if (result.saves)
                    result.saves.frt = parseSkillValue(value);
                break;
            case "system.saves.wil.classBonus":
                if (result.saves)
                    result.saves.wil = parseSkillValue(value);
                break;
        }
    }
    return result;
}
/**
 * Parse a single level's raw data into ProgressionLevelData
 */
export function parseClassLevel(raw) {
    const base = parseBaseLevelData(raw.levelData);
    const levelData = {
        attackBonus: base.attackBonus ?? 0,
        criticalDie: base.criticalDie ?? "1d8",
        criticalTable: base.criticalTable ?? "I",
        actionDice: base.actionDice ?? ["1d20"],
        hitDie: base.hitDie ?? "d6",
        saves: base.saves ?? { ref: 0, frt: 0, wil: 0 },
    };
    if (base.luckDie)
        levelData.luckDie = base.luckDie;
    if (base.critRange)
        levelData.critRange = base.critRange;
    // Conditionally assign alignment data (exactOptionalPropertyTypes)
    const lawfulData = raw.levelDataLawful
        ? parseAlignmentData(raw.levelDataLawful)
        : undefined;
    const neutralData = raw.levelDataNeutral
        ? parseAlignmentData(raw.levelDataNeutral)
        : undefined;
    const chaoticData = raw.levelDataChaotic
        ? parseAlignmentData(raw.levelDataChaotic)
        : undefined;
    if (lawfulData)
        levelData.lawful = lawfulData;
    if (neutralData)
        levelData.neutral = neutralData;
    if (chaoticData)
        levelData.chaotic = chaoticData;
    return levelData;
}
/**
 * Load class progression from an array of raw level data
 */
export function loadClassProgression(classId, name, skills, rawLevels) {
    const levels = {};
    for (const raw of rawLevels) {
        const level = parseInt(raw.level, 10);
        if (!isNaN(level)) {
            levels[level] = parseClassLevel(raw);
        }
    }
    return {
        classId,
        name,
        skills,
        levels,
    };
}
/**
 * Get skill bonus for a character from progression data
 */
export function getSkillBonusFromProgression(progression, level, alignment, skillId) {
    const levelData = progression.levels[level];
    if (!levelData)
        return undefined;
    const alignmentData = levelData[alignment];
    if (!alignmentData)
        return undefined;
    return alignmentData.skills[skillId];
}
//# sourceMappingURL=class-loader.js.map