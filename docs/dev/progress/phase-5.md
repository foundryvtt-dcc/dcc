# Phase 5 — Sheet composition + class defaults + starting items

> Archive of session-by-session detail for Phase 5: collapsing the
> per-class PC sheet subclasses in `module/actor-sheets-dcc.js` (and the
> partials at `templates/actor-partial-*.html`) into composable
> registry entries. The Phase 4 schema-mixin arc already lifted
> per-class **field** definitions onto `game.dcc.registerClassMixin`;
> Phase 5 lifts the per-class **sheet-side** concerns:
>
> 1. **Class defaults** (`game.dcc.registerClassDefaults`) — class
>    identity (className, classLink, sheetClass, optional enriched-HTML
>    link blobs) + mechanical defaults (critRange, attackBonusMode,
>    addClassLevelToInitiative, spellCheckAbility, …) + skill-activation
>    toggles (notably `skills.shieldBash.useDeed`).
> 2. **Sheet parts** (`game.dcc.registerSheetPart`, planned) — tab /
>    template composition that today lives on each sheet subclass's
>    `CLASS_PARTS` + `CLASS_TABS` statics.
> 3. **Starting items** (`game.dcc.registerClassStartingItems`,
>    planned) — auto-created class equipment (today only the dwarf
>    ShieldBash weapon).
>
> See
> [`docs/dev/ARCHITECTURE_REIMAGINED.md §7 Phase 5`](../ARCHITECTURE_REIMAGINED.md)
> + [`docs/02-slice-backlog.md`](../../02-slice-backlog.md) for the
> slice plan and [`00-progress.md`](../../00-progress.md) for current
> state + open questions.

---

<!-- Sessions will land here as they rotate out of Recent slices. -->
