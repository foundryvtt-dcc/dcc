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
const { attackHitsTarget, autoApplyAttackDamage, registerAutoApplyDamageHandler } = await import('../auto-apply-damage.mjs')

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
  test('a crit always hits', () => {
    expect(attackHitsTarget({ fumble: false, crit: true, hitsAc: 1 }, targetActor(99))).toBe(true)
  })
  test('a normal attack hits when the total meets the target AC', () => {
    expect(attackHitsTarget({ fumble: false, crit: false, hitsAc: 15 }, targetActor(15))).toBe(true)
    expect(attackHitsTarget({ fumble: false, crit: false, hitsAc: 14 }, targetActor(15))).toBe(false)
  })
  test('no usable target AC → no hit', () => {
    expect(attackHitsTarget({ fumble: false, crit: false, hitsAc: 99 }, { system: {} })).toBe(false)
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
