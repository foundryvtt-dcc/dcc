import { describe, beforeEach, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCItem from '../item.js'

// Mock the dice-chain module
vi.mock('../dice-chain.js', () => ({
  default: {
    bumpDie: vi.fn((die, steps) => {
      // Simple mock implementation - just return modified die
      if (steps === -1) {
        if (die === '1d20') return '1d16'
        if (die === '1d12') return '1d10'
      }
      return die
    })
  }
}))

// Mock the utilities module
vi.mock('../utilities.js', () => ({
  ensurePlus: vi.fn((value) => {
    if (!value || value === '0') return '+0'
    return value.toString().startsWith('+') || value.toString().startsWith('-') ? value.toString() : `+${value}`
  }),
  getFirstDie: vi.fn((value) => {
    const match = value?.match(/\d*d\d+/)
    return match ? match[0] : null
  })
}))

describe('DCCItem Tests', () => {
  describe('Weapon Calculations', () => {
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

  describe('Armor Items', () => {
    let armor, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          abilities: {
            str: { value: 14 },
            agl: { value: 13 }
          }
        }
      }

      armor = new DCCItem({ type: 'armor', name: 'chainmail' }, {})
      armor.system = {
        acBonus: '+4',
        checkPenalty: '-2',
        speed: '-5',
        fumbleDie: '1d6',
        equipped: true
      }
      armor.actor = actor
    })

    test('should set isPC and isNPC flags correctly', () => {
      armor.prepareBaseData()
      expect(armor.isPC).toBe(true)
      expect(armor.isNPC).toBe(false)
    })

    test('should handle NPC actor type', () => {
      actor.type = 'NPC'
      armor.prepareBaseData()
      expect(armor.isPC).toBe(false)
      expect(armor.isNPC).toBe(true)
    })

    test('should maintain armor properties after prepareBaseData', () => {
      armor.prepareBaseData()
      expect(armor.system.acBonus).toBe('+4')
      expect(armor.system.checkPenalty).toBe('-2')
      expect(armor.system.fumbleDie).toBe('1d6')
    })
  })

  describe('Equipment Items', () => {
    let equipment, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          abilities: {
            str: { value: 14 }
          }
        }
      }

      equipment = new DCCItem({ type: 'equipment', name: 'rope' }, {})
      equipment.system = {
        quantity: 50,
        weight: 10,
        equipped: true,
        value: { gp: 2 }
      }
      equipment.actor = actor
    })

    test('should handle equipment items without modification', () => {
      equipment.prepareBaseData()
      expect(equipment.system.quantity).toBe(50)
      expect(equipment.system.weight).toBe(10)
      expect(equipment.system.equipped).toBe(true)
    })

    test('should set isPC correctly for equipment', () => {
      equipment.prepareBaseData()
      expect(equipment.isPC).toBe(true)
      expect(equipment.isNPC).toBe(false)
    })
  })

  describe('Spell Items', () => {
    let spell, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          abilities: {
            int: { value: 16, mod: 2 },
            str: { value: 14 },
            agl: { value: 12 },
            sta: { value: 13 }
          },
          attributes: {
            actionDice: { value: '1d20' },
            ac: { checkPenalty: '-1' }
          },
          class: {
            spellCheck: '+3',
            spellCheckOverrideDie: '',
            disapproval: '1'
          }
        },
        getRollData: vi.fn(() => ({})),
        update: vi.fn()
      }

      spell = new DCCItem({ type: 'spell', name: 'magic missile' }, {})
      spell.system = {
        config: {
          inheritActionDie: true,
          inheritSpellCheck: true,
          inheritCheckPenalty: true,
          castingMode: 'wizard'
        },
        spellCheck: {
          die: '1d20',
          value: '+0',
          penalty: '-0'
        },
        results: {
          table: 'magic-missile-table',
          collection: ''
        },
        lost: false,
        manifestation: {
          displayInChat: true
        },
        mercurialEffect: {
          displayInChat: true
        }
      }
      spell.actor = actor
    })

    test('should inherit action die from actor when configured', () => {
      spell.prepareBaseData()
      expect(spell.system.spellCheck.die).toBe('1d20')
    })

    test('should use spellCheckOverrideDie when available', () => {
      actor.system.class.spellCheckOverrideDie = '1d24'
      spell.prepareBaseData()
      expect(spell.system.spellCheck.die).toBe('1d24')
    })

    test('should inherit spell check value from actor', () => {
      spell.prepareBaseData()
      expect(spell.system.spellCheck.value).toBe('+3')
    })

    test('should inherit check penalty from actor', () => {
      spell.prepareBaseData()
      expect(spell.system.spellCheck.penalty).toBe('-1')
    })

    test('should not inherit values when disabled in config', () => {
      spell.system.config.inheritActionDie = false
      spell.system.config.inheritSpellCheck = false
      spell.system.config.inheritCheckPenalty = false

      spell.system.spellCheck.die = '1d16'
      spell.system.spellCheck.value = '+1'
      spell.system.spellCheck.penalty = '-2'

      spell.prepareBaseData()

      expect(spell.system.spellCheck.die).toBe('1d16')
      expect(spell.system.spellCheck.value).toBe('+1')
      expect(spell.system.spellCheck.penalty).toBe('-2')
    })

    test('should handle missing actor gracefully', () => {
      spell.actor = null
      expect(() => spell.prepareBaseData()).not.toThrow()
    })
  })

  describe('Skill Items', () => {
    let skill, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          abilities: {
            agl: { value: 14, mod: 1 }
          }
        }
      }

      skill = new DCCItem({ type: 'skill', name: 'sneak silently' }, {})
      skill.system = {
        config: {
          freeform: true,
          useSummary: false
        },
        ability: 'agl',
        die: '1d20',
        value: '+2'
      }
      skill.actor = actor
    })

    test('should set useSummary when freeform is true', () => {
      skill.prepareBaseData()
      expect(skill.system.config.useSummary).toBe(true)
    })

    test('should not modify useSummary when already true', () => {
      skill.system.config.useSummary = true
      skill.prepareBaseData()
      expect(skill.system.config.useSummary).toBe(true)
    })

    test('should handle non-freeform skills', () => {
      skill.system.config.freeform = false
      skill.prepareBaseData()
      expect(skill.system.config.useSummary).toBe(false)
    })
  })

  describe('Treasure Items', () => {
    let treasure

    beforeEach(() => {
      treasure = new DCCItem({ type: 'treasure', name: 'gems' }, {})
      treasure.system = {
        value: {
          pp: 0,
          gp: 5,
          sp: 10,
          cp: 25
        },
        isCoins: false
      }

      // Mock CONFIG.DCC.currencies for treasure value tests
      global.CONFIG.DCC.currencies = {
        pp: { label: 'Platinum', factor: 10 },
        gp: { label: 'Gold', factor: 1 },
        sp: { label: 'Silver', factor: 0.1 },
        cp: { label: 'Copper', factor: 0.01 }
      }
    })

    test('should maintain treasure value properties', () => {
      treasure.prepareBaseData()
      expect(treasure.system.value.gp).toBe(5)
      expect(treasure.system.value.sp).toBe(10)
      expect(treasure.system.isCoins).toBe(false)
    })

    test('should handle coin treasures', () => {
      treasure.system.isCoins = true
      treasure.prepareBaseData()
      expect(treasure.system.isCoins).toBe(true)
    })
  })

  describe('Critical Hit Calculations', () => {
    let weapon, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          details: {
            critRange: 18
          },
          attributes: {
            critical: {
              die: '1d8',
              table: 'IV'
            }
          }
        },
        prepareBaseData: vi.fn() // Mock the prepareBaseData method
      }

      weapon = new DCCItem({ type: 'weapon', name: 'battleaxe' }, {})
      weapon.actor = actor
    })

    test('should inherit critical range from actor', () => {
      weapon.prepareBaseData()
      expect(weapon.system.critRange).toBe(18)
    })

    test('should inherit critical die from actor', () => {
      weapon.prepareBaseData()
      expect(weapon.system.critDie).toBe('1d8')
    })

    test('should inherit critical table from actor', () => {
      weapon.prepareBaseData()
      expect(weapon.system.critTable).toBe('IV')
    })

    test('should use config overrides when present', () => {
      weapon.system = {
        config: {
          critRangeOverride: '16',
          critDieOverride: '1d10',
          critTableOverride: 'V'
        }
      }
      weapon.prepareBaseData()

      expect(weapon.system.critRange).toBe(16)
      expect(weapon.system.critDie).toBe('1d10')
      expect(weapon.system.critTable).toBe('V')
    })

    test('should use defaults when actor properties missing', () => {
      weapon.actor = null
      weapon.prepareBaseData()

      expect(weapon.system.critRange).toBe(20)
      expect(weapon.system.critDie).toBe('1d4')
      expect(weapon.system.critTable).toBe('I')
    })
  })

  describe('NPC Weapon Handling', () => {
    let npcWeapon, npcActor

    beforeEach(() => {
      npcActor = {
        type: 'NPC',
        system: {
          attributes: {
            actionDice: { value: '1d16' }
          }
        }
      }

      npcWeapon = new DCCItem({ type: 'weapon', name: 'npc sword' }, {})
      npcWeapon.system = {
        config: {},
        damageWeapon: '1d8',
        damage: ''
      }
      npcWeapon.actor = npcActor
    })

    test('should set action die from NPC actor', () => {
      npcWeapon.prepareBaseData()
      expect(npcWeapon.system.actionDie).toBe('1d16')
    })

    test('should use action die override when present', () => {
      npcWeapon.system.config.actionDieOverride = '1d20'
      npcWeapon.prepareBaseData()
      expect(npcWeapon.system.actionDie).toBe('1d20')
    })

    test('should set damage from damageWeapon when damage is empty', () => {
      npcWeapon.prepareBaseData()
      expect(npcWeapon.system.damage).toBe('1d8')
    })

    test('should not override existing damage', () => {
      npcWeapon.system.damage = '1d10+2'
      npcWeapon.prepareBaseData()
      expect(npcWeapon.system.damage).toBe('1d10+2')
    })
  })

  describe('Unowned Weapon Items', () => {
    let unownedWeapon

    beforeEach(() => {
      unownedWeapon = new DCCItem({ type: 'weapon', name: 'unowned sword' }, {})
      unownedWeapon.actor = null
    })

    test('should clear attackBonus and toHit for unowned weapons', () => {
      unownedWeapon.prepareBaseData()
      expect(unownedWeapon.system.attackBonus).toBe('')
      expect(unownedWeapon.system.toHit).toBe('')
    })
  })

  describe('Advanced Weapon Configurations', () => {
    let weapon, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          abilities: {
            str: { value: 16, mod: 2 },
            agl: { value: 14, mod: 1 }
          },
          attributes: {
            init: { die: '1d20', value: '+1' },
            actionDice: { value: '1d20' }
          },
          details: {
            attackHitBonus: {
              melee: { value: '+3' },
              missile: { value: '+2' }
            },
            attackDamageBonus: {
              melee: { value: '+2' },
              missile: { value: '+1' }
            }
          }
        },
        prepareBaseData: vi.fn()
      }
    })

    test('should handle two-handed weapons with initiative penalty', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'greatsword' }, {})
      weapon.system = {
        twoHanded: true,
        melee: true,
        damageWeapon: '1d10',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      // Two-handed weapons get initiative die bumped down
      expect(weapon.system.initiativeDie).toBe('1d16')
      expect(weapon.system.attackBonus).toBe('+3')
    })

    test('should handle untrained weapons with action die penalty', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'exotic weapon' }, {})
      weapon.system = {
        trained: false,
        melee: true,
        damageWeapon: '1d8',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      // Untrained weapons get action die bumped down and marked
      expect(weapon.system.actionDie).toBe('1d16[untrained]')
    })

    test('should handle missile weapons correctly', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'crossbow' }, {})
      weapon.system = {
        melee: false,
        damageWeapon: '1d8',
        attackBonusWeapon: '+1',
        damageWeaponBonus: '+0',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.attackBonus).toBe('+2+1')
      expect(weapon.system.damage).toBe('1d8+1+0')
    })

    test('should handle weapon with attack bonus override', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'magic sword' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d8',
        config: {
          attackBonusOverride: '+5'
        }
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.toHit).toBe('+5')
    })

    test('should handle weapon with damage override', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'fire sword' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d8',
        config: {
          damageOverride: '1d8+1d6[fire]'
        }
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('1d8+1d6[fire]')
    })

    test('should handle mounted weapon with double damage', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'lance' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d8',
        damageWeaponBonus: '+1',
        doubleIfMounted: true,
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('(1d8)*2+2+1')
    })

    test('should handle subdual weapons', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'club' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d4',
        subdual: true,
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('1d4+2[subdual]')
    })

    test('should handle weapons with multiple bonuses', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'lucky sword' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d8',
        attackBonusWeapon: '+2',
        attackBonusLucky: '+1',
        damageWeaponBonus: '+1',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.attackBonus).toBe('+3+2+1')
      expect(weapon.system.damage).toBe('1d8+2+1')
    })

    test('should handle initiative die and bonus overrides', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'quick blade' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d6',
        initiativeWeaponBonus: '+2',
        config: {
          initiativeDieOverride: '1d24',
          initiativeBonusOverride: '+5'
        }
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.initiativeDie).toBe('1d24')
      expect(weapon.system.initiativeBonus).toBe('+5')
    })

    test('should handle action die override', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'special weapon' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d8',
        config: {
          actionDieOverride: '1d30'
        }
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.actionDie).toBe('1d30')
    })
  })

  describe('Weapon Damage Calculations with Various Modifiers', () => {
    let weapon, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          attributes: {
            actionDice: { value: '1d20' },
            init: { die: '1d20', value: '+1' }
          },
          details: {
            attackDamageBonus: {
              melee: { value: '+3' },
              missile: { value: '+1' }
            },
            attackHitBonus: {
              melee: { value: '+2' },
              missile: { value: '+1' }
            }
          }
        },
        prepareBaseData: vi.fn()
      }
    })

    test('should handle weapons with deed die damage bonus', () => {
      actor.system.details.attackDamageBonus.melee.value = '+1d3'

      weapon = new DCCItem({ type: 'weapon', name: 'warrior sword' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d8',
        damageWeaponBonus: '+2',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('1d8+1d3+2')
    })

    test('should handle complex damage calculations', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'complex weapon' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d10',
        damageWeaponBonus: '+1d4',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('1d10+3+1d4')
    })

    test('should handle missile weapon damage correctly', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'magic arrow' }, {})
      weapon.system = {
        melee: false,
        damageWeapon: '1d6',
        damageWeaponBonus: '+2',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('1d6+1+2')
    })

    // Legacy damage field migration is tested implicitly in other tests

    test('should handle weapons with non-standard damage override', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'special weapon' }, {})
      weapon.system = {
        melee: true,
        damage: '2d4+fire', // Non-standard damage
        damageWeapon: '',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.config.damageOverride).toBe('2d4+fire')
    })
  })

  describe('Initiative Bonus Calculations', () => {
    let weapon, actor

    beforeEach(() => {
      actor = {
        type: 'Player',
        system: {
          attributes: {
            init: { die: '1d20', value: '+2' }
          }
        },
        prepareBaseData: vi.fn()
      }

      weapon = new DCCItem({ type: 'weapon', name: 'quick weapon' }, {})
      weapon.system = {
        config: {}
      }
      weapon.actor = actor
    })

    test('should calculate initiative bonus with weapon bonus', () => {
      weapon.system.initiativeWeaponBonus = '+3'

      weapon.prepareBaseData()

      expect(weapon.system.initiativeBonus).toBe('+2+3')
    })

    test('should handle missing initiative values gracefully', () => {
      actor.system.attributes.init.value = ''
      weapon.system.initiativeWeaponBonus = '+1'

      weapon.prepareBaseData()

      expect(weapon.system.initiativeBonus).toBe('+0+1')
    })

    test('should respect initiative bonus override', () => {
      weapon.system.initiativeWeaponBonus = '+3'
      weapon.system.config.initiativeBonusOverride = '+10'

      weapon.prepareBaseData()

      expect(weapon.system.initiativeBonus).toBe('+10')
    })
  })

  describe('Spell Item Methods and Interactions', () => {
    let spell, actor

    beforeEach(() => {
    // Mock game and ui globals
      global.game = {
        settings: {
          get: vi.fn((module, key) => {
            if (module === 'dcc' && key === 'automateWizardSpellLoss') return true
            return false
          })
        },
        i18n: {
          format: vi.fn((key, data) => `${key} formatted`),
          localize: vi.fn((key) => key)
        },
        dcc: {
          DCCRoll: {
            createRoll: vi.fn(() => ({
              evaluate: vi.fn(),
              dice: [{ options: {} }]
            }))
          },
          processSpellCheck: vi.fn()
        },
        packs: {
          get: vi.fn(() => null)
        },
        tables: {
          contents: []
        }
      }

      global.ui = {
        notifications: {
          warn: vi.fn()
        }
      }

      global.CONFIG = {
        DCC: {
          abilities: {
            int: 'Intelligence'
          }
        }
      }

      actor = {
        type: 'Player',
        name: 'Test Wizard',
        system: {
          abilities: {
            int: { value: 16, mod: 2 },
            str: { value: 14 },
            agl: { value: 12 },
            sta: { value: 13 }
          },
          attributes: {
            actionDice: { value: '1d20' },
            ac: { checkPenalty: '-1' }
          },
          class: {
            spellCheck: '+3',
            disapproval: '1'
          }
        },
        getRollData: vi.fn(() => ({})),
        update: vi.fn()
      }

      spell = new DCCItem({ type: 'spell', name: 'magic missile' }, {})
      spell.system = {
        config: {
          inheritActionDie: true,
          inheritSpellCheck: true,
          inheritCheckPenalty: true,
          castingMode: 'wizard'
        },
        spellCheck: {
          die: '1d20',
          value: '+0',
          penalty: '-0'
        },
        results: {
          table: 'magic-missile-table',
          collection: ''
        },
        lost: false
      }
      spell.actor = actor
    })

    test('should prevent casting lost spells when automation enabled', async () => {
      spell.system.lost = true

      const result = await spell.rollSpellCheck('int')

      expect(global.ui.notifications.warn).toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    test('should allow casting lost spells when automation disabled', async () => {
      global.game.settings.get.mockReturnValue(false)
      spell.system.lost = true

      await spell.rollSpellCheck('int')

      expect(global.game.dcc.DCCRoll.createRoll).toHaveBeenCalled()
    })

    test('should handle missing spell results table', async () => {
      spell.system.results.table = ''

      await spell.rollSpellCheck('int')

      expect(global.ui.notifications.warn).toHaveBeenCalledWith('DCC.NoSpellResultsTableWarning')
    })

    test('should handle spell casting for clerics without spellburn', async () => {
      spell.system.config.castingMode = 'cleric'
      actor.type = 'Player'
      actor.system.class.spellCheckAbility = 'per'

      await spell.rollSpellCheck('per')

      expect(global.game.dcc.DCCRoll.createRoll).toHaveBeenCalled()
      const terms = global.game.dcc.DCCRoll.createRoll.mock.calls[0][0]
      const spellburnTerm = terms.find(term => term.type === 'Spellburn')
      expect(spellburnTerm).toBeUndefined()
    })

    test('should include spellburn for wizard spells', async () => {
      await spell.rollSpellCheck('int')

      const terms = global.game.dcc.DCCRoll.createRoll.mock.calls[0][0]
      const spellburnTerm = terms.find(term => term.type === 'Spellburn')
      expect(spellburnTerm).toBeDefined()
      expect(spellburnTerm.str).toBe(14)
      expect(spellburnTerm.agl).toBe(12)
      expect(spellburnTerm.sta).toBe(13)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle items without actors gracefully', () => {
      const weapon = new DCCItem({ type: 'weapon', name: 'orphaned sword' }, {})
      weapon.actor = null

      expect(() => weapon.prepareBaseData()).not.toThrow()
      expect(weapon.isPC).toBe(false)
      expect(weapon.isNPC).toBe(false)
    })

    test('should handle missing actor properties gracefully', () => {
      const weapon = new DCCItem({ type: 'weapon', name: 'incomplete actor weapon' }, {})
      weapon.actor = {
        type: 'Player',
        system: {},
        prepareBaseData: vi.fn() // Add the required method
      }

      expect(() => weapon.prepareBaseData()).not.toThrow()
      expect(weapon.system.initiativeDie).toBe('1d20') // Default fallback
    })

    test('should handle empty or invalid values', () => {
      const actor = {
        type: 'Player',
        system: {
          attributes: {
            init: { die: '', value: '' },
            actionDice: { value: '' }
          },
          details: {
            attackHitBonus: { melee: { value: '' } },
            attackDamageBonus: { melee: { value: '' } }
          }
        },
        prepareBaseData: vi.fn()
      }

      const weapon = new DCCItem({ type: 'weapon', name: 'empty values weapon' }, {})
      weapon.system = {
        melee: true,
        damageWeapon: '1d8',
        config: {}
      }
      weapon.actor = actor

      expect(() => weapon.prepareBaseData()).not.toThrow()
      expect(weapon.system.initiativeDie).toBe('1d20') // Fallback
      expect(weapon.system.attackBonus).toBe('+0') // ensurePlus converts empty to +0
    })

    test('should handle non-PC/NPC actor types', () => {
      const item = new DCCItem({ type: 'equipment', name: 'token item' }, {})
      item.actor = { type: 'Token' }

      item.prepareBaseData()

      expect(item.isPC).toBe(false)
      expect(item.isNPC).toBe(false)
    })

    test('should handle spell without actor', () => {
      const spell = new DCCItem({ type: 'spell', name: 'orphaned spell' }, {})
      spell.actor = null

      expect(() => spell.prepareBaseData()).not.toThrow()
    })

    test('should handle items with missing system properties', () => {
      const item = new DCCItem({ type: 'weapon', name: 'minimal weapon' }, {})
      // Minimal system without typical weapon properties
      item.system = { type: 'weapon' }
      item.actor = null

      expect(() => item.prepareBaseData()).not.toThrow()
    })
  })
})
