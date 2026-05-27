/* global Roll */
/**
 * Integration test for the Phase 1 adapter pipeline (initiative —
 * Path A, formula-only) with REAL Foundry dice.
 *
 * Covers the single-pass formula flow inside
 * `_getInitiativeRollViaAdapter`:
 *   actorToCharacter →
 *   libRollCheck (formula mode) with a synthetic 'initiative'
 *     SkillDefinition and an aggregate `add` modifier carrying
 *     `init.value` (already agl + otherMod + [class level]) →
 *   new Roll(formula) → Foundry's dice engine evaluates.
 *
 * Init has no gameplay crit/fumble in vanilla DCC, so there is no
 * pass-2 classification. Custom init dice (d14, d16, d24) propagate
 * through the formula and Foundry rolls them natively.
 *
 * ChatMessage rendering is out of scope here — Foundry's core
 * `Combat#rollInitiative` posts the message with `core.initiativeRoll`
 * set, which `emoteInitiativeRoll` in module/chat.js gates on. Full
 * client required to exercise that.
 */

import { describe, test, expect } from 'vitest'
import {
  rollCheck as libRollCheck
} from '../vendor/dcc-core-lib/index.js'
import {
  actorToCharacter
} from '../adapter/character-accessors.mjs'

const hasDiceEngine = typeof Roll !== 'undefined' && Roll?.parse
const describeIfDice = hasDiceEngine ? describe : describe.skip

// Minimal DCCActor-shaped object. Only the fields the adapter's
// initiative path reads.
function makeActor ({
  agl = 10,
  initDie = '1d20',
  initValue = 0,
  level = 1,
  classId
} = {}) {
  return {
    uuid: 'Actor.init-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Init Actor',
    system: {
      abilities: {
        str: { value: 10, max: 10 },
        agl: { value: agl, max: agl },
        sta: { value: 10, max: 10 },
        per: { value: 10, max: 10 },
        int: { value: 10, max: 10 },
        lck: { value: 10, max: 10 }
      },
      saves: {
        ref: { value: '0' },
        frt: { value: '0' },
        wil: { value: '0' }
      },
      attributes: {
        init: { die: initDie, value: initValue },
        ac: { checkPenalty: 0 }
      },
      details: { level: { value: level } },
      class: classId ? { className: classId } : {},
      config: { computeCheckPenalty: true }
    }
  }
}

// Abbreviated adapter flow — minus the Foundry weapon-override + label
// injection, which is Foundry-display glue unrelated to the lib call.
// Returns { plan, foundryRoll, natural } so tests can assert on both
// sides of the adapter boundary.
async function runAdapterInitiative (actor) {
  const character = actorToCharacter(actor)

  const dieFormula = actor.system.attributes.init.die || '1d20'
  const libDie = /^(?:\d+)?(d\d+)$/i.exec(dieFormula.trim())?.[1].toLowerCase() || 'd20'
  const initValue = parseInt(actor.system.attributes.init.value) || 0

  const definition = {
    id: 'initiative',
    name: 'Initiative',
    type: 'check',
    roll: { die: libDie, levelModifier: 'none' }
  }

  const modifiers = initValue !== 0
    ? [{
        kind: 'add',
        value: initValue,
        origin: {
          category: 'other',
          id: 'initiative-total',
          label: 'Initiative'
        }
      }]
    : []

  const plan = libRollCheck(definition, character, {
    mode: 'formula',
    modifiers
  })

  const foundryRoll = new Roll(plan.formula)
  await foundryRoll.evaluate()

  const primaryDie = foundryRoll.dice?.[0]
  const natural = primaryDie?.total ?? foundryRoll.total

  return { character, plan, foundryRoll, natural }
}

describeIfDice('adapter formula flow for initiative (real Foundry dice)', () => {
  test('default initiative formula is 1d20 with zero modifier', async () => {
    const actor = makeActor({ agl: 10, initValue: 0 })
    const { plan } = await runAdapterInitiative(actor)

    expect(plan.formula).toBe('1d20')
  })

  test('positive init value appears as a +N modifier on the formula', async () => {
    // agl 15 (mod +1) + otherMod +2 folded → init.value = 3
    const actor = makeActor({ agl: 15, initValue: 3 })
    const { plan, foundryRoll, natural } = await runAdapterInitiative(actor)

    expect(plan.formula).toMatch(/^1d20/)
    // The lib may render "1d20 + 3" or similar; assert total arithmetic
    // instead of exact string shape.
    expect(foundryRoll.total).toBe(natural + 3)
  })

  test('negative init value appears as a -N modifier on the formula', async () => {
    // agl 8 (mod -1) + otherMod 0 → init.value = -1
    const actor = makeActor({ agl: 8, initValue: -1 })
    const { foundryRoll, natural } = await runAdapterInitiative(actor)

    expect(foundryRoll.total).toBe(natural - 1)
  })

  test('custom d14 init die propagates through the formula', async () => {
    const actor = makeActor({ initDie: '1d14', initValue: 2 })
    const { plan, foundryRoll, natural } = await runAdapterInitiative(actor)

    expect(plan.formula).toMatch(/^1d14/)
    expect(natural).toBeGreaterThanOrEqual(1)
    expect(natural).toBeLessThanOrEqual(14)
    expect(foundryRoll.total).toBe(natural + 2)
  })

  test('custom d24 init die (warrior) propagates through the formula', async () => {
    const actor = makeActor({ initDie: '1d24', initValue: 0, classId: 'warrior', level: 5 })
    const { plan, foundryRoll, natural } = await runAdapterInitiative(actor)

    expect(plan.formula).toMatch(/^1d24/)
    expect(natural).toBeGreaterThanOrEqual(1)
    expect(natural).toBeLessThanOrEqual(24)
    expect(foundryRoll.total).toBe(natural)
  })

  test('natural range matches the configured die across many rolls', async () => {
    const actor = makeActor({ initDie: '1d16', initValue: 1 })
    for (let i = 0; i < 30; i++) {
      const { foundryRoll, natural } = await runAdapterInitiative(actor)
      expect(natural).toBeGreaterThanOrEqual(1)
      expect(natural).toBeLessThanOrEqual(16)
      expect(foundryRoll.total).toBe(natural + 1)
    }
  })

  test('modifier breakdown carries the aggregate initiative-total origin', async () => {
    // Evaluate mode classifies the natural die and returns applied flags
    // on the modifiers — easier to assert against than the formula-mode
    // `modifiers` field, which may not be populated until evaluation.
    const actor = makeActor({ agl: 13, initValue: 2 })
    const character = actorToCharacter(actor)

    const result = libRollCheck(
      {
        id: 'initiative',
        name: 'Initiative',
        type: 'check',
        roll: { die: 'd20', levelModifier: 'none' }
      },
      character,
      {
        mode: 'evaluate',
        roller: () => 12,
        modifiers: [{
          kind: 'add',
          value: 2,
          origin: {
            category: 'other',
            id: 'initiative-total',
            label: 'Initiative'
          }
        }]
      }
    )

    const initMod = result.modifiers.find(
      (m) => m.origin?.category === 'other' && m.origin?.id === 'initiative-total'
    )
    expect(initMod).toBeDefined()
    expect(initMod.kind).toBe('add')
    expect(initMod.value).toBe(2)
    expect(initMod.applied).toBe(true)
    expect(result.natural).toBe(12)
    expect(result.total).toBe(14)
  })
})
