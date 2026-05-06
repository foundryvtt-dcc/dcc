/**
 * Character Serialization
 *
 * Functions for exporting and importing characters as JSON.
 */
/**
 * Current export format version.
 * Increment when making breaking changes to the format.
 *
 * 1.1 — dropped `ThiefState.backstabMultiplier` (DCC backstab is
 *       auto-crit + Table 1-9 attack bonus, not a damage multiplier).
 *       Legacy imports are migrated automatically on read.
 */
export const CHARACTER_FORMAT_VERSION = "1.1";
/**
 * Export a character to JSON string.
 *
 * @param character - The character to export
 * @param options - Export options
 * @returns JSON string representation
 */
export function exportCharacter(character, options) {
    const pretty = options?.pretty ?? true;
    const indent = options?.indent ?? 2;
    const exported = {
        version: CHARACTER_FORMAT_VERSION,
        format: "dcc-core-lib",
        exportedAt: new Date().toISOString(),
        character,
    };
    return JSON.stringify(exported, null, pretty ? indent : undefined);
}
/**
 * Export just the character data without wrapper metadata.
 *
 * @param character - The character to export
 * @param options - Export options
 * @returns JSON string of character data only
 */
export function exportCharacterRaw(character, options) {
    const pretty = options?.pretty ?? true;
    const indent = options?.indent ?? 2;
    return JSON.stringify(character, null, pretty ? indent : undefined);
}
/**
 * Import a character from JSON string.
 *
 * Accepts both wrapped format (with metadata) and raw character JSON.
 *
 * @param json - JSON string to import
 * @returns Import result with character or error
 */
export function importCharacter(json) {
    const warnings = [];
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        return {
            success: false,
            error: "Invalid JSON",
        };
    }
    if (typeof parsed !== "object" || parsed === null) {
        return {
            success: false,
            error: "JSON must be an object",
        };
    }
    const obj = parsed;
    // Check if this is a wrapped export or raw character
    let character;
    if (obj["format"] === "dcc-core-lib") {
        // Wrapped format
        const version = obj["version"];
        if (typeof version === "string" && version !== CHARACTER_FORMAT_VERSION) {
            warnings.push(`Version mismatch: file is v${version}, current is v${CHARACTER_FORMAT_VERSION}`);
        }
        character = obj["character"];
    }
    else if (obj["identity"] && obj["state"]) {
        // Raw character format
        character = obj;
    }
    else {
        return {
            success: false,
            error: "Unrecognized format: missing 'format' field or character structure",
        };
    }
    // Validate character structure
    const validation = validateCharacterStructure(character);
    if (!validation.valid) {
        return {
            success: false,
            error: validation.error,
        };
    }
    // Strip fields that were removed from the schema in later versions
    // so stale data from v1.0 exports doesn't leak into runtime state.
    const migrated = migrateLegacyCharacter(character);
    return {
        success: true,
        character: migrated,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}
/**
 * Apply in-place migrations for legacy character exports.
 *
 * v1.0 → v1.1: Drop `thief.backstabMultiplier` (removed when backstab
 * was rewritten to the RAW auto-crit + attack-bonus model).
 */
function migrateLegacyCharacter(character) {
    const thief = character.state.classState?.thief;
    if (thief && "backstabMultiplier" in thief) {
        delete thief["backstabMultiplier"];
    }
    return character;
}
/**
 * Validate that an object has the required character structure.
 */
function validateCharacterStructure(obj) {
    if (typeof obj !== "object" || obj === null) {
        return { valid: false, error: "Character must be an object" };
    }
    const char = obj;
    // Check identity
    if (!char["identity"] || typeof char["identity"] !== "object") {
        return { valid: false, error: "Missing or invalid 'identity' field" };
    }
    const identity = char["identity"];
    if (typeof identity["id"] !== "string") {
        return { valid: false, error: "Missing or invalid 'identity.id'" };
    }
    if (typeof identity["occupation"] !== "string") {
        return { valid: false, error: "Missing or invalid 'identity.occupation'" };
    }
    if (!identity["birthAugur"] || typeof identity["birthAugur"] !== "object") {
        return { valid: false, error: "Missing or invalid 'identity.birthAugur'" };
    }
    // Check state
    if (!char["state"] || typeof char["state"] !== "object") {
        return { valid: false, error: "Missing or invalid 'state' field" };
    }
    const state = char["state"];
    if (!state["hp"] || typeof state["hp"] !== "object") {
        return { valid: false, error: "Missing or invalid 'state.hp'" };
    }
    if (!state["abilities"] || typeof state["abilities"] !== "object") {
        return { valid: false, error: "Missing or invalid 'state.abilities'" };
    }
    if (!state["combat"] || typeof state["combat"] !== "object") {
        return { valid: false, error: "Missing or invalid 'state.combat'" };
    }
    return { valid: true };
}
/**
 * Parse exported character metadata without importing the full character.
 * Useful for previewing before import.
 */
export function peekExportedCharacter(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        return { valid: false, error: "Invalid JSON" };
    }
    if (typeof parsed !== "object" || parsed === null) {
        return { valid: false, error: "JSON must be an object" };
    }
    const obj = parsed;
    if (obj["format"] === "dcc-core-lib") {
        const character = obj["character"];
        const identity = character?.["identity"];
        return {
            valid: true,
            version: obj["version"],
            format: obj["format"],
            exportedAt: obj["exportedAt"],
            characterName: identity?.["name"],
            occupation: identity?.["occupation"],
        };
    }
    // Raw format
    if (obj["identity"] && obj["state"]) {
        const identity = obj["identity"];
        return {
            valid: true,
            format: "raw",
            characterName: identity["name"],
            occupation: identity["occupation"],
        };
    }
    return { valid: false, error: "Unrecognized format" };
}
//# sourceMappingURL=serialize.js.map