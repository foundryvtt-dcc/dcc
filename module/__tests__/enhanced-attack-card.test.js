/**
 * Unit coverage for module/chat/enhanced-attack-card.mjs. The integrations
 * guard and the socket module are mocked; Foundry globals (game, settings,
 * i18n) are stubbed. Focuses on the pure-ish surface: the render gate, actor
 * resolution, weapon properties, the template-data builder (hit/miss + button
 * gating), and the GM flag socket handler.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../integrations.mjs', () => ({ qolHandlingCombat: vi.fn(() => false) }))
vi.mock('../socket.mjs', () => ({ executeAsGM: vi.fn(), registerSocketHandler: vi.fn() }))

const { qolHandlingCombat } = await import('../integrations.mjs')
const { registerSocketHandler } = await import('../socket.mjs')
const {
  shouldRenderEnhancedAttackCard,
  resolveAttackActor,
  getWeaponProperties,
  buildEnhancedCardData,
  registerEnhancedCardSocket
} = await import('../chat/enhanced-attack-card.mjs')

let originalGame
let originalChatMessage
let settings

function makeMessage (flags = {}, system = {}, extra = {}) {
  return {
    id: 'msg1',
    isAuthor: true,
    speaker: {},
    system: { actorId: 'a1', weaponId: 'w1', ...system },
    rolls: [{ render: async () => '<div class="full-roll"></div>', toAnchor: () => ({ outerHTML: '<a>15</a>' }) }],
    getFlag: (scope, key) => flags[key],
    ...extra
  }
}

const weapon = { name: 'Bow', img: 'bow.png', system: { melee: false, range: '30/60/120', damage: '1d6', backstabDamage: '' } }
const pcActor = { name: 'Hero', img: 'hero.png', type: 'Player', items: { get: () => weapon }, canUserModify: () => true }

beforeEach(() => {
  vi.clearAllMocks()
  qolHandlingCombat.mockReturnValue(false)
  settings = { enhancedAttackCards: true, automateDamageFumblesCrits: false, showHitMissOnCard: true, attackCardFormat: 'full' }
  originalGame = globalThis.game
  originalChatMessage = globalThis.ChatMessage
  globalThis.ChatMessage = { getSpeakerActor: vi.fn(() => null), getSpeaker: vi.fn(() => ({})) }
  globalThis.game = {
    user: { isGM: false },
    settings: { get: vi.fn((_s, key) => settings[key]) },
    i18n: { localize: vi.fn(k => k), format: vi.fn((k, d) => `${k}:${JSON.stringify(d)}`) },
    dcc: { buildMightyDeedPrompt: vi.fn(() => '<div class="deed"></div>') },
    actors: { get: vi.fn(() => pcActor) },
    scenes: { get: vi.fn() }
  }
})

afterEach(() => { globalThis.game = originalGame; globalThis.ChatMessage = originalChatMessage })

describe('shouldRenderEnhancedAttackCard', () => {
  test('true for an attack message with the setting on and dcc-qol inactive', () => {
    expect(shouldRenderEnhancedAttackCard(makeMessage({ isToHit: true }))).toBe(true)
  })
  test('false when dcc-qol is active', () => {
    qolHandlingCombat.mockReturnValue(true)
    expect(shouldRenderEnhancedAttackCard(makeMessage({ isToHit: true }))).toBe(false)
  })
  test('false when the setting is off', () => {
    settings.enhancedAttackCards = false
    expect(shouldRenderEnhancedAttackCard(makeMessage({ isToHit: true }))).toBe(false)
  })
  test('false for a non-attack message', () => {
    expect(shouldRenderEnhancedAttackCard(makeMessage({}))).toBe(false)
  })
})

describe('resolveAttackActor', () => {
  test('falls back to system.actorId when there is no token speaker', () => {
    expect(resolveAttackActor(makeMessage())).toBe(pcActor)
  })
  test('prefers the token speaker actor', () => {
    const tokenActor = { name: 'Token' }
    globalThis.game.scenes.get = vi.fn(() => ({ tokens: { get: () => ({ actor: tokenActor }) } }))
    const msg = makeMessage({}, {}, { speaker: { scene: 's1', token: 't1' } })
    expect(resolveAttackActor(msg)).toBe(tokenActor)
  })
})

describe('getWeaponProperties', () => {
  test('lists damage and (for missiles) range', () => {
    expect(getWeaponProperties(weapon, {})).toEqual(['1d6', '30/60/120'])
  })
  test('omits range for melee weapons and adds a backstab tag', () => {
    const melee = { system: { melee: true, damage: '1d8', backstabDamage: '2d8' } }
    expect(getWeaponProperties(melee, { isBackstab: true })).toEqual(['1d8', 'DCC.Backstab'])
  })
  test('empty for no weapon', () => {
    expect(getWeaponProperties(null, {})).toEqual([])
  })
})

describe('buildEnhancedCardData', () => {
  test('hit vs target: hit banner, damage button allowed, not suppressed', async () => {
    const msg = makeMessage({ isToHit: true, hasTarget: true, hitsTarget: true, targetName: 'Goblin' }, { hitsAc: 18 })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.hitsTarget).toBe(true)
    expect(data.suppressDamage).toBe(false)
    expect(data.automated).toBe(false)
    expect(data.isPC).toBe(true)
    expect(data.diceHTML).toBe('<div class="full-roll"></div>')
    expect(data.flavorText).toContain('DCC.AttacksWith')
  })

  test('miss vs target suppresses the damage button', async () => {
    const msg = makeMessage({ isToHit: true, hasTarget: true, hitsTarget: false, targetName: 'Goblin' })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.suppressDamage).toBe(true)
  })

  test('crit always allows damage even with the hits flag unset', async () => {
    const msg = makeMessage({ isToHit: true, hasTarget: true, hitsTarget: false, isCrit: true })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.suppressDamage).toBe(false)
  })

  test('compact format uses the die anchor for diceHTML', async () => {
    settings.attackCardFormat = 'compact'
    const data = await buildEnhancedCardData(makeMessage({ isToHit: true }), pcActor, weapon)
    expect(data.compact).toBe(true)
    expect(data.diceHTML).toBe('<a>15</a>')
  })

  test('automated reads the setting and surfaces rolled fields', async () => {
    settings.automateDamageFumblesCrits = true
    const msg = makeMessage({ isToHit: true }, { damageInlineRoll: '<a>7</a>', critResult: 'x' })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.automated).toBe(true)
    expect(data.damageInlineRoll).toBe('<a>7</a>')
  })

  test('NPC attacker: no weapon description exposed', async () => {
    const npc = { ...pcActor, type: 'NPC' }
    const withDesc = { ...weapon, system: { ...weapon.system, description: { value: 'desc' } } }
    const data = await buildEnhancedCardData(makeMessage({ isToHit: true }), npc, withDesc)
    expect(data.isPC).toBe(false)
    expect(data.hasDescription).toBe(false)
  })
})

describe('registerEnhancedCardSocket', () => {
  test('registers a GM handler that sets the dcc flag on the named message', async () => {
    registerEnhancedCardSocket()
    expect(registerSocketHandler).toHaveBeenCalledWith('dcc.updateMessageFlags', expect.any(Function))
    const handler = registerSocketHandler.mock.calls[0][1]
    const setFlag = vi.fn()
    globalThis.game.messages = { get: vi.fn(() => ({ setFlag })) }
    await handler({ messageId: 'm', key: 'damageButtonClicked', value: true })
    expect(setFlag).toHaveBeenCalledWith('dcc', 'damageButtonClicked', true)
  })
})
