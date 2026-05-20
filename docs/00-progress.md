# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and
> after any significant decision. Future Claude sessions rely on this.
>
> **Detailed session-by-session history lives in phase archives:**
> - [Phase 0 + 1 — scaffolding + simple rolls](dev/progress/phase-0-1.md)
> - [Phase 2 — spell check migration](dev/progress/phase-2.md)
> - [Phase 3 — attacks, damage, crit, fumble + cruft](dev/progress/phase-3.md)
> - [Phase 4 — data-model slimming + class-mixin extension surface](dev/progress/phase-4.md)
> - [Phase 5 — sheet composition + class defaults + starting items](dev/progress/phase-5.md)

## Archive discipline

**This file is the index, not the log.** Keep it scannable — session
narratives belong in the phase archives above. Rules for maintaining
the split:

- **End-of-session updates go here first**, in *Recent slices*
  (newest at top). Write the slice narrative at whatever detail level
  feels right to the author; don't pre-abbreviate.
- **When *Recent slices* passes 5 entries, push the oldest down to
  the relevant phase archive.** The archives are chronological
  within each phase — append the demoted entry at the end of its
  section. Don't delete anything. If the entry belongs to a phase
  that isn't yet archived (e.g., first Phase 4 slice), start
  `dev/progress/phase-N.md` with the existing archive header style
  and link it from the index above.
- **New phase boundaries** (a slice starts Phase 4 / 5 / 6 / 7) get
  a new archive file from day one. The first slice of a new phase
  lands in *Recent slices* like any other; the archive file exists
  ready to receive it when it rotates out.
- **What stays here indefinitely:** *Current phase* (≤2 paragraphs,
  rewritten each session if the situation moved), *Closed questions*
  (short ticks), *Blockers / open questions* (active only — move
  resolved ones to *Closed* with a one-line date stamp),
  *PR #N review backlog* (these are actionable and short-lived —
  prune fixed items with strikethrough + date, delete fully when
  a section is empty), *Decisions made* (durable — never archived),
  *Next steps*, *Notes for future sessions*.
- **What never goes here:** session-by-session narrative beyond the
  5 most recent, historical decision rationale that's already
  captured in a completed slice, test-count deltas from older
  sessions. If you catch yourself summarizing a session that's
  already in an archive, delete the summary and let the archive
  speak.
- **Cross-linking rule.** Every entry in *Recent slices* should fit
  in 3–6 lines. If the slice has architecturally interesting detail,
  put that detail in the archive and link from the *Recent slices*
  bullet, don't inline it here.
- **No dedup pass required between this file and `01-session-start.md`.**
  The session-start prompt is a self-contained handoff; it will
  drift from this file's *Current phase* summary by a sentence or
  two and that's fine. They're read in different contexts (fresh
  session vs. in-progress update). If they diverge meaningfully,
  treat *this file* as authoritative and refresh the session-start
  prompt when the next slice lands.

**Length check.** If `00-progress.md` creeps past ~600 lines, one of
the rules above is being ignored. The *PR #720 review backlog* is
the most likely offender — prune fixed items with strikethrough +
date, then delete them entirely once a whole sub-section is cleared.

## Current phase

**Phase 6 session 4 (2026-05-20)** closed the open flake-investigation
follow-up by hardening `browser-tests/e2e/extension-api.spec.js`'s
`beforeEach`. Two consecutive full-suite Playwright runs surfaced two
*different* failure patterns in the same family (extension-api:267 +
302 timing out in `beforeEach` waiting for `game.user`;
v14-features:540 timing out on a tab click intercepted by the
hardware-acceleration notification banner). Investigation found that
`extension-api.spec.js` was the only e2e spec lacking the per-test
`#notifications .notification` banner-removal + open-app cleanup the
other three specs (`data-models`, `phase1-adapter-dispatch`,
`v14-features`) all have. The slice adds banner-removal + `ui.windows`
cleanup + stale `P*` actor purge to the `beforeEach`, and a new
self-verifying top-of-file test `beforeEach hygiene purges stale state
before the test body runs` asserting the three invariants
(`ui.windows` empty, no notifications, no stale `P\d` actors). **The
originally-cited flakes (`elf mixin attaches…` at line 553, `forceCrit
shift-click flag…` at phase1:922) did NOT reproduce in either of the
two pre-fix runs or the post-fix run** — the work addresses the FAMILY
of environmental races rather than those specific test bodies.
1030 Vitest green (unchanged — Vitest isn't affected). **141 Playwright
passed** (was 140 baseline +1 new hygiene test; one latent xcc-core-book
`DCCItemSheet → XCCItemSheet` override baseline unchanged at line 127,
was line 78 — line shift comes from the new test).

Remaining Phase 6 work: (1) `registerVariant` for variant-class
modules (larger; touches actor-class selection UI / level-change
dialog). The flake-chase item is closed by this session.

<!-- Detailed prior-phase narrative removed — archived in
`dev/progress/phase-{3,4,5}.md`. The Recent slices section below
keeps the five most-recent entries. -->

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

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
- **2026-05-19 — Phase 5 session 5: migrate remaining capitalized
  `sheetClass` readers to `actor.classId` (closes Phase 5
  sub-arc).** Four mechanical rewrites of
  `system.details.sheetClass === '<CapitalizedClass>'` to
  `actor.classId === '<lowercase>'`:
  - `module/actor.js:198` — elf detect-secret-doors derived
    prepare (`prepareDerivedData` block). Switched
    `this.system.details.sheetClass === 'Elf'` →
    `this.classId === 'elf'`.
  - `module/actor.js:2196` — `rollSpellCheck` dispatcher's
    `isCleric` gate. Was `this.system.details?.sheetClass ===
    'Cleric' || this.system.class?.className === 'Cleric'`; the
    sheetClass leg now uses `this.classId === 'cleric'`. The
    `className === 'Cleric'` leg stays — added 2026-04-23 to
    accept programmatic PCs that haven't been through the
    level-change dialog (no sheetClass populated).
  - `module/actor.js:2497` — `_castNakedViaAdapter` idol-magic
    flag (`isIdolMagic = this.classId === 'cleric'`).
  - `module/dcc.js:775` — `processSpellCheck`'s default-castingMode
    branch for naked checks on cleric actors. Uses
    `actor.classId === 'cleric'` (the function takes an `actor`
    parameter, not `this`).
  Pure-refactor — `actor.classId` is implemented as
  `system.details.sheetClass?.toLowerCase()`, so each migration is
  a no-op behavior change but normalizes the dispatch surface to
  the lowercase canonical IDs that `registerClassMixin` /
  `registerClassDefaults` / `registerClassStartingItems` /
  `registerSheetPart` use.
  +1 Vitest regression-guard test in
  `module/__tests__/class-dispatch-i18n-guard.test.js` (sibling
  to the C3-era localize-on-the-right guard): walks `module/`
  source and fails if any file re-introduces
  `sheetClass === '<CapitalizedClass>'` for the seven built-in
  classes. The Generic sheet's `sheetClass !== 'Generic'`
  first-open check stays — Generic isn't class-bound (no
  CLASS_ID, not on the class registries) so it can't dispatch via
  classId; `actor-sheets-dcc.js` is whitelisted in the guard for
  that reason. `migrations.js` also whitelisted (writer-side
  helper that maps localized className → English sheetClass).
  1003 Vitest green (was 1002, +1 new guard). 134 Playwright
  passed (unchanged from session 4; this slice's only new test is
  the Vitest regression guard, so the Playwright count holds
  steady). No visual regression run — slice doesn't touch sheets
  or templates.
  **Phase 5 sub-arc closes with this slice.** All five
  refactor concerns done: schema mixins (component 1, Phase 4) +
  class defaults (Phase 5-1) + starting items (Phase 5-2 dwarf) +
  link fields (Phase 5-3) + sheet parts (Phase 5-4) +
  module-side reader migration to classId (Phase 5-5). Remaining
  work is Phase 6 (lib-side `registerClassProgression` and
  `registerVariant`).
## Closed questions

5. ~~**Patron-taint mechanic alignment.**~~ **Resolved 2026-04-24 at
   Session 21 / D3a: `dcc-core-lib@0.7.0` models the two RAW triggers
   (creeping chance + patron-spell result-table entries) plus the
   natural-1-forces-row-1 rule; `_runLegacyPatronTaint` deleted.
   D3b (manifestation table loader + cross-repo content mirror) closed
   at session 22; D3b-γ (sibling audit) closed as a no-op; D3c
   (dead-flag cleanup) closed at session 23 via `dcc-core-lib@0.8.0`.
   Entire D3 arc complete.**

6. ~~**Spellburn dialog integration.**~~ **Resolved 2026-04-18 at
   Phase 3 session 1: adapter-side `promptSpellburnCommitment` dialog
   via DialogV2, wired into `rollSpellCheck` dispatcher for the
   wizard / elf + `showModifierDialog` branch.** The latent regression
   from Phase 2 session 2 (wizard adapter casts silently lost the
   Spellburn UI) is fixed. Other legacy-dialog capabilities (die
   tweak, custom modifier rows, CheckPenalty toggle, FleetingLuck)
   remain absent on the adapter path and will be revisited once the
   attack / damage dialog work generalizes the roll-dialog scaffold.

3. ~~**Dead hook `dcc.update`.**~~ **Resolved 2026-05-18: don't emit.**
   Git history showed the DCC system never emitted the hook; XCC's
   listener was speculative from its initial commit (`24b68b1`) and
   its body was a debug-only `console.log` gated on `isDebug` —
   redundant with the adjacent Foundry-native `updateActor` listener
   doing the same thing. Inventing an emission contract from nothing
   would add coupling without a real consumer. XCC removed the
   listener on `chore/drop-dead-dcc-update-hook`; `EXTENSION_API.md`
   Dead-hook table cleared.

## Blockers / open questions

1. ~~**Runtime loading strategy.**~~ **Resolved 2026-04-17: vendor
   approach (option b).** `scripts/sync-core-lib.mjs` builds the linked
   lib and copies its `dist/` into `module/vendor/dcc-core-lib/`, which
   is committed. Adapter code imports via relative path
   (`../vendor/dcc-core-lib/index.js`). No bundler added. One sync
   command (`npm run sync-core-lib`) + one commit per lib-version bump.

2. ~~**Package name discrepancy.**~~ **Closed 2026-05-18.** The
   underlying issue (the unscoped `dcc-core-lib` cannot be `npm
   install`ed because only the scoped `@moonloch/dcc-core-lib` is
   published) was rendered moot by the vendor approach (open question
   #1, resolved 2026-04-17) — the system imports from
   `module/vendor/dcc-core-lib/` and never `npm install`s the lib at
   all. The documentation cleanup (2026-05-18) updated the top of
   `ARCHITECTURE_REIMAGINED.md`, the install step in Phase 0, the
   `EXTENSION_API.md` header, and the "Working with dcc-core-lib"
   section in `CLAUDE.md` to call out the scoped name explicitly and
   note that the bare `dcc-core-lib` token in branch / vendor / repo
   identifiers refers to local-only paths, not the npm package.
   Historical session-handoff prose that says e.g. "synced
   dcc-core-lib@0.7.0" is unchanged — it refers to lib versions, not
   install instructions, and the context is unambiguous.

4. ~~**Undocumented `game.dcc.*` pieces with heavy XCC usage.**~~
   **Closed 2026-05-18.** Re-audit of XCC, MCC, dcc-crawl-classes,
   dcc-qol, and the four content-pack modules against the current
   stable surface confirmed: every `game.dcc.*` symbol XCC actually
   touches (`DCCRoll.createRoll` / `DCCRoll.cleanFormula`,
   `DiceChain.bumpDie` / `calculateCritAdjustment` /
   `calculateProportionalCritRange`, the five-method `FleetingLuck`
   surface — `init`, `updateFlags`, `give`, `enabled`,
   `automationEnabled`, the latter two consumed via
   `Object.defineProperty`, so they must remain configurable —
   `processSpellCheck`, and `registerActorSheet`) appears in
   `EXTENSION_API.md`'s Stable table. No undocumented usage and no
   gaps. The audit also caught two doc-rot items, both fixed in the
   same pass: `dcc.afterComputeSpellCheck` now has a live XCC
   consumer (XCC retired `xcc-actor.js` + `CONFIG.Actor.documentClass`
   override 2026-05-18 in favor of the hook) and XCC migrated all 19
   actor-sheet registrations to `game.dcc.registerActorSheet`. MCC
   (7 sites) and dcc-crawl-classes (9 sites) have not migrated yet;
   that's opt-in with no deadline. See `EXTENSION_API.md` re-audit
   header dated 2026-05-18.

7. **Wizard / elf adapter-path modifier-dialog coverage beyond
   Spellburn.** **Fully resolved 2026-05-17 across sessions 26 +
   27.** Session 26 / Q7-phase1 landed
   `promptRollModifierDialog` + the skill-check fold; session 27 /
   Q7-phase2 extended the wrapper with an optional spellburn
   descriptor and folded wizard / cleric / naked spell-check
   routes onto it (retiring the bespoke
   `promptSpellburnCommitment` helper). The unified prompt now
   surfaces Die / Compound / CheckPenalty / Spellburn / Other
   Bonus in one dialog for both skill checks and spell checks,
   matching the legacy `DCCItem.rollSpellCheck` term layout.
   `_castViaCalculateSpellCheck` subtracts the lib's auto level +
   ability from the dialog total to avoid double-counting when
   feeding the user's flat modifier as a situational. Can be
   closed.

## PR #720 review backlog (2026-04-19)

PR #720 (the merge of Phases 0-3 into `main`) triggered a full
8-agent review. Safe auto-fixes landed in the PR as follow-up
commits; the items below are the deferred findings — real issues or
design calls — that are out of scope for a "review cleanup" commit
and should be scheduled into Phase 4+ work.

**Blocking for Phase 4 start (pick up before broadening the adapter):**

- ~~**Silent adapter→legacy fallbacks missing a logged reason.**~~
  **Fixed 2026-04-23.** Each silent-fallback site now emits a
  `reason=<tag>` field on the dispatch log so the code path is
  readable from the console without opening the source.
    - `buildSpellCheckArgs` returns `null` (custom-class caster with
      no lib profile) → `_rollSpellCheckLegacy` called with
      `reason: 'noCasterProfile'`; the legacy dispatch log carries
      `reason=noCasterProfile` alongside the `spell=…` field.
    - `loadDisapprovalTable` returns `null` (cleric actor without a
      disapproval table configured) → a second
      `logDispatch('rollSpellCheck', 'adapter', { reason: 'noDisapprovalTable' })`
      line fires from `_castViaCalculateSpellCheck`. The adapter path
      continues (degradation, not legacy fall-back) but the silent
      sub-roll skip is now observable.
    - `loadMercurialMagicTable` returns `null` (wizard/elf first-cast
      with no mercurial table) → `_rollMercurialIfNeeded` emits a
      `logDispatch('rollSpellCheck', 'adapter', { reason: 'noMercurialTable' })`
      line and bails; the cast continues without a fresh effect.
  Coverage: three new unit tests in
  `module/__tests__/adapter-spell-check.test.js` (`…reason=noCasterProfile`,
  `…reason=noDisapprovalTable`, `…reason=noMercurialTable`) and three
  matching Playwright cases in
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.
- ~~**Partial-failure state when `_castViaCalculateSpellCheck`'s pass-2
  returns `result.error`.**~~ **Fixed 2026-04-23.** Events now run
  with a rollback-capable wrapper; if pass-2 returns `result.error`
  the adapter reverses applied actor / spellItem mutations before
  returning.
- **Spellburn dialog prompts before the adapter knows it can handle
  the cast.** `rollSpellCheck` (`module/actor.js:1914-1940`) calls
  `promptSpellburnCommitment` before `_rollSpellCheckViaAdapter` tries
  `buildSpellCheckArgs` — when the actor's class has no lib caster
  profile the adapter falls back to `_rollSpellCheckLegacy`, which
  ignores `options.spellburn`, silently dropping the user's
  commitment. Scope is narrow (custom-class wizards / elves with
  spellburn) but user-visible. Fix: a cheap `resolveCasterProfile`
  pre-check before the dialog, or have legacy honor `options.spellburn`.

**Design calls (need a deliberate decision, not a silent fix):**

- **Spellburn clamp: `1` vs `0`.** `onSpellburnApplied`
  (`module/adapter/spell-events.mjs:124`) clamps ability scores at
  1; legacy `DCCSpellburnTerm` allowed 0 (RAW permits a wizard dying
  from Stamina burn). The docstring acknowledges the adapter's
  choice. Decide: preserve legacy (allow 0) or keep the safer
  adapter floor (1) and document it as a house-rules change.
- **Damage `_total` clamp divergence** (`module/actor.js:3096`).
  Foundry clamps `damageRoll._total = 1` when below; the lib
  doesn't. Review cleanup added `warnIfDivergent` with post-clamp
  normalization, so no more false-positive warns — but the
  `dcc.libDamageResult.total` flag can still carry `0` or a negative
  while chat shows `1`. Decide: mirror the clamp on the flag
  (`libDamageResult.total = Math.max(1, libResult.total)`) or
  document that the flag is "lib-native, pre-clamp" and let
  consumers clamp.
- **Error boundaries around `_xxxViaAdapter`.** A lib throw currently
  becomes an unhandled rejection → the cast silently fails, broken UX.
  Wrapping every adapter path in `try/catch` with legacy fallback
  would make the system more forgiving, but risks masking the very
  lib bugs the observational refactor is designed to surface. Right
  answer is probably: add the fallback *after* Phase 4-5 prove the
  adapter paths stable.
- **`createFoundryRoller` — delete or wire.** Review cleanup updated
  the docstring to reflect that no dispatcher path currently consumes
  it. Phase 4 should either adopt it (replacing the inline `new Roll`
  + `evaluate()` scattered across dispatchers) or delete the file.

**Resilience (low-risk, nice-to-have):**

- ~~**`rollSpellCheck`'s cleric branch silently no-ops without
  `details.sheetClass = 'Cleric'`.**~~ **Fixed 2026-04-23.** The
  dispatcher's `isCleric` gate in `module/actor.js` now accepts
  either `system.details.sheetClass === 'Cleric'` OR
  `system.class.className === 'Cleric'` — programmatic PCs (anything
  not routed through the level-change dialog) route via the cleric
  adapter path instead of silently no-oping on the legacy
  `spellItem.rollSpellCheck` delegate. Matches the class-identity
  key `resolveCasterProfile` (`spell-input.mjs:194`) already uses.
  Symmetric effect: wizard / generic branches on a
  className-only-Cleric actor now correctly route to legacy
  (preserving the "wizard spell on cleric → legacy side-effect set"
  contract). Coverage: unit test
  `adapter path fires for a cleric-castingMode item on a
  className-only Cleric (no sheetClass)` in
  `module/__tests__/adapter-spell-check.test.js`; Playwright case
  `cleric-castingMode spell on className-only Cleric (no sheetClass)
  → adapter + chat` in
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js`.

- **Programmatic PC creation produces inconsistent class config —
  the system relies on the level-change dialog to populate it.**
  `Actor.create({..., system: { class: { className: 'Wizard' } } })`
  does NOT set `class.spellCheckAbility` (defaults to `'per'` for
  every class — Wizards then cast with Personality, formula AND
  flavor), `details.sheetClass` (cleric branch above won't fire),
  `saves.{ref,frt,wil}.classBonus` (saves drop to ability-mod-only),
  or class-appropriate crit die / luck die / etc. Real users get
  these via the level-change dialog (which applies a class-specific
  level item from `CONFIG.DCC.levelDataPacks`), so end-users don't
  hit this — it bites browser-test fixtures, the PC parser when a
  field is missing, and any future "quick PC" tooling. Two paths to
  resolve: (a) document the level-change-dialog dependency
  prominently and have programmatic creators call into the same
  apply-level-data routine, or (b) register the standard DCC class
  progressions with the lib (`registerClassProgression`) and have
  the system auto-derive defaults from `class.className` + level on
  prepare. The lib already has `getSavingThrows("warrior", 3)` etc.
  — currently returns zeros because no class is registered. Option
  (b) is more invasive but eliminates a whole class of "PC silently
  has wrong stats because user skipped the level-up dialog" bugs.
  Surfaced 2026-04-23 during exhaustive manual-testing.

- **Chat doesn't surface the per-modifier breakdown the adapter
  already captures.** The lib emits each contributing modifier with
  rich origin metadata (`{ kind, value, origin: { category, id,
  label }, applied }`) and the adapter persists the array onto the
  ChatMessage as `flags.dcc.libResult.modifiers` (see
  `module/adapter/chat-renderer.mjs` — every renderer projects it).
  Nothing currently renders it: chat templates don't reference
  `libResult.modifiers`, and because the adapter builds the Foundry
  Roll from the lib's flat formula string (`new Roll(plan.formula)`),
  Foundry's native term-tooltip is unlabelled too — a regression vs.
  the legacy `module/roll-modifier.js` path, which set per-term
  `label` (e.g. "Strength", "Stamina") that Foundry's tooltip
  surfaced. Cheapest fix: a small chat-template partial under the
  rolled formula that lists each `applied` modifier as
  `<origin.label> <signed value>` (e.g. "STA modifier +1, Save bonus
  +0"). More invasive alternative: reconstruct the Roll term-by-term
  in the adapter so the native Foundry tooltip works again — keeps
  parity with the legacy path's UX without adding a chat partial,
  but requires every renderer / dispatcher to thread structured
  terms instead of a string formula. Surfaced 2026-04-23 during the
  Cheesemaker save-bonus debugging session — modifier metadata is
  available to downstream modules (`dcc-qol` etc.) and to debugger
  scripts via the flag, but invisible to the player reading chat.

- **Dispatcher gate style inconsistency.** Attack / damage / crit /
  fumble use named `_canRouteXxxViaAdapter` predicates; ability /
  save / skill / spell / init inline their gates as
  `const needsLegacyPath = …`. Pick one convention and retrofit —
  the named predicate form scales better as gates grow.
- **Unused `weapon` / `attackRollResult` parameters** on
  `_canRouteCritViaAdapter` / `_canRouteFumbleViaAdapter`
  (`weapon` unused) and `_rollCriticalLegacy` / `_rollFumbleLegacy`
  (`attackRollResult` unused). Dropping them touches test call
  sites that pass positional args; clean as a pair of coordinated
  edits but out of scope for the review cleanup. Tracker: do this
  with the gate-style unification above. (Note: `_rollCriticalLegacy`
  / `_rollFumbleLegacy` retired at session 16 — revisit the
  remaining predicate params.)
- **Three copies of "strip die count" normalization:**
  `module/adapter/attack-input.mjs:normalizeLibDie`,
  `module/adapter/spell-input.mjs:normalizeLibDie` (private), and
  `module/actor.js:_stripDieCount`. Pick one canonical
  `normalizeLibDie` (probably `attack-input.mjs`'s, it's already
  exported) and consolidate.
- **Four near-identical `dcc.libResult` flag payloads** in
  `module/adapter/chat-renderer.mjs` — every renderer hand-rolls
  the same projection plus the `FleetingLuck.updateFlags` guard.
  Extract a `buildLibResultFlag(result, extras)` + `applyFleetingLuck(flags, roll)`
  helper; renderers keep per-type extras only.
- **Uncached compendium walks.**
  `loadDisapprovalTable` + `loadMercurialMagicTable`
  (`module/adapter/spell-input.mjs`) walk packs on every cleric
  disapproval / wizard first-cast. `getCritTableLink` +
  `getCritTableResult` (`module/utilities.js`, reached from
  `_rollCriticalViaAdapter`) do two independent pack walks per
  crit. Module-level `Map` cache keyed on `tableName`, cleared on
  world reload, is plenty. The caching opportunity was already
  flagged in `spell-input.mjs:399`.
- **`migrateWorld` per-doc catches swallow silently** (C2 review,
  2026-04-24). Four `catch (err) { console.error(err) }` sites in
  `module/migrations.js` (`migrateWorld`'s actors/items/scenes loops
  + `migrateCompendium`) log to console and keep going. A
  migration that fails on every document still stamps the world at
  `NEEDS_MIGRATION_VERSION` and shows the green "complete"
  notification, so the GM has no signal. Align with the
  `9e79459 feat(adapter): reason codes for silent adapter→legacy
  fallbacks` pattern: accumulate failures into a `failedMigrations[]`
  array, surface a `ui.notifications.warn` with the count at the
  end, and only stamp the version when the run was clean.
- **`migrateWorld` fire-and-forget from a sync ready hook** (C2
  review, 2026-04-24). `checkMigrations` calls `migrations.migrateWorld()`
  without `await` from a non-async ready callback, so the rest of
  the ready chain (`registerTables`, `FleetingLuck.init`,
  `SpellDuel.init`, `defineStatusIcons`, welcome dialog,
  `Hooks.callAll('dcc.ready')`) runs concurrently with the async
  per-document mutations. Third-party modules listening on
  `dcc.ready` can fire against a half-migrated world. Pre-existing;
  elevated by C2 because the guard-up-front approach now means
  ordering is the only remaining correctness lever. Fix: make
  `checkMigrations` async, `await migrations.migrateWorld()`, and
  thread a `{ migrationComplete: true }` payload on `dcc.ready`.

**Test coverage gaps (pr-test-analyzer severity ≥ 6):**

- `renderDisapprovalRoll` has no unit/integration test — only covered
  transitively via the cleric disapproval browser-test case.
- `promptSpellburnCommitment` + `clampBurn` are entirely mocked
  across every caller; `roll-dialog.mjs` has no direct coverage.
- `onSpellLost` is tested as a direct callback but never verified to
  *actually fire* during a real adapter cast — regression surface if
  `createSpellEvents` wiring drifts.
- Two-pass divergence (hook mutates terms *after* pass 1) only has
  coverage for the `terms[0]` die-bump case; `terms[N]` Compound /
  Modifier in-place mutations are uncovered.
- `_canRouteAttackViaAdapter` untested branches: dice-bearing
  `weapon.toHit` (e.g. `+1d4` magic), `twoWeaponSecondary: true`,
  and the `game.settings.get` try/catch fallback. **(Note: gate
  retired at session 15 — these assertions moved to the single-path
  body.)**
- `_rollToHitViaAdapter` NPC `attackHitBonus.melee.adjustment`
  Modifier injection block is uncovered (PC-only tests).
- `_rollToHitViaAdapter` `Roll.validate(toHit) === false` early
  return path is untested.
- `loadDisapprovalTable` / `loadMercurialMagicTable` isolated
  fallback-order tests (compendium hit / world fallback / both miss)
  are missing.
- `createFoundryRoller` has no direct unit test (ties to the
  delete-or-wire decision above).
- `__mocks__/dcc-roll.js` declares `createRoll` as `static async`
  while production is sync; tests install local sync stubs to
  paper over the mismatch — fix the shared mock, delete the stubs.
- **Surviving data-driven migration branches have no fixture
  tests** (C2 review, 2026-04-24). `migrateActorData` /
  `migrateItemData` retain the V14 ActiveEffect numeric-mode →
  string-type converter, the `sheetClass`-from-localized-`className`
  inverse helper, `critRange` / `disapproval` string→number
  coercion, `luckyRoll` → `birthAugur`, and default alignment.
  None have direct Vitest coverage; they're exercised only
  transitively when Foundry boots a real world. The V14 AE
  converter is particularly V14-critical — if it silently stops
  running, every pre-V14 active effect fails to apply on upgrade.
  Proposed: `migrations-data-driven.test.js` with one fixture per
  branch (numeric-mode effect → string-type, localized
  `className: 'Zwerg'` → `sheetClass: 'Dwarf'`, stringy
  `critRange: '20'` → number, unaligned actor → alignment `'l'`,
  `luckyRoll: '…'` → `birthAugur`). Requires exporting
  `migrateActorData` / `migrateItemData` (currently module-local
  `const`) or a test-only export.

**Documentation / comment hygiene:**

- `docs/dev/ARCHITECTURE_REIMAGINED.md` §7 Phase-1 bullets reference
  lib APIs `rollCheck('ability:str', …)` / `resolveSkillCheck(…)` /
  `rollInitiative(…)` but the adapter landed `rollAbilityCheck` /
  `rollSavingThrow` / `rollCheck` (subsumed skill + init). Annotate
  the bullets with landed names.
- ARCHITECTURE_REIMAGINED.md §2.7 file-size snapshot is pinned to
  branch start; prefix with a `(Snapshot at main @ 2337ec0)` note
  so readers don't mistake it for current state.
- `module/actor.js:2136-2138` ("post the disapproval roll chat
  after the main spell-check chat, mirroring the legacy two-message
  ordering") overstates ordering guarantees — `onDisapprovalIncreased`
  fires fire-and-forget inside pass 2, actual interleaving is at
  the mercy of Foundry's chat-message pipeline. Soften the claim or
  `await` the chat-message creation inside the event.
- `_getInitiativeRollViaAdapter` accepts an `options = {}` parameter
  it never reads — drop, or document "reserved for future
  modifier-dialog bridge."

**Performance (below measurement threshold; document only):**

- `getActionDice` called 3× per `_rollToHitViaAdapter`
  (`module/actor.js:2735-2752`). Hoist to a single `const dice = ...`.
- `items.find` called 2× per `_getInitiativeRollViaAdapter`
  (`module/actor.js:1065, 1070, 1129, 1133`). Fold into one iteration.
- `renderDisapprovalRoll` / `renderMercurialEffect` use
  `new Roll('${N}d1')` for deterministic chat. Use
  `Roll.fromTerms([new NumericTerm({ number: total })])` — no
  measurable win, but reads cleaner.

## Decisions made

0. **Runtime loading: vendor the lib's built `dist/`.** See open
   question #1 above for the full rationale. Committed the initial
   sync + `scripts/sync-core-lib.mjs` in a standalone prep commit so
   Phase 1 imports have somewhere to import *from*. The sync script
   reads from `$DCC_CORE_LIB_SRC` (default
   `/Users/timwhite/WebstormProjects/dcc-core-lib`), runs `npm run
   build` inside the lib, wipes and copies `dist/`, and writes a
   `VERSION.json` with `{ name, version, commit, dirty, syncedAt }`.
   `module/vendor/**` added to `standard.ignore` so the linter skips
   vendored output.

1. **Worktree location.** Now at
   `/Users/timwhite/FoundryVTT-Next/Data/systems/dcc`. Main repo remains
   at `/Users/timwhite/FoundryVTT/Data/systems/dcc`.
   *Why:* `FoundryVTT-Next` is a separate Foundry user-data install, so
   the worktree can live under its `systems/` directory without clashing
   with the main repo on `system.json` id (each Foundry install sees
   only its own `systems/` tree). This lets Tim actually run the
   refactored system in Foundry for testing during Phase 1+.
   *History:* originally parked at
   `/Users/timwhite/WebstormProjects/dcc-refactor` on 2026-04-17 to
   avoid `systems/` collisions; moved same day once the separate
   `FoundryVTT-Next` install was set up.

2. **No `package.json` dependency entry this phase.** Adding
   `"@moonloch/dcc-core-lib": "file:../../../WebstormProjects/dcc-core-lib"`
   would break CI (absolute path, ubuntu runner), and `"*"` or any
   registry version fails because the package is unpublished. Chose to
   leave `package.json` alone and document `npm link` in this log.
   Revisit when open question #1 is resolved.

3. **Adapter stubs are empty by design.** The goal of Phase 0 is to lock
   in the *shape* of the adapter layer (which concerns live where) and
   catch any architectural objections before implementation starts in
   Phase 1. Empty stubs give reviewers a file-tree to react to; filled
   stubs would invite relitigation on boilerplate.

4. **Hook categorization method.** "Stable" = emitted *and* actively
   consumed by a sibling module. "Internal" = emitted but no external
   consumer found in the audited modules. "Dead" = listened to
   externally but never emitted (or vice versa). Tagged per-item in
   `docs/dev/EXTENSION_API.md`.

5. **Dispatch logs are permanent infrastructure** (2026-04-18).
   Originally planned to strip at Phase 1 close; reversed because
   the Playwright dispatch spec asserts on them. Every
   `_xxxViaAdapter` / single-path-with-branch added in later phases
   must call `logDispatch(...)` as its first line. See
   "Dispatch logging" note below.

6. **`game.dcc.processSpellCheck` is permanent stable API**
   (Phase 2 close, 2026-04-18). Don't deprecate; don't shim; route
   migration is per-call-site and incremental. See phase-2.md
   Phase 2 CLOSE section for full rationale.

7. **Legacy-branch retirement principle** (added post-Phase-2,
   2026-04-19; see `ARCHITECTURE_REIMAGINED.md §8.6`). Foundry-facing
   API (`DCCActor.rollXxx`, `game.dcc.*`, hooks) stays as thin
   wrappers indefinitely. Internal `_xxxLegacy` branches and
   direct-reimpl methods retire once adapter coverage is exhaustive
   for their call site. **Supersedes** earlier "permanent legacy
   branch" close-outs — those blockers are back on the critical
   path. Group D D1 / D2 (attack / crit / fumble / damage) all
   landed under this principle.

## Next steps

**Post-Group-E-session-1 (2026-05-18) — Groups A, C, and D are
fully closed; open questions #2, #3, #4, and #7 all closed
2026-05-18.** `rollWeaponAttack` + all four chained calls are
single-path via the adapter; `module/migrations.js` targets V14-era
(0.66+) worlds only; patron-taint matches DCC RAW end-to-end; the
unified roll-modifier dialog covers wizard / cleric / naked spell
checks + skill checks. Group E session 1 added the per-class
mercurial-magic table registry, closing the long-standing §2.4
generalization promise. Remaining Group E candidates (any are
viable next):

1. **Halfling vertical slice** — most natural Phase 4 starter
   because it concentrates the schema-slimming question on one
   class. Exercises §2.1 (monolithic Player schema) directly.
2. **Homebrew single-class slice** — most ambitious; exercises
   Phase 4 + 5 + 6 end-to-end via `registerClassMixin` +
   `registerSheetPart` + variant-aware data loading. Largest blast
   radius but lays the most pattern down.

(Mercurial-magic, originally listed here as the third candidate,
landed as Group E session 1 — see Recent slices.)

**Cross-repo coordination:** if any migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with
`allowLuck` needing dice-chain bumps), land the lib change first in
its own PR in `dcc-core-lib`, then sync via `npm run sync-core-lib`.

**Sibling-module status:** XCC has consumed the
`dcc.afterComputeSpellCheck` hook + `game.dcc.registerActorSheet`
recipes shipped in B1-followup / B1-followup-2; PR pending on
`foundryvtt-dcc/xcc` branch `chore/migrate-to-dcc-extension-api`.
Same branch also retires 9 XCC-side redefinitions of DCC class
schema fields (luckDie, backstab, knownSpells, maxSpellLevel,
disapproval, disapprovalTable, deity, corruption,
spellCheckAbility) that were silently clobbering DCC defaults.
Phase 4 schema-mixin design needs to coordinate with the XCC field
consumption documented in this PR.

## Notes for future sessions

- The pre-commit hook runs `npm run format` → `git add .` → `npm test`.
  That `git add .` **will sweep untracked files into the commit**. Before
  committing, either stash or add to `.gitignore`.
- **Lib updates require `npm run sync-core-lib`** to re-vendor
  `module/vendor/dcc-core-lib/`. Commit the vendor delta separately
  from any adapter change that depends on it — two commits: `vendor:
  sync dcc-core-lib to <version> (<sha>)` then the adapter change.
  `VERSION.json` records the lib's git SHA and flags `dirty: true` if
  the lib tree had uncommitted changes at sync time (do not release
  from a dirty sync).
- `npm link @moonloch/dcc-core-lib` is no longer required for runtime
  loading (the vendored copy is used instead). It *is* still useful if
  you want TypeScript-aware IDE support against the linked source, but
  nothing in the system imports from `@moonloch/dcc-core-lib` at
  runtime anymore — all imports are relative paths into
  `module/vendor/dcc-core-lib/`.
- Sibling modules that must keep working:
  - `../../modules/dcc-qol` — attack hook consumer, reaches into
    `DiceChain.bumpDie` + `DCCRoll.createRoll`
  - `../../modules/xcc` — heaviest consumer; variant game fighting the
    system (replaces `CONFIG.Actor.documentClass` globally)
  - `../../modules/mcc-classes` — clean schema-hook consumer
  - `../../modules/dcc-crawl-classes` — clean schema-hook consumer

### Dispatch logging (permanent)

- Centralized at `module/adapter/debug.mjs`. Every dispatch path calls
  `logDispatch(rollType, 'adapter'|'legacy', details)` to print one
  line to the Foundry console, e.g.
  `[DCC adapter] rollSavingThrow → via adapter saveId=ref`.
- **The logs are permanent, not a Phase-1 scaffold** (decision
  2026-04-18). `browser-tests/e2e/phase1-adapter-dispatch.spec.js`
  captures them via Playwright and asserts every dispatcher branch
  end-to-end; stripping the logs would delete that signal.
- Every `_xxxViaAdapter` / `_xxxLegacy` added in later phases (spell,
  attack, damage, crit, fumble) must call `logDispatch(...)` as its
  first line. Mirror the pattern at `_rollSavingThrowViaAdapter` in
  `module/actor.js`.
- The helper's header JSDoc describes the role. This bullet is the
  process-level reminder; `debug.mjs` itself should be treated as
  core adapter infrastructure on a par with `chat-renderer.mjs` and
  `character-accessors.mjs`.

### Silent adapter→legacy fallback reason codes (2026-04-23)

- Every silent-fallback site emits a `reason=<tag>` field on the
  dispatch log. Pattern: `logDispatch('rollXxx', 'adapter' | 'legacy',
  { reason: 'camelCaseTag', ...extras })` so the Foundry console is
  self-documenting ("why did this cast fall back?") without opening
  source. Tags in use: `noCasterProfile`, `noDisapprovalTable`,
  `noMercurialTable`. New fallback sites added in future sessions
  must pick a short tag and document it here.
