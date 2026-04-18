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

**Status:** Phase 0 complete. Phase 1 in progress —
`rollAbilityCheck` is migrated to the adapter
(`_rollAbilityCheckViaAdapter` for the simple path,
`_rollAbilityCheckLegacy` as the fallback for rollUnder / modifier
dialog / CheckPenalty-display cases). `@moonloch/dcc-core-lib@0.3.0`
is vendored at `module/vendor/dcc-core-lib/`. The lib now uses a
tagged-union `RollModifier` (see `dcc-core-lib/docs/MODIFIERS.md`)
and exports async siblings (`rollAbilityCheckAsync`,
`rollSavingThrowAsync`, `rollCheckAsync`, `resolveSkillCheckAsync`,
`evaluateRollAsync`) for Promise-based roll machinery.
Run `npm run sync-core-lib` after any lib change to re-vendor.

**Phase 1 goal (continuation):** with `rollAbilityCheck` already
migrated, extend the same pattern to `rollSavingThrow` (easiest next),
then `rollSkillCheck`, then `rollInit`. Each is a small commit that
leaves the system shippable. See `docs/00-progress.md` → Next steps
for a worked-out per-roll plan.

The adapter flow is: `character-accessors.actorToCharacter` → lib's
async entry point (`rollSavingThrowAsync` / `rollCheckAsync`) with
`createFoundryRoller` injected → `chat-renderer` builds the
ChatMessage with the existing flag contract. Legacy fallback
(preserved verbatim in `_rollAbilityCheckLegacy`) exists for cases
the adapter can't yet handle — keep the same dual-track shape when
migrating saves/skills/init.

**No outstanding blockers for Phase 1 continuation.** The remaining
open questions in `00-progress.md` (#2 package-name discrepancy, #3
dead `dcc.update` hook, #4 stabilizing undocumented `game.dcc.*`
pieces) are Phase 2/3/4 concerns.

**Constraints:**
- Small commits; each leaves the system in a working state.
- Four sibling modules must keep working:
  `../../modules/{dcc-qol,xcc,mcc-classes,dcc-crawl-classes}`. The
  stable surface in `EXTENSION_API.md` is load-bearing.
- Add one vitest under `module/tests/` exercising the adapter
  round-trip against a mock actor before migrating the next roll
  (saves → skills → init).
- The pre-commit hook runs `npm run format && git add . && npm test`
  — that `git add .` sweeps untracked files, so stash or `.gitignore`
  them first.

Start by reading the three docs above. For the Phase 1 save-throw
migration, model the work on `module/actor.js` →
`_rollAbilityCheckViaAdapter` plus `module/__tests__/adapter-ability-check.test.js`.
Imports use `../vendor/dcc-core-lib/index.js`.
