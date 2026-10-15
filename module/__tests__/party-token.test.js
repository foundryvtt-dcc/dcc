/* global CONFIG, game, TokenDocument, canvas, Hooks */
import { beforeEach, afterEach, expect, test, vi } from 'vitest'

let registerPartyTokenHooks
let hooks

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
  ;({ registerPartyTokenHooks } = await import('../party-token.mjs'))
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
  return { actor, prepareData: vi.fn(), object: { renderFlags: { set: vi.fn() } } }
}

test('refreshes only affected viewed-scene Party documents before bars and bound HUD on remote updates/deletions', () => {
  const party = { id: 'party', type: 'Party', flags: { dcc: { partyMembers: [{ id: 'member' }] } } }
  const affected = token(party)
  const other = token({ id: 'other', type: 'Party', flags: { dcc: { partyMembers: [] } } })
  const member = token({ id: 'member', type: 'Player' })
  canvas.scene.tokens = [affected, other, member]
  canvas.hud.token.object = affected.object
  registerPartyTokenHooks()
  for (const name of ['updateActor', 'deleteActor']) hooks[name](member.actor, {}, {}, 'remote-GM')
  expect(affected.prepareData).toHaveBeenCalledTimes(2)
  expect(affected.object.renderFlags.set).toHaveBeenCalledWith({ refreshBars: true })
  expect(affected.prepareData.mock.invocationCallOrder[0]).toBeLessThan(affected.object.renderFlags.set.mock.invocationCallOrder[0])
  expect(canvas.hud.token.render).toHaveBeenCalledTimes(2)
  expect(other.prepareData).not.toHaveBeenCalled()
  expect(member.prepareData).not.toHaveBeenCalled()
  hooks.updateActor(party, { flags: { dcc: { partyMembers: [] } } })
  expect(affected.prepareData).toHaveBeenCalledTimes(3)
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
  expect(affected.prepareData).toHaveBeenCalledTimes(6)
  expect(canvas.hud.token.render).not.toHaveBeenCalled()
  canvas.scene = null
  expect(() => hooks.updateActor(member)).not.toThrow()
})
