# Phase 5 — Sheet composition + class defaults + starting items

> Archive of session-by-session detail for Phase 5: collapsing the
> per-class PC sheet subclasses in `module/actor-sheets-dcc.js` (and the
> partials at `templates/actor-partial-*.html`) into composable
> registry entries. The Phase 4 schema-mixin arc already lifted
> per-class **field** definitions onto `game.dcc.registerClassMixin`;
> Phase 5 lifts the per-class **sheet-side** concerns:
>
> 1. **Class defaults** (`game.dcc.registerClassDefaults`) — class
>    identity (className, classLink, sheetClass, optional enriched-HTML
>    link blobs) + mechanical defaults (critRange, attackBonusMode,
>    addClassLevelToInitiative, spellCheckAbility, …) + skill-activation
>    toggles (notably `skills.shieldBash.useDeed`).
> 2. **Sheet parts** (`game.dcc.registerSheetPart`, planned) — tab /
>    template composition that today lives on each sheet subclass's
>    `CLASS_PARTS` + `CLASS_TABS` statics.
> 3. **Starting items** (`game.dcc.registerClassStartingItems`,
>    planned) — auto-created class equipment (today only the dwarf
>    ShieldBash weapon).
>
> See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 5`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state + open questions.

---

- **2026-05-18 — Phase 5 session 1: `registerClassDefaults` registry
  + 7 PC sheets migrated.** New stable extension hook
  `game.dcc.registerClassDefaults(classId, defaults)` and companion
  `applyClassDefaults(actor, classId)` helper in
  `module/extension-api.mjs`. Each entry packages the
  `_prepareContext` first-open writes the legacy class-sheet subclasses
  inlined: `sheetClass` (capitalized sentinel that drives the
  initial-setup-vs-maintenance dispatch), `localize` (i18n keys for
  `class.className`), `enrichHtml` (i18n keys for `class.classLink` +
  optional `mightyDeedsLink` / `spellcastingLink` / `spellburnLink`),
  and `literal` (scalar mechanical defaults — critRange,
  attackBonusMode, addClassLevelToInitiative, spellCheckAbility,
  showBackstab / showSpells, `skills.shieldBash.useDeed`).
  `applyClassDefaults` returns `'initialized' | 'regenerated' |
  'unchanged'` so the dwarf sheet can still gate its inline
  ShieldBash auto-create on the `'initialized'` branch — that
  starting-item logic stays inline pending a follow-up
  `registerClassStartingItems` slice. Seven built-in PC entries
  (cleric/dwarf/elf/halfling/thief/warrior/wizard) seeded via the
  new `module/built-in-class-defaults.mjs` table consumed by
  `module/dcc.js:init` only (integration tests don't open sheets,
  so the shared production-and-test registration pattern the mixin
  table uses isn't needed here). All 7 PC sheets in
  `module/actor-sheets-dcc.js` shrunk from ~22-line
  `_prepareContext` blocks to a single
  `applyClassDefaults(this.options.document, '<classId>')` call —
  net 156 lines deleted (623 → 467); `TextEditor` import dropped
  alongside (it was only used by the now-extracted blocks). Generic
  sheet stays untouched (not class-bound, has no maintenance branch
  in the legacy code either). +11 Vitest in `extension-api.test.js`
  covering both helpers (registration storage, self-heal on missing
  registry, last-write-wins, validation throws on bad classId /
  bad defaults / missing sheetClass / missing CONFIG.DCC; helper
  initial-setup payload shape, maintenance-branch enrichHtml-only
  payload, dual-enrichHtml mightyDeedsLink path, `unchanged` /
  `initialized` / `regenerated` returns, defensive partial-entry
  handling). 983 Vitest green (was 970, +13: 11 new helper tests
  + 2 happy-path flippers). +5 Playwright cases in
  `extension-api.spec.js` exercising the new helper end-to-end
  against live Foundry: hook exposed on `game.dcc`; seed table
  shape across all 7 PC classes asserting sheetClass + classLink
  presence + critRange/attackBonusMode literal correctness; warrior
  + dwarf carry the mightyDeedsLink slot AND wizard carries
  spellcastingLink + spellburnLink; `applyClassDefaults` full
  lifecycle on a halfling Player (initial → unchanged on second
  call → regenerate after classLink wipe); warrior literal-defaults
  end-to-end (`attackBonusMode='autoPerAttack'`,
  `addClassLevelToInitiative=true`). 122 Playwright passed (was
  117, +5), 1 latent failure (xcc-core-book DCCItemSheet override,
  unchanged baseline). **Latent gap surfaced, NOT fixed in this
  slice:** the warrior + dwarf `class.mightyDeedsLink` and wizard
  `class.spellcastingLink` / `class.spellburnLink` writes don't
  surface on `system.class.*` because those paths aren't registered
  on the Player schema (only `class.classLink` is, contributed by
  a sibling module's `dcc.definePlayerSchema` hook — the test
  world also adds dozens of XCC/MCC extras like `archaicAlignment`,
  `aiPatron`, `blasterDie`). Templates render
  `{{{system.class.mightyDeedsLink}}}` → empty. Legacy sheets have
  been writing these stripped values forever; my refactor matches
  byte-for-byte. Tracked as a follow-up: either register the link
  fields in the static `class` SchemaField in `player-data.mjs` or
  document the missing sibling contribution in `EXTENSION_API.md`.
  Opens Phase 5; remaining work is the `registerSheetPart` collapse
  (§3.2), `registerClassStartingItems` (§3.4), and the
  remaining-capitalized-`sheetClass`-readers migration (Elf at
  `actor.js:182`; Cleric at `actor.js:2180`/`actor.js:2481`/
  `dcc.js:746` — bundled with whichever later Phase 5 slice touches
  the writer side).
- **2026-05-18 — Phase 5 session 2: `registerClassStartingItems`
  registry + dwarf ShieldBash migrated.** New stable extension
  hook `game.dcc.registerClassStartingItems(classId, items)` and
  companion `applyClassStartingItems(actor, classId)` helper in
  `module/extension-api.mjs`. `CONFIG.DCC.classStartingItems = {}`
  seeded in `module/config.js`. Each entry shape is a
  `{ nameKey, type, img?, system? }` factory descriptor — the
  helper localizes `nameKey` at apply time (item documents are
  created with `name: localize(nameKey)`), and the duplicate check
  matches on `(type, localized-name)` so renaming an existing
  auto-created item suppresses re-creation. Created items batch
  into a single `createEmbeddedDocuments('Item', [...])` call so
  multi-item registrations (future homebrew "Cultist" with multiple
  starting items) get the Foundry-preferred bulk-create shape, and
  the helper returns the created docs array so callers can decide
  whether to re-render. Dwarf ShieldBash seed registered via new
  `module/built-in-class-starting-items.mjs` table consumed by
  `module/dcc.js:init` (mirror of the mixins/defaults table
  pattern). The dwarf sheet's inline ~21-line ShieldBash
  auto-create block in `module/actor-sheets-dcc.js` collapsed to
  the same 2-line uniform pattern used by every other PC sheet:
  `if (result === 'initialized')` → `applyClassStartingItems` →
  `render(false)` when created.length>0. All 7 PC sheets now share
  identical `_prepareContext` shape — only the `classId` literal
  differs. Future-homebrew benefit: a sibling module registering
  starting items for its own classId gets them applied
  automatically through any PC sheet subclass that uses the
  uniform pattern (no monkey-patching, no subclassing needed).
  +13 Vitest tests in `extension-api.test.js` covering both helpers
  (registration storage / self-heal / last-write-wins / validation
  throws; helper create-missing / skip-existing /
  partial-create-mixed-state / unregistered no-op / empty-list
  no-op / malformed-entry defense / lean-payload omits img+system).
  996 Vitest green (was 983, +13). +5 Playwright cases in
  `extension-api.spec.js` exercising the hook end-to-end against
  live Foundry: hook exposed on `game.dcc`; built-in dwarf entry
  seeded with the expected shape AND no other DCC class has
  entries; live dwarf actor gets ShieldBash created via
  `applyClassStartingItems`; idempotent on second call (no
  duplicate); homebrew classId registered mid-test propagates
  through the helper. **Phase 5 active sub-arc progress:** schema
  mixins (component 1, Phase 4) + class defaults (component 3,
  Phase 5-1) + starting items (component 5, Phase 5-2) all
  complete for the dwarf vertical. Remaining: sheet parts
  (component 2, registerSheetPart — Phase 5 session 3 territory)
  and lib progression (component 6, Phase 6).
- **2026-05-18 — Phase 5 session 3: register the four link fields
  on the base Player schema (closes Phase 5-1 latent gap).** Pure
  schema add — re-import `HTMLField` in
  `module/data/actor/player-data.mjs` (was dropped at Phase 4
  session 6 when `corruption` moved to the wizard mixin) and add
  four `HTMLField({ initial: '' })` declarations to the static
  `class` SchemaField alongside `className`: `classLink`,
  `mightyDeedsLink`, `spellcastingLink`, `spellburnLink`. Closes
  the latent gap surfaced at Phase 5 session 1: pre-Phase-5-3,
  only `classLink` survived schema validation (a sibling
  `dcc.definePlayerSchema` hook in xcc-core-book registered it),
  so `mightyDeedsLink` / `spellcastingLink` / `spellburnLink`
  writes from `applyClassDefaults`'s `enrichHtml` bag were
  silently stripped by Foundry. Templates rendered
  `{{{system.class.mightyDeedsLink}}}` → empty for warrior /
  dwarf actors and similarly for wizard's spellcasting / spellburn
  fields. Post-slice, all four `enrichHtml` paths persist on
  `system.class.*` in every world configuration (including
  clean DCC-only worlds without xcc-core-book). The sibling
  module's `classLink` registration via `dcc.definePlayerSchema`
  still runs and overrides the base-body declaration on its own
  schedule (last-write-wins as before) — no breakage for existing
  worlds. +4 assertions added to the existing integration test
  `module/__integration__/data-models.test.js` (`PlayerData
  constructs with defaults` now also asserts `class.classLink`,
  `class.mightyDeedsLink`, `class.spellcastingLink`,
  `class.spellburnLink` initialize to `''`). +2 Playwright cases
  in `extension-api.spec.js`: (a) `Phase 5 session 3 link fields
  surface on system.class.* (latent gap closed)` exercises
  warrior + wizard + dwarf via `applyClassDefaults` and asserts
  every registered enrichHtml path resolves to a non-empty string
  on `system.class.*` post-write — regression guard catching any
  future schema strip; (b) `fresh Player schema initializes the
  four link fields to empty strings` asserts the empty-string
  default on a brand-new Player document. 996 Vitest green
  (unchanged from session 2 — the +4 assertions extend an
  existing test rather than adding new test cases). The earlier
  warrior `applyClassDefaults` test's "latent gap" comment trimmed
  to point at the new sibling regression guard instead. **Phase 5
  active sub-arc:** halfling/dwarf/thief/cleric/warrior/wizard/elf
  all have ✅ schema mixin (Phase 4) + ✅ class defaults (Phase 5
  session 1) + ✅ working enriched-HTML link fields (Phase 5
  session 3). Dwarf adds ✅ starting items (Phase 5 session 2).
  Remaining: `registerSheetPart` collapse + sheetClass-reader
  migration (next sessions).

- **2026-05-18 — Phase 5 session 4: `registerSheetPart` registry +
  7 PC sheets collapsed onto `DCCSheet` base.** New stable extension
  hook `game.dcc.registerSheetPart(classId, descriptor)` in
  `module/extension-api.mjs`; `CONFIG.DCC.sheetParts = {}` seeded in
  `module/config.js`. Each entry shape:
  `{ parts: { partKey: { id, template } }, tabs: { group: { tabs:
  [{ id, group, label }] } } }` — mirrors ApplicationV2's `PARTS` +
  `TABS` statics so the registry is a drop-in for the previously
  hardcoded per-class `CLASS_PARTS` + `CLASS_TABS`. Seeded for all 7
  PC classes via new `module/built-in-sheet-parts.mjs` table
  consumed by `module/dcc.js:init` (mirror of the
  mixins/defaults/starting-items pattern). New `DCCSheet`
  intermediate base class in `module/actor-sheets-dcc.js` between
  `DCCActorSheet` (NPC base) and the per-class subclasses:
  exposes inherited static getters `CLASS_PARTS` + `CLASS_TABS`
  that resolve from `CONFIG.DCC.sheetParts[this.CLASS_ID]` at
  lookup time (`this` in a static getter is the class the getter is
  accessed on — `DCCActorSheetCleric.CLASS_PARTS` evaluates with
  `this === DCCActorSheetCleric` → `this.CLASS_ID === 'cleric'` →
  registry lookup). DCCSheet's `_prepareContext` runs the shared
  `applyClassDefaults` + `applyClassStartingItems` pair gated on
  `this.constructor.CLASS_ID` resolving. Each per-class subclass
  collapses to a 4-line stub: just pin `static CLASS_ID =
  '<classId>'` and inherit everything else. `module/actor-sheets-dcc.js`
  shrunk from 466 → 235 lines (-49%). All 7 PC sheet classes stay
  registered with their existing class names (`DCCActorSheetCleric`
  etc.) so the "Configure Sheet" picker still has 7 labeled
  options and existing `flags.core.sheetClass` values continue to
  resolve — only the internals collapsed. Generic sheet
  (`DCCActorSheetGeneric`) stays separate: it has a fully-static
  `PARTS` declaration (different shape from class sheets), no
  CLASS_ID, and its initial-setup logic isn't class-bound.
  Sibling-module recipe for homebrew classes is now four
  `register*` calls (mixin / defaults / starting items / sheet
  part) + a 4-line sheet subclass extending DCCSheet —
  documented in EXTENSION_API.md. +6 Vitest tests in
  `extension-api.test.js` (registration storage / self-heal /
  last-write-wins / validation throws on bad classId / non-object
  descriptor / missing CONFIG.DCC). 1002 Vitest green (was 996,
  +6). +5 Playwright cases in `extension-api.spec.js`: hook
  exposed on `game.dcc`; all 7 built-in PC classes present in
  the registry with the expected class-specific part key and tab
  id; cleric / wizard / elf carry their extra
  `clericSpells` / `wizardSpells` parts while halfling / thief /
  warrior / dwarf don't; inherited static getters on each PC
  sheet class resolve to the registry-keyed shape; homebrew
  classId registration propagates through. **134 Playwright
  passed** (was 129, +5), 1 latent failure (xcc-core-book
  DCCItemSheet override, unchanged baseline). Visual regression
  suite couldn't run in this session's environment — its
  `start-foundry` script in
  `browser-tests/visual-regression/package.json` launches a
  `baselinev12` world, not the v14 world this slice was tested
  against; the test-actor folders and selectors expect that v12
  baseline. Slice doesn't change templates or CSS, so screenshots
  should be byte-identical when the v12 baseline is available.
  **Phase 5 complete for all 7 built-in PC classes**: schema mixin
  (P4) + class defaults (P5-1) + starting items (P5-2 dwarf) +
  link fields (P5-3) + sheet parts (P5-4). Remaining work in this
  arc is the migration of the remaining capitalized `sheetClass`
  readers (Elf / Cleric in `actor.js` + `dcc.js`) to
  `actor.classId` — small follow-up.
