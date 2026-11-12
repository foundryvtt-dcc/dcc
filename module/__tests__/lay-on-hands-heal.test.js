/**
 * Unit coverage for module/lay-on-hands-heal.mjs (#966): reading the dice
 * counts from the active table, the subject's hit dice, the card record, and
 * the GM-side heal. The socket module is mocked so the handler can be called
 * directly.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../socket.mjs', () => ({
  executeAsGM: vi.fn(),
  registerSocketHandler: vi.fn()
}))

const {
  alignmentRelation,
  parseLayOnHandsDice,
  subjectHitDice,
  buildLayOnHandsHealFlag,
  layOnHandsHealHtml,
  layOnHandsHealHandler
} = await import('../lay-on-hands-heal.mjs')

/** A result in the shape of the core book's Lay on Hands table. */
const resultHtml = (same, adjacent, opposed) => `<table class="tg"> <thead> <tr><th>Alignment</th><th>Hit Dice</th></tr> </thead> <tbody>
  <tr><th>Same</th><td>${same}</td></tr>
  <tr><th>Adjacent</th><td>${adjacent}</td></tr>
  <tr><th>Opposed</th><td>${opposed}</td></tr> </tbody> </table>`

let originalGame
let originalFromUuid
let originalRoll
let originalChatMessage

beforeEach(() => {
  originalGame = globalThis.game
  originalFromUuid = globalThis.fromUuid
  originalRoll = globalThis.Roll
  originalChatMessage = globalThis.ChatMessage
  globalThis.game = {
    settings: { get: vi.fn(() => true) },
    i18n: {
      localize: key => key,
      format: (key, data) => `${key} ${JSON.stringify(data)}`
    },
    user: { isGM: true }
  }
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.fromUuid = originalFromUuid
  globalThis.Roll = originalRoll
  globalThis.ChatMessage = originalChatMessage
})

describe('reading the rule inputs', () => {
  test('alignment relationship: same, adjacent through neutral, lawful vs chaotic opposed', () => {
    expect(alignmentRelation('l', 'l')).toBe('same')
    expect(alignmentRelation('n', 'c')).toBe('adjacent')
    expect(alignmentRelation('c', 'l')).toBe('opposed')
    expect(alignmentRelation('l', '')).toBeNull()
  })

  test('dice counts come from the result rows in table order; a failure is 0', () => {
    expect(parseLayOnHandsDice(resultHtml('3 dice', '2 dice', '1 die'))).toEqual({ same: 3, adjacent: 2, opposed: 1 })
    expect(parseLayOnHandsDice(resultHtml('Failure', 'Failure', 'Failure'))).toEqual({ same: 0, adjacent: 0, opposed: 0 })
    expect(parseLayOnHandsDice('<p>The judge decides.</p>')).toBeNull()
  })

  test("a PC's hit dice are its level; an NPC's come from its HD; fractional HD is 1", () => {
    expect(subjectHitDice({ type: 'Player', system: { attributes: { hitDice: { value: '1d8' } }, details: { level: { value: 2 } } } }))
      .toEqual({ hitDie: 'd8', hitDice: 2 })
    expect(subjectHitDice({ type: 'NPC', system: { attributes: { hitDice: { value: '3d6+3' } } } }))
      .toEqual({ hitDie: 'd6', hitDice: 3 })
    expect(subjectHitDice({ type: 'NPC', system: { attributes: { hitDice: { value: '½d8' } } } }))
      .toEqual({ hitDie: 'd8', hitDice: 1 })
  })
})

describe('the card record', () => {
  const cleric = { system: { details: { alignment: 'l' } } }
  const subject = { uuid: 'Actor.bob', name: 'Bob', type: 'NPC', system: { details: { alignment: 'l' }, attributes: { hitDice: { value: '2d8' } } } }
  const result = [{ description: resultHtml('3 dice', '2 dice', '1 die') }]

  test('records the one targeted token', () => {
    expect(buildLayOnHandsHealFlag(cleric, result, new Set([{ name: 'Bob', actor: subject }]))).toEqual({
      targetUuid: 'Actor.bob',
      targetName: 'Bob',
      relation: 'same',
      hitDie: 'd8',
      hitDice: 2,
      dice: { same: 3, adjacent: 2, opposed: 1 }
    })
  })

  test('no target, or more than one, leaves the card note-only', () => {
    expect(buildLayOnHandsHealFlag(cleric, result, new Set())).toBeNull()
    expect(buildLayOnHandsHealFlag(cleric, result, new Set([{ actor: subject }, { actor: subject }]))).toBeNull()
  })

  test('the button states the capped dice; other columns stay available', () => {
    const html = layOnHandsHealHtml(buildLayOnHandsHealFlag(cleric, result, [{ name: 'Bob', actor: subject }]))
    expect(html).toContain('DCC.LayOnHandsHealCapped {"target":"Bob","relation":"DCC.LayOnHandsRelationSame","raw":3,"hd":2,"formula":"2d8"}')
    expect(html).toContain('data-relation="adjacent"')
    expect(html).toContain('data-relation="opposed"')
  })
})

describe('GM-side heal', () => {
  const record = { targetUuid: 'Actor.bob', targetName: 'Bob', relation: 'same', hitDie: 'd8', hitDice: 2, dice: { same: 3, adjacent: 2, opposed: 1 } }

  function setup () {
    const message = {
      id: 'card1',
      speaker: { actor: 'cleric' },
      flags: { layOnHands: { ...record } },
      getFlag: vi.fn((scope, key) => message.flags[key]),
      testUserPermission: vi.fn(() => true),
      update: vi.fn(async data => {
        message.flags.layOnHands.healed = data['flags.dcc.layOnHands.healed']
      })
    }
    const applyDamage = vi.fn()
    const toMessage = vi.fn()
    globalThis.game.messages = { get: () => message }
    globalThis.game.users = { get: () => ({ isGM: false }) }
    globalThis.fromUuid = vi.fn(async () => ({ documentName: 'Actor', applyDamage }))
    globalThis.Roll = vi.fn(function (formula) {
      this.formula = formula
      this.total = 7
      this.evaluate = vi.fn()
      this.toMessage = toMessage
    })
    return { message, applyDamage, toMessage }
  }

  test('rolls the capped dice with the hit die, marks the card and heals once', async () => {
    const { message, applyDamage, toMessage } = setup()

    await layOnHandsHealHandler({ messageId: 'card1', relation: 'same' }, 'player')
    await layOnHandsHealHandler({ messageId: 'card1', relation: 'same' }, 'player')

    expect(globalThis.Roll).toHaveBeenCalledWith('2d8')
    expect(toMessage).toHaveBeenCalledTimes(1)
    expect(message.update).toHaveBeenCalledWith({ 'flags.dcc.layOnHands.healed': { relation: 'same', hp: 7, formula: '2d8' } })
    expect(applyDamage).toHaveBeenCalledTimes(1)
    expect(applyDamage).toHaveBeenCalledWith(7, -1)
  })

  test('refuses a user who may not act for the card', async () => {
    const { message, applyDamage } = setup()
    message.testUserPermission = vi.fn(() => false)
    globalThis.ChatMessage = { getSpeakerActor: () => null }

    await layOnHandsHealHandler({ messageId: 'card1', relation: 'same' }, 'player')

    expect(applyDamage).not.toHaveBeenCalled()
  })
})
