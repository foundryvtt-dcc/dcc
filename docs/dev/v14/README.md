# V14 Migration Guide

This directory contains documentation for preparing for FoundryVTT V14.

**Note**: V14 is currently in prototype/development. Expected stable release: January 2026.

## Overview

V14 focuses on several key pillars:
- **Scene Levels** - New framework for multi-level scenes
- **Active Effects V2** - Major improvements to effect handling
- **Scene Regions V2** - MeasuredTemplates absorbed into Scene Regions
- **ProseMirror Improvements** - TinyMCE removed entirely
- **Pop-out Applications** - Render ApplicationV2 in separate browser windows

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

- **Prototype Phase**: Through November 2025
- **Alpha (API Development)**: Following prototypes
- **Beta (User Testing)**: Before stable release
- **Expected Stable**: January 2026

## Resources

- [Official Release Notes](https://foundryvtt.com/releases/)
- [API Migration Guides](https://foundryvtt.com/article/migration/)
- [System Data Models Guide](https://foundryvtt.com/article/system-data-models/)
- [Community Wiki - DataModel](https://foundryvtt.wiki/en/development/api/DataModel)

## Related Documentation

- [V13 Migration Guide](../v13/README.md) - Complete V13 migration first
- [Architecture](../ARCHITECTURE.md) - System structure
