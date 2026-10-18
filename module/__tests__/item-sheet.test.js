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

const prepareContext = (item) => new DCCItemSheet({
  document: item,
  dragDrop: [{ dragSelector: '[data-drag="true"]', dropSelector: '.dcc.item' }]
})._prepareContext({})

test('prepareContext returns the item document for a plain item', async () => {
  const item = makeItem()
  const context = await prepareContext(item)
  expect(context.document).toBe(item)
})

/* Regression (#1043): `_prepareContext` wrote a display fallback into the V1
 * `data.data` property, which does not exist in an AppV2 context. Every item
 * whose image is empty or the mystery-man placeholder made the sheet throw, so
 * the sheet could not be opened at all. */
test('prepareContext does not throw for an item without an image', async () => {
  const context = await prepareContext(makeItem({ img: '' }))
  expect(context.document.name).toBe('Test Weapon')
})

test('prepareContext does not throw for the mystery-man placeholder', async () => {
  const context = await prepareContext(makeItem({ img: 'icons/svg/mystery-man.svg' }))
  expect(context.document.name).toBe('Test Weapon')
})
