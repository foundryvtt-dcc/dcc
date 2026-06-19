/* global CONFIG, foundry, game, Hooks */

/**
 * Table-loading surface extracted from `module/dcc.js`.
 *
 * Three production entry-points the `init` / `ready` hooks call directly
 * (`setupCoreBookCompendiumLinks`, `registerTables`, `getSkillTable`),
 * five hook handlers wired by `registerTableLoadingHooks()` covering
 * `diceSoNiceReady`, `importAdventure`, and the three world-RollTable
 * lifecycle hooks (`createRollTable` / `deleteRollTable` /
 * `updateRollTable`) that keep `CONFIG.DCC.disapprovalTables` in sync as
 * world tables are added / renamed / removed.
 *
 * Handlers are exported individually so the unit tests can invoke them
 * as plain functions; the dispatch table + `registerTableLoadingHooks()`
 * helper mirror the `module/settings-table-hooks.mjs` pattern.
 */

import TablePackManager from './table-pack-manager.js'

/**
 * Module-private predicate. Reads `game.i18n` per call so the localized
 * "Disapproval" string reflects the active language at hook-fire time
 * (matches the three inline copies that lived in `dcc.js` pre-extraction).
 */
function isDisapprovalTable (tableName) {
  const disapprovalText = game.i18n.localize('DCC.Disapproval')
  return tableName.includes('Disapproval') || tableName.includes(disapprovalText)
}

/**
 * Module-private predicate for Mighty Deed tables (issue #319). Mirrors
 * `isDisapprovalTable` — reads `game.i18n` per call so the localized
 * "Deed" string reflects the active language at hook-fire time.
 */
function isMightyDeedsTable (tableName) {
  const deedText = game.i18n.localize('DCC.Deed')
  return tableName.includes('Deed') || tableName.includes(deedText)
}

/**
 * Set up compendium links for the equipment tab if dcc-core-book module
 * is active. Stores links in `CONFIG.DCC.coreBookCompendiumLinks`.
 */
export function setupCoreBookCompendiumLinks () {
  if (!game.modules.get('dcc-core-book')?.active) {
    CONFIG.DCC.coreBookCompendiumLinks = null
    return
  }

  CONFIG.DCC.coreBookCompendiumLinks = {
    weapons: 'dcc-core-book.dcc-core-weapons',
    armor: 'dcc-core-book.dcc-core-armor',
    equipment: 'dcc-core-book.dcc-core-equipment',
    ammunition: 'dcc-core-book.dcc-core-ammunition',
    mounts: 'dcc-core-book.dcc-core-mounts',
    wizardSpells: [
      'dcc-core-book.dcc-core-spells-wizard-1',
      'dcc-core-book.dcc-core-spells-wizard-2',
      'dcc-core-book.dcc-core-spells-wizard-3',
      'dcc-core-book.dcc-core-spells-wizard-4',
      'dcc-core-book.dcc-core-spells-wizard-5'
    ],
    clericSpells: [
      'dcc-core-book.dcc-core-spells-cleric-1',
      'dcc-core-book.dcc-core-spells-cleric-2',
      'dcc-core-book.dcc-core-spells-cleric-3',
      'dcc-core-book.dcc-core-spells-cleric-4',
      'dcc-core-book.dcc-core-spells-cleric-5'
    ]
  }
}

/**
 * Install the disapproval / critical-hit / patron-taint table-pack
 * managers and seed the per-table `CONFIG.DCC.<name>Table` scalars from
 * world settings.
 */
export function registerTables () {
  // Create manager for disapproval tables and register the system setting
  CONFIG.DCC.disapprovalPacks = new TablePackManager({
    updateHook: async (manager) => {
      // Clear disapproval tables
      CONFIG.DCC.disapprovalTables = {}

      // For each valid pack, update the list of disapproval tables available to a cleric
      // Using table name as key to enable de-duplication
      for (const packName of manager.packs) {
        const pack = game.packs.get(packName)
        if (pack) {
          for (const value of pack.index.values()) {
            // Use table name as key for de-duplication
            CONFIG.DCC.disapprovalTables[value.name] = {
              name: value.name,
              path: `${packName}.${value.name}`
            }
          }
        }
      }

      // Add world tables to the disapproval tables list if they contain "Disapproval" in their name
      // World tables will overwrite compendium tables with the same name (preferred)
      // If multiple world tables have the same name, the last one processed wins
      for (const table of game.tables) {
        if (isDisapprovalTable(table.name)) {
          // Use table name as key - this overwrites compendium tables with same name
          CONFIG.DCC.disapprovalTables[table.name] = {
            name: table.name,
            path: table.name
          }
        }
      }
    }
  })
  const disapprovalCompendium = game.settings.get('dcc', 'disapprovalCompendium')
  if (disapprovalCompendium) {
    CONFIG.DCC.disapprovalPacks.addPack(disapprovalCompendium, true)
  } else {
    // No compendium configured - still scan world tables for disapproval tables
    CONFIG.DCC.disapprovalPacks._updateHook(CONFIG.DCC.disapprovalPacks)
  }

  // Create manager for Mighty Deed table packs (issue #319). Mirrors the
  // disapproval manager: pull tables from the configured compendium plus
  // any world table whose name contains "Deed" (or the localized term).
  // The attack card only surfaces these when the `mightyDeedsEnabled`
  // world setting is on, but the registry stays populated regardless so
  // the compendium picker and world-table tracking behave consistently.
  CONFIG.DCC.mightyDeedsPacks = new TablePackManager({
    updateHook: async (manager) => {
      // Clear Mighty Deed tables
      CONFIG.DCC.mightyDeedsTables = {}

      // For each valid pack, update the list of Mighty Deed tables available on the attack card deed prompt
      // Using table name as key to enable de-duplication
      for (const packName of manager.packs) {
        const pack = game.packs.get(packName)
        if (pack) {
          for (const value of pack.index.values()) {
            // Use table name as key for de-duplication
            CONFIG.DCC.mightyDeedsTables[value.name] = {
              name: value.name,
              path: `${packName}.${value.name}`
            }
          }
        }
      }

      // Add world tables to the Mighty Deed tables list if they contain "Deed" in their name
      // World tables will overwrite compendium tables with the same name (preferred)
      // If multiple world tables have the same name, the last one processed wins
      for (const table of game.tables) {
        if (isMightyDeedsTable(table.name)) {
          // Use table name as key - this overwrites compendium tables with same name
          CONFIG.DCC.mightyDeedsTables[table.name] = {
            name: table.name,
            path: table.name
          }
        }
      }
    }
  })
  const mightyDeedsCompendium = game.settings.get('dcc', 'mightyDeedsCompendium')
  if (mightyDeedsCompendium) {
    CONFIG.DCC.mightyDeedsPacks.addPack(mightyDeedsCompendium, true)
  } else {
    // No compendium configured - still scan world tables for Mighty Deed tables
    CONFIG.DCC.mightyDeedsPacks._updateHook(CONFIG.DCC.mightyDeedsPacks)
  }

  // Create manager for critical hit table packs and register the system setting
  CONFIG.DCC.criticalHitPacks = new TablePackManager()
  CONFIG.DCC.criticalHitPacks.addPack(game.settings.get('dcc', 'critsCompendium'), true)

  // D3b — manager for patron-taint manifestation table packs. Seeded
  // with the core + xcc side-effect packs; sibling modules that ship
  // their own patron content can push additional packs via
  // `CONFIG.DCC.patronTaintPacks.addPack(packName)`. The adapter's
  // `loadPatronTaintTable` walks this list looking for a RollTable
  // named `Patron Taint: ${actor.system.class.patron}`. Unknown pack
  // names are ignored by `loadPatronTaintTable` (null-safe walk), so
  // listing packs whose modules aren't installed is harmless.
  CONFIG.DCC.patronTaintPacks = new TablePackManager()
  CONFIG.DCC.patronTaintPacks.addPack('dcc-core-book.dcc-core-spell-side-effect-tables')
  CONFIG.DCC.patronTaintPacks.addPack('xcc-core-book.xcc-core-spell-side-effect-tables')

  // Set divine aid table from the system setting
  const divineAidTable = game.settings.get('dcc', 'divineAidTable')
  if (divineAidTable) {
    CONFIG.DCC.divineAidTable = divineAidTable
  }

  // Set fumble table from the system setting
  const fumbleTable = game.settings.get('dcc', 'fumbleTable')
  if (fumbleTable) {
    CONFIG.DCC.fumbleTable = fumbleTable
  }

  // Set lay on hands table from the system setting
  const layOnHandsTable = game.settings.get('dcc', 'layOnHandsTable')
  if (layOnHandsTable) {
    CONFIG.DCC.layOnHandsTable = layOnHandsTable
  }

  // Set mercurial magic table from the system setting
  const mercurialMagicTable = game.settings.get('dcc', 'mercurialMagicTable')
  if (mercurialMagicTable) {
    CONFIG.DCC.mercurialMagicTable = mercurialMagicTable
  }

  // Set turn unholy table from the system setting
  const turnUnholyTable = game.settings.get('dcc', 'turnUnholyTable')
  if (turnUnholyTable) {
    CONFIG.DCC.turnUnholyTable = turnUnholyTable
  }
}

/**
 * Look up a table for a given skill, if present.
 * @param {string} skillName     The name of the skill
 * @returns {Promise}            RollTable object or null
 */
export async function getSkillTable (skillName) {
  // Convert skill name to a property name on CONFIG.DCC
  const tableProperty = CONFIG.DCC.skillTables[skillName] || null

  // Look up the property if the skill was found
  const tableName = tableProperty ? (CONFIG.DCC[tableProperty] || null) : null

  // Load the table defined by the property if available
  if (tableName) {
    const tablePath = tableName.split('.')
    let pack
    if (tablePath.length === 3) {
      pack = game.packs.get(tablePath[0] + '.' + tablePath[1])
    }
    if (pack) {
      const entry = pack.index.find((entity) => entity.name === tablePath[2])
      if (entry) {
        return pack.getDocument(entry._id)
      }
    }

    // Fall back to searching world tables by name
    const worldTableName = tablePath.length === 3 ? tablePath[2] : tableName
    const worldTable = game.tables.getName(worldTableName)
    if (worldTable) {
      return worldTable
    }
  }

  // Fall back to searching world tables by localized skill name
  // This allows users to create a world table named "Turn Unholy" (or the
  // equivalent in their language) without any system settings configuration
  const labelKey = CONFIG.DCC.skillTableLabels?.[skillName]
  if (labelKey) {
    const localizedName = game.i18n.localize(labelKey)
    const worldTable = game.tables.getName(localizedName)
    if (worldTable) {
      return worldTable
    }
  }

  return null
}

/**
 * Show the d3 / d5 / d7 / d14 / d16 / d24 / d30 in Dice So Nice's
 * customization dialog.
 */
export function onDiceSoNiceReady (dice3d) {
  dice3d.showExtraDiceByDefault(true)
}

/**
 * Adventure import follow-up: enable map-note display and regenerate
 * scene thumbnails for every imported scene (the adventure packer
 * doesn't do it).
 */
export async function onImportAdventure () {
  // This is a client side setting so only the GM user is affected
  game.settings.set('core', foundry.canvas.layers.NotesLayer.TOGGLE_SETTING, true)

  // Regenerate all the scene thumbnails, since the adventure packer doesn't do that.
  // v14 reworked Scene#createThumbnail to render from a Level (the background
  // moved onto Level textures); the old `img` parameter is deprecated and
  // passing it — even as undefined — fires a compatibility warning per scene.
  // `initialLevel` already falls back to the scene's first Level, so resolve
  // it once and skip level-less scenes rather than letting createThumbnail
  // throw "The Level doesn't belong to this Scene".
  for (const scene of game.scenes) {
    const level = scene.initialLevel
    if (!level) continue
    const t = await scene.createThumbnail({ level: level.id })
    if (t?.thumb) {
      console.log(`Regenerated thumbnail for ${scene.name}`)
      await scene.update({ thumb: t.thumb })
    }
  }
}

/**
 * Add newly created world RollTables to the disapproval tables list if
 * they contain "Disapproval" (or the localized equivalent).
 */
export function onCreateRollTable (table) {
  if (isDisapprovalTable(table.name)) {
    // Use table name as key for de-duplication with compendium tables
    CONFIG.DCC.disapprovalTables[table.name] = {
      name: table.name,
      path: table.name
    }
  }

  // Add to Mighty Deed tables list if the name contains "Deed" (issue #319)
  if (isMightyDeedsTable(table.name)) {
    CONFIG.DCC.mightyDeedsTables[table.name] = {
      name: table.name,
      path: table.name
    }
  }
}

/**
 * Remove deleted world RollTables from the disapproval tables list.
 */
export function onDeleteRollTable (table) {
  // Use table name as key to find and delete
  delete CONFIG.DCC.disapprovalTables[table.name]
  delete CONFIG.DCC.mightyDeedsTables[table.name]
}

/**
 * Update world RollTable entries when the name changes. Rebuilds the
 * world-table half of `CONFIG.DCC.disapprovalTables` from scratch (the
 * compendium half is preserved by detecting paths containing `.`).
 */
export function onUpdateRollTable (table, changes) {
  if (changes.name) {
    // Rebuild world tables list to handle renames correctly
    // First, remove all world table entries (we'll re-add the valid ones)
    const compendiumTables = {}
    for (const [key, value] of Object.entries(CONFIG.DCC.disapprovalTables)) {
      // Keep compendium tables (they have paths with dots like "pack.table")
      if (value.path.includes('.')) {
        compendiumTables[key] = value
      }
    }

    // Reset to only compendium tables
    CONFIG.DCC.disapprovalTables = compendiumTables

    // Re-add all world disapproval tables
    for (const worldTable of game.tables) {
      if (isDisapprovalTable(worldTable.name)) {
        CONFIG.DCC.disapprovalTables[worldTable.name] = {
          name: worldTable.name,
          path: worldTable.name
        }
      }
    }

    // Rebuild the Mighty Deed world tables list the same way (issue #319)
    const deedCompendiumTables = {}
    for (const [key, value] of Object.entries(CONFIG.DCC.mightyDeedsTables)) {
      // Keep compendium tables (they have paths with dots like "pack.table")
      if (value.path.includes('.')) {
        deedCompendiumTables[key] = value
      }
    }
    CONFIG.DCC.mightyDeedsTables = deedCompendiumTables
    for (const worldTable of game.tables) {
      if (isMightyDeedsTable(worldTable.name)) {
        CONFIG.DCC.mightyDeedsTables[worldTable.name] = {
          name: worldTable.name,
          path: worldTable.name
        }
      }
    }
  }
}

export const TABLE_LOADING_HOOKS = Object.freeze({
  diceSoNiceReady: { handler: onDiceSoNiceReady, once: false },
  importAdventure: { handler: onImportAdventure, once: true },
  createRollTable: { handler: onCreateRollTable, once: false },
  deleteRollTable: { handler: onDeleteRollTable, once: false },
  updateRollTable: { handler: onUpdateRollTable, once: false }
})

export function registerTableLoadingHooks () {
  for (const [hookName, { handler, once }] of Object.entries(TABLE_LOADING_HOOKS)) {
    if (once) Hooks.once(hookName, handler)
    else Hooks.on(hookName, handler)
  }
}
