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
