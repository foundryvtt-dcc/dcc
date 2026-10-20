/**
 * Coverage for the Party aggregate-bar migration (#911):
 * `partyTokenBarUpdate`, its `migrateActorData` wiring (prototype token) and
 * the `migrateSceneData` placed-token sweep. Globals are stubbed per-test in
 * the same style as `migrations-data-driven.test.js`; no live Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { migrateActorData, migrateSceneData, partyTokenBarUpdate } from '../migrations.js'

let originalGame
let originalFoundry
let originalConst

function stubFoundry () {
  return {
    utils: {
      deepClone: (o) => structuredClone(o),
      isEmpty: (o) => o == null || (typeof o === 'object' && Object.keys(o).length === 0)
    }
  }
}

/** Minimal Party actor whose data-driven branches are all no-ops. */
function partyActor ({ prototypeToken } = {}) {
  return {
    type: 'Party',
    system: {
      details: { alignment: 'n', critRange: 20, sheetClass: 'Party' },
      class: {}
    },
    _source: prototypeToken ? { prototypeToken } : {}
  }
}

beforeEach(() => {
  originalGame = globalThis.game
  originalFoundry = globalThis.foundry
  originalConst = globalThis.CONST
  globalThis.game = {
    i18n: { localize: vi.fn((k) => k) },
    settings: { get: vi.fn(() => 0.73) },
    system: { primaryTokenAttribute: 'attributes.hp' }
  }
  globalThis.foundry = stubFoundry()
  globalThis.CONST = { TOKEN_DISPLAY_MODES: { NONE: 0, HOVER: 30 } }
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.foundry = originalFoundry
  globalThis.CONST = originalConst
})

describe('partyTokenBarUpdate', () => {
  test('Party at the system default adopts aggregate.hp', () => {
    expect(partyTokenBarUpdate({ type: 'Party', barAttribute: 'attributes.hp' }))
      .toEqual({ 'bar1.attribute': 'aggregate.hp' })
  })

  test('Party with an empty bar adopts aggregate.hp', () => {
    expect(partyTokenBarUpdate({ type: 'Party', barAttribute: '' }))
      .toEqual({ 'bar1.attribute': 'aggregate.hp' })
  })

  test('Party with a deliberately chosen attribute is left alone', () => {
    expect(partyTokenBarUpdate({ type: 'Party', barAttribute: 'attributes.ac' })).toBeNull()
  })

  test('Party already on aggregate.hp is a no-op', () => {
    expect(partyTokenBarUpdate({ type: 'Party', barAttribute: 'aggregate.hp' })).toBeNull()
  })

  test('non-Party actors are left alone', () => {
    expect(partyTokenBarUpdate({ type: 'Player', barAttribute: 'attributes.hp' })).toBeNull()
  })

  test('NONE display mode enables bars (HOVER, matching creation)', () => {
    expect(partyTokenBarUpdate({ type: 'Party', barAttribute: '', displayBars: 0 }))
      .toEqual({ 'bar1.attribute': 'aggregate.hp', displayBars: 30 })
  })

  test('an already-visible display mode is kept', () => {
    expect(partyTokenBarUpdate({ type: 'Party', barAttribute: '', displayBars: 10 }))
      .toEqual({ 'bar1.attribute': 'aggregate.hp' })
  })
})

describe('migrateActorData Party prototype token', () => {
  test('writes prototypeToken.bar1.attribute and displayBars', async () => {
    const actor = partyActor({ prototypeToken: { bar1: { attribute: 'attributes.hp' }, displayBars: 0 } })
    const updateData = await migrateActorData(actor)
    expect(updateData['prototypeToken.bar1.attribute']).toBe('aggregate.hp')
    expect(updateData['prototypeToken.displayBars']).toBe(30)
  })

  test('leaves an already-updated prototype token untouched', async () => {
    const actor = partyActor({ prototypeToken: { bar1: { attribute: 'aggregate.hp' }, displayBars: 30 } })
    const updateData = await migrateActorData(actor)
    expect(updateData).not.toHaveProperty('prototypeToken.bar1.attribute')
    expect(updateData).not.toHaveProperty('prototypeToken.displayBars')
  })

  test('synthetic token actors do not receive prototypeToken data', async () => {
    const actor = { ...partyActor({ prototypeToken: { bar1: { attribute: 'attributes.hp' }, displayBars: 0 } }), isToken: true }
    const updateData = await migrateActorData(actor)
    expect(updateData).not.toHaveProperty('prototypeToken.bar1.attribute')
    expect(updateData).not.toHaveProperty('prototypeToken.displayBars')
  })
})

describe('migrateSceneData Party tokens', () => {
  test('updates a placed Party token once and skips non-Party tokens', async () => {
    const scene = {
      tokens: [
        { id: 'party', actorLink: true, actor: { type: 'Party' }, _source: { bar1: { attribute: 'attributes.hp' }, displayBars: 0 } },
        { id: 'hero', actorLink: true, actor: { type: 'Player' }, _source: { bar1: { attribute: 'attributes.hp' }, displayBars: 0 } }
      ],
      updateEmbeddedDocuments: vi.fn()
    }
    const migrated = await migrateSceneData(scene)
    expect(scene.updateEmbeddedDocuments).toHaveBeenCalledTimes(1)
    expect(scene.updateEmbeddedDocuments).toHaveBeenCalledWith('Token', [
      { _id: 'party', 'bar1.attribute': 'aggregate.hp', displayBars: 30 }
    ])
    expect(migrated).toBe(1)
  })

  test('never writes placed tokens of a compendium scene', async () => {
    const scene = {
      pack: 'world.scenes',
      tokens: [
        { id: 'party', actorLink: true, actor: { type: 'Party' }, _source: { bar1: { attribute: 'attributes.hp' }, displayBars: 0 } }
      ],
      updateEmbeddedDocuments: vi.fn()
    }
    expect(await migrateSceneData(scene)).toBe(0)
    expect(scene.updateEmbeddedDocuments).not.toHaveBeenCalled()
  })
})
