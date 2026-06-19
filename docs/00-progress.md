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

**Refactor work is COMPLETE — the branch is in pre-merge holding (latest
2026-06-12).** Every planned arc is done and the slice backlog is fully
drained: Phases 0–6 shipped, every Phase 7 cleanup arc closed (legacy
decommission 21–25, coverage backfill 26–31 + the 2026-06-09 batch,
doc hygiene 32–33, perf 34, Appendix-A file shrinkage 35–54 — all five
god-object targets `actor.js` 4574→575 / `actor-sheet.js` 1890→1040 /
`item.js` 975→339 / `config.js` 845→451 / `dcc.js` 1560→87), Group E
validated by real sibling consumers, §2.1 schema-slimming closed as
architecturally-bounded, and the #732 spell-check seam fired from all
adapter cast terminals (2026-06-10). The branch is current with **main
v0.67.8** (merged 2026-06-12) and `system.json` is pinned to the target
release **0.70.0**. Health: **1752 Vitest, full E2E 205/205 clean**.

**What remains is the PR #720 endgame, not slices:** review the
Phases 4–7 surface (the 8-agent review only covered Phases 0–3), cut a
pre-release build for live playtesting (`PRERELEASE_PROCESS.md`),
coordinate the sibling-module PR landings (dcc-crawl-classes #40,
mcc-classes #38, XCC `chore/migrate-to-dcc-extension-api`), then
squash-merge PR #720 into main as 0.70.0. The only time-gated cleanup
left is the `warnIfDivergent` exit criterion (delete the 6 calls after
≥2 consecutive zero-divergence vendor syncs — see
`ARCHITECTURE_REIMAGINED.md` §8.6); the 2026-06-12 E2E run also cleared
the long-documented `extension-api.spec.js` container-probe flake.

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-06-12 — main merge: v0.67.8 (#744 crit double-display fix).**
  Merged `origin/main` after landing PR #745 there (a standalone crit roll
  rendered its table result twice when emote rolls were on and
  `automateDamageFumblesCrits` off — `emoteCritRoll` embeds the stored
  `system.critResult` block and `lookupCriticalRoll` appended a second copy;
  fix is an idempotency guard: `lookupCriticalRoll` returns early when the
  rendered HTML already contains `.crit-result`). Only conflict: `system.json`
  — kept this branch's 0.70.0 pin + pre-release URLs (`version.txt` /
  `package.json` auto-merged to 0.67.8, mirroring the pre-merge split).
  Adapted the merged `module/__tests__/chat.test.js` unavailable-table case to
  this branch's `crit-lookup-hint` contract (main appends
  `DCC.CritTableUnavailable` instead); deduped `.gitignore` (main gained the
  `coverage/`/`test-results/`/`playwright-report/` entries this branch already
  had). **1752 Vitest; full E2E 205/205 clean (6.2 min) — including the
  previously-flaky `extension-api.spec.js` container probe.** Pushed
  (batch gate green).

- **2026-06-10 — #732 spell-check-seam completion on the adapter paths +
  v0.67.7 main merge + 0.70.0 version pin.** Three commits. **(a)** Merged
  `origin/main` v0.67.7 (`785646e`) — #732 spell-check-hooks was the only real
  integration; the rest was take-HEAD. **(b)** `feat(adapter)` (`0ab2c48`): the
  item path (`DCCItem.rollSpellCheck` → `game.dcc.processSpellCheck`) already
  fired the #732 seam post-merge; this extends it to the adapter cast paths
  that bypass `processSpellCheck`. New shared emitter
  `module/actor/spell-result-hook.mjs` (`emitAfterSpellCheckResult` +
  `sumSpellburn`) normalizes the lib `SpellCheckResult` to the
  `processSpellCheck` payload contract (one listener serves both paths;
  `result`/`patronTaint` are null on the adapter path — listeners key off
  `naturalRoll`), fired from all three adapter terminals in
  `rolls-spell-mixin.mjs` (`_castNakedViaAdapter` — the primary gap —,
  `_castViaCastSpell`, `_castViaCalculateSpellCheck`). `suppressPatronTaint`
  honored in `_castViaCalculateSpellCheck` by clearing `input.isPatronSpell`
  (collapses the taint table load + d100/d6 pre-rolls, mirroring the legacy
  guard). +`spell-result-hook.test.js` (payload contract + sumSpellburn) +
  end-to-end `adapter-spell-check.test.js` assertions; **1747 Vitest**.
  **(c)** `chore` (`c4be351`): `system.json` pinned to **0.70.0** + v0.70.0
  manifest/download URLs — the refactor's target release number; `version.txt`
  / `package.json` keep tracking main's release train (expect a `system.json`
  conflict on every future main merge; resolve by keeping ours).

- **2026-06-09 — Phase 7 sessions 52–54: `dcc.js` decomposition (the
  Appendix-A entry-point split, finally done).** The system entry point
  `module/dcc.js` was already 470 lines (the §2.7/Appendix-A 1560 baseline
  predates the settings-table / table-loading / chat-and-hook-wiring
  extractions). This batch finished the job: the three remaining inline hook
  bodies moved into focused `register*()` + named-handler modules matching the
  established sibling pattern — **session 52** lifted the `Hooks.once('init')`
  body into `module/init-hook.mjs` (split into `registerBuiltInRegistries` /
  `registerDocumentConfig` / `registerDataModels` / `assembleGameDccNamespace` /
  `registerSheets` / `loadSystemTemplates` / `registerEarlySettings`, wired via
  `registerInitHook()`; `foundry.*` destructures pushed into the functions that
  use them); **session 53** lifted the `Hooks.once('ready')` body +
  `checkReleaseNotes`/`_onShowJournal`/`_onShowURI` into `module/ready-hook.mjs`
  (`registerReadyHook()`); **session 54** lifted `getSceneControlButtons` into
  `module/scene-control-hooks.mjs` (`registerSceneControlHooks()`). **`dcc.js`
  470 → 87 lines** — now a pure orchestrator of seven `register*()` calls with
  zero inline hook bodies (init/scene-controls/ready + the four pre-existing
  settings-table/table-loading/table-cache/chat-and-hook wirings). Behaviour-
  neutral: identical hooks register at module load. Tests: +37 Vitest across
  `init-hook.test.js` (17), `ready-hook.test.js` (13), `scene-control-hooks.test.js`
  (7) — **1716 Vitest** (was 1679); +3 Playwright probes in
  `extension-api.spec.js` (init-hook bootstrap side effects, ready-hook
  settings/KeyState/theme-classes, scene-control buttons driven via
  `Hooks.callAll`). Three commits, one per slice. Docs: this entry + Current
  phase + `ARCHITECTURE_REIMAGINED.md` Appendix A / §5.3.

- **2026-06-09 — coverage backfill + tooling batch (previously unrecorded;
  brackets the roll-dispatch slice below).** Eleven commits. **(a) Unit-coverage
  backfill** for the largest untested surfaces: `spell-duel.js` (the whole
  805-line module), parser `_applyBirthAugurEffect` guards, `migrateWorld`
  orchestration (failure → unstamped → warn), party-sheet membership +
  member-weapon round-trip, chat table-result dual-write + spell-result wiring,
  currency `rollValue` + `RollModifierDialog` formula construction,
  fleeting-luck + init-die parser + `deleteDialog` cascade catch. **(b) Fixes
  found while testing:** weapon-macro icon fallback read undefined
  `data.data.weapon.type` (`95a4454`); numeric coin-weight totals + awaited
  `rollValue` update (`1e69c72`). **(c) Tooling** (`478f427`):
  `@vitest/coverage-v8` + `npm run test:coverage` with **ratchet-floor
  thresholds** in `vitest.config.js` (statements 60 / branches 60 / functions
  63 / lines 60 — just below the 2026-06-09 baseline so coverage can only hold
  or climb; see `TESTING.md` "Coverage tooling + ratchet"). **(d)
  `warnIfDivergent` exit criterion defined** (`3f7ae9b`): the 6 calls are NOT
  redundant two-pass computation (single integer comparison catching silent lib
  drift); JSDoc in `adapter/debug.mjs` + `ARCHITECTURE_REIMAGINED.md` §8.6 now
  say to delete them only once the lib is version-pinned and ≥2 consecutive
  vendor syncs ship zero divergence warnings. Plus `chore` cleanup (`c278bc1` —
  debug logs + vendor sourcemap noise).

- **2026-06-09 — Phase 7: actor.js roll-dispatch extraction (reverses the
  session-50 "no further shrinkage" call).** Per owner direction, extracted the
  five roll-dispatch groups out of `actor.js` into cohesive mixins under
  `module/actor/`: `rolls-spell-mixin.mjs` (986 lines), `rolls-weapon-mixin.mjs`
  (984), `rolls-check-mixin.mjs` (777, ability/luck/init/hit-dice/save),
  `rolls-skill-mixin.mjs` (624), plus the shared `force-crit.mjs` free function
  (`applyForceCritToFoundryRoll`, used by both skill + spell). `DCCActor` now
  `extends RollsSkillMixin(RollsCheckMixin(RollsWeaponMixin(RollsSpellMixin(
  RollDataMixin(DerivedStatsMixin(ActiveEffectsMixin(Actor)))))))`. **actor.js
  3999 → 575** — what remains is the document lifecycle, `rollLuckDie`, and the
  damage/disapproval resolution methods. Behaviour-neutral: every `this.*`
  cross-reference resolves up the (always co-composed) prototype chain; all
  existing Vitest pass unchanged + a shape/behaviour guard per mixin
  (`actor-rolls-{spell,weapon,check,skill}-mixin.test.js`, 1679 total). Five
  commits, one per slice. Docs updated: `02-slice-backlog.md` Appendix-A note +
  `ARCHITECTURE_REIMAGINED.md` Appendix A / §8.6.


## Closed questions

All resolved — one-line ticks (full rationale in the linked sessions /
phase archives):

1. ~~Runtime loading strategy~~ — vendor the lib's built `dist/`; adapter imports a relative path into `module/vendor/dcc-core-lib/`, one `npm run sync-core-lib` per lib bump (2026-04-17).
2. ~~Package-name discrepancy~~ — moot under the vendor approach; docs call out the scoped `@moonloch/dcc-core-lib` (the bare token = local paths only) (2026-05-18).
3. ~~Dead hook `dcc.update`~~ — don't emit; XCC's speculative debug-only listener removed; `EXTENSION_API.md` Dead-hook table cleared (2026-05-18).
4. ~~Undocumented `game.dcc.*` with heavy XCC usage~~ — re-audit confirmed every symbol XCC touches is in `EXTENSION_API.md` Stable; caught + fixed two doc-rot items (2026-05-18).
5. ~~Patron-taint mechanic alignment~~ — `dcc-core-lib@0.7.0` models the RAW triggers; `_runLegacyPatronTaint` deleted; entire D3 arc complete (2026-04-24).
6. ~~Spellburn dialog integration~~ — adapter DialogV2 prompt wired into `rollSpellCheck` (2026-04-18); later unified into `promptRollModifierDialog` (Q7).
7. ~~Wizard/elf modifier-dialog coverage beyond Spellburn~~ — unified `promptRollModifierDialog` covers skill + spell checks incl. spellburn (2026-05-17, sessions 26 + 27).
8. ~~§2.1 schema-slimming (Group E halfling vertical)~~ — resolved **architecturally-bounded** (2026-06-08, session 51): Foundry's static one-schema-per-subtype model makes full per-class field removal unreachable; §2.1 closes on the mixin relocation (extensibility) + the lib being the class-clean read-side source of truth (schema class fields = compat projection). Per-class subtypes + runtime pruning rejected (ecosystem breakage). Decision record: [`dev/SCHEMA_SLIMMING.md`](dev/SCHEMA_SLIMMING.md).

## Blockers / open questions

None open. All prior blockers/questions are resolved (see *Closed
questions* above); active design / coverage work is tracked in the
*PR #720 review backlog* below.

## PR #720 review backlog (2026-04-19) — FULLY DRAINED

PR #720 (the merge of Phases 0-3 into `main`) triggered a full 8-agent review.
**Every flagged finding is now closed**; per-session narratives live in the
[phase-7 archive](dev/progress/phase-7.md). One-line close-out per sub-section:

- **Design calls** — 5 review-flagged calls (spellburn dialog-ordering,
  spellburn floor 0-vs-1, damage `_total` clamp divergence, `_xxxViaAdapter`
  error boundaries, `createFoundryRoller` delete-or-wire) resolved in sessions
  16–20.
- **Resilience / cleanup** — the programmatic-PC-creation finding was documented
  in `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` (session 33); a "quick PC" helper
  stays unbuilt by design.
- **Legacy decommission** — COMPLETE (sessions 16, 21–25): no `_xxxLegacy` roll
  branch survives; every public dispatcher is single-path through the adapter
  (retaining only the `options.rollUnder` / `!hasDie` *adapter* branches).
- **Test-coverage gaps (severity ≥ 6)** — all closed/found-stale (sessions
  26–31), each with Vitest + a live Playwright probe where the gap was real
  behavior.
- **Doc/comment hygiene** — 4 behavior-neutral edits (session 32).
- **Performance** — the two above-threshold items done (session 34); one
  micro-item left (deterministic `new Roll('${N}d1')` → `Roll.fromTerms`, no
  measurable win), not worth a slice.

## Decisions made

0. **Runtime loading: vendor the lib's built `dist/`.** See open
   question #1 above for the full rationale. Committed the initial
   sync + `scripts/sync-core-lib.mjs` in a standalone prep commit so
   Phase 1 imports have somewhere to import *from*. The sync script
   reads from `$DCC_CORE_LIB_SRC` (default
   `/Users/timlwhite/WebstormProjects/dcc-core-lib`), runs `npm run
   build` inside the lib, wipes and copies `dist/`, and writes a
   `VERSION.json` with `{ name, version, commit, dirty, syncedAt }`.
   `module/vendor/**` added to `standard.ignore` so the linter skips
   vendored output.

1. **Worktree location.** Now at
   `/Users/timlwhite/FoundryVTT-Next/Data/systems/dcc`. Main repo remains
   at `/Users/timlwhite/FoundryVTT/Data/systems/dcc`.
   *Why:* `FoundryVTT-Next` is a separate Foundry user-data install, so
   the worktree can live under its `systems/` directory without clashing
   with the main repo on `system.json` id (each Foundry install sees
   only its own `systems/` tree). This lets Tim actually run the
   refactored system in Foundry for testing during Phase 1+.
   *History:* originally parked at
   `/Users/timlwhite/WebstormProjects/dcc-refactor` on 2026-04-17 to
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

**All slice work is done — what's next is the PR #720 endgame
(sequenced, 2026-06-12):**

1. **Phases 4–7 review pass.** The 8-agent PR #720 review covered the
   Phases 0–3 diff; everything since (class registries, sheet
   composition, lib progression, the Phase 7 extraction arcs, the #732
   seam) has only had per-slice review. Run a comprehensive review of
   the full branch diff before merge (e.g. `/code-review ultra`).
2. **Pre-release build for live playtesting.** Cut a
   Foundry-installable 0.70.0 pre-release off this branch per
   `dev/PRERELEASE_PROCESS.md` so real worlds exercise the adapter
   before it ships. (`system.json` is already pinned to 0.70.0 with
   pre-release URLs — commit `c4be351`.)
3. **Sibling-module PR coordination.** Land/sequence with the system
   merge: `dcc-crawl-classes` #40, `mcc-classes` #38, and XCC
   `chore/migrate-to-dcc-extension-api` (all on the extension API this
   branch ships). Refresh the stale `EXTENSION_API.md` consumer rows
   while touching it.
4. **Squash-merge PR #720 into main as 0.70.0** (after 1–3), then
   release per `dev/RELEASE_PROCESS.md`.
5. **Time-gated, post-merge:** delete the 6 `warnIfDivergent` calls
   once the lib is version-pinned and ≥2 consecutive vendor syncs ship
   zero divergence warnings (`ARCHITECTURE_REIMAGINED.md` §8.6).

The per-file shrinkage record below is kept for reference — every
target is DONE; no further shrinkage slice is warranted anywhere.

All PR #720 cleanup arcs were closed first — legacy-decom
21–25, test-coverage 26–31, doc-hygiene 32, programmatic-PC doc 33, perf 34.

- **`config.js` (845 → 451 after session 39) — DONE.** `monster-data.mjs` (35),
  `images.mjs` (36), `dice.mjs` (37), `active-effect-keys.mjs` (38),
  `actor-importer.mjs` (39). What's left is small scalar enums
  (`abilities` / `saves` / `items` / `currencies` / `critRanges` / …) + the
  Phase 4–6 registry seeds (`classMixins` / `classDefaults` / `sheetParts` /
  `variants` / …) — **leave those in place**; they're tiny and are the file's
  actual reason to exist. No further `config.js` slice is warranted. ~~Open
  question: whether the unconsumed `activeEffectKeys` table should be
  deprecated/removed.~~ **RESOLVED 2026-06-08 (session 52): removed** — zero runtime
  consumers ever (system or siblings), superseded by Foundry's native V14 AE UI,
  human reference is the independent user-guide. `module/config/active-effect-keys.mjs`
  + the `CONFIG.DCC.activeEffectKeys` re-composition + tests deleted.
- **`item.js` (975 → 339 after session 42) — effectively DONE.** Pattern was
  **method-group → Foundry mixin** in `module/item/*.mjs`
  (`DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`),
  public surface byte-identical. Done: `container-mixin.mjs` (40 — 9
  weight/capacity/depth getters + 2 validation helpers); `currency-mixin.mjs`
  (41 — the 4-method treasure-value / currency block); `spell-mixin.mjs` (42 —
  the 5-method spell-roll block). All cohesive method groups are now extracted;
  what remains in `item.js` is `prepareBaseData` (weapon attack/damage prep) +
  the lifecycle hooks (`_onCreate` / `_preDelete` / `deleteDialog`) — the class's
  core identity, which stays. No further `item.js` slice is warranted.
  ~~**Open item:** the session-41 latent finding — `needsValueRoll`/`rollValue`
  formula path is dead under the integer `CurrencyField` schema.~~ **RESOLVED
  2026-06-08 (session 52): rollable treasure values restored.** New
  `TreasureValueField` (StringField per denomination) for an item's `system.value`
  (actor `currency` stays integer `CurrencyField` — Item Piles/§2.12 safe);
  `base-item.mjs` `migrateData` now String()s legacy integers instead of
  `parseInt()`-destroying formulas. The surrounding scaffolding (text sheet inputs,
  `parseInt` readers, `needsValueRoll` guard, the Roll-Value button) was already
  formula-aware — only the schema + migration had orphaned the feature.
- **`actor-sheet.js` (1890 → 1040 after session 47) — cohesive extractions DONE.**
  Sheets can't use the mixin pattern (their big methods are `#private`); shape is
  **pure-logic → free function** in `module/actor-sheet/*.mjs`, sheet calls it.
  Done: `effects.mjs` (43), `items.mjs` (44), `presentation.mjs` (45),
  `drag-drop.mjs` (46 — `_onDragStart` + `findDataset`), `drop.mjs` (47 — the two
  drop handlers `handleContainerDrop` / `dropActiveEffect`; `_onDrop` stays since
  it calls `super._onDrop`). Remaining is just the static `#` action handlers
  (thin `rollXxx` wrappers — low value, the `static #x` entries must stay in the
  `actions` map). No further `actor-sheet.js` slice warranted.
- **`actor.js` (4574 → 4145 after session 49) — IN PROGRESS.** Document class →
  uses the `item.js` mixin pattern (`DCCActor extends DerivedStatsMixin(
  ActiveEffectsMixin(Actor))`). Done: `active-effects-mixin.mjs` (48 — the
  AE-application engine) + `derived-stats-mixin.mjs` (49 — the four `compute*`
  helpers) + `roll-data-mixin.mjs` (50 — `getRollData` / `getAttackBonusMode` /
  `getActionDice`) + `damage-breakdown.mjs` (50 — the pure `_buildDamageBreakdown`
  free function). `actor.js` 4574 → 3999 (−575). **All cohesive *non-dispatch*
  groups + the low-value accessor/pure-logic mop-up are now extracted — the
  Appendix-A shrinkage arc is COMPLETE.** What remains in `actor.js` is the
  **adapter dispatch layer** (`rollXxx` + `_xxxViaAdapter` + the
  spell/attack/damage/crit/fumble dispatch bodies) that per
  `ARCHITECTURE_REIMAGINED.md §8.6` stays co-located with the public wrappers —
  extracting it would split the dispatch path and is NOT a behavior-neutral
  shrinkage. No further `actor.js` shrinkage slice is warranted.

**Group E / §2.8 — validated, no DCC-side work left.** The class-registration
registries shipped in Phases 4–6 and two real sibling content modules now
consume them (`dcc-crawl-classes` PR #40, `mcc-classes` PR #38; Group E
session 1 added the per-class mercurial-magic table registry). **The §2.1
schema-slimming question — the halfling vertical — was closed session 51
(2026-06-08) as architecturally-bounded** (Foundry's static one-schema-per-subtype
model blocks full per-class field removal; the lib is the class-clean read-side
source of truth; per-class subtypes + runtime pruning rejected for ecosystem
breakage — see [`dev/SCHEMA_SLIMMING.md`](dev/SCHEMA_SLIMMING.md)). **The
"homebrew single-class vertical" candidate is dropped — already validated by real
consumers** (2026-06-08 audit): `dcc-crawl-classes` ships **9 homebrew classes on
base DCC** (Ranger / Paladin / Orc / two Halfling subclasses / Gnome / Elven Rogue
/ Dwarven Priest / Bard) driving `registerClassMixin` + `registerSheetPart` +
`registerClassDefaults` + `registerHomebrewClassForProgressionLoad` +
`registerActorSheet` + 9 `extends DCCSheet` stubs; `mcc-classes` exercises the same
registries across 7 variant classes. A real 9-class module is strictly stronger
than a synthetic demo. The only registries no sibling exercises —
`registerClassStartingItems` (built-in dwarf only) and `registerVariant` for a
base-DCC homebrew (n/a) — already have dedicated coverage (P5-2, P6-5). **Group E
is fully done; no further Group E work is warranted.**

**Cross-repo coordination:** if any future migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with `allowLuck`
needing dice-chain bumps), land the lib change first in its own `dcc-core-lib`
PR, then sync via `npm run sync-core-lib`.

**Sibling-module status:**
- **`dcc-crawl-classes`** — migrated to the full class-registration API
  (mixins / defaults / sheet-parts / `registerActorSheet` + 5-line
  `DCCSheet` stubs). Branch `refactor/dcc-extension-api`, PR
  foundryvtt-dcc/dcc-crawl-classes#40 (2026-05-29).
- **`mcc-classes`** — migrated the same way, keeping thin `_prepareContext`
  overrides for its §9.2/§9.3a data migrations; cross-cutting shared MCC
  fields stay on the `dcc.definePlayerSchema` hook. Branch
  `refactor/dcc-extension-api`, PR foundryvtt-dcc/mcc-classes#38
  (2026-05-29). Both verified live in the v14 world; together they are the
  §2.8 homebrew-extensibility validation.
- **XCC** has consumed the `dcc.afterComputeSpellCheck` hook +
  `game.dcc.registerActorSheet` recipes shipped in B1-followup /
  B1-followup-2; PR pending on `foundryvtt-dcc/xcc` branch
  `chore/migrate-to-dcc-extension-api`. Same branch also retires 9
  XCC-side redefinitions of DCC class schema fields (luckDie, backstab,
  knownSpells, maxSpellLevel, disapproval, disapprovalTable, deity,
  corruption, spellCheckAbility) that were silently clobbering DCC
  defaults. Phase 4 schema-mixin design needs to coordinate with the XCC
  field consumption documented in this PR.

## Notes for future sessions

- The pre-commit hook runs `npm run format` → `git add .` → `npm test`.
  That `git add .` **will sweep untracked files into the commit**. Before
  committing, either stash or add to `.gitignore`.
- **Node is managed by fnm, not nvm** (Node 24 is the default; there is
  no `~/.nvm/nvm.sh`). Ignore older `nvm use 24` instructions — just
  verify `node --version` ≥ 24 and run commands directly.
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
