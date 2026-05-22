# Phase 7 — Cleanup

> Archive of session-by-session detail for Phase 7: the formal
> cleanup window for the `refactor/dcc-core-lib-adapter` branch.
> Items per `ARCHITECTURE_REIMAGINED.md §7`:
>
> 1. ~~Retire `critText`/`fumbleText` compatibility shims.~~
>    Done as Phase 3 session 20 / C1 (2026-04-20).
> 2. ~~Prune pre-V14 migrations past the minimum data version.~~
>    Done as a chore(cruft) slice / C2 (2026-04-23).
> 3. Split `module/dcc.js` (~1655 lines after Phase 6 closes) into
>    focused modules — Handlebars helpers, macro factories,
>    settings-table hooks, `processSpellCheck`, chat / hook wiring,
>    table loading. Target ~4–5 files per Appendix A.
> 4. Split `styles/dcc.scss` (~2979 lines) into partials + theme
>    layer; document CSS custom properties as a theming contract so
>    the Phase 6 `sheetTheme` mechanism has documented variables to
>    override.
> 5. ~~Extract `module/ruleset/` into the variant config for DCC
>    core.~~ No-op — the directory doesn't exist on this branch
>    (already extracted, or never landed as a real module).
>    Confirmed 2026-05-20 at the Phase 7 kickoff.
>
> See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state.

---

- **2026-05-20 — Phase 7 session 1: extract Handlebars helpers from
  `dcc.js` into `module/handlebars-helpers.mjs` (opens Phase 7).**
  Pure refactor — moves the four helpers (`add`, `stringify`,
  `distanceFormat`, `dccPackExists`) out of the init hook and into
  a focused module exporting each helper individually plus a
  `registerDCCHandlebarsHelpers()` entry-point the init hook calls
  in place of the four inline `Handlebars.registerHelper(...)`
  blocks. ~20 lines removed from `dcc.js`'s init body; the file is
  still 1655 lines pre-future-extractions but the pattern for the
  remaining splits (macros, settings-table hooks, `processSpellCheck`,
  chat / hook wiring, table loading) is now established. The Phase 7
  work list was also reconciled against the source at session start:
  items 1 (`critText`/`fumbleText` retirement) + 2 (pre-V14 migration
  pruning) were already done as C1 + C2 chore slices in 2026-04;
  item 5 (extract `module/ruleset/`) is a no-op because the
  directory doesn't exist on this branch. Remaining Phase 7 work is
  the `dcc.js` piecemeal split (this slice) + the `styles/dcc.scss`
  partials split. +12 Vitest tests in new
  `module/__tests__/handlebars-helpers.test.js` (3 add cases:
  ints / string-coercion / negative; 2 stringify cases:
  object / array; 4 distanceFormat cases: trailing apostrophe / no
  apostrophe / negative / non-matching; 2 dccPackExists cases:
  pack-present + fn branch / pack-missing + inverse branch;
  1 `registerDCCHandlebarsHelpers` test asserting all four names
  register against a mocked `Handlebars.registerHelper`). +1
  Playwright case in `extension-api.spec.js` (`DCC Handlebars
  helpers (add / stringify / distanceFormat / dccPackExists) survive
  registerDCCHandlebarsHelpers extraction`) — reads
  `Handlebars.helpers.{add, stringify, distanceFormat, dccPackExists}`
  off the live page, invokes each (including dccPackExists with a
  real pack collection + a missing pack name), and asserts identical
  outputs to the pre-extraction inline definitions. **1065 Vitest
  green** (was 1053, +12). **143 Playwright passed** + 1 latent
  failure (the long-standing xcc-core-book DCCItemSheet override
  baseline at `extension-api.spec.js:162`, unchanged from every
  prior session). Phase 6 session 5's "Playwright count to be
  confirmed by post-slice full-suite run" can also be retroactively
  closed by this run — the pre-slice baseline was 142 passes (140
  pre-session-4 + 1 session-4 hygiene + 2 session-5 registerVariant
  cases minus 1 ongoing latent failure); this slice's +1 case lands
  the post-slice count at 143 passed.
