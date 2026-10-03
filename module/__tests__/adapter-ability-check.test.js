/* global rollToMessageMock, ChatMessage */
/**
 * Adapter round-trip test — Phase 1.
 *
 * Exercises the full adapter flow for a non-legacy ability check:
 *   DCCActor._rollAbilityCheckViaAdapter →
 *   actorToCharacter →
 *   libRollAbilityCheck pass 1 ({mode:'formula'}) →
 *   inline `new Roll(plan.formula).evaluate()` (Foundry owns the dice) →
 *   libRollAbilityCheck pass 2 ({mode:'evaluate', roller: () => natural}) →
 *   chat-renderer (builds ChatMessage).
 *
 * Locks the contract between the Foundry adapter and dcc-core-lib
 * before the next check/save/init migrations reuse the pattern.
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor.js'
import { actorToCharacter } from '../adapter/character-accessors.mjs'

// Mock actor-level-change like actor.test.js does
vi.mock('../actor-level-change.js')

// Build an actor. This goes through the same mock path as actor.test.js.
// noinspection JSCheckFunctionSignatures
const actor = new DCCActor()

test('actor → character accessor shape', () => {
  const character = actorToCharacter(actor)

  // Ability scores flow through
  expect(character.state.abilities.str.current).toBe(6)
  expect(character.state.abilities.lck.current).toBe(18)
  expect(character.state.abilities.per.current).toBe(16)

  // Save ids are remapped frt/ref/wil → fortitude/reflex/will
  expect(character.state.saves.fortitude).toBe(-1)
  expect(character.state.saves.reflex).toBe(0)
  expect(character.state.saves.will).toBe(2)

  // Level + classInfo
  expect(character.classInfo.level).toBe(1)
})

test('actor → character passes the effective score (value + otherMod) as current (#801)', () => {
  // noinspection JSCheckFunctionSignatures
  const boosted = new DCCActor()
  boosted.system.abilities.str.otherMod = 2
  boosted.prepareBaseData() // recompute effectiveValue with the otherMod applied

  const character = actorToCharacter(boosted)
  expect(character.state.abilities.str.current).toBe(8) // 6 + 2
  // max falls back to the raw base value, unshifted by otherMod
  expect(character.state.abilities.str.max).toBe(6)
})

test('adapter path invokes lib and renders ChatMessage', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // Luck check (not str/agl, no dialog, no rollUnder) → adapter path
  await actor.rollAbilityCheck('lck')

  // Chat-renderer called toMessage with adapter-produced data
  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData, toMessageOpts] = rollToMessageMock.mock.calls[0]

  expect(messageData.flavor).toBe('Luck Check')
  expect(messageData.flags['dcc.Ability']).toBe('lck')
  expect(messageData.flags['dcc.RollType']).toBe('AbilityCheck')
  expect(messageData.flags['dcc.isAbilityCheck']).toBe(true)
  // lck is not str/agl, so checkPenaltyCouldApply must NOT be set
  expect(messageData.flags.checkPenaltyCouldApply).toBeUndefined()

  // Lib result attached in flags (schema-free JSON). system.* is
  // schema-constrained and would drop unknown keys; flags accept
  // arbitrary module namespaces like 'dcc.libResult'.
  expect(messageData.flags['dcc.libResult']).toBeDefined()
  expect(messageData.flags['dcc.libResult'].skillId).toBe('ability:lck')
  expect(Array.isArray(messageData.flags['dcc.libResult'].modifiers)).toBe(true)

  // toMessage called with create: false so we can inject into messageData.rolls[]
  expect(toMessageOpts).toEqual({ create: false })

  // ChatMessage.create is called at the end to actually post
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()
})

test('rollUnder (Luck check) routes through the lib luck-check adapter path', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // Roll-under now flows through _rollLuckCheckViaAdapter → lib
  // rollLuckCheck (no longer the legacy DCCRoll term-builder).
  await actor.rollAbilityCheck('lck', { rollUnder: true })

  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData, toMessageOpts] = rollToMessageMock.mock.calls[0]

  // Roll-under flag contract (unchanged from the legacy path); the flavor
  // now carries an explicit success/failure suffix (mock natural 10 vs
  // mock lck 18 → success).
  expect(messageData.flags['dcc.RollType']).toBe('AbilityCheckRollUnder')
  expect(messageData.flags['dcc.Ability']).toBe('lck')
  expect(messageData.flags['dcc.isAbilityCheck']).toBe(true)
  expect(messageData.flavor).toBe('Luck CheckRollUnder — Success')

  // Roll-under is a naked d20 — no modifier breakdown, so (unlike the
  // standard ability check) it carries NO dcc.libResult flag and does
  // NOT set checkPenaltyCouldApply.
  expect(messageData.flags['dcc.libResult']).toBeUndefined()
  expect(messageData.flags.checkPenaltyCouldApply).toBeUndefined()
  expect(messageData.system).toEqual({ checkPenaltyRollIndex: null })

  expect(toMessageOpts).toEqual({ create: false })
  expect(chatMessageCreateSpy).toHaveBeenCalledTimes(1)

  chatMessageCreateSpy.mockRestore()
})

test('rollUnder tags the rolled die with roll-under thresholds from the Luck score', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  await actor.rollAbilityCheck('lck', { rollUnder: true })

  // The Foundry Roll is the `this` of the toMessage call. The renderer
  // tags terms[0] so module/chat.js's highlight hook swaps the
  // success/failure classes (roll ≤ score = success). Thresholds derive
  // from the Luck score the lib classified against (mock lck = 18):
  // lowerThreshold = 18 (≤ = success/critical), upperThreshold = 19.
  const foundryRoll = rollToMessageMock.mock.contexts[0]
  expect(foundryRoll.terms[0].options.dcc).toEqual({
    rollUnder: true,
    lowerThreshold: 18,
    upperThreshold: 19
  })

  chatMessageCreateSpy.mockRestore()
})

// Legacy-decom step 2: the modifier dialog is handled adapter-side (the
// former legacy ability-check body was deleted at session 25). The
// adapter surfaces the unified
// `RollModifierDialog` via `promptRollModifierDialog`, then folds the
// user's flattened die + total into a `rollCheck` pass (bare definition
// + one `dialog-modifier` line, suppressing the lib's auto-ability add
// since the dialog total already includes the ability mod).
test('adapter path opens RollModifierDialog when showModifierDialog is true', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  // Simulate the user submitting the dialog with a bumped die (1d24) and
  // a +3 total (Luck 18 → +3 ability mod). Same Roll shape the real
  // dialog yields.
  global.dccRollCreateRollMock.mockImplementationOnce(() => ({
    formula: '1d24+3',
    total: 14,
    dice: [{ results: [11], total: 11, options: {} }],
    options: { dcc: {} },
    terms: [
      { class: 'Die', formula: '1d24', number: 1, faces: 24 },
      { class: 'OperatorTerm', operator: '+' },
      { class: 'NumericTerm', number: 3 }
    ],
    _evaluated: true
  }))

  await actor.rollAbilityCheck('lck', { showModifierDialog: true })

  // The dialog was surfaced adapter-side (through DCCRoll.createRoll).
  expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(1)
  const createCall = global.dccRollCreateRollMock.mock.calls[0]
  const termsArg = createCall[0]
  expect(Array.isArray(termsArg)).toBe(true)
  // Action-die term + the Luck ability modifier term are present.
  expect(termsArg.some(t => t.type === 'Die' && t.formula === '1d20')).toBe(true)
  expect(termsArg.some(t => t.type === 'Modifier' && t.formula === '+3')).toBe(true)
  // lck is not str/agl, so NO check-penalty term is offered.
  expect(termsArg.some(t => t.type === 'CheckPenalty')).toBe(false)
  expect(createCall[2].showModifierDialog).toBe(true)

  expect(rollToMessageMock).toHaveBeenCalledTimes(1)
  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flags['dcc.RollType']).toBe('AbilityCheck')
  expect(messageData.flags['dcc.Ability']).toBe('lck')

  const libResult = messageData.flags['dcc.libResult']
  expect(libResult).toBeDefined()
  // Die was bumped to d24 by the dialog.
  expect(libResult.die).toBe('d24')
  // Per-source attribution collapsed to one flat `dialog-modifier` line.
  const dialogMod = libResult.modifiers.find(m => m.origin?.id === 'dialog-modifier')
  expect(dialogMod).toBeDefined()
  expect(dialogMod.kind).toBe('add')
  expect(dialogMod.value).toBe(3)
})

test('dialog path uses the effective-derived mod, not a raw-value re-derivation (#801)', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  // Base 12 -> mod +0, but effective 13 (12 + otherMod 1) -> mod +1. A
  // re-derivation from ability.value would offer '+0' in the dialog and
  // silently drop the effect bonus the non-dialog roll includes.
  // noinspection JSCheckFunctionSignatures
  const boosted = new DCCActor()
  boosted.system.abilities.str.value = 12
  boosted.system.abilities.str.otherMod = 1
  boosted.prepareBaseData()

  global.dccRollCreateRollMock.mockImplementationOnce(() => ({
    formula: '1d20+1',
    total: 12,
    dice: [{ results: [11], total: 11, options: {} }],
    options: { dcc: {} },
    terms: [
      { class: 'Die', formula: '1d20', number: 1, faces: 20 },
      { class: 'OperatorTerm', operator: '+' },
      { class: 'NumericTerm', number: 1 }
    ],
    _evaluated: true
  }))

  await boosted.rollAbilityCheck('str', { showModifierDialog: true })

  const termsArg = global.dccRollCreateRollMock.mock.calls[0][0]
  const modifierTerm = termsArg.find(t => t.type === 'Modifier')
  expect(modifierTerm.formula).toBe('+1')
})

test('rollUnder thresholds follow the effective Luck score when otherMod shifts it (#801)', async () => {
  rollToMessageMock.mockClear()
  const chatMessageCreateSpy = vi.spyOn(ChatMessage, 'create')

  // Base lck 18 with a -2 otherMod penalty -> effective 16: the lib
  // classifies roll-under against `current` (the effective score), so
  // the success boundary must be 16, not the raw 18.
  // noinspection JSCheckFunctionSignatures
  const cursed = new DCCActor()
  cursed.system.abilities.lck.otherMod = -2
  cursed.prepareBaseData()

  await cursed.rollAbilityCheck('lck', { rollUnder: true })

  const foundryRoll = rollToMessageMock.mock.contexts[0]
  expect(foundryRoll.terms[0].options.dcc).toEqual({
    rollUnder: true,
    lowerThreshold: 16,
    upperThreshold: 17
  })

  chatMessageCreateSpy.mockRestore()
})

test('rollUnder flavor indicates failure when the roll exceeds the Luck score', async () => {
  rollToMessageMock.mockClear()

  // Luck 5 vs the mock's natural 10 → roll > score → failure suffix.
  // noinspection JSCheckFunctionSignatures
  const unlucky = new DCCActor()
  unlucky.system.abilities.lck.value = 5
  unlucky.prepareBaseData()

  await unlucky.rollAbilityCheck('lck', { rollUnder: true })

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.flavor).toBe('Luck CheckRollUnder — Failure')
})

test('adapter path returns undefined when the ability-check dialog is cancelled', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  // RollModifierDialog cancel resolves with `null`.
  global.dccRollCreateRollMock.mockImplementationOnce(() => null)

  const result = await actor.rollAbilityCheck('lck', { showModifierDialog: true })

  expect(result).toBeUndefined()
  expect(rollToMessageMock).not.toHaveBeenCalled()
})

// Armor check penalty note (#951): a non-zero penalty on a str/agl
// ability check is NOT applied to the roll. The would-be total rides on
// the `dcc.checkPenalty` flag and renders as a labeled plain-text note
// ("With check penalty (-2): 8") in the card body; emote mode renders the
// same note from the flag (module/chat.js). No bare secondary roll is
// attached any more, so card mode no longer shows an unlabeled number.
const PENALTY_NOTE_HTML = '<p class="dcc-check-penalty-note">With check penalty (-2): 8</p>'

/**
 * Roll a check with the given armor check penalty, restoring the actor
 * afterwards. Returns the toMessage data and the created message data.
 */
async function rollWithPenalty (penalty, roll, { computeCheckPenalty = true } = {}) {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()
  const created = []
  const chatMessageCreateSpy = vi
    .spyOn(ChatMessage, 'create')
    .mockImplementation(d => { created.push(d); return d })
  // Real Foundry's toMessage({create:false}) returns the message data
  // with rolls: [primaryRoll]; the mock returns undefined, so synthesize
  // it. `this` is the primary Foundry Roll the renderer called it on.
  rollToMessageMock.mockImplementationOnce(function (data) {
    return { ...data, rolls: [this] }
  })
  const savedCompute = actor.system.config.computeCheckPenalty
  actor.system.attributes.ac.checkPenalty = penalty
  actor.system.config.computeCheckPenalty = computeCheckPenalty
  try {
    await roll()
  } finally {
    actor.system.attributes.ac.checkPenalty = 0
    actor.system.config.computeCheckPenalty = savedCompute
    chatMessageCreateSpy.mockRestore()
  }
  return { messageData: rollToMessageMock.mock.calls[0]?.[0], created: created[0] }
}

test('non-zero armor check penalty (str) shows the labeled check penalty note', async () => {
  const { messageData, created } = await rollWithPenalty(-2, () => actor.rollAbilityCheck('str'))

  // Adapter path — the legacy DCCRoll.createRoll term-builder is dead.
  expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(0)

  // The mock Roll hardcodes `total = 10`: 10 + (-2) = 8.
  expect(messageData.flags['dcc.checkPenalty']).toEqual({ penalty: -2, total: 8 })
  expect(messageData.content).toContain(PENALTY_NOTE_HTML)

  // No bare secondary roll: the message carries only the check roll.
  expect(messageData.system.checkPenaltyRollIndex).toBeNull()
  expect(created.rolls).toHaveLength(1)
})

test('agl check also shows the check penalty note', async () => {
  const { messageData } = await rollWithPenalty(-2, () => actor.rollAbilityCheck('agl'))
  expect(messageData.flags['dcc.checkPenalty']).toEqual({ penalty: -2, total: 8 })
  expect(messageData.content).toContain(PENALTY_NOTE_HTML)
})

test('a hand-entered penalty shows the note with Compute Check Penalty off (#951)', async () => {
  const { messageData } = await rollWithPenalty(
    -2,
    () => actor.rollAbilityCheck('str'),
    { computeCheckPenalty: false }
  )
  expect(messageData.flags['dcc.checkPenalty']).toEqual({ penalty: -2, total: 8 })
  expect(messageData.content).toContain(PENALTY_NOTE_HTML)
})

test('zero check penalty shows no note', async () => {
  const { messageData } = await rollWithPenalty(0, () => actor.rollAbilityCheck('str'))
  expect(messageData.flags['dcc.checkPenalty']).toBeUndefined()
  expect(messageData.content ?? '').not.toContain('dcc-check-penalty-note')
})

test('non-zero check penalty on a non-str/agl ability shows no note', async () => {
  // lck is not str/agl — the armor check penalty never applies.
  const { messageData } = await rollWithPenalty(-2, () => actor.rollAbilityCheck('lck'))
  expect(messageData.flags['dcc.checkPenalty']).toBeUndefined()
  expect(messageData.content ?? '').not.toContain('dcc-check-penalty-note')
})

/**
 * The real dialog reports each term's submitted value through its
 * callback; the mock must too, or the adapter can't tell whether the
 * CheckPenalty toggle was on. '+0' is an unchecked toggle.
 */
function submitCheckPenalty (terms, value) {
  terms.find(t => t.type === 'CheckPenalty')?.callback?.(value)
}

test('dialog path with the check penalty left unapplied shows the note', async () => {
  // User submits the dialog WITHOUT toggling the -2 check penalty on:
  // the resulting formula omits the penalty (only str mod -1 applies).
  global.dccRollCreateRollMock.mockImplementationOnce((terms) => {
    submitCheckPenalty(terms, '+0')
    return {
      formula: '1d20-1',
      total: 9,
      dice: [{ results: [10], total: 10, options: {} }],
      options: { dcc: {} },
      terms: [
        { class: 'Die', formula: '1d20', number: 1, faces: 20 },
        { class: 'OperatorTerm', operator: '-' },
        { class: 'NumericTerm', number: 1 }
      ],
      _evaluated: true
    }
  })
  const { messageData } = await rollWithPenalty(
    -2,
    () => actor.rollAbilityCheck('str', { showModifierDialog: true })
  )

  // The dialog offered the check-penalty toggle, off by default.
  const termsArg = global.dccRollCreateRollMock.mock.calls[0][0]
  expect(termsArg.some(t => t.type === 'CheckPenalty' && t.formula === '-2' && t.apply === false)).toBe(true)

  // Penalty not applied → note shown (mock lib roll total 10 + -2 = 8).
  expect(messageData.flags['dcc.checkPenalty']).toEqual({ penalty: -2, total: 8 })
  expect(messageData.content).toContain(PENALTY_NOTE_HTML)
})

test('dialog path offers the check penalty term with Compute Check Penalty off', async () => {
  global.dccRollCreateRollMock.mockImplementationOnce(() => ({
    formula: '1d20-1',
    total: 9,
    dice: [{ results: [10], total: 10, options: {} }],
    options: { dcc: {} },
    terms: [{ class: 'Die', formula: '1d20', number: 1, faces: 20 }],
    _evaluated: true
  }))
  await rollWithPenalty(
    -2,
    () => actor.rollAbilityCheck('str', { showModifierDialog: true }),
    { computeCheckPenalty: false }
  )
  const termsArg = global.dccRollCreateRollMock.mock.calls[0][0]
  expect(termsArg.some(t => t.type === 'CheckPenalty' && t.formula === '-2')).toBe(true)
})

test('dialog path with the check penalty applied shows no note', async () => {
  // User toggled the -2 penalty ON: the dialog reports it through the
  // term callback, the lib total already includes it, and no note shows.
  global.dccRollCreateRollMock.mockImplementationOnce((terms) => {
    submitCheckPenalty(terms, '-2')
    return {
      formula: '1d20-1-2',
      total: 7,
      dice: [{ results: [10], total: 10, options: {} }],
      options: { dcc: {} },
      terms: [
        { class: 'Die', formula: '1d20', number: 1, faces: 20 },
        { class: 'OperatorTerm', operator: '-' },
        { class: 'NumericTerm', number: 1 },
        { class: 'OperatorTerm', operator: '-' },
        { class: 'NumericTerm', number: 2 }
      ],
      _evaluated: true
    }
  })
  const { messageData } = await rollWithPenalty(
    -2,
    () => actor.rollAbilityCheck('str', { showModifierDialog: true })
  )
  expect(messageData.flags['dcc.checkPenalty']).toBeUndefined()
  expect(messageData.content ?? '').not.toContain('dcc-check-penalty-note')
})

test('dialog path counts a hand-edited penalty expression as applied', async () => {
  // User rewrote the term as '-(2)': parseInt would read that as 0, but
  // it is in the roll, so no note (which would double-count it) shows.
  global.dccRollCreateRollMock.mockImplementationOnce((terms) => {
    submitCheckPenalty(terms, '-(2)')
    return {
      formula: '1d20-1-2',
      total: 7,
      dice: [{ results: [10], total: 10, options: {} }],
      options: { dcc: {} },
      terms: [
        { class: 'Die', formula: '1d20', number: 1, faces: 20 },
        { class: 'OperatorTerm', operator: '-' },
        { class: 'NumericTerm', number: 1 },
        { class: 'OperatorTerm', operator: '-' },
        { class: 'NumericTerm', number: 2 }
      ],
      _evaluated: true
    }
  })
  const { messageData } = await rollWithPenalty(
    -2,
    () => actor.rollAbilityCheck('str', { showModifierDialog: true })
  )
  expect(messageData.flags['dcc.checkPenalty']).toBeUndefined()
  expect(messageData.content ?? '').not.toContain('dcc-check-penalty-note')
})

test('dialog path keeps the note when the ability modifier equals the penalty', async () => {
  // Regression: the old check matched the penalty's text in the formula.
  // Str mod -1 with a -1 penalty left unchecked gives `1d20-1`, which
  // contains "-1", so the note was wrongly dropped.
  global.dccRollCreateRollMock.mockImplementationOnce((terms) => {
    submitCheckPenalty(terms, '+0')
    return {
      formula: '1d20-1',
      total: 9,
      dice: [{ results: [10], total: 10, options: {} }],
      options: { dcc: {} },
      terms: [{ class: 'Die', formula: '1d20', number: 1, faces: 20 }],
      _evaluated: true
    }
  })
  const { messageData } = await rollWithPenalty(
    -1,
    () => actor.rollAbilityCheck('str', { showModifierDialog: true })
  )
  expect(messageData.flags['dcc.checkPenalty']).toEqual({ penalty: -1, total: 9 })
})
