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

  // Roll-under flag + flavor contract (unchanged from the legacy path).
  expect(messageData.flags['dcc.RollType']).toBe('AbilityCheckRollUnder')
  expect(messageData.flags['dcc.Ability']).toBe('lck')
  expect(messageData.flags['dcc.isAbilityCheck']).toBe(true)
  expect(messageData.flavor).toBe('Luck CheckRollUnder')

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

test('adapter path returns undefined when the ability-check dialog is cancelled', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  // RollModifierDialog cancel resolves with `null`.
  global.dccRollCreateRollMock.mockImplementationOnce(() => null)

  const result = await actor.rollAbilityCheck('lck', { showModifierDialog: true })

  expect(result).toBeUndefined()
  expect(rollToMessageMock).not.toHaveBeenCalled()
})

// Legacy-decom step 3: a non-zero armor check penalty on a str/agl
// ability check now renders adapter-side. The penalty is NOT applied to
// the roll — instead the would-be total is pushed as a secondary roll
// (`rolls[1]`) flagged via `system.checkPenaltyRollIndex`, which
// `emoteAbilityRoll` (module/chat.js) renders as the "If check penalty
// applies, total is X" note. Reproduces the legacy contract exactly.
test('non-zero armor check penalty (str) emits the alternative-total roll via the adapter', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()
  const created = []
  const chatMessageCreateSpy = vi
    .spyOn(ChatMessage, 'create')
    .mockImplementation(d => { created.push(d); return d })

  // Real Foundry's toMessage({create:false}) returns the message data
  // with rolls: [primaryRoll]; the mock returns undefined, so synthesize
  // the shape the adapter pushes the secondary roll onto. `this` is the
  // primary Foundry Roll the renderer called toMessage on.
  rollToMessageMock.mockImplementationOnce(function (data) {
    return { ...data, rolls: [this] }
  })

  actor.system.attributes.ac.checkPenalty = -2
  try {
    await actor.rollAbilityCheck('str')
  } finally {
    actor.system.attributes.ac.checkPenalty = 0
  }

  // Adapter path — the legacy DCCRoll.createRoll term-builder is dead.
  expect(global.dccRollCreateRollMock).toHaveBeenCalledTimes(0)

  // The message flags the secondary roll at index 1.
  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.system.checkPenaltyRollIndex).toBe(1)

  // The created message carries the alt-total roll as rolls[1]. The mock
  // Roll hardcodes `total = 10`, so assert the FORMULA the adapter built:
  // primary total (10) + penalty (-2) = 8.
  const finalData = created[0]
  expect(finalData.rolls).toHaveLength(2)
  expect(finalData.rolls[1].formula).toBe('8')

  chatMessageCreateSpy.mockRestore()
})

test('non-zero check penalty on a non-str/agl ability shows no alternative-total note', async () => {
  rollToMessageMock.mockClear()

  // lck is not str/agl — the armor check penalty never applies, so no
  // secondary roll even with a penalty present.
  actor.system.attributes.ac.checkPenalty = -2
  try {
    await actor.rollAbilityCheck('lck')
  } finally {
    actor.system.attributes.ac.checkPenalty = 0
  }

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.system.checkPenaltyRollIndex).toBeNull()
})

test('dialog path with the check penalty left unapplied shows the alternative-total note', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()
  const created = []
  const chatMessageCreateSpy = vi
    .spyOn(ChatMessage, 'create')
    .mockImplementation(d => { created.push(d); return d })

  // User submits the dialog WITHOUT toggling the -2 check penalty on:
  // the resulting formula omits the penalty (only str mod -1 applies).
  global.dccRollCreateRollMock.mockImplementationOnce(() => ({
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
  }))

  rollToMessageMock.mockImplementationOnce(function (data) {
    return { ...data, rolls: [this] }
  })

  actor.system.attributes.ac.checkPenalty = -2
  try {
    await actor.rollAbilityCheck('str', { showModifierDialog: true })
  } finally {
    actor.system.attributes.ac.checkPenalty = 0
  }

  // The dialog offered the check-penalty toggle.
  const termsArg = global.dccRollCreateRollMock.mock.calls[0][0]
  expect(termsArg.some(t => t.type === 'CheckPenalty' && t.formula === '-2')).toBe(true)

  // Penalty not applied → alternative-total note shown (rolls[1] = 8).
  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.system.checkPenaltyRollIndex).toBe(1)
  expect(created[0].rolls[1].formula).toBe('8')

  chatMessageCreateSpy.mockRestore()
})

test('dialog path with the check penalty applied shows no alternative-total note', async () => {
  rollToMessageMock.mockClear()
  global.dccRollCreateRollMock.mockClear()

  // User toggled the -2 penalty ON: it appears in the dialog roll's
  // formula, so the lib total already includes it and no alternative is
  // shown (mirrors the legacy `formula.includes(penalty)` check).
  global.dccRollCreateRollMock.mockImplementationOnce(() => ({
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
  }))

  actor.system.attributes.ac.checkPenalty = -2
  try {
    await actor.rollAbilityCheck('str', { showModifierDialog: true })
  } finally {
    actor.system.attributes.ac.checkPenalty = 0
  }

  const [messageData] = rollToMessageMock.mock.calls[0]
  expect(messageData.system.checkPenaltyRollIndex).toBeNull()
})
