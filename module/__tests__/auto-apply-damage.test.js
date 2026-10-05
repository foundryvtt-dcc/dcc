/**
 * Unit coverage for module/auto-apply-damage.mjs. The socket module is mocked
 * so executeAsGM calls and the registered GM-side handler can be inspected
 * without a Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../socket.mjs', () => ({
  executeAsGM: vi.fn(),
  registerSocketHandler: vi.fn()
}))

const { executeAsGM, registerSocketHandler } = await import('../socket.mjs')
const { attackHitsTarget, autoApplyAttackDamage, registerAutoApplyDamageHandler, cardAwaitsDamage, applyCardDamage, attachManualDamageAutoApply } = await import('../auto-apply-damage.mjs')

let originalGame
let originalFromUuid

function makeTargets (actor) {
  const set = new Set([{ actor }])
  set.first = () => [...set][0]
  return set
}

const targetActor = (ac, uuid = 'Actor.tgt') => ({ uuid, system: { attributes: { ac: { value: ac } } } })

beforeEach(() => {
  vi.clearAllMocks()
  originalGame = globalThis.game
  originalFromUuid = globalThis.fromUuid
  globalThis.game = {
    modules: { get: vi.fn(() => undefined) }, // dcc-qol inactive
    settings: { get: vi.fn(() => true) } // autoApplyDamage on
  }
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.fromUuid = originalFromUuid
})

describe('attackHitsTarget', () => {
  test('a fumble always misses', () => {
    expect(attackHitsTarget({ fumble: true, crit: false, hitsAc: 30 }, targetActor(10))).toBe(false)
  })
  test('a crit that misses the AC is a miss (#978)', () => {
    expect(attackHitsTarget({ fumble: false, crit: true, hitsAc: 1 }, targetActor(99))).toBe(false)
  })
  test('a natural max always hits', () => {
    expect(attackHitsTarget({ fumble: false, crit: true, autoHit: true, hitsAc: 1 }, targetActor(99))).toBe(true)
  })
  test("the lib's verdict wins when rollToHit had the target's AC", () => {
    expect(attackHitsTarget({ fumble: false, hitsTarget: true, hitsAc: 1 }, targetActor(99))).toBe(true)
    expect(attackHitsTarget({ fumble: false, hitsTarget: false, hitsAc: 30 }, targetActor(10))).toBe(false)
  })
  test('a fumble misses even with a hit verdict', () => {
    expect(attackHitsTarget({ fumble: true, hitsTarget: true, hitsAc: 30 }, targetActor(10))).toBe(false)
  })
  test('a normal attack hits when the total meets the target AC', () => {
    expect(attackHitsTarget({ fumble: false, crit: false, hitsAc: 15 }, targetActor(15))).toBe(true)
    expect(attackHitsTarget({ fumble: false, crit: false, hitsAc: 14 }, targetActor(15))).toBe(false)
  })
  test('no usable target AC → hit unknown (undefined), not a miss', () => {
    expect(attackHitsTarget({ fumble: false, crit: false, hitsAc: 99 }, { system: {} })).toBeUndefined()
    expect(attackHitsTarget({ fumble: false, crit: true, hitsAc: 99 }, { system: { attributes: { ac: { value: '' } } } })).toBeUndefined()
  })
  test('a fumble or natural max still decides the hit when the AC is unreadable', () => {
    expect(attackHitsTarget({ fumble: true, hitsAc: 99 }, { system: {} })).toBe(false)
    expect(attackHitsTarget({ fumble: false, autoHit: true, hitsAc: 1 }, { system: {} })).toBe(true)
  })
})

describe('autoApplyAttackDamage', () => {
  const hit = { fumble: false, crit: false, hitsAc: 18 }

  test('applies damage to the target via the GM on a hit', async () => {
    await autoApplyAttackDamage({ targets: makeTargets(targetActor(15)) }, hit, { total: 7 })
    expect(executeAsGM).toHaveBeenCalledWith('dcc.applyDamage', { actorUuid: 'Actor.tgt', amount: 7 })
  })

  test('stands down when dcc-qol is active', async () => {
    globalThis.game.modules.get.mockReturnValue({ active: true })
    await autoApplyAttackDamage({ targets: makeTargets(targetActor(15)) }, hit, { total: 7 })
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test('does nothing when the setting is off', async () => {
    globalThis.game.settings.get.mockReturnValue(false)
    await autoApplyAttackDamage({ targets: makeTargets(targetActor(15)) }, hit, { total: 7 })
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test('does nothing without positive damage', async () => {
    await autoApplyAttackDamage({ targets: makeTargets(targetActor(15)) }, hit, { total: 0 })
    await autoApplyAttackDamage({ targets: makeTargets(targetActor(15)) }, hit, undefined)
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test('does nothing on a miss', async () => {
    await autoApplyAttackDamage({ targets: makeTargets(targetActor(25)) }, { fumble: false, crit: false, hitsAc: 18 }, { total: 7 })
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test('does nothing without a target', async () => {
    await autoApplyAttackDamage({ targets: new Set() }, hit, { total: 7 })
    await autoApplyAttackDamage({}, hit, { total: 7 })
    expect(executeAsGM).not.toHaveBeenCalled()
  })
})

describe('registerAutoApplyDamageHandler', () => {
  test('registers a GM handler that resolves the target and applies damage', async () => {
    registerAutoApplyDamageHandler()
    expect(registerSocketHandler).toHaveBeenCalledWith('dcc.applyDamage', expect.any(Function))
    const handler = registerSocketHandler.mock.calls[0][1]

    const applyDamage = vi.fn()
    // a token-doc UUID resolves to a TokenDocument whose .actor is applied to
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Token', actor: { applyDamage } }))

    await handler({ actorUuid: 'Scene.s.Token.t.Actor.a', amount: 6 })

    expect(applyDamage).toHaveBeenCalledWith(6, 1)
  })

  test('the handler is a no-op for an unresolvable target', async () => {
    registerAutoApplyDamageHandler()
    const handler = registerSocketHandler.mock.calls[0][1]
    globalThis.fromUuid = vi.fn(async () => null)
    await expect(handler({ actorUuid: 'Actor.missing', amount: 6 })).resolves.toBeUndefined()
  })
})

describe('manual damage from an attack card (#992)', () => {
  function makeCard (flags = {}, extra = {}) {
    const store = { isToHit: true, hitsTarget: true, targetUuid: 'Actor.tgt', ...flags }
    return {
      id: 'card1',
      getFlag: (scope, key) => store[key],
      setFlag: vi.fn(async (scope, key, value) => { store[key] = value }),
      testUserPermission: vi.fn(() => false),
      ...extra
    }
  }
  const cardHandler = () => {
    registerAutoApplyDamageHandler()
    return registerSocketHandler.mock.calls.find(([action]) => action === 'dcc.applyCardDamage')[1]
  }

  test('a card awaits damage only when it hit a known target and none was applied', () => {
    expect(cardAwaitsDamage(makeCard())).toBe(true)
    expect(cardAwaitsDamage(makeCard({ hitsTarget: false }))).toBe(false)
    expect(cardAwaitsDamage(makeCard({ targetUuid: undefined }))).toBe(false)
    expect(cardAwaitsDamage(makeCard({ damageApplied: true }))).toBe(false)
    expect(cardAwaitsDamage(makeCard({ isToHit: false }))).toBe(false)
  })

  test('a card does not await damage with the setting off or dcc-qol active', () => {
    globalThis.game.settings.get.mockReturnValue(false)
    expect(cardAwaitsDamage(makeCard())).toBe(false)
    globalThis.game.settings.get.mockReturnValue(true)
    globalThis.game.modules.get.mockReturnValue({ active: true })
    expect(cardAwaitsDamage(makeCard())).toBe(false)
  })

  test('applyCardDamage asks the GM to apply the roll, minimum 1', async () => {
    await applyCardDamage(makeCard(), 7)
    expect(executeAsGM).toHaveBeenCalledWith('dcc.applyCardDamage', { messageId: 'card1', amount: 7 })
    await applyCardDamage(makeCard(), -2)
    expect(executeAsGM).toHaveBeenLastCalledWith('dcc.applyCardDamage', { messageId: 'card1', amount: 1 })
  })

  test('applyCardDamage does nothing for a card that missed', async () => {
    await applyCardDamage(makeCard({ hitsTarget: false }), 7)
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test("the GM handler applies once to the card's own target, for the card's owner", async () => {
    const card = makeCard({}, { testUserPermission: vi.fn(() => true) })
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    globalThis.game.messages = { get: () => card }
    globalThis.game.users = { get: () => ({ isGM: false }) }
    const handler = cardHandler()

    await handler({ messageId: 'card1', amount: 5, actorUuid: 'Actor.someoneElse' }, 'player')
    expect(globalThis.fromUuid).toHaveBeenCalledWith('Actor.tgt')
    expect(applyDamage).toHaveBeenCalledWith(5, 1)
    expect(card.setFlag).toHaveBeenCalledWith('dcc', 'damageApplied', true)

    await handler({ messageId: 'card1', amount: 5 }, 'player')
    expect(applyDamage).toHaveBeenCalledTimes(1) // never twice
  })

  test('two requests racing the flag write apply the damage once', async () => {
    const card = makeCard({}, { testUserPermission: vi.fn(() => true) })
    // The flag write is a server round trip: the card doesn't read as applied
    // until it resolves.
    let release
    card.setFlag = vi.fn(() => new Promise(resolve => { release = resolve }))
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    globalThis.game.messages = { get: () => card }
    globalThis.game.users = { get: () => ({ isGM: false }) }
    const handler = cardHandler()

    const first = handler({ messageId: 'card1', amount: 5 }, 'player')
    const second = handler({ messageId: 'card1', amount: 5 }, 'player')
    release()
    await Promise.all([first, second])

    expect(applyDamage).toHaveBeenCalledTimes(1)
  })

  test('the GM handler refuses a requester who does not own the card', async () => {
    const card = makeCard()
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    globalThis.game.messages = { get: () => card }
    globalThis.game.users = { get: () => ({ isGM: false }) }
    await cardHandler()({ messageId: 'card1', amount: 5 }, 'stranger')
    expect(applyDamage).not.toHaveBeenCalled()
    expect(card.setFlag).not.toHaveBeenCalled()
  })

  describe('plain-card inline damage roll', () => {
    let rolled
    beforeEach(() => {
      rolled = { total: 6, toMessage: vi.fn(async () => {}) }
      globalThis.Roll = { create: vi.fn(() => rolled) }
      globalThis.ChatMessage = { getSpeaker: vi.fn(() => ({ alias: 'A' })), getSpeakerActor: vi.fn(() => ({ getRollData: () => ({}) })) }
      globalThis.foundry = { dice: { Roll: { _mapLegacyRollMode: () => 'public' } } }
    })

    // Minimal element fakes (no DOM in the unit env): the card element keeps
    // its capture-phase click listener; the click targets an inline-roll anchor.
    function clickAnchor (card, { flavor = 'Damage', result = false } = {}) {
      let listener = null
      const html = { addEventListener: vi.fn((type, fn, opts) => { if (type === 'click' && opts?.capture) listener = fn }) }
      attachManualDamageAutoApply(card, html)
      const anchor = { dataset: { formula: '1d6', flavor, mode: 'roll' }, classList: { contains: (c) => result && c === 'inline-result' } }
      anchor.closest = (sel) => (sel === 'a.inline-roll' ? anchor : null)
      const event = { target: anchor, defaultPrevented: false, preventDefault () { this.defaultPrevented = true }, stopPropagation: vi.fn() }
      listener?.(event)
      return event
    }

    test('takes over the damage roll click and applies the result', async () => {
      const event = clickAnchor(makeCard())
      expect(event.defaultPrevented).toBe(true)
      await vi.waitFor(() => expect(executeAsGM).toHaveBeenCalledWith('dcc.applyCardDamage', { messageId: 'card1', amount: 6 }))
      expect(globalThis.Roll.create).toHaveBeenCalledWith('1d6', {})
      expect(rolled.toMessage).toHaveBeenCalledWith({ flavor: 'Damage', speaker: { alias: 'A' } }, { messageMode: 'public' })
    })

    test('leaves other inline rolls and already-rolled results to Foundry', () => {
      expect(clickAnchor(makeCard(), { flavor: 'Critical' }).defaultPrevented).toBe(false)
      expect(clickAnchor(makeCard(), { result: true }).defaultPrevented).toBe(false)
      expect(globalThis.Roll.create).not.toHaveBeenCalled()
    })

    test('a card that missed keeps the default inline roll', () => {
      expect(clickAnchor(makeCard({ hitsTarget: false })).defaultPrevented).toBe(false)
    })
  })
})
