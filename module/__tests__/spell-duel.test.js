import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// spell-duel.js coverage backfill (audit 2026-06-08: the 805-line module had zero
// dedicated tests). The exported SpellDuel ApplicationV2 class carries the
// counterspell math + the fragile die-from-table-HTML regex; these exercise the
// pure-ish statics (getSpellDuelDie, the participant state machine, resolveExchange's
// momentum/column selection) with the Foundry globals + table loads stubbed.

// foundry.applications.api must exist at import time (class extends it).
globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: class {},
      HandlebarsApplicationMixin: (B) => class extends B {}
    }
  }
}

const { default: SpellDuel } = await import('../spell-duel.js')

// Controllable Roll: `new Roll(f).evaluate()` resolves to itself; `.total` is the
// scripted next result; `.toMessage()` is a no-op.
let nextRollTotal = 5
class MockRoll {
  constructor (formula) { this.formula = formula; this.total = nextRollTotal }
  async evaluate () { return this }
  async toMessage () {}
}

// A fake RollTable whose getResultsForRoll(value) returns one row of text.
const fakeTable = (rowTextByValue) => ({
  getResultsForRoll: (value) => {
    const text = rowTextByValue[value]
    return text ? [{ description: text }] : []
  }
})

beforeEach(() => {
  SpellDuel.participants = []
  SpellDuel._addingParticipant = false
  SpellDuel.dialog = null
  nextRollTotal = 5

  globalThis.Roll = MockRoll
  globalThis.ui = { notifications: { warn: vi.fn(), error: vi.fn() } }
  globalThis.game = {
    user: { id: 'u1', isGM: false }, // isGM false -> saveState is a no-op (no settings)
    i18n: {
      localize: (k) => k,
      format: (k, data) => `${k} ${JSON.stringify(data || {})}`
    },
    modules: { get: () => ({ active: false }) }, // dcc-core-book inactive -> world-table fallback
    tables: { getName: () => null }
  }

  // refresh() reads SpellDuel.dialog (null -> no-op); addChatMessage is spied.
  SpellDuel.addChatMessage = vi.fn(async () => {})
})

afterEach(() => {
  delete globalThis.Roll
  delete globalThis.ui
  delete globalThis.game
})

const actor = (id, name = id) => ({ id, name, img: `${id}.png` })

describe('SpellDuel.getSpellDuelDie', () => {
  // Comparison table row keyed by DEFENDER check; the row text lists the attacker
  // columns "12: PD, 13: d3, 14: d4, 28: d10".
  const comparison = fakeTable({
    12: 'Defender 12: 12: PD, 13: d3, 14: d4, 28: d10',
    20: 'Defender 20: 12: d6, 14: d8'
  })

  beforeEach(() => { globalThis.game.tables.getName = () => comparison })

  test('parses the attacker column out of the defender row', async () => {
    expect(await SpellDuel.getSpellDuelDie(14, 12)).toBe('d4')
    expect(await SpellDuel.getSpellDuelDie(13, 12)).toBe('d3')
  })

  test('returns PD when the attacker column is a phlogiston cell', async () => {
    expect(await SpellDuel.getSpellDuelDie(12, 12)).toBe('PD')
  })

  test('clamps checks to the [12,28] table boundary before lookup', async () => {
    // attacker 30 -> 28, defender 5 -> 12: row 12, column 28 -> d10
    expect(await SpellDuel.getSpellDuelDie(30, 5)).toBe('d10')
  })

  test('returns null when the table is unavailable', async () => {
    globalThis.game.tables.getName = () => null
    expect(await SpellDuel.getSpellDuelDie(14, 12)).toBeNull()
  })

  test('returns null when the attacker column is absent from the row', async () => {
    // row 12 has no "99:" column (and 99 clamps to 28, which IS present) — use a
    // row that genuinely lacks the clamped attacker column.
    expect(await SpellDuel.getSpellDuelDie(15, 20)).toBeNull() // row 20 lists 12 + 14 only
  })
})

describe('SpellDuel participant state machine', () => {
  test('addParticipant seeds momentum 10, announces, and blocks duplicates', async () => {
    await SpellDuel.addParticipant(actor('a', 'Alice'))
    expect(SpellDuel.participants).toHaveLength(1)
    expect(SpellDuel.participants[0]).toMatchObject({ actorId: 'a', name: 'Alice', momentum: 10 })
    expect(SpellDuel.addChatMessage).toHaveBeenCalledTimes(1)

    await SpellDuel.addParticipant(actor('a', 'Alice')) // duplicate
    expect(SpellDuel.participants).toHaveLength(1)
    expect(globalThis.ui.notifications.warn).toHaveBeenCalled()
  })

  test('addParticipant is re-entrancy guarded', async () => {
    SpellDuel._addingParticipant = true
    await SpellDuel.addParticipant(actor('b'))
    expect(SpellDuel.participants).toHaveLength(0)
  })

  test('removeParticipant drops the matching actor and is a no-op when absent', async () => {
    await SpellDuel.addParticipant(actor('a'))
    await SpellDuel.removeParticipant('missing')
    expect(SpellDuel.participants).toHaveLength(1)
    await SpellDuel.removeParticipant('a')
    expect(SpellDuel.participants).toHaveLength(0)
  })

  test('adjustMomentum clamps at a floor of 1', async () => {
    await SpellDuel.addParticipant(actor('a'))
    await SpellDuel.adjustMomentum('a', -100)
    expect(SpellDuel.participants[0].momentum).toBe(1)
    await SpellDuel.adjustMomentum('a', 5)
    expect(SpellDuel.participants[0].momentum).toBe(6)
  })

  test('resetMomentum restores 10', async () => {
    await SpellDuel.addParticipant(actor('a'))
    await SpellDuel.adjustMomentum('a', -5)
    await SpellDuel.resetMomentum('a')
    expect(SpellDuel.participants[0].momentum).toBe(10)
  })

  test('isParticipant reflects membership', async () => {
    expect(SpellDuel.isParticipant('a')).toBe(false)
    await SpellDuel.addParticipant(actor('a'))
    expect(SpellDuel.isParticipant('a')).toBe(true)
  })
})

describe('SpellDuel.resolveExchange', () => {
  beforeEach(async () => {
    await SpellDuel.addParticipant(actor('atk', 'Attacker'))
    await SpellDuel.addParticipant(actor('def', 'Defender'))
    SpellDuel.addChatMessage.mockClear()
    // comparison table yields a die for the counterspell path; counterspell +
    // phlogiston tables return null so the module-constant fallback is used.
    globalThis.game.tables.getName = (name) =>
      name.includes('4-5') ? fakeTable({ 12: '14: d6, 28: d6' }) : null
  })

  test('errors and bails when a participant is missing', async () => {
    await SpellDuel.resolveExchange('atk', 14, 'ghost', 12)
    expect(globalThis.ui.notifications.error).toHaveBeenCalled()
    expect(SpellDuel.addChatMessage).not.toHaveBeenCalled()
  })

  test('identical checks award the defender momentum and post the phlogiston result', async () => {
    nextRollTotal = 3 // 1d10 phlogiston
    await SpellDuel.resolveExchange('atk', 12, 'def', 12)
    // attackerWins = 12 > 12 = false -> winner is defender
    expect(SpellDuel.participants.find(p => p.actorId === 'def').momentum).toBe(11)
    const msg = SpellDuel.addChatMessage.mock.calls.at(-1)[0]
    expect(msg).toContain('DCC.SpellDuelPhlogistonMessage')
  })

  test('attacker win selects attackerHigh + clamps the momentum-modified roll', async () => {
    // attacker check 14 > defender 12 -> attacker wins, attacker.momentum 10->11.
    // momentumDiff = 11 - 10 = 1; dieRoll.total = 5 -> modifiedRoll = min(10, 5+1) = 6.
    // attackerHigh[6] = DCC.SpellDuelEffectOverwhelmAndReflect.
    nextRollTotal = 5
    await SpellDuel.resolveExchange('atk', 14, 'def', 12)
    expect(SpellDuel.participants.find(p => p.actorId === 'atk').momentum).toBe(11)
    const msg = SpellDuel.addChatMessage.mock.calls.at(-1)[0]
    expect(msg).toContain('DCC.SpellDuelExchangeResult')
    expect(msg).toContain('"finalRoll":6')
    expect(msg).toContain('SpellDuelEffectOverwhelmAndReflect')
  })

  test('momentum modifier clamps the final roll to the [1,10] table bounds', async () => {
    // Give the attacker a big momentum lead so dieRoll + momentumDiff overflows 10.
    SpellDuel.participants.find(p => p.actorId === 'atk').momentum = 30
    nextRollTotal = 6
    await SpellDuel.resolveExchange('atk', 14, 'def', 12)
    // attacker wins -> momentum 31; momentumDiff 31-10=21; 6+21 -> clamp 10.
    const msg = SpellDuel.addChatMessage.mock.calls.at(-1)[0]
    expect(msg).toContain('"finalRoll":10')
  })
})
