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

**Status:** **Phase 1 is closed.** All four rolls flow through the
adapter: `rollAbilityCheck`, `rollSavingThrow`, `rollSkillCheck`, and
initiative (via `getInitiativeRoll`, Path A — formula-only). 759
Vitest tests pass (unit + dice-gated integration) plus 15 Playwright
e2e tests in `browser-tests/e2e/phase1-adapter-dispatch.spec.js` that
validate every dispatcher branch by asserting on the `[DCC adapter]`
console logs.

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

**This session's goal:** open **Phase 2 — spell checks** by landing
the smallest possible green slice. Full phase is 3–4 sessions;
target for session 1 below.

### Session 1 slice — scaffold the adapter path, no side effects yet

The existing `processSpellCheck` in `module/dcc.js` (~200 lines)
interleaves wizard spell loss, cleric disapproval, patron taint,
spellburn, and mercurial magic. Migrating it in one commit is the
trap. Instead, this session:

1. **Read first** — `module/dcc.js` `processSpellCheck`,
   `config.js:188-192` (the three casting modes: `generic`,
   `wizard`, `cleric`), and the lib entry points:
   `module/vendor/dcc-core-lib/index.js` exports
   `calculateSpellCheck` + `castSpell`. Skim
   `/Users/timwhite/WebstormProjects/dcc-core-lib/src/spells/`
   to see the `SpellCastInput` + `SpellEvents` shapes.

2. **Scaffold adapter files** (empty-ish stubs, like Phase 0 did):
   - `module/adapter/spell-events.mjs` — header JSDoc describing
     the Foundry-flavored `SpellEvents` implementation. No body
     yet; later sessions fill in `onSuccess` / `onFailure` /
     `onSpellLost` / `onPatronTaint` / etc.
   - `module/adapter/spell-input.mjs` — builds a lib
     `SpellCastInput` from `(actor, spellItem, options)`.
   - Extend `module/adapter/chat-renderer.mjs` with a
     `renderSpellCheck` stub that just posts a minimal chat
     message and a `dcc.libResult` flag, matching the shape of
     `renderSavingThrow` / `renderSkillCheck`.

3. **Dispatcher split for generic casts only.** Add a new
   `rollSpellCheck` method on `DCCActor` that dispatches:
   - Adapter path: only when `spellType === 'generic'` AND no
     wizard/cleric/patron side effects involved. Uses
     `calculateSpellCheck` to produce the result; renders via
     `renderSpellCheck`.
   - Legacy path: everything else — delegates to today's
     `processSpellCheck` in `dcc.js`, which stays intact this
     session. Keep `game.dcc.processSpellCheck` exported verbatim
     (XCC's wizard + cleric sheets consume it — see
     `EXTENSION_API.md`).
   Both branches get a `logDispatch('rollSpellCheck', 'adapter'|'legacy', …)`
   call as their first line.

4. **Tests.** Unit: `module/__tests__/adapter-spell-check.test.js`
   (2–3 tests covering the dispatcher). Browser: extend
   `browser-tests/e2e/phase1-adapter-dispatch.spec.js` with a
   `rollSpellCheck` test group — adapter path for a generic
   spell item, legacy path for a wizard spell.

5. **Lib-side wave-2 modifier migration is a prerequisite for
   later sessions.** The spell subsystem still uses
   `LegacyRollModifier`. If session 1's scaffolding can get away
   with the legacy shape for generic casts, fine. If the lib APIs
   we adopt return the new tagged union, we'll need to land the
   lib's wave-2 migration first in its own PR + `npm run sync-core-lib`.
   Decide after reading the lib exports.

Do NOT in session 1: migrate wizard spell loss, cleric
disapproval, patron taint, or mercurial magic. Those are
session 2+ slices.

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
