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
const { attackHitsTarget, applyAutomatedCardDamage, registerAutoApplyDamageHandler, cardAwaitsDamage, canApplyCardDamage, applyCardDamage, attachManualDamageAutoApply } = await import('../auto-apply-damage.mjs')

let originalGame
let originalFromUuid

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

describe('manual damage from an attack card (#992)', () => {
  let originalChatMessage
  let speakerActor
  beforeEach(() => {
    originalChatMessage = globalThis.ChatMessage
    speakerActor = null
    globalThis.ChatMessage = { getSpeakerActor: vi.fn(() => speakerActor), getSpeaker: vi.fn(() => ({ alias: 'Clicker' })) }
    globalThis.game.user = { isGM: true }
  })
  afterEach(() => {
    globalThis.ChatMessage = originalChatMessage
  })

  function makeCard (flags = {}, extra = {}) {
    const store = { isToHit: true, hitsTarget: true, targetUuid: 'Actor.tgt', ...flags }
    return {
      id: 'card1',
      speaker: { alias: 'Attacker' },
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
    expect(cardAwaitsDamage(makeCard({ automated: true }))).toBe(false) // applied at attack time already
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

  test('the GM, the card author, and owners of the attacking character may apply it', () => {
    const player = { isGM: false }
    expect(canApplyCardDamage(makeCard(), { isGM: true })).toBe(true)
    expect(canApplyCardDamage(makeCard({}, { testUserPermission: () => true }), player)).toBe(true)
    speakerActor = { testUserPermission: (user, level) => user === player && level === 'OWNER' }
    expect(canApplyCardDamage(makeCard(), player)).toBe(true) // GM rolled the attack for this player's PC
    speakerActor = { testUserPermission: () => false }
    expect(canApplyCardDamage(makeCard(), player)).toBe(false)
    expect(canApplyCardDamage(makeCard(), null)).toBe(false)
  })

  test('applyCardDamage does not ask the GM for a user who may not apply it', async () => {
    globalThis.game.user = { isGM: false }
    speakerActor = { testUserPermission: () => false }
    await applyCardDamage(makeCard(), 7)
    expect(executeAsGM).not.toHaveBeenCalled()
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
    await vi.waitFor(() => expect(card.setFlag).toHaveBeenCalled())
    release()
    await Promise.all([first, second])

    expect(applyDamage).toHaveBeenCalledTimes(1)
  })

  test('a target deleted since the attack leaves the card unapplied', async () => {
    const card = makeCard({}, { testUserPermission: vi.fn(() => true) })
    globalThis.fromUuid = vi.fn(async () => null)
    globalThis.game.messages = { get: () => card }
    globalThis.game.users = { get: () => ({ isGM: true }) }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await cardHandler()({ messageId: 'card1', amount: 5 }, 'gm')
    expect(card.setFlag).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  test('the GM handler accepts an owner of the attacking character', async () => {
    const card = makeCard() // authored by the GM
    const player = { isGM: false }
    speakerActor = { testUserPermission: (user) => user === player }
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    globalThis.game.messages = { get: () => card }
    globalThis.game.users = { get: () => player }
    await cardHandler()({ messageId: 'card1', amount: 5 }, 'player')
    expect(applyDamage).toHaveBeenCalledWith(5, 1)
  })

  test('the GM handler refuses a requester who owns neither the card nor the character', async () => {
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
      speakerActor = { getRollData: () => ({ str: 2 }), testUserPermission: () => false }
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
      // Posted as the attacker with the attacker's roll data, not the clicker's token.
      expect(globalThis.Roll.create).toHaveBeenCalledWith('1d6', { str: 2 })
      expect(rolled.toMessage).toHaveBeenCalledWith({ flavor: 'Damage', speaker: { alias: 'Attacker' } }, { messageMode: 'public' })
    })

    test('a viewer who may not apply it keeps the default inline roll', () => {
      globalThis.game.user = { isGM: false }
      expect(clickAnchor(makeCard()).defaultPrevented).toBe(false)
    })

    test('leaves other inline rolls and already-rolled results to Foundry', () => {
      expect(clickAnchor(makeCard(), { flavor: 'Critical' }).defaultPrevented).toBe(false)
      expect(clickAnchor(makeCard(), { result: true }).defaultPrevented).toBe(false)
      expect(globalThis.Roll.create).not.toHaveBeenCalled()
    })

    test('a roll that throws tells the user instead of failing silently', async () => {
      globalThis.Roll = { create: vi.fn(() => { throw new Error('bad formula') }) }
      const originalUI = globalThis.ui
      globalThis.ui = { notifications: { error: vi.fn() } }
      globalThis.game.i18n = { localize: k => k, format: k => k }
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        clickAnchor(makeCard())
        await vi.waitFor(() => expect(globalThis.ui.notifications.error).toHaveBeenCalled())
        expect(executeAsGM).not.toHaveBeenCalled()
      } finally {
        globalThis.ui = originalUI
        err.mockRestore()
      }
    })

    test('a card that missed keeps the default inline roll', () => {
      expect(clickAnchor(makeCard({ hitsTarget: false })).defaultPrevented).toBe(false)
    })
  })
})

describe('automated card damage (#994)', () => {
  let originalChatMessage
  beforeEach(() => {
    originalChatMessage = globalThis.ChatMessage
    globalThis.ChatMessage = { getSpeakerActor: vi.fn(() => null) }
    globalThis.game.user = { isGM: false }
  })
  afterEach(() => {
    globalThis.ChatMessage = originalChatMessage
  })

  const damageRoll = (total) => ({ total, options: { dcc: { isDamageRoll: true } } })
  function makeAutomatedCard (flags = {}, { rolls = [{ total: 19, options: {} }, damageRoll(7)], owner = true } = {}) {
    const store = { isToHit: true, automated: true, hitsTarget: true, targetUuid: 'Actor.tgt', ...flags }
    return {
      id: 'card2',
      speaker: {},
      rolls,
      getFlag: (scope, key) => store[key],
      setFlag: vi.fn(async (scope, key, value) => { store[key] = value }),
      testUserPermission: vi.fn(() => owner)
    }
  }
  const handlerFor = (card, sender = { isGM: false }) => {
    globalThis.game.messages = { get: (id) => (id === card.id ? card : undefined) }
    globalThis.game.users = { get: () => sender }
    registerAutoApplyDamageHandler()
    return registerSocketHandler.mock.calls.find(([action]) => action === 'dcc.applyCardDamage')[1]
  }

  test('only the card-based action is registered; the raw dcc.applyDamage action is gone', () => {
    registerAutoApplyDamageHandler()
    expect(registerSocketHandler.mock.calls.map(([action]) => action)).toEqual(['dcc.applyCardDamage'])
  })

  test('asks the GM to apply the card by id only — no target or amount in the request', async () => {
    await applyAutomatedCardDamage(makeAutomatedCard())
    expect(executeAsGM).toHaveBeenCalledWith('dcc.applyCardDamage', { messageId: 'card2' })
  })

  test('does nothing for a miss, a manual card, no damage roll, a cancelled card, or a non-owner', async () => {
    await applyAutomatedCardDamage(makeAutomatedCard({ hitsTarget: false }))
    await applyAutomatedCardDamage(makeAutomatedCard({ automated: false }))
    await applyAutomatedCardDamage(makeAutomatedCard({}, { rolls: [{ total: 19, options: {} }] }))
    await applyAutomatedCardDamage(undefined)
    await applyAutomatedCardDamage(makeAutomatedCard({}, { owner: false }))
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test('stands down with the setting off or dcc-qol active', async () => {
    globalThis.game.settings.get.mockReturnValue(false)
    await applyAutomatedCardDamage(makeAutomatedCard())
    globalThis.game.settings.get.mockReturnValue(true)
    globalThis.game.modules.get.mockReturnValue({ active: true })
    await applyAutomatedCardDamage(makeAutomatedCard())
    expect(executeAsGM).not.toHaveBeenCalled()
  })

  test("the GM applies the card's own damage roll to the card's own target, ignoring the payload", async () => {
    const card = makeAutomatedCard()
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Token', actor: { applyDamage } }))
    const handler = handlerFor(card)

    await handler({ messageId: 'card2', amount: 999, actorUuid: 'Actor.someoneElse' }, 'player')
    expect(globalThis.fromUuid).toHaveBeenCalledWith('Actor.tgt')
    expect(applyDamage).toHaveBeenCalledWith(7, 1)
    expect(card.setFlag).toHaveBeenCalledWith('dcc', 'damageApplied', true)

    await handler({ messageId: 'card2' }, 'player')
    expect(applyDamage).toHaveBeenCalledTimes(1)
  })

  test('clearing the damageApplied flag does not let the author apply the card again', async () => {
    const card = makeAutomatedCard()
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    const handler = handlerFor(card)
    await handler({ messageId: 'card2' }, 'player')
    await card.setFlag('dcc', 'damageApplied', false) // the author rewrites their own card
    await handler({ messageId: 'card2' }, 'player')
    expect(applyDamage).toHaveBeenCalledTimes(1)
  })

  test('the GM refuses a non-numeric manual amount', async () => {
    const card = makeAutomatedCard({ automated: false })
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    const handler = handlerFor(card)
    await handler({ messageId: 'card2', amount: '1e6' }, 'player')
    await handler({ messageId: 'card2', amount: Infinity }, 'player')
    expect(applyDamage).not.toHaveBeenCalled()
    await handler({ messageId: 'card2', amount: 4 }, 'player')
    expect(applyDamage).toHaveBeenCalledWith(4, 1)
  })

  test('the GM refuses a requester who owns neither the card nor the attacker', async () => {
    const card = makeAutomatedCard({}, { owner: false })
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    await handlerFor(card)({ messageId: 'card2' }, 'stranger')
    expect(applyDamage).not.toHaveBeenCalled()
  })

  test('the GM ignores an unknown card, and a card that is neither an attack nor friendly fire', async () => {
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    const handler = handlerFor(makeAutomatedCard({ isToHit: false }))
    await handler({ messageId: 'card2' }, 'player')
    await handler({ messageId: 'nope', amount: 5 }, 'player')
    expect(applyDamage).not.toHaveBeenCalled()
  })

  test('a friendly-fire card applies its damage roll to the struck ally', async () => {
    const card = makeAutomatedCard({ isToHit: undefined, isFriendlyFire: true, targetUuid: 'Actor.ally' }, { rolls: [{ total: 30, options: {} }, damageRoll(4)] })
    const applyDamage = vi.fn()
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    await applyAutomatedCardDamage(card)
    expect(executeAsGM).toHaveBeenCalledWith('dcc.applyCardDamage', { messageId: 'card2' })
    await handlerFor(card)({ messageId: 'card2' }, 'player')
    expect(globalThis.fromUuid).toHaveBeenCalledWith('Actor.ally')
    expect(applyDamage).toHaveBeenCalledWith(4, 1)
  })

  test('an automated card never awaits a manual damage roll', () => {
    expect(cardAwaitsDamage(makeAutomatedCard())).toBe(false)
    expect(cardAwaitsDamage(makeAutomatedCard({ isToHit: undefined, isFriendlyFire: true, automated: false }))).toBe(false)
  })
})
