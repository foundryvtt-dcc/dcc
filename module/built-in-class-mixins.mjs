/* global foundry */
/**
 * Built-in class-mixin registrations for the DCC system itself.
 *
 * Phase 4 of the `refactor/dcc-core-lib-adapter` arc moves class-bound
 * Player schema fields off the monolithic `module/data/actor/player-data.mjs`
 * body and onto the `game.dcc.registerClassMixin` registry. The DCC
 * system dogfoods its own helper by registering one mixin per built-in
 * class through this single entry point.
 *
 * Sharing the registration list between `module/dcc.js`'s `init` hook
 * and the integration-test setup (`module/__integration__/setup-foundry.js`)
 * means new class mixins land in one place and both environments stay
 * in sync. See `docs/dev/CLASS_DECOMPOSITION.md` §3.1 and
 * `docs/dev/EXTENSION_API.md` for the broader contract.
 */
import { DiceField } from './data/fields/_module.mjs'

/**
 * Attach the shared wizard/elf class-field block to `schema.class.fields`.
 * Wizards and elves cast on the same field shape in DCC; the wizard
 * and elf mixins both call this helper so the field declarations live
 * in one place. Each call builds **fresh** field instances — Foundry
 * forbids reusing field objects across schemas, and the wizard mixin
 * runs once before the elf mixin which then runs `attachWizardFields`
 * again. Both attachments are identical, so the second is functionally
 * a no-op (last-write-wins, matching the rest of the registry).
 */
function attachWizardFields (schema) {
  const fields = foundry.data.fields
  schema.class.fields.knownSpells = new fields.NumberField({ initial: 0, integer: true, min: 0 })
  schema.class.fields.maxSpellLevel = new fields.NumberField({ initial: 0, integer: true, min: 0 })
  schema.class.fields.spellCheckOtherMod = new fields.StringField({ nullable: true, initial: null })
  schema.class.fields.spellCheckDieOverride = new fields.StringField({ nullable: true, initial: null })
  schema.class.fields.spellCheckOverride = new fields.StringField({ nullable: true, initial: null })
  schema.class.fields.patron = new fields.StringField({ nullable: true, initial: null })
  schema.class.fields.patronTaintChance = new fields.StringField({ initial: '1%' })
  schema.class.fields.familiar = new fields.StringField({ nullable: true, initial: null })
  schema.class.fields.corruption = new fields.HTMLField({ initial: '' })
}

/**
 * Map of `classId → mixinFn`. Each function takes the in-progress
 * Player schema and attaches fresh field instances under
 * `schema.skills.fields` / `schema.class.fields`.
 *
 * **DO NOT** reuse field instances across schemas — Foundry's
 * TypeDataModel may re-invoke `defineSchema()` and shared instances
 * cross-contaminate. Build new ones inside the mixin body.
 */
export const BUILT_IN_CLASS_MIXINS = {
  cleric (schema) {
    const fields = foundry.data.fields
    schema.class.fields.spellCheck = new fields.NumberField({ initial: 1, integer: true })
    schema.class.fields.spellCheckAbility = new fields.StringField({ initial: 'per' })
    for (let level = 1; level <= 5; level++) {
      schema.class.fields[`spellsLevel${level}`] = new fields.NumberField({ initial: 0, integer: true, min: 0 })
    }
    schema.class.fields.deity = new fields.StringField({ nullable: true, initial: null })
    schema.class.fields.disapproval = new fields.NumberField({ initial: 1, integer: true, min: 1, max: 20 })
    schema.class.fields.disapprovalTable = new fields.StringField({ initial: 'Disapproval' })
    const disapprovalSkill = (label, extra = {}) => new fields.SchemaField({
      label: new fields.StringField({ initial: label }),
      value: new fields.NumberField({ initial: 0, integer: true }),
      useDisapprovalRange: new fields.BooleanField({ initial: true }),
      ...extra
    })
    schema.skills.fields.divineAid = disapprovalSkill('DCC.DivineAid', {
      drainDisapproval: new fields.NumberField({ initial: 10, integer: true })
    })
    schema.skills.fields.turnUnholy = disapprovalSkill('DCC.TurnUnholy')
    schema.skills.fields.layOnHands = disapprovalSkill('DCC.LayOnHands')
  },
  dwarf (schema) {
    const fields = foundry.data.fields
    schema.skills.fields.shieldBash = new fields.SchemaField({
      label: new fields.StringField({ initial: 'DCC.ShieldBash' }),
      ability: new fields.StringField({ initial: 'str' }),
      die: new DiceField({ initial: '1d14' }),
      value: new fields.StringField({ initial: '+0' }),
      useDeed: new fields.BooleanField({ initial: true })
    })
  },
  elf (schema) {
    // Elves cast as wizards (same field shape) — attach the shared
    // wizard fields, then override detectSecretDoors with the elf-
    // specific HeightenedSenses shape. The base body declares
    // detectSecretDoors as the non-Elf default
    // (`label='DCC.DetectSecretDoors'`, `ability=''`, `value='+0'`);
    // the elf mixin replaces the SchemaField entirely.
    attachWizardFields(schema)
    const fields = foundry.data.fields
    schema.skills.fields.detectSecretDoors = new fields.SchemaField({
      label: new fields.StringField({ initial: 'DCC.HeightenedSenses' }),
      ability: new fields.StringField({ initial: 'int' }),
      value: new fields.StringField({ initial: '+4' })
    })
  },
  halfling (schema) {
    const fields = foundry.data.fields
    schema.skills.fields.sneakAndHide = new fields.SchemaField({
      label: new fields.StringField({ initial: 'DCC.SneakAndHide' }),
      value: new fields.StringField({ initial: '+3' })
    })
  },
  thief (schema) {
    const fields = foundry.data.fields
    schema.class.fields.luckDie = new DiceField({ initial: '1d3' })
    schema.class.fields.backstab = new fields.StringField({ initial: '0' })
    const thiefSkill = (label, ability) => new fields.SchemaField({
      label: new fields.StringField({ initial: label }),
      ability: new fields.StringField({ initial: ability }),
      value: new fields.StringField({ initial: '0' })
    })
    schema.skills.fields.sneakSilently = thiefSkill('DCC.SneakSilently', 'agl')
    schema.skills.fields.hideInShadows = thiefSkill('DCC.HideInShadows', 'agl')
    schema.skills.fields.pickPockets = thiefSkill('DCC.PickPocket', 'agl')
    schema.skills.fields.climbSheerSurfaces = thiefSkill('DCC.ClimbSheerSurfaces', 'agl')
    schema.skills.fields.pickLock = thiefSkill('DCC.PickLock', 'agl')
    schema.skills.fields.findTrap = thiefSkill('DCC.FindTrap', 'int')
    schema.skills.fields.disableTrap = thiefSkill('DCC.DisableTrap', 'agl')
    schema.skills.fields.forgeDocument = thiefSkill('DCC.ForgeDocument', 'agl')
    schema.skills.fields.disguiseSelf = thiefSkill('DCC.DisguiseSelf', 'per')
    schema.skills.fields.readLanguages = thiefSkill('DCC.ReadLanguages', 'int')
    schema.skills.fields.handlePoison = new fields.SchemaField({
      label: new fields.StringField({ initial: 'DCC.HandlePoison' }),
      value: new fields.StringField({ initial: '0' })
    })
    schema.skills.fields.castSpellFromScroll = new fields.SchemaField({
      label: new fields.StringField({ initial: 'DCC.CastSpellFromScroll' }),
      ability: new fields.StringField({ initial: 'int' }),
      die: new DiceField({ initial: '1d10' }),
      value: new fields.StringField({ initial: '0' })
    })
  },
  warrior (schema) {
    const fields = foundry.data.fields
    schema.class.fields.luckyWeapon = new fields.StringField({ nullable: true, initial: null })
    schema.class.fields.luckyWeaponMod = new fields.StringField({ initial: '+0' })
  },
  wizard (schema) {
    attachWizardFields(schema)
  }
}

/**
 * Register every entry in `BUILT_IN_CLASS_MIXINS` with the supplied
 * `registerClassMixin` function. Production code (`module/dcc.js:init`)
 * and the integration-test setup share this entry point so additions
 * land in one place.
 *
 * @param {(classId: string, mixinFn: (schema: object) => void) => void} register
 *   The `registerClassMixin` from `module/extension-api.mjs`.
 */
export function registerBuiltInClassMixins (register) {
  for (const [classId, mixinFn] of Object.entries(BUILT_IN_CLASS_MIXINS)) {
    register(classId, mixinFn)
  }
}
