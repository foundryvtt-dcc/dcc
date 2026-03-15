# V14 Migration Guide

This directory contains documentation for preparing for FoundryVTT V14.

**Current Status**: Developer 1 (Build 354) released. API development phase.

## Overview

V14 focuses on several key pillars:
- **Scene Levels** - Vertically stacking multiple images inside a single scene at defined elevations
- **Active Effects V2** - Promoted to primary documents, compendium storage, token drop support
- **Scene Regions V2** - MeasuredTemplates absorbed into Scene Regions, enhanced shape editing
- **ProseMirror Only** - TinyMCE entirely removed (external integration API available for modules)
- **Pop-out Applications** - Render ApplicationV2 in separate browser windows
- **Performance Improvements** - Significant DataModel and document operation speedups
- **Placeables Palette** - Bulk-editing canvas objects (technical preview)

## Quick Start

1. Read [Breaking Changes](BREAKING_CHANGES.md) to understand what's changing
2. Review [Data Models](DATA_MODELS.md) if you're still using template.json
3. Check [Active Effects](ACTIVE_EFFECTS.md) for effect-related changes
4. Use the [Checklist](CHECKLIST.md) to track your preparation

## Documentation Index

| Document | Description |
|----------|-------------|
| [Breaking Changes](BREAKING_CHANGES.md) | V14 breaking changes and deprecation removals |
| [Data Models](DATA_MODELS.md) | Migrating from template.json to TypeDataModel |
| [Migration Plan](MIGRATION_PLAN.md) | Detailed DCC system migration plan with code examples |
| [Active Effects](ACTIVE_EFFECTS.md) | Active Effects V2 changes |
| [Checklist](CHECKLIST.md) | Migration preparation checklist |

## Key Changes Summary

### Critical: template.json Deprecation
The legacy `template.json` specification is deprecated. Systems must migrate to `TypeDataModel` for schema definition.

### V12 Deprecations Removed
Many V12-era deprecations have been retired in V14. See [Breaking Changes](BREAKING_CHANGES.md) for details.

### Active Effects Changes
- `CONFIG.ActiveEffect.legacyTransferral` removed (was deprecated since V11)
- `ActiveEffect#origin` is now a `DocumentUUIDField`
- Effects can be stored in Compendiums independently
- New application phases for precise timing

### TinyMCE Removal
TinyMCE is fully removed in V14. Only ProseMirror editor is available.

## Timeline

- **Prototype 1**: Build 349 - Core API changes, Active Effects V2, Pop-out Apps
- **Developer 1**: Build 354 (Current) - Scene Levels, TinyMCE removal, Placeables Palette
- **Future**: Scene Objects Sidebar, Measured Templates redesign
- **Alpha (API Development)**: Following developer builds
- **Beta (User Testing)**: Before stable release
- **Expected Stable**: 2026

## Resources

- [Official Release Notes](https://foundryvtt.com/releases/)
- [V14 Prototype 1 Notes](https://foundryvtt.com/releases/14.349)
- [V14 Developer 1 Notes](https://foundryvtt.com/releases/14.354)
- [V14 Breaking Changes Board](https://github.com/orgs/foundryvtt/projects/67/views/8)
- [API Migration Guides](https://foundryvtt.com/article/migration/)
- [System Data Models Guide](https://foundryvtt.com/article/system-data-models/)
- [Community Wiki - DataModel](https://foundryvtt.wiki/en/development/api/DataModel)

## Related Documentation

- [V13 Migration Guide](../v13/README.md) - Complete V13 migration first
- [Architecture](../ARCHITECTURE.md) - System structure
