/* global game */

export const registerSystemSettings = function () {
  /**
   * Track the last system version to which the world was migrated
   */
  game.settings.register('dcc', 'systemMigrationVersion', {
    name: 'System Migration Version',
    scope: 'world',
    config: true,
    type: Number,
    default: 0
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
