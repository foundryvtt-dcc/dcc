import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import '../__mocks__/foundry.js'
import DCCPartySheet from '../party-sheet.js'
import { togglePartyTokens } from '../party-token.mjs'

vi.mock('../party-token.mjs', () => ({ togglePartyTokens: vi.fn() }))

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// party-sheet.js coverage backfill (audit 2026-06-08: 0 dedicated tests). The static
// #roll* action handlers are class-private (reachable only through the action map,
// like the actor-sheet handlers — e2e territory); these cover the public membership +
// form-data instance methods by invoking them with a faked `this`.

const proto = DCCPartySheet.prototype

describe('party token sheet control', () => {
  test('static action passes initiating scene, level and unchanged selection to the controller', async () => {
    const actor = { id: 'party' }
    const scene = { id: 'source' }
    const selection = [{ document: { id: 'member' } }, { document: { id: 'foreign' } }]
    globalThis.canvas = { scene, level: { id: 'upstairs' }, tokens: { controlled: selection } }
    await DCCPartySheet.DEFAULT_OPTIONS.actions.togglePartyTokens.call({ actor })
    expect(togglePartyTokens).toHaveBeenCalledWith({ party: actor, scene, levelId: 'upstairs', selection })
  })

  test('header button is GM-only, accessible and neutral', () => {
    const template = fs.readFileSync(path.join(ROOT, 'templates/party-sheet-partial-party.html'), 'utf8')
    const guarded = template.match(/{{#if canManagePartyTokens}}([\s\S]*?){{\/if}}/)
    expect(guarded?.[1]).toContain('data-action="togglePartyTokens"')
    // The label, tooltip and accessible name all resolve the same fixed key:
    // the button never derives its text from the party's snapshot state.
    expect(template).toContain('aria-label="{{localize \'DCC.PartyTokenGatherDeploy\'}}"')
    expect(template).toContain('title="{{localize \'DCC.PartyTokenGatherDeploy\'}}"')
    expect(template).toContain("{{localize 'DCC.PartyTokenGatherDeploy'}}")
    expect(template).toContain('class="fas fa-people-group"')
    expect(template).not.toContain('partyTokenActionLabel')
  })

  test.each([true, false])('prepared sheet context exposes management only for GM=%s', async isGM => {
    const parent = Object.getPrototypeOf(proto)
    const prepare = vi.spyOn(parent, '_prepareContext').mockResolvedValue({})
    const actor = { getFlag: () => [], system: { details: { notes: { value: '' } } } }
    globalThis.game.user = { isGM }
    try {
      const sheet = new DCCPartySheet({ document: actor, dragDrop: [] })
      const context = await sheet._prepareContext({})
      expect(context.canManagePartyTokens).toBe(isGM)
      // State-dependent label/icon contexts are gone: the template is fixed.
      expect(context).not.toHaveProperty('partyTokenActionLabel')
      expect(context).not.toHaveProperty('partyTokenActionIcon')
    } finally { prepare.mockRestore() }
  })
})

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

describe('party portrait', () => {
  // The party sheet used to clobber the inherited `editImage` action with an
  // undefined handler (`DCCPartySheet.editImage` was never defined — Foundry's
  // own handler is private), which silently broke portrait editing. Leave the
  // key absent so `DocumentSheetV2`'s default `editImage` survives the merge.
  test('does not override the inherited editImage action', () => {
    expect('editImage' in DCCPartySheet.DEFAULT_OPTIONS.actions).toBe(false)
  })

  // The party actor's own portrait must be rendered (and bound for editing) in
  // the party-name header row — previously there was no `<img>` at all, so the
  // portrait was neither visible nor editable (#party-portrait).
  test('renders an editable portrait bound to the actor img', () => {
    const template = fs.readFileSync(
      path.join(ROOT, 'templates', 'party-sheet-partial-party.html'), 'utf8'
    )
    const portrait = template.match(/<img[^>]*class="party-portrait"[^>]*>/)
    expect(portrait, 'party-sheet-partial-party.html has no .party-portrait img').not.toBeNull()
    expect(portrait[0]).toContain('src="{{img}}"')
    expect(portrait[0]).toContain('data-action="editImage"')
    expect(portrait[0]).toContain('data-edit="img"')
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

  test('returns false for a rejected item drop without delegating to the parent', async () => {
    // A handled-but-rejected item drop (no member row under the cursor) returns
    // false, which must short-circuit before super._onDrop. A truthy check in
    // place of `!== undefined` would wrongly delegate and reintroduce the
    // invisible-copy + source-deletion bug this override exists to prevent.
    const origUi = globalThis.ui
    const origI18n = globalThis.game.i18n
    try {
      globalThis.foundry.applications.ux.TextEditor.getDragEventData = () => ({ type: 'Item', uuid: 'Item.x' })
      globalThis.ui = { notifications: { warn: vi.fn() } }
      globalThis.game.i18n = { localize: (key) => key }

      const ctx = { actor: { id: 'party' }, _clearDragHighlight: vi.fn() }
      const event = { target: { closest: () => null } } // no member row under the cursor
      const result = await proto._onDrop.call(ctx, event)

      expect(result).toBe(false)
      expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith('DCC.PartyNoInventoryHint')
      expect(parentProto._onDrop).not.toHaveBeenCalled()
    } finally {
      globalThis.ui = origUi
      globalThis.game.i18n = origI18n
    }
  })
})

describe('no effects tab (#1022)', () => {
  beforeEach(() => {
    globalThis.foundry.utils.deepClone = obj => JSON.parse(JSON.stringify(obj))
  })

  test('does not register an effects part', () => {
    expect(DCCPartySheet.PARTS.effects).toBeUndefined()
  })

  test('_getTabsConfig strips the inherited effects tab but keeps notes', () => {
    const ctx = { constructor: DCCPartySheet, options: { document: {} }, tabGroups: {} }
    const tabs = proto._getTabsConfig.call(ctx, 'sheet')
    expect(tabs.tabs.map(t => t.id)).toEqual(['party', 'notes'])
  })

  test('_onDropActiveEffect warns and refuses the drop', async () => {
    const warn = vi.fn()
    globalThis.ui = { notifications: { warn } }
    globalThis.game.i18n = { localize: key => key }
    expect(await proto._onDropActiveEffect.call({}, {}, { type: 'ActiveEffect' })).toBe(false)
    expect(warn).toHaveBeenCalledWith('DCC.PartyNoEffectsHint')
  })
})

describe("night's rest (#1064)", () => {
  test('GM-only button; warns with the log off, otherwise rests only Luck-recovering members', async () => {
    const template = fs.readFileSync(path.join(ROOT, 'templates/party-sheet-partial-party.html'), 'utf8')
    expect(template.match(/{{#if canManagePartyTokens}}([\s\S]*?){{\/if}}/)?.[1]).toContain('data-action="nightsRest"')

    const member = (id, sheetClass) => ({
      id,
      name: id,
      system: {
        abilities: { lck: { value: 8, max: 11 } },
        details: { level: { value: 3 }, sheetClass },
        abilityLog: [{ id: 'spend', timestamp: 1, ability: 'lck', change: -3, type: 'luckSpend', healedAmount: 0 }]
      },
      update: vi.fn()
    })
    const broken = member('broken', 'Thief')
    broken.update = vi.fn(async () => { throw new Error('denied') })
    const actors = [broken, member('halfling', 'Halfling'), member('warrior', 'Warrior')]
    globalThis.game.actors.get = vi.fn(id => actors.find(a => a.id === id))
    globalThis.game.user = { id: 'gm', isGM: true }
    globalThis.game.i18n = { localize: key => key, format: key => key }
    globalThis.ui = { notifications: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }
    const ctx = { members: actors.map(a => ({ id: a.id })) }
    const original = globalThis.gameSettingsGetMock.getMockImplementation()
    try {
      globalThis.gameSettingsGetMock.mockImplementation((module, key) => key === 'enableAbilityScoreLog' ? false : original?.(module, key))
      expect(await proto.nightsRest.call(ctx)).toEqual([])
      expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith('DCC.PartyNightsRestLogDisabled')

      globalThis.gameSettingsGetMock.mockImplementation((module, key) => key === 'enableAbilityScoreLog' ? true : original?.(module, key))
      // A failing member is reported and doesn't stop the rest of the party
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const results = await proto.nightsRest.call(ctx)
      consoleError.mockRestore()
      expect(results.map(r => [r.actor.id, r.restored])).toEqual([['halfling', 3]])
      expect(globalThis.ui.notifications.error).toHaveBeenCalledWith('DCC.PartyNightsRestFailed')
      expect(actors[2].update).not.toHaveBeenCalled()
    } finally {
      globalThis.gameSettingsGetMock.mockImplementation(original)
    }
  })
})
