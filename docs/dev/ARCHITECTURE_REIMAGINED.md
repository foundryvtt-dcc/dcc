# DCC Architecture — Reimagined

**Status:** Discussion draft · 2026-04-17 (revised)
**Audience:** System maintainers, `dcc-core-lib` authors, module authors considering DCC spinoffs
**Scope:** Strategic refactor directions, centered on the existing `dcc-core-lib` package

---

## 0. The situation

Three forces are pushing at the DCC system at once:

1. **Age.** The codebase is ~6 years old. Five files carry over 8,000 of its ~15,000 lines. Migration code, "Legacy name for dcc-qol compatibility" comments, and string-matched class dispatch are accumulating.
2. **Spinoffs.** MCC, XCC, Crawl!, Empire of the East, and future settings keep reusing the DCC engine. Some (MCC, dcc-crawl-classes) extend cleanly through two documented hooks. Others (XCC) must replace `CONFIG.Actor.documentClass` globally because no clean API exists for "I'm a variant game, not an add-on."
3. **Homebrew.** Users want to invent classes, skills, and sheet layouts without touching the system. Today this is impractical — every class field lives in one Player schema, sheet selection is manual, and class-specific behavior is scattered through string checks.

**And now there's a fourth, much bigger factor:** a pure-functional TypeScript engine for DCC already exists as `dcc-core-lib` at `/Users/timwhite/WebstormProjects/dcc-core-lib`. 44K lines of source, 1,079 passing tests, zero Foundry dependencies, explicit `SystemConfig` for variants, and a unified skill model where everything from Turn Unholy to an attack roll is a `SkillDefinition`.

This changes the refactor question entirely. The goal isn't "rebuild the DCC engine inside Foundry." The goal is **thin the Foundry system until it's an adapter over `dcc-core-lib`**.

---

## 1. Current state — what's working in the Foundry system

Before critiquing, name the strengths. Any refactor should preserve these:

### 1.1 DCCRoll is already a unified roll abstraction
`module/dcc-roll.js` and `module/roll-modifier.js` funnel every roll (ability check, save, skill, spell, attack, crit, damage, init) through `DCCRoll.createRoll(terms, data, options)`. This is the bridge that makes delegating rolls to `dcc-core-lib` feasible without fighting Foundry's dice pipeline.

### 1.2 The data model is modern (V14 TypeDataModel)
No `template.json`. `module/data/actor/*.mjs` and `module/data/item/*.mjs` define schemas as classes with `defineSchema()` and `migrateData()`. This is the modern Foundry V14 pattern — refactors can lean on it, not fight it.

### 1.3 Schema extension hooks exist and work
Two hooks — `dcc.defineBaseActorSchema` and `dcc.definePlayerSchema` — fire inside `defineSchema()` after the base is built (`player-data.mjs:231-247`). **MCC and dcc-crawl-classes both use them successfully with zero monkey-patching.**

### 1.4 The `skill` item type is already close to a CheckSpec
`module/data/item/skill-data.mjs` defines skills as items with `ability`, `die`, `value`, and `config.{useAbility,useDie,useLevel,useValue,applyCheckPenalty}`. That's a CheckSpec in miniature — and it maps almost 1:1 to `dcc-core-lib`'s `SkillDefinition.roll` shape.

### 1.5 `rollSkillCheck()` already handles both built-in and item-based skills
`actor.js:1111` dispatches to either `system.skills.{id}` or a skill-typed item. The abstraction is in place; what's missing is routing *through* it.

### 1.6 i18n discipline, test coverage, migration infrastructure
Seven language files with `npm run compare-lang`. 17 unit + 4 integration test files. 418 lines of migration logic that's boring and correct. Preserve all of it.

---

## 2. Current state — what's painful

### 2.1 The Player schema is monolithic
Every Player actor — Warrior, Wizard, or an XCC Archaeologist — carries *every* DCC class's fields: cleric disapproval + spells 1–5, thief 13 skills + luck die, wizard patron + corruption + familiar + mercurial magic, halfling `sneakAndHide`, dwarf `shieldBash`, warrior `luckyWeapon`, elf `detectSecretDoors` override. Spinoffs can **add** via hooks but cannot **remove or restructure**.

### 2.2 Class dispatch is string-matched, not polymorphic
Examples from the audit:
- `actor.js:134` — `if (this.system.details.sheetClass === 'Elf')`
- `actor.js:1393` — `const isIdolMagic = this.system.details.sheetClass === 'Cleric'`
- `actor.js:1725` — `this.system?.class?.className === game.i18n.localize('DCC.Halfling')` ⚠️ *compares to a localized string*
- `item.js:71` — same halfling localized-string bug
- `dcc.js:743` — cleric disapproval drain

**The halfling checks are a latent i18n bug:** if the translation of "Halfling" ever changes, the two-weapon fumble rule silently stops firing. Fix before anything else.

### 2.3 Seven class sheets registered for one document type, no auto-selection
All registered for `type: Player` with `makeDefault: false`. The user picks one manually. Each subclass hardcodes its own `CLASS_PARTS` / `CLASS_TABS`. XCC has 20 sheet subclasses, MCC has 7, every spinoff reinvents the sheet-per-class pattern because no composition primitive exists.

### 2.4 The magic system is hardcoded to wizard/cleric
`config.js:188-192` hardcodes three casting modes (`generic`, `wizard`, `cleric`). `processSpellCheck` (~200 lines) interleaves wizard spell loss, cleric disapproval, patron taint, and mercurial magic in one procedure.

The smoking gun from `xcc-core-book/module/dccModule.js:66-67`:
> "XCC has 2 Mercurial tables and DCC only supports one. We don't call 'setMercurialMagicTable' hook"

XCC *cannot* use the DCC extension hook because its shape doesn't fit XCC's data.

### 2.5 Extension surface is lopsided
~15 custom hooks emit, mostly for **schema extension** and **pack registration**. But nothing for:
- Sheet registration by document type (XCC unregisters DCC's item sheet to replace it)
- Actor document class customization (XCC sets `CONFIG.Actor.documentClass` globally)
- Roll customization outside of attacks
- Skill / ability / save registration
- Post-roll effect handlers (disapproval, spell loss, spellburn baked into caller methods)

### 2.6 CSS is monolithic with no theming contract
`styles/dcc.scss` is ~2500 lines in one file. `dcc-qol` uses 40+ `!important` declarations — specificity warfare, not intent.

### 2.7 God objects and transitional code
- `actor.js` — 2,251 lines
- `actor-sheet.js` — 1,848 lines
- `dcc.js` — 1,560 lines (bootstrap + settings + hotbar + spell-result processing + patron taint + disapproval drain + migration triggers)
- `item.js` — 967 lines
- `item-sheet.js` — 874 lines
- Backward-compat shims: `critText` / `fumbleText` ("Legacy name for dcc-qol compatibility"), the `useSummary` migration path, 418 lines of cumulative migrations

---

## 3. What the spinoff modules reveal

Two very different kinds of module exist, and DCC treats them the same:

| Module | Kind | Strategy | Assessment |
|---|---|---|---|
| `mcc-classes` | Variant (sci-fi MCC) | Schema hooks, subclass sheets | **clean** |
| `dcc-crawl-classes` | Expansion (+9 classes, same rules) | Schema hooks, sheets, pack hook | **clean** |
| `dcc-qol` | Add-on (QOL layer) | Attack hooks, reaches into `game.dcc.DiceChain` | works but brittle |
| `xcc` | Variant (Xcrawl Classics, different game) | Replaces `CONFIG.Actor.documentClass`, unregisters DCC's item sheet, `setTimeout(0)` workaround | **fighting the system** |
| `xcc-core-book` | Content | Pack hooks + direct `CONFIG.DCC` manipulation | works but fragile |

The pattern is clear: **expansions are easy, variants are hard**. MCC adds classes without touching core rules. XCC redefines parts of the game and has to punch through every seam DCC didn't design for.

---

## 4. `dcc-core-lib` — what already exists

Before proposing the target architecture, catalogue what's already built. The Foundry system shouldn't reinvent any of this.

### 4.1 Shape of the library
- **Pure TypeScript, zero platform dependencies** (no Foundry, no DOM, no Node built-ins)
- ESM module, published to npm, built to `dist/` with strict TypeScript
- Events via **callback injection** — the library never depends on Foundry's `Hooks`
- Data separation: **copyrighted content lives in the private `dcc-official-data` repo**; the public lib ships only mechanics + fan-made test data
- 1,079 passing tests

### 4.2 What's already implemented
From `docs/STATUS.md`:

| Subsystem | Status |
|---|---|
| Dice chain (bump, rank, crit-range scaling) | ✅ |
| Roll evaluation with custom roller injection | ✅ |
| Unified `resolveSkillCheck(skill, input, events)` | ✅ |
| Ability checks, saves, skill checks as namespaced IDs (`ability:str`, `save:reflex`) | ✅ |
| `CharacterAccessors` interface — extract data from *any* character shape | ✅ |
| Character creation (0-level funnel with occupations, birth augurs) | ✅ |
| Character serialization (versioned JSON) | ✅ |
| Bonus system (ability, luck, spell, equipment, situational) | ✅ |
| Table lookup (simple / multi-column / tiered) + registry | ✅ |
| Spell casting (spell checks, spellbooks, spellburn, corruption, fumbles, mercurial magic) | ✅ |
| Disapproval system | ✅ |
| Attack / damage / crit / fumble / initiative | ✅ |
| Armor class calculation | ✅ |
| Level advancement + HP rolling + save recalculation | ✅ |
| Cleric abilities (Turn Unholy, Lay on Hands, Divine Aid) | ✅ |
| Enabling skills (Mighty Deed, Shield Bash, Backstab, Two-Weapon Fighting, Luck Recovery) | ✅ |
| Patron system (registry, Invoke Patron, bonds, taint) | ✅ |
| Occupation-based skills | ✅ |
| Purple Sorcerer parser (text + JSON) | ✅ |
| NPC stat block parser | ✅ |
| `SystemConfig` for variants (DCC, MCC, XCrawl) | ✅ |

### 4.3 Key design decisions already locked in
From `docs/ARCHITECTURE.md` and `STATUS.md`:

- **Unified skill model** — all class abilities are `SkillDefinition`s. Classes are lists of skill IDs.
- **Callback-injection events** — not a built-in pub/sub. Each Foundry/API/bot provides its own event adapter.
- **Data loaders** — `DataLoader` interface has Foundry, filesystem, and HTTP implementations.
- **Pack/table registry** — `registerTable()`, `registerClassProgression()`, `registerXPThresholds()` are all runtime registries.
- **Custom roller injection** — `evaluateRoll(formula, { roller })` accepts Foundry's `Roll` class as a custom roller. No dice-pipeline conflict.
- **Error handling** — `null` for parse, result objects for user-facing ops, exceptions for programming errors.
- **Strict TypeScript** — `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `strictTypeChecked` eslint.

### 4.4 What the library *doesn't* handle (by design)
- Foundry-specific document lifecycle (`prepareBaseData`, `prepareDerivedData`, embedded documents)
- Chat message rendering
- ApplicationV2 sheets / templates / HTMX
- Compendium packs (LevelDB, JSON round-trips)
- Active Effects (mode/type system, transfer, duration tracking)
- Hotbar, scene, combat tracker integration
- i18n and translation files
- Hot reload
- User permissions, socketlib bridges, settings UI

**Everything above is Foundry's turf.** The adapter's job is to own it.

---

## 5. Target architecture

Separate the stack into clearly-bounded packages:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Content packages (copyrighted / fan-made)                           │
│    dcc-official-data (private) · dcc-core-book · xcc-core-book · ... │
├──────────────────────────────────────────────────────────────────────┤
│  Variant packages (SystemConfig + content + sheet themes)            │
│    dcc-core-lib exports DCC_SYSTEM · xcc-lib exports XCC_SYSTEM      │
│    (these are registries of skills, classes, tables, mechanics)      │
├──────────────────────────────────────────────────────────────────────┤
│  dcc-core-lib  (the ENGINE — pure functional TypeScript)             │
│    Rolls · skill resolution · combat · spells · checks · parsers     │
│    SystemConfig variant support · CharacterAccessors interface       │
├──────────────────────────────────────────────────────────────────────┤
│  DCC FoundryVTT system  (the ADAPTER — the repo this doc lives in)   │
│    DCCActor/DCCItem documents · ApplicationV2 sheets · ChatMessage   │
│    ActiveEffect integration · compendium packs · settings · migrate  │
│    Thin wrappers that call dcc-core-lib and render results           │
├──────────────────────────────────────────────────────────────────────┤
│  FoundryVTT V14 primitives                                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.1 What the Foundry adapter owns
- **Documents.** `DCCActor`, `DCCItem`, `DCCCombatant` extend Foundry's base classes. Their `prepareBaseData` and `prepareDerivedData` methods call `dcc-core-lib` pure functions and assign results to `system.*` fields.
- **Sheets.** ApplicationV2 sheets render Handlebars templates against data that `dcc-core-lib` calculated.
- **Rolls.** Each `rollX` method on `DCCActor` becomes: build inputs → call lib function with a Foundry `Roll`-backed custom roller → render a `ChatMessage` from the result → apply actor updates via Foundry's update pipeline.
- **Active Effects.** Stay in Foundry (they're a Foundry concept). The adapter translates AE-modified fields into the `Character` shape the library expects via a `CharacterAccessors` implementation.
- **Compendium packs.** LevelDB JSON, pack management, the `npm run todb`/`tojson` workflow — all stays.
- **Settings, hotbar macros, hot reload, migration infrastructure** — all stays.

### 5.2 What moves out (to `dcc-core-lib`)
- All roll formula construction (`roll-modifier.js` becomes a UI over `CheckSpec` + `buildFormula` from the lib)
- Ability check / save / skill check / spell check / attack / damage / crit / fumble / initiative logic
- Disapproval, spellburn, corruption, mercurial magic, patron taint, spell loss mechanics
- Class progression lookups (already in the lib as a registry)
- NPC parser, PC parser (Purple Sorcerer parser already in the lib)
- Character creation wizard (if one is added) → `createZeroLevelCharacter` already exists
- `DiceChain` → `dcc-core-lib`'s dice module

### 5.3 What stays in Foundry but gets *smaller*
- `actor.js` — 2,251 lines → ~400 lines of thin wrappers
- `item.js` — 967 lines → ~200 lines
- `dcc.js` — 1,560 lines → split into `init.mjs`, `ready.mjs`, `settings.mjs`, `adapter.mjs`
- `actor-sheet.js` — 1,848 lines → composition framework, not a class-dispatch sheet

### 5.4 The adapter layer
A new `module/adapter/` directory owns the bridge:

```
module/adapter/
  character-accessors.mjs   // Implements CharacterAccessors over Foundry Actor shape
  foundry-roller.mjs        // Wraps Foundry's Roll as a custom roller for the lib
  foundry-events.mjs        // Bridges lib events → Foundry Hooks
  foundry-data-loader.mjs   // Loads tables/progressions from Foundry compendia
  chat-renderer.mjs         // Renders SkillCheckResult/AttackResult as ChatMessages
```

This is where "Foundry quirks meet pure logic." Everything else in the system becomes either a Foundry document class, a sheet, or a template.

### 5.5 Variant support
XCC, MCC, Empire of the East become `SystemConfig` registrations:
- `dcc-core-lib` exports `DCC_SYSTEM`
- A future `xcc-lib` exports `XCC_SYSTEM` (or publishes a module that registers it)
- The Foundry system reads a world setting for the active variant and passes that `SystemConfig` to every lib call

XCC stops needing to replace `CONFIG.Actor.documentClass` globally. It registers its variant config, its skills, its classes, its tables, and the same DCC Foundry adapter handles it. The adapter doesn't care whether it's resolving a Warrior's Mighty Deed or an XCC Athlete's Scramble — both are `SkillDefinition`s.

---

## 6. How existing pain points dissolve

| Pain point | How the target architecture fixes it |
|---|---|
| Monolithic Player schema | Only `Character` from the lib is the source of truth. The Foundry schema shrinks to: base state + class ID + variant-specific fields added by the variant package. Fields for classes you're not playing stop existing. |
| String-matched class dispatch | The lib already keys everything by class ID in registries. `classHasEnablingSkill('halfling', 'two-weapon-fighting')` replaces `className === game.i18n.localize('DCC.Halfling')`. The i18n bug can't happen. |
| 7 class sheets, manual selection | Sheet registers one `DCCSheet` for type `Player`. It composes parts based on `character.classId` looked up in the variant's class registry. XCC's 20 classes reduce to 20 JSON class definitions + one sheet. |
| Hardcoded wizard/cleric magic | `castSpell()` in the lib already supports multiple caster types via `CasterProfile.type`. XCC's 2 mercurial tables become two `registerTable()` calls with different IDs. |
| Spinoffs reaching into `game.dcc.*` | `dcc-qol`-style add-ons stop reaching into DCC internals and reach into `dcc-core-lib` directly (as a peer dependency). The Foundry adapter emits documented events. |
| CSS `!important` wars | Out of scope for the engine split, but solvable separately via CSS custom properties + layers. Mention in Phase 6. |
| 418 lines of migrations | Stays in Foundry (migrations are a persistence concern). Gets easier once the schema is smaller. |

---

## 7. Incremental path

Seven phases. Each ends with the Foundry system working and shippable. No big-bang rewrite.

### Phase 0 — Prep (1–2 weeks)
- Fix the halfling i18n bug in `actor.js:1725` and `item.js:71` (compare to an internal key or canonical English string, not to `game.i18n.localize('DCC.Halfling')`).
- Add the `dcc-core-lib` package as a peer dep (`npm install dcc-core-lib`) and confirm it bundles / Foundry can import it.
- Write the adapter scaffolding: `character-accessors.mjs`, `foundry-roller.mjs`, `foundry-data-loader.mjs`, `chat-renderer.mjs` as empty stubs.
- Document every currently-emitted DCC Foundry hook and every `game.dcc.X` export as **stable** or **internal**. Publish the list.
- **Ships as:** patch release. No behavior change except the i18n bug fix.

### Phase 1 — Adopt the lib for simple rolls (2–3 weeks)
Port the rolls where the lib's API is a drop-in. Pick the easiest first:
- `rollAbilityCheck` → `rollCheck('ability:str', character, {…})` from `dcc-core-lib/checks`
- `rollSavingThrow` → `rollCheck('save:reflex', …)`
- `rollSkillCheck` → `resolveSkillCheck(skill, input, events)`
- `rollInit` → `rollInitiative(…)` from `dcc-core-lib/combat`

For each one:
1. Build a `Character` / `SkillDefinition` from the actor via `CharacterAccessors`
2. Call the lib
3. Render `ChatMessage` from the result
4. Apply any actor updates (luck burn, disapproval, etc.) via Foundry

Keep the existing methods as thin wrappers around the new adapter call so external modules (`dcc-qol`, `token-action-hud-dcc`) keep working.

**Ships as:** minor release. User-visible change: *nothing*. Maintenance burden: drops immediately.

### Phase 2 — Migrate spell checks (3–4 weeks)
Spell checks are harder because of the spell-loss / disapproval / patron-taint interplay. But the lib already handles all of that in `calculateSpellCheck` + event callbacks.
- Build a `SpellCastInput` from the actor + spell item
- Provide a Foundry-flavored `SpellEvents` implementation that:
  - Creates ChatMessages on success/failure
  - Updates the actor's disapproval range
  - Marks wizard spells as lost
  - Triggers patron taint rolls
  - Applies spellburn ability changes
- Delete `processSpellCheck` from `dcc.js` after spells are ported

**Ships as:** minor release. Behavior: should be identical (the lib's tests are already regression coverage for the DCC rules).

### Phase 3 — Migrate attacks, damage, crits, fumbles (4–6 weeks)
The hardest one. Attack → damage → crit → fumble is chained and has the most caller-specific glue (weapon types, two-weapon rules, backstab multipliers, deed dice). But the lib has `makeAttackRoll`, `rollDamage`, `rollCritical`, `rollFumble`, `getTwoWeaponPenalty`, `getBackstabMultiplier` — it's all there.

Port carefully and keep `dcc.modifyAttackRollTerms` working (it's dcc-qol's main integration point) by translating from the lib's modifier list.

**Ships as:** major release. External module compatibility needs announcement and a grace period.

### Phase 4 — Data-model slimming (3–5 weeks)
Now that the lib is producing `Character` shapes, the Foundry Player schema no longer needs to hold every class's fields.
- Split `player-data.mjs` into `BaseCharacterData` + per-class mixins registered via a new `dcc.registerClassMixin(classId, mixin)` hook
- Migration: existing characters get all mixins applied (zero data loss); future characters only get the mixins their class needs
- Foundry's `system.*` shape becomes a projection of the lib's `Character` type

**Ships as:** major release with migration. External modules using `dcc.definePlayerSchema` migrate to `registerClassMixin`.

### Phase 5 — Sheet composition (4–6 weeks)
- Collapse 7 class sheets into 1 `DCCSheet` that composes parts based on `character.classId`
- Parts are registrable: `dcc.registerSheetPart({ classId, tab, template, condition })`
- Auto-select the sheet by class (Cleric PC → cleric tab is the default active tab)
- CSS custom properties get documented as a theming contract; variants (XCC, MCC) ship theme stylesheets

**Ships as:** major release. Replaces sheet-subclass-per-class patterns in MCC, dcc-crawl-classes, XCC.

### Phase 6 — Variant registration (2–3 weeks)
- Add `dcc.registerVariant` hook
- World setting: active variant (defaults to `dcc`)
- XCC drops its `CONFIG.Actor.documentClass` override and its item-sheet unregister/register dance

**Ships as:** minor release. XCC needs a companion update — a feature, not a bug.

### Phase 7 — Cleanup (ongoing)
- Retire `critText`/`fumbleText` compatibility shims
- Prune old migrations past a minimum data version
- Split `dcc.js` into focused modules
- Split `styles/dcc.scss` into partials + theme layer
- Extract the `module/ruleset/` (what little remains) into the variant config for DCC core

**Total effort:** ~20–25 engineering weeks for Phases 1–6, plus ongoing cleanup. With part-time maintenance, ~10–12 months. With focused full-time work, ~4–5 months.

---

## 8. Hard questions this forces us to answer

### 8.1 Do we ship `dcc-official-data` as a Foundry module?
The lib reads class progressions, birth augurs, spells, crit tables, etc. from `dcc-official-data`. Options:
- **A.** Ship the Foundry system bundling `dcc-official-data` at build time (private npm auth required in CI)
- **B.** Keep `dcc-core-book` as the Foundry compendium, write a `DataLoader` that reads Foundry packs and hands results to the lib
- **C.** Mirror: `dcc-official-data` for TS consumers, Foundry packs for Foundry (both sourced from the same JSON)

**Likely best:** C — single source of truth, built twice. A script in `dcc-official-data` generates both the TS exports and the Foundry pack JSON from one set of source files.

### 8.2 How does Active Effects fit?
Foundry's Active Effects modify `system.*` fields *before* `prepareDerivedData` runs. `dcc-core-lib` expects a fully-calculated `Character`. So:
- AE modifications happen at the Foundry layer, on the raw data
- `CharacterAccessors` read *post-AE* data when handing off to the lib
- The lib doesn't need to know AE exists

This is clean. The only wrinkle: AE's dice-chain modifications (the custom applyActiveEffects in `actor.js:227`) need to run before the adapter hands the actor off to the lib. Phase 1 keeps this logic in Foundry; a future cleanup could represent "dice chain shift" as a lib-side bonus type.

### 8.3 Does `dcc-core-lib` become an npm dep of the Foundry system?
Yes — a peer dep, bundled via Vite/Rollup into `module/dcc.js` or loaded as a separate ESM file. Foundry supports npm-published dependencies fine when bundled. The system's `package.json` already has a build pipeline.

### 8.4 Is XCC a variant (same adapter) or its own Foundry system?
The lib already supports XCC via `SystemConfig`. The Foundry side:
- **Option A (variant):** stay unified — XCC is a module that registers a variant config. Users install the DCC system + XCC module.
- **Option B (fork):** XCC becomes its own Foundry system that also depends on `dcc-core-lib`. Two Foundry systems, one engine.

**Tentative preference: A.** The Foundry integrations (`dcc-qol`, `token-action-hud-dcc`) are more useful to XCC users if everyone's on the same system id. But the decision only matters once Phase 6 lands.

### 8.5 What about modules like `dcc-qol` that don't currently depend on the lib?
They don't need to migrate. `dcc-qol` listens to Foundry Hooks; those hooks keep firing. If `dcc-qol` wants cleaner access to crit-range-scaling or dice-chain utilities, it can depend on `dcc-core-lib` directly as a peer — but it doesn't have to.

### 8.6 What about backward compatibility during the migration?
Every phase keeps the existing public API (`DCCActor.rollAbilityCheck` still exists, `game.dcc.DiceChain.bumpDie` still works) — they become thin wrappers. Deprecation warnings come in Phase 6/7, removals in a later major version.

### 8.7 Who keeps writing tests?
The Foundry system's existing unit tests (17 files, ~369 cases) stay valuable for the adapter layer — schema validation, active effect integration, pack round-trips. Business-logic tests (rolls, skill resolution, spell mechanics) migrate to `dcc-core-lib` if not already there, with the Foundry side keeping integration tests that wire the whole thing together.

---

## 9. What NOT to change

- **`dcc-core-lib`** — already correct. Bug-fix and extend, don't rearchitect.
- **DCCRoll** — keep as the custom-roller implementation the lib calls via injection.
- **TypeDataModel-based schemas** — modern, correct, keep.
- **Existing `dcc.define*Schema` hooks** — they work. Phase 4 extends them, doesn't break them.
- **Migration infrastructure** — leave it alone.
- **i18n discipline** — preserve.
- **Test setup** (unit + integration split, mocks, `npm run compare-lang`) — preserve.
- **`game.dcc` namespace** — stabilize it. Modules depend on it.
- **Compendium pack workflow** (`npm run todb` / `tojson`) — preserve.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| `dcc-core-lib` and Foundry system fall out of sync (rule changes need two PRs) | Establish a lockstep release cadence; add CI that runs Foundry system tests against both latest and pinned lib versions; treat `dcc-official-data` as the single content source. |
| Bundling overhead — `dcc-core-lib` ships 44K TS lines | Tree-shake aggressively. Strict TypeScript + pure functions make this easy. Benchmark Foundry load times at Phase 1 gate. |
| Spinoff modules break mid-migration | Phase each change behind a deprecation window; keep old APIs as adapters for one major version; coordinate with XCC/MCC/crawl-classes maintainers. |
| Debugging crosses package boundaries (stack frames in `dcc-core-lib`) | Source maps; publish TS types; document how to link the lib locally during adapter development. |
| Active Effects and pure-functional logic don't interact cleanly | Keep AE in Foundry land; only feed post-AE values to the lib. Accept some glue code in the adapter. |
| `dcc-official-data` licensing / private-npm CI in a public repo | Option C from §8.1: generate Foundry packs from the same source; public system doesn't need to import the private package directly. |

---

## 11. Recommendation

Start with **Phase 0 + Phase 1**. Low-risk, no user-visible change, but infrastructure that unlocks everything else:

- Phase 0 fixes the halfling i18n bug, sets up the adapter directory, and gets `dcc-core-lib` loading into Foundry.
- Phase 1 migrates the easiest rolls (ability checks, saves, skill checks, init) to the lib. Success here proves the adapter pattern works and lets you feel out the ergonomics.

Reassess after those two. The answers to "does the adapter feel sane?" and "are the lib's APIs the right shape for Foundry's call sites?" will shape whether Phases 2–6 as described are right, or whether the library needs adjustments to fit Foundry better.

**The worst path is a six-month rewrite on `main`.** The best path is monthly releases where each phase shrinks the Foundry system by a measurable percentage, the lib gains dogfooding in a real application, and rollback stays available at every step.

---

## Appendix A — File hotspots and their Phase targets

| File | Lines | Phase when it shrinks | Target size |
|---|---|---|---|
| `module/actor.js` | 2251 | Phases 1–4 | ~400 |
| `module/actor-sheet.js` | 1848 | Phase 5 | ~500 |
| `module/dcc.js` | 1560 | Phase 7 | split into 4–5 files |
| `module/item.js` | 967 | Phases 2–3 | ~200 |
| `module/data/actor/player-data.mjs` | ~400 | Phase 4 | ~100 + mixins |
| `module/config.js` | 764 | Phases 4–6 | ~200 (variant-specific moves to lib/registry) |
| `styles/dcc.scss` | ~2500 | Phase 7 | partials + theme contract |

## Appendix B — Hooks to add during the migration

Most of what my earlier draft proposed adding is already in `dcc-core-lib` as a registry. Foundry-side hooks that remain needed:

- `dcc.registerClassMixin(classId, mixin)` — Phase 4, replaces `dcc.definePlayerSchema` for class-specific fields
- `dcc.registerSheetPart({ classId, tab, template, condition })` — Phase 5
- `dcc.registerVariant(variantConfig)` — Phase 6
- `dcc.registerItemSheet(types, SheetClass)` — Phase 3 (eliminates XCC's unregister/register)

## Appendix C — The halfling i18n trap (fix this today)

In `actor.js:1725` and `item.js:71`:
```javascript
className === game.i18n.localize('DCC.Halfling')
```
If a translation of `DCC.Halfling` changes or differs across locales, halfling two-weapon fighting silently stops applying. Fix:
```javascript
// Pre-Phase-1 stopgap
className === 'Halfling'                    // canonical English

// Post-Phase-1 (via the lib's class registry)
character.classId === 'halfling'
```

## Appendix D — Mapping DCC Foundry concepts to `dcc-core-lib`

| Foundry concept | `dcc-core-lib` equivalent |
|---|---|
| `DCCActor` (the document) | no direct equivalent — adapter owns Foundry lifecycle |
| `actor.system` | `Character` type (accessed via `CharacterAccessors`) |
| `DCCItem` of type `skill` | `SkillDefinition` |
| `actor.rollAbilityCheck('str')` | `rollCheck('ability:str', character)` |
| `actor.rollSavingThrow('ref')` | `rollCheck('save:reflex', character)` |
| `actor.rollWeaponAttack(id)` | `makeAttackRoll(attackInput)` + `rollDamage(damageInput)` |
| `actor.rollCritical()` | `rollCritical(criticalInput)` |
| `actor.rollSpellCheck(...)` | `castSpell(spellCastInput)` or `calculateSpellCheck(...)` |
| `processSpellCheck` (in `dcc.js`) | effect handlers in `spell-check.ts` + `SpellEvents` callbacks |
| `DCCRoll.createRoll(...)` | the custom roller passed to `evaluateRoll` |
| `DiceChain.bumpDie(...)` | `bumpDie(die, steps)` |
| Foundry `RollTable` | `RollableTable` type + `lookup()` |
| `CONFIG.DCC.classes` (hypothetical) | `registerClassProgression()` + `SystemConfig.classes` |
| `Hooks.call('dcc.rollComplete', ...)` | callback injected into `events` arg of lib calls |
