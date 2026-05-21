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
2. `docs/02-slice-backlog.md` — prioritized executable worklist; the
   next slice(s) come from the top of the active queue.
3. `docs/dev/ARCHITECTURE_REIMAGINED.md` — read §2 (pain points the
   refactor addresses), §7 (the 7-phase plan), and §8.6 (legacy-path
   retirement principle — Foundry-facing API stays as thin wrappers,
   `_xxxLegacy` branches retire once gate is exhaustive).
4. `docs/dev/EXTENSION_API.md` — what sibling modules consume (stable /
   internal / dead).
5. `docs/dev/CLASS_DECOMPOSITION.md` — per-class component map for the
   Phase 4–6 arc (which extension API owns schema mixins, sheet parts,
   defaults, starting items, lib progression, variants — plus per-class
   status table). Read before relocating any class-bound concern.
6. `docs/dev/TESTING.md` — testing tiers; `#browser-tests-playwright`
   covers the e2e launch recipe (fvtt CLI installPath / dataPath /
   Node 24 / world name gotchas).
7. `/Users/timwhite/WebstormProjects/dcc-core-lib/docs/MODIFIERS.md` —
   lib-side design doc for the tagged-union `RollModifier` type the
   adapter emits and consumes.

**Detailed phase histories** (don't read unless you need a specific
session's context):
- [phase-0-1.md](dev/progress/phase-0-1.md) scaffolding + simple rolls
- [phase-2.md](dev/progress/phase-2.md) spell-check migration
- [phase-3.md](dev/progress/phase-3.md) attacks/damage/crit/fumble + cruft
- [phase-4.md](dev/progress/phase-4.md) data-model slimming
- [phase-5.md](dev/progress/phase-5.md) sheet composition (in progress)

## Status (2026-05-20)

**Phase 7 session 1 opened the Phase 7 cleanup arc** by extracting the
four Handlebars helpers (`add`, `stringify`, `distanceFormat`,
`dccPackExists`) out of `module/dcc.js`'s `init` hook into a focused
module `module/handlebars-helpers.mjs`. Each helper is exported
individually plus a `registerDCCHandlebarsHelpers()` entry-point the
init hook calls in place of the four inline `Handlebars.registerHelper(...)`
blocks. Pure refactor — every template that uses these helpers sees
identical behavior. The session also reconciled the Phase 7 work list
against the source at session start: items 1 (`critText`/`fumbleText`
shim retirement) + 2 (pre-V14 migration pruning) were already done in
2026-04 (C1 + C2 chore slices); item 5 (extract `module/ruleset/`) is
a no-op because the directory doesn't exist on this branch. Remaining
Phase 7 work is items 3 (`dcc.js` piecemeal split — this slice is the
first extraction; next candidates are macros / settings-table hooks /
`processSpellCheck` / chat-and-hook wiring / table loading) and 4
(`styles/dcc.scss` partials + theme contract). +12 Vitest tests
in new `module/__tests__/handlebars-helpers.test.js` (per-helper
coverage + a registration assertion against a mocked
`Handlebars.registerHelper`); +1 Playwright case in
`extension-api.spec.js` asserting the four helpers survive the
extraction and produce identical outputs against the live
`Handlebars.helpers` table. **1065 Vitest green** (was 1053, +12);
**143 Playwright passed** + 1 latent xcc-core-book DCCItemSheet
override (unchanged baseline; same failure flagged every prior
session). Phase 6 session 5's "Playwright count to be confirmed by
post-slice full-suite run" is also retroactively closed at 142
pre-Phase-7 → 143 post-this-slice.

**Phase 6 session 4 closed the flake-investigation follow-up.**
The session-start prompt called out two suite-only Playwright
flakes — `extension-api.spec.js:553 built-in elf mixin attaches…`
and `phase1-adapter-dispatch.spec.js:922 forceCrit shift-click
flag…` — observed in Phase 6 sessions 1 and 2 but not in session 3,
and not in two pre-fix full-suite runs this session. The runs *did*
surface a different failure pattern in the same environmental-race
family: run 2 produced `beforeEach`-level timeouts at
`extension-api.spec.js:267 + 302` (waiting on `game.user` for 30s)
plus `v14-features.spec.js:540` blocked by the persistent hardware-
acceleration notification banner intercepting a tab click. The slice
fills the gap behind those failures: `extension-api.spec.js` was the
*only* e2e spec lacking the per-test `#notifications .notification`
banner-removal + `ui.windows` cleanup the other three specs
(`data-models`, `phase1-adapter-dispatch`, `v14-features`) all
carry. The enhanced `beforeEach` closes any open ApplicationV2
windows, removes notification banners, and purges stale `P*` actor
probes from failed prior runs. +1 self-verifying Playwright case
`beforeEach hygiene purges stale state before the test body runs`
asserts the three invariants (no open windows, no notification
banners, no stale `P\d` actors) hold at the start of each test —
turns the hygiene into a contract. **Honest framing in slice
narrative**: the change addresses the *family* of environmental
races, NOT the specific elf:553 / forceCrit:922 test bodies that
didn't reproduce in either pre-fix run or the post-fix run. **1030
Vitest green** (unchanged — Vitest isn't affected). **141
Playwright passed** (was 140 baseline + 1 new hygiene test). One
latent failure (xcc-core-book DCCItemSheet override, now at line
127 because the new test shifted line numbers — was line 78
pre-slice; baseline unchanged). All previously-flaked tests passed
this run: elf:553, forceCrit:922, extension-api:267+302,
v14-features:540. Did NOT migrate the spec to the worker-scoped
session-reuse fixture pattern that `phase1-adapter-dispatch` uses
— blast radius too large for one slice; tracked as a possible
follow-up.

**Phase 6 session 3 opened the level-name registry to homebrew
modules.** New stable extension hook
`game.dcc.registerHomebrewClassForProgressionLoad(classId, itemPrefix)`
in `module/extension-api.mjs`; `CONFIG.DCC.classLevelNames = {}`
seeded in `module/config.js`. The Phase 6 session 2 loader at
`module/adapter/foundry-data-loader.mjs` previously hardcoded the
seven canonical PC classes in a module-private
`BUILT_IN_CLASS_LEVEL_NAMES` const — that table is gone, the
loader reads `CONFIG.DCC.classLevelNames` instead. New
`module/built-in-class-level-names.mjs` seeds the seven built-ins
through the same helper at `init` time. Sibling content modules
with homebrew classes ship a level-data pack via
`CONFIG.DCC.levelDataPacks.addPack(...)` + a
`registerHomebrewClassForProgressionLoad(...)` call from their own
`init` hook; the loader picks them up at `dcc.ready` without
editing system source. classId → itemPrefix indirection lets a
homebrew classId like `'my-druid'` map onto a pack whose items
ship under a different prefix (e.g. `'druid-1'`). +10 Vitest tests
(7 helper + 3 loader-gating). +2 Playwright cases. **1030 Vitest
green** (was 1020, +10).

**Phase 6 session 2 wired the compendium → lib-registry loader.**
New `registerClassProgressionsFromPacks(...)` in
`module/adapter/foundry-data-loader.mjs` walks
`CONFIG.DCC.levelDataPacks` at `dcc.ready`, parses each
`{ClassName}-{level}` item's `system.levelData` text, maps the
Foundry-system-paths onto the lib's `ProgressionLevelData` shape,
and calls `registerClassProgressions(...)`. The lib's consumer
APIs (`getSavingThrows`, `getCritDie`, `getSaveBonus`,
`getClassProgression`) now return non-zero values for actors in
worlds where a content module ships level data (dcc-core-book
ships one for the 7 canonical PC classes; sibling content
modules can ship their own).

The loader uses the existing level-data-items extensibility
mechanism — single source of truth between the level-change
dialog and the lib registry. Homebrew classes that ship their
own level packs (registered via
`CONFIG.DCC.levelDataPacks.addPack(...)`) get picked up
automatically once a name→classId entry is added to
`BUILT_IN_CLASS_LEVEL_NAMES` (or via a future
`registerHomebrewClassForProgressionLoad`-style helper landing
alongside `registerVariant`).

Closes the remaining half of PR #720's "programmatic PC
creation produces inconsistent class config" item. +15 Vitest
tests in new `module/__tests__/foundry-data-loader.test.js`
(parser, mapper, assembler — all fixtures use unambiguously
placeholder values like `d13`, save bonuses 7/9/11, 'TEST' crit
table — values that obviously don't match any official
progression). +1 Playwright case in `extension-api.spec.js`
(structural-shape assertions only, no value claims). **1020
Vitest green** (was 1005, +15). **136 Playwright passed** (was
135, +1 new from this slice). One new suite-only flake observed
(`extension-api.spec.js:553 built-in elf mixin attaches…` —
passes in isolation; not slice-caused). Latent xcc-core-book
DCCItemSheet override unchanged baseline.

The open-source DCC system continues to ship no class
progression data; data lives in user-installed content modules
per `ARCHITECTURE_REIMAGINED.md §8.1`.

**Phase 6 session 1 opened Phase 6** by exposing the vendored
lib's class-progression registration helpers on `game.dcc.*`.
Two-line addition to `module/dcc.js` imports
`registerClassProgression` + `registerClassProgressions` from
`module/vendor/dcc-core-lib/data/classes/progression-utils.js`
and adds them alongside the other Phase 4/5 registry helpers.
The lib's consumer APIs (`getSavingThrows`, `getCritDie`,
`getSaveBonus`, `getClassProgression`) have been in the vendored
bundle since before the vendor sync; this slice just makes the
*registration* surface reachable from sibling content modules
without forcing them to import a vendored-lib internal path.

The class progression data itself is copyrighted Goodman Games
material that lives in the private `dcc-official-data` repo
(per `ARCHITECTURE_REIMAGINED.md §8.1`). The open-source DCC
system ships only the registration surface; content modules
(a future `dcc-core-book` update, sibling content packs)
register their data on their own schedule. PR #720's
"programmatic PC creation produces inconsistent class config"
item is *partially* closed by this slice — full closure waits
on a content module to actually invoke the helper with a
complete progression payload. +2 Vitest tests (helpers
importable from vendored lib; fictional round-trip with
cleanup), +2 Playwright cases (helpers exposed on live
`game.dcc`; end-to-end round-trip using a fictional class).
**1005 Vitest green** (was 1003, +2). **135 Playwright passed**
(was 134, +2 new from this slice; one new flake observed —
`phase1-adapter-dispatch.spec.js:922 forceCrit shift-click flag…`
fails under the full-suite run but passes in isolation. State
pollution between tests in the shared Foundry world; not caused
by this slice. Latent xcc-core-book DCCItemSheet override
failure unchanged baseline).

**Phase 5 session 5 closed the Phase 5 sub-arc** by migrating the
four remaining capitalized `system.details.sheetClass ===
'<Class>'` readers in module source to the lowercase canonical
`actor.classId` accessor. Mechanical: elf at `actor.js:198`,
cleric at `actor.js:2196` (sheetClass leg only — keeps the
`className === 'Cleric'` widening), `actor.js:2497`, and
`dcc.js:775`. `actor-sheets-dcc.js` retains its
`sheetClass !== 'Generic'` first-open check (Generic isn't
class-bound; can't use classId). +1 Vitest regression guard in
`class-dispatch-i18n-guard.test.js` walks module source and
fails on any future re-introduction of the
`sheetClass === '<CapitalizedClass>'` pattern. **1003 Vitest
green** (was 1002, +1). **134 Playwright passed** (unchanged
from session 4; this slice's only new test is the Vitest
regression guard).

**Phase 5 session 4 (2026-05-18) shipped `registerSheetPart` +
collapsed the 7 PC sheets onto a `DCCSheet` base.** New
`game.dcc.registerSheetPart(classId, descriptor)` in
`module/extension-api.mjs`; `CONFIG.DCC.sheetParts = {}` seeded.
Each entry is `{ parts, tabs }` mirroring ApplicationV2's `PARTS`
+ `TABS` statics. Seeded for all 7 PC classes via
`module/built-in-sheet-parts.mjs`. New `DCCSheet` intermediate
base class in `module/actor-sheets-dcc.js` exposes inherited
static getters that resolve `CLASS_PARTS` + `CLASS_TABS` from
`CONFIG.DCC.sheetParts[this.CLASS_ID]`; each per-class subclass
shrinks to a 4-line stub pinning `static CLASS_ID = '<classId>'`.
`actor-sheets-dcc.js` 466 → 235 lines (-49%). All 7 sheet classes
stay registered with original names — no UX regression for the
"Configure Sheet" picker, existing `flags.core.sheetClass` values
still resolve. Generic sheet stays separate (different shape,
not class-bound). +6 Vitest, +5 Playwright. **1002 Vitest green**
(was 996, +6). **134 Playwright passed** (was 129, +5; 1 latent
xcc-core-book failure, unchanged baseline). Visual regression
suite couldn't run in this session's environment (expects a v12
baseline world per its `start-foundry` script, not v14).

**Phase 5 sessions 1–3 (2026-05-18)** shipped the
`registerClassMixin` / `registerClassDefaults` /
`registerClassStartingItems` registries + link-field schema add.
All four Phase 5 per-class extension hooks are now live; all 7
DCC built-in classes use the registries end-to-end. Detail in
[phase-5.md](dev/progress/phase-5.md) when entries rotate.

**Phase 4 (data-model slimming, closed 2026-05-18):** all 7 DCC
classes mixin-source their fields via the
`BUILT_IN_CLASS_MIXINS` table; `DCCActor.classId` getter normalizes
`system.details.sheetClass` to lowercase canonical ID for dispatch.
Detail in [phase-4.md](dev/progress/phase-4.md).

**Phase 3 (attacks/damage/crit/fumble, closed 2026-05-17):** every
`rollWeaponAttack` downstream call is single-path through
`dcc-core-lib`; `_xxxLegacy` retired for attack/crit/fumble/damage. A
generalized `promptRollModifierDialog` adapter scaffold (skill +
spell-check, including spellburn) shipped in sessions 26/27. Detail
in [phase-3.md](dev/progress/phase-3.md).

## Standing infrastructure the next session builds on

- **Dispatchers** (`DCCActor.rollSpellCheck`, `rollToHit`,
  `_rollDamage`, `_rollCritical`, `_rollFumble`): all single-path
  through adapter for the common case; legacy fallbacks gated by
  `reason=…` log codes.
- **Adapter modules**: `module/adapter/{character-accessors,
  foundry-roller, chat-renderer, spell-input, spell-events,
  attack-input, attack-events, damage-input, crit-fumble-input,
  roll-dialog, debug}.mjs`. `roll-dialog.mjs` carries the unified
  `promptRollModifierDialog` for both skill + spell checks.
- **Extension API** (`module/extension-api.mjs`): `registerItemSheet`,
  `registerActorSheet`, `registerClassMixin` + `applyClassMixins`,
  `registerClassDefaults` + `applyClassDefaults` (Phase 5 session 1
  addition). All stable; see `docs/dev/EXTENSION_API.md`.
- **Built-in registrations**: `module/built-in-class-mixins.mjs` (schema
  fields), `module/built-in-class-defaults.mjs` (sheet defaults). New
  classes/changes edit these tables; production init + integration-test
  setup (mixins only) consume them through shared helpers.
- **Dispatch logging** (`module/adapter/debug.mjs` +
  `logDispatch(rollType, 'adapter'|'legacy', details)`) is PERMANENT —
  the Playwright adapter-dispatch spec asserts on the log lines. Every
  `_xxxViaAdapter` / `_xxxLegacy` must `logDispatch(...)` as its first
  line. Silent fallbacks emit a `reason=<camelCaseTag>` field so the
  Foundry console is self-documenting.
- **`@moonloch/dcc-core-lib`** vendored at `module/vendor/dcc-core-lib/`.
  Lib updates: bump in `/Users/timwhite/WebstormProjects/dcc-core-lib`,
  then `npm run sync-core-lib` here (commit the vendor delta separately).
- **`dcc.modifyAttackRollTerms`** is dcc-qol's primary integration
  point. Fires inside `rollToHit` (single-path adapter body) before the
  Roll evaluates. Pushed Modifier terms + in-place die-bumps both
  surface on the lib's `libResult.bonuses` / `libResult.die`. Do NOT
  break this hook — dcc-qol depends on it.

## Lib-vs-rules divergence rule (canonical example)

The lib's `getTwoWeaponPenalty` returns flat `-1`/`-2`, but DCC RAW
uses dice-chain reductions on the action die instead. We deliberately
do NOT set `AttackInput.twoWeaponPenalty`; the bumped `actionDie` from
`item.js:prepareBaseData` flows through, and the lib computes the
attack on the bumped die. **Don't silently translate divergence —
surface it instead.** If a lib contract contradicts a rule already
correctly implemented in Foundry, stop the slice and surface to Tim
(memory `feedback_lib_vs_rules_stop_and_verify`).

## Next-session guidance

**Phase 7 session 1 (2026-05-20) opened the Phase 7 cleanup arc** by
extracting the four Handlebars helpers (`add`, `stringify`,
`distanceFormat`, `dccPackExists`) from `module/dcc.js`'s init hook
into `module/handlebars-helpers.mjs`. Phase 7 status reconciled
against the source: items 1 (`critText`/`fumbleText` shim retirement)
and 2 (pre-V14 migration pruning) were already done in 2026-04 as the
C1 + C2 chore slices; item 5 (extract `module/ruleset/`) is a no-op
because the directory doesn't exist on this branch. Remaining Phase 7
work is items 3 (`dcc.js` piecemeal split) and 4 (`styles/dcc.scss`
partials + theme contract).

**Next-slice candidates for `module/dcc.js` split** (~1655 lines
remaining after this session's extraction; per
`ARCHITECTURE_REIMAGINED.md Appendix A`, target ~4–5 focused modules).
Pick one per session — do NOT bundle multiple into one slice.

1. **Macro factories** (lines 1289–1671 — ~380 lines). 13
   `_createDCCXxxMacro` helpers + `createDCCMacro` +
   `rollDCCWeaponMacro` + `getMacroActor` + `getMacroOptions`. Largest
   cohesive block; isolated (no init coupling). Suggested
   destination: `module/macros.mjs`.
2. **Settings-table hooks** (lines 954–1041 — ~90 lines). The eight
   `Hooks.on('dcc.registerXxxPack')` / `Hooks.on('dcc.setXxxTable')`
   handlers. Self-contained hook wiring; suggested destination:
   `module/settings-table-hooks.mjs`.
3. **`processSpellCheck`** (lines 664–866 — ~200 lines). The public
   stable API (`game.dcc.processSpellCheck`). Self-contained but
   touches more downstream behavior — confirm sibling-module
   consumption pattern survives before extracting.
4. **Chat / hook wiring** (lines 873–946 + scattered `Hooks.on(...)`
   blocks). `renderChatMessageHTML`, context-menu options.
5. **Table loading** (lines 442–650). `setupCoreBookCompendiumLinks`,
   `registerTables`, `getSkillTable`, related `diceSoNiceReady` /
   `importAdventure` hooks.

After the `dcc.js` split lands its biggest chunks, item 4 (split
`styles/dcc.scss` ~2979 lines into partials + theme layer) opens up
as the second Phase 7 arc.

**Possible follow-up (not on critical path):** migrate
`extension-api.spec.js` from per-test login to the worker-scoped
session-reuse fixture pattern in `phase1-adapter-dispatch.spec.js`
(`sessionPage` fixture, login once per worker). Eliminates ~60 per-
test login overheads + the per-test login race. Larger blast
radius; tracked here in case future runs surface more login-race
failures.

**Also pending — dcc-qol sibling-fix coordination.** Session 20
shim removal leaves dcc-qol's `attackRollHooks.js:283-284` reading
fields that no longer emit. A 2-line rename is documented as a
migration recipe in `EXTENSION_API.md`. Tim is landing the dcc-qol
PR on his schedule — do NOT edit that repo from this session.

Pick a Phase 7 dcc.js extraction from the candidates above and
confirm with Tim before starting. The macro factories (1) are the
largest cohesive block; the settings-table hooks (2) are the
smallest well-scoped next-slice. `processSpellCheck` (3) is the
public-stable API extraction — landing it preserves
`game.dcc.processSpellCheck` as a thin wrapper per §8.6.

**Do NOT:** touch lib-side internals (Phase 6/7 work is
adapter-side cleanup, not lib changes); break
`dcc.modifyAttackRollTerms` (dcc-qol consumer); silently translate
lib-vs-rules divergence — surface it instead.

## Before touching code, confirm the repo is green

- `npm test` — Vitest unit + integration suites.
- `npm run test:unit` — mock-only; runs everywhere.
- `npm run test:integration` — skips if Foundry isn't detected.
- **Dice-engine-gated tests** only run if `.foundry-dev/client/dice/`
  exists. If missing, run `npm run setup:foundry` once; otherwise the
  dice cases skip (not fail).

## Browser tests (required for refactor slices)

See `docs/dev/TESTING.md#browser-tests-playwright` for the full recipe.
TL;DR — with the fvtt CLI's `installPath` / `dataPath` pointed at
`foundry-14` / `FoundryVTT-Next` (verify via
`npx @foundryvtt/foundryvtt-cli configure view`):

```
nvm use 24
nohup npx @foundryvtt/foundryvtt-cli launch --world=v14 \
  >/tmp/foundry-v14.log 2>&1 & disown
cd browser-tests/e2e && npm test
```

Close any manual Foundry browser tab first — a logged-in Gamemaster
disables the Playwright login and tests hang for 11 s each.

**Refactor-slice rules** (per `CLAUDE.md`):
- Run the FULL Playwright suite each session (not just the dispatch
  spec). Visual regression too if the slice touches sheet markup or
  chat templates.
- Every slice adds at least one new browser-test assertion exercising
  the new behavior end-to-end.

## Constraints

- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing.
- The pre-commit hook runs `npm run format && git add . && npm test`
  — the `git add .` sweeps untracked files; stash or `.gitignore`
  them first.
- Standing authorization on this branch (per `CLAUDE.md`): auto-commit
  + push refactor slices when tests are green using the format
  `feat(adapter): Phase <N> session <M> — <slice>`.

## Open questions

All closed as of 2026-05-18. See `docs/00-progress.md` "Closed
questions" for the ticks (#1 runtime loading, #2 package name, #3 dead
hook, #4 undocumented game.dcc.*, #5 patron taint, #6 spellburn
dialog, #7 wizard modifier-dialog).

Start by reading the docs above, then run `npm test` to confirm the
repo is green before touching anything.
