# V14 Breaking Changes

This document covers breaking changes in FoundryVTT V14.

**Current Status**: Stable 1 (Build 359). Official release on April 1, 2026.

## Resources

- [V14 Breaking Changes GitHub Board](https://github.com/orgs/foundryvtt/projects/67/views/8)
- [V14 Prototype 1 Release Notes](https://foundryvtt.com/releases/14.349)
- [V14 Developer 1 Release Notes](https://foundryvtt.com/releases/14.354)
- [V14 User Testing 2 Release Notes](https://foundryvtt.com/releases/14.357)
- [V14 User Testing 3 Release Notes](https://foundryvtt.com/releases/14.358)
- [V14 Stable 1 Release Notes](https://foundryvtt.com/releases/14.359)

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

**TinyMCE Fully Removed:**
TinyMCE has been entirely removed from Foundry. An external integration API exists for modules/systems that need to reintroduce it.

**TextureData Attributes Removed:**
The unused `offsetX`, `offsetY`, and `rotation` attributes have been removed from `TextureData`.

**Macro Author Field:**
`Macro#author` field is now nullable.

**Utility Function Renames:**
- `foundry.utils.objectsEqual` → `foundry.utils.equals()` (redesigned for generalized equality testing)
- New utility: `foundry.utils.isPlainObject` for plain object detection
- New utility: `foundry.utils.closestPointToPath`

**Boolean Values in Rolls:**
Boolean values in Rolls now evaluate as numbers (0 for false, 1 for true).

**Wall Properties Moved:**
Wall properties (`isDoor`, `isOpen`) moved from Wall placeable to `WallDocument` class.

**Thumbnail Generation:**
Scene thumbnail generation now uses either the initial level or currently viewed level. The `properties`, `src`, and `texture` properties of `ImageHelper#createThumbnail` return type are deprecated.

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

### Pop-out Applications

`ApplicationV2` instances can now render in separate browser windows. **Important**: Legacy v1 Applications do not support pop-out functionality.

```javascript
// ApplicationV2 supports pop-out windows
// Legacy Application (v1) does NOT support this feature
```

**DCC Impact**: All DCC sheets have been migrated to ApplicationV2 and support pop-out windows.

### Roll Mode Renamed to Message Mode

The `rollMode` setting and `ChatMessage.applyRollMode` are deprecated. Use the new `messageMode` setting and `ChatMessage.applyMode` instead. The mode values changed from legacy strings to shorter names.

```javascript
// V13
const rollMode = game.settings.get('core', 'rollMode')  // "publicroll", "gmroll", "blindroll", "selfroll"
ChatMessage.applyRollMode(messageData, rollMode)

// V14
const messageMode = game.settings.get('core', 'messageMode')  // "public", "gm", "blind", "self"
ChatMessage.applyMode(messageData, messageMode)

// Roll.toMessage options
// V13: { rollMode: game.settings.get('core', 'rollMode') }
// V14: { messageMode: game.settings.get('core', 'messageMode') }
```

**DCC Impact**: ✅ FIXED - All usages updated:
- `module/actor.js` - 4 calls migrated to `ChatMessage.applyMode` + `messageMode` setting
- `module/spell-result.js` - `rollMode` option → `messageMode` in `Roll.toMessage()` options

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

### Scene Levels (New in Developer 1)

Scene Levels allow vertically stacking multiple images inside a single scene, each at a defined elevation.

Key features:
- Dedicated "Levels" tab in Scene Configuration dialog
- Token positioning adjusts when changing levels via Change Level behavior
- `Scene#gridlessGrid` property added (gridless version of `Scene#grid`)
- New grid helper methods: `BaseGrid#getRectangle`, `BaseGrid#getLine`, `BaseGrid#getEllipse`

### Placeables Palette (Technical Preview)

New bulk-editing feature for canvas objects. Adds Select tool for Ambient Lights, Ambient Sounds, and Map Notes.

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

### Token Movement Path Options (User Testing 2 - Build 357)

`TokenFindMovementPathOptions` deprecated properties replaced:

```javascript
// Deprecated
TokenFindMovementPathOptions#ignoreWalls
TokenFindMovementPathOptions#ignoreCost
TokenFindMovementPathOptions#history

// Replaced by
TokenFindMovementPathOptions#constrainOptions
```

New `TokenConstrainMovementPathOptions` properties: `maxCost` and `maxDistance`.

**DCC Impact**: Not directly used by the DCC system.

### Token Configuration Labels (User Testing 2 - Build 357)

Token Configuration dialog labels updated:
- `Dimensions (Grid Spaces) Width / Height / Depth` → `Size (Grid Spaces) X / Y / Z`

### SceneControlTool Required Properties (User Testing 3 - Build 358)

New required properties added to `SceneControlTool`:

```javascript
SceneControlTool#interaction
SceneControlTool#control
SceneControlTool#creation
```

**DCC Impact**: If the DCC system registers any custom scene control tools, these properties must now be provided.

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
CONST.ACTIVE_EFFECT_CHANGE_TYPES  // Replaces numeric ACTIVE_EFFECT_MODES
```

## New API Features

### DataModel Improvements

Performance improvements:
- Document construction: ~9% faster
- Local updates: ~3% faster
- Persisted creation: ~26% faster
- Persisted updates: ~10% faster

New features:
- Batch multiple Document modifications into single database transaction
- `DataModel#updateSource` now accepts another `DataModel` as changes
- New lifecycle functions: `DataModel#_updateDiff` and `DataModel#_updateCommit`
- `SchemaField#entries` caching for performance optimization

### ApplicationV2 Improvements

- Middle mouse button click support (`auxclick`)
- Standard `ContextMenu` implementation for kebab menu
- Pop-out window spawning API with bootstrap hooks
- `ApplicationV2.instances` generator for iterating application instances

### PolygonTree API

- `PolygonTreeNode#testPoint` now accepts `tolerance` parameter
- New methods: `PolygonTreeNode#findContainingNode`, `PolygonTreeNode#findClosestPoint`

### User Testing 2 (Build 357) API Additions

- Core `debounce` helper now supports `cancel()` for cleanup workflows
- `Roll.replaceFormulaData` uses custom `value.toString()` when available for object-type values
- Token movement API: explicit movement ID support in `TokenMovement#move` and `Scene#moveTokens`
- New high-level API: `token.planMovement(options)` for interactive movement planning
- `RegionLayer#placeRegions` added; index/count arguments renamed to `shapeIndex`/`shapeCount`
- `RegionLayer#placeRegion` accepts `allowEmpty` option

### User Testing 3 (Build 358) API Additions

- `Scene#pullUsers()` now accepts `viewOptions?: SceneViewOptions` parameter
- `Scene#activate()` now accepts `{viewOptions?: SceneViewOptions; pullUsers?: boolean}` options
- New `highlightElement(element, options={})` helper function (extracted from Tour class)
- `SceneControlTool#shapeData` added for Region drawing tool shapes
- `RegionDocument#spawnTokens()` accepts `{create: false}` for ephemeral tokens
- New `SceneManager#_determineInitialLevel` method
- `TokenDocument#getOccupiedGridSpaceOffsets` now accounts for walls and surfaces
- `FogManager` made easier to extend; improved shared fog handling

### User Testing 3 (Build 358) Performance

Major world loading improvements:
- D&D 5E: 25,258ms → 10,354ms (59% faster)
- Crucible: 11,315ms → 4,998ms (56% faster)
- Achieved by eliminating accidental `ActorDelta` creation and world-level guards

## Bug Fixes of Note

### Active Effect Fixes (Build 357-358)

- `ActiveEffect#_prepareTimeBasedDuration` no longer passes deprecated option to `CalendarData` format methods (357)
- `ActiveEffect#isSuppressed` simplified by removing unnecessary check (357)
- Compendiums containing only Active Effects no longer have missing banner images (357)
- Combat-based active effect duration accuracy loss across multiple combats fixed (358)
- `ArrayField`/`SetField` `_applyChangeAdd`/`_applyChangeSubtract` now respect min/max constraints (358)
- Data model initialization when applying active effects to `EmbeddedDataField` fixed (358)
- Active Effect drop on tokens now uses token shape instead of bounds (358)
- Manually added `tokenActiveEffectChanges` now properly apply to synthetic actors (358)

### Other Notable Fixes

- Documents with invalid `type` can now be deleted (357)
- Compendium item updates no longer lose data in index entries (358)
- Compendium sidebar filter now searches across compendium contents, not just names (358)

### Stable 1 (Build 359) Changes

**Installation:**
- Cannot update to V14 from within Foundry; requires uninstall and reinstall
- Complete data backup recommended before upgrading

**New Stable Features:**
- Scene transition effects
- Screen shake API
- Particle generation engine with rotation randomization and `onUpdate` callbacks
- `RegionDocument#elevation.base` property added
- Token `shape` property now targetable by Active Effects
- `Level#background`, `#foreground`, `#fog` made non-nullable fields
- Font Awesome updated to 7.2.0
- Token drag ruler customization via `TokenRuler#_getWaypointStyle`
- Alpha Threshold field added to Tile Configuration dialog
- "Clear All Objects" buttons now respect locked object status
- Non-GMs can delete their own placeable objects

**Known Issues:**
- Roll visibility bug: Player-visible rolls show as `'???'` when message mode is Private to Gamemasters or using `/gmroll`; GM receives correct results. Text messages work correctly.

**Confirmed Compatible Systems at Launch:**
- D&D 5E, Crucible, Universal Tabletop System, Blades In The Dark, Discworld, Fate Core Official, Metanthropes, Ryuutama, Star Trek Adventures 2d20

## V14 Deprecations (Removed in V16)

These are deprecated in V14 but still functional. They will be removed in V16.

### CONST.DICE_ROLL_MODES → CONFIG.ChatMessage.modes

`CONST.DICE_ROLL_MODES` is deprecated. Use `CONFIG.ChatMessage.modes` instead with new string values. Migration is facilitated by `Roll._mapLegacyRollMode`.

**DCC Impact**: ✅ FIXED - Production code uses `game.settings.get('core', 'rollMode')` which returns the setting value directly (not via CONST). Integration tests updated to avoid deprecated CONST access.

### mergeObject: performDeletions → applyOperators

The `performDeletions` option in `foundry.utils.mergeObject` is renamed to `applyOperators`.

```javascript
// V13 (deprecated in V14)
foundry.utils.mergeObject(original, changes, { performDeletions: true })

// V14 (required by V16)
foundry.utils.mergeObject(original, changes, { applyOperators: true })
```

**DCC Impact**: ✅ FIXED - Mocks and tests updated to use `applyOperators`.

### mergeObject: -=key syntax → ForcedDeletion operator

The `-=key` deletion syntax in `mergeObject` is deprecated. Use `foundry.data.operators.ForcedDeletion` instead.

```javascript
// V13 (deprecated in V14)
foundry.utils.mergeObject(obj, { '-=b': null }, { performDeletions: true })

// V14 (required by V16)
const { ForcedDeletion } = foundry.data.operators
foundry.utils.mergeObject(obj, { b: new ForcedDeletion() }, { applyOperators: true })
```

**DCC Impact**: ✅ FIXED - Mocks and tests updated to use `ForcedDeletion` operator.

## Compatibility Notes

- V14 requires **Node.js 24** (mutually exclusive with V13 which requires earlier Node.js)
- Separate installation and User Data folder recommended for testing
- ~800 new sci-fi themed core icons added in Build 358

## Related Documentation

- [Data Models](DATA_MODELS.md) - template.json migration
- [Active Effects](ACTIVE_EFFECTS.md) - Effect system changes
- [Checklist](CHECKLIST.md) - Migration checklist
- [V13 Breaking Changes](../v13/BREAKING_CHANGES.md) - Ensure V13 migration is complete
