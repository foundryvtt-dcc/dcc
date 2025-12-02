/* global foundry */
/**
 * Data model for NPC actors
 * NPCs use common and config templates with some overrides
 */
import { BaseActorData } from './base-actor.mjs'
import { DiceField } from '../fields/_module.mjs'

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields

export class NPCData extends BaseActorData {
  static defineSchema () {
    const schema = super.defineSchema()

    // Override default critical table for NPCs (Monster table M instead of I)
    schema.attributes.fields.critical = new SchemaField({
      die: new DiceField({ initial: '1d4' }),
      table: new StringField({ initial: 'M' })
    })

    // Override default hit dice for NPCs (1d6 instead of 1d4)
    schema.attributes.fields.hitDice = new SchemaField({
      value: new DiceField({ initial: '1d6' })
    })

    return {
      ...schema,

      // NPC class fields for spell checks
      class: new SchemaField({
        spellCheck: new NumberField({ initial: 1, integer: true }),
        spellCheckAbility: new StringField({ initial: 'int' })
      }),

      // Configuration (from config template)
      config: new SchemaField({
        attackBonusMode: new StringField({ initial: 'flat' }),
        actionDice: new DiceField({ initial: '1d20' }),
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
  }
}
