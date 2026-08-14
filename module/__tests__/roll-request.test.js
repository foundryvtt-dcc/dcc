/**
 * Unit coverage for the GM roll-request helpers (issues #855, #914).
 *
 * The actor/check/source helpers and the chat-card poster are exported
 * as pure(ish) functions; the assertions stub `game` / `CONFIG` /
 * `canvas` / `ChatMessage` per-test so no DOM or live Foundry boot is
 * needed. The dialog itself (ApplicationV2 rendering, actor-change
 * re-render, submit) is covered by the Playwright spec
 * `browser-tests/e2e/roll-request.spec.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'

import {
  actorHasSkill,
  buildCheckOptions,
  buildRollRequestSource,
  getDefaultRequestActors,
  getRequestableActors,
  postRollRequest
} from '../roll-request.mjs'

const I18N = {
  'DCC.Check': 'Check',
  'DCC.AbilityStr': 'Strength',
  'DCC.AbilityAgl': 'Agility',
  'DCC.AbilitySta': 'Stamina',
  'DCC.AbilityPer': 'Personality',
  'DCC.AbilityInt': 'Intelligence',
  'DCC.AbilityLck': 'Luck',
  'DCC.SneakSilently': 'Sneak Silently',
  'DCC.RequestRollText': '{user} asks {actor} to roll:',
  'DCC.RequestRollTextMultiple': '{user} asks these characters to roll:',
  'DCC.RequestRollSkillMissingWarning': 'No roll was requested for {actors} — that skill is not on their sheet.'
}

let original

beforeEach(() => {
  original = {
    game: globalThis.game,
    CONFIG: globalThis.CONFIG,
    canvas: globalThis.canvas,
    ChatMessage: globalThis.ChatMessage,
    ui: globalThis.ui
  }
  globalThis.game = {
    i18n: {
      localize: vi.fn((key) => I18N[key] ?? key),
      format: vi.fn((key, data = {}) => {
        if (key === 'DCC.SaveDC') return `DC ${data.dc}`
        return (I18N[key] ?? key).replace(/{(\w+)}/g, (_, k) => data[k])
      })
    },
    user: { isGM: true, name: 'Judge' },
    actors: []
  }
  globalThis.CONFIG = {
    DCC: {
      abilities: {
        str: 'DCC.AbilityStr',
        agl: 'DCC.AbilityAgl',
        sta: 'DCC.AbilitySta',
        per: 'DCC.AbilityPer',
        int: 'DCC.AbilityInt',
        lck: 'DCC.AbilityLck'
      },
      skillTables: { divineAid: 'divineAidTable' }
    }
  }
  globalThis.canvas = { tokens: { controlled: [] } }
  globalThis.ChatMessage = { create: vi.fn().mockResolvedValue({ id: 'msg' }) }
  globalThis.ui = { notifications: { warn: vi.fn() } }
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.CONFIG = original.CONFIG
  globalThis.canvas = original.canvas
  globalThis.ChatMessage = original.ChatMessage
  globalThis.ui = original.ui
  vi.restoreAllMocks()
})

function mockActor (overrides = {}) {
  return {
    id: 'actor1',
    uuid: 'Actor.actor1',
    name: 'Torvald',
    type: 'Player',
    system: { skills: {} },
    itemTypes: { skill: [] },
    ...overrides
  }
}

describe('getRequestableActors', () => {
  test('player actors only, sorted by name', () => {
    const npc = mockActor({ id: 'n', name: 'Ogre', type: 'NPC' })
    const zed = mockActor({ id: 'z', name: 'Zed' })
    const anya = mockActor({ id: 'a', name: 'Anya' })
    globalThis.game.actors = [npc, zed, anya]
    expect(getRequestableActors()).toEqual([anya, zed])
  })
})

describe('getDefaultRequestActors', () => {
  test('every controlled PC token, deduplicated, NPCs excluded', () => {
    const npc = mockActor({ type: 'NPC' })
    const pc = mockActor()
    const other = mockActor({ id: 'actor2', name: 'Anya' })
    globalThis.canvas.tokens.controlled = [{ actor: npc }, { actor: pc }, { actor: other }, { actor: pc }]
    expect(getDefaultRequestActors()).toEqual([pc, other])
  })

  test('empty when nothing suitable is controlled', () => {
    globalThis.canvas.tokens.controlled = [{ actor: null }]
    expect(getDefaultRequestActors()).toEqual([])
  })
})

describe('actorHasSkill', () => {
  test('true for a built-in slot and for a skill item, false otherwise', () => {
    const actor = mockActor({
      system: { skills: { sneakSilently: { label: 'DCC.SneakSilently' } } },
      itemTypes: { skill: [{ name: 'Nature Lore' }] }
    })
    expect(actorHasSkill(actor, 'sneakSilently')).toBe(true)
    expect(actorHasSkill(actor, 'Nature Lore')).toBe(true)
    expect(actorHasSkill(actor, 'findTrap')).toBe(false)
  })
})

describe('buildCheckOptions', () => {
  test('abilities come first, namespaced and localized', () => {
    const { abilities } = buildCheckOptions(mockActor())
    expect(abilities[0]).toEqual({ value: 'check:str', label: 'Strength Check' })
    expect(abilities.map(o => o.value)).toEqual(
      ['check:str', 'check:agl', 'check:sta', 'check:per', 'check:int', 'check:lck']
    )
  })

  test('built-in skill slots precede custom skill items', () => {
    const actor = mockActor({
      system: { skills: { sneakSilently: { label: 'DCC.SneakSilently' } } },
      itemTypes: { skill: [{ name: 'Nature Lore' }] }
    })
    const { skills } = buildCheckOptions(actor)
    expect(skills).toEqual([
      { value: 'skill:sneakSilently', label: 'Sneak Silently' },
      { value: 'skill:Nature Lore', label: 'Nature Lore' }
    ])
  })

  test('an untranslated built-in label falls back to a prettified id', () => {
    const actor = mockActor({
      system: { skills: { findTrap: { label: 'DCC.NoSuchKey' } } }
    })
    expect(buildCheckOptions(actor).skills).toEqual([
      { value: 'skill:findTrap', label: 'Find Trap' }
    ])
  })

  test('a skill item colliding with a built-in slot id is skipped', () => {
    const actor = mockActor({
      system: { skills: { sneakSilently: { label: 'DCC.SneakSilently' } } },
      itemTypes: { skill: [{ name: 'sneakSilently' }] }
    })
    expect(buildCheckOptions(actor).skills).toHaveLength(1)
  })

  test('null actor yields abilities but no skills', () => {
    const { abilities, skills } = buildCheckOptions(null)
    expect(abilities).toHaveLength(6)
    expect(skills).toEqual([])
  })

  test('several actors union their skills, slots before items, no duplicates', () => {
    const thief = mockActor({
      system: { skills: { sneakSilently: { label: 'DCC.SneakSilently' } } },
      itemTypes: { skill: [{ name: 'Nature Lore' }] }
    })
    const elf = mockActor({
      id: 'actor2',
      system: { skills: { findTrap: { label: 'DCC.NoSuchKey' } } },
      itemTypes: { skill: [{ name: 'Nature Lore' }, { name: 'Heraldry' }] }
    })
    expect(buildCheckOptions([thief, elf]).skills).toEqual([
      { value: 'skill:sneakSilently', label: 'Sneak Silently' },
      { value: 'skill:findTrap', label: 'Find Trap' },
      { value: 'skill:Nature Lore', label: 'Nature Lore' },
      { value: 'skill:Heraldry', label: 'Heraldry' }
    ])
  })

  test('an empty selection yields abilities but no skills', () => {
    expect(buildCheckOptions([]).skills).toEqual([])
    expect(buildCheckOptions([]).abilities).toHaveLength(6)
  })
})

describe('buildRollRequestSource', () => {
  test('ability check with DC and actor', () => {
    expect(buildRollRequestSource({ type: 'check', key: 'agl', dc: 10, actorUuid: 'Actor.abc' }))
      .toBe('[[/check agl 10 actor=Actor.abc]]')
  })

  test('no DC omits the number', () => {
    expect(buildRollRequestSource({ type: 'check', key: 'agl', actorUuid: 'Actor.abc' }))
      .toBe('[[/check agl actor=Actor.abc]]')
  })

  test('multi-word skill names are quoted and labels appended', () => {
    expect(buildRollRequestSource({
      type: 'skill',
      key: 'Nature Lore',
      dc: 12,
      actorUuid: 'Actor.abc',
      label: 'DC 12 Nature Lore Check'
    })).toBe('[[/skill "Nature Lore" 12 actor=Actor.abc]]{DC 12 Nature Lore Check}')
  })

  test('pattern-breaking characters are stripped from key and label', () => {
    expect(buildRollRequestSource({ type: 'skill', key: 'Weird]] "Sk=ill"', label: 'a{b}c' }))
      .toBe('[[/skill "Weird Skill"]]{abc}')
  })

  test('an explicit rollUnder override serializes into the config', () => {
    expect(buildRollRequestSource({ type: 'check', key: 'lck', dc: 10, actorUuid: 'Actor.abc', rollUnder: false }))
      .toBe('[[/check lck 10 rollUnder=false actor=Actor.abc]]')
  })
})

describe('postRollRequest', () => {
  test('posts a request card carrying the enricher source and flags', async () => {
    const actor = mockActor()
    await postRollRequest({ actor, checkValue: 'check:agl', dc: '10' })
    expect(globalThis.ChatMessage.create).toHaveBeenCalledTimes(1)
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/check agl 10 actor=Actor.actor1]]')
    expect(payload.content).toContain('Judge asks Torvald to roll:')
    expect(payload.flags.dcc.rollRequest).toBe(true)
    expect(payload.speaker).toEqual({ alias: 'Judge' })
  })

  test('skill requests carry the localized label with DC prefix', async () => {
    const actor = mockActor({
      system: { skills: { sneakSilently: { label: 'DCC.SneakSilently' } } }
    })
    await postRollRequest({ actor, checkValue: 'skill:sneakSilently', dc: 12 })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain(
      '[[/skill sneakSilently 12 actor=Actor.actor1]]{DC 12 Sneak Silently Check}'
    )
  })

  test('skill item requests use the item name as label (quotes HTML-escaped in the card body)', async () => {
    const actor = mockActor({ itemTypes: { skill: [{ name: 'Nature Lore' }] } })
    await postRollRequest({ actor, checkValue: 'skill:Nature Lore', dc: null })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    // escapeHtml encodes the quotes for safe storage; chat enrichment
    // decodes text nodes before pattern matching, so the link still wires.
    expect(payload.content).toContain(
      '[[/skill &quot;Nature Lore&quot; actor=Actor.actor1]]{Nature Lore Check}'
    )
  })

  test('an empty DC field posts without a DC (luck stays roll-under)', async () => {
    const actor = mockActor()
    await postRollRequest({ actor, checkValue: 'check:lck', dc: '' })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/check lck actor=Actor.actor1]]')
    expect(payload.content).not.toContain('rollUnder')
  })

  test('a Luck check with a DC becomes a roll-high check (rollUnder=false)', async () => {
    const actor = mockActor()
    await postRollRequest({ actor, checkValue: 'check:lck', dc: 10 })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/check lck 10 rollUnder=false actor=Actor.actor1]]')
  })

  test('table-backed skills drop the DC — the result table decides the outcome', async () => {
    const divineAid = mockActor({
      system: { skills: { divineAid: { label: 'DCC.DivineAid' } } }
    })
    await postRollRequest({ actor: divineAid, checkValue: 'skill:divineAid', dc: 12 })
    let payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/skill divineAid actor=Actor.actor1]]')
    expect(payload.content).not.toContain('12')

    const disapproval = mockActor({
      system: { skills: { customTable: { label: 'DCC.NoSuchKey', useDisapprovalRange: true } } }
    })
    await postRollRequest({ actor: disapproval, checkValue: 'skill:customTable', dc: 12 })
    payload = globalThis.ChatMessage.create.mock.calls[1][0]
    expect(payload.content).toContain('[[/skill customTable actor=Actor.actor1]]')
    expect(payload.content).not.toContain('12')
  })

  test('several actors share one card, each with their own targeted link', async () => {
    const torvald = mockActor()
    const anya = mockActor({ id: 'actor2', uuid: 'Actor.actor2', name: 'Anya' })
    await postRollRequest({ actors: [torvald, anya], checkValue: 'check:agl', dc: '10' })
    expect(globalThis.ChatMessage.create).toHaveBeenCalledTimes(1)
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('Judge asks these characters to roll:')
    expect(payload.content).toContain('[[/check agl 10 actor=Actor.actor1]]')
    expect(payload.content).toContain('[[/check agl 10 actor=Actor.actor2]]')
    expect(payload.content).toContain('>Torvald<')
    expect(payload.content).toContain('>Anya<')
    expect(payload.flags.dcc.rollRequest).toBe(true)
  })

  test('a single-actor `actors` array still posts the one-line card', async () => {
    await postRollRequest({ actors: [mockActor()], checkValue: 'check:agl' })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('Judge asks Torvald to roll:')
    expect(payload.content).not.toContain('dcc-roll-request-list')
  })

  test('per-actor DC handling applies within one group card', async () => {
    const table = mockActor({
      system: { skills: { divineAid: { label: 'DCC.DivineAid' } } }
    })
    const plain = mockActor({
      id: 'actor2',
      uuid: 'Actor.actor2',
      name: 'Anya',
      system: { skills: { divineAid: { label: 'DCC.DivineAid' } } }
    })
    globalThis.CONFIG.DCC.skillTables = {}
    plain.system.skills.divineAid.useDisapprovalRange = true
    await postRollRequest({ actors: [table, plain], checkValue: 'skill:divineAid', dc: 12 })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/skill divineAid 12 actor=Actor.actor1]]')
    expect(payload.content).toContain('[[/skill divineAid actor=Actor.actor2]]')
  })

  test('actors without the requested skill are dropped from the card and reported', async () => {
    const knows = mockActor({ itemTypes: { skill: [{ name: 'Nature Lore' }] } })
    const doesNot = mockActor({ id: 'actor2', uuid: 'Actor.actor2', name: 'Anya' })
    await postRollRequest({ actors: [knows, doesNot], checkValue: 'skill:Nature Lore' })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('actor=Actor.actor1')
    expect(payload.content).not.toContain('actor=Actor.actor2')
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(
      'No roll was requested for Anya — that skill is not on their sheet.'
    )
  })

  test('hostile actor names are HTML-escaped into the group card', async () => {
    const evil = mockActor({ name: '<img src=x onerror="alert(1)">' })
    const anya = mockActor({ id: 'actor2', uuid: 'Actor.actor2', name: 'Anya' })
    await postRollRequest({ actors: [evil, anya], checkValue: 'check:agl' })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).not.toContain('<img')
    expect(payload.content).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  test('a negative DC is dropped rather than shown on a link that ignores it', async () => {
    await postRollRequest({ actor: mockActor(), checkValue: 'check:agl', dc: -5 })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/check agl actor=Actor.actor1]]')
    expect(payload.content).not.toContain('-5')
  })

  test('no actor left to ask posts nothing', async () => {
    const result = await postRollRequest({ actors: [mockActor()], checkValue: 'skill:Nature Lore' })
    expect(result).toBeNull()
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled()
  })

  test('a malformed checkValue throws instead of posting a broken link', async () => {
    await expect(postRollRequest({ actor: mockActor(), checkValue: 'garbage' })).rejects.toThrow(/invalid checkValue/)
    await expect(postRollRequest({ actor: mockActor(), checkValue: 'save:ref' })).rejects.toThrow(/invalid checkValue/)
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled()
  })
})
