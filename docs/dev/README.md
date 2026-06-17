# Developer Documentation

This directory contains developer documentation for the DCC system for FoundryVTT.

## Getting Started

1. [Development Guide](DEVELOPMENT.md) - Setup, commands, and workflow
2. [Architecture](ARCHITECTURE.md) - System structure and design

## Core Topics

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System structure, classes, data model, DCC features |
| [Architecture (reimagined)](ARCHITECTURE_REIMAGINED.md) | 7-phase refactor plan splitting Foundry adapter from `dcc-core-lib` engine |
| [Class Decomposition](CLASS_DECOMPOSITION.md) | Per-class component map: which extension API owns schema mixins, sheet parts, defaults, starting items, lib progression, variants |
| [Extension API](EXTENSION_API.md) | Stable / internal / dead surface that sibling modules consume |
| [Development](DEVELOPMENT.md) | Commands, code standards, project structure |
| [Testing](TESTING.md) | Test suite, mocks, writing tests |
| [Pack Management](PACKS.md) | Compendium JSON/LevelDB workflow |
| [Internationalization](I18N.md) | Translation system and guidelines |
| [Programmatic PC Creation](PROGRAMMATIC_ACTOR_CREATION.md) | Why `Actor.create()` produces a partially-configured PC, what's missing, and how quick-PC tooling / test fixtures should fill it |

## Foundry Version References

| Document | Description |
|----------|-------------|
| [V14](V14.md) | V14 reference: data models, Active Effects V2, API changes, new features |
| [V13](V13.md) | ApplicationV2 patterns: base classes, tabs, forms, drag/drop, theming |

## Additional Resources

| Document | Description |
|----------|-------------|
| [Test Coverage](TEST_COVERAGE.md) | Detailed testing strategy and coverage goals |
| [Release Process](RELEASE_PROCESS.md) | How to create releases |
| [Pre-Release Process](PRERELEASE_PROCESS.md) | Foundry-installable test builds off a feature branch (not `main`) |
| [LevelDB Workflow](LEVELDB_WORKFLOW.md) | Detailed pack workflow |
| [Module Conversion](MODULE_CONVERSION.md) | End-to-end guide for converting an adventure module |

## User Documentation

End-user documentation is located in [../user-guide/](../user-guide/), including:
- [Active Effects](../user-guide/Active-Effects.md) - Using effects, attribute keys
- [Two-Weapon Fighting](../user-guide/Two-Weapon-Fighting.md) - DCC rules reference
