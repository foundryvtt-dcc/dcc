/* global CONFIG */

import { expect, vi, describe, it, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import {
  docNameMatches,
  ensurePlus,
  findPackEntryByName,
  formatMercurialDescriptionHTML,
  getMercurialSpecial,
  getNameCandidates,
  removeActiveEffectOverrides,
  getFirstDie,
  getFirstMod,
  getSingleActionDie,
  addDamageFlavorToRolls,
  getCritTableLink,
  getCritTableResult,
  getFumbleTableResult,
  getFumbleTableNameFromCritTableName,
  getNPCFumbleTableResult,
  getTableFromPath
} from '../utilities.js'
import { clearAllTableCaches, critTableDocCache, critTableLinkCache } from '../adapter/table-cache.mjs'

describe('Utilities', () => {
  // Issue #339 — special (roll-again) mercurial table entries
  describe('getMercurialSpecial', () => {
    it('reads a rollAgain flag from flags.dcc.mercurial', () => {
      const result = {
        description: 'Roll again twice.',
        flags: { dcc: { mercurial: { action: 'rollAgain', count: 2 } } }
      }
      expect(getMercurialSpecial(result)).toEqual({ action: 'rollAgain', count: 2, formula: '1d100' })
    })

    it('honors a custom formula on the flag', () => {
      const result = {
        description: 'anything',
        flags: { dcc: { mercurial: { action: 'rollAgain', count: 2, formula: '4d20' } } }
      }
      expect(getMercurialSpecial(result)).toEqual({ action: 'rollAgain', count: 2, formula: '4d20' })
    })

    it('clamps malformed counts into 1..10', () => {
      const make = (count) => ({ flags: { dcc: { mercurial: { action: 'rollAgain', count } } } })
      expect(getMercurialSpecial(make(9999)).count).toBe(10)
      expect(getMercurialSpecial(make(-3)).count).toBe(1)
      expect(getMercurialSpecial(make('nonsense')).count).toBe(2)
    })

    it('canonicalizes near-miss flag formulas and rejects unrollable ones (#848)', () => {
      const make = (formula) => ({ flags: { dcc: { mercurial: { action: 'rollAgain', count: 2, formula } } } })
      // Implicit count and uppercase D normalize to the lib's NdX shape
      expect(getMercurialSpecial(make('d6')).formula).toBe('1d6')
      expect(getMercurialSpecial(make('1D8')).formula).toBe('1d8')
      expect(getMercurialSpecial(make(' 2d6+3 ')).formula).toBe('2d6+3')
      expect(getMercurialSpecial(make('3d10-2')).formula).toBe('3d10-2')
      // Garbage, zero-faced, and empty formulas fall back to 1d100
      expect(getMercurialSpecial(make('banana')).formula).toBe('1d100')
      expect(getMercurialSpecial(make('2d0')).formula).toBe('1d100')
      expect(getMercurialSpecial(make('')).formula).toBe('1d100')
    })

    it('ignores flags with an unknown action', () => {
      const result = {
        description: 'A plain effect.',
        flags: { dcc: { mercurial: { action: 'somethingElse', count: 2 } } }
      }
      expect(getMercurialSpecial(result)).toBeNull()
    })

    it('falls back to text detection for the un-flagged core 99 entry', () => {
      expect(getMercurialSpecial({ description: 'Roll again twice.' }))
        .toEqual({ action: 'rollAgain', count: 2, formula: '1d100' })
    })

    it('falls back to text detection for the un-flagged core 100+ entry (4d20)', () => {
      const text = 'Roll again twice, but instead of rolling d%, roll [[/roll 4d20]] modified by the wizard’s Luck adjustment (in increments of 10%).'
      expect(getMercurialSpecial({ description: text }))
        .toEqual({ action: 'rollAgain', count: 2, formula: '4d20' })
    })

    it('returns null for ordinary entries and empty input', () => {
      expect(getMercurialSpecial({ description: 'Turbulent magic. Winds whip around.' })).toBeNull()
      expect(getMercurialSpecial({ description: 'The caster must roll again twice next round.' })).toBeNull()
      expect(getMercurialSpecial({})).toBeNull()
      expect(getMercurialSpecial(null)).toBeNull()
    })
  })

  describe('formatMercurialDescriptionHTML', () => {
    it('wraps a single-effect description in one paragraph', () => {
      expect(formatMercurialDescriptionHTML('Blue aura. A shimmering aura.'))
        .toBe('<p>Blue aura. A shimmering aura.</p>')
    })

    it('splits an expanded multi-effect description into paragraphs', () => {
      expect(formatMercurialDescriptionHTML('(45) Turbulent magic.\n\n(70) Cannibal magic.'))
        .toBe('<p>(45) Turbulent magic.</p><p>(70) Cannibal magic.</p>')
    })

    it('returns an empty string for empty input', () => {
      expect(formatMercurialDescriptionHTML('')).toBe('')
      expect(formatMercurialDescriptionHTML(undefined)).toBe('')
    })
  })

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

  describe('getSingleActionDie', () => {
    it('keeps a plain single die', () => {
      expect(getSingleActionDie('1d20')).toBe('1d20')
      expect(getSingleActionDie('1d24')).toBe('1d24')
    })

    it('takes the first die of a list', () => {
      expect(getSingleActionDie('1d20,1d16')).toBe('1d20')
      expect(getSingleActionDie('1d16+1d14')).toBe('1d16')
    })

    it('normalizes a multi-action count to one die (2d20 = two d20 actions)', () => {
      expect(getSingleActionDie('2d20')).toBe('1d20')
      expect(getSingleActionDie('3d20')).toBe('1d20')
    })

    // #834 review: a flat rider on the first die is part of the roll and
    // must survive normalization — but a following die is another action.
    it('keeps a flat rider on the first die, drops additional dice', () => {
      expect(getSingleActionDie('1d20+4')).toBe('1d20+4')
      expect(getSingleActionDie('1d20-1')).toBe('1d20-1')
      expect(getSingleActionDie('1d20+4,1d20')).toBe('1d20+4')
      expect(getSingleActionDie('2d20+4')).toBe('1d20+4')
      expect(getSingleActionDie('1d20+1d16')).toBe('1d20')
      expect(getSingleActionDie('1d20+4+1d16')).toBe('1d20+4')
    })

    it('returns empty string when no die is present', () => {
      expect(getSingleActionDie('special')).toBe('')
      expect(getSingleActionDie('')).toBe('')
      expect(getSingleActionDie(null)).toBe('')
      expect(getSingleActionDie(undefined)).toBe('')
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

      // Phase 7 session 9: drop the module-level cache so each test
      // starts from a cold cache. The cache is per-process and would
      // otherwise carry state from prior tests in this file.
      clearAllTableCaches()
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

    it('resolves a Babele-translated pack entry by its original name (#799)', async () => {
      mockEntry.name = 'Table de Critique III'
      mockEntry.originalName = 'Crit Table III'
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

    it('caches the loaded RollTable doc — second call skips pack.getDocument', async () => {
      // First call: cold cache. Pack walk runs and loads the doc.
      await getCritTableResult(mockRoll, 'Crit Table III')
      expect(mockPack.getDocument).toHaveBeenCalledTimes(1)

      // Second call with the SAME table name: cache hit.
      // pack.getDocument should not run again. getResultsForRoll still
      // does (it's the cheap per-roll lookup we don't cache).
      mockTable.getResultsForRoll.mockClear()
      await getCritTableResult(mockRoll, 'Crit Table III')
      expect(mockPack.getDocument).toHaveBeenCalledTimes(1)
      expect(mockTable.getResultsForRoll).toHaveBeenCalledWith(15)
    })

    it('caches null when no table is found — second call still null without re-walking', async () => {
      mockPack.index = []
      global.game.tables.find.mockReturnValue(null)

      // First call: cold cache, walk runs, finds nothing.
      await getCritTableResult(mockRoll, 'Crit Table III')
      const firstWalkPackGetCalls = global.game.packs.get.mock.calls.length

      // Second call: cache HAS the entry (it's `null`). Don't re-walk.
      await getCritTableResult(mockRoll, 'Crit Table III')
      expect(global.game.packs.get.mock.calls.length).toBe(firstWalkPackGetCalls)
    })

    it('separate suffixes use separate cache entries', async () => {
      await getCritTableResult(mockRoll, 'Crit Table III')
      expect(critTableDocCache.has('Crit Table III')).toBe(true)
      expect(critTableDocCache.has('Crit Table IV')).toBe(false)

      // A different suffix is a cache miss → another pack.getDocument.
      mockEntry.name = 'Crit Table IV'
      await getCritTableResult(mockRoll, 'Crit Table IV')
      expect(mockPack.getDocument).toHaveBeenCalledTimes(2)
      expect(critTableDocCache.has('Crit Table IV')).toBe(true)
    })
  })

  describe('getCritTableLink', () => {
    let mockPack
    let mockEntry

    beforeEach(() => {
      mockEntry = {
        _id: 'crit-link-id',
        name: 'Crit Table III — Edged'
      }
      mockPack = {
        index: [mockEntry]
      }
      global.game = {
        packs: {
          get: vi.fn().mockReturnValue(mockPack)
        },
        tables: {
          find: vi.fn()
        }
      }
      global.CONFIG = {
        DCC: {
          criticalHitPacks: {
            packs: ['dcc-core-book.dcc-crit-tables'],
            addPack: vi.fn()
          }
        }
      }
      clearAllTableCaches()
    })

    it('returns a Compendium UUID with the display text appended', async () => {
      const link = await getCritTableLink('III', 'crit table III')
      expect(link).toBe('@UUID[Compendium.dcc-core-book.dcc-crit-tables.crit-link-id]{crit table III}')
    })

    it('falls back to a world RollTable UUID when the pack misses', async () => {
      global.game.packs.get.mockReturnValue(null)
      global.game.tables.find.mockReturnValue({ id: 'world-table-id' })

      const link = await getCritTableLink('IV', 'crit table IV')
      expect(link).toBe('@UUID[RollTable.world-table-id]{crit table IV}')
    })

    it('returns plain display text when no table is found', async () => {
      mockPack.index = []
      global.game.tables.find.mockReturnValue(null)

      const link = await getCritTableLink('V', 'crit table V')
      expect(link).toBe('crit table V')
    })

    it('caches the resolved UUID prefix — second call skips the pack walk', async () => {
      await getCritTableLink('III', 'crit table III')
      expect(global.game.packs.get).toHaveBeenCalledTimes(1)

      // Second call with a DIFFERENT display text still hits cache.
      // The cached prefix gets concatenated with the new label —
      // proves the cache stores the prefix, not the full string.
      const second = await getCritTableLink('III', 'monster crit')
      expect(global.game.packs.get).toHaveBeenCalledTimes(1)
      expect(second).toBe('@UUID[Compendium.dcc-core-book.dcc-crit-tables.crit-link-id]{monster crit}')
    })

    it('caches null when no table is found — second call returns the new displayText without re-walking', async () => {
      mockPack.index = []
      global.game.tables.find.mockReturnValue(null)

      await getCritTableLink('V', 'first')
      const firstPackGetCalls = global.game.packs.get.mock.calls.length

      const second = await getCritTableLink('V', 'second')
      expect(global.game.packs.get.mock.calls.length).toBe(firstPackGetCalls)
      expect(second).toBe('second')
      expect(critTableLinkCache.get('V')).toBeNull()
    })

    it('Elemental EL suffix uses Crit/Fumble Table EL canonical name', async () => {
      mockEntry.name = 'Crit/Fumble Table EL'
      const link = await getCritTableLink('EL', 'elemental crit')
      expect(link).toBe('@UUID[Compendium.dcc-core-book.dcc-crit-tables.crit-link-id]{elemental crit}')
    })
  })

  describe('getTableFromPath', () => {
    let mockPack
    let mockTable

    beforeEach(() => {
      mockTable = {
        name: 'Deed: Trips and Throws',
        getResultsForRoll: vi.fn()
      }

      mockPack = {
        index: [{ _id: 'deed-table-id', name: 'Deed: Trips and Throws' }],
        getDocument: vi.fn().mockResolvedValue(mockTable)
      }

      global.game = {
        packs: {
          get: vi.fn().mockReturnValue(mockPack)
        },
        tables: {
          getName: vi.fn().mockReturnValue(null)
        }
      }
    })

    it('returns null for an empty path', async () => {
      expect(await getTableFromPath('')).toBeNull()
      expect(await getTableFromPath(null)).toBeNull()
    })

    it('resolves a compendium path', async () => {
      const result = await getTableFromPath('some-module.deed-tables.Deed: Trips and Throws')
      expect(global.game.packs.get).toHaveBeenCalledWith('some-module.deed-tables')
      expect(mockPack.getDocument).toHaveBeenCalledWith('deed-table-id')
      expect(result).toBe(mockTable)
    })

    it('resolves a world table by name', async () => {
      const worldTable = { name: 'Deed: Disarm' }
      global.game.tables.getName.mockReturnValue(worldTable)

      const result = await getTableFromPath('Deed: Disarm')
      expect(global.game.tables.getName).toHaveBeenCalledWith('Deed: Disarm')
      expect(result).toBe(worldTable)
    })

    it('falls back to a world table when the pack is missing', async () => {
      global.game.packs.get.mockReturnValue(null)
      const worldTable = { name: 'some-module.deed-tables.Deed: Trips and Throws' }
      global.game.tables.getName.mockReturnValue(worldTable)

      const result = await getTableFromPath('some-module.deed-tables.Deed: Trips and Throws')
      expect(result).toBe(worldTable)
    })

    it('returns null when nothing matches', async () => {
      global.game.packs.get.mockReturnValue(null)
      const result = await getTableFromPath('Nonexistent Table')
      expect(result).toBeNull()
    })

    it('resolves a Babele-translated pack entry by its original name (#799)', async () => {
      mockPack.index = [{ _id: 'deed-table-id', name: 'Heldentat: Würfe', originalName: 'Deed: Trips and Throws' }]
      const result = await getTableFromPath('some-module.deed-tables.Deed: Trips and Throws')
      expect(mockPack.getDocument).toHaveBeenCalledWith('deed-table-id')
      expect(result).toBe(mockTable)
    })

    it('falls back to a world table imported from a translated pack (#799)', async () => {
      const worldTable = { name: 'Heldentat: Würfe', flags: { babele: { originalName: 'Deed: Trips and Throws' } } }
      global.game.packs.get.mockReturnValue(null)
      global.game.tables.find = vi.fn((predicate) => (predicate(worldTable) ? worldTable : null))

      const result = await getTableFromPath('Deed: Trips and Throws')
      expect(result).toBe(worldTable)
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

    it('resolves a Babele-translated pack entry by its original name (#799)', async () => {
      mockEntry.name = 'Patzer-Tabelle'
      mockEntry.originalName = 'Fumble Table'
      const result = await getFumbleTableResult(mockRoll)
      expect(result).toEqual({ text: 'Fumble result' })
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
        },
        tables: {
          find: vi.fn().mockReturnValue(null)
        }
      }
    })

    it('finds NPC fumble table result from monster fumble pack', async () => {
      const result = await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')
      expect(result).toEqual({ text: 'NPC fumble result' })
      expect(global.game.packs.get).toHaveBeenCalledWith('dcc-core-book.dcc-monster-fumble-tables')
      expect(mockTable.getResultsForRoll).toHaveBeenCalledWith(12)
    })

    it('resolves a Babele-translated pack entry by its original name prefix (#799)', async () => {
      mockEntry.name = 'Patzer-Tabelle M (Monster)'
      mockEntry.originalName = 'Fumble Table M (Monsters)'
      const result = await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')
      expect(result).toEqual({ text: 'NPC fumble result' })
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

    it('falls back to world table when pack not found', async () => {
      global.game.packs.get.mockReturnValue(null)
      const mockWorldTable = {
        name: 'Fumble Table M',
        getResultsForRoll: vi.fn().mockReturnValue([{ text: 'World NPC fumble result' }])
      }
      global.game.tables.find.mockReturnValue(mockWorldTable)

      const result = await getNPCFumbleTableResult(mockRoll, 'Fumble Table M')
      expect(result).toEqual({ text: 'World NPC fumble result' })
    })
  })

  // Issue #799 — Babele-aware name resolution helpers
  describe('getNameCandidates', () => {
    it('returns just the display name for an untranslated document', () => {
      expect(getNameCandidates({ name: 'Sleep' })).toEqual(['Sleep'])
    })

    it('adds the Babele original name for a translated document', () => {
      const doc = { name: 'Schlaf', flags: { babele: { originalName: 'Sleep', translated: true } } }
      expect(getNameCandidates(doc)).toEqual(['Schlaf', 'Sleep'])
    })

    it('deduplicates when the original name equals the display name', () => {
      const doc = { name: 'Sleep', flags: { babele: { originalName: 'Sleep' } } }
      expect(getNameCandidates(doc)).toEqual(['Sleep'])
    })

    it('tolerates null/undefined documents and missing names', () => {
      expect(getNameCandidates(null)).toEqual([])
      expect(getNameCandidates(undefined)).toEqual([])
      expect(getNameCandidates({})).toEqual([])
    })
  })

  describe('docNameMatches', () => {
    it('matches exactly by default', () => {
      expect(docNameMatches({ name: 'Crit Table III' }, 'Crit Table III')).toBe(true)
      expect(docNameMatches({ name: 'Crit Table III (Warriors)' }, 'Crit Table III')).toBe(false)
    })

    it('matches by prefix when requested', () => {
      expect(docNameMatches({ name: 'Crit Table III (Warriors)' }, 'Crit Table III', { prefix: true })).toBe(true)
      expect(docNameMatches({ name: 'Crit Table II' }, 'Crit Table III', { prefix: true })).toBe(false)
    })

    it('matches prefixes against the Babele original name', () => {
      const doc = { name: 'T. dei Critici III (Guerrieri)', originalName: 'Crit Table III (Warriors)' }
      expect(docNameMatches(doc, 'Crit Table III', { prefix: true })).toBe(true)
    })

    it('tolerates missing docs and names', () => {
      expect(docNameMatches(null, 'X')).toBe(false)
      expect(docNameMatches({}, 'X', { prefix: true })).toBe(false)
    })
  })

  describe('findPackEntryByName', () => {
    const pack = (entries) => ({ index: entries })

    it('matches an entry by its display name', () => {
      const entry = { _id: 'a', name: 'Sleep Manifestation' }
      expect(findPackEntryByName(pack([entry]), 'Sleep Manifestation')).toBe(entry)
    })

    it('matches a translated entry by its top-level originalName', () => {
      const entry = { _id: 'a', name: 'Schlaf-Manifestation', originalName: 'Sleep Manifestation' }
      expect(findPackEntryByName(pack([entry]), ['Sleep Manifestation'])).toBe(entry)
    })

    it('matches a translated entry by flags.babele.originalName', () => {
      const entry = { _id: 'a', name: 'Schlaf-Manifestation', flags: { babele: { originalName: 'Sleep Manifestation' } } }
      expect(findPackEntryByName(pack([entry]), ['Sleep Manifestation'])).toBe(entry)
    })

    it('accepts multiple candidate names and returns the first matching entry', () => {
      const entries = [
        { _id: 'a', name: 'Other Table' },
        { _id: 'b', name: 'Schlaf Manifestation' }
      ]
      expect(findPackEntryByName(pack(entries), ['Sleep Manifestation', 'Schlaf Manifestation'])).toBe(entries[1])
    })

    it('returns null when nothing matches or the pack is missing', () => {
      expect(findPackEntryByName(pack([{ _id: 'a', name: 'Other' }]), 'Sleep Manifestation')).toBeNull()
      expect(findPackEntryByName(null, 'Sleep Manifestation')).toBeNull()
      expect(findPackEntryByName({}, 'Sleep Manifestation')).toBeNull()
    })
  })
})

describe('removeActiveEffectOverrides', () => {
  it('removes keys present in document.overrides from updateData', () => {
    const document = { overrides: { 'system.saves.frt.value': 1, 'system.attributes.init.value': 5 } }
    const updateData = { 'system.saves.frt.value': 1, 'system.saves.frt.otherBonus': 2, 'system.attributes.init.value': 5 }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result).toEqual({ 'system.saves.frt.otherBonus': 2 })
  })

  it('preserves all keys when document.overrides is empty', () => {
    const document = { overrides: {} }
    const updateData = { 'system.saves.frt.value': 3 }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result).toEqual({ 'system.saves.frt.value': 3 })
  })

  it('handles document.overrides being undefined', () => {
    const document = {}
    const updateData = { 'system.saves.frt.value': 3 }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result).toEqual({ 'system.saves.frt.value': 3 })
  })

  it('handles override keys not present in updateData', () => {
    const document = { overrides: { 'system.saves.frt.value': 1 } }
    const updateData = { 'system.attributes.init.value': 5 }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result).toEqual({ 'system.attributes.init.value': 5 })
  })

  it('returns the same object reference (mutates in place)', () => {
    const document = { overrides: { 'system.saves.frt.value': 1 } }
    const updateData = { 'system.saves.frt.value': 1, 'system.saves.frt.otherBonus': 2 }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result).toBe(updateData)
  })

  // The actor sheet's submit data is expanded (DocumentSheetV2 _processFormData returns
  // expandObject(formData.object)) while DCC's effects mixin tracks overrides as flat
  // dotted keys. Deleting a flat key from a nested object no-ops, so effect-modified
  // values were written back as the new base on every sheet save — the "curse keeps
  // re-applying itself" bug. Overrides must be stripped from expanded data too.
  it('removes flat override keys from expanded updateData (sheet submit path)', () => {
    const document = { overrides: { 'system.abilities.lck.value': 11 } }
    const updateData = {
      system: {
        abilities: { lck: { value: 11 } },
        attributes: { hp: { value: 7 } }
      }
    }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result.system.abilities.lck).toEqual({})
    expect(result.system.attributes.hp.value).toEqual(7)
  })

  // Core Foundry's own Actor#applyActiveEffects stores overrides nested
  // (mergeObject(this.overrides, expandObject(overrides))) — strip those too.
  it('removes core-style nested override keys from flat updateData', () => {
    const document = { overrides: { system: { abilities: { lck: { value: 11 } } } } }
    const updateData = {
      'system.abilities.lck.value': 11,
      'system.attributes.hp.value': 7
    }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result).toEqual({ 'system.attributes.hp.value': 7 })
  })

  it('removes core-style nested override keys from expanded updateData', () => {
    const document = { overrides: { system: { abilities: { lck: { value: 11 } } } } }
    const updateData = {
      system: {
        abilities: { lck: { value: 11 } },
        attributes: { hp: { value: 7 } }
      }
    }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result.system.abilities.lck).toEqual({})
    expect(result.system.attributes.hp.value).toEqual(7)
  })

  it('handles mixed nested core overrides and flat DCC-tracked overrides', () => {
    const document = {
      overrides: {
        system: { abilities: { str: { value: 12 } } },
        'system.saves.frt.value': 1
      }
    }
    const updateData = {
      'system.abilities.str.value': 12,
      'system.saves.frt.value': 1,
      'system.saves.frt.otherBonus': 2
    }

    const result = removeActiveEffectOverrides(document, updateData)

    expect(result).toEqual({ 'system.saves.frt.otherBonus': 2 })
  })
})
