/* global game, Hooks */

export const pubConstants = {
  name: 'dcc',
  dccLogoPath: 'systems/dcc/styles/images/dcc-rpg-logo-red.webp',
  langRoot: 'DCC',
  templates: 'systems/dcc/templates/',
  title: 'DCC'
}

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
   * Automatic or Manual Table Configuration
   */
  game.settings.register('dcc', 'manualCompendiumConfiguration', {
    name: 'DCC.SettingManualCompendiumConfiguration',
    hint: 'DCC.SettingManualCompendiumConfigurationHint',
    scope: 'world',
    config: true,
    requiresReload: true,
    type: Boolean,
    default: false
  })

  const manualConfig = game.settings.get('dcc', 'manualCompendiumConfiguration')

  /**
   * Gather a list of available compendium packs with RollTables
   */
  const tableCompendiumNames = { '': 'Automatic' }
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
  const rollTables = { '': 'Automatic' }
  try {
    for (const pack of tableCompendiums) {
      pack.index.forEach(function (value) {
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
    config: manualConfig,
    default: '',
    type: String,
    choices: tableCompendiumNames,
    onChange: value => {
      Hooks.callAll('dcc.registerCriticalHitsPack', value, true)
    }
  })

  /**
   * Compendium to look in for magic side effect tables
   */
  game.settings.register('dcc', 'spellSideEffectsCompendium', {
    name: 'DCC.SettingSpellSideEffectsCompendium',
    hint: 'DCC.SettingSpellSideEffectsCompendiumHint',
    scope: 'world',
    config: manualConfig,
    default: '',
    type: String,
    choices: tableCompendiumNames,
    onChange: value => {
      Hooks.callAll('dcc.registerSpellSideEffectsPack', value, true)
    }
  })

  /**
   * Table to use for fumbles
   */
  game.settings.register('dcc', 'fumbleTable', {
    name: 'DCC.SettingFumbleTable',
    hint: 'DCC.SettingFumbleTableHint',
    scope: 'world',
    config: manualConfig,
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
    config: manualConfig,
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
    config: manualConfig,
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
    config: manualConfig,
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
    config: manualConfig,
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
    config: manualConfig,
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
   * Convert roll cards in the chat to narrative emotes rather than data-style cards
   */
  game.settings.register('dcc', 'emoteRolls', {
    name: 'DCC.SettingEmoteRolls',
    hint: 'DCC.SettingEmoteRollsHint',
    scope: 'client',
    type: Boolean,
    default: true,
    config: true
  })

  /**
   * Automatically roll damage, fumbles, and crits for attacks
   */
  game.settings.register('dcc', 'automateDamageFumblesCrits', {
    name: 'DCC.SettingAutomateDamageFumblesCrits',
    hint: 'DCC.SettingAutomateDamageFumblesCritsHint',
    scope: 'client',
    type: Boolean,
    default: true,
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
    requiresReload: true,
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
    requiresReload: true,
    scope: 'world',
    type: Boolean,
    default: true,
    config: true
  })

  /**
   * Check weapon is equipped if not UI warning display appears and prevent rolls
   */
  game.settings.register('dcc', 'checkWeaponEquipment', {
    name: 'DCC.SettingWeaponEquipmentCheck',
    hint: 'DCC.SettingWeaponEquipmentCheckHint',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })

  /**
   * Disable icon filter in dark theme
   */
  game.settings.register('dcc', 'disableDarkThemeIconFilter', {
    name: 'DCC.SettingDisableDarkThemeIconFilter',
    hint: 'DCC.SettingDisableDarkThemeIconFilterHint',
    scope: 'client',
    type: Boolean,
    default: false,
    config: true,
    requiresReload: true
  })

  /**
   * Chat cards use app theme instead of UI theme
   */
  game.settings.register('dcc', 'chatCardsUseAppTheme', {
    name: 'DCC.SettingChatCardsUseAppTheme',
    hint: 'DCC.SettingChatCardsUseAppThemeHint',
    scope: 'client',
    type: Boolean,
    default: true,
    config: true,
    requiresReload: true
  })

  /**
   * Enable strict critical hit rules (proportional crit range for different die sizes)
   */
  game.settings.register('dcc', 'strictCriticalHits', {
    name: 'DCC.SettingStrictCriticalHits',
    hint: 'DCC.SettingStrictCriticalHitsHint',
    scope: 'world',
    type: Boolean,
    default: false,
    config: true
  })

  /**
   * Last used Importer Type
   */
  game.settings.register('dcc', 'lastImporterType', {
    scope: 'world',
    type: String,
    default: 'NPC',
    config: false
  })

  /**
   * Last used Importer Folder ID
   */
  game.settings.register('dcc', 'lastImporterFolderId', {
    scope: 'world',
    type: String,
    default: '',
    config: false
  })

  // Show Welcome Dialog
  game.settings.register(pubConstants.name, 'showWelcomeDialog', {
    name: `${pubConstants.langRoot}.Settings.ShowWelcomeDialog`,
    hint: `${pubConstants.langRoot}.Settings.ShowWelcomeDialogHint`,
    scope: 'world',
    config: true,
    default: true,
    type: Boolean
  })
}
