import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Unit tests exercise the getter independently of Foundry's schema machinery.
vi.mock('../data/actor/base-actor.mjs', () => ({ BaseActorData: class {} }))
const { PartyData } = await import('../data/actor/party-data.mjs')

describe('PartyData aggregate hit points', () => {
  let actors
  let parent
  let party

  const member = (value, max) => ({ system: { attributes: { hp: { value, max } } } })

  beforeEach(() => {
    actors = new Map([
      ['first', member(5, 8)],
      ['second', member(2, 4)]
    ])
    vi.stubGlobal('game', { actors })
    parent = {
      flags: { dcc: { partyMembers: [{ id: 'first' }, { id: 'second' }] } },
      getFlag: vi.fn((scope, key) => parent.flags[scope][key]),
      update: vi.fn()
    }
    party = new PartyData()
    party.parent = parent
  })

  afterEach(() => vi.unstubAllGlobals())

  test('sums current world member hit points', () => {
    expect(party.aggregate).toEqual({ hp: { value: 7, max: 12 } })
    expect(parent.getFlag).toHaveBeenCalledWith('dcc', 'partyMembers')
  })

  test('treats a non-array roster as empty', () => {
    parent.flags.dcc.partyMembers = {}
    expect(party.aggregate.hp).toEqual({ value: 0, max: 0 })
  })

  test('ignores missing actors and counts duplicate IDs once', () => {
    parent.flags.dcc.partyMembers.push({ id: 'missing' }, { id: 'first' })
    expect(party.aggregate.hp).toEqual({ value: 7, max: 12 })
  })

  test('reads changed HP, roster, and actor collection without a cache', () => {
    expect(party.aggregate.hp).toEqual({ value: 7, max: 12 })
    actors.get('first').system.attributes.hp.value = 2
    expect(party.aggregate.hp).toEqual({ value: 4, max: 12 })
    parent.flags.dcc.partyMembers = [{ id: 'second' }]
    expect(party.aggregate.hp).toEqual({ value: 2, max: 4 })
    globalThis.game.actors = new Map([['second', member(3, 6)]])
    expect(party.aggregate.hp).toEqual({ value: 3, max: 6 })
  })

  test('treats missing HP as zero', () => {
    actors.set('first', member(undefined, undefined))
    expect(party.aggregate.hp).toEqual({ value: 2, max: 4 })
  })

  test('ignores absent HP structures', () => {
    actors.set('first', { system: {} })
    actors.set('second', {})
    expect(party.aggregate.hp).toEqual({ value: 0, max: 0 })
  })

  test('converts numeric strings without clamping negative or overmaximum HP', () => {
    actors.set('first', member('-3', '8'))
    actors.set('second', member('10', '4'))
    expect(party.aggregate.hp).toEqual({ value: 7, max: 12 })
  })

  test('handles early lifecycle without parent, game, or actors', () => {
    party.parent = null
    expect(party.aggregate.hp).toEqual({ value: 0, max: 0 })
    party.parent = parent
    globalThis.game.actors = undefined
    expect(party.aggregate.hp).toEqual({ value: 0, max: 0 })
    vi.stubGlobal('game', undefined)
    expect(party.aggregate.hp).toEqual({ value: 0, max: 0 })
  })

  test('does not update the party or mutate its flags or members', () => {
    const flags = structuredClone(parent.flags)
    const members = structuredClone([...actors])
    expect(party.aggregate.hp).toEqual({ value: 7, max: 12 })
    expect(parent.update).not.toHaveBeenCalled()
    expect(parent.flags).toEqual(flags)
    expect([...actors]).toEqual(members)
  })
})
