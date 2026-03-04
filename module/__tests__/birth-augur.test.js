/**
 * Tests for birth augur automation
 */

import { describe, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'
import { BIRTH_AUGURS, matchAugurFromText } from '../birth-augurs.mjs'

// Mock the actor-level-change module
vi.mock('../actor-level-change.js')

/**
 * Create a test actor with isPC set to true
 * The mock doesn't set type/isPC automatically like the real actor does
 */
function createPCActor () {
  const actor = new DCCActor()
  actor.isPC = true
  return actor
}

describe('BIRTH_AUGURS table', () => {
  test('has 30 entries', () => {
    expect(BIRTH_AUGURS).toHaveLength(30)
  })

  test('indices are 1-30', () => {
    BIRTH_AUGURS.forEach((augur, i) => {
      expect(augur.index).toBe(i + 1)
    })
  })

  test('each augur has key and effect', () => {
    BIRTH_AUGURS.forEach(augur => {
      expect(augur.key).toBeTruthy()
      expect(augur.effect).toBeTruthy()
    })
  })
})

describe('matchAugurFromText', () => {
  test('returns null for empty/invalid input', () => {
    expect(matchAugurFromText(null)).toBeNull()
    expect(matchAugurFromText('')).toBeNull()
    expect(matchAugurFromText(undefined)).toBeNull()
    expect(matchAugurFromText(42)).toBeNull()
  })

  test('matches augur names', () => {
    expect(matchAugurFromText('Harsh winter: All attack rolls (+2)')).toBe(1)
    expect(matchAugurFromText('The bull: Melee attack rolls (-1)')).toBe(2)
    expect(matchAugurFromText('Fortunate date: Missile fire attack rolls (+3)')).toBe(3)
    expect(matchAugurFromText('Hawkeye: Missile fire damage rolls (+1)')).toBe(8)
    expect(matchAugurFromText('Seventh son: Spell checks (-2)')).toBe(13)
    expect(matchAugurFromText('Lucky sign: Saving throws (+1)')).toBe(17)
    expect(matchAugurFromText('Struck by lightning: Reflex saving throws (+2)')).toBe(20)
    expect(matchAugurFromText('Charmed house: Armor Class (+1)')).toBe(23)
    expect(matchAugurFromText('Speed of the cobra: Initiative (+2)')).toBe(24)
    expect(matchAugurFromText('Wild child: Speed (+1)')).toBe(30)
  })

  test('matches case-insensitively', () => {
    expect(matchAugurFromText('HARSH WINTER: All attack rolls')).toBe(1)
    expect(matchAugurFromText('the bull: melee attack rolls')).toBe(2)
  })

  test('returns null for unrecognized text', () => {
    expect(matchAugurFromText('Some random text')).toBeNull()
    expect(matchAugurFromText('Not a real augur')).toBeNull()
  })
})

describe('_getBirthAugurBonusFor', () => {
  test('returns 0 for NPC', () => {
    const actor = createPCActor()
    actor.isPC = false
    actor.system.details.birthAugurIndex = 1
    actor.system.details.birthAugurLuckMod = 2
    expect(actor._getBirthAugurBonusFor('allAttack')).toBe(0)
  })

  test('returns 0 when birthAugurIndex is null', () => {
    const actor = createPCActor()
    expect(actor._getBirthAugurBonusFor('allAttack')).toBe(0)
  })

  test('returns 0 when effect type does not match', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 1 // harshWinter -> allAttack
    actor.system.details.birthAugurLuckMod = 2
    expect(actor._getBirthAugurBonusFor('meleeAttack')).toBe(0)
  })

  test('returns birthAugurLuckMod in static mode', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 1 // harshWinter -> allAttack
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    expect(actor._getBirthAugurBonusFor('allAttack')).toBe(2)
  })

  test('returns lck.mod in floating mode', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 1 // harshWinter -> allAttack
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'floating'
    // actor has lck value 18 -> mod 3
    expect(actor._getBirthAugurBonusFor('allAttack')).toBe(3)
  })

  test('matches multiple effect types', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 1 // harshWinter -> allAttack
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    expect(actor._getBirthAugurBonusFor('meleeAttack', 'allAttack')).toBe(2)
  })
})

describe('birth augur integration with compute methods', () => {
  test('allAttack augur adds to both melee and missile attack', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 1 // harshWinter -> allAttack
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    // Base: str mod (-1) + attack bonus (0) + augur (+2) = +1
    expect(actor.system.details.attackHitBonus.melee.value).toBe('+1')
    // Missile: agl mod (-1) + attack bonus (0) + augur (+2) = +1
    expect(actor.system.details.attackHitBonus.missile.value).toBe('+1')
  })

  test('meleeAttack augur adds only to melee attack', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 2 // theBull -> meleeAttack
    actor.system.details.birthAugurLuckMod = 3
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    // Melee: str mod (-1) + attack bonus (0) + augur (+3) = +2
    expect(actor.system.details.attackHitBonus.melee.value).toBe('+2')
    // Missile: agl mod (-1) + attack bonus (0) + no augur = -1
    expect(actor.system.details.attackHitBonus.missile.value).toBe('-1')
  })

  test('missileAttack augur adds only to missile attack', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 3 // fortunateDate -> missileAttack
    actor.system.details.birthAugurLuckMod = 1
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    // Melee: str mod (-1) + attack bonus (0) + no augur = -1
    expect(actor.system.details.attackHitBonus.melee.value).toBe('-1')
    // Missile: agl mod (-1) + attack bonus (0) + augur (+1) = +0
    expect(actor.system.details.attackHitBonus.missile.value).toBe('+0')
  })

  test('allDamage augur adds to both melee and missile damage', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 6 // bornOnTheBattlefield -> allDamage
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    // Melee damage: str mod (-1) + augur (+2) = +1
    expect(actor.system.details.attackDamageBonus.melee.value).toBe('+1')
    // Missile damage: augur (+2) = +2
    expect(actor.system.details.attackDamageBonus.missile.value).toBe('+2')
  })

  test('meleeDamage augur adds only to melee damage', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 7 // pathOfTheBear -> meleeDamage
    actor.system.details.birthAugurLuckMod = 1
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    // Melee damage: str mod (-1) + augur (+1) = +0
    expect(actor.system.details.attackDamageBonus.melee.value).toBe('+0')
    // Missile damage: no augur = +0
    expect(actor.system.details.attackDamageBonus.missile.value).toBe('+0')
  })

  test('missileDamage augur adds only to missile damage', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 8 // hawkeye -> missileDamage
    actor.system.details.birthAugurLuckMod = 3
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    // Melee damage: str mod (-1) + no augur = -1
    expect(actor.system.details.attackDamageBonus.melee.value).toBe('-1')
    // Missile damage: augur (+3) = +3
    expect(actor.system.details.attackDamageBonus.missile.value).toBe('+3')
  })

  test('reflexSave augur adds to reflex save', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 20 // struckByLightning -> reflexSave
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    actor.computeSavingThrows()
    // Ref: agl mod (-1) + augur (+2) = +1
    expect(actor.system.saves.ref.value).toBe('+1')
    // Fort: sta mod (0) = +0
    expect(actor.system.saves.frt.value).toBe('+0')
    // Will: per mod (2) = +2
    expect(actor.system.saves.wil.value).toBe('+2')
  })

  test('fortSave augur adds to fort save', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 21 // livedThroughFamine -> fortSave
    actor.system.details.birthAugurLuckMod = 1
    actor.system.config.birthAugurMode = 'static'
    actor.computeSavingThrows()
    expect(actor.system.saves.frt.value).toBe('+1')
    expect(actor.system.saves.ref.value).toBe('-1')
  })

  test('willSave augur adds to will save', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 22 // resistedTemptation -> willSave
    actor.system.details.birthAugurLuckMod = 1
    actor.system.config.birthAugurMode = 'static'
    actor.computeSavingThrows()
    expect(actor.system.saves.wil.value).toBe('+3')
    expect(actor.system.saves.ref.value).toBe('-1')
  })

  test('allSaves augur adds to all saves', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 17 // luckySign -> allSaves
    actor.system.details.birthAugurLuckMod = 1
    actor.system.config.birthAugurMode = 'static'
    actor.computeSavingThrows()
    // Ref: agl mod (-1) + augur (+1) = +0
    expect(actor.system.saves.ref.value).toBe('+0')
    // Fort: sta mod (0) + augur (+1) = +1
    expect(actor.system.saves.frt.value).toBe('+1')
    // Will: per mod (2) + augur (+1) = +3
    expect(actor.system.saves.wil.value).toBe('+3')
  })

  test('spellCheck augur adds to spell check', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 13 // seventhSon -> spellCheck
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    actor.computeSpellCheck()
    // Level (1) + int mod (+1) + augur (+2) = "+1+1+2" (formula string)
    expect(actor.system.class.spellCheck).toBe('+1+1+2')
  })

  test('initiative augur adds to initiative', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 24 // speedOfTheCobra -> initiative
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    actor.computeInitiative({ addClassLevelToInitiative: false })
    // Agl mod (-1) + otherMod (0) + augur (+2) = 1
    expect(actor.system.attributes.init.value).toBe(1)
  })

  test('no augur selected does not affect computations', () => {
    const actor = createPCActor()
    // birthAugurIndex is null by default
    actor.computeMeleeAndMissileAttackAndDamage()
    expect(actor.system.details.attackHitBonus.melee.value).toBe('-1')
    expect(actor.system.details.attackHitBonus.missile.value).toBe('-1')
    actor.computeSavingThrows()
    expect(actor.system.saves.ref.value).toBe('-1')
    expect(actor.system.saves.frt.value).toBe('+0')
    expect(actor.system.saves.wil.value).toBe('+2')
  })

  test('non-automated augur does not affect computations', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 4 // raisedByWolves -> 'none'
    actor.system.details.birthAugurLuckMod = 3
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    expect(actor.system.details.attackHitBonus.melee.value).toBe('-1')
    actor.computeSavingThrows()
    expect(actor.system.saves.ref.value).toBe('-1')
    actor.computeInitiative({ addClassLevelToInitiative: false })
    expect(actor.system.attributes.init.value).toBe(-1)
  })

  test('armorClass augur returns correct bonus', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 23 // charmedHouse -> armorClass
    actor.system.details.birthAugurLuckMod = 2
    actor.system.config.birthAugurMode = 'static'
    expect(actor._getBirthAugurBonusFor('armorClass')).toBe(2)
    // Verify it doesn't match unrelated effect types
    expect(actor._getBirthAugurBonusFor('allAttack')).toBe(0)
  })

  test('speed augur returns correct bonus (caller multiplies by 5)', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 30 // wildChild -> speed
    actor.system.details.birthAugurLuckMod = 1
    actor.system.config.birthAugurMode = 'static'
    // _getBirthAugurBonusFor returns raw bonus; prepareDerivedData multiplies by 5
    expect(actor._getBirthAugurBonusFor('speed')).toBe(1)
    expect(actor._getBirthAugurBonusFor('speed') * 5).toBe(5)
  })

  test('negative birthAugurLuckMod applies correctly', () => {
    const actor = createPCActor()
    actor.system.details.birthAugurIndex = 1 // harshWinter -> allAttack
    actor.system.details.birthAugurLuckMod = -2
    actor.system.config.birthAugurMode = 'static'
    actor.computeMeleeAndMissileAttackAndDamage()
    // Melee: str mod (-1) + augur (-2) = -3
    expect(actor.system.details.attackHitBonus.melee.value).toBe('-3')
  })
})
