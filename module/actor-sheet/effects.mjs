/**
 * Active-effect summary builders for the DCC actor sheet.
 *
 * Phase 7 (Appendix-A actor-sheet.js shrinkage): the four AE summary builders
 * (`#prepareAbilityEffects` / `#prepareAttackBonusEffects` / `#prepareSaveEffects`
 * / `#prepareAttributeEffects`) were lifted out of `module/actor-sheet.js` into
 * this module as pure free functions. A sheet's `#private` methods cannot be
 * relocated to a mixin (private names are lexically class-scoped), so the
 * shrinkage shape here is **pure-logic → free function** taking the actor: the
 * sheet's `_prepareContext` now calls these directly.
 *
 * Each builder only ever read `this.options.document` (the actor) — no other
 * sheet state — so they extract cleanly. All four also repeated an identical
 * effect-collection block and an identical effect-info push shape; those are
 * deduplicated here into {@link collectTransferredActiveEffects} and the
 * internal `effectInfo`, so this extraction is also a (behavior-neutral)
 * de-duplication. The methods were `#private` and therefore had no prior unit
 * coverage; as free functions they are now directly testable.
 */

/**
 * Collect the active effects that apply to an actor for sheet display: enabled,
 * non-suppressed effects directly on the actor, plus enabled, non-suppressed,
 * *transferring* effects from its equipped items. (An item with no `equipped`
 * flag is treated as equipped, matching the pre-extraction behavior.)
 * @param {Actor} actor
 * @returns {ActiveEffect[]}
 */
export function collectTransferredActiveEffects (actor) {
  const allEffects = []

  // Effects directly on actor
  for (const effect of actor.effects) {
    if (!effect.disabled && !effect.isSuppressed) {
      allEffects.push(effect)
    }
  }

  // Effects from equipped items that transfer
  for (const item of actor.items) {
    const isEquipped = item.system?.equipped ?? true
    if (isEquipped) {
      for (const effect of item.effects) {
        if (!effect.disabled && !effect.isSuppressed && effect.transfer) {
          allEffects.push(effect)
        }
      }
    }
  }

  return allEffects
}

/**
 * The display shape stored for one effect → one change in a summary bucket.
 * @param {ActiveEffect} effect
 * @param {object} change - the matched `effect.changes[i]` entry
 * @returns {{id: string, name: string, img: string, value: *, type: *}}
 */
function effectInfo (effect, change) {
  return {
    id: effect.id,
    name: effect.name,
    img: effect.img || 'icons/svg/aura.svg',
    value: change.value,
    type: change.type
  }
}

/**
 * Push an effect into a summary bucket unless it is already present there
 * (dedup by effect id — a single effect can carry multiple matching changes).
 * @param {Array} bucket
 * @param {ActiveEffect} effect
 * @param {object} change
 */
function pushUnique (bucket, effect, change) {
  if (!bucket.find(e => e.id === effect.id)) {
    bucket.push(effectInfo(effect, change))
  }
}

/**
 * Collect active effects that modify abilities, keyed by ability id.
 * @param {Actor} actor
 * @returns {{str: Array, agl: Array, sta: Array, per: Array, int: Array, lck: Array}}
 */
export function prepareAbilityEffects (actor) {
  const abilityEffects = { str: [], agl: [], sta: [], per: [], int: [], lck: [] }

  for (const effect of collectTransferredActiveEffects(actor)) {
    if (!effect.changes) continue

    for (const change of effect.changes) {
      // Match patterns like system.abilities.str.value or system.abilities.str.mod
      const match = change.key.match(/^system\.abilities\.(\w+)\.(value|mod|max)$/)
      if (match) {
        const abilityId = match[1]
        if (abilityEffects[abilityId]) {
          pushUnique(abilityEffects[abilityId], effect, change)
        }
      }
    }
  }

  return abilityEffects
}

/**
 * Collect active effects that modify attack hit/damage bonuses, keyed by
 * bonus type (`meleeHit` / `meleeDamage` / `missileHit` / `missileDamage`).
 * @param {Actor} actor
 * @returns {{meleeHit: Array, meleeDamage: Array, missileHit: Array, missileDamage: Array}}
 */
export function prepareAttackBonusEffects (actor) {
  const attackBonusEffects = { meleeHit: [], meleeDamage: [], missileHit: [], missileDamage: [] }

  // Map from regex capture groups to effect keys
  const keyMap = {
    'attackHitBonus.melee': 'meleeHit',
    'attackHitBonus.missile': 'missileHit',
    'attackDamageBonus.melee': 'meleeDamage',
    'attackDamageBonus.missile': 'missileDamage'
  }

  for (const effect of collectTransferredActiveEffects(actor)) {
    if (!effect.changes) continue

    for (const change of effect.changes) {
      const match = change.key.match(/^system\.details\.(attackHitBonus|attackDamageBonus)\.(melee|missile)\.(adjustment|value)$/)
      if (match) {
        const effectKey = keyMap[`${match[1]}.${match[2]}`]
        if (effectKey) {
          pushUnique(attackBonusEffects[effectKey], effect, change)
        }
      }
    }
  }

  return attackBonusEffects
}

/**
 * Collect active effects that modify saving throws, keyed by save id
 * (`ref` / `frt` / `wil`).
 * @param {Actor} actor
 * @returns {{ref: Array, frt: Array, wil: Array}}
 */
export function prepareSaveEffects (actor) {
  const saveEffects = { ref: [], frt: [], wil: [] }

  for (const effect of collectTransferredActiveEffects(actor)) {
    if (!effect.changes) continue

    for (const change of effect.changes) {
      // Match patterns like system.saves.ref.otherBonus or system.saves.ref.value
      const match = change.key.match(/^system\.saves\.(\w+)\.(otherBonus|value)$/)
      if (match) {
        const saveId = match[1]
        if (saveEffects[saveId]) {
          pushUnique(saveEffects[saveId], effect, change)
        }
      }
    }
  }

  return saveEffects
}

/**
 * Collect active effects that modify AC and HP attributes.
 * @param {Actor} actor
 * @returns {{ac: Array, hp: Array}}
 */
export function prepareAttributeEffects (actor) {
  const attributeEffects = { ac: [], hp: [] }

  for (const effect of collectTransferredActiveEffects(actor)) {
    if (!effect.changes) continue

    for (const change of effect.changes) {
      const key = change.key
      // Match patterns for AC: system.attributes.ac.value, system.attributes.ac.otherMod
      if (key.match(/^system\.attributes\.ac\.(value|otherMod)$/)) {
        pushUnique(attributeEffects.ac, effect, change)
      }
      // Match patterns for HP: system.attributes.hp.value, system.attributes.hp.max, system.attributes.hp.temp
      if (key.match(/^system\.attributes\.hp\.(value|max|temp)$/)) {
        pushUnique(attributeEffects.hp, effect, change)
      }
    }
  }

  return attributeEffects
}
