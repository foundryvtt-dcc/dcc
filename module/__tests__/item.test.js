import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest'
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
  }),
  // Mirrors the real implementation: bare die or die + the given bonus
  // (tolerating a dropped '+0') infers the die; anything else returns ''.
  inferWeaponDie: vi.fn((damage, bonus = '') => {
    if (typeof damage !== 'string' || damage === '') return ''
    const match = damage.match(/\d*d\d+/)
    const die = match ? match[0] : ''
    if (!die) return ''
    if (damage === die) return die
    const total = `${die}${bonus || ''}`
    if (damage === total || damage === total.replaceAll('+0', '')) return die
    return ''
  }),
  // Mirrors the real implementation: single die of the first listed faces
  // with its flat rider kept ('2d20' → '1d20', '1d20+4' → '1d20+4'), ''
  // when no die is present.
  getSingleActionDie: vi.fn((value) => {
    const first = String(value || '').split(',')[0]
    const match = first.match(/d(\d+)/)
    if (!match) return ''
    const after = first.slice(first.indexOf(match[0]) + match[0].length)
    const rider = after.match(/^(?:[+-]\d+(?!\d*d\d))+/)?.[0] ?? ''
    return `1d${match[1]}${rider}`
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

    // Issue #834: an NPC-style multi-action value ('Act 2d20' ⇒ '2d20')
    // means two separate d20 ACTIONS — the weapon's per-roll die must be a
    // single 1d20, never a summed 2d20.
    test('a multi-action dice value yields a single per-roll die', () => {
      item.actor.system.attributes.actionDice.value = '2d20'
      item.prepareBaseData()
      expect(item.system.actionDie).toBe('1d20')
      item.actor.system.attributes.actionDice.value = '1d20'
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
          critRangeOverride: 16,
          critDieOverride: '1d10',
          critTableOverride: 'V',
          fumbleRangeOverride: 3
        }
      }
      weapon.prepareBaseData()

      expect(weapon.system.critRange).toBe(16)
      expect(weapon.system.critDie).toBe('1d10')
      expect(weapon.system.critTable).toBe('V')
      expect(weapon.system.fumbleRange).toBe(3)
    })

    test('should use defaults when actor properties missing', () => {
      weapon.actor = null
      weapon.prepareBaseData()

      expect(weapon.system.critRange).toBe(20)
      expect(weapon.system.critDie).toBe('1d4')
      expect(weapon.system.critTable).toBe('I')
      expect(weapon.system.fumbleRange).toBe(1)
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

    // Legacy-shape weapons (`damage` stored, no `damageWeapon`): the
    // heuristic runtime split retired in #907. `_preCreate` and the world
    // migration persist `damageWeapon` for confidently-attributable shapes;
    // prepareBaseData rolls anything left verbatim.

    test('weapon with no damageWeapon keeps its stored damage formula verbatim', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'legacy sword' }, {})
      weapon.system = {
        melee: true,
        damage: '1d8',
        damageWeapon: '',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      // No heuristic split at prepare time, and no override baked in — the
      // stored formula is the safety net
      expect(weapon.system.config.damageOverride).toBeUndefined()
      expect(weapon.system.damageWeapon).toBe('')
      expect(weapon.system.damage).toBe('1d8')
    })

    test('_preCreate splits the weapon die for a legacy weapon embedded on a Player (temp Str loss)', async () => {
      // User report: max Str 9 (mod 0, damage stored as bare '1d4')
      // temporarily lowered to 7 (mod -1). Normalizing at creation is what
      // lets the composed formula subtract the current -1.
      actor.system.details.attackDamageBonus.melee.value = '-1'
      actor.type = 'Player'

      weapon = new DCCItem({ type: 'weapon', name: 'club' }, {})
      weapon.system = {
        melee: true,
        damage: '1d4',
        damageWeapon: '',
        config: {}
      }
      weapon._source = { system: weapon.system }
      weapon.parent = actor

      await weapon._preCreate({}, {}, {})
      expect(weapon.system.damageWeapon).toBe('1d4')

      weapon.actor = actor
      weapon.prepareBaseData()
      expect(weapon.system.config.damageOverride).toBeUndefined()
      expect(weapon.system.damage).toBe('1d4-1')
    })

    test('_preCreate splits when the stored formula matches die + current actor bonus', async () => {
      actor.type = 'Player'
      // Suite actor's melee damage bonus is '+3'
      weapon = new DCCItem({ type: 'weapon', name: 'longsword' }, {})
      weapon.system = {
        melee: true,
        damage: '1d8+3',
        damageWeapon: '',
        config: {}
      }
      weapon._source = { system: weapon.system }
      weapon.parent = actor

      await weapon._preCreate({}, {}, {})
      expect(weapon.system.damageWeapon).toBe('1d8')
    })

    test('_preCreate leaves ambiguous formulas and non-Player owners alone', async () => {
      actor.type = 'Player'
      weapon = new DCCItem({ type: 'weapon', name: 'odd blade' }, {})
      weapon.system = {
        melee: true,
        damage: '1d8+5', // Doesn't match bare die or die + bonus ('+3')
        damageWeapon: '',
        config: {}
      }
      weapon._source = { system: weapon.system }
      weapon.parent = actor
      await weapon._preCreate({}, {}, {})
      expect(weapon.system.damageWeapon).toBe('')

      // NPC-owned weapons use `damage` directly — never split
      const npc = { type: 'NPC', system: actor.system }
      const npcWeapon = new DCCItem({ type: 'weapon', name: 'claw' }, {})
      npcWeapon.system = { melee: true, damage: '1d4', damageWeapon: '', config: {} }
      npcWeapon._source = { system: npcWeapon.system }
      npcWeapon.parent = npc
      await npcWeapon._preCreate({}, {}, {})
      expect(npcWeapon.system.damageWeapon).toBe('')
    })

    test('should handle weapons with non-standard damage', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'special weapon' }, {})
      weapon.system = {
        melee: true,
        damage: '2d4+fire', // Non-standard damage
        damageWeapon: '',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      // Rolled as stored — no override is baked in anymore (#907)
      expect(weapon.system.config.damageOverride).toBeUndefined()
      expect(weapon.system.damage).toBe('2d4+fire')
    })

    test('_preCreate uses the missile bonus for non-melee weapons', async () => {
      actor.type = 'Player'
      // Suite actor's missile damage bonus is '+1'
      weapon = new DCCItem({ type: 'weapon', name: 'shortbow' }, {})
      weapon.system = {
        melee: false,
        damage: '1d6+1', // Matches die + missile bonus, NOT melee ('+3')
        damageWeapon: '',
        config: {}
      }
      weapon._source = { system: weapon.system }
      weapon.parent = actor

      await weapon._preCreate({}, {}, {})
      expect(weapon.system.damageWeapon).toBe('1d6')
    })

    test('_preCreate never touches non-weapons, unowned items, or already-normalized weapons', async () => {
      actor.type = 'Player'

      // Non-weapon item types are ignored even with weapon-shaped data
      const equipment = new DCCItem({ type: 'equipment', name: 'torch' }, {})
      equipment.system = { damage: '1d4', damageWeapon: '', config: {} }
      equipment._source = { system: equipment.system }
      equipment.parent = actor
      await equipment._preCreate({}, {}, {})
      expect(equipment.system.damageWeapon).toBe('')

      // World-item creation (no parent): no owner context, no split
      const worldWeapon = new DCCItem({ type: 'weapon', name: 'display sword' }, {})
      worldWeapon.system = { melee: true, damage: '1d8', damageWeapon: '', config: {} }
      worldWeapon._source = { system: worldWeapon.system }
      worldWeapon.parent = null
      await worldWeapon._preCreate({}, {}, {})
      expect(worldWeapon.system.damageWeapon).toBe('')

      // damageWeapon already recorded: the split never overwrites it
      const modern = new DCCItem({ type: 'weapon', name: 'modern sword' }, {})
      modern.system = { melee: true, damage: '1d8+3', damageWeapon: '1d10', config: {} }
      modern._source = { system: modern.system }
      modern.parent = actor
      await modern._preCreate({}, {}, {})
      expect(modern.system.damageWeapon).toBe('1d10')

      // Explicit damageOverride: the author's formula is authoritative
      const custom = new DCCItem({ type: 'weapon', name: 'custom sword' }, {})
      custom.system = { melee: true, damage: '1d8', damageWeapon: '', config: { damageOverride: '2d6' } }
      custom._source = { system: custom.system }
      custom.parent = actor
      await custom._preCreate({}, {}, {})
      expect(custom.system.damageWeapon).toBe('')

      // Empty damage: nothing to infer from
      const blank = new DCCItem({ type: 'weapon', name: 'blank sword' }, {})
      blank.system = { melee: true, damage: '', damageWeapon: '', config: {} }
      blank._source = { system: blank.system }
      blank.parent = actor
      await blank._preCreate({}, {}, {})
      expect(blank.system.damageWeapon).toBe('')
    })

    test('a fresh weapon with no damage and no damageWeapon stays empty after prepare', () => {
      // Pre-#907 the composition ran unconditionally, so a brand-new weapon
      // displayed the actor bonus alone ('+3') as its damage. The gated
      // composition leaves it empty until a weapon die is recorded.
      weapon = new DCCItem({ type: 'weapon', name: 'new weapon' }, {})
      weapon.system = {
        melee: true,
        damage: '',
        damageWeapon: '',
        config: {}
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('')
    })

    test('damageOverride still wins for weapons with no damageWeapon', () => {
      weapon = new DCCItem({ type: 'weapon', name: 'overridden legacy' }, {})
      weapon.system = {
        melee: true,
        damage: '1d8',
        damageWeapon: '',
        config: { damageOverride: '3d6' }
      }
      weapon.actor = actor

      weapon.prepareBaseData()

      expect(weapon.system.damage).toBe('3d6')
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
            // The rolled die reports the faces of the Die term it was built
            // from, so the multiple-action-dice reconcile actually runs against
            // a realistic roll instead of short-circuiting on a missing `faces`
            // (a stub without it would let a wrong `defaultActionDieFaces` pass).
            createRoll: vi.fn((terms) => {
              const dieFormula = terms?.find(t => t.type === 'Die')?.formula ?? '1d20'
              const faces = parseInt(String(dieFormula).match(/d(\d+)/)?.[1] || '20')
              return {
                evaluate: vi.fn(),
                dice: [{ options: {}, faces }]
              }
            })
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

    test('should handle spell casting with stamina ability', async () => {
      actor.type = 'Player'
      actor.system.class.spellCheckAbility = 'sta'

      await spell.rollSpellCheck('sta')

      expect(global.game.dcc.DCCRoll.createRoll).toHaveBeenCalled()
      const terms = global.game.dcc.DCCRoll.createRoll.mock.calls[0][0]
      // Should have the standard spell check terms
      const dieTerm = terms.find(term => term.type === 'Die')
      expect(dieTerm).toBeDefined()
      // Should have spell check compound term (combines level + ability mod)
      const spellCheckTerm = terms.find(term => term.type === 'Compound')
      expect(spellCheckTerm).toBeDefined()
      // Should include spellburn for wizard-style casting
      const spellburnTerm = terms.find(term => term.type === 'Spellburn')
      expect(spellburnTerm).toBeDefined()
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

    // Multiple action dice on the item-level cast path (#857). This is the
    // entry point the character sheet uses for an owned spell, and it had no
    // action-die integration at all: every cast rolled `spellCheck.die` (always
    // the FIRST action die, via getSingleActionDie) and spent no slot, so a
    // wizard's second spell in a round never dropped to its second action die.
    describe('multiple action dice (#857)', () => {
      let combatant

      // A level-5 wizard: 1d20 (any) + a spells-only 1d14.
      const wizardSlots = () => [
        { slot: 0, die: 'd20', modifier: 0, use: 'any' },
        { slot: 1, die: 'd14', modifier: 0, use: 'spell' }
      ]

      // `spent` is the stored per-round state; null ⇒ fresh round.
      const enterCombat = (spent = null, { round = 3, list = wizardSlots() } = {}) => {
        actor.id = 'wiz1'
        combatant = {
          actor: { id: 'wiz1', system: { attributes: { actionDice: { list } } }, isOwner: true },
          isOwner: true,
          getFlag: (scope, key) => (scope === 'dcc' && key === 'actionDice'
            ? (spent ? { round, spent } : undefined)
            : undefined),
          setFlag: vi.fn(async () => {})
        }
        global.game.combat = { round, combatants: [combatant] }
      }

      const dieTerm = () => global.game.dcc.DCCRoll.createRoll.mock.calls[0][0]
        .find(term => term.type === 'Die')

      beforeEach(() => {
        global.game.user = { isGM: true }
        global.game.settings.get = vi.fn((module, key) => {
          if (module !== 'dcc') return false
          if (key === 'automateWizardSpellLoss') return true
          // The multiple-action-dice master switch plus in-combat tracking.
          if (key === 'multipleActionDice' || key === 'trackActionDiceInCombat') return true
          return false
        })
      })

      afterEach(() => {
        delete global.game.combat
        delete global.game.user
      })

      test("the round's first cast uses the spell's own die and spends slot 0", async () => {
        enterCombat()

        await spell.rollSpellCheck('int')

        expect(dieTerm().formula).toBe('1d20')
        expect(combatant.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
          round: 3,
          spent: [true, false]
        }))
      })

      test("the second cast drops to the wizard's spells-only second action die", async () => {
        enterCombat([true, false])

        await spell.rollSpellCheck('int')

        // The bug: this rolled 1d20 again, because `spellCheck.die` only ever
        // carries the first action die.
        expect(dieTerm().formula).toBe('1d14')
        expect(combatant.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
          round: 3,
          spent: [true, true]
        }))
      })

      test('the "Action N of M" line reaches the chat card', async () => {
        enterCombat([true, false])

        await spell.rollSpellCheck('int')

        const spellData = global.game.dcc.processSpellCheck.mock.calls[0][1]
        expect(spellData.actionDiceChatLine).toBe('DCC.ActionDiceChatLine formatted')
      })

      test('a third cast is over budget — no die is spent and the line says so', async () => {
        enterCombat([true, true])

        await spell.rollSpellCheck('int')

        // Nothing left to spend, so the die falls back to the spell's own and
        // the state is never rewritten; the card carries the over-budget line.
        expect(dieTerm().formula).toBe('1d20')
        expect(combatant.setFlag).not.toHaveBeenCalled()
        const spellData = global.game.dcc.processSpellCheck.mock.calls[0][1]
        expect(spellData.actionDiceChatLine).toBe('DCC.ActionDiceChatLineOverBudget formatted')
      })

      test('the modifier dialog is offered one preset per eligible slot', async () => {
        enterCombat()

        await spell.rollSpellCheck('int')

        // Both slots are unspent and both take a spell, so both are offered —
        // and no untrained 1d10 (that is an attack/skill concept).
        expect(dieTerm().presets.map(p => p.formula)).toEqual(['1d20', '1d14'])
      })

      test('a die chosen in the dialog re-points the spend to that slot', async () => {
        enterCombat()
        // The player overrode the auto-picked 1d20 with slot 1's 1d14.
        global.game.dcc.DCCRoll.createRoll = vi.fn(() => ({
          evaluate: vi.fn(),
          dice: [{ options: {}, faces: 14 }]
        }))

        await spell.rollSpellCheck('int')

        expect(combatant.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
          spent: [false, true]
        }))
      })

      test('off-path (setting disabled) the cast is unchanged and spends nothing', async () => {
        enterCombat([true, false])
        global.game.settings.get = vi.fn((module, key) =>
          module === 'dcc' && key === 'automateWizardSpellLoss')

        await spell.rollSpellCheck('int')

        expect(dieTerm().formula).toBe('1d20')
        expect(dieTerm().presets).toBeUndefined()
        expect(combatant.setFlag).not.toHaveBeenCalled()
        const spellData = global.game.dcc.processSpellCheck.mock.calls[0][1]
        expect(spellData.actionDiceChatLine).toBe('')
      })

      test('a spell that opts out of inheritActionDie keeps its own die', async () => {
        enterCombat([true, false])
        spell.system.config.inheritActionDie = false
        spell.system.spellCheck.die = '1d24'

        await spell.rollSpellCheck('int')

        // The authored die is a deliberate choice; the slot must not discard it.
        expect(dieTerm().formula).toBe('1d24')
        // The action is still taken, so the slot is still spent.
        expect(combatant.setFlag).toHaveBeenCalledWith('dcc', 'actionDice', expect.objectContaining({
          spent: [true, true]
        }))
      })

      test('a class spellCheckOverrideDie survives the slot step-down', async () => {
        enterCombat([true, false])
        actor.system.class.spellCheckOverrideDie = '1d30'
        spell.system.spellCheck.die = '1d30'

        await spell.rollSpellCheck('int')

        expect(dieTerm().formula).toBe('1d30')
      })

      test('a spell with no results table posts nothing, so it costs nothing', async () => {
        enterCombat()
        spell.system.results.table = ''

        await spell.rollSpellCheck('int')

        expect(global.ui.notifications.warn).toHaveBeenCalledWith('DCC.NoSpellResultsTableWarning')
        expect(combatant.setFlag).not.toHaveBeenCalled()
      })

      test('out of combat there is no budget, so the cast is unchanged', async () => {
        // Master setting on, but no active combat ⇒ planActionDie returns null.
        await spell.rollSpellCheck('int')

        expect(dieTerm().formula).toBe('1d20')
        const spellData = global.game.dcc.processSpellCheck.mock.calls[0][1]
        expect(spellData.actionDiceChatLine).toBe('')
      })
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
