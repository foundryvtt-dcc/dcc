/* global foundry, Hooks */
/**
 * Data model for Player actors
 * Players use all class templates merged together:
 * common, config, player, cleric, thief, warrior, wizard, dwarf, elf.
 * Class-specific fields (starting with halfling's `sneakAndHide` as of
 * Phase 4 session 1) are contributed via the `game.dcc.registerClassMixin`
 * registry instead of living in the static schema body — see
 * `applyClassMixins` below and `docs/dev/EXTENSION_API.md`.
 */
import { BaseActorData } from './base-actor.mjs'
import { isValidDiceNotation, migrateFieldsToInteger } from '../fields/_module.mjs'
import { applyClassMixins } from '../../extension-api.mjs'

const { SchemaField, StringField, NumberField, BooleanField, HTMLField } = foundry.data.fields

export class PlayerData extends BaseActorData {
  /**
   * Migrate source data to handle legacy formats
   * @param {object} source - Raw source data
   * @returns {object} - Migrated data
   */
  static migrateData (source) {
    // Handle any missing skills structure
    if (!source.skills) {
      source.skills = {}
    }

    // Ensure detectSecretDoors has ability field for backwards compatibility
    if (source.skills.detectSecretDoors && !('ability' in source.skills.detectSecretDoors)) {
      source.skills.detectSecretDoors.ability = ''
    }

    // Fix invalid dice notation in skills
    // "0" or other non-dice values should become empty or default
    if (source.skills?.castSpellFromScroll?.die) {
      if (!isValidDiceNotation(source.skills.castSpellFromScroll.die)) {
        source.skills.castSpellFromScroll.die = '1d10' // default value
      }
    }
    if (source.skills?.shieldBash?.die) {
      if (!isValidDiceNotation(source.skills.shieldBash.die)) {
        source.skills.shieldBash.die = '1d14' // default value
      }
    }

    // Convert class numeric fields from strings to integers
    migrateFieldsToInteger(source.class, [
      'spellCheck', 'spellsLevel1', 'spellsLevel2', 'spellsLevel3',
      'spellsLevel4', 'spellsLevel5', 'knownSpells', 'maxSpellLevel'
    ], { spellCheck: 1 })

    // Convert cleric skill values from strings to integers
    migrateFieldsToInteger(source.skills?.divineAid, ['value', 'drainDisapproval'], { drainDisapproval: 10 })
    migrateFieldsToInteger(source.skills?.turnUnholy, ['value'], 0)
    migrateFieldsToInteger(source.skills?.layOnHands, ['value'], 0)

    return super.migrateData(source)
  }

  static defineSchema () {
    const schema = {
      ...super.defineSchema(),

      // Class information
      class: new SchemaField({
        className: new StringField({ initial: 'Zero-Level' }),

        // Cleric fields
        spellCheck: new NumberField({ initial: 1, integer: true }),
        spellCheckAbility: new StringField({ initial: 'per' }),
        spellsLevel1: new NumberField({ initial: 0, integer: true, min: 0 }),
        spellsLevel2: new NumberField({ initial: 0, integer: true, min: 0 }),
        spellsLevel3: new NumberField({ initial: 0, integer: true, min: 0 }),
        spellsLevel4: new NumberField({ initial: 0, integer: true, min: 0 }),
        spellsLevel5: new NumberField({ initial: 0, integer: true, min: 0 }),
        deity: new StringField({ nullable: true, initial: null }),
        disapproval: new NumberField({ initial: 1, integer: true, min: 1, max: 20 }),
        disapprovalTable: new StringField({ initial: 'Disapproval' }),

        // Warrior fields
        luckyWeapon: new StringField({ nullable: true, initial: null }),
        luckyWeaponMod: new StringField({ initial: '+0' }),

        // Wizard fields
        knownSpells: new NumberField({ initial: 0, integer: true, min: 0 }),
        maxSpellLevel: new NumberField({ initial: 0, integer: true, min: 0 }),
        spellCheckOtherMod: new StringField({ nullable: true, initial: null }),
        spellCheckDieOverride: new StringField({ nullable: true, initial: null }),
        spellCheckOverride: new StringField({ nullable: true, initial: null }),
        patron: new StringField({ nullable: true, initial: null }),
        patronTaintChance: new StringField({ initial: '1%' }),
        familiar: new StringField({ nullable: true, initial: null }),
        corruption: new HTMLField({ initial: '' })
      }),

      // Skills - all class skills in one place
      skills: new SchemaField({
        // Player skill (from player template)
        // Note: Elf template overrides with label=DCC.HeightenedSenses, ability=int, value=+4
        detectSecretDoors: new SchemaField({
          label: new StringField({ initial: 'DCC.DetectSecretDoors' }),
          ability: new StringField({ initial: '' }), // Empty for non-Elf, 'int' for Elf
          value: new StringField({ initial: '+0' })
        }),

        // Cleric skills
        divineAid: new SchemaField({
          label: new StringField({ initial: 'DCC.DivineAid' }),
          value: new NumberField({ initial: 0, integer: true }),
          useDisapprovalRange: new BooleanField({ initial: true }),
          drainDisapproval: new NumberField({ initial: 10, integer: true })
        }),
        turnUnholy: new SchemaField({
          label: new StringField({ initial: 'DCC.TurnUnholy' }),
          value: new NumberField({ initial: 0, integer: true }),
          useDisapprovalRange: new BooleanField({ initial: true })
        }),
        layOnHands: new SchemaField({
          label: new StringField({ initial: 'DCC.LayOnHands' }),
          value: new NumberField({ initial: 0, integer: true }),
          useDisapprovalRange: new BooleanField({ initial: true })
        })

        // Thief skills (sneakSilently / hideInShadows / pickPockets /
        // climbSheerSurfaces / pickLock / findTrap / disableTrap /
        // forgeDocument / disguiseSelf / readLanguages / handlePoison /
        // castSpellFromScroll) + Thief class fields (luckDie / backstab)
        // + Halfling skills (`skills.sneakAndHide`) + Dwarf skills
        // (`skills.shieldBash`) contributed via the `'thief'` /
        // `'halfling'` / `'dwarf'` entries in `CONFIG.DCC.classMixins`
        // — see `module/dcc.js`'s built-in registrations. Phase 4
        // sessions 1 / 2 / 3 relocations — keep the Foundry-smelling
        // shapes intact while moving source-of-truth onto the
        // per-class registry.
      }),

      // Configuration (from config template)
      config: new SchemaField({
        attackBonusMode: new StringField({ initial: 'flat' }),
        actionDice: new StringField({ initial: '1d20' }), // Can be comma-separated like "1d20,1d14"
        addClassLevelToInitiative: new BooleanField({ initial: false }),
        maxLevel: new StringField({ initial: '' }),
        rollAttackBonus: new BooleanField({ initial: false }),
        computeAC: new BooleanField({ initial: true }),
        baseACAbility: new StringField({ initial: 'agl' }),
        computeSpeed: new BooleanField({ initial: true }),
        computeCheckPenalty: new BooleanField({ initial: true }),
        computeInitiative: new BooleanField({ initial: true }),
        computeMeleeAndMissileAttackAndDamage: new BooleanField({ initial: true }),
        computeSavingThrows: new BooleanField({ initial: true }),
        sortInventory: new BooleanField({ initial: true }),
        removeEmptyItems: new BooleanField({ initial: true }),
        showSpells: new BooleanField({ initial: false }),
        showSkills: new BooleanField({ initial: false }),
        showBackstab: new BooleanField({ initial: false }),
        showSwimFlySpeed: new BooleanField({ initial: false })
      })
    }

    /**
     * Apply registered class mixins BEFORE the public extension hook
     * fires so `dcc.definePlayerSchema` handlers can observe (and
     * further mutate) mixin-contributed fields. Order within the
     * registry is deterministic (sorted classId keys) — see
     * `applyClassMixins`.
     */
    applyClassMixins(schema)

    /**
     * Allow modules to extend the Player schema by adding fields to existing SchemaFields
     * or adding entirely new top-level fields.
     *
     * @example
     * // In your module's init hook:
     * Hooks.on('dcc.definePlayerSchema', (schema) => {
     *   // Add a new field to the class SchemaField
     *   schema.class.fields.myCustomField = new foundry.data.fields.StringField({ initial: '' })
     *
     *   // Add a new field to details
     *   schema.details.fields.sheetClass = new foundry.data.fields.StringField({ initial: '' })
     *
     *   // Add an entirely new top-level SchemaField
     *   schema.rewards = new foundry.data.fields.SchemaField({
     *     fame: new foundry.data.fields.NumberField({ initial: 0 }),
     *     wealth: new foundry.data.fields.NumberField({ initial: 0 })
     *   })
     * })
     */
    Hooks.callAll('dcc.definePlayerSchema', schema)

    return schema
  }
}
