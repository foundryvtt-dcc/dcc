/* global uiNotificationsErrorMock */
/**
 * Adapter error-boundary unit tests — Phase 7 session 20.
 *
 * The public roll dispatchers wrap their bodies in
 * `withRollErrorBoundary` / `withRollErrorBoundarySync` (debug.mjs) so a
 * throw inside an `_xxxViaAdapter` / `_xxxLegacy` path surfaces to the
 * user (console.error + ui.notifications.error) instead of becoming a
 * silent unhandled rejection. The boundary is FAIL-LOUD: it rethrows,
 * it does NOT swallow the error or fall back to legacy — that preserves
 * the observational refactor's surface-bugs philosophy.
 *
 * The single exception is a roll-modifier-dialog cancellation (issue
 * #867): the user backing out is a decision, not a failure, so it exits
 * quietly. Everything else — including a non-`Error` rejection, which
 * used to log a contentless `null` — still notifies and rethrows.
 *
 * These tests pin both the helper contract directly and the
 * dispatcher-level wiring (a forced throw inside a real dispatcher is
 * notified + rethrown).
 */

import { expect, test, vi, beforeEach, afterEach } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import { withRollErrorBoundary, withRollErrorBoundarySync } from '../adapter/debug.mjs'
import { RollCancelledError } from '../roll-cancellation.mjs'

vi.mock('../actor-level-change.js')

// The mocked `game.i18n.format` returns the stripped key without
// interpolating `{rollType}`, so the rendered string can't be asserted
// directly. Spy on `format` instead and assert the boundary requested
// the notification key with the expected localized label in the data —
// that proves the right per-roll label flows through to the user.
let formatSpy

beforeEach(() => {
  uiNotificationsErrorMock.mockClear()
  // Fresh spy per test — `game.i18n` is a singleton, so a persisted spy
  // would accumulate format() calls across tests and leak labels.
  formatSpy = vi.spyOn(global.game.i18n, 'format')
})

afterEach(() => {
  formatSpy.mockRestore()
})

/** Assert the error notification was built with the given label. */
function expectNotifiedWithLabel (label) {
  expect(uiNotificationsErrorMock).toHaveBeenCalledTimes(1)
  const formatCall = formatSpy.mock.calls.find(
    ([key]) => key === 'DCC.RollErrorNotification'
  )
  expect(formatCall, 'format(DCC.RollErrorNotification, …) was called').toBeTruthy()
  expect(formatCall[1]).toEqual({ rollType: label })
}

// ── helper contract: async ────────────────────────────────────────────

test('withRollErrorBoundary returns fn result on the happy path (no notification)', async () => {
  const result = await withRollErrorBoundary('rollX', 'Label', () => 'ok')
  expect(result).toBe('ok')
  expect(uiNotificationsErrorMock).not.toHaveBeenCalled()
})

test('withRollErrorBoundary awaits an async fn result', async () => {
  const result = await withRollErrorBoundary('rollX', 'Label', async () => 'async-ok')
  expect(result).toBe('async-ok')
  expect(uiNotificationsErrorMock).not.toHaveBeenCalled()
})

test('withRollErrorBoundary notifies + rethrows on a sync throw', async () => {
  const boom = new Error('sync boom')
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(
    withRollErrorBoundary('rollX', 'Spell Check', () => { throw boom })
  ).rejects.toBe(boom)
  // Notified once, with the localized label passed to the message format.
  expectNotifiedWithLabel('Spell Check')
  expect(errorSpy).toHaveBeenCalled()
  errorSpy.mockRestore()
})

test('withRollErrorBoundary notifies + rethrows on an async rejection (await is load-bearing)', async () => {
  const boom = new Error('async boom')
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(
    withRollErrorBoundary('rollX', 'Save', async () => { throw boom })
  ).rejects.toBe(boom)
  expectNotifiedWithLabel('Save')
  errorSpy.mockRestore()
})

// ── helper contract: sync ─────────────────────────────────────────────

test('withRollErrorBoundarySync returns fn result without wrapping it in a promise', () => {
  const result = withRollErrorBoundarySync('getInit', 'Initiative', () => 'sync-ok')
  // Not a thenable — the init path must stay synchronous.
  expect(result).toBe('sync-ok')
  expect(typeof result?.then).not.toBe('function')
  expect(uiNotificationsErrorMock).not.toHaveBeenCalled()
})

test('withRollErrorBoundarySync notifies + rethrows synchronously on a throw', () => {
  const boom = new Error('sync-only boom')
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(
    () => withRollErrorBoundarySync('getInit', 'Initiative', () => { throw boom })
  ).toThrow(boom)
  expectNotifiedWithLabel('Initiative')
  errorSpy.mockRestore()
})

// ── cancellation is not a failure (issue #867) ────────────────────────

test('withRollErrorBoundary swallows a roll cancellation — no notification, no rethrow', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const result = await withRollErrorBoundary('rollWeaponAttack', 'Attack', async () => {
    throw new RollCancelledError()
  })
  // Resolves quietly with nothing — the click just does nothing, which
  // is what "Cancel" means. No red toast, no console noise.
  expect(result).toBeUndefined()
  expect(uiNotificationsErrorMock).not.toHaveBeenCalled()
  expect(errorSpy).not.toHaveBeenCalled()
  errorSpy.mockRestore()
})

test('withRollErrorBoundary swallows the legacy bare-null rejection', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const result = await withRollErrorBoundary('rollWeaponAttack', 'Attack', async () => {
    // eslint-disable-next-line no-throw-literal
    throw null
  })
  expect(result).toBeUndefined()
  expect(uiNotificationsErrorMock).not.toHaveBeenCalled()
  expect(errorSpy).not.toHaveBeenCalled()
  errorSpy.mockRestore()
})

test('withRollErrorBoundarySync swallows a roll cancellation', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const result = withRollErrorBoundarySync('getInit', 'Initiative', () => {
    throw new RollCancelledError()
  })
  expect(result).toBeUndefined()
  expect(uiNotificationsErrorMock).not.toHaveBeenCalled()
  errorSpy.mockRestore()
})

test('a non-Error rejection still produces a console line with content', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  // A bare object is NOT a cancellation, so it must still be reported —
  // and the log line must describe it rather than printing nothing.
  const junk = { code: 42 }
  await expect(
    withRollErrorBoundary('rollX', 'Attack', async () => { throw junk })
  ).rejects.toBe(junk)
  expectNotifiedWithLabel('Attack')
  const [message] = errorSpy.mock.calls[0]
  expect(message).toContain('rollX threw')
  expect(message).toContain('42')
  errorSpy.mockRestore()
})

// ── dispatcher-level wiring ───────────────────────────────────────────

test('rollAbilityCheck surfaces a thrown adapter error (notify + rethrow)', async () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const boom = new Error('adapter exploded')
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  // Force the adapter sub-path to throw.
  vi.spyOn(actor, '_rollAbilityCheckViaAdapter').mockImplementation(() => { throw boom })

  await expect(actor.rollAbilityCheck('str')).rejects.toBe(boom)
  expect(uiNotificationsErrorMock).toHaveBeenCalledTimes(1)
  errorSpy.mockRestore()
})

test('getInitiativeRoll surfaces a thrown adapter error synchronously (combat-tracker contract preserved)', () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  const boom = new Error('init exploded')
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(actor, '_getInitiativeRollViaAdapter').mockImplementation(() => { throw boom })

  // Throws synchronously — NOT a rejected promise — so Foundry's sync
  // combat-tracker init path still sees a thrown error, not an
  // unhandled rejection on a Promise it never awaits.
  expect(() => actor.getInitiativeRoll()).toThrow(boom)
  expect(uiNotificationsErrorMock).toHaveBeenCalledTimes(1)
  errorSpy.mockRestore()
})

test('a non-throwing dispatcher does not notify (happy path stays quiet)', async () => {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.attributes.init.die = '1d20'
  actor.system.attributes.init.value = 0
  actor.getInitiativeRoll()
  await actor.rollSavingThrow('ref')
  expect(uiNotificationsErrorMock).not.toHaveBeenCalled()
})
