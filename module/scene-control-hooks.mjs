/* global game, Hooks */

/**
 * Scene-control-button hook extracted from `module/dcc.js`.
 *
 * Adds the DCC token-layer scene-control tools: the Fleeting Luck button
 * (gated on the `dcc.enableFleetingLuck` world setting — registered early in
 * the `init` hook because `getSceneControlButtons` fires before `ready`) and
 * the always-present Spell Duel button.
 *
 * The handler is exported as a plain function so the unit tests can invoke it
 * against a stubbed `controls` object; `registerSceneControlHooks()` wires it
 * onto `Hooks.on('getSceneControlButtons', …)`. Mirrors the
 * `module/init-hook.mjs` / `module/ready-hook.mjs` extraction pattern.
 */

/**
 * Populate `controls.tokens.tools` with the DCC scene-control buttons.
 */
export function onGetSceneControlButtons (controls) {
  // Only add Fleeting Luck button if the setting is enabled
  try {
    if (game.settings.get('dcc', 'enableFleetingLuck')) {
      controls.tokens.tools.fleetingLuck = {
        name: 'fleetingLuck',
        title: 'DCC.FleetingLuck',
        icon: 'fas fa-balance-scale-left',
        onChange: (event, active) => {
          game.dcc.FleetingLuck.show()
        },
        button: true,
        active: true
      }
    }
  } catch (e) {
    console.error('DCC | Error adding Fleeting Luck button:', e)
  }

  controls.tokens.tools.spellDuel = {
    name: 'spellDuel',
    title: 'DCC.SpellDuel',
    icon: 'fas fa-hat-wizard',
    onChange: (event, active) => {
      game.dcc.SpellDuel.show()
    },
    button: true,
    active: true
  }
}

/**
 * Production entry-point invoked from `module/dcc.js` in place of the inline
 * `Hooks.on('getSceneControlButtons', …)` block.
 */
export function registerSceneControlHooks () {
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons)
}
