import { describe, test, expect } from 'vitest'
import { actorToCharacter } from '../adapter/character-accessors.mjs'

// §2.1 schema-slimming resolution guard (see docs/dev/SCHEMA_SLIMMING.md).
//
// §2.1 ("the Player schema is monolithic") cannot be resolved by making a
// halfling's schema differ from a wizard's — Foundry's defineSchema() is static,
// one schema per document subtype, so every `type: 'Player'` actor shares one
// schema and carries every class's fields. The resolution is that the lib is the
// class-clean READ-SIDE source of truth: `actorToCharacter` projects a Foundry
// actor into the lib's Character shape reading ZERO class-specific schema fields
// (no shieldBash / disapproval / knownSpells / skills). These guards lock that in
// — they fail if the projection ever starts depending on a monolithic class field,
// which would re-couple the read path to the un-slimmable schema.

// The cross-class fields the projection is allowed to read. `extraSystem` adds
// (or overrides) system keys on top of the base — used to bolt on the pile of
// foreign-class fields the monolithic schema would carry.
function baseActor (extraSystem = {}) {
  return {
    name: 'Probe',
    _id: 'probe123',
    uuid: 'Actor.probe123',
    system: {
      abilities: {
        str: { value: 12, max: 12 },
        agl: { value: 10, max: 10 },
        sta: { value: 13, max: 13 },
        per: { value: 9, max: 9 },
        int: { value: 8, max: 8 },
        lck: { value: 14, max: 14 }
      },
      saves: {
        ref: { value: '+1' },
        frt: { value: '+2' },
        wil: { value: '+0' }
      },
      details: { level: { value: 2 } },
      class: { className: 'Halfling' },
      ...extraSystem
    }
  }
}

// The class-specific schema fields the monolithic Player schema bakes onto every
// actor — none of which the projection should touch.
const FOREIGN_CLASS_FIELDS = {
  class: {
    className: 'Halfling',
    // cleric
    spellCheck: '+5',
    spellCheckAbility: 'per',
    disapproval: 1,
    disapprovalTable: 'x',
    deity: 'Some Deity',
    spellsLevel1: 1,
    // wizard / elf
    knownSpells: 3,
    maxSpellLevel: 2,
    patron: 'A Patron',
    patronTaintChance: 4,
    familiar: 'cat',
    corruption: '<p>x</p>',
    spellCheckOtherMod: '+1',
    spellCheckOverride: '',
    spellCheckDieOverride: '',
    // thief / warrior
    luckDie: '1d4',
    backstab: '+2',
    luckyWeapon: 'dagger',
    luckyWeaponMod: '+1'
  },
  skills: {
    // halfling's own + a pile of foreign-class skills
    sneakAndHide: { label: 'DCC.SneakAndHide', value: '+3' },
    shieldBash: { label: 'DCC.ShieldBash', value: '+0', die: '1d14', useDeed: false },
    sneakSilently: { label: 'x', ability: 'agl', value: '+0' },
    hideInShadows: { label: 'x', ability: 'agl', value: '+0' },
    divineAid: { label: 'x', value: '+0' },
    turnUnholy: { label: 'x', value: '+0' },
    layOnHands: { label: 'x', value: '+0' }
  }
}

describe('§2.1 schema-slimming: actorToCharacter is class-clean', () => {
  test('builds a complete Character from an actor carrying NO class-specific fields', () => {
    // Minimal actor: only the cross-class fields the projection reads.
    const character = actorToCharacter(baseActor())

    // Full cross-class shape is present...
    expect(character.identity).toEqual({ id: 'Actor.probe123', name: 'Probe' })
    expect(Object.keys(character.state.abilities).sort()).toEqual(
      ['agl', 'int', 'lck', 'per', 'sta', 'str']
    )
    expect(character.state.abilities.str).toEqual({ current: 12, max: 12 })
    expect(character.state.saves).toEqual({ reflex: 1, fortitude: 2, will: 0 })
    expect(character.classInfo).toEqual({ level: 2, classId: 'halfling' })

    // ...and NO class-specific state leaked in.
    expect(character.state.skills).toBeUndefined()
    expect(character.state.cleric).toBeUndefined()
    expect(character.state.wizard).toBeUndefined()
    expect(character).not.toHaveProperty('skills')
  })

  test('ignores the monolithic schema class fields: identical output with vs without them', () => {
    const slim = actorToCharacter(baseActor())
    const fat = actorToCharacter(baseActor(FOREIGN_CLASS_FIELDS))

    // The pile of foreign-class fields makes ZERO difference to the projection —
    // proving the read path needs none of the un-slimmable schema's class fields.
    expect(fat).toEqual(slim)
  })

  test('classId derives from className only — foreign class fields do not change it', () => {
    const character = actorToCharacter(baseActor(FOREIGN_CLASS_FIELDS))
    expect(character.classInfo.classId).toBe('halfling')
  })
})
