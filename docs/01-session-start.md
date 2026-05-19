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

## Status (2026-05-18)

**Phase 5 session 1 opened Phase 5 with the `registerClassDefaults`
registry + helper.** New stable extension hook
`game.dcc.registerClassDefaults(classId, defaults)` and companion
`applyClassDefaults(actor, classId)` helper in
`module/extension-api.mjs`. `CONFIG.DCC.classDefaults = {}` seeded in
`module/config.js`. Each entry packages the `_prepareContext` first-open
writes the legacy class-sheet subclasses inlined: `sheetClass`
(capitalized sentinel that drives the initial-setup-vs-maintenance
dispatch), `localize` (i18n keys for `class.className`), `enrichHtml`
(i18n keys for `class.classLink` + optional `mightyDeedsLink` /
`spellcastingLink` / `spellburnLink`), and `literal` (scalar mechanical
defaults — critRange, attackBonusMode, addClassLevelToInitiative,
spellCheckAbility, showBackstab / showSpells,
`skills.shieldBash.useDeed`). `applyClassDefaults` returns
`'initialized' | 'regenerated' | 'unchanged'` so the dwarf sheet's
still-inline ShieldBash auto-create gates on `'initialized'`. Seven
built-in PC entries (cleric/dwarf/elf/halfling/thief/warrior/wizard)
seeded via `module/built-in-class-defaults.mjs` consumed by
`module/dcc.js:init` only. All 7 PC sheets in
`module/actor-sheets-dcc.js` shrunk to a single
`applyClassDefaults(this.options.document, '<classId>')` call — net
156 lines deleted; `TextEditor` import dropped. Generic sheet stays
untouched. **983 Vitest green**, **122 Playwright passed** (1 latent
xcc-core-book failure, unchanged baseline).

**Latent gap surfaced (NOT fixed):** warrior + dwarf
`class.mightyDeedsLink` and wizard `class.spellcastingLink` /
`class.spellburnLink` writes don't surface on `system.class.*` because
no schema field registers them (only `class.classLink` is, via a
sibling `dcc.definePlayerSchema` hook). The legacy sheets have been
writing these stripped values forever; refactor is byte-for-byte
equivalent. Follow-up in `02-slice-backlog.md`.

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

**Phase 5 session 1 (2026-05-18) opened Phase 5.** Pick one of these
candidates (Tim picks; default is the smallest blast radius first):

1. **`registerClassStartingItems` for the dwarf ShieldBash
   (smallest scope).** Lift the still-inline dwarf ShieldBash
   auto-create at `module/actor-sheets-dcc.js` (gated on the
   `'initialized'` return from `applyClassDefaults`) onto a new
   `registerClassStartingItems({ classId, items })` registry. May
   fold into `registerClassDefaults` instead — decide at slice time.
2. **Add the link fields to the base Player schema (smallest scope).**
   Fix the latent gap surfaced by Phase 5 session 1: add
   `classLink`, `mightyDeedsLink`, `spellcastingLink`, `spellburnLink`
   as base-body fields in `module/data/actor/player-data.mjs`. After
   that, the `applyClassDefaults` writes surface on `system.class.*`
   and templates render correctly. Low risk; pure schema add.
3. **`registerSheetPart` + `DCCSheet` collapse (largest scope).**
   Collapse the 7 PC sheet subclasses (each with `CLASS_PARTS` +
   `CLASS_TABS` statics) into a single composable `DCCSheet`
   consuming a new `game.dcc.registerSheetPart` registry. Sheet
   markup changes — run visual regression alongside.
4. **Migrate the remaining capitalized `sheetClass` readers** (Elf
   at `actor.js:182`; Cleric at `actor.js:2180` / `actor.js:2481` /
   `dcc.js:746`) to `actor.classId`. Bundle with #3.

**Also pending — dcc-qol sibling-fix coordination.** Session 20
shim removal leaves dcc-qol's `attackRollHooks.js:283-284` reading
fields that no longer emit. A 2-line rename is documented as a
migration recipe in `EXTENSION_API.md`. Tim is landing the dcc-qol
PR on his schedule — do NOT edit that repo from this session.

Ask Tim which to pick.

**Do NOT:** touch lib-side internals (Phase 6 work); break
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
