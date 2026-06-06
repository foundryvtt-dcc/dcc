# Refactor Progress — `refactor/dcc-core-lib-adapter`

> **Handoff artifact.** Update at the end of every work session and
> after any significant decision. Future Claude sessions rely on this.
>
> **Detailed session-by-session history lives in phase archives:**
> - [Phase 0 + 1 — scaffolding + simple rolls](dev/progress/phase-0-1.md)
> - [Phase 2 — spell check migration](dev/progress/phase-2.md)
> - [Phase 3 — attacks, damage, crit, fumble + cruft](dev/progress/phase-3.md)
> - [Phase 4 — data-model slimming + class-mixin extension surface](dev/progress/phase-4.md)
> - [Phase 5 — sheet composition + class defaults + starting items](dev/progress/phase-5.md)
> - [Phase 6 — lib-side class progression + variant registration](dev/progress/phase-6.md)
> - [Phase 7 — cleanup](dev/progress/phase-7.md)

## Archive discipline

**This file is the index, not the log.** Keep it scannable — session
narratives belong in the phase archives above. Rules for maintaining
the split:

- **End-of-session updates go here first**, in *Recent slices*
  (newest at top). Write the slice narrative at whatever detail level
  feels right to the author; don't pre-abbreviate.
- **When *Recent slices* passes 5 entries, push the oldest down to
  the relevant phase archive.** The archives are chronological
  within each phase — append the demoted entry at the end of its
  section. Don't delete anything. If the entry belongs to a phase
  that isn't yet archived (e.g., first Phase 4 slice), start
  `dev/progress/phase-N.md` with the existing archive header style
  and link it from the index above.
- **New phase boundaries** (a slice starts Phase 4 / 5 / 6 / 7) get
  a new archive file from day one. The first slice of a new phase
  lands in *Recent slices* like any other; the archive file exists
  ready to receive it when it rotates out.
- **What stays here indefinitely:** *Current phase* (≤2 paragraphs,
  rewritten each session if the situation moved), *Closed questions*
  (short ticks), *Blockers / open questions* (active only — move
  resolved ones to *Closed* with a one-line date stamp),
  *PR #N review backlog* (these are actionable and short-lived —
  prune fixed items with strikethrough + date, delete fully when
  a section is empty), *Decisions made* (durable — never archived),
  *Next steps*, *Notes for future sessions*.
- **What never goes here:** session-by-session narrative beyond the
  5 most recent, historical decision rationale that's already
  captured in a completed slice, test-count deltas from older
  sessions. If you catch yourself summarizing a session that's
  already in an archive, delete the summary and let the archive
  speak.
- **Cross-linking rule.** Every entry in *Recent slices* should fit
  in 3–6 lines. If the slice has architecturally interesting detail,
  put that detail in the archive and link from the *Recent slices*
  bullet, don't inline it here.
- **No dedup pass required between this file and `01-session-start.md`.**
  The session-start prompt is a self-contained handoff; it will
  drift from this file's *Current phase* summary by a sentence or
  two and that's fine. They're read in different contexts (fresh
  session vs. in-progress update). If they diverge meaningfully,
  treat *this file* as authoritative and refresh the session-start
  prompt when the next slice lands.

**Length check.** If `00-progress.md` creeps past ~600 lines, one of
the rules above is being ignored. The *PR #720 review backlog* is
the most likely offender — prune fixed items with strikethrough +
date, then delete them entirely once a whole sub-section is cleared.

## Current phase

**Phase 7 cleanup — latest 2026-06-06 (session 46).** Every PR #720 arc is
closed: legacy-decommission (sessions 21–25 — no `_xxxLegacy` roll body
survives; every public dispatcher is single-path through the adapter),
test-coverage backfill (26–31 — every PR #720 severity-≥6 gap closed or
found-stale, incl. the session-29 forceCrit dice-flake fix), doc/comment
hygiene (32), the programmatic-PC-creation doc (33), and the two
below-threshold perf items (34). **Sessions 35–39 ran the Appendix-A
`config.js` file-shrinkage arc** with five slices (monster tables →
`module/config/monster-data.mjs`; default-image tables →
`module/config/images.mjs`; dice config → `module/config/dice.mjs`;
`activeEffectKeys` → `module/config/active-effect-keys.mjs`; actor-importer
block → `module/config/actor-importer.mjs`), shrinking `config.js` 845 → 451.
**Sessions 40–42 opened + advanced the Appendix-A `item.js` arc** —
container-support → `module/item/container-mixin.mjs` (40), treasure-value/currency
→ `module/item/currency-mixin.mjs` (41), spell-roll (spell check + manifestation +
mercurial magic) → `module/item/spell-mixin.mjs` (42), composed as
`DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`;
`item.js` 975 → 339 (−636). **Session 43 opened the `actor-sheet.js` arc** by
extracting the four AE summary builders into `module/actor-sheet/effects.mjs` as
pure free functions (sheets can't use mixins for `#private` methods), `actor-sheet.js`
1890 → 1613. **Session 44 extracted `#prepareItems`** (the ~248-line inventory
categorizer) into `module/actor-sheet/items.mjs` as an "actor-logic → free
function" (it mutates the actor: zero-qty deletion, coin-treasure merge, icon
repair), Foundry globals injected via a `deps` param; `actor-sheet.js` 1613 →
1366. **Session 45 extracted the four small context-field helpers** (`#prepareNotes`
/ `#prepareCorruption` / `#prepareImage` / `#prepareCompendiumLinks`) into
`module/actor-sheet/presentation.mjs` as pure free functions (Foundry globals via
`deps`), `actor-sheet.js` 1366 → 1324. **Session 46 extracted `_onDragStart`**
(the ~210-line drag-payload switch — the biggest cohesive chunk left, and a plain
overridable method rather than `#private`) into `module/actor-sheet/drag-drop.mjs`
as the pure free function `buildDragStartData(actor, event)`, leaving the sole
side effect (`event.dataTransfer.setData`) in the thin sheet wrapper; `findDataset`
moved alongside it with `DCCActorSheet.findDataset` kept as a delegating static
(it's consumed cross-module by `party-sheet.js` + documented), `actor-sheet.js`
1324 → 1121. All were behavior-neutral with no lib change. Repo green on the final
run: **1544 Vitest passed**; **194 Playwright**
(193 passed + the documented `createEmbeddedDocuments`-under-load `#prepareItems`
flake, which passes in isolation). Per-session detail lives in *Recent slices* +
the [phase-7 archive](dev/progress/phase-7.md); the itemized close-outs are in
the *PR #720 review backlog* below.

**Appendix-A `config.js` data-table extraction is effectively complete (arc ran
sessions 35–39).** The pattern mirrored the Phase-7 `dcc.js` split: break the
big self-contained data tables in `config.js` into focused
`module/config/*.mjs` modules and let `config.js` import + re-compose them onto
the `DCC` object, keeping the public `CONFIG.DCC` shape byte-identical. Done:
`monster-data.mjs` (35) + `images.mjs` (36) + `dice.mjs` (37) +
`active-effect-keys.mjs` (38) + `actor-importer.mjs` (39) — `config.js` 845 →
451 lines (−394). What remains in `config.js` is small scalar enums + the
Phase 4–6 registry seeds (`classMixins` / `classDefaults` / `sheetParts` /
`variants` / …); those stay — they're tiny and are the file's reason to exist.

**Appendix-A `item.js` arc opened (session 40).** The behavior-class targets
(`actor.js` / `actor-sheet.js` / `item.js`) use a different shape than the
`config.js` data-table arc: **method-group → Foundry mixin**
(`(Base) => class extends Base`, the codebase's `HandlebarsApplicationMixin(...)`
idiom), keeping the public instance surface byte-identical. Session 40 lifted the
container-support block into `module/item/container-mixin.mjs`; session 41 lifted
the treasure-value / currency block into `module/item/currency-mixin.mjs`; session
42 lifted the spell-roll block (spell check + manifestation + mercurial magic)
into `module/item/spell-mixin.mjs`
(`DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`),
`item.js` 975 → 339 (−636 across the three slices). What remains in `item.js` is
`prepareBaseData` (weapon attack/damage prep) + the lifecycle hooks
(`_onCreate` / `_preDelete` / `deleteDialog`) — the class's core identity, which
stays. The `item.js` arc is effectively done.

**Appendix-A `actor-sheet.js` arc opened (session 43).** A sheet is an
`ApplicationV2` class whose big methods are mostly `#private` (the action
handlers, `#prepareItems`, the AE builders) — and **private names are lexically
class-scoped, so they can't move to a mixin** the way `item.js`'s public methods
did. The shrinkage shape for the sheet is therefore **pure-logic → free function
in `module/actor-sheet/*.mjs`**, with the sheet calling them. Session 43 lifted
the four AE summary builders (`#prepareAbilityEffects` /
`#prepareAttackBonusEffects` / `#prepareSaveEffects` / `#prepareAttributeEffects`,
all `#private`, all with zero prior coverage) into `module/actor-sheet/effects.mjs`
as pure free functions, deduping the identical effect-collection block they each
repeated into one shared `collectTransferredActiveEffects`. Session 44 lifted
`#prepareItems` (the inventory categorizer) into `module/actor-sheet/items.mjs`
as an "actor-logic → free function" (it mutates the actor; Foundry globals
injected via `deps`). Session 45 lifted the four small context-field helpers
(`#prepareNotes` / `#prepareCorruption` / `#prepareImage` /
`#prepareCompendiumLinks`) into `module/actor-sheet/presentation.mjs` as pure
free functions (Foundry globals via `deps`). Session 46 lifted `_onDragStart`
(the ~210-line drag-payload switch — a plain overridable method, not `#private`,
so it extracts more cleanly than the action handlers will) into
`module/actor-sheet/drag-drop.mjs` as the pure `buildDragStartData(actor, event)`,
with `findDataset` relocated beside it and `DCCActorSheet.findDataset` kept as a
delegating static (cross-module + documented). `actor-sheet.js` 1890 → 1613 →
1366 → 1324 → 1121. The cohesive small-helper extractions + the drag-start
builder are now done; what remains are the static `#` action handlers + the
drop-side handlers (`_onDrop` calls `super._onDrop` so it can't fully move;
`_handleContainerDrop` / `_onDropActiveEffect` are more self-contained and could
follow) — trickier, lower priority. `actor.js` remains an unstarted multi-session
project.
Group E / §2.8 homebrew
extensibility was validated 2026-05-29 by migrating two real sibling content
modules (`dcc-crawl-classes` PR #40, `mcc-classes` PR #38) onto the Phase 4–6
class-registration API; no further DCC-side Group E work is needed (see
*Sibling-module status*).

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-06-06 — Phase 7 session 46: Appendix-A `actor-sheet.js` shrinkage —
  extract `_onDragStart` into `module/actor-sheet/drag-drop.mjs`.** Fourth slice
  of the `actor-sheet.js` arc. `_onDragStart` (~210 lines — the biggest cohesive
  chunk left) is the switch that maps a dragged sheet element to its macro
  `dragData` payload. Unlike the prior three slices' `#private` `prepare*`
  helpers, it's a plain overridable method, so it extracts more cleanly: it reads
  only the actor (`this.options.document`) and the DOM event, with the sole side
  effect being `event.dataTransfer.setData`. Lifted into the pure free function
  `buildDragStartData(actor, event)` (returns the `dragData` object or `null`);
  the sheet's `_onDragStart` collapses to a 4-line wrapper that calls it and owns
  the `setData`. `findDataset` (the parent-walking dataset reader the switch leans
  on) moved into the same module as an export, with `DCCActorSheet.findDataset`
  kept as a **thin delegating static** — it's consumed cross-module by
  `party-sheet.js` (lines 451/466/476) and documented (`CLICKABLE_ITEMS.md`), so
  its public surface is preserved byte-for-byte. `actor-sheet.js` 1324 → 1121
  lines (−203). **No behavior change, no lib change.** Both functions had **zero
  prior unit coverage** (drag is e2e-hard), so a real coverage win. Tests: +28
  Vitest (new `module/__tests__/actor-sheet-drag-drop.test.js` — `findDataset`
  walk/miss/null, and `buildDragStartData` across every `dragAction` branch:
  non-draggable + unknown-action null, ActiveEffect found/gone, ability
  plain-vs-luck-roll-under [class + value-label], initiative/hitDice/save/skill
  [label-vs-id fallback]/luckDie, spellCheck item-vs-name, attackBonus,
  actionDice [configured + 1d20 default], disapproval range/table, weapon
  [toDragData merge + backstab], item [Item vs DCC-Item for spells], and the
  token-actor `tokenId` append); +1 Playwright (`sheet-ui.spec.js` "Drag Start
  Data" — a live actor with a weapon + spell drives the real
  `sheet._onDragStart` with synthesized events and asserts the captured
  `setData` JSON for the initiative / weapon-backstab / spell-`DCC Item` /
  non-draggable cases). **1544 Vitest** (was 1516, +28). **195 Playwright** (194
  passed + 1 flake; was 194). **Flake reconfirmed, not slice-caused** (per the
  refactor testing rules): the full run's one red was `active-effects.spec.js:559`
  — the **session-43** `effects.mjs` AE-summary-builder probe, untouched by this
  slice — where the equipped ring's *transferred* `lck` effect bucket came back
  empty (the actor-level `str` boon passed). That probe fires five sequential
  `createEmbeddedDocuments` calls (actor AEs → two items → ring AE → stowed AE)
  before reading `_prepareContext`; the nested `ring.createEmbeddedDocuments`
  didn't land in time under full-suite load — the documented
  `createEmbeddedDocuments`-under-load flake family. It passed cleanly in
  isolation (1.1s, all 14 in the spec green). The new "Drag Start Data" probe
  passed in the full run. Next
  `actor-sheet.js`: the static `#` action handlers (thin `rollXxx` wrappers — low
  value, the `static #x` entries must stay in the `actions` map) and the
  drop-side handlers (`_handleContainerDrop` / `_onDropActiveEffect` could follow;
  `_onDrop` itself calls `super._onDrop` so it can't fully move) — lower priority.

- **2026-06-05 — Phase 7 session 45: Appendix-A `actor-sheet.js` shrinkage —
  extract the four small context-field helpers into
  `module/actor-sheet/presentation.mjs`.** Third slice of the `actor-sheet.js`
  arc, same **pure-logic → free function** shape as sessions 43/44 (a sheet's
  `#private` methods can't move to a mixin). The four remaining small `prepare*`
  helpers — `#prepareNotes` / `#prepareCorruption` (both `TextEditor.enrichHTML`
  of an actor text field), `#prepareImage` (display-image fallback via
  `EntityImages.imageForActor`), `#prepareCompendiumLinks` (a one-line
  `CONFIG.DCC.coreBookCompendiumLinks` passthrough) — each read only
  `this.options.document` (the actor) plus one Foundry global, so they extract
  cleanly into `prepareNotes(actor)` / `prepareCorruption(actor)` /
  `prepareImage(actor)` / `prepareCompendiumLinks(config)`. The Foundry globals
  (`TextEditor`, `EntityImages.imageForActor`, `CONFIG.DCC`) are injected via
  `deps`/param defaults to the live globals (the `items.mjs` / `extension-api.mjs`
  DI idiom), so the enrichment, image-fallback, and config-read logic are now
  directly unit-testable. `_prepareContext` calls the free functions and the four
  `#private` methods are deleted. `actor-sheet.js` 1366 → 1324 lines (−42). **No
  behavior change, no lib change.** All four were `#private` with **zero prior
  coverage**, so a real coverage win. Tests: +10 Vitest (new
  `module/__tests__/actor-sheet-presentation.test.js` — notes/corruption
  enrichment with relativeTo + owner-secrets context, the no-class NPC `''`
  short-circuit, image keep-vs-fallback for custom/mystery-man/empty, and the
  compendium-links config passthrough incl. absent-config); +1 Playwright
  (`sheet-ui.spec.js` "Context Field Preparation" — a live actor drives the real
  `actor.sheet._prepareContext({})` and asserts enriched notes+corruption HTML,
  the custom-image keep, the mystery-man → default-icon fallback after an
  `update`, and the compendium-links passthrough). **1516 Vitest** (was 1506,
  +10). **194 Playwright** (was 193, +1). **Two probe assertions corrected during
  the slice** (both my new test, not the extraction): the compendium-links check
  was reference-`===` but `_prepareContext` runs every value through
  `foundry.utils.mergeObject` which deep-clones a non-null object, so it's now a
  structural `toEqual` against the `CONFIG.DCC` source; and the "custom image"
  fixture was a non-existent `worlds/*.webp` that 404'd in the Actors-directory
  thumbnail (caught by the `afterEach` console-error guard), swapped to the real
  core icon `icons/svg/aura.svg`. **Flake reflagged** (per the refactor testing
  rules): the session-44 `#prepareItems` probe (`sheet-ui.spec.js:297`,
  `containedCount`) failed once on a full run with the contained item's second
  `createEmbeddedDocuments` not landing — the documented transient
  `createEmbeddedDocuments`-under-load race; it passed cleanly in isolation (3.8s)
  and is untouched by this slice (it tests `items.mjs`). Worth watching if it
  recurs. Next `actor-sheet.js` candidates: the static `#` action handlers +
  drag-drop are trickier (they reach other private members / sheet `this`) —
  lower priority; the cohesive small-helper extractions are now done.

- **2026-06-05 — Phase 7 session 44: Appendix-A `actor-sheet.js` shrinkage —
  extract `#prepareItems` into `module/actor-sheet/items.mjs`.** Second slice of
  the `actor-sheet.js` arc, same **pure-logic → free function** shape as session
  43 (a sheet's `#private` methods can't move to a mixin). `#prepareItems` (~248
  lines, the inventory categorizer, called once in `_prepareContext`) reads only
  `this.options.document` (the actor), so it extracts to `prepareItems(actor)`.
  **Unlike the effects builders it is NOT pure** — it mutates the actor (deletes
  zero-quantity items when `removeEmptyItems` is on, folds resolved coin-treasure
  into `system.currency`, repairs missing/mystery-man item icons), so it's
  "actor-logic → free function". The four Foundry globals it touches (`TextEditor`,
  the item-icon table, `game.i18n`, `game.settings`) are injected via a `deps`
  param defaulting to the live globals (the `extension-api.mjs` DI idiom), so the
  bucketing / coin-merge / weight math are now directly unit-testable. The sheet's
  `_prepareContext` calls `prepareItems(this.options.document)` and the `#private`
  method is deleted. `actor-sheet.js` 1613 → 1366 lines (−247). **No behavior
  change, no lib change.** Subtlety preserved: the return is a dotted-key object
  (`'equipment.weapons'`, …) that `_prepareContext` merges via
  `foundry.utils.mergeObject`, which **expands** dotted keys → `ctx.equipment.weapons`
  (the e2e probe reads the expanded nested path; the unit tests read the function's
  direct dotted-key return). Was `#private` with **zero prior coverage**, so a real
  coverage win. Tests: +22 Vitest (new `module/__tests__/actor-sheet-items.test.js`
  — weapon melee/ranged bucketing, ammo/armor/equipment/mounts, spell grouping by
  level + description enrich, skill displayDie own/inherited-action-die/null,
  treasure-vs-coins routing + currency merge + delete, container display data +
  capacitySummary + contained-item hiding, removeEmptyItems deletion, icon repair,
  sortInventory, and the per-section/container/coin weight math); +1 Playwright
  (`sheet-ui.spec.js` "Inventory Preparation" — a live actor with one item per
  category drives the real `actor.sheet._prepareContext({})` and asserts the
  expanded buckets/weights/container-summary/contained-count/spell-grouping/skill-die
  end-to-end). **1506 Vitest** (was 1484, +22). **193 Playwright passed** on a
  clean full run, zero failures — incl. the session-40 container probe, which
  passed this run (no flake). Next `actor-sheet.js` candidates (same free-function
  pattern): the smaller `#prepareNotes`/`#prepareCorruption`/`#prepareImage`/
  `#prepareCompendiumLinks` helpers; the static `#` action handlers + drag-drop
  are trickier (they reach other private members / sheet `this`) — lower priority.

- **2026-06-03 — Phase 7 session 43: Appendix-A `actor-sheet.js` arc opens —
  extract the four AE summary builders into `module/actor-sheet/effects.mjs`.**
  First slice of the `actor-sheet.js` target, and the first that is **not** a
  mixin: a sheet's big methods are mostly `#private` (action handlers,
  `#prepareItems`, the AE builders), and private names are lexically class-scoped
  so they cannot be relocated to a mixin. The shrinkage shape for a sheet is
  **pure-logic → free function** in `module/actor-sheet/*.mjs`, with the sheet
  calling it. The four AE summary builders — `#prepareAbilityEffects`,
  `#prepareAttackBonusEffects`, `#prepareSaveEffects`, `#prepareAttributeEffects`
  (each called exactly once, in `_prepareContext`) — read only
  `this.options.document` (the actor) and nothing else of the sheet, so they
  extract cleanly into `prepareAbilityEffects(actor)` etc. The four ALSO repeated
  an **identical ~20-line effect-collection block** (actor effects +
  equipped-item transferred effects) and an identical effect-info push shape;
  those are deduped here into a shared `collectTransferredActiveEffects(actor)` +
  internal `effectInfo`/`pushUnique`, so the slice is a behavior-neutral
  de-duplication on top of the relocation. The sheet's `_prepareContext` now calls
  the free functions directly (`prepareAbilityEffects(this.options.document)`) and
  the four `#private` methods are deleted. `actor-sheet.js` 1890 → 1613 lines
  (−277). **No behavior change, no lib change.** The builders were `#private` and
  had **zero prior unit coverage** (no `module/__tests__` or e2e reference), so as
  free functions they're now directly testable — a real coverage win. Tests: +19
  Vitest (new `module/__tests__/actor-sheet-effects.test.js` — the collector's
  disabled/suppressed/unequipped/non-transfer filtering + default-equipped, each
  builder's regex bucketing, dedup-by-effect-id, img fallback, the
  AC+HP-both-buckets case, and equipped-vs-unequipped item-transfer feeding all
  four); +1 Playwright (`active-effects.spec.js` — live actor with ability/save/
  attribute AEs + an equipped-ring transfer + an unequipped-charm + a disabled
  effect, drives the real `actor.sheet._prepareContext({})` and asserts every
  summary bucket end-to-end). **1478 Vitest** (was 1459, +19). **191 Playwright
  passed** on a clean run, zero failures (was 190, +1; no flake this run). Next
  `actor-sheet.js` candidates (same free-function pattern): `#prepareItems`
  (~248 lines, inventory categorization — the next-biggest cohesive chunk) and
  the AE/compendium-link smaller helpers.

- **2026-06-03 — Phase 7 session 42: Appendix-A `item.js` shrinkage —
  extract the spell-roll block into `module/item/spell-mixin.mjs`.** Third (and
  largest) slice of the `item.js` arc, same method-group→Foundry-mixin shape. The
  5-method spell-item block (`rollSpellCheck`, `hasExistingManifestation`,
  `hasExistingMercurialMagic`, `rollManifestation`, `rollMercurialMagic` — ~352
  lines) moved into `SpellItemMixin`, the **outermost** layer:
  `DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`.
  **Entanglement assessed before extracting** (the slice the progress notes
  flagged as roll-behavior/adapter-adjacent): the block carries **no
  `logDispatch` and no direct adapter-module imports** — it reaches the adapter
  through the GLOBAL `game.dcc.*` namespace (`game.dcc.DCCRoll.createRoll`,
  `game.dcc.processSpellCheck`), which a mixin reaches identically; the
  dispatch-logged spell-check *routing* lives on the actor side
  (`DCCActor._rollSpellCheckViaAdapter`), untouched. The one module dependency is
  `ensurePlus` (`../utilities.js`), imported by the mixin. Consumers
  (`actor-sheet.js` + `item-sheet.js` action handlers, `macros.mjs` macro
  commands, the spell/cleric/wizard/elf templates' `data-action`s) call these off
  live items and need **zero** change. `item.js` 691 → 339 lines (−352;
  cumulative 975 → 339, −636 across sessions 40–42). What's left in `item.js` is
  `prepareBaseData` + the lifecycle hooks — the class's core identity. **No
  behavior change, no lib change.** `rollSpellCheck` already had item.test.js
  coverage (passes unchanged — proves transparent composition); the
  manifestation / mercurial / `hasExisting*` methods had **no prior unit
  coverage**, so the new test is a coverage win. Tests: +14 Vitest (new
  `module/__tests__/item-spell-mixin.test.js` — composition guards incl. Spell as
  the outermost layer + all-three-mixins-coexist, AND behavioral:
  `hasExistingManifestation`/`hasExistingMercurialMagic` truthiness across
  value/summary/description, the non-spell-type + no-actor guards, and the
  manifestation/mercurial lookup-by-value stow). Also **fixed the session-41
  currency chain-order test** — adding the Spell layer made its hard-coded
  Currency→Container→Item assertion stale; rewrote it to walk the prototype chain
  (resilient to future outer layers). +1 Playwright (`extension-api.spec.js`
  "survives extraction" probe — live spell item: `rollManifestation(7)` /
  `rollMercurialMagic(55)` lookup-and-stow end-to-end [value fields are
  StringFields → round-trip as strings], `hasExisting*` flips false→true,
  `rollSpellCheck` survives as a live method). **1459 Vitest** (was 1445, +14).
  **190 Playwright passed** on a clean run, zero failures (was 189, +1). **Flake
  flagged** (per the refactor testing rules): on the first full-suite run the
  unchanged session-40 container probe failed once with `result.isContainer`
  undefined — the `page.evaluate` block threw early, consistent with a transient
  `Actor.create`/`createEmbeddedDocuments` timeout under full-suite load; it
  passed in isolation, in a 3-item-probe run, and on a clean full re-run. Not
  introduced by this slice (container probe untouched); worth watching if it
  recurs. Next `item.js`: nothing warranted — the arc's cohesive method groups
  are extracted; `prepareBaseData` + lifecycle hooks stay.

## Closed questions

All resolved — one-line ticks (full rationale in the linked sessions /
phase archives):

1. ~~Runtime loading strategy~~ — vendor the lib's built `dist/`; adapter imports a relative path into `module/vendor/dcc-core-lib/`, one `npm run sync-core-lib` per lib bump (2026-04-17).
2. ~~Package-name discrepancy~~ — moot under the vendor approach; docs call out the scoped `@moonloch/dcc-core-lib` (the bare token = local paths only) (2026-05-18).
3. ~~Dead hook `dcc.update`~~ — don't emit; XCC's speculative debug-only listener removed; `EXTENSION_API.md` Dead-hook table cleared (2026-05-18).
4. ~~Undocumented `game.dcc.*` with heavy XCC usage~~ — re-audit confirmed every symbol XCC touches is in `EXTENSION_API.md` Stable; caught + fixed two doc-rot items (2026-05-18).
5. ~~Patron-taint mechanic alignment~~ — `dcc-core-lib@0.7.0` models the RAW triggers; `_runLegacyPatronTaint` deleted; entire D3 arc complete (2026-04-24).
6. ~~Spellburn dialog integration~~ — adapter DialogV2 prompt wired into `rollSpellCheck` (2026-04-18); later unified into `promptRollModifierDialog` (Q7).
7. ~~Wizard/elf modifier-dialog coverage beyond Spellburn~~ — unified `promptRollModifierDialog` covers skill + spell checks incl. spellburn (2026-05-17, sessions 26 + 27).

## Blockers / open questions

None open. All prior blockers/questions are resolved (see *Closed
questions* above); active design / coverage work is tracked in the
*PR #720 review backlog* below.

## PR #720 review backlog (2026-04-19) — FULLY DRAINED

PR #720 (the merge of Phases 0-3 into `main`) triggered a full 8-agent review.
**Every flagged finding is now closed**; per-session narratives live in the
[phase-7 archive](dev/progress/phase-7.md). One-line close-out per sub-section:

- **Design calls** — 5 review-flagged calls (spellburn dialog-ordering,
  spellburn floor 0-vs-1, damage `_total` clamp divergence, `_xxxViaAdapter`
  error boundaries, `createFoundryRoller` delete-or-wire) resolved in sessions
  16–20.
- **Resilience / cleanup** — the programmatic-PC-creation finding was documented
  in `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` (session 33); a "quick PC" helper
  stays unbuilt by design.
- **Legacy decommission** — COMPLETE (sessions 16, 21–25): no `_xxxLegacy` roll
  branch survives; every public dispatcher is single-path through the adapter
  (retaining only the `options.rollUnder` / `!hasDie` *adapter* branches).
- **Test-coverage gaps (severity ≥ 6)** — all closed/found-stale (sessions
  26–31), each with Vitest + a live Playwright probe where the gap was real
  behavior.
- **Doc/comment hygiene** — 4 behavior-neutral edits (session 32).
- **Performance** — the two above-threshold items done (session 34); one
  micro-item left (deterministic `new Roll('${N}d1')` → `Roll.fromTerms`, no
  measurable win), not worth a slice.

## Decisions made

0. **Runtime loading: vendor the lib's built `dist/`.** See open
   question #1 above for the full rationale. Committed the initial
   sync + `scripts/sync-core-lib.mjs` in a standalone prep commit so
   Phase 1 imports have somewhere to import *from*. The sync script
   reads from `$DCC_CORE_LIB_SRC` (default
   `/Users/timlwhite/WebstormProjects/dcc-core-lib`), runs `npm run
   build` inside the lib, wipes and copies `dist/`, and writes a
   `VERSION.json` with `{ name, version, commit, dirty, syncedAt }`.
   `module/vendor/**` added to `standard.ignore` so the linter skips
   vendored output.

1. **Worktree location.** Now at
   `/Users/timlwhite/FoundryVTT-Next/Data/systems/dcc`. Main repo remains
   at `/Users/timlwhite/FoundryVTT/Data/systems/dcc`.
   *Why:* `FoundryVTT-Next` is a separate Foundry user-data install, so
   the worktree can live under its `systems/` directory without clashing
   with the main repo on `system.json` id (each Foundry install sees
   only its own `systems/` tree). This lets Tim actually run the
   refactored system in Foundry for testing during Phase 1+.
   *History:* originally parked at
   `/Users/timlwhite/WebstormProjects/dcc-refactor` on 2026-04-17 to
   avoid `systems/` collisions; moved same day once the separate
   `FoundryVTT-Next` install was set up.

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

5. **Dispatch logs are permanent infrastructure** (2026-04-18).
   Originally planned to strip at Phase 1 close; reversed because
   the Playwright dispatch spec asserts on them. Every
   `_xxxViaAdapter` / single-path-with-branch added in later phases
   must call `logDispatch(...)` as its first line. See
   "Dispatch logging" note below.

6. **`game.dcc.processSpellCheck` is permanent stable API**
   (Phase 2 close, 2026-04-18). Don't deprecate; don't shim; route
   migration is per-call-site and incremental. See phase-2.md
   Phase 2 CLOSE section for full rationale.

7. **Legacy-branch retirement principle** (added post-Phase-2,
   2026-04-19; see `ARCHITECTURE_REIMAGINED.md §8.6`). Foundry-facing
   API (`DCCActor.rollXxx`, `game.dcc.*`, hooks) stays as thin
   wrappers indefinitely. Internal `_xxxLegacy` branches and
   direct-reimpl methods retire once adapter coverage is exhaustive
   for their call site. **Supersedes** earlier "permanent legacy
   branch" close-outs — those blockers are back on the critical
   path. Group D D1 / D2 (attack / crit / fumble / damage) all
   landed under this principle.

## Next steps

**The Appendix-A `config.js` data-table extraction arc is done** (sessions
35–39); **the `item.js` behavior-class arc opened at session 40** with the
container-support mixin. All PR #720 cleanup arcs were closed first — legacy-decom
21–25, test-coverage 26–31, doc-hygiene 32, programmatic-PC doc 33, perf 34.

- **`config.js` (845 → 451 after session 39) — DONE.** `monster-data.mjs` (35),
  `images.mjs` (36), `dice.mjs` (37), `active-effect-keys.mjs` (38),
  `actor-importer.mjs` (39). What's left is small scalar enums
  (`abilities` / `saves` / `items` / `currencies` / `critRanges` / …) + the
  Phase 4–6 registry seeds (`classMixins` / `classDefaults` / `sheetParts` /
  `variants` / …) — **leave those in place**; they're tiny and are the file's
  actual reason to exist. No further `config.js` slice is warranted. Open
  question still deferred: whether the unconsumed `activeEffectKeys` table
  (extracted session 38) should be deprecated/removed — see the session-38
  slice.
- **`item.js` (975 → 339 after session 42) — effectively DONE.** Pattern was
  **method-group → Foundry mixin** in `module/item/*.mjs`
  (`DCCItem extends SpellItemMixin(CurrencyItemMixin(ContainerItemMixin(Item)))`),
  public surface byte-identical. Done: `container-mixin.mjs` (40 — 9
  weight/capacity/depth getters + 2 validation helpers); `currency-mixin.mjs`
  (41 — the 4-method treasure-value / currency block); `spell-mixin.mjs` (42 —
  the 5-method spell-roll block). All cohesive method groups are now extracted;
  what remains in `item.js` is `prepareBaseData` (weapon attack/damage prep) +
  the lifecycle hooks (`_onCreate` / `_preDelete` / `deleteDialog`) — the class's
  core identity, which stays. No further `item.js` slice is warranted.
  **Open item:** the session-41 latent finding — `needsValueRoll`/`rollValue`
  formula path is dead under the integer-`NumberField` `CurrencyField` schema
  (`migrateData` `parseInt()`s strings); decide whether to make the value field
  formula-capable or remove the dead path. Separate from the extraction arc.
- **`actor-sheet.js` (1890 → 1121 after session 46) — IN PROGRESS.** Sheets
  can't use the mixin pattern (their big methods are `#private`); shape is
  **pure-logic → free function** in `module/actor-sheet/*.mjs`, sheet calls it.
  Done: `effects.mjs` (43 — the 4 AE summary builders + shared collector);
  `items.mjs` (44 — `#prepareItems`, the ~248-line inventory categorizer, as an
  "actor-logic → free function" since it mutates the actor, with Foundry globals
  injected via a `deps` param); `presentation.mjs` (45 — the four small
  context-field helpers `#prepareNotes`/`#prepareCorruption`/`#prepareImage`/
  `#prepareCompendiumLinks` as pure free functions, Foundry globals via `deps`);
  `drag-drop.mjs` (46 — `_onDragStart`'s ~210-line drag-payload switch as the
  pure `buildDragStartData(actor, event)` + the relocated `findDataset`, with
  `DCCActorSheet.findDataset` kept as a delegating static for the cross-module +
  documented callers). The cohesive `prepare*` helpers + the drag-start builder
  are now done. Remaining: the static `#` action handlers (thin wrappers over
  `this.options.document.rollXxx` — extracting gains little since the `static #x`
  entries must stay in the `actions` map) and the drop-side handlers (`_onDrop`
  calls `super._onDrop` so it can't fully move; `_handleContainerDrop` /
  `_onDropActiveEffect` are more self-contained and could follow `drag-drop.mjs`).
  Lower priority.
- **`actor.js` (~4574 lines)** — the largest Appendix-A target; a multi-session
  project, not a slice; start only with budget for it. Being a document class
  (not a sheet) it CAN use the `item.js` mixin pattern, but much of its bulk is
  the adapter dispatch layer that should stay co-located with the public
  `rollXxx` wrappers.

**Group E / §2.8 — validated, no DCC-side work left.** The class-registration
registries shipped in Phases 4–6 and two real sibling content modules now
consume them (`dcc-crawl-classes` PR #40, `mcc-classes` PR #38; Group E
session 1 added the per-class mercurial-magic table registry). The two unbuilt
vertical-slice candidates remain viable if more pattern-laying is wanted, but
nothing requires them: (1) **Halfling** — concentrates the §2.1 schema-slimming
question on one class; (2) **homebrew single-class** — exercises Phase 4+5+6
end-to-end via `registerClassMixin` + `registerSheetPart` + variant-aware data
loading.

**Cross-repo coordination:** if any future migration uncovers a missing
feature in the lib's tagged-union modifier (e.g. skill items with `allowLuck`
needing dice-chain bumps), land the lib change first in its own `dcc-core-lib`
PR, then sync via `npm run sync-core-lib`.

**Sibling-module status:**
- **`dcc-crawl-classes`** — migrated to the full class-registration API
  (mixins / defaults / sheet-parts / `registerActorSheet` + 5-line
  `DCCSheet` stubs). Branch `refactor/dcc-extension-api`, PR
  foundryvtt-dcc/dcc-crawl-classes#40 (2026-05-29).
- **`mcc-classes`** — migrated the same way, keeping thin `_prepareContext`
  overrides for its §9.2/§9.3a data migrations; cross-cutting shared MCC
  fields stay on the `dcc.definePlayerSchema` hook. Branch
  `refactor/dcc-extension-api`, PR foundryvtt-dcc/mcc-classes#38
  (2026-05-29). Both verified live in the v14 world; together they are the
  §2.8 homebrew-extensibility validation.
- **XCC** has consumed the `dcc.afterComputeSpellCheck` hook +
  `game.dcc.registerActorSheet` recipes shipped in B1-followup /
  B1-followup-2; PR pending on `foundryvtt-dcc/xcc` branch
  `chore/migrate-to-dcc-extension-api`. Same branch also retires 9
  XCC-side redefinitions of DCC class schema fields (luckDie, backstab,
  knownSpells, maxSpellLevel, disapproval, disapprovalTable, deity,
  corruption, spellCheckAbility) that were silently clobbering DCC
  defaults. Phase 4 schema-mixin design needs to coordinate with the XCC
  field consumption documented in this PR.

## Notes for future sessions

- The pre-commit hook runs `npm run format` → `git add .` → `npm test`.
  That `git add .` **will sweep untracked files into the commit**. Before
  committing, either stash or add to `.gitignore`.
- **Lib updates require `npm run sync-core-lib`** to re-vendor
  `module/vendor/dcc-core-lib/`. Commit the vendor delta separately
  from any adapter change that depends on it — two commits: `vendor:
  sync dcc-core-lib to <version> (<sha>)` then the adapter change.
  `VERSION.json` records the lib's git SHA and flags `dirty: true` if
  the lib tree had uncommitted changes at sync time (do not release
  from a dirty sync).
- `npm link @moonloch/dcc-core-lib` is no longer required for runtime
  loading (the vendored copy is used instead). It *is* still useful if
  you want TypeScript-aware IDE support against the linked source, but
  nothing in the system imports from `@moonloch/dcc-core-lib` at
  runtime anymore — all imports are relative paths into
  `module/vendor/dcc-core-lib/`.
- Sibling modules that must keep working:
  - `../../modules/dcc-qol` — attack hook consumer, reaches into
    `DiceChain.bumpDie` + `DCCRoll.createRoll`
  - `../../modules/xcc` — heaviest consumer; variant game fighting the
    system (replaces `CONFIG.Actor.documentClass` globally)
  - `../../modules/mcc-classes` — clean schema-hook consumer
  - `../../modules/dcc-crawl-classes` — clean schema-hook consumer

### Dispatch logging (permanent)

- Centralized at `module/adapter/debug.mjs`. Every dispatch path calls
  `logDispatch(rollType, 'adapter'|'legacy', details)` to print one
  line to the Foundry console, e.g.
  `[DCC adapter] rollSavingThrow → via adapter saveId=ref`.
- **The logs are permanent, not a Phase-1 scaffold** (decision
  2026-04-18). `browser-tests/e2e/phase1-adapter-dispatch.spec.js`
  captures them via Playwright and asserts every dispatcher branch
  end-to-end; stripping the logs would delete that signal.
- Every `_xxxViaAdapter` / `_xxxLegacy` added in later phases (spell,
  attack, damage, crit, fumble) must call `logDispatch(...)` as its
  first line. Mirror the pattern at `_rollSavingThrowViaAdapter` in
  `module/actor.js`.
- The helper's header JSDoc describes the role. This bullet is the
  process-level reminder; `debug.mjs` itself should be treated as
  core adapter infrastructure on a par with `chat-renderer.mjs` and
  `character-accessors.mjs`.

### Silent adapter→legacy fallback reason codes (2026-04-23)

- Every silent-fallback site emits a `reason=<tag>` field on the
  dispatch log. Pattern: `logDispatch('rollXxx', 'adapter' | 'legacy',
  { reason: 'camelCaseTag', ...extras })` so the Foundry console is
  self-documenting ("why did this cast fall back?") without opening
  source. Tags in use: `noCasterProfile`, `noDisapprovalTable`,
  `noMercurialTable`. New fallback sites added in future sessions
  must pick a short tag and document it here.
