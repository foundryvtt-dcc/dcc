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

**Phase 7 cleanup — latest 2026-05-31.** Phase 7 session 19 (full detail
in *Recent slices*) closed the PR #720 **`createFoundryRoller`
delete-or-wire design call** — deleted. The async Foundry-Roll wrapper had
zero consumers and its only rationale (a future phase preferring the lib's
async roller) is a closed door: every dispatcher landed on the two-pass
**sync** pattern instead, which the async roller conflicts with. Closed
both the design call and its paired coverage gap; corrected three stale
comments + two live docs. (Session 18 closed the **damage `_total`
clamp-divergence** call as resolved-upstream — the lib now clamps `total`
itself; session 17 closed the **spellburn floor-1-vs-0** call in favor of
RAW fidelity.) Repo green: **1319 Vitest** / **166 Playwright e2e passed**,
zero failures.

**Remaining PR #720 items:** open *design calls* (1 left — **error
boundaries around `_xxxViaAdapter`**; damage-clamp + `createFoundryRoller`
closed 2026-05-31) + *test-coverage gaps* + *doc hygiene* (see *PR #720
review backlog* below) — the resilience/cleanup sub-list is fully ticked.

**Group E / §2.8 validated by real consumers (2026-05-29).** The
"homebrew single-class vertical" candidate is fulfilled by migrating two
*actual* sibling content modules onto the Phase 4–6 class-registration
API — `dcc-crawl-classes` (9 classes, PR #40) and `mcc-classes` (7
classes, PR #38). No further DCC-side Group E work is needed (the
registries already shipped in Phases 4–6; these are downstream
consumers). See top *Recent slices* entry + *Sibling-module status*.

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-05-31 — Phase 7 session 19: close the PR #720 `createFoundryRoller`
  delete-or-wire design call — deleted (+ its paired coverage gap).** The
  async Foundry-Roll wrapper (`module/adapter/foundry-roller.mjs`,
  39 lines) had **zero consumers** — production, tests, and all four
  sibling modules. Its stated future-use ("later phases may prefer the
  lib's async roller") is a *closed door*: Groups A/C/D + the unified
  modifier dialog all landed on the two-pass **sync** pattern (Foundry
  evaluates the formula inline via `new Roll(plan.formula).evaluate()`,
  the lib classifies the natural in a second `{mode:'evaluate'}` pass),
  which the async roller fundamentally conflicts with — wiring it would
  *reverse* a deliberate design choice, not finish an unfinished one.
  `git rm`'d the file + corrected three stale comments that
  mischaracterized the ability-check flow as routing through it
  (`adapter-ability-check.test.js` header flow-diagram; two in
  `actor.test.js`). Live docs updated (`01-session-start.md` adapter
  list; `ARCHITECTURE_REIMAGINED.md` §5.4 annotated PLANNED/NEVER-ADOPTED);
  the `phase-0-1.md` archive references stay (accurate history — the file
  existed then). Zero behavior change (nothing imported it). Closes both
  the design call and its paired test-coverage gap. **1319 Vitest**
  (unchanged — no tests removed; the file had none). Full e2e re-run as
  the regression net (the deleted path's stale comments referenced the
  live ability-check dispatch, already covered).

- **2026-05-31 — Phase 7 session 18: close the PR #720 damage `_total`
  clamp-divergence design call — resolved-upstream, the premise was
  stale.** The backlog worried that Foundry floored the *displayed* damage
  total at 1 while the lib left `dcc.libDamageResult.total` un-floored, so
  the chat flag could carry `0`/negative while chat showed `1` (latent —
  no consumer reads the flag; `dcc-qol` reads the pre-clamped
  `messageData.system.damageRoll.total`). User chose the **hybrid** fix
  (keep `total` honest + add a clamped `displayTotal`); investigating it
  surfaced that the **lib has since gained its own min-1 clamp**
  (`combat/damage.js:93` — `Math.max(1, baseDamage + modifierDamage)`),
  *proven empirically* when a `1d3-4` test expecting lib `total: -3`
  returned `1`. That guts the divergence entirely — both sides floor, so
  `displayTotal` would just duplicate `total`. Backed out the `displayTotal`
  additions; final change is **doc + test only, zero behavior change**:
  corrected the now-false "lib doesn't [clamp]" comment at
  `_buildLibDamageResult` + the `_rollDamage` / `buildPassthroughDamageResult`
  JSDoc (both now state both sides floor + the lib leaves
  `baseDamage`/`modifierDamage` raw so they won't sum to a floored total —
  its deliberate shape). +1 Vitest reworked (`adapter-weapon-damage.test.js`:
  a 1d3-4 floored hit floors to 1 on *both* sides, components stay raw)
  +1 Playwright (`adapter-dispatch.spec.js`: live `_rollDamage('1d3-4')`
  asserts `damageRoll.total === libDamageResult.total === 1`). **1319 Vitest**
  (was 1318, +1). **166 Playwright passed**, zero failures (was 165, +1;
  5.5-min full suite). PR #720 design calls: 3 → 2 left.

- **2026-05-31 — Phase 7 session 17: resolve the spellburn floor-1-vs-0
  design call in favor of RAW fidelity (floor 0) — the load-bearing fix was
  the *schema*, not the adapter clamp; + an e2e smoke-test fast-fail; + lib
  0.11.0 synced.** The PR #720 design call asked whether a physical ability
  burned by spellburn floors at 1 or 0 (legacy + DCC RAW allow 0 — burning
  Stamina to 0 is lethal, an intentional rules feature). Decided **floor 0**.
  The floor turned out to live in **three** layers, peeled in order:
  1. **Adapter write-sites** — two `Math.max(1, …)` clamps flipped to
     `Math.max(0, …)`: the item-bound `onSpellburnApplied` bridge
     (`adapter/spell-events.mjs`) and the **naked-cast inline deduct** in
     `_castNakedViaAdapter` (`actor.js`, easy to miss — a raw check has no
     `spellItem` to wire `createSpellEvents`, so it deducts inline).
  2. **Data-model schema** — the *actual* persisted floor: `AbilityField.value`
     was `NumberField({ min: 1 })`, so Foundry silently clamped the adapter's
     0-write back to 1. Changed to `min: 0` (`max` keeps `min: 1` — a 0
     ceiling is nonsensical). **This is the load-bearing change**; the
     adapter clamps alone were cosmetic without it. The mocked unit tests
     missed it (they don't run schema validation); the new burn-to-0
     **browser test caught it live** (read 1, expected 0) — exactly the
     regression net the suite exists for.
  3. **Lib utilities** — `validateSpellburn` / `getMaxSpellburn` /
     `applyBurnToAbility` floors moved 1→0 in `@moonloch/dcc-core-lib`
     (PR moonloch/dcc-core-lib#8, **merged**, v0.11.0; `631f250`). These are
     RAW-correctness / landmine-removal — **not in the cast path** (nothing
     calls them), so behavior never depended on them; fixed per the "fix it
     in dcc-core-lib" rule for any future consumer. New dedicated
     `spellburn.test.ts` (10 tests) in the lib.
  Vendor **synced** (`npm run sync-core-lib` → `module/vendor/dcc-core-lib/`
  at 0.11.0/`631f250`); the sync also pruned 28 stale `data/classes/*-progression.*`
  files (pre-registry build artifacts vendored at the Phase 0 `fddcf04` sync,
  provably unused — `data/classes/index.js` only re-exports `progression-utils.js`).
  Separately, **added an e2e smoke-test fast-fail** (`browser-tests/e2e/global-setup.js`
  + a defense-in-depth check in `fixtures.js login()`): when Foundry is down or a
  GM is already logged in (the "Gamemaster" `/join` option is disabled), the run
  now aborts in ~10 s with an actionable message instead of letting all ~165 tests
  each burn the 60 s setup timeout (~25 min). This was prompted by exactly that
  happening this session. The 20 s picker-wait avoids false-fails on a slow world
  boot (verified: passes when joinable, fast-fails when blocked). Also corrected the
  stale `/Users/timwhite` → `/Users/timlwhite` username across CLAUDE.md, the sync
  script, and docs (this machine's checkout is under `timlwhite`), and cloned the
  lib source to `/Users/timlwhite/WebstormProjects/dcc-core-lib` (it was absent).
  Tests: +2 Vitest (item-bridge burn-to-0 + oversized-burn-clamps-at-0, replacing
  the old floor-1 assertion) +1 Vitest (naked-path burn-to-0) +1 integration
  (`data-models.test.js`: real-`NumberField` value 0 accepted, −3 clamps to 0,
  `max` 0→1). +1 Playwright (`adapter-dispatch.spec.js`: live Wizard burns Stamina
  3 → 0, asserts 0 not 1). **1318 Vitest** (was 1309). **165 Playwright passed**,
  zero failures (5.9-min full suite, smoke-gated).

- **2026-05-31 — Phase 7 session 16: retire `_rollSpellCheckLegacy` by
  deriving the caster profile from the spell's castingMode (closes PR #720
  design-call #1 — silently-dropped spellburn).** The internal legacy
  spell-check backstop had two reachable triggers, both "the lib can't
  model this class": the `noCasterProfile` fallback (wizard/cleric-mode
  spell on a class with no lib profile) and the dispatcher fall-through
  (unknown castingMode, or a generic-mode spell on a cleric/patron actor).
  The key realization: the lib already resolves a profile from
  `castingModeOverride` via `getCasterProfile(mode)` (canonical wizard/
  cleric regardless of the actor's class), so the adapter can absorb every
  legacy case — **no lib change needed**, pure routing consolidation.
  `_rollSpellCheckViaAdapter` now retries `buildSpellCheckArgs` with
  `castingModeOverride: castingMode` when the class profile is null
  (logged `reason=profileFromCastingMode`), routing the cast through
  `_castViaCalculateSpellCheck` with canonical wizard/cleric mechanics
  driven by the spell — **which honors `options.spellburn`**, the harm in
  design-call #1 (legacy ignored it, so the player burned ability points
  for nothing). The dispatcher dropped its `!isCleric && !hasPatron`
  generic guard (generic spells carry no disapproval / patron taint per
  RAW) and routes generic + unknown modes to the synthetic-generic
  `_castViaCastSpell`. `_rollSpellCheckLegacy` deleted; 4 stale comment
  references (actor.js / roll-dialog.mjs / spell-input.mjs docstrings)
  cleaned. `DCCItem.rollSpellCheck` / `processSpellCheck` stay (permanent
  public API, decision #6 — only the internal dispatch wrapper went).
  Behavior contract change (user-approved 2026-05-31): an unregistered
  class's wizard/cleric-mode spell now gets canonical lib treatment from
  the castingMode; unknown-mode spells get a side-effect-free generic
  cast; the escape hatch for bespoke mechanics is
  `registerClassProgression`. +1 Vitest (spellburn deducts on an
  unregistered class) + 4 flipped unit/actor tests to the new contract.
  +1 Playwright (`spellburn on a class the lib does not know is HONORED` —
  live STR 12 → 9 after a 3-point burn) + 1 flipped (`noCasterProfile` →
  `profileFromCastingMode`). **1309 Vitest** (was 1304). **164 Playwright
  passed**, zero failures. Note: the full e2e run first showed 2
  `extension-api.spec.js` failures from `dcc-core-book` being **disabled
  in the v14 world** (pin-pointed via the boot log — the level pack never
  connected; nothing to do with this slice); re-enabling the module +
  rebooting → fully green.

- **2026-05-29 — §2.8 homebrew extensibility validated by real
  sibling-module migrations + EXTENSION_API doc refresh (`c76a3a9`).** The
  Phase 4–6 class-registration stack (`registerClassMixin` /
  `registerClassDefaults` / `registerSheetPart` / `registerActorSheet`)
  got its first real-world consumers: `dcc-crawl-classes` (9 classes — PR
  foundryvtt-dcc/dcc-crawl-classes#40) and `mcc-classes` (7 classes — PR
  foundryvtt-dcc/mcc-classes#38) were migrated off the legacy
  monolithic-`dcc.definePlayerSchema` + NPC-base-sheet pattern onto the
  API, each verified live in the v14 world. This fulfills the Group E
  "homebrew single-class vertical" candidate with **actual content
  modules** rather than a synthetic class — crawl collapsed to 5-line
  `DCCSheet` stubs; mcc kept thin `_prepareContext` overrides for its
  §9.2/§9.3a one-time data migrations (the `-=`/transform logic
  `registerClassDefaults` can't express). **No DCC-suite delta** (the
  migrations live in the sibling repos with their own suites; counts stay
  1304 Vitest / 162 Playwright). The only DCC-branch artifact is the
  docs-only `c76a3a9` refreshing the `EXTENSION_API.md` `registerActorSheet`
  row (both modules were still listed "migration opt-in"). Surfaced no
  DCC-system gaps — every enabler (`DCCSheet` export, `sheetClass` on the
  base schema, the progression-load hook) already existed.

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

## Blockers / open questions

None open. All prior blockers/questions are resolved (see *Closed
questions* above); active design / coverage work is tracked in the
*PR #720 review backlog* below.

## PR #720 review backlog (2026-04-19)

PR #720 (the merge of Phases 0-3 into `main`) triggered a full 8-agent
review. Fixed findings have been pruned — their narratives live in the
*Recent slices* section / phase archives. The items below are the
deferred findings still open.

**Open design calls (need a deliberate decision, not a silent fix):**

- ~~**Spellburn dialog prompts before the adapter knows it can handle the
  cast.**~~ CLOSED 2026-05-31 (Phase 7 session 16). Resolved by retiring
  `_rollSpellCheckLegacy` itself rather than guarding the dialog: when the
  actor's class has no lib profile, `_rollSpellCheckViaAdapter` now derives
  the profile from the spell's own castingMode (`castingModeOverride:
  castingMode` → canonical wizard/cleric) and routes through
  `_castViaCalculateSpellCheck`, **which honors `options.spellburn`**.
  There is no longer a `noCasterProfile`→legacy path to drop the
  commitment. See Recent slices.
- ~~**Spellburn clamp: `1` vs `0`.**~~ CLOSED 2026-05-31 (Phase 7 session
  17). Decided in favor of **RAW fidelity (floor 0)** — a physical ability
  may be burned all the way to 0 (burning Stamina to 0 is lethal, an
  intentional DCC rules feature). The floor lived in **three** layers, all
  flipped: (1) the **data-model schema** `AbilityField.value`
  (`min: 1` → `min: 0`) — the actual persisted floor; Foundry was silently
  clamping the 0-write to 1 (caught live by the new burn-to-0 browser test,
  missed by the mocked unit tests); (2) both adapter write-sites — the
  item-bound `onSpellburnApplied` bridge and the naked-cast inline deduct
  in `_castNakedViaAdapter` (`Math.max(1,…)` → `Math.max(0,…)`); (3) the
  lib utilities `validateSpellburn` / `getMaxSpellburn` / `applyBurnToAbility`
  (RAW-correctness only — not in the cast path). The legacy `#modifySpellburn`
  dialog already permitted `newStat >= 0`, so the input side needed no change.
  Lib **merged + synced** (`@moonloch/dcc-core-lib` v0.11.0, `631f250`;
  PR moonloch/dcc-core-lib#8). See Recent slices.
- ~~**Damage `_total` clamp divergence** (`actor.js`).~~ CLOSED
  2026-05-31 (Phase 7 session 18) — resolved-upstream; the premise was
  stale (the lib gained its own min-1 clamp, so the two totals can't
  diverge). Doc + test only; no consumer reads the flag. Full narrative
  in the session-18 Recent-slices entry.
- **Error boundaries around `_xxxViaAdapter`** — DECIDED 2026-05-31:
  **fail-loud** (wrap each adapter dispatch; on throw log + show a
  `ui.notifications.error`, then rethrow — no legacy fallback, preserving
  the surface-bugs philosophy). Not yet implemented. Sequence it
  before/with the *Legacy decommission* work below (once legacy is gone
  there's no fallback at all). Fix the two un-awaited sheet calls
  (`rollAbilityCheck` actor-sheet:1477, `rollWeaponAttack` :1622) in the
  same slice — a throw there is an unhandled rejection / silent dead
  click today.
- ~~**`createFoundryRoller` — delete or wire.**~~ CLOSED 2026-05-31
  (Phase 7 session 19) — **deleted** (zero consumers; its only rationale
  was a closed door — every dispatcher landed on the two-pass sync
  pattern the async roller conflicts with). Closes the paired coverage
  gap below. Full narrative in the session-19 Recent-slices entry.

**Open resilience / cleanup items:**

- ~~**Dispatcher gate style inconsistency.**~~ CLOSED 2026-05-29 (Phase 7
  session 15). The premise was stale: the named `_canRouteXxxViaAdapter`
  predicates were already retired in D1/D2 (sessions 15–16), so
  attack/damage/crit/fumble are single-path with no gate. The only
  surviving binary legacy-vs-adapter gates were ability + save (named
  `const needsLegacyPath`) and init (a bare `if`). Normalized init to the
  named-boolean idiom so all three read identically; skill + spell are
  intentionally left multi-way (they dispatch to several adapter
  sub-routes, not a binary legacy gate). See Recent slices.
- ~~**Unused `weapon` / `attackRollResult` parameters.**~~ CLOSED
  2026-05-29 (Phase 7 session 15). The `_canRouteCrit/FumbleViaAdapter`
  predicates this referenced were retired in D2; the surviving vestigial
  param was `attackRollResult` on `_rollDamage` / `_rollCritical` /
  `_rollFumble` (unused since session 19, no external/sibling callers,
  `_`-prefixed private). Dropped from all three signatures + call sites +
  tests. See Recent slices.
- **Programmatic PC creation produces inconsistent class config.**
  `Actor.create({ system: { class: { className: 'Wizard' } } })` doesn't
  set `spellCheckAbility`, `details.sheetClass`, save `classBonus`, crit
  / luck die, etc. — real users get these from the level-change dialog.
  Phase 6 sessions 1-2 wired `registerClassProgression` + a compendium →
  lib-registry loader, so in worlds where a content module ships level
  data the lib derives these; the open-source system ships none, so bare
  programmatic creation in a content-free world still hits it. Remaining:
  document the level-change-dialog dependency for "quick PC" tooling /
  browser-test fixtures.

**Legacy decommission (full `_xxxLegacy` retirement — added 2026-05-31):**

Goal: delete every surviving `_xxxLegacy` branch so the public
dispatchers are single-path through the adapter, per the
legacy-branch-retirement principle (decision #7 — Foundry-facing API
stays as thin wrappers; internal `_xxxLegacy` bodies retire once adapter
coverage is exhaustive for their gate). Group D already retired
attack / crit / fumble / damage; the spell-check legacy wrapper went in
session 16. **Four `_xxxLegacy` bodies remain**, each kept alive only by
the option-flag(s) in its dispatcher gate. Retiring them is gated on
moving those capabilities into the adapter first — sequence the work by
the shared capability, not by the method, since one capability unblocks
several gates at once:

1. **Roll-under in the adapter.** Blocks `_rollAbilityCheckLegacy`
   (luck checks) + `_rollSavingThrowLegacy`. **Partly already in the
   lib:** `checks/luck-check.js` exports `rollLuckCheck(character,
   options)` with full roll-under mechanics (1d20, success if ≤ Luck
   score, no modifiers) — so the ability-check luck case is mostly an
   adapter-wiring job (build a `_rollLuckCheckViaAdapter` around
   `rollLuckCheck` + a roll-under render path through chat-renderer; the
   two-pass `{mode:'formula'}`→evaluate→`roller:()=>natural` pattern
   applies). **Open for saves:** confirm whether any DCC save actually
   uses roll-under (the gate has `!!options.rollUnder` on save, but it
   may be dead in practice — audit the sheet's save options first); if a
   real save roll-under exists and the lib can't express it, that's the
   `dcc-core-lib` PR (generalize roll-under beyond luck, land lib-side
   first, then sync). Once wired, drop the `!!options.rollUnder` clause
   from both gates.
2. **Modifier-dialog for ability + save + init.** Blocks the
   `!!options.showModifierDialog` clause in `_rollAbilityCheckLegacy`,
   `_rollSavingThrowLegacy`, and `_getInitiativeRollLegacy`. The
   pattern already exists — Q7 (sessions 26–27) wired
   `promptRollModifierDialog` adapter-side for skill + spell checks.
   This extends the same dialog to the three remaining binary gates.
   Biggest single unblock: clears the only gate on init, and one of
   two clauses on ability + save.
3. **Non-zero check-penalty display in the adapter.** Blocks the last
   clause of `_rollAbilityCheckLegacy` (str/agl with a non-zero armor
   check penalty render a penalty term). Adapter must surface the
   penalty as a labelled modifier term in the chat breakdown (the
   `buildModifierBreakdownHtml` machinery from the chat-renderer slice
   can likely carry it).
4. **Description-only skill items in the adapter.** Blocks
   `_rollSkillCheckLegacy` (the `!resolved.hasDie` gate) — these emit a
   *description chat message*, not a roll. Either teach
   `_rollSkillCheckViaAdapter` / a sibling adapter route to emit the
   description card, or split a tiny `_emitSkillDescription` helper that
   both the (eventually-deleted) legacy path and the adapter call.
5. **Delete the bodies + the shared helper.** Once 1–4 land, the four
   `needsLegacyPath` / gate branches are dead. Delete
   `_rollAbilityCheckLegacy`, `_getInitiativeRollLegacy`,
   `_rollSavingThrowLegacy`, `_rollSkillCheckLegacy`, and the shared
   `_buildSkillCheckLegacyTerms` helper. Collapse each dispatcher to a
   single `return this._xxxViaAdapter(...)` (mirroring the Group D
   attack/crit/fumble/damage collapse). Add a retirement-guard test per
   method (assert the `_xxxLegacy` symbol is `undefined`), matching the
   D2 `_rollDamageLegacy` guard pattern. Clean the ~15 stale
   `_rollSkillCheckLegacy` doc/comment references catalogued by the
   grep at session 19.

Dependency notes / landmines:
- **`error boundaries` interaction.** The remaining design call (fail-loud
  notify + rethrow around `_xxxViaAdapter`, chosen 2026-05-31) should land
  *before or alongside* this — once legacy is gone there's no fallback at
  all, so a lib throw must surface as a `ui.notifications.error`, not a
  silent dead click. Two sheet calls are currently **un-awaited**
  (`rollAbilityCheck` actor-sheet:1477, `rollWeaponAttack` :1622), so a
  throw there is an unhandled rejection today — fix the await + add the
  boundary in the same slice.
- **Cross-repo.** Any capability the lib can't yet express (roll-under
  result shape, modifier-dialog term threading) lands as a
  `dcc-core-lib` PR first, then `npm run sync-core-lib`, per the
  standing lib-fix rule.
- **Per-slice testing.** Each of 1–5 is its own refactor slice on this
  branch (auto-commit authorization applies): full Vitest + full e2e +
  ≥1 new browser assertion exercising the newly-adapter-routed behavior
  live (e.g. a roll-under luck check, a save with the modifier dialog, a
  description-only skill item) — these are exactly the branches that
  *only* the legacy path covered, so the e2e assertions are the
  regression net proving the adapter now owns them.

**Open test coverage gaps (pr-test-analyzer severity ≥ 6):**

- `renderDisapprovalRoll` — no unit/integration test (only transitively
  via the cleric disapproval browser-test).
- `promptSpellburnCommitment` + `clampBurn` mocked across every caller;
  `roll-dialog.mjs` has no direct coverage.
- `onSpellLost` tested as a direct callback but never verified to fire
  during a real adapter cast.
- Two-pass divergence: only the `terms[0]` die-bump case is covered;
  `terms[N]` Compound / Modifier in-place mutations are not.
- `_canRouteAttackViaAdapter` untested branches (dice-bearing
  `weapon.toHit`, `twoWeaponSecondary`, settings try/catch). Gate retired
  at session 15 — assertions moved to the single-path body.
- `_rollToHitViaAdapter` NPC `attackHitBonus.melee.adjustment` Modifier
  injection (PC-only tests) + the `Roll.validate(toHit) === false`
  early-return path.
- ~~`createFoundryRoller` — no direct unit test~~ CLOSED 2026-05-31
  (Phase 7 session 19) — moot; the file was deleted (see the design-call
  closure above), so there is nothing left to cover.
- `__mocks__/dcc-roll.js` declares `createRoll` as `static async` while
  production is sync; tests install local sync stubs — fix the shared
  mock, delete the stubs.
- Surviving data-driven migration branches (`migrateActorData` /
  `migrateItemData`: V14 AE numeric-mode → string-type converter,
  `sheetClass`-from-localized-`className`, `critRange` / `disapproval`
  string→number, `luckyRoll` → `birthAugur`, default alignment) have no
  fixture tests — only exercised when Foundry boots a real world. The V14
  AE converter is V14-critical. Proposed: `migrations-data-driven.test.js`
  with one fixture per branch (needs a test-only export of the two
  module-local `const` helpers).

**Documentation / comment hygiene:**

- `ARCHITECTURE_REIMAGINED.md` §7 Phase-1 bullets reference lib APIs
  `rollCheck('ability:str', …)` / `resolveSkillCheck(…)` /
  `rollInitiative(…)` but the adapter landed `rollAbilityCheck` /
  `rollSavingThrow` / `rollCheck` (subsumed skill + init). Annotate with
  the landed names.
- `ARCHITECTURE_REIMAGINED.md` §2.7 file-size snapshot is pinned to
  branch start; prefix with `(Snapshot at main @ 2337ec0)`.
- `actor.js` disapproval-chat-ordering comment overstates ordering
  guarantees (`onDisapprovalIncreased` fires fire-and-forget inside
  pass 2). Soften the claim or `await` the chat-message creation.
- `_getInitiativeRollViaAdapter` accepts an `options = {}` param it never
  reads — drop, or document "reserved for future modifier-dialog bridge."

**Performance (below measurement threshold; document only):**

- `getActionDice` called 3× per `_rollToHitViaAdapter` — hoist to a
  single `const`.
- `items.find` called 2× per `_getInitiativeRollViaAdapter` — fold into
  one iteration.
- `renderDisapprovalRoll` / `renderMercurialEffect` use
  `new Roll('${N}d1')` for deterministic chat;
  `Roll.fromTerms([new NumericTerm({ number: total })])` reads cleaner
  (no measurable win).

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

**PRIORITY (2026-05-31, user-directed) — fully decommission the legacy
roll paths.** See the *Legacy decommission* subsection in the PR #720
backlog above for the sequenced 5-step plan (roll-under → modifier-dialog
→ check-penalty → description-only skill → delete the 4 `_xxxLegacy`
bodies + `_buildSkillCheckLegacyTerms`). Land the **error-boundaries**
design call (fail-loud notify + rethrow; fix the two un-awaited sheet
calls) before/with the deletion so a post-legacy lib throw surfaces
visibly instead of as a silent dead click. Any lib capability gap
(roll-under result shape, modifier-dialog term threading) lands as a
`dcc-core-lib` PR first, then `npm run sync-core-lib`.

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

**~~Pending feature — optional label override for raw spell checks
(`options.checkLabel`).~~ LANDED 2026-05-29.** Implemented from the spec
([docs/dev/SPELL_CHECK_LABEL_OVERRIDE.md](dev/SPELL_CHECK_LABEL_OVERRIDE.md),
Status now ✅ landed) — see Recent slices. Downstream: MCC still needs to
add the `data-check-label` attributes on its mutation / program-check
cells (inert until MCC ships them; no DCC-side work remaining).

**Cross-repo coordination:** if any migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with
`allowLuck` needing dice-chain bumps), land the lib change first in
its own PR in `dcc-core-lib`, then sync via `npm run sync-core-lib`.

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
