# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and
> after any significant decision. Future Claude sessions rely on this.
>
> **Detailed session-by-session history lives in phase archives:**
> - [Phase 0 + 1 — scaffolding + simple rolls](dev/progress/phase-0-1.md)
> - [Phase 2 — spell check migration](dev/progress/phase-2.md)
> - [Phase 3 — attacks, damage, crit, fumble + cruft](dev/progress/phase-3.md)

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

Phase 3 is active but now narrow. `rollWeaponAttack` + all four
chained calls (`rollToHit` / `rollDamage` / `rollCritical` /
`rollFumble`) are single-path via the adapter (sessions 15 / 16 /
19 retired the respective `_xxxLegacy` branches). Groups A
(attack-gate broadening) and C (parallel cruft slices) are closed.
Session 21 / D3a (2026-04-24) retired `_runLegacyPatronTaint` by
bringing patron taint in line with DCC RAW lib-side
(`dcc-core-lib@0.7.0`). Session 22 / D3b-α (2026-04-24) landed the
patron-taint manifestation table loader: the adapter now routes
`CastSpellInput.patronTaintTable` via `CONFIG.DCC.patronTaintPacks`
so the 10 authored Bobugbubilz / Azi Dahaka / Sezrekan / the King
of Elfland / Three Fates / Barzodi / Circe / Medea / Prometheus /
Amazing Rando manifestation tables shipped in `dcc-core-book` +
`xcc-core-book` light up the `onPatronTaint` chat emote. Session
22 follow-ons closed D3b-γ (sibling-pack audit — no
`dcc-crawl-classes` / `mcc-classes` patron content exists; default
seed is exhaustive) and authored D3b-β (content mirror in
`dcc-official-data`). Session 23 / D3c (2026-04-24) retired the
dormant `SpellFumbleResult.patronTaint` flag + fumble-entry tag
parsing via `dcc-core-lib@0.8.0` (breaking change, audit-clean dead-
code removal). Remaining Phase 3 backlog is D4 (fold direct-reimpl
spell-check branches — per-branch design, **STOP AND ASK per branch**).
See
[`docs/02-slice-backlog.md`](02-slice-backlog.md) for the full
inventory. Phase 4 (schema slimming) has not started.

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-04-24 — Session 23 / D3c: retire dormant
  `SpellFumbleResult.patronTaint` flag.** Lib PR to
  `dcc-core-lib@0.8.0` (breaking change) removed `.patronTaint` from
  `SpellFumbleResult` + the `effect.type === 'patron-taint'` /
  `effect.data.patronTaint === true` parsing in `rollSpellFumble` /
  `rollSpellFumbleWithModifier`. Pre-exec audit confirmed zero
  consumers (lib orchestration never read the flag; DCC system +
  siblings + compendium content had none). Vendor-synced; +1 vitest
  regression guard asserting the flag is absent from both fumble
  rollers. 925 Vitest + 98 Playwright green. Lib build: 1407 tests
  green. (Lib commit in `dcc-core-lib` pending Tim's cadence;
  vendored `dist/` is 0.8.0 but `VERSION.json.commit` still points
  at `e8ecabe` (0.7.0) with `dirty: true` — will refresh post lib
  commit.)
- **2026-04-24 — Session 22 follow-ons: D3b-γ closed, D3b-β
  authored cross-repo.** Sibling audit: `mcc-classes` ships no
  packs; `dcc-crawl-classes/packs/` has no patron-taint JSONs.
  `CONFIG.DCC.patronTaintPacks` default seed (core + xcc side-
  effect packs) is exhaustive — no adapter change needed (γ).
  D3b-β authored new `src/spells/patron-taints.ts` in
  `dcc-official-data` mirroring the 5 core `dcc-core-book`
  manifestation tables with Foundry `[[/roll XdY]]` markup
  stripped to plain `[XdY]` dice notation; exports
  `PATRON_TAINT_TABLES` + `getPatronTaintTable(patron)` lookup
  helper; `tsc --noEmit` clean. Commit in `dcc-official-data`
  pending (different repo, auto-commit authorization scoped to
  DCC refactor branch only). No runtime DCC change — the
  compendium RollTables remain authoritative.
- **2026-04-24 — Session 22 / D3b-α: patron-taint manifestation
  table loader.** New `loadPatronTaintTable(actor)` in
  `module/adapter/spell-input.mjs` (mirror of `loadDisapprovalTable`):
  walks `CONFIG.DCC.patronTaintPacks` looking for a `RollTable`
  named `Patron Taint: ${actor.system.class.patron}`, case-
  insensitive-fallback on the tail (lets actors storing "The King
  of Elfland" resolve the `dcc-core-book` table named with lowercase
  "the King of Elfland"), falls back to world tables. New `CONFIG.DCC.patronTaintPacks`
  `TablePackManager` seeded in `module/dcc.js:462-472` with the core
  + xcc side-effect packs; sibling modules can push additional packs
  via `addPack`. `_castViaCalculateSpellCheck` threads the resolved
  `SimpleTable` onto `input.patronTaintTable`, pre-rolls the paired
  manifestation 1d6 (only when a table is present, matching the
  existing creeping-chance d100 pattern), and the roller closure now
  returns the pre-rolled d6 for `1d6` formulas. Bobugbubilz / Azi
  Dahaka / Sezrekan / the King of Elfland / Three Fates tables ship
  authored in `dcc-core-book/packs/dcc-core-spell-side-effect-tables`;
  Barzodi / Circe / Medea / Prometheus Firebringer / Amazing Rando
  in the equivalent `xcc-core-book` pack. All 10 light up the
  `onPatronTaint` chat emote automatically. 805 Vitest + 98
  Playwright (+7 new vitest for loader paths + full integration
  acquisition; +1 new Playwright asserting compendium-resolved
  manifestation text reaches chat).
- **2026-04-24 — Session 21 / D3a: patron-taint RAW alignment +
  retire `_runLegacyPatronTaint`.** Lib PR #6 (`dcc-core-lib@0.7.0`,
  commit `e8ecabe`) replaced the fumble-gated taint mechanic with the
  two RAW triggers: per-cast creeping chance (1d100 vs
  `patronTaintChance`, +1% per miss, reset to 1 on acquisition) + per-
  spell result-table entry (`effect.type === 'patron-taint'` or
  `effect.data.patronTaint === true`). Also fixed natural-1 forcing
  result-table lookup to row 1 (discards modifiers per RAW). Adapter
  side: `spell-input.mjs` threads `patronTaintChance` +
  `isPatronSpell` onto `castInput`; `spell-events.mjs` wires
  `onPatronTaint` chat render; `actor.js` pre-rolls the 1d100 via
  Foundry (same two-pass determinism pattern as disapproval d4),
  persists `result.newPatronTaintChance`, and deletes
  `_runLegacyPatronTaint` (36 lines). 917 Vitest + 97 Playwright
  (+2 new: high-chance acquisition reset, non-patron spell no-op).
  A new D3c backlog entry tracks the follow-up cleanup of the
  now-dead `SpellFumbleResult.patronTaint` flag + fumble-entry tag.
- **2026-04-23 — C2 cruft: prune pre-V14 migrations.** Seven
  version-gated branches in `module/migrations.js` deleted; new
  `MINIMUM_SUPPORTED_VERSION = 0.66` guard in `dcc.js`'s
  `checkMigrations` with i18n key `DCC.MigrationUnsupportedVersion`
  (7 langs). Fresh-world guard treats `0` + `null` as "never
  migrated". 917 Vitest + 95 Playwright.
- **2026-04-20 — Session 20 / C1 cruft: retire `critText` /
  `fumbleText` compat shims.** 3 lines dropped from `actor.js`;
  dcc-qol rename documented as migration recipe in
  `EXTENSION_API.md`. 883 Vitest + 87 Playwright.
- **2026-04-20 — Session 19 / D2 damage retirement.** Retired
  `_rollDamageLegacy` + gate + via-adapter alias in a combined
  sub-slice (c)+(d) collapse after `@moonloch/dcc-core-lib@0.6.0`
  extended `DamageInput` with negative `magicBonus` + new
  `extraDamageDice[]`. All three D2 retirements (attack / crit /
  fumble / damage) now complete.
- **2026-04-20 — Session 18 / D2 damage sub-slice a.**
  `buildPassthroughDamageResult` accepts unparseable formulas
  (lance `doubleIfMounted`, homebrew `damageOverride`, multi-die)
  through the adapter with `libDamageResult.passthrough: true`.

## Closed questions

5. ~~**Patron-taint mechanic alignment.**~~ **Resolved 2026-04-24 at
   Session 21 / D3a: `dcc-core-lib@0.7.0` models the two RAW triggers
   (creeping chance + patron-spell result-table entries) plus the
   natural-1-forces-row-1 rule; `_runLegacyPatronTaint` deleted.
   D3b (content authoring) + D3c (fumble-entry tag cleanup) tracked
   in the backlog but neither blocks Phase 3 close.**

6. ~~**Spellburn dialog integration.**~~ **Resolved 2026-04-18 at
   Phase 3 session 1: adapter-side `promptSpellburnCommitment` dialog
   via DialogV2, wired into `rollSpellCheck` dispatcher for the
   wizard / elf + `showModifierDialog` branch.** The latent regression
   from Phase 2 session 2 (wizard adapter casts silently lost the
   Spellburn UI) is fixed. Other legacy-dialog capabilities (die
   tweak, custom modifier rows, CheckPenalty toggle, FleetingLuck)
   remain absent on the adapter path and will be revisited once the
   attack / damage dialog work generalizes the roll-dialog scaffold.

## Blockers / open questions

1. ~~**Runtime loading strategy.**~~ **Resolved 2026-04-17: vendor
   approach (option b).** `scripts/sync-core-lib.mjs` builds the linked
   lib and copies its `dist/` into `module/vendor/dcc-core-lib/`, which
   is committed. Adapter code imports via relative path
   (`../vendor/dcc-core-lib/index.js`). No bundler added. One sync
   command (`npm run sync-core-lib`) + one commit per lib-version bump.

2. **Package name discrepancy.** The architecture doc and setup
   instructions refer to `dcc-core-lib`, but the actual npm package
   name is `@moonloch/dcc-core-lib` (scoped). Imports use the scoped
   name. The unscoped name is not currently published, so CI currently
   *cannot* `npm install` the lib — only `npm link` works. Resolved
   in spirit by vendoring; can be closed out.

3. **Dead hook `dcc.update`.** XCC listens for this hook
   (`modules/xcc/module/xcc.js:525`), but nothing in the DCC system
   emits it. Either it was removed at some point, or XCC added it
   speculatively. Decide: add the emission back, or coordinate with
   XCC maintainers to remove the listener. Documented in
   `EXTENSION_API.md §Dead`.

4. **Undocumented `game.dcc.*` pieces with heavy XCC usage.** XCC
   reaches into `game.dcc.DCCRoll.cleanFormula`, `game.dcc.DiceChain.
   bumpDie`, `calculateCritAdjustment`,
   `calculateProportionalCritRange`, and the full `FleetingLuck` class
   (`init`, `updateFlags`, `give`, `enabled`, `automationEnabled`).
   These are now tagged **stable** in `EXTENSION_API.md`. Formal
   stabilization before Phase 3 was the original ask; Phase 3 is
   largely complete and these exports still stand. Can be closed once
   `EXTENSION_API.md` is re-audited.

7. **Wizard / elf adapter-path modifier-dialog coverage beyond
   Spellburn.** Phase 3 session 1 added back the Spellburn prompt but
   the other legacy `RollModifierDialog` capabilities (die tweak,
   custom modifier rows, CheckPenalty toggle, FleetingLuck) remain
   absent for wizard adapter casts. Low-volume (most users take
   default rolls). Most likely path: generalize
   `module/adapter/roll-dialog.mjs` after the attack / damage dialog
   lands, once the two dialogs share a common scaffold.

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

**Post-C2 (2026-04-23) — all of Group A closed, all Group D
retirements landed (sessions 15 / 16 / 19), C1 + C3 cruft
retired (session 20 + 2026-04-20), C2 pre-V14 migrations pruned
(2026-04-23).** `rollWeaponAttack` + all four chained calls
(`rollToHit` / `rollDamage` / `rollCritical` / `rollFumble`) are
single-path via the adapter; `module/migrations.js` now targets
V14-era (0.66+) worlds only. Remaining backlog candidates — all
marked **STOP AND ASK** because each carries a design decision
the code alone can't settle:

1. **D3 patron-taint RAW alignment** — cross-repo design. Needs
   `dcc-core-book` + `xcc-core-book` coordination for
   fumble-table `effect.type === 'patron-taint'` tagging.
2. **D4 fold direct-reimpl spell-check branches** — pre-built
   Roll + RollTable, `forceCrit`, skill-table spells (Turn
   Unholy). Each branch evaluated separately; stop-and-ask per
   branch.
3. **Group E vertical slice** (placeholder — needs explicit
   pick): halfling, mercurial-magic, or homebrew single-class.
   Would exercise Phase 4 + 5 + 6 end-to-end.

**Cross-repo coordination:** if any migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with
`allowLuck` needing dice-chain bumps), land the lib change first in
its own PR in `dcc-core-lib`, then sync via `npm run sync-core-lib`.

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
