/* global game */

/**
 * DCC Control Sets
 */
class DCCControls {
  static register () {
    Hooks.on('getSceneControlButtons', DCCControls._getSceneControlButtons)
  }

  static _getSceneControlButtons (controls) {
    if (!game.user.isGM) return;

    const tokenTools = controls.find(t => t.name == 'token')
    if (tokenTools) {
      tokenTools.tools.push({
        name: 'fleetingluck',
        title: game.i18n.localize('DCC.FleetingLuck'),
        icon: 'fas fa-crow',
        onClick: () => {
          game.dcc.FleetingLuck.show()
        },
        active: game.dcc.FleetingLuck?.visible,
        toggle: true
      })
    }
  }
}

export default DCCControls
