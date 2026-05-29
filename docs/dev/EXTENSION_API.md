# DCC System Extension API

The DCC FoundryVTT system exposes a surface to downstream modules through
two channels: **Foundry hooks** (`Hooks.on('dcc.*', …)`) and the global
**`game.dcc` namespace**. This document categorizes every item on that
surface so module authors know what they can rely on and so the refactor
to an adapter over [`@moonloch/dcc-core-lib`](ARCHITECTURE_REIMAGINED.md)
knows what it must preserve.

> The library is published on npm as **`@moonloch/dcc-core-lib`** (scoped).
> The unscoped name is not published; install / import / link with the
> scoped name only.

**Categories:**

- **Stable** — emitted/exported *and* known to be consumed by at least
  one sibling module. Must be preserved verbatim through the refactor,
  with at least a deprecation window before any breaking change.
- **Internal** — emitted/exported but no external consumer found in the
  audited modules (`dcc-qol`, `xcc`, `xcc-core-book`, `mcc-classes`,
  `dcc-crawl-classes`, `dcc-core-book`, `dcc-annual-1`,
  `token-action-hud-dcc`). Safe to refactor or rename. Flag on a best-
  effort basis if changes land.
- **Dead** — either listened to externally but never emitted by the
  system, or emitted but with no consumers detected anywhere. Candidates
  for removal in coordination with downstream maintainers.

Audit method: `Hooks.(call|callAll|on|once)\(['"]dcc\.` and
`game\.dcc\.*` across sibling modules at
`/Users/timwhite/FoundryVTT-Next/Data/modules/`. Audit performed
2026-04-17 against the commit on `main` at the time (`2337ec0`).
Cross-reference pass against `ARCHITECTURE_REIMAGINED.md
§2.8–§2.12` performed 2026-04-19 (Phase 3 session 8); pain-point
columns added to the tables below. **Re-audit 2026-05-18** (closing
open question #4) confirmed XCC, MCC, dcc-crawl-classes, dcc-qol,
dcc-core-book, xcc-core-book, dcc-annual-1, and
token-action-hud-dcc against the current stable surface. Findings:
XCC retired the `XCCActor` subclass and migrated all 19
actor-sheet registrations to `game.dcc.registerActorSheet` (so
`dcc.afterComputeSpellCheck` now has a live consumer); MCC (7
sites) and dcc-crawl-classes (9 sites) still call
`Actors.registerSheet` directly — migration is opt-in, no
deadline. No undocumented `game.dcc.*` or `dcc.*` hook usage
detected. The tables below reflect the re-audit.

**Group E session 1 — 2026-05-18** added
`dcc.registerMercurialMagicTable(classKey, tableName)` as a Stable
hook from day one (see the table below). It lands the
generalization that the §2.4 critique (and
xcc-core-book's "DCC only supports one" comment) called for.
Migration recipe for xcc-core-book in the "Sibling-module
migration recipes" section below; the legacy `setMercurialMagicTable`
hook stays Stable as a back-compat shim through the new registry.

## Stated contract: Foundry-smelling surface (§2.12)

Per `ARCHITECTURE_REIMAGINED.md §2.12`, the DCC system must keep its
**Foundry-smelling API surface** intact even as internals migrate to
the lib. Third-party Foundry modules — Token Action HUD, Item Piles,
Dynamic Active Effects, Active-Effects-aware HUDs, generic
`dnd-ui`-style consumers — read idiomatic Foundry shapes
(`system.attributes.ac.value`, currency paths, top-level
`type === 'Player' | 'NPC'` discriminators, attribute keys on the
template). Their compatibility constraints bound how aggressive the
refactor can get on `system.*` restructuring (especially
**Phase 4**'s schema slimming).

The categories above already encode the contract for hooks and
`game.dcc.*` exports — the stated commitment now extends explicitly
to the **schema shape** rendered into actor / item documents. This
is the hard ceiling on Phase 4: removing fields whose names or
locations are read by ecosystem tools requires a deprecation window
+ migration shim, not a silent restructure. When in doubt, grep the
audited sibling modules for the path before slimming.

---

## Hooks emitted by the system

### Stable

| Hook | Emit site | Consumers | Pain points it addresses | Notes |
|---|---|---|---|---|
| `dcc.ready` | `module/dcc.js:347` | `xcc`, `dcc-annual-1`, `xcc-core-book`, `dcc-core-book` | §2.10 (content packs are the hand-off boundary between rules + data) | Content modules register their packs on this hook. Any change breaks every content module. |
| `dcc.defineBaseActorSchema` | `module/data/actor/base-actor.mjs:282` | `xcc`, `mcc-classes`, `dcc-crawl-classes` | §2.1 (monolithic Player schema), §2.8 (homebrew classes) | Fires inside `defineSchema()` to let variants extend the base actor schema. |
| `dcc.definePlayerSchema` | `module/data/actor/player-data.mjs` | `xcc`, `mcc-classes`, `dcc-crawl-classes` | §2.1, §2.8, §2.11 (relieves module-extension pressure) | Same as above, for the Player schema. **Phase 4 session 1 (2026-05-18)** added a sibling `game.dcc.registerClassMixin` registry that runs *before* this hook so class-bound fields can move off the monolithic static body; the hook stays the public extension surface for arbitrary cross-cutting schema extensions that aren't naturally class-keyed (rewards, world-specific config blocks, etc.). |
| `dcc.modifyAttackRollTerms` | `module/actor.js:1867` | `dcc-qol` (3 handlers), `xcc` (self-emission) | §2.5 (extension surface), §2.11 | Lets modules modify the terms of an attack roll before it's evaluated. `dcc-qol`'s primary integration point. Phase 3 sessions 3–4 fully bridged it through the adapter (pushed `Modifier` terms surface as `libResult.bonuses`; in-place `terms[0].formula` mutations reflect into `libResult.die`). |
| `dcc.rollWeaponAttack` | `module/actor.js:1782` | `dcc-qol`, `xcc` (several sheets emit + listen) | §2.5, §2.11 | Fired after a weapon attack resolves. Carries `rolls` and `messageData`. |
| `dcc.postActorImport` | `module/parser.js:273` | `xcc` (self-emission) | §2.5 | Fired after Purple Sorcerer / stat-block import. |
| `dcc.registerCriticalHitsPack` | `module/settings.js:76` | `dcc-core-book`, `xcc-core-book` (emitters) | §2.10, §2.11 | Emitted by settings change AND re-emitted by content packs during `dcc.ready`. |
| `dcc.registerDisapprovalPack` | `module/settings.js:124` | `dcc-core-book`, `xcc-core-book`, `dcc-annual-1` (emitters) | §2.10, §2.11 | Same pattern. |
| `dcc.registerLevelDataPack` | *(system listens; emitted by packs)* | `dcc-core-book`, `xcc-core-book`, `dcc-crawl-classes` (emitters); system listens at `dcc.js:923` | §2.10, §2.11 | System is a *listener* here, not an emitter. Class progressions come in through this. |
| `dcc.setFumbleTable` | `module/settings.js:108` | `dcc-core-book`, `xcc-core-book` (emitters) | §2.10 | |
| `dcc.setDivineAidTable` | `module/settings.js:172` | `dcc-core-book` (emitter) | §2.10 | |
| `dcc.setLayOnHandsTable` | `module/settings.js:156` | `dcc-core-book` (emitter) | §2.10 | |
| `dcc.setMercurialMagicTable` | `module/settings.js:188` | `dcc-core-book` (emitter) | §2.4 (hardcoded wizard/cleric magic system), §2.11 | Single-table back-compat setter, kept stable. Now shims through `dcc.registerMercurialMagicTable('default', value)`; existing emitters keep working with no change. Modules that need per-class tables use the new hook below. |
| `dcc.registerMercurialMagicTable` | `module/dcc.js` | `xcc-core-book` (after migration recipe below) | §2.4, §2.11 | `(classKey, tableName)` — register a mercurial-magic table for a specific class. `classKey` is the lowercase `system.details.sheetClass` (`'wizard'`, `'elf'`, `'blaster'`, `'gnome'`, …) or the literal `'default'`. Resolver walks per-class → `'default'` → legacy `CONFIG.DCC.mercurialMagicTable` mirror; first hit wins. Lands the Group E session 1 generalization that retires XCC's per-roll `CONFIG.DCC.mercurialMagicTable = …` monkey-patch (see migration recipe below). Stable from day one. |
| `dcc.setTurnUnholyTable` | `module/settings.js:140` | `dcc-core-book` (emitter) | §2.10 | |
| `dcc.afterComputeSpellCheck` | `module/actor.js:786` | `xcc` (consumed since 2026-05-18; `xcc/module/xcc.js:42` — XCC retired the `XCCActor` subclass + global `CONFIG.Actor.documentClass` replacement in favor of this hook) | §2.5 (Actor document class customization) | Fires at the end of `DCCActor.computeSpellCheck()` with `(actor)` after `system.class.spellCheck` has been populated by the default DCC computation. Listeners can observe or overwrite the result. Only fires when DCC actually computed something (the `!this.system.class` early-return path skips the hook so listeners don't have to defensively re-check). Stable from day one. |

### Internal

| Hook | Emit site | Reason |
|---|---|---|
| `dcc.registerSpellSideEffectsPack` | `module/settings.js:92` | No consumers found in audited modules. Appears to be self-contained. |

### Dead

None identified. (`dcc.update` was an XCC-side speculative listener with no DCC emission; removed from XCC on `chore/drop-dead-dcc-update-hook` 2026-05-18.)

---

## `game.dcc.*` exports

Set in `module/dcc.js:108–121`.

### Stable

| Export | Kind | Consumers | Pain points it addresses | Notes |
|---|---|---|---|---|
| `game.dcc.DCCRoll` | class | `dcc-qol` (`createRoll`), `xcc` (`createRoll`, `cleanFormula`) | §2.5 (extension surface), §2.9 (lib retirement reduces upgrade tax) | The unified roll abstraction. `createRoll(terms, data, options)` and `cleanFormula(terms)` are load-bearing. |
| `game.dcc.DiceChain` | object | `dcc-qol` (`bumpDie`), `xcc` (`bumpDie`, `calculateCritAdjustment`, `calculateProportionalCritRange`) | §2.5 | Dice-chain utility. Every XCC class sheet's attack/crit code calls these. |
| `game.dcc.FleetingLuck` | class | `xcc` (`init`, `updateFlags`, `give`, `enabled`, `automationEnabled`) | §2.5 | XCC uses `Object.defineProperty` on `enabled` and `automationEnabled` — so those must remain configurable properties, not frozen. |
| `game.dcc.processSpellCheck` | function | `xcc` (`xcc-actor-sheet.js` for wizard + cleric spells) | §2.4 (magic system), §2.5, §2.11 | Post-roll spell-check orchestrator: pre-built `Roll` + optional `RollTable` → patron taint check + crit/fumble classification + result-table lookup + level-added crit totaling + `SpellResult` chat render + wizard spell loss / cleric disapproval gating. **Phase 2 close (2026-04-18) finalized this as a permanent stable API** — not a deprecation target. The adapter dispatcher (`DCCActor.rollSpellCheck`) routes the happy-path generic / wizard / cleric / patron-bound casts through `_castViaCastSpell` / `_castViaCalculateSpellCheck`; everything else (result-table spells, naked pre-built-Roll calls, skill-table spells like Turn Unholy, XCC sheet paths with elf-trickster / blaster tweaks) continues to invoke `processSpellCheck`. Future adapter capability growth (result-table rendering, manifestation, forceCrit, mercurial display w/o race condition) can progressively migrate routes; `processSpellCheck` stays as the fallback orchestrator indefinitely. See `docs/00-progress.md` Phase 2 close-out for the inventory and rationale. |
| `game.dcc.registerItemSheet` | function | (none yet — stable from day one per recommendation 7) | §2.5 (extension surface), §2.11 | `(types, SheetClass, options?)` — single declarative call that folds the `Items.unregisterSheet('core', ItemSheetV2) + Items.registerSheet(scope, SheetClass, …)` boilerplate. `types` is `string \| string[] \| undefined` (undefined → all sub-types). `options.makeDefault: true` (the common case) also unregisters Foundry's core `ItemSheetV2` for the same `types` so the new sheet wins the default-pick. Source: `module/extension-api.mjs`. Added 2026-04-19 (Group B1). DCC's own `DCCItemSheet` registration was migrated to dogfood the helper — see `module/dcc.js`. |
| `game.dcc.registerActorSheet` | function | `xcc` (all 19 sites migrated; `xcc/module/xcc.js:178–286`), `dcc-crawl-classes` (9 sites migrated 2026-05-29, PR foundryvtt-dcc/dcc-crawl-classes#40) and `mcc-classes` (7 sites migrated 2026-05-29, PR foundryvtt-dcc/mcc-classes#38). | §2.5 (extension surface), §2.11 | `(types, SheetClass, options?)` — Actor-side mirror of `registerItemSheet`. Same signature shape; defaults `options.scope` to `'dcc'` (sibling modules pass their own scope: `'xcc'`, `'mcc-healer'`, `'dcc-crawl-classes-bard'`, etc.). Closes the 19 `Actors.registerSheet('xcc', ...)` calls in XCC (migrated 2026-05-18), 7 in MCC + 9 in dcc-crawl-classes (both migrated 2026-05-29 — those modules now also dogfood the per-class `registerClassMixin` / `registerClassDefaults` / `registerSheetPart` stack), and 11 in DCC's own code (the latter migrated 2026-04-19 to dogfood the helper). The legacy global `Actors.unregisterSheet('core', ActorSheetV2)` line in `module/dcc.js` is kept as a one-shot system-replaces-core gesture, separate from any single helper call. Source: `module/extension-api.mjs`. Added 2026-04-19. |
| `game.dcc.registerClassMixin` | function | (none yet — stable from day one per recommendation 7) | §2.1 (monolithic Player schema), §2.8 (homebrew classes), §2.11 | `(classId, mixinFn)` — register a class-specific schema mixin invoked during `PlayerData.defineSchema()` (deterministic-sorted classId order, **before** the `dcc.definePlayerSchema` hook). `classId` is the lowercase canonical class identifier (`'halfling'`, `'warrior'`, `'cleric'`, …). The mixin receives the in-progress schema and typically attaches fresh `SchemaField` instances onto `schema.skills.fields` or `schema.class.fields`. Last-write-wins on duplicate `classId` (lets a sibling fully replace a DCC built-in, e.g. an XCC halfling variant). Phase 4 §2.1 — the system relocates class-bound fields off `player-data.mjs`'s monolithic body onto per-class mixins; session 1 ships the infrastructure plus a built-in `'halfling'` mixin for `sneakAndHide` (DCC's own dogfooding seed). Source: `module/extension-api.mjs`. Added 2026-05-18 (Group E session 2 / Phase 4 session 1). |
| `game.dcc.registerClassDefaults` | function | (none yet — stable from day one per recommendation 7) | §2.8 (homebrew classes), §2.11 (class sheets fight Foundry) | `(classId, defaults)` — register class identity + mechanical defaults that the sheet writes onto an actor on first open. `defaults` is `{ sheetClass, localize?, enrichHtml?, literal? }` — `sheetClass` (required) is the capitalized sentinel for `system.details.sheetClass`; `localize` maps `system.*` paths to i18n keys resolved via `game.i18n.localize`; `enrichHtml` maps to keys whose localized value runs through `TextEditor.enrichHTML` (typical: `class.classLink` + optional `mightyDeedsLink` / `spellcastingLink` / `spellburnLink`); `literal` maps to pre-resolved scalar values (critRange, attackBonusMode, addClassLevelToInitiative, etc.). Internal helper `applyClassDefaults(actor, classId)` does the write — returns `'initialized'` on the sheetClass-doesn't-match branch, `'regenerated'` on the classLink-missing maintenance branch, `'unchanged'` otherwise. Last-write-wins on duplicate `classId`. Phase 5 §2.11 — the system lifts each class sheet's `_prepareContext` first-open block onto this registry; session 1 ships the infrastructure plus 7 built-in PC class entries. Source: `module/extension-api.mjs`. Added 2026-05-18 (Phase 5 session 1). |
| `game.dcc.registerClassStartingItems` | function | (none yet — stable from day one per recommendation 7) | §2.8 (homebrew classes), §2.11 | `(classId, items)` — register starting equipment that the class sheet auto-creates on a new character's first open. `items` is an array of `{ nameKey, type, img?, system? }` factory descriptors. Internal helper `applyClassStartingItems(actor, classId)` resolves `nameKey` via `game.i18n.localize`, dedupes against existing `(type, localized-name)` matches on the actor, batches missing entries into a single `createEmbeddedDocuments('Item', [...])` call, and returns the created docs (or `[]` if nothing was created). Class sheets call this in the `applyClassDefaults` `'initialized'` branch. Last-write-wins on duplicate `classId`. Today the only built-in entry is dwarf's ShieldBash weapon; the registry exists for homebrew classes to ship their own starting equipment without subclassing or monkey-patching the sheet. Source: `module/extension-api.mjs`. Added 2026-05-18 (Phase 5 session 2). |
| `game.dcc.registerSheetPart` | function | (none yet — stable from day one per recommendation 7) | §2.8 (homebrew classes), §2.11 | `(classId, descriptor)` — register per-class sheet parts (Handlebars template fragments) and tab labels. Descriptor shape: `{ parts, tabs }` mirroring ApplicationV2's `PARTS` + `TABS` statics — `parts` is `partKey → { id, template }`, `tabs` is `group → { tabs: [{ id, group, label }, …] }`. The `DCCSheet` base class in `module/actor-sheets-dcc.js` exposes inherited static getters `CLASS_PARTS` + `CLASS_TABS` that resolve from `CONFIG.DCC.sheetParts[this.CLASS_ID]` at lookup time. Last-write-wins on duplicate `classId`. Templates must be pre-registered via `loadTemplates` in `module/dcc.js:init` (or the sibling module's equivalent). Phase 5 session 4 lifted the per-class `CLASS_PARTS` + `CLASS_TABS` statics off the 7 built-in PC sheet subclasses onto this registry; each subclass now is a 4-line stub pinning `static CLASS_ID`. Sibling modules ship a homebrew class as `registerSheetPart('my-druid', {...})` + a 4-line `class MyDruidSheet extends DCCSheet { static CLASS_ID = 'my-druid' }` + `registerActorSheet('Player', MyDruidSheet, …)`. Source: `module/extension-api.mjs`. Added 2026-05-18 (Phase 5 session 4). |
| `game.dcc.registerClassProgression` | function | (none yet — stable from day one per recommendation 7) | §2.8 (homebrew classes), §8.1 (data ship) | `(progression)` — register a level-by-level class progression with the lib's class registry. Once registered, the lib's consumer APIs (`getSavingThrows`, `getCritDie`, `getSaveBonus`, `getClassProgression`) return non-zero values for actors of that class. `progression` shape: `{ classId, name, skills, levels: { 1: ProgressionLevelData, 2: …, … } }` — see `module/vendor/dcc-core-lib/types/class-progression.d.ts` for the full type. `classId` is the lowercase canonical identifier (`'warrior'`, `'cleric'`, …). Last-write-wins on duplicate `classId`. Re-export of the vendored lib's `registerClassProgression` from `module/vendor/dcc-core-lib/data/classes/progression-utils.js`. **Note on data:** the open-source DCC system ships only the registration surface; class progression *data* is copyrighted Goodman Games material that lives in the private `dcc-official-data` repo (per `ARCHITECTURE_REIMAGINED.md §8.1`). Content modules — a future `dcc-core-book` update, sibling content packs — call this helper with their own data on their own schedule. Added 2026-05-19 (Phase 6 session 1). |
| `game.dcc.registerClassProgressions` | function | (none yet — stable from day one per recommendation 7) | §2.8, §8.1 | `(progressions)` — bulk variant of `registerClassProgression`. Takes an array of progressions and registers each. Re-export of the vendored lib's `registerClassProgressions`. Same data-ship note applies — payload lives in content modules, not the open-source system. Added 2026-05-19 (Phase 6 session 1). |
| `game.dcc.registerHomebrewClassForProgressionLoad` | function | (none yet — stable from day one per recommendation 7) | §2.8 (homebrew classes), §8.1 (data ship) | `(classId, itemPrefix)` — register a homebrew class for the Phase 6 level-data-pack loader. `classId` is the lowercase canonical identifier; `itemPrefix` is the leading token of the level-data items (`{itemPrefix}-{level}`). The loader at `module/adapter/foundry-data-loader.mjs` reads from `CONFIG.DCC.classLevelNames` at `dcc.ready` time and walks every registered class for its level items, then registers an assembled `ClassProgression` via `registerClassProgressions(...)`. Last-write-wins on duplicate `classId`. Phase 6 session 3 lifted the previously hardcoded `BUILT_IN_CLASS_LEVEL_NAMES` table onto this registry — the 7 canonical PC classes are seeded by `module/built-in-class-level-names.mjs` at system `init`. Sibling-module recipe: call `CONFIG.DCC.levelDataPacks.addPack(...)` to register the level-data pack, then call this helper from the same `init` hook to register the classId → itemPrefix mapping; the loader picks it up at `dcc.ready`. Source: `module/extension-api.mjs`. Added 2026-05-19 (Phase 6 session 3). |
| `game.dcc.registerVariant` | function | (none yet — stable from day one per recommendation 7) | §2.5 (extension surface), §2.8 (homebrew), §3.6 (variant identity) | `(descriptor)` — register a variant ruleset (the named set of classes active in a world). Descriptor shape: `{ id, label, classes, sheetTheme? }`. `id` is a lowercase slug (`'dcc'`, `'xcc'`, `'mcc'`) used as the registry key and the value stored in the `dcc.activeVariant` world setting. `label` is an i18n key resolved via `game.i18n.localize` at render time. `classes` is the array of canonical classIds declared by this variant (declarative metadata; the registry doesn't enforce membership). `sheetTheme` is an optional CSS class added to the actor sheet element when this variant is the active one (the base `'dcc'` variant ships without one — base CSS already is the DCC theme; XCC / MCC declare e.g. `'theme-xcc'` so their styles scope under a single root selector without each per-class sheet subclass declaring the CSS class). Last-write-wins on duplicate `id`. Phase 6 session 5 added this surface so variant modules can ship as Foundry modules rather than overriding `CONFIG.Actor.documentClass` globally; the DCC system dogfoods its own helper by seeding the canonical `'dcc'` variant via `module/built-in-variant.mjs` at `init`. Source: `module/extension-api.mjs`. Added 2026-05-20 (Phase 6 session 5). |
| `game.dcc.getActiveVariant` | function | (none yet — stable from day one per recommendation 7) | §3.6 (variant identity) | `()` — resolve the active variant from the `dcc.activeVariant` world setting and return its registered descriptor. Returns the registry entry stored via `registerVariant` (`{ id, label, classes, sheetTheme? }`), with a `'dcc'` fallback when the configured id is missing. Returns `null` only when neither the configured nor the built-in `'dcc'` variant is registered (defensive; `init` always seeds `'dcc'`). Survives pre-`ready` callers (where `game.settings.get` throws). Source: `module/extension-api.mjs`. Added 2026-05-20 (Phase 6 session 5). |

### Internal

| Export | Kind | Reason |
|---|---|---|
| `game.dcc.DCCActor` | class | No external references found; Foundry reaches the document class through `CONFIG.Actor.documentClass`. XCC replaces that globally anyway — it doesn't use `game.dcc.DCCActor`. |
| `game.dcc.SpellDuel` | class | No external references. |
| `game.dcc.SpellResult` | class | No external references. |
| `game.dcc.TableResult` | class | No external references. |
| `game.dcc.getSkillTable` | function | `dcc-qol` only references it inside a test mock (`scripts/__mocks__/foundry.js`), not in runtime code. Treat as internal. |
| `game.dcc.rollDCCWeaponMacro` | function | Called from hotbar macros (see comment in `dcc.js`). Not imported by modules. |
| `game.dcc.getMacroActor` | function | Same — macro surface. |
| `game.dcc.getMacroOptions` | function | Same — macro surface. |

The macro-surface functions (`rollDCCWeaponMacro`, `getMacroActor`,
`getMacroOptions`) are internal to modules but **published to end-user
macro scripts**. They're de-facto stable in the same sense that the
`game.dcc.*` JS shape is.

### Dead

None identified.

---

## Recommendations for the refactor

1. **Preserve every "Stable" item verbatim** through Phases 1–3. Thin
   wrappers are fine; signatures and hook names are not negotiable
   without a deprecation window.
2. ~~**Generalize** `dcc.setMercurialMagicTable`~~ **Landed 2026-05-18
   (Group E session 1).** New `dcc.registerMercurialMagicTable(classKey,
   tableName)` hook + per-class registry at
   `CONFIG.DCC.mercurialMagicTables`. The old `setMercurialMagicTable`
   hook shims through `register('default', value)`, so existing
   emitters (dcc-core-book etc.) keep working with no change. Resolver
   walks per-class → `'default'` → legacy single-table mirror; both
   the adapter spell-check path and the legacy `DCCItem.rollMercurialMagic`
   item-sheet button use the same resolver, which is what lets XCC's
   per-roll `CONFIG.DCC.mercurialMagicTable = …` monkey-patch retire.
   See the XCC migration recipe below. (Addressed §2.4 + §2.11.)
3. ~~**Resolve `dcc.update`**~~ **Resolved 2026-05-18.** Listener was
   speculative (XCC initial commit, no DCC emission ever). XCC
   `chore/drop-dead-dcc-update-hook` removes the listener; nothing
   re-introduced DCC-side.
4. **"Stabilize" `DCCRoll.cleanFormula` and the three `DiceChain`
   utilities** as the de-facto API surface XCC depends on. They're
   currently undocumented; the refactor should add JSDoc treating them
   as a public contract. (Addresses §2.5.)
5. **`game.dcc.processSpellCheck` is a permanent stable API** (decision
   at Phase 2 close, 2026-04-18). The earlier plan to deprecate-and-shim
   was abandoned once the audit showed XCC's two call sites are
   structurally identical peers of DCC's own internal callers (not
   public-API consumers). Keep the export, keep the implementation, grow
   the adapter alongside it. Route migration is per-call-site and
   incremental — no global deprecation.
6. **Honor the §2.12 Foundry-smelling-surface contract** during Phase 4
   schema slimming. See the contract section at the top of this doc:
   removing or relocating fields read by ecosystem tools (Token Action
   HUD, Item Piles, Dynamic Active Effects, etc.) requires a deprecation
   window + migration shim, not a silent restructure. This bounds the
   reach of every `system.*` change.
7. **Plan extension-hook additions to relieve §2.11 pressure.** The
   refactor's stated direction (§2.5, §2.8, §2.11) calls for new
   stable-from-day-one hooks to absorb pressure that currently leaks
   into core: `dcc.registerItemSheet` (closes §2.5 — Group B1, landed
   2026-04-19), `dcc.registerActorSheet` (mirror; closes ~46 sibling
   call sites across XCC + MCC + dcc-crawl-classes — landed
   2026-04-19), `dcc.registerClassMixin` (closes §2.1 monolithic
   Player schema — Phase 4 session 1, landed 2026-05-18 with a
   built-in `'halfling'` mixin for `sneakAndHide`; subsequent slices
   relocate additional class-bound fields the same way),
   `dcc.registerSheetPart` + `dcc.registerVariant` (Phase 5/6). Each
   ships **stable** the moment it lands; document under the table above
   rather than waiting for downstream consumers to materialize.

---

## Conventions for modules reading actor data

### Class dispatch uses internal class IDs, not localized labels

When branching on an actor's class, **read `system.details.sheetClass`**
(or the lib's class-ID registry) and compare against the canonical
English ID (`'halfling'`, `'warrior'`, `'cleric'`, `'thief'`, `'wizard'`,
`'elf'`, `'dwarf'`).

**Don't dispatch on `system.class.className`.** That field is the
*localized* display label populated by the sheet at init time — its
value depends on the GM's locale, so equality checks break silently in
non-English games. The anti-pattern looks like:

```js
// 🚫 breaks on any non-English locale
if (actor.system?.class?.className === game.i18n.localize('DCC.Halfling')) { … }
```

Correct form:

```js
// ✅ locale-independent
if (actor.system?.details?.sheetClass === 'halfling') { … }
```

A vitest regression guard
(`module/__tests__/class-dispatch-i18n-guard.test.js`) greps module
source for `X === game.i18n.localize(...)` and fails the suite if the
anti-pattern reappears. `module/migrations.js:235` intentionally uses
the *inverse* direction (`game.i18n.localize(…) === className`) to map
legacy localized `className` data back to internal IDs during world
migration — that's legitimate and not caught by the guard.

---

## Sibling-module migration recipes

Concrete step-by-step migrations for downstream modules. **The DCC
system never modifies sibling modules directly** — these recipes are
notes for the sibling maintainers (or whoever is coordinating the
multi-repo change) so they can land the migration on their own
timeline. The system stays backward-compatible: nothing here is
required for a sibling module to keep working.

### XCC migration: retiring `xcc-actor.js` — **completed 2026-05-18**

**Status:** done. XCC landed the migration; `xcc/module/xcc-actor.js`
no longer exists and there is no `CONFIG.Actor.documentClass`
override in `xcc/module/xcc.js`. The `dcc.afterComputeSpellCheck`
listener now lives at `xcc/module/xcc.js:42` and consumes the hook
DCC ships. Recipe retained below for reference / for other modules
considering a similar Actor-subclass retirement.

**Original goal:** Drop the `XCCActor` subclass + the global
`CONFIG.Actor.documentClass = XCCActor` replacement. Before this
migration, XCC paid for one method override (`computeSpellCheck`) by
replacing the entire actor document class globally — a textbook §2.5
monkey-patch.

**Why it was safe to retire:** `xcc-actor.js` overrode exactly one
method, and that override was purely additive (called `super` first,
then conditionally overwrote `system.class.spellCheck`). The
`dcc.afterComputeSpellCheck` hook fires at the same point with
identical pre-/post-state.

**Step 1 — register the listener.** In `xcc/module/xcc.js` (any
`Hooks.once('init', …)` block, before any actor is rendered):

```js
import { calculateSpellCheckBonus } from './xcc-utils.js'

Hooks.on('dcc.afterComputeSpellCheck', (actor) => {
  // DCC has already run; `actor.system.class.spellCheck` reflects the
  // default computation (with `spellCheckOverride` already applied).
  // Only override the fallback path — XCC's blaster-die /
  // elf-trickster math wins when no explicit override is set.
  if (!actor.system.class.spellCheckOverride) {
    actor.system.class.spellCheck = calculateSpellCheckBonus(actor)
  }
})
```

**Step 2 — delete the subclass.**

- Delete `xcc/module/xcc-actor.js` entirely.
- Remove `import XCCActor from './xcc-actor.js'` from `xcc.js`.
- Remove the `CONFIG.Actor.documentClass = XCCActor` line.

**Step 3 — verify.** Open an XCC PC, confirm `system.class.spellCheck`
matches the pre-migration value (DCC computes first, XCC's hook
adjusts second). Specifically check: blaster-die actors, sp-elf-
trickster actors (luck mod folded in), actors with a string
`spellCheckOtherMod`. The XCC test suite (if present) should pass
unchanged.

**No DCC system change was required for this migration** — the hook
shipped 2026-04-19 (see the "Stable" hooks table) and XCC adopted it
on its own schedule.

### XCC / MCC / dcc-crawl-classes migration: actor-sheet boilerplate

**Goal:** Collapse each `Actors.registerSheet('<scope>', SheetClass,
{ types: ['Player'], label: '…' })` call into
`game.dcc.registerActorSheet('Player', SheetClass, { scope: '<scope>',
label: '…' })`. Identical behavior; one line shorter; no need to
import `Actors` from `foundry.documents.collections`.

**Per-module call counts (audited 2026-04-19; re-confirmed 2026-05-18):**
- ~~XCC: 19 call sites in `xcc/module/xcc.js`~~ — **migrated
  2026-05-18.** All 19 sites now call `game.dcc.registerActorSheet`
  at `xcc/module/xcc.js:178–286`.
- MCC: 7 call sites in `mcc-classes/module/mcc-classes.js` (lines
  122–146) — **not yet migrated.**
- dcc-crawl-classes: 9 call sites in
  `dcc-crawl-classes/module/dcc-crawl-classes.js` (lines 137–145)
  — **not yet migrated.**

**Recipe (per call site):**

```js
// Before
Actors.registerSheet('xcc', XCCActorSheetAthlete, {
  types: ['Player'],
  label: 'XCC.Athlete.DropdownLabel'
})

// After
game.dcc.registerActorSheet('Player', XCCActorSheetAthlete, {
  scope: 'xcc',
  label: 'XCC.Athlete.DropdownLabel'
})
```

`addHooksAndHelpers()` calls (or any other post-register
side-effects) stay verbatim.

**Optional: drop the `Actors` import.** Once every `Actors.*` call
in the module has migrated, the `const { Actors } =
foundry.documents.collections` declaration at the top of the file
can be removed.

**No DCC system change required** — `game.dcc.registerActorSheet`
ships stable.

### XCC item-sheet helper

XCC currently does not register custom item sheets, so
`game.dcc.registerItemSheet` has no XCC migration today. If XCC
adds a future item sheet, the recipe mirrors the actor-sheet one
above (substitute `registerItemSheet` for `registerActorSheet` and
the appropriate item sub-types).

### xcc-core-book migration: retiring the mercurial-magic monkey-patch

**Goal:** Drop the per-roll `CONFIG.DCC.mercurialMagicTable = …`
mutation in `xcc-core-book/module/xcc-item-sheet.js:49-58` (both
`_rollMercurialMagic` and `_lookupMercurialMagic`) in favor of
registering each XCC mercurial table once at `dcc.ready`. Before
this migration, XCC sets the global mercurial-magic table on every
roll based on `sheetClass`, which works but textbook-monkey-patches
a piece of system state. Comment in
`xcc-core-book/module/dccModule.js:66-67` ("XCC has 2 Mercurial
tables and DCC only supports one. We don't call
'setMercurialMagicTable' hook") was the long-standing tracking
issue.

**Why it's safe to retire:** the DCC system now keeps a per-class
registry (`CONFIG.DCC.mercurialMagicTables`) populated via the new
`dcc.registerMercurialMagicTable(classKey, tableName)` hook. Both
the adapter cast path AND the legacy `DCCItem.rollMercurialMagic`
item-sheet button use the same resolver, which walks the per-class
slot first. Once XCC's two tables are registered against `'blaster'`
and `'gnome'`, the item-sheet button looks up the right table by
`actor.system.details.sheetClass` without any caller-side mutation.

**Step 1 — register the tables.** In
`xcc-core-book/module/dccModule.js`, replace the existing comment
block (which currently explains *why* the registration is skipped)
with the two `register` calls inside the existing `dcc.ready`
handler:

```js
Hooks.once('dcc.ready', async function () {
  // ...existing pack registrations...
  Hooks.callAll('dcc.registerMercurialMagicTable', 'blaster',
    'xcc-core-book.xcc-core-tables.Table 7-1: Blaster Mercurial Effects')
  Hooks.callAll('dcc.registerMercurialMagicTable', 'gnome',
    'xcc-core-book.xcc-core-tables.Table 7-2: Gnome Mercurial Effects')
})
```

**Step 2 — drop the monkey-patch.** In
`xcc-core-book/module/xcc-item-sheet.js:49-58`, delete the
`CONFIG.DCC.mercurialMagicTable = sheetClass === 'gnome' ? … : …`
line at the top of both `_rollMercurialMagic` and
`_lookupMercurialMagic`. Each method becomes a pass-through:

```js
async _rollMercurialMagic (event, options) {
  await this.document.rollMercurialMagic(undefined, options)
}

async _lookupMercurialMagic () {
  await this.document.rollMercurialMagic(this.document.system.mercurialEffect.value)
}
```

`DCCItem.rollMercurialMagic` now resolves the table via the registry
keyed on `actor.system.details.sheetClass`, which for XCC actors
is `'blaster'` or `'gnome'` — matching the registrations above.

**Step 3 — verify.** Open an XCC PC with a blaster sheet, roll
mercurial on a spell, confirm the rolled effect comes from Table
7-1. Repeat with a gnome PC, confirm Table 7-2. Confirm DCC core
wizard / elf casts on a vanilla world still resolve the
core-book mercurial table (via the `'default'` slot the legacy
`setMercurialMagicTable` shim populates).

**No DCC system change required for this migration** — the registry
hook ships stable on 2026-05-18 (see the "Stable" hooks table). The
xcc-core-book maintainer can land both steps in a single PR on their
own schedule. Until the migration lands, the legacy monkey-patch
keeps working: it still writes to `CONFIG.DCC.mercurialMagicTable`,
which is the last fallback in the resolver chain.

### Homebrew / sibling-module recipe: registerClassMixin

**Goal:** Contribute class-specific schema fields without touching the
DCC system's `module/data/actor/player-data.mjs` static body. Sibling
modules adding their own classes (homebrew, MCC class packs, XCC
specialists) use this in place of mutating
`schema.skills.fields.*` blindly inside `dcc.definePlayerSchema`.

**Why:** Direct mutation of the shared schema via `definePlayerSchema`
works but spreads class-bound knowledge across every consumer.
`registerClassMixin` keyed by `classId` puts each class's schema
extension under a name that can be inspected, removed, or replaced —
sibling modules can fully override a built-in DCC class mixin by
re-registering the same `classId` (last-write-wins), and Phase 4's
direction is to drive every class-bound field through this registry.

**Recipe:**

```js
Hooks.once('init', () => {
  game.dcc.registerClassMixin('steampunk-inventor', (schema) => {
    const fields = foundry.data.fields
    // New skill specific to the homebrew class.
    schema.skills.fields.tinker = new fields.SchemaField({
      label: new fields.StringField({ initial: 'Homebrew.Tinker' }),
      ability: new fields.StringField({ initial: 'int' }),
      value: new fields.StringField({ initial: '+0' })
    })
    // Class-bound progression field on the class block.
    schema.class.fields.contraptionCharges = new fields.NumberField({
      initial: 1, integer: true, min: 0
    })
  })
})
```

**Caller contract:**

- `classId` is the lowercase canonical identifier used elsewhere for
  class dispatch (the same string `system.details.sheetClass` should
  hold for a character of this class — see the "Conventions for
  modules reading actor data" section above).
- The mixin function is invoked during `PlayerData.defineSchema()`.
  Each call must construct **fresh `SchemaField` instances** —
  Foundry caches field objects per schema and may re-invoke
  `defineSchema()`; reusing field instances across schemas corrupts
  state.
- Mixin order is deterministic (sorted `classId`). Don't rely on
  registration order; if you need to override another mixin's
  contribution, register the same `classId` after it (last-write-wins
  on the registry entry, but field-level merges still depend on the
  schema state when your mixin runs).
- `dcc.definePlayerSchema` fires **after** all registered mixins;
  use the hook for cross-class extensions (rewards, world-config
  blocks) and the mixin registry for class-keyed ones.

**No DCC system change required for sibling adoption** — the helper
ships stable on 2026-05-18 (see the "Stable" `game.dcc.*` exports
table). DCC dogfoods its own seed by registering the `'halfling'`
mixin (which contributes `skills.sneakAndHide`) at
`module/dcc.js:init`.

### dcc-qol migration: `critText` / `fumbleText` → `critResult` / `fumbleResult`

**Goal:** Read the canonical crit / fumble detail fields on the
weapon-attack chat `messageData.system` instead of the
`critText` / `fumbleText` legacy aliases.

**Why:** DCC's `rollWeaponAttack` previously emitted both
`critResult` / `fumbleResult` (the canonical names) AND
`critText` / `fumbleText` (duplicate aliases carrying the same
values, labeled "Legacy name for dcc-qol compatibility" in
`module/actor.js`). The aliases are a §2.7 cruft shim from before
`critResult` / `fumbleResult` stabilized as names. Retiring them
slims the messageData shape without changing any emitted values.

**Scope:** two lines in
`dcc-qol/scripts/hooks/attackRollHooks.js`.

```js
// Before (lines 283–284)
const automatedCritDetails = messageData.system.critText || "";
const automatedFumbleDetails = messageData.system.fumbleText || "";

// After
const automatedCritDetails = messageData.system.critResult || "";
const automatedFumbleDetails = messageData.system.fumbleResult || "";
```

The enriched-HTML comment at line 282 ("critText and fumbleText are
already enriched HTML by the DCC system if automated") stays
accurate — the post-rename field names are the ones the DCC system
already enriches. Update the comment in the same diff if desired:
"critResult and fumbleResult are already enriched HTML …".

**Timing:** dcc-qol should land this fix **before or alongside** the
DCC system's shim removal. DCC removed the shim on the
`refactor/dcc-core-lib-adapter` branch (2026-04-20, C1 cruft slice);
a dcc-qol version built against a DCC release that still emits the
shim continues to work unchanged until the shim removal ships.
A dcc-qol version still reading `critText` / `fumbleText` after the
shim removal ships will silently display empty strings for the
"automated crit/fumble details" section of the chat card until
updated.

**No DCC system change required after this slice** — `critResult`
and `fumbleResult` have always been emitted alongside the shim
aliases; this migration just flips the reader.
