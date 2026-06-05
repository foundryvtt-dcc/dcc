/**
 * Presentation-field preparers for the DCC actor sheet.
 *
 * Phase 7 (Appendix-A actor-sheet.js shrinkage): the four small context-field
 * helpers (`#prepareNotes` / `#prepareCorruption` / `#prepareImage` /
 * `#prepareCompendiumLinks`) were lifted out of `module/actor-sheet.js` into
 * this module as free functions. A sheet's `#private` methods cannot be
 * relocated to a mixin (private names are lexically class-scoped), so the
 * shrinkage shape here mirrors `actor-sheet/effects.mjs` and
 * `actor-sheet/items.mjs`: free functions taking the actor, which the sheet's
 * `_prepareContext` now calls directly.
 *
 * Each helper read only `this.options.document` (the actor) plus a Foundry
 * global — `TextEditor` (notes / corruption HTML enrichment), `EntityImages`
 * (default actor image), or `CONFIG.DCC` (compendium links). The globals are
 * injected via a `deps` parameter defaulting to the live ones, matching the
 * dependency-injection idiom in `actor-sheet/items.mjs` and `extension-api.mjs`,
 * so the helpers are directly unit-testable. All four were `#private` and had
 * no prior unit coverage; as free functions they do now.
 */

import EntityImages from '../entity-images.js'

/**
 * Enrich the actor's notes HTML for sheet display.
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {object} [deps.TextEditor] - `foundry.applications.ux.TextEditor`.
 * @returns {Promise<string>} enriched notes HTML.
 */
export async function prepareNotes (actor, {
  TextEditor = globalThis.foundry?.applications?.ux?.TextEditor
} = {}) {
  const context = { relativeTo: actor, secrets: actor.isOwner }
  return await TextEditor.enrichHTML(actor.system.details.notes.value, context)
}

/**
 * Enrich the actor's corruption HTML for sheet display. Returns an empty string
 * for actors without a `class` block (e.g. NPCs).
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {object} [deps.TextEditor] - `foundry.applications.ux.TextEditor`.
 * @returns {Promise<string>} enriched corruption HTML, or `''`.
 */
export async function prepareCorruption (actor, {
  TextEditor = globalThis.foundry?.applications?.ux?.TextEditor
} = {}) {
  if (actor.system.class) {
    const context = { relativeTo: actor, secrets: actor.isOwner }
    const corruption = actor.system.class.corruption || ''
    return await TextEditor.enrichHTML(corruption, context)
  }
  return ''
}

/**
 * Resolve the actor's display image, falling back to the type-default icon when
 * the actor has no image or still carries the mystery-man placeholder. This is a
 * display-only fallback for actors created before the `preCreateActor` hook set
 * default images; it never writes back to the actor (avoids creation races).
 * @param {Actor} actor - the sheet's `options.document`.
 * @param {object} [deps] - injectable Foundry globals (default to the live ones).
 * @param {(type: string) => string} [deps.imageForActor] - actor-type → icon path.
 * @returns {string} the image path to display.
 */
export function prepareImage (actor, {
  imageForActor = (type) => EntityImages.imageForActor(type)
} = {}) {
  if (!actor.img || actor.img === 'icons/svg/mystery-man.svg') {
    return imageForActor(actor.type)
  }
  return actor.img
}

/**
 * Return the equipment-tab compendium links from `CONFIG.DCC`, populated when the
 * dcc-core-book module is active (otherwise `null`/`undefined`).
 * @param {object} [config] - `CONFIG.DCC` (defaults to the live one).
 * @returns {object|null|undefined} compendium pack names keyed by section.
 */
export function prepareCompendiumLinks (config = globalThis.CONFIG?.DCC) {
  return config?.coreBookCompendiumLinks
}
