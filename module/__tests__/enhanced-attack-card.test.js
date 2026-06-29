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
  test('lists range for missiles (damage formula is intentionally omitted, #786)', () => {
    expect(getWeaponProperties(weapon, {})).toEqual(['30/60/120'])
  })
  test('omits range and damage for melee weapons and adds a backstab tag', () => {
    const melee = { system: { melee: true, damage: '1d8', backstabDamage: '2d8' } }
    expect(getWeaponProperties(melee, { isBackstab: true })).toEqual(['DCC.Backstab'])
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

  test('automated falls back to the live setting for legacy cards (no stored flag)', async () => {
    settings.automateDamageFumblesCrits = true
    const msg = makeMessage({ isToHit: true }, { damageInlineRoll: '<a>7</a>', critResult: 'x' })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.automated).toBe(true)
    expect(data.damageInlineRoll).toBe('<a>7</a>')
  })

  // Issue #783: the card is rendered from the creation-time `automated` flag,
  // not the viewer's live (client-readable) setting, so every viewer sees the
  // same buttons-vs-results regardless of their own automation preference.
  test('stored automated:true flag wins over a manual live setting (auto-roll attacker, manual viewer)', async () => {
    settings.automateDamageFumblesCrits = false
    const msg = makeMessage({ isToHit: true, automated: true }, { damageInlineRoll: '<a>7</a>' })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.automated).toBe(true)
  })

  test('stored automated:false flag wins over an automatic live setting (manual attacker, auto viewer)', async () => {
    settings.automateDamageFumblesCrits = true
    const msg = makeMessage({ isToHit: true, automated: false }, { damageRollFormula: '1d6' })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.automated).toBe(false)
  })

  // Multiple action dice (Phase 3): the enhanced card surfaces the same
  // "Action N of M" line the plain card does, carried from stored system data.
  test('carries the multiple-action-dice chat line from stored system data', async () => {
    const msg = makeMessage({ isToHit: true }, { actionDiceChatLine: 'Action 2 of 3 (1d16)' })
    const data = await buildEnhancedCardData(msg, pcActor, weapon)
    expect(data.actionDiceChatLine).toBe('Action 2 of 3 (1d16)')
  })

  test('off-path: no action-dice line in system data ⇒ undefined (template renders nothing)', async () => {
    const data = await buildEnhancedCardData(makeMessage({ isToHit: true }), pcActor, weapon)
    expect(data.actionDiceChatLine).toBeUndefined()
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
  function getHandler () {
    registerEnhancedCardSocket()
    expect(registerSocketHandler).toHaveBeenCalledWith('dcc.updateMessageFlags', expect.any(Function))
    return registerSocketHandler.mock.calls[0][1]
  }

  test('a GM requester sets the allowlisted clicked flag', async () => {
    const handler = getHandler()
    const setFlag = vi.fn()
    globalThis.game.messages = { get: vi.fn(() => ({ setFlag, testUserPermission: () => false })) }
    globalThis.game.users = { get: vi.fn(() => ({ isGM: true })) }
    await handler({ messageId: 'm', key: 'damageButtonClicked' }, 'gm')
    expect(setFlag).toHaveBeenCalledWith('dcc', 'damageButtonClicked', true)
  })

  test('a non-GM owner of the message is allowed', async () => {
    const handler = getHandler()
    const setFlag = vi.fn()
    globalThis.game.messages = { get: vi.fn(() => ({ setFlag, testUserPermission: () => true })) }
    globalThis.game.users = { get: vi.fn(() => ({ isGM: false })) }
    await handler({ messageId: 'm', key: 'critButtonClicked' }, 'owner')
    expect(setFlag).toHaveBeenCalledWith('dcc', 'critButtonClicked', true)
  })

  test('rejects a non-allowlisted key (no arbitrary flag writes)', async () => {
    const handler = getHandler()
    const setFlag = vi.fn()
    globalThis.game.messages = { get: vi.fn(() => ({ setFlag, testUserPermission: () => true })) }
    globalThis.game.users = { get: vi.fn(() => ({ isGM: true })) }
    await handler({ messageId: 'm', key: 'isToHit' }, 'gm')
    expect(setFlag).not.toHaveBeenCalled()
  })

  test('rejects a non-GM non-owner requester', async () => {
    const handler = getHandler()
    const setFlag = vi.fn()
    globalThis.game.messages = { get: vi.fn(() => ({ setFlag, testUserPermission: () => false })) }
    globalThis.game.users = { get: vi.fn(() => ({ isGM: false })) }
    await handler({ messageId: 'm', key: 'damageButtonClicked' }, 'stranger')
    expect(setFlag).not.toHaveBeenCalled()
  })

  test('rejects when the sender id is unknown', async () => {
    const handler = getHandler()
    const setFlag = vi.fn()
    globalThis.game.messages = { get: vi.fn(() => ({ setFlag, testUserPermission: () => true })) }
    globalThis.game.users = { get: vi.fn(() => null) }
    await handler({ messageId: 'm', key: 'damageButtonClicked' }, 'ghost')
    expect(setFlag).not.toHaveBeenCalled()
  })
})
