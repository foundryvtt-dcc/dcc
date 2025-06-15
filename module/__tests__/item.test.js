import { describe, beforeEach, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCItem from '../item.js'

describe('DCCItem Weapon Calculations', () => {
  let item, actor, prepareBaseDataSpy

  beforeEach(() => {
    actor = {
      type: 'Player',
      system: {
        abilities: {
          str: { value: 14 },
          agl: { value: 13 },
          sta: { value: 10 },
          per: { value: 8 },
          int: { value: 12 },
          luck: { value: 16 }
        },
        attributes: {
          init: { die: '1d20', value: '+2' },
          actionDice: { value: '1d20' },
          critical: { die: '1d6', table: 'III' }
        },
        details: {
          attackHitBonus: { melee: { value: '+2' }, missile: { value: '+1' } },
          attackDamageBonus: { melee: { value: '+3' }, missile: { value: '+1' } },
          critRange: 19
        }
      }
    }

    item = new DCCItem({ type: 'weapon', name: 'longsword' }, {})
    const systemOverrideData = {
      twoHanded: false,
      config: {},
      melee: true,
      damage: '1d8',
      damageWeapon: '1d8',
      damageWeaponBonus: '+2',
      attackBonusWeapon: '+1',
      attackBonusLucky: '+1',
      initiativeWeaponBonus: '+1'
    }
    Object.assign(item.system, systemOverrideData)
    item.actor = actor
    prepareBaseDataSpy = vi.spyOn(DCCItem.prototype, 'prepareBaseData')
    console.log(item)
  })

  test('should calculate initiative die correctly', () => {
    item.prepareBaseData()
    expect(prepareBaseDataSpy).toHaveBeenCalled()
    expect(item.system.initiativeDie).toBe('1d20')
  })

  test('should calculate initiative bonus correctly', () => {
    item.prepareBaseData()
    expect(item.system.initiativeBonus).toBe('+2+1')
  })

  test('should calculate action die correctly', () => {
    item.prepareBaseData()
    expect(item.system.actionDie).toBe('1d20')
  })

  test('should calculate attack bonus correctly for melee', () => {
    item.prepareBaseData()
    expect(item.system.attackBonus).toBe('+2+1+1')
  })

  test('should calculate attack bonus correctly for missile', () => {
    item.system.melee = false
    item.prepareBaseData()
    expect(item.system.attackBonus).toBe('+1+1+1')
  })

  test('should calculate damage correctly for melee', () => {
    item.prepareBaseData()
    expect(item.system.damage).toBe('1d8+3+2')
  })

  test('should calculate damage correctly for missile', () => {
    item.system.melee = false
    item.prepareBaseData()
    expect(item.system.damage).toBe('1d8+1+2')
  })

  test('should calculate crit range correctly', () => {
    item.prepareBaseData()
    expect(item.system.critRange).toBe(19)
  })

  test('should calculate crit die correctly', () => {
    item.prepareBaseData()
    expect(item.system.critDie).toBe('1d6')
  })

  test('should calculate crit table correctly', () => {
    item.prepareBaseData()
    expect(item.system.critTable).toBe('III')
  })
})
