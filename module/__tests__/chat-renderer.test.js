/**
 * Unit tests for the chat-renderer's shared flag builder.
 *
 * `buildLibResultFlag` is the extraction that de-duplicates the four
 * near-identical `dcc.libResult` payloads the ability / save / skill /
 * spell renderers emit (Phase 7 session 10). The helper is pure — no
 * Foundry globals — so it is tested in isolation here; the full
 * renderer round-trips stay covered by the adapter-*-check tests and
 * the Playwright dispatch specs.
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import { applyFleetingLuck, buildLibResultFlag, buildModifierBreakdownHtml } from '../adapter/chat-renderer.mjs'

// A representative lib SkillCheckResult-shaped object. Carries every
// core field the flag projects plus the spell-only extras so the
// extras-passthrough tests have real values to assert against.
function makeResult (overrides = {}) {
  return {
    skillId: 'ability:str',
    spellId: 'magic-missile',
    die: 'd20',
    natural: 14,
    total: 17,
    formula: '1d20 + 3',
    critical: false,
    fumble: false,
    tier: 'success-minor',
    spellLost: false,
    corruptionTriggered: false,
    modifiers: [{ kind: 'ability', value: 3, applied: true }],
    ...overrides
  }
}

describe('buildLibResultFlag', () => {
  test('projects exactly the seven shared core fields when no extras given', () => {
    const flag = buildLibResultFlag(makeResult())
    expect(Object.keys(flag).sort()).toEqual(
      ['critical', 'die', 'formula', 'fumble', 'modifiers', 'natural', 'total'].sort()
    )
  })

  test('copies each core field verbatim from the result', () => {
    const result = makeResult()
    const flag = buildLibResultFlag(result)
    expect(flag.die).toBe('d20')
    expect(flag.natural).toBe(14)
    expect(flag.total).toBe(17)
    expect(flag.formula).toBe('1d20 + 3')
    expect(flag.critical).toBe(false)
    expect(flag.fumble).toBe(false)
    // modifiers carries through by reference (same array the lib emitted)
    expect(flag.modifiers).toBe(result.modifiers)
  })

  test('does NOT include result-id or spell-only fields unless passed as extras', () => {
    const flag = buildLibResultFlag(makeResult())
    expect(flag).not.toHaveProperty('skillId')
    expect(flag).not.toHaveProperty('spellId')
    expect(flag).not.toHaveProperty('tier')
    expect(flag).not.toHaveProperty('spellLost')
    expect(flag).not.toHaveProperty('corruptionTriggered')
  })

  test('check-shaped extras add skillId alongside the core (matches ability/save/skill renderers)', () => {
    const result = makeResult({ skillId: 'sneakSilently' })
    const flag = buildLibResultFlag(result, { skillId: result.skillId })
    expect(flag.skillId).toBe('sneakSilently')
    // Field set matches what renderAbilityCheck / renderSavingThrow /
    // renderSkillCheck emitted pre-extraction.
    expect(Object.keys(flag).sort()).toEqual(
      ['skillId', 'die', 'natural', 'total', 'formula', 'critical', 'fumble', 'modifiers'].sort()
    )
  })

  test('spell-shaped extras add spellId + tier + spellLost + corruptionTriggered (matches renderSpellCheck)', () => {
    const result = makeResult({ spellId: 'magic-shield', tier: 'success-major', spellLost: true, corruptionTriggered: true })
    const flag = buildLibResultFlag(result, {
      spellId: result.spellId,
      tier: result.tier,
      spellLost: result.spellLost,
      corruptionTriggered: result.corruptionTriggered
    })
    expect(flag.spellId).toBe('magic-shield')
    expect(flag.tier).toBe('success-major')
    expect(flag.spellLost).toBe(true)
    expect(flag.corruptionTriggered).toBe(true)
    // No skillId on the spell payload — matches the pre-extraction literal.
    expect(flag).not.toHaveProperty('skillId')
    expect(Object.keys(flag).sort()).toEqual(
      ['spellId', 'tier', 'spellLost', 'corruptionTriggered', 'die', 'natural', 'total', 'formula', 'critical', 'fumble', 'modifiers'].sort()
    )
  })

  test('passes undefined core fields through as undefined (no silent defaulting)', () => {
    const flag = buildLibResultFlag({ die: 'd16' })
    expect(flag.die).toBe('d16')
    expect(flag.natural).toBeUndefined()
    expect(flag.total).toBeUndefined()
    expect(flag.modifiers).toBeUndefined()
  })

  test('extras win over core when keys collide (caller controls the override)', () => {
    const flag = buildLibResultFlag(makeResult({ total: 17 }), { total: 99 })
    expect(flag.total).toBe(99)
  })
})

describe('buildModifierBreakdownHtml', () => {
  test('returns empty string for missing / empty / non-array input', () => {
    expect(buildModifierBreakdownHtml(undefined)).toBe('')
    expect(buildModifierBreakdownHtml(null)).toBe('')
    expect(buildModifierBreakdownHtml([])).toBe('')
    expect(buildModifierBreakdownHtml('nope')).toBe('')
  })

  test('renders tagged-union `add` modifiers as label + signed value', () => {
    const html = buildModifierBreakdownHtml([
      { kind: 'add', value: 1, origin: { category: 'ability', id: 'str', label: 'Strength' }, applied: true },
      { kind: 'add', value: -2, origin: { category: 'penalty', id: 'check-penalty', label: 'Check Penalty' }, applied: true }
    ])
    expect(html).toContain('<div class="dcc-modifier-breakdown">')
    expect(html).toContain('<span class="dcc-modifier-label">Strength</span><span class="dcc-modifier-value">+1</span>')
    expect(html).toContain('<span class="dcc-modifier-label">Check Penalty</span><span class="dcc-modifier-value">-2</span>')
  })

  test('renders a zero-value modifier as +0 (the backlog "Save bonus +0" case)', () => {
    const html = buildModifierBreakdownHtml([
      { kind: 'add', value: 0, origin: { category: 'progression', id: 'save', label: 'Save bonus' }, applied: true }
    ])
    expect(html).toContain('<span class="dcc-modifier-label">Save bonus</span><span class="dcc-modifier-value">+0</span>')
  })

  test('includes the localized heading when provided, omits it otherwise', () => {
    const mods = [{ kind: 'add', value: 1, origin: { label: 'Strength' }, applied: true }]
    const withHeading = buildModifierBreakdownHtml(mods, 'Modifiers')
    expect(withHeading).toContain('<span class="dcc-modifier-breakdown-heading">Modifiers</span>')
    const without = buildModifierBreakdownHtml(mods)
    expect(without).not.toContain('dcc-modifier-breakdown-heading')
  })

  test('drops tagged-union modifiers the evaluator marked applied:false', () => {
    const html = buildModifierBreakdownHtml([
      { kind: 'add', value: 3, origin: { label: 'Counted' }, applied: true },
      { kind: 'add', value: 5, origin: { label: 'Dropped' }, applied: false }
    ])
    expect(html).toContain('Counted')
    expect(html).not.toContain('Dropped')
  })

  test('renders `display` modifiers (informational, no applied flag) and `add-dice` as a dice term', () => {
    const html = buildModifierBreakdownHtml([
      { kind: 'display', value: 0, origin: { label: 'Armor Check Penalty' } },
      { kind: 'add-dice', dice: '1d3', origin: { label: 'Mighty Deed' }, applied: true }
    ])
    expect(html).toContain('<span class="dcc-modifier-label">Armor Check Penalty</span><span class="dcc-modifier-value">+0</span>')
    expect(html).toContain('<span class="dcc-modifier-label">Mighty Deed</span><span class="dcc-modifier-value">+1d3</span>')
  })

  test('skips die-reshaping kinds (set-die / bump-die / multiply / threat-shift)', () => {
    const html = buildModifierBreakdownHtml([
      { kind: 'set-die', die: 'd24', origin: { label: 'Set Die' } },
      { kind: 'bump-die', steps: 1, origin: { label: 'Bump Die' } },
      { kind: 'multiply', factor: 2, origin: { label: 'Double' } },
      { kind: 'threat-shift', amount: 1, origin: { label: 'Threat' } }
    ])
    // None of those have a flat "+N under the formula" reading.
    expect(html).toBe('')
  })

  test('synthesizes a category:id label when origin.label is absent', () => {
    const html = buildModifierBreakdownHtml([
      { kind: 'add', value: 2, origin: { category: 'luck-burn', id: 'luck' }, applied: true }
    ])
    expect(html).toContain('<span class="dcc-modifier-label">luck-burn: luck</span>')
  })

  test('renders LegacyRollModifier shape (spell results) using label || source', () => {
    const html = buildModifierBreakdownHtml([
      { source: 'strength', value: 1, label: 'Strength' },
      { source: 'caster level', value: 2 }
    ])
    expect(html).toContain('<span class="dcc-modifier-label">Strength</span><span class="dcc-modifier-value">+1</span>')
    expect(html).toContain('<span class="dcc-modifier-label">caster level</span><span class="dcc-modifier-value">+2</span>')
  })

  test('skips rows with a non-finite value rather than rendering +NaN', () => {
    const html = buildModifierBreakdownHtml([
      { source: 'bad', value: 'not-a-number' },
      { source: 'good', value: 4 }
    ])
    expect(html).not.toContain('NaN')
    expect(html).toContain('good')
  })

  test('escapes HTML in labels (item names can carry markup)', () => {
    const html = buildModifierBreakdownHtml([
      { kind: 'add', value: 1, origin: { label: '<b>Sword</b> & "Shield"' }, applied: true }
    ])
    expect(html).toContain('&lt;b&gt;Sword&lt;/b&gt; &amp; &quot;Shield&quot;')
    expect(html).not.toContain('<b>Sword</b>')
  })
})

describe('applyFleetingLuck', () => {
  afterEach(() => {
    delete globalThis.game
  })

  test('calls FleetingLuck.updateFlags with the flags + roll when both are present', () => {
    const updateFlags = vi.fn()
    globalThis.game = { dcc: { FleetingLuck: { updateFlags } } }
    const flags = { 'dcc.RollType': 'AbilityCheck' }
    const roll = { total: 12 }
    applyFleetingLuck(flags, roll)
    expect(updateFlags).toHaveBeenCalledTimes(1)
    expect(updateFlags).toHaveBeenCalledWith(flags, roll)
  })

  test('no-op when foundryRoll is absent (guard matches the pre-extraction inline behavior)', () => {
    const updateFlags = vi.fn()
    globalThis.game = { dcc: { FleetingLuck: { updateFlags } } }
    applyFleetingLuck({ a: 1 }, undefined)
    expect(updateFlags).not.toHaveBeenCalled()
  })

  test('no-op (no throw) when game.dcc.FleetingLuck is unavailable (test-mock-safe guard)', () => {
    globalThis.game = { dcc: {} }
    expect(() => applyFleetingLuck({ a: 1 }, { total: 5 })).not.toThrow()
    // Also safe when game itself has no dcc namespace at all.
    globalThis.game = {}
    expect(() => applyFleetingLuck({ a: 1 }, { total: 5 })).not.toThrow()
  })
})
