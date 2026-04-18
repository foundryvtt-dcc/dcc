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

**Status:** **Phase 1 closed. Phase 2 sessions 1 + 2 + 3 + 4 complete.**
`DCCActor.rollSpellCheck` is a dispatcher. Generic-castingMode spell
items on non-Cleric, non-patron actors flow through
`_castViaCastSpell` (buildSpellCastInput → libCastSpell two-pass →
renderSpellCheck). Wizard-castingMode items on non-cleric actors
(patron OK as of session 4) flow through `_castViaCalculateSpellCheck`
(buildSpellCheckArgs → libCalculateSpellCheck two-pass with
`createSpellEvents` callbacks → renderSpellCheck); `onSpellLost`
marks the Foundry item `system.lost: true` via `item.update`,
replacing the `actor.loseSpell(item)` side effect in
`processSpellCheck`. An adapter-side lost-spell pre-check (mirrors
`DCCItem.rollSpellCheck:260`) warns + returns before dispatch when
`spellItem.system.lost && automateWizardSpellLoss`.
**Cleric-castingMode items on non-patron Cleric actors** also flow
through `_castViaCalculateSpellCheck`: `buildSpellCheckArgs`
populates `character.state.classState.cleric.disapprovalRange` from
`actor.system.class.disapproval`; `loadDisapprovalTable(actor)`
adapts the Foundry disapproval table to a lib `SimpleTable`;
`_castViaCalculateSpellCheck` pre-rolls 1d4 via Foundry when
natural ≤ range, and the pass-2 roller dispatches on formula
(`'1d4'` → pre-rolled d4, else spell-check natural). The
`onDisapprovalIncreased` bridge updates `actor.system.class.disapproval`
+ posts the "DCC.DisapprovalGained" EMOTE (replaces
`actor.applyDisapproval()`); `renderDisapprovalRoll` posts the
disapproval roll chat from `result.disapprovalResult` (replaces
`actor.rollDisapproval(natural)` + `RollTable.draw`).
**Patron-bound wizard / elf actors (session 4)** route through
`_castViaCalculateSpellCheck`: `buildSpellCheckArgs` populates
`character.state.classState.<wizard|elf>.patron` from
`actor.system.class.patron` so `getPatronId(character)` resolves
and the lib records `castInput.patron`. The lib's RAW patron-taint
pipeline (`handleWizardFumble` → `rollPatronTaint`) stays dormant
because the adapter never plumbs in `input.fumbleTable`; instead
`_runLegacyPatronTaint(spellItem)` runs after `renderSpellCheck`
and ports `processSpellCheck:623-660` verbatim — the legacy
d100-vs-creeping-chance mechanic that bumps
`system.class.patronTaintChance` by 1% on every patron-related cast
(spell name contains 'Patron' OR `item.system.associatedPatron`
truthy). **Silent chance bump** — no chat — matches the legacy
no-table fallback path. Generic + cleric branches keep `!hasPatron`.
Cleric-on-non-cleric, naked spell checks, and unknown casting modes
stay on `_rollSpellCheckLegacy` (still hands off to
`game.dcc.processSpellCheck` verbatim).

`module/adapter/spell-input.mjs` now exports
`syntheticGenericProfile`, `buildSpellbookEntry`,
`buildSpellCastInput`, `buildSpellCheckArgs`
(calculateSpellCheck args — returns `null` when the actor's class
has no lib-side profile, letting the adapter fall back to legacy
for homebrew / spinoff classes; populates `wizard.patron` /
`elf.patron` for patron-bound casters as of session 4), and
`loadDisapprovalTable` (async).
`module/adapter/spell-events.mjs` exports
`createSpellEvents({ actor, spellItem })` — `onSpellLost` and
`onDisapprovalIncreased` wired. Session 4 chose adapter-side legacy
preservation (`_runLegacyPatronTaint`) over the lib's
`onPatronTaint` callback because the legacy creeping-chance mechanic
diverges fundamentally from the lib's RAW model — see
`00-progress.md` open question #5 for the alignment plan.
Session 5 adds `onSpellburnApplied` + `onMercurialEffect`.
`module/adapter/chat-renderer.mjs` now exports
`renderDisapprovalRoll`. 777 Vitest tests pass (773 + 4 net
patron-related additions in `adapter-spell-check.test.js`). The
Playwright spec stays at 20 tests (the prior "wizard + patron →
legacy" case rescoped to "wizard + patron → adapter (session 4)"
with a `patronTaintChance` bump assertion), all 20 passing against
live v14 Foundry as of 2026-04-18.

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

**This session's goal:** **Phase 2 session 5 — spellburn + mercurial
magic migration.** Sessions 1 + 2 + 3 + 4 landed the dispatcher,
generic + wizard + cleric + patron adapter branches,
`createSpellEvents.onSpellLost` + `.onDisapprovalIncreased`,
`loadDisapprovalTable`, `renderDisapprovalRoll`, and
`_runLegacyPatronTaint`. Session 5 wires `onSpellburnApplied` +
`onMercurialEffect`, loads the mercurial-magic table via the
existing `toLibSimpleTable` adapter, and extends
`buildSpellCheckArgs` to thread spellburn input + mercurial-table
through `castInput`.

### Session 5 slice — spellburn + mercurial magic

1. **Read first** — the current dispatcher + adapter branches in
   `module/actor.js` (`rollSpellCheck`, `_rollSpellCheckViaAdapter`,
   `_castViaCalculateSpellCheck`, `_runLegacyPatronTaint`), the
   session-3/4 event bridges + table loader in
   `module/adapter/spell-events.mjs` + `module/adapter/spell-input.mjs`
   (`loadDisapprovalTable` / `toLibSimpleTable`), the spellburn +
   mercurial branches in `module/dcc.js` (search `spellburn`,
   `mercurial`) + `module/actor.js` `applySpellburn` +
   `module/item.js` `rollMercurialMagic`, and the lib pieces at
   `module/vendor/dcc-core-lib/spells/spellburn.js` and
   `spells/mercurial.js`.

2. **Extend `buildSpellCheckArgs`** — populate `input.spellburn`
   when the caller passes spellburn ability allocations (likely via
   `options.spellburn` from the spellburn dialog flow), and
   `input.mercurialMagicTable` for wizard profiles by loading the
   single world table referenced by the `dcc.mercurialMagicTable`
   setting via the existing `toLibSimpleTable` adapter.

3. **Wire `onSpellburnApplied`** in `spell-events.mjs`. The lib
   passes the spent ability scores per ability id; the bridge
   updates the actor via `actor.update({ 'system.abilities.<id>.value': ... })`,
   matching `applySpellburn` semantics. Verify whether the lib
   restores ability scores over time (probably not — that's a
   Foundry-side schedule) and whether spellburn temporary mods need
   active-effects handling.

4. **Wire `onMercurialEffect`** in `spell-events.mjs`. The lib passes
   the mercurial table draw; the bridge posts the table chat (mirror
   `renderDisapprovalRoll` pattern via a new `renderMercurialEffect`
   in `chat-renderer.mjs`) and updates `spellItem.system.mercurialEffect`
   so the wizard sheet shows the rolled effect.

5. **Tests.** Extend `adapter-spell-check.test.js`: wizard cast with
   spellburn ability allocations → ability scores updated; wizard
   first-cast triggers mercurial → table draw posted + item updated;
   spellburn + mercurial in one cast both fire. Extend the Playwright
   spec with a spellburn dispatch test and a mercurial-trigger test
   (likely a separate describe block — getting close to spec size
   limit, consider splitting into `phase2-adapter-dispatch.spec.js`).

6. **Phase 2 close.** After session 5 ships, audit
   `game.dcc.processSpellCheck` consumers in XCC; coordinate with
   the XCC maintainer to migrate to a per-cast adapter call, then
   deprecate the export. Resolve open question #5 (patron-taint
   alignment) before declaring Phase 2 done.

Do NOT in session 5: touch attack / damage / crit / fumble pipelines
(Phase 3). Keep `game.dcc.processSpellCheck` exported verbatim until
the XCC migration plan is in place.

**Before touching Phase 2 code, confirm the repo is green:**

- `npm test` — 777 Vitest tests + dice-gated integration. Final
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
