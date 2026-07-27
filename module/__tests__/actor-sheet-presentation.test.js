import { describe, test, expect, vi } from 'vitest'
import {
  prepareNotes,
  prepareCorruption,
  prepareImage,
  prepareCompendiumLinks,
  prepareActionDiceContext
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

describe('prepareActionDiceContext', () => {
  // A settings double whose get() returns the configured master-switch value.
  const settingsReturning = (value) => ({ get: vi.fn(() => value) })
  // An i18n double: localize echoes the key, format appends the slot/use.
  const fakeI18n = {
    localize: (key) => key,
    format: (key, data) => `${key}:${data.slot}:${data.use}`
  }
  const actorWithList = (list) => ({ system: { attributes: { actionDice: { list } } } })

  test('off ⇒ no chips even when a list is present', () => {
    const ctx = prepareActionDiceContext(
      actorWithList([{ slot: 0, die: 'd20', use: 'any' }, { slot: 1, die: 'd14', use: 'any' }]),
      { settings: settingsReturning(false), i18n: fakeI18n }
    )
    expect(ctx.multipleActionDice).toBe(false)
    expect(ctx.showActionDiceChips).toBe(false)
  })

  test('on + 2 dice ⇒ chips with labels and tooltips', () => {
    const ctx = prepareActionDiceContext(
      actorWithList([
        { slot: 0, die: 'd20', modifier: 0, use: 'any' },
        { slot: 1, die: 'd16', modifier: 0, use: 'spell' }
      ]),
      { settings: settingsReturning(true), i18n: fakeI18n }
    )
    expect(ctx.showActionDiceChips).toBe(true)
    expect(ctx.actionDiceChips.map(c => c.label)).toEqual(['1d20', '1d16'])
    expect(ctx.actionDiceChips[0].restricted).toBe(false)
    expect(ctx.actionDiceChips[1].restricted).toBe(true)
    // tooltip uses 1-based slot number and the localized use label
    expect(ctx.actionDiceChips[1].tooltip).toBe('DCC.ActionDiceChipHint:2:DCC.ActionDieUseSpell')
  })

  test('on + single die ⇒ no chips (single-die actors unchanged)', () => {
    const ctx = prepareActionDiceContext(
      actorWithList([{ slot: 0, die: 'd20', use: 'any' }]),
      { settings: settingsReturning(true), i18n: fakeI18n }
    )
    expect(ctx.multipleActionDice).toBe(true)
    expect(ctx.showActionDiceChips).toBe(false)
  })

  test('on but no derived list ⇒ no chips, no throw', () => {
    const ctx = prepareActionDiceContext(
      { system: { attributes: { actionDice: {} } } },
      { settings: settingsReturning(true), i18n: fakeI18n }
    )
    expect(ctx.actionDiceChips).toEqual([])
    expect(ctx.showActionDiceChips).toBe(false)
  })

  test('treats a throwing settings.get as off (settings not yet registered)', () => {
    const settings = { get: vi.fn(() => { throw new Error('not registered') }) }
    const ctx = prepareActionDiceContext(actorWithList([]), { settings, i18n: fakeI18n })
    expect(ctx.multipleActionDice).toBe(false)
    expect(ctx.showActionDiceChips).toBe(false)
  })
})

describe('prepareActionDiceContext — live combat state (issue #834 §2)', () => {
  // Master + tracking both on; the settings double answers any dcc key.
  const bothOn = { get: vi.fn(() => true) }
  const i18n = {
    localize: (key) => key,
    format: (key, data) => `${key}|${JSON.stringify(data)}`
  }
  const actorWithList = (list, isOwner = false) => ({
    isOwner,
    system: { attributes: { actionDice: { list } } }
  })
  const twoSlots = [
    { slot: 0, die: 'd20', modifier: 0, use: 'any' },
    { slot: 1, die: 'd16', modifier: 0, use: 'any' }
  ]
  const combatantWithState = (state) => ({
    getFlag: (scope, key) => (scope === 'dcc' && key === 'actionDice' ? state : undefined)
  })

  test('in combat, chips carry live spent state, glyphs and toggle affordances (GM)', () => {
    const ctx = prepareActionDiceContext(actorWithList(twoSlots), {
      settings: bothOn,
      i18n,
      user: { isGM: true },
      lookupCombatant: () => combatantWithState({ round: 3, spent: [true, false] }),
      combat: { round: 3 }
    })
    expect(ctx.actionDiceTracking).toBe(true)
    expect(ctx.actionDiceInteractive).toBe(true)
    expect(ctx.actionDiceChips.map(c => c.spent)).toEqual([true, false])
    expect(ctx.actionDiceChips.map(c => c.stateGlyph)).toEqual(['○', '●'])
    expect(ctx.actionDiceChips[0].cssClass).toBe('action-die-chip spent interactive')
    expect(ctx.actionDiceChips[1].cssClass).toBe('action-die-chip ready interactive')
    expect(ctx.actionDiceChips[0].tooltip)
      .toBe('DCC.ActionDiceChipToggleHint|{"slot":1,"use":"DCC.ActionDieUseAny","state":"DCC.ActionDieStateSpent"}')
  })

  test('a stale (previous-round) state reads all-ready', () => {
    const ctx = prepareActionDiceContext(actorWithList(twoSlots), {
      settings: bothOn,
      i18n,
      user: { isGM: true },
      lookupCombatant: () => combatantWithState({ round: 2, spent: [true, true] }),
      combat: { round: 3 }
    })
    expect(ctx.actionDiceChips.map(c => c.spent)).toEqual([false, false])
  })

  test('a non-owner spectator sees state but no toggle affordance', () => {
    const ctx = prepareActionDiceContext(actorWithList(twoSlots, false), {
      settings: bothOn,
      i18n,
      user: { isGM: false },
      lookupCombatant: () => combatantWithState(null),
      combat: { round: 1 }
    })
    expect(ctx.actionDiceTracking).toBe(true)
    expect(ctx.actionDiceInteractive).toBe(false)
    expect(ctx.actionDiceChips[0].cssClass).toBe('action-die-chip ready')
    expect(ctx.actionDiceChips[0].tooltip.startsWith('DCC.ActionDiceChipStateHint|')).toBe(true)
  })

  test('out of combat the chips stay a static listing', () => {
    const ctx = prepareActionDiceContext(actorWithList(twoSlots, true), {
      settings: bothOn,
      i18n,
      user: { isGM: true },
      lookupCombatant: () => null,
      combat: null
    })
    expect(ctx.actionDiceTracking).toBe(false)
    expect(ctx.actionDiceInteractive).toBe(false)
    expect(ctx.actionDiceChips[0].cssClass).toBe('action-die-chip')
    expect(ctx.actionDiceChips[0].stateGlyph).toBe('')
    expect(ctx.actionDiceChips[0].tooltip.startsWith('DCC.ActionDiceChipHint|')).toBe(true)
  })

  test('restricted chips keep their marker class alongside live state', () => {
    const list = [
      { slot: 0, die: 'd20', modifier: 0, use: 'any' },
      { slot: 1, die: 'd16', modifier: 0, use: 'spell' }
    ]
    const ctx = prepareActionDiceContext(actorWithList(list), {
      settings: bothOn,
      i18n,
      user: { isGM: true },
      lookupCombatant: () => combatantWithState(null),
      combat: { round: 1 }
    })
    expect(ctx.actionDiceChips[1].cssClass).toBe('action-die-chip restricted ready interactive')
  })
})
