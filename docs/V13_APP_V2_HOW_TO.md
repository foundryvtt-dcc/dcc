# V13 ApplicationV2 Conversion Guide

This guide provides comprehensive instructions for converting FoundryVTT V1 applications (FormApplication) to V2 applications (ApplicationV2/ActorSheetV2) for V13 compatibility.

## Table of Contents

1. [Critical V13 Breaking Changes](#critical-v13-breaking-changes)
2. [Basic ApplicationV2 Migration](#basic-applicationv2-migration)
3. [Form and Dialog Configuration](#form-and-dialog-configuration)
4. [Event System Migration](#event-system-migration)
5. [Tab System Migration](#tab-system-migration)
6. [Drag and Drop Migration](#drag-and-drop-migration)
7. [Template and Editor Migration](#template-and-editor-migration)
8. [Complete Migration Examples](#complete-migration-examples)
9. [Testing and Validation](#testing-and-validation)
10. [Migration Checklist](#migration-checklist)

---

## Critical V13 Breaking Changes

### HTML Element Changes (CRITICAL)

**V12 vs V13 HTML Parameter Change:**
- **V12**: `html` parameters in hooks and `activateListeners()` are **jQuery objects**
- **V13**: `html` parameters are **plain DOM elements** (no jQuery methods)

**Required V13 Conversions:**
```javascript
// V12 jQuery-style (BREAKS in V13)
html.find('.my-button').click(handler)
html.html('<p>Content</p>')
html.addClass('active')

// V13 DOM-style (V13 compatible)
html.querySelector('.my-button').addEventListener('click', handler)
html.innerHTML = '<p>Content</p>'
html.classList.add('active')
```

### Document Update API Changes

```javascript
// V12 Pattern (BREAKS in V13)
this.object.update({ data: { results } })

// V13 Pattern (REQUIRED)
this.object.update({ system: { results } })
```

### Namespace Deprecations

FoundryVTT V13 has moved many global objects into namespaced modules:

**Applications & UX Objects:**
```javascript
// V12 Pattern (Deprecated)
TextEditor.enrichHTML(content)
FilePicker.browse()
renderTemplate('template.html', data)

// V13 Pattern (Required)
foundry.applications.ux.TextEditor.implementation.enrichHTML(content)
foundry.applications.apps.FilePicker.browse()
foundry.applications.handlebars.renderTemplate('template.html', data)
```

**Canvas Objects:**
```javascript
// V12 Pattern (Deprecated)
const ray = new Ray(origin, direction)
NotesLayer.TOGGLE_SETTING

// V13 Pattern (Required)
const ray = new foundry.geometry.Ray(origin, direction)
foundry.canvas.layers.NotesLayer.TOGGLE_SETTING
```

### Hook Name Changes

```javascript
// V12 (deprecated in V13)
Hooks.on('renderChatMessage', (message, html, data) => {
  // html is jQuery object in V12, DOM element in V13
})

// V13 (correct)
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  // html is always a DOM element (not jQuery)
  const messageContent = html.querySelector('.message-content')
})
```

### Sheet Registration Requirement (V13.341)

**CRITICAL**: All systems must explicitly register their sheets:

```javascript
// In your system's init hook
Hooks.once('init', () => {
  // Register Actor sheets
  Actors.registerSheet('dcc', DCCActorSheet, {
    types: ['Player'],
    makeDefault: true,
    label: 'DCC.SheetPlayer'
  })

  // Register Item sheets
  Items.registerSheet('dcc', DCCItemSheet, {
    makeDefault: true,
    label: 'DCC.SheetItem'
  })
})
```

---

## Basic ApplicationV2 Migration

### 1. Change Class Inheritance

**For Actor Sheets:**
```javascript
// V1 (Old)
class DCCActorSheet extends FormApplication {

// V2 (New)
const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

class DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
```

**For Dialogs and Config Applications:**
```javascript
// V1 (Old)
class MyDialog extends FormApplication {

// V2 (New)
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class MyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
```

### 2. Convert defaultOptions to DEFAULT_OPTIONS

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
  classes: ['dcc', 'sheet', 'actor', 'themed', 'theme-light'], // ⚠️ themed classes are workaround only
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

### 3. Rename getData() to _prepareContext()

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

### 4. Define Template Parts

```javascript
/** @inheritDoc */
static PARTS = {
  form: {
    template: 'systems/dcc/templates/dialog-actor-config.html'
  }
}
```

---

## Form and Dialog Configuration

### Form Tag Requirements

**CRITICAL**: Dialogs and forms MUST include `tag: 'form'` in DEFAULT_OPTIONS:

```javascript
static DEFAULT_OPTIONS = {
  tag: 'form',  // REQUIRED for dialogs and forms
  form: {
    submitOnChange: false,
    closeOnSubmit: true
  }
}
```

**Template Requirements**: When using `tag: 'form'`, templates should NOT contain `<form>` elements:

```html
<!-- WRONG: Nested forms are invalid HTML -->
<form class="config-dialog">
  <!-- content -->
</form>

<!-- CORRECT: Use section or div -->
<section class="config-dialog">
  <!-- content -->
</section>
```

### Form Submission Patterns

**Pattern 1: Static Form Handler (Recommended)**
```javascript
static DEFAULT_OPTIONS = {
  tag: 'form',
  form: {
    handler: MyClass.#onSubmitForm,
    closeOnSubmit: true,
    submitOnChange: false
  }
}

/**
 * Handle form submission
 * @this {MyClass}
 * @param {SubmitEvent} event
 * @param {HTMLFormElement} form
 * @param {FormDataExtended} formData
 */
static async #onSubmitForm(event, form, formData) {
  event.preventDefault()
  await this.document.update(formData.object) // Note: formData.object
}
```

**Pattern 2: Instance Method (Legacy Support)**
```javascript
async _updateObject(event, formData) {
  event.preventDefault()
  await this.document.update(formData) // Note: formData directly
}
```

### Constructor Pattern Changes

**CRITICAL**: ApplicationV2 constructor takes ALL parameters in a single options object:

```javascript
// V1 (FormApplication) - WRONG for V2
new DCCActorConfig(this.actor, { position: { ... } })

// V2 (ApplicationV2) - CORRECT
new DCCActorConfig({
  document: this.actor,  // Document goes INSIDE options
  position: { ... }
})
```

### Document Access in V2

```javascript
// In your ApplicationV2 class
get document() {
  return this.options.document  // Document comes from options
}

// Usage in methods
async _prepareContext(options) {
  const context = await super._prepareContext(options)
  context.actor = this.document
  return context
}
```

---

## Event System Migration

### Converting activateListeners to Actions

**V1 Pattern (Old):**
```javascript
activateListeners(html) {
  super.activateListeners(html)
  
  html.find('.ability-label').click(this._onRollAbilityCheck.bind(this))
  html.find('.item-create').click(this._onItemCreate.bind(this))
  html.find('.item-delete').click(this._onItemDelete.bind(this))
}

_onRollAbilityCheck(event) {
  event.preventDefault()
  const ability = event.currentTarget.dataset.ability
  this.actor.rollAbilityCheck(ability)
}
```

**V2 Pattern (New):**
```javascript
static DEFAULT_OPTIONS = {
  actions: {
    rollAbilityCheck: this.#rollAbilityCheck,
    itemCreate: this.#itemCreate,
    itemDelete: this.#itemDelete
  }
}

/**
 * Handle ability check rolls
 * @this {DCCActorSheet}
 * @param {PointerEvent} event
 * @param {HTMLElement} target
 */
static async #rollAbilityCheck(event, target) {
  event.preventDefault()
  const ability = target.dataset.ability
  await this.actor.rollAbilityCheck(ability)
}
```

### Template Changes for Actions

**V1 HTML (Old):**
```html
<span class="ability-label" data-ability="str">Strength</span>
<button class="item-create" data-type="weapon">Create Weapon</button>
```

**V2 HTML (New):**
```html
<span data-action="rollAbilityCheck" data-ability="str">Strength</span>
<button data-action="itemCreate" data-type="weapon">Create Weapon</button>
```

**Key Points:**
- `data-action` value must match the key in the `actions` object
- Other `data-*` attributes are passed to the handler via `target` parameter
- Remove JavaScript-specific classes like `.item-create` - use semantic classes for styling only

### Image Editing Migration

**V1 Pattern (Old):**
```html
<img src="{{img}}" data-edit="img" alt="Portrait">
```

**V2 Pattern (New):**
```html
<img src="{{img}}" data-action="editImage" data-field="img" alt="Portrait">
```

```javascript
static DEFAULT_OPTIONS = {
  actions: {
    editImage: this.#onEditImage
  }
}

static async #onEditImage(event, target) {
  const field = target.dataset.field || "img"
  const current = foundry.utils.getProperty(this.document, field)
  
  const fp = new foundry.applications.apps.FilePicker({
    type: "image",
    current: current,
    callback: (path) => this.document.update({ [field]: path })
  })
  
  fp.render(true)
}
```

---

## Tab System Migration

### Basic Tab Configuration

**V1 Pattern (Old):**
```javascript
static get defaultOptions() {
  return foundry.utils.mergeObject(super.defaultOptions, {
    tabs: [{
      navSelector: '.tabs',
      contentSelector: '.tab-content',
      initial: 'character'
    }]
  })
}
```

**V2 Pattern (New):**
```javascript
static TABS = {
  sheet: {
    tabs: [
      { id: 'character', group: 'sheet', label: 'DCC.Character' },
      { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
      { id: 'notes', group: 'sheet', label: 'DCC.Notes' }
    ],
    initial: 'character'
  }
}

static PARTS = {
  tabs: {
    template: 'systems/dcc/templates/actor-partial-tabs.html'
  },
  character: {
    template: 'systems/dcc/templates/actor-partial-pc-common.html'
  },
  equipment: {
    template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
  },
  notes: {
    template: 'systems/dcc/templates/actor-partial-pc-notes.html'
  }
}
```

### Tab Template Requirements

**CRITICAL**: Tab templates MUST have proper structure:

```html
{{!-- Individual Tab Template --}}
<section class="tab {{tabs.character.id}} {{tabs.character.cssClass}}"
         data-tab="{{tabs.character.id}}"
         data-group="{{tabs.character.group}}">
  {{!-- Tab content here --}}
  <div class="character-details">
    <!-- form fields, etc. -->
  </div>
</section>
```

**Required Elements:**
- Root element must have `tab` CSS class
- Must include `data-tab="{{tabs.tabId.id}}"` and `data-group="{{tabs.tabId.group}}"`
- Must include `{{tabs.tabId.cssClass}}` for dynamic CSS classes
- Use `<section>` or `<div>` (never `<form>` inside a form)

### Dynamic Tab Configuration

For applications where tabs vary based on document type:

```javascript
_getTabsConfig(group) {
  const tabs = foundry.utils.deepClone(super._getTabsConfig(group))
  
  // Modify tabs based on document properties
  if (this.document.type === 'weapon') {
    tabs.tabs.push({ id: 'combat', group: 'sheet', label: 'DCC.Combat' })
  }
  
  return tabs
}
```

### ⚠️ CSS Warning for Tabs

**Problem**: If parent elements have `display: grid` or `display: flex`, ALL tabs will be visible at once.

**Solution**: Never set `display` properties on elements that directly contain tabs:

```css
/* WRONG - Breaks tab switching */
.sheet-body { display: grid; }

/* CORRECT - Apply to inner elements */
.tab-content-wrapper { /* no display here */ }
.character-grid { display: grid; }
```

---

## Drag and Drop Migration

V2 requires manual initialization and binding of drag/drop handlers.

### V1 vs V2 Comparison

**V1 Pattern (Old):**
```javascript
static get defaultOptions() {
  return foundry.utils.mergeObject(super.defaultOptions, {
    dragDrop: [{ dragSelector: '.item', dropSelector: '.item-list' }]
  })
}
// Handlers were bound automatically
```

**V2 Pattern (New):**
```javascript
const { DragDrop } = foundry.applications.ux

class MyAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    dragDrop: [{
      dragSelector: '[data-drag="true"]',
      dropSelector: '.drop-zone'
    }]
  }
  
  constructor(options = {}) {
    super(options)
    this.#dragDrop = this.#createDragDropHandlers()
  }
  
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      }
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        drop: this._onDrop.bind(this)
      }
      return new DragDrop(d)
    })
  }
  
  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element))
  }
  
  _canDragStart(selector) {
    return this.document.isOwner && this.isEditable
  }
  
  _canDragDrop(selector) {
    return this.document.isOwner && this.isEditable
  }
}
```

### Template Requirements

Add `data-drag="true"` to draggable elements:

```html
<ol class="items">
  {{#each items}}
  <li data-drag="true" data-item-id="{{this.id}}">{{this.name}}</li>
  {{/each}}
</ol>
```

---

## Template and Editor Migration

### ProseMirror Editor Migration

**V12 Pattern (Deprecated):**
```handlebars
{{editor corruptionHTML target="system.class.corruption" engine="prosemirror" button=true editable=editable}}
```

**V13 Pattern (Required):**
```handlebars
{{#if editable}}
  <prose-mirror
    name="system.class.corruption"
    button="true"
    editable="{{editable}}"
    toggled="false"
    value="{{system.class.corruption}}">
    {{{corruptionHTML}}}
  </prose-mirror>
{{else}}
  {{{corruptionHTML}}}
{{/if}}
```

### Context Preparation for Editors

```javascript
async _prepareContext(options) {
  const context = await super._prepareContext(options)
  
  // Enrich content for display
  context.corruptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
    this.document.system.class.corruption,
    {
      secrets: this.document.isOwner,
      relativeTo: this.document
    }
  )
  
  return context
}
```

### Static Initializer Configuration Issue

**CRITICAL**: Cannot use CONFIG values in static field initializers:

```javascript
// ❌ BROKEN - CONFIG.DCC is undefined during static initialization
static PARTS = {
  form: {
    template: CONFIG.DCC.templates.rollModifierDialog // ERROR
  }
}

// ✅ WORKING - Hard-coded template path
static PARTS = {
  form: {
    template: 'systems/dcc/templates/dialog-roll-modifiers.html'
  }
}
```

---

## Complete Migration Examples

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
    position: { width: 380, height: 'auto' },
    window: { title: 'DCC.SheetConfig', resizable: false },
    form: {
      handler: DCCActorConfig.#onSubmitForm,
      closeOnSubmit: true
    }
  }
  
  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-actor-config.html'
    }
  }
  
  get document() {
    return this.options.document
  }
  
  get title() {
    return `${this.document.name}: ${game.i18n.localize('DCC.SheetConfig')}`
  }
  
  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    context.config = CONFIG.DCC
    context.actor = this.document
    return context
  }
  
  static async #onSubmitForm(event, form, formData) {
    event.preventDefault()
    await this.document.update(formData.object)
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

See the complete examples in the original sections above for detailed implementations.

---

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

---

## Migration Checklist

### Pre-Migration Setup
- [ ] Set up visual regression testing environment
- [ ] Take baseline screenshots of all components
- [ ] Create backup of V1 implementation

### Core Migration Steps
- [ ] **CRITICAL: Register all actor and item sheets explicitly**
- [ ] Update class inheritance (FormApplication → ApplicationV2)
- [ ] Convert `defaultOptions` to `DEFAULT_OPTIONS`
- [ ] Add `tag: 'form'` to DEFAULT_OPTIONS for dialogs
- [ ] Move dimensions to `position` object
- [ ] Move window properties to `window` object
- [ ] Rename `getData()` to `_prepareContext()`
- [ ] Define `PARTS` for templates

### Event System Migration
- [ ] Convert `activateListeners` to `actions`
- [ ] Change event handler methods from `_` prefix to `#` prefix
- [ ] Update HTML templates to use `data-action` attributes
- [ ] Test all interactive elements

### Tab System Migration
- [ ] Split monolithic templates into separate tab templates
- [ ] Define TABS configuration
- [ ] Implement `_getTabsConfig()` if tabs are dynamic
- [ ] Test tab switching functionality

### Advanced Features
- [ ] Convert drag/drop to manual initialization pattern
- [ ] Migrate `{{editor}}` helpers to `<prose-mirror>` elements
- [ ] Update image editing to use actions
- [ ] Replace jQuery with vanilla JS in hooks

### V13 Compatibility
- [ ] Replace deprecated namespace references
- [ ] Update hook names (renderChatMessage → renderChatMessageHTML)
- [ ] Fix static initializer CONFIG references
- [ ] Test with CSS Layers compatibility

### Final Validation
- [ ] Run visual regression tests
- [ ] Test all functionality end-to-end
- [ ] Verify performance is acceptable
- [ ] Test in multiple browsers
- [ ] Document any remaining workarounds

---

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

This guide provides a comprehensive roadmap for migrating to V13 ApplicationV2. Follow the sections in order for a systematic migration approach.