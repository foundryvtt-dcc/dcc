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

**Phase 7 cleanup — latest 2026-06-03 (session 39).** Every PR #720 arc is
closed: legacy-decommission (sessions 21–25 — no `_xxxLegacy` roll body
survives; every public dispatcher is single-path through the adapter),
test-coverage backfill (26–31 — every PR #720 severity-≥6 gap closed or
found-stale, incl. the session-29 forceCrit dice-flake fix), doc/comment
hygiene (32), the programmatic-PC-creation doc (33), and the two
below-threshold perf items (34). **Sessions 35–39 ran the Appendix-A
file-shrinkage arc** with five `config.js` slices (monster tables →
`module/config/monster-data.mjs`; default-image tables →
`module/config/images.mjs`; dice config → `module/config/dice.mjs`;
`activeEffectKeys` → `module/config/active-effect-keys.mjs`; actor-importer
block → `module/config/actor-importer.mjs`). All were behavior-neutral with no
lib change. Repo green: **1427 Vitest / 187 Playwright e2e passed**, zero
failures (flake-clean since the session-29 fix). Per-session detail lives in
*Recent slices* + the [phase-7 archive](dev/progress/phase-7.md); the itemized
close-outs are in the *PR #720 review backlog* below.

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
The other Appendix-A targets (`actor.js` / `actor-sheet.js` / `item.js`) remain
multi-session projects, not slices.
Group E / §2.8 homebrew
extensibility was validated 2026-05-29 by migrating two real sibling content
modules (`dcc-crawl-classes` PR #40, `mcc-classes` PR #38) onto the Phase 4–6
class-registration API; no further DCC-side Group E work is needed (see
*Sibling-module status*).

## Recent slices

Newest first. Five most recent — everything else is in the phase
archives linked above.

- **2026-06-03 — Phase 7 session 39: Appendix-A `config.js` shrinkage —
  extract the actor-importer block into `module/config/actor-importer.mjs`.**
  Fifth slice of the Appendix-A arc, same extract-and-compose pattern. The
  five actor-importer symbols — `importTypes` (actor-type select options,
  read by `templates/dialog-actor-import.html` via the `config.importTypes`
  context), `actorImporterPromptThreshold` (bulk-import warning count),
  `actorImporterItemPacks` (16 dcc-core-book search packs),
  `birthAugurEffectsPack`, and `actorImporterNameMap` (stat-block→canonical
  name remap) — moved into a new `module/config/actor-importer.mjs` as named
  exports; `config.js` imports + re-composes them onto `DCC` so the public
  `CONFIG.DCC` shape is **byte-identical**. The **only** runtime consumer is
  `module/parser.js` (the stat-block importer, reading `CONFIG.DCC.*`) + its
  dialog template — one cohesive concern, so all five grouped into one module
  (incl. `importTypes`, which had been sitting separately up-file at the old
  line 294). Verified byte-identical to git HEAD (`JSON.stringify` diff against
  a temp HEAD copy written inside `module/`) + same-reference composition
  (`DCC.x === module.x`). `config.js` 481 → 451 lines (−30; cumulative 845 →
  451, −394 across sessions 35–39). **No behavior change, no lib change.**
  Tests: +6 Vitest (new `module/__tests__/config-actor-importer.test.js` —
  values, the every-pack-is-`dcc-core-book.*` invariant, the
  every-remap-is-a-non-empty-string-array invariant, the `DCC.x === module.x`
  composition guard); +1 Playwright (`extension-api.spec.js` "survives
  extraction" probe — reads `CONFIG.DCC.importTypes`/`actorImporter*`/
  `birthAugurEffectsPack` live, asserts the 16-pack count + known remaps).
  **1427 Vitest** (was 1421, +6). **187 Playwright passed**, zero failures
  (was 186, +1; 6.5-min full suite). Next `config.js` work: the remaining
  bulk is small scalar enums + the Phase 4–6 registry seeds (`classMixins` /
  `classDefaults` / `sheetParts` / `variants` / …) — leave those in
  `config.js`; they're tiny and are the file's actual reason to exist. The
  data-table extraction arc for `config.js` is effectively complete.

- **2026-06-02 — Phase 7 session 38: Appendix-A `config.js` shrinkage —
  extract the `activeEffectKeys` reference table into
  `module/config/active-effect-keys.mjs`.** Fourth slice of the Appendix-A arc.
  Same extract-and-compose pattern, but with a **finding surfaced first**: the
  AE attribute-key → i18n-label reference table (`activeEffectKeys`, 32 entries)
  has **no runtime code consumer** anywhere — not `module/`, not a template, not
  a sibling module (`xcc`/`dcc-qol`/`mcc-classes`/`dcc-crawl-classes`), and the
  only dynamic `CONFIG.DCC[...]` access (`table-loading.mjs`) is for table props.
  It was added in PR #611 ("Add Active Effects support") and never read since;
  V14 AE editing uses Foundry's native config UI. Tim's call (asked
  explicitly): **extract like the others** (preserve the documented
  `CONFIG.DCC.activeEffectKeys` surface; defer the deprecation question) rather
  than skip or delete. Moved into `module/config/active-effect-keys.mjs` as a
  named export with a header documenting the no-consumer status + the deferred
  deprecation; `config.js` re-composes onto `DCC` byte-identical. Verified
  byte-identical to git HEAD + same-reference composition. `config.js` 525 → 481
  lines (−44; cumulative 845 → 481, −364 across sessions 35–38). **No behavior
  change, no lib change.** Tests: +3 Vitest (new
  `module/__tests__/config-active-effect-keys.test.js` — values, the
  every-entry-is-`system.*`→`DCC.*` invariant, the `DCC.x === module.x`
  composition guard — these pin the otherwise-unconsumed surface so a future
  deprecation is test-visible); +1 Playwright (`extension-api.spec.js` "survives
  extraction" probe — the **only** end-to-end guard, since there's no consumer:
  reads `CONFIG.DCC.activeEffectKeys` live, asserts 32 entries + well-formed
  paths). **1421 Vitest** (was 1418, +3). **186 Playwright passed**, zero
  failures (was 185, +1; 6.2-min full suite). Next `config.js` chunk: the
  actor-importer block.

- **2026-06-02 — Phase 7 session 37: Appendix-A `config.js` shrinkage —
  extract the dice config tables into `module/config/dice.mjs`.** Third slice
  of the Appendix-A arc, same extract-and-compose pattern. The three
  dice-related tables — `diceTypes` (15-die label/icon map for the
  dice-fulfillment dialog, wired into `CONFIG.Dice.fulfillment.dice` by
  `dcc.js:195`), `DICE_CHAIN` (the ordered die progression, read by
  `dice-chain.js`), and `effectChangeTypes` (the `diceChain` custom AE change
  type, read by `active-effect.js`) — moved into a new `module/config/dice.mjs`
  as named exports; `config.js` imports + re-composes onto `DCC` so the
  `CONFIG.DCC` shape is **byte-identical** (all three consumers unchanged).
  Grouped all three into one `dice.mjs` (one cohesive concern). Verified
  byte-identical to git HEAD + same-reference composition (`DCC.x ===
  module.x`). `config.js` 560 → 525 lines (−35; cumulative 845 → 525, −320
  across sessions 35–37). **No behavior change, no lib change.** Tests: +4
  Vitest (new `module/__tests__/config-dice.test.js` — values, the
  strictly-ascending `DICE_CHAIN` invariant, the every-die-has-label+icon
  invariant, the `DCC.x === module.x` composition-identity guard); +1 Playwright
  (`extension-api.spec.js` "survives extraction" probe reads
  `CONFIG.DCC.diceTypes`/`DICE_CHAIN`/`effectChangeTypes` live **and** asserts
  the `dcc.js` init wiring `CONFIG.Dice.fulfillment.dice === CONFIG.DCC.diceTypes`).
  **1418 Vitest** (was 1414, +4). **185 Playwright passed**, zero failures (was
  184, +1; 6.4-min full suite). Next `config.js` chunks: `activeEffectKeys`
  (~45 lines), the actor-importer block.

- **2026-06-02 — Phase 7 session 36: Appendix-A `config.js` shrinkage —
  extract the default-image tables into `module/config/images.mjs`.** Second
  slice of the Appendix-A arc, same extract-and-compose pattern as session 35.
  The three default/fallback image lookup tables (`defaultActorImages`,
  `defaultItemImages`, `macroImages` [49 keys] — consumed **only** by
  `module/entity-images.js` `EntityImages._selectImage` via `CONFIG.DCC.*`)
  moved into a new `module/config/images.mjs` as named exports; `config.js`
  imports + re-composes them onto `DCC` so the `CONFIG.DCC` shape is
  **byte-identical** (`entity-images.js` needs no change). Grouped all three
  into one `images.mjs` (one cohesive concern, one consumer file) rather than a
  single-table `macro-images.mjs`. `diceTypes` was left for a later slice —
  it's a different concern (dice config, consumed by `dcc.js:195`
  `CONFIG.Dice.fulfillment.dice`). Verified byte-identical to git HEAD
  (`JSON.stringify` diff; temp HEAD copy written **inside** `module/` so its
  now-committed `./config/monster-data.mjs` import resolves) + same-reference
  composition (`DCC.x === module.x`). `config.js` 625 → 560 lines (−65;
  cumulative 845 → 560, −285 across sessions 35–36). **No behavior change, no
  lib change.** Tests: +5 Vitest (new `module/__tests__/config-images.test.js`
  — table values, all-paths-non-empty-string invariant, the `DCC.x ===
  module.x` composition-identity guard); +1 Playwright (`extension-api.spec.js`
  "survives extraction" probe reads `CONFIG.DCC.defaultActorImages`/
  `defaultItemImages`/`macroImages` live, asserts known paths + the 7/49 key
  counts). **1414 Vitest** (was 1409, +5). **184 Playwright passed**, zero
  failures (was 183, +1; 6.3-min full suite). Next `config.js` chunks:
  `diceTypes` + `DICE_CHAIN`, `activeEffectKeys`, the actor-importer block.

- **2026-06-02 — Phase 7 session 35: Appendix-A `config.js` shrinkage arc
  opens — extract the monster-classification tables into
  `module/config/monster-data.mjs`.** First slice of the Appendix-A
  file-shrinkage arc (`config.js` target ~200 lines). `config.js` was a single
  845-line `DCC` data object (`export default DCC`; `CONFIG.DCC = DCC`); the
  four monster-classification tables (`monsterCriticalHits` [178 lines],
  `humanoidHints`, `giants`, `giantsNotGiants` — ~235 lines, the single biggest
  cohesive chunk, consumed **only** by `module/npc-parser.js:119–130`) moved to
  a new `module/config/monster-data.mjs` as named exports. `config.js` imports
  them and re-composes onto `DCC` (`DCC.monsterCriticalHits =
  monsterCriticalHits`, etc.), so the default-export / `CONFIG.DCC` shape is
  **byte-identical** — `npc-parser.js` needs zero changes (still reads
  `DCC.*`). Verified the extracted tables are byte-identical to git HEAD
  (`JSON.stringify` diff against `git show HEAD:module/config.js`) and that
  `config.js` re-composes the **same object references** (`DCC.x === module.x`).
  `config.js` 845 → 625 lines (−220). **No behavior change, no lib change.**
  Tests: +5 Vitest (new `module/__tests__/config-monster-data.test.js` — table
  values + the every-row-has-6-types invariant + the `DCC.x === module.x`
  composition-identity guard); +1 Playwright (`extension-api.spec.js`, the
  "survives extraction" family alongside the handlebars/macros/settings-table
  probes — reads `CONFIG.DCC.monsterCriticalHits`/`humanoidHints`/`giants`/
  `giantsNotGiants` live and asserts the known die/table values + the 22-HD-row
  count). **1409 Vitest** (was 1404, +5). **183 Playwright passed**, zero
  failures (was 182, +1; 6.3-min full suite). Establishes the
  `module/config/` directory + the extract-and-compose pattern for the rest of
  the arc (`macroImages`, `diceTypes`/`DICE_CHAIN`, `activeEffectKeys`, the
  actor-importer block are the natural next chunks).

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

## PR #720 review backlog (2026-04-19)

PR #720 (the merge of Phases 0-3 into `main`) triggered a full 8-agent
review. Fixed findings have been pruned — their narratives live in the
*Recent slices* section / phase archives. The items below are the
deferred findings still open.

**Design calls — ALL CLOSED, section drained.** The five review-flagged
design calls (spellburn dialog-ordering, spellburn floor 0-vs-1, damage
`_total` clamp divergence, error boundaries around `_xxxViaAdapter`,
`createFoundryRoller` delete-or-wire) were all resolved in Phase 7
sessions 16–20. Full rationale lives in those Recent-slices / phase-7
archive entries.

**Open resilience / cleanup items — section drained.** The one item
(programmatic PC creation produces inconsistent class config) was DOCUMENTED
2026-06-02 (session 33): `docs/dev/PROGRAMMATIC_ACTOR_CREATION.md` lays out the
three population mechanisms a bare `Actor.create()` misses, the quick-PC /
fixture guidance, and the content-free-world caveat; cross-linked from
`EXTENSION_API.md` / `CLASS_DECOMPOSITION.md` §3.3+§3.5 / `docs/dev/README.md`.
A "quick PC" helper stays unbuilt by design — no consumer needs it.

**Legacy decommission — COMPLETE (arc ran 2026-05-31 → 06-02).** Every
`_xxxLegacy` roll branch is gone; every public dispatcher is single-path
through the adapter (retaining only the `options.rollUnder` and `!hasDie`
*adapter* branches). Landed across sessions 16, 21–25 + the session-20
error-boundary prerequisite; `_buildSkillCheckLegacyTerms` →
`_buildSkillCheckRollTerms`. Vitest + live e2e retirement guards lock it in.
Per-session detail in the [phase-7 archive](dev/progress/phase-7.md).

**Open test coverage gaps (pr-test-analyzer severity ≥ 6) — ALL CLOSED /
found-stale 2026-06-02 (sessions 26–31).** Each closed with Vitest + (where the
gap was real-world behavior) a live Playwright probe: data-driven migration
branches incl. the V14-critical AE numeric-mode→string-type converter (26),
`renderDisapprovalRoll` + `renderMercurialEffect` (27), the `dcc-roll.js`
mock async/sync mismatch + shared `withSyncCreateRoll` (28), `onSpellLost`
during a real cast (29), the `terms[N>0]` two-pass-divergence boundary (30),
NPC `rollToHit` adjustment injection + `Roll.validate` early-return (31). The
`roll-dialog.mjs` / `promptSpellburnCommitment` gap was found stale (helpers
retired in the Q7 dialog unification; `adapter-roll-dialog.test.js` already
covers both current exports). `_canRouteAttackViaAdapter` gate was retired at
session 15 (assertions moved to the single-path body). Full per-session detail
in the phase-7 archive.

**Documentation / comment hygiene — ALL CLOSED 2026-06-02 (session 32).** Four
behavior-neutral edits: `ARCHITECTURE_REIMAGINED.md` §7 *Landed names*
annotation (lib shipped `rollAbilityCheck`/`rollSavingThrow`/generic `rollCheck`,
not the sketched `resolveSkillCheck`/`rollInitiative`), §2.7 `main @ 2337ec0`
snapshot pin, the softened `actor.js` disapproval-chat-ordering comment, and the
dropped unused `_getInitiativeRollViaAdapter` `options` param.

**Performance (below measurement threshold) — section drained.** `getActionDice`
3×→1× hoist in `rollToHit` and the double `items.find`→single-pass fold in both
init methods both DONE 2026-06-02 (session 34; Vitest guards + a live Playwright
order probe). One micro-item left, not worth a slice on its own: the
`renderDisapprovalRoll` / `renderMercurialEffect` `new Roll('${N}d1')` deterministic
chat could read cleaner as `Roll.fromTerms([new NumericTerm(...)])` (no measurable win).

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
35–39; all PR #720 cleanup arcs were closed first — legacy-decom 21–25,
test-coverage 26–31, doc-hygiene 32, programmatic-PC doc 33, perf 34). Every
self-contained data table is now its own `module/config/*.mjs` module
re-composed onto `DCC` byte-identically:

- **`config.js` (845 → 451 after session 39).** Done: `monster-data.mjs` (35),
  `images.mjs` (36), `dice.mjs` (37), `active-effect-keys.mjs` (38),
  `actor-importer.mjs` (39). What's left in `config.js` is small scalar enums
  (`abilities` / `saves` / `items` / `currencies` / `critRanges` / …) + the
  Phase 4–6 registry seeds (`classMixins` / `classDefaults` / `sheetParts` /
  `variants` / …) — **leave those in place**; they're tiny and are the file's
  actual reason to exist. No further `config.js` slice is warranted. Open
  question still deferred: whether the unconsumed `activeEffectKeys` table
  (extracted session 38) should be deprecated/removed — see the session-38
  slice.
- **`actor.js` / `actor-sheet.js` / `item.js`** — the remaining Appendix-A
  file-shrinkage targets; each a multi-session project, not a slice; start one
  only with budget for it.

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
