/* global Roll */
/**
 * Integration test for the Phase 1 adapter pipeline (saving throws)
 * with REAL Foundry dice.
 *
 * Covers the two-pass flow inside `_rollSavingThrowViaAdapter`:
 *   actorToCharacter (with frt/ref/wil → fortitude/reflex/will remap) →
 *   libRollSavingThrow (formula mode) →
 *   new Roll(formula).evaluate() (real Foundry dice engine) →
 *   libRollSavingThrow (evaluate mode, sync roller = pre-rolled natural)
 *
 * Mirror of adapter-ability-check integration tests. ChatMessage
 * rendering is out of scope here (full Foundry client required); the
 * mock-based suite at module/__tests__/adapter-saving-throw.test.js
 * covers that path.
 */

import { describe, test, expect } from 'vitest'
import {
  rollSavingThrow as libRollSavingThrow
} from '../vendor/dcc-core-lib/index.js'
import {
  actorToCharacter,
  foundrySaveIdToLib,
  libSaveIdToFoundry
} from '../adapter/character-accessors.mjs'

const hasDiceEngine = typeof Roll !== 'undefined' && Roll?.parse
const describeIfDice = hasDiceEngine ? describe : describe.skip

// Minimal DCCActor-shaped object. Mirror of the helper in the ability-
// check integration test — only the fields the adapter touches are
// populated.
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
    uuid: 'Actor.save-' + Math.random().toString(36).slice(2, 8),
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

// Abbreviated two-pass flow from DCCActor._rollSavingThrowViaAdapter,
// minus the chat-renderer step. Returns { foundryRoll, result } so
// tests can assert on both the Foundry Roll and the lib's structured
// result. Takes Foundry save id (frt/ref/wil) to exercise the remap.
async function runAdapterSavingThrow (actor, foundrySaveId) {
  const character = actorToCharacter(actor)
  const libSaveId = foundrySaveIdToLib(foundrySaveId)

  const plan = libRollSavingThrow(libSaveId, character, { mode: 'formula' })

  const foundryRoll = new Roll(plan.formula)
  await foundryRoll.evaluate()

  const primaryDie = foundryRoll.dice?.[0]
  const natural = primaryDie?.total ?? foundryRoll.total

  const result = libRollSavingThrow(libSaveId, character, {
    mode: 'evaluate',
    roller: () => natural
  })

  return { character, libSaveId, plan, foundryRoll, result, natural }
}

describe('save id remap (round-trip)', () => {
  test('frt/ref/wil → fortitude/reflex/will and back', () => {
    expect(foundrySaveIdToLib('frt')).toBe('fortitude')
    expect(foundrySaveIdToLib('ref')).toBe('reflex')
    expect(foundrySaveIdToLib('wil')).toBe('will')

    expect(libSaveIdToFoundry('fortitude')).toBe('frt')
    expect(libSaveIdToFoundry('reflex')).toBe('ref')
    expect(libSaveIdToFoundry('will')).toBe('wil')

    expect(libSaveIdToFoundry(foundrySaveIdToLib('frt'))).toBe('frt')
    expect(libSaveIdToFoundry(foundrySaveIdToLib('ref'))).toBe('ref')
    expect(libSaveIdToFoundry(foundrySaveIdToLib('wil'))).toBe('wil')
  })
})

describeIfDice('adapter two-pass flow for saves (real Foundry dice)', () => {
  // The Foundry actor stores `saves.{ref,frt,wil}.value` as the FULL
  // save total (class + ability mod, baked together by
  // actor.js#computeSaves). The lib now treats `state.saves.*` as that
  // same final value — see dcc-core-lib createSaveDefinition (no
  // `roll.ability`). So the rolled bonus is just the saves value;
  // ability is NOT layered on top.

  test('Reflex save formula uses the stored save total', async () => {
    const actor = makeActor({ agl: 15, saves: { ref: 2, frt: 0, wil: 0 } })
    const { plan, libSaveId, foundryRoll, natural } =
      await runAdapterSavingThrow(actor, 'ref')

    expect(libSaveId).toBe('reflex')
    expect(plan.formula).toMatch(/^1d20/)
    expect(foundryRoll.total).toBe(natural + 2)
  })

  test('Fortitude save formula uses the stored save total', async () => {
    const actor = makeActor({ sta: 13, saves: { frt: 3, ref: 0, wil: 0 } })
    const { plan, libSaveId, foundryRoll, natural } =
      await runAdapterSavingThrow(actor, 'frt')

    expect(libSaveId).toBe('fortitude')
    expect(plan.formula).toMatch(/^1d20/)
    expect(foundryRoll.total).toBe(natural + 3)
  })

  test('Will save formula uses the stored save total', async () => {
    const actor = makeActor({ per: 17, saves: { wil: 1, ref: 0, frt: 0 } })
    const { plan, libSaveId, foundryRoll, natural } =
      await runAdapterSavingThrow(actor, 'wil')

    expect(libSaveId).toBe('will')
    expect(plan.formula).toMatch(/^1d20/)
    expect(foundryRoll.total).toBe(natural + 1)
  })

  test('formula omits zero modifiers', async () => {
    const actor = makeActor({ agl: 10, saves: { ref: 0, frt: 0, wil: 0 } })
    const { plan } = await runAdapterSavingThrow(actor, 'ref')

    expect(plan.formula).toBe('1d20')
  })

  test('Foundry Roll total equals natural + stored save total', async () => {
    const actor = makeActor({ per: 17, saves: { wil: 3, ref: 0, frt: 0 } })
    for (let i = 0; i < 40; i++) {
      const { foundryRoll, natural } = await runAdapterSavingThrow(actor, 'wil')

      expect(natural).toBeGreaterThanOrEqual(1)
      expect(natural).toBeLessThanOrEqual(20)
      expect(foundryRoll.total).toBe(natural + 3)
    }
  })

  test('lib result.total matches Foundry Roll total across rolls', async () => {
    const actor = makeActor({ sta: 15, saves: { frt: 2, ref: 0, wil: 0 } })
    for (let i = 0; i < 25; i++) {
      const { foundryRoll, result } = await runAdapterSavingThrow(actor, 'frt')
      expect(result.total).toBe(foundryRoll.total)
    }
  })

  test('result classifies critical on natural 20', async () => {
    const actor = makeActor({ agl: 15, saves: { ref: 2, frt: 0, wil: 0 } })
    const result = libRollSavingThrow('reflex', actorToCharacter(actor), {
      mode: 'evaluate',
      roller: () => 20
    })

    expect(result.natural).toBe(20)
    expect(result.critical).toBe(true)
    expect(result.fumble).toBe(false)
  })

  test('result classifies fumble on natural 1', async () => {
    const actor = makeActor({ per: 14, saves: { wil: 1, ref: 0, frt: 0 } })
    const result = libRollSavingThrow('will', actorToCharacter(actor), {
      mode: 'evaluate',
      roller: () => 1
    })

    expect(result.natural).toBe(1)
    expect(result.critical).toBe(false)
    expect(result.fumble).toBe(true)
  })

  test('modifier breakdown carries the save total once, no ability layered on', async () => {
    // Saves are added by the lib via a single `save-bonus` modifier.
    // The save check definition deliberately omits `roll.ability`, so
    // the resolver does NOT also stack a `category: 'ability'` modifier
    // on top — that would double-count the ability mod (already baked
    // into the stored save total).
    const actor = makeActor({ agl: 15, saves: { ref: 2, frt: 0, wil: 0 } })
    const { result } = await runAdapterSavingThrow(actor, 'ref')

    const saveBonusMod = result.modifiers.find(
      (m) => m.origin?.category === 'other' && m.origin?.id === 'save-bonus'
    )
    expect(saveBonusMod).toBeDefined()
    expect(saveBonusMod.kind).toBe('add')
    expect(saveBonusMod.value).toBe(2)
    expect(saveBonusMod.applied).toBe(true)

    const abilityMod = result.modifiers.find((m) => m.origin?.category === 'ability')
    expect(abilityMod).toBeUndefined()
  })
})
