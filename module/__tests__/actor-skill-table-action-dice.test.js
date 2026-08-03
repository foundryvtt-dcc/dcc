/* global game, dccRollCreateRollMock */
/**
 * Multiple-action-dice slot handling in the skill-table adapter branch
 * (issue #873).
 *
 * Cleric spell-like skills (Lay on Hands, Turn Unholy, divine aid) ARE
 * spell checks per RAW, so when they are a later action in the round they
 * must roll that slot's (lower) action die. `_skillTableViaAdapter`
 * previously planned + spent the slot but never overrode the die, so a
 * cleric's second action rolled the primary d20 again.
 *
 * The action-dice tracker is mocked at the planning/spending seam so each
 * test can hand the branch a deterministic plan; `slotRollFormula` and
 * `formatActionDiceChatLine` stay real (pure helpers).
 */

import { expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import DCCActor from '../actor'
import { planActionDie, reconcilePlannedActionDie, spendPlannedActionDie, actionDicePresetsFromPlan } from '../action-dice-tracker.mjs'

// Mock the actor-level-change module
vi.mock('../actor-level-change.js')

vi.mock('../action-dice-tracker.mjs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    planActionDie: vi.fn(() => null),
    reconcilePlannedActionDie: vi.fn((plan) => plan),
    spendPlannedActionDie: vi.fn(async () => null),
    actionDicePresetsFromPlan: vi.fn(() => null)
  }
})

const slot2Plan = () => ({
  combatant: {},
  round: 1,
  choice: { index: 1, slot: { die: 'd14', use: 'any' } }
})

function makeClericActor ({ overrideDie = null } = {}) {
  // noinspection JSCheckFunctionSignatures
  const actor = new DCCActor()
  actor.system.details.sheetClass = 'Cleric'
  actor.system.class.disapproval = 1
  if (overrideDie) {
    actor.system.class.spellCheckOverrideDie = overrideDie
  }
  actor.system.skills.layOnHands = {
    label: 'DCC.LayOnHands',
    die: '1d20',
    value: 0,
    useDisapprovalRange: true
  }
  return actor
}

function installSpellResultMock () {
  const addChatMessage = vi.fn()
  const original = game.dcc.SpellResult
  game.dcc.SpellResult = { addChatMessage }
  return { addChatMessage, restore: () => { game.dcc.SpellResult = original } }
}

test('a later action-die slot overrides the skill-table die and lands in the chat card (#873)', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.getSkillTable.mockResolvedValue({ getResultsForRoll: () => [{ text: 'Healing' }] })
  const spellResult = installSpellResultMock()

  planActionDie.mockReturnValueOnce(slot2Plan())
  spendPlannedActionDie.mockResolvedValueOnce({ actionNumber: 2, count: 2, die: '1d14' })

  const actor = makeClericActor()
  await actor.rollSkillCheck('layOnHands')

  // The Die term rolls the slot's die, not the primary d20.
  const [terms] = dccRollCreateRollMock.mock.calls[0]
  const dieTerm = terms.find(t => t.type === 'Die')
  expect(dieTerm.formula).toBe('1d14')

  // The "Action N of M" line rides on the spell-result card.
  expect(spellResult.addChatMessage).toHaveBeenCalledTimes(1)
  const opts = spellResult.addChatMessage.mock.calls[0][3]
  expect(opts.actionDiceChatLine).toContain('ActionDiceChatLine')

  spellResult.restore()
  game.dcc.getSkillTable.mockResolvedValue(null)
})

test('the first slot (index 0) leaves the skill die unchanged', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.getSkillTable.mockResolvedValue({ getResultsForRoll: () => [{ text: 'Healing' }] })
  const spellResult = installSpellResultMock()

  planActionDie.mockReturnValueOnce({
    combatant: {},
    round: 1,
    choice: { index: 0, slot: { die: 'd20', use: 'any' } }
  })

  const actor = makeClericActor()
  await actor.rollSkillCheck('layOnHands')

  const [terms] = dccRollCreateRollMock.mock.calls[0]
  expect(terms.find(t => t.type === 'Die').formula).toBe('1d20')

  spellResult.restore()
  game.dcc.getSkillTable.mockResolvedValue(null)
})

test('spellCheckOverrideDie pins the die against a later slot', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.getSkillTable.mockResolvedValue({ getResultsForRoll: () => [{ text: 'Healing' }] })
  const spellResult = installSpellResultMock()

  planActionDie.mockReturnValueOnce(slot2Plan())

  const actor = makeClericActor({ overrideDie: '1d16' })
  await actor.rollSkillCheck('layOnHands')

  const [terms] = dccRollCreateRollMock.mock.calls[0]
  expect(terms.find(t => t.type === 'Die').formula).toBe('1d16')

  spellResult.restore()
  game.dcc.getSkillTable.mockResolvedValue(null)
  delete actor.system.class.spellCheckOverrideDie
})

test('the plan is reconciled against the rolled die before spending', async () => {
  dccRollCreateRollMock.mockClear()
  reconcilePlannedActionDie.mockClear()
  spendPlannedActionDie.mockClear()
  game.dcc.getSkillTable.mockResolvedValue({ getResultsForRoll: () => [{ text: 'Healing' }] })
  const spellResult = installSpellResultMock()

  const plan = slot2Plan()
  planActionDie.mockReturnValueOnce(plan)

  const actor = makeClericActor()
  await actor.rollSkillCheck('layOnHands')

  // Reconcile runs with the planned die's faces as the no-intervention
  // default, then the (possibly re-pointed) plan is spent.
  expect(reconcilePlannedActionDie).toHaveBeenCalledWith(plan, undefined, {
    action: 'check',
    defaultFaces: 14
  })
  expect(spendPlannedActionDie).toHaveBeenCalledWith(plan)

  spellResult.restore()
  game.dcc.getSkillTable.mockResolvedValue(null)
})

test('slot presets replace the config-derived presets on the dialog die term', async () => {
  dccRollCreateRollMock.mockClear()
  game.dcc.getSkillTable.mockResolvedValue({ getResultsForRoll: () => [{ text: 'Healing' }] })
  const spellResult = installSpellResultMock()

  planActionDie.mockReturnValueOnce(slot2Plan())
  const presets = [
    { formula: '1d20', label: '1d20 — action die 1 (ready)' },
    { formula: '1d14', label: '1d14 — action die 2 (ready)' }
  ]
  actionDicePresetsFromPlan.mockReturnValueOnce(presets)

  const actor = makeClericActor()
  await actor.rollSkillCheck('layOnHands')

  const [terms] = dccRollCreateRollMock.mock.calls[0]
  expect(terms.find(t => t.type === 'Die').presets).toBe(presets)

  spellResult.restore()
  game.dcc.getSkillTable.mockResolvedValue(null)
})
