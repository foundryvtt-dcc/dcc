import { describe, test, expect, vi, beforeEach } from 'vitest'

// table-result.js coverage backfill (audit 2026-06-08: the module was vi.mock-ed
// everywhere, so only its call sites were verified). _adjustCritResult /
// _adjustFumbleResult navigate a crit/fumble table in chat and must DUAL-WRITE the
// message content AND system.critResult/critRollTotal (resp. fumble) — if the
// system-data write regresses, navigation appears to work until the next re-render,
// then reverts to the stale value.

vi.mock('../utilities.js', () => ({
  getCritTableResult: vi.fn(),
  getFumbleTableResult: vi.fn(),
  getNPCFumbleTableResult: vi.fn(),
  addDamageFlavorToRolls: (s) => s
}))

// TextEditor is destructured at module load, so set the global before importing.
globalThis.foundry = { applications: { ux: { TextEditor: { enrichHTML: async (s) => `<e>${s}</e>` } } } }
globalThis.ui = { notifications: { warn: vi.fn() } }
globalThis.game = { i18n: { localize: (k) => k } }
// Minimal document: createElement returns a div-like whose querySelector finds no
// nested container (so the content-rewrite branch is skipped and content passes through).
globalThis.document = { createElement: () => ({ innerHTML: '', querySelector: () => null }) }

const { getCritTableResult, getFumbleTableResult, getNPCFumbleTableResult } = await import('../utilities.js')
const { default: TableResult } = await import('../table-result.js')

// A fake table container with mutable attributes + a .result-text child.
const makeContainer = (attrs) => {
  const store = { ...attrs }
  return {
    getAttribute: (k) => (k in store ? store[k] : null),
    setAttribute: (k, v) => { store[k] = String(v) },
    querySelector: () => ({ innerHTML: '' }),
    store
  }
}
const eventFor = (container, selector) => ({ target: { closest: (sel) => (sel === selector ? container : null) } })
const message = () => ({ content: '<div class="crit-result"></div>', update: vi.fn(async () => {}) })

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.ui.notifications.warn = vi.fn()
})

describe('_adjustCritResult', () => {
  test('no-ops when no .crit-result container is found', async () => {
    const msg = message()
    await TableResult._adjustCritResult.call(msg, eventFor(null, '.crit-result'), 1)
    expect(msg.update).not.toHaveBeenCalled()
  })

  test('no-ops when the table name is missing or the current roll is NaN', async () => {
    const msg = message()
    await TableResult._adjustCritResult.call(msg, eventFor(makeContainer({ 'data-current-roll': '5' }), '.crit-result'), 1)
    expect(msg.update).not.toHaveBeenCalled()
    await TableResult._adjustCritResult.call(msg, eventFor(makeContainer({ 'data-table-name': 'T', 'data-current-roll': 'x' }), '.crit-result'), 1)
    expect(msg.update).not.toHaveBeenCalled()
  })

  test('warns and bails when the adjusted roll is off the end of the table', async () => {
    getCritTableResult.mockResolvedValue(null)
    const msg = message()
    await TableResult._adjustCritResult.call(msg, eventFor(makeContainer({ 'data-table-name': 'CritI', 'data-current-roll': '24' }), '.crit-result'), 1)
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith('DCC.TableResultOutOfBounds')
    expect(msg.update).not.toHaveBeenCalled()
  })

  test('dual-writes content + system.critResult/critRollTotal on a successful step', async () => {
    getCritTableResult.mockResolvedValue({ description: 'Lopped off a limb' })
    const msg = message()
    const container = makeContainer({ 'data-table-name': 'CritI', 'data-current-roll': '5' })
    await TableResult._adjustCritResult.call(msg, eventFor(container, '.crit-result'), 1)

    expect(getCritTableResult).toHaveBeenCalledWith(expect.objectContaining({ total: 6, _evaluated: true }), 'CritI')
    expect(msg.update).toHaveBeenCalledTimes(1)
    expect(msg.update.mock.calls[0][0]).toMatchObject({
      'system.critResult': '<e>Lopped off a limb</e>',
      'system.critRollTotal': 6
    })
    expect(container.store['data-current-roll']).toBe('6') // DOM attribute advanced
  })

  test('steps backward with direction -1', async () => {
    getCritTableResult.mockResolvedValue({ description: 'Lesser crit' })
    const msg = message()
    await TableResult._adjustCritResult.call(msg, eventFor(makeContainer({ 'data-table-name': 'CritI', 'data-current-roll': '5' }), '.crit-result'), -1)
    expect(msg.update.mock.calls[0][0]['system.critRollTotal']).toBe(4)
  })
})

describe('_adjustFumbleResult', () => {
  test('PC fumble dual-writes system.fumbleResult/fumbleRollTotal via getFumbleTableResult', async () => {
    getFumbleTableResult.mockResolvedValue({ description: 'Drop weapon' })
    const msg = { content: '<div class="fumble-result"></div>', update: vi.fn(async () => {}) }
    await TableResult._adjustFumbleResult.call(msg, eventFor(makeContainer({ 'data-table-name': 'Fumble', 'data-current-roll': '3' }), '.fumble-result'), 1)
    expect(getFumbleTableResult).toHaveBeenCalled()
    expect(msg.update.mock.calls[0][0]).toMatchObject({
      'system.fumbleResult': '<e>Drop weapon</e>',
      'system.fumbleRollTotal': 4
    })
  })

  test('NPC fumble routes through getNPCFumbleTableResult with the table name', async () => {
    getNPCFumbleTableResult.mockResolvedValue({ description: 'NPC stumbles' })
    const msg = { content: '<div class="fumble-result"></div>', update: vi.fn(async () => {}) }
    await TableResult._adjustFumbleResult.call(
      msg,
      eventFor(makeContainer({ 'data-table-name': 'NPCFumble', 'data-is-npc': 'true', 'data-current-roll': '2' }), '.fumble-result'),
      1
    )
    expect(getNPCFumbleTableResult).toHaveBeenCalledWith(expect.objectContaining({ total: 3 }), 'NPCFumble')
    expect(getFumbleTableResult).not.toHaveBeenCalled()
  })

  test('warns and bails when the fumble step is off the table', async () => {
    getFumbleTableResult.mockResolvedValue(null)
    const msg = { content: '', update: vi.fn(async () => {}) }
    await TableResult._adjustFumbleResult.call(msg, eventFor(makeContainer({ 'data-table-name': 'Fumble', 'data-current-roll': '1' }), '.fumble-result'), -1)
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith('DCC.TableResultOutOfBounds')
    expect(msg.update).not.toHaveBeenCalled()
  })
})
