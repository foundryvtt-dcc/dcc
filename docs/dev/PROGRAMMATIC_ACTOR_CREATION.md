# Programmatic PC Creation

> **Scope.** Why `Actor.create({ type: 'Player', system: { class: { className: 'Wizard' } } })`
> produces a *partially-configured* character, what's missing, and how
> "quick PC" tooling / browser-test fixtures should fill the gap. This
> is the dev-facing write-up of the PR #720 backlog item *"programmatic
> PC creation produces inconsistent class config."*

## TL;DR

A real DCC player character is configured by **two mechanisms that
`Actor.create()` bypasses**:

1. **Sheet-open class defaults** — when a class sheet first opens it
   calls `applyClassDefaults(actor, classId)` (+ `applyClassStartingItems`),
   writing class identity and Foundry-only mechanical defaults
   (`details.sheetClass`, `class.spellCheckAbility`, `class.disapproval`,
   the `config.*` toggles, the `classLink` enriched-HTML blobs, …).
2. **The level-change dialog** — `DCCActorLevelChange` reads per-level
   data from compendium *level-data items* and writes the level-scaled
   mechanical fields onto the actor (`saves.*.value`, `details.critDie` /
   `critTable` / `critRange`, `attributes.actionDice.value`,
   `attributes.hitDice.value`, `class.luckDie`, HP, level).

A bare `Actor.create(...)` runs neither. The created document has only
its **schema defaults** plus whatever you passed inline. Until a sheet
opens, `applyClassDefaults` has never fired; unless you drive the level
dialog (or set the fields yourself), the level-scaled fields are never
written.

## The two population mechanisms

### 1. Sheet-open defaults (`applyClassDefaults`)

Each per-class sheet subclass in `module/actor-sheets-dcc.js` shares one
`_prepareContext` body (`DCCSheet._prepareContext`, `actor-sheets-dcc.js:81`):

```js
const result = await applyClassDefaults(this.options.document, classId)
if (result === 'initialized') {
  const created = await applyClassStartingItems(this.options.document, classId)
  if (created.length > 0) this.render(false)
}
```

`applyClassDefaults` (`module/extension-api.mjs:333`) fires its
initial-setup branch when `actor.system.details.sheetClass` doesn't yet
match the registered `sheetClass`. The built-in payloads live in
`module/built-in-class-defaults.mjs` (registered at `module/dcc.js:init`).
It writes class identity (`className`, `classLink`, `sheetClass`) plus
the Foundry-only mechanical defaults:

| Field | Example (Cleric) | Source |
|-------|------------------|--------|
| `details.sheetClass` | `'Cleric'` | `defaults.sheetClass` (the dispatch sentinel) |
| `class.className` | localized `DCC.Cleric` | `defaults.localize` |
| `class.classLink` | enriched HTML | `defaults.enrichHtml` |
| `class.spellCheckAbility` | `'per'` | `defaults.literal` |
| `class.disapproval` | `1` | `defaults.literal` |
| `details.critRange` | `20` | `defaults.literal` |
| `config.attackBonusMode`, `config.addClassLevelToInitiative`, `config.show{Spells,Skills,Backstab}`, skill toggles | per class | `defaults.literal` |

Homebrew classes contribute their own entries via
`game.dcc.registerClassDefaults(classId, defaults)` — see
[`EXTENSION_API.md`](EXTENSION_API.md).

> **Key point:** this is *sheet-driven*. `Actor.create()` does not open a
> sheet, so none of these fields are written at create time. Rendering
> the actor's sheet once (headlessly: `actor.sheet.render(true)` and
> wait for `_prepareContext`) is enough to fire the initial-setup write.

### 2. The level-change dialog (compendium level data)

`module/actor-level-change.js` is the **only** code path that writes the
level-scaled mechanical fields. On submit (`#onSubmitForm`,
`actor-level-change.js:280`) it:

1. looks up the `{ClassName}-{level}` item in the packs registered at
   `CONFIG.DCC.levelDataPacks` (`_lookupLevelItem`, line 148),
2. parses that item's `system.levelData` text into key/value pairs
   (`_getLevelDataFromItem`, line 115),
3. assembles a `levelData` update object and calls
   **`actor.update(levelData)`** (line 330).

Fields written this way: `saves.{ref,frt,wil}.value`,
`details.attackHitBonus`, `details.critDie`, `details.critTable`,
`details.critRange`, `attributes.actionDice.value`, `config.actionDice`,
`attributes.hitDice.value`, `class.luckDie`, `attributes.hp.{value,max}`,
`details.level.value`.

### 3. The lib progression registry (consumed at roll time, not stored)

Separately from the dialog's stored fields, Phase 6 wired a
**lib-side** class-progression registry. At `dcc.ready`,
`registerClassProgressionsFromPacks()`
(`module/adapter/foundry-data-loader.mjs:209`) walks the same
`CONFIG.DCC.levelDataPacks`, assembles a `ClassProgression` per class,
and calls the vendored lib's `registerClassProgressions(...)`. Adapter
roll paths then read derived values (`getSaveBonus`, `getCritDie`,
`getAttackBonus`, …) from that registry **keyed by `classId` + level** —
no per-actor field needed.

This means a content-bearing world supplies *some* mechanical numbers at
roll time even without the stored display fields. But the registry is
**only as populated as the world's content** (see the caveat below), and
it does not back the sheet's *display* of those fields — those still come
from the dialog-written `system.*` values.

## What a bare `Actor.create()` is missing

`Actor.create({ type: 'Player', system: { class: { className: 'Wizard' } } })`
gives you schema defaults + `class.className: 'Wizard'` and nothing else.
Concretely **missing** until you drive a sheet open and/or the level
dialog:

- **From class defaults (sheet-open):** `details.sheetClass`,
  `class.spellCheckAbility`, `class.disapproval`, `class.classLink`,
  `config.attackBonusMode`, `config.addClassLevelToInitiative`,
  `config.show{Spells,Skills,Backstab}`, class skill toggles.
- **From the level dialog (compendium-driven):** `saves.*.value`,
  `details.attackHitBonus`, `details.critDie` / `critTable` / `critRange`,
  `attributes.actionDice.value`, `config.actionDice`,
  `attributes.hitDice.value`, `class.luckDie`.

Symptoms in practice: a spellcaster created this way has no
`spellCheckAbility`, so its spell check can't resolve its governing
ability; saves show their schema-default (0) class bonus; the sheet
renders as un-themed until first open.

## Recommended approaches

### "Quick PC" tooling

To create a fully-configured PC programmatically, in order of fidelity:

1. **Open the sheet once** to fire `applyClassDefaults` /
   `applyClassStartingItems` — this covers all the *class-identity +
   Foundry-only defaults* (mechanism 1). Headless callers can
   `await actor.sheet.render(true)` and await the resulting
   `_prepareContext`, then close it.
2. **Drive the level-change dialog** (or replicate its submission logic)
   to write the *level-scaled* fields (mechanism 2). This requires a
   world that ships level-data packs — the open-source system does not
   (see caveat).
3. **Or set the fields explicitly** in the `Actor.create()` payload /
   a follow-up `actor.update(...)` when you know the exact values you
   need. This is what the e2e fixtures do (below).

### Browser-test fixtures

The e2e specs in `browser-tests/e2e/` deliberately **do not** drive the
level dialog. Each test sets only the specific field(s) it exercises:

- Inline at create when one field suffices, e.g.
  `Actor.create({ type: 'Player', system: { class: { className: 'Wizard', spellCheckAbility: 'int' } } })`
  (`extension-api.spec.js:1373`).
- Direct `update(...)` for a targeted field, e.g. a probe that sets
  `details.sheetClass` / `critRange` to keep a migration branch a no-op
  (`extension-api.spec.js:1186`).
- NPC adjustment fields set directly when testing the attack path
  (`adapter-dispatch.spec.js` NPC `rollToHit` cases).

This "set exactly what the test needs" pattern is intentional: it keeps
fixtures fast and self-documenting (the test names the fields it depends
on) and avoids coupling every spec to compendium level-data content the
open-source system doesn't ship. **When adding a fixture that needs a
field the test under exercise reads, set it explicitly rather than
assuming `Actor.create` populated it.**

## Caveat: the open-source system ships no level data

The DCC class-progression *data* is copyrighted Goodman Games material
and lives in the private `dcc-official-data` repo. The
open-source system ships only the **registration surface**:
`game.dcc.registerClassProgression(s)` and the level-data-pack loader.

So in a **content-free world** (`CONFIG.DCC.levelDataPacks` is `null`):
- the level dialog finds no `{ClassName}-{level}` items, so mechanism 2
  writes nothing;
- `registerClassProgressionsFromPacks()` registers zero progressions, so
  the lib registry's `getSaveBonus` / `getCritDie` / … return their
  zero/empty defaults.

Mechanism 1 (`applyClassDefaults`) still works — it ships its data in
`module/built-in-class-defaults.mjs`, not in a compendium. So in a
content-free world, opening a PC's sheet gives you the class identity and
Foundry-only defaults, but **the level-scaled mechanical fields stay at
schema defaults** until a content module (a `dcc-core-book` update, a
sibling content pack) registers its packs.

## Related

- [`EXTENSION_API.md`](EXTENSION_API.md) — `registerClassDefaults`,
  `registerClassProgression(s)`, `registerHomebrewClassForProgressionLoad`
- User-facing: [`../user-guide/Level-Up.md`](../user-guide/Level-Up.md)
