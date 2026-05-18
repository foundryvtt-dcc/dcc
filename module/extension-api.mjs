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
