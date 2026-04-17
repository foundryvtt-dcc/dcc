/**
 * Spell Data Loader
 *
 * Loads and parses spell definition data from external JSON sources.
 * Supports loading from raw JSON objects with validation.
 */
// =============================================================================
// Validation Helpers
// =============================================================================
/**
 * Valid caster types
 */
const VALID_CASTER_TYPES = ["wizard", "cleric", "elf"];
const VALID_SAVE_TYPES = ["reflex", "fortitude", "will", "none"];
/**
 * Valid mercurial triggers
 */
const VALID_TRIGGERS = [
    "always",
    "on-cast",
    "on-success",
    "on-failure",
    "on-crit",
    "on-fumble",
];
/**
 * Validate and convert a caster type string
 */
function parseCasterType(type) {
    const lower = type.toLowerCase();
    if (VALID_CASTER_TYPES.includes(lower)) {
        return lower;
    }
    return undefined;
}
/**
 * Validate and convert a save type string
 */
function parseSaveType(save) {
    const lower = save.toLowerCase();
    if (VALID_SAVE_TYPES.includes(lower)) {
        return lower;
    }
    return undefined;
}
/**
 * Validate and convert a mercurial trigger string
 */
function parseTrigger(trigger) {
    if (VALID_TRIGGERS.includes(trigger)) {
        return trigger;
    }
    return undefined;
}
// =============================================================================
// Spell Definition Loading
// =============================================================================
/**
 * Parse a raw spell definition into a typed SpellDefinition
 */
export function parseSpellDefinition(raw) {
    // Required fields validation
    if (!raw.id || typeof raw.id !== "string") {
        return undefined;
    }
    if (!raw.name || typeof raw.name !== "string") {
        return undefined;
    }
    if (typeof raw.level !== "number" || raw.level < 1 || raw.level > 9) {
        return undefined;
    }
    if (!Array.isArray(raw.casterTypes) || raw.casterTypes.length === 0) {
        return undefined;
    }
    // Parse caster types
    const casterTypes = [];
    for (const type of raw.casterTypes) {
        const parsed = parseCasterType(type);
        if (parsed) {
            casterTypes.push(parsed);
        }
    }
    if (casterTypes.length === 0) {
        return undefined;
    }
    // Build the result
    const result = {
        id: raw.id,
        name: raw.name,
        level: raw.level,
        casterTypes,
    };
    // Add optional fields only if provided
    if (raw.description) {
        result.description = raw.description;
    }
    if (raw.range) {
        result.range = raw.range;
    }
    if (raw.duration) {
        result.duration = raw.duration;
    }
    if (raw.castingTime) {
        result.castingTime = raw.castingTime;
    }
    if (raw.save) {
        const save = parseSaveType(raw.save);
        if (save) {
            result.save = save;
        }
    }
    if (raw.tags && raw.tags.length > 0) {
        result.tags = raw.tags;
    }
    if (raw.source) {
        result.source = raw.source;
    }
    return result;
}
/**
 * Load multiple spell definitions from raw JSON array
 */
export function loadSpellDefinitions(rawSpells) {
    const spells = [];
    for (const raw of rawSpells) {
        const parsed = parseSpellDefinition(raw);
        if (parsed) {
            spells.push(parsed);
        }
    }
    return spells;
}
/**
 * Load spell definitions with validation reporting
 */
export function loadSpellDefinitionsWithValidation(rawSpells) {
    const valid = [];
    const invalid = [];
    for (const raw of rawSpells) {
        const parsed = parseSpellDefinition(raw);
        if (parsed) {
            valid.push(parsed);
        }
        else {
            const reason = getSpellValidationError(raw);
            invalid.push({ raw, reason });
        }
    }
    return { valid, invalid };
}
/**
 * Get validation error reason for a raw spell
 */
function getSpellValidationError(raw) {
    if (!raw.id || typeof raw.id !== "string") {
        return "Missing or invalid id";
    }
    if (!raw.name || typeof raw.name !== "string") {
        return "Missing or invalid name";
    }
    if (typeof raw.level !== "number" || raw.level < 1 || raw.level > 9) {
        return "Level must be a number between 1 and 9";
    }
    if (!Array.isArray(raw.casterTypes) || raw.casterTypes.length === 0) {
        return "Missing or empty casterTypes array";
    }
    const validTypes = raw.casterTypes.filter((t) => parseCasterType(t) !== undefined);
    if (validTypes.length === 0) {
        return `No valid caster types found (valid: ${VALID_CASTER_TYPES.join(", ")})`;
    }
    return "Unknown validation error";
}
// =============================================================================
// Mercurial Table Loading
// =============================================================================
/**
 * Parse a raw mercurial effect data into typed MercurialEffectData
 */
function parseMercurialEffectData(raw) {
    const result = {
        type: raw.type,
    };
    if (raw.modifier !== undefined) {
        result.modifier = raw.modifier;
    }
    if (raw.dice !== undefined) {
        result.dice = raw.dice;
    }
    if (raw.trigger !== undefined) {
        const trigger = parseTrigger(raw.trigger);
        if (trigger) {
            result.trigger = trigger;
        }
    }
    if (raw.duration !== undefined) {
        result.duration = raw.duration;
    }
    if (raw.data !== undefined) {
        result.data = raw.data;
    }
    return result;
}
/**
 * Parse a raw mercurial table entry
 */
function parseMercurialTableEntry(raw) {
    const result = {
        min: raw.min,
        max: raw.max,
        summary: raw.summary,
        description: raw.description,
        displayOnCast: raw.displayOnCast ?? false,
    };
    if (raw.effect) {
        result.effect = parseMercurialEffectData(raw.effect);
    }
    return result;
}
/**
 * Load a mercurial table from raw JSON
 */
export function loadMercurialTable(raw) {
    const entries = raw.entries.map(parseMercurialTableEntry);
    return {
        id: raw.id,
        name: raw.name,
        entries,
    };
}
/**
 * Load mercurial table with validation
 */
export function loadMercurialTableWithValidation(raw) {
    const errors = [];
    // Basic validation
    if (!raw.id || typeof raw.id !== "string") {
        errors.push("Missing or invalid table id");
    }
    if (!raw.name || typeof raw.name !== "string") {
        errors.push("Missing or invalid table name");
    }
    if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
        errors.push("Missing or empty entries array");
    }
    if (errors.length > 0) {
        return { valid: false, errors };
    }
    // Validate entries
    for (let i = 0; i < raw.entries.length; i++) {
        const entry = raw.entries[i];
        if (!entry)
            continue;
        if (typeof entry.min !== "number") {
            errors.push(`Entry ${String(i)}: invalid min value`);
        }
        if (typeof entry.max !== "number") {
            errors.push(`Entry ${String(i)}: invalid max value`);
        }
        if (entry.min > entry.max) {
            errors.push(`Entry ${String(i)}: min (${String(entry.min)}) > max (${String(entry.max)})`);
        }
        if (!entry.summary || typeof entry.summary !== "string") {
            errors.push(`Entry ${String(i)}: missing or invalid summary`);
        }
        if (!entry.description || typeof entry.description !== "string") {
            errors.push(`Entry ${String(i)}: missing or invalid description`);
        }
    }
    // Check for gaps and overlaps
    const sorted = [...raw.entries].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!current || !next)
            continue;
        if (current.max >= next.min) {
            errors.push(`Overlap: entries at ${String(current.max)} and ${String(next.min)}`);
        }
        else if (current.max + 1 < next.min) {
            errors.push(`Gap: between ${String(current.max)} and ${String(next.min)}`);
        }
    }
    if (errors.length > 0) {
        return { valid: false, errors };
    }
    const table = loadMercurialTable(raw);
    return { valid: true, table, errors: [] };
}
// =============================================================================
// Utility Functions
// =============================================================================
/**
 * Group spells by level
 */
export function groupSpellsByLevel(spells) {
    const grouped = new Map();
    for (const spell of spells) {
        const existing = grouped.get(spell.level);
        if (existing) {
            existing.push(spell);
        }
        else {
            grouped.set(spell.level, [spell]);
        }
    }
    return grouped;
}
/**
 * Group spells by caster type
 */
export function groupSpellsByCasterType(spells) {
    const grouped = new Map();
    for (const spell of spells) {
        for (const casterType of spell.casterTypes) {
            const existing = grouped.get(casterType);
            if (existing) {
                existing.push(spell);
            }
            else {
                grouped.set(casterType, [spell]);
            }
        }
    }
    return grouped;
}
/**
 * Find a spell by ID
 */
export function findSpellById(spells, id) {
    return spells.find((s) => s.id === id);
}
/**
 * Find spells by name (case-insensitive partial match)
 */
export function findSpellsByName(spells, name) {
    const lower = name.toLowerCase();
    return spells.filter((s) => s.name.toLowerCase().includes(lower));
}
/**
 * Get all spells available to a specific caster type at a given level
 */
export function getAvailableSpells(spells, casterType, maxLevel) {
    return spells.filter((s) => s.casterTypes.includes(casterType) && s.level <= maxLevel);
}
//# sourceMappingURL=spell-loader.js.map