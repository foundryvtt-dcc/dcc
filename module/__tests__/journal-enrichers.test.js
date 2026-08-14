/**
 * Unit coverage for the journal roll-link enrichers (issue #794).
 *
 * The parser, key normalization, label/markup builders, and click
 * dispatchers are exported as pure(ish) functions; the assertions stub
 * `game` / `CONFIG` / `canvas` / `ui` / `ChatMessage` per-test so no DOM
 * or live Foundry boot is needed. The DOM-dependent surface (the enricher
 * callback and `onRender` wiring) is covered by the Playwright spec
 * `browser-tests/e2e/journal-enrichers.spec.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  DCC_ENRICHER_ID,
  ENRICHER_PATTERN,
  buildEnricherData,
  buildEnricherHtml,
  escapeHtml,
  handleEnricherRequestClick,
  handleEnricherRollClick,
  normalizeAbilityKey,
  normalizeSaveKey,
  parseEnricherConfig,
  registerJournalEnrichers,
  resolveEnricherActors,
  resolveTargetedEnricherActor,
  skillDisplayName
} from '../journal-enrichers.mjs'

const I18N = {
  'DCC.Check': 'Check',
  'DCC.Save': 'Save',
  'DCC.AbilityStr': 'Strength',
  'DCC.AbilityAgl': 'Agility',
  'DCC.AbilityLck': 'Luck',
  'DCC.SavesReflex': 'Reflex',
  'DCC.SavesFortitude': 'Fortitude',
  'DCC.SavesWill': 'Will',
  'DCC.EnricherRequestRoll': 'Request this roll in chat',
  'DCC.EnricherRequestText': 'Judge requests a roll:',
  'DCC.EnricherNoActorWarning': 'Select a token or assign a character to your user before clicking a roll link.',
  'DCC.EnricherActorMissingWarning': 'The actor for this roll link could not be found.',
  'DCC.EnricherNotOwnerWarning': 'You do not have permission to roll for {actor}.'
}

let original

beforeEach(() => {
  original = {
    game: globalThis.game,
    CONFIG: globalThis.CONFIG,
    canvas: globalThis.canvas,
    ui: globalThis.ui,
    ChatMessage: globalThis.ChatMessage,
    fromUuid: globalThis.fromUuid
  }
  globalThis.game = {
    i18n: {
      localize: vi.fn((key) => I18N[key] ?? key),
      format: vi.fn((key, data = {}) => {
        if (key === 'DCC.SaveDC') return `DC ${data.dc}`
        return (I18N[key] ?? key).replace(/{(\w+)}/g, (_, k) => data[k])
      })
    },
    user: { isGM: false, name: 'Tester', character: null }
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
      saves: {
        ref: 'DCC.SavesReflex',
        frt: 'DCC.SavesFortitude',
        wil: 'DCC.SavesWill'
      }
    },
    TextEditor: { enrichers: [] }
  }
  globalThis.canvas = { tokens: { controlled: [] } }
  globalThis.ui = { notifications: { warn: vi.fn() } }
  globalThis.ChatMessage = { create: vi.fn().mockResolvedValue({ id: 'msg' }) }
  globalThis.fromUuid = vi.fn().mockResolvedValue(null)
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.CONFIG = original.CONFIG
  globalThis.canvas = original.canvas
  globalThis.ui = original.ui
  globalThis.ChatMessage = original.ChatMessage
  globalThis.fromUuid = original.fromUuid
  vi.restoreAllMocks()
})

/** Build a mock actor exposing the three public roll methods. */
function mockActor (overrides = {}) {
  return {
    rollAbilityCheck: vi.fn().mockResolvedValue(undefined),
    rollSavingThrow: vi.fn().mockResolvedValue(undefined),
    rollSkillCheck: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

describe('ENRICHER_PATTERN', () => {
  test.each([
    ['[[/check agl 10]]', 'check', ' agl 10', undefined],
    ['[[/save ref 15]]', 'save', ' ref 15', undefined],
    ['[[/skill sneakSilently dc=12]]', 'skill', ' sneakSilently dc=12', undefined],
    ['[[/save frt 15]]{resist the poison}', 'save', ' frt 15', 'resist the poison'],
    ['[[/check lck]]', 'check', ' lck', undefined]
  ])('matches %s', (text, type, config, label) => {
    const match = [...text.matchAll(ENRICHER_PATTERN)][0]
    expect(match).toBeDefined()
    expect(match.groups.type).toBe(type)
    expect(match.groups.config).toBe(config)
    expect(match.groups.label).toBe(label)
  })

  test('does not match plain inline rolls or unknown commands', () => {
    expect([...'[[/r 1d20+2]]'.matchAll(ENRICHER_PATTERN)]).toHaveLength(0)
    expect([...'[[1d6]]'.matchAll(ENRICHER_PATTERN)]).toHaveLength(0)
  })

  test('requires a word boundary after the command — near-misses stay raw', () => {
    expect([...'[[/skills sneak]]'.matchAll(ENRICHER_PATTERN)]).toHaveLength(0)
    expect([...'[[/skillcheck x]]'.matchAll(ENRICHER_PATTERN)]).toHaveLength(0)
    expect([...'[[/checker agl]]'.matchAll(ENRICHER_PATTERN)]).toHaveLength(0)
  })
})

describe('parseEnricherConfig', () => {
  test('bare key and bare number', () => {
    expect(parseEnricherConfig(' agl 10')).toEqual({ key: 'agl', dc: '10' })
  })

  test('key=value pairs', () => {
    expect(parseEnricherConfig(' ability=agl dc=10 rollUnder=false'))
      .toEqual({ ability: 'agl', dc: '10', rollUnder: 'false' })
  })

  test('empty config', () => {
    expect(parseEnricherConfig('')).toEqual({})
    expect(parseEnricherConfig(undefined)).toEqual({})
  })

  test('first bare token wins as key', () => {
    expect(parseEnricherConfig(' ref extra')).toEqual({ key: 'ref' })
  })

  test('double quotes group multi-word values', () => {
    expect(parseEnricherConfig(' "Nature Lore" 12')).toEqual({ key: 'Nature Lore', dc: '12' })
    expect(parseEnricherConfig(' skill="Nature Lore" dc=12'))
      .toEqual({ skill: 'Nature Lore', dc: '12' })
  })

  test('actor uuid option parses intact', () => {
    expect(parseEnricherConfig(' agl 10 actor=Actor.abc123'))
      .toEqual({ key: 'agl', dc: '10', actor: 'Actor.abc123' })
  })
})

describe('key normalization', () => {
  test('abilities: canonical keys, full names, case-insensitive', () => {
    expect(normalizeAbilityKey('agl')).toBe('agl')
    expect(normalizeAbilityKey('Agility')).toBe('agl')
    expect(normalizeAbilityKey('LUCK')).toBe('lck')
    expect(normalizeAbilityKey('dex')).toBeNull()
  })

  test('saves: canonical keys, full names, fort alias', () => {
    expect(normalizeSaveKey('ref')).toBe('ref')
    expect(normalizeSaveKey('Reflex')).toBe('ref')
    expect(normalizeSaveKey('fort')).toBe('frt')
    expect(normalizeSaveKey('Fortitude')).toBe('frt')
    expect(normalizeSaveKey('str')).toBeNull()
  })
})

describe('skillDisplayName', () => {
  test.each([
    ['sneakSilently', 'Sneak Silently'],
    ['findTrap', 'Find Trap'],
    ['pick-locks', 'Pick Locks'],
    ['climb', 'Climb']
  ])('%s → %s', (id, expected) => {
    expect(skillDisplayName(id)).toBe(expected)
  })
})

describe('buildEnricherData', () => {
  test('ability check with DC', () => {
    expect(buildEnricherData({ type: 'check', config: ' agl 10' })).toEqual({
      type: 'check',
      key: 'agl',
      dc: 10,
      rollUnder: false,
      actorUuid: null,
      displayLabel: 'DC 10 Agility Check'
    })
  })

  test('luck check defaults to roll-under', () => {
    const data = buildEnricherData({ type: 'check', config: ' lck' })
    expect(data.rollUnder).toBe(true)
    expect(data.dc).toBeNull()
    expect(data.displayLabel).toBe('Luck Check')
  })

  test('rollUnder=false opts a luck check out of roll-under', () => {
    expect(buildEnricherData({ type: 'check', config: ' lck rollUnder=false' }).rollUnder).toBe(false)
  })

  test('saving throw via key=value form', () => {
    expect(buildEnricherData({ type: 'save', config: ' save=ref dc=15' })).toEqual({
      type: 'save',
      key: 'ref',
      dc: 15,
      rollUnder: false,
      actorUuid: null,
      displayLabel: 'DC 15 Reflex Save'
    })
  })

  test('actor option is carried through as actorUuid', () => {
    const data = buildEnricherData({ type: 'check', config: ' agl 10 actor=Actor.abc123' })
    expect(data.actorUuid).toBe('Actor.abc123')
  })

  test('skill check keeps the raw id and prettifies the label', () => {
    expect(buildEnricherData({ type: 'skill', config: ' sneakSilently dc=12' })).toEqual({
      type: 'skill',
      key: 'sneakSilently',
      dc: 12,
      rollUnder: false,
      actorUuid: null,
      displayLabel: 'DC 12 Sneak Silently Check'
    })
  })

  test('custom label wins over the generated one', () => {
    expect(buildEnricherData({ type: 'save', config: ' frt 15', label: 'resist the poison' }).displayLabel)
      .toBe('resist the poison')
  })

  test('invalid or missing keys leave the raw text alone (null)', () => {
    expect(buildEnricherData({ type: 'check', config: ' dex 10' })).toBeNull()
    expect(buildEnricherData({ type: 'save', config: ' agl' })).toBeNull()
    expect(buildEnricherData({ type: 'check', config: '' })).toBeNull()
  })
})

describe('buildEnricherHtml', () => {
  test('roll anchor carries the dispatch data attributes', () => {
    const html = buildEnricherHtml(buildEnricherData({ type: 'check', config: ' agl 10' }))
    expect(html).toContain('data-action="dccRoll"')
    expect(html).toContain('data-roll-type="check"')
    expect(html).toContain('data-key="agl"')
    expect(html).toContain('data-dc="10"')
    expect(html).not.toContain('data-roll-under')
    expect(html).toContain('DC 10 Agility Check')
    expect(html).not.toContain('dccRequest')
  })

  test('roll-under flag serializes for luck checks', () => {
    const html = buildEnricherHtml(buildEnricherData({ type: 'check', config: ' lck' }))
    expect(html).toContain('data-roll-under="true"')
  })

  test('actor targeting serializes as data-actor-uuid', () => {
    const html = buildEnricherHtml(buildEnricherData({ type: 'check', config: ' agl actor=Actor.abc123' }))
    expect(html).toContain('data-actor-uuid="Actor.abc123"')
  })

  test('GM gets the chat-bubble request anchor with the raw source', () => {
    const html = buildEnricherHtml(
      buildEnricherData({ type: 'save', config: ' ref 15' }),
      { isGM: true, source: '[[/save ref 15]]' }
    )
    expect(html).toContain('data-action="dccRequest"')
    expect(html).toContain('data-source="[[/save ref 15]]"')
    expect(html).toContain('fa-comment')
  })

  test('labels and sources are HTML-escaped', () => {
    const data = buildEnricherData({ type: 'save', config: ' ref', label: '<b>"sneaky"</b>' })
    const html = buildEnricherHtml(data, { isGM: true, source: '[[/save ref]]{<b>"sneaky"</b>}' })
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;&quot;sneaky&quot;&lt;/b&gt;')
  })
})

describe('escapeHtml', () => {
  test('escapes markup-significant characters', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
    expect(escapeHtml(null)).toBe('')
  })
})

describe('resolveEnricherActors', () => {
  test('controlled token actors, deduplicated', () => {
    const actor = mockActor()
    globalThis.canvas.tokens.controlled = [{ actor }, { actor }, { actor: null }]
    expect(resolveEnricherActors()).toEqual([actor])
  })

  test('falls back to the assigned character', () => {
    const character = mockActor()
    globalThis.game.user.character = character
    expect(resolveEnricherActors()).toEqual([character])
  })

  test('empty when nothing is controlled or assigned', () => {
    expect(resolveEnricherActors()).toEqual([])
  })
})

describe('handleEnricherRollClick', () => {
  test('ability check dispatches rollAbilityCheck with dc and rollUnder', async () => {
    const actor = mockActor()
    globalThis.canvas.tokens.controlled = [{ actor }]
    await handleEnricherRollClick({ dataset: { rollType: 'check', key: 'agl', dc: '10' } })
    expect(actor.rollAbilityCheck).toHaveBeenCalledWith('agl', { dc: 10, showDc: true, rollUnder: false })
  })

  test('luck check passes rollUnder true', async () => {
    const actor = mockActor()
    globalThis.canvas.tokens.controlled = [{ actor }]
    await handleEnricherRollClick({ dataset: { rollType: 'check', key: 'lck', rollUnder: 'true' } })
    expect(actor.rollAbilityCheck).toHaveBeenCalledWith('lck', { rollUnder: true })
  })

  test('save dispatches rollSavingThrow with the DC display options', async () => {
    const actor = mockActor()
    globalThis.canvas.tokens.controlled = [{ actor }]
    await handleEnricherRollClick({ dataset: { rollType: 'save', key: 'ref', dc: '15' } })
    expect(actor.rollSavingThrow).toHaveBeenCalledWith('ref', { dc: 15, showDc: true })
  })

  test('skill dispatches rollSkillCheck for every controlled actor', async () => {
    const first = mockActor()
    const second = mockActor()
    globalThis.canvas.tokens.controlled = [{ actor: first }, { actor: second }]
    await handleEnricherRollClick({ dataset: { rollType: 'skill', key: 'sneakSilently' } })
    expect(first.rollSkillCheck).toHaveBeenCalledWith('sneakSilently', {})
    expect(second.rollSkillCheck).toHaveBeenCalledWith('sneakSilently', {})
  })

  test('warns when no token is controlled and no character assigned', async () => {
    await handleEnricherRollClick({ dataset: { rollType: 'check', key: 'agl' } })
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(
      I18N['DCC.EnricherNoActorWarning']
    )
  })

  test('actor-targeted link rolls for exactly that actor', async () => {
    const target = mockActor({ isOwner: true })
    const controlled = mockActor()
    globalThis.canvas.tokens.controlled = [{ actor: controlled }]
    globalThis.fromUuid.mockResolvedValue(target)
    await handleEnricherRollClick({
      dataset: { rollType: 'check', key: 'agl', dc: '10', actorUuid: 'Actor.abc123' }
    })
    expect(globalThis.fromUuid).toHaveBeenCalledWith('Actor.abc123')
    expect(target.rollAbilityCheck).toHaveBeenCalledWith('agl', { dc: 10, showDc: true, rollUnder: false })
    expect(controlled.rollAbilityCheck).not.toHaveBeenCalled()
  })

  test('actor-targeted skill link unwraps a token uuid to its actor', async () => {
    const target = mockActor({ isOwner: true })
    globalThis.fromUuid.mockResolvedValue({ actor: target })
    await handleEnricherRollClick({
      dataset: { rollType: 'skill', key: 'Nature Lore', actorUuid: 'Scene.a.Token.b' }
    })
    expect(target.rollSkillCheck).toHaveBeenCalledWith('Nature Lore', {})
  })
})

describe('resolveTargetedEnricherActor', () => {
  test('warns and yields null when the actor cannot be found', async () => {
    globalThis.fromUuid.mockResolvedValue(null)
    expect(await resolveTargetedEnricherActor('Actor.gone')).toBeNull()
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(
      I18N['DCC.EnricherActorMissingWarning']
    )
  })

  test('warns and yields null when the user does not own the actor', async () => {
    const target = mockActor({ isOwner: false, name: 'Torvald' })
    globalThis.fromUuid.mockResolvedValue(target)
    expect(await resolveTargetedEnricherActor('Actor.abc123')).toBeNull()
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(
      'You do not have permission to roll for Torvald.'
    )
    expect(target.rollAbilityCheck).not.toHaveBeenCalled()
  })

  test('resolves an owned actor', async () => {
    const target = mockActor({ isOwner: true })
    globalThis.fromUuid.mockResolvedValue(target)
    expect(await resolveTargetedEnricherActor('Actor.abc123')).toBe(target)
  })
})

describe('handleEnricherRequestClick', () => {
  test('posts a chat card containing the raw enricher text', async () => {
    await handleEnricherRequestClick({ dataset: { source: '[[/save ref 15]]{resist}' } })
    expect(globalThis.ChatMessage.create).toHaveBeenCalledTimes(1)
    const payload = globalThis.ChatMessage.create.mock.calls[0][0]
    expect(payload.content).toContain('[[/save ref 15]]{resist}')
    expect(payload.content).toContain('Judge requests a roll:')
    expect(payload.flags.dcc.rollRequest).toBe(true)
  })

  test('does nothing without a source', async () => {
    await handleEnricherRequestClick({ dataset: {} })
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled()
  })
})

describe('registerJournalEnrichers', () => {
  test('pushes the enricher config onto CONFIG.TextEditor.enrichers', () => {
    registerJournalEnrichers()
    expect(globalThis.CONFIG.TextEditor.enrichers).toHaveLength(1)
    const config = globalThis.CONFIG.TextEditor.enrichers[0]
    expect(config.id).toBe(DCC_ENRICHER_ID)
    expect(config.pattern).toBe(ENRICHER_PATTERN)
    expect(typeof config.enricher).toBe('function')
    expect(typeof config.onRender).toBe('function')
  })
})
