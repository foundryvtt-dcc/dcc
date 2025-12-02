# Active Effects V2

This document covers Active Effects changes in FoundryVTT V14.

## Overview

V14 introduces Active Effects V2 with significant improvements:
- Effects can be stored in Compendiums independently of Actors
- Drop effects directly onto Tokens
- Application phases for precise timing
- Improved duration handling (coming in later prototypes)
- Token property application (vision, size, light)

## Breaking Changes

### Legacy Transferral Removed

`CONFIG.ActiveEffect.legacyTransferral` has been removed (was deprecated since V11).

**Action Required**: Ensure your system doesn't rely on legacy transferral behavior.

```javascript
// V11-V13: Could set to maintain legacy behavior
CONFIG.ActiveEffect.legacyTransferral = true  // REMOVED in V14

// V14: Legacy behavior no longer available
// Effects transfer based on the transfer property only
```

### Origin Field Type Change

`ActiveEffect#origin` is now a `DocumentUUIDField` instead of a `StringField`:

```javascript
// V13
effect.origin  // String: "Actor.abc123" or similar

// V14
effect.origin  // DocumentUUIDField with validation
// Still returns string value, but with UUID validation
```

### Effect Change Data

```javascript
// V13
effect.changes[0].mode   // Number (e.g., 2 for ADD)
effect.changes[0].value  // Always string

// V14
effect.changes[0].type   // String (replaces numeric mode)
effect.changes[0].value  // Deserializes to JSON or string
```

## New Features

### Compendium Storage

Active Effects can now be stored in Compendium packs independently:

```javascript
// Create a compendium for effects
// In system.json
{
  "packs": [
    {
      "name": "effects",
      "label": "DCC Effects",
      "type": "ActiveEffect",
      "path": "packs/effects"
    }
  ]
}
```

### Token Drop Support

Effects can be dropped directly onto Tokens:

```javascript
// When an effect is dropped on a token, it's automatically
// applied to the token's associated actor
// No custom handling required for basic functionality
```

### Application Phases

Effects now support application phases for precise timing:

```javascript
// Effects can specify when they should be applied
// during the data preparation cycle
// This helps avoid priority competition between effects
```

### Scene Region Effects

Scene Regions can apply Active Effects to tokens:

```javascript
// Configure in Scene Region behavior settings
// Effects apply when tokens enter the region
// Effects remove when tokens leave the region
```

## Preparing for V14

### 1. Disable Legacy Transferral Now

If you haven't already, disable legacy transferral in V13:

```javascript
Hooks.once('init', () => {
  CONFIG.ActiveEffect.legacyTransferral = false
})
```

Test thoroughly to ensure your effects still work correctly.

### 2. Audit Effect Origins

Check that all effect origins are valid UUIDs:

```javascript
// Audit script for checking effect origins
for (const actor of game.actors) {
  for (const effect of actor.effects) {
    if (effect.origin && !effect.origin.includes('.')) {
      console.warn(`Invalid origin for effect ${effect.name}:`, effect.origin)
    }
  }
}
```

### 3. Review Effect Change Modes

Prepare for the mode → type migration:

```javascript
// V13 numeric modes
const MODES = {
  CUSTOM: 0,
  MULTIPLY: 1,
  ADD: 2,
  DOWNGRADE: 3,
  UPGRADE: 4,
  OVERRIDE: 5
}

// V14 will use string types
// Exact mapping TBD - check official docs when V14 releases
```

### 4. Update Effect Value Handling

If you're parsing effect values, handle JSON deserialization:

```javascript
// V13: Values are always strings
const value = effect.changes[0].value  // "5" or "{\"bonus\": 5}"

// V14: Values may be parsed JSON
const value = effect.changes[0].value  // 5 or { bonus: 5 }

// Safe handling for both
function getEffectValue(change) {
  const value = change.value
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}
```

## DCC System Considerations

### Current DCC Effects Usage

The DCC system uses Active Effects for:
- Conditions (stunned, blessed, cursed)
- Magic item bonuses
- Spell effects
- Class abilities

### Migration Checklist

- [ ] Verify `legacyTransferral = false` works correctly
- [ ] Audit all effect origins for valid UUIDs
- [ ] Test effect transfer behavior
- [ ] Review effect change modes used
- [ ] Update any custom effect value parsing
- [ ] Consider creating an effects compendium for common conditions

## Future Features (Coming in Later V14 Prototypes)

- Robust duration data model
- Automatic effect expiration
- Token property application (vision, size, light)
- Enhanced status icon control

## Related Documentation

- [Breaking Changes](BREAKING_CHANGES.md) - All V14 breaking changes
- [Data Models](DATA_MODELS.md) - TypeDataModel migration
- [Checklist](CHECKLIST.md) - Migration checklist
- [V11 Active Effects Changes](https://foundryvtt.com/article/v11-active-effects/) - Historical context
- [Active Effects User Guide](../../user-guide/Active-Effects.md) - End-user documentation
