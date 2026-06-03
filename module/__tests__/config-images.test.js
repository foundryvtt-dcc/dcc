/* Tests for the extracted default/fallback image config data
 * (Phase 7 — Appendix-A config.js shrinkage arc).
 *
 * Guards the contract that matters after the extraction:
 *  1. the extracted module exports the three image tables with known values;
 *  2. config.js re-composes the SAME object references onto DCC, so the
 *     public CONFIG.DCC shape is unchanged and entity-images.js keeps working.
 */

import { expect, describe, it } from 'vitest'
import DCC from '../config.js'
import {
  defaultActorImages,
  defaultItemImages,
  macroImages
} from '../config/images.mjs'

describe('config/images.mjs', () => {
  describe('extracted table values', () => {
    it('defaultActorImages maps actor types onto art (plus default)', () => {
      expect(defaultActorImages.default).toBe('systems/dcc/styles/images/actor.webp')
      expect(defaultActorImages.Party).toBe('systems/dcc/styles/images/party.webp')
    })

    it('defaultItemImages covers the item types with a default fallback', () => {
      expect(defaultItemImages.default).toBe('systems/dcc/styles/images/item.webp')
      expect(defaultItemImages.weapon).toBe('systems/dcc/styles/images/weapon.webp')
      expect(defaultItemImages.container).toBe('systems/dcc/styles/images/game-icons-net/knapsack.svg')
      expect(Object.keys(defaultItemImages)).toHaveLength(7)
    })

    it('macroImages carries the macro-kind art with default + defaultDice fallbacks', () => {
      expect(macroImages.default).toBe('systems/dcc/styles/images/game-icons-net/dice-target.svg')
      expect(macroImages.defaultDice).toBe('systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg')
      // Per-ability + per-skill + per-die keys all present.
      expect(macroImages.str).toBe('systems/dcc/styles/images/game-icons-net/weight-lifting-up.svg')
      expect(macroImages.shieldBash).toBe('systems/dcc/styles/images/game-icons-net/shield-bash.svg')
      expect(macroImages.d20).toBe('systems/dcc/styles/images/game-icons-net/dice-twenty-faces-twenty.svg')
      expect(Object.keys(macroImages)).toHaveLength(49)
    })

    it('every image path is a non-empty string', () => {
      for (const table of [defaultActorImages, defaultItemImages, macroImages]) {
        for (const path of Object.values(table)) {
          expect(typeof path).toBe('string')
          expect(path.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('config.js composition', () => {
    it('re-composes the SAME object references onto DCC (shape unchanged)', () => {
      expect(DCC.defaultActorImages).toBe(defaultActorImages)
      expect(DCC.defaultItemImages).toBe(defaultItemImages)
      expect(DCC.macroImages).toBe(macroImages)
    })
  })
})
