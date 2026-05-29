# Fix: preserve additive init-die terms through the adapter init path

**Status:** ✅ **landed** on `refactor/dcc-core-lib-adapter` (2026-05-29). Implemented
directly on the branch (not the originally-suggested `fix/adapter-additive-init-die`):
`_initDieAdditiveTerms` helper + the re-append in `_getInitiativeRollViaAdapter`
(`module/actor.js`), with the unit / integration / e2e tests described below all
green.

## Problem

When `system.attributes.init.die` is a **compound additive formula** — e.g. MCC's
Mutant Horror folds its die into initiative as `1d20+1d3` (up to `1d20+1d7+7` at
higher levels) — the **combat-tracker** initiative path silently drops the extra
die and rolls only `1d20`.

The **sheet "Roll Initiative" button** is unaffected: it routes through the
legacy/dialog path (`_getInitiativeRollLegacy`), which reads `init.die` verbatim
and builds the compound roll correctly. The bug is specific to the adapter path.

> Context: this regression exists only on `refactor/dcc-core-lib-adapter`. On
> `main` (v0.67.3) `getInitiativeRoll` reads `init.die` verbatim for both paths,
> so compound init dice already work there. The adapter introduced the strip.

## Root cause

`module/actor.js` → `_getInitiativeRollViaAdapter()` is the path reached by the
combat tracker (`DCCCombatant.getInitiativeRoll` → `actor.getInitiativeRoll(formula)`
with no `showModifierDialog`). It does:

```js
const libDie = this._stripDieCount(dieFormula) || 'd20'
```

`_stripDieCount` → `normalizeLibDie(formula, null)` in
`module/adapter/attack-input.mjs:41`, whose regex `/\d*d(\d+)/` matches only the
**first** die — so `'1d20+1d3'` → `'d20'`. The lib's `SkillDefinition.roll.die`
models a single die plus flat modifiers; it has no representation for an
*additive die*, so the `+1d3` is lost.

(`init.value` — the agl-mod aggregate — is correctly carried as an `add`
modifier. Only the extra *die* is dropped.)

## Fix

Mirror the existing **weapon-label re-injection** already in this method (which
the code comments justify as "a Foundry display idiom the lib doesn't model"):
re-append the additive tail Foundry-side after `libRollCheck` builds the formula.

### 1. Add a helper to `actor.js`

```js
/**
 * The additive tail of an initiative die formula — everything after the
 * leading die. e.g. '1d20+1d3' -> '+1d3', '1d20+1d7+7' -> '+1d7+7', '1d20' -> ''.
 * The lib models initiative as a single die + flat modifiers, so an *additive*
 * die (MCC's Mutant Horror folds one into init.die) is a Foundry-side idiom the
 * lib can't represent; we re-append it the same way the weapon-die label is.
 */
_initDieAdditiveTerms (formula) {
  const m = /^\s*\d*d\d+(.*)$/i.exec(String(formula ?? '').trim())
  return m ? m[1].trim() : ''
}
```

### 2. Append the tail in `_getInitiativeRollViaAdapter`

Compute the tail from the actor's **own** `init.die` (not the possibly
weapon-overridden `dieFormula`), and append it only when no weapon override is in
effect — preserving today's weapon-override semantics, where an equipped
two-handed / `initiativeDieOverride` weapon **replaces** the init die entirely
(this matches `main`'s behavior):

```js
// after: const finalFormula = weaponLabel ? plan.formula.replace(...) : plan.formula
const additiveInitTerms = weaponLabel
  ? ''
  : this._initDieAdditiveTerms(this.system.attributes.init.die || '')
const rolledFormula = additiveInitTerms
  ? `${finalFormula} ${additiveInitTerms}`
  : finalFormula
return new Roll(rolledFormula, this.getRollData())
```

`plan.formula` is e.g. `1d20 + 3`; the result becomes `1d20 + 3 +1d3` — a valid
Foundry roll. `+1d7+7` works the same.

### Edge cases handled

- Plain `init.die` (`'1d20'`, `'d20'`, empty) → tail `''` → no append (unchanged).
- Two-handed / `initiativeDieOverride` weapon equipped → `weaponLabel` set → tail
  suppressed → weapon die wins, exactly as today (and as `main`).

## Tests

`module/__tests__/adapter-initiative.test.js` — add:

- `init.die = '1d20+1d3'` → adapter init `Roll.formula` contains `1d3` and has
  **two** dice terms.
- `init.die = '1d20+1d7+7'` → formula contains `1d7` and the flat `+7`.
- regression: `init.die = '1d20'` → single die, formula unchanged.
- regression: a two-handed weapon equipped + `init.die = '1d20+1d3'` → weapon die
  used, **no** `1d3` appended.

`module/__integration__/adapter-initiative.test.js` — one end-to-end case
asserting the compound die rolls (total within `[2, 23]` for `1d20+1d3`).

## Verify

`npm run test` (or
`npx vitest run module/__tests__/adapter-initiative.test.js module/__integration__/adapter-initiative.test.js`),
then `npm run check` (format + scss + test + compare-lang) before committing.

## Motivation / downstream

The MCC `mcc-classes` Mutant sheet folds the Mutant Horror die into
`system.attributes.init.die` as `1d20+<die>` (see `mcc-core-book` §9.2a). That
works from the sheet's Roll Initiative button today but not from the combat
tracker, because of the adapter strip described above. This fix makes the
combat-tracker path honor the additive die too, keeping the lib's single-die
model intact and only adding a Foundry-side re-append.
