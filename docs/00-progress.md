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

**Phase 7 session 14 (2026-05-29)** closes the PR #720 "chat doesn't
surface the per-modifier breakdown the adapter already captures" item.
The lib emits each contributing modifier with rich origin metadata and
the adapter persists it as `flags.dcc.libResult.modifiers`, but nothing
rendered it — and because the adapter builds the Foundry Roll from the
lib's flat formula string, Foundry's native term tooltip was unlabelled
too (a regression vs. the legacy `roll-modifier.js` path). New exported
pure helper `buildModifierBreakdownHtml(modifiers, heading)` in
`module/adapter/chat-renderer.mjs` lists each modifier as
`<origin.label> <signed value>` (e.g. "STR modifier +2"), handling both
the tagged-union `RollModifier` shape (ability / save / skill) and the
flat `LegacyRollModifier` shape (spell). All four renderers append it
under the rolled formula via the proven manual-`rollHTML` + `content`
pattern. New i18n key `DCC.ModifierBreakdown` ("Modifiers", all 7
langs); `.dcc-modifier-breakdown` styling in `styles/_chat.scss`. +11
Vitest (`chat-renderer.test.js`), +1 Playwright
(`adapter-dispatch.spec.js`). **1299 Vitest**; full e2e **160 passed,
zero failures** (the previously-flaky `extension-api.spec.js:2232`
link-fields test passed clean this run). Remaining PR #720 candidates:
dispatcher gate-style unification; unused crit/fumble predicate params.

**Prior (2026-05-29):** session 13 made `checkMigrations` async +
`await`ed `migrateWorld` before firing `dcc.ready` (threading
`{ migrationComplete }` onto the payload); a standalone `fix(adapter)`
preserved additive init-die terms (`1d20+1d3`) through the
combat-tracker path via `_initDieAdditiveTerms`
(`docs/dev/ADDITIVE_INITIATIVE_DIE_FIX.md`).

<!-- Detailed prior-phase narrative removed — archived in
`dev/progress/phase-{3,4,5}.md`. The Recent slices section below
keeps the five most-recent entries. -->

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-05-29 — Phase 7 session 14: render the per-modifier breakdown
  the adapter already captures (`libResult.modifiers`) under the rolled
  formula in chat (closes the PR #720 "chat doesn't surface the
  per-modifier breakdown" resilience item).** The lib emits each
  contributing modifier with rich origin metadata
  (`{ kind, value, origin: { category, id, label }, applied }` for the
  tagged-union shape; `{ source, value, label? }` for the legacy spell
  shape) and the four chat renderers persist the array as
  `flags.dcc.libResult.modifiers` — but nothing rendered it, and because
  the adapter builds the Foundry Roll from the lib's flat formula string
  (`new Roll(plan.formula)`) Foundry's native term tooltip was unlabelled
  too, a regression vs. the legacy `module/roll-modifier.js` path that
  set per-term labels. New exported pure helper
  `buildModifierBreakdownHtml(modifiers, heading)` in
  `module/adapter/chat-renderer.mjs` lists each modifier as
  `<origin.label> <signed value>`. Tagged-union handling renders `add` /
  `display` (signed numeric) + `add-dice` (a `+1d3`-style dice term),
  drops `applied:false` rows, and skips the die-reshaping kinds
  (`set-die` / `bump-die` / `multiply` / `threat-shift`) that have no
  flat "+N under the formula" reading; the legacy shape renders
  `label || source` + signed value. Labels are HTML-escaped (equipment /
  AE item names can carry markup). The localized heading (new i18n key
  `DCC.ModifierBreakdown` = "Modifiers", translated to all 7 langs;
  `compare-lang` clean) is passed in by the renderers, keeping the
  helper free of Foundry globals + unit-testable in isolation (mirrors
  `buildLibResultFlag`). All four renderers (`renderAbilityCheck` /
  `renderSavingThrow` / `renderSkillCheck` / `renderSpellCheck`) append
  the breakdown via the proven manual-`rollHTML` + `content` pattern
  (the one `renderSkillCheck` already used for skill-item descriptions),
  so it rides under the roll exactly once; ability / save switch from
  the auto-render path to manual-content in the common case (modifiers
  almost always present) — the manual `await foundryRoll.render()`
  reproduces the auto-render byte-for-byte plus the breakdown. Styling
  via `.dcc-modifier-breakdown` / `-heading` / `-list` / `-row` /
  `-value` in `styles/_chat.scss` (theming-contract `--system-*` vars;
  `dcc.css` recompiled). +11 Vitest in `chat-renderer.test.js` (empty /
  non-array input; `add` signed values; the `+0` "Save bonus" case;
  heading present/absent; `applied:false` drop; `display` + `add-dice`;
  die-reshaping skip; `category:id` label fallback; legacy
  `label || source`; non-finite-value skip; HTML escaping). +1 Playwright
  in `adapter-dispatch.spec.js` (a live STR-16 ability check asserts the
  breakdown container + localized heading + a labelled `+2` row render,
  exactly once). **1299 Vitest** (was 1288, +11). **160 Playwright
  passed**, zero failures — clean 6.3-min full suite (was 158 passed +
  1 isolation-passing flake at session 13; +1 new probe = 159, and the
  `extension-api.spec.js:2232` link-fields navigation-race flake passed
  clean this run → 160). Next PR #720 candidates: dispatcher gate-style
  unification; unused crit/fumble predicate params.

- **2026-05-29 — Phase 7 session 13: `await` world migration before
  firing `dcc.ready` + thread `{ migrationComplete }` onto the payload
  (closes the PR #720 "`migrateWorld` fire-and-forget from a sync ready
  hook" item).** Before this slice `module/dcc.js`'s sync ready callback
  called `checkMigrations()` (and inside it `migrations.migrateWorld()`)
  fire-and-forget, so `registerTables` / `FleetingLuck.init` /
  `SpellDuel.init` / … / `Hooks.callAll('dcc.ready')` ran concurrently
  with the async per-document `update()` calls — third-party modules
  listening on `dcc.ready` could fire against a half-migrated world.
  `checkMigrations` was relocated out of `dcc.js` into `migrations.js`
  (co-located with `migrateWorld` / `classifyMigrationDecision` /
  `migrationOutcome`), made `async`, and now `await`s `migrateWorld`;
  the ready hook does `const migrationStatus = await
  migrations.checkMigrations()` before the rest of the chain, and fires
  `Hooks.callAll('dcc.ready', { migrationComplete:
  migrationStatus.migrationComplete })`. `migrateWorld` now returns
  `{ migrationComplete: outcome.stampVersion }`; `checkMigrations`
  returns `{ migrationComplete }` — `true` for a non-GM client (never
  migrates locally), an already-migrated world (`skip`), or a clean run;
  `false` for a blocked pre-V14 world or a run that finished with
  per-document failures (version left unstamped). `ui` dropped from
  `dcc.js`'s `/* global */` (its only use was the now-relocated block
  notification). The relocation makes the decide-then-await orchestration
  unit-testable in the established `migrations.js` pattern. +4 Vitest in
  new `module/__tests__/check-migrations.test.js` (non-GM no-op; `skip`
  no-op; pre-V14 `block` → error toast + no migrate + reports incomplete;
  V14-era `run` → runs `migrateWorld` to completion on an empty world +
  stamps the version + reports complete). +1 Playwright probe in
  `extension-api.spec.js` dynamic-imports the live module, asserts
  `checkMigrations` is an `AsyncFunction`, and — on the already-migrated
  test world (decision `skip`) — invokes it live to confirm the
  `{ migrationComplete: true }` return contract with **no** `migrateWorld`
  run (spies the MigrationInfo toast to prove the no-op). **1283 Vitest**
  (was 1279, +4). Note: this closes only the fire-and-forget item; the
  separate (now-closed) silent-swallow item landed at session 11. The
  ordering item was the last remaining `migrateWorld`-related PR #720
  entry.

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
  Next-arc candidates: the remaining PR #720 items (`migrateWorld`
  async-await fire-and-forget fix; chat per-modifier breakdown
  rendering; dispatcher gate-style unification; unused crit/fumble
  predicate params) or a Group E vertical-slice.

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

- ~~**Chat doesn't surface the per-modifier breakdown the adapter
  already captures.**~~ **Fixed 2026-05-29** (Phase 7 session 14).
  The four chat renderers (`renderAbilityCheck` / `renderSavingThrow`
  / `renderSkillCheck` / `renderSpellCheck`) now render the modifier
  breakdown under the rolled formula via a new exported pure helper
  `buildModifierBreakdownHtml(modifiers, heading)` in
  `module/adapter/chat-renderer.mjs`. It lists each contributing
  modifier as `<origin.label> <signed value>` (e.g. "STR modifier
  +2"), handling both the tagged-union `RollModifier` shape
  (ability / save / skill — renders `add` / `display` numeric values +
  `add-dice` as a `+1d3` term, drops `applied:false` rows, skips the
  die-reshaping kinds set-die / bump-die / multiply / threat-shift)
  and the flat `LegacyRollModifier` shape (spell — `label || source` +
  signed value). Labels are HTML-escaped (item names can carry markup).
  The heading is the new i18n key `DCC.ModifierBreakdown` ("Modifiers",
  all 7 langs), passed in by the renderers so the helper stays
  Foundry-global-free + unit-testable (mirrors `buildLibResultFlag`).
  Renderers append it via the proven manual-`rollHTML` + `content`
  pattern (the same one `renderSkillCheck` already used for skill-item
  descriptions), so the breakdown rides under the roll exactly once and
  the legacy `roll-modifier.js` labelled-term UX is restored. Styling
  via `.dcc-modifier-breakdown` in `styles/_chat.scss` (theming-contract
  vars). +11 Vitest in `chat-renderer.test.js`, +1 Playwright in
  `adapter-dispatch.spec.js` (live STR-16 ability check → labelled `+2`
  row, rendered once). Surfaced 2026-04-23 during the Cheesemaker
  save-bonus debugging session.

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
- ~~**Three copies of "strip die count" normalization.**~~ **Fixed
  2026-05-29** (Phase 7 session 12). Consolidated onto one
  parameterized `normalizeLibDie(foundryDie, fallback = 'd20')` in
  `module/adapter/attack-input.mjs`: `spell-input.mjs` imports it
  (private dup deleted), and `DCCActor._stripDieCount` is a one-line
  wrapper delegating with `fallback: null`. All eight call sites pass a
  single die string or a falsy value, so the former copies' edge-case
  divergences (falsy / no-match fallback + anchoring) are unreachable;
  the lone behavior change (former `attack-input` no-match → fallback
  instead of original string) is unreachable + more correct. +3 Vitest,
  +1 Playwright probe.
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
- ~~**`migrateWorld` per-doc catches swallow silently**~~ **Fixed
  2026-05-29** (Phase 7 session 11). The four
  `catch (err) { console.error(err) }` sites in `module/migrations.js`
  now also push `{ type, name }` onto a `failures` array;
  `migrateCompendium` returns its failures up to `migrateWorld`. A new
  pure exported `migrationOutcome(failures)` gates the finish: a clean
  run stamps the version at `NEEDS_MIGRATION_VERSION` + shows the
  "complete" toast; any failure leaves the version unstamped (the
  idempotent data-driven migrations re-run next load) and raises
  `ui.notifications.warn(DCC.MigrationFailures, { count })`. New i18n
  key translated to all 7 langs. +4 Vitest in new
  `migration-outcome.test.js`, +1 Playwright probe.
- ~~**`migrateWorld` fire-and-forget from a sync ready hook**~~ **Fixed
  2026-05-29** (Phase 7 session 13). `checkMigrations` relocated out of
  `module/dcc.js` into `migrations.js`, made `async`, and now `await`s
  `migrateWorld`; the ready hook `await`s `checkMigrations` before the
  rest of the chain (`registerTables`, `FleetingLuck.init`,
  `SpellDuel.init`, `defineStatusIcons`, welcome dialog,
  `Hooks.callAll('dcc.ready', { migrationComplete })`) runs, so listeners
  no longer race the async per-document mutations. `migrateWorld` +
  `checkMigrations` return `{ migrationComplete }` (`true` for non-GM /
  already-migrated / clean run; `false` for a blocked pre-V14 world or a
  run with per-document failures), threaded onto the `dcc.ready` payload.
  +4 Vitest in new `module/__tests__/check-migrations.test.js`, +1
  Playwright probe in `extension-api.spec.js`.

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

**Pending feature — optional label override for raw spell checks
(`options.checkLabel`).** Small, general-purpose, fully
backward-compatible addition so a class/module can relabel the raw
(no-item) spell-check chat flavor (today hardcoded to "Spell Check").
MCC reuses the spell-check machinery for **Mutation Check** (mutant /
manimal / plantient) and **Wetware Program Check** (shaman), which
currently read wrong in chat. Change is two small edits:
`module/actor-sheet.js` `#rollSpellCheck` forwards a `data-check-label`
cell attribute as `options.checkLabel`; `module/actor.js`
`_castNakedViaAdapter` uses it as the flavor base when no spell name is
present (`game.i18n.localize` passes through a non-key literal, so it
works as either an i18n key or a raw string). Item casts unaffected
(already flavor with the item name); the ability suffix is preserved.
Tests: raw `rollSpellCheck({ checkLabel })` → localized flavor; regression
`rollSpellCheck({})` → still "Spell Check"; item cast with `checkLabel`
→ still the item name. Downstream: MCC adds the `data-check-label`
attributes (inert until this DCC change ships). Full spec:
[docs/dev/SPELL_CHECK_LABEL_OVERRIDE.md](dev/SPELL_CHECK_LABEL_OVERRIDE.md).

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
