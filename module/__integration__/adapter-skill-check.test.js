/* global Roll */
/**
 * Integration test for the Phase 1 adapter pipeline (skill checks)
 * with REAL Foundry dice.
 *
 * Covers the two-pass flow inside `_rollSkillCheckViaAdapter`:
 *   actorToCharacter →
 *   build SkillDefinition + situational modifiers →
 *   libRollCheck (formula mode) →
 *   new Roll(formula).evaluate() (real Foundry dice engine) →
 *   libRollCheck (evaluate mode, sync roller = pre-rolled natural)
 *
 * Mirrors adapter-saving-throw.test.js. ChatMessage rendering is out
 * of scope here (full Foundry client required); the mock-based suite
 * at module/__tests__/adapter-skill-check.test.js covers that path.
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

// Minimal DCCActor-shaped object — only the fields the adapter touches.
function makeActor ({
  str = 10,
  agl = 10,
  sta = 10,
  per = 10,
  int: intScore = 10,
  lck = 10,
  level = 1,
  classId
} = {}) {
  return {
    uuid: 'Actor.skill-' + Math.random().toString(36).slice(2, 8),
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
        ref: { value: '0' },
        frt: { value: '0' },
        wil: { value: '0' }
      },
      attributes: { ac: { checkPenalty: 0 } },
      details: { level: { value: level } },
      class: classId ? { className: classId } : {},
      config: { computeCheckPenalty: true }
    }
  }
}

// Build the SkillDefinition / modifier list the adapter would emit,
// then run the same two-pass flow (minus the chat renderer). Keeps the
// per-test scaffolding light while exercising every path under the
// actor's _buildSkillDefinition / _buildSkillCheckModifiers
// (re-implemented inline here so the integration suite doesn't need
// the full DCCActor mock stack).
function buildSkillDefinition (skillId, { name, die, ability }) {
  const definition = {
    id: `skill:${skillId}`,
    name,
    type: 'check',
    roll: {
      die,
      levelModifier: 'none'
    }
  }
  if (ability) definition.roll.ability = ability
  return definition
}

function skillValueMod (label, value) {
  return {
    kind: 'add',
    value,
    origin: { category: 'other', id: 'skill-value', label }
  }
}

async function runAdapterSkillCheck (actor, { skillId, name, die, ability, value }) {
  const character = actorToCharacter(actor)
  const definition = buildSkillDefinition(skillId, { name, die, ability })
  const modifiers = []
  if (value !== undefined && value !== 0) {
    modifiers.push(skillValueMod(name, value))
  }

  const plan = libRollCheck(definition, character, { mode: 'formula', modifiers })

  const foundryRoll = new Roll(plan.formula)
  await foundryRoll.evaluate()

  const natural = foundryRoll.dice?.[0]?.total ?? foundryRoll.total

  const result = libRollCheck(definition, character, {
    mode: 'evaluate',
    roller: () => natural,
    modifiers
  })

  return { definition, plan, foundryRoll, result, natural }
}

describeIfDice('adapter two-pass flow for skills (real Foundry dice)', () => {
  test('d20 skill with an ability modifier produces the right total', async () => {
    // int 14 = +1 ability mod, value 2 → 1d20 + 3
    const actor = makeActor({ int: 14 })
    const { plan, foundryRoll, natural } = await runAdapterSkillCheck(actor, {
      skillId: 'tinker',
      name: 'Tinker',
      die: 'd20',
      ability: 'int',
      value: 2
    })

    expect(plan.formula).toMatch(/^1d20/)
    expect(foundryRoll.total).toBe(natural + 3)
  })

  test('custom d14 skill rolls 1..14 and totals include the modifier', async () => {
    // Halfling-style d14 skill. agl 13 → +1, value 0 → 1d14 + 1.
    const actor = makeActor({ agl: 13 })
    for (let i = 0; i < 40; i++) {
      const { plan, foundryRoll, natural, result } = await runAdapterSkillCheck(actor, {
        skillId: 'sneak',
        name: 'Sneak',
        die: 'd14',
        ability: 'agl',
        value: 0
      })

      expect(plan.formula).toMatch(/^1d14/)
      expect(natural).toBeGreaterThanOrEqual(1)
      expect(natural).toBeLessThanOrEqual(14)
      expect(foundryRoll.total).toBe(natural + 1)
      expect(result.total).toBe(foundryRoll.total)
    }
  })

  test('custom d24 skill rolls 1..24 and propagates through the formula', async () => {
    // per 16 → +2 ability mod, value 1 → 1d24 + 3.
    const actor = makeActor({ per: 16 })
    for (let i = 0; i < 40; i++) {
      const { plan, foundryRoll, natural } = await runAdapterSkillCheck(actor, {
        skillId: 'alchemy',
        name: 'Alchemy',
        die: 'd24',
        ability: 'per',
        value: 1
      })

      expect(plan.formula).toMatch(/^1d24/)
      expect(natural).toBeGreaterThanOrEqual(1)
      expect(natural).toBeLessThanOrEqual(24)
      expect(foundryRoll.total).toBe(natural + 3)
    }
  })

  test('formula omits zero ability mod and zero value', async () => {
    // agl 10 (0 mod), value 0 → bare 1d20.
    const actor = makeActor()
    const { plan } = await runAdapterSkillCheck(actor, {
      skillId: 'bare',
      name: 'Bare',
      die: 'd20',
      ability: 'agl',
      value: 0
    })

    expect(plan.formula).toBe('1d20')
  })

  test('lib result.total matches Foundry Roll total across rolls', async () => {
    const actor = makeActor({ int: 15 })
    for (let i = 0; i < 25; i++) {
      const { foundryRoll, result } = await runAdapterSkillCheck(actor, {
        skillId: 'lore',
        name: 'Lore',
        die: 'd20',
        ability: 'int',
        value: 3
      })
      expect(result.total).toBe(foundryRoll.total)
    }
  })

  test('critical classification triggers on a natural-max d14', async () => {
    // Force natural 14 on d14 — the whole point of custom-die crit
    // detection. Skip the Foundry Roll and drive the evaluate step
    // with a deterministic roller so we can assert the classification.
    const actor = makeActor({ agl: 10 })
    const character = actorToCharacter(actor)
    const definition = buildSkillDefinition('sneak', {
      name: 'Sneak',
      die: 'd14',
      ability: 'agl'
    })

    const result = libRollCheck(definition, character, {
      mode: 'evaluate',
      roller: () => 14
    })

    expect(result.natural).toBe(14)
    expect(result.critical).toBe(true)
    expect(result.fumble).toBe(false)
  })

  test('fumble classification triggers on a natural 1', async () => {
    const actor = makeActor()
    const character = actorToCharacter(actor)
    const definition = buildSkillDefinition('sneak', {
      name: 'Sneak',
      die: 'd14',
      ability: 'agl'
    })

    const result = libRollCheck(definition, character, {
      mode: 'evaluate',
      roller: () => 1
    })

    expect(result.natural).toBe(1)
    expect(result.critical).toBe(false)
    expect(result.fumble).toBe(true)
  })

  test('modifier breakdown carries ability + skill-value origins', async () => {
    const actor = makeActor({ per: 17 })
    const { result } = await runAdapterSkillCheck(actor, {
      skillId: 'alchemy',
      name: 'Alchemy',
      die: 'd24',
      ability: 'per',
      value: 2
    })

    const abilityMod = result.modifiers.find((m) => m.origin?.category === 'ability')
    expect(abilityMod).toBeDefined()
    expect(abilityMod.origin.id).toBe('per')
    expect(abilityMod.value).toBe(2)

    const valueMod = result.modifiers.find((m) => m.origin?.id === 'skill-value')
    expect(valueMod).toBeDefined()
    expect(valueMod.value).toBe(2)
    expect(valueMod.origin.label).toBe('Alchemy')
  })
})
