/**
 * Bonus System Types
 *
 * Comprehensive system for representing all types of bonuses that can
 * apply to rolls in DCC. Bonuses can come from many sources:
 *
 * - Inherent: ability modifiers, class features, level
 * - Equipment: magic items, weapons, armor
 * - Circumstance: assist actions, terrain, judge rulings
 * - Luck: burning luck for bonuses
 * - Spell: active magical effects
 *
 * All bonuses stack in DCC (unlike D&D 3.5/Pathfinder).
 */
/**
 * Create an empty bonus list
 */
export function createEmptyBonusList() {
    return {
        inherent: [],
        situational: [],
    };
}
// =============================================================================
// Bonus Builders (convenience functions)
// =============================================================================
/**
 * Create an ability modifier bonus
 */
export function createAbilityBonus(abilityId, abilityName, modifier) {
    return {
        id: `ability:${abilityId}`,
        label: abilityName,
        source: { type: "ability", id: abilityId, name: abilityName },
        category: "inherent",
        effect: { type: "modifier", value: modifier },
    };
}
/**
 * Create a level/class bonus
 */
export function createLevelBonus(classId, level, modifier, label) {
    return {
        id: `class:${classId}:level`,
        label: label ?? `Level ${String(level)}`,
        source: { type: "class", id: classId },
        category: "inherent",
        effect: { type: "modifier", value: modifier },
    };
}
/**
 * Create a luck burn bonus
 */
export function createLuckBonus(pointsBurned, multiplier = 1) {
    const value = pointsBurned * multiplier;
    return {
        id: "luck:burn",
        label: multiplier === 1
            ? `Luck (${String(pointsBurned)} burned)`
            : `Luck (${String(pointsBurned)} × ${String(multiplier)})`,
        source: { type: "luck" },
        category: "luck",
        effect: { type: "modifier", value },
    };
}
/**
 * Create an equipment bonus
 */
export function createEquipmentBonus(itemId, itemName, modifier) {
    return {
        id: `item:${itemId}`,
        label: itemName,
        source: { type: "item", id: itemId, name: itemName },
        category: "equipment",
        effect: { type: "modifier", value: modifier },
    };
}
/**
 * Create a spell effect bonus
 */
export function createSpellBonus(spellId, spellName, effect) {
    return {
        id: `spell:${spellId}`,
        label: spellName,
        source: { type: "spell", id: spellId, name: spellName },
        category: "spell",
        effect,
    };
}
/**
 * Create an assist bonus (another character helping)
 */
export function createAssistBonus(helperName, modifier = 2) {
    return {
        id: `assist:${helperName.toLowerCase().replace(/\s+/g, "-")}`,
        label: `Assist (${helperName})`,
        source: { type: "assist", name: helperName },
        category: "circumstance",
        effect: { type: "modifier", value: modifier },
    };
}
/**
 * Create a judge's situational bonus
 */
export function createJudgeBonus(reason, effect) {
    return {
        id: `judge:${reason.toLowerCase().replace(/\s+/g, "-")}`,
        label: reason,
        source: { type: "judge", name: reason },
        category: "circumstance",
        effect,
    };
}
/**
 * Create a dice chain bump bonus
 */
export function createDiceChainBonus(source, steps, label) {
    return {
        id: `chain:${source.type}:${source.id ?? "default"}`,
        label,
        source,
        category: source.type === "spell" ? "spell" : "circumstance",
        effect: { type: "dice-chain", steps },
        priority: 10, // Dice chain changes should apply early
    };
}
/**
 * Compute the total effect of all bonuses.
 * All bonuses stack in DCC.
 *
 * @param bonuses - Array of bonuses to apply
 * @param condition - Optional condition to filter bonuses (e.g., "melee-attack")
 * @returns Computed totals for modifiers, dice chain, etc.
 */
export function computeBonuses(bonuses, condition) {
    // Sort by priority (higher first)
    const sorted = [...bonuses].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    // Filter by condition
    const applicable = sorted.filter((bonus) => {
        if (!bonus.condition)
            return true;
        if (!condition)
            return false;
        return bonus.condition === condition;
    });
    const result = {
        totalModifier: 0,
        diceChainSteps: 0,
        additionalDice: [],
        hasReroll: false,
        appliedBonuses: applicable,
    };
    for (const bonus of applicable) {
        switch (bonus.effect.type) {
            case "modifier":
                result.totalModifier += bonus.effect.value;
                break;
            case "die":
                result.additionalDice.push({
                    die: bonus.effect.die,
                    count: bonus.effect.count ?? 1,
                });
                break;
            case "dice-chain":
                result.diceChainSteps += bonus.effect.steps;
                break;
            case "set-die":
                result.forcedDie = bonus.effect.die;
                break;
            case "reroll":
                result.hasReroll = true;
                result.rerollMode = bonus.effect.mode;
                break;
        }
    }
    return result;
}
/**
 * Merge inherent and situational bonuses into a single list
 */
export function mergeBonuses(list) {
    return [...list.inherent, ...list.situational];
}
/**
 * Get the total modifier from a list of bonuses (quick helper)
 */
export function getTotalModifier(bonuses) {
    return bonuses.reduce((sum, bonus) => {
        if (bonus.effect.type === "modifier") {
            return sum + bonus.effect.value;
        }
        return sum;
    }, 0);
}
/**
 * Get net dice chain steps from a list of bonuses
 */
export function getDiceChainSteps(bonuses) {
    return bonuses.reduce((sum, bonus) => {
        if (bonus.effect.type === "dice-chain") {
            return sum + bonus.effect.steps;
        }
        return sum;
    }, 0);
}
//# sourceMappingURL=bonuses.js.map