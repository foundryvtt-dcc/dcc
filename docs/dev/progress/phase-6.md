# Phase 6 — Lib-side class progression + variant registration

> Archive of session-by-session detail for Phase 6: exposing
> `dcc-core-lib`'s class-progression registry from the Foundry system
> so the lib's consumer APIs (`getSavingThrows`, `getCritDie`,
> `getSaveBonus`, `getClassProgression`) return non-zero values for
> actors, plus the variant-ruleset extension surface so XCC / MCC /
> future homebrew variants can declare their class IDs + sheet theme
> through `game.dcc.registerVariant({ id, label, classes,
> sheetTheme? })`.
>
> Per `ARCHITECTURE_REIMAGINED.md §8.1`, class progression *data* is
> copyrighted Goodman Games material living in the private
> `dcc-official-data` repo. The open-source DCC system ships only the
> registration surface; content modules (a future `dcc-core-book`
> update, sibling content packs) register their data on their own
> schedule. Phase 6 session 2 wires `registerClassProgressionsFromPacks`
> against `CONFIG.DCC.levelDataPacks` at `dcc.ready` so worlds that
> install a level-data-pack-shipping content module get the lib
> registry populated automatically.
>
> See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 6`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state + open questions.

---

- **2026-05-19 — Phase 6 session 1: expose
  `registerClassProgression` / `registerClassProgressions` on
  `game.dcc.*`.** Two-line addition to `module/dcc.js`: import the
  helpers from the vendored lib
  (`module/vendor/dcc-core-lib/data/classes/progression-utils.js`)
  and add them to the `game.dcc` object alongside the other
  Phase 4/5 registry helpers. The lib already implements the
  registry + consumer APIs (`getSavingThrows`, `getCritDie`,
  `getSaveBonus`, `getClassProgression`) — they've been there since
  before the vendor sync; this slice just makes the registration
  surface reachable from sibling content modules without forcing
  them to import a vendored-lib internal path. PR #720's
  "programmatic PC creation produces inconsistent class config"
  item is *partially* closed: the registration plumbing is now
  available. Full closure waits on a content module (a future
  `dcc-core-book` update, or sibling) to invoke the helper with
  a complete progression payload. The class progression data
  itself is copyrighted Goodman Games material living in the
  private `dcc-official-data` repo (per
  `ARCHITECTURE_REIMAGINED.md §8.1`); the open-source DCC system
  ships only the registration surface. +2 Vitest tests in
  `extension-api.test.js` (helpers importable from vendored lib;
  fictional round-trip with `clearClassProgressions` cleanup).
  1005 Vitest green (was 1003, +2). +2 Playwright cases in
  `extension-api.spec.js` (helpers exposed on live `game.dcc`;
  end-to-end round-trip registering a fictional class and reading
  it back via the lib's `getSavingThrows` consumer, with cleanup).
  EXTENSION_API.md gains a Stable row pair for both helpers +
  documents the "data lives in content modules, not core" pattern.
  No copyrighted material reproduced in this repo. 135 Playwright
  passed (was 134, +2 from this slice). One new suite-only flake
  observed: `phase1-adapter-dispatch.spec.js:922 forceCrit
  shift-click flag…` fails under the full-suite run but passes
  in isolation (verified by re-running the single test). State
  pollution between tests in the shared Foundry world; this slice
  adds no chat / roll / spell logic so it can't have caused the
  flake.
