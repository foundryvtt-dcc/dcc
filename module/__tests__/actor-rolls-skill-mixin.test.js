import { describe, test, expect } from 'vitest'
import { RollsSkillMixin } from '../actor/rolls-skill-mixin.mjs'

// Phase 7 (actor.js shrinkage, continued): the skill-check dispatch layer moved
// out of actor.js into actor/rolls-skill-mixin.mjs. This guard pins the
// extraction's shape on a bare Base, alongside the existing behavioral coverage
// in actor.test.js (which exercises the dispatchers through live DCCActor
// instances and passes unchanged, proving transparent composition).

const MEMBERS = [
  'rollSkillCheck',
  '_resolveSkill',
  '_rollSkillCheckViaAdapter',
  '_skillTableViaAdapter',
  '_buildSkillDefinition',
  '_buildSkillCheckModifiers',
  '_stripDieCount',
  '_emitSkillDescriptionViaAdapter',
  '_buildSkillCheckRollTerms'
]

class Base {}
const Mixed = RollsSkillMixin(Base)

describe('RollsSkillMixin extraction', () => {
  test('is a mixin factory preserving the prototype chain', () => {
    expect(typeof RollsSkillMixin).toBe('function')
    expect(Object.getPrototypeOf(Mixed)).toBe(Base)
  })

  test('carries the full skill-check dispatch surface', () => {
    for (const name of MEMBERS) {
      expect(Object.getOwnPropertyDescriptor(Mixed.prototype, name), `missing: ${name}`).toBeDefined()
    }
  })
})
