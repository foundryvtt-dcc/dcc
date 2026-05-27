/**
 * NPC/Creature Stat Block Parser
 *
 * Parses DCC RPG stat blocks from text format into Creature objects.
 *
 * @example
 * const result = parseStatBlock(
 *   "Goblin: Init +1; Atk club +0 melee (1d4); AC 11; HD 1d6; MV 30'; Act 1d20; SV Fort +0, Ref +1, Will -1; AL C."
 * );
 * if (result.success) {
 *   console.log(result.creature);
 * }
 */
// =============================================================================
// Main Parser
// =============================================================================
/**
 * Parse a DCC stat block string into a Creature object
 *
 * @param statblock - The stat block text to parse
 * @param options - Optional parsing configuration
 * @returns Parse result with creature data or error
 *
 * @example
 * parseStatBlock("Bandit: Init +2; Atk scimitar +2 melee (1d8+1); AC 15; HD 1d8; MV 20'; Act 1d20; SV Fort +2, Ref +2, Will +0; AL C.")
 */
export function parseStatBlock(statblock, options = {}) {
    const warnings = [];
    try {
        // Normalize whitespace
        const normalized = statblock.trim().replace(/\s+/g, " ");
        // Parse the stat block into intermediate format
        const parsed = parseStatBlockText(normalized, warnings);
        // Convert to Creature type
        const creature = convertToCreature(parsed, options, warnings);
        return {
            success: true,
            creature,
            warnings: warnings.length > 0 ? warnings : undefined,
            original: statblock,
        };
    }
    catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
            warnings: warnings.length > 0 ? warnings : undefined,
            original: statblock,
        };
    }
}
/**
 * Parse multiple stat blocks from text (separated by blank lines or double newlines)
 */
export function parseStatBlocks(text, options = {}) {
    // Split on double newlines or blank lines
    const blocks = text.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
    return blocks.map((block) => parseStatBlock(block, options));
}
// =============================================================================
// Text Parsing
// =============================================================================
/**
 * Parse the stat block text into intermediate format
 */
function parseStatBlockText(text, warnings) {
    // Extract name (before the first colon)
    const nameMatch = /^([^:]+):/.exec(text);
    if (!nameMatch?.[1]) {
        throw new Error("Could not find creature name (expected 'Name: ...')");
    }
    const name = nameMatch[1].trim();
    // Extract sections using semicolon as delimiter
    // But first, we need to handle the various sections
    const result = { name };
    // Parse Initiative
    const initMatch = /Init\s*([+-]?\d+)/i.exec(text);
    if (initMatch?.[1]) {
        result.init = parseInt(initMatch[1], 10);
    }
    else {
        warnings.push("Could not parse initiative, defaulting to 0");
        result.init = 0;
    }
    // Parse Attacks
    result.attacks = parseAttacks(text, warnings);
    // Parse AC
    const acResult = parseAC(text);
    result.ac = acResult.ac;
    if (acResult.notes) {
        result.acNotes = acResult.notes;
    }
    // Parse HD
    const hdMatch = /HD\s+(\d+d\d+(?:[+-]\d+)?)/i.exec(text);
    if (hdMatch?.[1]) {
        result.hitDice = hdMatch[1];
    }
    else {
        // Try alternate formats
        const hdAltMatch = /HD\s+([^;]+)/i.exec(text);
        if (hdAltMatch?.[1]) {
            result.hitDice = hdAltMatch[1].trim();
        }
        else {
            throw new Error("Could not parse hit dice (HD)");
        }
    }
    // Parse MV (movement)
    result.speed = parseMovement(text, warnings);
    // Parse Action Dice
    const actMatch = /Act\s+([^;]+)/i.exec(text);
    if (actMatch?.[1]) {
        result.actionDice = actMatch[1].trim();
    }
    else {
        warnings.push("Could not parse action dice, defaulting to 1d20");
        result.actionDice = "1d20";
    }
    // Parse Special abilities (SP)
    const spMatch = /SP\s+([^;]+);/i.exec(text);
    if (spMatch?.[1]) {
        result.special = spMatch[1].trim();
    }
    // Parse crit info from special abilities
    const critRangeMatch = /crit\s+on\s+(\d+-\d+)/i.exec(text);
    if (critRangeMatch?.[1]) {
        result.critRange = critRangeMatch[1];
    }
    // Parse Saves
    result.saves = parseSaves(text, warnings);
    // Parse Alignment
    result.alignment = parseAlignment(text, warnings);
    return result;
}
// =============================================================================
// Section Parsers
// =============================================================================
/**
 * Parse attacks from stat block
 */
function parseAttacks(text, warnings) {
    const attacks = [];
    // Find the Atk section
    const atkMatch = /Atk\s+(.+?)(?:;|AC\s)/i.exec(text);
    if (!atkMatch?.[1]) {
        warnings.push("Could not parse attacks");
        return attacks;
    }
    const atkText = atkMatch[1].trim();
    // Split on " or " to get individual attacks
    const attackStrings = atkText.split(/\s+or\s+/i);
    for (const attackStr of attackStrings) {
        const attack = parseSingleAttack(attackStr.trim(), warnings);
        if (attack) {
            attacks.push(attack);
        }
    }
    return attacks;
}
/**
 * Parse a single attack string
 */
function parseSingleAttack(attackStr, warnings) {
    // Handle special attacks like "special (see below)" or "charm (see below)"
    if (/\(see below\)|special/i.exec(attackStr)) {
        const nameMatch = /^([^(]+)/.exec(attackStr);
        return {
            name: nameMatch?.[1] ? nameMatch[1].trim() : "special",
            toHit: "+0",
            melee: true,
            damage: "special",
            isSpecial: true,
        };
    }
    // Handle "spell" attacks
    if (/^spell$/i.test(attackStr)) {
        return {
            name: "spell",
            toHit: "+0",
            melee: false,
            damage: "special",
            isSpecial: true,
        };
    }
    // Standard attack format: "weapon +N melee/missile fire (damage)"
    // Examples:
    //   "scimitar +2 melee (1d8+1)"
    //   "javelin +3 missile fire (1d6)"
    //   "wand +4 missile fire (range 60', 1d4+2)"
    //   "poisoned dagger +9 melee (1d12 then 1d4, plus poison)"
    // Try to match standard format
    const standardMatch = /^(.+?)\s+([+-]?\d+)\s+(melee|missile\s*fire?)\s*\((.+)\)$/i.exec(attackStr);
    if (standardMatch) {
        const weaponName = standardMatch[1] ?? "";
        const toHit = standardMatch[2] ?? "+0";
        const attackType = standardMatch[3] ?? "melee";
        const damageInfo = standardMatch[4] ?? "";
        const isMelee = attackType.toLowerCase() === "melee";
        // Parse damage and range from the parenthetical
        const { damage, range } = parseDamageAndRange(damageInfo);
        return {
            name: weaponName.trim(),
            toHit: toHit.startsWith("+") || toHit.startsWith("-") ? toHit : `+${toHit}`,
            melee: isMelee,
            damage,
            range,
        };
    }
    // Try alternate format without explicit attack type
    const altMatch = /^(.+?)\s+([+-]?\d+)\s*\((.+)\)$/i.exec(attackStr);
    if (altMatch) {
        const weaponName = altMatch[1] ?? "";
        const toHit = altMatch[2] ?? "+0";
        const damageInfo = altMatch[3] ?? "";
        const { damage, range } = parseDamageAndRange(damageInfo);
        return {
            name: weaponName.trim(),
            toHit: toHit.startsWith("+") || toHit.startsWith("-") ? toHit : `+${toHit}`,
            melee: !range, // Assume melee if no range
            damage,
            range,
        };
    }
    // Couldn't parse this attack
    warnings.push(`Could not parse attack: "${attackStr}"`);
    return null;
}
/**
 * Parse damage and range from attack parenthetical
 */
function parseDamageAndRange(info) {
    // Handle "range X', damage" format
    const rangeFirstMatch = /range\s+(\d+')\s*,\s*(.+)/i.exec(info);
    if (rangeFirstMatch?.[1] && rangeFirstMatch[2]) {
        return {
            range: rangeFirstMatch[1],
            damage: rangeFirstMatch[2].trim(),
        };
    }
    // Handle "damage, range X'" format
    const rangeLast = /(.+),\s*range\s+(\d+')/i.exec(info);
    if (rangeLast?.[1] && rangeLast[2]) {
        return {
            damage: rangeLast[1].trim(),
            range: rangeLast[2],
        };
    }
    // Handle just range notation at the end "1d6, range 100'"
    const rangeAtEnd = /(.+?),?\s+range\s+(\d+'?)$/i.exec(info);
    if (rangeAtEnd?.[1] && rangeAtEnd[2]) {
        return {
            damage: rangeAtEnd[1].trim().replace(/,$/, ""),
            range: rangeAtEnd[2],
        };
    }
    // Just damage, remove "dmg " prefix if present
    let damage = info.trim();
    if (damage.toLowerCase().startsWith("dmg ")) {
        damage = damage.slice(4);
    }
    return { damage };
}
/**
 * Parse AC from stat block
 */
function parseAC(text) {
    // Try format "AC N (notes)"
    const acWithNotes = /AC\s+(\d+)\s*\(([^)]+)\)/i.exec(text);
    if (acWithNotes?.[1] && acWithNotes[2]) {
        return {
            ac: parseInt(acWithNotes[1], 10),
            notes: acWithNotes[2].trim(),
        };
    }
    // Try format "AC N"
    const acSimple = /AC\s+(\d+)/i.exec(text);
    if (acSimple?.[1]) {
        return { ac: parseInt(acSimple[1], 10) };
    }
    throw new Error("Could not parse AC");
}
/**
 * Parse movement from stat block
 */
function parseMovement(text, warnings) {
    const mvMatch = /MV\s+([^;]+)/i.exec(text);
    if (!mvMatch?.[1]) {
        warnings.push("Could not parse movement, defaulting to 30'");
        return { land: "30'" };
    }
    const mvText = mvMatch[1].trim();
    const speed = { land: "30'" };
    // Handle various formats:
    // "30'" - just land
    // "30' or fly 30'" - land and fly
    // "20', fly 40'" - land and fly with comma
    // "fly 40'" - fly only (no land)
    // "30' or swim 40'" - land and swim
    // "jump 80' or fly 30'" - special movement
    // Split on "or" and ","
    const parts = mvText.split(/\s+or\s+|,\s*/i);
    let hasLand = false;
    for (const part of parts) {
        const trimmed = part.trim();
        if (/^fly\s+/i.exec(trimmed)) {
            speed.fly = trimmed.replace(/^fly\s+/i, "").trim();
        }
        else if (/^swim\s+/i.exec(trimmed)) {
            speed.swim = trimmed.replace(/^swim\s+/i, "").trim();
        }
        else if (/^climb\s+/i.exec(trimmed)) {
            speed.other = speed.other ? `${speed.other}, ${trimmed}` : trimmed;
        }
        else if (/^dig\s+/i.exec(trimmed)) {
            speed.other = speed.other ? `${speed.other}, ${trimmed}` : trimmed;
        }
        else if (/^jump\s+/i.exec(trimmed)) {
            speed.other = speed.other ? `${speed.other}, ${trimmed}` : trimmed;
        }
        else if (/^\d+'/.exec(trimmed)) {
            // Plain number - this is land speed
            speed.land = trimmed;
            hasLand = true;
        }
    }
    // If we only found fly speed and no land, use fly as primary
    if (!hasLand && speed.fly) {
        // Keep land at 0 or remove it
        speed.land = "0'";
    }
    return speed;
}
/**
 * Parse saving throws from stat block
 */
function parseSaves(text, warnings) {
    const saves = { fort: 0, ref: 0, will: 0 };
    // Try to match "SV Fort +N, Ref +N, Will +N"
    const fortMatch = /Fort\s*([+-]?\d+)/i.exec(text);
    const refMatch = /Ref\s*([+-]?\d+)/i.exec(text);
    const willMatch = /Will\s*([+-]?\d+)/i.exec(text);
    if (fortMatch?.[1]) {
        saves.fort = parseInt(fortMatch[1], 10);
    }
    else {
        warnings.push("Could not parse Fort save, defaulting to 0");
    }
    if (refMatch?.[1]) {
        saves.ref = parseInt(refMatch[1], 10);
    }
    else {
        warnings.push("Could not parse Ref save, defaulting to 0");
    }
    if (willMatch?.[1]) {
        saves.will = parseInt(willMatch[1], 10);
    }
    else {
        warnings.push("Could not parse Will save, defaulting to 0");
    }
    return saves;
}
/**
 * Parse alignment from stat block
 */
function parseAlignment(text, warnings) {
    // Match "AL X" at end of stat block
    const alMatch = /AL\s+([LNCE]|varies|lawful|neutral|chaotic)/i.exec(text);
    if (!alMatch?.[1]) {
        warnings.push("Could not parse alignment, defaulting to neutral");
        return "n";
    }
    const al = alMatch[1].toLowerCase();
    switch (al) {
        case "l":
        case "lawful":
            return "l";
        case "c":
        case "chaotic":
            return "c";
        case "n":
        case "neutral":
        case "varies":
        case "e": // Sometimes used for neutral
            return "n";
        default:
            warnings.push(`Unknown alignment "${al}", defaulting to neutral`);
            return "n";
    }
}
// =============================================================================
// Conversion to Creature
// =============================================================================
/**
 * Convert parsed stat block to Creature type
 */
function convertToCreature(parsed, options, warnings) {
    // Generate ID from name if not provided
    const id = options.id ?? parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    // Convert attacks
    const attacks = parsed.attacks
        .filter((a) => !a.isSpecial)
        .map((a) => ({
        name: a.name,
        toHit: a.toHit,
        melee: a.melee,
        damage: a.damage,
        ...(a.range && { range: a.range }),
    }));
    // Add special attacks to special abilities
    const specialAttacks = parsed.attacks.filter((a) => a.isSpecial).map((a) => a.name);
    let special = parsed.special;
    if (specialAttacks.length > 0) {
        const specialAttackStr = specialAttacks.join(", ");
        special = special ? `${specialAttackStr}, ${special}` : specialAttackStr;
    }
    // Calculate average HP from hit dice
    const hp = options.defaultHp ?? calculateAverageHP(parsed.hitDice, warnings);
    // Determine crit die and table
    const critDie = options.defaultCritDie ?? guessCritDie(parsed.hitDice);
    const critTable = options.defaultCritTable ?? "M"; // Default to monster crit table
    return {
        id,
        name: parsed.name,
        ac: parsed.ac,
        hitDice: parsed.hitDice,
        hp,
        init: parsed.init,
        speed: parsed.speed,
        actionDice: parsed.actionDice,
        critDie,
        critTable,
        saves: parsed.saves,
        alignment: parsed.alignment,
        attacks,
        ...(special && { special }),
        statline: "", // Will be filled in by caller if needed
        ...(options.category && { category: options.category }),
    };
}
/**
 * Calculate average HP from hit dice expression
 */
function calculateAverageHP(hitDice, warnings) {
    // Parse expressions like "3d8+12", "1d6", "5d8+10"
    const match = /(\d+)d(\d+)(?:([+-])(\d+))?/.exec(hitDice);
    if (!match?.[1] || !match[2]) {
        warnings.push(`Could not calculate HP from "${hitDice}", defaulting to 5`);
        return 5;
    }
    const numDice = match[1];
    const dieSize = match[2];
    const sign = match[3];
    const modifier = match[4];
    const avgRoll = (parseInt(dieSize, 10) + 1) / 2;
    let hp = Math.round(parseInt(numDice, 10) * avgRoll);
    if (modifier) {
        const mod = parseInt(modifier, 10);
        hp = sign === "+" ? hp + mod : hp - mod;
    }
    return Math.max(1, hp);
}
/**
 * Guess appropriate crit die based on hit dice
 */
function guessCritDie(hitDice) {
    const match = /(\d+)d/.exec(hitDice);
    if (!match?.[1])
        return "1d6";
    const numDice = parseInt(match[1], 10);
    // Higher HD = bigger crit die
    if (numDice >= 12)
        return "1d16";
    if (numDice >= 8)
        return "1d12";
    if (numDice >= 5)
        return "1d10";
    if (numDice >= 3)
        return "1d8";
    return "1d6";
}
//# sourceMappingURL=parse-statblock.js.map