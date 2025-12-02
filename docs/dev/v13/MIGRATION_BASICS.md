# Basic ApplicationV2 Migration

This document covers the fundamental steps for converting V1 applications to V2.

## 1. Change Class Inheritance

**For Actor Sheets:**
```javascript
// V1 (Old)
class DCCActorSheet extends FormApplication {

// V2 (New)
const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

class DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
```

**For Item Sheets:**
```javascript
// V1 (Old)
class DCCItemSheet extends FormApplication {

// V2 (New)
const { HandlebarsApplicationMixin } = foundry.applications.api
const { ItemSheetV2 } = foundry.applications.sheets

class DCCItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
```

**For Dialogs and Config Applications:**
```javascript
// V1 (Old)
class MyDialog extends FormApplication {

// V2 (New)
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class MyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
```

## 2. Convert defaultOptions to DEFAULT_OPTIONS

```javascript
// V1 Pattern (Old)
static get defaultOptions() {
  return foundry.utils.mergeObject(super.defaultOptions, {
    classes: ['dcc', 'sheet', 'actor'],
    template: 'systems/dcc/templates/actor-sheet.html',
    width: 600,
    height: 600,
    resizable: true
  })
}

// V2 Pattern (New)
/** @inheritDoc */
static DEFAULT_OPTIONS = {
  classes: ['dcc', 'sheet', 'actor', 'themed', 'theme-light'], // themed classes are workaround only
  position: {
    width: 600,
    height: 600
  },
  window: {
    resizable: true,
    title: 'DCC.ActorSheetTitle' // Just the localization key
  }
}
```

## 3. Rename getData() to _prepareContext()

```javascript
// V1 Pattern (Old)
getData() {
  const context = super.getData()
  context.data = this.object.system
  context.flags = this.object.flags
  return context
}

// V2 Pattern (New)
async _prepareContext(options) {
  const context = await super._prepareContext(options)
  context.system = this.actor.system  // Note: this.actor for ActorSheetV2
  context.flags = this.actor.flags     // or this.document for ApplicationV2
  return context
}
```

## 4. Define Template Parts

```javascript
/** @inheritDoc */
static PARTS = {
  form: {
    template: 'systems/dcc/templates/dialog-actor-config.html'
  }
}
```

## Choosing the Right Base Class

FoundryVTT V13 provides a hierarchy of v2 application classes:

```
ApplicationV2 (Base)
├── DocumentSheetV2 (Document-specific)
│   ├── ActorSheetV2 (Actor-specific)
│   └── ItemSheetV2 (Item-specific)
└── DialogV2 (Modal dialogs)
```

### ApplicationV2 (Base Class)
**Use for**: Custom applications, configuration dialogs, tools
**Provides**:
- Render state management (NONE, RENDERING, RENDERED, CLOSING, CLOSED, ERROR)
- Window framing and positioning
- Event handling and lifecycle management
- Tab system for multi-panel interfaces
- Action system for declarative event handling
- Form handling with validation

### DocumentSheetV2 (Document Sheets)
**Use for**: Journal entry sheets, other document types
**Extends ApplicationV2 with**:
- Document permissions and ownership checks (`isVisible`, `isEditable`)
- Form submission pipeline with validation
- Header controls (configure sheet, copy UUID, edit image, import from compendium)
- Sheet theming and styling support
- Document update/creation handling

### ActorSheetV2 (Actor Sheets)
**Use for**: Actor character sheets
**Extends DocumentSheetV2 with**:
- **Automatic drag/drop setup** with `.draggable` selector
- Default handlers for items (`data-item-id`) and effects (`data-effect-id`)
- Item sorting within same actor using integer sort algorithm
- Document drop delegation system
- Additional header controls for token/portrait management
- Actor and token getters for convenient access

### ItemSheetV2 (Item Sheets)
**Use for**: Item editing sheets
**Extends DocumentSheetV2 with**:
- Item-specific document handling
- Header controls appropriate for items

### DialogV2 (Modal Dialogs)
**Use for**: User prompts, confirmations, input collection
**Extends ApplicationV2 with**:
- Button-based user interaction with callbacks
- Modal/non-modal display modes
- Keyboard navigation (Enter/Escape handling)
- Factory methods (`confirm()`, `prompt()`, `input()`, `wait()`)
- Promise-based async interaction patterns

### Quick Reference

```javascript
// For actor sheets - use ActorSheetV2
class MyActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // Gets automatic drag/drop, actor-specific features
}

// For item sheets - use ItemSheetV2
class MyItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  // Gets document handling, header controls for items
}

// For configuration dialogs - use ApplicationV2
class MyConfigDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  // Gets basic application features only
}

// For user prompts - use DialogV2
class MyPrompt extends DialogV2 {
  // Gets modal behavior, button handling
}
```

## Related Documentation

- [Breaking Changes](BREAKING_CHANGES.md) - V13 breaking changes
- [Forms and Events](FORMS_AND_EVENTS.md) - Form handling and events
- [Tabs](TABS.md) - Tab system implementation
- [Drag and Drop](DRAG_DROP.md) - Drag and drop patterns
- [Checklist](CHECKLIST.md) - Complete migration checklist
