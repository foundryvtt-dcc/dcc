// DCC Active Effect attribute-key reference table.
//
// Extracted from `module/config.js` (Phase 7 — Appendix-A config.js
// shrinkage arc). Maps common `system.*` Active-Effect target paths onto
// their i18n label keys. Re-composed onto `DCC` by `config.js`, so the
// public `CONFIG.DCC.activeEffectKeys` surface is unchanged.
//
// NOTE: this table currently has no runtime code consumer (added in PR #611;
// the V14 AE workflow uses Foundry's native config UI). It's retained as a
// documented `CONFIG.DCC.*` reference surface — the human-facing counterpart
// is `docs/user-guide/Active-Effects.md`. Whether to deprecate/remove it is a
// separate decision, deliberately deferred (see the Appendix-A arc notes).
// Pure data — no behavior lives here.

/**
 * Active Effect Attribute Keys
 * Common paths for modifying actor data via Active Effects
 * @type {Object}
 */
export const activeEffectKeys = {
  // Abilities
  'system.abilities.str.value': 'DCC.AbilityStr',
  'system.abilities.str.max': 'DCC.AbilityStrMax',
  'system.abilities.agl.value': 'DCC.AbilityAgl',
  'system.abilities.agl.max': 'DCC.AbilityAglMax',
  'system.abilities.sta.value': 'DCC.AbilitySta',
  'system.abilities.sta.max': 'DCC.AbilityStaMax',
  'system.abilities.per.value': 'DCC.AbilityPer',
  'system.abilities.per.max': 'DCC.AbilityPerMax',
  'system.abilities.int.value': 'DCC.AbilityInt',
  'system.abilities.int.max': 'DCC.AbilityIntMax',
  'system.abilities.lck.value': 'DCC.AbilityLck',
  'system.abilities.lck.max': 'DCC.AbilityLckMax',

  // Combat Attributes
  'system.attributes.ac.value': 'DCC.ArmorClass',
  'system.attributes.ac.otherMod': 'DCC.ACOtherMod',
  'system.attributes.hp.value': 'DCC.HitPoints',
  'system.attributes.hp.max': 'DCC.HitPointsMax',
  'system.attributes.hp.temp': 'DCC.HitPointsTemp',
  'system.attributes.speed.value': 'DCC.Speed',
  'system.attributes.init.value': 'DCC.Initiative',
  'system.attributes.init.otherMod': 'DCC.InitiativeOtherMod',

  // Attack and Damage Bonuses
  'system.details.attackHitBonus.melee.adjustment': 'DCC.MeleeAttackBonus',
  'system.details.attackDamageBonus.melee.adjustment': 'DCC.MeleeDamageBonus',
  'system.details.attackHitBonus.missile.adjustment': 'DCC.MissileAttackBonus',
  'system.details.attackDamageBonus.missile.adjustment': 'DCC.MissileDamageBonus',

  // Saving Throws
  'system.saves.frt.otherBonus': 'DCC.SavesFortitudeBonus',
  'system.saves.ref.otherBonus': 'DCC.SavesReflexBonus',
  'system.saves.wil.otherBonus': 'DCC.SavesWillBonus',

  // Class-specific
  'system.class.spellCheckOtherMod': 'DCC.SpellCheckBonus',
  'system.class.luckDie': 'DCC.LuckDie',
  'system.attributes.critical.die': 'DCC.CriticalDie',
  'system.attributes.fumble.die': 'DCC.FumbleDie',

  // Dice Chain Adjustable (add/subtract auto-detects dice expressions)
  'system.attributes.actionDice.value': 'DCC.ActionDie'
}
