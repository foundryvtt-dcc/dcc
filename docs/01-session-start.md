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

## Status (2026-05-29)

**Phase 7 session 10 opened a three-slice PR #720 resilience
batch** (the backlog active queue having drained at session 9).
Session 10 closed the "four near-identical `dcc.libResult` flag
payloads" item: the four chat renderers in
`module/adapter/chat-renderer.mjs` (`renderAbilityCheck`,
`renderSavingThrow`, `renderSkillCheck`, `renderSpellCheck`) built
near-identical `dcc.libResult` flag literals plus an identical
guarded `FleetingLuck.updateFlags` block. The shared seven-field
core (`die` / `natural` / `total` / `formula` / `critical` /
`fumble` / `modifiers`) now lives in one exported
`buildLibResultFlag(result, extras = {})`, with callers passing
type-specific extras (`{ skillId }` for the three checks,
`{ spellId, tier, spellLost, corruptionTriggered }` for spell
checks), and the luck update in `applyFleetingLuck(flags,
foundryRoll)`. Pure structural — the on-message flag contract is
unchanged (consumed by key name, not order). +10 Vitest in new
`module/__tests__/chat-renderer.test.js`, +1 Playwright probe in
`extension-api.spec.js`. **1272 Vitest green** (was 1262),
**155 Playwright passed** (was 154), clean 5.8-min suite. The two
remaining batch slices (sessions 11 + 12): surface `migrateWorld`
per-doc failures via `ui.notifications.warn`, then consolidate the
three `normalizeLibDie` / `_stripDieCount` die-normalize copies.

**Phase 7 session 9 closed the PR #720 "Uncached compendium
walks" item** by adding a per-process table cache in a new
`module/adapter/table-cache.mjs` module and routing the four
table-loading sites through it:
`loadDisapprovalTable(actor)` + `loadMercurialMagicTable(classKey)`
in `spell-input.mjs`, and `getCritTableLink(suffix, displayText)`
+ `getCritTableResult(roll, critTableName)` in `utilities.js`.
Each site consults a module-level `Map` cache (keyed on
`tableName` / resolved table name / `critTableSuffix` /
`critTableCanonical`) before falling through to the resolver
helpers (`resolveDisapprovalTable`, `resolveMercurialMagicTable`,
`resolveCritTable`, `resolveCritTableLink`) which carry the
unchanged pack-walk → world-fallback logic. The two crit-table
caches separate the expensive lookup from the cheap per-call
work — `critTableLinkCache` stores the `@UUID[...]` prefix
WITHOUT the trailing `{displayText}` so the same suffix can
render with different labels at zero pack-walk cost, and
`critTableDocCache` stores the loaded RollTable doc so
`getResultsForRoll(roll.total)` runs per call. Invalidation is
global: `Hooks.on('createRollTable'|'updateRollTable'|'deleteRollTable')`
all call `clearAllTableCaches()` via
`registerTableCacheInvalidation()` wired in `module/dcc.js`
alongside the existing `registerSettingsTableHooks()` /
`registerTableLoadingHooks()` / `registerChatAndHookWiring()`
calls. The world-RollTable lifecycle events are rare enough
during play that uniform invalidation is cheaper than per-cache
relevance predicates. Pure refactor — cold-cache walks match
pre-slice behavior byte-for-byte; warm-cache walks short-circuit
before the first `game.packs.get(...)` call. The slice also
backfills the PR #720 "loadDisapprovalTable /
loadMercurialMagicTable isolated fallback-order tests" coverage
gap. **1262 Vitest green** (was 1227, +35: +16 in new
`module/__tests__/table-cache.test.js`, +9 in `utilities.test.js`,
+10 in `adapter-spell-check.test.js`). **154 Playwright
passed**, zero failures — clean 5.9-min full suite. +1 new
probe (`DCC adapter table caches short-circuit pack walks and
invalidate on world-RollTable events`) dynamic-imports the live
cache module, asserts the four caches + dispatch table shape,
seeds each cache, and confirms `Hooks.callAll('createRollTable',
...)`, real `probeTable.update(...)`, and `probeTable.delete()`
each drop every cache entry to size 0.

**Phase 7 session 8 (closed 2026-05-28)** migrated the 20
remaining hex literals across the new partials onto a documented
`--system-*` theming contract.
Twelve new CSS custom properties land in `styles/variables.css`:
six theme-agnostic semantic colors
(`--system-text-muted-color` `#666`, `--system-damage-color`
`#8b0000`, `--system-rollable-hover-color` `#000`,
`--system-flat-button-border-color` `#c9c7b8`,
`--system-two-weapon-primary-color` `#4caf50`,
`--system-two-weapon-secondary-color` `#d32f2f`) plus six
tab-overflow dropdown vars paired with dark-theme overrides
(`--system-tab-overflow-background` `#f0e8d8`/`#2a2a2a`,
`--system-tab-overflow-border-color` `#8b7355`/`#444`,
`--system-tab-overflow-text-color` `#4a3c2a`/`#ccc`,
`--system-tab-overflow-hover-background` `#e0d5c0`/`#3a3a3a`,
`--system-tab-overflow-hover-text-color` `#2a1f14`/`#fff`,
`--system-tab-overflow-active-text-color`
`var(--color-text-dark-primary)`/`#fff`). All 14 light-path
hex literals across seven partials (`_base.scss`, `_dialogs.scss`,
`_hit-points-dialog.scss`, `_skills.scss`, `_party-sheet.scss`,
`_tabs.scss`, `_weapons.scss`) are replaced with the matching
`var(...)` references. The 17-line
`body.theme-dark & .sheet-tabs.responsive-tabs .tabs-overflow
.tabs-overflow-menu` override block in `_tabs.scss` is deleted
— the dark cascade now flows through variable overrides in
`variables.css` rather than through a duplicate component
selector. Compiled `dcc.css` shrinks 64,741 → 64,502 bytes
(-239 net; still well inside the existing probe's 50-80KB
range), and the only structural diff vs. pre-slice HEAD is
exactly those 14 substitutions + the deleted dark-override
block. `docs/dev/ARCHITECTURE_REIMAGINED.md §7` is expanded
with a "Theming contract (`--system-*` CSS custom properties)"
subsection documenting each variable's role, light + dark
defaults, and the override pattern variants (XCC, MCC,
homebrew) should use (variants override variable *values*, not
component selectors). +1 Playwright case in
`extension-api.spec.js` (`DCC theming-contract --system-* vars
resolve to documented values in both themes`) asserts the
contract end-to-end via `getComputedStyle()` reads against
both `:root` and a transient `<div class="theme-dark">` probe
— no live-theme flip needed, so the test is robust to the
test user's theme choice. **1227 Vitest green** (unchanged —
CSS not loaded in unit tests). **152 Playwright passed** in
the full-suite run + 1 environmental flake at
`adapter-dispatch.spec.js:1898 halfling two-weapon fumble
note round-trips through adapter` (navigation race during
`rollWeaponAttack`; passes cleanly in isolation, 1.2s; not
slice-caused — this slice touches only CSS + variables + docs
+ the new probe). Pre-slice baseline was 152 (after the five
post-session-7 e2e refactor commits on main); +1 new test
nets the post-slice count at 153 with the flake passing in
isolation.

**Phase 7 session 7 (closed 2026-05-22)** opened the second
Phase 7 arc by splitting `styles/dcc.scss` (was 2979 lines in
one file) into 18 focused partials + a 34-line manifest. Each
partial maps 1:1 onto a contiguous line range from the pre-split
file; only adjacent sections are combined, preserving relative
rule order so specificity ties land identically. Compiled
`styles/dcc.css` was byte-identical to the pre-split build
(verified by diffing the post-compile output against a baseline
snapshot taken before the split). No theme-variable refactoring
that slice — handed off to session 8 above. **1227 Vitest
green** (unchanged), **150 Playwright passed**, zero failures
(11.9-min full suite).

**Phase 7 session 6 (extract chat / hook wiring — closed 2026-05-22).**
Eleven remaining `Hooks.on` / `Hooks.once` handlers
(`hotbarDrop`, `renderChatMessageHTML`,
`getChatMessageContextOptions`, `renderActorDirectory`,
`preCreate{Actor,Item}`, `applyActiveEffect`, `preUpdateActor`,
`updateCombat`, `item-piles-ready`,
`getProseMirrorMenuDropDowns`) relocated from `module/dcc.js` to
`module/chat-and-hook-wiring.mjs`. `dcc.js` 737 → 475 lines
(-262); §Appendix A target of ~4–5 focused modules met. +43
Vitest, +1 Playwright. 1227 Vitest / 149 Playwright at close.

**Phase 7 session 5 (extract table-loading — closed 2026-05-21).**
`setupCoreBookCompendiumLinks` / `registerTables` /
`getSkillTable` + five hook handlers (`diceSoNiceReady`,
`importAdventure`, plus the three world-RollTable lifecycle
hooks) relocated from `dcc.js` to `module/table-loading.mjs`.
`dcc.js` 970 → 737 lines (-233). +34 Vitest, +1 Playwright.
1184 Vitest / 146 Playwright at close.

**Phase 7 session 4 (extract `processSpellCheck` — closed
2026-05-21).** ~200-line `processSpellCheck` function relocated
from `dcc.js` to `module/spell-check-processor.mjs`. Stable
extension surface preserved via re-publication on
`game.dcc.processSpellCheck` at init. `dcc.js` 1172 → 970 lines
(-202). +23 Vitest, +1 Playwright. 1150 Vitest / 145 Playwright
at close.

**Phase 7 session 2 (extract macro factories — closed 2026-05-20).**
Hotbar-macro block (~380 lines, 13 `_createDCCXxxMacro` factories +
`MACRO_FACTORIES` dispatch table + `createDCCMacro` /
`rollDCCWeaponMacro` / `getMacroActor` / `getMacroOptions`)
relocated from `dcc.js` to `module/macros.mjs`. `dcc.js` 1655 →
1255 lines (-400). +37 Vitest, +1 Playwright. 1102 Vitest /
143 Playwright at close. Detail in `dev/progress/phase-7.md`
when the entry rotates out of `00-progress.md` Recent slices.

**Phase 7 session 1 opened the Phase 7 cleanup arc** by extracting
the four Handlebars helpers (`add`, `stringify`, `distanceFormat`,
`dccPackExists`) out of `module/dcc.js`'s `init` hook into a focused
module `module/handlebars-helpers.mjs`. Each helper is exported
individually plus a `registerDCCHandlebarsHelpers()` entry-point the
init hook calls in place of the four inline
`Handlebars.registerHelper(...)` blocks. Pure refactor — every
template that uses these helpers sees identical behavior. The
session also reconciled the Phase 7 work list against the source at
session start: items 1 (`critText`/`fumbleText` shim retirement) +
2 (pre-V14 migration pruning) were already done in 2026-04 (C1 + C2
chore slices); item 5 (extract `module/ruleset/`) is a no-op
because the directory doesn't exist on this branch. Remaining
Phase 7 work is items 3 (`dcc.js` piecemeal split — sessions 1
extracted handlebars helpers, session 2 extracted macros; next
candidates are settings-table hooks / `processSpellCheck` /
chat-and-hook wiring / table loading) and 4 (`styles/dcc.scss`
partials + theme contract). +12 Vitest, +1 Playwright at session 1
close — 1065 Vitest, 143 Playwright passed.

**Phase 6 session 4 closed the flake-investigation follow-up.**
The session-start prompt called out two suite-only Playwright
flakes — `extension-api.spec.js:553 built-in elf mixin attaches…`
and `adapter-dispatch.spec.js:922 forceCrit shift-click
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
(`data-models`, `adapter-dispatch`, `v14-features`) all
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
session-reuse fixture pattern that `adapter-dispatch` uses
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
`adapter-dispatch.spec.js:922 forceCrit shift-click flag…`
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

**Phase 7 session 9 (2026-05-28) closed the PR #720 "Uncached
compendium walks" item** by routing the four table-loading
sites through a per-process cache in
`module/adapter/table-cache.mjs`, with global invalidation on
world-RollTable CRUD events. The slice also backfilled the
matching "loadDisapprovalTable / loadMercurialMagicTable
isolated fallback-order tests" PR #720 coverage gap.

**Next-arc candidates.** Remaining PR #720 resilience items
(`00-progress.md` PR #720 backlog) are the most natural
follow-ups: consolidate the three copies of
`normalizeLibDie` / `_stripDieCount` across
`module/adapter/attack-input.mjs` / `module/adapter/spell-input.mjs` /
`module/actor.js`; extract a shared
`buildLibResultFlag(result, extras)` helper from the four
near-identical `dcc.libResult` flag payloads in
`module/adapter/chat-renderer.mjs`; or surface
`migrateWorld` per-doc failures via `ui.notifications.warn`
(C2 review item). Alternatively, broaden the adapter / mixin
pattern via a Group E vertical-slice (halfling vertical slice
or homebrew single-class slice). Appendix-A file-shrinkage
arcs for `actor.js` / `actor-sheet.js` / `item.js` /
`config.js` are real cruft but each is a multi-session
project, not a single slice — pick one only if the time
budget allows.

**Possible follow-up (not on critical path):** migrate
`extension-api.spec.js` from per-test login to the worker-scoped
session-reuse fixture pattern in `adapter-dispatch.spec.js`
(`sessionPage` fixture, login once per worker). Eliminates ~60 per-
test login overheads + the per-test login race. Larger blast
radius; tracked here in case future runs surface more login-race
failures.

**Possible follow-up (Playwright hygiene).** Session 5 surfaced a
`net::ERR_NETWORK_IO_SUSPENDED` /
`net::ERR_SOCKET_NOT_CONNECTED` environmental flake at
`v14-features.spec.js:128`, addressed by commit `1935372`
(network-error filter in `v14-features` `afterEach`). Session 4
surfaced an `mcc-core-book-welcome-dialog` flake at
`data-models.spec.js:138`. Session 6's clean 149/149 run suggests
both are resolved by the recent fix commits — if either
reappears, extending the `extension-api.spec.js`-style
`beforeEach` hygiene (close ApplicationV2 windows, remove
`#notifications .notification` banners, dismiss per-module
`.welcome-dialog` asides) to `data-models.spec.js` and
`v14-features.spec.js` is the proven remedy.

**Also pending — dcc-qol sibling-fix coordination.** Session 20
shim removal leaves dcc-qol's `attackRollHooks.js:283-284` reading
fields that no longer emit. A 2-line rename is documented as a
migration recipe in `EXTENSION_API.md`. Tim is landing the dcc-qol
PR on his schedule — do NOT edit that repo from this session.

**Do NOT:** touch lib-side internals (Phase 7 work is
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
