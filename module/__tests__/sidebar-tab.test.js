/**
 * Unit coverage for the DCC right-hand sidebar tab (issue #833), which
 * replaced the Fleeting Luck / Spell Duel token-layer scene-control buttons.
 * `getSidebarTools()` is a pure assembler over `game` / `Hooks`, so the
 * assertions stub those per-test and invoke it as a plain function; the tab
 * class and registration are exercised against the mocked Foundry sidebar
 * namespace.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '../__mocks__/foundry.js'
import { DCCSidebarTab, getSidebarTools, registerDCCSidebarTab } from '../sidebar-tab.mjs'

let original

beforeEach(() => {
  original = { game: globalThis.game, Hooks: globalThis.Hooks, error: console.error }
  globalThis.game = {
    settings: { get: vi.fn().mockReturnValue(false) },
    dcc: { FleetingLuck: { show: vi.fn() }, SpellDuel: { show: vi.fn() } },
    user: { isGM: false }
  }
  globalThis.Hooks = { callAll: vi.fn() }
  console.error = vi.fn()
})

afterEach(() => {
  globalThis.game = original.game
  globalThis.Hooks = original.Hooks
  console.error = original.error
  delete globalThis.CONFIG.ui.dcc
  delete globalThis.foundry.applications.sidebar.Sidebar.TABS.dcc
})

describe('getSidebarTools', () => {
  test('always includes the Spell Duel tool', () => {
    const tools = getSidebarTools()
    expect(tools.spellDuel).toMatchObject({ label: 'DCC.SpellDuel', icon: 'fas fa-hat-wizard' })
  })

  test('includes the Fleeting Luck tool when the setting is enabled', () => {
    globalThis.game.settings.get.mockImplementation((scope, key) => key === 'enableFleetingLuck')
    const tools = getSidebarTools()
    expect(tools.fleetingLuck).toMatchObject({ label: 'DCC.FleetingLuck', icon: 'fas fa-balance-scale-left' })
  })

  test('omits the Fleeting Luck tool when the setting is disabled', () => {
    const tools = getSidebarTools()
    expect(tools.fleetingLuck).toBeUndefined()
    // Spell Duel is still added regardless of the Fleeting Luck setting.
    expect(tools.spellDuel).toBeDefined()
  })

  test('the Fleeting Luck onClick delegates to game.dcc.FleetingLuck.show()', () => {
    globalThis.game.settings.get.mockReturnValue(true)
    getSidebarTools().fleetingLuck.onClick({})
    expect(globalThis.game.dcc.FleetingLuck.show).toHaveBeenCalledTimes(1)
  })

  test('the Spell Duel onClick delegates to game.dcc.SpellDuel.show()', () => {
    getSidebarTools().spellDuel.onClick({})
    expect(globalThis.game.dcc.SpellDuel.show).toHaveBeenCalledTimes(1)
  })

  test('includes the Request Roll tool for GMs only (issue #855)', () => {
    expect(getSidebarTools().requestRoll).toBeUndefined()
    globalThis.game.user.isGM = true
    expect(getSidebarTools().requestRoll).toMatchObject({
      label: 'DCC.RequestRoll',
      icon: 'fas fa-dice-d20'
    })
  })

  test('swallows a Fleeting Luck setting-read failure and still adds Spell Duel', () => {
    globalThis.game.settings.get.mockImplementation(() => { throw new Error('settings not ready') })
    let tools
    expect(() => { tools = getSidebarTools() }).not.toThrow()
    expect(console.error).toHaveBeenCalled()
    expect(tools.fleetingLuck).toBeUndefined()
    expect(tools.spellDuel).toBeDefined()
  })

  test('broadcasts dcc.getSidebarTools so modules can contribute tools', () => {
    globalThis.Hooks.callAll.mockImplementation((hook, tools) => {
      tools.mojo = { label: 'XCC.Mojo', icon: 'fas fa-fire', onClick: vi.fn() }
    })
    const tools = getSidebarTools()
    expect(globalThis.Hooks.callAll).toHaveBeenCalledWith('dcc.getSidebarTools', tools)
    expect(tools.mojo).toBeDefined()
  })
})

describe('DCCSidebarTab', () => {
  test('is named "dcc" and renders the sidebar-dcc template as its root part', () => {
    expect(DCCSidebarTab.tabName).toBe('dcc')
    expect(DCCSidebarTab.PARTS.dcc).toMatchObject({ template: 'systems/dcc/templates/sidebar-dcc.html', root: true })
  })

  test('_prepareContext exposes the assembled tools to the template', async () => {
    globalThis.game.settings.get.mockReturnValue(true)
    const tab = new DCCSidebarTab()
    const context = await tab._prepareContext({})
    expect(Object.keys(context.tools)).toEqual(['fleetingLuck', 'spellDuel'])
  })

  test('the clickTool action dispatches to the tools assembled at render', async () => {
    globalThis.game.settings.get.mockReturnValue(true)
    const handler = DCCSidebarTab.DEFAULT_OPTIONS.actions.clickTool
    const tab = new DCCSidebarTab()
    await tab._prepareContext({})
    handler.call(tab, {}, { dataset: { tool: 'spellDuel' } })
    expect(globalThis.game.dcc.SpellDuel.show).toHaveBeenCalledTimes(1)
    // An unknown tool is a no-op rather than a throw.
    expect(() => handler.call(tab, {}, { dataset: { tool: 'nope' } })).not.toThrow()
    // A click before any render (no assembled tools) is also a no-op.
    expect(() => handler.call(new DCCSidebarTab(), {}, { dataset: { tool: 'spellDuel' } })).not.toThrow()
    expect(globalThis.game.dcc.SpellDuel.show).toHaveBeenCalledTimes(1)
  })

  test('a click does not re-fire the dcc.getSidebarTools hook', async () => {
    const handler = DCCSidebarTab.DEFAULT_OPTIONS.actions.clickTool
    const tab = new DCCSidebarTab()
    await tab._prepareContext({})
    const callsAfterRender = globalThis.Hooks.callAll.mock.calls.length
    handler.call(tab, {}, { dataset: { tool: 'spellDuel' } })
    expect(globalThis.Hooks.callAll.mock.calls.length).toBe(callsAfterRender)
  })
})

describe('registerDCCSidebarTab', () => {
  test('registers the tab class on CONFIG.ui and its descriptor on Sidebar.TABS', () => {
    registerDCCSidebarTab()
    expect(globalThis.CONFIG.ui.dcc).toBe(DCCSidebarTab)
    expect(globalThis.foundry.applications.sidebar.Sidebar.TABS.dcc).toEqual({
      tooltip: 'DCC.SidebarTab',
      icon: 'dcc-sidebar-icon'
    })
  })
})
