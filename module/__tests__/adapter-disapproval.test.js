/**
 * `module/adapter/disapproval.mjs` — the shared disapproval roll (#961).
 *
 * Foundry evaluates `(natural)d4 − Luck`; the lib's `rollDisapproval`
 * (real vendored code, not mocked) resolves the result and table entry.
 * The table loader and chat renderer are stubbed so the assertions read
 * exactly what the lib was handed and what would be posted.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../adapter/spell-input.mjs', () => ({
  loadDisapprovalTable: vi.fn()
}))
vi.mock('../adapter/chat-renderer.mjs', () => ({
  renderDisapprovalRoll: vi.fn(async () => ({}))
}))

const { loadDisapprovalTable } = await import('../adapter/spell-input.mjs')
const { renderDisapprovalRoll } = await import('../adapter/chat-renderer.mjs')
const { readDisapprovalRoll, resolveDisapprovalRoll } = await import('../adapter/disapproval.mjs')

// One row per value so each lookup is visible.
const table = {
  id: 'disapproval',
  name: 'Disapproval',
  type: 'simple',
  entries: Array.from({ length: 20 }, (_, i) => ({ min: i + 1, max: i + 1, text: `Row ${i + 1}` }))
}

/** An evaluated Foundry Roll for `${count}d4 ± luck` with the given dice total. */
function fakeRoll ({ count, diceTotal, luckModifier = 0 }) {
  return {
    dice: [{ number: count, faces: 4, total: diceTotal }],
    total: diceTotal - luckModifier
  }
}

function cleric (disapproval = 3) {
  return { name: 'Brother Cleric', system: { class: { disapproval } } }
}

beforeEach(() => {
  loadDisapprovalTable.mockReset()
  renderDisapprovalRoll.mockClear()
})

describe('readDisapprovalRoll', () => {
  test('reads the d4 count, the dice total, and the Luck adjustment', () => {
    expect(readDisapprovalRoll(fakeRoll({ count: 3, diceTotal: 9, luckModifier: 2 })))
      .toEqual({ diceCount: 3, diceTotal: 9, luckModifier: 2 })
  })

  test('a negative Luck modifier adds to the total', () => {
    expect(readDisapprovalRoll(fakeRoll({ count: 2, diceTotal: 5, luckModifier: -1 })))
      .toEqual({ diceCount: 2, diceTotal: 5, luckModifier: -1 })
  })

  test('a dialog-edited formula with several dice terms sums every die', () => {
    const roll = {
      dice: [{ number: 2, total: 5 }, { number: 1, total: 3 }],
      total: 7 // 2d4 + 1d4 − 1
    }
    expect(readDisapprovalRoll(roll)).toEqual({ diceCount: 2, diceTotal: 8, luckModifier: 1 })
  })

  test('a formula with no dice treats the whole total as the adjustment', () => {
    expect(readDisapprovalRoll({ dice: [], total: 4 }))
      .toEqual({ diceCount: 1, diceTotal: 0, luckModifier: -4 })
  })
})

describe('resolveDisapprovalRoll', () => {
  test('the lib result matches the Foundry total and looks up that row', async () => {
    loadDisapprovalTable.mockResolvedValue(table)
    const roll = fakeRoll({ count: 3, diceTotal: 9, luckModifier: 2 })

    const result = await resolveDisapprovalRoll({ actor: cleric(3), roll })

    expect(result).toMatchObject({
      roll: 7,
      formula: '3d4',
      diceCount: 3,
      luckModifier: 2,
      description: 'Row 7',
      disapprovalRange: 3
    })
    expect(renderDisapprovalRoll).toHaveBeenCalledWith({
      actor: expect.anything(),
      disapprovalResult: result,
      roll
    })
  })

  test('Luck pushing the roll below 1 looks up row 1', async () => {
    loadDisapprovalTable.mockResolvedValue(table)

    const result = await resolveDisapprovalRoll({
      actor: cleric(1),
      roll: fakeRoll({ count: 1, diceTotal: 1, luckModifier: 2 })
    })

    expect(result.roll).toBe(-1)
    expect(result.description).toBe('Row 1')
  })

  test('the lib total equals the Foundry total for an edited formula', async () => {
    loadDisapprovalTable.mockResolvedValue(table)
    const roll = { dice: [{ number: 2, total: 5 }, { number: 1, total: 3 }], total: 7 }

    const result = await resolveDisapprovalRoll({ actor: cleric(), roll })

    expect(result.roll).toBe(roll.total)
  })

  test('a roll past the last row reports a miss with no English fallback text', async () => {
    loadDisapprovalTable.mockResolvedValue(table)

    const result = await resolveDisapprovalRoll({
      actor: cleric(10),
      roll: fakeRoll({ count: 10, diceTotal: 31 })
    })

    expect(result.roll).toBe(31)
    expect(result.matched).toBe(false)
    expect(result.description).toBe('')
  })

  test('records the range passed by the caller over the actor\'s current range', async () => {
    loadDisapprovalTable.mockResolvedValue(table)

    // The cast already raised the actor to 4; the check was against 3.
    const result = await resolveDisapprovalRoll({
      actor: cleric(4),
      roll: fakeRoll({ count: 2, diceTotal: 5 }),
      disapprovalRange: 3
    })

    expect(result.disapprovalRange).toBe(3)
  })

  test('with no table configured the roll is posted without a result', async () => {
    loadDisapprovalTable.mockResolvedValue(null)
    const roll = fakeRoll({ count: 2, diceTotal: 6 })

    const result = await resolveDisapprovalRoll({ actor: cleric(), roll })

    expect(result).toBeNull()
    expect(renderDisapprovalRoll).toHaveBeenCalledWith({
      actor: expect.anything(),
      disapprovalResult: null,
      roll
    })
  })
})
