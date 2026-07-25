/* global foundry, game */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * Generic settings submenu application for the DCC system.
 *
 * Renders groups of registered `dcc` settings as fieldsets (mirroring how
 * core's own settings menus like "Configure UI" present theirs) and saves
 * any changed values on submit. Subclasses declare which settings they
 * present via the static GROUPS and TOGGLES members.
 */
class DCCSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Fieldset groups of registered settings to present.
   * @type {Array<{legend: string, settings: string[]}>} legend is an i18n key;
   *   settings are keys registered under the `dcc` namespace
   */
  static GROUPS = []

  /**
   * Dependent settings that are disabled while their master Boolean setting
   * is unchecked, keyed by the master setting's key.
   * @type {Object<string, string[]>}
   */
  static TOGGLES = {}

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'dcc-settings-menu'],
    tag: 'form',
    position: {
      width: 560,
      height: 'auto'
    },
    window: {
      contentClasses: ['standard-form'],
      resizable: true
    },
    form: {
      handler: DCCSettingsMenu.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    body: {
      template: 'systems/dcc/templates/dialog-settings-menu.html',
      scrollable: ['']
    },
    footer: {
      template: 'templates/generic/form-footer.hbs'
    }
  }

  /**
   * Can the current user edit a registered setting?
   * World-scoped settings require the SETTINGS_MODIFY permission.
   * @param {object} setting - Registered setting data
   * @returns {boolean}
   */
  static canEditSetting (setting) {
    return setting.scope !== 'world' || game.user.can('SETTINGS_MODIFY')
  }

  /**
   * Build a DataField used to render a registered setting, mirroring how
   * core's SettingsConfig derives fields from setting registration data.
   * @param {object} setting - Registered setting data
   * @returns {foundry.data.fields.DataField}
   */
  static buildSettingField (setting) {
    const fields = foundry.data.fields
    let field
    if (setting.type instanceof fields.DataField) {
      field = setting.type
    } else if (setting.type === Boolean) {
      field = new fields.BooleanField({ initial: setting.default ?? false })
    } else if (setting.type === Number) {
      const { min, max, step } = setting.range ?? {}
      field = new fields.NumberField({
        required: true,
        choices: setting.choices,
        initial: setting.default,
        min,
        max,
        step
      })
    } else {
      field = new fields.StringField({ required: true, choices: setting.choices })
    }
    field.name = setting.key
    field.label ||= game.i18n.localize(setting.name ?? '')
    field.hint ||= game.i18n.localize(setting.hint ?? '')
    return field
  }

  /** @inheritDoc */
  async _prepareContext (options) {
    const context = await super._prepareContext(options)
    context.rootId = this.id
    context.groups = this.constructor.GROUPS.map(group => ({
      legend: game.i18n.localize(group.legend),
      entries: group.settings.map(key => {
        const setting = game.settings.settings.get(`dcc.${key}`)
        return {
          field: this.constructor.buildSettingField(setting),
          value: game.settings.get('dcc', key),
          disabled: !this.constructor.canEditSetting(setting)
        }
      })
    }))
    context.buttons = [
      { type: 'submit', icon: 'fa-solid fa-floppy-disk', label: 'SETTINGS.Save' }
    ]
    return context
  }

  /** @inheritDoc */
  async _onRender (context, options) {
    await super._onRender(context, options)
    for (const [master, dependents] of Object.entries(this.constructor.TOGGLES)) {
      const masterInput = this.element.querySelector(`[name="${master}"]`)
      if (!masterInput) continue
      const applyToggles = () => {
        for (const key of dependents) {
          const input = this.element.querySelector(`[name="${key}"]`)
          if (!input) continue
          const setting = game.settings.settings.get(`dcc.${key}`)
          input.disabled = !masterInput.checked || !this.constructor.canEditSetting(setting)
        }
      }
      masterInput.addEventListener('change', applyToggles)
      applyToggles()
    }
  }

  /**
   * Save changed settings, prompting for a reload if any changed setting
   * requires one (world reload if a world-scoped setting changed).
   * @this {DCCSettingsMenu}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   */
  static async #onSubmit (event, form, formData) {
    let requiresClientReload = false
    let requiresWorldReload = false
    for (const group of this.constructor.GROUPS) {
      for (const key of group.settings) {
        if (!(key in formData.object)) continue
        const setting = game.settings.settings.get(`dcc.${key}`)
        if (!DCCSettingsMenu.canEditSetting(setting)) continue
        const value = formData.object[key]
        if (value === game.settings.get('dcc', key)) continue
        await game.settings.set('dcc', key, value)
        if (setting.requiresReload) {
          if (setting.scope === 'world') requiresWorldReload = true
          else requiresClientReload = true
        }
      }
    }
    if (requiresClientReload || requiresWorldReload) {
      await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: requiresWorldReload })
    }
  }
}

/**
 * Enhanced combat: the redesigned attack cards and the combat automation
 * options imported from the DCC Quality of Life module.
 */
class DCCEnhancedCombatSettings extends DCCSettingsMenu {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'dcc-enhanced-combat-settings',
    window: {
      title: 'DCC.SettingsMenuEnhancedCombat',
      icon: 'fa-solid fa-swords'
    }
  }

  /** @inheritDoc */
  static GROUPS = [
    {
      legend: 'DCC.SettingsMenuGroupAttackCards',
      settings: [
        'enhancedAttackCards',
        'attackCardFormat',
        'showHitMissOnCard'
      ]
    },
    {
      legend: 'DCC.SettingsMenuGroupCombatAutomation',
      settings: [
        'automateDamageFumblesCrits',
        'checkWeaponEquipment',
        'checkWeaponRange',
        'firingIntoMeleePenalty',
        'automateFriendlyFire',
        'playerLuckVsMonsterCrits',
        'monsterFumbles',
        'autoApplyDamage',
        'autoApplyDeadStatus'
      ]
    }
  ]

  /** @inheritDoc */
  static TOGGLES = {
    enhancedAttackCards: ['attackCardFormat', 'showHitMissOnCard']
  }
}

/**
 * Lookup tables and compendiums: manual compendium configuration and the
 * crit/fumble/disapproval/deed/spell table pickers it governs.
 */
class DCCTableSettings extends DCCSettingsMenu {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'dcc-table-settings',
    window: {
      title: 'DCC.SettingsMenuTables',
      icon: 'fa-solid fa-table-list'
    }
  }

  /** @inheritDoc */
  static GROUPS = [
    {
      legend: 'DCC.SettingsMenuGroupTableConfiguration',
      settings: ['manualCompendiumConfiguration']
    },
    {
      legend: 'DCC.SettingsMenuGroupCompendiums',
      settings: [
        'critsCompendium',
        'spellSideEffectsCompendium',
        'disapprovalCompendium',
        'mightyDeedsCompendium'
      ]
    },
    {
      legend: 'DCC.SettingsMenuGroupRollTables',
      settings: [
        'fumbleTable',
        'turnUnholyTable',
        'layOnHandsTable',
        'divineAidTable',
        'mercurialMagicTable'
      ]
    }
  ]

  /** @inheritDoc */
  static TOGGLES = {
    manualCompendiumConfiguration: [
      'critsCompendium',
      'spellSideEffectsCompendium',
      'disapprovalCompendium',
      'mightyDeedsCompendium',
      'fumbleTable',
      'turnUnholyTable',
      'layOnHandsTable',
      'divineAidTable',
      'mercurialMagicTable'
    ]
  }
}

/**
 * Multiple action dice: the experimental per-round action-die budget feature
 * and its sub-options.
 */
class DCCActionDiceSettings extends DCCSettingsMenu {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: 'dcc-action-dice-settings',
    window: {
      title: 'DCC.SettingsMenuActionDice',
      icon: 'fa-solid fa-dice'
    }
  }

  /** @inheritDoc */
  static GROUPS = [
    {
      legend: 'DCC.SettingsMenuGroupActionDice',
      settings: [
        'multipleActionDice',
        'trackActionDiceInCombat',
        'autoResetActionDice',
        'hideSingleActionDiePips'
      ]
    }
  ]

  /** @inheritDoc */
  static TOGGLES = {
    multipleActionDice: [
      'trackActionDiceInCombat',
      'autoResetActionDice',
      'hideSingleActionDiePips'
    ]
  }
}

export { DCCSettingsMenu, DCCEnhancedCombatSettings, DCCTableSettings, DCCActionDiceSettings }
