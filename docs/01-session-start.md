# Session Start Prompt — `refactor/dcc-core-lib-adapter`

> Paste the block below into a fresh Claude Code session to resume work
> on the refactor. Keep this file in sync with `docs/00-progress.md` —
> if the current phase or blockers change there, update this prompt too.

---

We're resuming a refactor on the DCC FoundryVTT system. Working dir:
`/Users/timwhite/FoundryVTT-Next/Data/systems/dcc` (git worktree,
branch `refactor/dcc-core-lib-adapter`). Run `nvm use` first — `.nvmrc`
pins Node 24.

**Read these first, in order:**
1. `docs/00-progress.md` — rolling handoff log. Update at session end.
2. `docs/dev/ARCHITECTURE_REIMAGINED.md §7` — the 7-phase plan.
3. `docs/dev/EXTENSION_API.md` — what sibling modules consume (stable /
   internal / dead).
4. `docs/dev/TESTING.md` — testing tiers; `#browser-tests-playwright`
   covers the e2e launch recipe (fvtt CLI installPath / dataPath /
   Node 24 / world name gotchas).
5. `/Users/timwhite/WebstormProjects/dcc-core-lib/docs/MODIFIERS.md`
   — lib-side design doc for the tagged-union `RollModifier` type the
   adapter emits and consumes.

**Status:** **Phase 1 closed. Phase 2 CLOSED 2026-04-18. Phase 3
sessions 1 (dialog-adapter), 2 (first attack-migration slice), 3
(hook-translation bridge), and 4 (long-range dice-chain translation)
all CLOSED 2026-04-18. Phase 3 session 5 is the active work.** Phase
2 close-out pinned two decisions: (a) `game.dcc.processSpellCheck`
is permanent stable API — no deprecation, no shim, route migration
is per-call-site and incremental; (b) `_runLegacyPatronTaint` is
permanent adapter infrastructure — RAW alignment deferred to
backlog. Phase 3 session 1 closed open question #6 via a
dialog-adapter (`module/adapter/roll-dialog.mjs` +
`promptSpellburnCommitment`). Phase 3 session 2 split
`DCCActor.rollToHit` into a dispatcher + `_rollToHitLegacy` +
`_rollToHitViaAdapter`; the adapter path routes the simplest-weapon
happy-path through the lib's `makeAttackRoll` while preserving
`dcc.modifyAttackRollTerms` and the Foundry chat render path. Phase
3 session 3 added `hookTermsToBonuses` in
`module/adapter/attack-input.mjs` — pushed `Modifier` terms with
pure signed-integer formulas flow into `attackInput.bonuses` and
surface as `libResult.bonuses` + an aggregate `{source:'bonuses',…}`
entry in `libResult.modifiers`. Phase 3 session 4 closed the
long-range gap: `_rollToHitViaAdapter` re-reads `terms[0].formula`
post-hook and assigns it to `attackInput.actionDie` via
`normalizeLibDie`, so dcc-qol's `DiceChain.bumpDie` in-place
mutation is reflected in `libResult.die`. See `docs/00-progress.md`
for full rationale.

**Phase 2 + 3 sessions 1–4 infrastructure session 5 builds on:**

- `DCCActor.rollSpellCheck` + `DCCActor.rollToHit` are both
  dispatchers. The two-pass formula/evaluate pattern (spell side)
  and the adapter-path-with-legacy-roll pattern (attack side, session
  2) are the templates for future slices.
- Adapter modules: `module/adapter/{character-accessors,
  foundry-roller, chat-renderer, spell-input, spell-events,
  attack-input, attack-events, roll-dialog, debug}.mjs`. Session 2
  added `attack-input.mjs` (buildAttackInput) + `attack-events.mjs`
  (stub — combat events wire later). Session 3 extended
  `attack-input.mjs` with `hookTermsToBonuses` (translator for hook-
  pushed Modifier terms). Session 4 exported `normalizeLibDie` so
  the dispatcher can normalize post-hook `terms[0].formula` mutations.
- `module/adapter/roll-dialog.mjs` (added session 1) currently
  exports `promptSpellburnCommitment` only. When the attack /
  damage dialog needs its own prompt, **extend this file** — don't
  add a parallel `attack-dialog.mjs`. Open question #7 tracks the
  eventual generalization into a full roll-modifier dialog.
- `@moonloch/dcc-core-lib@0.4.0` vendored at
  `module/vendor/dcc-core-lib/`. Wave-1 modifier redesign covers
  checks / skills / dice / cleric; **combat subsystems still use
  `LegacyRollModifier` pending wave 3.** Session 2's attack bridge
  emits `LegacyRollModifier[]` via `makeAttackRoll`'s
  `appliedModifiers`; downstream consumers surface it through
  `flags['dcc.libResult'].modifiers`. Session 3 also surfaces the
  per-bonus breakdown as `flags['dcc.libResult'].bonuses` so
  hook-injected penalties retain their labels. Session 4 keeps
  `flags['dcc.libResult'].die` in sync with the Foundry-evaluated
  die when hooks bump `terms[0].formula` in place.
- `module/adapter/debug.mjs` + `logDispatch('rollXxx',
  'adapter'|'legacy', details)` is PERMANENT. Session 2 wired
  `logDispatch('rollWeaponAttack', ...)` in both branches. Every
  future `_xxxViaAdapter` / `_xxxLegacy` must do the same.
- **Baseline:** 811 Vitest tests pass (808 at session 3 close + 3
  session-4 tests: `normalizeLibDie` unit, post-hook bump round-trip,
  no-op when hook leaves `terms[0]` alone) + 26 Playwright dispatch
  tests pass against live v14 Foundry (verified 2026-04-18 at session
  2 close; sessions 3 and 4 did not change dispatch behavior so the
  suite was not re-run).

**This session's goal:** **Phase 3 session 5 — next attack-migration
slice.**

Sessions 2–4 landed the simplest-weapon happy-path through the
adapter, plus the full hook bridge: pushed `Modifier` terms (session
3) and in-place action-die mutations (session 4) both flow through
to the lib's `AttackInput`. Session 5 picks up one of the options in
`00-progress.md §Next steps` — leaning (d) start the damage / crit /
fumble migration off the now-stable attack-roll bridge, or (a)
broaden the happy-path gate (backstab is the smallest; the lib has
`isBackstab` / `getBackstabMultiplier`, but legacy treats backstab
as auto-crit, which is a design call). Other candidates: (b)
deed-die adapter path, (c) attack-modifier dialog (open question #7).

Phase 3 as a whole is the largest migration so far:
`rollWeaponAttack` → `makeAttackRoll` + `rollDamage` + `rollCritical`
+ `rollFumble`, with the interleaving crit-range-scaling, two-weapon
penalty, backstab multiplier, deed-die, and weapon-type logic all
needing the adapter bridge. The lib has every piece (`makeAttackRoll`,
`rollDamage`, `rollCritical`, `rollFumble`, `getTwoWeaponPenalty`,
`getBackstabMultiplier`) — the work is building the Foundry-side
adapter that feeds them, one slice at a time.

**Critical integration point:** `dcc.modifyAttackRollTerms` is
dcc-qol's main hook. It fires inside `_rollToHitViaAdapter` and again
inside `_rollToHitLegacy`, before each branch's Roll evaluates. Phase
3 must preserve this hook — sessions 3–4 fully bridged it for the
simplest-weapon adapter path: pushed `Modifier` terms reflect into
`attackInput.bonuses` (`libResult.bonuses` + the `{source:'bonuses',…}`
aggregate on `libResult.modifiers`), and in-place mutations of
`terms[0].formula` reflect into `attackInput.actionDie`
(`libResult.die`). dcc-qol's two active handlers
(`applyFiringIntoMeleePenalty`, `applyRangeChecksAndPenalties` at
`../../modules/dcc-qol/scripts/hooks/listeners.js:25-27`) are both
now observationally faithful through the adapter path.

### Session 11 slice — Phase 3, session 5 (next attack slice)

1. **Read first** — `docs/00-progress.md` (Phase 3 session 4 entry +
   Next steps options + Blockers / open questions),
   `docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 3`, `module/actor.js`
   `rollToHit` dispatcher (line ~2733), `_rollToHitViaAdapter` (line
   ~2787), `_rollToHitLegacy` (line ~2907), `module/adapter/
   attack-input.mjs` (`buildAttackInput`, `hookTermsToBonuses`,
   `normalizeLibDie`). Check `module/vendor/dcc-core-lib/VERSION.json`
   — if wave-3 lib support has landed, sync + refactor accordingly.

2. **Pick the session slice** (per `00-progress.md §Next steps`).
   Leaning (d) start the damage / crit / fumble migration: the
   attack-roll bridge is observationally faithful for every
   dcc-qol injection it sees, so the next chained call
   (`weapon.system.damage` → `rollDamage` from the lib) is the
   natural follow-on. The lib has `rollDamage` / `rollCritical` /
   `rollFumble` ready. Slice-able by tail — damage first, crit /
   fumble layered on after. Alternative: (a) backstab broadens the
   attack-roll gate using `isBackstab` / `getBackstabMultiplier`,
   but legacy treats backstab as auto-crit (see `rollToHit:2855`),
   which is a design call.

3. **Dispatch logging.** Every `_rollXxxViaAdapter` /
   `_rollXxxLegacy` must call `logDispatch` as first line
   (permanent infrastructure). Session 2 added weapon-attack
   branches; extend the Playwright spec to validate any new
   branches session 5 opens up (e.g. a `_rollDamageViaAdapter` /
   `_rollDamageLegacy` split).

4. **Integration testing.** Playwright against live v14 Foundry is
   the gold standard for dispatcher validation. The 26-test suite
   was last run green at session 2 close (2026-04-18). Sessions 3–4
   were observational only (no new dispatch branches, no new log
   lines), so the suite wasn't re-run; session 5 should re-run it
   before claiming complete if dispatch behavior changes.

Do NOT in session 11: touch data-model slimming (Phase 4) or sheet
composition (Phase 5). Do NOT break `dcc.modifyAttackRollTerms` — it
has external consumers.

**Before touching Phase 3 code, confirm the repo is green:**

- `npm test` — 811 Vitest tests + dice-gated integration. Final
  check before any commit.
- `npm run test:unit` — mock-only; runs in every environment.
- `npm run test:integration` — integration project. Skips if Foundry
  isn't detected (via `FOUNDRY_PATH`, `.foundry-dev/`, or
  `~/Applications/foundry-14`).
- **Dice-engine-gated tests** only run if `.foundry-dev/client/dice/`
  exists. `ls .foundry-dev/client/dice` — missing → run
  `npm run setup:foundry` once. Otherwise the dice cases **skip**
  (not fail); the status line shows `N passed | M skipped`.

**Browser tests (optional — dispatch spec already validated against
v14 as of 2026-04-18):** see `docs/dev/TESTING.md#browser-tests-playwright`
for the full recipe. TL;DR — with the fvtt CLI's `installPath` /
`dataPath` pointed at `foundry-14` / `FoundryVTT-Next` (verify via
`npx @foundryvtt/foundryvtt-cli configure view`):

```
nvm use 24
nohup npx @foundryvtt/foundryvtt-cli launch --world=v14 \
  >/tmp/foundry-v14.log 2>&1 & disown
cd browser-tests/e2e && npm test -- phase1-adapter-dispatch.spec.js
```

Close any manual Foundry browser tab first — a logged-in Gamemaster
disables the Playwright login and tests hang for 11 s each.

**Constraints for Phase 3 work:**

- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing —
  `dcc.modifyAttackRollTerms` is dcc-qol's primary integration point;
  `game.dcc.DCCRoll.cleanFormula` + `game.dcc.DiceChain.{bumpDie,
  calculateCritAdjustment, calculateProportionalCritRange}` are
  XCC's attack/crit scaffolding. Preserve all of it.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — the `git add .` sweeps untracked files; stash or `.gitignore`
  them first.

**Remaining open questions** (tracked in `00-progress.md`):
- #2 package-name discrepancy — resolved in spirit by vendoring, can
  be closed out.
- #3 dead `dcc.update` hook — coordinate with XCC maintainer before
  Phase 4.
- #4 stabilizing undocumented `game.dcc.*` pieces — **Phase 3 is when
  this matters**; formal stabilization should land alongside the
  first attack-migration session.
- ~~#5 patron-taint RAW alignment~~ — closed at Phase 2 close.
- ~~#6 spellburn dialog integration~~ — closed at Phase 3 session 1.
- #7 wizard adapter-path modifier-dialog coverage beyond Spellburn
  — revisit after attack/damage dialog slice generalizes the
  `roll-dialog.mjs` scaffold.

Start by reading the five docs above, then run `npm test` to confirm
the repo is green before touching anything.
