/* global game, Hooks */

export const registerSystemSettings = async function () {
  /**
   * Track the last system version to which the world was migrated
   */
  game.settings.register('dcc', 'systemMigrationVersion', {
    name: 'System Migration Version',
    scope: 'world',
    config: false,
    type: Number,
    default: 0
  })

  /**
   * Gather a list of available compendium packs with RollTables
   */
  const tableCompendiumNames = { '': '-' }
  const tableCompendiums = []
  try {
    game.packs.forEach(function (pack) {
      if (pack.documentName === 'RollTable') {
        tableCompendiums.push(pack)
        tableCompendiumNames[pack.metadata.id] = pack.metadata.label
      }
    })
  } catch (e) { }

  /**
   * Gather a list of available RollTables from compendium packs
   */
  const rollTables = { '': '-' }
  try {
    for (const pack of tableCompendiums) {
      await pack.getIndex()
      pack.index.forEach(function (value, key, map) {
        rollTables[`${pack.metadata.id}.${value.name}`] = pack.metadata.label + ': ' + value.name
      })
    }
  } catch (e) { }

  /**
   * Compendium to look in for crit tables
   */
  game.settings.register('dcc', 'critsCompendium', {
    name: 'DCC.SettingCriticalHitsCompendium',
    hint: 'DCC.SettingCriticalHitsCompendiumHint',
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: tableCompendiumNames,
    onChange: value => {
      Hooks.callAll('dcc.registerCriticalHitsPack', value, true)
    }
  })

  /**
   * Table to use for fumbles
   */
  game.settings.register('dcc', 'fumbleTable', {
    name: 'DCC.SettingFumbleTable',
    hint: 'DCC.SettingFumbleTableHint',
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: rollTables,
    onChange: value => {
      Hooks.callAll('dcc.setFumbleTable', value, true)
    }
  })

  /**
   * Compendium to look in for disapproval tables
   */
  game.settings.register('dcc', 'disapprovalCompendium', {
    name: 'DCC.SettingDisapprovalTablesCompendium',
    hint: 'DCC.SettingDisapprovalTablesCompendiumHint',
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: tableCompendiumNames,
    onChange: value => {
      Hooks.callAll('dcc.registerDisapprovalPack', value, true)
    }
  })

  /**
   * Table to use for turn unholy
   */
  game.settings.register('dcc', 'turnUnholyTable', {
    name: 'DCC.SettingTurnUnholyTable',
    hint: 'DCC.SettingTurnUnholyTableHint',
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: rollTables,
    onChange: value => {
      Hooks.callAll('dcc.setTurnUnholyTable', value, true)
    }
  })

  /**
   * Table to use for lay on hands
   */
  game.settings.register('dcc', 'layOnHandsTable', {
    name: 'DCC.SettingLayOnHandsTable',
    hint: 'DCC.SettingLayOnHandsTableHint',
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: rollTables,
    onChange: value => {
      Hooks.callAll('dcc.setLayOnHandsTable', value, true)
    }
  })

  /**
   * Table to use for divine aid
   */
  game.settings.register('dcc', 'divineAidTable', {
    name: 'DCC.SettingDivineAidTable',
    hint: 'DCC.SettingDivineAidTableHint',
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: rollTables,
    onChange: value => {
      Hooks.callAll('dcc.setDivineAidTable', value, true)
    }
  })

  /**
   * Table to use for mercurial magic
   */
  game.settings.register('dcc', 'mercurialMagicTable', {
    name: 'DCC.SettingMercurialMagicTable',
    hint: 'DCC.SettingMercurialMagicTableHint',
    scope: 'world',
    config: true,
    default: '',
    type: String,
    choices: rollTables,
    onChange: value => {
      Hooks.callAll('dcc.setMercurialMagicTable', value, true)
    }
  })

  /**
   * Prompt for item deletion
   */
  game.settings.register('dcc', 'promptForItemDeletion', {
    name: 'DCC.SettingDeleteItem',
    hint: 'DCC.SettingDeleteItemHint',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true
  })

  /**
   * Roll attacks with standard dice roller
   */
  game.settings.register('dcc', 'useStandardDiceRoller', {
    name: 'DCC.SettingStandardDiceRoller',
    hint: 'DCC.SettingStandardDiceRollerHint',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })

  /**
   * Enable automation of Cleric Disapproval
   */
  game.settings.register('dcc', 'automateClericDisapproval', {
    name: 'DCC.SettingAutomateClericDisapproval',
    hint: 'DCC.SettingAutomateClericDisapprovalHint',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })

  /**
   * Enable automation of Wizard/Elf spell loss
   */
  game.settings.register('dcc', 'automateWizardSpellLoss', {
    name: 'DCC.SettingAutomateWizardSpellLoss',
    hint: 'DCC.SettingAutomateWizardSpellLossHint',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })

  /**
   * Allow showing the Roll Modifier dialog by default
   */
  game.settings.register('dcc', 'showRollModifierByDefault', {
    name: 'DCC.SettingShowRollModifierByDefault',
    hint: 'DCC.SettingShowRollModifierByDefaultHint',
    scope: 'client',
    type: Boolean,
    default: false,
    config: true
  })

  /**
   * Enable Fleeting Luck
   */
  game.settings.register('dcc', 'enableFleetingLuck', {
    name: 'DCC.SettingEnableFleetingLuck',
    hint: 'DCC.SettingEnableFleetingLuckHint',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })

  /**
   * Automatically track Fleeting Luck
   */
  game.settings.register('dcc', 'automateFleetingLuck', {
    name: 'DCC.SettingAutomateFleetingLuck',
    hint: 'DCC.SettingAutomateFleetingLuckHint',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true
  })
}
