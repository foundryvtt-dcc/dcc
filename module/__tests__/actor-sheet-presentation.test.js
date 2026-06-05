import { describe, test, expect, vi } from 'vitest'
import {
  prepareNotes,
  prepareCorruption,
  prepareImage,
  prepareCompendiumLinks
} from '../actor-sheet/presentation.mjs'

// Phase 7 (Appendix-A actor-sheet.js shrinkage): the four small context-field
// helpers (#prepareNotes / #prepareCorruption / #prepareImage /
// #prepareCompendiumLinks) were #private methods with NO prior unit coverage.
// Extracting them to free functions makes them directly testable — this whole
// file is a coverage win, not just a relocation guard. Foundry globals are
// injected via the deps params so no live Foundry is needed here.

// A fake TextEditor whose enrichHTML echoes its inputs so tests can assert both
// the source string and the enrichment context (relativeTo / secrets).
const fakeTextEditor = () => ({
  enrichHTML: vi.fn(async (html, context) => ({ html, context }))
})

describe('prepareNotes', () => {
  test('enriches the actor notes value with relativeTo + owner secrets', async () => {
    const TextEditor = fakeTextEditor()
    const actor = { isOwner: true, system: { details: { notes: { value: '<p>hi</p>' } } } }
    const result = await prepareNotes(actor, { TextEditor })
    expect(result).toEqual({ html: '<p>hi</p>', context: { relativeTo: actor, secrets: true } })
    expect(TextEditor.enrichHTML).toHaveBeenCalledOnce()
  })

  test('passes secrets=false for a non-owner', async () => {
    const TextEditor = fakeTextEditor()
    const actor = { isOwner: false, system: { details: { notes: { value: '' } } } }
    const result = await prepareNotes(actor, { TextEditor })
    expect(result.context.secrets).toBe(false)
  })
})

describe('prepareCorruption', () => {
  test('enriches class.corruption for a class-bearing actor', async () => {
    const TextEditor = fakeTextEditor()
    const actor = { isOwner: true, system: { class: { corruption: '<p>taint</p>' } } }
    const result = await prepareCorruption(actor, { TextEditor })
    expect(result).toEqual({ html: '<p>taint</p>', context: { relativeTo: actor, secrets: true } })
  })

  test('falls back to empty string when class.corruption is missing', async () => {
    const TextEditor = fakeTextEditor()
    const actor = { isOwner: true, system: { class: {} } }
    const result = await prepareCorruption(actor, { TextEditor })
    expect(result).toEqual({ html: '', context: { relativeTo: actor, secrets: true } })
  })

  test('returns "" without enriching for an actor with no class block (NPC)', async () => {
    const TextEditor = fakeTextEditor()
    const actor = { isOwner: true, system: {} }
    const result = await prepareCorruption(actor, { TextEditor })
    expect(result).toBe('')
    expect(TextEditor.enrichHTML).not.toHaveBeenCalled()
  })
})

describe('prepareImage', () => {
  const imageForActor = vi.fn((type) => `default/${type}.webp`)

  test('keeps a real custom image', () => {
    const actor = { type: 'Player', img: 'worlds/me.webp' }
    expect(prepareImage(actor, { imageForActor })).toBe('worlds/me.webp')
  })

  test('falls back to the type-default icon when img is the mystery-man placeholder', () => {
    const actor = { type: 'NPC', img: 'icons/svg/mystery-man.svg' }
    expect(prepareImage(actor, { imageForActor })).toBe('default/NPC.webp')
  })

  test('falls back to the type-default icon when img is empty/undefined', () => {
    expect(prepareImage({ type: 'Player', img: '' }, { imageForActor })).toBe('default/Player.webp')
    expect(prepareImage({ type: 'Player' }, { imageForActor })).toBe('default/Player.webp')
  })
})

describe('prepareCompendiumLinks', () => {
  test('returns the coreBookCompendiumLinks from the injected config', () => {
    const links = { weapons: 'dcc-core-book.weapons' }
    expect(prepareCompendiumLinks({ coreBookCompendiumLinks: links })).toBe(links)
  })

  test('returns undefined when config or the links table is absent', () => {
    expect(prepareCompendiumLinks({})).toBeUndefined()
    expect(prepareCompendiumLinks(undefined)).toBeUndefined()
  })
})
