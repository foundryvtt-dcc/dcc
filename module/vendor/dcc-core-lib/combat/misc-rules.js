/**
 * Miscellaneous Combat Rules
 *
 * Implements various DCC combat rules including:
 * - Ability loss effects (when abilities reach 0)
 * - Catching fire
 * - Charge attacks
 * - Dropping torches
 * - Falling damage
 * - Firing into melee
 * - Grappling
 * - Recovering armor and missile weapons
 * - Subdual damage
 * - Unarmed combat
 */
import { evaluateRoll } from "../dice/roll.js";
import { bumpDie } from "../dice/dice-chain.js";
// =============================================================================
// Ability Loss
// =============================================================================
/**
 * Get the effect of an ability being reduced to 0
 *
 * @param ability - The ability at 0
 * @returns The effect on the character
 */
export function getAbilityLossEffect(ability) {
    switch (ability) {
        case "per":
            return {
                ability,
                effect: "babbling-idiot",
                description: "Babbling idiot incapable of communication",
                incapacitated: true,
            };
        case "int":
            return {
                ability,
                effect: "babbling-idiot",
                description: "Babbling idiot incapable of feeding themselves",
                incapacitated: true,
            };
        case "str":
            return {
                ability,
                effect: "immobile",
                description: "Incapable of movement due to muscle failure",
                incapacitated: true,
            };
        case "agl":
            return {
                ability,
                effect: "immobile",
                description: "Incapable of movement due to loss of coordination",
                incapacitated: true,
            };
        case "sta":
            return {
                ability,
                effect: "unconscious",
                description: "Faints and remains unconscious",
                incapacitated: true,
            };
        case "lck":
            return {
                ability,
                effect: "constant-mishaps",
                description: "Suffers constant bizarre mishaps, effectively unable to accomplish anything",
                incapacitated: true,
            };
    }
}
/**
 * Check all abilities for zero values and return effects
 *
 * @param abilities - Record of ability scores
 * @returns Array of ability loss effects (empty if none at 0)
 */
export function checkAbilityLoss(abilities) {
    const results = [];
    for (const [ability, score] of Object.entries(abilities)) {
        if (score <= 0) {
            results.push(getAbilityLossEffect(ability));
        }
    }
    return results;
}
// =============================================================================
// Catching Fire
// =============================================================================
/**
 * Create initial on-fire state
 *
 * @param options - Optional configuration
 * @returns Fire state
 */
export function createOnFireState(options) {
    return {
        damageDie: options?.damageDie ?? "1d6",
        extinguishDC: options?.extinguishDC ?? 10,
        roundsOnFire: 0,
        source: options?.source,
    };
}
/**
 * Process a round of being on fire
 *
 * @param state - Current fire state
 * @param attemptExtinguish - Whether character spends action to stop/drop/roll
 * @param reflexSave - Character's Reflex save bonus
 * @param roller - Dice roller
 * @returns Fire damage result
 */
export function processFireRound(state, attemptExtinguish, reflexSave, roller) {
    // Roll fire damage
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const damageResult = evaluateRoll(state.damageDie, rollOptions);
    const damage = damageResult.total ?? 0;
    const result = {
        damage,
        attemptedExtinguish: attemptExtinguish,
        extinguished: false,
    };
    // If attempting to put out fire
    if (attemptExtinguish) {
        const saveResult = evaluateRoll("1d20", rollOptions);
        const reflexRoll = saveResult.total ?? 10;
        result.reflexRoll = reflexRoll;
        const total = reflexRoll + reflexSave;
        if (total >= state.extinguishDC) {
            result.extinguished = true;
            return result;
        }
    }
    // Fire continues
    result.newState = {
        ...state,
        roundsOnFire: state.roundsOnFire + 1,
    };
    return result;
}
// =============================================================================
// Charge
// =============================================================================
/**
 * Get charge attack modifiers
 *
 * @param speed - Character's movement speed
 * @returns Charge modifiers
 */
export function getChargeModifiers(speed) {
    return {
        attackBonus: 2,
        acPenalty: -2,
        minDistance: Math.floor(speed / 2),
    };
}
/**
 * Check if a charge is valid
 *
 * @param distanceMoved - Distance moved this turn
 * @param speed - Character's movement speed
 * @returns Whether the charge is valid
 */
export function isValidCharge(distanceMoved, speed) {
    return distanceMoved >= Math.floor(speed / 2);
}
// =============================================================================
// Dropping Torch
// =============================================================================
/**
 * Check if a dropped torch is extinguished
 *
 * @param roller - Dice roller
 * @returns Whether the torch went out
 */
export function checkDroppedTorch(roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const result = evaluateRoll("1d100", rollOptions);
    const roll = result.total ?? 50;
    return {
        extinguished: roll <= 50,
        roll,
    };
}
// =============================================================================
// Falling Damage
// =============================================================================
/**
 * Calculate falling damage
 *
 * @param distanceFeet - Distance fallen in feet
 * @param roller - Dice roller
 * @returns Falling damage result
 */
export function calculateFallingDamage(distanceFeet, roller) {
    const numDice = Math.floor(distanceFeet / 10);
    if (numDice <= 0) {
        return {
            damage: 0,
            diceResults: [],
            brokenBones: 0,
            distanceFallen: distanceFeet,
            permanentLoss: 0,
        };
    }
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const diceResults = [];
    let brokenBones = 0;
    for (let i = 0; i < numDice; i++) {
        const dieResult = evaluateRoll("1d6", rollOptions);
        const value = dieResult.total ?? 1;
        diceResults.push(value);
        if (value === 6) {
            brokenBones++;
        }
    }
    const damage = diceResults.reduce((sum, d) => sum + d, 0);
    return {
        damage,
        diceResults,
        brokenBones,
        distanceFallen: distanceFeet,
        permanentLoss: brokenBones, // Each broken bone = -1 STR or AGL (player's choice)
    };
}
// =============================================================================
// Firing Into Melee
// =============================================================================
/**
 * Check if a missed ranged attack hits an ally in melee
 *
 * @param numAlliesInMelee - Number of allies engaged with the target
 * @param allyACs - Array of ally armor classes
 * @param attackRoll - The original attack roll (to re-roll against ally)
 * @param attackBonus - Attacker's bonus
 * @param roller - Dice roller
 * @returns Result of firing into melee
 */
export function checkFiringIntoMelee(numAlliesInMelee, allyACs, attackBonus, roller) {
    if (numAlliesInMelee <= 0 || allyACs.length === 0) {
        return {
            hitAlly: false,
            chanceRoll: 0,
        };
    }
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    // 50% chance to hit ally
    const chanceResult = evaluateRoll("1d100", rollOptions);
    const chanceRoll = chanceResult.total ?? 50;
    if (chanceRoll > 50) {
        return {
            hitAlly: false,
            chanceRoll,
        };
    }
    // Determine which ally (randomly)
    const allyIndexResult = evaluateRoll(`1d${String(numAlliesInMelee)}`, rollOptions);
    const allyIndex = (allyIndexResult.total ?? 1) - 1;
    // Re-roll attack against ally's AC
    const attackResult = evaluateRoll("1d20", rollOptions);
    const allyAttackRoll = (attackResult.total ?? 10) + attackBonus;
    const allyAC = allyACs[allyIndex] ?? 10;
    const allyWasHit = allyAttackRoll >= allyAC;
    return {
        hitAlly: true,
        chanceRoll,
        allyIndex,
        allyAttackRoll,
        allyWasHit,
    };
}
// =============================================================================
// Grappling
// =============================================================================
/**
 * Calculate size bonus for grappling
 *
 * @param attackerSize - Attacker's size category
 * @param defenderSize - Defender's size category
 * @returns Bonus to attacker's grapple check
 */
export function getGrappleSizeBonus(attackerSize, defenderSize) {
    const sizeRatio = attackerSize / defenderSize;
    if (sizeRatio >= 4)
        return 16;
    if (sizeRatio >= 3)
        return 8;
    if (sizeRatio >= 2)
        return 4;
    return 0;
}
/**
 * Get the grapple modifier for a participant
 *
 * @param participant - Grapple participant
 * @returns The modifier to use (higher of STR/AGL, or HD for monsters)
 */
export function getGrappleModifier(participant) {
    if (participant.hitDice !== undefined) {
        return participant.hitDice;
    }
    return Math.max(participant.strengthMod, participant.agilityMod);
}
/**
 * Resolve a grapple attempt
 *
 * @param attacker - Attacker's stats
 * @param defender - Defender's stats
 * @param roller - Dice roller
 * @returns Grapple result
 */
export function resolveGrapple(attacker, defender, roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const modifiers = [];
    // Roll attacks
    const attackerRollResult = evaluateRoll("1d20", rollOptions);
    const defenderRollResult = evaluateRoll("1d20", rollOptions);
    const attackerRoll = attackerRollResult.total ?? 10;
    const defenderRoll = defenderRollResult.total ?? 10;
    // Calculate modifiers
    const attackerMod = getGrappleModifier(attacker);
    const defenderMod = getGrappleModifier(defender);
    modifiers.push({
        source: "ability",
        value: attackerMod,
        label: attacker.hitDice !== undefined ? "Hit Dice" : "STR/AGL",
    });
    // Attack bonus
    let attackerBonus = attacker.attackBonus + attackerMod;
    // Size bonus
    const sizeBonus = getGrappleSizeBonus(attacker.sizeCategory, defender.sizeCategory);
    if (sizeBonus > 0) {
        attackerBonus += sizeBonus;
        modifiers.push({
            source: "size",
            value: sizeBonus,
            label: "Size advantage",
        });
    }
    const attackerTotal = attackerRoll + attackerBonus;
    const defenderTotal = defenderRoll + defender.attackBonus + defenderMod;
    const attackerWins = attackerTotal > defenderTotal;
    return {
        attackerRoll,
        attackerTotal,
        defenderRoll,
        defenderTotal,
        attackerWins,
        targetPinned: attackerWins,
        modifiers,
    };
}
// =============================================================================
// Recovering Equipment
// =============================================================================
/**
 * Check if armor recovered from a fallen foe is usable
 *
 * @param checkHumanSized - Whether to also check if armor is human-sized
 * @param roller - Dice roller
 * @returns Armor recovery result
 */
export function checkArmorRecovery(checkHumanSized = false, roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    // 25% chance armor is useless
    const usableResult = evaluateRoll("1d100", rollOptions);
    const roll = usableResult.total ?? 50;
    const usable = roll > 25;
    const result = {
        usable,
        roll,
    };
    if (!usable) {
        result.repairCostFraction = 0.25 + Math.random() * 0.25; // 25-50% of original cost
    }
    // Check if human-sized
    if (checkHumanSized) {
        const sizeResult = evaluateRoll("1d100", rollOptions);
        const sizeRoll = sizeResult.total ?? 50;
        result.humanSized = sizeRoll <= 75; // 75% chance human-sized
    }
    return result;
}
/**
 * Check recovery of missile weapons
 *
 * @param numMissiles - Number of missiles to recover
 * @param roller - Dice roller
 * @returns Missile recovery result
 */
export function checkMissileRecovery(numMissiles, roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const rolls = [];
    let recovered = 0;
    let destroyed = 0;
    for (let i = 0; i < numMissiles; i++) {
        const result = evaluateRoll("1d100", rollOptions);
        const roll = result.total ?? 50;
        const isDestroyed = roll <= 50;
        rolls.push({ roll, destroyed: isDestroyed });
        if (isDestroyed) {
            destroyed++;
        }
        else {
            recovered++;
        }
    }
    return {
        recovered,
        destroyed,
        rolls,
    };
}
// =============================================================================
// Subdual Damage
// =============================================================================
/**
 * Weapons that can deal subdual damage when the user is proficient
 */
export const SUBDUAL_CAPABLE_WEAPONS = [
    "sword",
    "longsword",
    "short sword",
    "two-handed sword",
    "axe",
    "battle axe",
    "hand axe",
    "club",
    "spear",
    "staff",
    "quarterstaff",
];
/**
 * Check if a weapon can deal subdual damage
 *
 * @param weaponName - Name of the weapon
 * @returns Whether the weapon can deal subdual damage
 */
export function canDealSubdualDamage(weaponName) {
    const normalized = weaponName.toLowerCase();
    return SUBDUAL_CAPABLE_WEAPONS.some(w => normalized.includes(w));
}
/**
 * Calculate subdual damage (one die step lower)
 *
 * @param weaponDie - Normal weapon damage die
 * @param strengthMod - Strength modifier
 * @param roller - Dice roller
 * @returns Subdual damage result
 */
export function rollSubdualDamage(weaponDie, strengthMod, roller) {
    // Step down the die by one on the dice chain
    const subdualDie = bumpDie(weaponDie, -1);
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const result = evaluateRoll(subdualDie, rollOptions);
    const baseDamage = result.total ?? 1;
    const damage = Math.max(1, baseDamage + strengthMod);
    return {
        damageDie: subdualDie,
        damage,
        isSubdual: true,
        originalDie: weaponDie,
    };
}
/**
 * Roll unarmed combat damage (always subdual)
 *
 * @param strengthMod - Strength modifier
 * @param roller - Dice roller
 * @returns Subdual damage result
 */
export function rollUnarmedDamage(strengthMod, roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const result = evaluateRoll("1d3", rollOptions);
    const baseDamage = result.total ?? 1;
    const damage = Math.max(1, baseDamage + strengthMod);
    return {
        damageDie: "1d3",
        damage,
        isSubdual: true,
        originalDie: "1d3",
    };
}
// =============================================================================
// Melee Against Grappled
// =============================================================================
/**
 * Check if a missed melee attack against a grappled creature hits the grappler
 *
 * @param grapplerAC - AC of the ally maintaining the pin
 * @param attackBonus - Attacker's bonus
 * @param roller - Dice roller
 * @returns Result similar to firing into melee
 */
export function checkMeleeAgainstGrappled(grapplerAC, attackBonus, roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    // 50% chance to hit the grappler
    const chanceResult = evaluateRoll("1d100", rollOptions);
    const chanceRoll = chanceResult.total ?? 50;
    if (chanceRoll > 50) {
        return {
            hitAlly: false,
            chanceRoll,
        };
    }
    // Re-roll attack against grappler's AC
    const attackResult = evaluateRoll("1d20", rollOptions);
    const allyAttackRoll = (attackResult.total ?? 10) + attackBonus;
    const allyWasHit = allyAttackRoll >= grapplerAC;
    return {
        hitAlly: true,
        chanceRoll,
        allyIndex: 0, // Only one grappler
        allyAttackRoll,
        allyWasHit,
    };
}
/**
 * Process a withdrawal from melee combat
 *
 * When a character withdraws from an active melee, all engaged opponents
 * receive a single free attack against them.
 *
 * @param withdrawingAC - AC of the withdrawing character
 * @param opponents - Array of opponents engaged in melee
 * @param roller - Dice roller
 * @returns Withdrawal result with all attack of opportunity results
 */
export function processWithdrawal(withdrawingAC, opponents, roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    const attacks = [];
    let totalDamage = 0;
    for (const opponent of opponents) {
        // Roll attack
        const attackResult = evaluateRoll("1d20", rollOptions);
        const attackRoll = attackResult.total ?? 10;
        const attackTotal = attackRoll + opponent.attackBonus;
        const hit = attackTotal >= withdrawingAC;
        const attack = {
            opponentName: opponent.name,
            attackRoll,
            attackTotal,
            hit,
        };
        // Roll damage if hit
        if (hit) {
            const damageResult = evaluateRoll(opponent.damageDie, rollOptions);
            const baseDamage = damageResult.total ?? 1;
            const damage = Math.max(1, baseDamage + opponent.strengthMod);
            attack.damage = damage;
            totalDamage += damage;
        }
        attacks.push(attack);
    }
    return {
        numOpponents: opponents.length,
        attacks,
        totalDamage,
    };
}
/**
 * Check if a character is engaged in melee (for UI purposes)
 *
 * @param numAdjacentEnemies - Number of enemies in melee range
 * @returns Whether the character is engaged
 */
export function isEngagedInMelee(numAdjacentEnemies) {
    return numAdjacentEnemies > 0;
}
/**
 * Format withdrawal result for display
 */
export function formatWithdrawalResult(result) {
    if (result.numOpponents === 0) {
        return "Withdraws safely (not engaged in melee)";
    }
    const attackDescriptions = result.attacks.map(a => {
        if (a.hit) {
            return `${a.opponentName}: ${String(a.attackTotal)} - HIT for ${String(a.damage)} damage`;
        }
        return `${a.opponentName}: ${String(a.attackTotal)} - miss`;
    });
    const header = result.numOpponents === 1
        ? "Withdrawal triggers 1 attack of opportunity:"
        : `Withdrawal triggers ${String(result.numOpponents)} attacks of opportunity:`;
    return `${header}\n${attackDescriptions.join("\n")}\nTotal damage: ${String(result.totalDamage)}`;
}
/**
 * Create initial mount state
 *
 * @param horseType - Type of horse
 * @param maxHP - Horse's max HP
 * @param options - Optional overrides
 * @returns Mount state
 */
export function createMountState(horseType, maxHP, options) {
    const isWarhorse = horseType === "warhorse";
    // Default stats by horse type
    const defaults = {
        "warhorse": { speed: 50, ac: 13, initMod: 0 },
        "riding-horse": { speed: 60, ac: 12, initMod: 1 },
        "draft-horse": { speed: 40, ac: 11, initMod: -1 },
        "pony": { speed: 40, ac: 12, initMod: 0 },
    };
    const typeDefaults = defaults[horseType];
    return {
        horseType,
        combatTrained: isWarhorse,
        currentHP: maxHP,
        maxHP,
        halfHPChecked: false,
        initiativeMod: options?.initiativeMod ?? typeDefaults.initMod,
        speed: options?.speed ?? typeDefaults.speed,
        ac: options?.ac ?? typeDefaults.ac,
        attackBonus: isWarhorse ? (options?.attackBonus ?? 2) : undefined,
        damageDie: isWarhorse ? (options?.damageDie ?? "1d6") : undefined,
    };
}
/**
 * Get mounted combat bonuses
 *
 * @param isCharging - Whether the rider is charging
 * @param hasLanceOrSpear - Whether wielding a lance or spear
 * @returns Combat bonuses
 */
export function getMountedCombatBonuses(isCharging = false, hasLanceOrSpear = false) {
    return {
        acBonus: 1,
        attackBonusVsUnmounted: 1,
        lanceDamageDoubled: isCharging && hasLanceOrSpear,
    };
}
/**
 * Calculate mounted initiative modifier
 *
 * Uses the worse (lower) of rider and mount initiative modifiers
 *
 * @param riderInitMod - Rider's initiative modifier
 * @param mountInitMod - Mount's initiative modifier
 * @returns The worse of the two modifiers
 */
export function getMountedInitiativeModifier(riderInitMod, mountInitMod) {
    return Math.min(riderInitMod, mountInitMod);
}
/**
 * Check if a horse is spooked by damage
 *
 * - Warhorses: only spooked when first dropping below half HP
 * - Other horses: spooked any time they suffer a wound
 *
 * @param mount - Current mount state
 * @param damageDealt - Damage just dealt to the horse
 * @returns Spook check result and updated mount state
 */
export function checkHorseSpooked(mount, damageDealt) {
    const newHP = mount.currentHP - damageDealt;
    const halfHP = Math.floor(mount.maxHP / 2);
    const isWarhorse = mount.horseType === "warhorse";
    // Update mount state
    const newState = {
        ...mount,
        currentHP: Math.max(0, newHP),
    };
    // Warhorse: only spooked when first dropping below half HP
    if (isWarhorse) {
        const wasAboveHalf = mount.currentHP > halfHP;
        const nowAtOrBelowHalf = newHP <= halfHP;
        if (wasAboveHalf && nowAtOrBelowHalf && !mount.halfHPChecked) {
            newState.halfHPChecked = true;
            return {
                result: {
                    spooked: true,
                    reason: "Warhorse dropped below half HP for the first time",
                    requiresStayMountedCheck: true,
                },
                newState,
            };
        }
        return {
            result: {
                spooked: false,
                reason: mount.halfHPChecked
                    ? "Warhorse already checked for half HP"
                    : "Warhorse not yet at half HP",
                requiresStayMountedCheck: false,
            },
            newState,
        };
    }
    // Normal horses: spooked any time they take damage
    if (damageDealt > 0) {
        return {
            result: {
                spooked: true,
                reason: "Horse wounded (non-warhorse spooked by any wound)",
                requiresStayMountedCheck: true,
            },
            newState,
        };
    }
    return {
        result: {
            spooked: false,
            reason: "No damage dealt",
            requiresStayMountedCheck: false,
        },
        newState,
    };
}
/**
 * Check if a horse is spooked by an untrained horse attacking
 *
 * @param mount - Mount state
 * @returns Whether a stay mounted check is required
 */
export function checkHorseAttackSpook(mount) {
    if (mount.combatTrained) {
        return {
            spooked: false,
            reason: "Combat-trained horse can attack without spooking",
            requiresStayMountedCheck: false,
        };
    }
    return {
        spooked: true,
        reason: "Untrained horse attacking causes rider check",
        requiresStayMountedCheck: true,
    };
}
/**
 * Make a stay mounted check
 *
 * @param agilityScore - Rider's Agility score
 * @param isTrained - Whether rider is trained in horsemanship
 * @param reason - Why the check is being made
 * @param dc - DC to beat (default 10)
 * @param roller - Dice roller
 * @returns Stay mounted result
 */
export function makeStayMountedCheck(agilityScore, isTrained, reason, dc = 10, roller) {
    const rollOptions = roller !== undefined
        ? { mode: "evaluate", roller }
        : { mode: "evaluate" };
    // Trained riders roll d20, untrained roll d10
    const dieUsed = isTrained ? "1d20" : "1d10";
    const rollResult = evaluateRoll(dieUsed, rollOptions);
    const roll = rollResult.total ?? (isTrained ? 10 : 5);
    // Add Agility modifier (calculated from score)
    const agilityMod = Math.floor((agilityScore - 10) / 2);
    const total = roll + agilityMod;
    const stayedMounted = total >= dc;
    return {
        dieUsed,
        roll: total, // Total including modifier
        dc,
        stayedMounted,
        isProne: !stayedMounted,
        reason,
    };
}
/**
 * Check if a weapon is a lance or spear (for mounted charge damage)
 *
 * @param weaponName - Name of the weapon
 * @returns Whether it's a lance or spear
 */
export function isLanceOrSpear(weaponName) {
    const normalized = weaponName.toLowerCase();
    return normalized.includes("lance") || normalized.includes("spear") || normalized.includes("javelin");
}
/**
 * Calculate mounted charge damage multiplier
 *
 * @param isCharging - Whether mounted and charging
 * @param weaponName - Name of weapon being used
 * @returns Damage multiplier (2 for lance/spear charge, 1 otherwise)
 */
export function getMountedChargeDamageMultiplier(isCharging, weaponName) {
    if (isCharging && isLanceOrSpear(weaponName)) {
        return 2;
    }
    return 1;
}
/**
 * Format stay mounted result for display
 */
export function formatStayMountedResult(result) {
    const dieType = result.dieUsed === "1d20" ? "trained" : "untrained";
    const outcome = result.stayedMounted
        ? "STAYS MOUNTED"
        : "THROWN FROM HORSE - prone, must spend next round standing";
    return `Stay Mounted (${dieType}, ${result.dieUsed}): ${String(result.roll)} vs DC ${String(result.dc)} - ${outcome}`;
}
/**
 * Format mounted combat bonuses for display
 */
export function formatMountedBonuses(bonuses) {
    const parts = [];
    parts.push(`+${String(bonuses.acBonus)} AC`);
    parts.push(`+${String(bonuses.attackBonusVsUnmounted)} attack vs unmounted`);
    if (bonuses.lanceDamageDoubled) {
        parts.push("lance/spear damage doubled (charging)");
    }
    return `Mounted bonuses: ${parts.join(", ")}`;
}
// =============================================================================
// Formatting Helpers
// =============================================================================
/**
 * Format falling damage result for display
 */
export function formatFallingDamage(result) {
    if (result.damage === 0) {
        return "No falling damage (less than 10' fall)";
    }
    let text = `Falling ${String(result.distanceFallen)}': ${String(result.damage)} damage`;
    if (result.brokenBones > 0) {
        const boneText = result.brokenBones === 1 ? "1 broken bone" : `${String(result.brokenBones)} broken bones`;
        text += ` - ${boneText}! Permanent -${String(result.brokenBones)} STR or AGL (player's choice)`;
    }
    return text;
}
/**
 * Format grapple result for display
 */
export function formatGrappleResult(result, attackerName, defenderName) {
    const outcome = result.targetPinned
        ? `${attackerName} pins ${defenderName}!`
        : `${defenderName} resists the grapple!`;
    return `Grapple: ${attackerName} (${String(result.attackerTotal)}) vs ${defenderName} (${String(result.defenderTotal)}) - ${outcome}`;
}
//# sourceMappingURL=misc-rules.js.map