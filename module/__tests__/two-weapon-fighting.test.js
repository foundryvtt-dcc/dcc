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
          level: { value: 1 },
          sheetClass: className
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
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritNone')
      // The crit rule is applied at roll time (#996): no 21/51 sentinel range.
      expect(weapon.system.critRange).toBe(20)
    })

    it('should prevent critical hits for two-weapon secondary with low agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritNone')
      expect(weapon.system.critRange).toBe(20)
    })

    it('should apply dice penalty for two-weapon primary with low agility', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d16.*\[2w-primary]/) // -1 penalty for agility 14
    })

    it('should apply dice penalty for two-weapon secondary with low agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d14.*\[2w-off-hand]/) // -2 penalty for agility 14
    })

    // #834: the raw penalty is kept as derived data so the multiple-action-dice
    // extra-die override can re-apply it to the chosen slot's base die.
    it('should record the raw dice penalty for both hands', () => {
      const primary = createWeapon(actor, { twoWeaponPrimary: true })
      primary.prepareBaseData()
      expect(primary.system.twoWeaponDicePenalty).toBe(-1)

      const secondary = createWeapon(actor, { twoWeaponSecondary: true })
      secondary.prepareBaseData()
      expect(secondary.system.twoWeaponDicePenalty).toBe(-2)
    })
  })

  describe('Critical Hit Ranges - Medium Agility (16-17)', () => {
    beforeEach(() => {
      actor = createActor(16, 'Warrior')
    })

    it('should allow two-weapon primary to crit on max die result', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      // Crits on the max face of whatever die is rolled, if it beats AC —
      // judged at roll time by the lib's applyTwoWeaponHandRules (#996).
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritMaxBeatsAC')
      expect(weapon.system.critRange).toBe(20)
    })

    it('should prevent two-weapon secondary from critting', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritNone')
    })

    it('should apply minor penalty to two-weapon primary with medium agility', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d16.*\[2w-primary]/) // -1 penalty for agility 16
    })

    it('should apply -1 penalty to two-weapon secondary with medium agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d16.*\[2w-off-hand]/) // -1 penalty
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
      expect(weapon.system.twoWeaponCritRule).toBe('')
    })

    // Table 4-3, 18+ row: "Primary hand scores critical hits as normal" —
    // a warrior keeps an improved threat range (#996).
    it('should keep an improved crit range on the primary with high agility', () => {
      actor.system.details.critRange = 19
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(19)
      expect(weapon.system.twoWeaponCritRule).toBe('')
    })

    it('should prevent two-weapon secondary from critting with high agility', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritNone')
    })
  })

  describe('Halfling Special Rules', () => {
    beforeEach(() => {
      actor = createActor(12, 'Halfling')
    })

    it('should crit and auto-hit on the max face for agility 17 or lower', () => {
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      // The natural max of whatever die is rolled (a 1d14 extra die fought at
      // 1d12 crits on 12), judged at roll time (#996).
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritMaxAutoHit')
    })

    it('should give the halfling off-hand the same max-die crit as the primary', () => {
      const weapon = createWeapon(actor, { twoWeaponSecondary: true })

      weapon.prepareBaseData()
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritMaxAutoHit')
    })

    it('should let an actionDieOverride replace the penalized die', () => {
      const weapon = createWeapon(actor, {
        twoWeaponPrimary: true,
        config: { actionDieOverride: '1d12' }
      })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toBe('1d12')
      expect(weapon.system.twoWeaponCritRule).toBe('TwoWeaponCritMaxAutoHit')
    })

    it('should penalize a smaller base action die down the dice chain', () => {
      actor.system.attributes.actionDice.value = '1d14'
      const weapon = createWeapon(actor, { twoWeaponPrimary: true })

      weapon.prepareBaseData()
      expect(weapon.system.actionDie).toMatch(/d12.*\[2w-primary]/)
    })

    it('should use minimum effective agility of 16 for halflings', () => {
      actor = createActor(10, 'Halfling') // Very low agility

      const primary = createWeapon(actor, { twoWeaponPrimary: true })
      const secondary = createWeapon(actor, { twoWeaponSecondary: true })

      primary.prepareBaseData()
      secondary.prepareBaseData()

      // Should behave as if agility is 16 (-1 penalty for both hands)
      expect(primary.system.actionDie).toMatch(/d16.*\[2w-primary]/)
      expect(secondary.system.actionDie).toMatch(/d16.*\[2w-off-hand]/)
    })

    it('should use normal two-weapon rules for halflings with high agility (18+)', () => {
      actor = createActor(18, 'Halfling') // High agility - should use normal rules

      const primary = createWeapon(actor, { twoWeaponPrimary: true })
      const secondary = createWeapon(actor, { twoWeaponSecondary: true })

      primary.prepareBaseData()
      secondary.prepareBaseData()

      // Should follow normal agility 18+ rules, not special halfling rules
      expect(primary.system.actionDie).toBe('1d20') // No penalty for primary at 18+
      expect(secondary.system.actionDie).toMatch(/d16.*\[2w-off-hand]/) // -1 penalty for secondary
      expect(primary.system.twoWeaponCritRule).toBe('') // Normal crits, not max-die
      expect(secondary.system.twoWeaponCritRule).toBe('TwoWeaponCritNone')
    })
  })

  describe('Non Two-Weapon Weapons', () => {
    it('should not modify normal weapons', () => {
      actor = createActor(10, 'Warrior')

      const weapon = createWeapon(actor, { twoWeaponPrimary: false, twoWeaponSecondary: false })

      weapon.prepareBaseData()

      expect(weapon.system.actionDie).toBe('1d20')
      expect(weapon.system.critRange).toBe(20) // Default actor crit range
      expect(weapon.system.twoWeaponCritRule).toBeUndefined()
      expect(weapon.system.twoWeaponDicePenalty).toBeUndefined()
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
          expect(primary.system.actionDie).toMatch(new RegExp(`${expectedPrimaryDie}.*\\[2w-primary\\]`))
        }

        if (secondaryPenalty === 0) {
          expect(secondary.system.actionDie).toBe('1d20')
        } else {
          expect(secondary.system.actionDie).toMatch(new RegExp(`${expectedSecondaryDie}.*\\[2w-off-hand\\]`))
        }
      })
    })
  })

  describe('Die Size Crit Range Calculation', () => {
    beforeEach(() => {
      actor = createActor(16, 'Warrior') // Medium agility for testing primary weapon crit on max
    })

    it('should derive the die from the actor action die, not the weapon die', () => {
      for (const die of ['1d20', '1d24', '1d30', '1d16', '1d12']) {
        const weapon = createWeapon(actor, { twoWeaponPrimary: true, actionDie: die })

        weapon.prepareBaseData()
        expect(weapon.system.actionDie).toMatch(/^1d16\[2w-primary]/)
      }
    })
  })
})
