/**
 * Unit coverage for the settings-table hook handlers extracted from
 * `module/dcc.js`. Each handler is a pure delegate onto `CONFIG.DCC.*`;
 * the assertions stub `CONFIG` per-test so the handlers can be invoked
 * as plain functions without a live Foundry boot.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  SETTINGS_TABLE_HOOKS,
  onRegisterCriticalHitsPack,
  onRegisterDisapprovalPack,
  onRegisterMightyDeedsPack,
  onRegisterLevelDataPack,
  onRegisterMercurialMagicTable,
  onSetDivineAidTable,
  onSetFumbleTable,
  onSetLayOnHandsTable,
  onSetMercurialMagicTable,
  onSetTurnUnholyTable,
  registerSettingsTableHooks
} from '../settings-table-hooks.mjs'

let originalCONFIG

beforeEach(() => {
  originalCONFIG = globalThis.CONFIG
  globalThis.CONFIG = { DCC: {} }
})

afterEach(() => {
  globalThis.CONFIG = originalCONFIG
})

describe('onRegisterDisapprovalPack', () => {
  test('delegates to CONFIG.DCC.disapprovalPacks.addPack with the system-setting flag', () => {
    const addPack = vi.fn()
    globalThis.CONFIG.DCC.disapprovalPacks = { addPack }

    onRegisterDisapprovalPack('dcc.someDisapprovalPack', true)

    expect(addPack).toHaveBeenCalledWith('dcc.someDisapprovalPack', true)
  })

  test('defaults fromSystemSetting to false when omitted', () => {
    const addPack = vi.fn()
    globalThis.CONFIG.DCC.disapprovalPacks = { addPack }

    onRegisterDisapprovalPack('dcc.aPack')

    expect(addPack).toHaveBeenCalledWith('dcc.aPack', false)
  })

  test('no-ops when CONFIG.DCC.disapprovalPacks is absent', () => {
    expect(() => onRegisterDisapprovalPack('dcc.aPack', true)).not.toThrow()
  })
})

describe('onRegisterCriticalHitsPack', () => {
  test('delegates to CONFIG.DCC.criticalHitPacks.addPack', () => {
    const addPack = vi.fn()
    globalThis.CONFIG.DCC.criticalHitPacks = { addPack }

    onRegisterCriticalHitsPack('dcc.aCritPack', true)

    expect(addPack).toHaveBeenCalledWith('dcc.aCritPack', true)
  })

  test('no-ops when CONFIG.DCC.criticalHitPacks is absent', () => {
    expect(() => onRegisterCriticalHitsPack('dcc.aCritPack')).not.toThrow()
  })
})

describe('onSetDivineAidTable', () => {
  test('sets the table when unset', () => {
    onSetDivineAidTable('dcc.divineAid')
    expect(globalThis.CONFIG.DCC.divineAidTable).toBe('dcc.divineAid')
  })

  test('does not overwrite an existing value when fromSystemSetting is false', () => {
    globalThis.CONFIG.DCC.divineAidTable = 'module.firstWriter'
    onSetDivineAidTable('dcc.systemDefault', false)
    expect(globalThis.CONFIG.DCC.divineAidTable).toBe('module.firstWriter')
  })

  test('overwrites an existing value when fromSystemSetting is true', () => {
    globalThis.CONFIG.DCC.divineAidTable = 'module.firstWriter'
    onSetDivineAidTable('dcc.systemDefault', true)
    expect(globalThis.CONFIG.DCC.divineAidTable).toBe('dcc.systemDefault')
  })
})

describe('onSetFumbleTable', () => {
  test('sets when unset; respects first-write-wins; system setting overrides', () => {
    onSetFumbleTable('dcc.fumble')
    expect(globalThis.CONFIG.DCC.fumbleTable).toBe('dcc.fumble')

    onSetFumbleTable('module.laterWriter', false)
    expect(globalThis.CONFIG.DCC.fumbleTable).toBe('dcc.fumble')

    onSetFumbleTable('dcc.systemDefault', true)
    expect(globalThis.CONFIG.DCC.fumbleTable).toBe('dcc.systemDefault')
  })
})

describe('onSetLayOnHandsTable', () => {
  test('sets when unset; respects first-write-wins; system setting overrides', () => {
    onSetLayOnHandsTable('dcc.layOnHands')
    expect(globalThis.CONFIG.DCC.layOnHandsTable).toBe('dcc.layOnHands')

    onSetLayOnHandsTable('module.laterWriter', false)
    expect(globalThis.CONFIG.DCC.layOnHandsTable).toBe('dcc.layOnHands')

    onSetLayOnHandsTable('dcc.systemDefault', true)
    expect(globalThis.CONFIG.DCC.layOnHandsTable).toBe('dcc.systemDefault')
  })
})

describe('onRegisterLevelDataPack', () => {
  test('lazily constructs CONFIG.DCC.levelDataPacks via TablePackManager on first call', () => {
    onRegisterLevelDataPack('dcc.levelDataPack', true)

    const packs = globalThis.CONFIG.DCC.levelDataPacks
    expect(packs).toBeDefined()
    expect(packs.constructor.name).toBe('TablePackManager')
    // TablePackManager.addPack stores under _packs keyed by pack name
    expect(packs._packs).toHaveProperty('dcc.levelDataPack')
  })

  test('reuses the existing TablePackManager on subsequent calls', () => {
    onRegisterLevelDataPack('dcc.first', false)
    const firstManager = globalThis.CONFIG.DCC.levelDataPacks

    onRegisterLevelDataPack('dcc.second', false)
    expect(globalThis.CONFIG.DCC.levelDataPacks).toBe(firstManager)
    expect(firstManager._packs).toHaveProperty('dcc.first')
    expect(firstManager._packs).toHaveProperty('dcc.second')
  })
})

describe('onRegisterMercurialMagicTable', () => {
  test('writes a per-class entry into CONFIG.DCC.mercurialMagicTables', () => {
    onRegisterMercurialMagicTable('wizard', 'module.wizardTable')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables.wizard).toBe('module.wizardTable')
    // Per-class write must not touch the legacy default field
    expect(globalThis.CONFIG.DCC.mercurialMagicTable).toBeUndefined()
  })

  test('also mirrors onto the legacy default field when classKey === "default"', () => {
    onRegisterMercurialMagicTable('default', 'module.defaultTable')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables.default).toBe('module.defaultTable')
    expect(globalThis.CONFIG.DCC.mercurialMagicTable).toBe('module.defaultTable')
  })

  test('no-ops when classKey is falsy', () => {
    onRegisterMercurialMagicTable('', 'module.x')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables).toBeUndefined()
  })

  test('no-ops when value is falsy', () => {
    onRegisterMercurialMagicTable('wizard', null)
    expect(globalThis.CONFIG.DCC.mercurialMagicTables).toBeUndefined()
  })
})

describe('onSetMercurialMagicTable', () => {
  test('writes to legacy field + default registry slot when unset', () => {
    onSetMercurialMagicTable('module.firstWriter')
    expect(globalThis.CONFIG.DCC.mercurialMagicTable).toBe('module.firstWriter')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables.default).toBe('module.firstWriter')
  })

  test('first-write-wins for subsequent non-system writes', () => {
    onSetMercurialMagicTable('module.firstWriter')
    onSetMercurialMagicTable('module.laterWriter', false)
    expect(globalThis.CONFIG.DCC.mercurialMagicTable).toBe('module.firstWriter')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables.default).toBe('module.firstWriter')
  })

  test('system setting overrides the existing value AND the default slot', () => {
    onSetMercurialMagicTable('module.firstWriter')
    onSetMercurialMagicTable('dcc.systemDefault', true)
    expect(globalThis.CONFIG.DCC.mercurialMagicTable).toBe('dcc.systemDefault')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables.default).toBe('dcc.systemDefault')
  })

  test('does not clobber per-class slots in mercurialMagicTables', () => {
    globalThis.CONFIG.DCC.mercurialMagicTables = { wizard: 'module.wizardTable' }
    onSetMercurialMagicTable('module.defaultTable')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables.wizard).toBe('module.wizardTable')
    expect(globalThis.CONFIG.DCC.mercurialMagicTables.default).toBe('module.defaultTable')
  })
})

describe('onSetTurnUnholyTable', () => {
  test('sets when unset; respects first-write-wins; system setting overrides', () => {
    onSetTurnUnholyTable('dcc.turnUnholy')
    expect(globalThis.CONFIG.DCC.turnUnholyTable).toBe('dcc.turnUnholy')

    onSetTurnUnholyTable('module.laterWriter', false)
    expect(globalThis.CONFIG.DCC.turnUnholyTable).toBe('dcc.turnUnholy')

    onSetTurnUnholyTable('dcc.systemDefault', true)
    expect(globalThis.CONFIG.DCC.turnUnholyTable).toBe('dcc.systemDefault')
  })
})

describe('SETTINGS_TABLE_HOOKS dispatch table', () => {
  test('routes each documented hook name to the corresponding handler', () => {
    expect(SETTINGS_TABLE_HOOKS['dcc.registerDisapprovalPack']).toBe(onRegisterDisapprovalPack)
    expect(SETTINGS_TABLE_HOOKS['dcc.registerMightyDeedsPack']).toBe(onRegisterMightyDeedsPack)
    expect(SETTINGS_TABLE_HOOKS['dcc.registerCriticalHitsPack']).toBe(onRegisterCriticalHitsPack)
    expect(SETTINGS_TABLE_HOOKS['dcc.setDivineAidTable']).toBe(onSetDivineAidTable)
    expect(SETTINGS_TABLE_HOOKS['dcc.setFumbleTable']).toBe(onSetFumbleTable)
    expect(SETTINGS_TABLE_HOOKS['dcc.setLayOnHandsTable']).toBe(onSetLayOnHandsTable)
    expect(SETTINGS_TABLE_HOOKS['dcc.registerLevelDataPack']).toBe(onRegisterLevelDataPack)
    expect(SETTINGS_TABLE_HOOKS['dcc.registerMercurialMagicTable']).toBe(onRegisterMercurialMagicTable)
    expect(SETTINGS_TABLE_HOOKS['dcc.setMercurialMagicTable']).toBe(onSetMercurialMagicTable)
    expect(SETTINGS_TABLE_HOOKS['dcc.setTurnUnholyTable']).toBe(onSetTurnUnholyTable)
  })

  test('covers exactly the ten documented hook names', () => {
    expect(Object.keys(SETTINGS_TABLE_HOOKS).sort()).toEqual([
      'dcc.registerCriticalHitsPack',
      'dcc.registerDisapprovalPack',
      'dcc.registerLevelDataPack',
      'dcc.registerMercurialMagicTable',
      'dcc.registerMightyDeedsPack',
      'dcc.setDivineAidTable',
      'dcc.setFumbleTable',
      'dcc.setLayOnHandsTable',
      'dcc.setMercurialMagicTable',
      'dcc.setTurnUnholyTable'
    ])
  })
})

describe('registerSettingsTableHooks', () => {
  let originalHooks

  beforeEach(() => {
    originalHooks = globalThis.Hooks
    globalThis.Hooks = { on: vi.fn() }
  })

  afterEach(() => {
    globalThis.Hooks = originalHooks
  })

  test('wires every dispatch-table entry onto Hooks.on with the matching handler', () => {
    registerSettingsTableHooks()

    const registered = Object.fromEntries(globalThis.Hooks.on.mock.calls)
    expect(Object.keys(registered).sort()).toEqual(Object.keys(SETTINGS_TABLE_HOOKS).sort())
    for (const [hookName, handler] of Object.entries(SETTINGS_TABLE_HOOKS)) {
      expect(registered[hookName]).toBe(handler)
    }
  })

  test('registers exactly ten listeners — one per dispatch-table entry', () => {
    registerSettingsTableHooks()
    expect(globalThis.Hooks.on).toHaveBeenCalledTimes(10)
  })
})
