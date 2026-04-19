/**
 * Reserved — Foundry compendium → dcc-core-lib data-registry loader.
 *
 * The original Phase 0 design centralized all pack → lib-registry
 * loading here (disapproval, mercurial, fumble, crit, class
 * progressions). The actual landings live in the per-domain input
 * modules: `spell-input.mjs` has `loadDisapprovalTable` +
 * `loadMercurialMagicTable`; crit / fumble lookups still go through
 * `module/utilities.js`'s `getCritTableResult` / `getFumbleTableResult`.
 * This module stays as a placeholder for any cross-domain bulk
 * registry sync (e.g. `registerClassProgressions`) that later lands
 * and doesn't belong in a single input file.
 */

export {}
