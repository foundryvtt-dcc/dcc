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

- **2026-05-22 — Phase 7 session 6: extract chat / hook wiring from
  `dcc.js` into `module/chat-and-hook-wiring.mjs` (closes the
  `dcc.js` piecemeal-split arc).** Sixth and final piecemeal Phase 7
  extraction — relocates the eleven remaining `Hooks.on` /
  `Hooks.once` handlers (`hotbarDrop`, `renderChatMessageHTML`,
  `getChatMessageContextOptions`, `renderActorDirectory`,
  `preCreateActor`, `preCreateItem`, `applyActiveEffect`,
  `preUpdateActor`, `updateCombat`, `item-piles-ready`,
  `getProseMirrorMenuDropDowns`) into a focused module. The largest
  body is the ~70-line `renderChatMessageHTML` chat-decoration
  pipeline (crit/fail highlight, minimum-damage clamp, SpellResult
  HTML, `data-item-id` forwarding, the nine `chat.emoteXxxRoll`
  fan-out gated on `emoteRolls` with the `dcc.emoteRoll` flag
  fallback, crit/fumble lookups gated on `automateDamageFumblesCrits`,
  TableResult navigation); also the `updateCombat` Active Effect
  expiry loop and the `getProseMirrorMenuDropDowns` sidebar-style
  menu entry. Each handler exported individually plus a frozen
  `CHAT_AND_HOOK_WIRING_HOOKS` dispatch table (only
  `item-piles-ready` is once-only) + a `registerChatAndHookWiring()`
  entry-point — matching the `settings-table-hooks.mjs` /
  `table-loading.mjs` pattern (sessions 3 + 5). `module/dcc.js`
  shrinks 737 → 475 lines (-262). **The §Appendix A target of ~4–5
  focused modules out of `dcc.js` is met.** Pure refactor — every
  conditional, GM gate, default-image lookup, emote-roll fan-out, and
  AE duration calc preserved verbatim. +43 Vitest in new
  `module/__tests__/chat-and-hook-wiring.test.js` (the seven imported
  sibling modules `vi.mock`ed so handlers run without a Foundry boot),
  +1 Playwright case in `extension-api.spec.js` exercising
  `onPreCreateActor` + `onPreCreateItem` + `onPreUpdateActor`
  end-to-end against a temporary `P_ChatHook Probe`. **1227 Vitest
  green** (was 1184, +43). **149 Playwright passed**, zero failures
  (13.1-min full suite — both prior-session flakes resolved by the
  follow-up fix commits `1935372` + `2973a13`).

- **2026-05-22 — Phase 7 session 7: split `styles/dcc.scss` into 18
  partials + a 34-line manifest (opens the second Phase 7 arc).**
  Pure structural refactor — the previous ~2979-line monolith is
  broken out into focused partials per existing section comment,
  combining only adjacent sections so relative CSS rule order (and
  specificity-tie outcomes) is preserved verbatim. Partial map:
  `_base.scss` (383), `_journal.scss` (110), `_armor.scss` (36),
  `_chat.scss` (184), `_weapons.scss` (119), `_class-sheets.scss`
  (135), `_party-sheet.scss` (110), `_hit-points-dialog.scss` (40),
  `_items.scss` (249), `_config-dialogs.scss` (82), `_skills.scss`
  (49), `_tabs.scss` (233), `_entity-link.scss` (15),
  `_dialogs.scss` (353), `_actor-sheet.scss` (596 — largest),
  `_effects.scss` (162), `_level-change-dialog.scss` (9),
  `_container-items.scss` (112). Total partial line count 2977 —
  matches the pre-split body verbatim. The new `dcc.scss` is a
  34-line `@use` manifest. **Compiled `styles/dcc.css` is
  byte-identical to the pre-split build** (verified via baseline
  snapshot + `diff -q`). The 20 remaining hex literals were left for
  the session-8 hex-to-var migration. No JS/test code touched beyond
  the new Playwright probe; no Vitest delta (CSS not loaded into unit
  tests). +1 Playwright case in `extension-api.spec.js` fetching the
  served CSS and asserting HTTP 200, 50-80KB size, and 10
  representative selectors present. **1227 Vitest green** (unchanged).
  **150 Playwright passed**, zero failures (11.9-min full suite).
  Visual-regression suite couldn't run in this V14 environment; the
  byte-identical CSS diff is stronger evidence than a pixel-comparison.

- **2026-05-28 — Phase 7 session 8: hex-literal → theme-variable
  migration + `ARCHITECTURE_REIMAGINED.md §7` theming-contract
  documentation (closes the styling-cleanup arc opened by session
  7).** Mechanical refactor — the 20 remaining hex literals across
  the new partials (session 7 left them in place) are replaced
  with `var(--system-*)` references and the new variables are
  added to `styles/variables.css` as the documented theming
  contract for variants (XCC, MCC, homebrew). Twelve new
  `--system-*` vars: six theme-agnostic semantic colors
  (`--system-text-muted-color` `#666`, `--system-damage-color`
  `#8b0000`, `--system-rollable-hover-color` `#000`,
  `--system-flat-button-border-color` `#c9c7b8`,
  `--system-two-weapon-primary-color` `#4caf50`,
  `--system-two-weapon-secondary-color` `#d32f2f`) plus six
  tab-overflow dropdown vars paired with dark-theme overrides
  (`--system-tab-overflow-background` `#f0e8d8`/`#2a2a2a`,
  `--system-tab-overflow-border-color` `#8b7355`/`#444`,
  `--system-tab-overflow-text-color` `#4a3c2a`/`#ccc`,
  `--system-tab-overflow-hover-background` `#e0d5c0`/`#3a3a3a`,
  `--system-tab-overflow-hover-text-color` `#2a1f14`/`#fff`,
  `--system-tab-overflow-active-text-color`
  `var(--color-text-dark-primary)`/`#fff`). All 14 light-path
  hex literals across seven partials (`_base.scss:346` on
  `.rollable:hover`, `_dialogs.scss:78` on `button.flat-button`
  border, `_hit-points-dialog.scss:15,35` on `.hp-current` /
  `.hint`, `_skills.scss:33` on `.skill-summary-text`,
  `_party-sheet.scss:67,105` on `.fa-heart.clickable:hover` /
  `.empty-party p`, `_tabs.scss` lines 68/69/82/87/88 on the
  `.tabs-overflow-menu` light path, and `_weapons.scss:109,113`
  on `.two-weapon-primary` / `.two-weapon-secondary`) are
  replaced with the matching `var(...)` references. The 17-line
  `body.theme-dark & .sheet-tabs.responsive-tabs .tabs-overflow
  .tabs-overflow-menu` override block in `_tabs.scss` is deleted
  — the dark cascade now flows through the variable overrides
  in `variables.css` rather than through a duplicate component
  selector. Compiled `dcc.css` shrinks 64,741 → 64,502 bytes
  (-239 net; still well inside the existing probe's 50-80KB
  range). Only structural diff vs. the pre-slice HEAD output is
  exactly those 14 substitutions plus the deleted dark-override
  block (verified by `diff` against `git show HEAD:styles/dcc.css`).
  `docs/dev/ARCHITECTURE_REIMAGINED.md §7` is expanded with a
  "Theming contract (`--system-*` CSS custom properties)"
  subsection documenting each variable's role, light + dark
  defaults, and the override pattern variants should use
  (`body.theme-<variant>` sheet-wide vs `.dcc-<feature>`
  per-feature scoping — variants override variable *values*, not
  component selectors). +1 Playwright case in
  `extension-api.spec.js` (`DCC theming-contract --system-* vars
  resolve to documented values in both themes`) asserts the
  full contract end-to-end: (1) the compiled CSS references the
  new vars (regression net against re-introducing hex
  literals), (2) the redundant `body.theme-dark` tab-overflow
  block is gone from the compiled output, (3) `getComputedStyle()`
  resolves each of the 12 vars to its documented light value
  via `:root` and each of the 6 tab-overflow vars to its
  documented dark override via a transient `<div class="theme-
  dark">` probe element appended to body — no live-theme flip
  needed, so the test is robust to whichever theme the test
  user has selected. **1227 Vitest green** (unchanged — CSS is
  not loaded into unit tests). **152 Playwright passed** in the
  full-suite run + 1 environmental flake at
  `adapter-dispatch.spec.js:1898 halfling two-weapon fumble
  note round-trips through adapter` (`page.evaluate: Execution
  context was destroyed, most likely because of a navigation` —
  a sibling-spec state pollution / navigation race during
  `rollWeaponAttack`; the failing test passes cleanly in
  isolation, 1.2s, confirming it's a flake rather than a
  regression; NOT slice-caused — this slice touches only CSS
  partials, `variables.css`, the `ARCHITECTURE_REIMAGINED.md`
  docs, and the new `extension-api.spec.js` probe; the slice
  changed no JS code that runs in `actor.js` / `item.js` /
  anywhere else, and cannot semantically cause a navigation
  event mid-test). Pre-slice baseline was 152 (the five
  post-session-7 e2e refactor commits on main — split
  `v14-features` into `active-effects` + `sheet-ui` (`0e76620`),
  widen `openActorSheet` settle to 1.5s (`a83d944`), add
  `rolls-ui` smoke spec (`fe7a4da`), shared session fixture +
  rename adapter-dispatch spec (`1c9924b`), remove dead v12
  visual-regression suite (`e3eae15`) — shifted the spec layout
  and the net baseline). Net pass math: 152 baseline + 1 new
  test = 153 expected; observed 152 pass + 1 flake = 153 total,
  with the flake passing in isolation. With the styling-cleanup
  arc closed, the next Phase 7 candidates are the remaining
  §Appendix A items (cruft removal slices) or a Group E
  vertical-slice — halfling vertical slice or homebrew
  single-class slice — both viable starts to broaden the
  adapter / mixin pattern beyond the built-in seven classes.

- **2026-05-28 — Phase 7 session 9: compendium-walk caching for the
  four table-loading sites + isolated fallback-order coverage
  backfill (closes the PR #720 "Uncached compendium walks" item
  and the matching test-coverage gap).** New module
  `module/adapter/table-cache.mjs` owns four `Map` caches —
  `disapprovalTableCache` (keyed on `actor.system.class.disapprovalTable`,
  value: lib `SimpleTable | null`), `mercurialMagicTableCache`
  (keyed on the resolved table name from
  `resolveMercurialMagicTableName(classKey)`, value: lib
  `MercurialTable | null`), `critTableLinkCache` (keyed on
  `critTableSuffix`, value: `@UUID[Compendium...|RollTable...]`
  prefix without trailing `{displayText}` so the same suffix can
  render with different labels), and `critTableDocCache` (keyed
  on `critTableCanonical`, value: loaded Foundry `RollTable`
  document) — plus `clearAllTableCaches()`, three invalidation
  handlers (`onCreateRollTableInvalidate` / `onUpdateRollTableInvalidate`
  / `onDeleteRollTableInvalidate`), a frozen
  `TABLE_CACHE_INVALIDATION_HOOKS` dispatch table, and
  `registerTableCacheInvalidation()` that iterates the table
  wiring each entry via `Hooks.on` (all `once: false`).
  `module/adapter/spell-input.mjs` and `module/utilities.js`
  import their respective caches and check `cache.has(key)` /
  `cache.get(key)` before falling through to the resolver
  helpers (`resolveDisapprovalTable`, `resolveMercurialMagicTable`,
  `resolveCritTable`, `resolveCritTableLink`) which carry the
  unchanged pack-walk → world-fallback logic. The
  `getCritTableResult` EL-suffix side effect
  (`CONFIG.DCC.criticalHitPacks.addPack('dcc-core-book.dcc-monster-fumble-tables')`)
  stays in the pre-cache code path — `addPack` is idempotent
  per `TablePackManager.addPack`, so re-running it on every EL
  crit while the doc cache is warm is safe. Cache invalidation
  is global: any world-RollTable lifecycle event drops every
  cache entry — the simplest correct response since a rename /
  row change / delete can shift which table answers a name
  lookup, and the events are rare enough during play that
  uniform invalidation is cheaper than per-cache relevance
  predicates. `module/dcc.js` adds the `registerTableCacheInvalidation()`
  call alongside the existing `registerSettingsTableHooks()` /
  `registerTableLoadingHooks()` / `registerChatAndHookWiring()`
  calls at module-init time. Pure refactor — cold-cache walks
  match the pre-slice behavior byte-for-byte; warm-cache walks
  short-circuit before the first `game.packs.get(...)` call.
  No external contract change; `loadDisapprovalTable` /
  `loadMercurialMagicTable` / `getCritTableLink` /
  `getCritTableResult` retain their existing signatures, return
  types, and null-on-miss semantics. **1262 Vitest green** (was
  1227, +35): +16 in new
  `module/__tests__/table-cache.test.js` (TABLE_CACHES shape +
  same-Map identity + frozen invariant; clearAllTableCaches
  empties every cache and is safe on empty maps; each of the
  three invalidation handlers drops every cache entry and
  ignores its argument shape; dispatch table covers exactly the
  three lifecycle hooks, routes name → handler one-to-one, all
  `once: false`, is frozen; `registerTableCacheInvalidation`
  calls `Hooks.on` three times with the right name+handler
  pairs and does NOT call `Hooks.once`), +9 in
  `utilities.test.js` (the existing `getCritTableResult`
  describe gains 3 new cases — second call skips
  `pack.getDocument`, cached null skips the re-walk, separate
  suffixes use separate cache entries — plus a new
  `getCritTableLink` describe with 6 cases including the
  prefix-only caching that lets the same suffix render with
  different labels), +10 in `adapter-spell-check.test.js`
  backfilling the PR #720 isolated-coverage gap (5 for
  `loadDisapprovalTable`: compendium hit / world fallback /
  both miss / no-tableName → null / pack throws → warn + world
  fallback / cache per tableName; 5 for `loadMercurialMagicTable`:
  compendium hit by 3-part name / world fallback by stripped
  table name / both miss / resolver-returns-null no-op / cache
  per resolved tableName). +1 Playwright case in
  `extension-api.spec.js` (`DCC adapter table caches
  short-circuit pack walks and invalidate on world-RollTable
  events`) — dynamic-imports the live cache module
  (`/systems/dcc/module/adapter/table-cache.mjs`), asserts the
  four named caches are `Map` instances + the dispatch table
  covers exactly the three lifecycle hooks all `once: false`,
  then seeds each cache with a probe entry and confirms that
  `Hooks.callAll('createRollTable', probeTable)`, a real
  `probeTable.update({ name: ... })`, and `probeTable.delete()`
  each drop every cache entry to size 0 (proves the wiring
  registered at init survives end-to-end and fires for both
  synthetic `callAll` events and real Foundry document
  mutations). **154 Playwright passed**, zero failures —
  clean 5.9-min full suite. Pre-slice baseline post session 8
  was 153 (152 + 1 new session 8 test plus the halfling
  two-weapon fumble flake from session 8 staying quiet this
  run); +1 new probe takes us to 154. With the caching item
  closed and the `loadDisapprovalTable` /
  `loadMercurialMagicTable` isolated-coverage gap backfilled,
  the next-arc candidates are the remaining PR #720
  resilience items (`normalizeLibDie` consolidation across
  `attack-input.mjs` / `spell-input.mjs` /
  `actor.js:_stripDieCount`, the four near-identical
  `dcc.libResult` flag payload extraction from
  `chat-renderer.mjs`, surfacing `migrateWorld` per-doc
  failures via `ui.notifications.warn`) or a Group E
  vertical-slice (halfling vertical slice / homebrew
  single-class).

- **2026-05-29 — Phase 7 session 10: extract `buildLibResultFlag` +
  `applyFleetingLuck` shared helpers from the four chat renderers
  (closes the PR #720 resilience item "four near-identical
  `dcc.libResult` flag payloads").** Pure structural refactor —
  `renderAbilityCheck`, `renderSavingThrow`, `renderSkillCheck`, and
  `renderSpellCheck` in `module/adapter/chat-renderer.mjs` each built
  a near-identical `dcc.libResult` flag literal — the seven shared
  core fields (`die`, `natural`, `total`, `formula`, `critical`,
  `fumble`, `modifiers`), a result-id field (`skillId` for the three
  checks, `spellId` for spell checks), and — for spell checks only —
  `tier` / `spellLost` / `corruptionTriggered` — followed by an
  identical guarded `game.dcc?.FleetingLuck?.updateFlags(flags,
  foundryRoll)` block. The shared core now lives in a new exported
  `buildLibResultFlag(result, extras = {})` (the three checks pass
  `{ skillId: result.skillId }`, the spell renderer passes
  `{ spellId, tier, spellLost, corruptionTriggered }`); the luck
  update is now the exported `applyFleetingLuck(flags, foundryRoll)`
  (same guard — test-mock-safe + no-op without a roll). Key order in
  the produced flag object changes (core fields now precede the spread
  `extras`) but the flag is consumed by key name, not position, so
  the on-message contract downstream modules (dcc-qol,
  token-action-hud-dcc) read is unchanged — and the adapter
  ability/save/skill/spell round-trip tests (which read
  `libResult.skillId` / `.modifiers`) stay green untouched. +10 Vitest
  in new `module/__tests__/chat-renderer.test.js` (7 buildLibResultFlag:
  core-only field set when no extras; verbatim core copy + modifiers
  carried by reference; no result-id / spell fields without extras;
  check-shaped and spell-shaped field sets matching the pre-extraction
  literals; undefined-core passthrough with no silent defaulting;
  extras-win-on-key-collision — plus 3 applyFleetingLuck: calls
  `updateFlags(flags, roll)` when both present; no-op without a roll;
  no-throw when `game.dcc.FleetingLuck` is unavailable). +1 Playwright
  probe in `extension-api.spec.js` (`DCC chat-renderer shared helpers
  (buildLibResultFlag + applyFleetingLuck) survive the Phase 7 session
  10 extraction`) dynamic-imports the live-served module and asserts
  both flag-payload shapes (check: core + `skillId`, no `spellId`;
  spell: core + `spellId` + `tier` + `spellLost` +
  `corruptionTriggered`, no `skillId`) plus `applyFleetingLuck` being a
  function and a guard-safe no-op without a roll. **1272 Vitest green**
  (was 1262, +10; +1 test file). **155 Playwright passed**, zero
  failures — clean 5.8-min full suite (was 154 pre-slice, +1 new
  probe). Next batch slices: surface `migrateWorld` per-doc failures
  via `ui.notifications.warn`, then consolidate the three
  `normalizeLibDie` / `_stripDieCount` die-normalize copies.

- **2026-05-29 — Phase 7 session 11: surface `migrateWorld` per-doc
  failures via `ui.notifications.warn` + gate version-stamping on a
  clean run (closes the PR #720 "`migrateWorld` per-doc catches
  swallow silently" item).** Before this slice, the four
  `catch (err) { console.error(err) }` sites in `module/migrations.js`
  (`migrateWorld`'s actors / items / scenes loops + `migrateCompendium`)
  logged to the console and kept going — and the run stamped the world
  at `NEEDS_MIGRATION_VERSION` and showed the green "complete" toast
  regardless, so a GM whose migration failed on every document had no
  in-app signal. Now each loop pushes `{ type, name }` onto a
  `failures` array (still `console.error`ing the stack);
  `migrateCompendium` returns its own failures array which
  `migrateWorld` accumulates. A new pure exported
  `migrationOutcome(failures)` (no Foundry globals — same testable
  pattern as `classifyMigrationDecision`) decides the finish: a clean
  run stamps the version + shows the "complete" toast; any failure
  leaves the version unstamped (the idempotent data-driven migrations
  re-run on the next load after the GM resolves the issue) and raises
  `ui.notifications.warn(DCC.MigrationFailures, { count }, { permanent:
  true })`. New i18n key `DCC.MigrationFailures` added to all 7 lang
  files (en + cn/de/es/fr/it/pl translated; `compare-lang` reports 0
  missing keys). +4 Vitest in new
  `module/__tests__/migration-outcome.test.js` (clean → stamp +
  complete; one failure → no-stamp + failures; multi-failure exact
  count; non-array defensive → treated as clean). +1 Playwright probe
  in `extension-api.spec.js` (`DCC migrationOutcome gates
  version-stamping on a clean run + DCC.MigrationFailures resolves`)
  dynamic-imports the live module, asserts the clean / failed outcome
  shapes, and confirms `game.i18n.format('DCC.MigrationFailures',
  { count: 2 })` resolves (≠ the raw key) + interpolates the count —
  without running `migrateWorld` against the live world. **1276 Vitest
  green** (was 1272, +4; +1 test file). **155 Playwright passed + 1
  environmental flake** at `sheet-ui.spec.js:163 Halfling sheet has
  correct tabs` (`Execution context was destroyed, most likely because
  of a navigation` — the documented halfling navigation-race family,
  same one session 8 saw at `adapter-dispatch.spec.js:1898`; passes
  cleanly in isolation, 7.8s; NOT slice-caused — slice 2 touches only
  `migrations.js` + lang files + the migrations probe + docs, none of
  which run in sheet UI or trigger navigation). My new probe (test
  103) passed. Net: pre-slice 155 + 1 new probe = 156 expected;
  observed 155 pass + 1 isolation-passing flake = 156 total. Note:
  this closes only the *silent-swallow* `migrateWorld` item; the
  separate PR #720 "`migrateWorld` fire-and-forget from a sync ready
  hook" item (make `checkMigrations` async + `await`) is untouched
  and out of this batch's scope.

- **2026-05-29 — Phase 7 session 12: consolidate the three
  `normalizeLibDie` / `_stripDieCount` die-normalize copies onto one
  canonical helper (closes the PR #720 "three copies of strip die
  count normalization" item — completes the three-slice resilience
  batch).** The three former copies — `module/adapter/attack-input.mjs`
  `normalizeLibDie` (exported), `module/adapter/spell-input.mjs`
  `normalizeLibDie` (module-private dup), and
  `module/actor.js` `_stripDieCount` (anchored regex) — diverged on
  edge cases: falsy fallback (`'d20'` / `'d20'` / `null`), no-match
  fallback (original string / `'d20'` / `null`), and anchoring
  (unanchored / unanchored / anchored). They are now one parameterized
  `normalizeLibDie(foundryDie, fallback = 'd20')` in
  `attack-input.mjs`: `spell-input.mjs` imports it (private dup
  deleted), and `_stripDieCount` is a one-line wrapper delegating with
  `fallback: null`. **Divergence audit (surfaced, not silently
  translated):** every one of the eight call sites
  (`attack-input.mjs:100`, `actor.js:2601/2758/3481`,
  `crit-fumble-input.mjs:51/77`, `spell-input.mjs` deriveActionDie,
  and the three `_stripDieCount` sites `actor.js:1130/1593/1814`)
  passes either a single Foundry die string (`'1d20'`, `'d14'`, a
  Roll term `formula`) or a falsy value — so the anchored-vs-unanchored
  difference is unreachable (a compound `'1d20+2'` would differ, but no
  site produces one), and the only behavior change anywhere is the
  former `attack-input` copy's no-match return (original string → the
  `'d20'` fallback), which is both unreachable in practice and more
  correct (feeds the lib a valid `DieType` rather than an unparseable
  string). The `actor.js:1593` site that *relies* on the `null` return
  (`if (libDie) definition.roll.die = libDie`) keeps it via the
  `fallback: null` wrapper. +3 Vitest (2 new cases in
  `adapter-weapon-attack.test.js` — case-insensitivity + default
  fallback, and the explicit-null-fallback `_stripDieCount` contract;
  1 in `actor.test.js` exercising `actor._stripDieCount` directly).
  +1 Playwright probe in `extension-api.spec.js` (`DCC normalizeLibDie
  consolidation: canonical helper + live _stripDieCount delegation`)
  dynamic-imports the live canonical helper (asserts default + null
  fallback behavior) and creates a live Player actor to confirm
  `_stripDieCount` delegates end-to-end. **1279 Vitest green** (was
  1276, +3). **157 Playwright passed**, zero failures — clean 5.9-min
  full suite (pre-slice was 156 total at session 11 = 155 pass + 1
  isolation-passing halfling flake; +1 new probe = 157, and the
  halfling navigation-race flake stayed quiet this run). With session
  12 done, **the three-slice PR #720 resilience batch is complete** —
  all three targeted backlog items (`buildLibResultFlag` /
  `applyFleetingLuck` extraction, `migrateWorld` failure surfacing, and
  the `normalizeLibDie` / `_stripDieCount` consolidation) are ticked.

- **2026-05-29 — fix(adapter): preserve additive init-die terms through
  the combat-tracker initiative path.** When `system.attributes.init.die`
  is a compound additive formula — MCC folds the Mutant Horror die into
  init as `1d20+1d3` (up to `1d20+1d7+7` at higher levels; see
  mcc-core-book §9.2a) — the combat-tracker path (`DCCCombatant`
  `getInitiativeRoll` → `actor.getInitiativeRoll(formula)` with no
  dialog → `_getInitiativeRollViaAdapter`) flattened it through the lib's
  single-die model (`_stripDieCount('1d20+1d3')` → `'d20'`, since
  `normalizeLibDie`'s regex matches only the first die) and silently
  dropped the extra die, rolling only `1d20`. The sheet "Roll
  Initiative" button (`_getInitiativeRollLegacy`, dialog path) reads
  `init.die` verbatim, so it was unaffected — and `main` reads it
  verbatim on both paths, making this an adapter-only regression. Fix
  mirrors the existing weapon-die-label re-injection ("a Foundry display
  idiom the lib doesn't model"): a new `_initDieAdditiveTerms(formula)`
  helper extracts the tail after the leading die (`'1d20+1d3'` → `'+1d3'`,
  `'1d20+1d7+7'` → `'+1d7+7'`, `'1d20'` → `''`), and
  `_getInitiativeRollViaAdapter` re-appends it to the lib formula
  Foundry-side — computed from the actor's own `init.die` and **suppressed
  when an equipped two-handed / `initiativeDieOverride` weapon is in
  effect** (the weapon die replaces init entirely, matching `main` + the
  legacy path). Full spec: `docs/dev/ADDITIVE_INITIATIVE_DIE_FIX.md`. +4
  Vitest (`adapter-initiative.test.js`: `1d20+1d3` → two dice;
  `1d20+1d7+7` → tail die + flat `+7`; plain `1d20` unchanged;
  weapon-override suppresses the tail) + 1 integration
  (`__integration__/adapter-initiative.test.js`: the compound die
  evaluates with real Foundry dice, total within `[2, 23]`) + 1 Playwright
  (`adapter-dispatch.spec.js`: a live combat-tracker roll on a `1d20+1d3`
  Player keeps both dice). **1288 Vitest** combined with session 13.
  Unblocks dropping the mcc-core-book §9.2a "known limitation" caveat.
