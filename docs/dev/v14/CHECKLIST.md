# V14 Migration Checklist

This document provides a checklist for preparing for FoundryVTT V14.

**Current Status**: Stable 1 (Build 359)

**Last Updated**: April 2026

## Prerequisites

- [x] Complete [V13 migration](../v13/CHECKLIST.md) first
- [x] All sheets using ApplicationV2
- [x] All templates using ProseMirror (not TinyMCE)
- [x] Running on latest V13 stable

## Critical: Data Model Migration

### Assess Current State

- [x] Review current `template.json` structure
- [x] Identify all Actor types and their schemas (Player, NPC, Party)
- [x] Identify all Item types and their schemas (9 types)
- [x] Document any computed/derived fields

### Create TypeDataModel Classes

- [x] Create `module/data/` directory for data models
- [x] Create reusable field types in `module/data/fields/`:
  - [x] `AbilityField` - ability scores with spent/damage tracking
  - [x] `CurrencyField` - pp, ep, gp, sp, cp
  - [x] `DiceField` - dice notation with validation
  - [x] `SaveField` - saving throws with bonuses
- [x] Implement TypeDataModel for each Actor type:
  - [x] `BaseActorData` - common fields shared by all actors
  - [x] `PlayerData` extends `BaseActorData` - class fields, skills, config
  - [x] `NPCData` extends `BaseActorData` - with NPC-specific overrides
  - [x] `PartyData` extends `BaseActorData`
- [x] Implement TypeDataModel for each Item type:
  - [x] `BaseItemData` - description fields
  - [x] `PhysicalItemData` extends `BaseItemData` - quantity, weight, equipped
  - [x] `WeaponData` extends `PhysicalItemData`
  - [x] `AmmunitionData` extends `PhysicalItemData`
  - [x] `ArmorData` extends `PhysicalItemData`
  - [x] `EquipmentData` extends `PhysicalItemData`
  - [x] `MountData` extends `PhysicalItemData`
  - [x] `SpellData` extends `BaseItemData`
  - [x] `SkillData` extends `BaseItemData`
  - [x] `LevelData` extends `TypeDataModel`
  - [x] `TreasureData` extends `BaseItemData`

### Register Data Models

- [x] Register all Actor data models in `CONFIG.Actor.dataModels`
- [x] Register all Item data models in `CONFIG.Item.dataModels`
- [x] Verify registration happens in `init` hook (module/dcc.js:70-88)

### Remove template.json

- [x] Add `documentTypes` to `system.json` with all Actor and Item types
- [x] Delete `template.json` file

### Test Data Models

- [x] Create new actors/items of each type
- [x] Verify default values are correct
- [x] Test derived data calculations
- [x] Verify existing world data loads correctly
- [x] E2E tests added in `browser-tests/e2e/data-models.spec.js`

### Implement Migrations

- [x] Add `migrateData()` for any schema changes in each data model class
- [x] Test migration with legacy data
- [x] Document migration paths (handled in data model classes)

## Active Effects

### Immediate (Do in V13)

- [x] Set `CONFIG.ActiveEffect.legacyTransferral = false` (module/dcc.js:68)
- [x] Test all effects still work correctly
- [x] Fix any effects relying on legacy behavior

### Before V14

- [ ] Audit effect origins for valid UUIDs
- [x] Review effect change modes used (migrated to string types in actor.js)
- [ ] Update any custom effect value parsing
- [x] Create effects compendium (48 effects in packs/dcc-effects)

## Breaking Changes

### DataModel Operations

- [x] Search codebase for `-=` in updateSource calls (none found in production code)
- [x] Search codebase for `==` in updateSource calls (none found)
- [x] Replace with new DataFieldOperator values (not needed - no usage found)

### Null Checks

- [x] Add null checks for `game.activeTool` (not used)
- [x] Add null checks for `SceneControls#tool` (not used)

### parseHTML Changes

- [x] Update code checking for `undefined` from parseHTML (not used)
- [x] Change to check for `null` instead (not used)

### Renamed APIs

- [x] Replace `RegionPolygonTree` → `foundry.data.PolygonTree` (not used)
- [x] Replace `RegionShape` usage with BaseShapeData mixins (not used)
- [x] Update `foundry.prosemirror.defaultPlugins` → `ProseMirrorEditor.buildDefaultPlugins()` (not used)
- [x] Update `foundry.utils.objectsEqual` → `foundry.utils.equals()` (not used directly)

### New in Developer 1

- [x] Check for TextureData `offsetX/Y` and `rotation` usage (not used)
- [x] Check for `Macro#author` null handling (not used)
- [x] Check for Wall `isDoor`/`isOpen` on placeable (should use WallDocument)
- [x] Check for Boolean values in Rolls (auto-converted to numbers)

### New in User Testing 2 (Build 357)

- [x] Check for `TokenFindMovementPathOptions#ignoreWalls/ignoreCost/history` usage (not used - replaced by `constrainOptions`)
- [x] Check for token dimension label assumptions (renamed to Size X/Y/Z)

### New in User Testing 3 (Build 358)

- [ ] Check custom `SceneControlTool` registrations in `dcc.js` (Fleeting Luck and Spell Duel buttons - may need `interaction`, `control`, `creation` properties)
- [x] V14 requires Node.js 24 (note: mutually exclusive with V13)

### V14 Deprecations (Removed in V16)

- [x] Replace `CONST.DICE_ROLL_MODES` with `CONFIG.ChatMessage.modes` (production code unaffected, tests fixed)
- [x] Replace `performDeletions` with `applyOperators` in `mergeObject` calls (mocks and tests fixed)
- [x] Replace `-=key` deletion syntax with `ForcedDeletion` operator (mocks and tests fixed)
- [x] Replace `ChatMessage.applyRollMode` with `ChatMessage.applyMode` (actor.js, spell-result.js)
- [x] Replace `game.settings.get('core', 'rollMode')` with `game.settings.get('core', 'messageMode')` (actor.js)
- [x] Replace `rollMode` option with `messageMode` in `Roll.toMessage()` calls (spell-result.js)

## Editor Migration

### TinyMCE Removal

- [x] Verify no TinyMCE references in codebase
- [x] Confirm all editors use ProseMirror
- [x] Test all rich text fields

## Testing

### Functional Testing

- [x] Test all Actor sheet functionality
- [x] Test all Item sheet functionality
- [x] Test Active Effects application
- [x] Test drag and drop operations
- [x] Test all roll mechanics

### Data Integrity

- [x] Test loading existing world data
- [x] Verify no data loss after migration
- [ ] Test with various world sizes

### Performance

- [ ] Benchmark document creation
- [ ] Benchmark document updates
- [ ] Compare with V13 performance

## Documentation

- [x] Update system documentation
- [ ] Document any breaking changes for users
- [ ] Update changelog

## Pre-Release Testing

### Prototype/Developer/User Testing Builds

- [x] Test system on V14 Prototype 1 (Build 349)
- [x] Test system on V14 Developer 1 (Build 354)
- [x] Test system on V14 User Testing 2 (Build 357)
- [x] Test system on V14 User Testing 3 (Build 358)
- [x] Report any issues to Foundry team
- [x] Monitor future releases for new breaking changes

### V14 Stable Release

- [x] V14 Stable 1 (Build 359) released April 1, 2026
- [ ] Test system on V14 Stable 1 (Build 359)
- [ ] Address any new breaking changes from stable
- [ ] Final verification on stable
- [ ] Update minimum/verified compatibility in system.json

## Scene Levels (New Feature)

- [ ] Evaluate Scene Levels support for DCC
- [ ] Consider multi-level dungeon support
- [ ] Test token behavior across levels

## Resources

- [FoundryVTT Release Notes](https://foundryvtt.com/releases/)
- [V14 Prototype 1](https://foundryvtt.com/releases/14.349)
- [V14 Developer 1](https://foundryvtt.com/releases/14.354)
- [V14 User Testing 2](https://foundryvtt.com/releases/14.357)
- [V14 User Testing 3](https://foundryvtt.com/releases/14.358)
- [V14 Stable 1](https://foundryvtt.com/releases/14.359)
- [API Migration Guides](https://foundryvtt.com/article/migration/)
- [System Data Models](https://foundryvtt.com/article/system-data-models/)
- [GitHub Issues](https://github.com/foundryvtt/foundryvtt/issues)
- [Discord #dev-support](https://discord.gg/foundryvtt)

## Related Documentation

- [Breaking Changes](BREAKING_CHANGES.md) - Detailed breaking changes
- [Data Models](DATA_MODELS.md) - TypeDataModel migration guide
- [Active Effects](ACTIVE_EFFECTS.md) - Effect system changes
- [V13 Checklist](../v13/CHECKLIST.md) - Ensure V13 migration complete
