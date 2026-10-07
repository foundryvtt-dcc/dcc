/**
 * Unit coverage for module/friendly-fire.mjs. The Foundry-specific
 * dependencies (token/ally detection, the hit check, and the GM damage write)
 * are mocked; the real lib `checkFiringIntoMelee` classifies the outcome from
 * the queued Foundry roll naturals, so these tests exercise the genuine rule.
 */

/* global ChatMessage */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../integrations.mjs', () => ({ qolHandlingCombat: vi.fn(() => false) }))
vi.mock('../weapon-range.mjs', () => ({
  getFirstTargetDoc: vi.fn(),
  getAttackerTokenDoc: vi.fn(),
  getAlliesInMeleeWithTarget: vi.fn(() => [])
}))
vi.mock('../auto-apply-damage.mjs', () => ({
  attackHitsTarget: vi.fn(() => false), // default: the attack missed
  applyAutomatedCardDamage: vi.fn()
}))

const { qolHandlingCombat } = await import('../integrations.mjs')
const { getFirstTargetDoc, getAttackerTokenDoc, getAlliesInMeleeWithTarget } = await import('../weapon-range.mjs')
const { attackHitsTarget, applyAutomatedCardDamage } = await import('../auto-apply-damage.mjs')
const { maybeFriendlyFire, buildAllyAttackFormula } = await import('../friendly-fire.mjs')

let originalGame, originalRoll, originalChatMessage
let rollQueue
let created
let settings

// Deterministic Roll whose total is the next value queued by the test, in
// construction order (d100, then ally-index, ally-attack, damage).
class MockRoll {
  constructor (formula, data, options = {}) {
    this.formula = formula
    this.options = options
    this.total = rollQueue.length ? rollQueue.shift() : 0
  }

  async evaluate () { return this }
  toAnchor () { return { outerHTML: `<a class="roll">${this.total}</a>` } }
}

function ally (uuid, ac, name = uuid) {
  return { name, actor: { uuid, name, system: { attributes: { ac: { value: ac } } } } }
}

const actor = { getRollData: () => ({}) }
const rangedWeapon = { system: { melee: false, toHit: '+2', damage: '1d6' } }

beforeEach(() => {
  vi.clearAllMocks()
  rollQueue = []
  created = []
  settings = { automateFriendlyFire: true, autoApplyDamage: true }

  originalGame = globalThis.game
  originalRoll = globalThis.Roll
  originalChatMessage = globalThis.ChatMessage

  qolHandlingCombat.mockReturnValue(false)
  attackHitsTarget.mockReturnValue(false)
  getFirstTargetDoc.mockReturnValue({ actor: { system: { attributes: { ac: { value: 12 } } } } })
  getAttackerTokenDoc.mockReturnValue({ id: 'attacker' })
  getAlliesInMeleeWithTarget.mockReturnValue([])

  globalThis.Roll = MockRoll
  globalThis.ChatMessage = {
    create: vi.fn(async (data) => { created.push(data); return data }),
    getSpeaker: vi.fn(() => ({ alias: 'A' }))
  }
  globalThis.game = {
    user: { id: 'u1' },
    settings: { get: vi.fn((_scope, key) => settings[key]) },
    i18n: {
      localize: vi.fn(k => k),
      format: vi.fn((k, data) => `${k}:${JSON.stringify(data)}`)
    }
  }
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.Roll = originalRoll
  globalThis.ChatMessage = originalChatMessage
})

describe('buildAllyAttackFormula', () => {
  test('appends a signed bonus from the weapon toHit', () => {
    expect(buildAllyAttackFormula(actor, { system: { toHit: '+3' } })).toBe('1d20 +3')
  })
  test('inserts a plus for an unsigned bonus', () => {
    expect(buildAllyAttackFormula({ system: { details: { attackBonus: 1 } } }, { system: { toHit: '@ab' } })).toBe('1d20 + 1')
  })
  test('falls back to a bare d20 with no meaningful bonus', () => {
    expect(buildAllyAttackFormula(actor, { system: { toHit: '+0' } })).toBe('1d20')
    expect(buildAllyAttackFormula(actor, { system: {} })).toBe('1d20')
  })
})

describe('maybeFriendlyFire gates', () => {
  test('stands down when dcc-qol is active', async () => {
    qolHandlingCombat.mockReturnValue(true)
    await maybeFriendlyFire(actor, {}, { fumble: false, crit: false, hitsAc: 1 }, rangedWeapon)
    expect(ChatMessage.create).not.toHaveBeenCalled()
  })

  test('does nothing when the setting is off', async () => {
    settings.automateFriendlyFire = false
    await maybeFriendlyFire(actor, {}, {}, rangedWeapon)
    expect(ChatMessage.create).not.toHaveBeenCalled()
  })

  test('does nothing for a melee weapon', async () => {
    await maybeFriendlyFire(actor, {}, {}, { system: { melee: true } })
    expect(ChatMessage.create).not.toHaveBeenCalled()
  })

  test('does nothing without both tokens on the canvas', async () => {
    getFirstTargetDoc.mockReturnValue(null)
    await maybeFriendlyFire(actor, {}, {}, rangedWeapon)
    expect(ChatMessage.create).not.toHaveBeenCalled()
  })

  test('does nothing when the attack hit the target', async () => {
    attackHitsTarget.mockReturnValue(true)
    await maybeFriendlyFire(actor, {}, { hitsAc: 30 }, rangedWeapon)
    expect(ChatMessage.create).not.toHaveBeenCalled()
  })

  test("does nothing when the target's AC is unreadable (hit unknown, #978)", async () => {
    attackHitsTarget.mockReturnValue(undefined)
    await maybeFriendlyFire(actor, {}, { hitsAc: 5 }, rangedWeapon)
    expect(ChatMessage.create).not.toHaveBeenCalled()
  })

  test('does nothing when no ally is engaged with the target', async () => {
    getAlliesInMeleeWithTarget.mockReturnValue([])
    await maybeFriendlyFire(actor, {}, {}, rangedWeapon)
    expect(ChatMessage.create).not.toHaveBeenCalled()
  })
})

describe('maybeFriendlyFire resolution', () => {
  beforeEach(() => {
    getAlliesInMeleeWithTarget.mockReturnValue([ally('Actor.bob', 15, 'Bob')])
  })

  test('a d100 over 50 posts a safe card and rolls no stray attack', async () => {
    rollQueue = [75] // d100 only
    await maybeFriendlyFire(actor, {}, {}, rangedWeapon)
    expect(ChatMessage.create).toHaveBeenCalledTimes(1)
    expect(created[0].content).toContain('DCC.FriendlyFireSafe')
    expect(created[0].flags).toEqual({ 'dcc.isFriendlyFire': true })
  })

  test('a triggered check that hits the ally records it as the card target and applies the card damage', async () => {
    rollQueue = [30, 1, 25, 6] // d100, ally index, stray attack (>=15), damage
    await maybeFriendlyFire(actor, {}, {}, rangedWeapon)
    expect(created[0].content).toContain('DCC.FriendlyFireHits')
    expect(created[0].flags).toEqual({ 'dcc.isFriendlyFire': true, 'dcc.automated': true, 'dcc.hitsTarget': true, 'dcc.targetUuid': 'Actor.bob' })
    // The damage roll is tagged so the GM reads the amount from the card (#994).
    const damage = created[0].rolls.at(-1)
    expect(damage.total).toBe(6)
    expect(damage.options).toEqual({ dcc: { isDamageRoll: true } })
    expect(applyAutomatedCardDamage).toHaveBeenCalledWith(created[0])
  })

  test('a triggered check that misses the ally deals no damage', async () => {
    rollQueue = [30, 1, 8] // stray attack (8 < AC 15) → miss, no damage roll
    await maybeFriendlyFire(actor, {}, {}, rangedWeapon)
    expect(created[0].content).toContain('DCC.FriendlyFireMisses')
    expect(created[0].flags).toEqual({ 'dcc.isFriendlyFire': true })
  })

  test('errors are swallowed (a roll failure never breaks the attack)', async () => {
    globalThis.ChatMessage.create = vi.fn(async () => { throw new Error('boom') })
    rollQueue = [75]
    await expect(maybeFriendlyFire(actor, {}, {}, rangedWeapon)).resolves.toBeUndefined()
  })
})
