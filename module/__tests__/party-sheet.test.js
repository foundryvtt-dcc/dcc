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

describe('rollPartyInitiative', () => {
  let warn

  /** Fake member actor with the fields best-member selection reads. */
  function makeMember (id, { init = 0, agl = 10, formula = '1d20' } = {}) {
    return {
      id,
      system: {
        attributes: { init: { value: init } },
        abilities: { agl: { value: agl } }
      },
      getInitiativeRoll: vi.fn(() => ({ formula }))
    }
  }

  /** Fake sheet context over the given member actors, with one linked token. */
  function makeCtx (memberActors) {
    globalThis.game.actors.get = vi.fn(id => memberActors.find(a => a.id === id))
    const actor = {
      id: 'party1',
      rollInitiative: vi.fn(async () => {})
    }
    actor.getActiveTokens = vi.fn(() => [{ actor }])
    return {
      members: memberActors.map(a => ({ id: a.id })),
      actor
    }
  }

  beforeEach(() => {
    warn = vi.fn()
    globalThis.ui = { notifications: { warn } }
    globalThis.game.i18n = { localize: key => key }
    globalThis.game.combat = null
  })

  test('warns and bails when the party is empty', async () => {
    const ctx = makeCtx([])
    await proto.rollPartyInitiative.call(ctx)
    expect(warn).toHaveBeenCalledWith('DCC.PartyNoMembersWarning')
    expect(ctx.actor.rollInitiative).not.toHaveBeenCalled()
  })

  test('warns and bails when the party already has an initiative score', async () => {
    const ctx = makeCtx([makeMember('alice')])
    globalThis.game.combat = { combatants: [{ actor: { id: 'party1' }, initiative: 12 }] }
    await proto.rollPartyInitiative.call(ctx)
    expect(warn).toHaveBeenCalledWith('DCC.AlreadyHasInitiative')
    expect(ctx.actor.rollInitiative).not.toHaveBeenCalled()
  })

  test('rolls when the party is in combat without an initiative score', async () => {
    const ctx = makeCtx([makeMember('alice')])
    globalThis.game.combat = { combatants: [{ actor: { id: 'party1' }, initiative: null }] }
    await proto.rollPartyInitiative.call(ctx)
    expect(warn).not.toHaveBeenCalled()
    expect(ctx.actor.rollInitiative).toHaveBeenCalled()
  })

  test('warns and bails when the party has no token in the viewed scene', async () => {
    const ctx = makeCtx([makeMember('alice')])
    ctx.actor.getActiveTokens = vi.fn(() => [])
    await proto.rollPartyInitiative.call(ctx)
    expect(warn).toHaveBeenCalledWith('DCC.PartyNoTokenWarning')
    expect(ctx.actor.rollInitiative).not.toHaveBeenCalled()
  })

  test('rolls with the formula of the member with the highest init bonus', async () => {
    const alice = makeMember('alice', { init: 1, agl: 17, formula: '1d20+1' })
    const bob = makeMember('bob', { init: 3, agl: 8, formula: '1d16[Weapon]+3' })
    const ctx = makeCtx([alice, bob])
    await proto.rollPartyInitiative.call(ctx)
    expect(bob.getInitiativeRoll).toHaveBeenCalled()
    expect(alice.getInitiativeRoll).not.toHaveBeenCalled()
    expect(ctx.actor.rollInitiative).toHaveBeenCalledWith({
      createCombatants: true,
      initiativeOptions: { formula: '1d16[Weapon]+3' }
    })
  })

  test('breaks init-bonus ties on raw Agility', async () => {
    const alice = makeMember('alice', { init: 2, agl: 15, formula: '1d20+2[alice]' })
    const bob = makeMember('bob', { init: 2, agl: 10, formula: '1d20+2[bob]' })
    const ctx = makeCtx([bob, alice]) // bob first so the tie-break has to flip the pick
    await proto.rollPartyInitiative.call(ctx)
    expect(ctx.actor.rollInitiative).toHaveBeenCalledWith({
      createCombatants: true,
      initiativeOptions: { formula: '1d20+2[alice]' }
    })
  })

  test('rolls through the synthetic token actor for an unlinked party token', async () => {
    const ctx = makeCtx([makeMember('alice', { formula: '1d20+2' })])
    const syntheticActor = { id: 'party1', rollInitiative: vi.fn(async () => {}) }
    ctx.actor.getActiveTokens = vi.fn(() => [{ actor: syntheticActor }])
    await proto.rollPartyInitiative.call(ctx)
    expect(syntheticActor.rollInitiative).toHaveBeenCalledWith({
      createCombatants: true,
      initiativeOptions: { formula: '1d20+2' }
    })
    expect(ctx.actor.rollInitiative).not.toHaveBeenCalled()
  })

  test('rolls once when multiple tokens resolve to the same linked actor', async () => {
    const ctx = makeCtx([makeMember('alice')])
    ctx.actor.getActiveTokens = vi.fn(() => [{ actor: ctx.actor }, { actor: ctx.actor }])
    await proto.rollPartyInitiative.call(ctx)
    expect(ctx.actor.rollInitiative).toHaveBeenCalledTimes(1)
  })

  test('skips members whose actor no longer exists', async () => {
    const bob = makeMember('bob', { init: 0, agl: 10, formula: '1d20' })
    const ctx = makeCtx([bob])
    ctx.members = [{ id: 'ghost' }, { id: 'bob' }]
    await proto.rollPartyInitiative.call(ctx)
    expect(warn).not.toHaveBeenCalled()
    expect(ctx.actor.rollInitiative).toHaveBeenCalledWith({
      createCombatants: true,
      initiativeOptions: { formula: '1d20' }
    })
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

describe('_onDrop', () => {
  // _onDrop calls super._onDrop; stub the parent prototype method for the
  // duration. `super._onDrop` resolves through DCCPartySheet.prototype's
  // prototype at call time, so replacing it here intercepts the delegation.
  let parentProto, origSuperDrop, origGetDragEventData

  beforeEach(() => {
    parentProto = Object.getPrototypeOf(proto)
    origSuperDrop = parentProto._onDrop
    parentProto._onDrop = vi.fn(async () => 'SUPER')
    origGetDragEventData = globalThis.foundry.applications.ux.TextEditor.getDragEventData
  })

  afterEach(() => {
    parentProto._onDrop = origSuperDrop
    globalThis.foundry.applications.ux.TextEditor.getDragEventData = origGetDragEventData
  })

  test('delegates a non-item drop to the parent sheet', async () => {
    globalThis.foundry.applications.ux.TextEditor.getDragEventData = vi.fn(() => ({ type: 'Actor' }))
    const ctx = { actor: { id: 'party' }, _clearDragHighlight: vi.fn() }
    const result = await proto._onDrop.call(ctx, {})
    expect(result).toBe('SUPER')
    expect(ctx._clearDragHighlight).toHaveBeenCalled()
    expect(parentProto._onDrop).toHaveBeenCalled()
  })

  test('returns false without delegating when there is no drag data', async () => {
    globalThis.foundry.applications.ux.TextEditor.getDragEventData = vi.fn(() => null)
    const ctx = { actor: { id: 'party' }, _clearDragHighlight: vi.fn() }
    const result = await proto._onDrop.call(ctx, {})
    expect(result).toBe(false)
    expect(ctx._clearDragHighlight).toHaveBeenCalled()
    expect(parentProto._onDrop).not.toHaveBeenCalled()
  })

  test('routes an item drop to the member row and does not delegate to the parent', async () => {
    // Drive the REAL handlePartyItemDrop so the _onDrop wiring is covered
    // end to end: an item dropped on a member row returns the created item and
    // must short-circuit before super._onDrop (the transfer-delete path).
    const origFromUuid = globalThis.fromUuid
    const origActorsGet = globalThis.game.actors.get
    try {
      globalThis.foundry.applications.ux.TextEditor.getDragEventData = () => ({ type: 'Item', uuid: 'Item.item-1' })
      globalThis.fromUuid = vi.fn(async () => ({ id: 'item-1' }))
      globalThis.game.actors.get = (id) => ({
        id,
        sheet: { _onDropItem: vi.fn(async () => ({ id: 'created-1' })) },
        deleteEmbeddedDocuments: vi.fn()
      })

      const ctx = { actor: { id: 'party' }, _clearDragHighlight: vi.fn() }
      const event = { target: { closest: () => ({ dataset: { actorId: 'alice' } }) } }
      const result = await proto._onDrop.call(ctx, event)

      expect(result).toEqual({ id: 'created-1' })
      expect(parentProto._onDrop).not.toHaveBeenCalled()
    } finally {
      globalThis.fromUuid = origFromUuid
      globalThis.game.actors.get = origActorsGet
    }
  })
})

describe('_onDragLeave', () => {
  test('keeps the highlight when the pointer stays inside the drop zone', () => {
    const ctx = { _clearDragHighlight: vi.fn() }
    const event = { relatedTarget: { nodeName: 'DIV' }, currentTarget: { contains: vi.fn(() => true) } }
    proto._onDragLeave.call(ctx, event)
    expect(ctx._clearDragHighlight).not.toHaveBeenCalled()
  })

  test('clears the highlight when the pointer leaves the drop zone', () => {
    const ctx = { _clearDragHighlight: vi.fn() }
    // relatedTarget null (left the window) and outside the drop zone both clear.
    proto._onDragLeave.call(ctx, { relatedTarget: null, currentTarget: { contains: vi.fn() } })
    proto._onDragLeave.call(ctx, { relatedTarget: { nodeName: 'DIV' }, currentTarget: { contains: vi.fn(() => false) } })
    expect(ctx._clearDragHighlight).toHaveBeenCalledTimes(2)
  })
})

describe('_onDragOver / _clearDragHighlight', () => {
  /**
   * A fake member row with the `classList` spies the highlight code calls.
   * `element.querySelectorAll` returns the same `.character-row.drag-over`
   * array for both methods, mirroring the single selector they share.
   */
  function makeRow () {
    return { classList: { add: vi.fn(), remove: vi.fn() } }
  }

  test('_onDragOver adds drag-over to the hovered row and clears the others', () => {
    const other = makeRow()
    const hovered = makeRow()
    const ctx = { element: { querySelectorAll: vi.fn(() => [other, hovered]) } }
    proto._onDragOver.call(ctx, { target: { closest: vi.fn(() => hovered) } })
    expect(hovered.classList.add).toHaveBeenCalledWith('drag-over')
    expect(hovered.classList.remove).not.toHaveBeenCalled()
    expect(other.classList.remove).toHaveBeenCalledWith('drag-over')
    expect(other.classList.add).not.toHaveBeenCalled()
  })

  test('_onDragOver clears every highlighted row when not over a row', () => {
    const first = makeRow()
    const second = makeRow()
    const ctx = { element: { querySelectorAll: vi.fn(() => [first, second]) } }
    proto._onDragOver.call(ctx, { target: { closest: vi.fn(() => null) } })
    expect(first.classList.remove).toHaveBeenCalledWith('drag-over')
    expect(second.classList.remove).toHaveBeenCalledWith('drag-over')
    expect(first.classList.add).not.toHaveBeenCalled()
    expect(second.classList.add).not.toHaveBeenCalled()
  })

  test('_clearDragHighlight removes drag-over from every highlighted row', () => {
    const first = makeRow()
    const second = makeRow()
    const ctx = { element: { querySelectorAll: vi.fn(() => [first, second]) } }
    proto._clearDragHighlight.call(ctx)
    expect(first.classList.remove).toHaveBeenCalledWith('drag-over')
    expect(second.classList.remove).toHaveBeenCalledWith('drag-over')
  })

  test('_clearDragHighlight tolerates a missing element', () => {
    expect(() => proto._clearDragHighlight.call({})).not.toThrow()
  })
})
