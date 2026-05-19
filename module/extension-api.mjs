/**
 * Stable extension-API helpers exposed via `game.dcc`.
 *
 * Each export here is **stable from day one** per
 * `docs/dev/EXTENSION_API.md` — the surface relieves an
 * `ARCHITECTURE_REIMAGINED.md §2` pain point that would otherwise
 * leak into core if module authors had to invent their own boilerplate.
 *
 * Stay narrow: each helper does ONE thing and binds to ONE existing
 * pain point.
 */

/**
 * Register an Item sheet for the DCC system. Closes the
 * `Items.unregisterSheet('core', ItemSheetV2) + Items.registerSheet(…)`
 * boilerplate that §2.5 (extension surface is lopsided) calls out.
 *
 * Without this helper, a module shipping a custom item sheet has to
 * issue two Foundry calls in the right order — the unregister first,
 * then the register, with `ItemSheetV2` reached through
 * `foundry.applications.sheets.ItemSheetV2`. Forgetting either step
 * leaves Foundry's default sheet competing for default-pick. Pre-Phase
 * 3, XCC and similar variants either had to know the exact incantation
 * or fight Foundry over default sheet selection.
 *
 * `makeDefault: true` (the common case) folds the unregister into the
 * call. `makeDefault: false` simply registers as an additional sheet
 * option without disturbing the existing default.
 *
 * @param {string | string[] | undefined} types - Item sub-type(s) the
 *   sheet handles. `undefined` registers across all sub-types.
 * @param {typeof foundry.applications.api.DocumentSheetV2} SheetClass -
 *   The sheet to register.
 * @param {object} [options]
 * @param {string} [options.scope='dcc'] - Namespace scope (used by
 *   Foundry as part of the sheet-id).
 * @param {string} [options.label] - i18n key for the sheet's label.
 * @param {boolean} [options.makeDefault=false] - When true, also
 *   unregister the Foundry-core default `ItemSheetV2` for the same
 *   `types` so this sheet wins the default-pick.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.Items] - `Items` collection (defaults to
 *   `globalThis.Items`).
 * @param {Function} [deps.ItemSheetV2] - Default item sheet class
 *   (defaults to `foundry.applications.sheets.ItemSheetV2`).
 */
export function registerItemSheet (types, SheetClass, options = {}, deps = {}) {
  const ItemsImpl = deps.Items ??
    globalThis.foundry?.documents?.collections?.Items ??
    globalThis.Items
  const ItemSheetV2Impl = deps.ItemSheetV2 ??
    globalThis.foundry?.applications?.sheets?.ItemSheetV2 ??
    globalThis.ItemSheetV2

  if (!SheetClass) {
    throw new Error('registerItemSheet: SheetClass is required')
  }
  if (!ItemsImpl?.registerSheet) {
    throw new Error('registerItemSheet: Foundry `Items` collection unavailable')
  }

  const normalizedTypes = Array.isArray(types)
    ? types
    : (typeof types === 'string' && types.length ? [types] : undefined)
  const { scope = 'dcc', label, makeDefault = false } = options

  if (makeDefault && ItemSheetV2Impl && ItemsImpl.unregisterSheet) {
    ItemsImpl.unregisterSheet(
      'core',
      ItemSheetV2Impl,
      normalizedTypes ? { types: normalizedTypes } : undefined
    )
  }

  const registerOptions = { label, makeDefault }
  if (normalizedTypes) registerOptions.types = normalizedTypes
  ItemsImpl.registerSheet(scope, SheetClass, registerOptions)
}

/**
 * Register an Actor sheet for the DCC system. Mirror of
 * `registerItemSheet` for the Actor side. Closes the same §2.5 /
 * §2.11 pain points: sibling modules (XCC, MCC, dcc-crawl-classes)
 * each have 7–19 `Actors.registerSheet('<scope>', SheetClass, { types,
 * label })` boilerplate calls; this helper turns each into a
 * one-liner that also handles the unregister-default dance for the
 * `makeDefault: true` cases without the caller having to remember
 * `foundry.applications.sheets.ActorSheetV2`.
 *
 * Stable from day one (per `EXTENSION_API.md` recommendation 7).
 *
 * @param {string | string[] | undefined} types - Actor sub-type(s)
 *   the sheet handles (`'Player'`, `'NPC'`, `'Party'`, etc.).
 *   `undefined` registers across all sub-types.
 * @param {typeof foundry.applications.api.DocumentSheetV2} SheetClass -
 *   The sheet to register.
 * @param {object} [options]
 * @param {string} [options.scope='dcc'] - Namespace scope. Sibling
 *   modules pass their own scope (`'xcc'`, `'mcc-healer'`, etc.) so
 *   the resulting sheet id is per-module unique.
 * @param {string} [options.label] - i18n key for the sheet's label.
 * @param {boolean} [options.makeDefault=false] - When true, also
 *   unregister the Foundry-core default `ActorSheetV2` for the same
 *   `types` so this sheet wins the default-pick. Common case for the
 *   primary system sheet (DCC's NPC sheet, party sheet); class-specific
 *   variant sheets (XCC's per-class list) typically pass false.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.Actors] - `Actors` collection (defaults to
 *   `foundry.documents.collections.Actors` / `globalThis.Actors`).
 * @param {Function} [deps.ActorSheetV2] - Default actor sheet class
 *   (defaults to `foundry.applications.sheets.ActorSheetV2`).
 */
export function registerActorSheet (types, SheetClass, options = {}, deps = {}) {
  const ActorsImpl = deps.Actors ??
    globalThis.foundry?.documents?.collections?.Actors ??
    globalThis.Actors
  const ActorSheetV2Impl = deps.ActorSheetV2 ??
    globalThis.foundry?.applications?.sheets?.ActorSheetV2 ??
    globalThis.ActorSheetV2

  if (!SheetClass) {
    throw new Error('registerActorSheet: SheetClass is required')
  }
  if (!ActorsImpl?.registerSheet) {
    throw new Error('registerActorSheet: Foundry `Actors` collection unavailable')
  }

  const normalizedTypes = Array.isArray(types)
    ? types
    : (typeof types === 'string' && types.length ? [types] : undefined)
  const { scope = 'dcc', label, makeDefault = false } = options

  if (makeDefault && ActorSheetV2Impl && ActorsImpl.unregisterSheet) {
    ActorsImpl.unregisterSheet(
      'core',
      ActorSheetV2Impl,
      normalizedTypes ? { types: normalizedTypes } : undefined
    )
  }

  const registerOptions = { label, makeDefault }
  if (normalizedTypes) registerOptions.types = normalizedTypes
  ActorsImpl.registerSheet(scope, SheetClass, registerOptions)
}

/**
 * Register a class-specific schema mixin for the Player document type.
 * Closes the §2.1 (monolithic Player schema) pain point: today every
 * Player carries every official DCC class's fields hardcoded in
 * `module/data/actor/player-data.mjs`, and sibling modules can only
 * *add* via `dcc.definePlayerSchema` — they cannot relocate the
 * built-in fields. `registerClassMixin` lets the system itself
 * contribute class-specific schema fields through the same registry
 * that sibling modules will use for homebrew classes (Phase 4 / §2.8).
 *
 * The mixin function is invoked during `PlayerData.defineSchema()`
 * (after the static base body, **before** the existing
 * `dcc.definePlayerSchema` hook fires) with the in-progress schema
 * object. Mixins typically attach fresh `SchemaField` instances onto
 * `schema.skills.fields` or `schema.class.fields` — each call must
 * build new field instances because Foundry's TypeDataModel may
 * re-invoke `defineSchema()` and field objects are not shareable
 * across schemas.
 *
 * Phase 4 session 1 ships this hook alongside a built-in `'halfling'`
 * mixin that contributes the `sneakAndHide` skill. Subsequent phases
 * relocate additional class-bound fields (thief skills, cleric
 * disapproval, wizard patron, etc.) onto their respective mixins.
 *
 * `classId` is the lowercase canonical class identifier (`'halfling'`,
 * `'warrior'`, `'cleric'`, …) — the same convention `EXTENSION_API.md`
 * documents for class dispatch. Re-registering an existing `classId`
 * silently overwrites the prior mixin (matches the mercurial-magic
 * registry's last-write-wins semantic).
 *
 * Stable from day one (per `EXTENSION_API.md` recommendation 7).
 *
 * @param {string} classId - lowercase canonical class identifier.
 * @param {(schema: object) => void} mixinFn - mutator invoked with the
 *   in-progress Player schema; expected to add fields under
 *   `schema.skills.fields` / `schema.class.fields` / etc.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.CONFIG] - `CONFIG` namespace (defaults to
 *   `globalThis.CONFIG`).
 */
export function registerClassMixin (classId, mixinFn, deps = {}) {
  const CONFIGImpl = deps.CONFIG ?? globalThis.CONFIG
  if (!classId || typeof classId !== 'string') {
    throw new Error('registerClassMixin: classId must be a non-empty string')
  }
  if (typeof mixinFn !== 'function') {
    throw new Error('registerClassMixin: mixinFn must be a function')
  }
  if (!CONFIGImpl?.DCC) {
    throw new Error('registerClassMixin: CONFIG.DCC unavailable')
  }
  CONFIGImpl.DCC.classMixins ??= {}
  CONFIGImpl.DCC.classMixins[classId] = mixinFn
}

/**
 * Apply all registered class mixins to a Player schema in deterministic
 * order. Used by `PlayerData.defineSchema()`; the deterministic-order
 * guarantee (sorted classId keys) makes the resulting schema shape
 * reproducible regardless of mixin registration order, which matters
 * for migration replay + test determinism. Exported for tests; not
 * part of the public `game.dcc.*` surface.
 *
 * @param {object} schema - the in-progress Player schema being built.
 * @param {object} [deps] - Dependency injection for tests.
 * @param {object} [deps.CONFIG] - `CONFIG` namespace (defaults to
 *   `globalThis.CONFIG`).
 */
export function applyClassMixins (schema, deps = {}) {
  const CONFIGImpl = deps.CONFIG ?? globalThis.CONFIG
  const registry = CONFIGImpl?.DCC?.classMixins
  if (!registry) return
  const classIds = Object.keys(registry).sort()
  for (const classId of classIds) {
    const mixinFn = registry[classId]
    if (typeof mixinFn === 'function') {
      mixinFn(schema)
    }
  }
}

/**
 * Register class identity + mechanical defaults that a sheet writes
 * onto an actor the first time it opens. Closes the §2.11 (class sheets
 * fight Foundry) pain point: today every class sheet subclass in
 * `module/actor-sheets-dcc.js` carries a near-identical
 * `_prepareContext` first-open block that writes ~10 `system.*` fields
 * onto the document — class identity (className, classLink, sheetClass,
 * optional enriched-HTML link blobs), mechanical defaults (critRange,
 * disapproval, attackBonusMode, addClassLevelToInitiative,
 * spellCheckAbility, showBackstab, showSpells), and skill-activation
 * toggles (notably `skills.shieldBash.useDeed`).
 *
 * Phase 5 session 1 lifts those blocks onto a per-class registry. The
 * sheet subclasses call `applyClassDefaults(actor, classId)` instead;
 * the per-class data lives in `module/built-in-class-defaults.mjs`
 * and sibling modules contribute homebrew entries via this helper.
 *
 * The `defaults` payload is a plain object with three sub-bags so the
 * helper can localize / enrich-HTML / pass-through without baking the
 * Foundry text-pipeline knowledge into every registration:
 *
 * - `defaults.sheetClass` (string, required) — capitalized canonical
 *   sheet-class label written onto `system.details.sheetClass`. Also
 *   serves as the dispatch sentinel: the initial-setup branch fires
 *   when `actor.system.details.sheetClass !== defaults.sheetClass`.
 * - `defaults.localize` (object) — paths under `system.` mapped to
 *   i18n keys. `applyClassDefaults` resolves each via `i18n.localize`.
 *   Typically `{ 'class.className': 'DCC.<Class>' }`.
 * - `defaults.enrichHtml` (object) — paths under `system.` mapped to
 *   i18n keys whose localized value is run through `TextEditor.enrichHTML`
 *   before writing. Typically `{ 'class.classLink': 'DCC.<Class>ClassLink' }`
 *   plus optional `mightyDeedsLink` / `spellcastingLink` / `spellburnLink`.
 * - `defaults.literal` (object) — paths under `system.` mapped to
 *   pre-resolved scalar values (numbers, booleans, strings, null).
 *   Written verbatim.
 *
 * `classId` is the lowercase canonical class identifier (`'halfling'`,
 * `'warrior'`, `'cleric'`, …) matching the convention used by
 * `registerClassMixin` and the `DCCActor.classId` accessor. Re-registering
 * an existing `classId` silently overwrites the prior entry
 * (last-write-wins, matching `registerClassMixin`'s semantic).
 *
 * Stable from day one (per `EXTENSION_API.md` recommendation 7).
 *
 * @param {string} classId - lowercase canonical class identifier.
 * @param {object} defaults - registration payload as documented above.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.CONFIG] - `CONFIG` namespace (defaults to
 *   `globalThis.CONFIG`).
 */
export function registerClassDefaults (classId, defaults, deps = {}) {
  const CONFIGImpl = deps.CONFIG ?? globalThis.CONFIG
  if (!classId || typeof classId !== 'string') {
    throw new Error('registerClassDefaults: classId must be a non-empty string')
  }
  if (!defaults || typeof defaults !== 'object') {
    throw new Error('registerClassDefaults: defaults must be an object')
  }
  if (typeof defaults.sheetClass !== 'string' || !defaults.sheetClass) {
    throw new Error('registerClassDefaults: defaults.sheetClass must be a non-empty string')
  }
  if (!CONFIGImpl?.DCC) {
    throw new Error('registerClassDefaults: CONFIG.DCC unavailable')
  }
  CONFIGImpl.DCC.classDefaults ??= {}
  CONFIGImpl.DCC.classDefaults[classId] = defaults
}

/**
 * Apply a registered class-defaults entry to an actor. Mirrors the
 * legacy `_prepareContext` first-open + classLink-regenerate logic each
 * class sheet used to inline.
 *
 * Returns a status string so callers (notably the dwarf sheet, which
 * still inlines a starting-items auto-create until the
 * `registerClassStartingItems` slice lands) can branch on whether the
 * initial-setup write fired:
 *
 * - `'initialized'` — `system.details.sheetClass` did not match the
 *   registered `sheetClass`; the helper wrote the full update payload.
 * - `'regenerated'` — `sheetClass` matched but `system.class.classLink`
 *   was empty (compendium link target wasn't installed when the actor
 *   was first created); the helper re-ran `enrichHtml` for every
 *   registered enriched-HTML path.
 * - `'unchanged'` — no write occurred (either the registry entry is
 *   missing or both branches' preconditions failed).
 *
 * No-op (returns `'unchanged'`) if the classId isn't registered. The
 * helper itself never throws on a missing registry — sheet open is a
 * boot-critical path and a missing registration should degrade to the
 * legacy "no first-open setup" behavior rather than crash the sheet.
 *
 * @param {object} actor - DCCActor (Player) to apply defaults onto.
 * @param {string} classId - lowercase canonical class identifier.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.CONFIG] - defaults to `globalThis.CONFIG`.
 * @param {object} [deps.i18n] - defaults to `globalThis.game?.i18n`.
 * @param {object} [deps.TextEditor] - defaults to
 *   `globalThis.foundry?.applications?.ux?.TextEditor`.
 * @returns {Promise<'initialized' | 'regenerated' | 'unchanged'>}
 */
export async function applyClassDefaults (actor, classId, deps = {}) {
  const CONFIGImpl = deps.CONFIG ?? globalThis.CONFIG
  const i18n = deps.i18n ?? globalThis.game?.i18n
  const TextEditor = deps.TextEditor ??
    globalThis.foundry?.applications?.ux?.TextEditor
  const entry = CONFIGImpl?.DCC?.classDefaults?.[classId]
  if (!entry) return 'unchanged'

  if (actor?.system?.details?.sheetClass !== entry.sheetClass) {
    const updates = { 'system.details.sheetClass': entry.sheetClass }
    for (const [path, key] of Object.entries(entry.localize ?? {})) {
      updates[`system.${path}`] = i18n.localize(key)
    }
    for (const [path, key] of Object.entries(entry.enrichHtml ?? {})) {
      updates[`system.${path}`] = await TextEditor.enrichHTML(i18n.localize(key))
    }
    for (const [path, value] of Object.entries(entry.literal ?? {})) {
      updates[`system.${path}`] = value
    }
    await actor.update(updates)
    return 'initialized'
  }

  // Maintenance branch: regenerate every registered enrichHtml field
  // when `system.class.classLink` is empty. Matches the legacy sheet
  // guard `else if (!this.options.document.system.class.classLink)` —
  // the trigger is classLink alone, but every registered enrichHtml
  // path gets regenerated so e.g. a warrior whose mightyDeedsLink got
  // stale alongside classLink picks both up in one pass.
  if (!actor?.system?.class?.classLink) {
    const updates = {}
    for (const [path, key] of Object.entries(entry.enrichHtml ?? {})) {
      updates[`system.${path}`] = await TextEditor.enrichHTML(i18n.localize(key))
    }
    if (Object.keys(updates).length > 0) {
      await actor.update(updates)
      return 'regenerated'
    }
  }
  return 'unchanged'
}

/**
 * Register class-specific starting items that the sheet auto-creates on
 * a new character's first open. Sibling to `registerClassDefaults`:
 * defaults writes scalar fields, starting items create embedded
 * documents. Both fire on the same first-open dispatch (the sheet calls
 * `applyClassDefaults` and, when the return is `'initialized'`, calls
 * `applyClassStartingItems`).
 *
 * Today the only built-in case is the dwarf ShieldBash weapon — the
 * registry exists so homebrew classes can ship their own auto-created
 * starting equipment (a "Squire" class's starting longsword, a
 * "Cultist" class's holy symbol, etc.) without subclassing or
 * monkey-patching the sheet.
 *
 * Each entry shape:
 *
 * - `nameKey` (string, required) — i18n key resolved via `game.i18n.localize`
 *   at apply time. Item documents are created with `name: localize(nameKey)`.
 * - `type` (string, required) — Foundry Item sub-type (`'weapon'`, `'armor'`,
 *   `'equipment'`, …). Used both in the create-payload and in the
 *   "do I already have this item?" check.
 * - `img` (string, optional) — passed through to the create payload.
 * - `system` (object, optional) — passed through as `system: {...}`.
 *
 * The "already have it" check matches on `(type, name-after-localize)`,
 * so the same registered item won't be re-created on subsequent sheet
 * opens even if the user renamed or modified it (the rename simply
 * disables the auto-create for that actor).
 *
 * `classId` is the lowercase canonical class identifier (`'dwarf'`,
 * `'warrior'`, `'cleric'`, …) — same convention as the other Phase 4/5
 * registries. Re-registering an existing `classId` silently overwrites
 * the prior entry (last-write-wins).
 *
 * Stable from day one (per `EXTENSION_API.md` recommendation 7).
 *
 * @param {string} classId - lowercase canonical class identifier.
 * @param {Array<object>} items - registration payload as documented.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.CONFIG] - `CONFIG` namespace (defaults to
 *   `globalThis.CONFIG`).
 */
export function registerClassStartingItems (classId, items, deps = {}) {
  const CONFIGImpl = deps.CONFIG ?? globalThis.CONFIG
  if (!classId || typeof classId !== 'string') {
    throw new Error('registerClassStartingItems: classId must be a non-empty string')
  }
  if (!Array.isArray(items)) {
    throw new Error('registerClassStartingItems: items must be an array')
  }
  if (!CONFIGImpl?.DCC) {
    throw new Error('registerClassStartingItems: CONFIG.DCC unavailable')
  }
  CONFIGImpl.DCC.classStartingItems ??= {}
  CONFIGImpl.DCC.classStartingItems[classId] = items
}

/**
 * Apply registered starting items to an actor. Mirrors the legacy
 * dwarf-sheet ShieldBash auto-create block that fired inside
 * `_prepareContext` whenever the sheetClass-doesn't-match branch ran.
 *
 * For each registered entry, checks whether the actor already has an
 * embedded item with the matching `type` + localized `name`. Missing
 * entries are batched into a single `createEmbeddedDocuments('Item',
 * [...])` call. Returns the array of created documents (or `[]` if
 * nothing was created) so the caller can decide whether to re-render
 * the sheet — Foundry's automatic re-render from the item creation
 * usually arrives, but the dwarf sheet has historically forced an
 * explicit `this.render(false)` to avoid a race during the
 * still-running `_prepareContext`, and that pattern carries forward.
 *
 * No-op (returns `[]`) when the classId isn't registered. The helper
 * itself never throws on a missing registry — `_prepareContext` is on
 * a UI hot path and a missing registration should degrade to the
 * legacy "no auto-create" behavior rather than crash the sheet.
 *
 * @param {object} actor - DCCActor (Player) to populate.
 * @param {string} classId - lowercase canonical class identifier.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.CONFIG] - defaults to `globalThis.CONFIG`.
 * @param {object} [deps.i18n] - defaults to `globalThis.game?.i18n`.
 * @returns {Promise<Array<object>>} created embedded item documents.
 */
export async function applyClassStartingItems (actor, classId, deps = {}) {
  const CONFIGImpl = deps.CONFIG ?? globalThis.CONFIG
  const i18n = deps.i18n ?? globalThis.game?.i18n
  const entries = CONFIGImpl?.DCC?.classStartingItems?.[classId]
  if (!Array.isArray(entries) || entries.length === 0) return []

  const toCreate = []
  for (const entry of entries) {
    if (!entry?.nameKey || !entry?.type) continue
    const name = i18n.localize(entry.nameKey)
    const alreadyHas = actor?.items?.some(item =>
      item.type === entry.type && item.name === name
    )
    if (alreadyHas) continue
    const docData = { name, type: entry.type }
    if (entry.img) docData.img = entry.img
    if (entry.system) docData.system = entry.system
    toCreate.push(docData)
  }

  if (toCreate.length === 0) return []
  return await actor.createEmbeddedDocuments('Item', toCreate)
}

/**
 * Register per-class sheet parts (Handlebars template fragments) and
 * tab labels that the class sheet renders. Closes the §2.11 (class
 * sheets fight Foundry) pain point: today each per-class PC sheet in
 * `module/actor-sheets-dcc.js` carries its own
 * `static CLASS_PARTS = { … }` and `static CLASS_TABS = { … }` block.
 * Sibling modules that want to ship a homebrew class have to either
 * subclass one of the built-in sheets (inheriting the wrong parts) or
 * register their own sheet (rewriting the part-registration plumbing).
 *
 * Phase 5 session 4 lifts those blocks onto the registry. The DCC
 * system dogfoods its own helper by registering one entry per built-in
 * PC class through this hook; the per-class sheet subclasses collapse
 * to thin stubs that just pin `static CLASS_ID = '<classId>'`. The
 * shared `DCCSheet` base resolves the parts + tabs from the registry
 * via inherited static getters.
 *
 * Each entry shape:
 *
 * - `parts` (object) — `partKey → { id, template }`. Merged into the
 *   sheet's `_configureRenderParts` output. Templates must be
 *   pre-registered via `loadTemplates` in `module/dcc.js:init` (or
 *   the sibling module's equivalent).
 * - `tabs` (object) — `group → { tabs: [{ id, group, label }, …] }`.
 *   Inserted between the base TABS (character + equipment) and the
 *   END_TABS (effects + notes) via `_getTabsConfig`.
 *
 * `classId` is the lowercase canonical class identifier (`'cleric'`,
 * `'thief'`, `'halfling'`, …) — same convention as the rest of the
 * Phase 4/5 registries. Re-registering an existing `classId` silently
 * overwrites (last-write-wins, matching the other registries).
 *
 * Stable from day one (per `EXTENSION_API.md` recommendation 7).
 *
 * @param {string} classId - lowercase canonical class identifier.
 * @param {object} descriptor - `{ parts, tabs }` registration payload.
 * @param {object} [deps] - Dependency injection for tests; never
 *   supplied in production.
 * @param {object} [deps.CONFIG] - `CONFIG` namespace (defaults to
 *   `globalThis.CONFIG`).
 */
export function registerSheetPart (classId, descriptor, deps = {}) {
  const CONFIGImpl = deps.CONFIG ?? globalThis.CONFIG
  if (!classId || typeof classId !== 'string') {
    throw new Error('registerSheetPart: classId must be a non-empty string')
  }
  if (!descriptor || typeof descriptor !== 'object') {
    throw new Error('registerSheetPart: descriptor must be an object')
  }
  if (!CONFIGImpl?.DCC) {
    throw new Error('registerSheetPart: CONFIG.DCC unavailable')
  }
  CONFIGImpl.DCC.sheetParts ??= {}
  CONFIGImpl.DCC.sheetParts[classId] = descriptor
}
