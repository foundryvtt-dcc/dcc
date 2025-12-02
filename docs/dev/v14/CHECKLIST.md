# V14 Migration Checklist

This document provides a checklist for preparing for FoundryVTT V14.

**Note**: V14 is in development. Update this checklist as new information becomes available.

## Prerequisites

- [ ] Complete [V13 migration](../v13/CHECKLIST.md) first
- [ ] All sheets using ApplicationV2
- [ ] All templates using ProseMirror (not TinyMCE)
- [ ] Running on latest V13 stable

## Critical: Data Model Migration

### Assess Current State

- [ ] Review current `template.json` structure
- [ ] Identify all Actor types and their schemas
- [ ] Identify all Item types and their schemas
- [ ] Document any computed/derived fields

### Create TypeDataModel Classes

- [ ] Create `module/data/` directory for data models
- [ ] Implement TypeDataModel for each Actor type:
  - [ ] `PlayerData` extends `TypeDataModel`
  - [ ] `NPCData` extends `TypeDataModel`
- [ ] Implement TypeDataModel for each Item type:
  - [ ] `WeaponData`
  - [ ] `AmmunitionData`
  - [ ] `ArmorData`
  - [ ] `EquipmentData`
  - [ ] `SpellData`
  - [ ] `SkillData`
  - [ ] `LevelData`
  - [ ] `MountData`
  - [ ] `TreasureData`

### Register Data Models

- [ ] Register all Actor data models in `CONFIG.Actor.dataModels`
- [ ] Register all Item data models in `CONFIG.Item.dataModels`
- [ ] Verify registration happens in `init` hook

### Test Data Models

- [ ] Create new actors/items of each type
- [ ] Verify default values are correct
- [ ] Test derived data calculations
- [ ] Verify existing world data loads correctly

### Implement Migrations

- [ ] Add `migrateData()` for any schema changes
- [ ] Test migration with legacy data
- [ ] Document migration paths

## Active Effects

### Immediate (Do in V13)

- [ ] Set `CONFIG.ActiveEffect.legacyTransferral = false`
- [ ] Test all effects still work correctly
- [ ] Fix any effects relying on legacy behavior

### Before V14

- [ ] Audit effect origins for valid UUIDs
- [ ] Review effect change modes used
- [ ] Update any custom effect value parsing
- [ ] Consider creating effects compendium

## Breaking Changes

### DataModel Operations

- [ ] Search codebase for `-=` in updateSource calls
- [ ] Search codebase for `==` in updateSource calls
- [ ] Replace with new DataFieldOperator values (when documented)

### Null Checks

- [ ] Add null checks for `game.activeTool`
- [ ] Add null checks for `SceneControls#tool`

### parseHTML Changes

- [ ] Update code checking for `undefined` from parseHTML
- [ ] Change to check for `null` instead

### Renamed APIs

- [ ] Replace `RegionPolygonTree` → `foundry.data.PolygonTree`
- [ ] Replace `RegionShape` usage with BaseShapeData mixins
- [ ] Update `foundry.prosemirror.defaultPlugins` → `ProseMirrorEditor.buildDefaultPlugins()`

## Editor Migration

### TinyMCE Removal

- [ ] Verify no TinyMCE references in codebase
- [ ] Confirm all editors use ProseMirror
- [ ] Test all rich text fields

## Testing

### Functional Testing

- [ ] Test all Actor sheet functionality
- [ ] Test all Item sheet functionality
- [ ] Test Active Effects application
- [ ] Test drag and drop operations
- [ ] Test all roll mechanics

### Data Integrity

- [ ] Test loading existing world data
- [ ] Verify no data loss after migration
- [ ] Test with various world sizes

### Performance

- [ ] Benchmark document creation
- [ ] Benchmark document updates
- [ ] Compare with V13 performance

## Documentation

- [ ] Update system documentation
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
