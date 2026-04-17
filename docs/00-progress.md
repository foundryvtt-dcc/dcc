# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and after any
> significant decision. Future Claude sessions rely on this — without it,
> context is lost each time.

## Current phase

**Phase 0 — Prep.** Awaiting review of this session's work before Phase 1.

Per the 7-phase plan in `docs/dev/ARCHITECTURE_REIMAGINED.md §7`:
> Phase 0: fix halfling bug · add dcc-core-lib · adapter scaffolding ·
> document hooks + game.dcc exports.

## Done

### Session 2026-04-17 (first session)

- Created worktree `/Users/timwhite/WebstormProjects/dcc-refactor` on branch
  `refactor/dcc-core-lib-adapter` off `main` (`2337ec0`).
- Committed architecture doc at `docs/dev/ARCHITECTURE_REIMAGINED.md`
  (**32a5f79**).
- Wired `@moonloch/dcc-core-lib` via `npm link` (see §Decisions about the
  scoped name). Verified runtime resolution — library imports succeed.
- Created Phase 0 adapter stubs under `module/adapter/`:
  - `character-accessors.mjs` — Foundry actor shape → lib `Character` via
    `CharacterAccessors`
  - `foundry-roller.mjs` — wraps `DCCRoll.createRoll` as the lib's custom
    roller
  - `foundry-events.mjs` — bridges lib event callbacks to Foundry `Hooks`
  - `foundry-data-loader.mjs` — Foundry compendia → lib's table /
    progression registries
  - `chat-renderer.mjs` — library result objects → Foundry `ChatMessage`
  - Each contains only a header JSDoc explaining its role. No behavior.
- Audited every emitted hook in `module/` and every `game.dcc.*` export
  against the four sibling modules (dcc-qol, xcc, mcc-classes,
  dcc-crawl-classes) plus content packs. Published as
  `docs/dev/EXTENSION_API.md` with each item tagged **stable**,
  **internal**, or **dead**.
- Halfling i18n fix carried in via `main` — merged as commit `2337ec0`
  before the branch was created, so no extra work needed this session.

## In progress

Nothing carrying over.

## Blockers / open questions

1. **Runtime loading strategy.** The system has **no existing build
   pipeline** (no Rollup / Vite / esbuild). `package.json`'s `main` is
   `module/dcc.js`, which Foundry loads directly; there's no bundler to
   pull `@moonloch/dcc-core-lib` in from `node_modules`. Before Phase 1
   imports any lib code at runtime, one of the following needs to be
   decided:
   - **(a)** Add a bundler (Rollup/Vite) — new build step, but standard
     for modern JS systems.
   - **(b)** Ship the lib's `dist/` under `module/vendor/dcc-core-lib/`
     and import via relative path. No build step; requires a sync step
     when the lib updates.
   - **(c)** Symlink the lib's `dist/` into `module/vendor/` in dev, and
     copy on release.
   Recommendation TBD. Flagging for Tim.

2. **Package name discrepancy.** The architecture doc and setup instructions
   refer to `dcc-core-lib`, but the actual npm package name is
   `@moonloch/dcc-core-lib` (scoped). Imports use the scoped name. The
   unscoped name is not currently published, so CI currently *cannot*
   `npm install` the lib — only `npm link` works. This is entangled with
   the runtime-loading question.

3. **Dead hook `dcc.update`.** XCC listens for this hook
   (`modules/xcc/module/xcc.js:525`), but nothing in the DCC system
   emits it. Either it was removed at some point, or XCC added it
   speculatively. Decide: add the emission back, or coordinate with
   XCC maintainers to remove the listener. Documented in
   `EXTENSION_API.md §Dead`.

4. **Undocumented `game.dcc.*` pieces with heavy XCC usage.** XCC reaches
   into `game.dcc.DCCRoll.cleanFormula`, `game.dcc.DiceChain.bumpDie`,
   `calculateCritAdjustment`, `calculateProportionalCritRange`, and the
   full `FleetingLuck` class (`init`, `updateFlags`, `give`, `enabled`,
   `automationEnabled`). These are now tagged **stable** — removing or
   renaming them breaks XCC. Formal stabilization before Phase 3
   (attack/crit migration) is required because that's where those
   utilities are implicated.

## Decisions made

1. **Worktree location.** Parked at
   `/Users/timwhite/WebstormProjects/dcc-refactor`, not under
   `FoundryVTT/Data/systems/` — siblings inside `systems/` are picked up
   by Foundry as separate game systems and would clash on `system.json`
   id.
   *Why:* avoids Foundry startup conflicts and keeps the refactor
   invisible to Foundry until we copy it over.

2. **No `package.json` dependency entry this phase.** Adding
   `"@moonloch/dcc-core-lib": "file:../../../WebstormProjects/dcc-core-lib"`
   would break CI (absolute path, ubuntu runner), and `"*"` or any
   registry version fails because the package is unpublished. Chose to
   leave `package.json` alone and document `npm link` in this log.
   Revisit when open question #1 is resolved.

3. **Adapter stubs are empty by design.** The goal of Phase 0 is to lock
   in the *shape* of the adapter layer (which concerns live where) and
   catch any architectural objections before implementation starts in
   Phase 1. Empty stubs give reviewers a file-tree to react to; filled
   stubs would invite relitigation on boilerplate.

4. **Hook categorization method.** "Stable" = emitted *and* actively
   consumed by a sibling module. "Internal" = emitted but no external
   consumer found in the audited modules. "Dead" = listened to
   externally but never emitted (or vice versa). Tagged per-item in
   `docs/dev/EXTENSION_API.md`.

## Next steps

**Stop. Do not start Phase 1 until Tim signs off on Phase 0.**

When Phase 1 kicks off (per architecture doc §7.2):

1. Resolve open question #1 (runtime loading). Whatever the decision,
   land it in a small prep commit so Phase 1's import statements have
   somewhere to import *from*.
2. Start with the easiest roll to migrate: `rollAbilityCheck` →
   `rollCheck('ability:str', character, …)`. Wire it through:
   `character-accessors.mjs` → `foundry-roller.mjs` → the lib → result
   back through `chat-renderer.mjs`. Keep the existing
   `DCCActor.rollAbilityCheck` as a thin wrapper so dcc-qol /
   token-action-hud-dcc keep working.
3. Add one vitest case under `module/tests/` that exercises the whole
   adapter round-trip against a mock actor, to lock the contract before
   migrating the next roll.
4. Repeat for saves, then skill checks, then init. Ship each as a
   separate commit; each should leave the system in a working state.

## Notes for future sessions

- The pre-commit hook runs `npm run format` → `git add .` → `npm test`.
  That `git add .` **will sweep untracked files into the commit**. Before
  committing, either stash or add to `.gitignore`.
- `npm link @moonloch/dcc-core-lib` must be re-run if `node_modules/`
  is ever wiped. The source of truth is
  `/Users/timwhite/WebstormProjects/dcc-core-lib` (it's co-evolving; do
  not pin to a published version).
- Sibling modules that must keep working:
  - `../../modules/dcc-qol` — attack hook consumer, reaches into
    `DiceChain.bumpDie` + `DCCRoll.createRoll`
  - `../../modules/xcc` — heaviest consumer; variant game fighting the
    system (replaces `CONFIG.Actor.documentClass` globally)
  - `../../modules/mcc-classes` — clean schema-hook consumer
  - `../../modules/dcc-crawl-classes` — clean schema-hook consumer
