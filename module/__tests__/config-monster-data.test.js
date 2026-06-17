/* Tests for the extracted monster-classification config data
 * (Phase 7 — Appendix-A config.js shrinkage arc).
 *
 * Guards the contract that matters after the extraction:
 *  1. the extracted module exports the four tables with their known values;
 *  2. config.js re-composes the SAME object references onto DCC, so the
 *     public CONFIG.DCC shape is unchanged and npc-parser keeps working.
 */

import { expect, describe, it } from 'vitest'
import DCC from '../config.js'
import {
  giants,
  giantsNotGiants,
  humanoidHints,
  monsterCriticalHits
} from '../config/monster-data.mjs'

describe('config/monster-data.mjs', () => {
  describe('extracted table values', () => {
    it('monsterCriticalHits covers HD 0–21 with the expected die/table values', () => {
      expect(Object.keys(monsterCriticalHits)).toHaveLength(22)
      // Spot-check the corners + a known irregular value (giant d7 at HD 14).
      expect(monsterCriticalHits[0].demon).toEqual({ table: 'DN', die: 'd3' })
      expect(monsterCriticalHits[5].dragon.die).toBe('d14')
      expect(monsterCriticalHits[14].giant.die).toBe('d7')
      expect(monsterCriticalHits[21].dragon.die).toBe('4d20')
      expect(monsterCriticalHits[21].demon.die).toBe('d30')
    })

    it('every monsterCriticalHits row has all six monster types', () => {
      const types = ['humanoid', 'dragon', 'demon', 'giant', 'undead', 'other']
      for (const row of Object.values(monsterCriticalHits)) {
        expect(Object.keys(row).sort()).toEqual([...types].sort())
        for (const type of types) {
          expect(row[type]).toHaveProperty('table')
          expect(row[type]).toHaveProperty('die')
        }
      }
    })

    it('humanoidHints carries the 39 name-substring hints', () => {
      expect(humanoidHints).toHaveLength(39)
      expect(humanoidHints).toContain('goblin')
      expect(humanoidHints).toContain('serpent-man')
      expect(humanoidHints).toContain('time traveler')
    })

    it('giants / giantsNotGiants drive the giant veto', () => {
      expect(giants).toEqual(['cyclops', 'giant'])
      // "giant rat" matches `giants` (giant) but is vetoed by `giantsNotGiants` (rat).
      expect(giantsNotGiants).toContain('rat')
      expect(giantsNotGiants).toContain('snake')
    })
  })

  describe('config.js composition', () => {
    it('re-composes the SAME object references onto DCC (shape unchanged)', () => {
      expect(DCC.monsterCriticalHits).toBe(monsterCriticalHits)
      expect(DCC.giants).toBe(giants)
      expect(DCC.giantsNotGiants).toBe(giantsNotGiants)
      expect(DCC.humanoidHints).toBe(humanoidHints)
    })
  })
})
