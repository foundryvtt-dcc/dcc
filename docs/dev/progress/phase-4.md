# Phase 4 — Data-model slimming + class-mixin extension surface

> Archive of session-by-session detail for Phase 4: relocating
> class-bound fields off `module/data/actor/player-data.mjs`'s
> monolithic body onto the `game.dcc.registerClassMixin` registry, plus
> the related infrastructure (extension hook, dispatch by class ID,
> homebrew enablement). See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 4`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state + open questions.

---

<!-- Sessions will land here as they rotate out of Recent slices. -->

- **2026-05-18 — Phase 4 session 1: halfling vertical kickoff —
  `registerClassMixin` infrastructure + sneakAndHide extraction.**
  New stable extension helper `game.dcc.registerClassMixin(classId,
  mixinFn)` in `module/extension-api.mjs` (alongside companion
  `applyClassMixins(schema)` used by `defineSchema`).
  `CONFIG.DCC.classMixins = {}` initialized in `module/config.js`;
  mutators run in sorted-classId order during
  `PlayerData.defineSchema()` **before** the existing
  `dcc.definePlayerSchema` hook fires so external handlers see
  mixin-contributed fields. `module/dcc.js`'s init registers a
  built-in `'halfling'` mixin (right after `CONFIG.DCC = DCC`,
  before `CONFIG.Actor.dataModels`) that contributes
  `skills.sneakAndHide` (`StringField initial '+3'`,
  `label initial 'DCC.SneakAndHide'`) — identical to the static
  definition it replaces. The static `player-data.mjs` halfling
  block is removed; the field is no longer hardcoded in the
  monolithic schema body. Last-write-wins on duplicate `classId`
  registration (matches mercurial-magic registry semantic) — lets a
  sibling module fully replace a DCC built-in mixin instead of
  having to additively patch. EXTENSION_API.md gains the new helper
  in the Stable `game.dcc.*` exports table, refreshes the
  `dcc.definePlayerSchema` row to call out the new sibling registry,
  and adds a "Homebrew / sibling-module recipe: registerClassMixin"
  migration entry. +11 Vitest tests in `extension-api.test.js`
  (registry mechanics: stores under classId, self-heals missing
  registry, last-write-wins, throws on bad inputs;
  `applyClassMixins`: deterministic sort order, no-op on empty /
  missing registry, defensive against malformed entries). +3
  Playwright cases in `extension-api.spec.js` (helper exposed on
  `game.dcc`, built-in halfling mixin produces `sneakAndHide` on a
  live Player document, last-write-wins survives a round-trip
  restore). 966 Vitest green (was 955, +11); 109 Playwright passed.
  **Two pre-existing environmental Playwright failures observed
  (unrelated to slice, pin-pointed):**
  (1) `extension-api.spec.js:78 › registerItemSheet adds a sheet
  option…` asserts `sheetCtorName === 'DCCItemSheet'` but resolves
  to `'XCCItemSheet'` — `xcc-core-book/module/dccModule.js:14-16`
  unregisters DCC's item sheet and registers XCCItemSheet as
  default at init; the assertion has been latent since the test
  landed 2026-04-19 (`907cfaf`) and only fires when xcc-core-book
  is enabled in the test world. Fix is one of: relax to
  `expect(['DCCItemSheet', 'XCCItemSheet']).toContain(…)`, or
  disable xcc-core-book in the v14 world for the test run.
  (2) `v14-features.spec.js:659 › Status Icons › can toggle…`
  hit a "You have lost connection to the server" console error
  mid-suite — environmental Foundry connection flake during the
  long v14-features run, not a test-logic failure. Neither is
  introduced by this slice. First chip away at
  §2.1; Foundry-smelling shape (`system.skills.sneakAndHide`) stays
  intact per §2.12. Subsequent halfling-vertical sessions: extract
  remaining class-bound fields (Phase 4 cont.), halfling sheet-tab
  composition (Phase 5), variant registration (Phase 6).
