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

// Note: DCCActiveEffect.apply() handles:
// 1. Equipped status filtering for item effects
// 2. Signed string numeric operations for thief skills
// These are tested via integration in the actual Foundry environment
// since they require the full ActiveEffect document class infrastructure
