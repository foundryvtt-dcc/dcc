/**
 * Creature/NPC Types
 *
 * Types for monsters, NPCs, and other creatures in DCC.
 */
import type { Alignment } from "./system.js";
/**
 * Creature attack definition
 */
export interface CreatureAttack {
    /** Attack name (e.g., "bite", "claw", "mace") */
    name: string;
    /** Attack bonus (e.g., "+5") */
    toHit: string;
    /** Whether this is a melee attack */
    melee: boolean;
    /** Range for missile attacks (e.g., "60'") */
    range?: string;
    /** Damage expression (e.g., "1d6+5", "2d4") */
    damage: string;
}
/**
 * Creature saving throws
 */
export interface CreatureSaves {
    /** Fortitude save */
    fort: number;
    /** Reflex save */
    ref: number;
    /** Will save */
    will: number;
}
/**
 * Creature movement speeds
 */
export interface CreatureSpeed {
    /** Base land speed (e.g., "30'") */
    land: string;
    /** Flying speed if any */
    fly?: string;
    /** Swimming speed if any */
    swim?: string;
    /** Other movement (e.g., "climb 20'") */
    other?: string;
}
/**
 * Core creature/NPC data structure
 */
export interface Creature {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Armor Class */
    ac: number;
    /** Hit Dice expression (e.g., "4d8+4") */
    hitDice: string;
    /** Average/default HP */
    hp: number;
    /** Initiative modifier */
    init: number;
    /** Movement speed */
    speed: CreatureSpeed;
    /** Action dice (e.g., "1d20", "3d20") */
    actionDice: string;
    /** Critical hit die (e.g., "1d10") */
    critDie: string;
    /** Critical hit table (e.g., "M", "III") */
    critTable: string;
    /** Saving throws */
    saves: CreatureSaves;
    /** Alignment */
    alignment: Alignment;
    /** Attacks */
    attacks: CreatureAttack[];
    /** Special abilities description */
    special?: string;
    /** Full statline from source */
    statline: string;
    /** Category for grouping related creatures */
    category?: string;
}
/**
 * Collection of creatures indexed by ID
 */
export type CreatureCollection = Record<string, Creature>;
//# sourceMappingURL=creatures.d.ts.map