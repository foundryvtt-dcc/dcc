# Force Critical Feature (Disabled by Default)

This feature allows shift-clicking on spell dice to force a natural 20 for testing spell check criticals.

## Status: DISABLED

The feature is currently disabled but can be easily re-enabled for testing purposes.

## How to Enable

Uncomment the following lines in these 4 files:

### 1. `module/actor-sheet.js` (line ~822)
```javascript
static fillRollOptions (event) {
  const rollModifierDefault = game.settings.get('dcc', 'showRollModifierByDefault')
  return {
    showModifierDialog: rollModifierDefault ^ (event.ctrlKey || event.metaKey),
    forceCrit: event.shiftKey  // <-- Uncomment this line
  }
}
```

### 2. `module/actor.js` (line ~1073)
```javascript
await game.dcc.processSpellCheck(this, {
  rollTable: null,
  roll,
  item: null,
  flavor,
  forceCrit: options.forceCrit  // <-- Uncomment this line
})
```

### 3. `module/item.js` (line ~373)
```javascript
await game.dcc.processSpellCheck(actor, {
  rollTable: resultsTable,
  roll,
  item: this,
  flavor,
  manifestation: this.system?.manifestation?.displayInChat ? this.system?.manifestation : {},
  mercurial: this.system?.mercurialEffect?.displayInChat ? this.system?.mercurialEffect : {},
  forceCrit: options.forceCrit  // <-- Uncomment this line
})
```

### 4. `module/dcc.js` (lines ~447 and ~461-467)
```javascript
const forceCrit = spellData.forceCrit || false // <-- Uncomment this line

// ... later in the function ...

// Uncomment this entire block:
if (forceCrit && naturalRoll !== 1) {
  const originalDieRoll = naturalRoll
  naturalRoll = 20
  roll.terms[0].results[0].result = 20
  roll.terms[0]._total = 20
  roll._total += (20 - originalDieRoll)
}
```

## Usage (when enabled)

Hold **Shift** and click any spell die icon to force a natural 20 critical roll.

This works on:
- Individual spell items in the spell list
- Quick spell check buttons on the class tab (Wizard/Cleric)
- Both specific spells and raw spell checks

## Why Disabled?

The original bug report couldn't be reproduced in testing. Spell check criticals are working correctly without any code changes. This feature was created as a testing tool but is not needed for normal operation.

## Tests

The spell check critical calculation tests in `module/__tests__/spell-check-crit.test.js` will pass whether this feature is enabled or disabled, as they test the mathematical logic independently.
