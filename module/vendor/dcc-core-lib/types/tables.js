/**
 * Table Types
 *
 * Types for rollable tables (luck, crits, fumbles, etc.)
 */
/**
 * Look up a result in a table by roll value
 */
export function lookupTableResult(table, roll) {
    return table.entries.find((e) => roll >= e.min && roll <= e.max);
}
/**
 * Look up a birth augur by roll value
 */
export function lookupBirthAugurEntry(augurs, roll) {
    return augurs.find((a) => a.roll === roll);
}
//# sourceMappingURL=tables.js.map