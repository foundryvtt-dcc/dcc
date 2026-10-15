/* global CONFIG, game, TokenDocument, canvas, Hooks */
import { beforeEach, afterEach, expect, test, vi } from 'vitest'

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
