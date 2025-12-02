# Developer Documentation

This directory contains developer documentation for the DCC system for FoundryVTT.

## Getting Started

1. [Development Guide](DEVELOPMENT.md) - Setup, commands, and workflow
2. [Architecture](ARCHITECTURE.md) - System structure and design

## Core Topics

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System structure, classes, data model, DCC features |
| [Development](DEVELOPMENT.md) | Commands, code standards, project structure |
| [Testing](TESTING.md) | Test suite, mocks, writing tests |
| [Pack Management](PACKS.md) | Compendium JSON/LevelDB workflow |
| [Internationalization](I18N.md) | Translation system and guidelines |

## V13 Migration

The [v13/](v13/) directory contains comprehensive documentation for migrating to FoundryVTT V13:

| Document | Description |
|----------|-------------|
| [v13/README](v13/README.md) | V13 migration overview and quick start |
| [v13/Breaking Changes](v13/BREAKING_CHANGES.md) | Critical V13 changes |
| [v13/Migration Basics](v13/MIGRATION_BASICS.md) | ApplicationV2 conversion basics |
| [v13/Forms and Events](v13/FORMS_AND_EVENTS.md) | Form handling and actions |
| [v13/Tabs](v13/TABS.md) | Tab system migration |
| [v13/Drag and Drop](v13/DRAG_DROP.md) | Drag/drop patterns |
| [v13/Templates](v13/TEMPLATES.md) | Template migration patterns |
| [v13/Themes](v13/THEMES.md) | CSS variables and theming |
| [v13/Checklist](v13/CHECKLIST.md) | Migration checklist |

## V14 Preparation (Preview)

The [v14/](v14/) directory contains documentation for preparing for FoundryVTT V14 (expected January 2026):

| Document | Description |
|----------|-------------|
| [v14/README](v14/README.md) | V14 overview and timeline |
| [v14/Breaking Changes](v14/BREAKING_CHANGES.md) | V14 breaking changes |
| [v14/Data Models](v14/DATA_MODELS.md) | template.json → TypeDataModel migration |
| [v14/Migration Plan](v14/MIGRATION_PLAN.md) | Detailed DCC migration plan with code |
| [v14/Active Effects](v14/ACTIVE_EFFECTS.md) | Active Effects V2 changes |
| [v14/Checklist](v14/CHECKLIST.md) | Preparation checklist |

## Additional Resources

| Document | Description |
|----------|-------------|
| [Test Coverage](TEST_COVERAGE.md) | Detailed testing strategy and coverage goals |
| [Release Process](RELEASE_PROCESS.md) | How to create releases |
| [LevelDB Workflow](LEVELDB_WORKFLOW.md) | Detailed pack workflow |

## User Documentation

End-user documentation is located in [../user-guide/](../user-guide/), including:
- [Active Effects](../user-guide/Active-Effects.md) - Using effects, attribute keys
- [Two-Weapon Fighting](../user-guide/Two-Weapon-Fighting.md) - DCC rules reference
