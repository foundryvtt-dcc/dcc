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
4. `module/vendor/dcc-core-lib/../../../../WebstormProjects/dcc-core-lib/docs/MODIFIERS.md`
   — lib-side design doc for the tagged-union `RollModifier` type the
   adapter emits and consumes.

**Status:** Phase 1 implementation is **complete**. All four rolls are
migrated: `rollAbilityCheck`, `rollSavingThrow`, `rollSkillCheck`, and
initiative (via `getInitiativeRoll`, Path A — formula-only). 759 tests
pass (unit + dice-gated integration). `@moonloch/dcc-core-lib@0.4.0`
is vendored at `module/vendor/dcc-core-lib/`. The lib uses a
tagged-union `RollModifier` (add, add-dice, set-die, bump-die,
multiply, threat-shift, display) for wave-1 subsystems (checks,
skills, dice, cleric); combat / spells / patron / occupation still
use `LegacyRollModifier` pending their own waves.

**This session's goal:** close Phase 1. Two pieces:

1. **Exercise the skill + init adapter paths in Foundry.** This is
   the verification gate the debug logging exists to support. From
   a Player sheet in Foundry, click each of the built-in skills +
   at least one skill item, and click both the sheet's initiative
   button and the combat tracker's round-start init button. Watch
   the console for:
   - `[DCC adapter] rollSkillCheck → via adapter skillId=…` for
     regular skills; `→ LEGACY path` for the dialog / disapproval /
     skill-table / description-only carve-outs.
   - `[DCC adapter] rollInit → via adapter die=1d20` (or custom
     die) for initiative; `→ LEGACY path` only when the modifier
     dialog is requested.

   Confirm chat totals and flavors match pre-migration output.

2. **Ship the cleanup commit.** Once the Foundry-side checks pass,
   delete `module/adapter/debug.mjs` and every `logDispatch` import
   + call site in `module/actor.js`. Call sites today:
   - `_rollAbilityCheckViaAdapter` / `_rollAbilityCheckLegacy`
   - `_rollSavingThrowViaAdapter` / `_rollSavingThrowLegacy`
   - `_rollSkillCheckViaAdapter` / `_rollSkillCheckLegacy`
   - `_getInitiativeRollViaAdapter` / `_getInitiativeRollLegacy`

   One commit — `chore(adapter): remove Phase 1 dispatch logging`
   or similar. Leaves the import block in `actor.js` clean (remove
   the `logDispatch` entry from the adapter-imports block too).
   Run `npm test` to confirm nothing depended on the logs.

**Why Path A for initiative** (context for debugging if something
looks off):

- The current session migrated `getInitiativeRoll`, not `rollInit`.
  `rollInit` is a thin wrapper — its real work happens when
  Foundry's `Combat#rollInitiative` calls back through
  `DCCCombatant.getInitiativeRoll` → `actor.getInitiativeRoll` for
  each combatant. That callback returns a Foundry `Roll`; Foundry
  evaluates it and posts a chat message with `flags.core.initiativeRoll:
  true` — the flag `emoteInitiativeRoll` in `module/chat.js:492`
  gates on.
- The adapter path builds the formula via the lib's `rollCheck(mode:
  'formula')` with a synthetic `{ id: 'initiative', type: 'check',
  roll: { die, levelModifier: 'none' } }` SkillDefinition. No
  `roll.ability` — `system.attributes.init.value` already bakes in
  agl mod + otherMod + class level via `computeInitiative`, so
  setting `ability: 'agl'` would double-count.
- The init value is emitted as ONE aggregate `add` modifier with
  origin `{ category: 'other', id: 'initiative-total' }`. Decomposing
  into per-source modifiers (ability / level / AE) is a future
  improvement — blocked on `computeInitiative` tracking components.
- Init has no gameplay crit/fumble in vanilla DCC, so there's no
  pass-2 classification. Single-pass formula mode is sufficient.
- Weapon-die overrides (two-handed + custom `initiativeDieOverride`)
  stay Foundry-side. The `[Two-Handed]` / `[Weapon]` die label is
  re-injected into the lib's formula string via a targeted regex
  replace after the lib returns the bare `1d16` / etc.

**Running tests:**

- `npm test` — runs unit + integration projects. Always the final
  check before committing.
- `npm run test:unit` — unit project only (mock-based). Runs in
  every environment; use this during iteration.
- `npm run test:integration` — integration project only. Skips
  everything if Foundry isn't detected (env var `FOUNDRY_PATH`,
  `.foundry-dev/` in project root, or `~/Applications/foundry-14`
  etc.).
- The dice-engine-gated tests across the four adapter integration
  files only execute if `.foundry-dev/client/dice/` exists. Check
  with `ls .foundry-dev/client/dice` — if missing, run
  `npm run setup:foundry` once to populate it. Without that, the
  dice cases **skip** (not fail); the status line will show
  `N passed | M skipped` rather than a clean pass.

**Verification after the cleanup commit:**
- `npm test` — all unit + gated integration tests pass (759 tests
  post-init migration).
- `grep -n "logDispatch\|debug.mjs" module/` returns nothing.

**Constraints:**
- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing — signatures
  + emitted flags for `rollAbilityCheck`, `rollSavingThrow`,
  `rollSkillCheck`, and `rollInit` / `getInitiativeRoll` are all
  preserved verbatim by the Phase 1 dispatchers.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — that `git add .` sweeps untracked files, so stash or `.gitignore`
  them first.

**After Phase 1 closes** — the next phase is Phase 2 (spell checks).
That's a bigger migration: `processSpellCheck` carries wizard
spell-loss, cleric disapproval, patron taint, spellburn. The lib
has `calculateSpellCheck` + event callbacks for all of it but the
DCC-side orchestration is tangled. Expect 3–4 sessions.

**Remaining open questions** (tracked in `00-progress.md`; none block
Phase 1's close):
- #2 package-name discrepancy — resolved in spirit by vendoring, can
  be closed out.
- #3 dead `dcc.update` hook — coordinate with XCC maintainer.
- #4 stabilizing undocumented `game.dcc.*` pieces — Phase 3 concern.

Start by reading the four docs above, then run `npm test` to confirm
the repo is green before touching anything. Exercise the skill + init
paths in Foundry next.
