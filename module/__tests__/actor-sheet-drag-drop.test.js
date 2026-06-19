/**
 * Unit tests for the actor-sheet drag-start data builder.
 *
 * `findDataset` + `buildDragStartData` were extracted from
 * `module/actor-sheet.js`'s `_onDragStart` (Phase 7 Appendix-A shrinkage). Both
 * are pure — they read only a DOM event and the actor — so they are exercised
 * here directly, with no Foundry mock and no live sheet. The original method was
 * a `#`/override with no prior unit coverage (drag is e2e-hard).
 */

import { describe, expect, test, vi } from 'vitest'
import { findDataset, buildDragStartData } from '../actor-sheet/drag-drop.mjs'

/** Build a fake DOM element chain so `findDataset` can walk `parentElement`. */
function el (dataset = {}, parent = null) {
  return { dataset, parentElement: parent }
}

/** Build a fake dragstart event. */
function makeEvent ({ dataset = {}, classes = [], forAttr = null } = {}) {
  const currentTarget = el(dataset)
  return {
    currentTarget,
    target: {
      classList: { contains: (c) => classes.includes(c) },
      getAttribute: (name) => (name === 'for' ? forAttr : null)
    }
  }
}

/** Build a fake actor with just the fields the builder reads. */
function makeActor (overrides = {}) {
  return {
    id: 'actor-1',
    isToken: false,
    effects: new Map(),
    items: new Map(),
    system: {
      attributes: {
        hitDice: { value: '2d6' },
        actionDice: { value: '1d24' }
      },
      class: { luckDie: '1d3' },
      details: { attackBonus: '+3' },
      skills: { sneakSilently: { label: 'Sneak Silently' } }
    },
    ...overrides
  }
}

describe('findDataset', () => {
  test('returns the value when present on the starting element', () => {
    expect(findDataset(el({ itemId: 'abc' }), 'itemId')).toBe('abc')
  })

  test('walks up to a parent element', () => {
    const parent = el({ itemId: 'parent-id' })
    const child = el({ other: 'x' }, parent)
    expect(findDataset(child, 'itemId')).toBe('parent-id')
  })

  test('returns null when no ancestor has the attribute', () => {
    const parent = el({ foo: 'bar' })
    const child = el({ baz: 'qux' }, parent)
    expect(findDataset(child, 'itemId')).toBeNull()
  })

  test('returns null for a null starting element', () => {
    expect(findDataset(null, 'itemId')).toBeNull()
  })
})

describe('buildDragStartData', () => {
  test('returns null for a non-draggable element', () => {
    const event = makeEvent({ dataset: { dragAction: 'ability' } })
    expect(buildDragStartData(makeActor(), event)).toBeNull()
  })

  test('returns null for an unknown drag action', () => {
    const event = makeEvent({ dataset: { drag: 'true', dragAction: 'nope' } })
    expect(buildDragStartData(makeActor(), event)).toBeNull()
  })

  describe('ActiveEffect drags', () => {
    test('resolves the effect off the actor (no tokenId)', () => {
      const actor = makeActor()
      actor.effects.set('eff-1', {
        uuid: 'Actor.actor-1.ActiveEffect.eff-1',
        toObject: () => ({ _id: 'eff-1', name: 'Blessing' })
      })
      const event = makeEvent({ dataset: { drag: 'true', dragType: 'ActiveEffect', effectId: 'eff-1' } })
      expect(buildDragStartData(actor, event)).toEqual({
        type: 'ActiveEffect',
        uuid: 'Actor.actor-1.ActiveEffect.eff-1',
        data: { _id: 'eff-1', name: 'Blessing' }
      })
    })

    test('returns null when the effect is gone', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragType: 'ActiveEffect', effectId: 'missing' } })
      expect(buildDragStartData(makeActor(), event)).toBeNull()
    })
  })

  describe('ability', () => {
    test('plain ability is not roll-under', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'ability', ability: 'str' } })
      expect(buildDragStartData(makeActor(), event)).toEqual({
        type: 'Ability',
        actorId: 'actor-1',
        data: { abilityId: 'str', rollUnder: false }
      })
    })

    test('luck via the luck-roll-under class is roll-under', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'ability', ability: 'lck' }, classes: ['luck-roll-under'] })
      const data = buildDragStartData(makeActor(), event)
      expect(data.data.rollUnder).toBe(true)
    })

    test('luck via the value label is roll-under', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'ability', ability: 'lck' }, forAttr: 'system.abilities.lck.value' })
      const data = buildDragStartData(makeActor(), event)
      expect(data.data.rollUnder).toBe(true)
    })
  })

  test('initiative', () => {
    const event = makeEvent({ dataset: { drag: 'true', dragAction: 'initiative' } })
    expect(buildDragStartData(makeActor(), event)).toEqual({ type: 'Initiative', actorId: 'actor-1', data: {} })
  })

  test('hitDice reads the actor hit dice', () => {
    const event = makeEvent({ dataset: { drag: 'true', dragAction: 'hitDice' } })
    expect(buildDragStartData(makeActor(), event)).toEqual({ type: 'Hit Dice', actorId: 'actor-1', data: { dice: '2d6' } })
  })

  test('save carries the saveId as data', () => {
    const event = makeEvent({ dataset: { drag: 'true', dragAction: 'save', save: 'ref' } })
    expect(buildDragStartData(makeActor(), event)).toEqual({ type: 'Save', actorId: 'actor-1', data: 'ref' })
  })

  describe('skill', () => {
    test('uses the actor skill label when present', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'skill', skill: 'sneakSilently' } })
      expect(buildDragStartData(makeActor(), event)).toEqual({
        type: 'Skill',
        actorId: 'actor-1',
        data: { skillId: 'sneakSilently', skillName: 'Sneak Silently' }
      })
    })

    test('falls back to the skillId when the skill is unknown', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'skill', skill: 'mystery' } })
      expect(buildDragStartData(makeActor(), event).data).toEqual({ skillId: 'mystery', skillName: 'mystery' })
    })
  })

  test('luckDie reads the class luck die', () => {
    const event = makeEvent({ dataset: { drag: 'true', dragAction: 'luckDie' } })
    expect(buildDragStartData(makeActor(), event)).toEqual({ type: 'Luck Die', actorId: 'actor-1', data: { die: '1d3' } })
  })

  describe('spellCheck', () => {
    test('includes item details when itemId resolves', () => {
      const actor = makeActor()
      actor.items.set('spell-1', { name: 'Magic Missile', img: 'icons/mm.webp' })
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'spellCheck', ability: 'int', itemId: 'spell-1' } })
      expect(buildDragStartData(actor, event)).toEqual({
        type: 'Spell Check',
        actorId: 'actor-1',
        data: { ability: 'int', itemId: 'spell-1', name: 'Magic Missile', img: 'icons/mm.webp' }
      })
    })

    test('falls back to the spell name attribute when there is no itemId', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'spellCheck', ability: 'int', spell: 'Cantrip' } })
      expect(buildDragStartData(makeActor(), event).data).toEqual({ ability: 'int', name: 'Cantrip' })
    })
  })

  test('attackBonus reads the details attack bonus', () => {
    const event = makeEvent({ dataset: { drag: 'true', dragAction: 'attackBonus' } })
    expect(buildDragStartData(makeActor(), event)).toEqual({ type: 'Attack Bonus', actorId: 'actor-1', data: { die: '+3' } })
  })

  describe('actionDice', () => {
    test('reads the configured action die', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'actionDice' } })
      expect(buildDragStartData(makeActor(), event)).toEqual({ type: 'Action Dice', actorId: 'actor-1', data: { die: '1d24' } })
    })

    test('defaults to 1d20 when unset', () => {
      const actor = makeActor()
      actor.system.attributes.actionDice.value = ''
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'actionDice' } })
      expect(buildDragStartData(actor, event).data.die).toBe('1d20')
    })
  })

  test('disapprovalRange / disapprovalTable produce their payloads', () => {
    const rangeEvent = makeEvent({ dataset: { drag: 'true', dragAction: 'disapprovalRange' } })
    expect(buildDragStartData(makeActor(), rangeEvent)).toEqual({ type: 'Apply Disapproval', actorId: 'actor-1', data: {} })
    const tableEvent = makeEvent({ dataset: { drag: 'true', dragAction: 'disapprovalTable' } })
    expect(buildDragStartData(makeActor(), tableEvent)).toEqual({ type: 'Roll Disapproval', actorId: 'actor-1', data: {} })
  })

  describe('weapon', () => {
    test('merges toDragData with dcc weapon metadata + backstab flag', () => {
      const actor = makeActor()
      const weapon = { name: 'Dagger', toDragData: vi.fn(() => ({ type: 'Item', uuid: 'Item.weapon-1' })) }
      actor.items.set('weapon-1', weapon)
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'weapon', itemId: 'weapon-1' }, classes: ['backstab-button'] })
      const data = buildDragStartData(actor, event)
      expect(weapon.toDragData).toHaveBeenCalled()
      expect(data).toMatchObject({
        type: 'Item',
        uuid: 'Item.weapon-1',
        dccType: 'Weapon',
        actorId: 'actor-1',
        data: weapon,
        dccData: { weapon, backstab: true }
      })
    })

    test('returns null when the weapon is missing', () => {
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'weapon', itemId: 'gone' } })
      expect(buildDragStartData(makeActor(), event)).toBeNull()
    })
  })

  describe('item', () => {
    test('uses the Item type for non-spell items', () => {
      const actor = makeActor()
      const item = { type: 'armor', uuid: 'Item.armor-1' }
      actor.items.set('armor-1', item)
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'item', itemId: 'armor-1' } })
      expect(buildDragStartData(actor, event)).toEqual({
        type: 'Item',
        actorId: 'actor-1',
        uuid: 'Item.armor-1',
        data: item,
        system: { item }
      })
    })

    test('uses the DCC Item type for spell items', () => {
      const actor = makeActor()
      const item = { type: 'spell', uuid: 'Item.spell-2' }
      actor.items.set('spell-2', item)
      const event = makeEvent({ dataset: { drag: 'true', dragAction: 'item', itemId: 'spell-2' } })
      expect(buildDragStartData(actor, event).type).toBe('DCC Item')
    })
  })

  test('appends tokenId for synthetic (token) actors', () => {
    const actor = makeActor({ isToken: true, token: { id: 'token-9' } })
    const event = makeEvent({ dataset: { drag: 'true', dragAction: 'initiative' } })
    expect(buildDragStartData(actor, event).tokenId).toBe('token-9')
  })
})
