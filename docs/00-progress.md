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
> - [Phase 6 — lib-side class progression + variant registration](dev/progress/phase-6.md)
> - [Phase 7 — cleanup](dev/progress/phase-7.md)

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

**Phase 7 session 10 (2026-05-29)** opens a three-slice PR #720
resilience batch (the queue having drained at session 9). This
slice closes the "four near-identical `dcc.libResult` flag payloads"
item: the four chat renderers in `module/adapter/chat-renderer.mjs`
(`renderAbilityCheck`, `renderSavingThrow`, `renderSkillCheck`,
`renderSpellCheck`) built near-identical `dcc.libResult` flag
literals plus an identical guarded `FleetingLuck.updateFlags` block.
The shared seven-field core (`die` / `natural` / `total` / `formula`
/ `critical` / `fumble` / `modifiers`) now lives in one exported
`buildLibResultFlag(result, extras = {})` (callers pass type-specific
extras — `{ skillId }` for the three checks,
`{ spellId, tier, spellLost, corruptionTriggered }` for spell
checks), and the luck update in `applyFleetingLuck(flags,
foundryRoll)`. Pure structural — the on-message flag contract is
unchanged (consumed by key name, not order). **1272 Vitest** (was
1262, +10 in new `module/__tests__/chat-renderer.test.js`), **155
Playwright** (was 154, +1 probe), clean 5.8-min suite. The remaining
two batch slices are: surface `migrateWorld` per-doc failures via
`ui.notifications.warn`, and consolidate the three `normalizeLibDie`
/ `_stripDieCount` die-normalize copies across
`module/adapter/attack-input.mjs`, `module/adapter/spell-input.mjs`,
and `module/actor.js`.

**Phase 7 session 9 (closed 2026-05-28)** closed the PR #720
"Uncached compendium walks" item with a per-process table cache in
`module/adapter/table-cache.mjs` routing the four table-loading
sites (`loadDisapprovalTable` / `loadMercurialMagicTable` in
`spell-input.mjs`; `getCritTableLink` / `getCritTableResult` in
`utilities.js`) through `Map` caches, with global invalidation on
world-RollTable CRUD events via `registerTableCacheInvalidation()`.
Pure refactor; cold-cache walks match prior behavior byte-for-byte.
1262 Vitest, 154 Playwright at close.

<!-- Detailed prior-phase narrative removed — archived in
`dev/progress/phase-{3,4,5}.md`. The Recent slices section below
keeps the five most-recent entries. -->

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

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

- **2026-05-22 — Phase 7 session 7: split `styles/dcc.scss` into
  18 partials + a 34-line manifest (opens the second Phase 7
  arc).** Pure structural refactor — the previous ~2979-line
  monolith is broken out into focused partials per existing
  section comment, combining only adjacent sections so relative
  CSS rule order (and specificity-tie outcomes) is preserved
  verbatim. Partial map: `_base.scss` (globals + fonts +
  `.dcc` common, 383 lines), `_journal.scss` (110),
  `_armor.scss` (36), `_chat.scss` (chat rolls + spell-check
  chat card + notes — 184), `_weapons.scss` (119),
  `_class-sheets.scss` (cleric + wizard/elf — 135),
  `_party-sheet.scss` (110), `_hit-points-dialog.scss` (40),
  `_items.scss` (items + item sheet + level item sheet — 249),
  `_config-dialogs.scss` (82), `_skills.scss` (49),
  `_tabs.scss` (233), `_entity-link.scss` (15),
  `_dialogs.scss` (roll modifier + fleeting luck + spell duel —
  353), `_actor-sheet.scss` (596 — largest partial),
  `_effects.scss` (effects + item-effects transfer — 162),
  `_level-change-dialog.scss` (9), `_container-items.scss`
  (112). Total partial line count: 2977 — matches the
  pre-split body verbatim. The new `dcc.scss` is a 34-line
  manifest of `@use 'partial-name';` directives in source
  order, with SCSS-style `//` line comments documenting the
  partial pattern (those `//` comments don't compile into the
  CSS output — confirmed by diff). **Compiled
  `styles/dcc.css` is byte-identical to the pre-split build**
  (verified by snapshotting `dcc.css` before the split into
  `/tmp/dcc.css.baseline`, running `npm run scss` after the
  split, and confirming `diff -q` reports the files are
  identical). The existing `--system-*` CSS custom-property
  contract in `styles/variables.css` (with light/dark
  overrides) stays as-is; the 20 remaining hex literals in
  the partials (per-class accents in `_class-sheets.scss`,
  damage colours in `_items.scss`, tab-tooltip colours in
  `_tabs.scss`, focus-state shades) are left for a follow-up
  slice that pairs hex-to-var migration with the
  `docs/dev/ARCHITECTURE_REIMAGINED.md §7` theming-contract
  documentation. No JS or test code touched beyond the new
  Playwright probe. No Vitest delta (CSS is not loaded into
  unit tests). +1 Playwright case in `extension-api.spec.js`
  (`DCC compiled stylesheet survives the styles/dcc.scss
  split into 18 partials`) — fetches
  `/systems/dcc/styles/dcc.css` from the live Foundry server,
  asserts HTTP 200, file size in 50-80KB range, and 10
  representative selectors from across the partials all
  present (`.grid-align-center` from `_grid.scss`,
  `.journal-sheet` from `_journal.scss`,
  `.deed-result.critical` from `_chat.scss`,
  `.dcc .party-body` from `_party-sheet.scss`,
  `.dcc .equipment-bg` from `_items.scss`,
  `.dcc.sheet .sheet-tabs` from `_tabs.scss`,
  `.dcc-roll-modifier` from `_dialogs.scss`,
  `.dcc .fleeting-luck` from `_dialogs.scss`,
  `.dcc .spell-duel` from `_dialogs.scss`,
  `.dcc .container-sheet` from `_container-items.scss`).
  **1227 Vitest green** (unchanged). **150 Playwright
  passed**, zero failures (11.9-min full suite). Pre-slice
  baseline was 149 (post session 6); this slice's +1 new
  test cleanly lands the post-slice count at 150. Net math:
  149 + 1 = 150. Visual-regression suite at
  `browser-tests/visual-regression/` couldn't run in this
  V14 environment (its `start-foundry` script targets
  `baselinev12` per the Phase 5 session 4 note); the
  byte-identical CSS diff provides stronger evidence than a
  visual-regression pixel-comparison would — identical bytes
  guarantee identical pixels. With the second Phase 7 arc
  opened, the next slice candidate is the hex-literal →
  theme-variable migration + the
  `docs/dev/ARCHITECTURE_REIMAGINED.md §7` theming-contract
  documentation.

- **2026-05-22 — Phase 7 session 6: extract chat / hook wiring from
  `dcc.js` into `module/chat-and-hook-wiring.mjs` (closes the
  `dcc.js` piecemeal-split arc).** Sixth and final piecemeal Phase 7
  extraction — relocates the eleven remaining
  `Hooks.on` / `Hooks.once` handlers (`hotbarDrop`,
  `renderChatMessageHTML`, `getChatMessageContextOptions`,
  `renderActorDirectory`, `preCreateActor`, `preCreateItem`,
  `applyActiveEffect`, `preUpdateActor`, `updateCombat`,
  `item-piles-ready`, `getProseMirrorMenuDropDowns`) into a
  focused module. The largest body is the ~70-line
  `renderChatMessageHTML` chat-decoration pipeline (crit/fail
  highlight, minimum-damage clamp, SpellResult HTML,
  `data-item-id` attribute forwarding, the nine `chat.emoteXxxRoll`
  fan-out gated on the `emoteRolls` setting with the fallback
  to the `dcc.emoteRoll` message flag when the setting throws,
  the `spellResult` HTML append on the non-emote path, crit /
  fumble result lookups gated on `automateDamageFumblesCrits`,
  and TableResult navigation at the end); the `updateCombat`
  Active Effect expiry loop (round-based + time-based, GM-only,
  with the `ui.notifications.info(DCC.EffectsExpired)` summary);
  and the `getProseMirrorMenuDropDowns` sidebar-style menu entry
  (active-predicate + cmd toggle that adds/removes the `sidebar`
  class on the current paragraph node via
  `foundry.prosemirror.commands.setBlockType`). Each handler is
  exported individually plus a frozen
  `CHAT_AND_HOOK_WIRING_HOOKS` dispatch table (entries carry
  the handler + a `once` flag — only `item-piles-ready` is
  once-only) and a `registerChatAndHookWiring()` entry-point
  that iterates the table calling `Hooks.on` or `Hooks.once`
  per entry — matching the `module/settings-table-hooks.mjs`
  and `module/table-loading.mjs` pattern from Phase 7 sessions
  3 + 5. `module/dcc.js` shrinks from 737 → 475 lines (-262
  net including the new `import { registerChatAndHookWiring }`
  line, the dropped `* as chat`, `parser`, `EntityImages`,
  `setupItemPilesForDCC`, and `createDCCMacro` imports — the
  latter three exclusive to the relocated hook bodies — plus
  the 8-line replacement marker comment block summarising the
  eleven relocated handlers). Pure refactor — every
  conditional, every `game.user.isGM` gate, every default-
  image lookup, every emote-roll fan-out, every Active Effect
  duration calculation is preserved verbatim. **The §Appendix
  A target of ~4–5 focused modules out of `dcc.js` is met:**
  what remains in `dcc.js` is the init hook (data models, sheet
  registrations, template paths, `game.dcc` registry, Active
  Effect setup, custom dice types, custom document classes,
  Fleeting Luck setting), the `getSceneControlButtons` hook
  (Fleeting Luck + Spell Duel toolbar buttons — adjacent to
  init scaffolding), the ready hook (settings init, KeyState,
  release-notes, migrations, table-loading boot, Fleeting Luck
  / Spell Duel init, status icons, theme classes, welcome
  dialog, compendium-link setup, class-progression load,
  `dcc.ready` emission), the local `checkReleaseNotes` /
  `checkMigrations` / `_onShowJournal` / `_onShowURI`
  helpers, and three single-line `registerXxxHooks()` calls
  (settings-table, table-loading, chat-and-hook-wiring). +43
  Vitest tests in new `module/__tests__/chat-and-hook-wiring.test.js`:
  1 `onHotbarDrop` delegate test, 8 `onRenderChatMessageHTML`
  cases (early-return on `!isRoll`, on `!isContentVisible`, on
  empty `rolls`; the decoration pipeline canPopout + highlight
  + minimum-damage + SpellResult; the `data-item-id` attribute
  forwarding; the 9-emote-roll fan-out under `emoteRolls=true`
  with `automateDamageFumblesCrits=true` skipping the
  crit/fumble lookup; the `spellResult` HTML append on the
  non-emote path; the `game.settings.get` throws fallback to
  the `dcc.emoteRoll` message flag; the
  `lookupCriticalRoll` + `lookupFumbleRoll` invocation when
  emote is off OR automate is off), 1
  `onGetChatMessageContextOptions` delegate, 1
  `onRenderActorDirectory` delegate, 5 `onPreCreateActor`
  cases (GM-with-no-img default-img assignment; has-img skip;
  non-GM skip; brand-new non-Item-Pile Player gets
  `prototypeToken.actorLink`; `keepId=true` duplicate +
  Item-Pile-named Player both skip the actor-link path), 3
  `onPreCreateItem` cases (GM-with-no-img default-img; null-
  image-lookup no-op; non-GM short-circuit), 3
  `onApplyActiveEffect` cases (non-string current value
  returns null + skips setProperty; matching `[+-]?\d+d`
  pattern bumps via `game.dcc.DiceChain.bumpDie`;
  non-matching value returns null), 5 `onPreUpdateActor`
  cases (wrong userId; no img change; mystery-man default-
  image replacement; type-specific default-image replacement;
  custom-texture preservation), 5 `onUpdateCombat` cases
  (non-GM gate; no-round-delta skip; round-based expiry on
  round 5 >= startRound 2 + rounds 3; time-based expiry on
  `effect.isExpired`; zero-effect actor skip), 1
  `onItemPilesReady` delegate, 3
  `onGetProseMirrorMenuDropDowns` cases (no-format-key
  no-op; pushed `dcc-custom` entry shape + `DCC.CustomStyles`
  / `DCC.SidebarText` titles; active-predicate detects the
  sidebar class on the current paragraph node), 3
  `CHAT_AND_HOOK_WIRING_HOOKS` dispatch-table cases (one-to-
  one routing; exactly-11-keys; only-`item-piles-ready`-is-once),
  3 `registerChatAndHookWiring` cases (wires ten via
  `Hooks.on`, wires `item-piles-ready` via `Hooks.once`,
  exact `10 + 1` count). The test file `vi.mock`s the seven
  imported sibling modules (`../chat.js`, `../parser.js`,
  `../entity-images.js`, `../spell-result.js`,
  `../table-result.js`, `../item-piles-support.js`,
  `../macros.mjs`) so handlers can be invoked as plain
  functions without a live Foundry boot — `vi.fn()` shells
  for each named export, plain-object `makeHtml` stand-in
  for the DOM (the unit env has no jsdom), and plain-object
  effects collections with custom `[Symbol.iterator]` for
  the `updateCombat` walk (a real `Map`'s `size` getter
  isn't overridable). Same stub-and-restore beforeEach/
  afterEach pattern as Phase 7 sessions 1, 2, 3, 4, 5. +1
  Playwright case in `extension-api.spec.js` (`DCC chat-
  and hook-wiring (preCreateActor / preCreateItem /
  preUpdateActor + 8 other hooks) survives chat-and-hook-
  wiring.mjs extraction`) — creates a temporary `P_ChatHook
  Probe` Player actor without an `img`, asserts the
  relocated `onPreCreateActor` handler fired (`actor.img`
  is a non-empty string AND `prototypeToken.actorLink ===
  true`), creates an embedded weapon item without an `img`
  and asserts `onPreCreateItem` assigned a default image,
  then updates the actor's `img` to `icons/svg/aura.svg` and
  asserts `onPreUpdateActor` synced
  `prototypeToken.texture.src` to the new value — restoring
  the probe in a `finally` block. **1227 Vitest green** (was
  1184, +43). **149 Playwright passed**, zero failures —
  clean run (13.1-min full suite). Pre-slice baseline post
  the two follow-up fix commits that landed after session 5
  (`1935372` v14-features network-error filter + `2973a13`
  registerItemSheet XCC-resilience) was 148 — both
  previously-flagged failures (xcc-core-book DCCItemSheet
  baseline + v14-features network flake) recovered after
  the fixes; this slice's +1 new test cleanly lands the
  post-slice count at 149. Net pass-count math: 148 + 1 =
  149. With the `dcc.js` piecemeal-split arc closed, the
  next Phase 7 candidate is item 4 — split `styles/dcc.scss`
  (~2979 lines) into partials + theme contract.

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
- ~~**Four near-identical `dcc.libResult` flag payloads** in
  `module/adapter/chat-renderer.mjs`.~~ **Fixed 2026-05-29** (Phase 7
  session 10). Exported `buildLibResultFlag(result, extras = {})`
  owns the shared seven-field core; the three checks pass
  `{ skillId }`, the spell renderer `{ spellId, tier, spellLost,
  corruptionTriggered }`. The duplicated `FleetingLuck.updateFlags`
  guard is now `applyFleetingLuck(flags, foundryRoll)`. Pure
  structural; flag consumed by key name so the on-message contract is
  unchanged. +10 Vitest in new `chat-renderer.test.js`, +1 Playwright
  probe in `extension-api.spec.js`.
- ~~**Uncached compendium walks.**~~ **Fixed 2026-05-28** (Phase 7
  session 9). `module/adapter/table-cache.mjs` adds four module-level
  `Map` caches keyed on `tableName` / `critTableSuffix` /
  `critTableCanonical`; `loadDisapprovalTable` + `loadMercurialMagicTable`
  (`spell-input.mjs`) and `getCritTableLink` + `getCritTableResult`
  (`utilities.js`) consult them before walking packs.
  `registerTableCacheInvalidation()` wires
  `createRollTable` / `updateRollTable` / `deleteRollTable` to
  `clearAllTableCaches()` so GM edits drop stale entries. Coverage:
  +16 Vitest in new `table-cache.test.js`, +9 in `utilities.test.js`,
  +10 in `adapter-spell-check.test.js` (also closes the matching
  "loadDisapprovalTable / loadMercurialMagicTable isolated
  fallback-order tests" coverage-gap item below), +1 Playwright
  probe in `extension-api.spec.js` asserting the wiring + global
  invalidation on real RollTable CRUD events.
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
- ~~`loadDisapprovalTable` / `loadMercurialMagicTable` isolated
  fallback-order tests (compendium hit / world fallback / both miss)
  are missing.~~ **Closed 2026-05-28** (Phase 7 session 9). +10
  tests in `module/__tests__/adapter-spell-check.test.js` cover
  compendium hit / world fallback / both miss / no-tableName /
  pack-throws-warn-and-falls-through / caching-per-tableName for
  both loaders.
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
