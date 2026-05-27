/**
 * Encounter Engine
 *
 * Pure functions for managing combat encounters including:
 * - Creating encounters with players and monsters
 * - Rolling and managing initiative
 * - Processing combat actions
 * - Tracking damage and combat state
 */
import { rollInitiative, sortByInitiative } from "../combat/initiative.js";
import { makeAttackRoll } from "../combat/attack.js";
import { rollDamage } from "../combat/damage.js";
import { evaluateRoll } from "../dice/roll.js";
import { getAbilityModifier } from "../data/ability-modifiers.js";
import { createGroupMoraleState, createCreatureMoraleState, } from "../combat/morale.js";
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Generate a unique combatant ID
 */
function generateCombatantId(prefix) {
    return `${prefix}-${String(Date.now())}-${Math.random().toString(36).substring(2, 6)}`;
}
/**
 * Create a default behavior profile for a monster
 * In Phase 3, this will be more sophisticated based on creature type
 */
function createDefaultBehaviorProfile() {
    return {
        primary: "aggressive",
        preferRanged: false,
        fleeThreshold: 0.25, // Flee at 25% HP
        targetPriority: ["nearest", "random"],
    };
}
/**
 * Roll HP for a creature based on hit dice
 */
function rollCreatureHP(hitDice, roller) {
    const options = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const result = evaluateRoll(hitDice, options);
    return Math.max(1, result.total ?? 1);
}
/**
 * Create a log entry
 */
function createLogEntry(type, round, description, actorId, targetId, rolls) {
    const entry = {
        type,
        round,
        description,
        timestamp: new Date().toISOString(),
    };
    if (actorId)
        entry.actorId = actorId;
    if (targetId)
        entry.targetId = targetId;
    if (rolls)
        entry.rolls = rolls;
    return entry;
}
// =============================================================================
// Encounter Creation
// =============================================================================
/**
 * Create player combatants from characters
 */
export function createPlayerCombatants(players) {
    return players.map((p) => ({
        type: "player",
        combatantId: generateCombatantId("player"),
        discordUserId: p.discordUserId,
        characterId: p.character.identity.id,
        name: p.character.identity.name,
        characterSnapshot: p.character,
        currentHP: p.character.state.hp.current,
        initiative: 0,
        hasActedThisRound: false,
        vitalStatus: "alive",
        conditions: [],
    }));
}
/**
 * Create monster combatants from creatures
 */
export function createMonsterCombatants(monsters, roller) {
    const combatants = [];
    for (const { creature, count } of monsters) {
        for (let i = 1; i <= count; i++) {
            const hp = rollCreatureHP(creature.hitDice, roller);
            const name = count > 1 ? `${creature.name} ${String(i)}` : creature.name;
            combatants.push({
                type: "monster",
                combatantId: generateCombatantId("monster"),
                creatureTemplateId: creature.id,
                instanceNumber: i,
                name,
                creature,
                currentHP: hp,
                maxHP: hp,
                initiative: 0,
                hasActedThisRound: false,
                vitalStatus: "alive",
                conditions: [],
                moraleState: createCreatureMoraleState(hp),
                behaviorProfile: createDefaultBehaviorProfile(),
            });
        }
    }
    return combatants;
}
/**
 * Create a new combat encounter
 */
export function createCombatEncounter(encounterId, players, monsters, roller) {
    const playerCombatants = createPlayerCombatants(players);
    const monsterCombatants = createMonsterCombatants(monsters, roller);
    const totalMonsters = monsterCombatants.length;
    return {
        encounterId,
        type: "combat",
        phase: "pending",
        combatants: [...playerCombatants, ...monsterCombatants],
        round: 0,
        currentTurnCombatantId: null,
        turnOrder: [],
        turnIndex: 0,
        monsterGroupMorale: createGroupMoraleState(totalMonsters),
        monstersFleeing: false,
        combatLog: [],
    };
}
// =============================================================================
// Initiative
// =============================================================================
/**
 * Roll initiative for a player combatant
 */
function rollPlayerInitiative(player, roller) {
    const char = player.characterSnapshot;
    const aglMod = getAbilityModifier(char.state.abilities.agl.current);
    const result = rollInitiative({
        initiativeDie: "d16", // TODO: Use class-based die
        agilityModifier: aglMod,
    }, roller);
    return result.total;
}
/**
 * Roll initiative for a monster combatant
 */
function rollMonsterInitiative(monster, roller) {
    const result = rollInitiative({
        initiativeDie: "d16",
        agilityModifier: monster.creature.init,
    }, roller);
    return result.total;
}
/**
 * Roll initiative for all combatants and set up turn order
 */
export function rollAllInitiative(encounter, roller) {
    // Roll initiative for each combatant
    const updatedCombatants = encounter.combatants.map((c) => {
        if (c.type === "player") {
            return { ...c, initiative: rollPlayerInitiative(c, roller) };
        }
        return { ...c, initiative: rollMonsterInitiative(c, roller) };
    });
    // Sort by initiative
    const sorted = sortByInitiative(updatedCombatants);
    const turnOrder = sorted.map((c) => c.combatantId);
    // Create log entries
    const initiativeLog = sorted.map((c) => createLogEntry("initiative", 1, `${c.name} rolled ${String(c.initiative)} for initiative`));
    return {
        ...encounter,
        phase: "active",
        round: 1,
        combatants: updatedCombatants,
        turnOrder,
        turnIndex: 0,
        currentTurnCombatantId: turnOrder[0] ?? null,
        combatLog: [
            ...encounter.combatLog,
            createLogEntry("round-start", 1, "Combat begins!"),
            ...initiativeLog,
        ],
    };
}
// =============================================================================
// Turn Management
// =============================================================================
/**
 * Get the current turn's combatant
 */
export function getCurrentTurnCombatant(encounter) {
    if (!encounter.currentTurnCombatantId)
        return undefined;
    return encounter.combatants.find((c) => c.combatantId === encounter.currentTurnCombatantId);
}
/**
 * Check if it's a specific player's turn
 */
export function isPlayersTurn(encounter, discordUserId) {
    const current = getCurrentTurnCombatant(encounter);
    if (current?.type !== "player")
        return false;
    return current.discordUserId === discordUserId;
}
/**
 * Get a combatant by ID
 */
export function getCombatantById(encounter, combatantId) {
    return encounter.combatants.find((c) => c.combatantId === combatantId);
}
/**
 * Get a combatant by name (partial match, case-insensitive)
 */
export function getCombatantByName(encounter, name) {
    const lower = name.toLowerCase();
    return encounter.combatants.find((c) => c.name.toLowerCase().includes(lower));
}
/**
 * Get all living combatants
 */
export function getLivingCombatants(encounter) {
    return encounter.combatants.filter((c) => c.vitalStatus === "alive");
}
/**
 * Get all living players
 */
export function getLivingPlayers(encounter) {
    return encounter.combatants.filter((c) => c.type === "player" && c.vitalStatus === "alive");
}
/**
 * Get all living monsters
 */
export function getLivingMonsters(encounter) {
    return encounter.combatants.filter((c) => c.type === "monster" && c.vitalStatus === "alive");
}
/**
 * Advance to the next turn
 */
export function advanceTurn(encounter) {
    // Mark current combatant as having acted
    const currentId = encounter.currentTurnCombatantId;
    let combatants = encounter.combatants.map((c) => c.combatantId === currentId ? { ...c, hasActedThisRound: true } : c);
    const { turnIndex } = encounter;
    let { round } = encounter;
    const log = [...encounter.combatLog];
    // Find next living combatant
    let nextIndex = turnIndex + 1;
    let loopCount = 0;
    const maxLoops = encounter.turnOrder.length;
    while (loopCount < maxLoops) {
        if (nextIndex >= encounter.turnOrder.length) {
            // End of round - start new round
            nextIndex = 0;
            round += 1;
            // Reset hasActedThisRound for all combatants
            combatants = combatants.map((c) => ({ ...c, hasActedThisRound: false }));
            log.push(createLogEntry("round-start", round, `Round ${String(round)} begins!`));
        }
        const nextId = encounter.turnOrder[nextIndex];
        const nextCombatant = combatants.find((c) => c.combatantId === nextId);
        // Skip dead combatants
        if (nextCombatant?.vitalStatus === "alive") {
            return {
                ...encounter,
                combatants,
                turnIndex: nextIndex,
                round,
                currentTurnCombatantId: nextId ?? null,
                combatLog: log,
            };
        }
        nextIndex++;
        loopCount++;
    }
    // No living combatants found - combat should end
    return {
        ...encounter,
        combatants,
        currentTurnCombatantId: null,
        combatLog: log,
    };
}
// =============================================================================
// Combat Actions
// =============================================================================
/**
 * Apply damage to a combatant
 */
export function applyCombatDamage(encounter, targetId, damage) {
    const combatants = encounter.combatants.map((c) => {
        if (c.combatantId !== targetId)
            return c;
        const newHP = c.currentHP - damage;
        if (c.type === "player") {
            // For players, check vital status based on level
            // 0-level dies at 0 HP, 1+ level bleeds out
            const level = c.characterSnapshot.classInfo?.level ?? 0;
            let vitalStatus = c.vitalStatus;
            if (newHP <= 0) {
                if (level === 0) {
                    vitalStatus = "dead";
                }
                else {
                    vitalStatus = "bleeding-out";
                }
            }
            return {
                ...c,
                currentHP: newHP,
                vitalStatus,
            };
        }
        // Monster - just track HP and mark dead at 0
        return {
            ...c,
            currentHP: newHP,
            vitalStatus: newHP <= 0 ? "dead" : c.vitalStatus,
            moraleState: {
                ...c.moraleState,
                currentHP: newHP,
            },
        };
    });
    return { ...encounter, combatants };
}
/**
 * Process a player attack action
 */
export function processPlayerAttack(encounter, attackerId, targetId, roller) {
    const attacker = getCombatantById(encounter, attackerId);
    const target = getCombatantById(encounter, targetId);
    if (attacker?.type !== "player") {
        throw new Error("Invalid attacker");
    }
    if (!target) {
        throw new Error("Invalid target");
    }
    const char = attacker.characterSnapshot;
    const strMod = getAbilityModifier(char.state.abilities.str.current);
    const attackBonus = char.state.combat.attackBonus;
    // Get target AC
    let targetAC;
    if (target.type === "monster") {
        targetAC = target.creature.ac;
    }
    else {
        targetAC = target.characterSnapshot.state.combat.ac;
    }
    // Make attack roll
    const attackResult = makeAttackRoll({
        attackType: "melee",
        actionDie: "d20",
        attackBonus,
        abilityModifier: strMod,
        threatRange: 20,
        targetAC,
    }, roller);
    const hit = attackResult.total >= targetAC && !attackResult.isFumble;
    let damage = 0;
    let targetKilled = false;
    let updatedEncounter = encounter;
    if (hit) {
        // Roll damage - for now, use a simple d4 as default
        // TODO: Parse weapon damage from character inventory
        const damageDie = "d4";
        const damageResult = rollDamage({
            damageDie,
            diceCount: 1,
            strengthModifier: strMod,
        }, roller);
        damage = Math.max(1, damageResult.total);
        // Apply damage
        updatedEncounter = applyCombatDamage(encounter, targetId, damage);
        // Check if target died
        const updatedTarget = getCombatantById(updatedEncounter, targetId);
        targetKilled = updatedTarget?.vitalStatus === "dead";
    }
    // Get updated target HP
    const finalTarget = getCombatantById(updatedEncounter, targetId);
    const targetNewHP = finalTarget?.currentHP ?? 0;
    const targetVitalStatus = finalTarget?.vitalStatus ?? "dead";
    // Get natural roll from the roll result
    const naturalRoll = attackResult.roll.natural ?? 0;
    // Create log entry
    const logMessage = hit
        ? `${attacker.name} hits ${target.name} for ${String(damage)} damage!${targetKilled ? ` ${target.name} is slain!` : ""}`
        : attackResult.isFumble
            ? `${attacker.name} fumbles their attack!`
            : `${attacker.name} misses ${target.name}.`;
    const logEntry = createLogEntry(hit ? "attack" : attackResult.isFumble ? "fumble" : "miss", updatedEncounter.round, logMessage, attackerId, targetId, {
        natural: naturalRoll,
        total: attackResult.total,
        dc: targetAC,
    });
    updatedEncounter = {
        ...updatedEncounter,
        combatLog: [...updatedEncounter.combatLog, logEntry],
    };
    const result = {
        hit,
        naturalRoll,
        attackTotal: attackResult.total,
        targetAC,
        damage,
        critical: attackResult.isCriticalThreat,
        fumble: attackResult.isFumble,
        targetKilled,
        targetNewHP,
        targetVitalStatus,
    };
    return { encounter: updatedEncounter, result };
}
// =============================================================================
// Combat End Conditions
// =============================================================================
/**
 * Check if combat has ended
 */
export function checkCombatEnd(encounter) {
    const livingPlayers = getLivingPlayers(encounter);
    const livingMonsters = getLivingMonsters(encounter);
    // All players dead = defeat
    if (livingPlayers.length === 0) {
        return { ended: true, reason: "defeat" };
    }
    // All monsters dead = victory
    if (livingMonsters.length === 0) {
        return { ended: true, reason: "victory" };
    }
    // Monsters fleeing and all have fled
    if (encounter.monstersFleeing) {
        return { ended: true, reason: "fled" };
    }
    return { ended: false };
}
/**
 * End the combat encounter
 */
export function endCombat(encounter, reason) {
    const phaseMap = {
        victory: "resolved",
        defeat: "tpk",
        fled: "fled",
    };
    const logMessage = {
        victory: "Victory! All enemies have been defeated!",
        defeat: "Defeat... The party has fallen.",
        fled: "The enemies have fled!",
    };
    return {
        ...encounter,
        phase: phaseMap[reason],
        currentTurnCombatantId: null,
        combatLog: [
            ...encounter.combatLog,
            createLogEntry("combat-end", encounter.round, logMessage[reason]),
        ],
    };
}
// =============================================================================
// Monster AI
// =============================================================================
/**
 * Select a target for a monster based on its behavior profile
 */
function selectMonsterTarget(monster, validTargets) {
    if (validTargets.length === 0)
        return undefined;
    if (validTargets.length === 1)
        return validTargets[0];
    const priorities = monster.behaviorProfile.targetPriority;
    for (const priority of priorities) {
        switch (priority) {
            case "lowest-hp": {
                const sorted = [...validTargets].sort((a, b) => a.currentHP - b.currentHP);
                return sorted[0];
            }
            case "highest-hp": {
                const sorted = [...validTargets].sort((a, b) => b.currentHP - a.currentHP);
                return sorted[0];
            }
            case "wounded": {
                const wounded = validTargets.filter((t) => {
                    const maxHP = t.characterSnapshot.state.hp.max;
                    return t.currentHP < maxHP;
                });
                if (wounded.length > 0) {
                    return wounded[Math.floor(Math.random() * wounded.length)];
                }
                break;
            }
            case "random":
            case "nearest":
            default:
                return validTargets[Math.floor(Math.random() * validTargets.length)];
        }
    }
    // Default to random
    return validTargets[Math.floor(Math.random() * validTargets.length)];
}
/**
 * Decide what action a monster should take
 */
function decideMonsterAction(monster, encounter) {
    const livingPlayers = getLivingPlayers(encounter);
    // Check if should flee based on HP threshold
    const hpPercent = monster.currentHP / monster.maxHP;
    if (hpPercent <= monster.behaviorProfile.fleeThreshold && monster.behaviorProfile.fleeThreshold > 0) {
        return {
            actionType: "flee",
            reasoning: `HP (${String(Math.round(hpPercent * 100))}%) below flee threshold (${String(Math.round(monster.behaviorProfile.fleeThreshold * 100))}%)`,
        };
    }
    // No valid targets = pass
    if (livingPlayers.length === 0) {
        return {
            actionType: "pass",
            reasoning: "No valid targets",
        };
    }
    // Select target and attack
    const target = selectMonsterTarget(monster, livingPlayers);
    if (!target) {
        return {
            actionType: "pass",
            reasoning: "Could not select target",
        };
    }
    // Pick which attack to use (first attack for now)
    const attackIndex = 0;
    return {
        actionType: "attack",
        targetId: target.combatantId,
        attackIndex,
        reasoning: `Attacking ${target.name} (${monster.behaviorProfile.primary} behavior)`,
    };
}
/**
 * Process a monster's attack
 */
function processMonsterAttack(encounter, monster, targetId, attackIndex, roller) {
    const target = getCombatantById(encounter, targetId);
    if (!target) {
        throw new Error("Invalid target");
    }
    // Get monster's attack
    const attack = monster.creature.attacks[attackIndex];
    const toHitStr = attack?.toHit ?? "+0";
    const toHitBonus = parseInt(toHitStr.replace("+", ""), 10) || 0;
    // Get target AC
    let targetAC;
    if (target.type === "player") {
        targetAC = target.characterSnapshot.state.combat.ac;
    }
    else {
        targetAC = target.creature.ac;
    }
    // Make attack roll
    const attackResult = makeAttackRoll({
        attackType: attack?.melee ? "melee" : "missile",
        actionDie: "d20",
        attackBonus: toHitBonus,
        abilityModifier: 0,
        threatRange: 20,
        targetAC,
    }, roller);
    const hit = attackResult.total >= targetAC && !attackResult.isFumble;
    let damage = 0;
    let targetKilled = false;
    let updatedEncounter = encounter;
    if (hit) {
        // Parse and roll damage
        const damageStr = attack?.damage ?? "1d4";
        const damageRollResult = evaluateRoll(damageStr, roller ? { mode: "evaluate", roller } : { mode: "evaluate" });
        damage = Math.max(1, damageRollResult.total ?? 1);
        // Apply damage
        updatedEncounter = applyCombatDamage(encounter, targetId, damage);
        // Check if target died
        const updatedTarget = getCombatantById(updatedEncounter, targetId);
        targetKilled = updatedTarget?.vitalStatus === "dead" || updatedTarget?.vitalStatus === "bleeding-out";
    }
    // Get natural roll
    const naturalRoll = attackResult.roll.natural ?? attackResult.total;
    // Get updated target HP
    const finalTarget = getCombatantById(updatedEncounter, targetId);
    const targetNewHP = finalTarget?.currentHP ?? 0;
    const targetVitalStatus = finalTarget?.vitalStatus ?? "dead";
    // Log the attack
    const attackName = attack?.name ?? "attack";
    const logMessage = hit
        ? `${monster.name} hits ${target.name} with ${attackName} for ${String(damage)} damage!${targetKilled ? ` ${target.name} falls!` : ""}`
        : attackResult.isFumble
            ? `${monster.name} fumbles their ${attackName}!`
            : `${monster.name} misses ${target.name} with ${attackName}.`;
    const logEntry = createLogEntry(hit ? "attack" : attackResult.isFumble ? "fumble" : "miss", updatedEncounter.round, logMessage, monster.combatantId, targetId, {
        natural: naturalRoll,
        total: attackResult.total,
        dc: targetAC,
    });
    updatedEncounter = {
        ...updatedEncounter,
        combatLog: [...updatedEncounter.combatLog, logEntry],
    };
    return {
        encounter: updatedEncounter,
        result: {
            hit,
            naturalRoll,
            attackTotal: attackResult.total,
            targetAC,
            damage,
            critical: attackResult.isCriticalThreat,
            fumble: attackResult.isFumble,
            targetKilled,
            targetNewHP,
            targetVitalStatus,
        },
    };
}
/**
 * Process a single monster's turn
 */
export function processMonsterTurn(encounter, monsterId, roller) {
    const monster = getCombatantById(encounter, monsterId);
    if (monster?.type !== "monster") {
        throw new Error("Invalid monster");
    }
    // Decide action
    const decision = decideMonsterAction(monster, encounter);
    let updatedEncounter = encounter;
    let attackResult;
    let fled = false;
    switch (decision.actionType) {
        case "attack": {
            if (decision.targetId) {
                const result = processMonsterAttack(updatedEncounter, monster, decision.targetId, decision.attackIndex ?? 0, roller);
                updatedEncounter = result.encounter;
                attackResult = result.result;
            }
            break;
        }
        case "flee": {
            // Monster flees - remove from combat
            fled = true;
            updatedEncounter = {
                ...updatedEncounter,
                combatants: updatedEncounter.combatants.map((c) => c.combatantId === monsterId
                    ? { ...c, vitalStatus: "dead" } // Mark as "dead" to remove from turn order
                    : c),
                combatLog: [
                    ...updatedEncounter.combatLog,
                    createLogEntry("flee", updatedEncounter.round, `${monster.name} flees from combat!`, monsterId),
                ],
            };
            break;
        }
        case "pass":
        default: {
            updatedEncounter = {
                ...updatedEncounter,
                combatLog: [
                    ...updatedEncounter.combatLog,
                    createLogEntry("round-start", updatedEncounter.round, `${monster.name} hesitates.`, monsterId),
                ],
            };
            break;
        }
    }
    const result = {
        monsterId,
        monsterName: monster.name,
        decision,
        fled,
    };
    if (attackResult) {
        result.attackResult = attackResult;
    }
    return {
        encounter: updatedEncounter,
        result,
    };
}
/**
 * Process all pending monster turns until it's a player's turn or combat ends
 */
export function processAllMonsterTurns(encounter, roller) {
    const results = [];
    let current = encounter;
    let iterations = 0;
    const maxIterations = 100; // Safety limit
    while (iterations < maxIterations) {
        // Check if combat ended
        const endCheck = checkCombatEnd(current);
        if (endCheck.ended) {
            break;
        }
        // Get current turn combatant
        const currentCombatant = getCurrentTurnCombatant(current);
        if (!currentCombatant) {
            break;
        }
        // If it's a player's turn, stop
        if (currentCombatant.type === "player") {
            break;
        }
        // Process monster turn
        const turnResult = processMonsterTurn(current, currentCombatant.combatantId, roller);
        current = turnResult.encounter;
        results.push(turnResult.result);
        // Advance turn
        current = advanceTurn(current);
        iterations++;
    }
    return { encounter: current, results };
}
//# sourceMappingURL=encounter-engine.js.map