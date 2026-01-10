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

The `mode` property has been replaced with `type` and uses string values:

```javascript
// V13
effect.changes[0].mode   // Number (e.g., 2 for ADD)
effect.changes[0].value  // Always string

// V14
effect.changes[0].type   // String (replaces numeric mode)
effect.changes[0].value  // Deserializes to JSON or string
```

**V14 String Type Values:**
| V13 Mode | V13 Value | V14 Type |
|----------|-----------|----------|
| CUSTOM | 0 | `'custom'` |
| MULTIPLY | 1 | `'multiply'` |
| ADD | 2 | `'add'` |
| DOWNGRADE | 3 | `'downgrade'` |
| UPGRADE | 4 | `'upgrade'` |
| OVERRIDE | 5 | `'override'` |

**Note:** Accessing `CONST.ACTIVE_EFFECT_MODES` in V14 will log a deprecation warning. Use the string type values directly instead.

### Application Phases Must Be Registered

V14 uses a two-phase effect application system ("initial" and "final"). **You must register these phases** or you'll get the error: `"initial" is not a registered ActiveEffect application phase`.

```javascript
// module/dcc.js - in Hooks.once('init', ...)
CONFIG.ActiveEffect.phases = {
  initial: { priority: 0, label: 'Initial' },
  final: { priority: 100, label: 'Final' }
}
```

### DataField.applyChange() for Schema Fields

**Critical Change:** V14's `ActiveEffect.apply()` method uses `DataField.applyChange()` for fields defined in the DataModel schema. This bypasses the `_applyLegacy()` and `_applyAdd()` methods entirely.

This means:
- Custom `_applyAdd()` overrides won't be called for schema-defined fields
- String fields with numeric-looking values (like thief skills: "+5", "-2") won't be treated as numbers
- You must intercept in `apply()` before the DataField system handles the change

## DCC System Implementation

### Custom ActiveEffect Document Class

The DCC system uses a custom `DCCActiveEffect` class to handle:
1. **Equipped Status Filtering** - Only apply effects from equipped items
2. **Dice Chain Adjustments** - Custom effect type to move dice along the DCC dice chain
3. **Signed String Numeric Operations** - Handle thief skills that store numbers as signed strings ("+5", "-2", "0")

### Dice Chain Effect Type

DCC introduces a custom effect type `diceChain` that adjusts dice expressions along the DCC dice chain:

**Dice Chain:** d3 → d4 → d5 → d6 → d7 → d8 → d10 → d12 → d14 → d16 → d20 → d24 → d30

**Usage:**
- Set the effect's **Change Type** to "Dice Chain"
- Set the **Value** to the number of steps to move (positive = up, negative = down)
- **Value "1"** moves up one step (e.g., d20 → d24)
- **Value "-1"** moves down one step (e.g., d20 → d16)
- **Value "2"** moves up two steps (e.g., d20 → d30)

**Target Fields (use with Dice Chain type):**
| Field | Key |
|-------|-----|
| Action Die | `system.attributes.actionDice.value` |
| Critical Die | `system.attributes.critical.die` |
| Fumble Die | `system.attributes.fumble.die` |
| Luck Die | `system.class.luckDie` |

**JSON Example:**
```json
{
  "changes": [
    {
      "key": "system.attributes.actionDice.value",
      "value": "1",
      "type": "diceChain",
      "priority": null
    }
  ]
}
```

This effect would move the action die up one step on the chain (e.g., from d20 to d24).

```javascript
// module/active-effect.js
export default class DCCActiveEffect extends ActiveEffect {
  apply (actor, change) {
    // Check if this effect comes from an item
    const parentItem = this.parent
    if (parentItem?.documentName === 'Item') {
      const isEquipped = parentItem.system?.equipped ?? true
      if (!isEquipped) {
        return {}
      }
    }

    // Handle string values that look like signed numbers (thief skills)
    const current = foundry.utils.getProperty(actor, change.key)
    const ct = foundry.utils.getType(current)

    if (ct === 'string' && !String(current).includes('d') && !String(change.value).includes('d')) {
      const currentNum = Number(current)
      const deltaNum = Number(change.value)

      if (!isNaN(currentNum) && !isNaN(deltaNum)) {
        let result
        switch (change.type) {
          case 'add':
            result = currentNum + deltaNum
            break
          case 'multiply':
            result = currentNum * deltaNum
            break
          case 'upgrade':
            result = Math.max(currentNum, deltaNum)
            break
          case 'downgrade':
            result = Math.min(currentNum, deltaNum)
            break
          case 'override':
            result = deltaNum
            break
          default:
            result = null
        }

        if (result !== null) {
          const formatted = result > 0 ? `+${result}` : String(result)
          if (formatted !== current) {
            foundry.utils.setProperty(actor, change.key, formatted)
            return { [change.key]: formatted }
          }
          return {}
        }
      }
    }

    return super.apply(actor, change)
  }
}
```

Register the custom class in `dcc.js`:

```javascript
import DCCActiveEffect from './active-effect.js'

Hooks.once('init', async function () {
  // ... other init code ...

  CONFIG.ActiveEffect.legacyTransferral = false

  CONFIG.ActiveEffect.phases = {
    initial: { priority: 0, label: 'Initial' },
    final: { priority: 100, label: 'Final' }
  }

  CONFIG.ActiveEffect.documentClass = DCCActiveEffect
})
```

### Effect Target Fields

For effects that modify values that also have modifier fields, target the modifier field instead of the base value to ensure proper stacking:

| Attribute | Don't Use | Use Instead |
|-----------|-----------|-------------|
| Saves | `system.saves.frt.value` | `system.saves.frt.otherBonus` |
| Saves | `system.saves.ref.value` | `system.saves.ref.otherBonus` |
| Saves | `system.saves.wil.value` | `system.saves.wil.otherBonus` |
| AC | `system.attributes.ac.value` | `system.attributes.ac.otherMod` |
| Initiative | `system.attributes.init.value` | `system.attributes.init.otherMod` |

This prevents effects from overwriting the base value and allows multiple effects to stack properly.

## Effect Compendium Format

### ID Requirements

Effect IDs must be exactly 16 characters, alphanumeric only:

```javascript
// Invalid (too short)
"_id": "AE039PICK1"      // 10 chars - will fail validation

// Valid
"_id": "xZT74QXf3xMkTrXT"  // 16 chars alphanumeric
```

### JSON Structure

Example effect JSON for compendium:

```json
{
  "name": "Fortitude Save Bonus (+1)",
  "img": "systems/dcc/styles/images/game-icons-net/turtle-shell.svg",
  "type": "base",
  "system": {},
  "changes": [
    {
      "key": "system.saves.frt.otherBonus",
      "value": "1",
      "type": "add",
      "priority": null
    }
  ],
  "disabled": false,
  "duration": {
    "startTime": null,
    "seconds": null,
    "combat": null,
    "rounds": null,
    "turns": null,
    "startRound": null,
    "startTurn": null
  },
  "description": "<p>Adds +1 to Fortitude saving throws.</p>",
  "origin": null,
  "transfer": true,
  "statuses": [],
  "flags": {},
  "_id": "sFA7TCFXm6dwmDmg",
  "_stats": {
    "coreVersion": "14.352",
    "systemId": "dcc",
    "systemVersion": "0.66.0",
    "createdTime": null,
    "modifiedTime": null,
    "lastModifiedBy": null,
    "compendiumSource": null,
    "duplicateSource": null,
    "exportSource": null
  },
  "folder": null,
  "sort": 1200,
  "ownership": {
    "default": 0
  },
  "_key": "!effects!sFA7TCFXm6dwmDmg"
}
```

Key points:
- `type` field uses lowercase string ("add", not "Add" or 2)
- `_id` is exactly 16 alphanumeric characters
- `_key` follows pattern `!effects!{_id}`
- Target `otherBonus`/`otherMod` fields where appropriate

## Compendium Storage

Active Effects can be stored in Compendium packs independently:

```javascript
// In system.json
{
  "packs": [
    {
      "name": "dcc-effects",
      "label": "DCC Effects",
      "type": "ActiveEffect",
      "path": "packs/dcc-effects"
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

### Scene Region Effects

Scene Regions can apply Active Effects to tokens:

```javascript
// Configure in Scene Region behavior settings
// Effects apply when tokens enter the region
// Effects remove when tokens leave the region
```

## Common Issues and Solutions

### Double Application Bug

**Symptom:** Effects apply twice (+1 becomes +2)

**Cause:** V14's two-phase application system. If you have a custom `applyActiveEffects` that doesn't handle the `phase` parameter, effects apply in both phases.

**Solution:** Don't override `applyActiveEffects`. Let Foundry handle effect application and use a custom ActiveEffect document class for DCC-specific behavior.

### String Concatenation Instead of Addition

**Symptom:** Thief skills show "01" instead of "+1" when adding effects

**Cause:** V14 uses `DataField.applyChange()` for schema-defined fields, which treats string fields as strings, not numbers. "0" + "1" = "01" via string concatenation.

**Solution:** Intercept in `apply()` method before calling `super.apply()`. Check if the current value is a numeric string and handle the math manually, then format with sign prefix.

### Phase Not Registered Error

**Symptom:** Error: `"initial" is not a registered ActiveEffect application phase`

**Cause:** Missing phase registration in CONFIG.

**Solution:** Add to init hook:
```javascript
CONFIG.ActiveEffect.phases = {
  initial: { priority: 0, label: 'Initial' },
  final: { priority: 100, label: 'Final' }
}
```

## Migration Checklist

- [x] Verify `legacyTransferral = false` works correctly
- [x] Register ActiveEffect phases in CONFIG
- [x] Create custom DCCActiveEffect document class
- [x] Register document class in CONFIG
- [x] Update effect targets to use otherBonus/otherMod fields
- [x] Create effects compendium with proper format
- [x] Ensure 16-char alphanumeric IDs
- [x] Use lowercase string type values
- [ ] Audit all effect origins for valid UUIDs
- [ ] Test effect transfer behavior
- [ ] Update any custom effect value parsing

## Related Documentation

- [Breaking Changes](BREAKING_CHANGES.md) - All V14 breaking changes
- [Data Models](DATA_MODELS.md) - TypeDataModel migration
- [Checklist](CHECKLIST.md) - Migration checklist
- [V11 Active Effects Changes](https://foundryvtt.com/article/v11-active-effects/) - Historical context
- [Active Effects User Guide](../../user-guide/Active-Effects.md) - End-user documentation
