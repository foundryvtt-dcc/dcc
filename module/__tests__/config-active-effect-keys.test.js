/* Tests for the extracted Active-Effect attribute-key reference table
 * (Phase 7 — Appendix-A config.js shrinkage arc).
 *
 * Guards the contract that matters after the extraction:
 *  1. the extracted module exports the table with its known key→label entries;
 *  2. config.js re-composes the SAME object reference onto DCC, so the public
 *     CONFIG.DCC.activeEffectKeys surface is unchanged.
 *
 * NOTE: activeEffectKeys has no runtime code consumer (added PR #611; V14 AE
 * editing uses Foundry's native config UI). It's retained as a documented
 * CONFIG.DCC.* reference surface — these tests pin that surface so a future
 * deprecation is a deliberate, test-visible change rather than silent drift.
 */

import { expect, describe, it } from 'vitest'
import DCC from '../config.js'
import { activeEffectKeys } from '../config/active-effect-keys.mjs'

describe('config/active-effect-keys.mjs', () => {
  describe('extracted table values', () => {
    it('maps the documented system.* AE paths onto i18n label keys', () => {
      expect(Object.keys(activeEffectKeys)).toHaveLength(32)
      // One representative key from each documented group.
      expect(activeEffectKeys['system.abilities.str.value']).toBe('DCC.AbilityStr')
      expect(activeEffectKeys['system.attributes.hp.max']).toBe('DCC.HitPointsMax')
      expect(activeEffectKeys['system.details.attackHitBonus.melee.adjustment']).toBe('DCC.MeleeAttackBonus')
      expect(activeEffectKeys['system.saves.wil.otherBonus']).toBe('DCC.SavesWillBonus')
      expect(activeEffectKeys['system.class.luckDie']).toBe('DCC.LuckDie')
      expect(activeEffectKeys['system.attributes.actionDice.value']).toBe('DCC.ActionDie')
    })

    it('every entry is a system.* path mapped to a DCC.* label key', () => {
      for (const [path, label] of Object.entries(activeEffectKeys)) {
        expect(path.startsWith('system.')).toBe(true)
        expect(label.startsWith('DCC.')).toBe(true)
      }
    })
  })

  describe('config.js composition', () => {
    it('re-composes the SAME object reference onto DCC (shape unchanged)', () => {
      expect(DCC.activeEffectKeys).toBe(activeEffectKeys)
    })
  })
})
