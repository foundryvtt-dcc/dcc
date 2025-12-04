# V14 Migration Checklist

This document provides a checklist for preparing for FoundryVTT V14.

**Note**: V14 is in development. Update this checklist as new information becomes available.

**Last Updated**: December 2024

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
- [ ] Consider creating effects compendium

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

When V14 beta is available:

- [ ] Test system on V14 beta
- [ ] Report any issues to Foundry team
- [ ] Address any new breaking changes
- [ ] Final verification before V14 stable

## Resources

- [FoundryVTT Release Notes](https://foundryvtt.com/releases/)
- [API Migration Guides](https://foundryvtt.com/article/migration/)
- [System Data Models](https://foundryvtt.com/article/system-data-models/)
- [GitHub Issues](https://github.com/foundryvtt/foundryvtt/issues)
- [Discord #dev-support](https://discord.gg/foundryvtt)

## Related Documentation

- [Breaking Changes](BREAKING_CHANGES.md) - Detailed breaking changes
- [Data Models](DATA_MODELS.md) - TypeDataModel migration guide
- [Active Effects](ACTIVE_EFFECTS.md) - Effect system changes
- [V13 Checklist](../v13/CHECKLIST.md) - Ensure V13 migration complete
