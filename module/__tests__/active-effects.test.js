/**
 * Tests for Active Effects functionality
 */

import { expect, test, describe } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'
import DCCActiveEffect from '../active-effect'

/**
 * Create an NPC actor with default mock data
 * @returns {DCCActor}
 */
function createNPC () {
  const actor = new DCCActor()
  actor.type = 'NPC'
  actor.isNPC = true
  actor.isPC = false
  return actor
}

/**
 * Create a PC actor with default mock data
 * @returns {DCCActor}
 */
function createPC () {
  const actor = new DCCActor()
  actor.type = 'Player'
  actor.isPC = true
  actor.isNPC = false
  return actor
}

/**
 * Apply the NPC save bonus logic (mirrors prepareDerivedData)
 * @param {DCCActor} actor
 */
function applyNPCSaveBonuses (actor) {
  const saves = actor.system.saves
  for (const saveId of ['ref', 'frt', 'wil']) {
    const otherBonus = parseInt(saves[saveId].otherBonus || 0)
    if (otherBonus !== 0) {
      const baseValue = parseInt(saves[saveId].value || 0)
      saves[saveId].value = baseValue + otherBonus
    }
  }
}

/**
 * Apply the NPC init bonus logic (mirrors prepareDerivedData)
 * @param {DCCActor} actor
 */
function applyNPCInitBonus (actor) {
  const initOtherMod = parseInt(actor.system.attributes.init.otherMod || 0)
  if (initOtherMod !== 0) {
    const baseInit = parseInt(actor.system.attributes.init.value || 0)
    actor.system.attributes.init.value = baseInit + initOtherMod
  }
}

/**
 * Apply the NPC AC bonus logic (mirrors prepareDerivedData when computeAC is disabled)
 * @param {DCCActor} actor
 */
function applyNPCACBonus (actor) {
  if (actor.isNPC && !actor.system.config.computeAC) {
    const acOtherMod = parseInt(actor.system.attributes.ac.otherMod || 0)
    if (acOtherMod !== 0) {
      const baseAC = parseInt(actor.system.attributes.ac.value || 10)
      actor.system.attributes.ac.value = baseAC + acOtherMod
    }
  }
}

/**
 * Build NPC attack roll terms for a weapon (mirrors rollToHit logic)
 * @param {DCCActor} actor
 * @param {object} weapon
 * @returns {Array}
 */
function buildNPCAttackTerms (actor, weapon) {
  const terms = []
  if (actor.isNPC) {
    const isMelee = weapon.system?.melee !== false
    const attackAdjustment = isMelee
      ? parseInt(actor.system.details.attackHitBonus?.melee?.adjustment) || 0
      : parseInt(actor.system.details.attackHitBonus?.missile?.adjustment) || 0
    if (attackAdjustment !== 0) {
      terms.push({
        type: 'Modifier',
        label: isMelee ? 'MeleeAttackAdjustment' : 'MissileAttackAdjustment',
        formula: attackAdjustment
      })
    }
  }
  return terms
}

/**
 * Apply NPC damage adjustment to a formula (mirrors rollWeaponAttack logic)
 * @param {DCCActor} actor
 * @param {object} weapon
 * @param {string} formula
 * @returns {string}
 */
function applyNPCDamageAdjustment (actor, weapon, formula) {
  if (actor.isNPC) {
    const isMeleeWeapon = weapon.system?.melee !== false
    const damageAdjustment = isMeleeWeapon
      ? parseInt(actor.system.details.attackDamageBonus?.melee?.adjustment) || 0
      : parseInt(actor.system.details.attackDamageBonus?.missile?.adjustment) || 0
    if (damageAdjustment !== 0) {
      formula = `${formula}${damageAdjustment >= 0 ? '+' : ''}${damageAdjustment}`
    }
  }
  return formula
}

/**
 * Set up a PC actor with attack bonus structures for testing
 * @param {object} options
 * @param {number} options.strValue
 * @param {number} options.strMod
 * @param {number} options.aglValue
 * @param {number} options.aglMod
 * @returns {DCCActor}
 */
function createPCWithAttackSetup ({ strValue = 10, strMod = 0, aglValue = 10, aglMod = 0 } = {}) {
  const actor = createPC()
  actor.system.abilities.str.value = strValue
  actor.system.abilities.str.mod = strMod
  actor.system.abilities.agl.value = aglValue
  actor.system.abilities.agl.mod = aglMod
  actor.system.details.attackBonus = '+0'
  actor.system.details.attackHitBonus = {
    melee: { value: '+0', adjustment: '+0' },
    missile: { value: '+0', adjustment: '+0' }
  }
  actor.system.details.attackDamageBonus = {
    melee: { value: '+0', adjustment: '+0' },
    missile: { value: '+0', adjustment: '+0' }
  }
  return actor
}

describe('NPC Active Effects - Save Bonuses', () => {
  test('NPC saves include otherBonus when prepareDerivedData runs', () => {
    const actor = createNPC()
    actor.system.saves.frt.value = 3
    actor.system.saves.ref.value = 2
    actor.system.saves.wil.value = 1
    actor.system.saves.frt.otherBonus = 2
    actor.system.saves.ref.otherBonus = 1
    actor.system.saves.wil.otherBonus = 0

    applyNPCSaveBonuses(actor)

    expect(actor.system.saves.frt.value).toEqual(5) // 3 + 2
    expect(actor.system.saves.ref.value).toEqual(3) // 2 + 1
    expect(actor.system.saves.wil.value).toEqual(1) // 1 + 0 (unchanged)
  })

  test('NPC saves handle zero otherBonus correctly', () => {
    const actor = createNPC()
    actor.system.saves.ref.value = 4
    actor.system.saves.frt.value = 2
    actor.system.saves.wil.value = 3
    actor.system.saves.ref.otherBonus = 0
    actor.system.saves.frt.otherBonus = 0
    actor.system.saves.wil.otherBonus = 0

    applyNPCSaveBonuses(actor)

    expect(actor.system.saves.ref.value).toEqual(4)
    expect(actor.system.saves.frt.value).toEqual(2)
    expect(actor.system.saves.wil.value).toEqual(3)
  })

  test('NPC saves handle negative otherBonus', () => {
    const actor = createNPC()
    actor.system.saves.ref.value = 5
    actor.system.saves.frt.value = 3
    actor.system.saves.wil.value = 4
    actor.system.saves.ref.otherBonus = -2
    actor.system.saves.frt.otherBonus = 0
    actor.system.saves.wil.otherBonus = -1

    applyNPCSaveBonuses(actor)

    expect(actor.system.saves.ref.value).toEqual(3) // 5 - 2
    expect(actor.system.saves.frt.value).toEqual(3) // unchanged
    expect(actor.system.saves.wil.value).toEqual(3) // 4 - 1
  })

  test('NPC saves handle missing otherBonus gracefully', () => {
    const actor = createNPC()
    actor.system.saves.ref.value = 2
    actor.system.saves.frt.value = 3
    actor.system.saves.wil.value = 1
    // Don't set otherBonus - should default to 0

    applyNPCSaveBonuses(actor)

    expect(actor.system.saves.ref.value).toEqual(2)
    expect(actor.system.saves.frt.value).toEqual(3)
    expect(actor.system.saves.wil.value).toEqual(1)
  })
})

describe('Active Effect Methods - String to Number Conversion', () => {
  test('_applyAddEffect correctly handles string values like "+0"', () => {
    const actor = new DCCActor()
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    const overrides = {}

    actor._applyAddEffect('system.details.attackHitBonus.melee.adjustment', '-20', overrides)

    // The result should be -20 (numeric addition), not '+0-20' (string concatenation)
    expect(actor.system.details.attackHitBonus.melee.adjustment).toEqual(-20)
    expect(overrides['system.details.attackHitBonus.melee.adjustment']).toEqual(-20)
  })

  test('_applyAddEffect handles positive additions to string values', () => {
    const actor = new DCCActor()
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    const overrides = {}

    actor._applyAddEffect('system.details.attackHitBonus.melee.adjustment', '5', overrides)

    expect(actor.system.details.attackHitBonus.melee.adjustment).toEqual(5)
    expect(overrides['system.details.attackHitBonus.melee.adjustment']).toEqual(5)
  })

  test('_applyAddEffect handles additions to non-zero string values', () => {
    const actor = new DCCActor()
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: '+2' },
      missile: { value: '+0', adjustment: '+0' }
    }
    const overrides = {}

    actor._applyAddEffect('system.details.attackHitBonus.melee.adjustment', '3', overrides)

    // +2 + 3 = 5
    expect(actor.system.details.attackHitBonus.melee.adjustment).toEqual(5)
    expect(overrides['system.details.attackHitBonus.melee.adjustment']).toEqual(5)
  })

  test('_applyAddEffect handles numeric current values', () => {
    const actor = new DCCActor()
    actor.system.attributes.hp.value = 10
    const overrides = {}

    actor._applyAddEffect('system.attributes.hp.value', '-5', overrides)

    expect(actor.system.attributes.hp.value).toEqual(5)
    expect(overrides['system.attributes.hp.value']).toEqual(5)
  })

  test('_applyAddEffect treats null current values as zero', () => {
    const actor = new DCCActor()
    const overrides = {}

    actor._applyAddEffect('system.nonexistent.property', '5', overrides)

    expect(overrides['system.nonexistent.property']).toEqual(5)
  })

  test('_applyAddEffect returns early for non-numeric delta values', () => {
    const actor = new DCCActor()
    actor.system.attributes.hp.value = 10
    const overrides = {}

    actor._applyAddEffect('system.attributes.hp.value', 'not-a-number', overrides)

    expect(actor.system.attributes.hp.value).toEqual(10)
    expect(overrides).toEqual({})
  })

  test('_applyMultiplyEffect correctly handles string values', () => {
    const actor = new DCCActor()
    actor.system.details.attackHitBonus = {
      melee: { value: '+2', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    const overrides = {}

    actor._applyMultiplyEffect('system.details.attackHitBonus.melee.value', '2', overrides)

    // +2 * 2 = 4
    expect(actor.system.details.attackHitBonus.melee.value).toEqual(4)
    expect(overrides['system.details.attackHitBonus.melee.value']).toEqual(4)
  })

  test('_applyMultiplyEffect handles numeric values', () => {
    const actor = new DCCActor()
    actor.system.attributes.hp.value = 10
    const overrides = {}

    actor._applyMultiplyEffect('system.attributes.hp.value', '1.5', overrides)

    expect(actor.system.attributes.hp.value).toEqual(15)
    expect(overrides['system.attributes.hp.value']).toEqual(15)
  })

  test('_applyUpgradeEffect correctly handles string values', () => {
    const actor = new DCCActor()
    actor.system.details.attackHitBonus = {
      melee: { value: '+2', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    const overrides = {}

    // Upgrade from 2 to 5 (should take the higher value)
    actor._applyUpgradeEffect('system.details.attackHitBonus.melee.value', '5', overrides)

    expect(actor.system.details.attackHitBonus.melee.value).toEqual(5)
    expect(overrides['system.details.attackHitBonus.melee.value']).toEqual(5)
  })

  test('_applyUpgradeEffect keeps current value if higher', () => {
    const actor = new DCCActor()
    actor.system.attributes.hp.value = 10
    const overrides = {}

    actor._applyUpgradeEffect('system.attributes.hp.value', '5', overrides)

    expect(actor.system.attributes.hp.value).toEqual(10)
    expect(overrides['system.attributes.hp.value']).toEqual(10)
  })

  test('_applyDowngradeEffect correctly handles string values', () => {
    const actor = new DCCActor()
    actor.system.details.attackHitBonus = {
      melee: { value: '+5', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    const overrides = {}

    // Downgrade from 5 to 2 (should take the lower value)
    actor._applyDowngradeEffect('system.details.attackHitBonus.melee.value', '2', overrides)

    expect(actor.system.details.attackHitBonus.melee.value).toEqual(2)
    expect(overrides['system.details.attackHitBonus.melee.value']).toEqual(2)
  })

  test('_applyDowngradeEffect keeps current value if lower', () => {
    const actor = new DCCActor()
    actor.system.attributes.hp.value = 5
    const overrides = {}

    actor._applyDowngradeEffect('system.attributes.hp.value', '10', overrides)

    expect(actor.system.attributes.hp.value).toEqual(5)
    expect(overrides['system.attributes.hp.value']).toEqual(5)
  })

  test('_applyOverrideEffect sets numeric values', () => {
    const actor = new DCCActor()
    actor.system.attributes.hp.value = 10
    const overrides = {}

    actor._applyOverrideEffect('system.attributes.hp.value', '25', overrides)

    expect(actor.system.attributes.hp.value).toEqual(25)
    expect(overrides['system.attributes.hp.value']).toEqual(25)
  })

  test('_applyOverrideEffect preserves string values when non-numeric', () => {
    const actor = new DCCActor()
    actor.system.details.alignment = 'l'
    const overrides = {}

    actor._applyOverrideEffect('system.details.alignment', 'c', overrides)

    expect(actor.system.details.alignment).toEqual('c')
    expect(overrides['system.details.alignment']).toEqual('c')
  })
})

describe('Active Effects - Attack Bonus Adjustments', () => {
  test('Melee attack adjustment affects computed melee attack bonus', () => {
    const actor = createPCWithAttackSetup({ strValue: 14, strMod: 1 })
    const overrides = {}

    actor._applyAddEffect('system.details.attackHitBonus.melee.adjustment', '2', overrides)
    actor.computeMeleeAndMissileAttackAndDamage()

    // Base attack (+0) + STR (+1) + adjustment (+2) = +3
    expect(actor.system.details.attackHitBonus.melee.value).toEqual('+3')
  })

  test('Missile attack adjustment affects computed missile attack bonus', () => {
    const actor = createPCWithAttackSetup({ aglValue: 16, aglMod: 2 })
    const overrides = {}

    actor._applyAddEffect('system.details.attackHitBonus.missile.adjustment', '-1', overrides)
    actor.computeMeleeAndMissileAttackAndDamage()

    // Base attack (+0) + AGL (+2) + adjustment (-1) = +1
    expect(actor.system.details.attackHitBonus.missile.value).toEqual('+1')
  })

  test('Damage adjustment affects computed melee damage bonus', () => {
    const actor = createPCWithAttackSetup({ strValue: 14, strMod: 1 })
    const overrides = {}

    actor._applyAddEffect('system.details.attackDamageBonus.melee.adjustment', '3', overrides)
    actor.computeMeleeAndMissileAttackAndDamage()

    // STR (+1) + adjustment (+3) = +4
    expect(actor.system.details.attackDamageBonus.melee.value).toEqual('+4')
  })
})

describe('NPC Active Effects - Initiative', () => {
  test('NPC initiative includes otherMod when prepareDerivedData runs', () => {
    const actor = createNPC()
    actor.system.attributes.init.value = 2
    actor.system.attributes.init.otherMod = 3

    applyNPCInitBonus(actor)

    expect(actor.system.attributes.init.value).toEqual(5) // 2 + 3
  })

  test('NPC initiative handles negative otherMod', () => {
    const actor = createNPC()
    actor.system.attributes.init.value = 4
    actor.system.attributes.init.otherMod = -2

    applyNPCInitBonus(actor)

    expect(actor.system.attributes.init.value).toEqual(2) // 4 - 2
  })

  test('NPC initiative handles zero otherMod correctly', () => {
    const actor = createNPC()
    actor.system.attributes.init.value = 3
    actor.system.attributes.init.otherMod = 0

    applyNPCInitBonus(actor)

    expect(actor.system.attributes.init.value).toEqual(3)
  })

  test('NPC initiative handles missing otherMod gracefully', () => {
    const actor = createNPC()
    actor.system.attributes.init.value = 5
    // Don't set otherMod

    applyNPCInitBonus(actor)

    expect(actor.system.attributes.init.value).toEqual(5)
  })
})

describe('NPC Active Effects - AC', () => {
  test('NPC AC includes otherMod when computeAC is disabled', () => {
    const actor = createNPC()
    actor.system.attributes.ac.value = 14
    actor.system.attributes.ac.otherMod = 2
    actor.system.config.computeAC = false

    applyNPCACBonus(actor)

    expect(actor.system.attributes.ac.value).toEqual(16) // 14 + 2
  })

  test('NPC AC handles negative otherMod', () => {
    const actor = createNPC()
    actor.system.attributes.ac.value = 12
    actor.system.attributes.ac.otherMod = -3
    actor.system.config.computeAC = false

    applyNPCACBonus(actor)

    expect(actor.system.attributes.ac.value).toEqual(9) // 12 - 3
  })

  test('NPC AC does not apply otherMod when computeAC is enabled', () => {
    const actor = createNPC()
    actor.system.attributes.ac.value = 14
    actor.system.attributes.ac.otherMod = 2
    actor.system.config.computeAC = true

    applyNPCACBonus(actor)

    // Value should remain unchanged (computeAC would handle it separately)
    expect(actor.system.attributes.ac.value).toEqual(14)
  })

  test('NPC AC handles zero otherMod correctly', () => {
    const actor = createNPC()
    actor.system.attributes.ac.value = 15
    actor.system.attributes.ac.otherMod = 0
    actor.system.config.computeAC = false

    applyNPCACBonus(actor)

    expect(actor.system.attributes.ac.value).toEqual(15)
  })
})

describe('NPC Active Effects - Attack Roll Adjustments', () => {
  test('NPC melee attack includes adjustment in roll terms', () => {
    const actor = createNPC()
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: 2 },
      missile: { value: '+0', adjustment: 0 }
    }

    const terms = buildNPCAttackTerms(actor, { system: { melee: true } })

    expect(terms.length).toEqual(1)
    expect(terms[0].formula).toEqual(2)
    expect(terms[0].label).toEqual('MeleeAttackAdjustment')
  })

  test('NPC missile attack includes adjustment in roll terms', () => {
    const actor = createNPC()
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: 0 },
      missile: { value: '+0', adjustment: -1 }
    }

    const terms = buildNPCAttackTerms(actor, { system: { melee: false } })

    expect(terms.length).toEqual(1)
    expect(terms[0].formula).toEqual(-1)
    expect(terms[0].label).toEqual('MissileAttackAdjustment')
  })

  test('NPC attack does not add term when adjustment is zero', () => {
    const actor = createNPC()
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: 0 },
      missile: { value: '+0', adjustment: 0 }
    }

    const terms = buildNPCAttackTerms(actor, { system: { melee: true } })

    expect(terms.length).toEqual(0)
  })

  test('PC attack does not add adjustment term (already computed)', () => {
    const actor = createPC()
    actor.system.details.attackHitBonus = {
      melee: { value: '+3', adjustment: 2 },
      missile: { value: '+0', adjustment: 0 }
    }

    // buildNPCAttackTerms checks actor.isNPC, so PCs get no terms
    const terms = buildNPCAttackTerms(actor, { system: { melee: true } })

    expect(terms.length).toEqual(0)
  })
})

describe('NPC Active Effects - Damage Roll Adjustments', () => {
  test('NPC melee damage includes adjustment in formula', () => {
    const actor = createNPC()
    actor.system.details.attackDamageBonus = {
      melee: { value: '+0', adjustment: 3 },
      missile: { value: '+0', adjustment: 0 }
    }

    const result = applyNPCDamageAdjustment(actor, { system: { melee: true } }, '1d6+2')

    expect(result).toEqual('1d6+2+3')
  })

  test('NPC missile damage includes adjustment in formula', () => {
    const actor = createNPC()
    actor.system.details.attackDamageBonus = {
      melee: { value: '+0', adjustment: 0 },
      missile: { value: '+0', adjustment: 2 }
    }

    const result = applyNPCDamageAdjustment(actor, { system: { melee: false } }, '1d8')

    expect(result).toEqual('1d8+2')
  })

  test('NPC damage handles negative adjustment', () => {
    const actor = createNPC()
    actor.system.details.attackDamageBonus = {
      melee: { value: '+0', adjustment: -2 },
      missile: { value: '+0', adjustment: 0 }
    }

    const result = applyNPCDamageAdjustment(actor, { system: { melee: true } }, '1d6+1')

    expect(result).toEqual('1d6+1-2')
  })

  test('NPC damage does not modify formula when adjustment is zero', () => {
    const actor = createNPC()
    actor.system.details.attackDamageBonus = {
      melee: { value: '+0', adjustment: 0 },
      missile: { value: '+0', adjustment: 0 }
    }

    const result = applyNPCDamageAdjustment(actor, { system: { melee: true } }, '1d6+2')

    expect(result).toEqual('1d6+2')
  })

  test('PC damage does not add adjustment (already computed)', () => {
    const actor = createPC()
    actor.system.details.attackDamageBonus = {
      melee: { value: '+4', adjustment: 3 },
      missile: { value: '+0', adjustment: 0 }
    }

    // applyNPCDamageAdjustment checks actor.isNPC, so PCs get no modification
    const result = applyNPCDamageAdjustment(actor, { system: { melee: true } }, '1d6+4')

    expect(result).toEqual('1d6+4')
  })
})

describe('Active Effects - @-Variable Resolution', () => {
  test('resolveValue replaces @path with actor data value', () => {
    const actor = new DCCActor()
    actor.system.abilities.lck.value = 16
    actor.system.abilities.lck.mod = 2

    const result = DCCActiveEffect.resolveValue(actor, '@system.abilities.lck.mod')
    expect(result).toEqual('2')
  })

  test('resolveValue returns plain numbers unchanged', () => {
    const actor = new DCCActor()
    expect(DCCActiveEffect.resolveValue(actor, '5')).toEqual('5')
    expect(DCCActiveEffect.resolveValue(actor, '-2')).toEqual('-2')
    expect(DCCActiveEffect.resolveValue(actor, '+3')).toEqual('+3')
  })

  test('resolveValue returns non-string values unchanged', () => {
    const actor = new DCCActor()
    expect(DCCActiveEffect.resolveValue(actor, 5)).toEqual(5)
    expect(DCCActiveEffect.resolveValue(actor, null)).toEqual(null)
    expect(DCCActiveEffect.resolveValue(actor, undefined)).toEqual(undefined)
  })

  test('resolveValue handles undefined paths by returning 0', () => {
    const actor = new DCCActor()
    const result = DCCActiveEffect.resolveValue(actor, '@system.nonexistent.path')
    expect(result).toEqual('0')
  })

  test('resolveValue handles negative modifier values', () => {
    const actor = new DCCActor()
    actor.system.abilities.str.mod = -2

    const result = DCCActiveEffect.resolveValue(actor, '@system.abilities.str.mod')
    expect(result).toEqual('-2')
  })

  test('resolveValue handles zero values', () => {
    const actor = new DCCActor()
    actor.system.abilities.str.mod = 0

    const result = DCCActiveEffect.resolveValue(actor, '@system.abilities.str.mod')
    expect(result).toEqual('0')
  })

  test('resolveValue handles string values on actor by returning 0', () => {
    const actor = new DCCActor()
    actor.system.details.alignment = 'l'

    const result = DCCActiveEffect.resolveValue(actor, '@system.details.alignment')
    expect(result).toEqual('0')
  })

  test('melee attack adjustment works with @-variable reference', () => {
    const actor = createPCWithAttackSetup({ strValue: 14, strMod: 1 })
    actor.system.abilities.lck.value = 16
    actor.system.abilities.lck.mod = 2

    // Resolve the @-variable and apply as an add effect
    const resolvedValue = DCCActiveEffect.resolveValue(actor, '@system.abilities.lck.mod')
    const overrides = {}
    actor._applyAddEffect('system.details.attackHitBonus.melee.adjustment', resolvedValue, overrides)

    actor.computeMeleeAndMissileAttackAndDamage()

    // Base attack (+0) + STR (+1) + luck adjustment (+2) = +3
    expect(actor.system.details.attackHitBonus.melee.value).toEqual('+3')
  })

  test('applyActiveEffects resolves @-variable in effect changes end-to-end', () => {
    const actor = createPCWithAttackSetup({ strValue: 14, strMod: 1 })
    actor.system.abilities.lck.value = 16
    actor.system.abilities.lck.mod = 2

    // Add a mock effect with an @-variable value to the actor's effects collection
    const mockEffect = {
      disabled: false,
      isSuppressed: false,
      changes: [
        { key: 'system.details.attackHitBonus.melee.adjustment', mode: 2, value: '@system.abilities.lck.mod' }
      ]
    }
    actor.effects = new global.Collection([['luck-effect', mockEffect]])

    actor.applyActiveEffects()
    actor.computeMeleeAndMissileAttackAndDamage()

    // Base attack (+0) + STR (+1) + luck adjustment (+2) = +3
    expect(actor.system.details.attackHitBonus.melee.value).toEqual('+3')
  })
})
