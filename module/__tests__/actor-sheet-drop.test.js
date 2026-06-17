/**
 * Unit tests for the actor-sheet drop handlers.
 *
 * `handleContainerDrop` + `dropActiveEffect` were extracted from
 * `module/actor-sheet.js`'s `_handleContainerDrop` / `_onDropActiveEffect`
 * (Phase 7 Appendix-A shrinkage). Both read only the actor plus the DOM event /
 * drag data; the Foundry globals they touch (`fromUuid`, `ui.notifications`,
 * `game.i18n`, `foundry.utils.deepClone`) are injected via `deps`, so they are
 * exercised here directly with no live sheet. Neither had prior unit coverage.
 */

import { describe, expect, test, vi } from 'vitest'
import { handleContainerDrop, dropActiveEffect } from '../actor-sheet/drop.mjs'

/** Build a fake drop event whose `target.closest` returns the given element. */
function makeEvent (closestResult) {
  return { target: { closest: vi.fn(() => closestResult) } }
}

/** Build a fake container element carrying a `data-container-id`. */
function containerEl (containerId) {
  return { dataset: { containerId } }
}

/** A no-op i18n that echoes the key (so warn messages are inspectable). */
const i18n = { localize: (k) => k }

/** A spy-able `ui` with notifications.warn. */
function makeUi () {
  return { notifications: { warn: vi.fn() } }
}

/** Build a fake actor exposing only what the drop handlers read. */
function makeActor (overrides = {}) {
  return {
    id: 'actor-1',
    uuid: 'Actor.actor-1',
    isOwner: true,
    items: new Map(),
    createEmbeddedDocuments: vi.fn(async () => [{ id: 'created' }]),
    ...overrides
  }
}

describe('handleContainerDrop', () => {
  test('returns undefined when the drop is not over a container element', async () => {
    const actor = makeActor()
    const result = await handleContainerDrop(actor, makeEvent(null), { uuid: 'x' }, { i18n, ui: makeUi() })
    expect(result).toBeUndefined()
  })

  test('returns undefined when the container id resolves to no item', async () => {
    const actor = makeActor() // empty items map
    const event = makeEvent(containerEl('missing'))
    const result = await handleContainerDrop(actor, event, { uuid: 'x' }, { i18n, ui: makeUi() })
    expect(result).toBeUndefined()
  })

  test('returns false (and warns) when fromUuid throws', async () => {
    const container = { canContainItem: vi.fn() }
    const actor = makeActor({ items: new Map([['c1', container]]) })
    const event = makeEvent(containerEl('c1'))
    const fromUuid = vi.fn(async () => { throw new Error('boom') })
    const result = await handleContainerDrop(actor, event, { uuid: 'bad' }, { i18n, ui: makeUi(), fromUuid })
    expect(result).toBe(false)
  })

  test('returns false when the resolved item is null', async () => {
    const container = {}
    const actor = makeActor({ items: new Map([['c1', container]]) })
    const event = makeEvent(containerEl('c1'))
    const fromUuid = vi.fn(async () => null)
    const result = await handleContainerDrop(actor, event, { uuid: 'gone' }, { i18n, ui: makeUi(), fromUuid })
    expect(result).toBe(false)
  })

  describe('item already on this actor', () => {
    test('sets the container reference when canContainItem allows', async () => {
      const update = vi.fn(async () => {})
      const item = { parent: { id: 'actor-1' }, name: 'Torch', update }
      const container = { canContainItem: vi.fn(() => ({ allowed: true })) }
      const actor = makeActor({ items: new Map([['c1', container]]) })
      const event = makeEvent(containerEl('c1'))
      const fromUuid = vi.fn(async () => item)
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui: makeUi(), fromUuid })
      expect(result).toBe(true)
      expect(update).toHaveBeenCalledWith({ 'system.container': 'c1' })
    })

    test('warns and returns false when canContainItem disallows', async () => {
      const item = { parent: { id: 'actor-1' }, name: 'Anvil', update: vi.fn() }
      const container = { canContainItem: vi.fn(() => ({ allowed: false, reason: 'DCC.ContainerTooHeavy' })) }
      const actor = makeActor({ items: new Map([['c1', container]]) })
      const event = makeEvent(containerEl('c1'))
      const ui = makeUi()
      const fromUuid = vi.fn(async () => item)
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui, fromUuid })
      expect(result).toBe(false)
      expect(ui.notifications.warn).toHaveBeenCalledWith('DCC.ContainerTooHeavy')
      expect(item.update).not.toHaveBeenCalled()
    })

    test('returns false when the update write throws', async () => {
      const item = { parent: { id: 'actor-1' }, name: 'Torch', update: vi.fn(async () => { throw new Error('db') }) }
      const container = { canContainItem: vi.fn(() => ({ allowed: true })) }
      const actor = makeActor({ items: new Map([['c1', container]]) })
      const event = makeEvent(containerEl('c1'))
      const fromUuid = vi.fn(async () => item)
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui: makeUi(), fromUuid })
      expect(result).toBe(false)
    })
  })

  describe('item from elsewhere (sidebar / compendium / other actor)', () => {
    /** An external item not parented to this actor. */
    function externalItem (system = {}) {
      return {
        parent: { id: 'other-actor' },
        name: 'Sword',
        toObject: () => ({ name: 'Sword', system: { ...system } })
      }
    }

    test('creates the item inside the container when capacities pass', async () => {
      const container = { availableItemCapacity: 5, availableWeightCapacity: 50 }
      const actor = makeActor({ items: new Map([['c1', container]]) })
      const event = makeEvent(containerEl('c1'))
      const fromUuid = vi.fn(async () => externalItem({ quantity: 2, weight: 3 }))
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui: makeUi(), fromUuid })
      expect(result).toBe(true)
      expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
      const [docType, [created]] = actor.createEmbeddedDocuments.mock.calls[0]
      expect(docType).toBe('Item')
      expect(created.system.container).toBe('c1')
    })

    test('warns ContainerFull and returns false when item-capacity exceeded', async () => {
      const container = { availableItemCapacity: 1, availableWeightCapacity: null }
      const actor = makeActor({ items: new Map([['c1', container]]) })
      const event = makeEvent(containerEl('c1'))
      const ui = makeUi()
      const fromUuid = vi.fn(async () => externalItem({ quantity: 3 }))
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui, fromUuid })
      expect(result).toBe(false)
      expect(ui.notifications.warn).toHaveBeenCalledWith('DCC.ContainerFull')
      expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
    })

    test('warns ContainerTooHeavy and returns false when weight-capacity exceeded', async () => {
      const container = { availableItemCapacity: null, availableWeightCapacity: 2 }
      const actor = makeActor({ items: new Map([['c1', container]]) })
      const event = makeEvent(containerEl('c1'))
      const ui = makeUi()
      const fromUuid = vi.fn(async () => externalItem({ quantity: 1, weight: 5 }))
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui, fromUuid })
      expect(result).toBe(false)
      expect(ui.notifications.warn).toHaveBeenCalledWith('DCC.ContainerTooHeavy')
    })

    test('null capacities skip the capacity checks entirely', async () => {
      const container = { availableItemCapacity: null, availableWeightCapacity: null }
      const actor = makeActor({ items: new Map([['c1', container]]) })
      const event = makeEvent(containerEl('c1'))
      const fromUuid = vi.fn(async () => externalItem({ quantity: 999, weight: 999 }))
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui: makeUi(), fromUuid })
      expect(result).toBe(true)
    })

    test('returns false when createEmbeddedDocuments throws', async () => {
      const container = { availableItemCapacity: null, availableWeightCapacity: null }
      const actor = makeActor({
        items: new Map([['c1', container]]),
        createEmbeddedDocuments: vi.fn(async () => { throw new Error('db') })
      })
      const event = makeEvent(containerEl('c1'))
      const fromUuid = vi.fn(async () => externalItem())
      const result = await handleContainerDrop(actor, event, { uuid: 'i' }, { i18n, ui: makeUi(), fromUuid })
      expect(result).toBe(false)
    })
  })
})

describe('dropActiveEffect', () => {
  const deepClone = (v) => JSON.parse(JSON.stringify(v))

  test('returns false when the user does not own the actor', async () => {
    const actor = makeActor({ isOwner: false })
    const result = await dropActiveEffect(actor, { data: { name: 'Bless' } }, { deepClone })
    expect(result).toBe(false)
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('returns false when no effect data and no uuid', async () => {
    const actor = makeActor()
    const result = await dropActiveEffect(actor, {}, { deepClone })
    expect(result).toBe(false)
  })

  test('returns false when the uuid resolves to nothing', async () => {
    const actor = makeActor()
    const fromUuid = vi.fn(async () => null)
    const result = await dropActiveEffect(actor, { uuid: 'gone' }, { deepClone, fromUuid })
    expect(result).toBe(false)
  })

  test('creates the effect from inline data, stripping id and setting origin/transfer/img', async () => {
    const actor = makeActor()
    const data = { data: { _id: 'orig', name: 'Bless', transfer: true, flags: { module: { aura: 1 } } } }
    await dropActiveEffect(actor, data, { deepClone })
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
    const [docType, [created]] = actor.createEmbeddedDocuments.mock.calls[0]
    expect(docType).toBe('ActiveEffect')
    expect(created._id).toBeUndefined()
    expect(created.origin).toBe('Actor.actor-1')
    expect(created.transfer).toBe(false)
    expect(created.img).toBe('icons/svg/aura.svg')
    expect(created.flags.module.aura).toBe(1) // module flags preserved
  })

  test('resolves the effect by uuid for compendium drags and keeps an existing img', async () => {
    const actor = makeActor()
    const effect = { toObject: () => ({ _id: 'x', name: 'Shield', img: 'icons/svg/shield.svg' }) }
    const fromUuid = vi.fn(async () => effect)
    await dropActiveEffect(actor, { uuid: 'Compendium.x' }, { deepClone, fromUuid })
    const [, [created]] = actor.createEmbeddedDocuments.mock.calls[0]
    expect(created.name).toBe('Shield')
    expect(created.img).toBe('icons/svg/shield.svg')
  })
})
