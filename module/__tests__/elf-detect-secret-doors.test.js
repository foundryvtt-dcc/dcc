/**
 * #1000: the elf class mixin used to replace the shared Player schema's
 * `skills.detectSecretDoors` with the elf shape, so every Player started
 * with the elf's +4 Heightened Senses. The elf's values now come from its
 * class defaults (label / ability / value) and the `detectSecretDoorsBonus`
 * trait; the schema keeps the base-body default for everyone.
 */
import { describe, expect, test } from 'vitest'
import { BUILT_IN_CLASS_DEFAULTS } from '../built-in-class-defaults.mjs'
import { BUILT_IN_CLASS_TRAITS } from '../built-in-class-traits.mjs'

// The mixins build real DataField instances; stub the field classes so the
// module (and the DiceField it imports) load without a Foundry boot.
class StubField { constructor (...args) { this.args = args } }
globalThis.foundry = {
  ...globalThis.foundry,
  data: {
    fields: new Proxy({}, { get: () => StubField })
  }
}
const { BUILT_IN_CLASS_MIXINS } = await import('../built-in-class-mixins.mjs')

describe('elf Detect Secret Doors (#1000)', () => {
  test('the elf mixin leaves the base-body detectSecretDoors field alone', () => {
    const baseDetect = { kind: 'base detectSecretDoors' }
    const schema = { class: { fields: {} }, skills: { fields: { detectSecretDoors: baseDetect } } }

    BUILT_IN_CLASS_MIXINS.elf(schema)

    expect(schema.skills.fields.detectSecretDoors).toBe(baseDetect)
    // Still attaches the shared wizard fields
    expect(schema.class.fields.knownSpells).toBeDefined()
  })

  test('no built-in mixin touches detectSecretDoors', () => {
    for (const [classId, mixin] of Object.entries(BUILT_IN_CLASS_MIXINS)) {
      const baseDetect = { kind: 'base detectSecretDoors' }
      const schema = { class: { fields: {} }, skills: { fields: { detectSecretDoors: baseDetect } } }
      mixin(schema)
      expect(schema.skills.fields.detectSecretDoors, classId).toBe(baseDetect)
    }
  })

  test('elf class defaults write the Heightened Senses label, ability and value', () => {
    expect(BUILT_IN_CLASS_DEFAULTS.elf.literal).toMatchObject({
      'skills.detectSecretDoors.label': 'DCC.HeightenedSenses',
      'skills.detectSecretDoors.ability': 'int',
      'skills.detectSecretDoors.value': '+4'
    })
  })

  test('only the elf class defaults touch detectSecretDoors', () => {
    for (const [classId, defaults] of Object.entries(BUILT_IN_CLASS_DEFAULTS)) {
      if (classId === 'elf') continue
      const paths = Object.keys(defaults.literal ?? {}).filter(p => p.startsWith('skills.detectSecretDoors'))
      expect(paths, classId).toEqual([])
    }
  })

  test('the elf +4 value agrees with its detectSecretDoorsBonus trait', () => {
    expect(BUILT_IN_CLASS_DEFAULTS.elf.literal['skills.detectSecretDoors.value'])
      .toBe(BUILT_IN_CLASS_TRAITS.elf.detectSecretDoorsBonus)
  })
})
