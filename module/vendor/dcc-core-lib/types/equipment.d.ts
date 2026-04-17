/**
 * Equipment Data Types
 *
 * Types for equipment tables: armor, weapons, ammunition, mounts, etc.
 * These are "data" types for equipment catalogs/tables, distinct from
 * the combat-oriented types in combat.ts (WeaponStats, ArmorStats).
 */
/**
 * Equipment entry representing an item from the DCC equipment table
 */
export interface EquipmentEntry {
    /** Item name */
    name: string;
    /** Value in copper pieces */
    valueInCopper: number;
    /** Optional description/notes about the item */
    description?: string;
}
/**
 * Armor entry representing armor or shield from the DCC armor table
 */
export interface ArmorEntry {
    /** Armor name */
    name: string;
    /** AC bonus provided by this armor */
    acBonus: number;
    /** Check penalty (negative number, applied to certain skill checks) */
    checkPenalty: number;
    /** Speed penalty (e.g., "-5'" or "" for none) */
    speedPenalty: string;
    /** Fumble die when wearing this armor (e.g., "d8", "d12", "d16") */
    fumbleDie: string;
    /** Cost in gold pieces */
    costGp: number;
    /** Whether this is a shield rather than body armor */
    isShield: boolean;
}
/**
 * Weapon entry representing a weapon from the DCC weapons table
 */
export interface WeaponEntry {
    /** Weapon name */
    name: string;
    /** Base damage die (e.g., "1d8", "1d6", "1d4") */
    damage: string;
    /** Whether this is a melee weapon */
    melee: boolean;
    /** Range increments for ranged/thrown weapons (e.g., "10/20/30") */
    range?: string;
    /** Whether this requires two hands */
    twoHanded: boolean;
    /** Whether damage is doubled on a mounted charge */
    doubleIfMounted: boolean;
    /** Whether strength bonus applies at short range (thrown weapons) */
    shortRangeStrength: boolean;
    /** Whether this deals subdual (non-lethal) damage */
    subdual: boolean;
    /** Cost in gold pieces */
    costGp: number;
    /** Cost in silver pieces (for items costing less than 1 gp) */
    costSp: number;
    /** Optional notes about special properties */
    notes?: string;
}
/**
 * Ammunition entry representing projectiles for ranged weapons
 */
export interface AmmunitionEntry {
    /** Ammunition name */
    name: string;
    /** Quantity per purchase (e.g., 20 arrows, 30 sling stones) */
    quantity: number;
    /** Cost in gold pieces */
    costGp: number;
    /** Cost in silver pieces (for items costing less than 1 gp) */
    costSp: number;
    /** Optional notes */
    notes?: string;
}
/**
 * Mount entry representing a rideable animal
 */
export interface MountEntry {
    /** Mount name */
    name: string;
    /** Cost in gold pieces */
    costGp: number;
}
/**
 * Barding entry representing horse/mount armor
 */
export interface BardingEntry {
    /** Barding name (armor type) */
    name: string;
    /** Cost in gold pieces (4x normal armor cost) */
    costGp: number;
    /** AC bonus (same as equivalent armor) */
    acBonus: number;
}
/**
 * Mount equipment entry
 */
export interface MountEquipmentEntry {
    /** Item name */
    name: string;
    /** Cost in gold pieces */
    costGp: number;
    /** Cost in silver pieces (for items costing less than 1 gp) */
    costSp: number;
    /** Cost in copper pieces (for items costing less than 1 sp) */
    costCp: number;
}
/**
 * An occupation item that can be used as a weapon
 */
export interface OccupationWeapon {
    /** Unique identifier */
    id: string;
    /** Item name (e.g., "Awl (as dagger)") */
    name: string;
    /** Item type */
    type: "weapon";
    /** Damage dice */
    damage: string;
    /** Whether this is a melee weapon */
    melee: boolean;
    /** Range for thrown/ranged weapons */
    range?: string;
    /** Whether this requires two hands */
    twoHanded?: boolean;
}
/**
 * An occupation item that is trade goods/equipment
 */
export interface OccupationTradeGood {
    /** Unique identifier */
    id: string;
    /** Item name */
    name: string;
    /** Item type */
    type: "equipment";
}
/**
 * An occupation item that is treasure (coins, gems, etc.)
 */
export interface OccupationTreasure {
    /** Unique identifier */
    id: string;
    /** Item name */
    name: string;
    /** Item type */
    type: "treasure";
}
/**
 * An occupation item that is armor
 */
export interface OccupationArmor {
    /** Unique identifier */
    id: string;
    /** Item name */
    name: string;
    /** Item type */
    type: "armor";
}
/**
 * Union type for all occupation items
 */
export type OccupationItem = OccupationWeapon | OccupationTradeGood | OccupationTreasure | OccupationArmor;
//# sourceMappingURL=equipment.d.ts.map