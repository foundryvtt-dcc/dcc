/* global CONFIG, foundry, game, Hooks */

/**
 * DCC right-hand sidebar tab (issue #833).
 *
 * Foundry's UI paradigm places map-oriented tools in the left-hand scene
 * controls and data-oriented tools in the right-hand sidebar. The Fleeting
 * Luck and Spell Duel launchers are data-oriented, so they live in a
 * dedicated DCC sidebar tab (branded with the DCC logo) rather than under
 * the token scene controls.
 *
 * The tool list is assembled by `getSidebarTools()`: the core tools are
 * Fleeting Luck (gated on the `dcc.enableFleetingLuck` world setting, which
 * requires a reload to change) and Spell Duel. Modules can contribute their
 * own tools (e.g. XCC's Mojo tracker) via the `dcc.getSidebarTools` hook,
 * which receives the tools record and may add, modify, or remove entries.
 *
 * `registerDCCSidebarTab()` is invoked from the `init` hook
 * (module/init-hook.mjs) — registration must happen before
 * `Game#initializeUI` instantiates `CONFIG.ui.*` during setup.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api
const { AbstractSidebarTab, Sidebar } = foundry.applications.sidebar

/**
 * A sidebar tool descriptor.
 * @typedef {object} DCCSidebarTool
 * @property {string} label    i18n key for the button label
 * @property {string} icon     Font Awesome icon classes for the button
 * @property {Function} onClick  Invoked when the button is clicked
 */

/**
 * Assemble the tools shown in the DCC sidebar tab.
 * @returns {Record<string, DCCSidebarTool>}
 */
export function getSidebarTools () {
  const tools = {}

  // Only offer Fleeting Luck if the setting is enabled
  try {
    if (game.settings.get('dcc', 'enableFleetingLuck')) {
      tools.fleetingLuck = {
        label: 'DCC.FleetingLuck',
        icon: 'fas fa-balance-scale-left',
        onClick: () => game.dcc.FleetingLuck.show()
      }
    }
  } catch (e) {
    console.error('DCC | Error adding Fleeting Luck sidebar tool:', e)
  }

  tools.spellDuel = {
    label: 'DCC.SpellDuel',
    icon: 'fas fa-hat-wizard',
    onClick: () => game.dcc.SpellDuel.show()
  }

  // Let modules (e.g. XCC's Mojo tracker) contribute their own tools
  Hooks.callAll('dcc.getSidebarTools', tools)

  return tools
}

/**
 * The DCC sidebar tab application.
 */
export class DCCSidebarTab extends HandlebarsApplicationMixin(AbstractSidebarTab) {
  /** @override */
  static DEFAULT_OPTIONS = {
    window: {
      title: 'DCC.SidebarTab'
    },
    actions: {
      clickTool: DCCSidebarTab.#onClickTool
    }
  }

  /** @override */
  static tabName = 'dcc'

  /** @override */
  static PARTS = {
    dcc: {
      template: 'systems/dcc/templates/sidebar-dcc.html',
      root: true
    }
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    context.tools = getSidebarTools()
    return context
  }

  /**
   * Dispatch a tool button click to the matching tool's onClick.
   * @this {DCCSidebarTab}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static #onClickTool (event, target) {
    getSidebarTools()[target.dataset.tool]?.onClick?.(event)
  }
}

/**
 * Register the DCC sidebar tab onto the Sidebar. Must run during `init`,
 * before `Game#initializeUI` instantiates the `CONFIG.ui` singletons.
 */
export function registerDCCSidebarTab () {
  CONFIG.ui.dcc = DCCSidebarTab
  Sidebar.TABS.dcc = {
    tooltip: 'DCC.SidebarTab',
    icon: 'dcc-sidebar-icon'
  }
}
