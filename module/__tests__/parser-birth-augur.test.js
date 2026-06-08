import { describe, test, expect, vi, beforeEach } from 'vitest'
import '../__mocks__/foundry.js'
import { _applyBirthAugurEffect } from '../parser.js'

// parser.js coverage backfill (audit 2026-06-08: parser.js was never imported by any
// test). _applyBirthAugurEffect parses a luck mod + augur name out of free text and
// applies a matching compendium ActiveEffect — with four silent guard returns where a
// regex regression or a renamed pack would drop the effect unnoticed.

// A fake compendium pack: index of { name, _id } + getDocument returning a doc whose
// toObject() carries an _id the function must strip before create.
const makePack = (names) => ({
  index: names.map((name, i) => ({ name, _id: `e${i}` })),
  getDocument: vi.fn(async (id) => ({
    toObject: () => ({ _id: id, name: 'Effect', changes: [{ key: 'system.x', value: '1' }] })
  }))
})

let actor
beforeEach(() => {
  actor = { update: vi.fn(async () => {}), createEmbeddedDocuments: vi.fn(async () => {}) }
  globalThis.CONFIG = globalThis.CONFIG || {}
  globalThis.CONFIG.DCC = { ...(globalThis.CONFIG.DCC || {}), birthAugurEffectsPack: 'dcc.augurs' }
  globalThis.game = globalThis.game || {}
  globalThis.game.packs = { get: vi.fn(() => makePack(['Harsh winter', 'Bountiful harvest'])) }
})

describe('_applyBirthAugurEffect', () => {
  test('sets the luck mod and applies the matching effect (id stripped)', async () => {
    await _applyBirthAugurEffect(actor, 'Harsh winter (All attack rolls) (+2)')

    expect(actor.update).toHaveBeenCalledWith({ 'system.details.birthAugurLuckMod': 2 })
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
    const [docType, [effectData]] = actor.createEmbeddedDocuments.mock.calls[0]
    expect(docType).toBe('ActiveEffect')
    expect(effectData._id).toBeUndefined() // stripped before create
    expect(effectData.changes).toBeDefined()
  })

  test('parses a negative luck mod', async () => {
    await _applyBirthAugurEffect(actor, 'Unlucky (Saving throws) (-1)')
    expect(actor.update).toHaveBeenCalledWith({ 'system.details.birthAugurLuckMod': -1 })
  })

  test('does not write a luck mod when no trailing (+N) is present', async () => {
    await _applyBirthAugurEffect(actor, 'Harsh winter (All attack rolls)')
    expect(actor.update).not.toHaveBeenCalled()
    // augur name still resolves + applies the effect
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
  })

  test('no-ops on an empty augur name (text starting with a parenthetical)', async () => {
    await _applyBirthAugurEffect(actor, '(+2)')
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('returns quietly when the compendium pack is missing', async () => {
    globalThis.game.packs.get = vi.fn(() => undefined)
    await _applyBirthAugurEffect(actor, 'Harsh winter (+2)')
    expect(actor.update).toHaveBeenCalled() // luck mod still written before the pack lookup
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('returns quietly when no index entry starts with the augur name', async () => {
    globalThis.game.packs.get = vi.fn(() => makePack(['Some other augur']))
    await _applyBirthAugurEffect(actor, 'Harsh winter (+2)')
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled()
  })

  test('matches case-insensitively via startsWith (augur name is a prefix of the effect name)', async () => {
    globalThis.game.packs.get = vi.fn(() => makePack(['Harsh Winter, the All-attack Augur']))
    await _applyBirthAugurEffect(actor, 'harsh winter (+0)')
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1)
  })
})
