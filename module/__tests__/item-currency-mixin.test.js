import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import CurrencyItemMixin, { CurrencyItemMixin as NamedMixin } from '../item/currency-mixin.mjs'
import { ContainerItemMixin } from '../item/container-mixin.mjs'
import DCCItem from '../item.js'

vi.mock('../dice-chain.js', () => ({
  default: { bumpDie: vi.fn((die) => die) }
}))
vi.mock('../utilities.js', () => ({
  ensurePlus: vi.fn((value) => value),
  getFirstDie: vi.fn(() => null)
}))

// Minimal Roll stub for needsValueRoll: a formula is non-deterministic iff it
// contains a `dN` die term. (The real Roll lives in the live Foundry env; the
// end-to-end behavior is exercised by the extension-api.spec.js probe.)
class FakeRoll {
  constructor (formula) {
    this.formula = String(formula)
    this.isDeterministic = !/\dd\d/i.test(this.formula) && !/\bd\d/i.test(this.formula)
  }
}

// Phase 7 (Appendix-A item.js shrinkage): the treasure-value / currency block
// moved out of item.js into item/currency-mixin.mjs. These guards pin the
// extraction's shape, that DCCItem still composes BOTH item mixins, and — since
// this block had no prior unit coverage — the deterministic conversion logic.
describe('CurrencyItemMixin extraction', () => {
  const CURRENCY_MEMBERS = ['needsValueRoll', 'rollValue', 'convertCurrencyUpward', 'convertCurrencyDownward']

  beforeEach(() => {
    global.Roll = FakeRoll
  })

  describe('composition guards', () => {
    test('default and named exports are the same mixin factory function', () => {
      expect(typeof CurrencyItemMixin).toBe('function')
      expect(NamedMixin).toBe(CurrencyItemMixin)
    })

    test('applying the mixin yields a subclass carrying all four currency methods', () => {
      class Base {}
      const Mixed = CurrencyItemMixin(Base)
      expect(Object.getPrototypeOf(Mixed)).toBe(Base)
      for (const name of CURRENCY_MEMBERS) {
        expect(typeof Object.getOwnPropertyDescriptor(Mixed.prototype, name).value, `${name} should be a method`).toBe('function')
      }
    })

    test('DCCItem composes BOTH item mixins — currency + container surfaces coexist', () => {
      const item = new DCCItem({ type: 'treasure', name: 'Gem' }, {})
      for (const name of CURRENCY_MEMBERS) {
        expect(typeof item[name], `DCCItem instance missing currency method: ${name}`).toBe('function')
      }
      // Container surface from the other mixin is still present on the same instance.
      expect('canContainItem' in item).toBe(true)
      expect('contentsWeight' in item).toBe(true)
    })

    test('the item mixins compose as distinct prototype layers, Currency nested inside Spell and outside Container', () => {
      // Chain: DCCItem -> SpellItemMixin -> CurrencyItemMixin -> ContainerItemMixin -> Item.
      // Walk the chain and find which layer OWNS each signature member; resilient
      // to additional outer mixin layers being added later.
      const ownerLayerIndex = (member) => {
        let layer = DCCItem
        for (let i = 0; layer && i < 12; i++) {
          if (layer.prototype && Object.getOwnPropertyDescriptor(layer.prototype, member)) return i
          layer = Object.getPrototypeOf(layer)
        }
        return -1
      }
      const spell = ownerLayerIndex('rollSpellCheck')
      const currency = ownerLayerIndex('needsValueRoll')
      const container = ownerLayerIndex('canContainItem')
      expect(spell).toBeGreaterThanOrEqual(0)
      expect(currency).toBeGreaterThan(spell)
      expect(container).toBeGreaterThan(currency)
    })
  })

  describe('needsValueRoll', () => {
    const makeItem = (value) => {
      const item = new DCCItem({ type: 'treasure', name: 'Hoard' }, {})
      item.system = { ...item.system, value }
      return item
    }

    test('returns false when every currency field is a fixed number (deterministic)', () => {
      const item = makeItem({ pp: '0', ep: '0', gp: '50', sp: '0', cp: '0' })
      expect(item.needsValueRoll()).toBe(false)
    })

    test('returns true when any currency field carries a die formula', () => {
      const item = makeItem({ pp: '0', ep: '0', gp: '2d6', sp: '0', cp: '0' })
      expect(item.needsValueRoll()).toBe(true)
    })

    test('skips empty / falsy formulae without flagging a roll', () => {
      const item = makeItem({ pp: '', ep: 0, gp: '10', sp: null, cp: undefined })
      expect(item.needsValueRoll()).toBe(false)
    })
  })

  describe('convertCurrencyUpward / Downward', () => {
    // Override needsValueRoll so the conversion guard passes; we are testing the
    // pure denomination math (rank lookup + conversion factor) here.
    const makeResolvedItem = (value) => {
      const item = new DCCItem({ type: 'treasure', name: 'Purse' }, {})
      item.system = { ...item.system, value }
      item.needsValueRoll = () => false
      item.update = vi.fn()
      return item
    }

    test('upward: 100 cp -> mints 1 sp and spends 10 cp (factor 10)', async () => {
      const item = makeResolvedItem({ cp: 100, sp: 0, gp: 0, ep: 0, pp: 0 })
      await item.convertCurrencyUpward('cp')
      expect(item.update).toHaveBeenCalledWith({ 'system.value.cp': 90, 'system.value.sp': 1 })
    })

    test('upward: no-op when below the conversion factor (5 cp cannot make a sp)', async () => {
      const item = makeResolvedItem({ cp: 5, sp: 0, gp: 0, ep: 0, pp: 0 })
      await item.convertCurrencyUpward('cp')
      expect(item.update).not.toHaveBeenCalled()
    })

    test('upward: no-op at the top denomination (pp has nothing higher)', async () => {
      const item = makeResolvedItem({ cp: 0, sp: 0, gp: 0, ep: 0, pp: 5 })
      await item.convertCurrencyUpward('pp')
      expect(item.update).not.toHaveBeenCalled()
    })

    test('downward: 1 sp -> spends 1 sp and yields 10 cp (factor 10)', async () => {
      const item = makeResolvedItem({ cp: 0, sp: 1, gp: 0, ep: 0, pp: 0 })
      await item.convertCurrencyDownward('sp')
      expect(item.update).toHaveBeenCalledWith({ 'system.value.sp': 0, 'system.value.cp': 10 })
    })

    test('downward: no-op at the bottom denomination (cp has nothing lower)', async () => {
      const item = makeResolvedItem({ cp: 5, sp: 0, gp: 0, ep: 0, pp: 0 })
      await item.convertCurrencyDownward('cp')
      expect(item.update).not.toHaveBeenCalled()
    })

    test('conversion is blocked while the value is still unresolved (needsValueRoll true)', async () => {
      const item = makeResolvedItem({ cp: 100, sp: 0, gp: 0, ep: 0, pp: 0 })
      item.needsValueRoll = () => true
      await item.convertCurrencyUpward('cp')
      await item.convertCurrencyDownward('cp')
      expect(item.update).not.toHaveBeenCalled()
    })
  })
})
