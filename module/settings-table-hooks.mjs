/* global CONFIG, Hooks */

/**
 * Settings-table hook handlers extracted from `module/dcc.js`.
 *
 * These hooks let the system settings layer + sibling content modules push
 * table / pack registrations onto `CONFIG.DCC.*` without editing system
 * source. Each handler is a pure delegate onto `CONFIG.DCC.<registry>`;
 * `registerSettingsTableHooks()` is the production entry-point invoked from
 * `module/dcc.js`'s `init` hook in place of the inline `Hooks.on(...)`
 * blocks.
 *
 * The handlers are exported individually so the unit tests can invoke them
 * as plain functions; the registration helper wires them onto `Hooks.on`.
 */

import TablePackManager from './table-pack-manager.js'

export function onRegisterDisapprovalPack (value, fromSystemSetting = false) {
  const disapprovalPacks = CONFIG.DCC.disapprovalPacks
  if (disapprovalPacks) {
    disapprovalPacks.addPack(value, fromSystemSetting)
  }
}

export function onRegisterCriticalHitsPack (value, fromSystemSetting = false) {
  const criticalHitPacks = CONFIG.DCC.criticalHitPacks
  if (criticalHitPacks) {
    criticalHitPacks.addPack(value, fromSystemSetting)
  }
}

export function onSetDivineAidTable (value, fromSystemSetting = false) {
  if (fromSystemSetting || !CONFIG.DCC.divineAidTable) {
    CONFIG.DCC.divineAidTable = value
  }
}

export function onSetFumbleTable (value, fromSystemSetting = false) {
  if (fromSystemSetting || !CONFIG.DCC.fumbleTable) {
    CONFIG.DCC.fumbleTable = value
  }
}

export function onSetLayOnHandsTable (value, fromSystemSetting = false) {
  if (fromSystemSetting || !CONFIG.DCC.layOnHandsTable) {
    CONFIG.DCC.layOnHandsTable = value
  }
}

export function onRegisterLevelDataPack (value, fromSystemSetting = false) {
  if (!CONFIG.DCC.levelDataPacks) {
    CONFIG.DCC.levelDataPacks = new TablePackManager()
  }
  CONFIG.DCC.levelDataPacks.addPack(value, fromSystemSetting)
}

/**
 * Mercurial Magic — per-class table registry. Modules call
 * `registerMercurialMagicTable(classKey, tableName)` at `dcc.ready` to
 * attach a class-specific table; the cast / item-sheet code resolves
 * per-class with a fallback to the world-setting default. `classKey` is
 * the lowercase `system.details.sheetClass` (`'wizard'`, `'elf'`,
 * `'blaster'`, `'gnome'`, …) or the literal string `'default'`.
 */
export function onRegisterMercurialMagicTable (classKey, value) {
  if (!classKey || !value) return
  CONFIG.DCC.mercurialMagicTables ??= {}
  CONFIG.DCC.mercurialMagicTables[classKey] = value
  if (classKey === 'default') {
    CONFIG.DCC.mercurialMagicTable = value
  }
}

/**
 * Legacy single-table setter — preserved for back-compat. Writes to the
 * registry's `'default'` slot AND the legacy `mercurialMagicTable` field.
 * First-write-wins unless the system setting fires
 * (`fromSystemSetting=true`), which always overrides — same semantics as
 * before. dcc-core-book and similar content modules continue to call this;
 * modules that need per-class registration use the
 * `dcc.registerMercurialMagicTable` hook above.
 */
export function onSetMercurialMagicTable (value, fromSystemSetting = false) {
  if (fromSystemSetting || !CONFIG.DCC.mercurialMagicTable) {
    CONFIG.DCC.mercurialMagicTable = value
    CONFIG.DCC.mercurialMagicTables ??= {}
    CONFIG.DCC.mercurialMagicTables.default = value
  }
}

export function onSetTurnUnholyTable (value, fromSystemSetting = false) {
  if (fromSystemSetting || !CONFIG.DCC.turnUnholyTable) {
    CONFIG.DCC.turnUnholyTable = value
  }
}

export const SETTINGS_TABLE_HOOKS = Object.freeze({
  'dcc.registerDisapprovalPack': onRegisterDisapprovalPack,
  'dcc.registerCriticalHitsPack': onRegisterCriticalHitsPack,
  'dcc.setDivineAidTable': onSetDivineAidTable,
  'dcc.setFumbleTable': onSetFumbleTable,
  'dcc.setLayOnHandsTable': onSetLayOnHandsTable,
  'dcc.registerLevelDataPack': onRegisterLevelDataPack,
  'dcc.registerMercurialMagicTable': onRegisterMercurialMagicTable,
  'dcc.setMercurialMagicTable': onSetMercurialMagicTable,
  'dcc.setTurnUnholyTable': onSetTurnUnholyTable
})

export function registerSettingsTableHooks () {
  for (const [hookName, handler] of Object.entries(SETTINGS_TABLE_HOOKS)) {
    Hooks.on(hookName, handler)
  }
}
