import { describe, beforeEach, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCItem from '../item.js'

// Mock the dice-chain module
vi.mock('../dice-chain.js', () => ({
  default: {
    bumpDie: vi.fn((die) => die)
  }
}))

// Mock the utilities module
vi.mock('../utilities.js', () => ({
  ensurePlus: vi.fn((value) => {
    if (!value || value === '0') return '+0'
    return value.toString().startsWith('+') || value.toString().startsWith('-') ? value.toString() : `+${value}`
  }),
  getFirstDie: vi.fn(() => null)
}))

describe('Container Item Tests', () => {
  describe('Container Getters', () => {
    let container

    beforeEach(() => {
      container = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      container._id = 'container-1'
      container.id = 'container-1'
      container.system = {
        ...container.system,
        capacity: { weight: 50, items: 10 },
        weightReduction: 0,
        container: null
      }
    })

    test('isContainer returns true for container type', () => {
      expect(container.isContainer).toBe(true)
    })

    test('isContainer returns false for non-container type', () => {
      const sword = new DCCItem({ type: 'weapon', name: 'Sword' }, {})
      expect(sword.isContainer).toBe(false)
    })

    test('isContained returns false when container field is null', () => {
      expect(container.isContained).toBe(false)
    })

    test('isContained returns true when container field is set', () => {
      const sword = new DCCItem({ type: 'weapon', name: 'Sword' }, {})
      sword.system = { ...sword.system, container: 'container-1' }
      expect(sword.isContained).toBe(true)
    })

    test('contents returns empty array when no parent', () => {
      expect(container.contents).toEqual([])
    })

    test('contents returns contained items from parent', () => {
      const sword = new DCCItem({ type: 'weapon', name: 'Sword' }, {})
      sword._id = 'sword-1'
      sword.system = { ...sword.system, container: 'container-1' }

      const shield = new DCCItem({ type: 'equipment', name: 'Shield' }, {})
      shield._id = 'shield-1'
      shield.system = { ...shield.system, container: 'container-1' }

      const loose = new DCCItem({ type: 'equipment', name: 'Rope' }, {})
      loose._id = 'rope-1'
      loose.system = { ...loose.system, container: null }

      container.parent = {
        items: {
          filter: (fn) => [sword, shield, loose].filter(fn)
        }
      }

      const contents = container.contents
      expect(contents).toHaveLength(2)
      expect(contents[0].name).toBe('Sword')
      expect(contents[1].name).toBe('Shield')
    })
  })

  describe('Weight Calculations', () => {
    let container

    beforeEach(() => {
      container = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      container._id = 'container-1'
      container.id = 'container-1'
      container.system = {
        ...container.system,
        weight: 5,
        quantity: 1,
        capacity: { weight: 50, items: 10 },
        weightReduction: 0,
        container: null
      }
    })

    test('contentsWeight returns 0 for empty container', () => {
      container.parent = {
        items: { filter: () => [] }
      }
      expect(container.contentsWeight).toBe(0)
    })

    test('contentsWeight sums item weights', () => {
      const sword = { system: { weight: 3, quantity: 1, container: 'container-1' } }
      const shield = { system: { weight: 6, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: { filter: () => [sword, shield] }
      }
      expect(container.contentsWeight).toBe(9)
    })

    test('contentsWeight accounts for quantity', () => {
      const arrows = { system: { weight: 0.1, quantity: 20, container: 'container-1' } }
      container.parent = {
        items: { filter: () => [arrows] }
      }
      expect(container.contentsWeight).toBeCloseTo(2.0)
    })

    test('contentsWeight applies weight reduction', () => {
      container.system.weightReduction = 50
      const sword = { system: { weight: 10, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: { filter: () => [sword] }
      }
      expect(container.contentsWeight).toBe(5)
    })

    test('contentsWeight with 100% reduction = 0', () => {
      container.system.weightReduction = 100
      const sword = { system: { weight: 10, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: { filter: () => [sword] }
      }
      expect(container.contentsWeight).toBe(0)
    })

    test('totalWeight includes container own weight plus contents', () => {
      const sword = { system: { weight: 10, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: { filter: () => [sword] }
      }
      expect(container.totalWeight).toBe(15) // 5 (own) + 10 (contents)
    })

    test('totalWeight multiplies own weight by quantity', () => {
      container.system.weight = 3
      container.system.quantity = 2
      const sword = { system: { weight: 10, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: { filter: () => [sword] }
      }
      expect(container.totalWeight).toBe(16) // 3*2 (own) + 10 (contents)
    })

    test('contentsWeight returns 0 for non-container items', () => {
      const sword = new DCCItem({ type: 'weapon', name: 'Sword' }, {})
      expect(sword.contentsWeight).toBe(0)
    })

    test('availableWeightCapacity accounts for weight reduction', () => {
      container.system.capacity.weight = 20
      container.system.weightReduction = 50
      const heavyItem = { system: { weight: 30, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: {
          filter: () => [heavyItem],
          get: () => null
        }
      }
      // Contents weight after 50% reduction = 15, capacity = 20, available = 5
      expect(container.availableWeightCapacity).toBe(5)
    })
  })

  describe('Capacity Checks', () => {
    let container

    beforeEach(() => {
      container = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      container._id = 'container-1'
      container.id = 'container-1'
      container.system = {
        ...container.system,
        weight: 5,
        quantity: 1,
        capacity: { weight: 20, items: 3 },
        weightReduction: 0,
        container: null
      }
      container.parent = {
        items: {
          filter: () => [],
          get: () => null
        }
      }
    })

    test('availableWeightCapacity returns remaining capacity', () => {
      const sword = { system: { weight: 5, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: {
          filter: () => [sword],
          get: () => null
        }
      }
      expect(container.availableWeightCapacity).toBe(15)
    })

    test('availableWeightCapacity returns null when unlimited', () => {
      container.system.capacity.weight = 0
      expect(container.availableWeightCapacity).toBeNull()
    })

    test('availableItemCapacity returns remaining item slots', () => {
      const items = [
        { system: { weight: 1, quantity: 1, container: 'container-1' } },
        { system: { weight: 1, quantity: 1, container: 'container-1' } }
      ]
      container.parent = {
        items: {
          filter: () => items,
          get: () => null
        }
      }
      expect(container.availableItemCapacity).toBe(1)
    })

    test('availableItemCapacity returns null when unlimited', () => {
      container.system.capacity.items = 0
      expect(container.availableItemCapacity).toBeNull()
    })
  })

  describe('Containment Validation', () => {
    let container

    beforeEach(() => {
      container = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      container._id = 'container-1'
      container.id = 'container-1'
      container.system = {
        ...container.system,
        weight: 5,
        quantity: 1,
        capacity: { weight: 50, items: 10 },
        weightReduction: 0,
        container: null
      }
      container.parent = {
        items: {
          filter: () => [],
          get: () => null
        }
      }
    })

    test('canContainItem rejects non-container items', () => {
      const sword = new DCCItem({ type: 'weapon', name: 'Sword' }, {})
      sword.system = { ...sword.system, container: null }
      const result = sword.canContainItem(sword)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DCC.ContainerNotAContainer')
    })

    test('canContainItem rejects self-containment', () => {
      const result = container.canContainItem(container)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DCC.ContainerCannotContainSelf')
    })

    test('canContainItem allows valid physical items', () => {
      const sword = new DCCItem({ type: 'weapon', name: 'Sword' }, {})
      sword._id = 'sword-1'
      sword.id = 'sword-1'
      sword.system = { ...sword.system, weight: 3, quantity: 1, container: null }
      const result = container.canContainItem(sword)
      expect(result.allowed).toBe(true)
    })

    test('canContainItem rejects when container is full (item count)', () => {
      container.system.capacity.items = 1
      const existing = { system: { weight: 1, quantity: 1, container: 'container-1' } }
      container.parent = {
        items: {
          filter: () => [existing],
          get: () => null
        }
      }
      const newItem = new DCCItem({ type: 'equipment', name: 'Torch' }, {})
      newItem._id = 'torch-1'
      newItem.id = 'torch-1'
      newItem.system = { ...newItem.system, weight: 1, quantity: 1, container: null }
      const result = container.canContainItem(newItem)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DCC.ContainerFull')
    })

    test('canContainItem rejects when item too heavy', () => {
      container.system.capacity.weight = 5
      const heavyItem = new DCCItem({ type: 'equipment', name: 'Anvil' }, {})
      heavyItem._id = 'anvil-1'
      heavyItem.id = 'anvil-1'
      heavyItem.system = { ...heavyItem.system, weight: 10, quantity: 1, container: null }
      const result = container.canContainItem(heavyItem)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DCC.ContainerTooHeavy')
    })

    test('canContainItem rejects non-physical items (no container field)', () => {
      // Spells/skills lack the container field in their data model
      const spell = new DCCItem({ type: 'spell', name: 'Magic Missile' }, {})
      spell._id = 'spell-1'
      spell.id = 'spell-1'
      // Simulate a non-physical item: system has no container field
      spell.system = { description: { summary: '', value: '' } }
      const result = container.canContainItem(spell)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DCC.ContainerItemNotPhysical')
    })

    test('canContainItem rejects circular containment', () => {
      const innerContainer = new DCCItem({ type: 'container', name: 'Pouch' }, {})
      innerContainer._id = 'pouch-1'
      innerContainer.id = 'pouch-1'
      innerContainer.system = {
        ...innerContainer.system,
        container: 'container-1',
        capacity: { weight: 10, items: 5 },
        weightReduction: 0
      }

      const mockItems = {
        filter: () => [],
        get: (id) => {
          if (id === 'container-1') return container
          if (id === 'pouch-1') return innerContainer
          return null
        }
      }
      innerContainer.parent = { items: mockItems }
      container.parent = { items: mockItems }

      // Trying to put the outer container into the inner one should detect circular
      const result = innerContainer.canContainItem(container)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DCC.ContainerCircularReference')
    })

    test('canContainItem rejects exceeding max nesting depth', () => {
      // MAX_CONTAINER_DEPTH = 3, check: thisDepth + itemDepth + 1 >= 3
      // Set up: megaBag > outerBag > innerBag (depth 2), try to put deepBag into innerBag
      const megaBag = new DCCItem({ type: 'container', name: 'Mega Bag' }, {})
      megaBag._id = 'mega-1'
      megaBag.id = 'mega-1'
      megaBag.system = { ...megaBag.system, container: null, capacity: { weight: 100, items: 20 }, weightReduction: 0 }

      const outerBag = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      outerBag._id = 'outer-1'
      outerBag.id = 'outer-1'
      outerBag.system = { ...outerBag.system, container: 'mega-1', capacity: { weight: 50, items: 10 }, weightReduction: 0 }

      const innerBag = new DCCItem({ type: 'container', name: 'Pouch' }, {})
      innerBag._id = 'inner-1'
      innerBag.id = 'inner-1'
      innerBag.system = { ...innerBag.system, container: 'outer-1', capacity: { weight: 10, items: 5 }, weightReduction: 0 }

      const deepBag = new DCCItem({ type: 'container', name: 'Tiny Sack' }, {})
      deepBag._id = 'deep-1'
      deepBag.id = 'deep-1'
      deepBag.system = { ...deepBag.system, container: null, capacity: { weight: 5, items: 3 }, weightReduction: 0, weight: 1, quantity: 1 }

      const mockItems = {
        filter: () => [],
        get: (id) => {
          if (id === 'mega-1') return megaBag
          if (id === 'outer-1') return outerBag
          if (id === 'inner-1') return innerBag
          if (id === 'deep-1') return deepBag
          return null
        }
      }
      megaBag.parent = { items: mockItems }
      outerBag.parent = { items: mockItems }
      innerBag.parent = { items: mockItems }
      deepBag.parent = { items: mockItems }

      // innerBag is at depth 2, deepBag at depth 0
      // Check: 2 + 0 + 1 = 3 >= MAX_CONTAINER_DEPTH(3) → rejected
      const result = innerBag.canContainItem(deepBag)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('DCC.ContainerMaxDepth')
    })

    test('wouldCreateCircularContainment detects self-reference', () => {
      expect(container.wouldCreateCircularContainment('container-1')).toBe(true)
    })

    test('wouldCreateCircularContainment returns false for non-contained items', () => {
      // Container not inside anything — cannot form a cycle
      expect(container.wouldCreateCircularContainment('some-other-id')).toBe(false)
    })

    test('wouldCreateCircularContainment detects indirect loop', () => {
      const innerContainer = new DCCItem({ type: 'container', name: 'Pouch' }, {})
      innerContainer._id = 'pouch-1'
      innerContainer.id = 'pouch-1'
      innerContainer.system = {
        ...innerContainer.system,
        container: 'container-1',
        capacity: { weight: 10, items: 5 },
        weightReduction: 0
      }

      innerContainer.parent = {
        items: {
          get: (id) => {
            if (id === 'container-1') return container
            return null
          },
          filter: () => []
        }
      }

      // Trying to put the outer container into the inner one should detect circular
      expect(innerContainer.wouldCreateCircularContainment('container-1')).toBe(true)
    })
  })

  describe('Container Depth', () => {
    test('containerDepth returns 0 for uncontained items', () => {
      const item = new DCCItem({ type: 'equipment', name: 'Rope' }, {})
      item.system = { ...item.system, container: null }
      expect(item.containerDepth).toBe(0)
    })

    test('containerDepth returns 1 for directly contained item', () => {
      const container = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      container._id = 'bag-1'
      container.system = { ...container.system, container: null }

      const item = new DCCItem({ type: 'equipment', name: 'Rope' }, {})
      item._id = 'rope-1'
      item.system = { ...item.system, container: 'bag-1' }
      item.parent = {
        items: {
          get: (id) => {
            if (id === 'bag-1') return container
            return null
          }
        }
      }

      expect(item.containerDepth).toBe(1)
    })

    test('containerDepth returns 2 for nested item', () => {
      const outerBag = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      outerBag._id = 'outer-1'
      outerBag.system = { ...outerBag.system, container: null }

      const innerBag = new DCCItem({ type: 'container', name: 'Pouch' }, {})
      innerBag._id = 'inner-1'
      innerBag.system = { ...innerBag.system, container: 'outer-1' }

      const item = new DCCItem({ type: 'equipment', name: 'Gem' }, {})
      item._id = 'gem-1'
      item.system = { ...item.system, container: 'inner-1' }
      item.parent = {
        items: {
          get: (id) => {
            if (id === 'outer-1') return outerBag
            if (id === 'inner-1') return innerBag
            return null
          }
        }
      }

      expect(item.containerDepth).toBe(2)
    })
  })

  describe('deleteDialog', () => {
    let container

    beforeEach(() => {
      container = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      container._id = 'container-1'
      container.id = 'container-1'
      container.system = {
        ...container.system,
        capacity: { weight: 50, items: 10 },
        weightReduction: 0,
        container: null
      }
    })

    test('delegates to super for empty containers', async () => {
      container.parent = {
        items: { filter: () => [] }
      }
      // MockItem.prototype.deleteDialog returns `this`
      const result = await container.deleteDialog()
      expect(result).toBe(container)
    })

    test('batch deletes container and contents when confirmed', async () => {
      const sword = { id: 'sword-1', system: { container: 'container-1' } }
      const shield = { id: 'shield-1', system: { container: 'container-1' } }
      container.parent = {
        items: { filter: () => [sword, shield] },
        deleteEmbeddedDocuments: vi.fn().mockResolvedValue([])
      }

      // Global Dialog.confirm mock auto-calls yes callback
      global.Dialog.confirm = vi.fn(({ yes }) => yes())

      const result = await container.deleteDialog()
      expect(result).toBe(container)
      expect(container.parent.deleteEmbeddedDocuments).toHaveBeenCalledWith(
        'Item',
        ['sword-1', 'shield-1', 'container-1']
      )
    })
  })

  describe('_onCreate orphan re-association', () => {
    let container

    beforeEach(() => {
      container = new DCCItem({ type: 'container', name: 'Backpack' }, {})
      container._id = 'container-1'
      container.id = 'container-1'
      container.system = {
        ...container.system,
        capacity: { weight: 50, items: 10 },
        weightReduction: 0,
        container: null
      }
    })

    test('re-associates orphaned items with matching sourceContainerName', async () => {
      const orphanedItem = {
        id: 'sword-1',
        system: { container: 'old-container-id' },
        flags: { dcc: { sourceContainerName: 'Backpack' } }
      }

      container.parent = {
        items: {
          filter: (fn) => [orphanedItem].filter(fn),
          get: () => null // old-container-id doesn't exist
        },
        updateEmbeddedDocuments: vi.fn().mockResolvedValue([])
      }

      await container._onCreate({}, {}, 'user-1')

      expect(container.parent.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
        {
          _id: 'sword-1',
          'system.container': 'container-1',
          'flags.dcc.-=sourceContainerName': null
        }
      ])
    })

    test('does not re-associate items that belong to existing containers', async () => {
      const existingContainer = { id: 'existing-1' }
      const containedItem = {
        id: 'sword-1',
        system: { container: 'existing-1' },
        flags: { dcc: { sourceContainerName: 'Other Bag' } }
      }

      container.parent = {
        items: {
          filter: (fn) => [containedItem].filter(fn),
          get: (id) => id === 'existing-1' ? existingContainer : null
        },
        updateEmbeddedDocuments: vi.fn()
      }

      await container._onCreate({}, {}, 'user-1')

      expect(container.parent.updateEmbeddedDocuments).not.toHaveBeenCalled()
    })

    test('handles updateEmbeddedDocuments failure gracefully', async () => {
      const orphanedItem = {
        id: 'sword-1',
        system: { container: 'old-container-id' },
        flags: { dcc: { sourceContainerName: 'Backpack' } }
      }

      container.parent = {
        items: {
          filter: (fn) => [orphanedItem].filter(fn),
          get: () => null
        },
        updateEmbeddedDocuments: vi.fn().mockRejectedValue(new Error('DB error'))
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Should not throw
      await container._onCreate({}, {}, 'user-1')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to re-associate'),
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })
})
