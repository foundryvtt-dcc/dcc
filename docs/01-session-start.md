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
(attack / damage / crit / fumble) is the active phase.** Phase 2
sessions 1–5 landed; the close-out session pinned two decisions:
(a) `game.dcc.processSpellCheck` is permanent stable API — no
deprecation, no shim, route migration is per-call-site and
incremental; (b) `_runLegacyPatronTaint` is permanent adapter
infrastructure — RAW alignment deferred to backlog. See
`docs/00-progress.md` Phase 2 close-out for full rationale.

**Phase 2 infrastructure Phase 3 builds on:**

- `DCCActor.rollSpellCheck` is a dispatcher (`_castViaCastSpell` /
  `_castViaCalculateSpellCheck` + legacy fall-through). The same
  two-pass formula/evaluate pattern is the template for Phase 3's
  `_rollWeaponAttackViaAdapter`.
- Adapter modules: `module/adapter/{character-accessors,
  foundry-roller, chat-renderer, spell-input, spell-events,
  debug}.mjs`. Phase 3 will likely add `attack-input.mjs` +
  `attack-events.mjs` alongside these.
- `@moonloch/dcc-core-lib@0.4.0` vendored at
  `module/vendor/dcc-core-lib/`. Wave-1 modifier redesign covers
  checks / skills / dice / cleric; **combat subsystems still use
  `LegacyRollModifier` pending wave 3.** Check the lib's
  `MODIFIERS.md §9` for wave-3 status before committing to an
  attack migration approach — if combat is still on legacy
  modifiers, the first Phase 3 session may need to block on a lib
  wave-3 release.
- `module/adapter/debug.mjs` + `logDispatch('rollXxx',
  'adapter'|'legacy', details)` is PERMANENT. Every
  `_xxxViaAdapter` / `_xxxLegacy` added in Phase 3 must call
  `logDispatch` as its first line. The Playwright
  `phase1-adapter-dispatch.spec.js` extends to cover new branches.
- **Baseline:** 790 Vitest tests pass + 22 Playwright dispatch
  tests pass against live v14 Foundry (verified 2026-04-18).

**This session's goal:** **Begin Phase 3 — attack / damage / crit /
fumble migration.**

Phase 3 is the largest migration so far: `rollWeaponAttack` →
`makeAttackRoll` + `rollDamage` + `rollCritical` + `rollFumble`, with
the interleaving crit-range-scaling, two-weapon penalty, backstab
multiplier, deed-die, and weapon-type logic all needing the adapter
bridge. The lib has every piece (`makeAttackRoll`, `rollDamage`,
`rollCritical`, `rollFumble`, `getTwoWeaponPenalty`,
`getBackstabMultiplier`) — the work is building the Foundry-side
adapter that feeds them.

**Critical integration point:** `dcc.modifyAttackRollTerms` is
dcc-qol's main hook. It fires via `module/actor.js:1867` before the
attack roll evaluates. Phase 3 must preserve this hook — translate
from the lib's modifier list so dcc-qol's three handlers keep working.

**Early Phase 3 priority — open question #6 (spellburn dialog).**
Session 5 wired `options.spellburn` but not the dialog. The attack /
damage dialogs use the same legacy roll-modifier pattern. Pick the
dialog-adapter approach in the first Phase 3 session — the answer
applies to both spellburn + attack dialogs. Two options:
(a) **Dispatcher carve-out**: route `options.showModifierDialog` to
    legacy. Undoes migration for the dialog case.
(b) **Dialog-adapter**: extract the roll-modifier dialog into a
    standalone adapter-side component that collects input as modifier
    list entries, then invokes the adapter path. More work; preserves
    full adapter pipeline.

### Session 7 slice — Phase 3, session 1 (attack migration scaffold)

1. **Read first** — `docs/00-progress.md` (Phase 2 close-out + open
   question #6 + session-5 mercurial/spellburn patterns),
   `docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 3`, `module/actor.js`
   `rollWeaponAttack` (line ~2385) + `dcc.modifyAttackRollTerms` emit
   site (line 1867), dcc-qol's `modifyAttackRollTerms` handlers in
   `../../modules/dcc-qol/scripts/`. Also check if the lib has shipped
   wave-3 modifier support for combat — `module/vendor/dcc-core-lib/
   VERSION.json` shows the current pinned version.

2. **Pick the session slice.** Options:
   (a) **Dialog-adapter first**: build the dialog-adapter scaffolding
       (serves Phase 3 + open question #6). No attack migration yet.
   (b) **Attack-formula first**: build `_rollWeaponAttackViaAdapter`
       for the simplest attack path (no deed, no backstab, no two-
       weapon), leaving dialog / complex cases on legacy. Validates
       the `makeAttackRoll` bridge end-to-end.
   (c) **Hook translation**: wire `dcc.modifyAttackRollTerms` to
       translate lib-modifier-list ↔ Foundry terms so dcc-qol keeps
       working even as more attack paths migrate.
   Pick based on the lib's wave-3 status + how confident the session
   is in both the dialog pattern + the attack bridge. Lean (a) if lib
   wave-3 isn't ready; (b) otherwise; (c) when the first attack
   adapter path is about to ship.

3. **Dispatch logging.** Every `_rollWeaponAttackViaAdapter` /
   `_rollWeaponAttackLegacy` / related helper must call `logDispatch`
   as first line (same permanent-infrastructure contract as Phase 1/2).
   Extend the Playwright `phase1-adapter-dispatch.spec.js` (or rename
   to `adapter-dispatch.spec.js`) to validate the new branches.

4. **Integration testing.** Playwright against live v14 Foundry is
   now the gold standard for dispatcher validation. Run the full
   dispatch spec before claiming a session complete.

Do NOT in session 7: touch data-model slimming (Phase 4) or sheet
composition (Phase 5). Do NOT break `dcc.modifyAttackRollTerms` — it
has external consumers.

**Before touching Phase 3 code, confirm the repo is green:**

- `npm test` — 790 Vitest tests + dice-gated integration. Final
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
- #6 spellburn dialog integration — early Phase 3 pick-up.

Start by reading the five docs above, then run `npm test` to confirm
the repo is green before touching anything.
