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

    test('wouldCreateCircularContainment detects self-reference', () => {
      expect(container.wouldCreateCircularContainment('container-1')).toBe(true)
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
})
