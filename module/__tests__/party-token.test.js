/* global game, TokenDocument, canvas, ui */
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
  vi.stubGlobal('game', { model: { Actor: { Party: {} } }, user: { isGM: false } })
  vi.stubGlobal('CONFIG', { Actor: { dataModels: {}, trackableAttributes: {} } })
  vi.stubGlobal('TokenDocument', { getTrackedAttributes: vi.fn(() => ({ bar: [], value: [] })) })
  vi.stubGlobal('canvas', { scene: { tokens: [] }, hud: { token: { object: null, render: vi.fn() } } })
  vi.stubGlobal('ui', {})
  service = await import('../party-token.mjs')
  ;({ registerPartyTokenHooks } = service)
})

afterEach(() => vi.unstubAllGlobals())

function collection (documents) {
  return Object.assign(documents, { get: id => documents.find(document => document.id === id), has: id => documents.some(document => document.id === id) })
}

const levels = () => collection([
  { id: 'ground', elevation: { bottom: 0, top: 10, base: 0 } },
  { id: 'upper', elevation: { bottom: 10, top: 20, base: 10 } }
])

// Persistent-document fixture: operations can reject, abort silently or apply only
// part of a batch. Assertions inspect stored documents, not just API return values.
function gatherFixture (events = []) {
  const party = { id: 'party', type: 'Party', name: 'Party', prototypeToken: { actorLink: true }, flags: { dcc: { partyMembers: [{ id: 'a' }, { id: 'b' }] } } }
  const scene = { id: 'scene', levels: levels() }
  const make = (id, actorId, extra = {}) => {
    const data = { _id: id, actorId, actorLink: true, level: 'ground', x: 0, y: 0, width: 1, height: 1, hidden: false, texture: { src: 'original.webp' }, flags: { custom: { preserved: true } }, ...extra }
    const token = {
      ...data,
      id,
      parent: scene,
      toObject: () => structuredClone(data),
      getCenterPoint: options => new TokenDocument(data, { parent: scene }).getCenterPoint(options),
      getSnappedPosition: position => new TokenDocument(data, { parent: scene }).getSnappedPosition(position),
      move: vi.fn(async waypoint => {
        events.push(actorId === party.id ? 'party-move' : 'member-move')
        // TokenDocument.x/y are integer fields: Foundry rounds them on save.
        const rounded = { x: Math.round(waypoint.x), y: Math.round(waypoint.y) }
        if (waypoint.elevation !== undefined) rounded.elevation = waypoint.elevation
        Object.assign(data, rounded)
        Object.assign(token, rounded)
        return true
      }),
      update: vi.fn(async changes => {
        events.push(actorId === party.id ? 'party-update' : 'member-update')
        Object.assign(data, changes)
        Object.assign(token, changes)
      })
    }
    return token
  }
  const a = make('aaaaaaaaaaaaaaaa', 'a')
  const b = make('bbbbbbbbbbbbbbbb', 'b')
  const foreign = make('ffffffffffffffff', 'foreign')
  const partyToken = make('pppppppppppppppp', party.id)
  scene.tokens = collection([a, b, foreign])
  game.actors = collection([party])
  game.combats = []
  game.scenes = collection([scene])
  return { party, scene, a, b, foreign, partyToken, make, levels: scene.levels }
}

function gatherWorkflowFixture () {
  const events = []
  const fixture = gatherFixture(events)
  const { party, scene, make, a, b } = fixture
  // The raw workflows are GM-only; the socket/UI path already authorizes callers.
  game.user = { id: 'gm', isGM: true }
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
  test('saves full sources before creating the Party and deletes exactly the selected roster subset', async () => {
    const { party, scene, a, b, foreign, gather, events } = gatherWorkflowFixture()
    const expected = a.toObject()
    const result = await gather({ tokenIds: [a.id, foreign.id] })
    expect(events).toEqual(['snapshot', 'create', 'delete-members'])
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual({ sceneId: scene.id, members: [{ actorId: 'a', tokenData: expected }] })
    expect(party.getTokenDocument).toHaveBeenCalledWith({ x: 100, y: 150, level: 'ground' }, { parent: scene })
    expect(scene.createEmbeddedDocuments.mock.calls[0][1][0]).toMatchObject({ x: 100, y: 100, level: 'ground', hidden: false })
    expect(scene.tokens.has(a.id)).toBe(false)
    expect(scene.tokens).toEqual(expect.arrayContaining([b, foreign]))
    expect(result).toMatchObject({ gathered: 1, partyTokenId: 'new0000000000001', skippedCombatTokenIds: [] })
  })

  test.each(['foreign', 'missing', 'combat'])('gather with no eligible member (%s) makes no changes', async state => {
    const { scene, a, foreign, gather, events } = gatherWorkflowFixture()
    if (state === 'combat') game.combats = [{ started: true, combatants: [{ tokenId: a.id, sceneId: scene.id }] }]
    const id = state === 'foreign' ? foreign.id : state === 'missing' ? 'missing' : a.id
    const result = await gather({ tokenIds: [id] })
    expect(result).toEqual({ gathered: 0, skippedCombatTokenIds: state === 'combat' ? [a.id] : [] })
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

  test('failed member deletion restores originals with their IDs, removes the new Party and clears the snapshot', async () => {
    const { party, scene, a, b, gather, events } = gatherWorkflowFixture()
    const originals = [a.toObject(), b.toObject()]
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => { await remove(...args); throw new Error('after-delete') })
    await expect(gather()).rejects.toMatchObject({ code: 'member-delete-failed', rollbackComplete: true })
    for (const data of originals) {
      expect(scene.tokens.filter(token => token.id === data._id)).toHaveLength(1)
      expect(scene.tokens.get(data._id).toObject()).toEqual(data)
    }
    expect(events.indexOf('restore')).toBeLessThan(events.indexOf('delete-party'))
    expect(scene.tokens.filter(token => token.actorId === party.id)).toHaveLength(0)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    await expect(gather()).resolves.toMatchObject({ gathered: 2 })
  })

  test('reuses the existing anchor, moving it to the cluster centre and showing it', async () => {
    const { party, scene, partyToken, gather } = gatherWorkflowFixture()
    await partyToken.update({ x: 700, y: 800, hidden: true })
    const before = partyToken.toObject()
    scene.tokens.push(partyToken)
    partyToken.move.mockClear()
    partyToken.update.mockClear()
    await expect(gather()).resolves.toMatchObject({ gathered: 2, partyTokenId: partyToken.id })
    expect(party.getTokenDocument).not.toHaveBeenCalled()
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(partyToken.move).toHaveBeenCalledExactlyOnceWith({ x: 200, y: 100, action: 'displace', snapped: true })
    expect(partyToken.update).toHaveBeenCalledExactlyOnceWith({ hidden: false })
    expect(partyToken.toObject()).toEqual({ ...before, x: 200, y: 100, hidden: false })
  })

  test('places a fresh anchor on the target level base elevation', async () => {
    const { scene, a, b, gather } = gatherWorkflowFixture()
    a.level = 'upper'
    b.level = 'upper'
    const result = await gather({ levelId: 'upper' })
    const anchor = scene.tokens.get(result.partyTokenId)
    expect(anchor.level).toBe('upper')
    expect(anchor.elevation).toBe(10)
  })

  test('keeps the reused anchor elevation when gathering', async () => {
    const { scene, partyToken, gather } = gatherWorkflowFixture()
    await partyToken.update({ elevation: 17 })
    scene.tokens.push(partyToken)
    partyToken.move.mockClear()
    await expect(gather()).resolves.toMatchObject({ gathered: 2 })
    expect(partyToken.move).toHaveBeenCalledWith({ x: 200, y: 100, action: 'displace', snapped: true })
    expect(partyToken.elevation).toBe(17)
  })

  test('restores the reused anchor position and elevation after a failed gather', async () => {
    const { party, scene, partyToken, gather } = gatherWorkflowFixture()
    await partyToken.update({ x: 700, y: 800, hidden: true, elevation: 17 })
    scene.tokens.push(partyToken)
    const remove = scene.deleteEmbeddedDocuments.getMockImplementation()
    scene.deleteEmbeddedDocuments.mockImplementationOnce(async (...args) => { await remove(...args); throw new Error('after-delete') })
    await expect(gather()).rejects.toMatchObject({ code: 'member-delete-failed', rollbackComplete: true })
    const anchor = scene.tokens.get(partyToken.id)
    expect(anchor.x).toBe(700)
    expect(anchor.y).toBe(800)
    expect(anchor.elevation).toBe(17)
    expect(anchor.hidden).toBe(true)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
  })

  test('retains an unattributed same-actor creation and blocks until inspection', async () => {
    const { party, scene, make, gather } = gatherWorkflowFixture()
    const external = make('eeeeeeeeeeeeeeee', party.id)
    scene.createEmbeddedDocuments.mockImplementationOnce(async () => { scene.tokens.push(external); return [] })
    await expect(gather()).rejects.toMatchObject({ code: 'party-create-failed', rollbackComplete: false })
    expect(scene.tokens.get(external.id)).toBe(external)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeDefined()
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
  })
})

async function deployWorkflowFixture () {
  const fixture = gatherWorkflowFixture()
  const { party, scene } = fixture
  game.actors.push({ id: 'a' }, { id: 'b' })
  const gathered = await fixture.gather()
  const partyToken = scene.tokens.get(gathered.partyTokenId)
  const snapshot = structuredClone(party.getFlag('dcc', 'partyTokenSnapshots'))
  fixture.events.length = 0
  scene.createEmbeddedDocuments.mockClear()
  scene.deleteEmbeddedDocuments.mockClear()
  partyToken.move.mockClear()
  partyToken.update.mockClear()
  party.setFlag.mockClear()
  party.unsetFlag.mockClear()
  const deploy = (options = {}) => service.deployPartyTokens({ party, scene, partyTokenId: partyToken.id, ...options })
  return { ...fixture, partyToken, snapshot, deploy }
}

describe('snapshot deploy workflow', () => {
  test('places level-correct payloads with fresh IDs, hides the marker and clears the flag', async () => {
    const { party, scene, partyToken, snapshot, deploy, events, foreign } = await deployWorkflowFixture()
    partyToken.level = 'upper'
    const source = partyToken.toObject
    partyToken.toObject = () => ({ ...source(), level: 'upper' })
    const result = await deploy()
    expect(result).toEqual({ deployed: 2, skippedMemberIds: [] })
    // Elevation is absolute: source-level heights are replaced by the target base.
    const payloads = snapshot.members.map(member => ({ ...member.tokenData, level: 'upper', elevation: 10 }))
    const placements = service.computeDeployPlacements(scene, partyToken.getCenterPoint(), payloads)
    const created = scene.tokens.filter(token => ['a', 'b'].includes(token.actorId))
    expect(created).toHaveLength(2)
    for (const token of created) {
      const i = snapshot.members.findIndex(member => member.actorId === token.actorId)
      expect(token.id).not.toBe(snapshot.members[i].tokenData._id)
      expect(token.toObject()).toEqual({ ...payloads[i], ...placements[i], _id: token.id })
    }
    expect(events).toEqual(['create', 'party-update', 'clear'])
    expect(scene.tokens.get(foreign.id)).toBe(foreign)
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
    expect(partyToken.hidden).toBe(true)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    // Without a snapshot the prototype path needs a scene free of member tokens.
    await expect(deploy()).rejects.toMatchObject({ code: 'member-tokens-present' })
  })

  test('keeps saved elevation when deploying on the same level', async () => {
    const { scene, snapshot, deploy } = await deployWorkflowFixture()
    await expect(deploy()).resolves.toMatchObject({ deployed: 2 })
    for (const member of snapshot.members) {
      const created = scene.tokens.filter(token => token.actorId === member.actorId)
      expect(created).toHaveLength(1)
      expect(created[0].elevation).toBe(member.tokenData.elevation)
    }
  })

  test('rejects a missing snapshot in the snapshot preflight', async () => {
    const { party, scene, partyToken } = await deployWorkflowFixture()
    delete party.flags.dcc.partyTokenSnapshots
    expect(() => service.resolveDeployContext(party, scene, { partyTokenId: partyToken.id })).toThrow('missing-snapshot')
  })

  test.each([
    ['original present', 'original-token-exists', ({ scene, a }) => scene.tokens.push(a)],
    ['member already present', 'member-token-already-present', ({ scene, make }) => scene.tokens.push(make('eeeeeeeeeeeeeeee', 'a'))],
    ['invalid level', 'invalid-deploy-level', ({ scene }) => scene.levels.splice(0, 1)],
    ['invalid snapshot', 'invalid-snapshot-token-id', ({ party }) => { party.flags.dcc.partyTokenSnapshots.members[0].tokenData._id = 'invalid' }]
  ])('guards %s before mutations', async (label, code, arrange) => {
    const fixture = await deployWorkflowFixture()
    const { party, scene, events, deploy } = fixture
    arrange(fixture)
    await expect(deploy()).rejects.toMatchObject({ code })
    expect(events).toEqual([])
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(party.unsetFlag).not.toHaveBeenCalled()
  })

  test('skips a deleted rosters actor and reports skippedMemberIds', async () => {
    const { scene, deploy } = await deployWorkflowFixture()
    game.actors.splice(game.actors.findIndex(actor => actor.id === 'a'), 1)
    await expect(deploy()).resolves.toEqual({ deployed: 1, skippedMemberIds: ['a'] })
    expect(scene.tokens.filter(token => token.actorId === 'a')).toHaveLength(0)
    expect(scene.tokens.filter(token => token.actorId === 'b')).toHaveLength(1)
  })

  test('a partial member creation removes its own tokens, restores the marker and keeps the snapshot', async () => {
    const { party, scene, partyToken, snapshot, deploy } = await deployWorkflowFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (type, data, options) => create(type, data.slice(0, 1), options))
    await expect(deploy()).rejects.toMatchObject({ code: 'member-create-failed', rollbackComplete: true })
    expect(scene.tokens.filter(token => ['a', 'b'].includes(token.actorId))).toHaveLength(0)
    expect(partyToken.hidden).toBe(false)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
    await expect(deploy()).resolves.toMatchObject({ deployed: 2 })
  })

  test('a failed marker hide keeps the marker visible and rolls back the members', async () => {
    const { party, scene, partyToken, snapshot, deploy } = await deployWorkflowFixture()
    partyToken.update.mockRejectedValueOnce(new Error('hide'))
    await expect(deploy()).rejects.toMatchObject({ code: 'party-hide-failed', rollbackComplete: true })
    expect(partyToken.hidden).toBe(false)
    expect(scene.tokens.filter(token => ['a', 'b'].includes(token.actorId))).toHaveLength(0)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
  })

  test('a failed snapshot clear retains the snapshot after the marker and members are restored', async () => {
    const { party, scene, partyToken, snapshot, deploy } = await deployWorkflowFixture()
    party.unsetFlag.mockResolvedValueOnce(party)
    await expect(deploy()).rejects.toMatchObject({ code: 'snapshot-clear-failed', rollbackComplete: true })
    expect(partyToken.hidden).toBe(false)
    expect(scene.tokens.filter(token => ['a', 'b'].includes(token.actorId))).toHaveLength(0)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
  })

  test('an uncertain creation is retained and blocks the Party until manual inspection', async () => {
    const { party, scene, make, snapshot, deploy } = await deployWorkflowFixture()
    const external = make('eeeeeeeeeeeeeeee', 'a')
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      await create(...args)
      scene.tokens.push(external)
      throw new Error('uncertain-create')
    })
    await expect(deploy()).rejects.toMatchObject({ code: 'member-create-failed', rollbackComplete: false })
    expect(scene.tokens.get(external.id)).toBe(external)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toEqual(snapshot)
    expect(service.blockedPartyIds.has(party.id)).toBe(true)
    await expect(deploy()).rejects.toMatchObject({ code: 'party-blocked' })
  })
})

function prototypeDeployFixture ({ unlinked = [] } = {}) {
  const fixture = gatherWorkflowFixture()
  const { party, scene, partyToken, events } = fixture
  game.user = { id: 'gm', isGM: true }
  scene.tokens.splice(0)
  scene.tokens.push(partyToken)
  const actors = new Map()
  for (const { id } of party.flags.dcc.partyMembers) {
    const prototypeToken = { actorLink: !unlinked.includes(id), width: 2, height: 1, elevation: 7, hidden: false, texture: { src: `prototype-${id}.webp` }, sight: { enabled: true, range: 30 }, light: { bright: 10 }, flags: { dcc: { prototype: id } } }
    const actor = {
      id,
      type: 'Player',
      prototypeToken,
      getTokenDocument: vi.fn(async (position = {}, { parent } = {}) => {
        expect(parent).toBe(scene)
        const data = { actorId: id, ...structuredClone(prototypeToken), ...position }
        return { actorId: id, actorLink: data.actorLink, toObject: () => structuredClone(data) }
      })
    }
    actors.set(id, actor)
    game.actors.push(actor)
  }
  const deploy = (options = {}) => service.deployPartyTokens({ party, scene, partyTokenId: partyToken.id, ...options })
  events.length = 0
  scene.createEmbeddedDocuments.mockClear()
  scene.deleteEmbeddedDocuments.mockClear()
  partyToken.update.mockClear()
  return { ...fixture, actors, deploy }
}

function prototypePayload (actor, { x, y, index }) {
  return {
    ...structuredClone(actor.prototypeToken),
    actorId: actor.id,
    level: 'ground',
    // Prototype elevation is always the target level's base.
    elevation: 0,
    x,
    y,
    _id: `generated${String(index).padStart(7, '0')}`
  }
}

describe('prototype deploy workflow', () => {
  test('creates one prototype token per member around the anchor and hides it', async () => {
    const { party, scene, partyToken, actors, deploy, events } = prototypeDeployFixture()
    await expect(deploy()).resolves.toEqual({ deployed: 2, skippedMemberIds: [], skippedOnSceneIds: [] })
    const created = scene.tokens.filter(token => ['a', 'b'].includes(token.actorId))
    expect(created.map(token => token.toObject())).toEqual([
      prototypePayload(actors.get('a'), { x: 200, y: 0, index: 1 }),
      prototypePayload(actors.get('b'), { x: 200, y: 100, index: 2 })
    ])
    expect(scene.tokens.get(partyToken.id)).toBe(partyToken)
    expect(partyToken.hidden).toBe(true)
    expect(party.getFlag('dcc', 'partyTokenSnapshots')).toBeUndefined()
    expect(party.setFlag).not.toHaveBeenCalled()
    expect(events).toEqual(['create', 'party-update'])
  })

  test('deploying nothing returns the skip result without hiding the marker', async () => {
    const { party, scene, partyToken, deploy } = prototypeDeployFixture()
    party.flags.dcc.partyMembers = []
    scene.tokens.splice(0)
    scene.tokens.push(partyToken)
    await expect(deploy()).resolves.toEqual({ deployed: 0, skippedMemberIds: [], skippedOnSceneIds: [] })
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(partyToken.hidden).toBe(false)
  })

  test('splits deleted actors from members already on the scene', async () => {
    const { party, scene, make, deploy } = prototypeDeployFixture()
    party.flags.dcc.partyMembers.push({ id: 'c' })
    const prototypeToken = { actorLink: true, width: 1, height: 1, elevation: 7, hidden: false, texture: { src: 'prototype-c.webp' }, flags: { dcc: { prototype: 'c' } } }
    game.actors.push({ id: 'c', prototypeToken, getTokenDocument: vi.fn(async () => ({ actorId: 'c', actorLink: true, toObject: () => ({ actorId: 'c', ...prototypeToken }) })) })
    game.actors.splice(game.actors.findIndex(actor => actor.id === 'b'), 1)
    scene.tokens.push(make('aaaaaaaaaaaaaaaa', 'a', { actorLink: false }))
    await expect(deploy()).resolves.toEqual({ deployed: 1, skippedMemberIds: ['b'], skippedOnSceneIds: ['a'] })
    expect(scene.tokens.filter(token => token.actorId === 'c')).toHaveLength(1)
  })

  test('an unlinked member prototype aborts before any creation', async () => {
    const { party, scene, partyToken, deploy, actors, events } = prototypeDeployFixture({ unlinked: ['b'] })
    await expect(deploy()).rejects.toMatchObject({ code: 'unlinked-member-prototype' })
    expect(events).toEqual([])
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(partyToken.hidden).toBe(false)
    expect(actors.get('b').getTokenDocument).not.toHaveBeenCalled()
    expect(service.blockedPartyIds.has(party.id)).toBe(false)
  })

  test('a partial prototype creation rolls back its own tokens and keeps the marker visible', async () => {
    const { party, scene, partyToken, deploy } = prototypeDeployFixture()
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (type, data, options) => create(type, data.slice(0, 1), options))
    await expect(deploy()).rejects.toMatchObject({ code: 'member-create-failed', rollbackComplete: true })
    expect(scene.tokens.filter(token => ['a', 'b'].includes(token.actorId))).toHaveLength(0)
    expect(partyToken.hidden).toBe(false)
    expect(service.blockedPartyIds.has(party.id)).toBe(false)
    await expect(deploy()).resolves.toMatchObject({ deployed: 2 })
  })

  test('a failed marker hide rolls back the created members and keeps the anchor visible', async () => {
    const { scene, partyToken, deploy } = prototypeDeployFixture()
    partyToken.update.mockRejectedValueOnce(new Error('hide'))
    await expect(deploy()).rejects.toMatchObject({ code: 'party-hide-failed', rollbackComplete: true })
    expect(scene.tokens.filter(token => ['a', 'b'].includes(token.actorId))).toHaveLength(0)
    expect(partyToken.hidden).toBe(false)
    await expect(deploy()).resolves.toMatchObject({ deployed: 2 })
  })

  test('refuses the prototype path while eligible member tokens stand on the scene', async () => {
    const { party, scene, partyToken, make, deploy } = prototypeDeployFixture()
    const existing = make('aaaaaaaaaaaaaaaa', 'a')
    scene.tokens.push(existing)
    expect(() => service.resolvePrototypeDeployContext(party, scene, { partyTokenId: partyToken.id })).toThrow('member-tokens-present')
    await expect(deploy()).rejects.toMatchObject({ code: 'member-tokens-present' })
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
    expect(partyToken.hidden).toBe(false)
  })
})

describe('action derivation and geometry', () => {
  test('derives gather for any member token, even unlinked or in combat', () => {
    const { party, scene, a, b } = gatherFixture()
    game.combats = [{ started: true, combatants: [{ tokenId: a.id, sceneId: scene.id }] }]
    expect(service.derivePartyTokenAction(party, scene)).toBe('gather')
    scene.tokens.splice(0)
    scene.tokens.push({ ...a, actorLink: false }, { ...b, actorLink: false })
    expect(service.derivePartyTokenAction(party, scene)).toBe('gather')
  })

  test('derives deploy for a lone party token or an open snapshot, otherwise null', () => {
    const { party, scene, foreign, partyToken } = gatherFixture()
    scene.tokens.splice(0)
    scene.tokens.push(foreign)
    expect(service.derivePartyTokenAction(party, scene)).toBe(null)
    scene.tokens.push(partyToken)
    expect(service.derivePartyTokenAction(party, scene)).toBe('deploy')
    party.flags.dcc.partyTokenSnapshots = { sceneId: scene.id, members: [] }
    scene.tokens.splice(0)
    expect(service.derivePartyTokenAction(party, scene)).toBe('deploy')
  })

  test('matches only started combats attached to the scene', () => {
    const { scene, a } = gatherFixture()
    const check = combat => { game.combats = [combat]; return service.isTokenInRunningCombat(a, scene) }
    expect(check({ started: true, scene: null, combatants: [{ tokenId: a.id, sceneId: scene.id }] })).toBe(true)
    expect(check({ started: true, scene: { id: scene.id }, combatants: [{ tokenId: a.id }] })).toBe(true)
    expect(check({ started: true, scene: { id: 'other' }, combatants: [{ tokenId: a.id }] })).toBe(false)
    expect(check({ started: false, combatants: [{ tokenId: a.id, sceneId: scene.id }] })).toBe(false)
  })

  test.each(['square', 'hexagonal', 'gridless'])('computeDeployPlacements delegates %s snapping and keeps cells unique', type => {
    const scene = placementFixture(type)
    const members = [{ width: 2, height: 1 }, { width: 1, height: 2 }, { width: 1, height: 1 }]
    const before = structuredClone(members)
    const placements = service.computeDeployPlacements(scene, { x: 500, y: 400 }, members)
    expect(placements).toHaveLength(3)
    expect(new Set(placements.map(p => `${p.x},${p.y}`)).size).toBe(3)
    for (const position of placements) {
      expect(Number.isInteger(position.x)).toBe(true)
      expect(Number.isInteger(position.y)).toBe(true)
    }
    expect(scene.grid.getSnappedPoint).toHaveBeenCalled()
    expect(members).toEqual(before)
  })
})

describe('legacy roster flag', () => {
  test('a non-array roster reads as empty for gather and action derivation', () => {
    const { party, scene, partyToken } = gatherFixture()
    party.flags.dcc.partyMembers = {}
    expect(service.resolveGatherTokens(party, scene)).toEqual([])
    expect(service.derivePartyTokenAction(party, scene)).toBe(null)
    scene.tokens.push(partyToken)
    expect(service.derivePartyTokenAction(party, scene)).toBe('deploy')
  })

  test('the updateActor hook ignores a non-array roster', () => {
    const { party, scene } = gatherFixture()
    party.flags.dcc.partyMembers = {}
    scene.tokens.splice(0)
    scene.tokens.push({ actor: party })
    canvas.scene = scene
    registerPartyTokenHooks()
    expect(() => hooks.updateActor({ id: 'some-member' })).not.toThrow()
  })
})

function placementFixture (type) {
  const sizeY = type === 'hexagonal' ? 100 * 2 / Math.sqrt(3) : 100
  const grid = { size: 100, sizeX: 100, sizeY, distance: 5, isHexagonal: type === 'hexagonal', isGridless: type === 'gridless' }
  grid.getSnappedPoint = vi.fn(({ x, y }) => {
    if (grid.isGridless) return { x, y }
    const step = grid.isHexagonal ? 75 : 100
    return { x: Math.round(x / step) * step, y: Math.round(y / grid.sizeY) * grid.sizeY }
  })
  const scene = { grid }
  vi.stubGlobal('TokenDocument', class {
    constructor (data, { parent }) { Object.assign(this, data); this.parent = parent; this.elevation ??= 0 }
    getSize () { return { width: (this.width ?? 1) * this.parent.grid.sizeX, height: (this.height ?? 1) * this.parent.grid.sizeY } }
    getCenterPoint ({ x = 0, y = 0 } = {}) {
      const { width, height } = this.getSize()
      return { x: x + width / 2, y: y + height / 2 }
    }

    getSnappedPosition (position) {
      const { grid } = this.parent
      return { ...grid.getSnappedPoint(position), elevation: grid.isGridless ? this.elevation : Math.round(this.elevation / grid.distance) * grid.distance }
    }
  })
  return scene
}

async function socketFixture (fixture = gatherWorkflowFixture()) {
  const gm = { id: 'gm', isGM: true }
  const otherGM = { id: 'other-gm', isGM: true }
  const player = { id: 'player', isGM: false }
  game.user = gm
  game.users = collection([gm, otherGM, player])
  game.users.activeGM = gm
  game.socket = { emit: vi.fn() }
  game.i18n = { localize: key => key, format: (key, values) => `${key}:${JSON.stringify(values)}` }
  vi.stubGlobal('ui', { notifications: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } })
  service.registerPartyTokenSocket()
  const socket = await import('../socket.mjs')
  const payload = { action: 'gather', partyId: fixture.party.id, sceneId: fixture.scene.id, levelId: 'ground', tokenIds: [fixture.a.id] }
  const remote = (data = payload, sender = gm.id) => socket.onSocketMessage({ action: 'partyTokenAction', payload: data }, sender)
  return { ...fixture, gm, otherGM, player, payload, remote }
}

async function uiFixture (fixture) {
  const data = await socketFixture(fixture)
  game.i18n = { localize: key => key, format: (key, values) => `${key}:${JSON.stringify(values)}` }
  vi.stubGlobal('ui', { notifications: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } })
  return data
}

function hudElement () {
  const controls = []
  const column = { append: element => controls.push(element) }
  const html = {
    querySelectorAll: () => [...controls],
    querySelector: () => column,
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

describe('UI requests and notices', () => {
  test('renders the party toggle, the member gather control, or nothing', async () => {
    const { party, scene, partyToken, a, b, foreign, otherGM } = await uiFixture()
    const { html, controls } = hudElement()
    canvas.level = { id: 'ground' }
    canvas.tokens = { controlled: [] }
    game.user = otherGM
    registerPartyTokenHooks()
    scene.tokens.splice(0)
    scene.tokens.push(partyToken)
    hooks.renderTokenHUD({ document: partyToken }, html)
    expect(controls).toHaveLength(1)
    expect(controls[0].setAttribute).toHaveBeenCalledWith('aria-label', 'DCC.PartyTokenGatherDeploy')
    await controls[0].click({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(game.socket.emit.mock.calls[0][1].payload).toEqual({ action: 'deploy', partyId: party.id, sceneId: scene.id, partyTokenId: partyToken.id })
    expect(ui.notifications.info).toHaveBeenCalledWith('DCC.PartyTokenRequestSent')

    scene.tokens.splice(0)
    scene.tokens.push(a, b)
    controls.splice(0)
    canvas.tokens.controlled = [a, b]
    hooks.renderTokenHUD({ document: a }, html)
    expect(controls).toHaveLength(1)
    expect(controls[0].setAttribute).toHaveBeenCalledWith('aria-label', 'DCC.PartyTokenGather')
    await controls[0].click({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(game.socket.emit.mock.calls[1][1].payload).toEqual({ action: 'gather', partyId: party.id, sceneId: scene.id, levelId: 'ground', tokenIds: [a.id, b.id] })

    controls.splice(0)
    canvas.tokens.controlled = []
    hooks.renderTokenHUD({ document: foreign }, html)
    expect(controls).toHaveLength(0)
    game.user = { id: 'player', isGM: false }
    hooks.renderTokenHUD({ document: partyToken }, html)
    expect(controls).toHaveLength(0)
  })

  test('a non-active GM only forwards the sheet request and confirms the click', async () => {
    const { party, scene, a, otherGM } = await uiFixture()
    game.user = otherGM
    await service.togglePartyTokens({ party, scene, levelId: 'ground', selection: [a] })
    expect(ui.notifications.info).toHaveBeenCalledExactlyOnceWith('DCC.PartyTokenRequestSent')
    expect(game.socket.emit).toHaveBeenCalledWith('system.dcc', {
      action: 'partyTokenAction',
      payload: { action: 'gather', partyId: party.id, sceneId: scene.id, levelId: 'ground', tokenIds: [a.id] }
    })
  })

  test('an overlapping request resolves busy instead of silently dropping the click', async () => {
    const { payload, scene } = await socketFixture()
    let entered
    let release
    const enteredPromise = new Promise(resolve => { entered = resolve })
    const releasePromise = new Promise(resolve => { release = resolve })
    const create = scene.createEmbeddedDocuments.getMockImplementation()
    scene.createEmbeddedDocuments.mockImplementationOnce(async (...args) => {
      entered()
      await releasePromise
      return create(...args)
    })
    const first = service.requestPartyTokenAction(payload)
    await enteredPromise
    await expect(service.requestPartyTokenAction(payload)).resolves.toMatchObject({ error: { code: 'busy' } })
    release()
    await expect(first).resolves.toMatchObject({ gathered: 1 })
  })

  test('rejects socket requests from a non-GM or unknown sender', async () => {
    const { payload, remote, events } = await socketFixture()
    await expect(remote(payload, 'player')).resolves.toBeUndefined()
    await expect(remote(payload, 'unknown')).resolves.toBeUndefined()
    expect(events).toEqual([])
  })

  test('rejects a malformed request before any mutation', async () => {
    const { payload, events, scene } = await socketFixture()
    await expect(service.requestPartyTokenAction({ ...payload, levelId: undefined })).resolves.toEqual({ error: { code: 'invalid-request' } })
    expect(events).toEqual([])
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test.each([
    ['unauthorized', 'Unauthorized'],
    ['invalid-request', 'InvalidRequest'],
    ['member-token-already-present', 'MemberAlreadyPresent'],
    ['party-hide-failed', 'PartyHideFailed']
  ])('maps service error %s to its localized notice exactly once', async (code, suffix) => {
    const { payload } = await socketFixture()
    game.users.get = () => { throw Object.assign(new Error(code), { code }) }
    await expect(service.requestPartyTokenAction(payload)).resolves.toEqual({ error: { code } })
    expect(ui.notifications.warn).toHaveBeenCalledExactlyOnceWith(`DCC.PartyToken${suffix}`)
  })
})
