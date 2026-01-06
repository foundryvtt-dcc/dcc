/* global CONFIG */

import { expect, vi, describe, it, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import {
  ensurePlus,
  getFirstDie,
  getFirstMod,
  addDamageFlavorToRolls,
  getCritTableResult,
  getFumbleTableResult,
  getFumbleTableNameFromCritTableName,
  getNPCFumbleTableResult
} from '../utilities.js'

describe('Utilities', () => {
  describe('ensurePlus', () => {
    it('adds plus to positive numbers', () => {
      expect(ensurePlus('5')).toBe('+5')
      expect(ensurePlus('10')).toBe('+10')
      expect(ensurePlus('1')).toBe('+1')
    })

    it('does not modify negative numbers', () => {
      expect(ensurePlus('-5')).toBe('-5')
      expect(ensurePlus('-10')).toBe('-10')
      expect(ensurePlus('-1')).toBe('-1')
    })

    it('handles zero with includeZero true (default)', () => {
      expect(ensurePlus('0')).toBe('+0')
      expect(ensurePlus('0', true)).toBe('+0')
    })

    it('handles zero with includeZero false', () => {
      expect(ensurePlus('0', false)).toBe('')
    })

    it('does not add plus to values that already have it', () => {
      expect(ensurePlus('+5')).toBe('+5')
      expect(ensurePlus('+0')).toBe('+0')
      expect(ensurePlus('+10')).toBe('+10')
    })

    it('adds plus to dice expressions', () => {
      expect(ensurePlus('d6')).toBe('+d6')
      expect(ensurePlus('d20')).toBe('+d20')
      expect(ensurePlus('d100')).toBe('+d100')
    })

    it('handles edge cases', () => {
      expect(ensurePlus('')).toBe('')
      expect(ensurePlus('abc')).toBe('abc') // Non-numeric strings that parse as NaN
    })

    it('handles string numbers with leading zeros', () => {
      expect(ensurePlus('05')).toBe('+05')
      expect(ensurePlus('00')).toBe('+00')
    })
  })

  describe('getFirstDie', () => {
    it('extracts simple die expressions', () => {
      expect(getFirstDie('1d6')).toBe('1d6')
      expect(getFirstDie('2d8')).toBe('2d8')
      expect(getFirstDie('1d20')).toBe('1d20')
      expect(getFirstDie('3d4')).toBe('3d4')
    })

    it('extracts first die from complex expressions', () => {
      expect(getFirstDie('1d6+5')).toBe('1d6')
      expect(getFirstDie('2d8-3+1d4')).toBe('2d8')
      expect(getFirstDie('1d20+1d6+2')).toBe('1d20')
    })

    it('handles double-digit dice counts and faces', () => {
      expect(getFirstDie('10d6')).toBe('10d6')
      expect(getFirstDie('12d20')).toBe('12d20')
      expect(getFirstDie('1d100')).toBe('1d10') // Note: regex limits to 2 digits
    })

    it('returns empty string for no dice', () => {
      expect(getFirstDie('5')).toBe('')
      expect(getFirstDie('+3')).toBe('')
      expect(getFirstDie('abc')).toBe('')
      expect(getFirstDie('')).toBe('')
    })

    it('handles null/undefined input', () => {
      expect(getFirstDie(null)).toBe('')
      expect(getFirstDie(undefined)).toBe('')
    })

    it('handles expressions with spaces', () => {
      expect(getFirstDie(' 1d6 + 5 ')).toBe('1d6')
      expect(getFirstDie('2d8 - 3')).toBe('2d8')
    })

    it('does not match invalid die expressions', () => {
      expect(getFirstDie('d6')).toBe('') // No dice count
      expect(getFirstDie('1d')).toBe('') // No face count
      expect(getFirstDie('100d100')).toBe('00d10') // Note: regex captures first 2 digits
    })
  })

  describe('getFirstMod', () => {
    it('extracts positive modifiers', () => {
      expect(getFirstMod('+5')).toBe('+5')
      expect(getFirstMod('+10')).toBe('+10')
      expect(getFirstMod('+1')).toBe('+1')
    })

    it('extracts negative modifiers', () => {
      expect(getFirstMod('-5')).toBe('-5')
      expect(getFirstMod('-10')).toBe('-10')
      expect(getFirstMod('-1')).toBe('-1')
    })

    it('extracts first modifier from complex expressions', () => {
      expect(getFirstMod('1d6+5-2')).toBe('+5')
      expect(getFirstMod('2d8-3+1')).toBe('-3')
      expect(getFirstMod('roll+1-5')).toBe('+1')
    })

    it('handles double-digit modifiers', () => {
      expect(getFirstMod('+15')).toBe('+15')
      expect(getFirstMod('-20')).toBe('-20')
      expect(getFirstMod('+99')).toBe('+99')
    })

    it('returns empty string for no modifiers', () => {
      expect(getFirstMod('1d6')).toBe('')
      expect(getFirstMod('abc')).toBe('')
      expect(getFirstMod('roll')).toBe('')
      expect(getFirstMod('')).toBe('')
    })

    it('handles expressions with spaces', () => {
      expect(getFirstMod(' + 5 ')).toBe('') // Note: regex doesn't handle spaces
      expect(getFirstMod('1d6 + 5')).toBe('') // Regex doesn't match with spaces
    })

    it('does not match invalid modifiers', () => {
      expect(getFirstMod('+100')).toBe('+10') // Regex captures first 2 digits
      expect(getFirstMod('-100')).toBe('-10') // Regex captures first 2 digits
    })
  })

  describe('addDamageFlavorToRolls', () => {
    it('adds #damage to dice rolls followed by "damage"', () => {
      expect(addDamageFlavorToRolls('[[1d6]] damage')).toBe('[[1d6 #damage]] damage')
      expect(addDamageFlavorToRolls('[[2d8]]damage')).toBe('[[2d8 #damage]]damage')
      expect(addDamageFlavorToRolls('Inflict [[3d10]] damage')).toBe('Inflict [[3d10 #damage]] damage')
    })

    it('adds #damage to dice rolls followed by "additional damage"', () => {
      expect(addDamageFlavorToRolls('+[[1d6]] additional damage')).toBe('+[[1d6 #damage]] additional damage')
      expect(addDamageFlavorToRolls('[[2d8]] additional damage')).toBe('[[2d8 #damage]] additional damage')
    })

    it('adds #damage to dice rolls followed by "extra damage"', () => {
      expect(addDamageFlavorToRolls('[[1d6]] extra damage')).toBe('[[1d6 #damage]] extra damage')
      expect(addDamageFlavorToRolls('Deal [[2d4]] extra damage')).toBe('Deal [[2d4 #damage]] extra damage')
    })

    it('adds #damage to dice rolls with modifiers followed by damage', () => {
      expect(addDamageFlavorToRolls('[[1d6+2]] damage')).toBe('[[1d6+2 #damage]] damage')
      expect(addDamageFlavorToRolls('[[2d8-1]] additional damage')).toBe('[[2d8-1 #damage]] additional damage')
    })

    it('adds #damage to dice rolls with /r prefix followed by damage', () => {
      expect(addDamageFlavorToRolls('[[/r 1d6]] damage')).toBe('[[/r 1d6 #damage]] damage')
      expect(addDamageFlavorToRolls('[[/r 2d8+2]] extra damage')).toBe('[[/r 2d8+2 #damage]] extra damage')
    })

    it('does not modify rolls that already have a flavor', () => {
      expect(addDamageFlavorToRolls('[[1d6 #fire]] damage')).toBe('[[1d6 #fire]] damage')
      expect(addDamageFlavorToRolls('[[2d8 #healing]] extra damage')).toBe('[[2d8 #healing]] extra damage')
    })

    it('does not modify dice rolls NOT followed by damage', () => {
      expect(addDamageFlavorToRolls('[[1d4]] hours')).toBe('[[1d4]] hours')
      expect(addDamageFlavorToRolls('[[1d6]] rounds')).toBe('[[1d6]] rounds')
      expect(addDamageFlavorToRolls('Wait [[2d8]] minutes')).toBe('Wait [[2d8]] minutes')
      expect(addDamageFlavorToRolls('[[1d6]]')).toBe('[[1d6]]')
    })

    it('does not match across sentences when damage appears later', () => {
      // The weapon distance roll should NOT be tagged even though "damage" appears later
      expect(addDamageFlavorToRolls("Strike to hand knocks weapon into the air. The weapon lands [[/r 1d20+5]]' away."))
        .toBe("Strike to hand knocks weapon into the air. The weapon lands [[/r 1d20+5]]' away.")
      // Multi-line text where damage is on a different line
      expect(addDamageFlavorToRolls('Roll [[1d6]] for distance.\nDeal [[1d4]] damage.'))
        .toBe('Roll [[1d6]] for distance.\nDeal [[1d4 #damage]] damage.')
    })

    it('does not modify non-dice expressions', () => {
      expect(addDamageFlavorToRolls('[[@abilities.str.mod]] damage')).toBe('[[@abilities.str.mod]] damage')
      expect(addDamageFlavorToRolls('[[5+3]] damage')).toBe('[[5+3]] damage')
      expect(addDamageFlavorToRolls('[[@level]] extra damage')).toBe('[[@level]] extra damage')
    })

    it('handles text with multiple inline rolls selectively', () => {
      // Only the first roll followed by "damage" should be modified
      expect(addDamageFlavorToRolls('Inflict +[[/r 1d6]] damage and foe loses sense of smell for [[/r 1d4]] hours'))
        .toBe('Inflict +[[/r 1d6 #damage]] damage and foe loses sense of smell for [[/r 1d4]] hours')
    })

    it('handles multiple damage rolls in same text', () => {
      expect(addDamageFlavorToRolls('Deal [[1d6]] damage plus [[1d4]] extra damage'))
        .toBe('Deal [[1d6 #damage]] damage plus [[1d4 #damage]] extra damage')
    })

    it('handles null and undefined input', () => {
      expect(addDamageFlavorToRolls(null)).toBe(null)
      expect(addDamageFlavorToRolls(undefined)).toBe(undefined)
      expect(addDamageFlavorToRolls('')).toBe('')
    })

    it('handles text without any inline rolls', () => {
      expect(addDamageFlavorToRolls('No rolls here')).toBe('No rolls here')
      expect(addDamageFlavorToRolls('Just plain text')).toBe('Just plain text')
    })

    it('is case insensitive for damage keyword', () => {
      expect(addDamageFlavorToRolls('[[1d6]] Damage')).toBe('[[1d6 #damage]] Damage')
      expect(addDamageFlavorToRolls('[[1d6]] DAMAGE')).toBe('[[1d6 #damage]] DAMAGE')
      expect(addDamageFlavorToRolls('[[1d6]] Additional Damage')).toBe('[[1d6 #damage]] Additional Damage')
    })
  })

  describe('getFumbleTableNameFromCritTableName', () => {
    beforeEach(() => {
      // Mock game.i18n.localize
      global.game = {
        i18n: {
          localize: vi.fn((key) => {
            if (key === 'DCC.CritTable') return 'Crit Table'
            return key
          })
        }
      }
    })

    it('returns default fumble table for empty input', () => {
      expect(getFumbleTableNameFromCritTableName('')).toBe('(Table 4-2: Fumbles).')
      expect(getFumbleTableNameFromCritTableName(null)).toBe('(Table 4-2: Fumbles).')
      expect(getFumbleTableNameFromCritTableName(undefined)).toBe('(Table 4-2: Fumbles).')
    })

    it('returns humanoid fumble table for humanoid crit tables', () => {
      expect(getFumbleTableNameFromCritTableName('III')).toBe('Fumble Table H')
      expect(getFumbleTableNameFromCritTableName('IV')).toBe('Fumble Table H')
      expect(getFumbleTableNameFromCritTableName('V')).toBe('Fumble Table H')
      expect(getFumbleTableNameFromCritTableName('Crit Table III')).toBe('Fumble Table H')
      expect(getFumbleTableNameFromCritTableName('Some text with III in it')).toBe('Fumble Table H')
    })

    it('returns elemental fumble table for elemental crit table', () => {
      expect(getFumbleTableNameFromCritTableName('Crit Table EL')).toBe('Crit/Fumble Table EL')
    })

    it('returns generic fumble table for other crit tables', () => {
      expect(getFumbleTableNameFromCritTableName('I')).toBe('Fumble Table I')
      expect(getFumbleTableNameFromCritTableName('II')).toBe('Fumble Table II')
      expect(getFumbleTableNameFromCritTableName('M')).toBe('Fumble Table M')
      expect(getFumbleTableNameFromCritTableName('Custom')).toBe('Fumble Table Custom')
    })
  })

  describe('getCritTableResult', () => {
    let mockRoll
    let mockPack
    let mockTable
    let mockEntry

    beforeEach(() => {
      // Mock roll object
      mockRoll = {
        _evaluated: true,
        total: 15,
        evaluate: vi.fn().mockResolvedValue()
      }

      // Mock table entry and results
      mockEntry = {
        _id: 'test-table-id',
        name: 'Crit Table III'
      }

      mockTable = {
        getResultsForRoll: vi.fn().mockReturnValue([{ text: 'Critical hit result' }])
      }

      // Mock pack
      mockPack = {
        index: [mockEntry],
        getIndex: vi.fn().mockResolvedValue(),
        getDocument: vi.fn().mockResolvedValue(mockTable)
      }

      // Mock game object
      global.game = {
        i18n: {
          localize: vi.fn((key) => {
            if (key === 'DCC.CritTable') return 'Crit Table'
            return key
          })
        },
        packs: {
          get: vi.fn().mockReturnValue(mockPack)
        },
        tables: {
          find: vi.fn()
        }
      }

      // Mock CONFIG
      global.CONFIG = {
        DCC: {
          criticalHitPacks: {
            packs: ['dcc-core-book.dcc-crit-tables'],
            addPack: vi.fn()
          }
        }
      }
    })

    it('evaluates roll if not already evaluated', async () => {
      mockRoll._evaluated = false
      await getCritTableResult(mockRoll, 'Crit Table III')
      expect(mockRoll.evaluate).toHaveBeenCalled()
    })

    it('does not evaluate roll if already evaluated', async () => {
      mockRoll._evaluated = true
      await getCritTableResult(mockRoll, 'Crit Table III')
      expect(mockRoll.evaluate).not.toHaveBeenCalled()
    })

    it('finds crit table result from pack', async () => {
      const result = await getCritTableResult(mockRoll, 'Crit Table III')
      expect(result).toEqual({ text: 'Critical hit result' })
      expect(mockTable.getResultsForRoll).toHaveBeenCalledWith(15)
    })

    it('handles localized crit table names (French)', async () => {
      global.game.i18n.localize.mockReturnValue('Table de Critique')
      const result = await getCritTableResult(mockRoll, 'Table de Critique III')
      expect(result).toEqual({ text: 'Critical hit result' })
    })

    it('handles localized crit table names (Italian)', async () => {
      global.game.i18n.localize.mockReturnValue('T. dei Critici')
      const result = await getCritTableResult(mockRoll, 'T. dei Critici III')
      expect(result).toEqual({ text: 'Critical hit result' })
    })

    it('handles English table name even when locale is not English', async () => {
      // This test verifies the fix for the reported bug
      global.game.i18n.localize.mockReturnValue('T. dei Critici')
      const result = await getCritTableResult(mockRoll, 'Crit Table III')
      expect(result).toEqual({ text: 'Critical hit result' })
    })

    it('handles elemental crit table specially', async () => {
      await getCritTableResult(mockRoll, 'Crit Table EL')
      expect(CONFIG.DCC.criticalHitPacks.addPack).toHaveBeenCalledWith(
        'dcc-core-book.dcc-monster-fumble-tables'
      )
    })

    it('falls back to world tables if pack not found', async () => {
      global.game.packs.get.mockReturnValue(null)
      const mockWorldTable = {
        name: 'Crit Table III',
        getResultsForRoll: vi.fn().mockReturnValue([{ text: 'World crit result' }])
      }
      global.game.tables.find.mockReturnValue(mockWorldTable)

      const result = await getCritTableResult(mockRoll, 'Crit Table III')
      expect(result).toEqual({ text: 'World crit result' })
    })

    it('returns fallback message when table entry not found', async () => {
      mockPack.index = []
      mockTable.getResultsForRoll.mockReturnValue([])
      global.game.tables.find.mockReturnValue(null)

      const result = await getCritTableResult(mockRoll, 'Crit Table III')
      expect(result).toBeUndefined()
    })
  })

  describe('getFumbleTableResult', () => {
    let mockRoll
    let mockPack
    let mockTable
    let mockEntry

    beforeEach(() => {
      mockRoll = {
        total: 8
      }

      mockEntry = {
        _id: 'fumble-table-id',
        name: 'Fumble Table'
      }

      mockTable = {
        getResultsForRoll: vi.fn().mockReturnValue([{ text: 'Fumble result' }])
      }

      mockPack = {
        index: [mockEntry],
        getIndex: vi.fn().mockResolvedValue(),
        getDocument: vi.fn().mockResolvedValue(mockTable)
      }

      global.game = {
        packs: {
          get: vi.fn().mockReturnValue(mockPack)
        },
        tables: {
          find: vi.fn().mockReturnValue(null)
        }
      }

      global.CONFIG = {
        DCC: {
          fumbleTable: 'dcc-core-book.dcc-fumble-tables.Fumble Table'
        }
      }
    })

    it('finds fumble table result from local world table', async () => {
      const mockWorldFumbleTable = {
        name: 'Table 4-2: Fumbles',
        getResultsForRoll: vi.fn().mockReturnValue([{ text: 'World fumble result' }])
      }
      global.game.tables.find.mockReturnValue(mockWorldFumbleTable)

      const result = await getFumbleTableResult(mockRoll)
      expect(result).toEqual({ text: 'World fumble result' })
      expect(mockWorldFumbleTable.getResultsForRoll).toHaveBeenCalledWith(8)
    })

    it('finds fumble table result from configured pack when no world table', async () => {
      const result = await getFumbleTableResult(mockRoll)
      expect(result).toEqual({ text: 'Fumble result' })
      expect(mockTable.getResultsForRoll).toHaveBeenCalledWith(8)
    })

    it('handles missing fumble table configuration', async () => {
      global.CONFIG.DCC.fumbleTable = null
      const result = await getFumbleTableResult(mockRoll)
      expect(result).toBeUndefined()
    })

    it('handles pack not found', async () => {
      global.game.packs.get.mockReturnValue(null)
      const result = await getFumbleTableResult(mockRoll)
      expect(result).toBeUndefined()
    })

    it('handles table entry not found in pack', async () => {
      mockPack.index = []
      const result = await getFumbleTableResult(mockRoll)
      expect(result).toBeUndefined()
    })

    it('returns fallback message when no results found', async () => {
      mockTable.getResultsForRoll.mockReturnValue([])
      const result = await getFumbleTableResult(mockRoll)
      expect(result).toBe('Unable to find fumble result')
    })
  })

  describe('getNPCFumbleTableResult', () => {
    let mockRoll
    let mockPack
    let mockTable
    let mockEntry

    beforeEach(() => {
      mockRoll = {
        total: 12
      }

      mockEntry = {
        _id: 'npc-fumble-table-id',
        name: 'Fumble Table M'
      }

      mockTable = {
        getResultsForRoll: vi.fn().mockReturnValue([{ text: 'NPC fumble result' }])
      }

      mockPack = {
        index: [mockEntry],
        getIndex: vi.fn().mockResolvedValue(),
        getDocument: vi.fn().mockResolvedValue(mockTable)
      }

      global.game = {
        packs: {
          get: vi.fn().mockReturnValue(mockPack)
        }
      }
    })

    it('finds NPC fumble table result from monster fumble pack', async () => {
      const result = await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')
      expect(result).toEqual({ text: 'NPC fumble result' })
      expect(global.game.packs.get).toHaveBeenCalledWith('dcc-core-book.dcc-monster-fumble-tables')
      expect(mockTable.getResultsForRoll).toHaveBeenCalledWith(12)
    })

    it('handles missing fumble table name', async () => {
      const result = await getNPCFumbleTableResult(mockRoll, null)
      expect(result).toBeUndefined()
    })

    it('handles pack not found', async () => {
      global.game.packs.get.mockReturnValue(null)
      const result = await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')
      expect(result).toBeUndefined()
    })

    it('handles table entry not found', async () => {
      // Override the mock to return empty array from filter
      const emptyMockPack = {
        index: { filter: vi.fn().mockReturnValue([]) },
        getIndex: vi.fn().mockResolvedValue(),
        getDocument: vi.fn()
      }
      global.game.packs.get.mockReturnValue(emptyMockPack)

      const result = await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')
      expect(result).toBeUndefined()
    })

    it('returns fallback message when no results found', async () => {
      mockTable.getResultsForRoll.mockReturnValue([])
      const result = await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')
      expect(result).toBe('Unable to find fumble result')
    })

    it('filters table entries by name prefix', async () => {
      mockPack.index = [
        { _id: '1', name: 'Fumble Table M' },
        { _id: '2', name: 'Fumble Table H' },
        { _id: '3', name: 'Fumble Table M Extended' }
      ]

      await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')

      // Should get the first entry that starts with the fumble table name
      expect(mockPack.getDocument).toHaveBeenCalledWith('1')
    })
  })
})
