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

**Status:** **Phase 1 closed. Phase 2 sessions 1 + 2 + 3 complete.**
`DCCActor.rollSpellCheck` is a dispatcher. Generic-castingMode spell
items on non-Cleric, non-patron actors flow through
`_castViaCastSpell` (buildSpellCastInput → libCastSpell two-pass →
renderSpellCheck). Wizard-castingMode items on non-cleric,
non-patron actors flow through `_castViaCalculateSpellCheck`
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
`actor.rollDisapproval(natural)` + `RollTable.draw`). Patron-bound
actors, wizard-on-cleric, cleric-on-non-cleric, naked spell checks,
and unknown casting modes stay on `_rollSpellCheckLegacy` (still
hands off to `game.dcc.processSpellCheck` verbatim).

`module/adapter/spell-input.mjs` now exports
`syntheticGenericProfile`, `buildSpellbookEntry`,
`buildSpellCastInput`, `buildSpellCheckArgs`
(calculateSpellCheck args — returns `null` when the actor's class
has no lib-side profile, letting the adapter fall back to legacy
for homebrew / spinoff classes), and `loadDisapprovalTable` (async).
`module/adapter/spell-events.mjs` exports
`createSpellEvents({ actor, spellItem })` — `onSpellLost` and
`onDisapprovalIncreased` wired; sessions 4–5 add `onPatronTaint`,
`onSpellburnApplied`, `onMercurialEffect`.
`module/adapter/chat-renderer.mjs` now exports
`renderDisapprovalRoll`. 773 Vitest tests pass (767 + 6 new in
`adapter-spell-check.test.js`). The Playwright spec is at 20 tests
(cleric-castingMode → adapter (cleric) added), all 20 passing
against live v14 Foundry as of 2026-04-18.

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

**This session's goal:** **Phase 2 session 4 — patron taint
migration.** Sessions 1 + 2 + 3 landed the dispatcher, generic +
wizard + cleric adapter branches, `createSpellEvents.onSpellLost`
+ `.onDisapprovalIncreased`, `loadDisapprovalTable`, and
`renderDisapprovalRoll`. Session 4 broadens the adapter gate to
cover patron-bound wizard / elf actors, wires `onPatronTaint`
through `spell-events.mjs` to replace the taint roll + chance bump
in `processSpellCheck`, and extends `buildSpellCheckArgs` to
populate `character.state.classState.wizard.patron` (and/or
`.elf.patron`) so `calculateSpellCheck`'s patron path runs.

### Session 4 slice — patron taint

1. **Read first** — the current dispatcher + adapter branches in
   `module/actor.js` (`rollSpellCheck`, `_rollSpellCheckViaAdapter`,
   `_castViaCalculateSpellCheck`), the session-3 event bridge +
   table loader in `module/adapter/spell-events.mjs` +
   `module/adapter/spell-input.mjs` (`loadDisapprovalTable` /
   `toLibSimpleTable`), the patron / fumble branches in
   `module/dcc.js` (search `patronTaint`, `applyPatronTaint`), and
   the lib pieces at `module/vendor/dcc-core-lib/spells/corruption.js`
   (search `rollPatronTaint`) + `spells/spell-check.js` (search
   `handleWizardFumble`).

2. **Extend `buildSpellCheckArgs`** — when the actor's class is a
   patron caster (wizard / elf), populate
   `character.state.classState.<profile.type>.patron` from
   `actor.system.class.patron`. The lib's `getPatronId(character)`
   (spell-check.js:72) reads this to set `castInput.patron`.

3. **Load the patron-taint table and (likely) fumble / corruption
   tables.** `handleWizardFumble` reads `input.fumbleTable` +
   `input.corruptionTable` + `input.patronTaintTable`. Session 4
   needs at least the patron taint table; the fumble + corruption
   tables are probably needed too because wizard fumbles drive
   corruption / taint from the same pipeline. Reuse session 3's
   `toLibSimpleTable` — extract it to a shared `table-adapter.mjs`
   if the third consumer shape matches.

4. **Broaden the adapter gate.** Currently wizard branch requires
   `!isCleric` AND the top-level dispatch still requires `!hasPatron`.
   Session 4: drop `!hasPatron` from the wizard branch once the
   patron taint pipeline is wired. Keep the cleric branch at
   `!hasPatron` for now — patron + cleric is a rare XCC variant;
   defer until the last session decides whether to include it.

5. **Fill in `onPatronTaint`** in `module/adapter/spell-events.mjs`.
   When the lib reports patron taint, bump the actor's patron-taint
   chance (find the exact field in `processSpellCheck` —
   something like `actor.system.class.patronTaint`) via
   `actor.update(...)` and emit the taint chat message (the
   `patronTaintResult` from the lib carries the rolled row +
   description — surface it like session 3 did with
   `disapprovalResult`).

6. **Tests.** Extend `adapter-spell-check.test.js`: wizard-castingMode
   item on a patron-bound wizard → adapter; patron taint triggers
   on a natural 1 (or whatever the lib's gate is) → adapter posts
   taint chat + updates actor; wizard item on a patron-bound elf →
   adapter. Extend the Playwright spec with a patron-wizard adapter
   test (the existing "wizard + patron → legacy" test flips to
   "wizard + patron → adapter" — rename accordingly).

7. **Lib-side wave-2 modifier migration** is likely required this
   session because the corruption / fumble / patron pipelines are
   on `LegacyRollModifier` (per `dcc-core-lib/docs/MODIFIERS.md §9`
   wave 2). Check first by reading the types; if wave 2 hasn't
   landed yet, coordinate with `dcc-core-lib` maintainer / land the
   lib migration in its own repo + `npm run sync-core-lib` before
   adapter work starts.

Do NOT in session 4: migrate spellburn or mercurial magic (session
5). Keep `game.dcc.processSpellCheck` exported verbatim — XCC's
wizard/cleric sheets consume it until Phase 2 closes.

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
