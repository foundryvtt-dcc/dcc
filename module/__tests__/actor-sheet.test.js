/* global game */
/**
 * Tests for actor-sheet.js focusing on item transfer functionality
 * Tests the drag/drop item transfer between actors
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'
import DCCItem from '../item'
import DCCActorSheet from '../actor-sheet.js'

// Mock the dependencies
vi.mock('../actor-level-change.js')
vi.mock('../actor-config.js', () => ({
  default: class {
    render () { return this }
  }
}))
vi.mock('../melee-missile-bonus-config.js', () => ({
  default: class {
    render () { return this }
  }
}))
vi.mock('../saving-throw-config.js', () => ({
  default: class {
    render () { return this }
  }
}))
vi.mock('../entity-images.js', () => ({
  default: {
    imageForItem: () => 'icons/svg/item-bag.svg',
    imageForActor: () => 'icons/svg/mystery-man.svg'
  }
}))

/**
 * Helper function to create a mock drag event with item data
 */
function createDragEvent (dragData) {
  return {
    dataTransfer: {
      getData: vi.fn((type) => {
        if (type === 'text/plain') {
          return JSON.stringify(dragData)
        }
        return ''
      }),
      setData: vi.fn()
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
}

/**
 * Helper function to create an actor with items
 */
function createActorWithItems (id, items = []) {
  // Create actor with defaults (no data parameter lets ActorMock initialize properly)
  const actor = new DCCActor()
  actor._id = id
  actor.id = id
  actor.name = `Test Actor ${id}`

  // Mock the items collection
  const itemsMap = new Map()
  items.forEach(item => {
    item.actor = actor
    itemsMap.set(item._id, item)
  })

  actor.items = {
    get: (id) => itemsMap.get(id),
    has: (id) => itemsMap.has(id),
    [Symbol.iterator]: function * () {
      yield * itemsMap.values()
    },
    size: itemsMap.size
  }

  // Mock deleteEmbeddedDocuments
  actor.deleteEmbeddedDocuments = vi.fn(async (type, ids) => {
    ids.forEach(id => itemsMap.delete(id))
    return []
  })

  // Mock createEmbeddedDocuments
  actor.createEmbeddedDocuments = vi.fn(async (type, data) => {
    const newItems = data.map(d => new DCCItem(d))
    newItems.forEach(item => {
      item.actor = actor
      itemsMap.set(item._id, item)
    })
    return newItems
  })

  return actor
}

/**
 * Helper function to create a mock game.actors collection
 */
function setupGameActors (actors) {
  const actorsMap = new Map()
  actors.forEach(actor => actorsMap.set(actor.id, actor))

  game.actors = {
    get: (id) => actorsMap.get(id)
  }
}

/**
 * Helper function to create an actor sheet with proper configuration
 */
function createActorSheet (actor) {
  return new DCCActorSheet({
    document: actor,
    dragDrop: [{ dragSelector: '[data-drag="true"]', dropSelector: '.dcc.actor' }]
  })
}

test('item transfer between actors - removes from source', async () => {
  // Create source actor with an item
  const sourceItem = new DCCItem({
    _id: 'item-123',
    name: 'Test Sword',
    type: 'weapon',
    system: { damage: '1d8' }
  })

  const sourceActor = createActorWithItems('actor-source', [sourceItem])
  const targetActor = createActorWithItems('actor-target', [])

  // Setup game.actors
  setupGameActors([sourceActor, targetActor])

  // Create the actor sheet for the target actor
  const sheet = createActorSheet(targetActor)

  // Create drag event data matching the structure from _onDragStart
  const dragData = {
    type: 'Item',
    actorId: sourceActor.id,
    data: sourceItem, // The full item object
    system: { item: sourceItem }
  }

  const event = createDragEvent(dragData)

  // Mock the super._onDrop to simulate successful item creation on target
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(true)

  // Perform the drop
  await sheet._onDrop(event)

  // Verify that deleteEmbeddedDocuments was called on the source actor
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1)
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['item-123'])

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('item transfer uses data.data._id not data.uuid', async () => {
  // This test specifically verifies the PR fix
  const sourceItem = new DCCItem({
    _id: 'item-456',
    name: 'Magic Dagger',
    type: 'weapon',
    system: { damage: '1d4' }
  })

  const sourceActor = createActorWithItems('actor-a', [sourceItem])
  const targetActor = createActorWithItems('actor-b', [])

  setupGameActors([sourceActor, targetActor])

  const sheet = createActorSheet(targetActor)

  // Create drag data WITHOUT a uuid property (as per the bug report)
  const dragData = {
    type: 'Item',
    actorId: sourceActor.id,
    data: sourceItem // Contains _id: 'item-456'
    // Note: NO uuid property here
  }

  const event = createDragEvent(dragData)

  // Mock super._onDrop
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(true)

  await sheet._onDrop(event)

  // Verify deletion was called with the correct ID extracted from data.data._id
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['item-456'])

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('item transfer only happens when actors are different', async () => {
  // Create actor with an item
  const item = new DCCItem({
    _id: 'item-same',
    name: 'Same Actor Item',
    type: 'weapon'
  })

  const actor = createActorWithItems('actor-same', [item])
  setupGameActors([actor])

  const sheet = createActorSheet(actor)

  // Drag data from same actor (should NOT trigger deletion)
  const dragData = {
    type: 'Item',
    actorId: actor.id, // Same as target actor
    data: item
  }

  const event = createDragEvent(dragData)

  // Mock super._onDrop
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(true)

  await sheet._onDrop(event)

  // Should NOT call deleteEmbeddedDocuments (same actor = sorting, not transfer)
  expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled()

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('item transfer does not delete if drop fails', async () => {
  const sourceItem = new DCCItem({
    _id: 'item-fail',
    name: 'Failed Transfer Item',
    type: 'weapon'
  })

  const sourceActor = createActorWithItems('actor-fail-source', [sourceItem])
  const targetActor = createActorWithItems('actor-fail-target', [])

  setupGameActors([sourceActor, targetActor])

  const sheet = createActorSheet(targetActor)

  const dragData = {
    type: 'Item',
    actorId: sourceActor.id,
    data: sourceItem
  }

  const event = createDragEvent(dragData)

  // Mock super._onDrop to return false (drop failed)
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(false)

  await sheet._onDrop(event)

  // Should NOT delete from source if drop failed
  expect(sourceActor.deleteEmbeddedDocuments).not.toHaveBeenCalled()

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('item transfer handles missing source actor gracefully', async () => {
  const targetActor = createActorWithItems('actor-target-only', [])

  // Don't add source actor to game.actors
  game.actors = {
    get: vi.fn(() => null) // Source actor not found
  }

  const sheet = createActorSheet(targetActor)

  const dragData = {
    type: 'Item',
    actorId: 'nonexistent-actor',
    data: { _id: 'item-orphan', name: 'Orphan Item' }
  }

  const event = createDragEvent(dragData)

  // Mock super._onDrop
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(true)

  // Should not throw error even if source actor is not found
  await expect(sheet._onDrop(event)).resolves.toBeDefined()

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('item transfer handles missing source item ID gracefully', async () => {
  const sourceActor = createActorWithItems('actor-no-item-id', [])
  const targetActor = createActorWithItems('actor-target-no-id', [])

  setupGameActors([sourceActor, targetActor])

  const sheet = createActorSheet(targetActor)

  // Drag data with missing item _id
  const dragData = {
    type: 'Item',
    actorId: sourceActor.id,
    data: { name: 'No ID Item' } // Missing _id
  }

  const event = createDragEvent(dragData)

  // Mock super._onDrop
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(true)

  await sheet._onDrop(event)

  // Should not attempt to delete if source item ID is missing
  expect(sourceActor.deleteEmbeddedDocuments).not.toHaveBeenCalled()

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('DCC Item type is converted to Item for drop processing', async () => {
  // Test that 'DCC Item' type (used for spells) is converted back to 'Item'
  const sourceItem = new DCCItem({
    _id: 'spell-123',
    name: 'Magic Missile',
    type: 'spell'
  })

  const sourceActor = createActorWithItems('actor-spell-source', [sourceItem])
  const targetActor = createActorWithItems('actor-spell-target', [])

  setupGameActors([sourceActor, targetActor])

  const sheet = createActorSheet(targetActor)

  // Spell items use 'DCC Item' type in drag data
  const dragData = {
    type: 'DCC Item', // This should be converted to 'Item'
    actorId: sourceActor.id,
    data: sourceItem
  }

  const event = createDragEvent(dragData)

  // Mock super._onDrop
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(true)

  await sheet._onDrop(event)

  // Should still process as item transfer and delete from source
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['spell-123'])

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('multiple items can be transferred in sequence', async () => {
  const item1 = new DCCItem({ _id: 'item-1', name: 'Item 1', type: 'weapon' })
  const item2 = new DCCItem({ _id: 'item-2', name: 'Item 2', type: 'armor' })

  const sourceActor = createActorWithItems('actor-multi-source', [item1, item2])
  const targetActor = createActorWithItems('actor-multi-target', [])

  setupGameActors([sourceActor, targetActor])

  const sheet = createActorSheet(targetActor)

  // Mock super._onDrop
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(true)

  // Transfer first item
  const event1 = createDragEvent({
    type: 'Item',
    actorId: sourceActor.id,
    data: item1
  })
  await sheet._onDrop(event1)

  // Transfer second item
  const event2 = createDragEvent({
    type: 'Item',
    actorId: sourceActor.id,
    data: item2
  })
  await sheet._onDrop(event2)

  // Both items should have been deleted from source
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledTimes(2)
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['item-1'])
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['item-2'])

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

test('item transfer respects result from parent _onDrop', async () => {
  const sourceItem = new DCCItem({
    _id: 'item-respect',
    name: 'Respectful Item',
    type: 'weapon'
  })

  const sourceActor = createActorWithItems('actor-respect-source', [sourceItem])
  const targetActor = createActorWithItems('actor-respect-target', [])

  setupGameActors([sourceActor, targetActor])

  const sheet = createActorSheet(targetActor)

  const dragData = {
    type: 'Item',
    actorId: sourceActor.id,
    data: sourceItem
  }

  const event = createDragEvent(dragData)

  // Mock super._onDrop to return undefined (some handlers do this)
  vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(sheet)), '_onDrop').mockResolvedValue(undefined)

  await sheet._onDrop(event)

  // Should still delete because result !== false (undefined is truthy for the check)
  expect(sourceActor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['item-respect'])

  // Cleanup
  Object.getPrototypeOf(Object.getPrototypeOf(sheet))._onDrop.mockRestore()
})

/* -------------------------------------------- */
/*  Tab configuration (equipment subtabs)       */
/* -------------------------------------------- */

test('equipment tab group defines weapons and goods subtabs', () => {
  const actor = createActorWithItems('actor-tabs-1', [])
  const sheet = createActorSheet(actor)

  const config = sheet._getTabsConfig('equipment')
  expect(config.tabs.map(t => t.id)).toEqual(['weapons', 'goods'])
  expect(config.initial).toBe('weapons')
  expect(config.tabs.every(t => t.group === 'equipment')).toBe(true)
})

test('optional skills and spells tabs only join the sheet group', () => {
  const actor = createActorWithItems('actor-tabs-2', [])
  actor.system.config.showSkills = true
  actor.system.config.showSpells = true
  const sheet = createActorSheet(actor)

  const sheetConfig = sheet._getTabsConfig('sheet')
  expect(sheetConfig.tabs.map(t => t.id)).toContain('skills')
  expect(sheetConfig.tabs.map(t => t.id)).toContain('wizardSpells')

  const equipmentConfig = sheet._getTabsConfig('equipment')
  expect(equipmentConfig.tabs.map(t => t.id)).toEqual(['weapons', 'goods'])
})

test('_getTabsConfig returns null for a group the sheet does not define', () => {
  const actor = createActorWithItems('actor-tabs-3', [])
  const sheet = createActorSheet(actor)

  expect(sheet._getTabsConfig('nonexistent')).toBeNull()
})

test('_prepareTabs marks the initial equipment subtab active', () => {
  const actor = createActorWithItems('actor-tabs-4', [])
  const sheet = createActorSheet(actor)

  const tabs = sheet._prepareTabs('equipment')
  expect(tabs.weapons.active).toBe(true)
  expect(tabs.weapons.cssClass).toContain('active')
  expect(tabs.goods.active).toBe(false)

  // Switching the group state flips the active subtab on the next prepare
  sheet.tabGroups.equipment = 'goods'
  const tabsAfter = sheet._prepareTabs('equipment')
  expect(tabsAfter.goods.active).toBe(true)
  expect(tabsAfter.weapons.active).toBe(false)
})

/* -------------------------------------------- */
/*  Quantity increment/decrement                */
/* -------------------------------------------- */

test('decreaseQty floors quantity at zero', async () => {
  const item = new DCCItem({
    _id: 'item-qty-0',
    name: 'Empty Quiver Arrows',
    type: 'ammunition',
    system: { quantity: 0 }
  })
  const actor = createActorWithItems('actor-qty-1', [item])
  const sheet = createActorSheet(actor)
  item.update = vi.fn()

  const target = { dataset: { itemId: 'item-qty-0' } }
  await DCCActorSheet.DEFAULT_OPTIONS.actions.decreaseQty.call(sheet, {}, target)

  expect(item.update).toHaveBeenCalledWith({ 'system.quantity': 0 })
})

test('increaseQty and decreaseQty adjust quantity by one', async () => {
  const item = new DCCItem({
    _id: 'item-qty-2',
    name: 'Arrows',
    type: 'ammunition',
    system: { quantity: 2 }
  })
  const actor = createActorWithItems('actor-qty-2', [item])
  const sheet = createActorSheet(actor)
  item.update = vi.fn()

  const target = { dataset: { itemId: 'item-qty-2' } }
  await DCCActorSheet.DEFAULT_OPTIONS.actions.increaseQty.call(sheet, {}, target)
  expect(item.update).toHaveBeenCalledWith({ 'system.quantity': 3 })

  await DCCActorSheet.DEFAULT_OPTIONS.actions.decreaseQty.call(sheet, {}, target)
  expect(item.update).toHaveBeenCalledWith({ 'system.quantity': 1 })
})

test('quantity actions ignore a missing item', async () => {
  const actor = createActorWithItems('actor-qty-3', [])
  const sheet = createActorSheet(actor)
  const target = { dataset: { itemId: 'no-such-item' } }

  // Must not throw dereferencing a missing item
  await DCCActorSheet.DEFAULT_OPTIONS.actions.increaseQty.call(sheet, {}, target)
  await DCCActorSheet.DEFAULT_OPTIONS.actions.decreaseQty.call(sheet, {}, target)
})

test('a new tab group registered via CLASS_TABS is seeded instead of dropped', () => {
  class CustomTabsSheet extends DCCActorSheet {
    static CLASS_TABS = {
      custom: { tabs: [{ id: 'lore', group: 'custom', label: 'X.Lore' }] }
    }
  }
  const actor = createActorWithItems('actor-tabs-5', [])
  const sheet = new CustomTabsSheet({
    document: actor,
    dragDrop: [{ dragSelector: '[data-drag="true"]', dropSelector: '.dcc.actor' }]
  })

  const config = sheet._getTabsConfig('custom')
  expect(config).not.toBeNull()
  expect(config.tabs.map(t => t.id)).toEqual(['lore'])
})
