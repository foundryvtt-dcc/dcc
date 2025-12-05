# V14 Breaking Changes

This document covers breaking changes in FoundryVTT V14.

**Note**: V14 is in development. This information is based on prototype releases and may change.

## Resources

- [V14 Breaking Changes GitHub Board](https://github.com/orgs/foundryvtt/projects/67/views/8)

## Deprecation Expirations

### Removed in V14

**Active Effects:**
- `CONFIG.ActiveEffect.legacyTransferral` support removed (deprecated since V11)

**Status Effects:**
- Status effect configuration now uses `img` instead of `icon` for the image path

```javascript
// V13
CONFIG.statusEffects = [
  { id: 'blind', icon: 'icons/svg/blind.svg', label: 'Blind' }
]

// V14
CONFIG.statusEffects = [
  { id: 'blind', img: 'icons/svg/blind.svg', label: 'Blind' }
]
```

**DCC Impact**: ✅ FIXED in `module/status-icons.js` - Changed `icon` to `img` for all status effect definitions.

**V12 Deprecations:**
A large assortment of V12-era deprecations have been retired. See [GitHub issue #13436](https://github.com/foundryvtt/foundryvtt/issues/13436) for the complete list.

## Documents and Data

### DataModel Operation Keys

The `updateSource` method no longer supports `-=` and `==` special keys:

```javascript
// V13 and earlier (DEPRECATED in V14)
document.updateSource({ 'system.attributes.-=strength': null })  // Delete key
document.updateSource({ 'system.name.==': 'New Name' })          // Force overwrite

// V14 (Required)
// Use new DataFieldOperator values instead
// (Specific syntax TBD - check official docs when V14 releases)
```

### Legacy template.json Deprecated

**CRITICAL**: The legacy `template.json` specification is deprecated. Systems must migrate to `TypeDataModel`.

See [Data Models](DATA_MODELS.md) for migration guide.

### RectangleShapeData Changes

- Anchor properties added
- Pivot shifted from center calculation to `(x, y)` position
- Tile mesh positioning now equals `TileDocument` position
- New "Anchor X/Y" config option

### DataModel.cleanData Changes

Data cleaning consolidated - `DataModel.cleanData` now handles preprocessing with expanded `options` parameter.

### Field Validation Changes

- Field and joint validation moved from `DataModel#updateSource` to main `_updateDiff` workflow
- The source passed to DataModel construction in `EmbeddedDataField/EmbeddedDocumentField/ActorDeltaField/TypeDataField#initialize` is no longer unnecessarily cleaned and migrated

### Active Effect Changes

```javascript
// V13 (String field)
effect.origin  // Returns string

// V14 (DocumentUUIDField)
effect.origin  // Now a DocumentUUIDField instead of StringField

// EffectChangeData changes
effect.change.value  // Now deserializes to JSON parse result or string value
effect.change.mode   // DEPRECATED - use effect.change.type instead
effect.change.type   // New string-based type field
```

**CONST.ACTIVE_EFFECT_MODES → CONST.ACTIVE_EFFECT_CHANGE_TYPES:**

Accessing `CONST.ACTIVE_EFFECT_MODES` will log a deprecation warning. The new `CONST.ACTIVE_EFFECT_CHANGE_TYPES` uses string values:

| Old Mode | Old Value | New Type |
|----------|-----------|----------|
| CUSTOM | 0 | `'custom'` |
| MULTIPLY | 1 | `'multiply'` |
| ADD | 2 | `'add'` |
| DOWNGRADE | 3 | `'downgrade'` |
| UPGRADE | 4 | `'upgrade'` |
| OVERRIDE | 5 | `'override'` |

**DCC Impact**: ✅ FIXED in `module/actor.js` - The `applyActiveEffects` method now uses string types with fallback to numeric mode for backwards compatibility:

```javascript
// DCC system implementation
const type = change.type || change.mode || 'add'
switch (type) {
  case 'custom': ...
  case 'add': ...
  case 'multiply': ...
  case 'override': ...
  case 'upgrade': ...
  case 'downgrade': ...
}
```

### ActiveEffect Duration Time Units

ActiveEffect duration now supports multiple time units beyond just seconds:

```javascript
// V14 supported duration units
"years" | "months" | "days" | "hours" | "minutes" | "seconds" | "rounds" | "turns"

// Combat-related expiry events
"combatStart" | "roundStart" | "turnStart"
```

**DCC Impact**: The system uses `effect.duration.seconds` in `module/dcc.js`. Current code should continue to work, but may need updates to handle effects with other duration units.

## Applications and UI

### Roll Mode Renamed to Message Mode

The `rollMode` property is being renamed (likely to `mode` or `visibility`) since the modes affect more than just rolls. See [GitHub issue #8856](https://github.com/foundryvtt/foundryvtt/issues/8856).

```javascript
// V13
const rollMode = game.settings.get('core', 'rollMode')
ChatMessage.applyRollMode(messageData, rollMode)

// V14 (TBD - check official docs when V14 releases)
// Property name will change from 'rollMode' to 'mode' or 'visibility'
```

**DCC Impact**: The system uses `rollMode` in multiple places:
- `module/actor.js` - `game.settings.get('core', 'rollMode')` and `ChatMessage.applyRollMode()`
- `module/spell-result.js` - `rollMode` in message options
- Translation keys: `DCC.RollMode` in language files

### Scene Controls

`SceneControls#tool` and `Game#activeTool` may now be `null` if no tools exist in the current layer:

```javascript
// V13
const tool = game.activeTool  // Always a string

// V14
const tool = game.activeTool  // May be null
if (tool) {
  // Safe to use tool
}
```

### Edge Configuration

`ClockwiseSweepPolygonConfig#edgeOptions` replaced by `#edgeTypes`.

### ContextMenuEntry Icon

`ContextMenuEntry#icon` now accepts class names in addition to HTML-parseable strings:

```javascript
// Both now valid in V14
{ icon: '<i class="fas fa-star"></i>' }  // HTML string
{ icon: 'fas fa-star' }                   // Class name only
```

## Utilities

### parseHTML Behavior

`parseHTML` now returns `null` instead of `undefined` for failed parses:

```javascript
// V13
const result = parseHTML(invalidHtml)  // undefined

// V14
const result = parseHTML(invalidHtml)  // null
if (result === null) {
  // Handle parse failure
}
```

### Renamed Classes

- `RegionPolygonTree` → `foundry.data.PolygonTree` (with expanded API)
- `RegionShape` deprecated → Replaced by client-side mixins of `BaseShapeData` subclasses

## Canvas Changes

### MeasuredTemplates

The `MeasuredTemplate` Document type has been absorbed by the Scene Regions framework. Parity features have been added to maintain functionality.

### TokenMovementActionConfig

`TokenMovementActionConfig#getAnimationOptions` signature changed:

```javascript
// V13
getAnimationOptions(token: Token)

// V14
getAnimationOptions(tokenDocument: TokenDocument)
```

### TokenDocument Detection Modes

`TokenDocument#detectionModes` is now a `TypedObjectField` instead of a standard field.

## Editor Changes

### TinyMCE Removed

TinyMCE is fully removed in V14. Only ProseMirror is available.

```javascript
// V13 (deprecated)
foundry.prosemirror.defaultPlugins

// V14 (required)
ProseMirrorEditor.buildDefaultPlugins()
```

## New Constants

```javascript
CONST.EDGE_SENSE_TYPES
CONST.EDGE_RESTRICTION_TYPES
CONST.EDGE_DIRECTIONS
CONST.EDGE_DIRECTION_MODES
```

## Related Documentation

- [Data Models](DATA_MODELS.md) - template.json migration
- [Active Effects](ACTIVE_EFFECTS.md) - Effect system changes
- [Checklist](CHECKLIST.md) - Migration checklist
- [V13 Breaking Changes](../v13/BREAKING_CHANGES.md) - Ensure V13 migration is complete
