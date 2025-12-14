/* global foundry, Hooks */
/**
 * Data model for Player actors
 * Players use all class templates merged together:
 * common, config, player, cleric, thief, halfling, warrior, wizard, dwarf, elf
 */
import { BaseActorData } from './base-actor.mjs'
import { DiceField, isValidDiceNotation, migrateFieldsToInteger } from '../fields/_module.mjs'

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

        // Thief fields
        luckDie: new DiceField({ initial: '1d3' }),
        backstab: new StringField({ initial: '0' }),

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
        }),

        // Thief skills
        sneakSilently: new SchemaField({
          label: new StringField({ initial: 'DCC.SneakSilently' }),
          ability: new StringField({ initial: 'agl' }),
          value: new StringField({ initial: '0' })
        }),
        hideInShadows: new SchemaField({
          label: new StringField({ initial: 'DCC.HideInShadows' }),
          ability: new StringField({ initial: 'agl' }),
          value: new StringField({ initial: '0' })
        }),
        pickPockets: new SchemaField({
          label: new StringField({ initial: 'DCC.PickPocket' }),
          ability: new StringField({ initial: 'agl' }),
          value: new StringField({ initial: '0' })
        }),
        climbSheerSurfaces: new SchemaField({
          label: new StringField({ initial: 'DCC.ClimbSheerSurfaces' }),
          ability: new StringField({ initial: 'agl' }),
          value: new StringField({ initial: '0' })
        }),
        pickLock: new SchemaField({
          label: new StringField({ initial: 'DCC.PickLock' }),
          ability: new StringField({ initial: 'agl' }),
          value: new StringField({ initial: '0' })
        }),
        findTrap: new SchemaField({
          label: new StringField({ initial: 'DCC.FindTrap' }),
          ability: new StringField({ initial: 'int' }),
          value: new StringField({ initial: '0' })
        }),
        disableTrap: new SchemaField({
          label: new StringField({ initial: 'DCC.DisableTrap' }),
          ability: new StringField({ initial: 'agl' }),
          value: new StringField({ initial: '0' })
        }),
        forgeDocument: new SchemaField({
          label: new StringField({ initial: 'DCC.ForgeDocument' }),
          ability: new StringField({ initial: 'agl' }),
          value: new StringField({ initial: '0' })
        }),
        disguiseSelf: new SchemaField({
          label: new StringField({ initial: 'DCC.DisguiseSelf' }),
          ability: new StringField({ initial: 'per' }),
          value: new StringField({ initial: '0' })
        }),
        readLanguages: new SchemaField({
          label: new StringField({ initial: 'DCC.ReadLanguages' }),
          ability: new StringField({ initial: 'int' }),
          value: new StringField({ initial: '0' })
        }),
        handlePoison: new SchemaField({
          label: new StringField({ initial: 'DCC.HandlePoison' }),
          value: new StringField({ initial: '0' })
        }),
        castSpellFromScroll: new SchemaField({
          label: new StringField({ initial: 'DCC.CastSpellFromScroll' }),
          ability: new StringField({ initial: 'int' }),
          die: new DiceField({ initial: '1d10' }),
          value: new StringField({ initial: '0' })
        }),

        // Halfling skills
        sneakAndHide: new SchemaField({
          label: new StringField({ initial: 'DCC.SneakAndHide' }),
          value: new StringField({ initial: '+3' })
        }),

        // Dwarf skills
        shieldBash: new SchemaField({
          label: new StringField({ initial: 'DCC.ShieldBash' }),
          ability: new StringField({ initial: 'str' }),
          die: new DiceField({ initial: '1d14' }),
          value: new StringField({ initial: '+0' }),
          useDeed: new BooleanField({ initial: true })
        })
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
