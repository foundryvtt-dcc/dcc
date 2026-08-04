/**
 * Unit coverage for the GM roll-request helpers (issue #855).
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
  buildCheckOptions,
  buildRollRequestSource,
  getDefaultRequestActor,
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
  'DCC.RequestRollText': '{user} asks {actor} to roll:'
}

let original

beforeEach(() => {
  original = {
    game: globalThis.game,
    CONFIG: globalThis.CONFIG,
    canvas: globalThis.canvas,
    ChatMessage: globalThis.ChatMessage
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
      }
    }
  }
  globalThis.canvas = { tokens: { controlled: [] } }
  globalThis.ChatMessage = { create: vi.fn().mockResolvedValue({ id: 'msg' }) }
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.CONFIG = original.CONFIG
  globalThis.canvas = original.canvas
  globalThis.ChatMessage = original.ChatMessage
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

describe('getDefaultRequestActor', () => {
  test('first controlled PC token wins', () => {
    const npc = mockActor({ type: 'NPC' })
    const pc = mockActor()
    globalThis.canvas.tokens.controlled = [{ actor: npc }, { actor: pc }]
    expect(getDefaultRequestActor()).toBe(pc)
  })

  test('null when nothing suitable is controlled', () => {
    globalThis.canvas.tokens.controlled = [{ actor: null }]
    expect(getDefaultRequestActor()).toBeNull()
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
    expect(buildRollRequestSource({ type: 'skill', key: 'Weird]] "Skill"', label: 'a{b}c' }))
      .toBe('[[/skill "Weird Skill"]]{abc}')
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

  test('an empty DC field posts without a DC', async () => {
    const actor = mockActor()
    await postRollRequest({ actor, checkValue: 'check:lck', dc: '' })
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/check lck actor=Actor.actor1]]')
  })
})
