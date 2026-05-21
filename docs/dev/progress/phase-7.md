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
