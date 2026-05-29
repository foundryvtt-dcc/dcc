# Feature: optional label override for raw spell checks (`options.checkLabel`)

**Status:** proposed for `refactor/dcc-core-lib-adapter`. Small, general-purpose
addition so a class/module can relabel the raw (no-item) spell-check chat flavor.

## Problem

A raw spell check rolled from the sheet (the `system.class.spellCheck` cell, not a
specific spell item) always shows **"Spell Check"** in the chat card. MCC reuses
the spell-check machinery for **Mutation Check** (mutant / manimal / plantient) and
**Wetware Program Check** (shaman), so the chat flavor reads wrong for those
classes. There's currently no way to pass a different label.

(Rolling an individual spell/mutation *item* already uses the item's name as the
flavor — only the raw class-level check is hardcoded.)

## Where the flavor is set

`module/actor.js` → `_castNakedViaAdapter(options)` (the path a raw, no-item
`rollSpellCheck` takes):

```js
let flavor = options.spell || game.i18n.localize('DCC.SpellCheck')
if (abilityLabel) flavor += ` (${game.i18n.localize(abilityLabel)})`
```

The sheet action `module/actor-sheet.js` → `#rollSpellCheck(event, target)` calls
`this.options.document.rollSpellCheck(options)` for the no-item case and never
reads a label.

## Change

A two-line, fully backward-compatible addition: honor an optional
`options.checkLabel` (an i18n key or literal string) as the flavor base, and let
the sheet pass it from a `data-check-label` attribute on the rollable cell.

### 1. `module/actor-sheet.js` — `#rollSpellCheck`

Read the label from the cell's dataset (the same `target.parentElement.dataset`
already used for `itemId` / `ability`) and forward it:

```js
static async #rollSpellCheck (event, target) {
  const options = DCCActorSheet.fillRollOptions(event)
  const dataset = target.parentElement.dataset
  if (dataset.checkLabel) options.checkLabel = dataset.checkLabel   // <-- add
  if (dataset.itemId) {
    const item = this.actor.items.find(i => i.id === dataset.itemId)
    const ability = dataset.ability || ''
    await item.rollSpellCheck(ability, options)
  } else {
    await this.options.document.rollSpellCheck(options)
  }
}
```

### 2. `module/actor.js` — `_castNakedViaAdapter`

Use `checkLabel` as the flavor base when no spell name is present:

```js
let flavor = options.spell ||
  (options.checkLabel ? game.i18n.localize(options.checkLabel) : game.i18n.localize('DCC.SpellCheck'))
if (abilityLabel) flavor += ` (${game.i18n.localize(abilityLabel)})`
```

`game.i18n.localize` returns the input unchanged if it isn't a known key, so
`checkLabel` works as either an i18n key (preferred) or a raw string.

### Notes / edge cases

- Backward compatible: unset `checkLabel` → unchanged "Spell Check" behavior.
- Item casts are unaffected (they already flavor with the item name); `checkLabel`
  only changes the raw/no-item path. Setting it on an item cast is a harmless no-op.
- The ability suffix (` (Intelligence)`) is preserved — `checkLabel` only replaces
  the "Spell Check" base, so a shaman program check reads
  "Wetware Program Check (Intelligence)".
- If the legacy naked path (`_rollSpellCheckLegacy`/`processSpellCheck`) is ever
  reachable for a raw check, the same `options.spell || (options.checkLabel ? … )`
  substitution applies there for parity.

## Tests

`module/__tests__/` (adapter spell-check spec) — add:
- raw `rollSpellCheck({ checkLabel: 'MCC.MutationCheck' })` → chat flavor starts
  with the localized label (or the literal when not a key), not "Spell Check".
- regression: `rollSpellCheck({})` → flavor still "Spell Check".
- item cast with `checkLabel` set → flavor still the item name (unaffected).

## Downstream (MCC)

`mcc-classes` adds `data-check-label="MCC.MutationCheck"` to the mutant / manimal /
plantient mutation-check cells and `data-check-label="MCC.ProgramCheck"` to the
shaman program-check cell (the cell `<div>` that wraps the `data-action="rollSpellCheck"`
label). Those attributes are inert until this DCC change ships, then the chat flavor
reads "Mutation Check" / "Wetware Program Check".
