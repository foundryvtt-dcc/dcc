# Phase 6 — Lib-side class progression + variant registration

> Archive of session-by-session detail for Phase 6: exposing
> `dcc-core-lib`'s class-progression registry from the Foundry system
> so the lib's consumer APIs (`getSavingThrows`, `getCritDie`,
> `getSaveBonus`, `getClassProgression`) return non-zero values for
> actors, plus the variant-ruleset extension surface so XCC / MCC /
> future homebrew variants can declare their class IDs + sheet theme
> through `game.dcc.registerVariant({ id, label, classes,
> sheetTheme? })`.
>
> Per `ARCHITECTURE_REIMAGINED.md §8.1`, class progression *data* is
> copyrighted Goodman Games material living in the private
> `dcc-official-data` repo. The open-source DCC system ships only the
> registration surface; content modules (a future `dcc-core-book`
> update, sibling content packs) register their data on their own
> schedule. Phase 6 session 2 wires `registerClassProgressionsFromPacks`
> against `CONFIG.DCC.levelDataPacks` at `dcc.ready` so worlds that
> install a level-data-pack-shipping content module get the lib
> registry populated automatically.
>
> See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 6`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state + open questions.

---

- **2026-05-19 — Phase 6 session 1: expose
  `registerClassProgression` / `registerClassProgressions` on
  `game.dcc.*`.** Two-line addition to `module/dcc.js`: import the
  helpers from the vendored lib
  (`module/vendor/dcc-core-lib/data/classes/progression-utils.js`)
  and add them to the `game.dcc` object alongside the other
  Phase 4/5 registry helpers. The lib already implements the
  registry + consumer APIs (`getSavingThrows`, `getCritDie`,
  `getSaveBonus`, `getClassProgression`) — they've been there since
  before the vendor sync; this slice just makes the registration
  surface reachable from sibling content modules without forcing
  them to import a vendored-lib internal path. PR #720's
  "programmatic PC creation produces inconsistent class config"
  item is *partially* closed: the registration plumbing is now
  available. Full closure waits on a content module (a future
  `dcc-core-book` update, or sibling) to invoke the helper with
  a complete progression payload. The class progression data
  itself is copyrighted Goodman Games material living in the
  private `dcc-official-data` repo (per
  `ARCHITECTURE_REIMAGINED.md §8.1`); the open-source DCC system
  ships only the registration surface. +2 Vitest tests in
  `extension-api.test.js` (helpers importable from vendored lib;
  fictional round-trip with `clearClassProgressions` cleanup).
  1005 Vitest green (was 1003, +2). +2 Playwright cases in
  `extension-api.spec.js` (helpers exposed on live `game.dcc`;
  end-to-end round-trip registering a fictional class and reading
  it back via the lib's `getSavingThrows` consumer, with cleanup).
  EXTENSION_API.md gains a Stable row pair for both helpers +
  documents the "data lives in content modules, not core" pattern.
  No copyrighted material reproduced in this repo. 135 Playwright
  passed (was 134, +2 from this slice). One new suite-only flake
  observed: `phase1-adapter-dispatch.spec.js:922 forceCrit
  shift-click flag…` fails under the full-suite run but passes
  in isolation (verified by re-running the single test). State
  pollution between tests in the shared Foundry world; this slice
  adds no chat / roll / spell logic so it can't have caused the
  flake.
- **2026-05-19 — Phase 6 session 2: load class progressions from
  `levelDataPacks` at `dcc.ready` (closes PR #720 class-config
  item).** New `registerClassProgressionsFromPacks(...)` +
  `parseLevelDataText` + `buildProgressionLevelFromParsed` in
  `module/adapter/foundry-data-loader.mjs` (previously a Phase 0
  placeholder stub). Walks `CONFIG.DCC.levelDataPacks` for
  `{ClassName}-{level}` items for each of 7 built-in PC class IDs
  up to level 10, parses each `system.levelData` text (newline
  `key=value` pairs, numeric-coerced), and maps Foundry-system-paths
  onto the lib's `ProgressionLevelData` shape:
  `system.saves.{ref,frt,wil}.value` → `saves.{ref,frt,wil}`;
  `system.details.attackHitBonus` → `attackBonus`;
  `system.details.critDie` / `critTable` / `critRange` →
  `criticalDie` / `criticalTable` / `critRange`;
  `system.attributes.actionDice.value` (comma-separated string) →
  `actionDice` array; `system.attributes.hitDice.value` strips
  `LdN → dN` to recover the class hit die; `system.class.luckDie`
  → `luckDie`. Per-class `ClassProgression` objects assembled +
  registered via the vendored lib's `registerClassProgressions`.
  Wired into `module/dcc.js`'s `dcc.ready` hook handler BEFORE
  `Hooks.callAll('dcc.ready')` so sibling-module listeners see
  the populated registry; load errors are caught + logged
  defensively (system init can't be broken by malformed pack
  data). The slice closes the remaining half of PR #720's
  "programmatic PC creation produces inconsistent class config"
  item: the lib's `getSavingThrows("warrior", 3)`,
  `getCritDie("cleric", 5)`, etc. now return non-zero values for
  actors in worlds where a level-data pack is installed
  (dcc-core-book ships one for the 7 canonical classes; sibling
  content modules can ship their own). The level-data-items
  extensibility mechanism stays single-source-of-truth — content
  creators ship `{Class}-{level}` items in their own compendium
  packs, register the pack via
  `CONFIG.DCC.levelDataPacks.addPack(...)`, and both the
  level-change dialog AND the lib registry pick them up
  automatically. Homebrew classes that ship their own level packs
  add a name → classId entry to `BUILT_IN_CLASS_LEVEL_NAMES`
  (or a future `registerHomebrewClassForProgressionLoad`-style
  helper landing alongside `registerVariant`). +15 Vitest tests
  in new `module/__tests__/foundry-data-loader.test.js` covering
  the parser (empty-rhs guard, dice-notation preservation), the
  mapper (path → field, level-count strip, numeric action-dice
  fallback, sparse-saves coercion, non-numeric critRange drop,
  empty-token filter), and the assembler (no-packs / empty-packs
  / populated). All test fixtures use unambiguously placeholder
  values — `d13` hit die, save bonuses `7`/`9`/`11`, `TEST` crit
  table — values that obviously don't match any official
  progression. The open-source DCC system ships no class
  progression data; data lives in user-installed content modules.
  +1 Playwright case in `extension-api.spec.js` that
  direct-invokes `registerClassProgressionsFromPacks()` against
  the live world (with save+restore of the prior registry around
  the call) and asserts structural shape only: at least one of
  the canonical class IDs registered, sample progression has a
  populated `levels` map. Specific progression values are NOT
  asserted — those are pack-content-dependent. The session-1
  round-trip test also updated to use save+restore (previously
  `clearClassProgressions()` would have wiped the production
  entries that the init-time loader registers). 1020 Vitest green
  (was 1005, +15).

  **Production-init verification deferred to next Foundry restart:**
  the running test world started before this slice's `dcc.ready`
  wiring landed on disk, so the init-hook side-effect couldn't
  be asserted in this run. The direct-invoke assertion proves the
  loader works correctly against real compendium packs (verified
  against `dcc-core-book.dcc-class-level-data` — 70 items,
  lowercase `{classId}-{level}` convention, all 7 PC classes
  registered successfully). When Foundry restarts, the production
  init hook will load these automatically.

  136 Playwright passed (was 135, +1 from this slice). Two failures
  this run: the latent xcc-core-book DCCItemSheet override
  (unchanged baseline) and one new suite-only flake observed:
  `extension-api.spec.js:553 built-in elf mixin attaches wizard
  fields…` (Phase 4 session 6 test) — passes in isolation, fails
  under the full-suite run. State pollution between tests in the
  shared Foundry world; this slice didn't touch elf code or the
  classMixins registry so it can't have caused the flake. The
  forceCrit flake observed in Phase 6 session 1's run didn't fire
  this run.

- **2026-05-19 — Phase 6 session 3: expose homebrew level-name
  registration on `game.dcc.*` + lift the seven built-in PC classes
  onto `CONFIG.DCC.classLevelNames`.** New stable extension hook
  `game.dcc.registerHomebrewClassForProgressionLoad(classId,
  itemPrefix)` in `module/extension-api.mjs`;
  `CONFIG.DCC.classLevelNames = {}` seeded in `module/config.js`.
  The Phase 6 session 2 loader at
  `module/adapter/foundry-data-loader.mjs` previously carried a
  module-private `BUILT_IN_CLASS_LEVEL_NAMES` const — that table is
  gone, the loader now reads `CONFIG.DCC.classLevelNames` via the
  same `deps.CONFIG ?? globalThis.CONFIG` injection it already
  used for `levelDataPacks`. New `module/built-in-class-level-names.mjs`
  table seeds the seven canonical PC classes
  (cleric/dwarf/elf/halfling/thief/warrior/wizard, all mapping
  classId → itemPrefix 1:1 because the dcc-core-book level pack
  uses lowercase item names) via
  `registerBuiltInClassLevelNames(register)`, consumed by
  `module/dcc.js:init` alongside the other Phase 4/5
  `registerBuiltInXxx` calls. The helper is exposed on the
  `game.dcc` object alongside the other stable registry helpers;
  `EXTENSION_API.md` gains a new Stable row documenting the
  sibling-module recipe (`addPack(...)` +
  `registerHomebrewClassForProgressionLoad(...)`).
  Sibling modules with homebrew classes no longer need to edit
  system source to teach the lib about their progression — they
  register from their own `init` hook and the loader picks them
  up at `dcc.ready`. The indirection between classId and
  itemPrefix means a homebrew classId like `'my-druid'` can map
  onto a pack that ships its items under a different prefix
  (`'druid-1'`, `'druid-2'`), without forcing the homebrew author
  to rename items to match. Validation throws on empty / non-string
  classId / itemPrefix and missing CONFIG.DCC; storage is
  last-write-wins on duplicate classId, matching the other class
  registries. +10 Vitest tests in
  `module/__tests__/extension-api.test.js` (7 covering the helper
  itself — storage / self-heal / last-write-wins / classId
  validation / itemPrefix validation / missing CONFIG.DCC throw /
  built-in seed table shape) +
  `module/__tests__/foundry-data-loader.test.js` (2 new assembler
  tests asserting the loader skips classIds not present in the
  registry AND a homebrew classId → distinct itemPrefix mapping
  is honored; existing 3 loader tests updated to populate
  `classLevelNames` in the mock CONFIG; 1 new defensive
  registry-not-yet-seeded test). +2 Playwright cases in
  `extension-api.spec.js`: hook exposed on `game.dcc` AND
  `CONFIG.DCC.classLevelNames` carries exactly the 7 canonical
  PC classIds post-init with the expected itemPrefix values;
  end-to-end fictional homebrew classId registered mid-test gets
  picked up by the loader (with full save+restore of the
  classLevelNames registry AND the lib's progression registry).
  Closes the second of the three Phase 6 follow-ups identified in
  `01-session-start.md` (homebrew level-name extension hook).
  Remaining Phase 6 work: `registerVariant` (larger scope) +
  forceCrit / elf-mixin suite-only Playwright flake investigation.
  **1030 Vitest green** (was 1020, +10). **137 Playwright passed**
  (was 136 baseline + 2 new cases from this slice, expected 138;
  one data-models test dropped to a login race — see flakes below).
  Three Playwright failures this run, none caused by this slice:
  (1) `data-models.spec.js:120 can create a new Player actor with
  default values` — Gamemaster select-option timed out
  ("option being selected is not enabled"); login race; (2)
  `data-models.spec.js:157 can create a new NPC actor` — same
  Gamemaster select-option timeout; same race; (3)
  `extension-api.spec.js:78 registerItemSheet adds a sheet option
  Foundry can resolve for the item type` — expected `DCCItemSheet`,
  received `XCCItemSheet`. (3) is the **latent xcc-core-book
  DCCItemSheet override baseline** flagged in every prior session.
  (1) + (2) are new — the running Foundry world had a logged-in
  Gamemaster when the suite started; Tim logged out mid-run and
  the early Gamemaster-selecting tests caught the transition.
  Both data-models tests pass in isolation and on rerun. Worth
  pulling into the flake-investigation queue alongside forceCrit
  / elf-mixin, but not caused by this slice (no chat / actor /
  sheet logic touched).


- **2026-05-20 — Phase 6 session 4: harden
  `browser-tests/e2e/extension-api.spec.js`'s `beforeEach` to match
  sibling-spec hygiene (closes flake-investigation follow-up).** The
  session-start prompt called out two suite-only Playwright flakes —
  `extension-api.spec.js:553 built-in elf mixin attaches…` and
  `phase1-adapter-dispatch.spec.js:922 forceCrit shift-click flag…` —
  observed in Phase 6 sessions 1 and 2 but neither in session 3 nor
  in two pre-fix full-suite runs this session. The runs *did*
  surface a different failure pattern in the same environmental-race
  family: run 2 produced two `beforeEach`-level timeouts at
  `extension-api.spec.js:267 + 302` (waiting on `game.user` to be
  set after login, 30s timeout exceeded), plus
  `v14-features.spec.js:540` timing out clicking the Equipment tab
  because the persistent hardware-acceleration notification banner
  was intercepting pointer events. Investigation revealed
  `extension-api.spec.js` was the *only* e2e spec lacking the
  per-test `#notifications .notification` banner-removal +
  `ui.windows` cleanup the other three specs (`data-models`,
  `phase1-adapter-dispatch`, `v14-features`) all carry. The slice
  fills the gap: a unified world-state hygiene block at the tail of
  `extension-api.spec.js`'s `beforeEach` closes any open ApplicationV2
  windows, removes notification banners, and purges stale `P*`
  actor probes left by failed prior runs (every probe in the spec
  is named `P<digit>...`, deleted inline in the test body, so a
  crash leaves a stale entry that breaks the next run's
  `game.actors.getName(...)` lookups). +1 new top-of-file Playwright
  case `beforeEach hygiene purges stale state before the test body
  runs` reads `ui.windows.size`, `#notifications .notification` node
  count, and the count of `^P\d`-named actors and asserts all three
  invariants are zero — turns the hygiene into a self-verifying
  contract. **Honest framing in the slice docs + comment block**:
  the change addresses the *family* of environmental races, NOT the
  specific elf:553 / forceCrit:922 test bodies — those didn't
  reproduce in either pre-fix run or the post-fix run, and a
  targeted fix without a concrete failure mode would be speculative.
  Vitest unaffected (1030 green, unchanged). **141 Playwright
  passed** (was 140 baseline + 1 new hygiene test). One latent
  failure (xcc-core-book DCCItemSheet override at line 127 — was
  line 78 in the pre-slice run; line shift is from the new test
  insertion; baseline unchanged). All previously-flaked tests
  passed cleanly: elf:553, forceCrit:922, extension-api:267+302
  (run 2 beforeEach timeouts), v14-features:540 (run 2
  banner-blocking click). Did NOT migrate the spec to the
  worker-scoped session-reuse fixture pattern that
  `phase1-adapter-dispatch` uses — blast radius too large for one
  slice; tracked as a possible follow-up. Closes the flake-chase
  follow-up identified in `01-session-start.md`'s Next-session
  guidance. Remaining Phase 6 work: `registerVariant` for variant-
  class modules (larger scope; touches actor-class selection UI /
  level-change dialog).

- **2026-05-20 — Phase 6 session 5: `registerVariant` for variant
  rulesets (closes Phase 6).** Adds `game.dcc.registerVariant` +
  `game.dcc.getActiveVariant` to `module/extension-api.mjs`. Descriptor
  shape `{ id, label, classes, sheetTheme? }`; `id` is the lowercase
  slug stored in the new `dcc.activeVariant` world setting (defaults
  `'dcc'`). `getActiveVariant()` resolves the setting → registry entry
  with `'dcc'` fallback (survives pre-ready callers where
  `game.settings.get` throws). Active variant's `sheetTheme` (if any)
  is added to the actor sheet element via
  `applyActiveVariantSheetTheme(this.element)` in
  `DCCActorSheet._onRender`. New `module/built-in-variant.mjs` seeds
  the canonical `'dcc'` variant (7 PC classes, no `sheetTheme` — base
  CSS already is the DCC theme). Sibling variant modules like XCC ship
  a single `registerVariant({...})` call from their own `init` hook
  declaring their class IDs + a `sheetTheme` (sibling-module change,
  not system-side); XCC's `CONFIG.Actor.documentClass` override was
  retired 2026-05-18 — Phase 6's variant-API work was the remaining
  piece. +23 Vitest tests on `extension-api.test.js` (registry
  validation, last-write-wins, getActiveVariant pre-ready fallback,
  theme apply / no-theme no-op / idempotency / missing-element).
  +2 Playwright cases in `extension-api.spec.js` (`registerVariant`
  + `getActiveVariant` exposed and the `'dcc'` variant seeded;
  XCC-like variant round-trips through `game.settings.set` and
  `applyActiveVariantSheetTheme`). **1053 Vitest green** (was 1030,
  +23). Playwright count to be confirmed by post-slice full-suite run.
  Closes the last Phase 6 work item; `ARCHITECTURE_REIMAGINED.md §7`
  next phase is Phase 7 (cleanup).
