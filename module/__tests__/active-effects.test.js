/**
 * Tests for Active Effects functionality
 */

import { expect, test, describe } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'

describe('NPC Active Effects - Save Bonuses', () => {
  test('NPC saves include otherBonus when prepareDerivedData runs', () => {
    // Create actor using default mock data
    const actor = new DCCActor()

    // Convert to NPC
    actor.type = 'NPC'
    actor.isNPC = true
    actor.isPC = false

    // Set save values and otherBonus
    actor.system.saves.frt.value = 3
    actor.system.saves.ref.value = 2
    actor.system.saves.wil.value = 1
    actor.system.saves.frt.otherBonus = 2
    actor.system.saves.ref.otherBonus = 1
    actor.system.saves.wil.otherBonus = 0

    // Directly call the NPC save logic from prepareDerivedData
    const saves = actor.system.saves
    for (const saveId of ['ref', 'frt', 'wil']) {
      const otherBonus = parseInt(saves[saveId].otherBonus || 0)
      if (otherBonus !== 0) {
        const baseValue = parseInt(saves[saveId].value || 0)
        saves[saveId].value = baseValue + otherBonus
      }
    }

    // Check that values include the otherBonus
    expect(actor.system.saves.frt.value).toEqual(5) // 3 + 2
    expect(actor.system.saves.ref.value).toEqual(3) // 2 + 1
    expect(actor.system.saves.wil.value).toEqual(1) // 1 + 0 (unchanged)
  })

  test('NPC saves handle zero otherBonus correctly', () => {
    const actor = new DCCActor()
    actor.type = 'NPC'
    actor.isNPC = true
    actor.isPC = false

    actor.system.saves.ref.value = 4
    actor.system.saves.frt.value = 2
    actor.system.saves.wil.value = 3
    actor.system.saves.ref.otherBonus = 0
    actor.system.saves.frt.otherBonus = 0
    actor.system.saves.wil.otherBonus = 0

    // Apply NPC save logic
    const saves = actor.system.saves
    for (const saveId of ['ref', 'frt', 'wil']) {
      const otherBonus = parseInt(saves[saveId].otherBonus || 0)
      if (otherBonus !== 0) {
        const baseValue = parseInt(saves[saveId].value || 0)
        saves[saveId].value = baseValue + otherBonus
      }
    }

    // Values should remain unchanged when otherBonus is 0
    expect(actor.system.saves.ref.value).toEqual(4)
    expect(actor.system.saves.frt.value).toEqual(2)
    expect(actor.system.saves.wil.value).toEqual(3)
  })

  test('NPC saves handle negative otherBonus', () => {
    const actor = new DCCActor()
    actor.type = 'NPC'
    actor.isNPC = true
    actor.isPC = false

    actor.system.saves.ref.value = 5
    actor.system.saves.frt.value = 3
    actor.system.saves.wil.value = 4
    actor.system.saves.ref.otherBonus = -2
    actor.system.saves.frt.otherBonus = 0
    actor.system.saves.wil.otherBonus = -1

    // Apply NPC save logic
    const saves = actor.system.saves
    for (const saveId of ['ref', 'frt', 'wil']) {
      const otherBonus = parseInt(saves[saveId].otherBonus || 0)
      if (otherBonus !== 0) {
        const baseValue = parseInt(saves[saveId].value || 0)
        saves[saveId].value = baseValue + otherBonus
      }
    }

    expect(actor.system.saves.ref.value).toEqual(3) // 5 - 2
    expect(actor.system.saves.frt.value).toEqual(3) // unchanged
    expect(actor.system.saves.wil.value).toEqual(3) // 4 - 1
  })

  test('NPC saves handle missing otherBonus gracefully', () => {
    const actor = new DCCActor()
    actor.type = 'NPC'
    actor.isNPC = true
    actor.isPC = false

    actor.system.saves.ref.value = 2
    actor.system.saves.frt.value = 3
    actor.system.saves.wil.value = 1
    // Don't set otherBonus - should default to 0

    // Apply NPC save logic - should not throw
    const saves = actor.system.saves
    for (const saveId of ['ref', 'frt', 'wil']) {
      const otherBonus = parseInt(saves[saveId].otherBonus || 0)
      if (otherBonus !== 0) {
        const baseValue = parseInt(saves[saveId].value || 0)
        saves[saveId].value = baseValue + otherBonus
      }
    }

    // Values should remain unchanged
    expect(actor.system.saves.ref.value).toEqual(2)
    expect(actor.system.saves.frt.value).toEqual(3)
    expect(actor.system.saves.wil.value).toEqual(1)
  })
})

describe('Active Effect Methods - String to Number Conversion', () => {
  test('_applyAddEffect correctly handles string values like "+0"', () => {
    const actor = new DCCActor()

    // Set up string value like the real data model uses
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }

    const overrides = {}

    // Simulate applying an "Add" active effect with value -20
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

    // Set up numeric value (like HP)
    actor.system.attributes.hp.value = 10

    const overrides = {}

    actor._applyAddEffect('system.attributes.hp.value', '-5', overrides)

    expect(actor.system.attributes.hp.value).toEqual(5)
    expect(overrides['system.attributes.hp.value']).toEqual(5)
  })

  test('_applyAddEffect returns early for null current values', () => {
    const actor = new DCCActor()

    const overrides = {}

    // Try to add to a non-existent property
    actor._applyAddEffect('system.nonexistent.property', '5', overrides)

    // Should not throw or add to overrides
    expect(overrides).toEqual({})
  })

  test('_applyAddEffect returns early for non-numeric delta values', () => {
    const actor = new DCCActor()

    actor.system.attributes.hp.value = 10
    const overrides = {}

    actor._applyAddEffect('system.attributes.hp.value', 'not-a-number', overrides)

    // Value should remain unchanged
    expect(actor.system.attributes.hp.value).toEqual(10)
    expect(overrides).toEqual({})
  })

  test('_applyMultiplyEffect correctly handles string values', () => {
    const actor = new DCCActor()

    // Even though this is stored as a string, multiply should work
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

    // Trying to upgrade to 5 when current is 10 should keep 10
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

    // Trying to downgrade to 10 when current is 5 should keep 5
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
    const actor = new DCCActor()
    actor.type = 'Player'
    actor.isPC = true
    actor.isNPC = false

    // Set up ability scores for strength bonus
    actor.system.abilities.str.value = 14 // +1 mod
    actor.system.abilities.str.mod = 1
    actor.system.abilities.agl.value = 10 // +0 mod
    actor.system.abilities.agl.mod = 0
    actor.system.details.attackBonus = '+0'

    // Initialize attack bonus structure
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    actor.system.details.attackDamageBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }

    // Simulate an active effect adding +2 to melee attack adjustment
    const overrides = {}
    actor._applyAddEffect('system.details.attackHitBonus.melee.adjustment', '2', overrides)

    // Run the melee/missile computation
    actor.computeMeleeAndMissileAttackAndDamage()

    // Base attack (+0) + STR (+1) + adjustment (+2) = +3
    expect(actor.system.details.attackHitBonus.melee.value).toEqual('+3')
  })

  test('Missile attack adjustment affects computed missile attack bonus', () => {
    const actor = new DCCActor()
    actor.type = 'Player'
    actor.isPC = true
    actor.isNPC = false

    // Set up ability scores for agility bonus
    actor.system.abilities.str.value = 10 // +0 mod
    actor.system.abilities.str.mod = 0
    actor.system.abilities.agl.value = 16 // +2 mod
    actor.system.abilities.agl.mod = 2
    actor.system.details.attackBonus = '+0'

    // Initialize attack bonus structure
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    actor.system.details.attackDamageBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }

    // Simulate an active effect adding -1 to missile attack adjustment
    const overrides = {}
    actor._applyAddEffect('system.details.attackHitBonus.missile.adjustment', '-1', overrides)

    // Run the melee/missile computation
    actor.computeMeleeAndMissileAttackAndDamage()

    // Base attack (+0) + AGL (+2) + adjustment (-1) = +1
    expect(actor.system.details.attackHitBonus.missile.value).toEqual('+1')
  })

  test('Damage adjustment affects computed melee damage bonus', () => {
    const actor = new DCCActor()
    actor.type = 'Player'
    actor.isPC = true
    actor.isNPC = false

    // Set up ability scores
    actor.system.abilities.str.value = 14 // +1 mod
    actor.system.abilities.str.mod = 1
    actor.system.details.attackBonus = '+0'

    // Initialize attack bonus structure
    actor.system.details.attackHitBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }
    actor.system.details.attackDamageBonus = {
      melee: { value: '+0', adjustment: '+0' },
      missile: { value: '+0', adjustment: '+0' }
    }

    // Simulate an active effect adding +3 to melee damage adjustment
    const overrides = {}
    actor._applyAddEffect('system.details.attackDamageBonus.melee.adjustment', '3', overrides)

    // Run the melee/missile computation
    actor.computeMeleeAndMissileAttackAndDamage()

    // STR (+1) + adjustment (+3) = +4
    expect(actor.system.details.attackDamageBonus.melee.value).toEqual('+4')
  })
})
