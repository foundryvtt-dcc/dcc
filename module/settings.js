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
      if (pack.metadata.entity === 'RollTable') {
        tableCompendiums.push(pack)
        tableCompendiumNames[pack.metadata.package + '.' + pack.metadata.name] = pack.metadata.label
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
        rollTables[pack.metadata.package + '.' + pack.metadata.name + '.' + value.name] = pack.metadata.label + ': ' + value.name
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
   * Macro Shorthand setting
   */
  game.settings.register('dcc', 'macroShorthand', {
    name: 'Shortened Macro Syntax',
    hint: 'Enable a shortened macro syntax which allows referencing attributes directly, for example @str instead of @attributes.str.value. Disable this setting if you need the ability to reference the full attribute model, for example @attributes.str.label.',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true
  })
}
