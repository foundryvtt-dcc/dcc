/* global foundry, game, ui */

import { getSingleActionDie, inferWeaponDie } from './utilities.js'

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
 *
 * 0.70: re-sweep to seed `attributes.actionDice.value` from
 * `config.actionDice` when the persisted value is blank or still the 1d20
 * schema default while the config die differs (the skill/check paths and
 * Dice Chain effects read the attributes value; older importers only wrote
 * the config string, leaving the default behind).
 *
 * 0.71: re-sweep because the scene sweep was a silent no-op before —
 * `migrateSceneData` keyed on the pre-v11 `actorData` field, so unlinked
 * scene tokens never received any actor migration (including 0.70's
 * action-die seed). All branches are data-driven/idempotent, so each
 * ceiling bump costs one extra pass.
 *
 * 0.72: re-sweep to persist the weapon-die split for legacy-shape weapons
 * (`damage` stored with no `damageWeapon`). item.js no longer re-derives
 * the split heuristically on every prepare (#907), so shapes it can
 * attribute confidently — a bare die, or die + the owning actor's current
 * damage bonus — are stamped into `damageWeapon` here; anything ambiguous
 * is left untouched and rolls as stored.
 */
export const NEEDS_MIGRATION_VERSION = 0.72

/**
 * Floor below which a world must first pass through a pre-V14 DCC release.
 *
 * The pre-V14 lines (0.65.x / 0.66.x) only RUN their migration when the
 * stored version is `<= 0.22` (their own `NEEDS_MIGRATION_VERSION` gate),
 * so those are the only worlds a pre-V14 release can actually carry forward
 * (it stamps them up to 0.66). Worlds stamped in the `(0.22, 0.71)` band are
 * skipped by the pre-V14 gate, so the old "open in a pre-V14 release first"
 * instruction never advanced them — they sat below the previous 0.66 floor
 * forever. They are migrated in place here instead, by the data-driven
 * branches plus the version-gated fixups in `migrateActorData`. The floor is
 * therefore the pre-V14 gate value, not 0.66 (issue #774).
 */
export const MINIMUM_SUPPORTED_VERSION = 0.22

/**
 * Classify what `checkMigrations` should do for a stored migration
 * version. Pure function — no Foundry globals — so it's unit-testable.
 *
 * @param {number|null} currentVersion  The stored `systemMigrationVersion`
 *   (Foundry returns 0 by default for never-stored settings, which maps
 *   to the same "fresh world" bucket as `null`).
 * @returns {'skip'|'block'|'run'}
 *   - `'skip'`: already migrated (>= ceiling), nothing to do.
 *   - `'block'`: an ancient world (below `MINIMUM_SUPPORTED_VERSION`) a
 *     pre-V14 release CAN still carry forward — refuse and tell the user to
 *     upgrade through a pre-V14 release first.
 *   - `'run'`: fresh world, or any world in the `[floor, ceiling)` band that
 *     still needs data-driven + version-gated fixes; run `migrateWorld`.
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
 * Policy: a completed run ALWAYS advances the stored version to
 * `NEEDS_MIGRATION_VERSION` — `stampVersion` is `true` whether the run was
 * clean or hit per-document failures. A clean run also shows the "complete"
 * notification; a run with failures stamps anyway but warns the GM with the
 * failure count (and logs each stack) so the failed documents are visible
 * for manual repair.
 *
 * Why stamp on failure (issue #777): the previous policy left the version
 * UNSTAMPED on any failure so the idempotent migrations would re-run next
 * load. But `checkMigrations` re-runs `migrateWorld` on EVERY subsequent
 * boot until it's stamped, and `migrateWorld` `.update()`s every actor and
 * item each pass. A single permanently-failing document (e.g. one an active
 * sheet-overriding module like Item Piles rejects in its own update hook)
 * therefore turned world load into a perpetual world-wide `update()` storm —
 * and, with that module live, re-fired its hooks every boot, so restoring a
 * clean backup never stuck (the next load re-mutated it). Guaranteeing
 * forward progress sweeps a partially-failing world exactly ONCE; the GM
 * fixes the flagged documents and re-migrates them manually (e.g. via the
 * "Repair Sheet Overrides" macro) rather than the system re-sweeping forever.
 *
 * `clean` is surfaced separately so callers can keep the prior
 * `migrationComplete` semantics (true only for a fully-clean run) on the
 * `dcc.ready` payload while the version is stamped regardless.
 *
 * @param {Array<{type: string, name: string}>} failures - One entry per
 *   document whose migration threw. Empty array means a clean run.
 * @returns {{ stampVersion: boolean, clean: boolean, notify: 'complete'|'failures', failureCount: number }}
 */
export function migrationOutcome (failures) {
  const failureCount = Array.isArray(failures) ? failures.length : 0
  const clean = failureCount === 0
  return {
    stampVersion: true,
    clean,
    notify: clean ? 'complete' : 'failures',
    failureCount
  }
}

/**
 * Migrate the current world to the current version of the system
 *
 * @return {Promise<{ migrationComplete: boolean }>}  Resolves once the
 *   migration finishes. `migrationComplete` is `true` for a clean run and
 *   `false` if any document failed. Either way the stored version is now
 *   stamped (issue #777) — a failing world is swept once, not on every
 *   load — so `migrationComplete: false` means "stamped, but some documents
 *   need manual repair", not "will re-run next load". The flag is threaded
 *   onto the `dcc.ready` payload via `checkMigrations`.
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

  // Migrate unlinked-token synthetic actors (the scene sweep updates the
  // token deltas itself rather than returning scene updateData).
  for (const s of game.scenes) {
    try {
      const migratedTokens = await migrateSceneData(s)
      if (migratedTokens > 0) {
        console.log(game.i18n.format('DCC.MigrationMessage', { type: 'Scene', name: s.name }))
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

  // Decide the finish: stamp the world at `NEEDS_MIGRATION_VERSION`
  // unconditionally once the run completes (so subsequent loads classify
  // as 'skip' in `classifyMigrationDecision` and the world is swept once,
  // not re-swept on every boot — issue #777). A clean run shows the
  // "complete" toast; a run with failures stamps anyway but logs the
  // failed documents and warns the GM with the count so they can be
  // repaired and re-migrated manually rather than the system re-running
  // the whole world's updates forever.
  const outcome = migrationOutcome(failures)
  if (outcome.stampVersion) {
    game.settings.set('dcc', 'systemMigrationVersion', NEEDS_MIGRATION_VERSION)
  }
  if (outcome.clean) {
    ui.notifications.info(game.i18n.format('DCC.MigrationComplete', { systemVersion: game.system.version }, { permanent: true }))
  } else {
    console.warn(`DCC | Migration completed with ${outcome.failureCount} failed document(s); version stamped to halt the re-run loop. Failed:`, failures)
    ui.notifications.warn(game.i18n.format('DCC.MigrationFailures', { count: outcome.failureCount }), { permanent: true })
  }

  return { migrationComplete: outcome.clean }
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
 *   - `false` — an ancient world was refused (blocked), or `migrateWorld`
 *               finished with per-document failures (version still stamped
 *               to halt the re-run loop; flagged documents need manual
 *               repair — issue #777).
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
          // The scene sweep updates unlinked-token deltas directly and
          // returns a count, not updateData — nothing to doc.update() here.
          await migrateSceneData(doc)
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

  // Version-gated fixup for worlds that predate a schema change but were never
  // carried through a pre-V14 release (the pre-V14 gate is `<= 0.22`, so worlds
  // in the `(0.22, 0.66)` band slipped past it). The data-model floor blocks
  // anything below `MINIMUM_SUPPORTED_VERSION`, so only branches at/above that
  // floor can ever fire here (issue #774). The 0.65 base-speed split is already
  // handled data-driven below (it reads `_source` to see past the schema
  // default), so only the 0.50 attackHitBonus split needs an explicit gate.
  const currentVersion = game.settings.get('dcc', 'systemMigrationVersion')

  // If migrating from 0.50 or earlier, seed the per-mode attackHitBonus from the
  // legacy flat attackBonus — these worlds predate the melee/missile split, so
  // their attackHitBonus is still the schema default.
  if (currentVersion <= 0.50 && actor.system?.details?.attackBonus !== undefined) {
    updateData['system.details.attackHitBonus.melee.value'] = actor.system.details.attackBonus
    updateData['system.details.attackHitBonus.missile.value'] = actor.system.details.attackBonus
  }

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

  // Seed the sheet's single action die from the config authoring string. The
  // sheet, ability checks, and the skill fallback read
  // `attributes.actionDice.value` (also the documented Dice Chain effect
  // target), but older importers and hand-edits only populated
  // `config.actionDice`. Two repair cases, both reading raw _source so a
  // schema-defaulted value doesn't mask a genuinely-unset one (#739 pattern):
  //   1. A blank persisted value adopts the config die.
  //   2. A persisted value still at the '1d20' schema default adopts a
  //      DIFFERING config die — actors imported before the importers set the
  //      value persisted the default at creation, so the default + a non-d20
  //      config is drift, not a choice. Any other persisted value is a real
  //      hand-edit and is never overwritten.
  // The config die is normalized to a single die of the first listed faces
  // like the importers ('1d20,1d16' → 1d20, '2d20' → 1d20). Idempotent: once
  // adopted, the value no longer matches blank/default and is left alone.
  const rawActionDieValue = actor._source?.system?.attributes?.actionDice?.value
  const trimmedActionDieValue = rawActionDieValue == null ? '' : String(rawActionDieValue).trim()
  const configActionDice = actor._source?.system?.config?.actionDice ?? actor.system?.config?.actionDice
  const configActionDie = getSingleActionDie(configActionDice)
  const actionDieBlank = trimmedActionDieValue === ''
  const actionDieAtDefault = trimmedActionDieValue === '1d20'
  if (configActionDie && (actionDieBlank || (actionDieAtDefault && configActionDie !== trimmedActionDieValue))) {
    updateData['system.attributes.actionDice.value'] = configActionDie
  }

  // Migrate Owned Items
  // Player actors pass their current damage bonuses so the legacy weapon-die
  // split can attribute a matching baked-in modifier (#907); NPC (and Party)
  // weapons use `damage` directly (no composition), so the split is skipped
  // for them — matching DCCItem._preCreate's Player-only gate.
  const weaponContext = actor.type === 'Player'
    ? {
        damageBonusMelee: actor.system?.details?.attackDamageBonus?.melee?.value || '',
        damageBonusMissile: actor.system?.details?.attackDamageBonus?.missile?.value || ''
      }
    : { skipWeapons: true }
  // Each changed item becomes a plain `{_id, ...changes}` delta — the
  // differential embedded-update shape `Actor#update` persists to _source.
  // The previous `mergeObject(itemDocument, update)` pattern wrote the
  // changes onto the live document's *prepared* data (deepClone returns
  // class instances by reference), which document serialization — reading
  // _source — then dropped, so owned-item updates could silently fail to
  // persist (#907 review).
  const itemUpdates = []
  for (const i of actor.items ?? []) {
    const itemUpdate = migrateItemData(i, weaponContext)
    if (!foundry.utils.isEmpty(itemUpdate)) {
      itemUpdates.push({ _id: i._id ?? i.id, ...itemUpdate })
    }
  }
  if (itemUpdates.length > 0) {
    updateData.items = itemUpdates
  }

  return updateData
}

/* -------------------------------------------- */

/**
 * Migrate a single Item document to incorporate latest data model changes
 *
 * Exported for unit testing of its V14 AE numeric-mode → string-type
 * conversion branch and the legacy weapon-die split (#907). Not part of
 * the Foundry-facing API — internal migration helper only.
 *
 * @param {Item} item
 * @param {Object} [options]
 * @param {boolean} [options.skipWeapons] - Skip the weapon-die split
 *   (NPC-owned weapons use `damage` directly, no composition)
 * @param {string} [options.damageBonusMelee] - Owning actor's current melee
 *   damage bonus, for attributing a baked-in modifier
 * @param {string} [options.damageBonusMissile] - Owning actor's current
 *   missile damage bonus
 */
export const migrateItemData = function (item, options = {}) {
  const updateData = {}

  // Persist the weapon-die split for legacy-shape weapons: `damage` stored
  // with no `damageWeapon` and no override (#907). Reads raw _source so the
  // new prepare path (which no longer re-derives the split) can't mask the
  // persisted state. Data-driven and idempotent: once `damageWeapon` is
  // set, the branch never fires again. Only confident shapes are stamped —
  // a bare die, or die + the owner's current damage bonus (world items have
  // no owner context, so only the bare die qualifies); ambiguous formulas
  // are left untouched and roll as stored.
  if (item.type === 'weapon' && !options.skipWeapons) {
    const source = item._source?.system ?? item.system
    if (source?.damage && !source.damageWeapon && !source.config?.damageOverride) {
      const bonus = (source.melee !== false)
        ? options.damageBonusMelee
        : options.damageBonusMissile
      const damageWeapon = inferWeaponDie(source.damage, bonus || '')
      if (damageWeapon) {
        updateData['system.damageWeapon'] = damageWeapon
      }
    }
  }

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
 * Migrate a Scene's unlinked tokens.
 *
 * v11 removed `TokenDocument#actorData` in favor of the ActorDelta
 * `delta` document, so the previous implementation — which keyed the
 * unlinked-token branch on `t.actorData` — never matched a token and the
 * whole sweep silently no-opped on every scene. Instead of rebuilding a
 * `tokens` update array from raw deltas, migrate each unlinked token's
 * *synthetic actor* directly: `token.actor` materializes base + delta
 * (so `migrateActorData`'s `_source` reads see the real persisted
 * state), and `Actor#update` on a synthetic actor writes back into the
 * token's delta. Linked tokens are covered by the world-actor sweep;
 * tokens whose base actor is missing have no synthetic actor and are
 * skipped.
 *
 * @param {Scene} scene  The Scene whose tokens to migrate
 * @return {Promise<number>}  The number of token actors that were updated
 */
const migrateSceneData = async function (scene) {
  let migrated = 0
  for (const token of scene.tokens) {
    if (token.actorLink || !token.actor) continue
    const updateData = await migrateActorData(token.actor)
    if (!foundry.utils.isEmpty(updateData)) {
      await token.actor.update(updateData, { enforceTypes: false })
      migrated++
    }
  }
  return migrated
}
