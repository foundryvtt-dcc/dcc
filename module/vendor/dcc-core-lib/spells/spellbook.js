/**
 * Spellbook Management
 *
 * Pure functions for managing a character's known spells.
 * Handles adding/removing spells, tracking lost spells, and spell limits.
 */
// =============================================================================
// Internal Helpers
// =============================================================================
/**
 * Create a mutable copy of a readonly SpellbookEntry.
 * Handles exactOptionalPropertyTypes by only copying defined properties.
 */
function copySpellbookEntry(entry) {
    const result = {
        spellId: entry.spellId,
        lost: entry.lost,
    };
    if (entry.learnedAt !== undefined) {
        result.learnedAt = entry.learnedAt;
    }
    if (entry.mercurialEffect) {
        result.mercurialEffect = { ...entry.mercurialEffect };
    }
    if (entry.manifestation !== undefined) {
        result.manifestation = entry.manifestation;
    }
    if (entry.lastResult !== undefined) {
        result.lastResult = entry.lastResult;
    }
    if (entry.notes !== undefined) {
        result.notes = entry.notes;
    }
    return result;
}
// =============================================================================
// Spellbook Queries
// =============================================================================
/**
 * Find a spell entry in a spellbook by ID
 */
export function findSpellEntry(spellbook, spellId) {
    const entry = spellbook.spells.find((s) => s.spellId === spellId);
    if (!entry)
        return undefined;
    return copySpellbookEntry(entry);
}
/**
 * Check if a spell is known
 */
export function knowsSpell(spellbook, spellId) {
    return spellbook.spells.some((s) => s.spellId === spellId);
}
/**
 * Check if a spell is currently lost (for the day)
 */
export function isSpellLost(spellbook, spellId) {
    const entry = spellbook.spells.find((s) => s.spellId === spellId);
    return entry?.lost ?? false;
}
/**
 * Get count of spells known at a specific level
 */
export function getSpellCountAtLevel(spellbook, spells, level) {
    return spellbook.spells.filter((entry) => {
        const spell = spells.find((s) => s.id === entry.spellId);
        return spell?.level === level;
    }).length;
}
/**
 * Get all spell entries at a specific level
 */
export function getSpellsAtLevel(spellbook, spells, level) {
    return spellbook.spells
        .filter((entry) => {
        const spell = spells.find((s) => s.id === entry.spellId);
        return spell?.level === level;
    })
        .map(copySpellbookEntry);
}
/**
 * Get all lost spells
 */
export function getLostSpells(spellbook) {
    return spellbook.spells
        .filter((s) => s.lost)
        .map(copySpellbookEntry);
}
/**
 * Get all castable (not lost) spells from a spellbook
 */
export function getCastableSpells(spellbook) {
    return spellbook.spells
        .filter((s) => !s.lost)
        .map(copySpellbookEntry);
}
/**
 * Check if a character can learn a specific spell
 */
export function canLearnSpell(spellbook, spell, casterType, allSpells) {
    // Check if already known
    if (knowsSpell(spellbook, spell.id)) {
        return { allowed: false, reason: "Spell is already known" };
    }
    // Check if caster type can use this spell
    if (!spell.casterTypes.includes(casterType)) {
        return {
            allowed: false,
            reason: `${casterType} cannot learn ${spell.name}`,
        };
    }
    // Check spell limit per level (if defined)
    if (spellbook.maxSpellsPerLevel) {
        const maxAtLevel = spellbook.maxSpellsPerLevel[spell.level];
        if (maxAtLevel !== undefined) {
            const currentCount = getSpellCountAtLevel(spellbook, allSpells, spell.level);
            if (currentCount >= maxAtLevel) {
                return {
                    allowed: false,
                    reason: `Maximum spells at level ${String(spell.level)} reached (${String(maxAtLevel)})`,
                };
            }
        }
    }
    return { allowed: true };
}
// =============================================================================
// Spellbook Mutations (Return New Spellbook)
// =============================================================================
/**
 * Add a spell to a spellbook.
 * Returns a new spellbook with the spell added.
 */
export function addSpellToSpellbook(spellbook, spell, mercurialEffect, manifestation) {
    const newEntry = {
        spellId: spell.id,
        lost: false,
        learnedAt: new Date().toISOString(),
    };
    // Add optional fields only if provided (exactOptionalPropertyTypes)
    if (mercurialEffect !== undefined) {
        newEntry.mercurialEffect = mercurialEffect;
    }
    if (manifestation !== undefined) {
        newEntry.manifestation = manifestation;
    }
    const newSpellbook = {
        spells: [
            ...spellbook.spells.map((s) => ({ ...s })),
            newEntry,
        ],
    };
    // Copy maxSpellsPerLevel if present
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
/**
 * Remove a spell from a spellbook.
 * Returns a new spellbook with the spell removed.
 */
export function removeSpellFromSpellbook(spellbook, spellId) {
    const newSpellbook = {
        spells: spellbook.spells
            .filter((s) => s.spellId !== spellId)
            .map((s) => ({ ...s })),
    };
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
/**
 * Mark a spell as lost for the day.
 * Returns a new spellbook with the spell marked as lost.
 */
export function markSpellLost(spellbook, spellId) {
    const newSpellbook = {
        spells: spellbook.spells.map((s) => {
            if (s.spellId === spellId) {
                return { ...s, lost: true };
            }
            return { ...s };
        }),
    };
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
/**
 * Mark a spell as recovered (no longer lost).
 * Returns a new spellbook with the spell marked as available.
 */
export function markSpellRecovered(spellbook, spellId) {
    const newSpellbook = {
        spells: spellbook.spells.map((s) => {
            if (s.spellId === spellId) {
                return { ...s, lost: false };
            }
            return { ...s };
        }),
    };
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
/**
 * Recover all lost spells (after rest/prayer).
 * Returns a new spellbook with all spells marked as available.
 */
export function recoverAllSpells(spellbook) {
    const newSpellbook = {
        spells: spellbook.spells.map((s) => ({
            ...s,
            lost: false,
        })),
    };
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
/**
 * Update the last result for a spell (for GM adjustment feature).
 * Returns a new spellbook with the result recorded.
 */
export function updateSpellLastResult(spellbook, spellId, result) {
    const newSpellbook = {
        spells: spellbook.spells.map((s) => {
            if (s.spellId === spellId) {
                return { ...s, lastResult: result };
            }
            return { ...s };
        }),
    };
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
/**
 * Update notes for a spell.
 * Returns a new spellbook with updated notes.
 */
export function updateSpellNotes(spellbook, spellId, notes) {
    const newSpellbook = {
        spells: spellbook.spells.map((s) => {
            if (s.spellId === spellId) {
                const updated = { ...s };
                if (notes !== undefined) {
                    updated.notes = notes;
                }
                else {
                    delete updated.notes;
                }
                return updated;
            }
            return { ...s };
        }),
    };
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
/**
 * Set the maximum spells per level limits.
 * Returns a new spellbook with updated limits.
 */
export function setSpellLimits(spellbook, limits) {
    return {
        spells: spellbook.spells.map((s) => ({ ...s })),
        maxSpellsPerLevel: { ...limits },
    };
}
/**
 * Update a spell's mercurial effect.
 * Returns a new spellbook with updated mercurial effect.
 */
export function updateMercurialEffect(spellbook, spellId, mercurialEffect) {
    const newSpellbook = {
        spells: spellbook.spells.map((s) => {
            if (s.spellId === spellId) {
                const updated = { ...s };
                if (mercurialEffect !== undefined) {
                    updated.mercurialEffect = mercurialEffect;
                }
                else {
                    delete updated.mercurialEffect;
                }
                return updated;
            }
            return { ...s };
        }),
    };
    if (spellbook.maxSpellsPerLevel) {
        newSpellbook.maxSpellsPerLevel = { ...spellbook.maxSpellsPerLevel };
    }
    return newSpellbook;
}
//# sourceMappingURL=spellbook.js.map