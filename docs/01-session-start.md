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

**Status:** **Phase 1 closed. Phase 2 sessions 1 + 2 complete.**
`DCCActor.rollSpellCheck` is a dispatcher. Generic-castingMode spell
items on non-Cleric, non-patron actors flow through
`_castViaCastSpell` (buildSpellCastInput → libCastSpell two-pass →
renderSpellCheck). Wizard-castingMode items on the same actors now
flow through `_castViaCalculateSpellCheck` (buildSpellCheckArgs →
libCalculateSpellCheck two-pass with `createSpellEvents` callbacks →
renderSpellCheck); `onSpellLost` marks the Foundry item
`system.lost: true` via `item.update`, replacing the
`actor.loseSpell(item)` side effect in `processSpellCheck`. An
adapter-side lost-spell pre-check (mirrors `DCCItem.rollSpellCheck:260`)
warns + returns before dispatch when
`spellItem.system.lost && automateWizardSpellLoss`. Cleric /
patron-bound / naked spell checks stay on `_rollSpellCheckLegacy`
(which still hands off to `game.dcc.processSpellCheck` verbatim).

`module/adapter/spell-input.mjs` now exports
`syntheticGenericProfile`, `buildSpellbookEntry`,
`buildSpellCastInput` (castSpell args), and `buildSpellCheckArgs`
(calculateSpellCheck args — returns `null` when the actor's class
has no lib-side profile, letting the adapter fall back to legacy
for homebrew / spinoff classes). `module/adapter/spell-events.mjs`
exports `createSpellEvents({ actor, spellItem })` — only
`onSpellLost` is wired this session; sessions 3–5 add
`onDisapprovalIncreased`, `onPatronTaint`, `onSpellburnApplied`,
`onMercurialEffect`. 767 Vitest tests pass (763 + 4 new in
`adapter-spell-check.test.js`). The Playwright spec is at 19 tests
(wizard-castingMode → adapter added; ex-"wizard → legacy" rescoped
to "wizard + patron → legacy"). Live Foundry run still pending.

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

**This session's goal:** **Phase 2 session 3 — cleric disapproval
migration.** Sessions 1 + 2 landed the dispatcher, generic +
wizard adapter branches, `createSpellEvents.onSpellLost`, and the
wizard lost-spell pre-check. Session 3 broadens the adapter gate
to cover cleric actors, wires `onDisapprovalIncreased` through
`spell-events.mjs` to replace the
`actor.rollDisapproval(natural)` + `actor.applyDisapproval()` side
effects in `processSpellCheck`, and extends `buildSpellCheckArgs`
to populate `character.state.classState.cleric.disapprovalRange`
so the lib's disapproval-range read succeeds.

### Session 3 slice — cleric disapproval

1. **Read first** — the current dispatcher + adapter branches in
   `module/actor.js` (`rollSpellCheck`,
   `_rollSpellCheckViaAdapter`, `_castViaCastSpell`,
   `_castViaCalculateSpellCheck`), the session-2 event bridge in
   `module/adapter/spell-events.mjs`, the disapproval branch in
   `module/dcc.js:762-779` (the `castingMode === 'cleric'` section
   of `processSpellCheck`), and the lib pieces at
   `module/vendor/dcc-core-lib/spells/disapproval.js` +
   `spell-check.js` (search `handleClericDisapproval`).

2. **Extend `buildSpellCheckArgs`** — when
   `profile.type === 'cleric'`, populate
   `character.state.classState.cleric.disapprovalRange` from
   `actor.system.class.disapproval` so
   `getDisapprovalRange(character)` reads a real value. Add a
   disapproval-range default when the actor has no value yet.

3. **Pass a `disapprovalTable` to `calculateSpellCheck`** — the
   lib's `handleClericDisapproval` only runs the roll when the
   table is supplied. Pull it from
   `game.settings.get('dcc', 'disapprovalPacks')` + the first
   compendium entry. Session 1 + 2 skipped table loading (no
   disapproval + no corruption table needed); session 3 introduces
   it. Document the table-loading pattern so sessions 4–5 reuse it.

4. **Broaden the adapter gate.** Currently:
   `castingMode === 'generic' | 'wizard' && !hasPatron && !isCleric`.
   Session 3: also allow `(castingMode === 'cleric' || isCleric)`
   on non-patron-bound actors. Preserve the cleric sheet's
   idol-magic / no-checkPenalty semantics inside the adapter
   branch.

5. **Fill in `onDisapprovalIncreased`** in
   `module/adapter/spell-events.mjs`. When the lib reports
   `result.newDisapprovalRange > oldRange`, update
   `actor.system.class.disapproval` via `actor.update(...)` and
   emit the disapproval chat message (mirrors today's
   `actor.rollDisapproval(natural)` behavior). The `disapprovalResult`
   from the lib carries the table row + description — surface it
   in the chat message.

6. **Tests.** Extend `adapter-spell-check.test.js`: cleric-castingMode
   item on a cleric actor with natural above disapproval range →
   adapter no-op on disapproval; cleric item with natural within
   range → adapter triggers disapproval; cleric item on a
   patron-bound actor → legacy. Extend the Playwright spec with a
   cleric-adapter test.

7. **Lib-side wave-2 modifier migration** may now be required if
   the disapproval pipeline needs tagged-union modifiers. Check
   before writing code; if it does, land the lib migration in
   `dcc-core-lib` first + `npm run sync-core-lib`.

Do NOT in session 3: migrate patron taint (session 4), spellburn
or mercurial magic (session 5). Keep `game.dcc.processSpellCheck`
exported verbatim — XCC's wizard/cleric sheets consume it until
Phase 2 closes.

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
