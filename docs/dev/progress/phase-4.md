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
- **2026-05-18 — Phase 4 session 2: dwarf `shieldBash` class-mixin
  extraction.** Second halfling-vertical slice, same pattern as
  session 1 but with mixed field types. New `'dwarf'` entry in
  `CONFIG.DCC.classMixins` registered in `module/dcc.js:init`
  contributes `skills.shieldBash` (`label` / `ability` / `value`
  StringFields + `die` DiceField + `useDeed` BooleanField). The
  static `shieldBash` block in `player-data.mjs` is deleted; the
  comment near the removed block is updated to document both
  halfling + dwarf mixin-sourced fields together. `DiceField`
  imported into `dcc.js` from `module/data/fields/_module.mjs` so the
  mixin can reference it without further plumbing. +1 Playwright
  case in `extension-api.spec.js` asserts the built-in dwarf mixin
  produces all five fields with the expected defaults AND verifies
  `dieFieldType === 'DiceField'` + `useDeedFieldType === 'BooleanField'`
  on the resolved schema — proves mixed field types survive the
  mixin path identically to a static definition. No new Vitest test
  needed; the registry mechanics tested in session 1
  (`applyClassMixins` sort order, last-write-wins, etc.) cover the
  dwarf mixin's plumbing — only the schema-shape claim is new and
  it's best exercised against live Foundry. 966 Vitest green
  (unchanged from session 1). 110 Playwright passed (was 109, +1
  dwarf case); same single pre-existing environmental flake as
  session 1 (`xcc-core-book` unregistering DCCItemSheet).
- **2026-05-18 — Phase 4 session 3: thief class-mixin extraction (12
  skills + `class.luckDie` + `class.backstab`).** Largest single-
  class relocation so far. New `'thief'` entry in `CONFIG.DCC.classMixins`
  registered in `module/dcc.js:init` builds 12 skill SchemaFields via
  a shared inline `thiefSkill(label, ability)` helper plus two class-
  field mutations (`schema.class.fields.luckDie` =
  `DiceField('1d3')`, `schema.class.fields.backstab` =
  `StringField('0')`). First mixin to touch BOTH `schema.class.fields`
  and `schema.skills.fields` on the same registration. `handlePoison`
  deliberately omits `ability` to match the static body's shape;
  `castSpellFromScroll` carries its own DiceField die (`'1d10'`)
  alongside the standard label/ability/value triple. The static
  thief-skills block (~62 lines) + the two thief class-field lines
  in `module/data/actor/player-data.mjs` are deleted; the trailing
  comment near the removed skill block now documents thief alongside
  halfling/dwarf mixins. `DiceField` import dropped from
  `player-data.mjs` (was only used by the two now-relocated thief
  fields). +1 Playwright case in `extension-api.spec.js` asserts (a)
  all 12 skill fields are present, (b) `findTrap`/`disguiseSelf`
  carry their non-`agl` abilities, (c) `handlePoison` lacks the
  `ability` field, (d) `castSpellFromScroll.die`'s field type is
  `DiceField` with initial `'1d10'`, and (e) `class.luckDie` /
  `class.backstab` are present with correct types + initials. No new
  Vitest needed (registry mechanics covered session 1). 966 Vitest
  green (unchanged); 112 Playwright passed (was 110, +1 thief + 1
  dwarf-flake recovered), 1 latent failure (xcc-core-book DCCItemSheet
  override — unchanged).
