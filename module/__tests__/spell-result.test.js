import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'

// spell-result.js coverage backfill (audit 2026-06-08: vi.mock-ed everywhere, so its
// own logic was untested). Covers addChatMessage's flag construction (the crit/fumble
// Fleeting-Luck branch + the ItemId flag) and processChatMessage's GM guard + the
// SpellCheck-only navigation wiring — without a real DOM.

// TextEditor + renderTemplate are read at module load; augment the shared mock first.
globalThis.foundry.applications = globalThis.foundry.applications || {}
globalThis.foundry.applications.ux = { TextEditor: { enrichHTML: async (s) => s ?? '' } }
globalThis.foundry.applications.handlebars = { renderTemplate: async () => '<div class="card"></div>' }

const { default: SpellResult } = await import('../spell-result.js')

let created, updateFlagsForCrit, updateFlagsForFumble
beforeEach(() => {
  created = []
  updateFlagsForCrit = vi.fn()
  updateFlagsForFumble = vi.fn()
  globalThis.ChatMessage = { create: vi.fn(async (data) => { created.push(data); return data }) }
  globalThis.CONFIG = { ...(globalThis.CONFIG || {}), sounds: { dice: 'dice.wav' } }
  globalThis.game = {
    user: { id: 'u1', isGM: true },
    settings: { get: vi.fn(() => 'roll') },
    i18n: { localize: (k) => k },
    dcc: { FleetingLuck: { updateFlagsForCrit, updateFlagsForFumble } }
  }
})

const rollTable = { description: 'Magic missile table', displayRoll: false, name: 'Magic Missile' }
const result = [{ text: 'Tier 1' }]

describe('addChatMessage flag construction', () => {
  test('a normal cast sets the SpellCheck flags + ItemId and creates the message', async () => {
    await SpellResult.addChatMessage(null, rollTable, result, { item: { id: 'spell1' } })
    expect(globalThis.ChatMessage.create).toHaveBeenCalledTimes(1)
    const flags = created[0].flags
    expect(flags['dcc.SpellCheck']).toBe(true)
    expect(flags['dcc.RollType']).toBe('SpellCheck')
    expect(flags['dcc.ItemId']).toBe('spell1')
    expect(updateFlagsForCrit).not.toHaveBeenCalled()
    expect(updateFlagsForFumble).not.toHaveBeenCalled()
  })

  test('a crit cast routes the flags through Fleeting Luck (crit branch)', async () => {
    await SpellResult.addChatMessage(null, rollTable, result, { crit: true, item: { id: 's2' } })
    expect(updateFlagsForCrit).toHaveBeenCalledTimes(1)
    expect(updateFlagsForFumble).not.toHaveBeenCalled()
  })

  test('a fumble cast routes the flags through Fleeting Luck (fumble branch)', async () => {
    await SpellResult.addChatMessage(null, rollTable, result, { fumble: true, item: { id: 's3' } })
    expect(updateFlagsForFumble).toHaveBeenCalledTimes(1)
    expect(updateFlagsForCrit).not.toHaveBeenCalled()
  })

  test('ItemId is null when no spell item is supplied', async () => {
    await SpellResult.addChatMessage(null, rollTable, result, {})
    expect(created[0].flags['dcc.ItemId']).toBeNull()
  })
})

describe('manifestation override (Lay on Hands — #426)', () => {
  // Capture the context handed to the chat-card template so we can assert
  // which manifestation object is rendered.
  let lastContext
  beforeEach(() => {
    lastContext = null
    globalThis.foundry.applications.handlebars.renderTemplate = async (_tpl, ctx) => {
      lastContext = ctx
      return '<div class="card"></div>'
    }
  })

  test('an explicit manifestation override is rendered when displayInChat is true', async () => {
    const manifestation = { value: '5', description: 'A halo of light', displayInChat: true }
    await SpellResult.addChatMessage(null, rollTable, result, { manifestation })
    expect(lastContext.manifestation).toEqual(manifestation)
  })

  test('the override is suppressed when displayInChat is false', async () => {
    const manifestation = { value: '5', description: 'A halo of light', displayInChat: false }
    await SpellResult.addChatMessage(null, rollTable, result, { manifestation })
    expect(lastContext.manifestation).toEqual({})
  })

  test('the override takes precedence over an item-derived manifestation', async () => {
    const manifestation = { description: 'Skill manifestation', displayInChat: true }
    const item = { id: 'lay', system: { manifestation: { description: 'Item manifestation', displayInChat: true } } }
    await SpellResult.addChatMessage(null, rollTable, result, { item, manifestation })
    expect(lastContext.manifestation).toEqual(manifestation)
  })
})

describe('processChatMessage navigation wiring', () => {
  const htmlWith = (upEls, downEls) => ({
    querySelectorAll: vi.fn((sel) => (sel === '.spell-shift-up' ? upEls : sel === '.spell-shift-down' ? downEls : []))
  })
  const el = () => ({ addEventListener: vi.fn() })

  test('does nothing for non-GM users', async () => {
    globalThis.game.user.isGM = false
    const html = htmlWith([el()], [el()])
    await SpellResult.processChatMessage({ getFlag: () => true }, html)
    expect(html.querySelectorAll).not.toHaveBeenCalled()
  })

  test('does nothing for a message that is not a DCC SpellCheck', async () => {
    const html = htmlWith([el()], [el()])
    await SpellResult.processChatMessage({ getFlag: () => false }, html)
    expect(html.querySelectorAll).not.toHaveBeenCalled()
  })

  test('wires shift-up/shift-down click handlers on a SpellCheck message', async () => {
    const up = el()
    const down = el()
    const html = htmlWith([up], [down])
    await SpellResult.processChatMessage({ getFlag: (scope, key) => key === 'SpellCheck' }, html)
    expect(html.querySelectorAll).toHaveBeenCalledWith('.spell-shift-up')
    expect(html.querySelectorAll).toHaveBeenCalledWith('.spell-shift-down')
    expect(up.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
    expect(down.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
  })
})
