/* Tests for the extracted actor-importer config data
 * (Phase 7 — Appendix-A config.js shrinkage arc).
 *
 * Guards the contract that matters after the extraction:
 *  1. the extracted module exports the importer tables with known values;
 *  2. config.js re-composes the SAME object references onto DCC, so the
 *     public CONFIG.DCC shape is unchanged and the consumer keeps working
 *     (module/parser.js reads CONFIG.DCC.actorImporter* + birthAugurEffectsPack,
 *     and the import dialog template reads config.importTypes).
 */

import { expect, describe, it } from 'vitest'
import DCC from '../config.js'
import {
  actorImporterItemPacks,
  actorImporterNameMap,
  actorImporterPromptThreshold,
  birthAugurEffectsPack,
  importTypes
} from '../config/actor-importer.mjs'

describe('config/actor-importer.mjs', () => {
  describe('extracted table values', () => {
    it('importTypes maps the two actor types to i18n keys', () => {
      expect(importTypes).toEqual({
        Player: 'DCC.ActorTypePlayer',
        NPC: 'DCC.ActorTypeNPC'
      })
    })

    it('actorImporterPromptThreshold is the bulk-import warning count', () => {
      expect(actorImporterPromptThreshold).toBe(25)
    })

    it('actorImporterItemPacks lists the dcc-core-book search packs', () => {
      expect(actorImporterItemPacks).toHaveLength(16)
      // Every entry is a dcc-core-book pack path (module.packName).
      for (const pack of actorImporterItemPacks) {
        expect(typeof pack).toBe('string')
        expect(pack.startsWith('dcc-core-book.')).toBe(true)
      }
      expect(actorImporterItemPacks).toContain('dcc-core-book.dcc-core-weapons')
      expect(actorImporterItemPacks).toContain('dcc-core-book.dcc-core-spells-patron')
    })

    it('birthAugurEffectsPack points at the birth-augur AE pack', () => {
      expect(birthAugurEffectsPack).toBe('dcc-core-book.dcc-core-birth-augur-effects')
    })

    it('actorImporterNameMap remaps stat-block names to arrays of canonical names', () => {
      // Single-target remap.
      expect(actorImporterNameMap['Hammer (as club)']).toEqual(['Club'])
      // Fan-out remap (one stat-block name → several compendium items).
      expect(actorImporterNameMap.Blessing).toEqual(['Blessing', 'Blessing Self', 'Blessing Ally', 'Blessing Object'])
      // Every value is a non-empty array of strings.
      for (const names of Object.values(actorImporterNameMap)) {
        expect(Array.isArray(names)).toBe(true)
        expect(names.length).toBeGreaterThan(0)
        for (const n of names) expect(typeof n).toBe('string')
      }
    })
  })

  describe('config.js composition', () => {
    it('re-composes the SAME object references onto DCC (shape unchanged)', () => {
      expect(DCC.importTypes).toBe(importTypes)
      expect(DCC.actorImporterPromptThreshold).toBe(actorImporterPromptThreshold)
      expect(DCC.actorImporterItemPacks).toBe(actorImporterItemPacks)
      expect(DCC.birthAugurEffectsPack).toBe(birthAugurEffectsPack)
      expect(DCC.actorImporterNameMap).toBe(actorImporterNameMap)
    })
  })
})
