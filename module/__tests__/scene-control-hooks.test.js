/**
 * Unit coverage for the scene-control-button hook extracted from
 * `module/dcc.js`. The handler is a pure mutator over a `controls` object;
 * the assertions stub `game` / `Hooks` per-test so it can be invoked as a
 * plain function without a live Foundry boot.
 *
 * Mirrors the pattern in `init-hook.test.js` / `ready-hook.test.js`.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { onGetSceneControlButtons, registerSceneControlHooks } from '../scene-control-hooks.mjs'

let original

function makeControls () {
  return { tokens: { tools: {} } }
}

beforeEach(() => {
  original = { game: globalThis.game, Hooks: globalThis.Hooks, error: console.error }
  globalThis.game = {
    settings: { get: vi.fn().mockReturnValue(false) },
    dcc: { FleetingLuck: { show: vi.fn() }, SpellDuel: { show: vi.fn() } }
  }
  globalThis.Hooks = { on: vi.fn() }
  console.error = vi.fn()
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.Hooks = original.Hooks
  console.error = original.error
})

describe('onGetSceneControlButtons', () => {
  test('always adds the Spell Duel button', () => {
    const controls = makeControls()
    onGetSceneControlButtons(controls)
    expect(controls.tokens.tools.spellDuel).toMatchObject({ name: 'spellDuel', title: 'DCC.SpellDuel', button: true })
  })

  test('adds the Fleeting Luck button when the setting is enabled', () => {
    globalThis.game.settings.get.mockImplementation((scope, key) => key === 'enableFleetingLuck')
    const controls = makeControls()
    onGetSceneControlButtons(controls)
    expect(controls.tokens.tools.fleetingLuck).toMatchObject({ name: 'fleetingLuck', title: 'DCC.FleetingLuck', button: true })
  })

  test('omits the Fleeting Luck button when the setting is disabled', () => {
    globalThis.game.settings.get.mockReturnValue(false)
    const controls = makeControls()
    onGetSceneControlButtons(controls)
    expect(controls.tokens.tools.fleetingLuck).toBeUndefined()
    // Spell Duel is still added regardless of the Fleeting Luck setting.
    expect(controls.tokens.tools.spellDuel).toBeDefined()
  })

  test('the Fleeting Luck onChange delegates to game.dcc.FleetingLuck.show()', () => {
    globalThis.game.settings.get.mockReturnValue(true)
    const controls = makeControls()
    onGetSceneControlButtons(controls)
    controls.tokens.tools.fleetingLuck.onChange({}, true)
    expect(globalThis.game.dcc.FleetingLuck.show).toHaveBeenCalledTimes(1)
  })

  test('the Spell Duel onChange delegates to game.dcc.SpellDuel.show()', () => {
    const controls = makeControls()
    onGetSceneControlButtons(controls)
    controls.tokens.tools.spellDuel.onChange({}, true)
    expect(globalThis.game.dcc.SpellDuel.show).toHaveBeenCalledTimes(1)
  })

  test('swallows a Fleeting Luck setting-read failure and still adds Spell Duel', () => {
    globalThis.game.settings.get.mockImplementation(() => { throw new Error('settings not ready') })
    const controls = makeControls()
    expect(() => onGetSceneControlButtons(controls)).not.toThrow()
    expect(console.error).toHaveBeenCalled()
    expect(controls.tokens.tools.fleetingLuck).toBeUndefined()
    expect(controls.tokens.tools.spellDuel).toBeDefined()
  })
})

describe('registerSceneControlHooks', () => {
  test('wires onGetSceneControlButtons onto Hooks.on(\'getSceneControlButtons\')', () => {
    registerSceneControlHooks()
    expect(globalThis.Hooks.on).toHaveBeenCalledTimes(1)
    expect(globalThis.Hooks.on).toHaveBeenCalledWith('getSceneControlButtons', onGetSceneControlButtons)
  })
})
