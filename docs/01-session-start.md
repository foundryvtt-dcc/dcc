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

**Status:** Phase 0 complete and signed off, plus the runtime-loading
prep work. Adapter stubs at `module/adapter/` are empty by design.
`@moonloch/dcc-core-lib` is vendored at `module/vendor/dcc-core-lib/`
(committed ~4.3 MB of built `dist/`). Source of truth is the
co-evolving checkout at `/Users/timwhite/WebstormProjects/dcc-core-lib`
— run `npm run sync-core-lib` to re-vendor after lib changes. Adapter
code imports via relative path
(`../vendor/dcc-core-lib/index.js`); the npm-link resolution is no
longer on the runtime path.

**Phase 1 goal:** migrate `DCCActor.rollAbilityCheck` to the lib via
the adapter layer. Flow: `character-accessors.mjs` →
`foundry-roller.mjs` → lib → result back through `chat-renderer.mjs`.
Keep `DCCActor.rollAbilityCheck` as a thin wrapper — dcc-qol and
token-action-hud-dcc depend on it.

**Runtime loading was resolved in the previous session** (option b,
vendor). No outstanding blocker for Phase 1 imports. The remaining
open questions in `00-progress.md` (#2 package-name discrepancy, #3
dead `dcc.update` hook, #4 stabilizing undocumented `game.dcc.*`
pieces) are Phase 2/3/4 concerns — don't need to block Phase 1.

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

Start by reading the three docs above, then begin Phase 1 with
`rollAbilityCheck`. Imports land as
`import { ... } from '../vendor/dcc-core-lib/index.js'`.
