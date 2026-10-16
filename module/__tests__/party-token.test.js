/* global CONFIG, game, TokenDocument, canvas, Hooks, ui, foundry */
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { isDeepStrictEqual } from 'node:util'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'

let registerPartyTokenHooks
let hooks
let service

beforeEach(async () => {
  vi.resetModules()
  hooks = {}
  vi.stubGlobal('Hooks', {
    once: vi.fn((name, fn) => { hooks[name] = fn }),
    on: vi.fn((name, fn) => { hooks[name] = fn })
  })
  vi.stubGlobal('game', { model: { Actor: { Player: {}, NPC: {}, Party: {} } }, user: { isGM: false } })
  vi.stubGlobal('CONFIG', { Actor: { dataModels: { Player: class Player {}, NPC: class NPC {}, Party: class Party {}, Extra: class Extra {} }, trackableAttributes: {} } })
  vi.stubGlobal('TokenDocument', {
    getTrackedAttributes: vi.fn(source => {
      const registry = CONFIG.Actor.trackableAttributes
      if (typeof source === 'string') {
        const entries = registry[source] ? [registry[source]] : Object.values(registry)
        return Object.fromEntries(['bar', 'value'].map(key => [key, [...new Set(entries.flatMap(entry => entry[key]))].map(path => path.split('.'))]))
      }
      return { bar: [['attributes', 'hp']], value: [['details', 'level']] }
    })
  })
  vi.stubGlobal('canvas', { scene: { tokens: [] }, hud: { token: { object: null, render: vi.fn() } } })
  vi.stubGlobal('ui', {})
  service = await import('../party-token.mjs')
  ;({ registerPartyTokenHooks } = service)
})

// Persistent-document fixture: operations can reject, abort silently or apply only
// part of a batch. Assertions inspect stored documents, not just API return values.
function gatherWorkflowFixture () {
  const fixture = gatherFixture()
  const { party, scene, make, a, b } = fixture
  const events = []
  let generatedId = 0
  vi.stubGlobal('foundry', {
    utils: {
      equals: isDeepStrictEqual,
      randomID: () => `generated${String(++generatedId).padStart(7, '0')}`
    }
  })
  Object.assign(scene, placementFixture('square'))
  for (const [i, member] of [a, b].entries()) {
    const data = { ...member.toObject(), x: i * 200, y: 0, width: 2, height: 3, elevation: 17, delta: { system: { hp: 4 } }, sight: { enabled: true, range: 60 }, light: { bright: 20 }, texture: { src: 'member.webp', scaleX: 0.7 } }
    Object.assign(member, data)
    member.toObject = () => structuredClone(data)
    member.getCenterPoint = () => ({ x: data.x + 100, y: 150 })
  }
  party.getFlag = vi.fn((scope, key) => party.flags[scope][key])
  party.setFlag = vi.fn(async (scope, key, value) => {
    events.push('snapshot')
    party.flags[scope][key] = structuredClone(value)
    return party
  })
  party.unsetFlag = vi.fn(async (scope, key) => {
    events.push('clear')
    delete party.flags[scope][key]
    return party
  })
  party.getTokenDocument = vi.fn(async (position, { parent }) => {
    expect(parent).toBe(scene)
    const data = { actorId: party.id, actorLink: true, width: 1, height: 1, ...position }
    const document = new TokenDocument(data, { parent })
    document.updateSource = update => Object.assign(data, update)
    document.toObject = () => structuredClone(data)
    return document
  })
  let nextId = 0
  const deletedIds = new Set()
  scene.createEmbeddedDocuments = vi.fn(async (type, data, options = {}) => {
    expect(type).toBe('Token')
    // A create is a "restore" only when it brings back a previously deleted
    // document (rollback); deploy creates fresh IDs.
    events.push(options.keepId && data.every(source => deletedIds.has(source._id)) ? 'restore' : 'create')
    const documents = data.map(source => make(options.keepId && source._id ? source._id : `new${String(++nextId).padStart(13, '0')}`, source.actorId, source))
    for (const document of documents) document.getCenterPoint = () => new TokenDocument(document.toObject(), { parent: scene }).getCenterPoint(document)
    scene.tokens.push(...documents)
    return documents
  })
  scene.deleteEmbeddedDocuments = vi.fn(async (type, ids) => {
    expect(type).toBe('Token')
    events.push(ids.includes(a.id) ? 'delete-members' : 'delete-party')
    const removed = scene.tokens.filter(document => ids.includes(document.id))
    for (const document of removed) { deletedIds.add(document.id); scene.tokens.splice(scene.tokens.indexOf(document), 1) }
    return removed
  })
  const gather = (options = {}) => service.gatherPartyTokens({ party, scene, levelId: 'ground', ...options })
  return { ...fixture, events, gather }
}

describe('gather workflow', () => {
  test.each(['restored', 'restore-throw', 'restore-silent'])('original disappearing during awaited creation is verified before replacement cleanup (%s)', async mode => {
    const { party, scene, a, b, gather, events } = gatherWorkflowFixture()
    const source = a.toObject()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = await create(...args)
      scene.tokens.splice(scene.tokens.indexOf(a), 1)
      return result
    })
    if (mode === 'restore-throw') scene.createEmbeddedDocuments.mockRejectedValueOnce(new Error('restore'))
    if (mode === 'restore-silent') scene.createEmbeddedDocuments.mockResolvedValueOnce([])
    const restored = mode === 'restored'
    await expect(gather()).rejects.toMatchObject({ code: 'gather-context-changed', rollbackComplete: restored })
    expect(scene.tokens.get(b.id)).toBe(b)
    if (restored) {
      expect(scene.tokens.get(a.id)?.toObject()).toEqual(source)
      expect(scene.tokens.filter(t => t.id === a.id)).toHaveLength(1)
      expect(scene.createEmbeddedDocuments).toHaveBeenLastCalledWith('Token', [source], { keepId: true })
      expect(events.indexOf('restore')).toBeLessThan(events.indexOf('delete-party'))
      expect(scene.tokens.some(t => t.actorId === party.id)).toBe(false)
      expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    } else {
      expect(scene.tokens.some(t => t.actorId === party.id)).toBe(true)
      expect(party.getFlag('dcc', 'partyTokenSnapshots').members[0].tokenData).toEqual(source)
      expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
      expect(service.blockedPartyIds.has(party.id)).toBe(true)
      await expect(gather()).rejects.toMatchObject({ code: 'party-blocked' })
      expect(() => service.resolveDeployContext(party, scene)).toThrow('party-blocked')
    }
  })

  test.each(['throw', 'empty'])('external Party survives an unconfirmed own creation (%s)', async mode => {
    const { party, scene, a, b, make, gather } = gatherWorkflowFixture()
    const external = make('eeeeeeeeeeeeeeee', party.id)
    scene.createEmbeddedDocuments.mockImplementationOnce(async () => {
      scene.tokens.push(external)
      if (mode === 'throw') throw new Error('own-create-failed')
      return []
    })
    await expect(gather()).rejects.toMatchObject({ code: 'party-create-failed', rollbackComplete: false })
    expect(scene.tokens.get(external.id)).toBe(external)
    expect(scene.tokens).toEqual(expect.arrayContaining([a, b]))
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    expect(party.getFlag('dcc', 'partyTokenSnapshots').members.map(m => m.tokenData._id)).toEqual([a.id, b.id])
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
  })

  test('gather saves full sources before creating Party and only then deletes exactly the selected roster subset', async () => {
    const { party, scene, a, b, foreign, gather, events } = gatherWorkflowFixture()
    const expected = a.toObject()
    const result = await gather({ tokenIds: [a.id, foreign.id] })
    expect(events).toEqual(['snapshot', 'create', 'delete-members'])
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual({ sceneId: scene.id, members: [{ actorId: 'a', tokenData: expected }] })
    expect(party.getTokenDocument).toHaveBeenCalledWith({ x: 100, y: 150, level: 'ground' }, { parent: scene })
    expect(scene.createEmbeddedDocuments.mock.calls[0][1][0]).toMatchObject({ x: 100, y: 100, level: 'ground' })
    expect(scene.tokens.has(a.id)).toBe(false)
    expect(scene.tokens).toEqual(expect.arrayContaining([b, foreign]))
    expect(result).toMatchObject({ gathered: 1, partyTokenId: 'new0000000000001', skippedCombatTokenIds: [] })
  })

  test('gather uses the mean of current eligible centers and reports skipped combats without notifications', async () => {
    const { party, scene, a, gather } = gatherWorkflowFixture()
    await gather()
    expect(party.getTokenDocument).toHaveBeenCalledWith({ x: 200, y: 150, level: 'ground' }, { parent: scene })
    expect(scene.tokens.has(a.id)).toBe(false)
  })

  test.each(['foreign', 'missing', 'combat', 'departed'])('gather with no eligible members (%s) makes no changes', async state => {
    const { party, scene, a, foreign, gather, events } = gatherWorkflowFixture()
    if (state === 'combat') game.combats = [{ scene, started: true, combatants: [{ tokenId: a.id }] }]
    if (state === 'departed') party.flags.dcc.partyMembers = []
    const result = await gather({ tokenIds: [state === 'foreign' ? foreign.id : state === 'missing' ? 'missing' : a.id] })
    expect(result.gathered).toBe(0)
    expect(result.skippedCombatTokenIds).toEqual(state === 'combat' ? [a.id] : [])
    expect(events).toEqual([])
  })

  test.each(['snapshot', 'level', 'legacy', 'prototype', 'world'])('gather guards %s before any mutation with an error code', async state => {
    const { party, scene, partyToken, gather, events } = gatherWorkflowFixture()
    const codes = { snapshot: 'snapshot-open', level: 'invalid-gather-level', legacy: 'unlinked-party-token', prototype: 'unlinked-party-prototype', world: 'invalid-party' }
    if (state === 'snapshot') party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
    if (state === 'level') scene.levels.splice(0, 1)
    if (state === 'legacy') scene.tokens.push({ ...partyToken, actorLink: false })
    if (state === 'prototype') party.prototypeToken.actorLink = false
    if (state === 'world') game.actors.splice(0, 1)
    await expect(gather()).rejects.toMatchObject({ code: codes[state] })
    expect(events).toEqual([])
  })

  test.each(['throw', 'silent', 'wrong', 'partial'])('unconfirmed flag save (%s) never operates on tokens', async mode => {
    const { party, scene, gather } = gatherWorkflowFixture()
    party.setFlag.mockImplementation(async (scope, key, value) => {
      if (mode === 'throw') throw new Error('storage')
      if (mode === 'wrong') party.flags[scope][key] = { sceneId: 'wrong', members: value.members }
      if (mode === 'partial') party.flags[scope][key] = { ...value, members: value.members.slice(0, 1) }
    })
    await expect(gather()).rejects.toMatchObject({ code: 'snapshot-save-failed' })
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test.each(['throw', 'empty', 'silent', 'callback-throw', 'not-in-scene', 'unlinked'])('unconfirmed new Party (%s) never deletes members and retains additions without ownership proof', async mode => {
    const { party, scene, a, b, gather, events } = gatherWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      if (mode === 'throw') throw new Error('create')
      if (mode === 'silent') return []
      const documents = await create(...args)
      if (mode === 'empty') return []
      // A creation callback can throw after persistence but before returning the batch.
      if (mode === 'callback-throw') throw new Error('create-callback')
      if (mode === 'not-in-scene') scene.tokens.splice(scene.tokens.indexOf(documents[0]), 1)
      if (mode === 'unlinked') documents[0].actorLink = false
      return documents
    })
    const uncertain = mode === 'empty' || mode === 'callback-throw'
    await expect(gather()).rejects.toMatchObject({ code: 'party-create-failed', rollbackComplete: !uncertain })
    expect(scene.tokens).toEqual(expect.arrayContaining([a, b]))
    expect(scene.tokens.filter(t => t.actorId === party.id)).toHaveLength(uncertain ? 1 : 0)
    expect(events).not.toContain('delete-members')
    if (uncertain) {
      expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
      expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
      expect(service.blockedPartyIds.has(party.id)).toBe(true)
    } else expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
  })

  test.each(['throw', 'partial', 'silent', 'throw-after-delete'])('failed member deletion (%s) restores exact IDs before removing the new Party, clears snapshot and allows retry', async mode => {
    const { party, scene, a, b, gather, events } = gatherWorkflowFixture()
    const originals = [a, b].map(t => t.toObject())
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (type, ids) => {
      if (mode === 'throw') throw new Error('delete')
      if (mode === 'silent') return []
      await remove(type, mode === 'partial' ? ids.slice(0, 1) : ids)
      if (mode === 'throw-after-delete') throw new Error('after-delete')
      return []
    })
    await expect(gather()).rejects.toMatchObject({ code: 'member-delete-failed', rollbackComplete: true })
    for (const data of originals) {
      expect(scene.tokens.filter(t => t.id === data._id)).toHaveLength(1)
      expect(scene.tokens.get(data._id).toObject()).toEqual(data)
    }
    if (mode === 'partial' || mode === 'throw-after-delete') {
      expect(scene.createEmbeddedDocuments).toHaveBeenLastCalledWith('Token', mode === 'partial' ? [originals[0]] : originals, { keepId: true })
      expect(events.indexOf('restore')).toBeLessThan(events.indexOf('delete-party'))
    } else expect(events).not.toContain('restore')
    expect(scene.tokens.filter(t => t.actorId === party.id)).toHaveLength(0)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    expect(() => service.resolveDeployContext(party, scene)).toThrow('missing-snapshot')
    await expect(gather()).resolves.toMatchObject({ gathered: 2 })
  })

  test.each([false, true])('reuses an unchanged linked Party, never deletes it during rollback (%s)', async fail => {
    const { party, scene, partyToken, gather } = gatherWorkflowFixture()
    scene.tokens.push(partyToken)
    const before = partyToken.toObject()
    if (fail) scene.deleteEmbeddedDocuments.mockRejectedValueOnce(new Error('delete'))
    if (fail) await expect(gather()).rejects.toMatchObject({ rollbackComplete: true })
    else await gather()
    expect(party.getTokenDocument).not.toHaveBeenCalled()
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
    expect(partyToken.toObject()).toEqual(before)
    expect(scene.deleteEmbeddedDocuments.mock.calls.flatMap(([, ids]) => ids)).not.toContain(partyToken.id)
  })

  test.each(['restore-throw', 'restore-silent', 'restore-partial', 'party-delete-throw', 'party-delete-silent', 'clear-throw', 'clear-silent'])('incomplete rollback (%s) retains recovery data and blocks both actions', async mode => {
    const { party, scene, a, b, gather } = gatherWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (type, ids) => {
      await remove(type, ids)
      throw new Error('after-delete')
    })
    if (mode.startsWith('restore')) {
      scene.createEmbeddedDocuments.mockImplementation(async (type, data, options) => {
        if (!options?.keepId) return create(type, data, options)
        if (mode === 'restore-throw') throw new Error('restore')
        if (mode === 'restore-silent') return []
        return create(type, data.slice(0, 1), options)
      })
    }
    if (mode.startsWith('party-delete')) {
      scene.deleteEmbeddedDocuments.mockImplementation(async () => {
        if (mode === 'party-delete-throw') throw new Error('party-delete')
        return []
      })
    }
    if (mode === 'clear-throw') party.unsetFlag.mockRejectedValue(new Error('clear'))
    if (mode === 'clear-silent') party.unsetFlag.mockResolvedValue(party)
    await expect(gather()).rejects.toMatchObject({ code: 'member-delete-failed', rollbackComplete: false })
    expect(party.getFlag('dcc', 'partyTokenSnapshots').members.map(m => m.tokenData._id)).toEqual([a.id, b.id])
    if (mode.startsWith('restore') || mode.startsWith('party-delete')) expect(scene.tokens.some(t => t.actorId === party.id)).toBe(true)
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
    const calls = scene.createEmbeddedDocuments.mock.calls.length + scene.deleteEmbeddedDocuments.mock.calls.length
    await expect(gather()).rejects.toMatchObject({ code: 'party-blocked' })
    expect(() => service.resolveDeployContext(party, scene)).toThrow('party-blocked')
    expect(scene.createEmbeddedDocuments.mock.calls.length + scene.deleteEmbeddedDocuments.mock.calls.length).toBe(calls)
  })

  test('gather re-resolves stale caller objects against the current world roster and scene documents', async () => {
    const { party, scene, a, b, gather } = gatherWorkflowFixture()
    const staleParty = { ...party, flags: structuredClone(party.flags) }
    const staleScene = { ...scene, tokens: collection([...scene.tokens]) }
    party.flags.dcc.partyMembers = [{ id: 'b' }]
    await gather({ party: staleParty, scene: staleScene, tokenIds: [a.id, b.id] })
    expect(scene.tokens.has(a.id)).toBe(true)
    expect(scene.tokens.has(b.id)).toBe(false)
    expect(party.getFlag('dcc', 'partyTokenSnapshots').members.map(m => m.actorId)).toEqual(['b'])
  })

  test('gather skips combat members but still gathers eligible members', async () => {
    const { scene, a, b, gather } = gatherWorkflowFixture()
    game.combats = [{ scene, started: true, combatants: [{ tokenId: a.id }] }]
    await expect(gather()).resolves.toMatchObject({ gathered: 1, skippedCombatTokenIds: [a.id] })
    expect(scene.tokens.has(a.id)).toBe(true)
    expect(scene.tokens.has(b.id)).toBe(false)
  })

  test('a flag write that persists and then throws is cleared without any token operations', async () => {
    const { party, scene, gather } = gatherWorkflowFixture()
    const save = party.setFlag.getMockImplementation()
    party.setFlag.mockImplementationOnce(async (...args) => { await save(...args); throw new Error('after-save') })
    await expect(gather()).rejects.toMatchObject({ code: 'snapshot-save-failed', rollbackComplete: true })
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    await expect(gather()).resolves.toMatchObject({ gathered: 2 })
  })

  test('a create that persists then throws retains the unproven addition and snapshot, leaving originals intact', async () => {
    const { party, scene, a, b, gather } = gatherWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => { await create(...args); throw new Error('after-create') })
    await expect(gather()).rejects.toMatchObject({ code: 'party-create-failed', rollbackComplete: false })
    expect(scene.tokens).toEqual(expect.arrayContaining([a, b]))
    expect(scene.tokens.some(t => t.actorId === party.id)).toBe(true)
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
  })

  test.each(['roster', 'source', 'combat', 'party', 'snapshot'])('changes during awaited Party creation (%s) never delete originals', async mode => {
    const { party, scene, a, b, gather } = gatherWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = await create(...args)
      if (mode === 'roster') party.flags.dcc.partyMembers = []
      if (mode === 'source') a.toObject = () => ({ ...b.toObject(), _id: a.id, actorId: a.actorId, elevation: 99 })
      if (mode === 'combat') game.combats = [{ scene, started: true, combatants: [{ tokenId: a.id }] }]
      if (mode === 'party') result[0].actorId = 'foreign'
      if (mode === 'snapshot') delete party.flags.dcc.partyTokenSnapshots
      return result
    })
    await expect(gather()).rejects.toMatchObject({ code: mode === 'party' ? 'party-create-failed' : 'gather-context-changed' })
    expect(scene.tokens).toEqual(expect.arrayContaining([a, b]))
    expect(scene.deleteEmbeddedDocuments.mock.calls.flatMap(([, ids]) => ids)).not.toContain(a.id)
    expect(scene.tokens).toHaveLength(3)
  })

  test('reused Party also survives a partial deletion rollback with restored original IDs', async () => {
    const { party, scene, a, partyToken, gather } = gatherWorkflowFixture()
    scene.tokens.push(partyToken)
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce((type, ids) => remove(type, ids.slice(0, 1)))
    await expect(gather()).rejects.toMatchObject({ rollbackComplete: true })
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
    expect(scene.tokens.filter(t => t.id === a.id)).toHaveLength(1)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    expect(scene.deleteEmbeddedDocuments.mock.calls).toHaveLength(1)
  })

  test('rollback never deletes a concurrent Party addition outside the returned creation batch', async () => {
    const { party, scene, make, gather } = gatherWorkflowFixture()
    const concurrent = make('cccccccccccccccc', party.id)
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = await create(...args)
      scene.tokens.push(concurrent)
      return result
    })
    scene.deleteEmbeddedDocuments.mockRejectedValueOnce(new Error('delete-members'))
    await expect(gather()).rejects.toMatchObject({ code: 'member-delete-failed', rollbackComplete: true })
    expect(scene.tokens.get(concurrent.id)).toBe(concurrent)
    expect(scene.tokens.filter(t => t.actorId === party.id)).toEqual([concurrent])
  })

  test('ambiguous additions after a rejected creation are retained with snapshot and blocked guard', async () => {
    const { party, scene, make, gather } = gatherWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      await create(...args)
      scene.tokens.push(make('cccccccccccccccc', party.id))
      throw new Error('uncertain-create')
    })
    await expect(gather()).rejects.toMatchObject({ code: 'party-create-failed', rollbackComplete: false })
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    expect(scene.tokens.filter(t => t.actorId === party.id)).toHaveLength(2)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
  })

  test('Party disappearing during member deletion restores originals instead of reporting success', async () => {
    const { party, scene, a, b, gather } = gatherWorkflowFixture()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementation((type, ids) => {
      if (ids.some(id => !scene.tokens.has(id))) throw new Error('missing-document')
      return remove(type, ids)
    })
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = await remove(...args)
      const partyToken = scene.tokens.find(t => t.actorId === party.id)
      scene.tokens.splice(scene.tokens.indexOf(partyToken), 1)
      return result
    })
    await expect(gather()).rejects.toMatchObject({ code: 'member-delete-failed', rollbackComplete: true })
    expect(scene.tokens.get(a.id).toObject()).toEqual(a.toObject())
    expect(scene.tokens.get(b.id).toObject()).toEqual(b.toObject())
  })

  test('rollback verifies restored originals against documents Foundry normalized on create', async () => {
    const { party, scene, a, b, gather } = gatherWorkflowFixture()
    // The gathered token had moved and stood inside a region, so its snapshot
    // source carries a non-empty movement history and region set.
    const base = a.toObject()
    a.toObject = () => ({ ...structuredClone(base), _movementHistory: [{ x: 100, y: 0, elevation: 0, cost: 1, action: 'walk' }], _regions: ['region-a'] })
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    // Foundry's TokenDocument._preCreateOperation wipes the movement history and
    // recomputes _regions, so a restored document never byte-matches its source.
    scene.createEmbeddedDocuments.mockImplementation(async (type, data, options) => {
      const documents = await create(type, data, options)
      for (const document of documents) {
        const source = document.toObject()
        document.toObject = () => ({ ...source, _movementHistory: [], _regions: [] })
      }
      return documents
    })
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (type, ids) => { await remove(type, ids); throw new Error('after-delete') })
    await expect(gather()).rejects.toMatchObject({ code: 'member-delete-failed', rollbackComplete: true })
    expect(scene.tokens.get(a.id)).toBeDefined()
    expect(scene.tokens.get(b.id)).toBeDefined()
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    expect(service.blockedPartyIds.has(party.id)).toBe(false)
    await expect(gather()).resolves.toMatchObject({ gathered: 2 })
  })
})

afterEach(() => vi.unstubAllGlobals())

async function deployWorkflowFixture ({ crossScene = false, tokenIds = [] } = {}) {
  const fixture = gatherWorkflowFixture()
  const { party, scene: sourceScene, make, events } = fixture
  game.actors.push({ id: 'a' }, { id: 'b' })
  const gathered = await fixture.gather({ tokenIds })
  let scene = sourceScene
  if (crossScene) {
    scene = { ...sourceScene, id: 'destination', tokens: collection([]) }
    // Reuse the persistent backend with a separate storage collection.
    for (const name of ['createEmbeddedDocuments', 'deleteEmbeddedDocuments']) {
      const operation = sourceScene[name].getMockImplementation()
      scene[name] = vi.fn(async (...args) => {
        const tokens = sourceScene.tokens
        sourceScene.tokens = scene.tokens
        try { return await operation(...args) } finally { sourceScene.tokens = tokens }
      })
    }
    const token = sourceScene.tokens.get(gathered.partyTokenId)
    sourceScene.tokens.splice(sourceScene.tokens.indexOf(token), 1)
    scene.tokens.push(token)
    game.scenes.push(scene)
  }
  const partyToken = scene.tokens.get(gathered.partyTokenId)
  const snapshot = structuredClone(party.getFlag('dcc', 'partyTokenSnapshots'))
  events.length = 0
  scene.createEmbeddedDocuments.mockClear()
  scene.deleteEmbeddedDocuments.mockClear()
  party.setFlag.mockClear()
  party.unsetFlag.mockClear()
  const deploy = (options = {}) => service.deployPartyTokens({ party, scene, partyTokenId: partyToken.id, ...options })
  return { ...fixture, sourceScene, scene, partyToken, snapshot, deploy, make }
}

describe('deploy workflow', () => {
  test.each(['missing', 'null', 'empty', 'unknown'])('deploy requires an explicit existing target ID (%s) without mutations', async mode => {
    const { party, scene, snapshot, events } = await deployWorkflowFixture()
    const input = { party, scene }
    if (mode !== 'missing') input.partyTokenId = { null: null, empty: '', unknown: 'unknown-token-id' }[mode]
    const code = mode === 'unknown' ? 'missing-party-token' : 'missing-party-token-id'
    const tokens = scene.tokens.map(token => token.toObject())
    expect(() => service.resolveDeployContext(party, scene, input)).toThrow(code)
    await expect(service.deployPartyTokens(input)).rejects.toMatchObject({ code })
    expect(events).toEqual([])
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    expect(party.setFlag).not.toHaveBeenCalled()
    expect(party.unsetFlag).not.toHaveBeenCalled()
    expect(scene.tokens.map(token => token.toObject())).toEqual(tokens)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
  })

  test.each(['square', 'hexagonal', 'gridless'])('deploy creates fresh IDs and deep-cloned full payloads using %s geometry before consuming snapshot', async type => {
    const { party, scene, partyToken, snapshot, deploy, events, foreign } = await deployWorkflowFixture()
    Object.assign(scene, placementFixture(type))
    const center = partyToken.getCenterPoint()
    const placements = service.computeDeployPlacements(scene, center, snapshot.members.map(m => m.tokenData))
    const result = await deploy()
    expect(result).toMatchObject({ deployed: 2, skippedMemberIds: [], skipped: 0 })
    const created = scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))
    for (const [i, token] of created.entries()) {
      expect(token.id).not.toBe(snapshot.members[i].tokenData._id)
      expect(token.toObject()).toEqual({ ...snapshot.members[i].tokenData, ...placements[i], _id: token.id })
    }
    expect(events).toEqual(['create', 'delete-party', 'clear'])
    expect(scene.tokens.get(foreign.id)).toBe(foreign)
    expect(scene.tokens.has(partyToken.id)).toBe(false)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    const payload = scene.createEmbeddedDocuments.mock.calls[0][1][0]
    payload.texture.src = 'changed'
    expect(snapshot.members[0].tokenData.texture.src).toBe('member.webp')
    const count = events.length
    await expect(deploy()).rejects.toMatchObject({ code: 'missing-snapshot' })
    expect(events).toHaveLength(count)
  })

  test('deploy tolerates created documents returned out of input order', async () => {
    const { party, scene, partyToken, snapshot, deploy, events } = await deployWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    // Foundry does not guarantee that a create batch is returned in input order.
    scene.createEmbeddedDocuments.mockImplementation(async (...args) => [...await create(...args)].reverse())
    const placements = service.computeDeployPlacements(scene, partyToken.getCenterPoint(), snapshot.members.map(m => m.tokenData))
    const result = await deploy()
    expect(result).toMatchObject({ deployed: 2, skipped: 0 })
    for (const token of scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))) {
      const i = snapshot.members.findIndex(member => member.actorId === token.actorId)
      expect(token.toObject()).toEqual({ ...snapshot.members[i].tokenData, ...placements[i], _id: token.id })
    }
    expect(events).toEqual(['create', 'delete-party', 'clear'])
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
  })

  test.each([false, true])('deploy always uses current target Party level, including same-scene switch (cross scene %s)', async crossScene => {
    const { scene, sourceScene, partyToken, snapshot, deploy } = await deployWorkflowFixture({ crossScene })
    partyToken.level = 'upper'
    const toObject = partyToken.toObject
    partyToken.toObject = () => ({ ...toObject(), level: 'upper' })
    canvas.scene = null
    await deploy()
    for (const token of scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))) {
      expect(token.level).toBe('upper')
      expect(token.elevation).toBe(17)
    }
    expect(snapshot.members.every(m => m.tokenData.level === 'ground')).toBe(true)
    if (crossScene) expect(sourceScene.tokens.some(t => ['a', 'b'].includes(t.actorId))).toBe(false)
  })

  test('deploy re-resolves stale documents and only deploys gathered, existing, still-rostered members', async () => {
    const { party, scene, snapshot, deploy } = await deployWorkflowFixture()
    const staleParty = { ...party, flags: structuredClone(party.flags) }
    const staleScene = { ...scene, tokens: collection([]) }
    party.flags.dcc.partyMembers = [{ id: 'a' }, { id: 'new-member' }]
    game.actors.push({ id: 'new-member' })
    await expect(deploy({ party: staleParty, scene: staleScene })).resolves.toMatchObject({ deployed: 1, skipped: 1, skippedMemberIds: ['b'] })
    expect(scene.tokens.filter(t => t.actorId === 'new-member')).toHaveLength(0)
    expect(snapshot.members).toHaveLength(2)
  })

  test('deploy only replaces the gathered subset, leaving ungathered current roster tokens untouched', async () => {
    const { scene, b, deploy } = await deployWorkflowFixture({ tokenIds: ['aaaaaaaaaaaaaaaa'] })
    await expect(deploy()).resolves.toMatchObject({ deployed: 1, skippedMemberIds: [] })
    expect(scene.tokens.get(b.id)).toBe(b)
    expect(scene.tokens.filter(t => t.actorId === 'b')).toEqual([b])
    expect(scene.tokens.filter(t => t.actorId === 'a')).toHaveLength(1)
  })

  test('deploy skips a deleted world member even if its ID remains on the roster', async () => {
    const { scene, deploy } = await deployWorkflowFixture()
    game.actors.splice(game.actors.findIndex(actor => actor.id === 'a'), 1)
    await expect(deploy()).resolves.toMatchObject({ deployed: 1, skipped: 1, skippedMemberIds: ['a'] })
    expect(scene.tokens.filter(t => t.actorId === 'a')).toHaveLength(0)
    expect(scene.tokens.filter(t => t.actorId === 'b')).toHaveLength(1)
  })

  test.each(['all-departed', 'all-deleted'])('deploy safely clears %s snapshot without ever deleting Party without replacements', async mode => {
    const { party, scene, partyToken, deploy, events } = await deployWorkflowFixture()
    if (mode === 'all-departed') party.flags.dcc.partyMembers = []
    else game.actors.splice(1)
    await expect(deploy()).resolves.toMatchObject({ deployed: 0, skipped: 2, skippedMemberIds: ['a', 'b'] })
    expect(events).toEqual(['clear'])
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
  })

  test.each(['original', 'departed-original', 'invalid-id', 'source-missing', 'missing-token', 'wrong-party', 'legacy-alone', 'legacy-alongside', 'combat', 'level', 'world', 'synthetic', 'pack', 'scene-missing', 'blocked'])('deploy guards %s before mutations', async mode => {
    const { party, scene, sourceScene, partyToken, a, make, deploy, events } = await deployWorkflowFixture()
    const codes = { original: 'original-token-exists', 'departed-original': 'original-token-exists', 'invalid-id': 'invalid-snapshot-token-id', 'source-missing': 'missing-source-scene', 'missing-token': 'missing-party-token', 'wrong-party': 'missing-party-token', 'legacy-alone': 'unlinked-party-token', 'legacy-alongside': 'unlinked-party-token', combat: 'party-token-in-combat', level: 'invalid-deploy-level', world: 'invalid-party', synthetic: 'invalid-party', pack: 'invalid-party', 'scene-missing': 'missing-scene', blocked: 'party-blocked' }
    if (mode.includes('original')) sourceScene.tokens.push(a)
    if (mode === 'departed-original') party.flags.dcc.partyMembers = []
    if (mode === 'invalid-id') party.flags.dcc.partyTokenSnapshots.members[0].tokenData._id = 'invalid'
    if (mode === 'source-missing') party.flags.dcc.partyTokenSnapshots.sceneId = 'deleted'
    if (mode === 'missing-token' || mode === 'legacy-alone') scene.tokens.splice(scene.tokens.indexOf(partyToken), 1)
    if (mode === 'wrong-party') partyToken.actorId = 'other-party'
    if (mode.startsWith('legacy')) scene.tokens.push(make('llllllllllllllll', party.id, { actorLink: false, level: 'upper' }))
    if (mode === 'combat') game.combats = [{ scene, started: true, combatants: [{ tokenId: partyToken.id }] }]
    if (mode === 'level') scene.levels.splice(0)
    if (mode === 'world') game.actors.splice(0, 1)
    if (mode === 'synthetic') party.isToken = true
    if (mode === 'pack') party.pack = 'pack'
    if (mode === 'scene-missing') game.scenes.splice(0)
    if (mode === 'blocked') service.blockedPartyIds.add(party.id)
    await expect(deploy()).rejects.toMatchObject({ code: codes[mode] })
    expect(events).toEqual([])
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
  })

  test.each(['throw', 'silent', 'partial', 'not-stored', 'wrong-data', 'original-id'])('deploy verifies member creation (%s), fully rolls back and permits immediate retry', async mode => {
    const { party, scene, partyToken, snapshot, deploy } = await deployWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (type, data, options) => {
      if (mode === 'throw') throw new Error('create')
      if (mode === 'silent') return []
      const result = await create(type, mode === 'partial' ? data.slice(0, 1) : data, options)
      if (mode === 'not-stored') scene.tokens.splice(scene.tokens.indexOf(result[0]), 1)
      if (mode === 'wrong-data') result[0].toObject = () => ({ ...data[0], _id: result[0].id, elevation: 999 })
      return result
    })
    if (mode === 'original-id') {
      // The generated ID collides with a saved original ID.
      let ids = 0
      foundry.utils.randomID = () => ids++ === 0 ? snapshot.members[0].tokenData._id : `generatedx${String(ids).padStart(6, '0')}`
    }
    await expect(deploy()).rejects.toMatchObject({ code: 'member-create-failed', rollbackComplete: true })
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
    expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(0)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
    await expect(deploy()).resolves.toMatchObject({ deployed: 2 })
    expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(2)
  })

  test.each(['throw', 'silent', 'after-delete', 'clear-throw', 'clear-silent', 'clear-after-write'])('deploy failure (%s) restores original Party ID before member cleanup and preserves snapshot for retry', async mode => {
    const { party, scene, partyToken, snapshot, deploy, events } = await deployWorkflowFixture()
    const source = partyToken.toObject()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    if (mode === 'throw') scene.deleteEmbeddedDocuments.mockRejectedValueOnce(new Error('delete'))
    if (mode === 'silent') scene.deleteEmbeddedDocuments.mockResolvedValueOnce([])
    if (mode === 'after-delete') scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => { await remove(...args); throw new Error('deleted') })
    if (mode === 'clear-throw') party.unsetFlag.mockRejectedValueOnce(new Error('clear'))
    if (mode === 'clear-silent') party.unsetFlag.mockResolvedValueOnce(party)
    if (mode === 'clear-after-write') {
      const clear = party.unsetFlag.getMockImplementation()
      party.unsetFlag.mockImplementationOnce(async (...args) => { await clear(...args); throw new Error('cleared') })
    }
    await expect(deploy()).rejects.toMatchObject({ code: mode.startsWith('clear') ? 'snapshot-clear-failed' : 'party-delete-failed', rollbackComplete: true })
    expect(scene.tokens.get(partyToken.id)?.toObject()).toEqual(source)
    expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(0)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
    if (events.includes('restore')) expect(events.indexOf('restore')).toBeLessThan(events.lastIndexOf('delete-party'))
    await expect(deploy()).resolves.toMatchObject({ deployed: 2 })
  })

  test.each(['restore-throw', 'restore-silent', 'cleanup-throw', 'cleanup-silent', 'cleanup-partial', 'snapshot-restore'])('deploy incomplete rollback (%s) retains data and follow-up clicks on both actions are no-ops', async mode => {
    const { party, scene, partyToken, snapshot, deploy, gather } = await deployWorkflowFixture()
    party.unsetFlag.mockImplementationOnce(async (scope, key) => { delete party.flags[scope][key]; throw new Error('clear') })
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    if (mode.startsWith('restore')) {
      scene.createEmbeddedDocuments.mockImplementation((type, data, options) => {
        // Only intercept the rollback restore of the Party token itself.
        if (!(data.length === 1 && data[0]?._id === partyToken.id)) return create(type, data, options)
        if (mode === 'restore-throw') throw new Error('restore')
        return []
      })
    }
    if (mode.startsWith('cleanup')) {
      scene.deleteEmbeddedDocuments.mockImplementation((type, ids) => {
        if (ids.includes(partyToken.id)) return remove(type, ids)
        if (mode === 'cleanup-throw') throw new Error('cleanup')
        if (mode === 'cleanup-silent') return []
        return remove(type, ids.slice(0, 1))
      })
    }
    if (mode === 'snapshot-restore') party.setFlag.mockResolvedValue(party)
    await expect(deploy()).rejects.toMatchObject({ rollbackComplete: false, severity: 'error' })
    if (mode !== 'snapshot-restore') expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
    if (mode === 'snapshot-restore') expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(2)
    if (mode.startsWith('restore')) {
      expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(2)
      expect(scene.deleteEmbeddedDocuments).toHaveBeenCalledTimes(1)
    }
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
    const calls = scene.createEmbeddedDocuments.mock.calls.length + scene.deleteEmbeddedDocuments.mock.calls.length + party.setFlag.mock.calls.length + party.unsetFlag.mock.calls.length
    await expect(deploy()).rejects.toMatchObject({ code: 'party-blocked' })
    await expect(gather()).rejects.toMatchObject({ code: 'party-blocked' })
    expect(scene.createEmbeddedDocuments.mock.calls.length + scene.deleteEmbeddedDocuments.mock.calls.length + party.setFlag.mock.calls.length + party.unsetFlag.mock.calls.length).toBe(calls)
  })

  test.each(['throw', 'empty', 'partial-unreturned', 'external-only'])('deploy unknown creation attribution (%s) never deletes possible external members and blocks retry', async mode => {
    const { party, scene, make, snapshot, deploy } = await deployWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    const external = make('eeeeeeeeeeeeeeee', 'a')
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = mode === 'external-only' ? [] : await create(...args)
      scene.tokens.push(external)
      if (mode === 'throw') throw new Error('create-callback')
      if (mode === 'partial-unreturned') return result.slice(0, 1)
      return []
    })
    await expect(deploy()).rejects.toMatchObject({ code: 'member-create-failed', rollbackComplete: false })
    expect(scene.tokens.get(external.id)).toBe(external)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
    expect(scene.deleteEmbeddedDocuments.mock.calls.flatMap(([, ids]) => ids)).not.toContain(external.id)
  })

  test('deploy rollback only deletes proven own returned members, not a concurrent same-actor token', async () => {
    const { scene, make, deploy } = await deployWorkflowFixture()
    const external = make('eeeeeeeeeeeeeeee', 'a')
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => { const result = await create(...args); scene.tokens.push(external); return result })
    scene.deleteEmbeddedDocuments.mockRejectedValueOnce(new Error('delete'))
    await expect(deploy()).rejects.toMatchObject({ rollbackComplete: true })
    expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toEqual([external])
  })

  test.each(['original', 'roster', 'snapshot', 'party-missing', 'party-changed', 'combat', 'world', 'party-type', 'level', 'legacy'])('deploy rechecks awaited creation changes (%s) before Party destruction', async mode => {
    const { party, scene, a, partyToken, deploy } = await deployWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = await create(...args)
      if (mode === 'original') scene.tokens.push(a)
      if (mode === 'roster') party.flags.dcc.partyMembers = []
      if (mode === 'snapshot') delete party.flags.dcc.partyTokenSnapshots
      if (mode === 'party-missing') scene.tokens.splice(scene.tokens.indexOf(partyToken), 1)
      if (mode === 'party-changed') partyToken.actorId = 'external-party'
      if (mode === 'combat') game.combats = [{ scene, started: true, combatants: [{ tokenId: partyToken.id }] }]
      if (mode === 'world') game.actors.splice(0, 1)
      if (mode === 'party-type') party.type = 'NPC'
      if (mode === 'level') scene.levels.splice(0)
      if (mode === 'legacy') scene.tokens.push({ ...partyToken, id: 'llllllllllllllll', actorLink: false, level: 'upper' })
      return result
    })
    await expect(deploy()).rejects.toMatchObject({ code: 'deploy-context-changed' })
    expect(scene.deleteEmbeddedDocuments.mock.calls.flatMap(([, ids]) => ids)).not.toContain(partyToken.id)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
    if (mode === 'party-missing') expect(scene.tokens.get(partyToken.id)?.actorId).toBe(party.id)
    if (mode === 'party-changed') {
      expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
      expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(2)
      expect(service.blockedPartyIds.has(party.id)).toBe(true)
    }
    if (mode === 'world') {
      expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(2)
      expect(service.blockedPartyIds.has(party.id)).toBe(true)
    }
  })

  test('deploy rechecks original IDs after Party deletion and never clears snapshot on conflict', async () => {
    const { party, scene, a, deploy } = await deployWorkflowFixture()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => { const result = await remove(...args); scene.tokens.push(a); return result })
    await expect(deploy()).rejects.toMatchObject({ rollbackComplete: false })
    expect(party.unsetFlag).not.toHaveBeenCalled()
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
    expect(scene.tokens.get(a.id)).toBe(a)
  })

  test('deploy never mutates even the live snapshot payload when a failed backend mutates creation data', async () => {
    const { party, scene, deploy, snapshot } = await deployWorkflowFixture()
    const live = party.getFlag('dcc', 'partyTokenSnapshots')
    scene.createEmbeddedDocuments.mockImplementationOnce(async (type, data) => {
      data[0].texture.src = 'normalized'
      data[0].flags.custom.preserved = false
      throw new Error('failed-create')
    })
    await expect(deploy()).rejects.toMatchObject({ code: 'member-create-failed', rollbackComplete: true })
    expect(live).toEqual(snapshot)
  })

  test('deploy accepts only Foundry movement/region normalization, retaining all other source properties', async () => {
    const { scene, deploy } = await deployWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = await create(...args)
      for (const token of result) {
        const source = token.toObject()
        token.toObject = () => ({ ...source, _movementHistory: [], _regions: ['new-region'] })
      }
      return result
    })
    await expect(deploy()).resolves.toMatchObject({ deployed: 2 })
  })

  test('deploy rollback preserves a foreign document occupying a proven own member ID after Party restoration', async () => {
    const { party, scene, make, partyToken, deploy } = await deployWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    let external
    scene.createEmbeddedDocuments.mockImplementation(async (type, data, options) => {
      const result = await create(type, data, options)
      // A foreign document takes a member ID while the Party token is restored.
      if (options?.keepId && data.length === 1 && data[0]?._id === partyToken.id) {
        const member = scene.tokens.find(t => t.actorId === 'a')
        external = make(member.id, 'foreign')
        scene.tokens.splice(scene.tokens.indexOf(member), 1, external)
      }
      return result
    })
    party.unsetFlag.mockRejectedValueOnce(new Error('clear'))
    await expect(deploy()).rejects.toMatchObject({ rollbackComplete: false })
    expect(scene.tokens.get(external.id)).toBe(external)
    expect(scene.deleteEmbeddedDocuments.mock.calls.flatMap(([, ids]) => ids)).not.toContain(external.id)
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
  })

  test.each(['party-vanished', 'party-replaced', 'snapshot-vanished'])('deploy verifies final rollback state after awaited cleanup (%s)', async mode => {
    const { party, scene, partyToken, make, deploy } = await deployWorkflowFixture()
    if (mode === 'snapshot-vanished') party.setFlag.mockResolvedValue(party)
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockRejectedValueOnce(new Error('party-delete'))
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      const result = await remove(...args)
      if (mode === 'snapshot-vanished') delete party.flags.dcc.partyTokenSnapshots
      else {
        scene.tokens.splice(scene.tokens.findIndex(t => t.id === partyToken.id), 1)
        if (mode === 'party-replaced') scene.tokens.push(make(partyToken.id, 'foreign'))
      }
      return result
    })
    await expect(deploy()).rejects.toMatchObject({ rollbackComplete: false })
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
  })

  test('deploy rollback confirms actual member absence even when the cleanup callback throws after deletion', async () => {
    const { scene, deploy } = await deployWorkflowFixture()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockRejectedValueOnce(new Error('party-delete'))
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => { await remove(...args); throw new Error('cleanup-callback') })
    await expect(deploy()).rejects.toMatchObject({ rollbackComplete: true })
  })

  test.each(['clear-throw', 'clear-silent', 'original-appears'])('deploy all-invalid completion (%s) retains the Party and recovery data', async mode => {
    const { party, scene, partyToken, a, deploy, snapshot } = await deployWorkflowFixture()
    party.flags.dcc.partyMembers = []
    if (mode === 'clear-throw') party.unsetFlag.mockRejectedValueOnce(new Error('clear'))
    if (mode === 'clear-silent') party.unsetFlag.mockResolvedValueOnce(party)
    if (mode === 'original-appears') {
      party.unsetFlag.mockImplementationOnce(async (scope, key) => {
        scene.tokens.push(a)
        delete party.flags[scope][key]
      })
    }
    await expect(deploy()).rejects.toMatchObject({ code: 'snapshot-clear-failed' })
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
  })

  test('deploy all-invalid checks original IDs again immediately before clearing, not only at initial preflight', async () => {
    const { party, scene, partyToken, a, deploy, snapshot } = await deployWorkflowFixture()
    party.flags.dcc.partyMembers = []
    const center = partyToken.getCenterPoint()
    partyToken.getCenterPoint = () => { scene.tokens.push(a); return center }
    await expect(deploy()).rejects.toMatchObject({ code: 'deploy-context-changed' })
    expect(party.unsetFlag).not.toHaveBeenCalled()
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
  })
})

test('registers synchronous setup and client lifecycle hooks once at entry point', async () => {
  registerPartyTokenHooks()
  expect(Hooks.once).toHaveBeenCalledWith('setup', expect.any(Function))
  expect(hooks.setup()).toBeUndefined()
  expect(Object.keys(hooks)).toEqual(expect.arrayContaining(['updateActor', 'deleteActor', 'createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']))
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../dcc.js', import.meta.url), 'utf8'))
  expect(source.match(/^registerPartyTokenHooks\(\)/gm)).toHaveLength(1)
})

test('empty registry uses model classes, preserves every known type and deduplicates Party HP', () => {
  registerPartyTokenHooks()
  hooks.setup()
  for (const type of ['Player', 'NPC', 'Extra']) expect(CONFIG.Actor.trackableAttributes[type]).toEqual({ bar: ['attributes.hp'], value: ['details.level'] })
  expect(CONFIG.Actor.trackableAttributes.Party.bar).toEqual(['attributes.hp', 'aggregate.hp'])
  expect(TokenDocument.getTrackedAttributes.mock.calls.map(([source]) => source)).toEqual(Object.values(CONFIG.Actor.dataModels))
  hooks.setup()
  expect(CONFIG.Actor.trackableAttributes.Party.bar).toEqual(['attributes.hp', 'aggregate.hp'])
})

test('uses plain model fallback when no class exists', () => {
  delete CONFIG.Actor.dataModels.NPC
  registerPartyTokenHooks()
  hooks.setup()
  expect(TokenDocument.getTrackedAttributes).toHaveBeenCalledWith(game.model.Actor.NPC)
})

test.each([false, true])('snapshots partial foreign registry before mutation (explicit Party: %s)', explicitParty => {
  const foreign = { bar: ['foreign.hp'], value: ['foreign.score'] }
  CONFIG.Actor.trackableAttributes = { Player: foreign }
  if (explicitParty) CONFIG.Actor.trackableAttributes.Party = { bar: ['party.custom', 'aggregate.hp', 'aggregate.hp'], value: ['party.score'] }
  const initial = structuredClone(CONFIG.Actor.trackableAttributes)
  TokenDocument.getTrackedAttributes.mockImplementation(type => {
    expect(CONFIG.Actor.trackableAttributes).toEqual(initial)
    const entries = initial[type] ? [initial[type]] : Object.values(initial)
    return Object.fromEntries(['bar', 'value'].map(key => [key, entries.flatMap(entry => entry[key]).map(path => path.split('.'))]))
  })
  registerPartyTokenHooks()
  hooks.setup()
  expect(CONFIG.Actor.trackableAttributes.Player).toBe(foreign)
  expect(CONFIG.Actor.trackableAttributes.NPC.bar).toContain('foreign.hp')
  expect(CONFIG.Actor.trackableAttributes.Extra.value).toContain('foreign.score')
  expect(CONFIG.Actor.trackableAttributes.Party.bar.filter(path => path === 'aggregate.hp')).toHaveLength(1)
  if (explicitParty) expect(CONFIG.Actor.trackableAttributes.Party).toEqual({ bar: ['party.custom', 'aggregate.hp'], value: ['party.score'] })
})

function token (actor) {
  return { actor, reset: vi.fn(), prepareData: vi.fn(), object: { renderFlags: { set: vi.fn() } } }
}

test('repeated member HP refreshes reinitialize token effects instead of stacking them', () => {
  const member = { id: 'member', hp: 5 }
  const affected = token({ type: 'Party', flags: { dcc: { partyMembers: [{ id: member.id }] } } })
  // v14 prepareData applies additive effects to current values; reset first
  // reinitializes from source and then runs preparation.
  const sourceBright = 10
  affected.light = { bright: sourceBright }
  affected.prepareData.mockImplementation(() => {
    affected.light.bright += 5
    affected.bar1 = { value: member.hp, max: 8 }
  })
  affected.reset.mockImplementation(() => {
    affected.light.bright = sourceBright
    affected.prepareData()
  })
  affected.reset()
  canvas.scene.tokens = [affected]
  registerPartyTokenHooks()
  for (const hp of [4, 3, 2]) {
    member.hp = hp
    hooks.updateActor(member, { 'system.attributes.hp.value': hp }, {}, 'remote-GM')
    expect(affected.bar1).toEqual({ value: hp, max: 8 })
    expect(affected.light.bright).toBe(15)
  }
})

test('refreshes only affected viewed-scene Party documents before bars and bound HUD on remote updates/deletions', () => {
  const party = { id: 'party', type: 'Party', flags: { dcc: { partyMembers: [{ id: 'member' }] } } }
  const affected = token(party)
  const other = token({ id: 'other', type: 'Party', flags: { dcc: { partyMembers: [] } } })
  const member = token({ id: 'member', type: 'Player' })
  canvas.scene.tokens = [affected, other, member]
  canvas.hud.token.object = affected.object
  registerPartyTokenHooks()
  for (const name of ['updateActor', 'deleteActor']) hooks[name](member.actor, {}, {}, 'remote-GM')
  expect(affected.reset).toHaveBeenCalledTimes(2)
  expect(affected.object.renderFlags.set).toHaveBeenCalledWith({ refreshBars: true })
  expect(affected.reset.mock.invocationCallOrder[0]).toBeLessThan(affected.object.renderFlags.set.mock.invocationCallOrder[0])
  expect(canvas.hud.token.render).toHaveBeenCalledTimes(2)
  expect(other.reset).not.toHaveBeenCalled()
  expect(member.reset).not.toHaveBeenCalled()
  hooks.updateActor(party, { flags: { dcc: { partyMembers: [] } } })
  expect(affected.reset).toHaveBeenCalledTimes(3)
})

test('refreshes member effects via actor lifecycle, including item effects, without persistence', () => {
  const member = { id: 'member', documentName: 'Actor' }
  const affected = token({ type: 'Party', flags: { dcc: { partyMembers: [{ id: 'member' }] } } })
  canvas.scene.tokens = [affected]
  registerPartyTokenHooks()
  for (const name of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) {
    hooks[name]({ parent: member })
    hooks[name]({ parent: { documentName: 'Item', parent: member } })
  }
  expect(affected.reset).toHaveBeenCalledTimes(6)
  expect(canvas.hud.token.render).not.toHaveBeenCalled()
  canvas.scene = null
  expect(() => hooks.updateActor(member)).not.toThrow()
})

function deferred () {
  let resolve
  const promise = new Promise(_resolve => { resolve = _resolve })
  return { promise, resolve }
}

async function socketFixture (fixture = gatherWorkflowFixture()) {
  const gm = { id: 'gm', isGM: true }
  const otherGM = { id: 'other-gm', isGM: true }
  const player = { id: 'player', isGM: false }
  game.user = gm
  game.users = collection([gm, otherGM, player])
  game.users.activeGM = gm
  game.socket = { emit: vi.fn() }
  service.registerPartyTokenSocket()
  const socket = await import('../socket.mjs')
  const payload = { action: 'gather', partyId: fixture.party.id, sceneId: fixture.scene.id, levelId: 'ground', tokenIds: [fixture.a.id] }
  const remote = (data = payload, sender = gm.id) => socket.onSocketMessage({ action: 'partyTokenAction', payload: data }, sender)
  return { ...fixture, gm, otherGM, player, payload, remote }
}

describe('party token UI controller', () => {
  async function fixture () {
    const data = await socketFixture()
    game.i18n = { localize: key => key, format: (key, data) => `${key}:${JSON.stringify(data)}` }
    globalThis.ui = { notifications: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }
    return data
  }

  test.each(['subset', 'foreign', 'mixed', 'all'])('sheet sends %s selection through central socket without silently broadening', async mode => {
    const { party, scene, a, b, foreign } = await fixture()
    const selection = { subset: [a], foreign: [foreign], mixed: [a, foreign], all: [] }[mode]
    const result = await service.togglePartyTokens({ party, scene, levelId: 'ground', selection })
    expect(result.gathered).toBe(mode === 'foreign' ? 0 : mode === 'all' ? 2 : 1)
    expect(scene.tokens.has(foreign.id)).toBe(true)
    if (mode !== 'all') expect(scene.tokens.has(b.id)).toBe(true)
  })

  test('remote requests freeze concrete gather action and source selection, without using executing canvas', async () => {
    const { party, scene, a, otherGM } = await fixture()
    game.user = otherGM
    canvas.scene = { id: 'different' }
    canvas.level = { id: 'different' }
    await service.togglePartyTokens({ party, scene, levelId: 'ground', selection: [a] })
    await service.togglePartyTokens({ party, scene, levelId: 'ground', selection: [a] })
    expect(game.socket.emit).toHaveBeenCalledTimes(2)
    expect(game.socket.emit.mock.calls[0][1].payload).toEqual({ action: 'gather', partyId: party.id, sceneId: scene.id, levelId: 'ground', tokenIds: [a.id] })
    expect(game.socket.emit.mock.calls[1][1]).toEqual(game.socket.emit.mock.calls[0][1])
    expect(ui.notifications.info).not.toHaveBeenCalled()
  })

  test('label follows replicated snapshot, deploy requires a target in the viewed scene', async () => {
    const { party, scene } = await fixture()
    expect(service.partyTokenActionLabel(party)).toBe('DCC.PartyTokenGather')
    party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
    expect(service.partyTokenActionLabel(party)).toBe('DCC.PartyTokenDeploy')
    await service.togglePartyTokens({ party, scene })
    expect(ui.notifications.warn).toHaveBeenCalledWith('DCC.PartyTokenMissingPartyTokenOnScene')
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('unauthorized UI call is contained, warns and sends nothing', async () => {
    const { party, scene, player } = await fixture()
    game.user = player
    await expect(service.togglePartyTokens({ party, scene })).resolves.toBeUndefined()
    expect(ui.notifications.warn).toHaveBeenCalledWith('DCC.PartyTokenUnauthorized')
    expect(game.socket.emit).not.toHaveBeenCalled()
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('combat selection reaches service intact and produces success plus skip notice exactly once', async () => {
    const { party, scene, a, b } = await fixture()
    game.combats = [{ scene, started: true, combatants: [{ tokenId: b.id }] }]
    await service.togglePartyTokens({ party, scene, levelId: 'ground', selection: [a, b] })
    expect(ui.notifications.info).toHaveBeenCalledTimes(1)
    expect(ui.notifications.info).toHaveBeenCalledWith('DCC.PartyTokenGathered:{"count":1}')
    expect(ui.notifications.warn).toHaveBeenCalledWith('DCC.PartyTokenSkippedCombat:{"count":1}')
  })

  test.each([
    ['unauthorized', 'Unauthorized'], ['invalid-request', 'InvalidRequest'], ['invalid-party', 'InvalidParty'],
    ['missing-scene', 'MissingScene'], ['missing-party-token-id', 'MissingPartyToken'], ['missing-party-token', 'MissingPartyTokenOnScene'],
    ['ambiguous-party-token', 'AmbiguousPartyToken'], ['party-token-in-combat', 'PartyInCombat'], ['party-blocked', 'Blocked'],
    ['snapshot-open', 'SnapshotOpen'], ['missing-snapshot', 'MissingSnapshot'], ['unlinked-party-token', 'UnlinkedToken'],
    ['unlinked-party-prototype', 'UnlinkedPrototype'], ['invalid-gather-level', 'InvalidGatherLevel'], ['invalid-deploy-level', 'InvalidDeployLevel'],
    ['missing-source-scene', 'MissingSourceScene'], ['invalid-snapshot-token-id', 'InvalidSnapshot'], ['original-token-exists', 'OriginalsPresent'],
    ['snapshot-save-failed', 'SnapshotSaveFailed'], ['party-create-failed', 'PartyCreateFailed'], ['gather-context-changed', 'GatherContextChanged'],
    ['member-delete-failed', 'MemberDeleteFailed'], ['deploy-context-changed', 'DeployContextChanged'], ['member-create-failed', 'MemberCreateFailed'],
    ['party-delete-failed', 'PartyDeleteFailed'], ['snapshot-clear-failed', 'SnapshotClearFailed']
  ])('executing GM localizes service error %s exactly once as %s', async (code, suffix) => {
    const { payload, scene } = await fixture()
    // Inject at the handler boundary; workflow/error generation has separate coverage.
    game.users.get = () => { throw Object.assign(new Error(code), { code }) }
    await expect(service.requestPartyTokenAction(payload)).resolves.toEqual({ error: { code } })
    expect(ui.notifications.warn).toHaveBeenCalledExactlyOnceWith(`DCC.PartyToken${suffix}`)
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('missing party token on scene uses its own neutral notice, distinct from the deploy target notice', async () => {
    const { payload } = await fixture()
    // 'missing-party-token' also reaches the gather path, so it must not claim a deploy step.
    game.users.get = () => { throw Object.assign(new Error('missing-party-token'), { code: 'missing-party-token' }) }
    await expect(service.requestPartyTokenAction(payload)).resolves.toEqual({ error: { code: 'missing-party-token' } })
    expect(ui.notifications.warn).toHaveBeenCalledExactlyOnceWith('DCC.PartyTokenMissingPartyTokenOnScene')
    game.users.get = () => { throw Object.assign(new Error('missing-party-token-id'), { code: 'missing-party-token-id' }) }
    await expect(service.requestPartyTokenAction(payload)).resolves.toEqual({ error: { code: 'missing-party-token-id' } })
    expect(ui.notifications.warn).toHaveBeenLastCalledWith('DCC.PartyTokenMissingPartyToken')
  })

  test('missing-snapshot notice is emitted after a deploy click and points at deploying, not gathering again', () => {
    const lang = JSON.parse(readFileSync(new URL('../../lang/en.json', import.meta.url), 'utf8'))
    const text = lang['DCC.PartyTokenMissingSnapshot']
    expect(text).toMatch(/deploy/i)
  })

  test('failed rollback reports manual inspection, never retry/reload as repair', async () => {
    const { party, scene, payload } = await fixture()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      scene.createEmbeddedDocuments.mockRejectedValueOnce(new Error('create'))
      party.unsetFlag.mockRejectedValueOnce(new Error('clear'))
      await expect(service.requestPartyTokenAction(payload)).resolves.toMatchObject({ error: { rollbackComplete: false } })
      expect(ui.notifications.warn).toHaveBeenCalledExactlyOnceWith('DCC.PartyTokenRollbackFailed')
      expect(log).toHaveBeenCalledTimes(1)
    } finally { log.mockRestore() }
  })

  test('unexpected request failure is contained, with generic localized warning and console-only details', async () => {
    const { party, scene, otherGM } = await fixture()
    game.user = otherGM
    game.socket.emit.mockImplementationOnce(() => { throw new Error('private transport details') })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(service.togglePartyTokens({ party, scene, levelId: 'ground' })).resolves.toBeUndefined()
      expect(ui.notifications.warn).toHaveBeenCalledExactlyOnceWith('DCC.PartyTokenUnexpectedError')
      expect(log).toHaveBeenCalledTimes(1)
    } finally { log.mockRestore() }
  })

  test('multiple target tokens require context; an explicitly selected target is sent unchanged', async () => {
    const { party, scene, make, otherGM } = await fixture()
    party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
    const first = make('1111111111111111', party.id)
    const second = make('2222222222222222', party.id)
    scene.tokens.push(first, second)
    game.user = otherGM
    await service.togglePartyTokens({ party, scene })
    expect(ui.notifications.warn).toHaveBeenCalledWith('DCC.PartyTokenAmbiguousPartyToken')
    expect(game.socket.emit).not.toHaveBeenCalled()
    await service.togglePartyTokens({ party, scene, selection: [second] })
    expect(game.socket.emit.mock.calls[0][1].payload).toEqual({ action: 'deploy', partyId: party.id, sceneId: scene.id, partyTokenId: second.id })
  })

  test('gather also resolves a uniquely selected existing party token instead of ambiguous implicit reuse', async () => {
    const { party, scene, make, a, otherGM } = await fixture()
    const first = make('1111111111111111', party.id)
    const second = make('2222222222222222', party.id)
    scene.tokens.push(first, second)
    game.user = otherGM
    await service.togglePartyTokens({ party, scene, levelId: 'ground', selection: [a, second] })
    expect(game.socket.emit.mock.calls[0][1].payload).toMatchObject({ action: 'gather', partyTokenId: second.id })
  })

  function hudElement ({ withColumn = true } = {}) {
    const controls = []
    const column = { append: element => controls.push(element) }
    const html = {
      querySelectorAll: () => [...controls],
      querySelector: () => (withColumn ? column : null),
      append: element => controls.push(element)
    }
    vi.stubGlobal('document', {
      createElement: () => {
        const element = {
          dataset: {},
          classList: { add: vi.fn() },
          setAttribute: vi.fn(),
          addEventListener: (name, callback) => { element[name] = callback },
          append: vi.fn(),
          remove: () => controls.splice(controls.indexOf(element), 1)
        }
        return element
      }
    })
    return { html, controls }
  }

  test.each([true, false])('HUD resolves world actor through actorId, including legacy linked=%s, and keeps explicit target', async linked => {
    const { party, scene, make, otherGM } = await fixture()
    const token = make('1111111111111111', party.id, { actorLink: linked })
    token.actor = { id: party.id, flags: { dcc: {} }, isToken: true }
    scene.tokens.push(token, make('2222222222222222', party.id))
    party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
    canvas.tokens = { controlled: [] }
    game.user = otherGM
    const { html, controls } = hudElement()
    registerPartyTokenHooks()
    hooks.renderTokenHUD({ document: token }, html)
    hooks.renderTokenHUD({ document: token }, html)
    expect(controls).toHaveLength(1)
    expect(controls[0].dataset.action).toBe('partyTokenAction')
    expect(controls[0].classList.add).toHaveBeenCalledWith('control-icon')
    expect(controls[0].classList.add).not.toHaveBeenCalledWith('dcc-party-token')
    expect(controls[0].setAttribute).toHaveBeenCalledWith('aria-label', 'DCC.PartyTokenDeploy')
    await controls[0].click({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(game.socket.emit).toHaveBeenCalledTimes(1)
    expect(game.socket.emit.mock.calls[0][1].payload).toEqual({ action: 'deploy', partyId: party.id, sceneId: scene.id, partyTokenId: token.id })
  })

  test('missing right HUD column falls back to the HUD root and warns in the console only once', async () => {
    const { party, scene, make, otherGM } = await fixture()
    const token = make('1111111111111111', party.id, { actorLink: true })
    scene.tokens.push(token)
    canvas.tokens = { controlled: [] }
    game.user = otherGM
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { html, controls } = hudElement({ withColumn: false })
    registerPartyTokenHooks()
    hooks.renderTokenHUD({ document: token }, html)
    expect(controls).toHaveLength(1)
    expect(controls[0].dataset.action).toBe('partyTokenAction')
    expect(warn).toHaveBeenCalledTimes(1)
    hooks.renderTokenHUD({ document: token }, html)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(ui.notifications.warn).not.toHaveBeenCalled()
  })

  test('legacy HUD uses world snapshot state and reports Link Actor Data configuration without mutation', async () => {
    const { party, scene, make } = await fixture()
    const token = make('1111111111111111', party.id, { actorLink: false })
    const synthetic = { id: party.id, isToken: true, flags: { dcc: { partyTokenSnapshots: { poisoned: true } } } }
    token.actor = synthetic
    scene.tokens.push(token)
    const before = structuredClone(synthetic.flags)
    canvas.tokens = { controlled: [] }
    canvas.level = { id: 'ground' }
    const { html, controls } = hudElement()
    registerPartyTokenHooks()
    hooks.renderTokenHUD({ document: token }, html)
    expect(controls[0].setAttribute).toHaveBeenCalledWith('aria-label', 'DCC.PartyTokenGather')
    await controls[0].click({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(ui.notifications.warn).toHaveBeenCalledExactlyOnceWith('DCC.PartyTokenUnlinkedToken')
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    expect(party.setFlag).not.toHaveBeenCalled()
    expect(synthetic.flags).toEqual(before)
  })

  test('member HUD requires two eligible members; chooser cancel does not mutate, chosen gather freezes selection', async () => {
    const { party, scene, a, b, foreign, otherGM } = await fixture()
    const other = { ...party, id: 'other', name: 'Other' }
    game.actors.push(other)
    canvas.scene = scene
    canvas.level = { id: 'ground' }
    canvas.tokens = { controlled: [a] }
    const { html, controls } = hudElement()
    const wait = vi.fn(async () => null)
    foundry.applications = { api: { DialogV2: { wait } } }
    registerPartyTokenHooks()
    hooks.renderTokenHUD({ document: a }, html)
    expect(controls).toHaveLength(0)
    canvas.tokens.controlled = [a, b, foreign]
    hooks.renderTokenHUD({ document: foreign }, html)
    expect(controls).toHaveLength(0)
    hooks.renderTokenHUD({ document: a }, html)
    expect(controls).toHaveLength(1)
    await controls[0].click({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(wait).toHaveBeenCalledTimes(1)
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    game.user = otherGM
    wait.mockImplementationOnce(async () => {
      canvas.tokens.controlled = []
      canvas.scene = { id: 'changed' }
      canvas.level.id = 'changed'
      return party.id
    })
    await controls[0].click({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(game.socket.emit.mock.calls[0][1].payload).toEqual({ action: 'gather', partyId: party.id, sceneId: scene.id, levelId: 'ground', tokenIds: [a.id, b.id, foreign.id] })
  })

  test('non-GM HUD has no control', async () => {
    const { a, player } = await fixture()
    game.user = player
    const { html, controls } = hudElement()
    registerPartyTokenHooks()
    hooks.renderTokenHUD({ document: a }, html)
    expect(controls).toHaveLength(0)
  })
})

describe('serialized Party socket entry', () => {
  test.each(['authorization', 'validation', 'workflow'])('ignored socket event promise contains %s failures without unhandled rejection', async mode => {
    const { payload, scene, events } = await socketFixture()
    const socket = await import('../socket.mjs')
    const emitter = new EventEmitter()
    game.socket.on = emitter.on.bind(emitter)
    socket.registerSocket()
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      if (mode === 'workflow') scene.createEmbeddedDocuments.mockRejectedValueOnce(new Error('create'))
      // EventEmitter, like Socket.IO, ignores the async listener's return value.
      emitter.emit('system.dcc', { action: 'partyTokenAction', payload: mode === 'validation' ? {} : payload }, mode === 'authorization' ? 'unknown' : 'gm')
      await new Promise(resolve => setImmediate(resolve))
      expect(unhandled).not.toHaveBeenCalled()
      if (mode !== 'workflow') expect(events).toEqual([])
      expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
      // Failure completion must also release the lock for a fresh local request.
      await expect(service.requestPartyTokenAction(payload)).resolves.toMatchObject({ gathered: 1 })
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  test.each(['player', 'unknown', null])('rejects unauthenticated/non-GM sender %s despite forged payload userId', async sender => {
    const { payload, remote, events, gm } = await socketFixture()
    await expect(remote({ ...payload, userId: 'gm' }, sender)).resolves.toBeUndefined()
    game.users.splice(0, 1)
    await expect(service.requestPartyTokenAction(payload)).resolves.toEqual({ error: { code: 'unauthorized' } })
    game.users.unshift(gm)
    expect(events).toEqual([])
  })

  test('accepts another GM and filters forged foreign/departed selection and payload snapshots', async () => {
    const { payload, remote, party, scene, a, b, foreign } = await socketFixture()
    party.flags.dcc.partyMembers = [{ id: 'a' }]
    await expect(remote({ ...payload, tokenIds: [a.id, b.id, foreign.id], snapshot: {}, stats: { hp: 999 } }, 'other-gm')).resolves.toBeUndefined()
    expect(scene.tokens).toEqual(expect.arrayContaining([b, foreign]))
    expect(party.getFlag('dcc', 'partyTokenSnapshots').members.map(m => m.actorId)).toEqual(['a'])
  })

  test.each([
    null, { action: undefined }, { action: 'toggle' }, { partyId: '' }, { partyId: 1 }, { sceneId: null }, { sceneId: 'missing' },
    { levelId: undefined }, { levelId: 3 }, { levelId: 'deleted' }, { tokenIds: undefined }, { tokenIds: 'all' },
    { tokenIds: [null] }, { partyTokenId: {} }, { action: 'deploy', partyTokenId: undefined }
  ])('rejects malformed/unsupported input before any mutations: %j', async patch => {
    const { remote, payload, events } = await socketFixture()
    const invalid = patch === null ? null : { ...payload, ...patch }
    await expect(remote(invalid)).resolves.toBeUndefined()
    await expect(service.requestPartyTokenAction(invalid)).resolves.toHaveProperty('error.code')
    expect(events).toEqual([])
  })

  test.each(['missing', 'synthetic', 'pack', 'wrong-type'])('re-resolves the world Party (%s)', async mode => {
    const { remote, party, events } = await socketFixture()
    if (mode === 'missing') game.actors.splice(0, 1)
    if (mode === 'synthetic') party.isToken = true
    if (mode === 'pack') party.pack = 'compendium'
    if (mode === 'wrong-type') party.type = 'Player'
    await expect(remote()).resolves.toBeUndefined()
    await expect(service.requestPartyTokenAction({ action: 'gather', partyId: party.id, sceneId: 'scene', levelId: 'ground', tokenIds: [] })).resolves.toMatchObject({ error: { code: 'invalid-party' } })
    expect(events).toEqual([])
  })

  test('uses the explicit client scene/level, never the executing GM canvas', async () => {
    const { remote, scene, payload, b } = await socketFixture()
    canvas.scene = { id: 'elsewhere', tokens: [] }
    b.level = 'upper'
    await expect(service.requestPartyTokenAction({ ...payload, tokenIds: [payload.tokenIds[0], b.id] })).resolves.toMatchObject({ error: { code: 'invalid-gather-level' } })
    await expect(remote()).resolves.toBeUndefined()
    expect(scene.tokens.has(payload.tokenIds[0])).toBe(false)
    expect(scene.tokens.has(b.id)).toBe(true)
  })

  test('a missing selected ID never falls back to gathering the full roster', async () => {
    const { remote, payload, events } = await socketFixture()
    await expect(remote({ ...payload, tokenIds: ['deleted'] })).resolves.toBeUndefined()
    expect(events).toEqual([])
  })

  test('local active GM and remote Gather share the synchronous lock; repeated Gather never toggles Deploy', async () => {
    const { remote, payload, scene, party } = await socketFixture()
    const entered = deferred()
    const release = deferred()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => { entered.resolve(); await release.promise; return create(...args) })
    const first = service.requestPartyTokenAction(payload)
    await entered.promise
    await expect(remote({ ...payload, userId: 'gm' }, 'unknown')).resolves.toBeUndefined()
    await expect(remote()).resolves.toBeUndefined()
    await expect(remote({ ...payload, action: 'deploy', partyTokenId: 'new0000000000001' })).resolves.toBeUndefined()
    expect(scene.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
    release.resolve()
    await expect(first).resolves.toMatchObject({ gathered: 1 })
    await expect(service.requestPartyTokenAction(payload)).resolves.toMatchObject({ error: { code: 'snapshot-open' } })
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
  })

  test('Gather rollback holds the global lock even for a different Party', async () => {
    const { payload, scene, party } = await socketFixture()
    const other = { ...party, id: 'other', flags: { dcc: { partyMembers: [] } } }
    game.actors.push(other)
    const entered = deferred()
    const release = deferred()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      await remove(...args)
      throw new Error('delete callback')
    })
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(create).mockImplementationOnce(async (...args) => {
      entered.resolve()
      await release.promise
      return create(...args)
    })
    const first = service.requestPartyTokenAction(payload)
    const assertion = expect(first).resolves.toMatchObject({ error: { code: 'member-delete-failed', rollbackComplete: true } })
    await entered.promise
    await expect(service.requestPartyTokenAction({ ...payload, partyId: other.id })).resolves.toBeUndefined()
    expect(scene.createEmbeddedDocuments).toHaveBeenCalledTimes(2)
    release.resolve()
    await assertion
    await expect(service.requestPartyTokenAction({ ...payload, partyId: other.id })).resolves.toMatchObject({ gathered: 0 })
    await expect(service.requestPartyTokenAction(payload)).resolves.toMatchObject({ gathered: 1 })
  })

  test('overlapping Deploy B performs zero mutations and cannot restore A consumed snapshot', async () => {
    const { remote, payload, scene, party, partyToken } = await socketFixture(await deployWorkflowFixture())
    const entered = deferred()
    const release = deferred()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => { entered.resolve(); await release.promise; return create(...args) })
    const request = { ...payload, action: 'deploy', partyTokenId: partyToken.id }
    const first = remote(request)
    await entered.promise
    await expect(service.requestPartyTokenAction(request)).resolves.toBeUndefined()
    await expect(remote(payload)).resolves.toBeUndefined()
    expect(scene.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
    expect(party.setFlag).not.toHaveBeenCalled()
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled()
    release.resolve()
    await expect(first).resolves.toBeUndefined()
    await expect(service.requestPartyTokenAction(request)).resolves.toMatchObject({ error: { code: 'missing-snapshot' } })
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    expect(party.setFlag).not.toHaveBeenCalled()
    expect(scene.tokens.filter(t => ['a', 'b'].includes(t.actorId))).toHaveLength(2)
    expect(scene.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
  })

  test.each([false, true])('holds lock through awaited rollback and releases even when Party is blocked (%s)', async damaged => {
    const { remote, payload, scene, party } = await socketFixture(await deployWorkflowFixture())
    const entered = deferred()
    const release = deferred()
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      await remove(...args)
      throw new Error('delete callback')
    })
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(create).mockImplementationOnce(async (...args) => {
      entered.resolve()
      await release.promise
      return damaged ? [] : create(...args)
    })
    const request = { ...payload, action: 'deploy', partyTokenId: 'new0000000000001' }
    const first = service.requestPartyTokenAction(request)
    const assertion = expect(first).resolves.toMatchObject({ error: { code: 'party-delete-failed', rollbackComplete: !damaged } })
    await entered.promise
    const calls = scene.createEmbeddedDocuments.mock.calls.length
    await expect(remote(request)).resolves.toBeUndefined()
    expect(scene.createEmbeddedDocuments).toHaveBeenCalledTimes(calls)
    release.resolve()
    await assertion
    if (damaged) {
      await expect(service.requestPartyTokenAction(request)).resolves.toMatchObject({ error: { code: 'party-blocked' } })
      const other = { ...party, id: 'other', flags: { dcc: { partyMembers: [] } } }
      game.actors.push(other)
      await expect(service.requestPartyTokenAction({ ...payload, partyId: other.id })).resolves.toMatchObject({ gathered: 0 })
    } else await expect(service.requestPartyTokenAction(request)).resolves.toMatchObject({ deployed: 2 })
  })

  test.each(['legacy', 'foreign', 'wrong-scene'])('rejects an explicit invalid Deploy target (%s)', async mode => {
    const { remote, payload, scene, partyToken, foreign, events } = await socketFixture(await deployWorkflowFixture())
    if (mode === 'legacy') partyToken.actorLink = false
    if (mode === 'wrong-scene') scene.tokens.splice(scene.tokens.indexOf(partyToken), 1)
    const invalid = { ...payload, action: 'deploy', partyTokenId: mode === 'foreign' ? foreign.id : partyToken.id }
    await expect(remote(invalid)).resolves.toBeUndefined()
    await expect(service.requestPartyTokenAction(invalid)).resolves.toHaveProperty('error.code')
    expect(events).toEqual([])
  })

  test('remote request helper uses existing fire-and-forget executeAsGM and does not expose raw workflows', async () => {
    const { payload, otherGM } = await socketFixture()
    game.user = otherGM
    await expect(service.requestPartyTokenAction(payload)).resolves.toBeUndefined()
    expect(game.socket.emit).toHaveBeenCalledWith('system.dcc', { action: 'partyTokenAction', payload })
    expect(game.dcc?.gatherPartyTokens).toBeUndefined()
  })
})

function collection (documents) {
  return Object.assign(documents, { get: id => documents.find(document => document.id === id), has: id => documents.some(document => document.id === id) })
}

function gatherFixture () {
  const party = { id: 'party', type: 'Party', prototypeToken: { actorLink: true }, flags: { dcc: { partyMembers: [{ id: 'a' }, { id: 'b' }] } } }
  const scene = { id: 'scene', levels: collection([{ id: 'ground' }, { id: 'upper' }]) }
  const make = (id, actorId, extra = {}) => {
    const data = { _id: id, actorId, actorLink: true, level: 'ground', width: 1, height: 1, texture: { src: 'original.webp' }, flags: { custom: { preserved: true } }, ...extra }
    return { ...data, id, parent: scene, toObject: () => structuredClone(data) }
  }
  const a = make('aaaaaaaaaaaaaaaa', 'a')
  const b = make('bbbbbbbbbbbbbbbb', 'b')
  const foreign = make('ffffffffffffffff', 'foreign')
  const partyToken = make('pppppppppppppppp', party.id)
  scene.tokens = collection([a, b, foreign])
  game.actors = collection([party])
  game.combats = []
  game.scenes = collection([scene])
  return { party, scene, a, b, foreign, partyToken, make }
}

test.each([
  ['subset', ['a'], ['a']],
  ['no selection', [], ['a', 'b']],
  ['foreign only', ['foreign'], []],
  ['mixed selection', ['a', 'foreign'], ['a']]
])('resolves %s without changing foreign tokens', (label, selected, expected) => {
  const { party, scene, a, b, foreign } = gatherFixture()
  const tokens = { a, b, foreign }
  const selection = selected.map(id => ({ document: tokens[id] }))
  expect(service.resolveGatherTokens(party, scene, selection)).toEqual(expected.map(id => tokens[id]))
  expect(scene.tokens).toContain(foreign)
  expect(selection).toHaveLength(selected.length)
})

test('ignores unlinked members and tokens outside the explicit scene; sheet allows one but HUD needs two', () => {
  const { party, scene, a, b } = gatherFixture()
  b.actorLink = false
  expect(service.resolveGatherTokens(party, scene)).toEqual([a])
  expect(service.isGatherHudEligible(party, scene, [a])).toBe(false)
  b.actorLink = true
  expect(service.isGatherHudEligible(party, scene, [a, b])).toBe(true)
  expect(service.resolveGatherTokens(party, scene, [{ ...a, parent: { id: 'elsewhere' } }])).toEqual([])
})

test('returns ambiguous Party candidates instead of choosing one', () => {
  const { party, scene, a, foreign } = gatherFixture()
  const other = { ...party, id: 'other' }
  game.actors.push(other, { ...party, id: 'not-party', type: 'Player' })
  expect(service.findPartyCandidates(scene, [a])).toEqual([party, other])
  expect(service.findPartyCandidates(scene, [foreign])).toEqual([])
})

test.each([
  ['secondary running combat', 'scene', true, false, true],
  ['inactive tracker but running', 'scene', true, false, true],
  ['other scene', 'elsewhere', true, false, false],
  ['unstarted', 'scene', false, false, false],
  ['ended', 'scene', true, true, false],
  ['global combat', null, true, false, false]
])('protects exactly the explicit scene: %s', (label, sceneId, started, ended, expected) => {
  const { scene, a } = gatherFixture()
  game.combat = { combatants: [] }
  game.combats = [{ scene: sceneId && { id: sceneId }, started, ended, active: false, combatants: [{ tokenId: a.id }] }]
  expect(service.isTokenInRunningCombat(a, scene)).toBe(expected)
})

test('resolves eligible members against every running combat, not game.combat', () => {
  const { party, scene, a, b } = gatherFixture()
  game.combat = { scene, started: false, combatants: [{ tokenId: b.id }] }
  game.combats = [game.combat, { scene, started: true, combatants: [{ tokenId: a.id }] }]
  expect(service.resolveGatherTokens(party, scene)).toEqual([b])
  game.combats.push({ scene, started: true, combatants: [{ tokenId: b.id }] })
  expect(service.resolveGatherTokens(party, scene)).toEqual([])
})

test('snapshot preserves full token source including original IDs and refuses overwrite', () => {
  const { party, scene, a } = gatherFixture()
  const snapshot = service.createPartyTokenSnapshot(party, scene, [a])
  expect(snapshot).toEqual({ sceneId: scene.id, members: [{ actorId: 'a', tokenData: a.toObject() }] })
  expect(snapshot.members[0].tokenData._id).toBe(a.id)
  expect(snapshot.members[0].tokenData.flags.custom.preserved).toBe(true)
  expect(party.flags.dcc.partyTokenSnapshots).toBeUndefined()
  party.flags.dcc.partyTokenSnapshots = snapshot
  expect(() => service.createPartyTokenSnapshot(party, scene, [a])).toThrow('snapshot-open')
  expect(() => service.resolveGatherContext(party, scene, { levelId: 'ground' })).toThrow('snapshot-open')
})

test.each(['gather', 'deploy'])('%s rejects same-actor legacy unlinked tokens on any level', action => {
  const { party, scene, partyToken } = gatherFixture()
  party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
  if (action === 'gather') delete party.flags.dcc.partyTokenSnapshots
  const resolve = () => service[action === 'gather' ? 'resolveGatherContext' : 'resolveDeployContext'](party, scene, { levelId: 'ground', partyTokenId: partyToken.id })
  const legacy = { ...partyToken, id: 'legacy', actorLink: false, level: 'upper', actor: { id: 'synthetic' } }
  scene.tokens.push(legacy)
  expect(() => resolve()).toThrow('unlinked-party-token')
  scene.tokens.push(partyToken)
  expect(() => resolve()).toThrow('unlinked-party-token')
  legacy.actorId = 'other-party'
  expect(resolve().partyToken).toBe(partyToken)
  legacy.actorId = party.id
  scene.tokens.pop()
  scene.tokens.pop()
  game.scenes.push({ id: 'elsewhere', tokens: [legacy] })
  scene.tokens.push(partyToken)
  expect(resolve().partyToken).toBe(partyToken)
})

test.each(['gather', 'deploy'])('%s applies its target selection contract', action => {
  const { party, scene, partyToken } = gatherFixture()
  if (action === 'deploy') party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
  const resolve = options => service[action === 'gather' ? 'resolveGatherContext' : 'resolveDeployContext'](party, scene, { levelId: 'ground', ...options })
  scene.tokens.push(partyToken)
  if (action === 'gather') expect(resolve().partyToken).toBe(partyToken)
  else expect(() => resolve()).toThrow('missing-party-token-id')
  scene.tokens.push({ ...partyToken, id: 'duplicate' })
  expect(() => resolve()).toThrow(action === 'gather' ? 'ambiguous-party-token' : 'missing-party-token-id')
  expect(resolve({ partyTokenId: 'duplicate' }).partyToken.id).toBe('duplicate')
  expect(() => resolve({ partyTokenId: 'missing' })).toThrow('missing-party-token')
  game.combats = [{ scene, started: true, combatants: [{ tokenId: partyToken.id }] }]
  expect(() => resolve({ partyTokenId: partyToken.id })).toThrow('party-token-in-combat')
})

test('only new Party token creation requires a linked prototype', () => {
  const { party, scene, partyToken } = gatherFixture()
  party.prototypeToken.actorLink = false
  expect(() => service.resolveGatherContext(party, scene, { levelId: 'ground' })).toThrow('unlinked-party-prototype')
  scene.tokens.push(partyToken)
  expect(service.resolveGatherContext(party, scene, { levelId: 'ground' }).partyToken).toBe(partyToken)
})

test.each([
  ['missing caller level', undefined, 'ground', 'ground'],
  ['deleted caller level', 'deleted', 'ground', 'ground'],
  ['mixed member levels', 'ground', 'upper', 'ground'],
  ['different member level', 'upper', 'ground', 'upper'],
  ['deleted member level', 'ground', 'deleted', 'ground'],
  ['different Party level', 'ground', 'ground', 'upper']
])('gather rejects %s before mutation', (label, levelId, memberLevel, partyLevel) => {
  const { party, scene, b, partyToken } = gatherFixture()
  b.level = memberLevel
  partyToken.level = partyLevel
  scene.tokens.push(partyToken)
  expect(() => service.resolveGatherContext(party, scene, { levelId })).toThrow('invalid-gather-level')
  expect(scene.tokens).toHaveLength(4)
  expect(party.flags.dcc.partyTokenSnapshots).toBeUndefined()
})

test('explicit subset can gather on its level, with no selection all scene members are checked', () => {
  const { party, scene, a, b } = gatherFixture()
  b.level = 'upper'
  expect(service.resolveGatherContext(party, scene, { levelId: 'ground', selection: [a] }).tokens).toEqual([a])
  expect(() => service.resolveGatherContext(party, scene, { levelId: 'ground' })).toThrow('invalid-gather-level')
})

test.each(['departed', 'all-invalid'])('deploy checks ALL original IDs even when members are %s', state => {
  const { party, scene, a, b, partyToken } = gatherFixture()
  party.flags.dcc.partyMembers = []
  party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [a, b].map(t => ({ actorId: state, tokenData: t.toObject() })) }
  scene.tokens.splice(0, 1)
  scene.tokens.push(partyToken)
  expect(() => service.resolveDeployContext(party, scene)).toThrow('original-token-exists')
  scene.tokens.splice(scene.tokens.indexOf(b), 1)
  const destination = { id: 'destination', tokens: collection([partyToken]) }
  expect(service.resolveDeployContext(party, destination, { partyTokenId: partyToken.id }).sourceScene).toBe(scene)
})

test.each([undefined, '', 'invalid', 123, null])('deploy rejects invalid original ID %s', id => {
  const { party, scene, a, partyToken } = gatherFixture()
  party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [{ actorId: 'gone', tokenData: { ...a.toObject(), _id: id } }] }
  scene.tokens.push(partyToken)
  expect(() => service.resolveDeployContext(party, scene)).toThrow('invalid-snapshot-token-id')
})

test('deploy requires an existing snapshot source scene but does not block different token IDs', () => {
  const { party, scene, a, partyToken } = gatherFixture()
  scene.tokens.push(partyToken)
  expect(() => service.resolveDeployContext(party, scene)).toThrow('missing-snapshot')
  party.flags.dcc.partyTokenSnapshots = { sceneId: 'deleted', members: [{ actorId: 'a', tokenData: a.toObject() }] }
  expect(() => service.resolveDeployContext(party, scene)).toThrow('missing-source-scene')
  party.flags.dcc.partyTokenSnapshots.sceneId = scene.id
  scene.tokens.splice(0, 1)
  scene.tokens.push({ ...a, id: 'new-id' })
  expect(service.resolveDeployContext(party, scene, { partyTokenId: partyToken.id }).sourceScene).toBe(scene)
})

test.each(['gather', 'deploy'])('blocked Party prevents %s without implementing recovery', action => {
  const { party, scene } = gatherFixture()
  service.blockedPartyIds.add(party.id)
  expect(() => service[action === 'gather' ? 'resolveGatherContext' : 'resolveDeployContext'](party, scene, { levelId: 'ground' })).toThrow('party-blocked')
})

// Model the v14 document geometry contract; native snapping stays Foundry's job.
function placementFixture (type) {
  const grid = { size: 100, sizeX: 100, sizeY: 100, isHexagonal: type === 'hexagonal', isGridless: type === 'gridless' }
  grid.getSnappedPoint = vi.fn(({ x, y }) => {
    if (grid.isGridless) return { x, y }
    const step = grid.isHexagonal ? 75 : 100
    return { x: Math.round(x / step) * step, y: Math.round(y / 100) * 100 }
  })
  const scene = { grid }
  vi.stubGlobal('TokenDocument', class {
    constructor (data, { parent }) { Object.assign(this, data); this.parent = parent }
    getSize () { return { width: (this.width ?? 1) * this.parent.grid.sizeX, height: (this.height ?? 1) * this.parent.grid.sizeY } }
    getCenterPoint ({ x = 0, y = 0 } = {}) {
      const { width, height } = this.getSize()
      return { x: x + width / 2, y: y + height / 2 }
    }

    getSnappedPosition (position) { return this.parent.grid.getSnappedPoint(position) }
  })
  return scene
}

test.each([0, 1, 8, 24, 80, 17000])('square spiral returns %i unique center-free placements without ring gaps', async count => {
  const scene = await placementFixture('square')
  const members = Array.from({ length: count }, () => ({ width: 1, height: 1 }))
  const placements = service.computeDeployPlacements(scene, { x: 50, y: 50 }, members)
  expect(placements).toHaveLength(count)
  expect(new Set(placements.map(p => `${p.x},${p.y}`)).size).toBe(count)
  expect(placements).not.toContainEqual({ x: 0, y: 0 })
  if (count === 8) {
    expect(placements).toEqual([
      { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: -100, y: 100 },
      { x: -100, y: 0 }, { x: -100, y: -100 }, { x: 0, y: -100 }, { x: 100, y: -100 }
    ])
  }
  if (count === 24) expect(placements.every(p => Math.max(Math.abs(p.x), Math.abs(p.y)) <= 200)).toBe(true)
})

test.each(['square', 'hexagonal', 'gridless'])('placement delegates %s snapping to scene-parented TokenDocuments with enough spacing', type => {
  const scene = placementFixture(type)
  const members = [{ width: 3, height: 2 }, { width: 0.5, height: 1 }, { width: 1, height: 4 }, ...Array.from({ length: 24 }, () => ({ width: 1, height: 1 }))]
  const before = structuredClone(members)
  const center = { x: 237, y: 319 }
  const placements = service.computeDeployPlacements(scene, center, members)
  expect(placements).toEqual(service.computeDeployPlacements(scene, center, members))
  expect(scene.grid.getSnappedPoint).toHaveBeenCalled()
  expect(members).toEqual(before)
  for (const [i, position] of placements.entries()) {
    expect(position).toEqual(scene.grid.getSnappedPoint(position))
    const rect = { ...position, w: members[i].width * 100, h: members[i].height * 100 }
    expect(center.x < rect.x || center.x > rect.x + rect.w || center.y < rect.y || center.y > rect.y + rect.h).toBe(true)
    for (let j = 0; j < i; j++) {
      const other = placements[j]
      expect(rect.x >= other.x + members[j].width * 100 || other.x >= rect.x + rect.w || rect.y >= other.y + members[j].height * 100 || other.y >= rect.y + rect.h).toBe(true)
    }
  }
})
