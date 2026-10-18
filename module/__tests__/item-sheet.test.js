/* Tests for the DCC item sheet context */

import { expect, test } from 'vitest'
import '../__mocks__/foundry.js'
import DCCItemSheet from '../item-sheet.js'

/**
 * Minimal item document for the sheet's `_prepareContext`.
 * @param {object} [overrides]
 */
function makeItem (overrides = {}) {
  return {
    _id: 'item-1',
    id: 'item-1',
    name: 'Test Weapon',
    type: 'weapon',
    img: 'systems/dcc/styles/images/weapon.webp',
    isOwner: true,
    effects: [],
    system: {
      melee: true,
      thrown: false,
      description: { value: '' }
    },
    ...overrides
  }
}

// The Foundry mock does not merge `static DEFAULT_OPTIONS` (the real
// constructor does), so the sheet's drag/drop handles have to be passed in
// explicitly here - same shape as `module/__tests__/actor-sheet.test.js`.
const prepareContext = (item) => new DCCItemSheet({
  document: item,
  dragDrop: [{ dragSelector: '[data-drag="true"]', dropSelector: '.dcc.item' }]
})._prepareContext({})

test('prepareContext returns the item document for a plain item', async () => {
  const item = makeItem()
  const context = await prepareContext(item)
  expect(context.document).toBe(item)
})

test('prepareContext passes a stored image through to the portrait', async () => {
  const context = await prepareContext(makeItem({ img: 'icons/svg/aura.svg' }))
  expect(context.img).toBe('icons/svg/aura.svg')
})

/* Regression (#1043): `_prepareContext` wrote a display fallback into the V1
 * `data.data` property, which does not exist in an AppV2 context. Every item
 * whose image is empty or the mystery-man placeholder made the sheet throw, so
 * the sheet could not be opened at all. */
test('prepareContext does not throw for an item without an image', async () => {
  // `img: ''` is cleaned to the item default icon by the document schema, so
  // `null` is the reachable "no image" state.
  const context = await prepareContext(makeItem({ img: null }))
  // The portrait gets the type's entity icon (#225); the document is untouched.
  expect(context.img).toBe('systems/dcc/styles/images/weapon.webp')
  expect(context.document.img).toBeNull()
})

test('prepareContext does not throw for the mystery-man placeholder', async () => {
  const context = await prepareContext(makeItem({ img: 'icons/svg/mystery-man.svg' }))
  expect(context.img).toBe('systems/dcc/styles/images/weapon.webp')
  expect(context.document.img).toBe('icons/svg/mystery-man.svg')
})

test('prepareContext uses the default item icon for types without artwork', async () => {
  // `equipment` has no entry in CONFIG.DCC.defaultItemImages.
  const context = await prepareContext(makeItem({ type: 'equipment', img: null }))
  expect(context.img).toBe('systems/dcc/styles/images/item.webp')
})

test('prepareContext keeps a core placeholder that is not the mystery-man icon', async () => {
  // Only an empty image and the mystery-man placeholder are replaced (#225).
  const context = await prepareContext(makeItem({ img: 'icons/svg/item-bag.svg' }))
  expect(context.img).toBe('icons/svg/item-bag.svg')
})
