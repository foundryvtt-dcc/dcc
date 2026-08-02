/**
 * Roll-cancellation signal (issue #867).
 *
 * Closing the roll-modifier dialog used to `reject(null)`, which every
 * layer above it read as a crash: `withRollErrorBoundary` logged an
 * empty `null` and showed the player "The Attack roll failed
 * unexpectedly". These tests pin the replacement contract — a cancel is
 * a typed `RollCancelledError`, `isRollCancellation` recognizes it (and
 * the legacy bare `null`), and `rollOrNullOnCancel` turns it into a
 * `null` roll while letting real failures through.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import { RollCancelledError, isRollCancellation, rollOrNullOnCancel } from '../roll-cancellation.mjs'

describe('RollCancelledError', () => {
  test('is an Error with a duck-typed marker', () => {
    const err = new RollCancelledError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('RollCancelledError')
    expect(err.isRollCancellation).toBe(true)
    // Never contentless — the whole point of #867.
    expect(err.message.length).toBeGreaterThan(0)
  })
})

describe('isRollCancellation', () => {
  test('recognizes a RollCancelledError', () => {
    expect(isRollCancellation(new RollCancelledError())).toBe(true)
  })

  test('recognizes the duck-typed marker from another copy of the module', () => {
    // A sibling module (dcc-qol, xcc, …) loading its own copy of this
    // file produces a structurally identical error that fails
    // `instanceof` across the realm boundary.
    expect(isRollCancellation({ isRollCancellation: true })).toBe(true)
  })

  test('recognizes the legacy bare-null cancel signal', () => {
    expect(isRollCancellation(null)).toBe(true)
  })

  test('does NOT treat undefined as a cancellation', () => {
    // Nothing has ever rejected with `undefined`, and the boundary
    // swallows a cancellation without rethrowing — so accepting it would
    // make an accidental `throw someUninitializedVar` vanish silently.
    expect(isRollCancellation(undefined)).toBe(false)
  })

  test('does not swallow a real error', () => {
    expect(isRollCancellation(new Error('boom'))).toBe(false)
    expect(isRollCancellation(new TypeError('nope'))).toBe(false)
    expect(isRollCancellation('some string')).toBe(false)
    expect(isRollCancellation(0)).toBe(false)
  })
})

describe('rollOrNullOnCancel', () => {
  test('passes a resolved roll straight through', async () => {
    const roll = { formula: '1d20' }
    await expect(rollOrNullOnCancel(Promise.resolve(roll))).resolves.toBe(roll)
  })

  test('returns null when the user cancels', async () => {
    await expect(
      rollOrNullOnCancel(Promise.reject(new RollCancelledError()))
    ).resolves.toBeNull()
  })

  test('returns null for the legacy bare-null rejection', async () => {
    // eslint-disable-next-line prefer-promise-reject-errors
    await expect(rollOrNullOnCancel(Promise.reject(null))).resolves.toBeNull()
  })

  test('rethrows a genuine failure', async () => {
    const boom = new Error('dialog exploded')
    await expect(rollOrNullOnCancel(Promise.reject(boom))).rejects.toBe(boom)
  })
})

describe('RollModifierDialog cancel path', () => {
  let proto

  beforeEach(async () => {
    const mod = await import('../roll-modifier.js')
    proto = mod.RollModifierDialog.prototype
  })

  test('close() rejects the roll promise with a RollCancelledError, not null', async () => {
    const reject = vi.fn()
    const ctx = {
      _reject: reject,
      _cancel: proto._cancel
    }
    ctx._cancel()
    expect(reject).toHaveBeenCalledTimes(1)
    const [thrown] = reject.mock.calls[0]
    expect(isRollCancellation(thrown)).toBe(true)
    expect(thrown).toBeInstanceOf(RollCancelledError)
  })

  test('_cancel() is inert when the dialog has no reject handler', () => {
    // `createRollFromTerms` builds a never-rendered dialog with
    // (resolve, reject) = (null, null).
    expect(() => proto._cancel.call({ _reject: null })).not.toThrow()
  })
})
