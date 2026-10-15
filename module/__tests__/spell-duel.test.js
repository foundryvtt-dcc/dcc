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
let rolledFormulas = []
class MockRoll {
  constructor (formula) { this.formula = formula; this.total = nextRollTotal; rolledFormulas.push(formula) }
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
  rolledFormulas = []

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
  const momentumOf = (id) => SpellDuel.participants.find(p => p.actorId === id).momentum
  const lastMessage = () => SpellDuel.addChatMessage.mock.calls.at(-1)[0]

  beforeEach(async () => {
    await SpellDuel.addParticipant(actor('atk', 'Attacker'))
    await SpellDuel.addParticipant(actor('def', 'Defender'))
    SpellDuel.addChatMessage.mockClear()
    rolledFormulas = []
    // comparison table yields d6 for every pairing used below; counterspell +
    // phlogiston tables return null so the fallback labels are used.
    const row = '12: PD, 13: d6, 14: d6, 28: d6'
    globalThis.game.tables.getName = (name) =>
      name.includes('4-5') ? fakeTable({ 12: row, 13: row, 14: row }) : null
  })

  test('errors and bails when a participant is missing', async () => {
    await SpellDuel.resolveExchange('atk', 14, 'ghost', 12)
    expect(globalThis.ui.notifications.error).toHaveBeenCalled()
    expect(SpellDuel.addChatMessage).not.toHaveBeenCalled()
  })

  test('identical checks give no one momentum and roll a d10 phlogiston disturbance', async () => {
    nextRollTotal = 3
    await SpellDuel.resolveExchange('atk', 12, 'def', 12)
    expect(momentumOf('atk')).toBe(10)
    expect(momentumOf('def')).toBe(10)
    expect(rolledFormulas).toEqual(['1d10'])
    expect(lastMessage()).toContain('DCC.SpellDuelPhlogistonMessage')
    expect(lastMessage()).toContain('SpellDuelPhlogistonEffectTimeAccelerates')
  })

  test('an attacker win uses the attacker-high column with the winner\'s momentum lead', async () => {
    // attacker 10 -> 11, lead +1; d6 roll 5 -> 6 -> attackerHigh[6]
    nextRollTotal = 5
    await SpellDuel.resolveExchange('atk', 14, 'def', 12)
    expect(momentumOf('atk')).toBe(11)
    expect(rolledFormulas).toEqual(['1d6'])
    expect(lastMessage()).toContain('DCC.SpellDuelExchangeResult')
    expect(lastMessage()).toContain('"modifier":"+1"')
    expect(lastMessage()).toContain('"finalRoll":6')
    expect(lastMessage()).toContain('SpellDuelEffectOverwhelmAndReflect')
  })

  test('a defender who wins while ahead adds their lead, not subtracts it (#982)', async () => {
    SpellDuel.participants.find(p => p.actorId === 'def').momentum = 12
    globalThis.game.tables.getName = (name) =>
      name.includes('4-5') ? fakeTable({ 14: '12: d6, 14: PD' }) : null
    nextRollTotal = 5
    await SpellDuel.resolveExchange('atk', 12, 'def', 14)
    // defender 12 -> 13 vs 10: +3; 5 + 3 = 8 -> defenderHigh[8]
    expect(momentumOf('def')).toBe(13)
    expect(lastMessage()).toContain('"modifier":"+3"')
    expect(lastMessage()).toContain('"finalRoll":8')
    expect(lastMessage()).toContain('SpellDuelEffectOverwhelm')
  })

  test('a winner who trails on momentum gets a negative modifier', async () => {
    SpellDuel.participants.find(p => p.actorId === 'def').momentum = 13
    nextRollTotal = 5
    await SpellDuel.resolveExchange('atk', 14, 'def', 12)
    // attacker 10 -> 11 vs 13: -2; 5 - 2 = 3
    expect(lastMessage()).toContain('"modifier":-2')
    expect(lastMessage()).toContain('"finalRoll":3')
  })

  test('results above 10 use the 10+ row', async () => {
    SpellDuel.participants.find(p => p.actorId === 'atk').momentum = 30
    nextRollTotal = 6
    await SpellDuel.resolveExchange('atk', 14, 'def', 12)
    // 31 - 10 = +21; 6 + 21 = 27 -> attackerHigh 10+
    expect(lastMessage()).toContain('"finalRoll":27')
    expect(lastMessage()).toContain('SpellDuelEffectReflectAndOverwhelm')
  })

  test('a check below the spell\'s minimum stops the comparison', async () => {
    await SpellDuel.resolveExchange('atk', 14, 'def', 11)
    expect(lastMessage()).toContain('DCC.SpellDuelCheckFailed')
    expect(lastMessage()).toContain('"failed":"Defender"')
    expect(momentumOf('atk')).toBe(10)
    expect(rolledFormulas).toEqual([])
  })

  test('the minimum follows the spell level', async () => {
    // 13 succeeds at level 1 but not at level 2 (needs 14)
    await SpellDuel.resolveExchange('atk', 14, 'def', 13, { defenderLevel: 2 })
    expect(lastMessage()).toContain('DCC.SpellDuelCheckFailed')
  })

  test('same-patron invocations cancel when both succeed', async () => {
    await SpellDuel.resolveExchange('atk', 14, 'def', 12, { samePatron: true })
    expect(lastMessage()).toContain('DCC.SpellDuelSamePatronCancelled')
    expect(momentumOf('atk')).toBe(10)
    expect(rolledFormulas).toEqual([])
  })

  test('same-patron invocations do not cancel when a check fails', async () => {
    await SpellDuel.resolveExchange('atk', 14, 'def', 11, { samePatron: true })
    expect(lastMessage()).toContain('DCC.SpellDuelCheckFailed')
  })

  test('without the comparison table, a non-tie asks for a manual lookup and rolls nothing', async () => {
    globalThis.game.tables.getName = () => null
    await SpellDuel.resolveExchange('atk', 14, 'def', 12)
    expect(lastMessage()).toContain('DCC.SpellDuelManualLookup')
    expect(lastMessage()).toContain('"winner":"Attacker"')
    expect(momentumOf('atk')).toBe(11)
    expect(rolledFormulas).toEqual([])
  })

  test('uses the core-book table text found by id in the pack', async () => {
    const tables = {
      b8Eh0tUvRsYo5Zax: fakeTable({ 12: '12: PD, 14: d6' }),
      a7Dg9sTuQrXn4Yzw: fakeTable({ 6: 'attacker high row six' })
    }
    globalThis.game.modules.get = () => ({ active: true })
    globalThis.game.packs = {
      get: () => ({
        index: { get: (id) => (tables[id] ? { _id: id } : undefined), find: () => undefined },
        getDocument: async (id) => tables[id]
      })
    }
    nextRollTotal = 5
    await SpellDuel.resolveExchange('atk', 14, 'def', 12)
    expect(lastMessage()).toContain('attacker high row six')
  })

  test('finds Table 4-7 under its old misspelled name', async () => {
    globalThis.game.tables.getName = (name) =>
      name === 'Table 4-7: Phologiston Disturbance' ? fakeTable({ 4: 'old-name row four' }) : null
    nextRollTotal = 4
    await SpellDuel.resolveExchange('atk', 12, 'def', 12)
    expect(lastMessage()).toContain('old-name row four')
  })
})
