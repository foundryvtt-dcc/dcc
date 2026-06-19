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
