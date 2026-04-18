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

**Status:** **Phase 1 closed. Phase 2 sessions 1 + 2 + 3 + 4 + 5
complete.** `DCCActor.rollSpellCheck` is a dispatcher routing
generic / wizard / cleric / patron-bound-wizard-elf casts through
the adapter. `_castViaCastSpell` handles generic casts via
`libCastSpell`; `_castViaCalculateSpellCheck` handles wizard +
cleric + elf via `libCalculateSpellCheck` with the full
`createSpellEvents` bridge wiring (`onSpellLost` /
`onDisapprovalIncreased` / `onSpellburnApplied`). Mercurial magic
and disapproval chat render adapter-side directly from
`result.mercurialEffect` / `result.disapprovalResult` via
`renderMercurialEffect` / `renderDisapprovalRoll` (NOT through the
lib events — they fire unconditionally on both formula + evaluate
passes for spellburn / mercurial, so pass 1 is now called with `{}`
as events).

**Session 5 landed spellburn + mercurial magic.**
`buildSpellCheckArgs` forwards `options.spellburn` into
`input.spellburn`; the `onSpellburnApplied` bridge subtracts the
commitment from `system.abilities.<str|agl|sta>.value` (clamped at
1, NPC-aware). `loadMercurialMagicTable()` walks the configured
`CONFIG.DCC.mercurialMagicTable` (compendium → world fallback via
the shared `foundryTableEntries` row-walker). `_rollMercurialIfNeeded`
pre-rolls a Foundry `1d100`, feeds it to
`libRollMercurialMagic(luckMod, table, {roller})`, persists the
effect to `spellItem.system.mercurialEffect.{value,summary,
description,displayInChat}`, and attaches it to the in-flight
spellbook entry. Already-rolled items short-circuit the pre-roll
and display the stored effect via `renderMercurialEffect`.
Patron-taint is still preserved verbatim adapter-side via
`_runLegacyPatronTaint` (see open q5). **790 Vitest tests pass**
(777 + 13 session-5 additions). **22 Playwright dispatch tests
pass** (20 + 2 session-5 additions) against live v14 Foundry
(verified 2026-04-18).

`module/adapter/spell-input.mjs` exports: `syntheticGenericProfile`,
`buildSpellbookEntry` (now reads `system.mercurialEffect`),
`buildSpellCastInput`, `buildSpellCheckArgs` (threads
`options.spellburn` when set; populates
`character.state.classState.<type>.spellbook` with mercurial effect
when present; returns `null` for homebrew / spinoff classes),
`loadDisapprovalTable`, `loadMercurialMagicTable`.
`module/adapter/spell-events.mjs` exports `createSpellEvents({actor,
spellItem})` — wires `onSpellLost` / `onDisapprovalIncreased` /
`onSpellburnApplied`. Mercurial rendering is NOT via a bridge —
`_castViaCalculateSpellCheck` renders directly from
`result.mercurialEffect`. `module/adapter/chat-renderer.mjs` exports
`renderSpellCheck` / `renderDisapprovalRoll` / `renderMercurialEffect`.

`@moonloch/dcc-core-lib@0.4.0` is vendored at
`module/vendor/dcc-core-lib/`. The lib uses a tagged-union
`RollModifier` (add, add-dice, set-die, bump-die, multiply,
threat-shift, display) for wave-1 subsystems (checks, skills, dice,
cleric); combat / spells / patron / occupation still use
`LegacyRollModifier` pending their own waves.

**Dispatch logging is PERMANENT.** `module/adapter/debug.mjs` +
every `logDispatch('rollXxx', 'adapter'|'legacy', details)` call
site stays in place indefinitely. Every `_xxxViaAdapter` /
`_xxxLegacy` added in later phases must call `logDispatch` as its
first line.

**This session's goal:** **Phase 2 close.** Two items gate close:

1. **Audit `game.dcc.processSpellCheck` consumers** across the
   sibling modules (especially XCC). Coordinate with the XCC
   maintainer on a migration plan — deprecate the export with a
   1-version warning, or ship a per-cast adapter entry XCC can
   import. `EXTENSION_API.md` marks `processSpellCheck` as stable;
   don't rip it out without a plan.
2. **Resolve open question #5** — patron-taint mechanic alignment
   (legacy creeping-chance vs lib RAW). Either keep
   `_runLegacyPatronTaint` as-is and document the divergence, or
   migrate to RAW (needs fumble-table effect-tag migration + per-
   patron taint table resolution). A decision — not necessarily a
   full migration — is what closes Phase 2.

Once both gate items close, tag the branch and roll into Phase 3
(attack / damage / crit / fumble migration). Phase 3 should also
pick up open question #6 — the spellburn dialog integration session 5
left unfinished — since attack / damage dialogs share the same
dialog-adapter pattern.

### Session 6 slice — Phase 2 close audit

1. **Read first** — `docs/00-progress.md` (latest sections + open
   questions 5 + 6), `docs/dev/EXTENSION_API.md` §processSpellCheck
   entry, sibling modules' consumption:
   `../../modules/xcc/module/xcc.js` + XCC's sheet classes (grep for
   `processSpellCheck`), plus `module/dcc.js:591` for the legacy
   export signature.

2. **Inventory `processSpellCheck` callers** — every call site in
   DCC + XCC + any third-party mod in the tracked set. For each:
   note the invoker (item / actor / sheet), the options passed, and
   whether the adapter's `_castViaCalculateSpellCheck` /
   `_castViaCastSpell` covers the same options. Output an inventory
   table.

3. **Decide the migration path** — draft options for the XCC
   maintainer:
   (a) Keep `processSpellCheck` exported with a stub that routes
       into the adapter (shim). Zero XCC changes.
   (b) Deprecate `processSpellCheck` with a console warning; XCC
       migrates to calling `actor.rollSpellCheck` directly. 1-version
       deprecation window.
   (c) Publish a thin per-cast adapter-entry function (say,
       `game.dcc.adapter.castSpell(actor, spellItem, options)`) that
       XCC calls. Stable public API, no deprecation churn.
   Pick based on XCC's actual usage pattern uncovered in step 2.

4. **Resolve open question #5** — patron-taint RAW alignment. Read
   the legacy mechanic once more (`module/dcc.js:623-660`) and the
   lib's RAW pipeline (`spells/spell-check.js:241`
   `handleWizardFumble` + `spells/fumble.js:46`
   `fumbleRequiresPatronTaint`). Decide:
   (a) keep the creeping mechanic verbatim adapter-side (document
       that DCC diverges from RAW intentionally — finalize
       `_runLegacyPatronTaint` as permanent adapter infrastructure,
       not a phase-local scaffold); or
   (b) migrate to RAW (would need fumble-table effect-tag migration,
       per-patron taint table resolution). Scoped out for session 6
       — only the decision needs to happen now; the migration (if
       chosen) is its own multi-session project.

5. **Tag Phase 2 close.** After both gate items resolve, write a
   close-out note in `00-progress.md` marking Phase 2 complete, then
   update `ARCHITECTURE_REIMAGINED.md §7` to reflect Phase 3 as the
   active phase.

Do NOT in session 6: touch attack / damage / crit / fumble pipelines
(Phase 3). Do NOT rip out `game.dcc.processSpellCheck` without the
XCC migration plan in place.

**Before touching Phase 2 close code, confirm the repo is green:**

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

**Constraints for Phase 2 close work:**

- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing —
  `processSpellCheck` is the Phase 2 close target. Don't rip it out
  without XCC's migration landed.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — the `git add .` sweeps untracked files; stash or `.gitignore`
  them first.

**Remaining open questions** (tracked in `00-progress.md`; none
block Phase 2 close beyond gates (1) + (2) above):
- #2 package-name discrepancy — resolved in spirit by vendoring, can
  be closed out.
- #3 dead `dcc.update` hook — coordinate with XCC maintainer.
- #4 stabilizing undocumented `game.dcc.*` pieces — Phase 3 concern
  (attack/crit migration is when those utilities are actually
  implicated).
- #5 patron-taint RAW alignment — Phase 2 close gate.
- #6 spellburn dialog integration — Phase 3 early-session pick-up.

Start by reading the five docs above, then run `npm test` to confirm
the repo is green before touching anything.
