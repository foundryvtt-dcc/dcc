import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import '../__mocks__/foundry.js'
import DCCPartySheet from '../party-sheet.js'

// party-sheet.js coverage backfill (audit 2026-06-08: 0 dedicated tests). The static
// #roll* action handlers are class-private (reachable only through the action map,
// like the actor-sheet handlers — e2e territory); these cover the public membership +
// form-data instance methods by invoking them with a faked `this`.

const proto = DCCPartySheet.prototype

beforeEach(() => {
  globalThis.foundry = globalThis.foundry || {}
  globalThis.foundry.utils = globalThis.foundry.utils || {}
  // parseUuid('Actor.abc') -> { id: 'abc' }
  globalThis.foundry.utils.parseUuid = (uuid) => ({ id: String(uuid).split('.').pop() })
  globalThis.game = globalThis.game || {}
  globalThis.game.actors = { get: vi.fn() }
})

describe('_validateMember', () => {
  test('rejects an unknown actor', async () => {
    globalThis.game.actors.get = vi.fn(() => undefined)
    expect(await proto._validateMember.call({}, 'Actor.missing')).toBe(false)
  })

  test('rejects a Party actor (no party-in-party)', async () => {
    globalThis.game.actors.get = vi.fn(() => ({ type: 'Party' }))
    expect(await proto._validateMember.call({}, 'Actor.party')).toBe(false)
  })

  test('accepts a valid non-Party actor', async () => {
    globalThis.game.actors.get = vi.fn(() => ({ type: 'Player' }))
    expect(await proto._validateMember.call({}, 'Actor.alice')).toBe(true)
  })
})

describe('membership mutation', () => {
  test('_addMember appends the parsed id and re-renders', () => {
    const ctx = { members: [], render: vi.fn() }
    proto._addMember.call(ctx, 'Actor.alice')
    expect(ctx.members).toEqual([{ id: 'alice' }])
    expect(ctx.render).toHaveBeenCalledWith(false)
  })

  test('_removeMember drops the matching id and is a no-op when absent', () => {
    const ctx = { members: [{ id: 'alice' }, { id: 'bob' }], render: vi.fn() }
    proto._removeMember.call(ctx, 'ghost')
    expect(ctx.members).toHaveLength(2)
    proto._removeMember.call(ctx, 'alice')
    expect(ctx.members).toEqual([{ id: 'bob' }])
  })

  test('_updateMember merges updates into the matching member only', () => {
    const ctx = { members: [{ id: 'alice' }, { id: 'bob' }], render: vi.fn() }
    // mergeObject is provided by the shared foundry mock
    proto._updateMember.call(ctx, 'alice', { activeMelee: 'sword' })
    expect(ctx.members[0]).toMatchObject({ id: 'alice', activeMelee: 'sword' })
    expect(ctx.members[1]).toEqual({ id: 'bob' })
  })
})

describe('_processFormData / _processSubmitData member-weapon round-trip', () => {
  // _processFormData calls super._processFormData; stub the parent prototype method
  // for the duration so we exercise only the weapon-update extraction.
  let parentProto, origPFD, origPSD
  beforeEach(() => {
    parentProto = Object.getPrototypeOf(proto)
    origPFD = parentProto._processFormData
    origPSD = parentProto._processSubmitData
    parentProto._processFormData = vi.fn(() => 'PARENT_FORM')
    parentProto._processSubmitData = vi.fn(async () => 'PARENT_SUBMIT')
  })
  afterEach(() => {
    parentProto._processFormData = origPFD
    parentProto._processSubmitData = origPSD
  })

  test('_processFormData stages active melee/ranged into _pendingMemberUpdates', () => {
    const ctx = {}
    const formData = { object: { 'weaponUpdates.alice.melee': 'sword', 'weaponUpdates.alice.ranged': 'bow' } }
    const result = proto._processFormData.call(ctx, {}, {}, formData)
    expect(result).toBe('PARENT_FORM') // delegates to super
    expect(ctx._pendingMemberUpdates).toEqual({ alice: { activeMelee: 'sword', activeRanged: 'bow' } })
  })

  test('_processFormData skips members with no melee/ranged change', () => {
    const ctx = {}
    const formData = { object: { 'weaponUpdates.bob.other': 'x' } }
    proto._processFormData.call(ctx, {}, {}, formData)
    expect(ctx._pendingMemberUpdates).toEqual({}) // bob produced no member update
  })

  test('_processSubmitData applies pending updates via _updateMember then clears them', async () => {
    const ctx = {
      _pendingMemberUpdates: { alice: { activeMelee: 'sword' } },
      _updateMember: vi.fn()
    }
    const result = await proto._processSubmitData.call(ctx, {}, {}, {})
    expect(result).toBe('PARENT_SUBMIT')
    expect(ctx._updateMember).toHaveBeenCalledWith('alice', { activeMelee: 'sword' })
    expect(ctx._pendingMemberUpdates).toBeUndefined() // cleaned up
  })
})
