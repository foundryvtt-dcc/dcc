/* global CONFIG */
/**
 * Class traits registry (#998): rules read class traits instead of checking
 * for a built-in class ID, so a registered class can opt in to them.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'
import { BUILT_IN_CLASS_TRAITS, registerBuiltInClassTraits } from '../built-in-class-traits.mjs'
import { CLASS_TRAIT_TYPES, getClassTrait, getClassTraits, registerClassTraits } from '../extension-api.mjs'
import { getRecoveryClass } from '../ability-score-log.js'
import { isHalflingTwoWeaponAttack } from '../two-weapon-fumble.mjs'

vi.mock('../actor-level-change.js')

const HALFLING_TWO_WEAPON = { twoWeaponMinAgility: 16, twoWeaponCritOnMax: true, twoWeaponFumbleBothOnes: true }

// Production registers the built-ins at init; tests start from the same state.
beforeEach(() => {
  delete CONFIG.DCC.classTraits
  registerBuiltInClassTraits(registerClassTraits)
})
afterEach(() => {
  delete CONFIG.DCC.classTraits
})

describe('registerClassTraits', () => {
  test('stores a copy of the traits under the class ID', () => {
    const traits = { idolMagic: true }
    registerClassTraits('dwarven-priest', traits)
    traits.idolMagic = false
    expect(CONFIG.DCC.classTraits['dwarven-priest']).toEqual({ idolMagic: true })
  })

  test('re-registering a class replaces its traits', () => {
    registerClassTraits('ranger', { twoWeaponMinAgility: 16 })
    registerClassTraits('ranger', { luckRecovers: true })
    expect(getClassTraits('ranger')).toEqual({ luckRecovers: true })
  })

  test('rejects a bad class ID, a non-object, an unknown trait, or a wrong type', () => {
    expect(() => registerClassTraits('', {})).toThrow(/classId/)
    expect(() => registerClassTraits('ranger', null)).toThrow(/traits must be an object/)
    expect(() => registerClassTraits('ranger', [])).toThrow(/traits must be an object/)
    expect(() => registerClassTraits('ranger', { twoWeaponMinAgilty: 16 })).toThrow(/unknown trait "twoWeaponMinAgilty"/)
    expect(() => registerClassTraits('ranger', { twoWeaponMinAgility: '16' })).toThrow(/must be a number/)
  })

  test('throws without CONFIG.DCC', () => {
    expect(() => registerClassTraits('ranger', {}, { CONFIG: {} })).toThrow(/CONFIG.DCC unavailable/)
  })

  test('every built-in trait is a documented trait of the right type', () => {
    for (const traits of Object.values(BUILT_IN_CLASS_TRAITS)) {
      for (const [name, value] of Object.entries(traits)) {
        expect(typeof value).toBe(CLASS_TRAIT_TYPES[name])
      }
    }
  })
})

describe('getClassTraits / getClassTrait', () => {
  test('returns the registered traits, or {} for an unknown or missing class', () => {
    expect(getClassTraits('halfling')).toEqual(BUILT_IN_CLASS_TRAITS.halfling)
    expect(getClassTraits('warrior')).toEqual({})
    expect(getClassTraits(null)).toEqual({})
  })

  test('falls back to the built-in table before anything is registered', () => {
    delete CONFIG.DCC.classTraits
    expect(getClassTraits('cleric')).toEqual({ idolMagic: true })
    expect(getClassTraits('halfling-champion')).toEqual({})
  })

  test('once registered, the registry wins over the built-in table', () => {
    registerClassTraits('halfling', {})
    expect(getClassTraits('halfling')).toEqual({})
  })

  test('returns a copy the caller cannot use to change the registry', () => {
    getClassTraits('cleric').idolMagic = false
    expect(getClassTraits('cleric').idolMagic).toBe(true)
  })

  test("reads one trait from an actor's class ID", () => {
    expect(getClassTrait({ classId: 'thief' }, 'luckRecovers')).toBe(true)
    expect(getClassTrait({ classId: 'warrior' }, 'luckRecovers')).toBeUndefined()
    expect(getClassTrait(null, 'luckRecovers')).toBeUndefined()
  })
})

describe('two-weapon traits', () => {
  function createActor (agility, sheetClass) {
    return new DCCActor({
      type: 'Player',
      system: {
        abilities: {
          str: { value: 10, mod: 0 },
          agl: { value: agility, mod: 0 },
          sta: { value: 10, mod: 0 },
          int: { value: 10, mod: 0 },
          per: { value: 10, mod: 0 },
          lck: { value: 10, mod: 0 }
        },
        attributes: { actionDice: { value: '1d20' }, init: { value: 1 }, hp: { value: 4, max: 4 } },
        details: {
          attackBonus: '+0',
          attackHitBonus: { melee: { value: '+0', adjustment: '+0' }, missile: { value: '+0', adjustment: '+0' } },
          attackDamageBonus: { melee: { value: '+0', adjustment: '+0' }, missile: { value: '+0', adjustment: '+0' } },
          level: { value: 1 },
          sheetClass
        },
        class: { className: sheetClass },
        config: {}
      }
    })
  }

  function preparedWeapon (actor, hand) {
    const weapon = new DCCItem({ type: 'weapon', system: { actionDie: '1d20', trained: true, config: {}, [hand]: true } }, { parent: actor })
    weapon.actor = actor
    weapon.prepareBaseData()
    return weapon.system
  }

  test('a class registered with the halfling traits fights exactly like a halfling', () => {
    registerClassTraits('halfling-champion', HALFLING_TWO_WEAPON)
    for (const hand of ['twoWeaponPrimary', 'twoWeaponSecondary']) {
      const champion = preparedWeapon(createActor(10, 'Halfling-Champion'), hand)
      const halfling = preparedWeapon(createActor(10, 'Halfling'), hand)
      expect(champion.actionDie).toBe(halfling.actionDie)
      expect(champion.twoWeaponCritRule).toBe(halfling.twoWeaponCritRule)
      expect(champion.twoWeaponCritRule).toBe('TwoWeaponCritMaxAutoHit')
    }
  })

  test('the Agility floor alone gives the Agility-16 row without the halfling crit', () => {
    registerClassTraits('ranger', { twoWeaponMinAgility: 16 })
    for (const hand of ['twoWeaponPrimary', 'twoWeaponSecondary']) {
      const ranger = preparedWeapon(createActor(10, 'Ranger'), hand)
      const agile = preparedWeapon(createActor(16, 'Warrior'), hand)
      expect(ranger.actionDie).toBe(agile.actionDie)
      expect(ranger.twoWeaponCritRule).toBe(agile.twoWeaponCritRule)
    }
    // Non-halfling Agility 16-17 row: the primary's max must beat AC, and
    // the off-hand can't crit.
    expect(preparedWeapon(createActor(10, 'Ranger'), 'twoWeaponPrimary').twoWeaponCritRule).toBe('TwoWeaponCritMaxBeatsAC')
    expect(preparedWeapon(createActor(10, 'Ranger'), 'twoWeaponSecondary').twoWeaponCritRule).toBe('TwoWeaponCritNone')
  })

  test('a class without the traits keeps the normal Table 4-3 row', () => {
    const warrior = preparedWeapon(createActor(10, 'Warrior'), 'twoWeaponPrimary')
    const champion = preparedWeapon(createActor(10, 'Halfling-Champion'), 'twoWeaponPrimary')
    expect(champion.actionDie).toBe(warrior.actionDie)
    expect(champion.twoWeaponCritRule).toBe('TwoWeaponCritNone')
  })

  test('the both-1s fumble rule follows twoWeaponFumbleBothOnes', () => {
    const offHand = { system: { twoWeaponSecondary: true } }
    expect(isHalflingTwoWeaponAttack({ classId: 'halfling-champion' }, offHand)).toBe(false)
    registerClassTraits('halfling-champion', HALFLING_TWO_WEAPON)
    registerClassTraits('ranger', { twoWeaponMinAgility: 16 })
    expect(isHalflingTwoWeaponAttack({ classId: 'halfling-champion' }, offHand)).toBe(true)
    expect(isHalflingTwoWeaponAttack({ classId: 'ranger' }, offHand)).toBe(false)
  })
})

describe('detectSecretDoorsBonus', () => {
  test('sets the Detect Secret Doors skill for a class with the trait', () => {
    registerClassTraits('elven-rogue', { detectSecretDoorsBonus: '+2' })
    const actor = new DCCActor()
    actor.system.details.sheetClass = 'Elven-Rogue'
    actor.system.skills.detectSecretDoors = { value: '' }
    actor.applyClassSkillTraits()
    expect(actor.system.skills.detectSecretDoors.value).toBe('+2')
  })

  test('leaves the skill alone for a class without it', () => {
    const actor = new DCCActor()
    actor.system.details.sheetClass = 'Warrior'
    actor.system.skills.detectSecretDoors = { value: '+1' }
    actor.applyClassSkillTraits()
    expect(actor.system.skills.detectSecretDoors.value).toBe('+1')
  })
})

describe('luckRecovers', () => {
  const actorOf = classId => ({ classId, system: { details: {} } })

  test('a spent-Luck entry recovers for a class with the trait, and is permanent otherwise', () => {
    registerClassTraits('elven-rogue', { luckRecovers: true })
    expect(getRecoveryClass('luckSpend', actorOf('elven-rogue'))).toBe('luckRegen')
    expect(getRecoveryClass('luckSpend', actorOf('thief'))).toBe('luckRegen')
    expect(getRecoveryClass('luckSpend', actorOf('warrior'))).toBe('permanent')
  })
})
