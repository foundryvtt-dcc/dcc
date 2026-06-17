/**
 * Unit coverage for the two deterministic chat-emit renderers in
 * `module/adapter/chat-renderer.mjs` — `renderDisapprovalRoll` (Phase 7
 * session 3 disapproval pattern) and `renderMercurialEffect` (same
 * `${N}d1` pattern). Both were previously exercised only transitively
 * (the cleric-disapproval / mercurial browser tests), flagged as a
 * PR #720 test-coverage gap (severity ≥ 6).
 *
 * Each builds a deterministic `${Math.max(1, value)}d1` `Roll` to carry
 * the lib's already-rolled value through Foundry's chat pipeline, then
 * posts via `roll.toMessage(data, { create: false })` → `ChatMessage.create`.
 * The Foundry globals (`Roll` / `ChatMessage` / `game.i18n`) are stubbed
 * per-test in the `spell-check-processor.test.js` style; the `Roll` stub
 * records each constructed formula and `toMessage` returns its data verbatim
 * so the assertions can read the exact flavor / flags / content handed to
 * `ChatMessage.create`. No live Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderDisapprovalRoll, renderMercurialEffect } from '../adapter/chat-renderer.mjs'

let saved
let rollFormulas
let toMessageOpts

function installGlobals () {
  rollFormulas = []
  toMessageOpts = []
  globalThis.Roll = class {
    constructor (formula) {
      this.formula = formula
      rollFormulas.push(formula)
    }

    async evaluate () { return this }

    async toMessage (data, opts = {}) {
      toMessageOpts.push(opts)
      // Foundry's toMessage with { create: false } returns the prepared
      // message data; the renderer forwards that to ChatMessage.create.
      return data
    }
  }
  globalThis.ChatMessage = {
    getSpeaker: vi.fn(() => ({ alias: 'Tester' })),
    create: vi.fn((data) => ({ _created: true, ...data }))
  }
  globalThis.game = { i18n: { localize: vi.fn((k) => k) } }
}

beforeEach(() => {
  saved = {
    Roll: globalThis.Roll,
    ChatMessage: globalThis.ChatMessage,
    game: globalThis.game
  }
  installGlobals()
})

afterEach(() => {
  globalThis.Roll = saved.Roll
  globalThis.ChatMessage = saved.ChatMessage
  globalThis.game = saved.game
  vi.restoreAllMocks()
})

/** The single `ChatMessage.create` argument for the most recent emit. */
function createdMessageData () {
  expect(globalThis.ChatMessage.create).toHaveBeenCalledTimes(1)
  return globalThis.ChatMessage.create.mock.calls[0][0]
}

describe('renderDisapprovalRoll', () => {
  const actor = { name: 'Brother Cleric' }

  test('builds a deterministic {roll}d1 formula from the lib disapproval total', async () => {
    await renderDisapprovalRoll({
      actor,
      disapprovalResult: { roll: 3, description: 'You anger your deity', disapprovalRange: 2 }
    })
    expect(rollFormulas).toEqual(['3d1'])
    // Posted with { create: false } so the renderer (not toMessage) creates.
    expect(toMessageOpts[0]).toEqual({ create: false })
  })

  test('flavor joins the localized label and the table description with an em dash', async () => {
    await renderDisapprovalRoll({
      actor,
      disapprovalResult: { roll: 2, description: 'Smite!', disapprovalRange: 1 }
    })
    expect(createdMessageData().flavor).toBe('DCC.DisapprovalRoll — Smite!')
  })

  test('flavor is the bare localized label when no description is present', async () => {
    await renderDisapprovalRoll({
      actor,
      disapprovalResult: { roll: 1, description: '' }
    })
    expect(createdMessageData().flavor).toBe('DCC.DisapprovalRoll')
  })

  test('emits the Disapproval chat flags including the libDisapproval payload', async () => {
    await renderDisapprovalRoll({
      actor,
      disapprovalResult: { roll: 4, description: 'Cursed', disapprovalRange: 3 }
    })
    const flags = createdMessageData().flags
    expect(flags['dcc.RollType']).toBe('Disapproval')
    expect(flags['dcc.isDisapproval']).toBe(true)
    expect(flags['dcc.libDisapproval']).toEqual({
      roll: 4,
      description: 'Cursed',
      disapprovalRange: 3
    })
  })

  test('clamps a zero / missing roll to a 1d1 formula (never 0d1)', async () => {
    await renderDisapprovalRoll({ actor, disapprovalResult: { roll: 0 } })
    expect(rollFormulas).toEqual(['1d1'])

    globalThis.ChatMessage.create.mockClear()
    rollFormulas.length = 0
    await renderDisapprovalRoll({ actor, disapprovalResult: {} })
    expect(rollFormulas).toEqual(['1d1'])
  })

  test('returns the created ChatMessage', async () => {
    const result = await renderDisapprovalRoll({
      actor,
      disapprovalResult: { roll: 2, description: 'x' }
    })
    expect(result._created).toBe(true)
  })
})

describe('renderMercurialEffect', () => {
  const actor = { name: 'Wizard' }
  const spellItem = { id: 'spell-123' }

  test('is a no-op (returns undefined, posts nothing) when the effect is falsy', async () => {
    const result = await renderMercurialEffect({ actor, spellItem, effect: null })
    expect(result).toBeUndefined()
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled()
    expect(rollFormulas).toEqual([])
  })

  test('builds a deterministic {rollValue}d1 formula', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 42, summary: 'Roll again', description: 'desc' }
    })
    expect(rollFormulas).toEqual(['42d1'])
    expect(toMessageOpts[0]).toEqual({ create: false })
  })

  test('flavor joins the localized label and the summary', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 10, summary: 'Spell warps', description: 'd' }
    })
    expect(createdMessageData().flavor).toBe('DCC.MercurialMagicRoll — Spell warps')
  })

  test('sets content to a paragraph only when a description is present', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 5, summary: 's', description: 'A lasting boon' }
    })
    expect(createdMessageData().content).toBe('<p>A lasting boon</p>')
  })

  test('omits content entirely when the description is empty', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 5, summary: 's', description: '' }
    })
    expect(createdMessageData()).not.toHaveProperty('content')
  })

  test('emits the MercurialMagic flags incl. the spell item id and libMercurial payload', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 7, summary: 'Boon', description: 'desc', displayOnCast: true }
    })
    const flags = createdMessageData().flags
    expect(flags['dcc.RollType']).toBe('MercurialMagic')
    expect(flags['dcc.isMercurial']).toBe(true)
    expect(flags['dcc.ItemId']).toBe('spell-123')
    expect(flags['dcc.libMercurial']).toEqual({
      rollValue: 7,
      summary: 'Boon',
      description: 'desc',
      displayOnCast: true
    })
  })

  test('displayOnCast defaults to true when the effect omits it', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 1, summary: 's', description: 'd' }
    })
    expect(createdMessageData().flags['dcc.libMercurial'].displayOnCast).toBe(true)
  })

  test('displayOnCast is false only when explicitly false', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 1, summary: 's', description: 'd', displayOnCast: false }
    })
    expect(createdMessageData().flags['dcc.libMercurial'].displayOnCast).toBe(false)
  })

  test('tolerates a missing spellItem (ItemId undefined)', async () => {
    await renderMercurialEffect({
      actor,
      effect: { rollValue: 2, summary: 's', description: 'd' }
    })
    expect(createdMessageData().flags['dcc.ItemId']).toBeUndefined()
  })

  test('clamps a zero rollValue to a 1d1 formula', async () => {
    await renderMercurialEffect({
      actor,
      spellItem,
      effect: { rollValue: 0, summary: 's', description: 'd' }
    })
    expect(rollFormulas).toEqual(['1d1'])
  })
})
