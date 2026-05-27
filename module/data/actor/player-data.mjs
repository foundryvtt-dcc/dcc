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

const { SchemaField, StringField, BooleanField, HTMLField } = foundry.data.fields

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

      // Class information. After Phase 4 sessions 1–6, every
      // class-specific field on `system.class.*` lives on its
      // respective `CONFIG.DCC.classMixins` entry — only `className`
      // (the cross-class identity field) remains in the static body.
      // Wizard + elf class fields (knownSpells / maxSpellLevel /
      // spellCheckOtherMod / spellCheckDieOverride / spellCheckOverride
      // / patron / patronTaintChance / familiar / corruption) are
      // attached by the `'wizard'` and `'elf'` mixins; cleric /
      // thief / warrior fields by their respective mixins. See
      // `module/built-in-class-mixins.mjs` for the full table.
      //
      // The four link fields (`classLink` + per-class
      // `mightyDeedsLink` / `spellcastingLink` / `spellburnLink`)
      // are cross-class enriched-HTML blobs the sheet's `_prepareContext`
      // writes via `registerClassDefaults`'s `enrichHtml` bag. Pre-Phase
      // 5 session 3 these weren't registered in the schema — sibling
      // modules (xcc-core-book et al.) had been contributing `classLink`
      // via `dcc.definePlayerSchema`, so writes survived only when a
      // sibling was loaded; `mightyDeedsLink` / `spellcastingLink` /
      // `spellburnLink` writes were always stripped, and the templates
      // `{{{system.class.<field>}}}` rendered empty. Registering them
      // here closes the latent gap so the sheet writes survive in
      // every world configuration.
      class: new SchemaField({
        className: new StringField({ initial: 'Zero-Level' }),
        classLink: new HTMLField({ initial: '' }),
        mightyDeedsLink: new HTMLField({ initial: '' }),
        spellcastingLink: new HTMLField({ initial: '' }),
        spellburnLink: new HTMLField({ initial: '' })
      }),

      // Skills. Only `detectSecretDoors` is a base-body skill —
      // every other class skill lives on a class mixin (cleric:
      // divineAid/turnUnholy/layOnHands; thief: 12-skill block;
      // halfling: sneakAndHide; dwarf: shieldBash). The base shape
      // here is the non-Elf default; the `'elf'` mixin replaces it
      // with the HeightenedSenses overrides (label / ability='int'
      // / value='+4').
      skills: new SchemaField({
        detectSecretDoors: new SchemaField({
          label: new StringField({ initial: 'DCC.DetectSecretDoors' }),
          ability: new StringField({ initial: '' }),
          value: new StringField({ initial: '+0' })
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
