import { describe, test, expect } from 'vitest'
// The mixin destructures `foundry.applications.ux.TextEditor` at module load, so
// the foundry mock (which sets global.foundry) must be imported first.
import '../__mocks__/foundry.js'
import { RollsWeaponMixin } from '../actor/rolls-weapon-mixin.mjs'

// Phase 7 (actor.js shrinkage, continued): the weapon attack/damage/crit/fumble
// dispatch layer moved out of actor.js into actor/rolls-weapon-mixin.mjs. This
// guard pins the extraction's shape on a bare Base, alongside the existing
// behavioral coverage in actor.test.js (which exercises the dispatchers through
// live DCCActor instances and passes unchanged, proving transparent composition).

const MEMBERS = [
  'rollWeaponAttack',
  '_rollWeaponAttackDispatch',
  'rollToHit',
  '_rollDamage',
  '_buildLibDamageResult',
  '_structureDamageInput',
  '_rollCritical',
  '_rollFumble',
  'rollCritical'
]

class Base {}
const Mixed = RollsWeaponMixin(Base)

describe('RollsWeaponMixin extraction', () => {
  test('is a mixin factory preserving the prototype chain', () => {
    expect(typeof RollsWeaponMixin).toBe('function')
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
  })

  test('carries the full weapon-attack dispatch surface', () => {
    for (const name of MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(Mixed.prototype, name), `missing: ${name}`).toBeDefined()
    }
  })
})
