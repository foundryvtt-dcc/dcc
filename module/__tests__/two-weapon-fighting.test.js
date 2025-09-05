import { expect, vi, describe, it, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import DCCItem from '../item.js'

describe('Two-Weapon Fighting', () => {
  let actor

  // Helper function to create properly configured actor
  function createActor (agilityValue, className = 'Warrior') {
    return new DCCActor({
      type: 'Player',
      system: {
        abilities: {
          str: { value: 10, mod: 0 },
          agl: { value: agilityValue, mod: Math.floor((agilityValue - 10) / 2) },
          sta: { value: 10, mod: 0 },
          int: { value: 10, mod: 0 },
          per: { value: 10, mod: 0 },
          lck: { value: 10, mod: 0 }
        },
        attributes: {
          actionDice: { value: '1d20' },
          init: { value: 1 },
          hp: { value: 4, max: 4 }
        },
        details: {
          attackBonus: '+0',
          attackHitBonus: {
            melee: { value: '+0', adjustment: '+0' },
            missile: { value: '+0', adjustment: '+0' }
          },
          attackDamageBonus: {
            melee: { value: '+0', adjustment: '+0' },
            missile: { value: '+0', adjustment: '+0' }
          },
          level: { value: 1 }
        },
        class: { className },
        config: {}
      }
    })
  }

  // Helper function to create properly configured weapon
  function createWeapon (actor, weaponOptions) {
    const weapon = new DCCItem({
      type: 'weapon',
      system: {
        actionDie: '1d20',
        trained: true,
        config: {},
        ...weaponOptions
      }
    }, { parent: actor })

    // Manually set actor reference since mocks don't handle parent correctly
    weapon.actor = actor
    return weapon
  }

  beforeEach(() => {
    vi.clearAllMocks()
    actor = createActor(14) // Default to agility 14
  })

  describe('Critical Hit Ranges - Low Agility (≤15)', () => {
    beforeEach(() => {
      actor = createActor(14, 'Warrior')
    })

    it('should prevent critical hits for two-weapon primary with low agility', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(21) // No crits possible
    })

    it('should prevent critical hits for two-weapon secondary with low agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(21) // No crits possible
    })

    it('should apply dice penalty for two-weapon primary with low agility', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d16.*\[2-weapon]/) // -1 penalty for agility 14
    })

    it('should apply dice penalty for two-weapon secondary with low agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d14.*\[2-weapon]/) // -2 penalty for agility 14
    })
  })

  describe('Critical Hit Ranges - Medium Agility (16-17)', () => {
    beforeEach(() => {
      actor = createActor(16, 'Warrior')
    })

    it('should allow two-weapon primary to crit on max die result', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(16) // Can crit on modified die max (1d16 after penalty)
    })

    it('should prevent two-weapon secondary from critting', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(51) // No crits possible
    })

    it('should apply minor penalty to two-weapon primary with medium agility', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d16.*\[2-weapon]/) // -1 penalty for agility 16
    })

    it('should apply -1 penalty to two-weapon secondary with medium agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d16.*\[2-weapon]/) // -1 penalty
    })
  })

  describe('Critical Hit Ranges - High Agility (≥18)', () => {
    beforeEach(() => {
      actor = createActor(18, 'Warrior')
    })

    it('should allow two-weapon primary normal crit range with high agility', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(20) // Normal crit range (no penalty)
    })

    it('should prevent two-weapon secondary from critting with high agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(51) // No crits possible
    })
  })

  describe('Halfling Special Rules', () => {
    beforeEach(() => {
      actor = createActor(12, 'Halfling')
    })

    it('should set halfling crit range to 16 for agility 17 or lower', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(16) // 16 for halflings with agility ≤17
    })

    it('should use minimum effective agility of 16 for halflings', () => {
      actor = createActor(10, 'Halfling') // Very low agility

      const primary = createWeapon(actor, { twoWeaponPrimary: true })
      const secondary = createWeapon(actor, { twoWeaponSecondary: true })

      primary.prepareBaseData()
      secondary.prepareBaseData()

      // Should behave as if agility is 16 (-1 penalty for both hands)
      expect(primary.system.actionDie).toMatch(/d16.*\[2-weapon]/)
      expect(secondary.system.actionDie).toMatch(/d16.*\[2-weapon]/)
    })

    it('should use normal two-weapon rules for halflings with high agility (18+)', () => {
      actor = createActor(18, 'Halfling') // High agility - should use normal rules

      const primary = createWeapon(actor, { twoWeaponPrimary: true })
      const secondary = createWeapon(actor, { twoWeaponSecondary: true })

      primary.prepareBaseData()
      secondary.prepareBaseData()

      // Should follow normal agility 18+ rules, not special halfling rules
      expect(primary.system.actionDie).toBe('1d20') // No penalty for primary at 18+
      expect(secondary.system.actionDie).toMatch(/d16.*\[2-weapon]/) // -1 penalty for secondary
      expect(primary.system.critRange).toBe(20) // Normal crit range, not 16
      expect(secondary.system.critRange).toBe(51) // Secondary can't crit
    })
  })

  describe('Non Two-Weapon Weapons', () => {
    it('should not modify normal weapons', () => {
      actor = createActor(10, 'Warrior')

      const weapon = createWeapon(actor, { twoWeaponPrimary: false, twoWeaponSecondary: false })

      weapon.prepareBaseData()

      expect(weapon.system.actionDie).toBe('1d20')
      expect(weapon.system.critRange).toBe(20) // Default actor crit range
    })
  })

  describe('Agility Score Edge Cases', () => {
    const testCases = [
      { agility: 8, primaryPenalty: 3, secondaryPenalty: 4, expectedPrimaryDie: 'd12', expectedSecondaryDie: 'd10' },
      { agility: 12, primaryPenalty: 1, secondaryPenalty: 2, expectedPrimaryDie: 'd16', expectedSecondaryDie: 'd14' },
      { agility: 15, primaryPenalty: 1, secondaryPenalty: 2, expectedPrimaryDie: 'd16', expectedSecondaryDie: 'd14' },
      { agility: 16, primaryPenalty: 1, secondaryPenalty: 1, expectedPrimaryDie: 'd16', expectedSecondaryDie: 'd16' },
      { agility: 17, primaryPenalty: 1, secondaryPenalty: 1, expectedPrimaryDie: 'd16', expectedSecondaryDie: 'd16' },
      { agility: 18, primaryPenalty: 0, secondaryPenalty: 1, expectedPrimaryDie: 'd20', expectedSecondaryDie: 'd16' },
      { agility: 20, primaryPenalty: 0, secondaryPenalty: 1, expectedPrimaryDie: 'd20', expectedSecondaryDie: 'd16' }
    ]

    testCases.forEach(({ agility, primaryPenalty, secondaryPenalty, expectedPrimaryDie, expectedSecondaryDie }) => {
      it(`should handle agility ${agility} correctly`, () => {
        actor = createActor(agility, 'Warrior')

        const primary = createWeapon(actor, { twoWeaponPrimary: true })
        const secondary = createWeapon(actor, { twoWeaponSecondary: true })

        primary.prepareBaseData()
        secondary.prepareBaseData()

        if (primaryPenalty === 0) {
          expect(primary.system.actionDie).toBe('1d20')
        } else {
          expect(primary.system.actionDie).toMatch(new RegExp(`${expectedPrimaryDie}.*\\[2-weapon\\]`))
        }

        if (secondaryPenalty === 0) {
          expect(secondary.system.actionDie).toBe('1d20')
        } else {
          expect(secondary.system.actionDie).toMatch(new RegExp(`${expectedSecondaryDie}.*\\[2-weapon\\]`))
        }
      })
    })
  })

  describe('Die Size Crit Range Calculation', () => {
    beforeEach(() => {
      actor = createActor(16, 'Warrior') // Medium agility for testing primary weapon crit on max
    })

    it('should set crit range based on actor action die, not weapon override', () => {
      const testDice = ['1d20', '1d24', '1d30', '1d16', '1d12']
      const expectedCrit = 16 // Based on modified die after two-weapon penalty (1d16)

      testDice.forEach((die, index) => {
        const weapon = createWeapon(actor, { twoWeaponPrimary: true, actionDie: die })

        weapon.prepareBaseData()
        expect(weapon.system.critRange).toBe(expectedCrit) // 16 from modified 1d16 die
      })
    })
  })
})
