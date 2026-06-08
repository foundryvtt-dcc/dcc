import { describe, test, expect, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'

vi.mock('../actor-level-change.js')

// _initDieAdditiveTerms coverage backfill (audit 2026-06-08). The integration test
// re-implements this regex rather than calling it, and the getInitiativeRoll path
// suppresses the additive tail — so the parser itself (which re-appends MCC's additive
// init die, e.g. 1d20+1d3, that the lib can't represent) had no direct unit coverage.

const additiveTail = (formula) => DCCActor.prototype._initDieAdditiveTerms.call(null, formula)

describe('_initDieAdditiveTerms', () => {
  test('extracts the additive die tail after the leading die', () => {
    expect(additiveTail('1d20+1d3')).toBe('+1d3')
    expect(additiveTail('1d20+1d7+7')).toBe('+1d7+7')
  })

  test('a bare leading die has no tail', () => {
    expect(additiveTail('1d20')).toBe('')
    expect(additiveTail('d20')).toBe('') // optional die count
  })

  test('empty / non-die input yields an empty tail', () => {
    expect(additiveTail('')).toBe('')
    expect(additiveTail(null)).toBe('')
    expect(additiveTail(undefined)).toBe('')
  })

  test('a flat modifier tail is preserved', () => {
    expect(additiveTail('1d20+2')).toBe('+2')
  })
})
