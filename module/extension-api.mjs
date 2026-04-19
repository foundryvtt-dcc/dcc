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
