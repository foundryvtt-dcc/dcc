/* global foundry, game, ui */

/**
 * Core class keys used for migration lookups
 */
const CLASS_KEYS = ['Warrior', 'Thief', 'Halfling', 'Cleric', 'Wizard', 'Elf', 'Dwarf']

/**
 * Map numeric ActiveEffect mode values to v14 string type values
 */
const EFFECT_MODE_TO_TYPE = {
  0: 'custom',
  1: 'multiply',
  2: 'add',
  3: 'downgrade',
  4: 'upgrade',
  5: 'override'
}

/**
 * Lazy-loaded lookup table mapping localized class names to internal keys.
 * Only built if quick checks fail during migration.
 */
let classNameLookup = null

/**
 * Build lookup table from all lang files.
 * Called only when quick checks fail to find a match.
 * @returns {Promise<Object>} Map of localized class names to internal keys
 */
async function buildClassNameLookup () {
  if (classNameLookup) return classNameLookup

  classNameLookup = {}

  // English keys map to themselves
  for (const key of CLASS_KEYS) {
    classNameLookup[key] = key
  }

  // Load each lang file and extract class name translations
  const langs = ['de', 'es', 'fr', 'it', 'pl', 'cn']
  for (const lang of langs) {
    try {
      const response = await fetch(`systems/dcc/lang/${lang}.json`)
      const translations = await response.json()
      for (const key of CLASS_KEYS) {
        const localizedName = translations[`DCC.${key}`]
        if (localizedName) {
          classNameLookup[localizedName] = key
        }
      }
    } catch {
      // Lang file not found or failed to parse, skip
    }
  }

  return classNameLookup
}

/**
 * Version that triggers migration — set to the version that introduced
 * breaking changes. After migration completes we stamp the world at this
 * value to prevent repeated migrations.
 */
export const NEEDS_MIGRATION_VERSION = 0.68

/**
 * Floor for V14-era worlds. Worlds at or above this value can be migrated
 * forward by the surviving data-driven branches; worlds below it predate
 * V14 and must first upgrade through a pre-V14 DCC release.
 */
export const MINIMUM_SUPPORTED_VERSION = 0.66

/**
 * Classify what `checkMigrations` should do for a stored migration
 * version. Pure function — no Foundry globals — so it's unit-testable.
 *
 * @param {number|null} currentVersion  The stored `systemMigrationVersion`
 *   (Foundry returns 0 by default for never-stored settings, which maps
 *   to the same "fresh world" bucket as `null`).
 * @returns {'skip'|'block'|'run'}
 *   - `'skip'`: already migrated (>= ceiling), nothing to do.
 *   - `'block'`: known pre-V14 world, refuse and tell the user to upgrade
 *     through a pre-V14 release first.
 *   - `'run'`: fresh or V14-era world that still needs data-driven fixes;
 *     run `migrateWorld`.
 */
export function classifyMigrationDecision (currentVersion) {
  const needsMigration = (currentVersion == null) || (currentVersion < NEEDS_MIGRATION_VERSION)
  if (!needsMigration) return 'skip'
  if (currentVersion && currentVersion < MINIMUM_SUPPORTED_VERSION) return 'block'
  return 'run'
}

/**
 * Decide how `migrateWorld` should finish, given the list of per-document
 * failures it accumulated. Pure function — no Foundry globals — so the
 * stamp / notify policy is unit-testable in isolation (same pattern as
 * `classifyMigrationDecision`).
 *
 * Policy: a clean run stamps the world at `NEEDS_MIGRATION_VERSION` and
 * shows the "complete" notification. A run with any failed document does
 * NOT advance the version (so the world stays flagged and re-runs the —
 * idempotent — migrations on the next load after the GM resolves the
 * issue) and surfaces a `ui.notifications.warn` carrying the count. The
 * pre-this-change behavior swallowed each failure with a bare
 * `console.error` and stamped the version regardless, leaving a GM with
 * a green "complete" toast over a partially-migrated world.
 *
 * @param {Array<{type: string, name: string}>} failures - One entry per
 *   document whose migration threw. Empty array means a clean run.
 * @returns {{ stampVersion: boolean, notify: 'complete'|'failures', failureCount: number }}
 */
export function migrationOutcome (failures) {
  const failureCount = Array.isArray(failures) ? failures.length : 0
  return failureCount === 0
    ? { stampVersion: true, notify: 'complete', failureCount: 0 }
    : { stampVersion: false, notify: 'failures', failureCount }
}

/**
 * Migrate the current world to the current version of the system
 *
 * @return {Promise<{ migrationComplete: boolean }>}  Resolves once the
 *   migration finishes. `migrationComplete` is `true` for a clean run
 *   (version stamped) and `false` if any document failed (version left
 *   unstamped so the idempotent migrations re-run next load). The flag is
 *   threaded onto the `dcc.ready` payload via `checkMigrations`.
 */
export const migrateWorld = async function () {
  ui.notifications.info(game.i18n.format('DCC.MigrationInfo', { systemVersion: game.system.version }, { permanent: true }))

  // Per-document failures accumulate here so the run can report them as a
  // group and gate version-stamping (see `migrationOutcome`). Each catch
  // still logs the stack to the console for debugging.
  const failures = []

  // Migrate World Actors
  for (const a of game.actors) {
    try {
      const updateData = await migrateActorData(a)
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Actor', name: a.name }))
        await a.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
      failures.push({ type: 'Actor', name: a.name })
    }
  }

  // Migrate World Items
  for (const i of game.items) {
    try {
      const updateData = migrateItemData(i)
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Item', name: i.name }))
        await i.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
      failures.push({ type: 'Item', name: i.name })
    }
  }

  // Migrate Actor Override Tokens
  for (const s of game.scenes) {
    try {
      const updateData = await migrateSceneData(s)
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Scene', name: s.name }))
        await s.update(updateData, { enforceTypes: false })
      }
    } catch (err) {
      console.error(err)
      failures.push({ type: 'Scene', name: s.name })
    }
  }

  // Migrate World Compendium Packs
  const packs = game.packs.filter(p => {
    return (p.metadata.package === 'world') && ['Actor', 'Item', 'Scene'].includes(p.documentName)
  })
  for (const p of packs) {
    failures.push(...await migrateCompendium(p))
  }

  // Decide the finish: a clean run stamps the world at
  // `NEEDS_MIGRATION_VERSION` (so subsequent loads classify as 'skip'
  // in `classifyMigrationDecision`) and shows the "complete" toast; a
  // run with failures leaves the version unstamped (the idempotent
  // data-driven migrations re-run on the next load) and warns the GM
  // with the count rather than silently swallowing the errors.
  const outcome = migrationOutcome(failures)
  if (outcome.stampVersion) {
    game.settings.set('dcc', 'systemMigrationVersion', NEEDS_MIGRATION_VERSION)
    ui.notifications.info(game.i18n.format('DCC.MigrationComplete', { systemVersion: game.system.version }, { permanent: true }))
  } else {
    ui.notifications.warn(game.i18n.format('DCC.MigrationFailures', { count: outcome.failureCount }), { permanent: true })
  }

  return { migrationComplete: outcome.stampVersion }
}

/* -------------------------------------------- */

/**
 * Entry point the system's `ready` hook awaits before firing `dcc.ready`.
 * Decides — via `classifyMigrationDecision` — whether the stored migration
 * version needs work, and (when it does) **awaits** `migrateWorld` to
 * completion so the rest of the ready chain and any `dcc.ready` listeners
 * observe a fully-migrated world rather than racing the async per-document
 * mutations. Previously `dcc.js` called this fire-and-forget from a sync
 * ready callback, so `registerTables` / `FleetingLuck.init` / `dcc.ready`
 * et al. ran concurrently with the in-flight `update()` calls.
 *
 * Only the GM client migrates; other clients return immediately. The
 * returned `{ migrationComplete }` flag is threaded onto the `dcc.ready`
 * payload so sibling modules can branch on whether this client left the
 * world fully migrated:
 *   - `true`  — nothing to migrate (already at the ceiling), a non-GM
 *               client (never migrates locally), or a clean `migrateWorld`.
 *   - `false` — a pre-V14 world was refused (blocked), or `migrateWorld`
 *               finished with per-document failures (version left unstamped).
 *
 * @returns {Promise<{ migrationComplete: boolean }>}
 */
export const checkMigrations = async function () {
  if (!game.user.isGM) return { migrationComplete: true }
  const currentVersion = game.settings.get('dcc', 'systemMigrationVersion')
  const decision = classifyMigrationDecision(currentVersion)
  if (decision === 'skip') return { migrationComplete: true }
  if (decision === 'block') {
    // Toggles to a dot-separated string so the decimal separator doesn't
    // drift between interpolated and literal tokens in locales that format
    // numbers with a comma.
    ui.notifications.error(
      game.i18n.format('DCC.MigrationUnsupportedVersion', {
        currentVersion: currentVersion.toFixed(2),
        minimumVersion: MINIMUM_SUPPORTED_VERSION.toFixed(2)
      }),
      { permanent: true }
    )
    return { migrationComplete: false }
  }
  return migrateWorld()
}

/* -------------------------------------------- */

/**
 * Apply migration rules to all Entities within a single Compendium pack
 * @param pack
 * @return {Promise<Array<{type: string, name: string}>>}  Per-document
 *   failures (empty when clean), surfaced up to `migrateWorld` so they
 *   count toward the run's outcome.
 */
const migrateCompendium = async function (pack) {
  const documentName = pack.documentName
  if (!['Actor', 'Item', 'Scene'].includes(documentName)) return []

  const failures = []

  // Unlock the pack for editing
  const wasLocked = pack.locked
  await pack.configure({ locked: false })

  // Begin by requesting server-side data model migration and get the migrated documents
  await pack.migrate()
  const documents = await pack.getDocuments()

  // Iterate over compendium entries - applying fine-tuned migration functions
  for (const doc of documents) {
    try {
      let updateData = null
      switch (documentName) {
        case 'Item':
          updateData = migrateItemData(doc)
          break
        case 'Actor':
          updateData = await migrateActorData(doc)
          break
        case 'Scene':
          updateData = await migrateSceneData(doc)
          break
      }

      if (!foundry.utils.isEmpty(updateData)) {
        await doc.update(updateData)
        console.log(`Migrated ${documentName} document ${doc.name} in Compendium ${pack.collection}`)
      }
    } catch (err) {
      console.error(err)
      failures.push({ type: documentName, name: doc.name })
    }
  }

  // Apply the original locked status for the pack
  await pack.configure({ locked: wasLocked })

  console.log(`Migrated all ${documentName} documents from Compendium ${pack.collection}`)
  return failures
}

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 *
 * Exported for unit testing of its data-driven branches (V14 AE
 * numeric-mode → string-type conversion, `sheetClass`-from-`className`,
 * `critRange` / `disapproval` string→number, `luckyRoll` → `birthAugur`,
 * default alignment, #739 speed-base seed). Not part of the Foundry-facing
 * API — internal migration helper only.
 *
 * @param {Actor} actor   The actor to Update
 * @return {Promise<Object>}       The updateData to apply
 */
export const migrateActorData = async function (actor) {
  const updateData = {}

  if (actor.system.details.luckyRoll) {
    updateData['system.details.birthAugur'] = actor.system.details.luckyRoll
  }

  if (!actor.system?.details?.alignment) {
    updateData['system.details.alignment'] = 'l'
  }

  // Convert critRange and disapproval from string to number if needed (data-driven check)
  const critRange = actor.system?.details?.critRange
  if (typeof critRange === 'string') {
    updateData['system.details.critRange'] = parseInt(critRange) || 20
  }
  const disapproval = actor.system?.class?.disapproval
  if (typeof disapproval === 'string') {
    updateData['system.class.disapproval'] = parseInt(disapproval) || 1
  }

  // Set sheetClass from className for existing actors to prevent class setup overwriting values
  if (!actor.system?.details?.sheetClass && actor.system?.class?.className) {
    const className = actor.system.class.className

    // Quick check 1: Is it already an English/internal key?
    if (CLASS_KEYS.includes(className)) {
      updateData['system.details.sheetClass'] = className
    } else {
      // Quick check 2: Does it match the current locale?
      const localeMatch = CLASS_KEYS.find(key => game.i18n.localize(`DCC.${key}`) === className)
      if (localeMatch) {
        updateData['system.details.sheetClass'] = localeMatch
      } else {
        // Edge case: Load all translations and check
        const lookup = await buildClassNameLookup()
        // Use lookup result, or fall back to className for third-party classes
        updateData['system.details.sheetClass'] = lookup[className] || className
      }
    }
  }

  // Convert ActiveEffect changes for v14 compatibility (data-driven check)
  // - Convert numeric mode to string type
  if (actor.effects?.length) {
    const migratedEffects = []
    let hasEffectUpdates = false
    for (const effect of actor.effects) {
      const effectData = effect.toObject ? effect.toObject() : foundry.utils.deepClone(effect)
      if (effectData.changes?.length) {
        let effectModified = false
        for (const change of effectData.changes) {
          // Convert numeric mode to string type if needed
          if (typeof change.mode === 'number' && change.type === undefined) {
            change.type = EFFECT_MODE_TO_TYPE[change.mode] || 'add'
            delete change.mode
            effectModified = true
          }
        }
        if (effectModified) {
          hasEffectUpdates = true
        }
      }
      migratedEffects.push(effectData)
    }
    if (hasEffectUpdates) {
      updateData.effects = migratedEffects
    }
  }

  // Seed base speed from the persisted displayed speed so computed speed
  // derives from the character's real speed rather than the schema default.
  // Data-driven: only seeds when base is unset or still the '30' default while
  // the displayed value differs (#739). Reads raw _source so a schema-defaulted
  // base does not mask a genuinely-unset value.
  const rawSpeed = actor._source?.system?.attributes?.speed || {}
  const rawSpeedBase = rawSpeed.base
  const rawSpeedValue = rawSpeed.value
  // Compare parsed integers so unit-bearing values (e.g. "30'") aren't treated
  // as different from the unitless '30' default, and store base unitless (#739).
  const speedBaseNum = parseInt(rawSpeedBase)
  const speedValueNum = parseInt(rawSpeedValue)
  const speedBaseUnsetOrDefault = rawSpeedBase === undefined || rawSpeedBase === null || rawSpeedBase === '' || speedBaseNum === 30
  if (speedBaseUnsetOrDefault && !isNaN(speedValueNum) && speedValueNum !== speedBaseNum) {
    updateData['system.attributes.speed.base'] = String(speedValueNum)
  }

  // Migrate Owned Items
  let hasItemUpdates = false
  let items = []
  if (actor.items) {
    items = actor.items.map(i => {
      // Migrate the Owned Item
      const itemUpdate = migrateItemData(i)

      // Update the Owned Item
      if (!foundry.utils.isEmpty(itemUpdate)) {
        hasItemUpdates = true
        return foundry.utils.mergeObject(i, itemUpdate, { enforceTypes: false, inplace: false })
      } else {
        return i
      }
    })
  }

  if (hasItemUpdates) {
    updateData.items = items
  }

  return updateData
}

/* -------------------------------------------- */

/**
 * Migrate a single Item document to incorporate latest data model changes
 *
 * Exported for unit testing of its V14 AE numeric-mode → string-type
 * conversion branch. Not part of the Foundry-facing API — internal
 * migration helper only.
 *
 * @param item
 */
export const migrateItemData = function (item) {
  const updateData = {}

  // Convert ActiveEffect changes for v14 compatibility (data-driven check)
  // - Convert numeric mode to string type
  if (item.effects?.length) {
    const migratedEffects = []
    let hasEffectUpdates = false
    for (const effect of item.effects) {
      const effectData = effect.toObject ? effect.toObject() : foundry.utils.deepClone(effect)
      if (effectData.changes?.length) {
        let effectModified = false
        for (const change of effectData.changes) {
          // Convert numeric mode to string type if needed
          if (typeof change.mode === 'number' && change.type === undefined) {
            change.type = EFFECT_MODE_TO_TYPE[change.mode] || 'add'
            delete change.mode
            effectModified = true
          }
        }
        if (effectModified) {
          hasEffectUpdates = true
        }
      }
      migratedEffects.push(effectData)
    }
    if (hasEffectUpdates) {
      updateData.effects = migratedEffects
    }
  }

  // Return the migrated update data
  return updateData
}

/* -------------------------------------------- */

/**
 * Migrate a single Scene document to incorporate changes to the data model of its actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @return {Promise<Object>}       The updateData to apply
 */
const migrateSceneData = async function (scene) {
  const tokens = []
  for (const token of scene.tokens) {
    const t = token.toObject()
    const update = {}
    if (Object.keys(update).length) foundry.utils.mergeObject(t, update)
    if (!t.actorId || t.actorLink) {
      t.actorData = {}
    } else if (!game.actors.has(t.actorId)) {
      t.actorId = null
      t.actorData = {}
    } else if (!t.actorLink) {
      const actorData = foundry.utils.deepClone(t.actorData)
      actorData.type = token.actor?.type
      const actorUpdate = await migrateActorData(actorData);
      ['items', 'effects'].forEach(embeddedName => {
        if (!actorUpdate[embeddedName]?.length) return
        const updates = new Map(actorUpdate[embeddedName].map(u => [u._id, u]))
        t.actorData[embeddedName].forEach(original => {
          const embeddedUpdate = updates.get(original._id)
          if (embeddedUpdate) foundry.utils.mergeObject(original, embeddedUpdate)
        })
        delete actorUpdate[embeddedName]
      })

      foundry.utils.mergeObject(t.actorData, actorUpdate)
    }
    tokens.push(t)
  }
  return { tokens }
}
