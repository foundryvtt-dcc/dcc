# Class Decomposition Plan

> Single-source map of how a DCC "class" is being broken apart into
> registrable components across Phases 4–6 of the
> [`refactor/dcc-core-lib-adapter`](../../README.md) refactor.
>
> When you're about to relocate a class-bound concern (a schema field, a
> sheet partial, a `_prepareContext` first-open default, an auto-created
> starting item, a roll table reference, a class progression entry) —
> read this doc first to find which component category it belongs to,
> which extension-API helper owns it (current or planned), and which
> phase ships it.
>
> Cross-references:
> - High-level phase plan + pain points: [`ARCHITECTURE_REIMAGINED.md`](ARCHITECTURE_REIMAGINED.md) §§2, 7, 8.6
> - Active worklist: [`docs/02-slice-backlog.md`](../02-slice-backlog.md) "Phase 4 — Active sub-arc"
> - Current phase status: [`docs/00-progress.md`](../00-progress.md)
> - Live API surface: [`EXTENSION_API.md`](EXTENSION_API.md)
> - Phase 4 archive: [`docs/dev/progress/phase-4.md`](progress/phase-4.md)

## 1. What a class is, decomposed

Today a DCC class (Wizard, Thief, Halfling, …) bundles seven distinct
concerns. The refactor is moving each onto its own registrable
component — different APIs, different phases, but the same governing
principle: **per-class concerns live in per-class registrations, not
hardcoded inside system code**.

| # | Concern | Example (Dwarf) | Lives where today | Target API | Phase |
|---|---|---|---|---|---|
| 1 | **Schema fields** | `skills.shieldBash` (label/ability/value/die/useDeed) | `module/data/actor/player-data.mjs` static body (now empty for dwarf — extracted) | `game.dcc.registerClassMixin(classId, mixinFn)` | **4 (active)** |
| 2 | **Sheet markup parts** | `actor-partial-dwarf.html` rendered by `DCCActorSheetDwarf` | Per-class sheet subclass in `module/actor-sheets-dcc.js` + `templates/actor-partial-<class>.html` | `game.dcc.registerSheetPart({ classId, tab, template, condition })` (planned) | 5 |
| 3 | **Class identity + mechanical defaults** | `details.sheetClass = 'Dwarf'`, `details.critRange = 20`, `class.disapproval = 1`, `config.attackBonusMode = 'flat'`, `config.addClassLevelToInitiative = true`, `class.spellCheckAbility = null`, `config.showBackstab = false` | `_prepareContext` first-open block in each `module/actor-sheets-dcc.js` sheet (lines 60 / 128 / 201 / 269 / 346 / 518 / 595 — one per class) | `game.dcc.registerClassDefaults({ classId, … })` (planned — name TBD; see §3.3) | 5 |
| 4 | **Skill activation toggles** | `skills.shieldBash.useDeed = true` for Dwarf, `false` for every other class | Same `_prepareContext` blocks (lines `72/141/213/282/359/427/531/606` set `useDeed` per class) | Fold into `registerClassDefaults` (§3.3) | 5 |
| 5 | **Starting items** | Dwarf auto-creates a `ShieldBash` weapon on sheet open | Hardcoded in dwarf sheet `_prepareContext` at `module/actor-sheets-dcc.js:434-454` | `registerClassStartingItems` or extension of `registerClassDefaults` (§3.4) | 5 |
| 6 | **Lib class progression** | Warrior crit die / save bonuses / action dies per level | `levelData` packs (Foundry-side) + lib's class registry (currently empty — see §3.6) | Lib-side `registerClassProgression(classId, …)` invoked from `module/dcc.js:init` | 6 |
| 7 | **Variant identity** | "XCC" / "MCC" — which set of classes is active in this world | Hardcoded class list + global `CONFIG.Actor.documentClass = XCCActor` override (XCC's old approach) | `game.dcc.registerVariant({ id, label, classes, sheetTheme })` (planned) | 6 |

A separate (orthogonal) component category covers **per-class roll
tables**: mercurial magic, patron taint, cleric disapproval. These
aren't "class concerns" so much as "class-keyed table lookups," and
the relevant registries ship as their own slices (Phase 3+; see §3.7).

## 2. Per-class status

Status by class for components 1–5. Component 6 (lib progression) is
all-classes-at-once at Phase 6; component 7 (variant) is whole-system
at Phase 6.

| Class | Schema mixin (1, P4) | Sheet part (2, P5) | Defaults + skill toggles (3+4, P5) | Starting items (5, P5) |
|---|---|---|---|---|
| Halfling | ✅ P4-1 (`skills.sneakAndHide`) | pending | ✅ P5-1 | n/a (no starting items) |
| Dwarf | ✅ P4-2 (`skills.shieldBash` — mixed-type) | pending | ✅ P5-1 (`useDeed = true` override included) | ✅ P5-2 (`ShieldBash` weapon auto-created via `registerClassStartingItems`) |
| Thief | ✅ P4-3 (`skills.{sneakSilently, hideInShadows, pickPockets, climbSheerSurfaces, pickLock, findTrap, disableTrap, forgeDocument, disguiseSelf, readLanguages, handlePoison, castSpellFromScroll}` + `class.{luckDie, backstab}` — first mixin to touch both `schema.class.fields` and `schema.skills.fields`) | pending | ✅ P5-1 | n/a |
| Cleric | ✅ P4-4 (`class.{spellCheck, spellCheckAbility, spellsLevel1–5, deity, disapproval, disapprovalTable}` + `skills.{divineAid, turnUnholy, layOnHands}` — flushed out the integration-test mixin-bootstrap gap, now shared via `module/built-in-class-mixins.mjs`) | pending | ✅ P5-1 | n/a |
| Wizard | ✅ P4-6 (9 class fields attached via shared `attachWizardFields(schema)` helper in `module/built-in-class-mixins.mjs`) | pending | ✅ P5-1 (`spellcastingLink`, `spellburnLink` extra enrichHtml — registered on the base schema at Phase 5 session 3, all writes persist) | n/a |
| Elf | ✅ P4-6 (re-uses `attachWizardFields(schema)` AND overrides `skills.detectSecretDoors` with HeightenedSenses defaults — closes the per-class extraction arc) | pending | ✅ P5-1 | n/a |
| Warrior | ✅ P4-5 (`class.{luckyWeapon nullable StringField, luckyWeaponMod StringField '+0'}` — smallest block; no skills) | pending | ✅ P5-1 (`mightyDeedsLink` extra enrichHtml — registered on the base schema at Phase 5 session 3, all writes persist) | n/a |
| Zero-Level | not class-bound (`class.className = 'Zero-Level'` default; no class-specific fields) | n/a | n/a | n/a |
| Generic (upper-level fallback) | not class-bound | n/a | n/a — stays inline in `actor-sheets-dcc.js`; no maintenance branch | n/a |

## 3. Component design notes

### 3.1 Schema mixins (Phase 4 — active)

**Shipped:** `game.dcc.registerClassMixin(classId, mixinFn)` —
[`EXTENSION_API.md` Stable surface](EXTENSION_API.md). Companion
internal helper `applyClassMixins(schema)` runs the registered mixins
in deterministic sorted-classId order during
`PlayerData.defineSchema()`, **before** the `dcc.definePlayerSchema`
hook fires (so external handlers see the contributed fields).

**Where built-in registrations live:** `module/built-in-class-mixins.mjs`
defines the `BUILT_IN_CLASS_MIXINS` table + a
`registerBuiltInClassMixins(registerClassMixin)` helper. Two entry
points consume it: `module/dcc.js`'s `init` hook (production, runs
between `CONFIG.DCC = DCC` and `CONFIG.Actor.dataModels = …` —
must register before the Player schema is first constructed) and
`module/__integration__/setup-foundry.js` (integration-test setup,
runs after `globalThis.CONFIG` is attached so that integration tests
constructing `PlayerData` directly — bypassing the Foundry `init`
hook — still see the contributed fields). Adding a new built-in
class mixin means editing one file; both environments stay in sync
automatically.

**Mutator pattern:**

```js
registerClassMixin('halfling', (schema) => {
  const fields = foundry.data.fields
  schema.skills.fields.sneakAndHide = new fields.SchemaField({
    label: new fields.StringField({ initial: 'DCC.SneakAndHide' }),
    value: new fields.StringField({ initial: '+3' })
  })
})
```

Each mixin call must build **fresh field instances** — Foundry's
TypeDataModel may re-invoke `defineSchema()` and field objects are not
shareable across schemas. The mixin receives the in-progress schema
object; typically attaches to `schema.skills.fields` or
`schema.class.fields`.

**Last-write-wins** on duplicate `classId` lets a sibling module
fully replace a DCC built-in (e.g. an XCC halfling variant) without
having to additively patch — matches the mercurial-magic registry's
semantic (§3.7).

**What stays in `player-data.mjs`:**
- The static base body (common, config, player templates — see file
  header). As classes extract, the static body shrinks toward `~100
  lines` (target per `ARCHITECTURE_REIMAGINED.md §2.7`).
- `migrateData` — operates on raw source data **before** the schema
  is applied, so it doesn't care where the field's schema lives.
  Existing dice-notation guards for `castSpellFromScroll.die` and
  `shieldBash.die` stay even after those fields move to thief / dwarf
  mixins. Same goes for `migrateFieldsToInteger` calls against
  `source.class.*` and `source.skills.{divineAid,turnUnholy,
  layOnHands}.*`.

**Elf design call (resolved P4-6, 2026-05-18):** option (a) — both
mixins explicitly attach the wizard field shape via a shared
`attachWizardFields(schema)` helper inside
`module/built-in-class-mixins.mjs`. The helper builds fresh field
instances each call; the second pass (whichever runs later in
deterministic-sorted classId order — `elf` runs before `wizard` so
the wizard mixin's pass is the "second" one for the wizard fields)
re-attaches identical instances and the result is functionally a
no-op. Registry stays self-documenting (both classes appear);
declarations live in one place.

Elf also overrides `skills.detectSecretDoors`: the base body keeps
it as the non-Elf default (`label='DCC.DetectSecretDoors'`,
`ability=''`, `value='+0'`), and the elf mixin replaces the
SchemaField entirely with the HeightenedSenses defaults
(`label='DCC.HeightenedSenses'`, `ability='int'`, `value='+4'`).
Because mixins run after the base body, the override wins on the
constructed schema, but the path readers see (`system.skills.detectSecretDoors`)
stays identical per §2.12.

### 3.2 Sheet parts (Phase 5)

**Planned:** `game.dcc.registerSheetPart({ classId, tab, template,
condition })`.

Goal: collapse the 7 class sheets in `module/actor-sheets-dcc.js`
(plus the partials at `templates/actor-partial-*.html`) into one
`DCCSheet` that composes parts based on `character.classId`. Auto-
select the default active tab from the actor's class.

Today: per-class `ActorSheetV2` subclass in `actor-sheets-dcc.js`,
each with its own `PARTS` declaration and an
`actor-partial-<class>.html` template registered via `loadTemplates`
at `module/dcc.js:198-200`. XCC ships its own variants that subclass
the DCC class sheets and override at registration time.

Out of scope for Phase 4. The dwarf-shieldBash and halfling-sneakAndHide
mixin extractions deliberately don't touch sheet markup.

### 3.3 Class identity + mechanical defaults (Phase 5)

**Shipped Phase 5 session 1 (2026-05-18):**
`game.dcc.registerClassDefaults(classId, defaults)` —
[`EXTENSION_API.md` Stable surface](EXTENSION_API.md). Companion
internal helper `applyClassDefaults(actor, classId)` runs the
"initial-setup if `system.details.sheetClass` doesn't match" branch
plus the "regenerate enriched HTML if `system.class.classLink` is
missing" maintenance branch from the legacy sheet code. Returns
`'initialized' | 'regenerated' | 'unchanged'` so callers can gate
follow-on logic (the dwarf sheet's still-inline ShieldBash auto-create
keys off the `'initialized'` return).

**Where built-in registrations live:**
`module/built-in-class-defaults.mjs` defines the `BUILT_IN_CLASS_DEFAULTS`
table plus a `registerBuiltInClassDefaults(register)` helper consumed
by `module/dcc.js:init`. The integration-test setup does NOT need to
register these — integration tests construct PlayerData directly and
don't open sheets, so the registry has no observable effect outside
of sheet-render paths.

**Entry shape (each value is a path → key/literal):**

```js
warrior: {
  sheetClass: 'Warrior',                        // capitalized sentinel
  localize: { 'class.className': 'DCC.Warrior' },
  enrichHtml: {
    'class.classLink': 'DCC.WarriorClassLink',
    'class.mightyDeedsLink': 'DCC.MightyDeedsLink'
  },
  literal: {
    'details.critRange': 20,
    'class.disapproval': 1,
    'config.attackBonusMode': 'autoPerAttack',
    'config.addClassLevelToInitiative': true,
    'class.spellCheckAbility': null,
    'config.showBackstab': false,
    'skills.shieldBash.useDeed': false
  }
}
```

`applyClassDefaults` builds the update payload from all three sub-bags
+ writes `system.details.sheetClass`. Re-registering an existing
`classId` silently overwrites (last-write-wins, matches `registerClassMixin`).

**Legacy concerns now landed in this registry:**

- Class identity: `class.className`, `class.classLink` (enriched HTML),
  `details.sheetClass`, plus warrior/dwarf `class.mightyDeedsLink` and
  wizard `class.spellcastingLink` / `class.spellburnLink`
- Mechanical defaults: `details.critRange`, `class.disapproval`,
  `config.attackBonusMode`, `config.addClassLevelToInitiative`,
  `class.spellCheckAbility`, `config.showBackstab`, `config.showSpells`
- Skill activation: `skills.shieldBash.useDeed = true` for dwarves,
  `false` for every other class (the cross-class lines that used to
  live at `actor-sheets-dcc.js:72/141/213/282/359/531/606`)

**Link fields (closed Phase 5 session 3, 2026-05-18):** all four
enriched-HTML link fields (`classLink`, `mightyDeedsLink`,
`spellcastingLink`, `spellburnLink`) are now `HTMLField({ initial:
'' })` declarations on the static `class` SchemaField in
`module/data/actor/player-data.mjs`. Pre-Phase-5-3 only `classLink`
survived schema validation (via a sibling `dcc.definePlayerSchema`
hook in xcc-core-book registering it); the others were silently
stripped by Foundry. With the schema add, all four `applyClassDefaults`
`enrichHtml` writes persist on `system.class.*` in every world
configuration. The sibling-module `classLink` registration still
runs (last-write-wins) — no breakage.

**Partial overlap with lib progression (component 6):** save bonuses,
crit dies, and action dies will derive from
`lib.getSavingThrows(classId, level)` etc. once Phase 6 wires
`registerClassProgression`. `registerClassDefaults` covers what's
left — Foundry-only concerns like `sheetClass`, `classLink`, and the
sheet-config booleans.

### 3.4 Starting items (Phase 5)

**Shipped Phase 5 session 2 (2026-05-18):**
`game.dcc.registerClassStartingItems(classId, items)` —
[`EXTENSION_API.md` Stable surface](EXTENSION_API.md). Companion
internal helper `applyClassStartingItems(actor, classId)` auto-creates
the registered items on a Player document, deduping against existing
`(type, localized-name)` matches. Returns the array of created docs
so callers (sheet `_prepareContext`) can decide whether to re-render.

**Design decision:** kept the registry separate from
`registerClassDefaults` rather than folding into it. Rationale: the
sub-bag shapes are conceptually distinct — defaults writes scalar
field values (`actor.update({...})`), starting items create embedded
documents (`actor.createEmbeddedDocuments('Item', [...])`). Future
homebrew classes might want either contribution without the other
(e.g., a homebrew "Squire" class extending warrior defaults but
shipping its own starting longsword). Two registrations stay cheap
because both helpers expose `register…(classId, …)` parity API.

**Where built-in registrations live:**
`module/built-in-class-starting-items.mjs` defines
`BUILT_IN_CLASS_STARTING_ITEMS` and the
`registerBuiltInClassStartingItems(register)` helper consumed by
`module/dcc.js:init`. Mirrors the mixins/defaults pattern.

**Entry shape:**

```js
dwarf: [
  {
    nameKey: 'DCC.ShieldBash',
    type: 'weapon',
    img: 'systems/dcc/styles/images/game-icons-net/shield-bash.svg',
    system: {
      melee: true,
      damage: '1d3',
      config: { actionDieOverride: '1d14' }
    }
  }
]
```

`applyClassStartingItems` localizes `nameKey` at apply time (so
templates and chat messages see the user's localized weapon name) and
the duplicate check matches on `(type, localized-name)` — renaming
the auto-created item suppresses re-creation. Missing entries batch
into a single `createEmbeddedDocuments` call for Foundry-preferred
bulk-create semantics.

**Sheet integration:** all 7 PC sheets in
`module/actor-sheets-dcc.js` share the same `_prepareContext` body
(only the classId literal differs):

```js
async _prepareContext (options) {
  const context = await super._prepareContext(options)
  const result = await applyClassDefaults(this.options.document, '<classId>')
  if (result === 'initialized') {
    const created = await applyClassStartingItems(this.options.document, '<classId>')
    if (created.length > 0) this.render(false)
  }
  return context
}
```

The render-after-create is dwarf-historical — Foundry's automatic
re-render after embedded-document creation usually arrives, but the
explicit call avoids a race during the still-running
`_prepareContext`. Other PC sheets get the same call for the homebrew
case (a sibling-module classId registered through any PC sheet
subclass gets items applied through the same code path).

Today the only built-in case is dwarf. The registry is ready for
homebrew classes (warrior "luckyWeapon" prompt → starting weapon,
cleric "holy symbol," etc.) and the Phase 5 session 3 `DCCSheet`
collapse will dedupe the `_prepareContext` boilerplate across the 7
sheets.

### 3.5 Class progression (Phase 6, lib-driven)

**Planned:** lib-side `registerClassProgression(classId, …)` invoked
from `module/dcc.js:init` for each built-in DCC class.

Today: the Foundry side reads class progression from `levelData`
packs (`CONFIG.DCC.levelDataPacks`) via the level-change dialog. The
lib already has `getSavingThrows('warrior', 3)`, etc., but those
functions currently return zeros because no class is registered. PR
#720 review surfaced this as the "programmatic PC creation produces
inconsistent class config" item (see `00-progress.md` PR #720 review
backlog) — option (b) in that note is the Phase 6 fix.

### 3.6 Variant identity (Phase 6)

**Planned:** `game.dcc.registerVariant({ id, label, classes,
sheetTheme })`. World setting selects active variant (defaults to
`dcc`). Allows XCC to ship as a variant module rather than overriding
`CONFIG.Actor.documentClass` globally.

Phase 6 ships this alongside `registerClassProgression`. XCC retires
its global override; MCC retires its parallel one.

### 3.7 Per-class roll tables (Phase 3+; component-specific status)

A registry pattern — class/patron-keyed string → table-name string,
resolved at roll time against a `TablePackManager` that walks the
configured compendium packs. Sibling modules push their packs via
`addPack(...)` on init.

| Concern | API | Status |
|---|---|---|
| Mercurial magic table per wizard variant | `dcc.registerMercurialMagicTable(classKey, tableName)` Hook + `CONFIG.DCC.mercurialMagicTables` registry + `CONFIG.DCC.mercurialMagicPacks` `TablePackManager` | ✅ shipped Group E session 1 |
| Patron taint per patron | `CONFIG.DCC.patronTaintPacks.addPack(packId)` (no per-patron registration helper yet — relies on RollTable name matching `Patron Taint: <patron>`) | ✅ shipped Phase 3 session 22 |
| Cleric disapproval | `CONFIG.DCC.disapprovalPacks.addPack(packId)` (same pattern — RollTable name lookup) | preexisting |
| Crit tables per class | (no registry — currently a string `critTable` field on the class) | not slated; revisit if homebrew needs it |
| Fumble table | (single global table) | not slated |

Use the same pattern when adding new class-keyed table lookups: a
`registerXxxTable(classKey, tableName)` hook for the per-class binding
+ a `TablePackManager` for the pack walk + a resolver that
falls through to a `'default'` key. The hook is **stable from day
one** (per `EXTENSION_API.md` recommendation 7) because sibling
modules need to bind into the resolver during their `init`.

## 4. Why this split

§§2.1, 2.5, 2.8, 2.11, 2.12 of `ARCHITECTURE_REIMAGINED.md` are the
five pain points the decomposition is built to relieve:

- **§2.1 — Monolithic Player schema.** Every Player carries every
  class's fields. Schema mixins (component 1) move the source of
  truth onto a per-class registry; Foundry-smelling shape (component
  in §2.12) stays intact because the path `system.skills.shieldBash`
  resolves identically once the dwarf mixin is registered.
- **§2.5 — Extension surface is lopsided.** Sibling modules can
  *add* fields via `dcc.definePlayerSchema` but can't *relocate* the
  built-ins. Mixins let the system itself contribute through the
  same registry sibling modules use, dogfooding the public API.
- **§2.8 — Homebrew is impractical.** Users want to invent classes
  without forking. The whole component split is structured so a
  homebrew class needs to call seven registrations (one per
  component) instead of touching the system source.
- **§2.11 — Class-specific sheets fight Foundry.** The sheet-parts
  component (Phase 5) collapses 7 sheet subclasses into 1 composable
  sheet.
- **§2.12 — Foundry-smelling API surface must survive.** The
  decomposition is internal — readers reading `system.skills.X` /
  `system.class.X` see the same paths whether the field came from
  the static body or a mixin. Token Action HUD, Item Piles, dcc-qol,
  and Dynamic Active Effects all keep working without changes.

## 5. Working order

For a sibling module shipping a new class (homebrew or commercial):

1. **`registerClassMixin('<classId>', mixinFn)`** during `init` —
   contribute schema fields (skills, class fields).
2. **`registerActorSheet('Player', YourClassSheet, { label: '…' })`**
   during `init` — register your class-specific sheet. *(Will collapse
   into a single `registerSheetPart` call in Phase 5.)*
3. **(Phase 5)** `registerSheetPart({ classId, tab, template })` —
   contribute sheet markup (tabs, partials). Pending.
4. **(Phase 5 ✅ shipped P5-1)** `registerClassDefaults({ classId,
   defaults })` — contribute identity + mechanical defaults applied
   on first-open.
5. **(Phase 5 ✅ shipped P5-2)** `registerClassStartingItems({
   classId, items })` — if your class needs auto-created starting
   equipment.
6. **(Phase 6)** Lib `registerClassProgression(classId, progression)`
   — saves, crit dies, action dies per level.
7. **(Phase 6)** `registerVariant({ id, classes })` only if you ship
   a variant ruleset (XCC, MCC) — single homebrew classes against
   base DCC don't need this.
8. **(Optional)** Per-class roll-table bindings: `registerMercurialMagicTable`,
   pack-manager pushes for patron-taint / disapproval.

For the system itself, the same order applies — DCC dogfoods each
helper for its own seven built-in classes. The Phase 4 sub-arc
in `02-slice-backlog.md` walks step 1 class by class; Phase 5 and 6
sub-arcs will land steps 3–7 with the same per-class cadence.

## 6. Constraints to remember

- **Foundry-smelling shape stays** (§2.12). Mixins move the source of
  truth, not the path readers see.
- **Mixins must construct fresh field instances each call.** Foundry
  may re-invoke `defineSchema()`; field objects aren't shareable.
- **Built-in registrations live in `module/dcc.js:init`** — before
  `CONFIG.Actor.dataModels` is set, so the schema is fully composed
  before any document construction.
- **`classId` is lowercase canonical** (`'halfling'`, `'warrior'`,
  `'cleric'`, …) — same convention `EXTENSION_API.md` documents for
  class dispatch (see "Conventions for modules reading actor data"
  section there).
- **Last-write-wins on registries** (mixins, mercurial-magic table,
  etc.). Sibling modules can fully replace built-ins; users picking up
  two modules registering the same `classId` get the last one
  registered (registration order = module load order — Foundry
  doesn't guarantee this is stable, so document conflicts as a known
  limitation).
- **Source migrations (`migrateData`, `migrateFieldsToInteger`) stay
  in `player-data.mjs`.** They operate on raw source data before the
  schema applies, so they don't care which mixin owns the field.
- **Don't fold sheet-first-open concerns into `registerClassMixin`.**
  Mixins are schema-only. Defaults / starting items go to Phase 5
  registries.
