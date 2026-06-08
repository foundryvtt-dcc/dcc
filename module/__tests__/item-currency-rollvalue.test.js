import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { CurrencyItemMixin } from '../item/currency-mixin.mjs'

// currency-mixin rollValue coverage backfill (audit 2026-06-08). The existing
// currency tests cover needsValueRoll + convertCurrency*, but rollValue — which rolls
// each denomination's formula, writes system.value.*, and posts the LootValue chat
// card — and its bad-formula catch had no unit coverage.

class Base {}
const Mixed = CurrencyItemMixin(Base)

// A Roll whose evaluate() resolves a formula deterministically; '2d6' -> 7, plain
// integers -> their value; a formula of 'BAD' throws to exercise the catch branch.
class RollStub {
  constructor (formula) { this.formula = String(formula); this.terms = [] }
  async evaluate () {
    if (this.formula === 'BAD') throw new Error('bad formula')
    this.total = this.formula === '2d6' ? 7 : (parseInt(this.formula) || 0)
    return this
  }
}

let item, create, warn
beforeEach(() => {
  globalThis.Roll = RollStub
  create = vi.fn(async () => {})
  warn = vi.fn()
  globalThis.CONFIG = {
    DCC: { currencies: { pp: 1, ep: 1, gp: 1, sp: 1, cp: 1 } },
    sounds: { dice: 'dice.wav' },
    ChatMessage: { documentClass: { create } }
  }
  globalThis.CONST = { CHAT_MESSAGE_STYLES: { EMOTE: 2 } }
  globalThis.ui = { notifications: { warn } }
  globalThis.game = {
    user: { id: 'u1' },
    i18n: { format: (k, d) => `${k} ${JSON.stringify(d || {})}`, localize: (k) => k },
    dcc: { DCCRoll: { cleanFormula: () => '2' } }
  }

  item = new Mixed()
  item.name = 'Probe Hoard'
  item.actor = { name: 'Hero', id: 'a1' }
  item.update = vi.fn(async () => {})
})

afterEach(() => { delete globalThis.Roll })

describe('rollValue', () => {
  test('resolves every denomination, writes system.value.*, and posts the LootValue card', async () => {
    item.system = { value: { pp: '0', ep: '0', gp: '7', sp: '0', cp: '0' } }
    await item.rollValue()

    expect(item.update).toHaveBeenCalledTimes(1)
    const updates = item.update.mock.calls[0][0]
    expect(updates['system.value.gp']).toBe(7)
    expect(updates['system.value.pp']).toBe(0)

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].flags).toMatchObject({ 'dcc.RollType': 'LootValue' })
  })

  test('rolls a die formula to a concrete total', async () => {
    item.system = { value: { pp: '0', ep: '0', gp: '2d6', sp: '0', cp: '0' } }
    await item.rollValue()
    expect(item.update.mock.calls[0][0]['system.value.gp']).toBe(7) // 2d6 -> 7 (stub)
  })

  test('warns on a bad formula but still resolves the other denominations + completes', async () => {
    item.system = { value: { pp: '0', ep: '0', gp: 'BAD', sp: '5', cp: '0' } }
    await item.rollValue()

    expect(warn).toHaveBeenCalledWith('DCC.BadValueFormulaWarning')
    const updates = item.update.mock.calls[0][0]
    expect('system.value.gp' in updates).toBe(false) // the throwing denomination is skipped
    expect(updates['system.value.sp']).toBe(5) // others still resolve
    expect(create).toHaveBeenCalledTimes(1) // the method still completes + posts the card
  })
})
