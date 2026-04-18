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

**Status:** **Phase 1 closed. Phase 2 session 1 complete.**
`DCCActor.rollSpellCheck` is now a dispatcher. Generic-castingMode
spell items on non-Cleric, non-patron actors flow through
`_rollSpellCheckViaAdapter` (buildSpellCastInput → libCastSpell two-pass
→ renderSpellCheck); wizard / cleric / patron-bound paths and naked
spell checks stay on `_rollSpellCheckLegacy` (which still hands off to
`game.dcc.processSpellCheck` verbatim). Adapter files scaffolded:
`module/adapter/spell-input.mjs` (synthetic generic caster profile —
session 2 swaps this for a real wizard lookup), `module/adapter/spell-events.mjs`
(header-only stub — sessions 2–5 wire the callbacks), and a new
`renderSpellCheck` in `module/adapter/chat-renderer.mjs`. 763 Vitest
tests pass (759 + 4 new in `adapter-spell-check.test.js`). The
Playwright spec is up to 18 tests (`npx playwright test --list`
confirms parse); a live Foundry run is still pending.

`@moonloch/dcc-core-lib@0.4.0` is vendored at
`module/vendor/dcc-core-lib/`. The lib uses a tagged-union
`RollModifier` (add, add-dice, set-die, bump-die, multiply,
threat-shift, display) for wave-1 subsystems (checks, skills, dice,
cleric); combat / spells / patron / occupation still use
`LegacyRollModifier` pending their own waves.

**Dispatch logging is PERMANENT.** `module/adapter/debug.mjs` +
every `logDispatch('rollXxx', 'adapter'|'legacy', details)` call
site stays in place indefinitely. Decision made 2026-04-18 — the
earlier plan to strip them at phase close was cancelled because the
Playwright spec relies on them for automated dispatch validation and
`getInitiativeRoll` has no chat-message signal to substitute. Every
`_xxxViaAdapter` / `_xxxLegacy` added in later phases must call
`logDispatch` as its first line.

**This session's goal:** **Phase 2 session 2 — wizard spell loss
migration.** Session 1 landed the dispatcher + scaffold. Session 2
broadens the adapter gate to cover wizard-castingMode items, wires
`onSpellLost` through `spell-events.mjs` to replace the
`actor.loseSpell(item)` call in `processSpellCheck`, and switches
the adapter to `calculateSpellCheck` (not just `castSpell`) once a
real caster profile + spellbook entry is available.

### Session 2 slice — wizard spell loss

1. **Read first** — the `_rollSpellCheckViaAdapter` +
   `_rollSpellCheckLegacy` split already in `module/actor.js`, plus
   `module/item.js:255` (`DCCItem.rollSpellCheck` — spell-loss
   pre-check at line 260), `module/dcc.js:753-761`
   (`processSpellCheck`'s wizard branch — the `actor.loseSpell(item)`
   call), and the lib entry points:
   `calculateSpellCheck`, `getCasterProfile('wizard')`, and
   `findSpellEntry` / `markSpellLost` in
   `module/vendor/dcc-core-lib/spells/spellbook.js`.

2. **Extend `spell-input.mjs`** — look up a real caster profile via
   `getCasterProfile(classId)` when the actor has a caster class;
   build a real `spellbookEntry` from the spell item's
   `system.lost` / `system.timesPreparedOrCast` fields. For the
   generic path keep the synthetic profile, or move it to a named
   factory (e.g. `syntheticGenericProfile()`).

3. **Switch the adapter call to `calculateSpellCheck`.** Only once
   the caster profile + spellbook entry are real; `castSpell`
   stays as a fallback for the synthetic generic path (or we drop
   the generic branch in favor of routing all casts through
   `calculateSpellCheck`). Handle the error shape
   (`{ error: string }`) gracefully — render an error chat
   message and return without touching actor state.

4. **Fill in `onSpellLost`** in `module/adapter/spell-events.mjs`.
   When the lib reports `result.spellLost` for a wizard, set
   `spellItem.system.lost: true` via `item.update(...)`. This
   replaces the `actor.loseSpell(item)` side effect that
   `processSpellCheck` performs today.

5. **Broaden the adapter gate.** Currently:
   `castingMode === 'generic' && !hasPatron && !isCleric`.
   Session 2: also allow `castingMode === 'wizard' && !hasPatron`
   (cleric disapproval is session 3, patron taint is session 4).
   Handle `spellItem.system.lost && settings.get('dcc',
   'automateWizardSpellLoss')` as an adapter-side warn + early
   return (mirrors `DCCItem.rollSpellCheck:260`).

6. **Tests.** Extend `adapter-spell-check.test.js`: wizard-castingMode
   item on a wizard actor → adapter; lost wizard spell with
   automation on → warn + early return; wizard item on a
   patron-bound actor → legacy (taint still carved out). Extend
   the Playwright spec with at least one wizard-adapter test.

7. **Lib-side wave-2 modifier migration** may now be required if
   the switch to `calculateSpellCheck` returns tagged-union
   modifiers. Check before writing code; if it does, land the lib
   migration in `dcc-core-lib` first + `npm run sync-core-lib`.

Do NOT in session 2: migrate cleric disapproval (session 3),
patron taint (session 4), spellburn or mercurial magic (session 5).
Keep `game.dcc.processSpellCheck` exported verbatim — XCC's
wizard/cleric sheets consume it until the full Phase 2 is done.

**Before touching Phase 2 code, confirm the repo is green:**

- `npm test` — 759 Vitest tests + dice-gated integration. Final
  check before any commit.
- `npm run test:unit` — mock-only; runs in every environment.
- `npm run test:integration` — integration project. Skips if Foundry
  isn't detected (via `FOUNDRY_PATH`, `.foundry-dev/`, or
  `~/Applications/foundry-14`).
- **Dice-engine-gated tests** only run if `.foundry-dev/client/dice/`
  exists. `ls .foundry-dev/client/dice` — missing → run
  `npm run setup:foundry` once. Otherwise the dice cases **skip**
  (not fail); the status line shows `N passed | M skipped`.

**Browser tests (optional but recommended when touching dispatcher
code):** see `docs/dev/TESTING.md#browser-tests-playwright` for the
full recipe. TL;DR — with the fvtt CLI's `installPath` /
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

**Constraints for Phase 2 work:**

- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing — signatures
  + emitted flags for `rollAbilityCheck`, `rollSavingThrow`,
  `rollSkillCheck`, `rollInit` / `getInitiativeRoll`, and the
  Phase-2-target `processSpellCheck` shim must keep working for XCC.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — the `git add .` sweeps untracked files; stash or `.gitignore`
  them first.
- Every new `_xxxViaAdapter` / `_xxxLegacy` dispatcher method needs
  a `logDispatch` call as its first line (see Dispatch logging
  above) plus a new test group in
  `browser-tests/e2e/phase1-adapter-dispatch.spec.js` (consider
  renaming if it grows large).

**Remaining open questions** (tracked in `00-progress.md`; none block
Phase 2):
- #2 package-name discrepancy — resolved in spirit by vendoring, can
  be closed out.
- #3 dead `dcc.update` hook — coordinate with XCC maintainer.
- #4 stabilizing undocumented `game.dcc.*` pieces — Phase 3 concern
  (attack/crit migration is when those utilities are actually
  implicated).

Start by reading the five docs above, then run `npm test` to confirm
the repo is green before touching anything. Phase 2 planning next.
