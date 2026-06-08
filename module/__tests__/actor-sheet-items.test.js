import { describe, test, expect, vi } from 'vitest'
import { prepareItems } from '../actor-sheet/items.mjs'

// Phase 7 (Appendix-A actor-sheet.js shrinkage): `#prepareItems` was a #private
// method with NO prior unit coverage. Extracting it to a free function (with the
// four Foundry globals injected via `deps`) makes its bucketing, coin-merge, and
// weight math directly testable — this whole file is a coverage win, not just a
// relocation guard.

// --- minimal mocks ------------------------------------------------------------

// An items "collection": a plain array (so `[...items]` works) carrying a `.get`
// method, mirroring a Foundry EmbeddedCollection.
const makeItems = (arr) => {
  const map = new Map(arr.map((i) => [i._id, i]))
  arr.get = (id) => map.get(id)
  return arr
}

// A bare item. `system` defaults to {} and is shallow-merged with overrides.
let nextId = 0
const item = (type, system = {}, extra = {}) => ({
  _id: extra._id ?? `i${nextId++}`,
  name: extra.name ?? `${type}-${nextId}`,
  img: extra.img,
  type,
  system,
  ...extra
})

const makeActor = ({ items = [], currency = {}, config = {}, isOwner = true, actionDie = '1d20' } = {}) => {
  const itemsColl = makeItems(items)
  return {
    items: itemsColl,
    system: { config, currency },
    isOwner,
    getActionDice: () => [{ formula: actionDie }],
    deleteEmbeddedDocuments: vi.fn(async () => {}),
    update: vi.fn(async () => {})
  }
}

// Injected deps: stub the four Foundry globals. coinWeight is configurable.
const makeDeps = (coinWeight = 0) => ({
  TextEditor: { enrichHTML: vi.fn(async (v) => `<enriched>${v}</enriched>`) },
  imageForItem: (type) => `icons/${type}.svg`,
  i18n: { localize: (k) => k },
  settings: { get: vi.fn((scope, key) => (key === 'coinWeight' ? coinWeight : 0)) }
})

// --- bucketing ---------------------------------------------------------------

describe('prepareItems — categorization', () => {
  test('buckets weapons by melee vs ranged', async () => {
    const actor = makeActor({
      items: [
        item('weapon', { melee: true }, { name: 'Sword' }),
        item('weapon', { melee: false }, { name: 'Bow' })
      ]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.weapons'].melee.map((w) => w.name)).toEqual(['Sword'])
    expect(ctx['equipment.weapons'].ranged.map((w) => w.name)).toEqual(['Bow'])
  })

  test('buckets ammunition, armor, equipment, and mounts', async () => {
    const actor = makeActor({
      items: [item('ammunition'), item('armor'), item('equipment'), item('mount')]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.ammunition']).toHaveLength(1)
    expect(ctx['equipment.armor']).toHaveLength(1)
    expect(ctx['equipment.equipment']).toHaveLength(1)
    expect(ctx['equipment.mounts']).toHaveLength(1)
  })

  test('groups spells by level, defaulting a missing level to 0, and enriches descriptions', async () => {
    const deps = makeDeps()
    const actor = makeActor({
      items: [
        item('spell', { level: 1, description: { value: 'Magic Missile' } }, { name: 'MM' }),
        item('spell', { description: { value: '' } }, { name: 'Cantrip' }),
        item('spell', { level: 1 }, { name: 'Second' })
      ]
    })
    const ctx = await prepareItems(actor, deps)
    expect(Object.keys(ctx.spells).sort()).toEqual(['0', '1'])
    expect(ctx.spells['1'].map((s) => s.name)).toEqual(['MM', 'Second'])
    expect(ctx.spells['0'].map((s) => s.name)).toEqual(['Cantrip'])
    // Level was mutated onto the level-less spell
    expect(ctx.spells['0'][0].system.level).toBe(0)
    // Only the spell with a non-empty description gets enriched HTML
    expect(ctx.spells['1'][0].descriptionHTML).toBe('<enriched>Magic Missile</enriched>')
    expect(ctx.spells['0'][0].descriptionHTML).toBeUndefined()
    expect(deps.TextEditor.enrichHTML).toHaveBeenCalledTimes(1)
  })
})

// --- skill display die -------------------------------------------------------

describe('prepareItems — skill displayDie', () => {
  test('uses the skill own die when useDie is on and a die is set', async () => {
    const actor = makeActor({ items: [item('skill', { config: { useDie: true }, die: '1d14' })] })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx.skills[0].displayDie).toBe('1d14')
  })

  test('inherits the actor action die for a rollable skill with useDie off', async () => {
    const actor = makeActor({
      items: [item('skill', { config: { useDie: false, useValue: true } })],
      actionDie: '1d24'
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx.skills[0].displayDie).toBe('1d24')
  })

  test('shows nothing for a description-only skill', async () => {
    const actor = makeActor({ items: [item('skill', { config: {} })] })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx.skills[0].displayDie).toBeNull()
  })
})

// --- treasure vs coins -------------------------------------------------------

describe('prepareItems — treasure and coins', () => {
  const coinItem = (value, needsRoll = false, extra = {}) => {
    const it = item('treasure', { isCoins: true, value }, extra)
    it.needsValueRoll = () => needsRoll
    return it
  }

  test('routes resolved coin-treasure to coins and merges it into actor currency', async () => {
    const actor = makeActor({
      currency: { pp: 1, ep: 0, gp: 2, sp: 0, cp: 5 },
      items: [coinItem({ pp: 0, ep: 0, gp: 3, sp: 0, cp: 10 }, false, { _id: 'c1' })]
    })
    const ctx = await prepareItems(actor, makeDeps())
    // Coins are merged away, not surfaced as treasure
    expect(ctx['equipment.treasure']).toHaveLength(0)
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['c1'])
    expect(actor.update).toHaveBeenCalledWith(
      { 'system.currency': { pp: 1, ep: 0, gp: 5, sp: 0, cp: 15 } },
      { diff: true }
    )
  })

  test('keeps an unresolved coin item as treasure (needsValueRoll true)', async () => {
    const actor = makeActor({
      currency: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 },
      items: [coinItem({ pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 }, true)]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.treasure']).toHaveLength(1)
    expect(actor.update).not.toHaveBeenCalled()
  })

  test('keeps non-coin treasure as treasure', async () => {
    const actor = makeActor({ items: [item('treasure', { isCoins: false })] })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.treasure']).toHaveLength(1)
  })

  test('coin weight totals string denomination values numerically, not by concatenation', async () => {
    // Regression (post treasure-value restore): system.value.* are now
    // formula-capable StringFields. An unresolved coin (needsValueRoll true)
    // stays as treasure and reaches the coin-weight branch — a bare `+` would
    // string-concat "0"+"0"+"12"+"0"+"0" -> "001200" -> 1200, then /10 -> 120 lbs.
    // parseInt per denomination gives the correct 12 / 10 = 1.2.
    const actor = makeActor({
      currency: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 0 },
      items: [coinItem({ pp: '0', ep: '0', gp: '12', sp: '0', cp: '0' }, true, { _id: 'c1' })]
    })
    const ctx = await prepareItems(actor, makeDeps(10)) // coinWeight = 10 coins/lb
    expect(ctx['equipment.treasure']).toHaveLength(1) // unresolved coin stays as treasure
    expect(ctx['equipment.weights'].treasure).toBeCloseTo(1.2)
  })
})

// --- containers --------------------------------------------------------------

describe('prepareItems — containers', () => {
  const container = (system, getters, extra = {}) => {
    const it = item('container', system, extra)
    Object.assign(it, getters)
    return it
  }

  test('builds container display data with a capacity summary and hides contained items', async () => {
    const contained = item('equipment', { container: 'box', weight: 5, quantity: 1 }, { _id: 'inside' })
    const box = container(
      { capacity: { weight: 20, items: 4 } },
      {
        contents: [contained],
        contentsWeight: 5,
        contentsItemCount: 1,
        totalWeight: 5,
        availableWeightCapacity: 15,
        availableItemCapacity: 3
      },
      { _id: 'box', name: 'Backpack' }
    )
    const actor = makeActor({ items: [box, contained] })
    const ctx = await prepareItems(actor, makeDeps())

    expect(ctx['equipment.containers']).toHaveLength(1)
    const data = ctx['equipment.containers'][0]
    expect(data.name).toBe('Backpack')
    expect(data.capacitySummary).toBe('5/20 DCC.WeightUnit, 1/4 DCC.ContainerItemsUnit')
    // The contained item is nested, not surfaced as standalone equipment
    expect(ctx['equipment.equipment']).toHaveLength(0)
  })

  test('omits a capacity dimension when its max is 0', async () => {
    const box = container(
      { capacity: { weight: 0, items: 2 } },
      { contents: [], contentsWeight: 0, contentsItemCount: 0, totalWeight: 0, availableWeightCapacity: 0, availableItemCapacity: 2 },
      { _id: 'b', name: 'Pouch' }
    )
    const actor = makeActor({ items: [box] })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.containers'][0].capacitySummary).toBe('0/2 DCC.ContainerItemsUnit')
  })

  test('does not hide an item whose referenced container is absent', async () => {
    const orphan = item('equipment', { container: 'ghost' })
    const actor = makeActor({ items: [orphan] })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.equipment']).toHaveLength(1)
  })
})

// --- mutations: empty-item removal + icon repair -----------------------------

describe('prepareItems — actor mutations', () => {
  test('deletes physical items with quantity <= 0 when removeEmptyItems is on', async () => {
    const actor = makeActor({
      config: { removeEmptyItems: true },
      items: [item('equipment', { quantity: 0 }, { _id: 'empty' }), item('equipment', { quantity: 1 })]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['empty'])
    expect(ctx['equipment.equipment']).toHaveLength(1)
  })

  test('keeps zero-quantity items when removeEmptyItems is off', async () => {
    const actor = makeActor({
      config: { removeEmptyItems: false },
      items: [item('equipment', { quantity: 0 })]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    expect(ctx['equipment.equipment']).toHaveLength(1)
  })

  test('repairs a missing or mystery-man icon from the item-type table', async () => {
    const actor = makeActor({
      items: [
        item('armor', {}, { img: undefined }),
        item('weapon', { melee: true }, { img: 'icons/svg/mystery-man.svg' }),
        item('equipment', {}, { img: 'icons/keep.png' })
      ]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.armor'][0].img).toBe('icons/armor.svg')
    expect(ctx['equipment.weapons'].melee[0].img).toBe('icons/weapon.svg')
    expect(ctx['equipment.equipment'][0].img).toBe('icons/keep.png')
  })
})

// --- sorting -----------------------------------------------------------------

describe('prepareItems — sortInventory', () => {
  test('sorts inventory lexically by name when enabled', async () => {
    const actor = makeActor({
      config: { sortInventory: true },
      items: [item('equipment', {}, { name: 'Zebra' }), item('equipment', {}, { name: 'Apple' })]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.equipment'].map((i) => i.name)).toEqual(['Apple', 'Zebra'])
  })

  test('preserves source order when sorting is disabled', async () => {
    const actor = makeActor({
      config: { sortInventory: false },
      items: [item('equipment', {}, { name: 'Zebra' }), item('equipment', {}, { name: 'Apple' })]
    })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.equipment'].map((i) => i.name)).toEqual(['Zebra', 'Apple'])
  })
})

// --- weight math -------------------------------------------------------------

describe('prepareItems — weights', () => {
  test('sums weight * quantity per section and totals them', async () => {
    const actor = makeActor({
      items: [
        item('weapon', { melee: true, weight: 3, quantity: 2 }),
        item('weapon', { melee: false, weight: 1, quantity: 1 }),
        item('armor', { weight: 10, quantity: 1 }),
        item('equipment', { weight: 2, quantity: 3 }),
        item('ammunition', { weight: 0.1, quantity: 10 }),
        item('mount', { weight: 0, quantity: 1 })
      ]
    })
    const ctx = await prepareItems(actor, makeDeps())
    const w = ctx['equipment.weights']
    expect(w.melee).toBe(6)
    expect(w.ranged).toBe(1)
    expect(w.armor).toBe(10)
    expect(w.equipment).toBe(6)
    expect(w.ammunition).toBeCloseTo(1)
    expect(w.mounts).toBe(0)
    expect(w.total).toBeCloseTo(24)
  })

  test('container weight comes from each container totalWeight', async () => {
    const box = item('container', { capacity: {} }, { _id: 'b' })
    Object.assign(box, {
      contents: [], contentsWeight: 0, contentsItemCount: 0, totalWeight: 7, availableWeightCapacity: 0, availableItemCapacity: 0
    })
    const actor = makeActor({ items: [box] })
    const ctx = await prepareItems(actor, makeDeps())
    expect(ctx['equipment.weights'].containers).toBe(7)
    expect(ctx['equipment.weights'].total).toBe(7)
  })

  test('coin treasure uses coinsPerPound and actor currency adds to treasure weight', async () => {
    // coinsPerPound = 10. Unresolved coin treasure stays (so it counts toward weight).
    const coins = item('treasure', { isCoins: true, value: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 50 } })
    coins.needsValueRoll = () => true
    const actor = makeActor({
      currency: { pp: 0, ep: 0, gp: 0, sp: 0, cp: 100 },
      items: [coins]
    })
    const ctx = await prepareItems(actor, makeDeps(10))
    // treasure coins 50/10 = 5, actor currency 100/10 = 10 → 15
    expect(ctx['equipment.weights'].treasure).toBeCloseTo(15)
  })

  test('coins contribute no weight when coinsPerPound is 0', async () => {
    const coins = item('treasure', { isCoins: true, value: { cp: 100 } })
    coins.needsValueRoll = () => true
    const actor = makeActor({ currency: { cp: 500 }, items: [coins] })
    const ctx = await prepareItems(actor, makeDeps(0))
    expect(ctx['equipment.weights'].treasure).toBe(0)
  })

  test('non-coin treasure uses standard weight * quantity', async () => {
    const gem = item('treasure', { isCoins: false, weight: 2, quantity: 3 })
    const actor = makeActor({ items: [gem] })
    const ctx = await prepareItems(actor, makeDeps(10))
    expect(ctx['equipment.weights'].treasure).toBe(6)
  })
})
