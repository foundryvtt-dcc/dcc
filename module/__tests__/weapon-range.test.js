/**
 * Unit coverage for missile-weapon range checking (`module/weapon-range.mjs`).
 * Drives the real `dcc-core-lib` range helpers through the hook handler against
 * a stubbed `game` / `foundry`; no live Foundry boot. Token positions are laid
 * out on a 100px / 5ft grid so `measureTokenDistance` yields exact distances:
 * a target at x = (ft / 5) * 100 sits `ft` feet from an attacker at the origin.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { measureTokenDistance, onModifyAttackRollTermsForRange, onModifyAttackRollTermsForFiringIntoMelee, onModifyAttackRollTerms } from '../weapon-range.mjs'

let originalGame
let originalFoundry

const attackerDoc = { x: 0, y: 0, width: 1, height: 1 }
const makeTargetDoc = (feet) => ({ x: (feet / 5) * 100, y: 0, width: 1, height: 1 })

function makeTargets (doc) {
  const set = new Set([{ document: doc }])
  set.first = () => [...set][0]
  return set
}

function actionDieTerms () {
  return [
    { type: 'Die', label: 'Action Die', formula: '1d20', presets: [] },
    { type: 'Compound', dieLabel: 'Deed', modifierLabel: 'To Hit', formula: '+0' }
  ]
}

function makeActor () {
  return {
    id: 'actor-1',
    getActiveTokens: () => [{ document: attackerDoc }],
    rollWeaponAttack: vi.fn()
  }
}

const rangedWeapon = { id: 'w1', name: 'Longbow', system: { melee: false, range: '70/140/210' } }

beforeEach(() => {
  originalGame = globalThis.game
  originalFoundry = globalThis.foundry
  globalThis.game = {
    modules: { get: vi.fn(() => undefined) }, // dcc-qol inactive
    // both opt-in settings on by default; individual tests override
    settings: { get: vi.fn((scope, key) => ({ checkWeaponRange: true, firingIntoMeleePenalty: true }[key] ?? false)) },
    canvas: { dimensions: { size: 100, distance: 5 }, tokens: { placeables: [] } },
    i18n: { localize: (k) => k, format: (k) => k }
  }
  globalThis.foundry = { applications: { api: { DialogV2: { confirm: vi.fn(() => Promise.resolve(false)) } } } }
})

afterEach(() => {
  globalThis.game = originalGame
  globalThis.foundry = originalFoundry
})

describe('measureTokenDistance', () => {
  test('adjacent tokens read as one space (scene.distance), never zero', () => {
    expect(measureTokenDistance(attackerDoc, makeTargetDoc(5))).toBe(5)
  })

  test('returns Infinity when a token is missing', () => {
    expect(measureTokenDistance(attackerDoc, null)).toBe(Infinity)
  })

  test('scales with grid spacing', () => {
    expect(measureTokenDistance(attackerDoc, makeTargetDoc(45))).toBe(45)
  })
})

describe('onModifyAttackRollTermsForRange — gating', () => {
  test('stands down (no mutation) when dcc-qol is active', () => {
    globalThis.game.modules.get.mockReturnValue({ active: true })
    const terms = actionDieTerms()
    expect(onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, { targets: makeTargets(makeTargetDoc(150)) })).toBe(true)
    expect(terms).toHaveLength(2)
    expect(terms[0].formula).toBe('1d20')
  })

  test('stands down when the checkWeaponRange setting is off', () => {
    globalThis.game.settings.get.mockReturnValue(false)
    const terms = actionDieTerms()
    expect(onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, { targets: makeTargets(makeTargetDoc(100)) })).toBe(true)
    expect(terms).toHaveLength(2)
  })

  test('ignores melee weapons', () => {
    const terms = actionDieTerms()
    const melee = { id: 'm1', name: 'Sword', system: { melee: true, range: '' } }
    expect(onModifyAttackRollTermsForRange(terms, makeActor(), melee, { targets: makeTargets(makeTargetDoc(100)) })).toBe(true)
    expect(terms).toHaveLength(2)
  })

  test('proceeds untouched when no target is selected', () => {
    const terms = actionDieTerms()
    expect(onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, { targets: new Set() })).toBe(true)
    expect(terms).toHaveLength(2)
  })
})

describe('onModifyAttackRollTermsForRange — penalties', () => {
  test('short range applies no penalty', () => {
    const terms = actionDieTerms()
    onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, { targets: makeTargets(makeTargetDoc(50)) })
    expect(terms).toHaveLength(2)
    expect(terms[0].formula).toBe('1d20')
  })

  test('medium range pushes a -2 modifier term', () => {
    const terms = actionDieTerms()
    onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, { targets: makeTargets(makeTargetDoc(100)) })
    expect(terms).toHaveLength(3)
    expect(terms[2]).toMatchObject({ type: 'Modifier', label: 'DCC.MediumRangePenalty', formula: -2 })
    expect(terms[0].formula).toBe('1d20')
  })

  test('long range steps the action die down one rung (1d20 → 1d16)', () => {
    const terms = actionDieTerms()
    onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, { targets: makeTargets(makeTargetDoc(180)) })
    expect(terms).toHaveLength(2) // no extra modifier term
    expect(terms[0].formula).toBe('1d16')
  })
})

describe('onModifyAttackRollTermsForRange — out of range', () => {
  test('cancels the roll and prompts when beyond long range', () => {
    const terms = actionDieTerms()
    const result = onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, { targets: makeTargets(makeTargetDoc(300)) })
    expect(result).toBe(false)
    expect(globalThis.foundry.applications.api.DialogV2.confirm).toHaveBeenCalledOnce()
    expect(terms).toHaveLength(2) // unchanged while the dialog decides
  })

  test('on confirmation, fires at the long-range penalty', () => {
    const terms = actionDieTerms()
    const result = onModifyAttackRollTermsForRange(terms, makeActor(), rangedWeapon, {
      targets: makeTargets(makeTargetDoc(300)),
      _rangeDialogConfirmed: true
    })
    expect(result).toBe(true)
    expect(globalThis.foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled()
    expect(terms[0].formula).toBe('1d16') // stepped down like long range
  })
})

describe('onModifyAttackRollTermsForFiringIntoMelee', () => {
  const FRIENDLY = 1
  const HOSTILE = -1
  const attacker = { id: 'att', x: 0, y: 0, width: 1, height: 1, disposition: FRIENDLY }
  const target = { id: 'tgt', x: 1000, y: 0, width: 1, height: 1, disposition: HOSTILE }
  const placeable = (doc) => ({ document: doc })
  const allyAdjacent = { id: 'ally', x: 1100, y: 0, width: 1, height: 1, disposition: FRIENDLY } // one grid from target
  const allyFar = { id: 'allyFar', x: 1300, y: 0, width: 1, height: 1, disposition: FRIENDLY } // two grids away
  const enemyAdjacent = { id: 'enemy', x: 900, y: 0, width: 1, height: 1, disposition: HOSTILE }

  function run (extraPlaceables = [], opts = {}) {
    globalThis.game.canvas.tokens.placeables = [placeable(target), ...extraPlaceables]
    const terms = actionDieTerms()
    const proceed = onModifyAttackRollTermsForFiringIntoMelee(terms, makeActor(), rangedWeapon, { token: attacker, targets: makeTargets(target), ...opts })
    return { terms, proceed }
  }

  test('applies -1 when an ally is in melee with the target', () => {
    const { terms, proceed } = run([placeable(allyAdjacent)])
    expect(proceed).toBe(true)
    expect(terms).toHaveLength(3)
    expect(terms[2]).toMatchObject({ type: 'Modifier', label: 'DCC.FiringIntoMeleePenalty', formula: -1 })
  })

  test('no penalty when only enemies are adjacent to the target', () => {
    expect(run([placeable(enemyAdjacent)]).terms).toHaveLength(2)
  })

  test('no penalty when allies are beyond melee range', () => {
    expect(run([placeable(allyFar)]).terms).toHaveLength(2)
  })

  test("excludes the attacker's own token from the melee check", () => {
    const attackerAdjacent = { ...attacker, x: 1100 } // shooter standing next to target
    globalThis.game.canvas.tokens.placeables = [placeable(target), placeable(attackerAdjacent)]
    const terms = actionDieTerms()
    onModifyAttackRollTermsForFiringIntoMelee(terms, makeActor(), rangedWeapon, { token: attackerAdjacent, targets: makeTargets(target) })
    expect(terms).toHaveLength(2)
  })

  test('stands down when dcc-qol is active', () => {
    globalThis.game.modules.get.mockReturnValue({ active: true })
    expect(run([placeable(allyAdjacent)]).terms).toHaveLength(2)
  })

  test('stands down when the firingIntoMeleePenalty setting is off', () => {
    globalThis.game.settings.get.mockImplementation((scope, key) => key !== 'firingIntoMeleePenalty')
    expect(run([placeable(allyAdjacent)]).terms).toHaveLength(2)
  })

  test('ignores melee weapons', () => {
    globalThis.game.canvas.tokens.placeables = [placeable(target), placeable(allyAdjacent)]
    const terms = actionDieTerms()
    onModifyAttackRollTermsForFiringIntoMelee(terms, makeActor(), { id: 'm', name: 'Sword', system: { melee: true } }, { token: attacker, targets: makeTargets(target) })
    expect(terms).toHaveLength(2)
  })
})

describe('onModifyAttackRollTerms (combined dispatcher)', () => {
  const attacker = { id: 'att', x: 0, y: 0, width: 1, height: 1, disposition: 1 }

  test('applies both firing-into-melee and range penalties in one pass', () => {
    const tgt = { id: 'tgt', x: (100 / 5) * 100, y: 0, width: 1, height: 1, disposition: -1 } // 100 ft → medium
    const ally = { id: 'ally', x: tgt.x + 100, y: 0, width: 1, height: 1, disposition: 1 } // adjacent to target
    globalThis.game.canvas.tokens.placeables = [{ document: tgt }, { document: ally }]
    const terms = actionDieTerms()
    const proceed = onModifyAttackRollTerms(terms, makeActor(), rangedWeapon, { token: attacker, targets: makeTargets(tgt) })
    expect(proceed).toBe(true)
    const labels = terms.filter(t => t.type === 'Modifier').map(t => t.label)
    expect(labels).toContain('DCC.FiringIntoMeleePenalty')
    expect(labels).toContain('DCC.MediumRangePenalty')
  })

  test('returns false (cancelling) when the range rule prompts out-of-range', () => {
    const tgt = { id: 'tgt', x: (300 / 5) * 100, y: 0, width: 1, height: 1, disposition: -1 } // 300 ft → out of range
    globalThis.game.canvas.tokens.placeables = [{ document: tgt }]
    const terms = actionDieTerms()
    expect(onModifyAttackRollTerms(terms, makeActor(), rangedWeapon, { token: attacker, targets: makeTargets(tgt) })).toBe(false)
  })
})
