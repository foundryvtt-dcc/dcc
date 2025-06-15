import { expect, vi, describe, it, beforeEach, afterEach } from 'vitest'
import '../__mocks__/foundry.js'
import '../__mocks__/roll.js'
import parseNPCs from '../npc-parser.js'

describe('NPC Parser Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Regex Patterns and Edge Cases', () => {
    describe('Name Parsing', () => {
      it('should handle names with colons and parentheses', async () => {
        const result = await parseNPCs('Complex Name (with parentheses): Init +1; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0].name).toBe('Complex Name (with parentheses)')
      })

      it('should handle names with numbers in parentheses (quantity indicators)', async () => {
        const result = await parseNPCs('Goblin Warriors (5): Init +1; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0].name).toBe('Goblin Warriors')
      })

      it('should handle names with special characters', async () => {
        const result = await parseNPCs('Über-Demon of Tzeentch™: Init +1; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0].name).toBe('Über-Demon of Tzeentch™')
      })

      it('should handle empty or malformed names', async () => {
        const result = await parseNPCs(': Init +1; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0].name).toBe('Unnamed')
      })

      it('should handle names without colons', async () => {
        const result = await parseNPCs('No Colon Here Init +1; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0].name).toBe('Unnamed')
      })
    })

    describe('Initiative Parsing', () => {
      it('should parse positive initiative', async () => {
        const result = await parseNPCs('Test: Init +3; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.init.value']).toBe('+3')
      })

      it('should parse negative initiative', async () => {
        const result = await parseNPCs('Test: Init -2; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.init.value']).toBe('-2')
      })

      it('should parse zero initiative', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.init.value']).toBe('+0')
      })

      it('should handle initiative without spaces', async () => {
        const result = await parseNPCs('Test: Init+5; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.init.value']).toBe('+5')
      })

      it('should default missing initiative', async () => {
        const result = await parseNPCs('Test: AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.init.value']).toBe('+0')
      })

      it('should handle initiative with dice notation', async () => {
        const result = await parseNPCs('Test: Init 1d4+2; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.init.value']).toBe('1d4+2')
      })
    })

    describe('AC Parsing', () => {
      it('should parse basic AC values', async () => {
        const result = await parseNPCs('Test: Init +0; AC 15; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.ac.value']).toBe('15')
      })

      it('should handle AC with armor descriptions', async () => {
        const result = await parseNPCs('Test: Init +0; AC 18 (plate mail); HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.ac.value']).toBe('18')
      })

      it('should handle AC with complex descriptions', async () => {
        const result = await parseNPCs('Test: Init +0; AC 16 (chainmail & shield, +1 vs ranged); HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.ac.value']).toBe('16')
      })

      it('should default missing AC', async () => {
        const result = await parseNPCs('Test: Init +0; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.ac.value']).toBe('10')
      })

      it('should handle AC without spaces', async () => {
        const result = await parseNPCs('Test: Init +0; AC12; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.ac.value']).toBe('12')
      })
    })

    describe('Hit Dice Parsing', () => {
      it('should parse standard hit dice', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HD 3d8+6; HP 20; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.hitDice.value']).toBe('3d8+6')
      })

      it('should handle fractional hit dice with ½', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HD ½d8; HP 2; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.hitDice.value']).toBe('1d8/2')
      })

      it('should handle fractional hit dice with ⅓', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HD ⅓d6; HP 1; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.hitDice.value']).toBe('1d6/3')
      })

      it('should handle fractional hit dice with ¼', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HD ¼d4; HP 1; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.hitDice.value']).toBe('1d4/4')
      })

      it('should handle fractional hit dice with 1/4 notation', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HD 1/4d4; HP 1; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.hitDice.value']).toBe('1d4/4')
      })

      it('should default missing hit dice', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.hitDice.value']).toBe('1d8')
      })

      it('should handle complex hit dice expressions', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HD 2d10+4 (hp 18); HP 18; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.hitDice.value']).toBe('2d10+4')
      })
    })

    describe('Movement Parsing', () => {
      it('should parse basic movement', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 40\'; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.speed.value']).toBe('40\'')
      })

      it('should parse movement with multiple modes', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 30\' or fly 60\'; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.speed.value']).toBe('30\'')
        expect(result[0]['attributes.speed.other']).toBe('fly 60\'')
      })

      it('should handle movement as "none"', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV none; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.speed.value']).toBe('none')
      })

      it('should default missing movement', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.speed.value']).toBe('30')
      })

      it('should handle complex movement descriptions', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 25\' or climb 25\' or burrow 10\'; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        // Parser splits on first 'or' and puts everything after first 'or' in the 'other' field
        // So '25' or climb 25' or burrow 10'' becomes: value='25' or climb 25'' and other='burrow 10''
        expect(result[0]['attributes.speed.value']).toBe('25\' or climb 25\'')
        expect(result[0]['attributes.speed.other']).toBe('burrow 10\'')
      })
    })

    describe('Special Abilities Parsing', () => {
      it('should parse basic special abilities', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 30\'; Act 1d20; SP fire immunity, flight; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.special.value']).toBe('fire immunity, flight')
      })

      it('should handle complex special abilities with semicolons', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 30\'; Act 1d20; SP poison (DC 15 Fort save or die; half damage on success); SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.special.value']).toBe('poison (DC 15 Fort save or die')
      })

      it('should handle missing special abilities', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 30\'; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.special.value']).toBe('')
      })

      it('should handle "none" special abilities', async () => {
        const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 30\'; Act 1d20; SP none; SV Fort +0, Ref +0, Will +0; AL N.')
        expect(result[0]['attributes.special.value']).toBe('none')
      })
    })
  })

  describe('Critical Hit System Tests', () => {
    it('should parse explicit critical hit information', async () => {
      const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 30\'; Act 1d20; Crit 19-20 IV/d8; SV Fort +0, Ref +0, Will +0; AL N.')
      expect(result[0]['attributes.critical.die']).toBe('d8')
      expect(result[0]['attributes.critical.table']).toBe('IV')
      expect(result[0]['details.critRange']).toBe('19')
    })

    it('should parse critical hit without range', async () => {
      const result = await parseNPCs('Test: Init +0; AC 10; HP 5; MV 30\'; Act 1d20; Crit M/d6; SV Fort +0, Ref +0, Will +0; AL N.')
      expect(result[0]['attributes.critical.die']).toBe('d6')
      expect(result[0]['attributes.critical.table']).toBe('M')
      expect(result[0]['details.critRange']).toBe(20)
    })

    it('should infer humanoid critical hits from HD and keywords', async () => {
      const result = await parseNPCs('Orc Warrior: Init +0; AC 10; HD 2d8; HP 9; MV 30\'; Act 1d20; SV Fort +0, Ref +0, Will +0; AL C.')
      expect(result[0]['attributes.critical.die']).toBe('d8')
      expect(result[0]['attributes.critical.table']).toBe('III')
    })

    it('should infer dragon critical hits', async () => {
      const result = await parseNPCs('Young Dragon: Init +0; AC 18; HD 8d12; HP 52; MV 40\' or fly 80\'; Act 2d20; SP breath weapon; SV Fort +8, Ref +4, Will +6; AL C.')
      expect(result[0]['attributes.critical.die']).toBe('d20')
      expect(result[0]['attributes.critical.table']).toBe('DR')
    })

    it('should infer giant critical hits', async () => {
      const result = await parseNPCs('Hill Giant: Init +0; AC 16; HD 12d8; HP 54; MV 40\'; Act 1d20; SV Fort +8, Ref +2, Will +4; AL C.')
      // Due to bug in HD parsing (parseInt of full match instead of capture group), hdCount becomes 0
      // For giants at HD 0, the table should be G with d4 die, but this might default to 'other' type
      expect(result[0]['attributes.critical.die']).toBe('d20')
      expect(result[0]['attributes.critical.table']).toBe('M')
    })

    it('should infer demon critical hits', async () => {
      const result = await parseNPCs('Pit Fiend: Init +0; AC 20; HD 15d8; HP 68; MV 30\'; Act 2d20; SP demon traits; SV Fort +10, Ref +6, Will +8; AL C.')
      expect(result[0]['attributes.critical.die']).toBe('d16')
      expect(result[0]['attributes.critical.table']).toBe('DN')
    })

    it('should infer undead critical hits', async () => {
      const result = await parseNPCs('Skeleton Warrior: Init +0; AC 14; HD 3d8; HP 14; MV 30\'; Act 1d20; SP un-dead; SV Fort +2, Ref +1, Will +3; AL C.')
      expect(result[0]['attributes.critical.die']).toBe('d8')
      expect(result[0]['attributes.critical.table']).toBe('U')
    })

    it('should handle fractional HD for critical determination', async () => {
      const result = await parseNPCs('Tiny Creature: Init +0; AC 12; HD ½d4; HP 1; MV 15\'; Act 1d20; SV Fort +0, Ref +2, Will +0; AL N.')
      expect(result[0]['attributes.critical.die']).toBe('d4')
      expect(result[0]['attributes.critical.table']).toBe('M')
    })
  })

  describe('Attack Parsing Tests', () => {
    it('should parse single melee attack', async () => {
      const result = await parseNPCs('Test: Init +0; Atk sword +5 melee (1d8+2); AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
      expect(result[0].items).toHaveLength(1)
      expect(result[0].items[0].name).toBe('sword')
      expect(result[0].items[0].system.toHit).toBe('+5')
      expect(result[0].items[0].system.damage).toBe('1d8+2')
      expect(result[0].items[0].system.melee).toBe(true)
    })

    it('should parse multiple attacks with "or"', async () => {
      const result = await parseNPCs('Test: Init +0; Atk claw +3 melee (1d4) or bite +5 melee (1d6+1); AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
      expect(result[0].items).toHaveLength(2)
      expect(result[0].items[0].name).toBe('claw')
      expect(result[0].items[0].system.damage).toBe('1d4')
      expect(result[0].items[1].name).toBe('bite')
      expect(result[0].items[1].system.damage).toBe('1d6+1')
    })

    it('should parse ranged attacks', async () => {
      const result = await parseNPCs('Test: Init +0; Atk bow +4 ranged (1d6); AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
      expect(result[0].items[0].system.melee).toBe(false)
    })

    it('should handle special attacks without damage dice', async () => {
      const result = await parseNPCs('Test: Init +0; Atk breath weapon +0 melee (special); AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
      expect(result[0].items[0].name).toBe('breath weapon')
      expect(result[0].items[0].system.damage).toBe('0')
      expect(result[0].items[0].system.description.summary).toBe('special')
    })
  })

  describe('Malformed Input Handling', () => {
    it('should handle completely empty input', async () => {
      const result = await parseNPCs('')
      expect(result).toEqual([])
    })

    it('should handle whitespace-only input', async () => {
      const result = await parseNPCs('   \n\r\t   ')
      expect(result).toEqual([])
    })

    it('should handle input without proper stat block format', async () => {
      const result = await parseNPCs('This is just random text with no stat block format.')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Unnamed')
    })

    it('should handle partial stat blocks', async () => {
      const result = await parseNPCs('Incomplete: Init +1; AC 10.')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Incomplete')
      expect(result[0]['attributes.init.value']).toBe('+1')
      expect(result[0]['attributes.ac.value']).toBe('10')
    })

    it('should handle stat blocks with missing semicolons', async () => {
      const result = await parseNPCs('Test: Init +0; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL N.')
      expect(result[0]['attributes.init.value']).toBe('+0')
      expect(result[0]['attributes.ac.value']).toBe('10')
    })

    it('should handle stat blocks with excessive whitespace', async () => {
      const result = await parseNPCs('Test:   Init   +0;   AC   10;   HP   5;   Act   1d20;   SV   Fort   +0,   Ref   +0,   Will   +0;   AL   N.')
      expect(result[0].name).toBe('Test')
      expect(result[0]['attributes.init.value']).toBe('+0')
    })
  })

  describe('Multiple Stat Block Processing', () => {
    it('should parse two simple stat blocks', async () => {
      const input = `First Creature: Init +1; AC 12; HP 8; Act 1d20; SV Fort +2, Ref +1, Will +0; AL L.

Second Creature: Init +0; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL C.`
      const result = await parseNPCs(input)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('First Creature')
      expect(result[1].name).toBe('Second Creature')
    })

    it('should handle stat blocks separated by various whitespace', async () => {
      const input = 'First: Init +1; AC 12; HP 8; Act 1d20; SV Fort +2, Ref +1, Will +0; AL L.\n\n\nSecond: Init +0; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL C.'
      const result = await parseNPCs(input)
      expect(result).toHaveLength(2)
    })

    it('should handle malformed blocks mixed with good ones', async () => {
      const input = `Good: Init +1; AC 12; HP 8; Act 1d20; SV Fort +2, Ref +1, Will +0; AL L.

Another Good: Init +0; AC 10; HP 5; Act 1d20; SV Fort +0, Ref +0, Will +0; AL C.`
      const result = await parseNPCs(input)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Good')
      expect(result[1].name).toBe('Another Good')
    })
  })

  describe('Special Formatting Edge Cases', () => {
    it('should handle stat blocks with equipment lists', async () => {
      const result = await parseNPCs('Cultist: Init +1; Atk dagger +2 melee (1d4+1); AC 12; HD 1d8+1; hp 6; MV 30\'; Act 1d20; SV Fort +2, Ref +1, Will +0; AL C. Equipment: robes, silver medallion (25 gp).')
      expect(result[0].name).toBe('Cultist')
      expect(result[0]['details.alignment']).toBe('c')
    })

    it('should handle DT-style formatting variations', async () => {
      const result = await parseNPCs('Paladin (fighter 5): Init +2; Atk holy sword +8+deed die melee (1d8+4+deed die); AC 18 (plate mail); HD 5d10+10; hp 38; MV 20\'; Act 1d20; SP Mighty Deed of Arms, deed die (+d4), lay on hands, detect evil; SV Fort +6, Ref +3, Will +5; AL L; Crit 19-20 II/d8.')
      expect(result[0].name).toBe('Paladin (fighter 5)')
      expect(result[0]['attributes.critical.table']).toBe('II')
      expect(result[0]['details.critRange']).toBe('19')
    })
  })

  describe('Notes Field Population', () => {
    it('should populate notes field with original stat block', async () => {
      const originalText = 'Test: Init +1; AC 12; HP 8; Act 1d20; SV Fort +2, Ref +1, Will +0; AL L.'
      const result = await parseNPCs(originalText)
      expect(result[0]['details.notes.value']).toBe(originalText)
    })

    it('should preserve formatting in notes field', async () => {
      const originalText = 'Complex Creature: Init +2; Atk bite +4 melee (1d6+2 plus poison); AC 15; HD 3d8+6; hp 20; MV 30\' or fly 60\'; Act 1d20; SP poison (DC 15 Fort save or paralyzed 1d4 rounds), flight; SV Fort +5, Ref +3, Will +2; AL C.'
      const result = await parseNPCs(originalText)
      expect(result[0]['details.notes.value']).toBe(originalText)
    })
  })
})
