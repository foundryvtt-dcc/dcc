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

- **2026-05-21 — Phase 7 session 4: extract `processSpellCheck` from
  `dcc.js` into `module/spell-check-processor.mjs`.** Fourth
  piecemeal Phase 7 extraction — relocates the ~200-line public
  stable-API function `processSpellCheck` (was `dcc.js:637–842`)
  into a focused module. The function handles every spell-check
  cast routed through `game.dcc.processSpellCheck` — evaluates the
  roll (lazy `roll._evaluated` check), applies the shift-click GM
  `forceCrit` mutation (rewrites natural to 20 + recomputes total;
  no-op when natural is already 1), rolls patron taint when the
  actor has a `class.patron` field and the spell name contains
  `'Patron'` OR carries an `associatedPatron` (d100 vs.
  `patronTaintChance`, persists `+1%` chance increment back to the
  actor), branches on `rollTable` presence (with-table path:
  natural-20-on-Player crit boosts result lookup by level AND
  mutates the roll with `OperatorTerm('+')` + `NumericTerm(level)`
  + `_formula += ' + N'` + `_total += N`; natural-1 fumble looks
  up row 1; otherwise lookup by `roll.total`; routes through
  `game.dcc.SpellResult.addChatMessage` with `{crit, fumble, item,
  patronTaint, messageData}`; no-table path: emits one of four
  `<p class="emote-alert ...">DCC.SpellCheck{Fumble,Crit,Success,
  Failure}NoTable</p>` indicators based on natural roll and
  threshold-check, generates the `dcc.{RollType, isSpellCheck,
  isSkillCheck, ItemId, spellResult}` flag block,
  `FleetingLuck.updateFlags`-amends it, and emits via
  `roll.toMessage`), determines casting mode from
  `item.system.config.castingMode` OR — for item-less casts —
  defaults to `'wizard'` with a `'cleric'` override when
  `actor.classId === 'cleric'`, routes side-effects (wizard:
  `await actor.loseSpell(item)` when `automateWizardSpellLoss` ON
  and threshold-failed; cleric: `rollDisapproval(naturalRoll)`
  when `automateClericDisapproval` ON and natural inside
  `class.disapproval` range, then `applyDisapproval()` if the
  cast failed either via disapproval-forces-failure or
  threshold), and finally writes `roll.total` back to
  `item.system.lastResult` for the spells-tab display. The
  function is exported as a named symbol; `module/dcc.js` keeps
  the `game.dcc.processSpellCheck` re-publication at init time
  (Foundry-facing stable surface per `EXTENSION_API.md` /
  `00-progress.md` Decision #6 — no contract change, no
  deprecation path). `module/dcc.js` shrinks from 1172 → 970
  lines (-202 net including the new `import` line, the 5-line
  replacement marker comment, and dropping `Roll` from the
  `/* global */` declaration since the patron-taint `new
  Roll('1d100')` moved with the function). Pure refactor —
  continues to read `game.dcc.SpellResult` / `game.dcc.FleetingLuck`
  rather than importing them directly, mirroring the pattern in
  `module/actor.js`'s spell-check paths and preserving the
  init-time `game.dcc` registration order. +23 Vitest tests in
  new `module/__tests__/spell-check-processor.test.js`: 3
  evaluation/forceCrit cases (lazy evaluate, forceCrit total
  recompute, natural-1 forceCrit no-op preserves fumble), 5
  natural fumble/crit detection cases (natural-1 fumble HTML +
  flag shape, natural-20 Player crit HTML, natural-20 NPC does
  NOT crit per Player-only rule, success indicator path, failure
  indicator path), 5 rollTable branch cases (non-crit lookup by
  roll.total, natural-1 forces row-1 lookup, natural-20 Player
  boosts lookup by level and mutates roll, string-level coerced
  via parseInt (regression of the spell-check-crit fix),
  no-item flavor + speaker forwarded in messageData), 5
  casting-mode side-effect cases (wizard automation OFF skips
  loseSpell, wizard automation ON fires loseSpell on threshold
  failure, cleric automation natural-inside-disapproval-range
  fires both rollDisapproval + applyDisapproval, cleric
  automation natural-outside-range with threshold-failure still
  applies disapproval, no-item cleric inference from
  `actor.classId === 'cleric'`), 3 patron-taint branch cases
  (patron-bound actor on Patron-named spell rolls d100 +
  updates patronTaintChance "1%" → "2%", actor without patron
  does NOT update, patronTaint object forwarded into
  SpellResult.addChatMessage with tainted/oldChance/newChance/roll
  fields), 2 item.lastResult cases (writes roll.total when item
  present, no-item path skips lastResult). Test file stubs
  `game`, `ChatMessage`, `foundry`, `Roll` per `beforeEach` and
  restores per `afterEach` — same pattern as Phase 7 sessions
  1, 2, 3. +1 Playwright case in `extension-api.spec.js` (`DCC
  processSpellCheck survives spell-check-processor.mjs extraction`)
  — creates a temporary `P_SpellProc Probe` Player, evaluates a
  real `1d20+5` roll, snapshots existing chat-message IDs, fires
  `game.dcc.processSpellCheck(actor, { roll, flavor:
  'P_SpellProc probe', forceCrit: false })`, asserts the new
  chat message carries `dcc.RollType === 'SpellCheck'` +
  `isSpellCheck === true` + `isSkillCheck === true` and a
  `spellResult` HTML envelope matching
  `^<p class="emote-alert (fumble|critical)">[^<]+</p>$`
  (specific branch depends on the natural roll; envelope is
  fixed and the localized text is non-empty), then cleans up
  the created chat messages so downstream tests start from the
  prior snapshot. **1150 Vitest green** (was 1127, +23). **145
  Playwright passed** + 2 failures: (1) the latent xcc-core-book
  DCCItemSheet override at `extension-api.spec.js:420` —
  unchanged baseline, flagged every prior session as pre-existing
  (line shifted from 320 because this slice inserted a new test
  earlier in the file); (2) NEW environmental flake at
  `data-models.spec.js:138` — the `mcc-core-book-welcome-dialog`
  aside intercepts pointer events on the new-Player-actor form's
  OK button (Test timeout of 60000ms exceeded waiting for the
  click to succeed); sibling-module dialog state in the
  FoundryVTT-Next world data dir, NOT slice-caused (this slice
  touches no actor-sheet code, no MCC interaction, no
  welcome-dialog wiring). The documented `forceCrit
  shift-click flag` suite-only environmental race that fired in
  Phase 6 sessions 1, 2, 4 and Phase 7 session 2 stayed quiet
  this run. Pre-slice baseline was 145 passes (Phase 7 session
  3 close); this slice's +1 new test minus the mcc-welcome
  flake nets to 145 — same as the prior session count, with
  one passing test swapped for one environmental flake. The
  mcc-welcome-dialog pattern is worth pulling into the
  flake-investigation queue (extend the
  `extension-api.spec.js`-style `beforeEach` hygiene to
  `data-models.spec.js`'s opening setup) but is out of slice
  scope; tracked as a follow-up.

- **2026-05-21 — Phase 7 session 5: extract table-loading surface
  from `dcc.js` into `module/table-loading.mjs`.** Fifth piecemeal
  Phase 7 extraction — relocates the table-loading surface
  (`setupCoreBookCompendiumLinks` + `registerTables` setup-time
  functions, `getSkillTable` stable-API lookup, five hook handlers
  for `diceSoNiceReady` / `importAdventure` / `createRollTable` /
  `deleteRollTable` / `updateRollTable`) into a focused module
  following the dispatch-table-plus-entry-point pattern from
  session 3. The five hook handlers are exported individually plus
  a frozen `TABLE_LOADING_HOOKS` table (entries carry the handler
  + a `once` flag — only `importAdventure` is once-only) and a
  `registerTableLoadingHooks()` entry-point that iterates the
  table calling `Hooks.on` or `Hooks.once` per entry.
  `module/dcc.js` shrinks from 970 → 737 lines (-233 net
  including the new import line, the dropped `TablePackManager`
  import + `ChatMessage` global, and an 8-line replacement
  marker comment). Pure refactor — every branch, every CONFIG
  slot, every `i18n.localize('DCC.Disapproval')` lookup is
  preserved verbatim. Only structural change: the three near-
  identical `isDisapprovalTable` checks that lived inline in
  `registerTables`'s closure, the `createRollTable` handler, and
  the `updateRollTable` handler are folded into one module-
  private helper that reads `game.i18n` per call (identical
  semantics — the localized string was already read at hook-fire
  time pre-extraction, not at module load). +34 Vitest tests in
  new `module/__tests__/table-loading.test.js` (3
  setupCoreBookCompendiumLinks cases, 7 registerTables cases, 6
  getSkillTable cases, 1 diceSoNiceReady, 2 importAdventure, 3
  createRollTable, 2 deleteRollTable, 3 updateRollTable, 3
  `TABLE_LOADING_HOOKS` dispatch-table cases, 3
  `registerTableLoadingHooks` wiring cases). +1 Playwright case in
  `extension-api.spec.js` asserting the three TablePackManager
  registries are constructor-typed at ready time, the patron-taint
  registry is seeded with both core + xcc side-effect packs,
  `setupCoreBookCompendiumLinks` touched the
  `coreBookCompendiumLinks` slot, `game.dcc.getSkillTable` is a
  function, and the relocated world-RollTable lifecycle hooks keep
  `CONFIG.DCC.disapprovalTables` in sync end-to-end (create / rename
  / rename-back / delete a probe table, restoring the snapshot in a
  `finally`). **1184 Vitest green** (was 1150, +34). **146
  Playwright passed** + 2 failures (the latent xcc-core-book
  DCCItemSheet override baseline; a NEW environmental
  network-suspension flake at `v14-features.spec.js:128` —
  `net::ERR_NETWORK_IO_SUSPENDED`, not slice-caused). Pre-slice
  baseline was 146; +1 new test minus the network flake nets to
  146.
