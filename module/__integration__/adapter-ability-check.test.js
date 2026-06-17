/* global Roll */
/**
 * Integration test for the Phase 1 adapter pipeline with REAL Foundry dice.
 *
 * Covers the two-pass flow inside `_rollAbilityCheckViaAdapter`:
 *   actorToCharacter →
 *   libRollAbilityCheck (formula mode) →
 *   new Roll(formula).evaluate() (real Foundry dice engine) →
 *   libRollAbilityCheck (evaluate mode, sync roller = pre-rolled natural)
 *
 * ChatMessage rendering is out of scope here (it requires a full Foundry
 * client environment). The mock-based suite at
 * module/__tests__/adapter-ability-check.test.js covers that path.
 *
 * These tests verify the part that matters for correctness: the lib's
 * formula matches what the actor's data implies, the Foundry Roll total
 * includes modifiers, and classification (crit/fumble) operates on the
 * same natural value that Foundry rolled.
 */

import { describe, test, expect } from 'vitest'
import {
  rollAbilityCheck as libRollAbilityCheck
} from '../vendor/dcc-core-lib/index.js'
import { actorToCharacter } from '../adapter/character-accessors.mjs'

const hasDiceEngine = typeof Roll !== 'undefined' && Roll?.parse
const describeIfDice = hasDiceEngine ? describe : describe.skip

// Minimal DCCActor-shaped object. Only the fields actorToCharacter and the
// adapter path touch are populated — no Actor subclass, no mocking of the
// full Foundry Document API.
function makeActor ({
  str = 10,
  agl = 10,
  sta = 10,
  per = 10,
  int: intScore = 10,
  lck = 10,
  level = 1,
  classId,
  saves = { ref: 0, frt: 0, wil: 0 }
} = {}) {
  return {
    uuid: 'Actor.test-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Adapter Actor',
    system: {
      abilities: {
        str: { value: str, max: str },
        agl: { value: agl, max: agl },
        sta: { value: sta, max: sta },
        per: { value: per, max: per },
        int: { value: intScore, max: intScore },
        lck: { value: lck, max: lck }
      },
      saves: {
        ref: { value: String(saves.ref) },
        frt: { value: String(saves.frt) },
        wil: { value: String(saves.wil) }
      },
      attributes: { ac: { checkPenalty: 0 } },
      details: { level: { value: level } },
      class: classId ? { className: classId } : {},
      config: { computeCheckPenalty: true }
    }
  }
}

// Abbreviated two-pass flow from DCCActor._rollAbilityCheckViaAdapter,
// minus the chat-renderer step. Returns { foundryRoll, result } so tests
// can assert on both the Foundry Roll and the lib's structured result.
async function runAdapterAbilityCheck (actor, abilityId, { luckBurn } = {}) {
  const character = actorToCharacter(actor)

  const plan = libRollAbilityCheck(abilityId, character, {
    mode: 'formula',
    ...(luckBurn !== undefined ? { luckBurn } : {})
  })

  const foundryRoll = new Roll(plan.formula)
  await foundryRoll.evaluate()

  const primaryDie = foundryRoll.dice?.[0]
  const natural = primaryDie?.total ?? foundryRoll.total

  const result = libRollAbilityCheck(abilityId, character, {
    mode: 'evaluate',
    roller: () => natural,
    ...(luckBurn !== undefined ? { luckBurn } : {})
  })

  return { character, plan, foundryRoll, result, natural }
}

describe('actorToCharacter (integration)', () => {
  test('maps ability scores to Character shape', () => {
    const actor = makeActor({ str: 15, agl: 11, per: 17, int: 16, sta: 14, lck: 16 })
    const character = actorToCharacter(actor)

    expect(character.state.abilities.str.current).toBe(15)
    expect(character.state.abilities.agl.current).toBe(11)
    expect(character.state.abilities.per.current).toBe(17)
    expect(character.state.abilities.lck.current).toBe(16)
  })

  test('remaps Foundry save ids (frt/ref/wil) to lib ids (fortitude/reflex/will)', () => {
    const actor = makeActor({ saves: { ref: 2, frt: -1, wil: 3 } })
    const character = actorToCharacter(actor)

    expect(character.state.saves.reflex).toBe(2)
    expect(character.state.saves.fortitude).toBe(-1)
    expect(character.state.saves.will).toBe(3)
  })

  test('carries level + class id', () => {
    const actor = makeActor({ level: 3, classId: 'Warrior' })
    const character = actorToCharacter(actor)

    expect(character.classInfo.level).toBe(3)
    expect(character.classInfo.classId).toBe('warrior')
  })
})

describeIfDice('adapter two-pass flow (real Foundry dice)', () => {
  test('formula includes the ability modifier the character carries', async () => {
    const actor = makeActor({ str: 15 }) // +1 modifier in DCC
    const { plan } = await runAdapterAbilityCheck(actor, 'str')

    expect(plan.formula).toBe('1d20+1')
  })

  test('formula omits the ability modifier when it is zero', async () => {
    const actor = makeActor({ int: 10 }) // 0 modifier
    const { plan } = await runAdapterAbilityCheck(actor, 'int')

    expect(plan.formula).toBe('1d20')
  })

  test('Foundry Roll total equals natural + ability modifier', async () => {
    const actor = makeActor({ str: 15 }) // +1
    // Run enough iterations to cover the full d20 range with high probability
    for (let i = 0; i < 40; i++) {
      const { foundryRoll, natural } = await runAdapterAbilityCheck(actor, 'str')

      expect(natural).toBeGreaterThanOrEqual(1)
      expect(natural).toBeLessThanOrEqual(20)
      expect(foundryRoll.total).toBe(natural + 1)
    }
  })

  test('lib result.total matches Foundry Roll total', async () => {
    const actor = makeActor({ agl: 13 }) // +1 modifier
    for (let i = 0; i < 25; i++) {
      const { foundryRoll, result } = await runAdapterAbilityCheck(actor, 'agl')
      expect(result.total).toBe(foundryRoll.total)
    }
  })

  test('result classifies critical on natural max of the die', async () => {
    const actor = makeActor({ str: 18 }) // +3
    // Force a natural 20 by using maximize mode on a fresh Roll
    const roll = new Roll('1d20+3')
    roll.evaluateSync({ maximize: true })

    const result = libRollAbilityCheck('str', actorToCharacter(actor), {
      mode: 'evaluate',
      roller: () => 20
    })

    expect(result.natural).toBe(20)
    expect(result.critical).toBe(true)
    expect(result.fumble).toBe(false)
    expect(roll.total).toBe(23) // 20 + 3
  })

  test('result classifies fumble on natural 1', async () => {
    const actor = makeActor({ agl: 11 }) // +0
    const result = libRollAbilityCheck('agl', actorToCharacter(actor), {
      mode: 'evaluate',
      roller: () => 1
    })

    expect(result.natural).toBe(1)
    expect(result.critical).toBe(false)
    expect(result.fumble).toBe(true)
  })

  test('modifier breakdown carries the ability origin', async () => {
    const actor = makeActor({ per: 17 }) // +2
    const { result } = await runAdapterAbilityCheck(actor, 'per')

    const abilityMod = result.modifiers.find((m) => m.origin?.category === 'ability')
    expect(abilityMod).toBeDefined()
    expect(abilityMod.kind).toBe('add')
    expect(abilityMod.value).toBe(2)
    expect(abilityMod.origin.id).toBe('per')
    expect(abilityMod.applied).toBe(true)
  })

  test('default ability check has no level modifier (levelModifier: none)', async () => {
    const actor = makeActor({ int: 14, level: 5 }) // +1 int, level 5
    const { result } = await runAdapterAbilityCheck(actor, 'int')

    const levelMod = result.modifiers.find((m) => m.origin?.category === 'level')
    expect(levelMod).toBeUndefined()
  })
})
