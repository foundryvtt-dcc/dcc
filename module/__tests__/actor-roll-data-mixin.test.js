import { describe, test, expect, vi, beforeEach } from 'vitest'
import { RollDataMixin } from '../actor/roll-data-mixin.mjs'

// Phase 7 (Appendix-A actor.js shrinkage): the three roll-input accessors
// (getRollData / getAttackBonusMode / getActionDice) moved out of actor.js into
// actor/roll-data-mixin.mjs. These guards pin the extraction's shape + behavior
// on a bare Base, alongside the existing behavioral coverage in actor.test.js
// (which exercises them through live DCCActor instances and passes unchanged,
// proving transparent composition).

const MEMBERS = ['getRollData', 'getAttackBonusMode', 'getActionDice', 'getLastDeedDie', 'withLastDeedDie', 'getLastDeedBonus', 'rememberDeedDie']

// Minimal Base supplying the `super.getRollData()` the mixin augments.
class Base {
  getRollData () {
    return {
      abilities: {
        str: { mod: 1, maxMod: 1 },
        agl: { mod: 2, maxMod: 2 },
        sta: { mod: 3, maxMod: 3 },
        per: { mod: 0, maxMod: 0 },
        int: { mod: 4, maxMod: 4 },
        lck: { mod: 0, maxMod: 0 }
      },
      saves: { ref: { value: '+2' }, frt: { value: '+3' }, wil: { value: '+1' } },
      attributes: {
        init: { value: 2 },
        ac: { value: 10, checkPenalty: 0 },
        speed: { value: 30 },
        hp: { value: 6, max: 6 }
      },
      details: {
        level: { value: 1 },
        attackBonus: '+0',
        lastRolledAttackBonus: 3,
        attackHitBonus: { melee: { value: '+2' }, missile: { value: '+1' } },
        attackDamageBonus: { melee: { value: '+2' }, missile: { value: '+0' } },
        xp: { value: 10 }
      }
    }
  }
}
const Mixed = RollDataMixin(Base)

describe('RollDataMixin extraction', () => {
  beforeEach(() => {
    // Real-ish mergeObject: shallow-merge the second arg onto the first.
    globalThis.foundry = { utils: { mergeObject: (a, b) => Object.assign(a, b) } }
    globalThis.ui = { notifications: { warn: vi.fn() } }
    globalThis.game = { i18n: { localize: (k) => k } }
  })

  test('is a mixin factory carrying the roll-input accessors', () => {
    expect(typeof RollDataMixin).toBe('function')
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
    for (const name of MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(Mixed.prototype, name), `missing: ${name}`).toBeDefined()
    }
  })

  test('getRollData augments super data with ability/save/attack shorthands', () => {
    const inst = new Mixed()
    inst.type = 'Player'
    inst.system = { config: { attackBonusMode: 'flat' } }
    const data = inst.getRollData()
    expect(data.str).toBe(1)
    expect(data.agi).toBe(2)
    expect(data.int).toBe(4)
    expect(data.ref).toBe('+2')
    expect(data.ac).toBe(10)
    expect(data.cl).toBe(1)
    expect(data.xp).toBe(10) // Player only
  })

  test('getRollData ab/mab use flat field when mode is flat', () => {
    const flat = new Mixed()
    flat.type = 'Player'
    flat.system = { config: { attackBonusMode: 'flat' } }
    expect(flat.getRollData().mab).toBe('+2') // flat -> melee hit value
  })

  test('getRollData without a deed die keeps the values as they are', () => {
    const rolled = new Mixed()
    rolled.type = 'Player'
    rolled.system = { config: { attackBonusMode: 'autoPerAttack' } }
    expect(rolled.getRollData().mab).toBe('+2') // attackBonus '+0' has no deed die
  })

  describe('deed die in the attack shorthands (#1041)', () => {
    // Warrior: +d4+1 attack bonus, Str +2, Agl +1
    const deedDetails = (overrides = {}) => ({
      level: { value: 3 },
      attackBonus: '+d4+1',
      lastRolledAttackBonus: 3,
      lastRolledAttackBonusCombat: '',
      lastRolledAttackBonusRound: 0,
      attackHitBonus: { melee: { value: '+d4+3' }, missile: { value: '+d4+2' } },
      attackDamageBonus: { melee: { value: '+d4+3' }, missile: { value: '+d4+1' } },
      xp: { value: 10 },
      ...overrides
    })
    const warrior = (details) => {
      class DeedBase extends Base {
        getRollData () { return { ...super.getRollData(), details } }
      }
      const inst = new (RollDataMixin(DeedBase))()
      inst.type = 'Player'
      inst.system = { config: { attackBonusMode: 'autoPerAttack' }, details }
      return inst
    }
    const shorthands = (data) => ({ ab: data.ab, mab: data.mab, mad: data.mad, rab: data.rab, rad: data.rad })

    test('each shorthand is its own value with the last deed roll in place of the die', () => {
      expect(shorthands(warrior(deedDetails()).getRollData())).toEqual({ ab: 4, mab: 6, mad: 6, rab: 5, rad: 4 })
    })

    test('with no deed rolled the die counts as 0', () => {
      const data = warrior(deedDetails({ lastRolledAttackBonus: 0 })).getRollData()
      expect(shorthands(data)).toEqual({ ab: 1, mab: 3, mad: 3, rab: 2, rad: 1 })
    })

    test('a deed rolled in a combat counts only in that round', () => {
      globalThis.game.combats = new Map([['c1', { round: 2 }]])
      const details = deedDetails({ lastRolledAttackBonusCombat: 'c1', lastRolledAttackBonusRound: 2 })
      expect(warrior(details).getRollData().ab).toBe(4)

      globalThis.game.combats.get('c1').round = 3
      expect(warrior(details).getRollData().ab).toBe(1)

      globalThis.game.combats.get('c1').round = 2 // stepped back
      expect(warrior(details).getRollData().ab).toBe(4)

      globalThis.game.combats.delete('c1') // combat ended
      expect(warrior(details).getRollData().ab).toBe(1)
    })

    test('a value with dice other than the deed die keeps the formula', () => {
      const details = deedDetails({ attackHitBonus: { melee: { value: '+d4+1d6' }, missile: { value: '+d4+2' } } })
      expect(warrior(details).getRollData().mab).toBe('+3+1d6')
    })

    test('getLastDeedBonus is the deed roll plus the flat part, or 0 with no deed', () => {
      expect(warrior(deedDetails()).getLastDeedBonus()).toBe(4)
      expect(warrior(deedDetails({ lastRolledAttackBonus: 0 })).getLastDeedBonus()).toBe(0)
    })

    test('rememberDeedDie stamps the started combat the actor is fighting in', async () => {
      const inst = warrior(deedDetails())
      inst.update = vi.fn()
      const fighting = { id: 'c2', round: 4, started: true, getCombatantsByActor: (a) => a === inst ? [{}] : [] }
      const other = { id: 'c3', round: 1, started: true, getCombatantsByActor: () => [] }
      globalThis.game.combats = [other, fighting]
      await inst.rememberDeedDie(2)
      expect(inst.update).toHaveBeenCalledWith({
        'system.details.lastRolledAttackBonus': 2,
        'system.details.lastRolledAttackBonusCombat': 'c2',
        'system.details.lastRolledAttackBonusRound': 4
      })

      globalThis.game.combats = [other]
      await inst.rememberDeedDie(1)
      expect(inst.update).toHaveBeenLastCalledWith({
        'system.details.lastRolledAttackBonus': 1,
        'system.details.lastRolledAttackBonusCombat': '',
        'system.details.lastRolledAttackBonusRound': 0
      })
    })
  })

  test('getRollData omits xp for non-Player actors', () => {
    const npc = new Mixed()
    npc.type = 'NPC'
    npc.system = { config: { attackBonusMode: 'flat' } }
    expect(npc.getRollData().xp).toBeUndefined()
  })

  test('getAttackBonusMode normalizes known modes and defaults invalid to flat', () => {
    const inst = new Mixed()
    for (const mode of ['flat', 'manual', 'autoPerAttack']) {
      inst.system = { config: { attackBonusMode: mode } }
      expect(inst.getAttackBonusMode()).toBe(mode)
    }
    inst.system = { config: { attackBonusMode: 'bogus' } }
    expect(inst.getAttackBonusMode()).toBe('flat')
    inst.system = { config: {} }
    expect(inst.getAttackBonusMode()).toBe('flat')
  })

  test('getActionDice parses comma list into label/formula presets', () => {
    const inst = new Mixed()
    inst.system = { config: { actionDice: '1d20,1d14' } }
    expect(inst.getActionDice()).toEqual([
      { label: '1d20', formula: '1d20' },
      { label: '1d14', formula: '1d14' }
    ])
  })

  test('getActionDice appends the untrained 1d10 preset when requested', () => {
    const inst = new Mixed()
    inst.system = { config: { actionDice: '1d20' } }
    const dice = inst.getActionDice({ includeUntrained: true })
    expect(dice).toContainEqual({ label: 'DCC.Untrained', formula: '1d10' })
  })

  test('getActionDice implicit-migrates a legacy actor and normalizes + to ,', () => {
    const fromAttributes = new Mixed()
    fromAttributes.system = { config: {}, attributes: { actionDice: { value: '1d20' } } }
    expect(fromAttributes.getActionDice()).toEqual([{ label: '1d20', formula: '1d20' }])
    expect(fromAttributes.system.config.actionDice).toBe('1d20') // written back

    const plusForm = new Mixed()
    plusForm.system = { config: { actionDice: '1d20+1d14' } }
    expect(plusForm.getActionDice()).toEqual([
      { label: '1d20', formula: '1d20' },
      { label: '1d14', formula: '1d14' }
    ])
    expect(plusForm.system.config.actionDice).toBe('1d20,1d14')
  })

  test('getActionDice warns on a die-less action-dice string', () => {
    const inst = new Mixed()
    inst.system = { config: { actionDice: 'oops' } }
    inst.getActionDice()
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith('DCC.ActionDiceInvalid')
  })
})
