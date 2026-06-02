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
The **test-coverage-backfill arc** is underway (sessions 26–28): session 26
closed the *always-run* data-driven migration-branch gap (the **V14-critical
ActiveEffect numeric-mode → string-type converter** + `luckyRoll`/alignment/
`critRange`/`disapproval`/`sheetClass`/#739-speed/owned-item branches);
session 27 closed the two deterministic chat-emit renderers
`renderDisapprovalRoll` + `renderMercurialEffect`; **session 28** (full detail
in *Recent slices*) fixed the `__mocks__/dcc-roll.js` async/sync mismatch —
the mock's `createRoll` now matches production's sync declaration, with one
shared `withSyncCreateRoll` helper replacing the duplicated per-file sync
overrides (footprint was 2 files, not the backlog's estimated 13). All three
are **pure test-infra / coverage backfill — no production behavior change, no
lib change.** Remaining gaps (`onSpellLost` real-cast e2e, `terms[N]`
two-pass, the NPC `_rollToHitViaAdapter` branches) are in progress with Tim
engaged. Repo green: **1399 Vitest** / **178 Playwright e2e passed**, zero
failures (6.2-min full suite).

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

- **2026-06-02 — Phase 7 session 28: `__mocks__/dcc-roll.js` async/sync
  parity fix + shared `withSyncCreateRoll` helper (PR #720 test-coverage gap;
  test-coverage-backfill arc).** The shared DCCRoll mock declared
  `createRoll` as `static async` while **production** `module/dcc-roll.js:17`
  is a *sync-declared* function (returns the Roll directly). Adapter dispatch
  paths that consume `createRoll(...)` synchronously (`rollWeaponAttack`'s
  damage block: `damageRoll = DCCRoll.createRoll(...)`, no `await`) therefore
  saw a Promise under test, so each affected test installed its own local
  sync override. **Fix:** made the mock's `createRoll` sync (matching
  production) and added one **shared** `withSyncCreateRoll(rollFactory)`
  helper exported from the mock — it save/replace/restores
  `game.dcc.DCCRoll.createRoll` with a sync `vi.fn` returning the factory's
  roll (forwards args). Deleted the duplicated per-file `withSyncCreateRoll`
  copies in `adapter-weapon-crit-fumble.test.js` +
  `adapter-weapon-damage.test.js` and folded the one inline override
  (damage's "trailing flavor bracket" test) onto the shared helper; both
  files' now-stale "we don't touch the shared mock" docstrings refreshed.
  **Scope reality check:** the backlog estimated "13+ files"; the actual
  duplicated-stub footprint was **2 files** (the other createRoll references
  are ordinary mock uses), so the change is contained. **No production
  change — test-infra only.** +4 Vitest (`dcc-roll.test.js`: production +
  mock `createRoll` are sync-declared `constructor.name === 'Function'`, not
  `'AsyncFunction'`; `withSyncCreateRoll` installs a sync override returning
  the factory roll + restores; forwards the createRoll args). +1 Playwright
  (`extension-api.spec.js`: the deployed `game.dcc.DCCRoll.createRoll` is a
  sync-declared function — locks the production half of the parity contract
  live). **1399 Vitest** (was 1395, +4). **178 Playwright passed**, zero
  failures (was 177, +1; 6.2-min full suite).

- **2026-06-02 — Phase 7 session 27: `renderDisapprovalRoll` +
  `renderMercurialEffect` direct coverage (PR #720 test-coverage gap;
  test-coverage-backfill arc).** Backfilled unit coverage of the two
  deterministic chat-emit renderers in `module/adapter/chat-renderer.mjs`,
  previously exercised only *transitively* (the cleric-disapproval /
  mercurial browser tests). Both build a `${Math.max(1, value)}d1` `Roll`
  to carry the lib's already-rolled value through Foundry's chat pipeline,
  then post via `roll.toMessage(data, { create: false })` →
  `ChatMessage.create`. New `module/__tests__/chat-renderer-emit.test.js`
  (**+16 Vitest**): `renderDisapprovalRoll` — `${roll}d1` formula, `{ create:
  false }`, em-dash flavor join (with + without description), the
  `Disapproval`/`isDisapproval`/`libDisapproval` flags, the `max(1,0)`→`1d1`
  clamp for a zero/missing roll, returned ChatMessage; `renderMercurialEffect`
  — falsy-effect no-op (returns undefined, posts nothing), `${rollValue}d1`,
  flavor join, content-only-when-description, the `MercurialMagic` flags incl.
  `ItemId` + `libMercurial`, `displayOnCast` default-true / explicit-false /
  missing-spellItem, and the rollValue clamp. Foundry globals (`Roll` /
  `ChatMessage` / `game.i18n`) stubbed per-test in the
  `spell-check-processor.test.js` style; the `Roll` stub records each
  constructed formula and `toMessage` returns its data verbatim so the
  assertions read the exact flags/flavor/content handed to
  `ChatMessage.create`. Kept `chat-renderer.test.js`'s stated pure-helper-only
  scope intact — new emit tests live in a separate file. +1 Playwright
  (`extension-api.spec.js`): runs the **deployed** renderers against the live
  `Roll` + `ChatMessage` on a throwaway Player (both created messages + the
  actor deleted afterward), asserting the real message's flags (`getFlag`),
  the `rolls[0].total` = the deterministic `${N}d1` value, the joined flavor,
  and the description content — the highest-value end-to-end check for thin
  chat-pipeline wrappers. **No behavior change — pure test backfill. No lib
  change.** **1395 Vitest** (was 1379, +16). **177 Playwright passed**, zero
  failures (was 176, +1; 6.4-min full suite).

- **2026-06-02 — Phase 7 session 26: data-driven migration coverage
  (PR #720 test-coverage gap, first post-legacy-decom slice).** Backfilled
  unit coverage of the *always-run* (non-version-gated) data-driven branches
  in `migrateActorData` / `migrateItemData` — before this they were only
  exercised when Foundry booted a real world, and the **V14-critical
  ActiveEffect numeric-mode → string-type converter** had no isolated test.
  Test-only export of the two internal `const` helpers from `migrations.js`
  (not Foundry-facing — not on `game.dcc`/`DCCActor`; mirrors how
  `classifyMigrationDecision` / `migrationOutcome` are already exported for
  testing). New `module/__tests__/migrations-data-driven.test.js` (**+34
  Vitest**): one fixture per branch — the full AE mode→type map (0→custom …
  5→override) + unknown-mode→`add` fallback + no-op-when-string-typed +
  no-op-when-mode-and-type-coexist + `deepClone`-fallback for an effect
  lacking `toObject()`; `luckyRoll`→`birthAugur`; default alignment;
  `critRange`/`disapproval` string→number incl. unparseable→20/1 fallbacks;
  `sheetClass`-from-`className` (English-key / locale-match via stubbed
  `localize` / third-party-fallback via stubbed `fetch`); the #739
  speed-base seed (seeds from displayed value when base is the 30 default
  *or* unset, preserves a custom base, no-ops when value==base); owned-item
  recursion. Mocks `foundry.utils` (`deepClone`/`isEmpty`/`mergeObject`) +
  `game.i18n` per-test in the `check-migrations.test.js` style. **No
  behavior change — pure test backfill.** +1 Playwright
  (`extension-api.spec.js`: imports the live-served `migrations.js`, runs
  the deployed `migrateItemData`/`migrateActorData` against the REAL
  `foundry.utils` + live `game.i18n` on synthetic legacy objects — a
  multi-branch actor pass asserting AE mode 5→`override`, `luckyRoll`→
  `birthAugur`, `critRange '18'`→18; synthetic objects, not live documents,
  so the legacy shapes the converter targets are reproduced
  deterministically rather than depending on current v14 AE schema
  defaults; no `migrateWorld` mutation). **1379 Vitest** (was 1345, +34).
  **176 Playwright passed**, zero failures (was 175, +1; 6.0-min full
  suite).

- **2026-06-02 — Phase 7 session 25: the batch delete (legacy-decom step
  5 of 5 — arc COMPLETE).** Deleted the four now-dead `_xxxLegacy` roll
  bodies (`_rollAbilityCheckLegacy`, `_rollSavingThrowLegacy`,
  `_getInitiativeRollLegacy`, `_rollSkillCheckLegacy` — ~290 lines), all
  fully unreachable after steps 1–4 moved every gate into the adapter.
  Every public roll dispatcher is now **single-path through the adapter**.
  The four dispatchers were already collapsed in prior sessions (sessions
  21–24 each flipped its last gate), so this slice is the deletion + the
  surviving-branch verification: `rollAbilityCheck` keeps its
  `options.rollUnder` → `_rollLuckCheckViaAdapter` branch; `rollSkillCheck`
  keeps its three-way `!hasDie` → `_emitSkillDescriptionViaAdapter` /
  `_skillTableViaAdapter` / `_rollSkillCheckViaAdapter` routing (both are
  *adapter* branches, not legacy gates). **Rename, not delete:** the shared
  `_buildSkillCheckLegacyTerms` term-descriptor builder → `_buildSkillCheckRollTerms`
  — it still backs `_skillTableViaAdapter` + `_rollSkillCheckViaAdapter`'s
  dialog branch (the "Legacy" named the DCCRoll term-descriptor *format*
  the Foundry dialog consumes, not a code path), so deleting it was never
  on the table; the rename drops the misleading token now its last legacy
  caller is gone. Cleaned ~12 stale doc/comment references to the deleted
  methods across `actor.js` (dispatcher JSDocs, the check-penalty / dialog
  provenance comments softened to "former legacy", the unknown-skill guard
  comment) + 5 test-file comments. No lib change. `actor.js` shed ~218 net
  lines (441 touched). +2 Vitest retirement guards (`actor.test.js`: all
  four `_xxxLegacy` symbols `undefined` on the prototype + dispatchers/adapter
  routes present; old term-builder name retired + renamed one present). +1
  Playwright live guard (`adapter-dispatch.spec.js`, beside the D1 guard:
  the four legacy bodies + old term-builder absent from the live
  prototype, dispatchers + `_emitSkillDescriptionViaAdapter` +
  `_buildSkillCheckRollTerms` present). **1345 Vitest** (was 1343, +2).
  **175 Playwright passed**, zero failures (was 174, +1; 6.0-min full
  suite). **Legacy-decom arc complete** — no `_xxxLegacy` roll body
  survives anywhere in the system.

- **2026-06-02 — Phase 7 session 24: description-only skill items in the
  adapter (legacy-decom step 4 of 5).** The last gate keeping
  `_rollSkillCheckLegacy` reachable. A skill item with
  `useDie`/`useValue`/`useAbility`/`useLevel` all off resolves to
  `!hasDie` (built-in slots + rollable items always inherit the action
  die, so this is reached *only* for skill items with nothing to roll) and
  emits a *description chat card*, not a roll. New private
  `_emitSkillDescriptionViaAdapter(skillId, resolved)` logs
  `logDispatch('rollSkillCheck', 'adapter', { skillId, mode: 'description' })`
  then reproduces the legacy `_rollSkillCheckLegacy` early-return branch
  **exactly**: a `<div class="skill-description">…</div>` content, flavor
  `${label}${abilityLabel}`, flags `SkillCheck`/`ItemId`/`SkillId`/
  `isSkillCheck`, and `system: { skillId, skillDescription }` — and emits
  **nothing** when the item carries no description value (faithful to the
  legacy guard). It's a **pure Foundry-side chat emit, no lib round-trip**
  (a description-only skill has no formula to hand the lib); the
  `mode: 'description'` dispatch field distinguishes it from the rolling
  adapter routes (`_rollSkillCheckViaAdapter` / `_skillTableViaAdapter`).
  **Why the legacy roll branch was provably dead:** `!hasDie` ⟹ a skill
  *item* (not a built-in slot) with `useValue`/`useAbility`/`useLevel` all
  off ⟹ `_buildSkillCheckLegacyTerms` produces no die/value/level/deed
  terms, and the check-penalty term can't fire on the synthesized
  skill-item object (no `config`, and `skillId` is the item name) — so the
  legacy method's only reachable behavior from this gate was the
  description emit. **Gate flip:** `rollSkillCheck`'s `!resolved.hasDie`
  branch now calls `_emitSkillDescriptionViaAdapter`; `_rollSkillCheckLegacy`
  is fully unreachable, joining the three already-dead bodies for the
  step-5 batch delete. No lib change (pure adapter wiring — no formula
  crosses the lib boundary). +2 Vitest (`adapter-skill-check.test.js`:
  description-only item → adapter posts the card with the exact
  content/flags/system; description-*less* item → no chat message) — the
  former replaces the old "routes to the legacy path" assertion. +1
  Playwright new + 1 flipped (`adapter-dispatch.spec.js`: the
  `description-only skill item (no die)` test flips `→ legacy` to
  `→ adapter` + `mode: 'description'` and now asserts the live card's
  flags/content + that it carries no `libResult` and no rolls; a new
  description-*less* item case asserts adapter dispatch with no chat card
  posted). **1343 Vitest** (was 1342, +1 net). **174 Playwright passed**,
  zero failures (was 173, +1; 6.2-min full suite).

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

**Legacy decommission arc — COMPLETE (2026-06-02, sessions 21–25 + the
session-20 error-boundary prerequisite).** All five steps landed: roll-under
(21), modifier dialog (22), check-penalty (23), description-only skill items
(24), and the batch delete (25). No `_xxxLegacy` roll body survives anywhere
in the system; every public roll dispatcher is single-path through the
adapter (with the `options.rollUnder` and `!hasDie` *adapter* branches the
respective dispatchers retain). Vitest + e2e retirement guards lock it in.
The user-directed priority that opened this arc is fully discharged.

**Test-coverage backfill arc — IN PROGRESS 2026-06-02 (sessions 26–27).**
Sessions 26–28 cleared the data-driven migration branches, the two chat
renderers, and the `dcc-roll.js` mock async/sync mismatch. Tim is engaged for
the remaining (trickier) gaps; agreed approaches noted inline:
- `onSpellLost` verified to fire during a real adapter cast — **approach
  agreed:** force a spell-lost outcome in e2e by setting the caster's action
  die to a tiny die (e.g. `1d2`/`1d1`) so the check fails low.
- `terms[N]` two-pass divergence (Compound / Modifier in-place mutations;
  only the `terms[0]` die-bump case is covered) — Tim: "yes, just be careful"
  (avoid a test that passes without exercising the real two-pass path).
- `_rollToHitViaAdapter` NPC `attackHitBonus.melee.adjustment` Modifier
  injection + the `Roll.validate(toHit) === false` early-return path.
- ~~the data-driven migration branches~~ **done (session 26).**
- ~~`renderDisapprovalRoll`~~ **done (session 27; `renderMercurialEffect`
  covered too).**
- ~~`__mocks__/dcc-roll.js` async/sync mismatch~~ **done (session 28; shared
  `withSyncCreateRoll`; footprint was 2 files, not 13).**
- ~~`roll-dialog.mjs` direct coverage~~ **STALE — the named helpers
  (`promptSpellburnCommitment`/`clampBurn`) were retired and
  `adapter-roll-dialog.test.js` already covers both current exports
  (verified session 27 follow-up).**
- *Doc / comment hygiene* (`ARCHITECTURE_REIMAGINED.md` §7 / §2.7 stale
  refs, disapproval-chat-ordering comment, the unused
  `_getInitiativeRollViaAdapter` `options` param).
- *Programmatic-PC-creation* documentation item.
- Or an Appendix-A file-shrinkage arc (`actor.js` / `actor-sheet.js` /
  `item.js` / `config.js`) — each a multi-session project, not a slice.
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
