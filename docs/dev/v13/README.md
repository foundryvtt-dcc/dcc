# V13 Migration Guide

This directory contains documentation for migrating to FoundryVTT V13 ApplicationV2.

## Quick Start

1. Read [Breaking Changes](BREAKING_CHANGES.md) first to understand what's changed
2. Follow [Migration Basics](MIGRATION_BASICS.md) for initial setup
3. Use the [Checklist](CHECKLIST.md) to track your progress

## Documentation Index

| Document | Description |
|----------|-------------|
| [Breaking Changes](BREAKING_CHANGES.md) | Critical V13 changes: HTML elements, namespaces, hooks, sheet registration |
| [Migration Basics](MIGRATION_BASICS.md) | Class inheritance, DEFAULT_OPTIONS, _prepareContext, choosing base classes |
| [Forms and Events](FORMS_AND_EVENTS.md) | Form submission patterns, actions system, event migration |
| [Tabs](TABS.md) | Tab system configuration, PARTS, template requirements |
| [Drag and Drop](DRAG_DROP.md) | ActorSheetV2 auto-features, manual setup, hybrid approach |
| [Templates](TEMPLATES.md) | ProseMirror editors, template patterns |
| [Themes](THEMES.md) | CSS variables, theme implementation |
| [Checklist](CHECKLIST.md) | Complete migration checklist, examples, troubleshooting |

## Key Concepts

### Base Class Selection

```
ApplicationV2 (Base)         → Configuration dialogs, custom tools
├── DocumentSheetV2          → Journal entries, other documents
│   ├── ActorSheetV2         → Actor character sheets (auto drag/drop)
│   └── ItemSheetV2          → Item editing sheets
└── DialogV2                 → User prompts, confirmations
```

### Critical Changes

1. **HTML Elements**: V13 uses plain DOM elements, not jQuery
2. **Sheet Registration**: Must explicitly register all sheets
3. **CSS Layers**: Existing styles may break; implement theming
4. **Hook Names**: Many hooks renamed (e.g., `renderChatMessage` → `renderChatMessageHTML`)

### Migration Order

1. Update class inheritance and imports
2. Convert `defaultOptions` → `DEFAULT_OPTIONS`
3. Convert `getData()` → `_prepareContext()`
4. Define `PARTS` for templates
5. Convert `activateListeners` → `actions`
6. Update templates with `data-action` attributes
7. Implement theme support

## Related Documentation

- [Architecture](../ARCHITECTURE.md) - System structure
- [Development](../DEVELOPMENT.md) - Commands and workflow
- [Testing](../TESTING.md) - Test suite
