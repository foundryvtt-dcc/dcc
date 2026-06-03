import { describe, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import ContainerItemMixin, { ContainerItemMixin as NamedMixin, MAX_CONTAINER_DEPTH } from '../item/container-mixin.mjs'
import DCCItem from '../item.js'

// Mock the dice-chain + utilities modules the same way container.test.js does,
// so importing item.js (which DCCItem pulls in) stays side-effect-free.
vi.mock('../dice-chain.js', () => ({
  default: { bumpDie: vi.fn((die) => die) }
}))
vi.mock('../utilities.js', () => ({
  ensurePlus: vi.fn((value) => value),
  getFirstDie: vi.fn(() => null)
}))

// Phase 7 (Appendix-A item.js shrinkage): the container-support block moved out
// of item.js into item/container-mixin.mjs. These guards pin the extraction
// itself — the mixin's *shape* and that DCCItem still composes it — alongside
// the behavioral coverage in container.test.js (which exercises the members
// through live DCCItem instances and continues to pass unchanged).
describe('ContainerItemMixin extraction', () => {
  const CONTAINER_MEMBERS = [
    'isContainer',
    'isContained',
    'contents',
    'contentsWeight',
    'totalWeight',
    'availableWeightCapacity',
    'availableItemCapacity',
    'contentsItemCount',
    'containerDepth',
    'wouldCreateCircularContainment',
    'canContainItem'
  ]

  test('default and named exports are the same mixin factory function', () => {
    expect(typeof ContainerItemMixin).toBe('function')
    expect(NamedMixin).toBe(ContainerItemMixin)
  })

  test('MAX_CONTAINER_DEPTH constant travels with the mixin', () => {
    expect(MAX_CONTAINER_DEPTH).toBe(3)
  })

  test('applying the mixin to a Base yields a subclass carrying all 11 container members', () => {
    class Base {}
    const Mixed = ContainerItemMixin(Base)
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
    const proto = Mixed.prototype
    for (const name of CONTAINER_MEMBERS) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, name)
      expect(descriptor, `missing member: ${name}`).toBeDefined()
    }
  })

  test('the seven weight/capacity/depth members are accessor getters, the rest are methods', () => {
    const proto = ContainerItemMixin(class {}).prototype
    const getters = ['isContainer', 'isContained', 'contents', 'contentsWeight', 'totalWeight', 'availableWeightCapacity', 'availableItemCapacity', 'contentsItemCount', 'containerDepth']
    const methods = ['wouldCreateCircularContainment', 'canContainItem']
    for (const name of getters) {
      expect(typeof Object.getOwnPropertyDescriptor(proto, name).get, `${name} should be a getter`).toBe('function')
    }
    for (const name of methods) {
      expect(typeof Object.getOwnPropertyDescriptor(proto, name).value, `${name} should be a method`).toBe('function')
    }
  })

  test('DCCItem still composes the mixin — instances expose the container surface', () => {
    const item = new DCCItem({ type: 'container', name: 'Backpack' }, {})
    for (const name of CONTAINER_MEMBERS) {
      expect(name in item, `DCCItem instance missing: ${name}`).toBe(true)
    }
    // The getter actually runs through the extracted code path.
    expect(item.isContainer).toBe(true)
  })
})
