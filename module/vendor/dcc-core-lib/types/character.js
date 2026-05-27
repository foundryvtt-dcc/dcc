/**
 * Character Types
 *
 * Normalized character data structures for DCC.
 * All values use consistent types (numbers are numbers, not strings).
 * Class-specific data is only present when relevant.
 */
/**
 * Create default ability scores (all 10s)
 */
export function createDefaultAbilityScores() {
    return {
        str: { current: 10, max: 10 },
        agl: { current: 10, max: 10 },
        sta: { current: 10, max: 10 },
        per: { current: 10, max: 10 },
        int: { current: 10, max: 10 },
        lck: { current: 10, max: 10 },
    };
}
/**
 * Create an empty inventory
 */
export function createEmptyInventory() {
    return { items: [] };
}
/**
 * Create an inventory item with defaults
 */
export function createInventoryItem(name, category, options) {
    const item = {
        id: options?.id ?? `item-${String(Date.now())}-${String(Math.floor(Math.random() * 10000))}`,
        name,
        category,
        quantity: options?.quantity ?? 1,
    };
    // Only add optional properties if they have values (exactOptionalPropertyTypes)
    if (options?.equipped !== undefined) {
        item.equipped = options.equipped;
    }
    if (options?.notes !== undefined) {
        item.notes = options.notes;
    }
    if (options?.value !== undefined) {
        item.value = options.value;
    }
    return item;
}
//# sourceMappingURL=character.js.map