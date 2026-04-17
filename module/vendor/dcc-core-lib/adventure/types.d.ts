/**
 * Adventure System Types
 *
 * Types for running multiplayer adventures with encounters,
 * combat, and narrative elements.
 */
import type { Character } from "../types/character.js";
import type { Creature } from "../types/creatures.js";
import type { VitalStatus, BleedingOutState } from "../combat/death-and-dying.js";
import type { CreatureMoraleState, GroupMoraleState } from "../combat/morale.js";
import type { DCCAbilityId } from "../types/system.js";
/**
 * Type of encounter
 */
export type EncounterType = "combat" | "exploration" | "trap" | "skill-challenge" | "narrative";
/**
 * Phase of a combat encounter
 */
export type CombatPhase = "pending" | "initiative" | "active" | "resolved" | "fled" | "tpk";
/**
 * Phase of a narrative encounter
 */
export type NarrativePhase = "presenting" | "awaiting-choice" | "resolving" | "resolved";
/**
 * Primary behavior type for monster AI
 */
export type MonsterBehaviorType = "aggressive" | "opportunistic" | "pack" | "cowardly" | "berserker" | "intelligent" | "territorial";
/**
 * Target selection priority
 */
export type TargetPriority = "nearest" | "lowest-hp" | "highest-hp" | "lowest-ac" | "wounded" | "spellcaster" | "last-attacker" | "random";
/**
 * Monster behavior profile for AI decisions
 */
export interface MonsterBehaviorProfile {
    /** Primary behavior type */
    primary: MonsterBehaviorType;
    /** Whether to prefer ranged attacks when available */
    preferRanged: boolean;
    /** HP percentage (0-1) at which to flee, 0 = never flee */
    fleeThreshold: number;
    /** Target selection priorities in order */
    targetPriority: TargetPriority[];
}
/**
 * Base combatant properties shared by players and monsters
 */
export interface BaseCombatant {
    /** Unique ID for this combatant in the encounter */
    combatantId: string;
    /** Display name */
    name: string;
    /** Rolled initiative total */
    initiative: number;
    /** Whether this combatant has acted in the current round */
    hasActedThisRound: boolean;
    /** Current vital status */
    vitalStatus: VitalStatus;
    /** Active conditions (poisoned, prone, etc.) */
    conditions: string[];
}
/**
 * A player character in combat
 */
export interface PlayerCombatant extends BaseCombatant {
    type: "player";
    /** Discord user ID */
    discordUserId: string;
    /** Character ID from storage */
    characterId: string;
    /** Snapshot of character at encounter start */
    characterSnapshot: Character;
    /** Current HP (may differ from snapshot after damage) */
    currentHP: number;
    /** Bleeding out state if applicable */
    bleedingOut?: BleedingOutState;
}
/**
 * A monster/NPC in combat
 */
export interface MonsterCombatant extends BaseCombatant {
    type: "monster";
    /** Creature template ID (e.g., "goblin") */
    creatureTemplateId: string;
    /** Instance number for multiples (1, 2, 3...) */
    instanceNumber: number;
    /** Current HP */
    currentHP: number;
    /** Maximum HP (rolled or default) */
    maxHP: number;
    /** Full creature template data */
    creature: Creature;
    /** Individual morale state */
    moraleState: CreatureMoraleState;
    /** AI behavior profile */
    behaviorProfile: MonsterBehaviorProfile;
}
/**
 * Union of combatant types
 */
export type Combatant = PlayerCombatant | MonsterCombatant;
/**
 * Types of combat log entries
 */
export type CombatLogEntryType = "initiative" | "attack" | "damage" | "critical" | "fumble" | "miss" | "death" | "morale" | "flee" | "round-start" | "combat-end";
/**
 * An entry in the combat log
 */
export interface CombatLogEntry {
    /** Type of entry */
    type: CombatLogEntryType;
    /** Round number */
    round: number;
    /** Acting combatant ID */
    actorId?: string;
    /** Target combatant ID */
    targetId?: string;
    /** Human-readable description */
    description: string;
    /** Timestamp */
    timestamp: string;
    /** Roll details if applicable */
    rolls?: {
        natural?: number;
        total?: number;
        dc?: number;
    };
}
/**
 * Full state of a combat encounter
 */
export interface CombatEncounterState {
    /** Unique encounter ID */
    encounterId: string;
    /** Discriminator */
    type: "combat";
    /** Current phase */
    phase: CombatPhase;
    /** All combatants */
    combatants: Combatant[];
    /** Current round number (starts at 1) */
    round: number;
    /** ID of combatant whose turn it is */
    currentTurnCombatantId: string | null;
    /** Ordered list of combatant IDs by initiative */
    turnOrder: string[];
    /** Index into turnOrder for current turn */
    turnIndex: number;
    /** Group morale state for monsters */
    monsterGroupMorale: GroupMoraleState;
    /** Whether monsters are fleeing */
    monstersFleeing: boolean;
    /** Combat log */
    combatLog: CombatLogEntry[];
}
/**
 * Category of narrative template
 */
export type NarrativeCategory = "exploration" | "trap" | "puzzle" | "social" | "environmental";
/**
 * An option in a narrative encounter
 */
export interface NarrativeOption {
    /** Option ID */
    id: string;
    /** Display text for the option */
    text: string;
    /** Required skill check if any */
    skillCheck?: {
        ability: DCCAbilityId;
        dc: number;
    };
    /** Outcome text on success (or if no check required) */
    successOutcome: string;
    /** Outcome text on failure */
    failureOutcome?: string;
}
/**
 * A narrative encounter template
 */
export interface NarrativeTemplate {
    /** Template ID */
    id: string;
    /** Category */
    category: NarrativeCategory;
    /** Situation description with {variable} placeholders */
    situation: string;
    /** Available options */
    options: NarrativeOption[];
}
/**
 * A skill check result for a player
 */
export interface NarrativeCheckResult {
    playerId: string;
    playerName: string;
    ability: DCCAbilityId;
    dc: number;
    roll: number;
    modifier: number;
    total: number;
    passed: boolean;
}
/**
 * Full state of a narrative encounter
 */
export interface NarrativeEncounterState {
    /** Unique encounter ID */
    encounterId: string;
    /** Discriminator */
    type: "narrative";
    /** Current phase */
    phase: NarrativePhase;
    /** Template ID used */
    templateId: string;
    /** Filled-in situation text */
    situation: string;
    /** Available options */
    options: NarrativeOption[];
    /** Chosen option ID */
    chosenOptionId?: string;
    /** Skill check results if applicable */
    checkResults?: NarrativeCheckResult[];
    /** Final outcome text */
    outcome?: string;
}
/**
 * Union of encounter state types
 */
export type EncounterState = CombatEncounterState | NarrativeEncounterState;
/**
 * Adventure status
 */
export type AdventureStatus = "gathering" | "active" | "paused" | "completed" | "abandoned";
/**
 * A player in an adventure
 */
export interface AdventurePlayer {
    /** Discord user ID */
    discordUserId: string;
    /** Discord username for display */
    discordUsername: string;
    /** Character ID from storage */
    characterId: string;
    /** Character name for display */
    characterName: string;
    /** When the player joined */
    joinedAt: string;
}
/**
 * Summary of a completed encounter
 */
export interface EncounterSummary {
    /** Encounter ID */
    encounterId: string;
    /** Type of encounter */
    type: EncounterType;
    /** How it ended */
    outcome: string;
    /** When it completed */
    completedAt: string;
}
/**
 * Full adventure state
 */
export interface AdventureState {
    /** Unique adventure ID */
    adventureId: string;
    /** Adventure name */
    name: string;
    /** Discord thread ID */
    threadId: string;
    /** Discord guild ID */
    guildId: string;
    /** Discord user ID of creator */
    creatorId: string;
    /** Current status */
    status: AdventureStatus;
    /** When created */
    createdAt: string;
    /** Last activity timestamp */
    lastActivityAt: string;
    /** Players in the adventure */
    players: AdventurePlayer[];
    /** Current active encounter if any */
    currentEncounter: EncounterState | null;
    /** History of completed encounters */
    encounterHistory: EncounterSummary[];
    /** Custom monsters added for this adventure */
    customMonsters: Creature[];
}
/**
 * Types of player combat actions
 */
export type PlayerActionType = "attack" | "defend" | "flee" | "pass" | "use-item" | "cast-spell";
/**
 * A player combat action
 */
export interface PlayerCombatAction {
    /** Action type */
    type: PlayerActionType;
    /** Target combatant ID (for attacks) */
    targetId?: string;
    /** Weapon or item being used */
    weaponId?: string;
    /** Spell being cast */
    spellId?: string;
}
/**
 * Monster AI decision
 */
export interface MonsterDecision {
    /** Chosen action type */
    actionType: "attack" | "flee" | "pass" | "special";
    /** Target combatant ID */
    targetId?: string;
    /** Which attack to use */
    attackIndex?: number;
    /** Reasoning for the decision (for logging) */
    reasoning: string;
}
/**
 * Result of a combat attack action
 */
export interface AttackActionResult {
    /** Whether the attack hit */
    hit: boolean;
    /** Natural roll */
    naturalRoll: number;
    /** Total attack roll */
    attackTotal: number;
    /** Target AC */
    targetAC: number;
    /** Damage dealt (0 if miss) */
    damage: number;
    /** Whether it was a critical hit */
    critical: boolean;
    /** Whether it was a fumble */
    fumble: boolean;
    /** Critical hit description if applicable */
    criticalEffect?: string;
    /** Fumble description if applicable */
    fumbleEffect?: string;
    /** Whether the target was killed */
    targetKilled: boolean;
    /** Target's new HP */
    targetNewHP: number;
    /** Target's new vital status */
    targetVitalStatus: VitalStatus;
}
/**
 * Result of a monster's turn
 */
export interface MonsterTurnResult {
    /** Monster combatant ID */
    monsterId: string;
    /** Monster name */
    monsterName: string;
    /** The decision made */
    decision: MonsterDecision;
    /** Attack result if attacked */
    attackResult?: AttackActionResult;
    /** Whether the monster fled */
    fled: boolean;
}
//# sourceMappingURL=types.d.ts.map