/**
 * Unit coverage for `processSpellCheck` extracted from `module/dcc.js`
 * into `module/spell-check-processor.mjs`.
 *
 * The function consumes a small surface of Foundry globals (`game`,
 * `ChatMessage`, `Roll`, `foundry.dice.terms.*`) plus the `game.dcc.*`
 * registry (`SpellResult`, `FleetingLuck`). All are stubbed per-test
 * so each branch can be exercised as a pure function without booting
 * Foundry. Pattern mirrors `module/__tests__/macros.test.js` and
 * `module/__tests__/settings-table-hooks.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { processSpellCheck } from '../spell-check-processor.mjs'

const savedGlobals = {}

function snapshotGlobals () {
  savedGlobals.game = globalThis.game
  savedGlobals.ChatMessage = globalThis.ChatMessage
  savedGlobals.foundry = globalThis.foundry
  savedGlobals.Roll = globalThis.Roll
}

function restoreGlobals () {
  globalThis.game = savedGlobals.game
  globalThis.ChatMessage = savedGlobals.ChatMessage
  globalThis.foundry = savedGlobals.foundry
  globalThis.Roll = savedGlobals.Roll
}

function makeRoll ({ natural = 10, total = null, evaluated = true } = {}) {
  const effectiveTotal = total === null ? natural + 5 : total
  const roll = {
    _evaluated: evaluated,
    _total: effectiveTotal,
    _formula: '1d20+5',
    get total () { return this._total },
    dice: [{ total: natural }],
    terms: [{
      results: [{ result: natural }],
      _total: natural
    }],
    evaluate: vi.fn(async function () { this._evaluated = true }),
    toMessage: vi.fn(async function () { return { id: 'msg' } })
  }
  return roll
}

function installFoundryStubs ({
  addChatMessage = vi.fn(),
  updateFlags = vi.fn(),
  getSpeaker = vi.fn(() => ({ alias: 'Probe' })),
  localize = (key) => key,
  settings = { automateWizardSpellLoss: false, automateClericDisapproval: false },
  patronTaintRoll = { total: 50 }
} = {}) {
  globalThis.game = {
    i18n: { localize },
    settings: {
      get: vi.fn((scope, key) => settings[key])
    },
    dcc: {
      SpellResult: { addChatMessage },
      FleetingLuck: { updateFlags }
    }
  }
  globalThis.ChatMessage = { getSpeaker }
  globalThis.foundry = {
    dice: {
      terms: {
        OperatorTerm: class { constructor (opts) { Object.assign(this, opts) } },
        NumericTerm: class { constructor (opts) { Object.assign(this, opts) } }
      }
    }
  }
  globalThis.Roll = class {
    constructor (formula) {
      this.formula = formula
      this._evaluated = false
      this.total = patronTaintRoll.total
    }

    async evaluate () { this._evaluated = true }
  }
  return { addChatMessage, updateFlags, getSpeaker }
}

beforeEach(() => {
  snapshotGlobals()
})

afterEach(() => {
  restoreGlobals()
  vi.restoreAllMocks()
})

describe('processSpellCheck — roll evaluation + forceCrit', () => {
  test('evaluates the roll if not already evaluated', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 10, evaluated: false })
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll })

    expect(roll.evaluate).toHaveBeenCalled()
    expect(stubs.updateFlags).toHaveBeenCalled()
  })

  test('forceCrit rewrites natural roll to 20 and recalculates total', async () => {
    installFoundryStubs()
    const roll = makeRoll({ natural: 7, total: 12 })
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll, forceCrit: true })

    expect(roll.terms[0].results[0].result).toBe(20)
    expect(roll.terms[0]._total).toBe(20)
    // Original total 12 + (20 - 7) = 25
    expect(roll._total).toBe(25)
  })

  test('forceCrit is a no-op when natural roll is already 1 (preserves fumble)', async () => {
    installFoundryStubs()
    const roll = makeRoll({ natural: 1, total: 6 })
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll, forceCrit: true })

    expect(roll.terms[0].results[0].result).toBe(1)
    expect(roll._total).toBe(6)
  })
})

describe('processSpellCheck — natural fumble / crit detection', () => {
  test('natural 1 with no rollTable sets fumble HTML on flags', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 1, total: 3 })
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll })

    expect(stubs.updateFlags).toHaveBeenCalledTimes(1)
    const flags = stubs.updateFlags.mock.calls[0][0]
    expect(flags['dcc.spellResult']).toContain('DCC.SpellCheckFumbleNoTable')
    expect(flags['dcc.RollType']).toBe('SpellCheck')
    expect(flags['dcc.isSpellCheck']).toBe(true)
    expect(flags['dcc.isSkillCheck']).toBe(true)
  })

  test('natural 20 on a Player with no rollTable sets crit HTML on flags', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 20, total: 25 })
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll })

    const flags = stubs.updateFlags.mock.calls[0][0]
    expect(flags['dcc.spellResult']).toContain('DCC.SpellCheckCritNoTable')
  })

  test('natural 20 on an NPC does NOT set crit (Player-only rule)', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 20, total: 25 })
    const actor = { type: 'NPC', system: { class: {}, details: { level: { value: 3 } } } }

    await processSpellCheck(actor, { roll })

    const flags = stubs.updateFlags.mock.calls[0][0]
    // Success threshold for level 1 (no item) is 12; 25 >= 12 → success HTML, not crit.
    expect(flags['dcc.spellResult']).toContain('DCC.SpellCheckSuccessNoTable')
    expect(flags['dcc.spellResult']).not.toContain('DCC.SpellCheckCritNoTable')
  })

  test('successful no-table roll emits the success indicator', async () => {
    const stubs = installFoundryStubs()
    // level 1 success threshold is 10 + 2 = 12.
    const roll = makeRoll({ natural: 15, total: 18 })
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll })

    const flags = stubs.updateFlags.mock.calls[0][0]
    expect(flags['dcc.spellResult']).toContain('DCC.SpellCheckSuccessNoTable')
  })

  test('failed no-table roll emits the failure indicator', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 5, total: 8 })
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll })

    const flags = stubs.updateFlags.mock.calls[0][0]
    expect(flags['dcc.spellResult']).toContain('DCC.SpellCheckFailureNoTable')
  })
})

describe('processSpellCheck — rollTable branch', () => {
  test('non-crit non-fumble looks up table by roll.total', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 12, total: 17 })
    const rollTable = {
      getResultsForRoll: vi.fn(() => [{ text: 'middling result' }])
    }
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll, rollTable })

    expect(rollTable.getResultsForRoll).toHaveBeenCalledWith(17)
    expect(stubs.addChatMessage).toHaveBeenCalledTimes(1)
    const [passedRoll, passedTable, passedResult, opts] = stubs.addChatMessage.mock.calls[0]
    expect(passedRoll).toBe(roll)
    expect(passedTable).toBe(rollTable)
    expect(passedResult).toEqual([{ text: 'middling result' }])
    expect(opts.crit).toBe(false)
    expect(opts.fumble).toBe(false)
  })

  test('natural 1 with rollTable forces lookup of row 1', async () => {
    installFoundryStubs()
    const roll = makeRoll({ natural: 1, total: 4 })
    const rollTable = {
      getResultsForRoll: vi.fn(() => [{ text: 'fumble row' }])
    }
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 3 } } } }

    await processSpellCheck(actor, { roll, rollTable })

    expect(rollTable.getResultsForRoll).toHaveBeenLastCalledWith(1)
  })

  test('natural 20 on a Player with rollTable boosts result lookup by level and mutates the roll', async () => {
    installFoundryStubs()
    const roll = makeRoll({ natural: 20, total: 28 })
    const rollTable = {
      getResultsForRoll: vi.fn(() => [{ text: 'crit row' }])
    }
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 4 } } } }

    await processSpellCheck(actor, { roll, rollTable })

    // Final lookup uses roll.total + level = 28 + 4 = 32.
    expect(rollTable.getResultsForRoll).toHaveBeenLastCalledWith(32)
    // Roll mutated to reflect the +level adjustment.
    expect(roll._total).toBe(32)
    expect(roll._formula).toBe('1d20+5 + 4')
    expect(roll.terms.length).toBe(3) // original term + OperatorTerm + NumericTerm
    expect(roll.terms[1]).toMatchObject({ operator: '+' })
    expect(roll.terms[2]).toMatchObject({ number: 4 })
  })

  test('string level on a crit is coerced via parseInt (no string concat)', async () => {
    installFoundryStubs()
    const roll = makeRoll({ natural: 20, total: 26 })
    const rollTable = {
      getResultsForRoll: vi.fn(() => [{ text: 'crit row' }])
    }
    // Level value as STRING — this is the spell-check-crit.test.js scenario.
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: '3' } } } }

    await processSpellCheck(actor, { roll, rollTable })

    // 26 + 3 = 29 (not "263" string-concat).
    expect(rollTable.getResultsForRoll).toHaveBeenLastCalledWith(29)
    expect(roll._total).toBe(29)
  })

  test('passes flavor + messageData speaker into SpellResult.addChatMessage when no item', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 10, total: 15 })
    const rollTable = {
      getResultsForRoll: vi.fn(() => [{ text: 'row' }])
    }
    const actor = { type: 'Player', system: { class: {}, details: { level: { value: 1 } } } }

    await processSpellCheck(actor, { roll, rollTable, flavor: 'My Spell' })

    const opts = stubs.addChatMessage.mock.calls[0][3]
    expect(opts.messageData.flavor).toBe('My Spell')
    expect(opts.messageData.speaker).toEqual({ alias: 'Probe' })
    expect(stubs.getSpeaker).toHaveBeenCalledWith({ actor })
  })
})

describe('processSpellCheck — casting-mode side effects', () => {
  test('wizard automation OFF does NOT call loseSpell on failure', async () => {
    installFoundryStubs({ settings: { automateWizardSpellLoss: false } })
    const roll = makeRoll({ natural: 5, total: 8 })
    const loseSpell = vi.fn()
    const item = {
      id: 'i1',
      name: 'Magic Missile',
      system: { level: 1, config: { castingMode: 'wizard' }, associatedPatron: '' },
      update: vi.fn()
    }
    const actor = {
      type: 'Player',
      system: { class: {}, details: { level: { value: 1 } } },
      classId: 'wizard',
      loseSpell
    }

    await processSpellCheck(actor, { roll, item })

    expect(loseSpell).not.toHaveBeenCalled()
    expect(item.update).toHaveBeenCalledWith({ 'system.lastResult': 8 })
  })

  test('wizard automation ON calls loseSpell when roll fails the threshold', async () => {
    installFoundryStubs({ settings: { automateWizardSpellLoss: true } })
    const roll = makeRoll({ natural: 4, total: 7 })
    const loseSpell = vi.fn()
    const item = {
      id: 'i2',
      name: 'Magic Missile',
      system: { level: 1, config: { castingMode: 'wizard' }, associatedPatron: '' },
      update: vi.fn()
    }
    const actor = {
      type: 'Player',
      system: { class: {}, details: { level: { value: 1 } } },
      classId: 'wizard',
      loseSpell
    }

    await processSpellCheck(actor, { roll, item })

    // 7 < 12 = failure → loseSpell fires.
    expect(loseSpell).toHaveBeenCalledWith(item)
  })

  test('cleric automation ON with naturalRoll inside disapproval range triggers rollDisapproval + applyDisapproval', async () => {
    installFoundryStubs({ settings: { automateClericDisapproval: true } })
    const roll = makeRoll({ natural: 1, total: 5 })
    const rollDisapproval = vi.fn()
    const applyDisapproval = vi.fn()
    const item = {
      id: 'i3',
      name: 'Cure Light Wounds',
      system: { level: 1, config: { castingMode: 'cleric' }, associatedPatron: '' },
      update: vi.fn()
    }
    const actor = {
      type: 'Player',
      system: { class: { disapproval: 2 }, details: { level: { value: 1 } } },
      classId: 'cleric',
      rollDisapproval,
      applyDisapproval
    }

    await processSpellCheck(actor, { roll, item })

    expect(rollDisapproval).toHaveBeenCalledWith(1)
    // After disapproval, success forced to false → applyDisapproval also called.
    expect(applyDisapproval).toHaveBeenCalled()
  })

  test('cleric automation ON, naturalRoll outside disapproval range AND failed cast still applies disapproval', async () => {
    installFoundryStubs({ settings: { automateClericDisapproval: true } })
    const roll = makeRoll({ natural: 8, total: 8 })
    const rollDisapproval = vi.fn()
    const applyDisapproval = vi.fn()
    const item = {
      id: 'i4',
      name: 'Bless',
      system: { level: 1, config: { castingMode: 'cleric' }, associatedPatron: '' },
      update: vi.fn()
    }
    const actor = {
      type: 'Player',
      system: { class: { disapproval: 2 }, details: { level: { value: 1 } } },
      classId: 'cleric',
      rollDisapproval,
      applyDisapproval
    }

    await processSpellCheck(actor, { roll, item })

    expect(rollDisapproval).not.toHaveBeenCalled()
    // 8 < 12 threshold → still a failure → applyDisapproval fires.
    expect(applyDisapproval).toHaveBeenCalled()
  })

  test('no-item cleric path infers cleric castingMode from actor.classId', async () => {
    installFoundryStubs({ settings: { automateClericDisapproval: true } })
    const roll = makeRoll({ natural: 2, total: 6 })
    const rollDisapproval = vi.fn()
    const applyDisapproval = vi.fn()
    const actor = {
      type: 'Player',
      system: { class: { disapproval: 3 }, details: { level: { value: 1 } } },
      classId: 'cleric',
      rollDisapproval,
      applyDisapproval
    }

    await processSpellCheck(actor, { roll })

    expect(rollDisapproval).toHaveBeenCalledWith(2)
  })
})

describe('processSpellCheck — patron taint branch', () => {
  test('actor with patron casting a Patron-named spell rolls 1d100 and updates patronTaintChance', async () => {
    installFoundryStubs({ patronTaintRoll: { total: 50 } })
    const roll = makeRoll({ natural: 12, total: 17 })
    const item = {
      id: 'i5',
      name: 'Invoke Patron',
      system: { level: 1, config: { castingMode: 'wizard' }, associatedPatron: '' },
      update: vi.fn()
    }
    const actor = {
      type: 'Player',
      system: {
        class: { patron: 'Bobugbubilz', patronTaintChance: '1%' },
        details: { level: { value: 1 } }
      },
      classId: 'wizard',
      loseSpell: vi.fn(),
      update: vi.fn()
    }

    await processSpellCheck(actor, { roll, item, rollTable: { getResultsForRoll: vi.fn(() => []) } })

    // currentChance=1, newChance=2 → "2%" persisted.
    expect(actor.update).toHaveBeenCalledWith({ 'system.class.patronTaintChance': '2%' })
  })

  test('actor without patron does NOT update patronTaintChance even on Patron-named spell', async () => {
    installFoundryStubs()
    const roll = makeRoll({ natural: 10, total: 15 })
    const item = {
      id: 'i6',
      name: 'Invoke Patron',
      system: { level: 1, config: { castingMode: 'wizard' }, associatedPatron: '' },
      update: vi.fn()
    }
    const actor = {
      type: 'Player',
      system: {
        class: { /* no patron field */ },
        details: { level: { value: 1 } }
      },
      classId: 'wizard',
      loseSpell: vi.fn(),
      update: vi.fn()
    }

    await processSpellCheck(actor, { roll, item, rollTable: { getResultsForRoll: vi.fn(() => []) } })

    expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({ 'system.class.patronTaintChance': expect.anything() }))
  })

  test('patronTaint object is forwarded into SpellResult.addChatMessage', async () => {
    const stubs = installFoundryStubs({ patronTaintRoll: { total: 1 } })
    const roll = makeRoll({ natural: 10, total: 15 })
    const item = {
      id: 'i7',
      name: 'Invoke Patron',
      system: { level: 1, config: { castingMode: 'wizard' }, associatedPatron: '' },
      update: vi.fn()
    }
    const rollTable = { getResultsForRoll: vi.fn(() => []) }
    const actor = {
      type: 'Player',
      system: {
        class: { patron: 'Sezrekan', patronTaintChance: '5%' },
        details: { level: { value: 1 } }
      },
      classId: 'wizard',
      loseSpell: vi.fn(),
      update: vi.fn()
    }

    await processSpellCheck(actor, { roll, item, rollTable })

    const opts = stubs.addChatMessage.mock.calls[0][3]
    expect(opts.patronTaint).not.toBeNull()
    // 1 <= 5 → tainted.
    expect(opts.patronTaint.tainted).toBe(true)
    expect(opts.patronTaint.oldChance).toBe(5)
    expect(opts.patronTaint.newChance).toBe(6)
    expect(opts.patronTaint.roll).toBe(1)
  })
})

describe('processSpellCheck — item lastResult update', () => {
  test('writes roll.total back to item.system.lastResult after a successful cast', async () => {
    installFoundryStubs()
    const roll = makeRoll({ natural: 15, total: 19 })
    const item = {
      id: 'i8',
      name: 'Magic Missile',
      system: { level: 1, config: { castingMode: 'wizard' }, associatedPatron: '' },
      update: vi.fn()
    }
    const actor = {
      type: 'Player',
      system: { class: {}, details: { level: { value: 1 } } },
      classId: 'wizard',
      loseSpell: vi.fn()
    }

    await processSpellCheck(actor, { roll, item })

    expect(item.update).toHaveBeenCalledWith({ 'system.lastResult': 19 })
  })

  test('no item passed → no lastResult update attempted', async () => {
    const stubs = installFoundryStubs()
    const roll = makeRoll({ natural: 10, total: 15 })
    const actor = {
      type: 'Player',
      system: { class: {}, details: { level: { value: 1 } } },
      classId: 'wizard'
    }

    await processSpellCheck(actor, { roll })

    expect(stubs.updateFlags).toHaveBeenCalledTimes(1)
    expect(roll.toMessage).toHaveBeenCalledTimes(1)
  })
})
