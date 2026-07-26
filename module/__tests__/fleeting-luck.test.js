import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import FleetingLuck from '../fleeting-luck.js'

// fleeting-luck.js coverage backfill (audit 2026-06-08: 0 dedicated tests). Covers the
// pure flag helpers that drive automated Fleeting Luck off a roll, and the give/take/
// spend balance math (notably the floor-at-zero clamp on take/spend).

describe('updateFlags (natural 20 / natural 1 detection)', () => {
  const rollWith = (natural) => ({ dice: [{ values: [natural] }] })

  test('a natural 20 sets the Gain effect', () => {
    const flags = {}
    FleetingLuck.updateFlags(flags, rollWith(20))
    expect(flags['dcc.FleetingLuckEffect']).toBe('Gain')
  })

  test('a natural 1 sets the Lose effect', () => {
    const flags = {}
    FleetingLuck.updateFlags(flags, rollWith(1))
    expect(flags['dcc.FleetingLuckEffect']).toBe('Lose')
  })

  test('a mid-range roll sets no effect', () => {
    const flags = {}
    FleetingLuck.updateFlags(flags, rollWith(10))
    expect(flags['dcc.FleetingLuckEffect']).toBeUndefined()
  })

  test('a roll with no dice is a no-op', () => {
    const flags = {}
    FleetingLuck.updateFlags(flags, { dice: [] })
    expect(flags).toEqual({})
  })

  test('honors a pre-set isNaturalCrit / isFumble flag even without a nat 20/1', () => {
    const crit = { 'dcc.isNaturalCrit': true }
    FleetingLuck.updateFlags(crit, rollWith(10))
    expect(crit['dcc.FleetingLuckEffect']).toBe('Gain')
  })
})

describe('updateFlagsForCrit / updateFlagsForFumble', () => {
  test('crit -> Gain, fumble -> Lose', () => {
    const c = {}; FleetingLuck.updateFlagsForCrit(c); expect(c['dcc.FleetingLuckEffect']).toBe('Gain')
    const f = {}; FleetingLuck.updateFlagsForFumble(f); expect(f['dcc.FleetingLuckEffect']).toBe('Lose')
  })

  test('null flags are tolerated', () => {
    expect(() => FleetingLuck.updateFlagsForCrit(null)).not.toThrow()
    expect(() => FleetingLuck.updateFlagsForFumble(undefined)).not.toThrow()
  })
})

describe('addUserContextOptions (Players list context menu, issue #826)', () => {
  // The v14 ContextMenu passes a plain HTMLElement to visible/onClick — no
  // jQuery wrapper — so these stubs model `li` as a bare { dataset } object.
  const makeLi = (userId) => ({ dataset: { userId } })
  let entry
  let users

  beforeEach(() => {
    users = {
      p1: { id: 'p1', isGM: false },
      gm: { id: 'gm', isGM: true }
    }
    globalThis.game = {
      users: { get: (id) => users[id] },
      user: { id: 'gm', isGM: true },
      settings: { get: vi.fn(() => true) }
    }
    const options = []
    FleetingLuck.addUserContextOptions({}, options)
    entry = options[0]
  })

  test('pushes a single v14-shaped entry (label/visible/onClick, class-name icon)', () => {
    expect(entry.label).toBe('DCC.FleetingLuckGive')
    expect(entry.icon).not.toMatch(/</) // class name string, not an <i> HTML string
    expect(typeof entry.visible).toBe('function')
    expect(typeof entry.onClick).toBe('function')
  })

  test('visible for a GM right-clicking a player when fleeting luck is enabled', () => {
    expect(entry.visible(makeLi('p1'))).toBe(true)
  })

  test('not visible when the fleeting luck setting is disabled', () => {
    globalThis.game.settings.get = vi.fn(() => false)
    expect(entry.visible(makeLi('p1'))).toBe(false)
  })

  test('not visible for non-GM users', () => {
    globalThis.game.user = { id: 'p1', isGM: false }
    expect(entry.visible(makeLi('p1'))).toBe(false)
  })

  test('not visible on GM entries (GMs are not tracked for fleeting luck)', () => {
    expect(entry.visible(makeLi('gm'))).toBe(false)
  })

  test('not visible (and no throw) for a stale/unknown user id', () => {
    expect(entry.visible(makeLi('deleted-user'))).toBe(false)
  })

  test('onClick awards one fleeting luck to the clicked user', () => {
    const give = vi.spyOn(FleetingLuck, 'give').mockResolvedValue(undefined)
    entry.onClick(new Event('click'), makeLi('p1'))
    expect(give).toHaveBeenCalledWith('p1', 1)
    give.mockRestore()
  })
})

describe('give / take / spend balance math', () => {
  let user
  const makeUser = (start) => {
    let v = start
    return { name: 'U', getFlag: () => v, setFlag: vi.fn((scope, key, val) => { v = val }) }
  }
  beforeEach(() => {
    FleetingLuck.addChatMessage = vi.fn(async () => {})
    FleetingLuck.refresh = vi.fn(async () => {})
    globalThis.game = {
      users: { get: () => user },
      i18n: { format: (k, d) => k },
      user: { id: 'u1' }
    }
  })

  test('give adds to the current value', async () => {
    user = makeUser(3)
    await FleetingLuck.give('u1', 4)
    expect(user.setFlag).toHaveBeenCalledWith('dcc', expect.anything(), 7)
  })

  test('give of 0 posts no chat message', async () => {
    user = makeUser(3)
    await FleetingLuck.give('u1', 0)
    expect(FleetingLuck.addChatMessage).not.toHaveBeenCalled()
  })

  test('take floors the new value at zero', async () => {
    user = makeUser(3)
    await FleetingLuck.take('u1', 5)
    expect(user.setFlag).toHaveBeenCalledWith('dcc', expect.anything(), 0)
  })

  test('take subtracts normally above the floor', async () => {
    user = makeUser(3)
    await FleetingLuck.take('u1', 1)
    expect(user.setFlag).toHaveBeenCalledWith('dcc', expect.anything(), 2)
  })

  test('spend also floors at zero', async () => {
    user = makeUser(2)
    await FleetingLuck.spend('u1', 10)
    expect(user.setFlag).toHaveBeenCalledWith('dcc', expect.anything(), 0)
  })
})
