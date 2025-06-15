import { expect, vi, describe, it, beforeEach, afterEach } from 'vitest'
import '../__mocks__/foundry.js'
import '../__mocks__/roll.js'
import parsePCs from '../pc-parser.js'

describe('PC Parser Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Purple Sorcerer JSON Format Variations', () => {
    describe('Single Character JSON Tests', () => {
      it('should handle minimal JSON character data', async () => {
        const result = parsePCs('{"name": "Test Character"}')
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Test Character')
        expect(result[0]['abilities.str.value']).toBe(10)
        expect(result[0]['details.occupation.value']).toBe('')
      })

      it('should handle missing optional fields gracefully', async () => {
        const result = parsePCs('{"occTitle": "Farmer", "strengthScore": "15"}')
        expect(result[0]['details.occupation.value']).toBe('Farmer')
        expect(result[0]['abilities.str.value']).toBe('15')
        expect(result[0]['abilities.agl.value']).toBe(10) // Default
        expect(result[0]['attributes.hp.value']).toBeUndefined()
      })

      it('should handle string and numeric ability scores', async () => {
        const stringScores = parsePCs('{"strengthScore": "18", "agilityScore": "12"}')
        const numericScores = parsePCs('{"strengthScore": 18, "agilityScore": 12}')
        
        expect(stringScores[0]['abilities.str.value']).toBe('18')
        expect(stringScores[0]['abilities.agl.value']).toBe('12')
        expect(numericScores[0]['abilities.str.value']).toBe(18)
        expect(numericScores[0]['abilities.agl.value']).toBe(12)
      })

      it('should handle malformed weapon data', async () => {
        const result = parsePCs('{"weapons": [{"name": "Sword", "attackMod": null, "attackDamage": ""}]}')
        expect(result[0].items).toHaveLength(1)
        expect(result[0].items[0].name).toBe('Sword')
        expect(result[0].items[0].system.toHit).toBe('+0')
        expect(result[0].items[0].system.damage).toBe('1d3')
      })

      it('should handle legacy single weapon format', async () => {
        const result = parsePCs('{"weapon": "Club", "attackMod": "+1", "attackDamage": "1d4+1"}')
        expect(result[0].items).toHaveLength(1)
        expect(result[0].items[0].name).toBe('Club')
        expect(result[0].items[0].system.toHit).toBe('+1')
        expect(result[0].items[0].system.damage).toBe('1d4+1')
        expect(result[0].items[0].system.melee).toBe(true)
      })

      it('should handle complex starting funds parsing', async () => {
        const result = parsePCs('{"startingFunds": "25 cp + 15 sp + 3 gp + 1 ep + 2 pp"}')
        const coins = result[0].items.find(item => item.name === 'Coins')
        expect(coins.system.value.cp).toBe('25')
        expect(coins.system.value.sp).toBe('15')
        expect(coins.system.value.gp).toBe('3')
        expect(coins.system.value.ep).toBe('1')
        expect(coins.system.value.pp).toBe('2')
      })

      it('should handle missing equipment fields', async () => {
        const result = parsePCs('{"equipment": "", "equipment2": null, "equipment3": "Rope"}')
        const equipmentItems = result[0].items.filter(item => item.type === 'equipment')
        expect(equipmentItems).toHaveLength(1)
        expect(equipmentItems[0].name).toBe('Rope')
      })

      it('should handle save calculation with ability modifier extraction', async () => {
        const result = parsePCs('{"saveReflex": "+3", "agilityScore": "16", "saveFort": "-1", "staminaScore": "8"}')
        expect(result[0]['saves.ref.value']).toBe('+3')
        expect(result[0]['saves.ref.classBonus']).toBe(1) // +3 save - +2 agi mod = +1 class bonus
        expect(result[0]['saves.frt.value']).toBe('-1')
        expect(result[0]['saves.frt.classBonus']).toBe(0) // -1 save - (-1 sta mod) = 0 class bonus
      })
    })

    describe('Multiple Character JSON Tests', () => {
      it('should parse multiple characters from characters array', async () => {
        const json = {
          characters: [
            { name: 'Character 1', occTitle: 'Farmer' },
            { name: 'Character 2', occTitle: 'Blacksmith' }
          ]
        }
        const result = parsePCs(JSON.stringify(json))
        expect(result).toHaveLength(2)
        expect(result[0].name).toBe('Character 1')
        expect(result[1].name).toBe('Character 2')
      })

      it('should handle nested character parsing recursively', async () => {
        const json = {
          characters: [
            { name: 'Test', strengthScore: '15' }
          ]
        }
        const result = parsePCs(JSON.stringify(json))
        expect(result[0]['abilities.str.value']).toBe('15')
        expect(result[0]['abilities.str.max']).toBe('15')
      })
    })

    describe('Class-Specific JSON Parsing', () => {
      it('should set correct hit dice for known classes', async () => {
        const classes = [
          { className: 'warrior', expectedHD: '1d12' },
          { className: 'Wizard', expectedHD: '1d4' },
          { className: 'CLERIC', expectedHD: '1d8' },
          { className: 'thief', expectedHD: '1d6' },
          { className: 'unknown', expectedHD: '1d4' } // Default
        ]

        for (const testCase of classes) {
          const result = parsePCs(`{"className": "${testCase.className}"}`)
          expect(result[0]['attributes.hitDice.value']).toBe(testCase.expectedHD)
        }
      })

      it('should handle upper-level character attributes', async () => {
        const result = parsePCs(`{
          "alignment": "c",
          "className": "Wizard", 
          "level": "5",
          "critDie": "1d10",
          "critTable": "II",
          "spellCheck": "+8",
          "actionDice": "1d20+1d16",
          "attackBonus": "d6+2"
        }`)
        
        expect(result[0]['details.alignment']).toBe('c')
        expect(result[0]['class.className']).toBe('Wizard')
        expect(result[0]['details.level.value']).toBe('5')
        expect(result[0]['attributes.critical.die']).toBe('1d10')
        expect(result[0]['attributes.critical.table']).toBe('II')
        expect(result[0]['class.spellCheck']).toBe('+8')
        expect(result[0]['config.actionDice']).toBe('1d20,1d16')
        expect(result[0]['details.attackBonus']).toBe('d6+2')
      })

      it('should handle armor data parsing', async () => {
        const result = parsePCs('{"armorData": "Chainmail (+5) Check penalty (-3) Fumble die (d10)"}')
        const armor = result[0].items.find(item => item.type === 'armor')
        expect(armor.name).toBe('Chainmail')
        expect(armor.system.acBonus).toBe('+5')
        expect(armor.system.checkPenalty).toBe('-3')
        expect(armor.system.fumbleDie).toBe('1d10')
      })
    })
  })

  describe('Plain Text Format Parsing', () => {
    describe('Zero-Level Character Parsing', () => {
      it('should handle missing weapon field', async () => {
        const text = `0-level Occupation: Farmer
        Strength: 10 (0)
        AC: 10; HP: 5
        Speed: 30; Init: 0; Ref: 0; Fort: 0; Will: 0`
        
        const result = parsePCs(text)
        expect(result[0]['details.occupation.value']).toBe('Farmer')
        expect(result[0].items.filter(item => item.type === 'weapon')).toHaveLength(0)
      })

      it('should handle malformed ability score lines', async () => {
        const text = `0-level Occupation: Test
        Strength: (invalid)
        Agility: 15 (+1)
        AC: 10; HP: 5`
        
        const result = parsePCs(text)
        expect(result[0]['abilities.str.value']).toBeNull()
        expect(result[0]['abilities.agl.value']).toBe('15')
      })

      it('should handle missing optional fields', async () => {
        const text = `0-level Occupation: Minimalist
        Strength: 10 (0)
        AC: 10; HP: 5`
        
        const result = parsePCs(text)
        expect(result[0]['details.occupation.value']).toBe('Minimalist')
        expect(result[0]['attributes.ac.value']).toBe('10')
        expect(result[0]['attributes.speed.value']).toBeNull()
        expect(result[0]['saves.frt.value']).toBeNull()
      })

      it('should parse weapon with special damage notation', async () => {
        const text = `0-level Occupation: Fighter
        Weapon: Sword +2 (dmg 1d8+2 plus fire)
        AC: 10; HP: 5`
        
        const result = parsePCs(text)
        const weapon = result[0].items.find(item => item.type === 'weapon')
        expect(weapon.name).toBe('Sword')
        expect(weapon.system.toHit).toBe('+2')
        expect(weapon.system.damage).toBe('1d8+2')
      })
    })

    describe('Upper-Level Character Parsing', () => {
      it('should parse alignment, class, and level from header', async () => {
        const text = `Chaotic Wizard (3rd level)
        Occupation: Former farmer
        Strength: 12 (+1)`
        
        const result = parsePCs(text)
        expect(result[0]['details.alignment']).toBe('c')
        expect(result[0]['class.className']).toBe('Wizard')
        expect(result[0]['details.level.value']).toBe('3')
        expect(result[0]['details.occupation.value']).toBe('Former farmer')
      })

      it('should handle alternative AC format with armor description', async () => {
        const text = `Lawful Warrior (2nd level)
        AC: (15)* (Chainmail & Shield (+6) Check penalty (-5) Fumble die (d12))
        HP: 20`
        
        const result = parsePCs(text)
        expect(result[0]['attributes.ac.value']).toBe('15')
        expect(result[0]['details.armorData']).toBe('Chainmail & Shield (+6) Check penalty (-5) Fumble die (d12)')
      })

      it('should parse spell section with various spell levels', async () => {
        const text = `Neutral Wizard (5th level)
        Spells: (Spell Check: d20+10)
        1) Magic Missile
        2) Web
        3) Fireball
        4) Polymorph
        5) Teleport`
        
        const result = parsePCs(text)
        expect(result[0]['class.spellCheck']).toBe('+10')
        const spells = result[0].items.filter(item => item.type === 'spell')
        expect(spells).toHaveLength(5)
        expect(spells[0].name).toBe('Magic Missile')
        expect(spells[0].system.level).toBe('1')
        expect(spells[4].name).toBe('Teleport')
        expect(spells[4].system.level).toBe('5')
      })

      it('should parse thief skills section', async () => {
        const text = `Neutral Thief (4th level)
        Thief Skills:
        Backstab: 3 (0)
        Sneak Silently: 15 (+2)
        Pick Lock: 12 (+1)
        Cast Spell From Scroll (d12)`
        
        const result = parsePCs(text)
        expect(result[0]['class.backstab']).toBe('3')
        expect(result[0]['skills.sneakSilently.value']).toBe('15')
        expect(result[0]['skills.pickLock.value']).toBe('12')
        expect(result[0]['skills.castSpellFromScroll.die']).toBe('1d12')
      })

      it('should handle multiple weapon parsing', async () => {
        const text = `Lawful Warrior (3rd level)
        Occupation Weapon: Club melee +5 (dmg 1d4+2+deed)
        Main Weapon: Sword melee +6 (dmg 1d8+3+deed)
        Secondary Weapon: Bow ranged +3 (dmg 1d6+deed)`
        
        const result = parsePCs(text)
        const weapons = result[0].items.filter(item => item.type === 'weapon')
        expect(weapons).toHaveLength(3)
        expect(weapons[0].name).toBe('Club')
        expect(weapons[0].system.damage).toBe('1d4+2+@ab')
        expect(weapons[2].system.melee).toBe(false)
      })
    })

    describe('Multi-Character Plain Text Parsing', () => {
      it('should parse multiple zero-level characters', async () => {
        const text = `Some header text

        0-level Occupation: Farmer
        Strength: 12 (+1)
        AC: 10; HP: 4

        0-level Occupation: Blacksmith  
        Strength: 15 (+1)
        AC: 11; HP: 6`
        
        const result = parsePCs(text)
        expect(result).toHaveLength(2)
        expect(result[0]['details.occupation.value']).toBe('Farmer')
        expect(result[1]['details.occupation.value']).toBe('Blacksmith')
      })

      it('should parse mixed zero and upper level characters', async () => {
        const text = `Header
        
        0-level Occupation: Peasant
        Strength: 10 (0)
        AC: 10; HP: 3

        Lawful Cleric (1st level)
        Occupation: Former peasant  
        Strength: 12 (+1)
        HP: 8`
        
        const result = parsePCs(text)
        expect(result).toHaveLength(2)
        expect(result[0]['details.occupation.value']).toBe('Peasant')
        expect(result[1]['class.className']).toBe('Cleric')
        expect(result[1]['details.level.value']).toBe('1')
      })
    })
  })

  describe('Partial Data Handling', () => {
    it('should handle JSON with missing critical fields', async () => {
      const result = parsePCs('{}')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBeUndefined()
      expect(result[0]['abilities.str.value']).toBe(10)
      expect(result[0]['attributes.hitDice.value']).toBe('1d4')
    })

    it('should handle plain text with only occupation', async () => {
      const result = parsePCs('0-level Occupation: Loner')
      expect(result[0]['details.occupation.value']).toBe('Loner')
      expect(result[0]['abilities.str.value']).toBeNull()
    })

    it('should handle incomplete weapon parsing', async () => {
      const text = `0-level Occupation: Fighter
      Weapon: Broken (dmg`
      
      const result = parsePCs(text)
      expect(result[0].items.filter(item => item.type === 'weapon')).toHaveLength(0)
    })

    it('should handle malformed starting funds', async () => {
      const result = parsePCs('{"startingFunds": "invalid currency format"}')
      const coins = result[0].items.find(item => item.name === 'Coins')
      expect(coins.system.value.cp).toBe('0')
      expect(coins.system.value.gp).toBe('0')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle completely invalid JSON gracefully', async () => {
      const result = parsePCs('{invalid json')
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty string input', async () => {
      const result = parsePCs('')
      expect(result).toEqual([])
    })

    it('should handle whitespace-only input', async () => {
      const result = parsePCs('   \n\r\t   ')
      expect(result).toEqual([])
    })

    it('should handle malformed plain text that doesnt match patterns', async () => {
      const result = parsePCs('This is just random text with no character data')
      expect(result).toEqual([])
    })

    it('should handle text with partial character matches', async () => {
      const text = `Some random text
      0-level Occupation: Incomplete
      Random text in between
      Chaotic Wizard (2nd level)
      More random text`
      
      const result = parsePCs(text)
      expect(result).toHaveLength(2)
      expect(result[0]['details.occupation.value']).toBe('Incomplete')
      expect(result[1]['class.className']).toBe('Wizard')
    })

    it('should handle character with only header line', async () => {
      const result = parsePCs('Lawful Warrior (1st level)')
      expect(result).toHaveLength(1)
      expect(result[0]['class.className']).toBe('Warrior')
      expect(result[0]['details.level.value']).toBe('1')
      expect(result[0]['details.alignment']).toBe('l')
    })
  })

  describe('Equipment and Spell Edge Cases', () => {
    it('should handle multiple equipment fields correctly', async () => {
      const result = parsePCs(`{
        "equipment": "Rope (50 ft)",
        "equipment2": "Torch",
        "equipment3": "Rations (1 day)",
        "tradeGood": "Fine pottery"
      }`)
      
      const equipment = result[0].items.filter(item => item.type === 'equipment')
      expect(equipment).toHaveLength(4)
      expect(equipment.map(e => e.name)).toContain('Rope (50 ft)')
      expect(equipment.map(e => e.name)).toContain('Fine pottery')
    })

    it('should handle spell parsing with empty spell check', async () => {
      const text = `Neutral Wizard (2nd level)
      Spells: (Spell Check: d20)
      1) Light
      2) Invisibility`
      
      const result = parsePCs(text)
      expect(result[0]['class.spellCheck']).toBe('')
      const spells = result[0].items.filter(item => item.type === 'spell')
      expect(spells).toHaveLength(2)
    })

    it('should handle thieves cant language special case', async () => {
      const result = parsePCs('{"languages": "Common, Thieves\' Cant, Dwarf"}')
      expect(result[0]['details.languages']).toBe('Common, Thieves\' Cant, Dwarf')
    })

    it('should handle weapon damage with deed replacement', async () => {
      const text = `Lawful Warrior (3rd level)
      Occupation Weapon: Sword melee +5 (dmg 1d8+3+deed)`
      
      const result = parsePCs(text)
      const weapon = result[0].items.find(item => item.type === 'weapon')
      expect(weapon.system.damage).toBe('1d8+3+@ab')
    })

    it('should handle halfling special sneak skills', async () => {
      const text = `Chaotic Halfling (2nd level)
      Thief Skills:
      Sneak Silently: 10 (+1)
      Hide In Shadows: 8 (0)`
      
      const result = parsePCs(text)
      expect(result[0]['skills.sneakAndHide.value']).toBe('10')
      expect(result[0]['skills.sneakSilently.value']).toBe('10')
      expect(result[0]['skills.hideInShadows.value']).toBe('8')
    })
  })

  describe('Notes Field Population', () => {
    it('should populate notes with character attributes for JSON', async () => {
      const result = parsePCs('{"luckySign": "Test sign", "racialTraits": "Test traits"}')
      expect(result[0]['details.notes.value']).toContain('Test sign')
      expect(result[0]['details.notes.value']).toContain('Test traits')
    })

    it('should include equipment in notes', async () => {
      const result = parsePCs('{"equipment": "Rope", "startingFunds": "50 gp"}')
      expect(result[0]['details.notes.value']).toContain('Equipment')
      expect(result[0]['details.notes.value']).toContain('Rope')
      expect(result[0]['details.notes.value']).toContain('Starting Funds')
    })

    it('should include spell information in notes', async () => {
      const result = parsePCs('{"spells": [{"level": "1", "name": "Magic Missile"}]}')
      expect(result[0]['details.notes.value']).toContain('Spells')
      expect(result[0]['details.notes.value']).toContain('Magic Missile')
    })

    it('should include thief skills in notes', async () => {
      const result = parsePCs('{"thiefSkills": {"raw": "Backstab: +2\\nSneak: +5", "backstab": "+2"}}')
      expect(result[0]['details.notes.value']).toContain('Skills')
      expect(result[0]['details.notes.value']).toContain('Sneak: +5')
    })
  })

  describe('Weapon Parsing Edge Cases', () => {
    it('should determine melee vs ranged correctly', async () => {
      const meleeText = `0-level Occupation: Fighter
      Weapon: Club melee +1 (dmg 1d4+1)`
      
      const rangedText = `0-level Occupation: Hunter  
      Weapon: Bow ranged +2 (dmg 1d6)`
      
      const unknownText = `0-level Occupation: Peasant
      Weapon: Rock +0 (dmg 1d3)`
      
      const meleeResult = parsePCs(meleeText)
      const rangedResult = parsePCs(rangedText)
      const unknownResult = parsePCs(unknownText)
      
      expect(meleeResult[0].items[0].system.melee).toBe(true)
      expect(rangedResult[0].items[0].system.melee).toBe(false)
      expect(unknownResult[0].items[0].system.melee).toBe(true) // Default
    })

    it('should handle weapon with attack bonus extraction', async () => {
      const result = parsePCs('{"weapons": [{"name": "Magic Sword +2", "attackDamage": "1d8+3"}]}')
      const weapon = result[0].items[0]
      expect(weapon.name).toBe('Magic Sword +2')
      expect(weapon.system.damageWeaponBonus).toBe('+2') // Extracted from name
      expect(weapon.system.attackBonusWeapon).toBe('+2')
    })

    it('should handle empty weapon slots in upper level parsing', async () => {
      const text = `Lawful Warrior (2nd level)
      Occupation Weapon: Dagger melee +2 (dmg 1d4+1)
      Main Weapon:
      Secondary Weapon:`
      
      const result = parsePCs(text)
      const weapons = result[0].items.filter(item => item.type === 'weapon')
      expect(weapons).toHaveLength(1)
      expect(weapons[0].name).toBe('Dagger')
    })
  })
})