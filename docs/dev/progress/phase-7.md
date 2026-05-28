# Phase 7 — Cleanup

> Archive of session-by-session detail for Phase 7: the formal
> cleanup window for the `refactor/dcc-core-lib-adapter` branch.
> Items per `ARCHITECTURE_REIMAGINED.md §7`:
>
> 1. ~~Retire `critText`/`fumbleText` compatibility shims.~~
>    Done as Phase 3 session 20 / C1 (2026-04-20).
> 2. ~~Prune pre-V14 migrations past the minimum data version.~~
>    Done as a chore(cruft) slice / C2 (2026-04-23).
> 3. Split `module/dcc.js` (~1655 lines after Phase 6 closes) into
>    focused modules — Handlebars helpers, macro factories,
>    settings-table hooks, `processSpellCheck`, chat / hook wiring,
>    table loading. Target ~4–5 files per Appendix A.
> 4. Split `styles/dcc.scss` (~2979 lines) into partials + theme
>    layer; document CSS custom properties as a theming contract so
>    the Phase 6 `sheetTheme` mechanism has documented variables to
>    override.
> 5. ~~Extract `module/ruleset/` into the variant config for DCC
>    core.~~ No-op — the directory doesn't exist on this branch
>    (already extracted, or never landed as a real module).
>    Confirmed 2026-05-20 at the Phase 7 kickoff.
>
> See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state.

---

- **2026-05-20 — Phase 7 session 1: extract Handlebars helpers from
  `dcc.js` into `module/handlebars-helpers.mjs` (opens Phase 7).**
  Pure refactor — moves the four helpers (`add`, `stringify`,
  `distanceFormat`, `dccPackExists`) out of the init hook and into
  a focused module exporting each helper individually plus a
  `registerDCCHandlebarsHelpers()` entry-point the init hook calls
  in place of the four inline `Handlebars.registerHelper(...)`
  blocks. ~20 lines removed from `dcc.js`'s init body; the file is
  still 1655 lines pre-future-extractions but the pattern for the
  remaining splits (macros, settings-table hooks, `processSpellCheck`,
  chat / hook wiring, table loading) is now established. The Phase 7
  work list was also reconciled against the source at session start:
  items 1 (`critText`/`fumbleText` retirement) + 2 (pre-V14 migration
  pruning) were already done as C1 + C2 chore slices in 2026-04;
  item 5 (extract `module/ruleset/`) is a no-op because the
  directory doesn't exist on this branch. Remaining Phase 7 work is
  the `dcc.js` piecemeal split (this slice) + the `styles/dcc.scss`
  partials split. +12 Vitest tests in new
  `module/__tests__/handlebars-helpers.test.js` (3 add cases:
  ints / string-coercion / negative; 2 stringify cases:
  object / array; 4 distanceFormat cases: trailing apostrophe / no
  apostrophe / negative / non-matching; 2 dccPackExists cases:
  pack-present + fn branch / pack-missing + inverse branch;
  1 `registerDCCHandlebarsHelpers` test asserting all four names
  register against a mocked `Handlebars.registerHelper`). +1
  Playwright case in `extension-api.spec.js` (`DCC Handlebars
  helpers (add / stringify / distanceFormat / dccPackExists) survive
  registerDCCHandlebarsHelpers extraction`) — reads
  `Handlebars.helpers.{add, stringify, distanceFormat, dccPackExists}`
  off the live page, invokes each (including dccPackExists with a
  real pack collection + a missing pack name), and asserts identical
  outputs to the pre-extraction inline definitions. **1065 Vitest
  green** (was 1053, +12). **143 Playwright passed** + 1 latent
  failure (the long-standing xcc-core-book DCCItemSheet override
  baseline at `extension-api.spec.js:162`, unchanged from every
  prior session). Phase 6 session 5's "Playwright count to be
  confirmed by post-slice full-suite run" can also be retroactively
  closed by this run — the pre-slice baseline was 142 passes (140
  pre-session-4 + 1 session-4 hygiene + 2 session-5 registerVariant
  cases minus 1 ongoing latent failure); this slice's +1 case lands
  the post-slice count at 143 passed.

- **2026-05-20 — Phase 7 session 2: extract macro factories from
  `dcc.js` into `module/macros.mjs`.** Second piecemeal Phase 7
  extraction — relocates the largest cohesive block in `dcc.js`
  (~380 lines, was `dcc.js:1255–1634`) into a focused module. The
  relocated surface is the 13 `_createDCCXxxMacro` factories
  (Ability / Initiative / Hit Dice / Save / Skill / Luck Die /
  Spell Check / Attack Bonus / Action Dice / Weapon / Item /
  Apply Disapproval / Roll Disapproval), the `MACRO_FACTORIES`
  dispatch table, the `createDCCMacro` dispatcher, the
  `rollDCCWeaponMacro` weapon-roll bridge, `getMacroActor`, and
  `getMacroOptions`. `module/dcc.js` shrinks from 1655 → 1255
  lines (-400 lines net including the new `import` and the
  factoring-out of the inline `handlers` map that lived inside
  `createDCCMacro`). The init hook keeps the three end-user macro
  surface entries on `game.dcc.*` (`rollDCCWeaponMacro`,
  `getMacroActor`, `getMacroOptions` — internal but de-facto
  stable per `EXTENSION_API.md`'s "macro-surface functions are
  internal to modules but published to end-user macro scripts"
  classification); the `hotbarDrop` hook still calls
  `createDCCMacro(data, slot)` — now imported from `macros.mjs`
  instead of inlined. Pure refactor — every macro shape
  (`{ name, command, img }` triple) and the runtime behavior of
  every factory + dispatcher branch is preserved verbatim. Only
  structural change: the `handlers` map that lived inside
  `createDCCMacro` is lifted to module scope as `MACRO_FACTORIES`
  + exported so the dispatch table can be unit-tested
  independently of the dispatcher body. +37 Vitest tests in new
  `module/__tests__/macros.test.js`. +1 Playwright case in
  `extension-api.spec.js` (`DCC macro factories ... survive
  macros.mjs extraction`). **1102 Vitest green** (was 1065, +37).
  **143 Playwright passed** + 2 failures (latent xcc-core-book
  DCCItemSheet override + the suite-only forceCrit shift-click
  flake from Phase 6 sessions 1/2/4 — neither slice-caused).

- **2026-05-20 — Phase 7 session 3: extract settings-table hooks
  from `dcc.js` into `module/settings-table-hooks.mjs`.** Third
  piecemeal Phase 7 extraction — relocates the nine top-level
  `Hooks.on('dcc.{register,set}Xxx', ...)` handlers (was
  `dcc.js:932–1019`, ~88 lines) into a focused module. The
  handlers cover: `dcc.registerDisapprovalPack` /
  `dcc.registerCriticalHitsPack` (delegate to
  `CONFIG.DCC.{name}Packs.addPack`); `dcc.setDivineAidTable` /
  `dcc.setFumbleTable` / `dcc.setLayOnHandsTable` /
  `dcc.setTurnUnholyTable` (first-write-wins on the matching
  `CONFIG.DCC.<name>Table` scalar, with `fromSystemSetting=true`
  overriding); `dcc.registerLevelDataPack` (lazy-inits a
  `TablePackManager` onto `CONFIG.DCC.levelDataPacks` if absent
  then delegates `.addPack`); `dcc.registerMercurialMagicTable`
  (per-class registry writing `CONFIG.DCC.mercurialMagicTables[classKey] = value`
  + mirroring onto the legacy `mercurialMagicTable` field iff
  `classKey === 'default'`); and `dcc.setMercurialMagicTable`
  (legacy single-table setter — first-write-wins, system-setting
  override, mirrors onto `mercurialMagicTables.default`). Each
  handler is exported individually as a plain function
  (`onRegisterDisapprovalPack`, `onSetDivineAidTable`, …) plus a
  frozen `SETTINGS_TABLE_HOOKS` dispatch table mapping hook name
  → handler and a `registerSettingsTableHooks()` entry-point that
  iterates the dispatch table and registers each via `Hooks.on`.
  `module/dcc.js` shrinks from 1254 → 1172 lines (-82 net
  including the new `import` line and a 5-line replacement
  comment + call). Pure refactor — hook names, parameter shapes,
  defaults (`fromSystemSetting = false`), and mutation semantics
  are preserved verbatim across every handler. Sibling modules
  (dcc-core-book, xcc-core-book) emit
  `Hooks.callAll('dcc.setFumbleTable', 'module.fumble', false)`
  exactly as before and see the same `CONFIG.DCC.fumbleTable`
  mutation land. **No external contract change.** +25 Vitest
  tests in new `module/__tests__/settings-table-hooks.test.js`:
  3 disapproval-pack cases (delegation with explicit
  `fromSystemSetting=true`, default `false` when omitted, no-op
  when CONFIG.DCC.disapprovalPacks is absent), 2 critical-hits-pack
  cases (delegation, no-op when registry absent), 3 divine-aid
  cases (first-write, first-write-wins on subsequent non-system
  writes, system-setting override), 1 fumble + 1 layOnHands + 1
  turnUnholy case each (same three-phase pattern), 2 levelData
  cases (lazy-init constructs TablePackManager with the probe
  pack stored under `_packs[name]`, reuse on subsequent calls),
  4 per-class mercurial cases (per-class write doesn't touch
  legacy field, `'default'` classKey mirrors onto legacy field,
  no-op on falsy classKey, no-op on falsy value), 4 legacy
  mercurial cases (sets when unset, first-write-wins, system
  override touches both fields + default slot, per-class slots
  unaffected), 1 SETTINGS_TABLE_HOOKS dispatch-table
  one-to-one routing assertion, 1 dispatch-table-covers-exactly-9
  assertion, 1 `registerSettingsTableHooks` wires-all-9-via-Hooks.on
  assertion + 1 calls-Hooks.on-exactly-9-times assertion. Test
  file stubs `CONFIG` (and per-describe `Hooks`) in `beforeEach`
  and restores in `afterEach` — same pattern as Phase 7 sessions
  1 & 2. +1 Playwright case in `extension-api.spec.js` (`DCC
  settings-table hooks (disapproval / critical hits / level data
  packs + 4 set-table hooks + mercurial registry) survive
  settings-table-hooks.mjs extraction`) — snapshots seven
  `CONFIG.DCC.*` slots (`divineAidTable`, `fumbleTable`,
  `layOnHandsTable`, `turnUnholyTable`, `mercurialMagicTable`,
  `mercurialMagicTables.default`, `levelDataPacks`), fires every
  hook via `Hooks.callAll(...)` with a probe value, asserts each
  expected mutation landed (pack present in `_packs[name]`, table
  scalar updated, per-class mercurial entry written without
  touching legacy field, lazy-init of `levelDataPacks` when
  absent), then restores all seven snapshots in a `finally` block
  so downstream tests in this spec see the prior state. **1127
  Vitest green** (was 1102, +25). **145 Playwright passed** + 1
  failure: the latent xcc-core-book DCCItemSheet override at
  `extension-api.spec.js:320` (unchanged baseline, flagged every
  prior session as pre-existing — line shifted from 213 because
  this slice inserted a new test earlier in the file). The
  documented `phase1-adapter-dispatch.spec.js:922 forceCrit
  shift-click flag` suite-only flake did NOT fire this run, so
  pre-slice baseline was 143 passed and post-slice is 145 (+1 new
  test + 1 forceCrit recovered).
