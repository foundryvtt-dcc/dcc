import { describe, test, expect } from 'vitest'
import '../__mocks__/foundry.js'

describe('Enhanced Foundry Mocks', () => {
  test('CONFIG.DCC.abilityModifiers is properly available', () => {
    expect(global.CONFIG.DCC.abilityModifiers).toBeDefined()
    expect(global.CONFIG.DCC.abilityModifiers[14]).toBe(1)
    expect(global.CONFIG.DCC.abilityModifiers[8]).toBe(-1)
  })

  test('Actor mock properly calculates ability modifiers', () => {
    // Test with the basic ActorMock instead of full DCCActor to avoid complex dependencies
    const actor = new global.Actor()

    // Manually set ability values and run prepareBaseData
    actor.system.abilities.str.value = 14
    actor.system.abilities.agl.value = 8
    actor.system.abilities.sta.value = 16
    actor.prepareBaseData()

    expect(actor.system.abilities.str.mod).toBe(1)
    expect(actor.system.abilities.agl.mod).toBe(-1)
    expect(actor.system.abilities.sta.mod).toBe(2)
  })

  test('Enhanced localization provides real translations', () => {
    expect(global.game.i18n.localize('DCC.AbilityStr')).toBe('Strength')
    expect(global.game.i18n.localize('DCC.ActionDie')).toBe('Action Die')
    expect(global.game.i18n.localize('DCC.SpellCheck')).toBe('Spell Check')
  })

  test('Game settings mock returns realistic DCC defaults', () => {
    expect(global.game.settings.get('dcc', 'criticalHitPacks')).toBe('dcc-core-book.dcc-crits')
    expect(global.game.settings.get('dcc', 'fumbleTable')).toBe('dcc-core-book.dcc-fumbles')
  })

  test('DiceChain mock provides proper functionality', () => {
    expect(global.game.dcc.DiceChain.DICE_CHAIN).toEqual([3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30])
    expect(global.game.dcc.DiceChain.rankDiceExpression('1d12')).toBe(7)
    expect(global.game.dcc.DiceChain.rankDiceExpression('1d20')).toBe(10)
  })

  test('Enhanced CONST provides more realistic Foundry constants', () => {
    expect(global.CONST.DICE_ROLL_MODES.PUBLIC).toBe('roll')
    expect(global.CONST.CHAT_MESSAGE_STYLES.IC).toBe('ic')
    expect(global.CONST.ENTITY_TYPES.ACTOR).toBe('Actor')
  })

  test('Item mock enhanced with proper defaults for weapons', () => {
    const weapon = new global.Item({
      type: 'weapon',
      name: 'Test Sword'
    })

    // Test that template data is merged with our enhanced defaults
    expect(weapon.name).toBe('Test Sword')
    expect(weapon.type).toBe('weapon')
    expect(weapon.system).toBeDefined()
    expect(weapon.system.quantity).toBe(1) // From template
    expect(weapon.system.melee).toBe(true) // Our enhancement
    expect(weapon.system.damage).toBe('1d6') // Our enhancement
    expect(weapon.system.critRange).toBe(20) // Our enhancement
    expect(weapon.system.critTable).toBe('III') // Our enhancement
  })

  test('Item mock enhanced with proper defaults for armor', () => {
    const armor = new global.Item({
      type: 'armor',
      name: 'Test Mail'
    })

    // Test that template data is merged with our enhanced defaults
    expect(armor.name).toBe('Test Mail')
    expect(armor.type).toBe('armor')
    expect(armor.system).toBeDefined()
    expect(armor.system.fumbleDie).toBe('1d4') // Our enhancement
  })
})
