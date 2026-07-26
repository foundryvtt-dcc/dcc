/* global game */
/**
 * Unit coverage for module/settings-menus.mjs and the submenu registration in
 * module/settings.js. Foundry globals (foundry.applications, foundry.data,
 * game.settings, game.i18n) are stubbed locally; the tests cover field
 * building, context preparation (including world-scope permission gating),
 * the submit handler (changed-only saves, permission skips, reload prompts),
 * and that every setting referenced by a menu is registered with
 * `config: false` so it only appears inside its submenu.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

/* Minimal Foundry stubs, needed before the modules under test are imported */
class DataField {
  constructor (options = {}) {
    Object.assign(this, options)
  }
}
class BooleanField extends DataField {}
class NumberField extends DataField {}
class StringField extends DataField {}

class ApplicationV2Stub {
  constructor (options = {}) {
    this.options = options
  }

  async _prepareContext () {
    return {}
  }

  async _onRender () {}
}

const reloadConfirm = vi.fn()

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: ApplicationV2Stub,
      HandlebarsApplicationMixin: Base => class extends Base {}
    },
    settings: {
      SettingsConfig: { reloadConfirm }
    }
  },
  data: {
    fields: { DataField, BooleanField, NumberField, StringField }
  }
}

const registeredSettings = new Map()
globalThis.game = {
  user: { can: vi.fn(() => true) },
  i18n: { localize: vi.fn(key => `#${key}`) },
  settings: {
    settings: registeredSettings,
    get: vi.fn(),
    set: vi.fn(),
    register: vi.fn((namespace, key, data) => {
      registeredSettings.set(`${namespace}.${key}`, { namespace, key, ...data })
    }),
    registerMenu: vi.fn()
  }
}
globalThis.CONFIG = { DCC: { variants: { dcc: { id: 'dcc', label: 'DCC.VariantDCC' } } } }
globalThis.Hooks = { callAll: vi.fn() }

const {
  DCCSettingsMenu,
  DCCEnhancedCombatSettings,
  DCCTableSettings,
  DCCActionDiceSettings
} = await import('../settings-menus.mjs')
const { registerEarlySystemSettings, registerSystemSettings } = await import('../settings.js')

const registerAllSettings = async () => {
  registerEarlySystemSettings()
  await registerSystemSettings()
}

const submitHandler = DCCSettingsMenu.DEFAULT_OPTIONS.form.handler

class TestMenu extends DCCSettingsMenu {
  static GROUPS = [
    { legend: 'TEST.Legend', settings: ['boolSetting', 'choiceSetting'] }
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  registeredSettings.clear()
  game.user.can.mockReturnValue(true)
  game.settings.register('dcc', 'boolSetting', {
    name: 'TEST.Bool',
    hint: 'TEST.BoolHint',
    scope: 'client',
    type: Boolean,
    default: false
  })
  game.settings.register('dcc', 'choiceSetting', {
    name: 'TEST.Choice',
    hint: 'TEST.ChoiceHint',
    scope: 'world',
    type: String,
    choices: { a: 'A', b: 'B' },
    default: 'a'
  })
})

describe('buildSettingField', () => {
  test('builds a BooleanField for Boolean settings', () => {
    const field = DCCSettingsMenu.buildSettingField(registeredSettings.get('dcc.boolSetting'))
    expect(field).toBeInstanceOf(BooleanField)
    expect(field.initial).toBe(false)
  })

  test('passes a DataField setting type through without mutating it', () => {
    const sharedField = new StringField({ required: true })
    game.settings.register('dcc', 'dataFieldSetting', {
      name: 'TEST.DataField',
      scope: 'world',
      type: sharedField
    })
    const field = DCCSettingsMenu.buildSettingField(registeredSettings.get('dcc.dataFieldSetting'))
    expect(field).toBe(sharedField)
    expect(field.name).toBeUndefined()
    expect(field.label).toBeUndefined()
  })

  test('builds a StringField with choices for String settings', () => {
    const field = DCCSettingsMenu.buildSettingField(registeredSettings.get('dcc.choiceSetting'))
    expect(field).toBeInstanceOf(StringField)
    expect(field.choices).toEqual({ a: 'A', b: 'B' })
  })

  test('builds a NumberField carrying range limits for Number settings', () => {
    game.settings.register('dcc', 'numberSetting', {
      name: 'TEST.Number',
      scope: 'world',
      type: Number,
      default: 10,
      range: { min: 1, max: 20, step: 1 }
    })
    const field = DCCSettingsMenu.buildSettingField(registeredSettings.get('dcc.numberSetting'))
    expect(field).toBeInstanceOf(NumberField)
    expect(field.initial).toBe(10)
    expect(field.min).toBe(1)
    expect(field.max).toBe(20)
    expect(field.step).toBe(1)
  })
})

describe('_prepareContext', () => {
  test('builds localized fieldset groups with current values and a save button', async () => {
    game.settings.get.mockImplementation((namespace, key) => ({ boolSetting: true, choiceSetting: 'b' }[key]))
    const context = await new TestMenu()._prepareContext({})
    expect(context.groups).toHaveLength(1)
    expect(context.groups[0].legend).toBe('#TEST.Legend')
    expect(context.groups[0].entries.map(e => e.value)).toEqual([true, 'b'])
    expect(context.groups[0].entries.map(e => e.disabled)).toEqual([false, false])
    // name/label/hint travel in the entry (raw i18n keys; the template's
    // formGroup localize=true localizes) rather than mutating the field.
    expect(context.groups[0].entries.map(e => e.name)).toEqual(['boolSetting', 'choiceSetting'])
    expect(context.groups[0].entries[0].label).toBe('TEST.Bool')
    expect(context.groups[0].entries[0].hint).toBe('TEST.BoolHint')
    expect(context.buttons[0].type).toBe('submit')
  })

  test('skips unregistered settings instead of breaking the render', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    class MissingKeyMenu extends DCCSettingsMenu {
      static GROUPS = [{ legend: 'TEST.Legend', settings: ['boolSetting', 'notRegistered'] }]
    }
    const context = await new MissingKeyMenu()._prepareContext({})
    expect(context.groups[0].entries.map(e => e.name)).toEqual(['boolSetting'])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  test('disables world-scoped settings for users without SETTINGS_MODIFY', async () => {
    game.user.can.mockReturnValue(false)
    const context = await new TestMenu()._prepareContext({})
    const [boolEntry, choiceEntry] = context.groups[0].entries
    expect(boolEntry.disabled).toBe(false)
    expect(choiceEntry.disabled).toBe(true)
  })
})

describe('submit handler', () => {
  const submit = formData => submitHandler.call(new TestMenu(), {}, {}, { object: formData })

  test('saves only changed settings', async () => {
    game.settings.get.mockImplementation((namespace, key) => ({ boolSetting: false, choiceSetting: 'b' }[key]))
    await submit({ boolSetting: true, choiceSetting: 'b' })
    expect(game.settings.set).toHaveBeenCalledTimes(1)
    expect(game.settings.set).toHaveBeenCalledWith('dcc', 'boolSetting', true)
  })

  test('ignores settings missing from the form data', async () => {
    game.settings.get.mockReturnValue(false)
    await submit({ boolSetting: true })
    expect(game.settings.set).toHaveBeenCalledTimes(1)
  })

  test('skips world-scoped settings for users without SETTINGS_MODIFY', async () => {
    game.user.can.mockReturnValue(false)
    game.settings.get.mockImplementation((namespace, key) => ({ boolSetting: false, choiceSetting: 'a' }[key]))
    await submit({ boolSetting: true, choiceSetting: 'b' })
    expect(game.settings.set).toHaveBeenCalledTimes(1)
    expect(game.settings.set).toHaveBeenCalledWith('dcc', 'boolSetting', true)
  })

  test('prompts for a world reload when a changed world setting requires one', async () => {
    registeredSettings.get('dcc.choiceSetting').requiresReload = true
    game.settings.get.mockImplementation((namespace, key) => ({ boolSetting: false, choiceSetting: 'a' }[key]))
    await submit({ boolSetting: false, choiceSetting: 'b' })
    expect(reloadConfirm).toHaveBeenCalledWith({ world: true })
  })

  test('does not prompt for a reload when nothing requiring one changed', async () => {
    game.settings.get.mockImplementation((namespace, key) => ({ boolSetting: false, choiceSetting: 'a' }[key]))
    await submit({ boolSetting: true, choiceSetting: 'a' })
    expect(reloadConfirm).not.toHaveBeenCalled()
  })
})

describe('menu registration', () => {
  const menuClasses = [DCCEnhancedCombatSettings, DCCTableSettings, DCCActionDiceSettings]

  test('registerSystemSettings registers the three submenus', async () => {
    await registerSystemSettings()
    const menus = game.settings.registerMenu.mock.calls
    expect(menus.map(([namespace, key]) => [namespace, key])).toEqual([
      ['dcc', 'enhancedCombatMenu'],
      ['dcc', 'tableSettingsMenu'],
      ['dcc', 'actionDiceMenu']
    ])
    expect(menus.map(([,, data]) => data.type)).toEqual(menuClasses)
    expect(menus.map(([,, data]) => data.restricted)).toEqual([false, true, true])
  })

  test('every setting shown in a submenu is registered with config: false', async () => {
    await registerAllSettings()
    for (const menuClass of menuClasses) {
      for (const group of menuClass.GROUPS) {
        for (const key of group.settings) {
          const setting = registeredSettings.get(`dcc.${key}`)
          expect(setting, `dcc.${key} is not registered`).toBeDefined()
          expect(setting.config, `dcc.${key} should not appear in the main settings list`).toBe(false)
        }
      }
    }
  })

  test('settings outside the submenus stay in the main settings list', async () => {
    await registerAllSettings()
    for (const key of ['activeVariant', 'mightyDeedsEnabled', 'promptForItemDeletion', 'coinWeight']) {
      expect(registeredSettings.get(`dcc.${key}`).config).toBe(true)
    }
  })

  test('settings read before ready register early: fleeting luck pair and action dice', () => {
    registerEarlySystemSettings()
    const keys = [...registeredSettings.keys()]
    for (const key of ['dcc.enableFleetingLuck', 'dcc.automateFleetingLuck', 'dcc.multipleActionDice', 'dcc.trackActionDiceInCombat', 'dcc.autoResetActionDice', 'dcc.hideSingleActionDiePips']) {
      expect(keys, `${key} must be registered before ready`).toContain(key)
    }
    // The Fleeting Luck pair renders adjacently in the main settings list.
    expect(keys[keys.indexOf('dcc.enableFleetingLuck') + 1]).toBe('dcc.automateFleetingLuck')
  })

  test('early and ready-time registrations do not overlap', async () => {
    registerEarlySystemSettings()
    const earlyCount = game.settings.register.mock.calls.length
    await registerSystemSettings()
    const allKeys = game.settings.register.mock.calls.map(([namespace, key]) => `${namespace}.${key}`)
    expect(new Set(allKeys).size).toBe(allKeys.length)
    expect(allKeys.length).toBeGreaterThan(earlyCount)
  })

  test('TOGGLES only reference settings presented by the same menu', () => {
    for (const menuClass of menuClasses) {
      const shown = menuClass.GROUPS.flatMap(group => group.settings)
      for (const [master, dependents] of Object.entries(menuClass.TOGGLES)) {
        expect(shown).toContain(master)
        for (const dependent of dependents) {
          expect(shown).toContain(dependent)
        }
      }
    }
  })
})
