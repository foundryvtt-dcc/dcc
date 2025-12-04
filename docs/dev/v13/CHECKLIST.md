# Migration Checklist

This document provides a complete checklist for migrating to V13 ApplicationV2, along with examples and troubleshooting.

## Complete Migration Example

### Basic Dialog Migration

**Before (V1):**
```javascript
class DCCActorConfig extends FormApplication {
  static get defaultOptions() {
    const options = super.defaultOptions
    options.template = 'systems/dcc/templates/dialog-actor-config.html'
    options.width = 380
    return options
  }

  get title() {
    return `${this.object.name}: ${game.i18n.localize('DCC.SheetConfig')}`
  }

  getData() {
    const data = this.object
    data.config = CONFIG.DCC
    return data
  }

  async _updateObject(event, formData) {
    await this.object.update(formData)
  }
}
```

**After (V2):**
```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class DCCActorConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor-config'],
    tag: 'form',
    position: { width: 420, height: 'auto' },
    window: { title: 'DCC.SheetConfig', resizable: false },
    form: {
      handler: DCCActorConfig.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-actor-config.html'
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const actor = this.options.document

    context.config = CONFIG.DCC
    context.system = actor.system
    context.actor = actor
    return context
  }

  static async #onSubmitForm(event, form, formData) {
    event.preventDefault()
    await this.options.document.update(formData.object)
    // Re-draw the updated sheet
    await this.options.document.sheet.render(true)
  }
}
```

### Actor Sheet with Tabs Migration

**Key Changes:**
1. Split single template into multiple tab templates
2. Define PARTS for each template
3. Define TABS configuration
4. Convert event handlers to actions
5. Update HTML templates with data-action attributes

## Testing and Validation

### Visual Regression Testing

**Setup Process:**
1. Take baseline screenshots of all V1 components
2. Migrate components one by one
3. Compare V2 screenshots with baselines
4. Fix any visual regressions

**Components to Test:**
- Actor sheets (all character classes and tabs)
- Item sheets (all item types)
- Configuration dialogs
- Chat cards and roll results

### Functional Testing

**Critical Areas:**
- Form submission and data saving
- Tab switching functionality
- Event handler responses (clicks, changes)
- Drag and drop operations
- Image editing
- Rich text editor functionality

### Performance Testing

Monitor rendering performance and ensure V2 implementations don't regress performance compared to V1.

## Pre-Migration Setup
- [x] Set up visual regression testing environment
- [x] Take baseline screenshots of all components
- [x] Create backup of V1 implementation

## Core Migration Steps
- [x] **CRITICAL: Register all actor and item sheets explicitly**
- [x] **Choose correct base class**:
  - [x] ActorSheetV2 for actor sheets (automatic drag/drop)
  - [x] ItemSheetV2 for item sheets (document features)
  - [x] ApplicationV2 for configuration dialogs (basic features)
  - [x] DialogV2 for user prompts (modal behavior)
- [x] Update class inheritance (FormApplication → chosen V2 class)
- [x] Convert `defaultOptions` to `DEFAULT_OPTIONS`
- [x] Add `tag: 'form'` to DEFAULT_OPTIONS for dialogs
- [x] Move dimensions to `position` object
- [x] Move window properties to `window` object
- [x] Rename `getData()` to `_prepareContext()`
- [x] Define `PARTS` for templates

## Event System Migration
- [x] Convert `activateListeners` to `actions`
- [x] Change event handler methods from `_` prefix to `#` prefix
- [x] Update HTML templates to use `data-action` attributes
- [x] Test all interactive elements

## Tab System Migration
- [x] Split monolithic templates into separate tab templates
- [x] Define TABS configuration
- [x] Implement `_getTabsConfig()` if tabs are dynamic
- [x] Test tab switching functionality

## Advanced Features
- [x] **Implement drag/drop appropriately**:
  - [x] ActorSheetV2: Use `.draggable` class for automatic item/effect dragging
  - [x] ActorSheetV2: Add custom drag types if needed (like DCC system)
  - [x] ApplicationV2: Manual DragDrop setup required
  - [x] DocumentSheetV2: Usually no drag/drop needed
- [x] Migrate `{{editor}}` helpers to `<prose-mirror>` elements
- [x] **Update image editing to use inherited editImage** (RECOMMENDED):
  - [x] Remove custom `#editImage` methods
  - [x] Update actions to reference `YourSheetClass.editImage` instead of `this.#editImage`
  - [x] Update templates to use `data-action="editImage"` and `data-edit="img"`
- [x] Replace jQuery with vanilla JS in hooks
- [x] **Consider using DialogV2 factory methods** for simple prompts

## Theme Implementation
- [x] Create variables.css file with CSS custom properties
- [x] Add variables.css to system.json with "variables" layer
- [x] Define both light and dark theme variables
- [x] Update primary stylesheet to use variables instead of hard-coded values
- [x] Use `system-` prefix for all custom CSS variables
- [x] Test theme switching functionality
- [x] Verify proper contrast ratios in both themes
- [x] Check for opacity/layering issues

## V13 Compatibility
- [x] Replace deprecated namespace references
- [x] Update hook names (renderChatMessage → renderChatMessageHTML)
- [x] Fix static initializer CONFIG references
- [x] Test with CSS Layers compatibility

## Final Validation
- [x] Run visual regression tests
- [x] Test all functionality end-to-end
- [x] **Test drag/drop operations specifically** (ActorSheetV2 auto-features)
- [x] **Test dialog interactions** (DialogV2 factory methods)
- [x] Verify performance is acceptable
- [x] Test in multiple browsers
- [x] Test theme switching in multiple browsers
- [x] Document any remaining workarounds

## Common Issues and Solutions

### Dialog Not Opening
**Cause**: Incorrect constructor pattern
**Solution**: Use `new Dialog({ document: actor })` not `new Dialog(actor, {})`

### All Tabs Visible
**Cause**: CSS display properties on tab containers
**Solution**: Move display properties to inner wrapper elements

### Actions Not Working
**Cause**: Missing or incorrect `data-action` attributes
**Solution**: Ensure `data-action` value matches actions object key exactly

### Form Not Submitting
**Cause**: Missing `tag: 'form'` or nested form elements
**Solution**: Add `tag: 'form'` to DEFAULT_OPTIONS and remove `<form>` from templates

### CONFIG Undefined Errors
**Cause**: Using CONFIG in static initializers
**Solution**: Hard-code template paths or use getter methods

### Drag/Drop Not Working
**Cause**: Missing manual setup for ApplicationV2 or wrong selector for ActorSheetV2
**Solution**:
- For ActorSheetV2: Ensure elements have `class="draggable"` and `data-item-id`
- For ApplicationV2: Implement full manual DragDrop setup

### Items Not Saving on Actor Sheet
**Cause**: ApplicationV2 strips nested item data from form submission
**Solution**: Override `_processFormData` and `_processSubmitData` to handle items separately

### Theme Not Applying
**Cause**: Missing CSS layer configuration or wrong variable names
**Solution**: Add `"layer": "variables"` to system.json and use `system-` prefix for variables

## Related Documentation

- [Breaking Changes](BREAKING_CHANGES.md) - V13 breaking changes
- [Migration Basics](MIGRATION_BASICS.md) - Class inheritance and setup
- [Forms and Events](FORMS_AND_EVENTS.md) - Form handling and events
- [Tabs](TABS.md) - Tab system implementation
- [Drag and Drop](DRAG_DROP.md) - Drag and drop patterns
- [Templates](TEMPLATES.md) - Template migration patterns
- [Themes](THEMES.md) - CSS variables and theming
