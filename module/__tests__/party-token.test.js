/* global CONFIG, game, TokenDocument, canvas, Hooks */
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { isDeepStrictEqual } from 'node:util'

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
  vi.stubGlobal('foundry', { utils: { equals: isDeepStrictEqual } })
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
  scene.createEmbeddedDocuments = vi.fn(async (type, data, options = {}) => {
    expect(type).toBe('Token')
    events.push(options.keepId ? 'restore' : 'create')
    const documents = data.map(source => make(options.keepId ? source._id : `new${String(++nextId).padStart(13, '0')}`, source.actorId, source))
    for (const document of documents) document.getCenterPoint = () => new TokenDocument(document.toObject(), { parent: scene }).getCenterPoint(document)
    scene.tokens.push(...documents)
    return documents
  })
  scene.deleteEmbeddedDocuments = vi.fn(async (type, ids) => {
    expect(type).toBe('Token')
    events.push(ids.includes(a.id) ? 'delete-members' : 'delete-party')
    const removed = scene.tokens.filter(document => ids.includes(document.id))
    for (const document of removed) scene.tokens.splice(scene.tokens.indexOf(document), 1)
    return removed
  })
  const gather = (options = {}) => service.gatherPartyTokens({ party, scene, levelId: 'ground', ...options })
  return { ...fixture, events, gather }
}

describe('gather workflow', () => {
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

  test.each(['throw', 'empty', 'silent', 'partial', 'not-in-scene', 'unlinked'])('unconfirmed new Party (%s) never deletes members and rolls back its own additions', async mode => {
    const { party, scene, a, b, gather, events } = gatherWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      if (mode === 'throw') throw new Error('create')
      if (mode === 'silent') return []
      const documents = await create(...args)
      if (mode === 'empty') return []
      if (mode === 'partial') return [documents[0], documents[0]]
      if (mode === 'not-in-scene') scene.tokens.splice(scene.tokens.indexOf(documents[0]), 1)
      if (mode === 'unlinked') documents[0].actorLink = false
      return documents
    })
    await expect(gather()).rejects.toMatchObject({ code: 'party-create-failed' })
    expect(scene.tokens).toEqual(expect.arrayContaining([a, b]))
    expect(scene.tokens.filter(t => t.actorId === party.id)).toHaveLength(0)
    expect(events).not.toContain('delete-members')
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
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

  test('a create that persists then throws removes only its new replacement, leaving originals intact', async () => {
    const { party, scene, a, b, gather } = gatherWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => { await create(...args); throw new Error('after-create') })
    await expect(gather()).rejects.toMatchObject({ code: 'party-create-failed', rollbackComplete: true })
    expect(scene.tokens).toEqual(expect.arrayContaining([a, b]))
    expect(scene.tokens.some(t => t.actorId === party.id)).toBe(false)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
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
})

afterEach(() => vi.unstubAllGlobals())

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

test.each(['gather', 'deploy'])('%s requires unique or explicitly selected Party token', action => {
  const { party, scene, partyToken } = gatherFixture()
  if (action === 'deploy') party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
  const resolve = options => service[action === 'gather' ? 'resolveGatherContext' : 'resolveDeployContext'](party, scene, { levelId: 'ground', ...options })
  scene.tokens.push(partyToken)
  expect(resolve().partyToken).toBe(partyToken)
  scene.tokens.push({ ...partyToken, id: 'duplicate' })
  expect(() => resolve()).toThrow('ambiguous-party-token')
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
  expect(service.resolveDeployContext(party, destination).sourceScene).toBe(scene)
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
  expect(service.resolveDeployContext(party, scene).sourceScene).toBe(scene)
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
