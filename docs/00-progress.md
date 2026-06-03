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

**Phase 7 cleanup → PR #720 test-coverage backfill — latest 2026-06-02.**
With the legacy-decom arc closed (sessions 21–25) and the slice backlog's
active queue drained, the open work is the PR #720 *test-coverage gaps* +
*doc hygiene* + *programmatic-PC-creation* items (none on a critical path).
The **test-coverage-backfill arc is COMPLETE** (sessions 26–31): session 26
closed the *always-run* data-driven migration-branch gap (the **V14-critical
ActiveEffect numeric-mode → string-type converter** + `luckyRoll`/alignment/
`critRange`/`disapproval`/`sheetClass`/#739-speed/owned-item branches);
session 27 closed the two deterministic chat-emit renderers
`renderDisapprovalRoll` + `renderMercurialEffect`; session 28 fixed the
`__mocks__/dcc-roll.js` async/sync mismatch (shared `withSyncCreateRoll`;
footprint was 2 files, not the backlog's estimated 13); session 29 verified
`onSpellLost` fires during a real wizard cast (deterministic d3+low-INT
fail-to-lost); session 30 added the `terms[N]` two-pass-divergence boundary
guard (re-scoped: the only genuine gap was the documented "in-place
`terms[N>0]` mutation reaches Foundry but not `libResult`" boundary);
**session 31** (full detail in *Recent slices*) closed the last gap — the NPC
`rollToHit` `attackHitBonus.<type>.adjustment` Modifier injection + the
`Roll.validate(toHit) === false` early-return. All six are **pure test-infra /
coverage backfill — no production behavior change, no lib change.** Session
29's full-suite run also surfaced + fixed the long-standing **forceCrit test
flake** — root-caused as a *dice-probability* flake (the test expected a
forced natural-20 but `applyForceCritToFoundryRoll` intentionally skips a
natural 1, so an uncontrolled d20 failed ~1/20), NOT the "suite-only state
pollution" the docs long assumed; fixed by retrying past the nat-1 (verified
10/10). With session 31 the **arc is complete — every PR #720 severity-≥6
coverage gap is closed or found-stale.** Repo green: **1402 Vitest** / **181
Playwright e2e passed**, zero failures (flake-clean since the session-29
forceCrit fix).

**Doc/comment-hygiene arc — session 32 (2026-06-02) drained the
*Documentation / comment hygiene* backlog subsection** (now all four items
struck). Four behavior-neutral edits: the `ARCHITECTURE_REIMAGINED.md` §7
*Landed names* annotation + §2.7 `main @ 2337ec0` snapshot pin, the softened
`actor.js` disapproval-chat-ordering comment, and the dropped unused
`_getInitiativeRollViaAdapter` `options` param. No production behavior change,
no lib change, no test-count delta (full e2e run per Tim's call since the
param drop touches a real dispatch path; **1402 Vitest / 181 Playwright**,
unchanged).

**Programmatic-PC-creation doc — session 33 (2026-06-02) drained the last open
*resilience/cleanup* backlog item.** Pure-doc slice (zero code/test/lib change):
new `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` documents the three mechanisms a
bare `Actor.create()` bypasses (sheet-open `applyClassDefaults`, the
level-change dialog's compendium-driven writes, the Phase-6 lib-progression
registry) + the quick-PC/fixture guidance + the content-free-world caveat;
cross-linked from `EXTENSION_API.md` / `README.md` / `CLASS_DECOMPOSITION.md`
(§3.5 + §3.3 also refreshed from their stale "Planned"/"once Phase 6 wires"
framing). The backlog item's open option was always "document the dependency"
(no consumer needs an actual quick-PC helper). **Full e2e run deferred to Tim's
call** — no code touched, so the Playwright net asserts nothing new.

**Perf cleanups — session 34 (2026-06-02) drained the two itemized PR #720
Performance "document only" items.** Behavior-neutral perf slice: (1) hoisted
the **3×** `getActionDice` call in `rollToHit` to one `const actionDicePresets`
(the call also does a side-effecting `config.actionDice` migration write, so the
repeats redid that work) — threaded into `buildAttackInput` via a new optional
`actorActionDiceFormula` param so the standalone helper stays back-compatible;
(2) folded the **2×** `items.find` scan in both `_getInitiativeRollViaAdapter`
and `_getInitiativeRollWithDialogViaAdapter` into one `for…of` pass, apply order
preserved (custom-init-die weapon still wins over two-handed). +2 Vitest (hoist
guard + fold-order guard; 3 dead `.find`-mock tests rewritten to inject real
Collections) + 1 live Playwright (both-equipped order probe). **No behavior
change, no lib change.** **1404 Vitest** (was 1402, +2). **182 Playwright
passed**, zero failures (was 181, +1; 6.5-min full suite). Slice was picked up
uncommitted from a prior session and finished here. The remaining off-critical-
path candidate is the Appendix-A file-shrinkage arc.

**Legacy decommission arc — done.** All five steps landed (sessions 21–25)
plus the session-20 error-boundary prerequisite. No `_xxxLegacy` roll body
survives anywhere in the system. All PR #720 design calls remain closed.

**Group E / §2.8 validated by real consumers (2026-05-29).** The
"homebrew single-class vertical" candidate is fulfilled by migrating two
*actual* sibling content modules onto the Phase 4–6 class-registration
API — `dcc-crawl-classes` (9 classes, PR #40) and `mcc-classes` (7
classes, PR #38). No further DCC-side Group E work is needed (the
registries already shipped in Phases 4–6; these are downstream
consumers). See *Sibling-module status* below.

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-06-02 — Phase 7 session 34: below-threshold perf cleanups — hoist
  `getActionDice` in `rollToHit` + fold the double `items.find` in both
  initiative methods (PR #720 Performance "document only" backlog).** Drained
  the two remaining itemized Performance items (both were tagged
  *below-measurement-threshold; document only*, but each removes a genuinely
  redundant call so they were worth doing, not just documenting). (1)
  **`rollToHit` hoist** — `getActionDice({ includeUntrained: true })` was
  called **3×** per attack (the `die` [0]-formula read, the action-die term
  `presets`, and inside `buildAttackInput`). `getActionDice` is not pure: it
  runs a regex/split **and** performs a side-effecting implicit
  `config.actionDice` migration write, so the repeats redid that work. Hoisted
  to one `const actionDicePresets = this.getActionDice({ includeUntrained:
  true })`; `actorActionDice = actionDicePresets[0].formula` feeds all three
  consumers, and `buildAttackInput(this, weapon, actorActionDice)` now takes an
  **optional** third `actorActionDiceFormula` param (`attack-input.mjs`) — when
  omitted, standalone callers still self-compute via the prior
  `actor.getActionDice(...)[0]?.formula || '1d20'` fallback, so the public
  helper signature stays back-compatible. (2) **initiative fold** — both
  `_getInitiativeRollViaAdapter` and `_getInitiativeRollWithDialogViaAdapter`
  scanned `this.items` **twice** (`find` for the first equipped two-handed
  weapon, then again for the first equipped custom-init-die weapon). Folded
  into a single `for…of` pass collecting both, **preserving apply order** —
  two-handed applied first, custom-init-die applied last so it still WINS when
  both are equipped. Tests: +2 Vitest — a `rollToHit` hoist regression guard
  (`vi.spyOn(actor, 'getActionDice')` → `toHaveBeenCalledTimes(1)`), and a
  `getInitiativeRoll` fold-order guard that injects a real two-weapon
  Collection (two-handed listed first) and asserts the custom-init die +
  `[Weapon]` label win over the d16/two-handed label. Also **rewrote 3
  `.find`-mock tests** (`actor.test.js` + 2 in `adapter-initiative.test.js`)
  to inject a real `global.Collection` instead of `vi.spyOn(actor.items,
  'find')` — the fold no longer calls `.find`, so the old mocks were dead; the
  rewrites now also assert the d16 die actually reaches the formula, not just
  that a Roll comes back. +1 Playwright (`adapter-dispatch.spec.js`): a **live**
  actor equipped with BOTH a two-handed `1d16`-init weapon (created first) and
  a custom-init `1d24`-override weapon → the adapter log + produced Roll carry
  the custom die + `[Weapon]` label, not the two-handed die/label (guards the
  single-pass apply order end-to-end). **No behavior change — pure perf +
  test-infra. No lib change.** **1404 Vitest** (was 1402, +2). **182 Playwright
  passed**, zero failures (was 181, +1; 6.5-min full suite). Picked up
  uncommitted from a prior session and finished (docs + full e2e run); Foundry
  was relaunched mid-session after the GM tab freed.

- **2026-06-02 — Phase 7 session 33: programmatic-PC-creation dev guide
  (PR #720 resilience/cleanup backlog — the last open non-perf item).**
  Pure-doc slice; no code, test, or lib change. Closed the standing
  "programmatic PC creation produces inconsistent class config" item by
  *documenting the dependency* (the open option in that note was always
  "document the level-change-dialog dependency for quick-PC tooling /
  browser-test fixtures" — no consumer needs an actual quick-PC helper).
  New `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` lays out the **three**
  population mechanisms a bare `Actor.create({ system: { class: {
  className: 'Wizard' } } })` bypasses: (1) **sheet-open class defaults** —
  `applyClassDefaults(actor, classId)` (`extension-api.mjs:333`) fires from
  every PC sheet's `_prepareContext` (`actor-sheets-dcc.js:81`) on first
  open, writing `details.sheetClass` / `class.spellCheckAbility` /
  `class.disapproval` / `classLink` / the `config.*` toggles from
  `built-in-class-defaults.mjs`; (2) **the level-change dialog** —
  `DCCActorLevelChange.#onSubmitForm` (`actor-level-change.js:280`) is the
  *only* path that writes the level-scaled fields (`saves.*.value`,
  `details.critDie`/`critTable`/`critRange`, `attributes.actionDice.value`,
  `hitDice.value`, `class.luckDie`, HP, level) via `actor.update(levelData)`
  from compendium `{ClassName}-{level}` items; (3) **the Phase-6 lib
  registry** — `registerClassProgressionsFromPacks()`
  (`foundry-data-loader.mjs:209`) loads the same packs at `dcc.ready` so
  adapter roll paths read `getSaveBonus`/`getCritDie`/… by classId+level at
  roll time (no stored field). Documented what's missing on a bare create,
  the quick-PC/fixture guidance (e2e specs deliberately set only the field
  each test needs — `extension-api.spec.js:1373` inline `spellCheckAbility`,
  `:1186` targeted `update`), and the **content-free-world caveat** (the
  open-source system ships only the registration surface; level data is
  copyrighted GG material in the private `dcc-official-data` repo, so
  mechanisms 2+3 write nothing without a content module). Cross-linked from
  `EXTENSION_API.md` (`registerClassProgression` row), `docs/dev/README.md`,
  and `CLASS_DECOMPOSITION.md` — and **refreshed two now-stale spots there**:
  §3.5 from "Planned"/"return zeros because no class is registered" to
  "Shipped Phase 6 sessions 1–2" + the data caveat, and §3.3's overlap note
  from "will derive … once Phase 6 wires `registerClassProgression`" to the
  shipped present tense. **No production behavior change, no lib change, no
  test-count delta.** Full e2e suite run deferred to Tim's call (see Notes)
  — zero code touched, so the Playwright net asserts nothing new.

- **2026-06-02 — Phase 7 session 32: doc/comment hygiene — `ARCHITECTURE_REIMAGINED.md`
  §7/§2.7 + the disapproval-chat-ordering comment + drop the unused
  `_getInitiativeRollViaAdapter` `options` param (PR #720 doc/comment-hygiene
  backlog).** First slice of the post-coverage doc-hygiene arc; four
  behavior-neutral edits. (1) **§7 Phase-1 bullets** sketched the lib API as
  `rollCheck('ability:str', …)` / `resolveSkillCheck(…)` / `rollInitiative(…)`;
  added a *Landed names* annotation block — as shipped the lib exposes
  **dedicated** `rollAbilityCheck` + `rollSavingThrow` (not the string-tag
  form) plus a **generic** `rollCheck(definition, character, { mode })` that
  **subsumed** both `resolveSkillCheck` and `rollInitiative` (no such symbols
  exist); all three import into `actor.js` as `libRollAbilityCheck` /
  `libRollSavingThrow` / `libRollCheck`. (2) **§2.7** file-size figures
  flagged as a snapshot at `main @ 2337ec0` (verified: those are the exact
  line counts at that commit — actor.js 2,251 / actor-sheet.js 1,848 / dcc.js
  1,560 / item.js 966 / item-sheet.js 874). (3) **`actor.js`
  disapproval-chat-ordering comment** overstated the order — softened: only
  the two *awaited* messages (spell check, then disapproval roll) are ordered;
  the "gained-range" EMOTE is emitted **fire-and-forget** by the
  `onDisapprovalIncreased` callback inside pass 2 (`spell-events.mjs` →
  `ChatMessage.create` not awaited by the lib), so its landing position
  relative to the two isn't deterministic. (4) **`_getInitiativeRollViaAdapter`**
  dropped its never-read `options = {}` param (signature + the one call site
  at the no-dialog branch) — the modifier-dialog bridge lives entirely in the
  sibling `_getInitiativeRollWithDialogViaAdapter`; replaced with a doc note.
  No `resolveSkillCheck`/`rollInitiative` reserved-future framing (that bridge
  already landed as the separate dialog method). **No production behavior
  change — pure doc/comment + dead-param removal. No lib change. No test count
  delta** (the param was already covered by the live init dispatch test + the
  error-boundary mock; the existence assertion in `actor.test.js` still holds).
  Full e2e run per Tim's call (the param drop touches a real dispatch path):
  **1402 Vitest** (unchanged) / **181 Playwright passed**, zero failures
  (unchanged; 6.4-min full suite). Served system verified to reflect the
  no-arg signature before the run.

- **2026-06-02 — Phase 7 session 31: NPC `rollToHit` branches — adjustment
  injection + `Roll.validate` early-return (PR #720 test-coverage gap;
  closes the test-coverage-backfill arc).** The last two uncovered
  `rollToHit` branches, both NPC/edge: (1) **NPC melee/missile
  `attackHitBonus.<type>.adjustment` Modifier injection** (`actor.js:3669`) —
  prior coverage exercised only a *test-local reimplementation*
  (`buildNPCAttackTerms` in `active-effects.test.js`), not the real path; (2)
  the **`Roll.validate(toHit) === false` early-return** (`actor.js:3634`) —
  unit-untested because the shared Roll mock's `validate` returns `true`
  unconditionally. +2 Vitest (`adapter-weapon-attack.test.js`): a `new
  DCCActor()` flipped to NPC (mirroring `createNPC`) with `melee.adjustment:
  3` → the captured `createRoll` terms carry exactly one Modifier term
  (formula 3), the zero missile adjustment adds none; and a weapon with an
  invalid `toHit` + a forced `Roll.validate=()=>false` → `rollToHit` returns
  `{ rolled: false, formula }`, `logDispatch` still fired (it precedes the
  gate), `createRoll` never called. +1 Playwright (`adapter-dispatch.spec.js`
  `rollWeaponAttack`): a **live** NPC with a `+50` melee adjustment casts a
  real attack and the `isToHit` card's `rolls[0].total >= 51` (only reachable
  if the +50 reached the live roll). **No production change — pure coverage
  backfill.** **1402 Vitest** (was 1400, +2). **181 Playwright passed**, zero
  failures (was 180, +1). **Test-coverage-backfill arc COMPLETE** (sessions
  26–31): every PR #720 severity-≥6 coverage gap is now closed or
  found-stale.

- **2026-06-02 — Phase 7 session 30: `terms[N]` two-pass-divergence boundary
  guard (PR #720 test-coverage gap; test-coverage-backfill arc).**
  Investigation first re-scoped the gap: the `dcc.modifyAttackRollTerms`
  post-hook re-read is already well covered — `hookTermsToBonuses` has direct
  unit tests (translate-Modifier / skip-non-Modifier / empty), plus the live
  `terms[0]` die-bump (`adapter-weapon-attack.test.js:588`) and the appended-
  Modifier→`libResult.bonuses` test (507). The one genuinely-uncovered case is
  the **documented boundary** (`attack-input.mjs:139`): an **in-place mutation
  of an existing `terms[N]` (N>0)** is captured by *neither* the `terms[0]`
  die re-read *nor* the appended-Modifier→bonus slice — it flows through the
  Foundry Roll natively (chat total stays authoritative) and surfaces only as
  a divergence, never as a `libResult` bonus. Tim chose to add the guard
  (over skipping). +1 Vitest (`adapter-weapon-attack.test.js`): a hook mutates
  the existing Compound to-hit term `terms[1].formula` in place (asserting it
  mutated a real Compound + appended nothing, so the test exercises the real
  path) → `libResult.die` unchanged (`d20`) + `libResult.bonuses` `[]`. +1
  Playwright (`adapter-dispatch.spec.js`, `rollWeaponAttack`): the same in
  **live** Foundry — a real `Hooks.on('dcc.modifyAttackRollTerms')` listener
  mutates `terms[1]` to `+99` during a live attack, then asserts the chat
  `libResult` carries no hook bonus + unchanged die AND the Foundry roll total
  **exceeds** `libResult.total` (the `+99` reached Foundry but not the lib —
  the divergence the boundary produces). **No production change — pure
  coverage backfill of an intentional, documented boundary.** **1400 Vitest**
  (was 1399, +1). **180 Playwright passed**, zero failures (was 179, +1).

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

**Design calls — ALL CLOSED, section drained.** The five review-flagged
design calls (spellburn dialog-ordering, spellburn floor 0-vs-1, damage
`_total` clamp divergence, error boundaries around `_xxxViaAdapter`,
`createFoundryRoller` delete-or-wire) were all resolved in Phase 7
sessions 16–20. Full rationale lives in those Recent-slices / phase-7
archive entries.

**Open resilience / cleanup items:**

- ~~**Programmatic PC creation produces inconsistent class config.**
  `Actor.create({ system: { class: { className: 'Wizard' } } })` doesn't
  set `spellCheckAbility`, `details.sheetClass`, save `classBonus`, crit
  / luck die, etc. — real users get these from the level-change dialog.~~
  **DOCUMENTED 2026-06-02 (Phase 7 session 33).** New dev guide
  `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` lays out the three population
  mechanisms (sheet-open `applyClassDefaults`, the level-change dialog's
  compendium-driven `actor.update`, and the Phase-6 lib-progression
  registry consumed at roll time), what a bare `Actor.create()` misses,
  the quick-PC / fixture guidance, and the content-free-world caveat.
  Cross-linked from `EXTENSION_API.md` (`registerClassProgression`),
  `CLASS_DECOMPOSITION.md` §3.3/§3.5 (also refreshed §3.5 from "Planned"
  to "Shipped" + §3.3's stale "once Phase 6 wires" overlap note), and
  `docs/dev/README.md`. The remaining engineering option (a "quick PC"
  helper that drives the dialog / sets the fields) stays unbuilt by
  design — no consumer needs it; the doc records the dependency so any
  future tooling knows what to populate.

**Legacy decommission — COMPLETE (2026-06-02; arc ran 2026-05-31 → 06-02).**
Goal (achieved): delete every surviving `_xxxLegacy` roll branch so the
public dispatchers are single-path through the adapter, per the
legacy-branch-retirement principle (decision #7). Group D had already
retired attack / crit / fumble / damage; the spell-check wrapper went in
session 16. The ability/save/init/skill arc then landed across five slices:
step 1 roll-under (session 21), step 2 modifier dialog (22), step 3
check-penalty (23), step 4 description-only skill items (24), step 5 the
batch delete (25) — plus the session-20 fail-loud error-boundary
prerequisite. **No `_xxxLegacy` roll body survives anywhere in the system;
every public roll dispatcher is single-path through the adapter**, retaining
only the `options.rollUnder` (`rollAbilityCheck`) and `!hasDie`
(`rollSkillCheck`) *adapter* branches. `_buildSkillCheckLegacyTerms` →
renamed `_buildSkillCheckRollTerms` (still backs the skill-table + dialog
adapter routes). Vitest + live e2e retirement guards lock it in. Full
per-session detail in Recent slices (sessions 24–25) + the
[phase-7 archive](dev/progress/phase-7.md) (sessions 19–23). The standing
lib-fix rule (any lib-capability gap → `dcc-core-lib` PR first, then
`npm run sync-core-lib`) applied throughout; steps 1–5 needed none — all
pure adapter-side wiring.

**Open test coverage gaps (pr-test-analyzer severity ≥ 6):**

- ~~`renderDisapprovalRoll` — no unit/integration test (only transitively
  via the cleric disapproval browser-test).~~ **CLOSED 2026-06-02 (Phase 7
  session 27).** `chat-renderer-emit.test.js` covers `renderDisapprovalRoll`
  + the sibling `renderMercurialEffect` (+16 Vitest) + a live-Foundry e2e
  probe runs the deployed renderers against the real `Roll`/`ChatMessage`.
- ~~`promptSpellburnCommitment` + `clampBurn` mocked across every caller;
  `roll-dialog.mjs` has no direct coverage.~~ **STALE — entry obsolete
  (verified 2026-06-02, session 27 follow-up).** Both helpers were *retired*
  in the Q7-phase2 spellburn-dialog unification (they no longer exist in
  `roll-dialog.mjs`; its only exports are `promptRollModifierDialog` +
  `parseRollIntoDieAndModifier`). `roll-dialog.mjs` already has **direct**
  coverage: `module/__tests__/adapter-roll-dialog.test.js` exercises
  `parseRollIntoDieAndModifier` (die extraction, signed/positive sums,
  no-die, falsy-terms, no-formula-field) and `promptRollModifierDialog`
  (terms+rollData forwarding, user-cancel → null, throw → null, default
  rollData, the spellburn descriptor incl. the negative-burn → 0 clamp that
  superseded `clampBurn`). No work needed.
- ~~`onSpellLost` tested as a direct callback but never verified to fire
  during a real adapter cast.~~ **CLOSED 2026-06-02 (Phase 7 session 29).**
  New e2e in `adapter-dispatch.spec.js` drives a real wizard cast engineered
  to deterministically fail-to-lost (`config.inheritActionDie:false` + d3 die
  + INT 3 + level 1 → total ≤ 1 → tier 'lost') and polls the spell item until
  `system.lost` flips true; cleans up its actor afterward.
- ~~Two-pass divergence: only the `terms[0]` die-bump case is covered;
  `terms[N]` Compound / Modifier in-place mutations are not.~~ **CLOSED
  2026-06-02 (Phase 7 session 30).** Re-scoped: `hookTermsToBonuses` +
  terms[0]-bump + appended-Modifier→bonus were already covered; the one
  genuine gap was the *documented boundary* that an in-place mutation of an
  existing `terms[N]` (N>0) reaches Foundry but NOT `libResult`. +1 Vitest
  (in-place `terms[1]` mutation → die unchanged + bonuses `[]`) + 1 live
  Playwright (real hook → Foundry total > libResult.total divergence).
- `_canRouteAttackViaAdapter` untested branches (dice-bearing
  `weapon.toHit`, `twoWeaponSecondary`, settings try/catch). Gate retired
  at session 15 — assertions moved to the single-path body.
- ~~`_rollToHitViaAdapter` NPC `attackHitBonus.melee.adjustment` Modifier
  injection (PC-only tests) + the `Roll.validate(toHit) === false`
  early-return path.~~ **CLOSED 2026-06-02 (Phase 7 session 31).** +2 Vitest
  (real NPC `rollToHit` adjustment injection; forced-`Roll.validate=false`
  early-return) + 1 live Playwright (NPC `+50` adjustment → attack total
  ≥ 51). The prior NPC coverage was a test-local reimplementation, not the
  real path.
- ~~`__mocks__/dcc-roll.js` declares `createRoll` as `static async` while
  production is sync; tests install local sync stubs — fix the shared
  mock, delete the stubs.~~ **CLOSED 2026-06-02 (Phase 7 session 28).** Mock
  `createRoll` made sync (matches production); one shared
  `withSyncCreateRoll` helper exported from the mock replaced the duplicated
  per-file copies (footprint was 2 files, not the estimated 13). +4 Vitest
  parity guards + 1 e2e (production createRoll stays sync-declared).
- ~~Surviving data-driven migration branches (`migrateActorData` /
  `migrateItemData`: V14 AE numeric-mode → string-type converter,
  `sheetClass`-from-localized-`className`, `critRange` / `disapproval`
  string→number, `luckyRoll` → `birthAugur`, default alignment) have no
  fixture tests.~~ **CLOSED 2026-06-02 (Phase 7 session 26).** Test-only
  export of the two `const` helpers + `migrations-data-driven.test.js` (one
  fixture per branch, full AE mode map, +34 Vitest) + a live-Foundry e2e
  probe. The #739 speed-base seed and owned-item recursion are covered too.

**Documentation / comment hygiene — ALL CLOSED 2026-06-02 (Phase 7 session 32).**

- ~~`ARCHITECTURE_REIMAGINED.md` §7 Phase-1 bullets reference lib APIs
  `rollCheck('ability:str', …)` / `resolveSkillCheck(…)` /
  `rollInitiative(…)` but the adapter landed `rollAbilityCheck` /
  `rollSavingThrow` / `rollCheck` (subsumed skill + init). Annotate with
  the landed names.~~ **DONE (session 32).** Added a *Landed names*
  annotation block; no `resolveSkillCheck`/`rollInitiative` symbol exists
  (both subsumed by generic `rollCheck`).
- ~~`ARCHITECTURE_REIMAGINED.md` §2.7 file-size snapshot is pinned to
  branch start; prefix with `(Snapshot at main @ 2337ec0)`.~~ **DONE
  (session 32).** Verified the figures are the exact line counts at
  `2337ec0`.
- ~~`actor.js` disapproval-chat-ordering comment overstates ordering
  guarantees (`onDisapprovalIncreased` fires fire-and-forget inside
  pass 2). Soften the claim or `await` the chat-message creation.~~
  **DONE (session 32).** Softened — only the two awaited messages are
  ordered; the EMOTE is fire-and-forget so its position isn't guaranteed
  (awaiting would require changing the lib's non-awaiting callback
  protocol, so soften was the right call).
- ~~`_getInitiativeRollViaAdapter` accepts an `options = {}` param it never
  reads — drop, or document "reserved for future modifier-dialog bridge."~~
  **DONE (session 32).** Dropped (the dialog bridge already lives in the
  sibling `_getInitiativeRollWithDialogViaAdapter`, so there's nothing to
  reserve for).

**Performance (below measurement threshold; document only):**

- ~~`getActionDice` called 3× per `_rollToHitViaAdapter` — hoist to a
  single `const`.~~ **DONE 2026-06-02 (Phase 7 session 34).** Hoisted to
  one `const actionDicePresets`; the [0] formula feeds `die`, the term
  `presets`, and `buildAttackInput` (new optional `actorActionDiceFormula`
  param). +1 Vitest hoist guard (`getActionDice` called exactly once).
- ~~`items.find` called 2× per `_getInitiativeRollViaAdapter` — fold into
  one iteration.~~ **DONE 2026-06-02 (Phase 7 session 34).** Both init
  methods (`_getInitiativeRollViaAdapter` + the dialog sibling) now scan
  `this.items` in one `for…of` pass, apply order preserved (custom-init-die
  weapon still wins over two-handed). +1 Vitest fold-order guard + 1 live
  Playwright probe.
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

**Legacy decommission arc — COMPLETE (2026-06-02, sessions 21–25 + the
session-20 error-boundary prerequisite).** All five steps landed: roll-under
(21), modifier dialog (22), check-penalty (23), description-only skill items
(24), and the batch delete (25). No `_xxxLegacy` roll body survives anywhere
in the system; every public roll dispatcher is single-path through the
adapter (with the `options.rollUnder` and `!hasDie` *adapter* branches the
respective dispatchers retain). Vitest + e2e retirement guards lock it in.
The user-directed priority that opened this arc is fully discharged.

**Test-coverage backfill arc — IN PROGRESS 2026-06-02 (sessions 26–27).**
**Test-coverage-backfill arc COMPLETE (sessions 26–31, 2026-06-02).** Every
PR #720 severity-≥6 coverage gap is now closed or found-stale. Sessions:
26 (data-driven migration branches), 27 (`renderDisapprovalRoll` +
`renderMercurialEffect`), 28 (`dcc-roll.js` mock async/sync + shared
`withSyncCreateRoll`), 29 (`onSpellLost` real-cast + the forceCrit dice-flake
fix), 30 (`terms[N]` two-pass-divergence boundary guard), 31 (NPC `rollToHit`
adjustment injection + `Roll.validate` early-return). The `roll-dialog.mjs`
gap was found stale (helpers retired + already covered).

**Doc/comment-hygiene arc — the *Documentation / comment hygiene* subsection
is drained (session 32, 2026-06-02).** All four items closed: §7 *Landed
names* annotation, §2.7 `main @ 2337ec0` snapshot pin, the softened
disapproval-chat-ordering comment, and the dropped unused
`_getInitiativeRollViaAdapter` `options` param. **Next arc** (none on a
critical path): an Appendix-A file-shrinkage arc — the two below-threshold
perf items (hoist `getActionDice`, fold the `items.find` double-iteration)
and the programmatic-PC-creation doc item are now both done (sessions 34
and 33 respectively).
- ~~the data-driven migration branches~~ **done (session 26).**
- ~~`renderDisapprovalRoll`~~ **done (session 27; `renderMercurialEffect`
  covered too).**
- ~~`__mocks__/dcc-roll.js` async/sync mismatch~~ **done (session 28; shared
  `withSyncCreateRoll`; footprint was 2 files, not 13).**
- ~~`onSpellLost` during a real cast~~ **done (session 29; deterministic
  d3+low-INT fail-to-lost, polled for `system.lost`).**
- ~~`terms[N]` two-pass divergence~~ **done (session 30; in-place
  `terms[N>0]` mutation boundary guard — Vitest + live e2e).**
- ~~`roll-dialog.mjs` direct coverage~~ **STALE — the named helpers
  (`promptSpellburnCommitment`/`clampBurn`) were retired and
  `adapter-roll-dialog.test.js` already covers both current exports
  (verified session 27 follow-up).**
- ~~*Doc / comment hygiene* (`ARCHITECTURE_REIMAGINED.md` §7 / §2.7 stale
  refs, disapproval-chat-ordering comment, the unused
  `_getInitiativeRollViaAdapter` `options` param).~~ **done (session 32;
  all four items closed).**
- ~~*Programmatic-PC-creation* documentation item.~~ **done (session 33;
  new `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` + cross-links + §3.5/§3.3
  refresh).**
- ~~The below-threshold perf "document only" items (hoist `getActionDice`,
  fold the `_getInitiativeRollViaAdapter` `items.find` double-iteration).~~
  **done (session 34; both items drained — hoist + single-pass fold, Vitest
  guards + a live Playwright order probe).**
- The remaining candidate: an Appendix-A file-shrinkage arc (`actor.js` /
  `actor-sheet.js` / `item.js` / `config.js`) — each a multi-session project,
  not a slice.
See the PR #720 backlog subsections above for the itemized lists.

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
