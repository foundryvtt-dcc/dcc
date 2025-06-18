# V13 ApplicationV2 Conversion Guide

This guide provides step-by-step instructions for converting Foundry V1 applications (FormApplication) to V2 applications (ApplicationV2/ActorSheetV2).

## CRITICAL V13 Breaking Change: HTML Elements

**Foundry V12 vs V13 HTML Parameter Change:**
- **V12**: `html` parameters in hooks, `activateListeners()`, and chat functions are **jQuery objects**
- **V13**: `html` parameters are **plain DOM elements** (no jQuery methods)

**This affects ALL of these patterns:**
- `html.find('.selector')` ❌ (breaks in V13)
- `html.html(content)` ❌ (breaks in V13) 
- `html.addClass('class')` ❌ (breaks in V13)
- `html.removeClass('class')` ❌ (breaks in V13)
- `html.attr('attribute')` ❌ (breaks in V13)

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

## V13 API Deprecations and Breaking Changes

### Document Update API Changes ❌ **CRITICAL**

**V12 Pattern (BREAKS in V13):**
```javascript
// Using 'data:' parameter for system data updates
this.object.update({
  data: { results }
})
```

**V13 Pattern (REQUIRED):**
```javascript
// Use 'system:' parameter instead of 'data:'
this.object.update({
  system: { results }
})
```

### Package API Changes

Several Package properties have been renamed in V13:

**Deprecated → Replacement:**
- `Package#name` → `Package#id`
- `Package#minimumCoreVersion` → `Package#compatibility.minimum`
- `Package#dependencies` → `Package#relationships.requires`
- `Package#system` → `Package#relationships.systems`
- `Package#media.link` → `Package#media.url`
- `Package#packs.entity` → `Package#packs.type`
- `Package#packs.private` → `Package#packs.ownership`

### renderTemplate Namespacing ❌ **CRITICAL**

**V12 Pattern (BREAKS in V13):**
```javascript
// Global renderTemplate is deprecated in V13
messageData.content = await renderTemplate('systems/dcc/templates/chat-card.html', data)
```

**V13 Pattern (REQUIRED):**
```javascript
// Use namespaced foundry.applications.handlebars.renderTemplate
messageData.content = await foundry.applications.handlebars.renderTemplate('systems/dcc/templates/chat-card.html', data)
```

**Alternative Pattern (Cleaner):**
```javascript
// Import at top of file for cleaner code
const { renderTemplate } = foundry.applications.handlebars

// Then use normally
messageData.content = await renderTemplate('systems/dcc/templates/chat-card.html', data)
```

**Why This Matters:**
- **V13 Breaking Change**: Global `renderTemplate` shows deprecation warnings and will be removed in V15
- **All Template Rendering**: Affects any code that renders templates outside of ApplicationV2 (chat cards, notifications, etc.)
- **Common Locations**: Actor methods, item methods, chat hooks, and utility functions

**Mock Testing Update:**
When using the namespaced version, update your test mocks:
```javascript
// Add to your foundry mocks
global.foundry = {
  applications: {
    handlebars: {
      renderTemplate: vi.fn((template, data) => { return '' }).mockName('renderTemplate')
    }
  }
}
```

### Document and DataModel Changes

**Document System Data Access:**
```javascript
// V12 (deprecated)
const systemData = document.data.system
Document.hasSystemData

// V13 (correct)
const systemData = document.system
Document.hasTypeData
```

**DataModel Validation:**
```javascript
// V12 (deprecated)
ModelValidationError
DataModel#_validateModel()

// V13 (correct)
DataModelValidationError
DataModel.validateJoint() // now static
```

**System Data Model Configuration:**
```javascript
// V13 uses new configuration structure
CONFIG.Actor.dataModels = {
  character: MyCharacterModel,
  npc: MyNPCModel
}
```

### UUID Resolution Changes

**V12 Pattern (deprecated):**
```javascript
const doc = await fromUuid(uuid, relative)
```

**V13 Pattern (required):**
```javascript
const doc = await fromUuid(uuid, {relative})
```

### Worker Manager Changes

**V12 (deprecated):**
```javascript
WorkerManager#getWorker()
```

**V13 (correct):**
```javascript
WorkerManager#get()
```

### Hook Name Changes

**Chat Message Rendering Hook:**
```javascript
// V12 (deprecated in V13)
Hooks.on('renderChatMessage', (message, html, data) => {
  // html is jQuery object in V12, DOM element in V13
})

// V13 (correct)
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  // html is always a DOM element (not jQuery)
  // Use vanilla JavaScript DOM methods
  const messageContent = html.querySelector('.message-content')
  if (messageContent) {
    messageContent.innerHTML = content
  }
})
```

**Important Notes:**
- `renderChatMessage` is deprecated in V13, use `renderChatMessageHTML` instead
- The `html` parameter is always a plain DOM element (never jQuery) in both hooks in V13
- All jQuery methods (`html.find()`, `html.html()`, etc.) must be replaced with vanilla JavaScript

## 1. Change Class Inheritance

### For Actor Sheets
Replace:
```javascript
class DCCActorSheet extends FormApplication {
```

With:
```javascript
const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

class DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
```

### For Regular Dialogs and Config Applications
Replace:
```javascript
class MyDialog extends FormApplication {
```

With:
```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class MyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
```

## 2. Convert defaultOptions to DEFAULT_OPTIONS

**Important**: Dialogs and forms MUST include `tag: 'form'` in DEFAULT_OPTIONS to function properly.

**⚠️ CRITICAL for Forms**: When using `tag: 'form'`, the template file should NOT contain a `<form>` element. ApplicationV2 wraps the entire content in the specified tag. Use `<section>` or `<div>` as the root element in your template instead:

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

### V1 Pattern (Old):
```javascript
static get defaultOptions () {
  return foundry.utils.mergeObject(super.defaultOptions, {
    classes: ['dcc', 'sheet', 'actor'],
    template: 'systems/dcc/templates/actor-sheet.html',
    width: 600,
    height: 600,
    resizable: true,
    tabs: [{
      navSelector: '.tabs',
      contentSelector: '.tab-content',
      initial: 'character'
    }]
  })
}
```

### V2 Pattern (New):
```javascript
/** @inheritDoc */
static DEFAULT_OPTIONS = {
  classes: ['dcc', 'sheet', 'actor', 'themed', 'theme-light'],
  tag: 'form',  // REQUIRED for dialogs and forms
  position: {
    width: 600,
    height: 600
  },
  window: {
    resizable: true,
    title: 'DCC.ActorSheetTitle' // Localization key
  },
  tabs: [{
    navSelector: '.tabs',
    contentSelector: '.tab-content',
    initial: 'character'
  }]
}
```

### Key Changes:
- Change from getter method to static property
- Add `/** @inheritDoc */` comment
- Add `'themed', 'theme-light'` to classes array
- **Add `tag: 'form'` (REQUIRED for all dialogs and forms)**
- Move `width` and `height` into `position` object
- Move `resizable` into `window` object
- Move `title` into `window` object (use localization key)
- Remove `template` (now handled by PARTS)

## 3. Rename getData() to _prepareContext()

### V1 Pattern (Old):
```javascript
getData () {
  const context = super.getData()
  context.data = this.object.system
  context.flags = this.object.flags
  return context
}
```

### V2 Pattern (New):
```javascript
async _prepareContext(options) {
  const context = await super._prepareContext(options)
  context.system = this.actor.system
  context.flags = this.actor.flags
  return context
}
```

### Key Changes:
- Rename method from `getData` to `_prepareContext`
- Make it `async` and use `await super._prepareContext(options)`
- Pass `options` parameter
- Change `this.object` to `this.actor` (for ActorSheetV2) or `this.document` (for ApplicationV2)

## 4. Move Title to DEFAULT_OPTIONS

### V1 Pattern (Old):
```javascript
get title () {
  return game.i18n.localize('DCC.ActorSheetTitle')
}
```

### V2 Pattern (New):
```javascript
static DEFAULT_OPTIONS = {
  // ... other options
  window: {
    title: 'DCC.ActorSheetTitle', // Just the localization key
    resizable: true
  }
}
```

## 5. Complete Example: Converting a FormApplication

### Before (V1):
```javascript
/* global game, foundry */

export default class DCCActorConfig extends FormApplication {
  static get defaultOptions () {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['dcc', 'sheet', 'actor-config'],
      template: 'systems/dcc/templates/dialog-actor-config.html',
      width: 400,
      height: 'auto',
      resizable: false
    })
  }

  get title () {
    return game.i18n.localize('DCC.ActorConfigTitle')
  }

  getData () {
    const data = super.getData()
    data.config = CONFIG.DCC
    data.data = this.object
    return data
  }

  activateListeners (html) {
    super.activateListeners(html)
    // Event listeners here
  }

  async _updateObject (event, formData) {
    // Update logic here
  }
}
```

### After (V2):
```javascript
/* global game, foundry, CONFIG */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export default class DCCActorConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor-config', 'themed', 'theme-light'],
    tag: 'form',  // REQUIRED for dialogs and forms
    position: {
      width: 400,
      height: 'auto'
    },
    window: {
      title: 'DCC.ActorConfigTitle',
      resizable: false
    },
    form: {
      submitOnChange: true
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
    context.config = CONFIG.DCC
    context.data = this.document
    return context
  }

  // activateListeners is replaced by actions in DEFAULT_OPTIONS
  // _updateObject is still used but with different signature
}
```

## 6. Real-World Example: DCCActorConfig Conversion

Here's a complete, working example of converting `actor-config.js` from V1 to V2:

### Before (V1 - FormApplication):
```javascript
/* global FormApplication, game, CONFIG */

class DCCActorConfig extends FormApplication {
  static get defaultOptions () {
    const options = super.defaultOptions
    options.template = 'systems/dcc/templates/dialog-actor-config.html'
    options.width = 380
    return options
  }

  get title () {
    return `${this.object.name}: ${game.i18n.localize('DCC.SheetConfig')}`
  }

  getData (options = {}) {
    const data = this.object
    data.isNPC = (this.object.type === 'NPC')
    data.isPC = (this.object.type === 'Player')
    data.isZero = (this.object.system.details.level.value === 0)
    data.user = game.user
    data.config = CONFIG.DCC
    return data
  }

  async _updateObject (event, formData) {
    event.preventDefault()
    await this.object.update(formData)
    await this.object.sheet.render(true)
  }
}
```

### After (V2 - ApplicationV2):
```javascript
/* global game, CONFIG, foundry */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class DCCActorConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['dcc', 'sheet', 'actor-config', 'themed', 'theme-light'],
    tag: 'form',
    position: {
      width: 380,
      height: 'auto'
    },
    window: {
      title: 'DCC.SheetConfig',
      resizable: false
    },
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

  /**
   * Get the document being configured
   * @type {Actor}
   */
  get document () {
    return this.options.document
  }

  get title () {
    return `${this.document.name}: ${game.i18n.localize('DCC.SheetConfig')}`
  }

  async _prepareContext (options = {}) {
    const context = await super._prepareContext(options)
    const actor = this.document
    
    context.isNPC = (actor.type === 'NPC')
    context.isPC = (actor.type === 'Player')
    context.isZero = (actor.system.details.level.value === 0)
    context.user = game.user
    context.config = CONFIG.DCC
    context.system = actor.system
    context.actor = actor
    
    return context
  }

  /**
   * Handle form submission
   * @this {DCCActorConfig}
   * @param {SubmitEvent} event - The form submission event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - The processed form data
   * @private
   */
  static async #onSubmitForm (event, form, formData) {
    event.preventDefault()
    await this.document.update(formData.object)
    await this.document.sheet.render(true)
  }
}
```

### Key Changes Made:
1. **Import Structure**: Added `const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api`
2. **Base Class**: Changed from `FormApplication` to `HandlebarsApplicationMixin(ApplicationV2)`
3. **DEFAULT_OPTIONS**: Converted `defaultOptions` getter to static property with proper structure
4. **PARTS**: Added static PARTS for template handling
5. **Context Method**: Renamed `getData` to `_prepareContext` with async signature
6. **Document Reference**: Added `get document()` getter that returns `this.options.document`
7. **Form Configuration**: Added `tag: 'form'` and form options with handler method
8. **Form Submission**: Replaced `_updateObject` with static `#onSubmitForm` handler

### Instantiation Change:
```javascript
// V1 Pattern (Old):
new DCCActorConfig(this.actor, {
  top: this.position.top + 40,
  left: this.position.left + (this.position.width - 400) / 2
}).render(true)

// V2 Pattern (New):
new DCCActorConfig({
  document: this.actor,
  position: {
    top: this.position.top + 40,
    left: this.position.left + (this.position.width - 400) / 2
  }
}).render(true)
```

**Critical**: In ApplicationV2, all parameters including the document are passed in the options object, not as separate parameters.

### ⚠️ **CRITICAL ApplicationV2 Constructor Pattern**

**The most common migration issue** is incorrect instantiation of ApplicationV2 classes. This will cause dialogs to not open or throw errors.

#### FormApplication V1 Constructor Pattern (Old):
```javascript
// V1 FormApplication takes document as first parameter, options as second
new DCCItemConfig(this.document, {
  top: this.position.top + 40,
  left: this.position.left + (this.position.width - 400) / 2
}).render(true)
```

#### ApplicationV2 Constructor Pattern (New):
```javascript
// V2 ApplicationV2 takes ALL parameters in a single options object
new DCCItemConfig({
  document: this.document,  // Document goes INSIDE the options object
  position: {
    top: this.position.top + 40,
    left: this.position.left + (this.position.width - 400) / 2
  }
}).render(true)
```

#### Common Instantiation Examples:

**Actor Configuration:**
```javascript
// V1 (FormApplication)
new DCCActorConfig(this.actor, { position: { ... } })

// V2 (ApplicationV2)
new DCCActorConfig({ document: this.actor, position: { ... } })
```

**Item Configuration:**
```javascript
// V1 (FormApplication)
new DCCItemConfig(this.document, { position: { ... } })

// V2 (ApplicationV2)
new DCCItemConfig({ document: this.document, position: { ... } })
```

**Custom Dialogs:**
```javascript
// V1 (FormApplication)
new SavingThrowConfig(this.actor, { position: { ... } })

// V2 (ApplicationV2)
new SavingThrowConfig({ document: this.actor, position: { ... } })
```

#### Why This Matters:
- **V1**: Expects separate document and options parameters
- **V2**: Expects a single options object with document nested inside
- **Wrong pattern**: Dialog won't open or will throw constructor errors
- **Correct pattern**: Dialog opens normally with proper document access

#### Document Access Inside V2 Classes:
```javascript
// In your ApplicationV2 class
get document() {
  return this.options.document  // Document comes from options object
}

// Usage in methods
async _prepareContext(options) {
  const context = await super._prepareContext(options)
  context.actor = this.document  // this.document refers to options.document
  return context
}
```

This example shows a minimal but complete V2 conversion that preserves all original functionality while upgrading to the new V13 API structure.

## 7. Form Submission in ApplicationV2

ApplicationV2 handles form submission differently than FormApplication. There are two main patterns:

### Pattern 1: Static Form Handler (Recommended)
```javascript
static DEFAULT_OPTIONS = {
  tag: 'form',
  form: {
    handler: MyClass.#onSubmitForm,  // Static method reference
    closeOnSubmit: true,             // Auto-close on successful submit
    submitOnChange: false            // Don't auto-submit on changes
  }
}

/**
 * Handle form submission
 * @this {MyClass}
 * @param {SubmitEvent} event - The form submission event
 * @param {HTMLFormElement} form - The form element
 * @param {FormDataExtended} formData - The processed form data
 */
static async #onSubmitForm(event, form, formData) {
  event.preventDefault()
  // Note: formData.object contains the flattened form data
  await this.document.update(formData.object)
}
```

### Pattern 2: Instance Method (Legacy Support)
```javascript
// This pattern still works but is less preferred
async _updateObject(event, formData) {
  event.preventDefault()
  await this.document.update(formData)
}
```

### Important Notes:
- When using static handler, form data is in `formData.object`
- When using `_updateObject`, form data is directly in `formData`
- Always prevent default form submission with `event.preventDefault()`
- Use `closeOnSubmit: true` to auto-close dialogs after saving

## 8. Additional V2 Concepts

### Templates (PARTS)
V2 uses a PARTS system for templates:
```javascript
static PARTS = {
  header: {
    template: 'systems/dcc/templates/dialog-header.html'
  },
  form: {
    template: 'systems/dcc/templates/dialog-form.html'
  }
}
```

### Actions
Replace jQuery event handlers with actions:
```javascript
static DEFAULT_OPTIONS = {
  actions: {
    rollDice: this.#rollDice,
    deleteItem: this.#deleteItem
  }
}

// Then define static methods:
static #rollDice(event, target) {
  // Handle action
}
```

### Tabs Configuration
See the dedicated tabs section below for detailed tab migration instructions.

## 7. Converting Event Handlers (activateListeners → actions)

In V2, the `activateListeners` method is replaced by the `actions` system in `DEFAULT_OPTIONS`. Event handlers become static methods with `#` prefix (private) or regular methods if they need external access.

### 🚨 **IMPORTANT: Commented-Out jQuery Code**

If you see commented-out jQuery code in `activateListeners()` methods, **DO NOT REMOVE IT**. This code shows:
- The original V12 event handlers that need to be converted to V2 actions
- All the functionality that must be mapped to the new actions system
- The complete list of interactions the sheet/dialog should support

**Example of commented code to preserve:**
```javascript
// KEEP THIS - it shows what actions are needed:
//   html.find('.ability-label').click(this._onRollAbilityCheck.bind(this))
//   html.find('.item-create').click(this._onItemCreate.bind(this))
//   html.find('.item-delete').click(this._onItemDelete.bind(this))
```

This maps to V2 actions and data-action attributes in templates.

### V1 Pattern (Old):
```javascript
activateListeners(html) {
  super.activateListeners(html)
  
  // Click handlers
  html.find('.ability-label').click(this._onRollAbilityCheck.bind(this))
  html.find('.save-label').click(this._onRollSavingThrow.bind(this))
  html.find('.skill-check').click(this._onRollSkillCheck.bind(this))
  
  // Button handlers
  html.find('button.item-create').click(this._onItemCreate.bind(this))
  html.find('button.item-edit').click(this._onItemEdit.bind(this))
  html.find('button.item-delete').click(this._onItemDelete.bind(this))
  
  // Change handlers
  html.find('input.checkbox').change(this._onCheckboxChange.bind(this))
}

// Handler methods use _ prefix
_onRollAbilityCheck(event) {
  event.preventDefault()
  const ability = event.currentTarget.dataset.ability
  this.actor.rollAbilityCheck(ability)
}

_onItemCreate(event) {
  event.preventDefault()
  const type = event.currentTarget.dataset.type
  // Create item logic
}
```

### V2 Pattern (New):
```javascript
static DEFAULT_OPTIONS = {
  // ... other options
  actions: {
    rollAbilityCheck: this.#rollAbilityCheck,
    rollSavingThrow: this.#rollSavingThrow,
    rollSkillCheck: this.#rollSkillCheck,
    itemCreate: this.#itemCreate,
    itemEdit: this.#itemEdit,
    itemDelete: this.#itemDelete,
    checkboxChange: this.#checkboxChange
  }
}

// Handler methods use # prefix (private static methods)
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

/**
 * Create a new item
 * @this {DCCActorSheet}
 * @param {PointerEvent} event
 * @param {HTMLElement} target
 */
static async #itemCreate(event, target) {
  event.preventDefault()
  const type = target.dataset.type
  // Create item logic
}
```

### HTML Template Changes

The most critical change is adding `data-action` attributes to HTML elements that trigger actions. The value must match the key defined in the `actions` object of `DEFAULT_OPTIONS`.

#### Basic Click Actions:
```html
<!-- V1 Pattern (Old) - Uses class selectors -->
<span class="ability-label" data-ability="str">Strength</span>
<button class="item-create" data-type="weapon">Create Weapon</button>
<a class="item-control item-edit" title="Edit Item"><i class="fas fa-edit"></i></a>

<!-- V2 Pattern (New) - Uses data-action -->
<span data-action="rollAbilityCheck" data-ability="str">Strength</span>
<button data-action="itemCreate" data-type="weapon">Create Weapon</button>
<a data-action="itemEdit" data-item-id="{{item._id}}" title="Edit Item"><i class="fas fa-edit"></i></a>
```

#### Form Elements:
```html
<!-- V1 Pattern (Old) -->
<input type="checkbox" class="checkbox" name="system.config.showSpells" {{checked system.config.showSpells}}>
<select class="skill-die" name="system.skills.{{@key}}.die">

<!-- V2 Pattern (New) -->
<input type="checkbox" data-action="toggleConfig" name="system.config.showSpells" {{checked system.config.showSpells}}>
<select data-action="updateSkillDie" data-skill="{{@key}}" name="system.skills.{{@key}}.die">
```

#### Multiple Actions on Same Element Type:
```html
<!-- When you have multiple buttons that do different things -->
<div class="item-controls">
  <button data-action="itemCreate" data-type="weapon">Add Weapon</button>
  <button data-action="itemCreate" data-type="armor">Add Armor</button>
  <button data-action="itemCreate" data-type="spell">Add Spell</button>
</div>

<!-- The action handler can differentiate using data attributes -->
<div class="saving-throws">
  <span data-action="rollSavingThrow" data-save="frt">{{localize "DCC.SaveFortitude"}}</span>
  <span data-action="rollSavingThrow" data-save="ref">{{localize "DCC.SaveReflex"}}</span>
  <span data-action="rollSavingThrow" data-save="wil">{{localize "DCC.SaveWill"}}</span>
</div>
```

#### Complex Interactions:
```html
<!-- Drag handles don't need data-action, but the draggable element needs proper data -->
<li class="item" data-item-id="{{item._id}}">
  <img src="{{item.img}}" title="{{item.name}}" width="24" height="24"/>
  <h4>{{item.name}}</h4>
  <div class="item-controls">
    <a data-action="itemEdit" data-item-id="{{item._id}}"><i class="fas fa-edit"></i></a>
    <a data-action="itemDelete" data-item-id="{{item._id}}"><i class="fas fa-trash"></i></a>
  </div>
</li>

<!-- Context menu triggers -->
<div class="ability-score" data-action="rollAbilityCheck" data-action-secondary="openAbilityMenu" data-ability="str">
  {{system.abilities.str.value}}
</div>
```

#### Important Notes:

1. **Action Name Must Match**: The `data-action` value must exactly match the key in the `actions` object
2. **Keep Data Attributes**: Other `data-*` attributes are still passed to the handler via the `target` parameter
3. **Event Types**: By default, actions trigger on 'click' events. For other events, you may need custom handling
4. **No More Classes for JS**: Remove JavaScript-specific classes like `.item-create`, `.roll-ability` - use semantic classes for styling only
5. **Icons Inside Clickable Elements**: Child elements (like `<i>` icons) don't need `data-action` - clicks bubble up to the parent
6. **Label Click Behavior**: When adding `data-action` to `<label>` elements, clicks will still trigger focus on the associated form element unless you call `event.preventDefault()` in your handler:
   ```javascript
   static async #rollAbilityCheck(event, target) {
     event.preventDefault() // Prevent label from focusing the input
     const ability = target.dataset.ability
     await this.actor.rollAbilityCheck(ability)
   }
   ```

### Key Differences:

1. **Method Signature**: V2 handlers receive `(event, target)` parameters
2. **Method Prefix**: Use `#` for private static methods, no prefix for public methods
3. **Static Methods**: All action handlers are static methods
4. **Context Binding**: Use `@this {ClassName}` JSDoc to specify context
5. **HTML Attributes**: Add `data-action="actionName"` to trigger the action

### JSDoc Documentation for Action Methods

When renaming action methods from `_methodName` to `#methodName`, update the JSDoc comments to include the required `@this` annotation and proper parameter types:

```javascript
/**
 * Open the item edit dialog
 * @this {DCCActorSheet}
 * @param {PointerEvent} event   The originating click event
 * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
 * @returns {Promise<void>}
 */
static async #itemEdit(event, target) {
  // Implementation
}
```

**Required JSDoc Elements**:
- `@this {ClassName}` - Specifies the context binding for static methods
- `@param {PointerEvent} event` - The triggering event (always first parameter)
- `@param {HTMLElement} target` - The element with the data-action attribute (always second parameter)
- `@returns {Promise<void>}` - Return type (typically Promise<void> for async actions)

### Common Migration Examples:

```javascript
// V1: Multiple jQuery selectors for similar actions
activateListeners(html) {
  html.find('.roll-str').click(() => this.actor.rollAbilityCheck('str'))
  html.find('.roll-agl').click(() => this.actor.rollAbilityCheck('agl'))
  html.find('.roll-sta').click(() => this.actor.rollAbilityCheck('sta'))
}

// V2: Single action handler with data attributes
static DEFAULT_OPTIONS = {
  actions: {
    rollAbilityCheck: this.#rollAbilityCheck
  }
}

static async #rollAbilityCheck(event, target) {
  const ability = target.dataset.ability
  await this.actor.rollAbilityCheck(ability)
}
```

Template:
```html
<!-- V1 -->
<span class="roll-str">STR</span>
<span class="roll-agl">AGL</span>

<!-- V2 -->
<span data-action="rollAbilityCheck" data-ability="str">STR</span>
<span data-action="rollAbilityCheck" data-ability="agl">AGL</span>
```

### Methods That Need External Access:

If a method needs to be called from outside the form (e.g., from other parts of the application), keep it as a regular method:

```javascript
// Public method (can be called externally)
async rollInitiative(options = {}) {
  return this.actor.rollInitiative(options)
}

// Private action handler that calls the public method
static async #rollInitiative(event, target) {
  event.preventDefault()
  await this.rollInitiative()
}
```

### Complex Event Handling:

For drag-drop or other complex events, use specialized handlers:

```javascript
static DEFAULT_OPTIONS = {
  // ... other options
  dragDrop: this.#createDragDropHandlers
}

static #createDragDropHandlers() {
  return [{
    dragSelector: '.item',
    dropSelector: '.item-list'
  }]
}

// Override drag/drop methods
_onDragStart(event) {
  // Custom drag logic
}

_onDrop(event) {
  // Custom drop logic
}
```

## 8. Tab System Migration

V2 introduces a new tab system that requires significant changes from V1. Templates need to be split into separate files, and tab configuration is handled through `TABS` and `_getTabsConfig()`.

### V1 Pattern (Old):
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

// Single template with all tabs inside
template: 'systems/dcc/templates/actor-sheet.html'
```

### V2 Pattern (New):

#### 1. Split Templates into Separate Files
Each tab needs its own template file:
```
templates/
  actor-sheet-body.html           (main container)
  actor-partial-tabs.html         (tab navigation)
  actor-partial-pc-common.html    (character tab)
  actor-partial-pc-equipment.html (equipment tab)
  actor-partial-pc-notes.html     (notes tab)
```

#### 2. Define PARTS for Each Tab
```javascript
static PARTS = {
  tabs: {
    id: 'tabs',
    template: 'systems/dcc/templates/actor-partial-tabs.html'
  },
  body: {
    id: 'body',
    template: 'systems/dcc/templates/actor-sheet-body.html'
  },
  character: {
    id: 'character',
    template: 'systems/dcc/templates/actor-partial-pc-common.html'
  },
  equipment: {
    id: 'equipment',
    template: 'systems/dcc/templates/actor-partial-pc-equipment.html'
  },
  notes: {
    id: 'notes',
    template: 'systems/dcc/templates/actor-partial-pc-notes.html'
  }
}
```

#### 3. Define TABS Configuration
```javascript
static TABS = {
  sheet: { // group name
    tabs: [
      { id: 'character', group: 'sheet', label: 'DCC.Character' },
      { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' },
      { id: 'notes', group: 'sheet', label: 'DCC.Notes' }
    ],
    initial: 'character'
  }
}
```

### Dynamic Tabs with _getTabsConfig()

For applications where tabs vary based on document type or settings, override `_getTabsConfig()`:

#### Example 1: Item Sheet with Dynamic Tab Names
```javascript
// From item-sheet.js
_getTabsConfig(group) {
  const tabs = foundry.utils.deepClone(super._getTabsConfig(group))
  
  // Change first tab based on item type
  const initCapTypeName = this.document.type.charAt(0).toUpperCase() + this.document.type.slice(1)
  tabs.tabs[0] = {
    id: this.document.type,
    group: 'sheet',
    label: `DCC.${initCapTypeName}`
  }
  tabs.initial = this.document.type
  
  return tabs
}
```

#### Example 2: Actor Sheet with Modular Class-Specific Tabs
```javascript
// Base actor sheet defines core tabs and extension points
static TABS = {
  sheet: {
    tabs: [
      { id: 'character', group: 'sheet', label: 'DCC.Character' },
      { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' }
    ],
    initial: 'character'
  }
}

// Empty objects for subclasses to override
static CLASS_TABS = {}
static END_TABS = {
  sheet: {
    tabs: [
      { id: 'notes', group: 'sheet', label: 'DCC.Notes' }
    ]
  }
}

// Override _getTabsConfig to merge all tabs
_getTabsConfig(group) {
  const tabs = foundry.utils.deepClone(super._getTabsConfig(group))
  
  // Add class-specific tabs (defined by subclasses)
  if (this.constructor.CLASS_TABS?.[group]?.tabs) {
    for (const tab of this.constructor.CLASS_TABS[group].tabs) {
      tabs.tabs.push(tab)
    }
  }
  
  // Add conditional tabs based on settings
  if (this.document?.system?.config?.showSkills) {
    tabs.tabs.push({ id: 'skills', group: 'sheet', label: 'DCC.Skills' })
  }
  
  // Add end tabs
  if (this.constructor.END_TABS?.[group]?.tabs) {
    for (const tab of this.constructor.END_TABS[group].tabs) {
      tabs.tabs.push(tab)
    }
  }
  
  return tabs
}
```

### Extensible Tab System for Modules

To allow external modules to add tabs, use static properties that subclasses can override:

```javascript
// In actor-sheets-dcc.js - Cleric subclass
class DCCActorSheetCleric extends DCCActorSheet {
  // Define additional parts for cleric-specific tabs
  static CLASS_PARTS = {
    clericSpells: {
      id: 'clericSpells',
      template: 'systems/dcc/templates/actor-partial-cleric-spells.html'
    },
    cleric: {
      id: 'cleric',
      template: 'systems/dcc/templates/actor-partial-cleric.html'
    }
  }
  
  // Define cleric-specific tabs
  static CLASS_TABS = {
    sheet: {
      tabs: [
        { id: 'cleric', group: 'sheet', label: 'DCC.Cleric' },
        { id: 'clericSpells', group: 'sheet', label: 'DCC.ClericSpells' }
      ]
    }
  }
}
```

### Dynamic Parts with _configureRenderParts()

For dynamic template selection based on document properties:

```javascript
_configureRenderParts(options) {
  const parts = super._configureRenderParts(options)
  
  // Add class-specific parts
  for (const [key, part] of Object.entries(this.constructor.CLASS_PARTS || [])) {
    if (part?.template) {
      parts[key] = part
    }
  }
  
  // Conditionally remove parts
  if (!this.document?.system?.config?.showSpells) {
    delete parts.wizardSpells
  }
  
  return parts
}
```

### Tab Template Structure

#### Navigation Template (actor-partial-tabs.html):
```html
<nav class="sheet-tabs tabs" data-group="sheet">
  {{#each tabs as |tab|}}
    <a class="item {{#if tab.active}}active{{/if}}" data-tab="{{tab.id}}">
      {{localize tab.label}}
    </a>
  {{/each}}
</nav>
```

#### Body Template (actor-sheet-body.html):
```html
<section class="sheet-body">
  {{> character}}
  {{> equipment}}
  {{> notes}}
  {{#if cleric}}{{> cleric}}{{/if}}
  {{#if clericSpells}}{{> clericSpells}}{{/if}}
</section>
```

### ⚠️ **CRITICAL CSS WARNING for Tab Display**

**Problem**: If the parent element containing your tabs has a `display` CSS property set (e.g., `display: grid`, `display: flex`), **ALL tabs will be visible at once** and tab switching will not work properly.

**Why This Happens**: Foundry's tab system relies on default display behavior. When you set a specific display property on the parent container, it overrides Foundry's tab hiding mechanism.

**Example of the Problem**:
```css
/* WRONG - This will break tab switching */
.sheet-body {
  display: grid;  /* This causes ALL tabs to show at once */
  grid-template-columns: 1fr 1fr;
}

/* ALSO WRONG */
.tab-content {
  display: flex;  /* This will also break tab switching */
}
```

**Solution**: Never set `display` properties on elements that directly contain tabs. Instead, add a wrapper div inside each tab:

```html
<!-- CORRECT Tab Template Structure -->
<section class="tab {{tabs.character.cssClass}}" data-tab="{{tabs.character.id}}" data-group="{{tabs.character.group}}">
  <div class="tab-content-wrapper">  <!-- Add wrapper for layout -->
    <!-- Now you can safely use display: grid or flex on the wrapper -->
    <div class="character-grid">
      <!-- Your content here -->
    </div>
  </div>
</section>
```

```css
/* CORRECT - Apply display properties to inner elements */
.tab-content-wrapper {
  /* No display property here */
}

.character-grid {
  display: grid;  /* Safe to use on inner elements */
  grid-template-columns: 1fr 1fr;
}
```

**Debugging Tips**:
- If all tabs show at once, check your CSS for any `display` properties on `.sheet-body`, `.tab`, or similar parent elements
- Use browser dev tools to inspect computed styles on tab containers
- Look for any CSS rules that might be setting display properties globally

### 🚨 **CRITICAL: Tab Template Root Element Requirements**

**Tab templates MUST have proper root element structure to work in V13:**

1. **REQUIRED `tab` class**: The root element must have the CSS class `tab`
2. **REQUIRED tab data attributes**: The root element must include dynamic tab attributes:
   - `data-tab="{{tabs.tabId.id}}"`
   - `data-group="{{tabs.tabId.group}}"`
   - `{{tabs.tabId.cssClass}}` for dynamic CSS classes
3. **REQUIRED element type**: Use `<section>` or `<div>` (never `<form>` inside a form)

#### ✅ **CORRECT Tab Template Structure**:
```html
{{!-- Individual Tab Template (e.g., actor-partial-character.html) --}}
<section class="tab {{tabs.character.id}} {{tabs.character.cssClass}}" 
         data-tab="{{tabs.character.id}}" 
         data-group="{{tabs.character.group}}">
  {{!-- Tab content here --}}
  <div class="character-details">
    <!-- form fields, etc. -->
  </div>
</section>
```

#### ✅ **CORRECT Item Sheet Tab Template**:
```html
{{!-- Spell Details Tab (item-sheet-spell.html) --}}
<section class="tab-body {{tabs.spell.id}} {{tabs.spell.cssClass}}" 
         data-tab="{{tabs.spell.id}}" 
         data-group="{{tabs.spell.group}}">
  {{!-- Spell form fields --}}
  <div class="grid-col-span-12 grid-tpl-max-auto mb-5">
    <label for="name">{{localize "DCC.Name"}}</label>
    <input id="name" name="name" value="{{document.name}}" />
  </div>
  {{!-- More content --}}
</section>
```

#### ❌ **INCORRECT Examples**:
```html
{{!-- WRONG: Missing tab class --}}
<section data-tab="{{tabs.character.id}}">
  <!-- content -->
</section>

{{!-- WRONG: Missing data attributes --}}
<section class="tab">
  <!-- content -->
</section>

{{!-- WRONG: Static tab ID instead of dynamic --}}
<section class="tab" data-tab="character" data-group="sheet">
  <!-- content -->
</section>

{{!-- WRONG: Form element inside form application --}}
<form class="tab {{tabs.character.id}}" data-tab="{{tabs.character.id}}">
  <!-- Creates invalid nested forms -->
</form>
```

#### **Why These Attributes Are Required**:
- **Tab Switching**: Foundry's tab system uses these attributes to show/hide tabs
- **CSS Targeting**: The dynamic classes allow proper styling and transitions
- **Event Handling**: Tab navigation relies on these data attributes
- **Accessibility**: Screen readers need proper tab structure for navigation

#### **Template Variable Names**:
The `{{tabs.tabId}}` variables come from your `_getTabsConfig()` method or `TABS` configuration:
```javascript
// In your sheet class
static TABS = {
  sheet: {
    tabs: [
      { id: 'character', group: 'sheet', label: 'DCC.Character' },
      { id: 'equipment', group: 'sheet', label: 'DCC.Equipment' }
    ]
  }
}

// This creates these template variables:
// {{tabs.character.id}} = 'character'
// {{tabs.character.group}} = 'sheet'
// {{tabs.character.cssClass}} = CSS classes for active state, etc.
```

### Migration Checklist for Tabs:
- [ ] Split monolithic template into separate tab templates
- [ ] Create navigation template for tab buttons
- [ ] Define PARTS for each tab template
- [ ] Define TABS configuration
- [ ] Override `_getTabsConfig()` if tabs are dynamic
- [ ] Override `_configureRenderParts()` if parts are conditional
- [ ] Update tab content templates to remove wrapper divs
- [ ] Test tab switching and dynamic tab visibility

## 9. jQuery Removal

**⚠️ CRITICAL NOTE**: When migrating to ApplicationV2, jQuery references in `activateListeners()` methods should be converted to **ACTIONS**, not vanilla JavaScript.

### jQuery in activateListeners → Actions (Preferred for ApplicationV2)

When you see jQuery code in `activateListeners()`, it should be converted to the ApplicationV2 actions system:

```javascript
// V1 jQuery (OLD):
activateListeners(html) {
  html.find('.roll-button').click(this._onRoll.bind(this))
  html.find('.delete-item').click(this._onDelete.bind(this))
}

// V2 Actions (CORRECT):
static DEFAULT_OPTIONS = {
  actions: {
    roll: this.#onRoll,
    deleteItem: this.#onDelete
  }
}

// Template uses data-action:
<button data-action="roll">Roll</button>
<button data-action="deleteItem">Delete</button>
```

### jQuery to Vanilla JS (Only for Hook Functions and Non-ApplicationV2 Code)

Replace jQuery with vanilla JavaScript only in hooks, chat functions, and other non-ApplicationV2 contexts:

| jQuery | Vanilla JS |
|--------|------------|
| `$(selector)` | `document.querySelector(selector)` |
| `html.find('.class')` | `html.querySelector('.class')` |
| `html.find('.class').click(handler)` | `html.querySelector('.class').addEventListener('click', handler)` |
| `.val()` | `.value` |
| `.html(content)` | `.innerHTML = content` |
| `.text(content)` | `.textContent = content` |
| `.addClass('class')` | `.classList.add('class')` |
| `.attr('data-id')` | `.getAttribute('data-id')` |

### When to Use Each Approach

**Use Actions (ApplicationV2):**
- Converting FormApplication/ActorSheet/ItemSheet classes
- Any `activateListeners()` method in V2 applications
- Event handlers in sheet templates

**Use Vanilla JS:**
- Chat hook functions (`renderChatMessageHTML`)
- Directory hooks (`renderActorDirectory`)
- System initialization code
- Utility functions that manipulate DOM outside of ApplicationV2

## 10. Additional Migration Patterns

### Window Controls
V2 allows you to define custom window controls in the title bar:

```javascript
static DEFAULT_OPTIONS = {
  window: {
    controls: [
      {
        action: 'configureActor',
        icon: 'fas fa-code',
        label: 'DCC.ConfigureSheet',
        ownership: 'OWNER'  // Only show for owners
      }
    ]
  }
}
```

### Form Configuration
V2 provides built-in form handling options:

```javascript
static DEFAULT_OPTIONS = {
  form: {
    submitOnChange: true  // Auto-save on any form change
  }
}
```

### Dynamic Positioning
In V2, position adjustments should be done during context preparation:

```javascript
// V1: Modified position in getData()
async getData() {
  if (this.object.type === 'weapon') {
    this.position.height = 663
  }
}

// V2: Modify position in _prepareContext()
async _prepareContext(options) {
  const data = await super._prepareContext(options)
  if (data.document.type === 'weapon') {
    this.position.height = 663
  }
  return data
}
```

### Property Access Changes
V2 uses different property names for accessing the document:

| V1 | V2 |
|----|----|
| `this.object` | `this.document` |
| `this.item` | `this.document` |
| `this.actor` | `this.actor` (unchanged) |
| `data.item` | `data.document` |
| `data.type` | `data.document.type` |

### setPosition Override
When overriding setPosition, use vanilla JS instead of jQuery:

```javascript
// V1
setPosition(options = {}) {
  const position = super.setPosition(options)
  const sheetBody = this.element.find('.sheet-body')
  const bodyHeight = position.height - 160
  sheetBody.css('height', bodyHeight)
  return position
}

// V2
setPosition(options = {}) {
  const position = super.setPosition(options)
  const sheetBody = this.element.querySelector('.sheet-body')
  const bodyHeight = position.height - 160
  sheetBody.style.height = bodyHeight + 'px'
  return position
}
```

### Drag and Drop Migration

V2 uses a completely different approach for drag and drop functionality. Unlike V1 which automatically bound drag/drop handlers, V2 requires manual initialization and binding in the constructor and `_onRender` method.

#### V1 Pattern (Old):
```javascript
static get defaultOptions() {
  return foundry.utils.mergeObject(super.defaultOptions, {
    dragDrop: [{ dragSelector: '.item', dropSelector: '.item-list' }]
  })
}

// Drag/drop handlers were bound automatically
activateListeners(html) {
  super.activateListeners(html)
  // Additional listeners...
}
```

#### V2 Pattern (New) - Step-by-Step Implementation:

**1. Import DragDrop and configure DEFAULT_OPTIONS:**
```javascript
const { DragDrop } = foundry.applications.ux

class MyAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    // Configure drag/drop selector array
    dragDrop: [{ 
      dragSelector: '[data-drag="true"]',  // Note: data-drag="true" attribute 
      dropSelector: '.drop-zone' 
    }]
  }
}
```

**2. Initialize DragDrop in constructor:**
```javascript
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
      dragover: this._onDragOver.bind(this),
      drop: this._onDrop.bind(this)
    }
    return new DragDrop(d)
  })
}
```

**3. Add draggable elements to templates with `data-drag="true"`:**
```html
<ol class="items">
  {{#each items}}
  <li data-drag="true" data-item-id="{{this.id}}">{{this.name}}</li>
  {{/each}}
</ol>

<!-- For specific drag actions, use data-drag-action -->
<label data-drag="true" data-drag-action="ability" data-ability="str">
  Strength
</label>
```

**4. Bind DragDrop listeners in _onRender:**
```javascript
_onRender(context, options) {
  this.#dragDrop.forEach((d) => d.bind(this.element))
}
```

**5. Implement required callback methods:**
```javascript
// Permission methods (required)
_canDragStart(selector) {
  return this.document.isOwner && this.isEditable
}

_canDragDrop(selector) {
  return this.document.isOwner && this.isEditable
}

// Event handlers
_onDragStart(event) {
  const li = event.currentTarget
  
  // Use data-drag-action for specific drag types
  const dragAction = li.dataset.dragAction
  let dragData = null
  
  switch (dragAction) {
    case 'ability':
      dragData = {
        type: 'Ability',
        actorId: this.actor.id,
        data: { abilityId: li.dataset.ability }
      }
      break
      
    case 'item':
      const itemId = li.dataset.itemId
      const item = this.actor.items.get(itemId)
      dragData = Object.assign(item.toDragData(), {
        dccType: 'Item',
        actorId: this.actor.id,
        data: item
      })
      break
  }
  
  if (dragData) {
    if (this.actor.isToken) dragData.tokenId = this.actor.token.id
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
  }
}

_onDragOver(event) {
  // Optional: handle dragover events
}

_onDrop(event) {
  const data = foundry.applications.ux.TextEditor.getDragEventData(event)
  if (!data) return false
  
  // Handle the dropped data
  // Delegate to base class for standard item drops
  return super._onDrop?.(event)
}
```

#### Key Differences:

1. **Manual Initialization**: V2 requires manual creation and binding of DragDrop instances in the constructor
2. **Template Attribute**: Use `data-drag="true"` attribute to mark draggable elements
3. **Manual Binding**: Must call `d.bind(this.element)` in `_onRender()` method
4. **Permission Methods**: Must implement `_canDragStart()` and `_canDragDrop()` 
5. **Import Required**: Must import `DragDrop` from `foundry.applications.ux`
6. **Constructor Required**: Unlike V1's automatic binding, V2 requires explicit setup in constructor

#### ⚠️ Important Notes:

- **`data-drag="true"` is required** - Elements must have this attribute to be draggable
- **Manual binding is critical** - Forgetting to call `d.bind(this.element)` in `_onRender()` will result in non-functional drag/drop
- **Constructor initialization** - The `#createDragDropHandlers()` must be called in the constructor
- **Array configuration** - `dragDrop` in `DEFAULT_OPTIONS` should be an array of configuration objects, not a method reference

#### Migration Notes:

- **Critical Difference**: V1 automatically bound drag/drop handlers, V2 requires manual initialization and binding
- Permission methods are required in V2 but were optional in V1
- Multiple drag/drop handlers can be defined by returning multiple objects in the array
- The `_onDragStart` method signature remains the same: `(event)`
- The drag/drop functionality must be explicitly enabled through the dragDrop configuration
- **Note**: The DCC system uses a simplified approach with `data-drag-action` attributes instead of `data-drag="true"` for better organization

### Removed Properties
The following properties are no longer needed in V2:
- `@extends` JSDoc comments (use `@inheritDoc` instead)

## 12. Static Initializer Configuration Issue

**CRITICAL V13 Issue**: You cannot use CONFIG-based values in static field initializers because CONFIG is not yet available during class definition.

### Problem Example:
```javascript
// ❌ BROKEN - CONFIG.DCC is undefined during static initialization
class RollModifierDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    form: {
      template: CONFIG.DCC.templates.rollModifierDialog  // ERROR: undefined
    }
  }
}
```

### Error Message:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'templates')
    at <static_initializer> (roll-modifier.js:296:28)
```

### Solutions:

#### Solution 1: Hard-code Values (Recommended)
Remove configuration dependency and hard-code template paths:

```javascript
// ✅ WORKING - Hard-coded template path
class RollModifierDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    form: {
      template: 'systems/dcc/templates/dialog-roll-modifiers.html'
    }
  }
}
```

#### Solution 2: Use Getter Method
Convert static property to getter that executes at runtime:

```javascript
// ✅ WORKING - Getter executes after CONFIG is available
class RollModifierDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static get PARTS() {
    return {
      form: {
        template: CONFIG.DCC.templates.rollModifierDialog
      }
    }
  }
}
```

#### Solution 3: Dynamic Assignment in Init Hook
Set up templates after CONFIG is initialized:

```javascript
// In your system's init hook, after CONFIG.DCC is set
Hooks.once('init', () => {
  CONFIG.DCC = DCC;
  
  // Now safe to reference CONFIG values
  RollModifierDialog.PARTS = {
    form: {
      template: CONFIG.DCC.templates.rollModifierDialog
    }
  };
});
```

### Why This Happens:
- **Static initializers** run when the class is first parsed/loaded
- **CONFIG assignment** happens later in the `init` hook
- **Timing mismatch** causes CONFIG.DCC to be undefined during class definition
- **ES modules** and V13 changes make this timing more strict

### Migration Steps:
1. **Find CONFIG references** in static properties (`PARTS`, `DEFAULT_OPTIONS`, etc.)
2. **Choose solution approach** (hard-coding recommended for simplicity)
3. **Update all affected classes** in your system
4. **Remove CONFIG template objects** if no longer needed
5. **Test thoroughly** to ensure all templates load correctly

### Real-world Example from DCC System:
```javascript
// Before (broken):
// config.js
DCC.templates = {
  attackResult: 'systems/dcc/templates/chat-card-attack-result.html',
  rollModifierDialog: 'systems/dcc/templates/dialog-roll-modifiers.html',
  spellResult: 'systems/dcc/templates/chat-card-spell-result.html'
}

// roll-modifier.js  
static PARTS = {
  form: {
    template: CONFIG.DCC.templates.rollModifierDialog  // ❌ Breaks
  }
}

// After (working):
// config.js - Remove templates object entirely

// roll-modifier.js
static PARTS = {
  form: {
    template: 'systems/dcc/templates/dialog-roll-modifiers.html'  // ✅ Works
  }
}

// spell-result.js
messageData.content = await renderTemplate(
  'systems/dcc/templates/chat-card-spell-result.html',  // ✅ Hard-coded
  { ... }
)

// actor.js  
messageData.content = await renderTemplate(
  'systems/dcc/templates/chat-card-attack-result.html',  // ✅ Hard-coded
  { message: messageData }
)
```

This approach removes the configuration abstraction but eliminates the timing issue and makes template paths more explicit and easier to find.

## 13. Critical V13 Breaking Changes

### Sheet Registration Removal (V13.341)
**CRITICAL**: Default actor and item sheet registrations have been removed in V13.341. All systems must explicitly register their sheets:

```javascript
// In your system's init hook
Hooks.once('init', () => {
  // Register Actor sheets
  Actors.registerSheet('dcc', DCCActorSheet, {
    types: ['Player'],
    makeDefault: true,
    label: 'DCC.SheetPlayer'
  })
  
  Actors.registerSheet('dcc', DCCActorSheetNPC, {
    types: ['NPC'],
    makeDefault: true,
    label: 'DCC.SheetNPC'
  })
  
  // Register class-specific sheets
  Actors.registerSheet('dcc', DCCActorSheetCleric, {
    types: ['Player'],
    makeDefault: false,
    label: 'DCC.SheetCleric'
  })
  
  // Register Item sheets
  Items.registerSheet('dcc', DCCItemSheet, {
    makeDefault: true,
    label: 'DCC.SheetItem'
  })
})
```

Without explicit registration, sheets will fall back to AppV1 sheets, breaking the V2 migration.

### CSS Layers
V13 introduces CSS Cascade Layers. System styles are automatically placed in the correct layer, eliminating the need for specificity hacks.

### TinyMCE to ProseMirror
TinyMCE deprecation moved forward to V14. Consider migrating rich text editing to ProseMirror.

## 12. Visual Regression Testing

### Manual Visual Testing Approach

**Before Migration (Baseline)**:
1. Create a test world with representative data:
   - Level 0 character
   - Each character class (Cleric, Thief, Warrior, Wizard, Dwarf, Elf, Halfling)
   - Various item types (weapons, armor, spells, equipment, treasures)
   - NPCs with different configurations
2. Take screenshots of each component at standard browser zoom (100%)
3. Test different browser window sizes (1920x1080, 1366x768, mobile sizes)
4. Document any known styling issues in the baseline

**Screenshot Checklist**:
```
Actor Sheets:
- [ ] Level 0 character sheet (all tabs)
- [ ] Cleric sheet (all tabs including spells)
- [ ] Thief sheet (all tabs including skills)
- [ ] Warrior sheet (all tabs)
- [ ] Wizard sheet (all tabs including spells)
- [ ] Dwarf sheet (all tabs)
- [ ] Elf sheet (all tabs including spells)
- [ ] Halfling sheet (all tabs)
- [ ] NPC sheet (all tabs)

Item Sheets:
- [ ] Weapon sheet (different weapon types)
- [ ] Armor sheet
- [ ] Spell sheet (wizard and cleric spells)
- [ ] Equipment sheet
- [ ] Treasure sheet (resolved and unresolved)
- [ ] Skill sheet
- [ ] Level sheet
- [ ] Ammunition sheet
- [ ] Mount sheet

Configuration Dialogs:
- [ ] Actor Config dialog
- [ ] Item Config dialog
- [ ] Level Change dialog
- [ ] Melee/Missile Bonus Config dialog
- [ ] Saving Throw Config dialog
- [ ] Parser dialog (NPC and PC parsers)

UI Components:
- [ ] Roll Modifier dialog
- [ ] Fleeting Luck dialog
- [ ] Welcome dialog
- [ ] All tabs in each sheet type
- [ ] Context menus and dropdowns
- [ ] Form validation states (errors, warnings)
```

### Automated Screenshot Testing

**Using Playwright/Puppeteer**:
```javascript
// Example test script for automated visual regression
const { test, expect } = require('@playwright/test');

test.describe('DCC System V2 Migration Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test world
    await page.goto('http://localhost:30000/game');
    await page.waitForSelector('.game.system-dcc');
  });

  test('Actor sheet renders correctly', async ({ page }) => {
    // Open actor sheet
    await page.click('[data-document-id="actor-id"]');
    await page.waitForSelector('.dcc.actor.sheet');
    
    // Take screenshot
    await expect(page.locator('.dcc.actor.sheet')).toHaveScreenshot('actor-sheet.png');
    
    // Test each tab
    const tabs = ['character', 'equipment', 'notes'];
    for (const tab of tabs) {
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForTimeout(500); // Allow animations
      await expect(page.locator('.dcc.actor.sheet')).toHaveScreenshot(`actor-sheet-${tab}.png`);
    }
  });

  test('Item sheet renders correctly', async ({ page }) => {
    // Similar pattern for item sheets
    await page.click('[data-document-id="item-id"]');
    await page.waitForSelector('.dcc.item.sheet');
    await expect(page.locator('.dcc.item.sheet')).toHaveScreenshot('item-sheet.png');
  });
});
```

### CSS Regression Testing

**Check Computed Styles**:
```javascript
// Test that critical styles are preserved
test('Actor sheet maintains styling', async ({ page }) => {
  await page.goto('/game');
  await page.click('.actor[data-document-id="test-actor"]');
  
  const sheet = page.locator('.dcc.actor.sheet');
  
  // Test key CSS properties
  await expect(sheet).toHaveCSS('width', '520px');
  await expect(sheet).toHaveCSS('height', '450px');
  
  // Test tab styling
  const tabs = page.locator('.sheet-tabs .item');
  await expect(tabs.first()).toHaveCSS('background-color', 'rgb(...)');
});
```

### Interactive Element Testing

**Form Functionality**:
```javascript
test('Form elements work correctly', async ({ page }) => {
  // Test form inputs maintain functionality
  await page.fill('input[name="system.abilities.str.value"]', '15');
  await expect(page.locator('input[name="system.abilities.str.value"]')).toHaveValue('15');
  
  // Test dropdowns
  await page.selectOption('select[name="system.class.className"]', 'Cleric');
  await expect(page.locator('select[name="system.class.className"]')).toHaveValue('Cleric');
  
  // Test checkboxes
  await page.check('input[name="system.config.showSpells"]');
  await expect(page.locator('input[name="system.config.showSpells"]')).toBeChecked();
});
```

### Cross-Browser Testing

**Browser Matrix**:
```
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest) 
- [ ] Safari (if on Mac)
- [ ] Chrome Mobile (responsive)
```

### Accessibility Testing

**Screen Reader Compatibility**:
```javascript
test('Accessibility maintained', async ({ page }) => {
  // Check ARIA labels and roles
  await expect(page.locator('.sheet-tabs')).toHaveAttribute('role', 'tablist');
  await expect(page.locator('.tab-content')).toHaveAttribute('role', 'tabpanel');
  
  // Check form labels
  const inputs = page.locator('input[type="text"], input[type="number"]');
  for (const input of await inputs.all()) {
    const id = await input.getAttribute('id');
    if (id) {
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
    }
  }
});
```

### Performance Testing

**Rendering Performance**:
```javascript
test('Sheet rendering performance', async ({ page }) => {
  // Measure time to interactive
  const startTime = Date.now();
  await page.click('.actor[data-document-id="test-actor"]');
  await page.waitForSelector('.dcc.actor.sheet', { state: 'visible' });
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(1000); // Should load within 1 second
});
```

### Animation and Transition Testing

**CSS Animations**:
```javascript
test('Animations work correctly', async ({ page }) => {
  // Test tab switching animations
  await page.click('[data-tab="equipment"]');
  
  // Wait for transition to complete
  await page.waitForTimeout(300);
  
  // Verify active state
  await expect(page.locator('[data-tab="equipment"]')).toHaveClass(/active/);
});
```

### Data Integrity Testing

**Form Submissions**:
```javascript
test('Data saves correctly', async ({ page }) => {
  // Change a value
  await page.fill('input[name="system.abilities.str.value"]', '18');
  
  // Submit form (trigger auto-save or manual save)
  await page.keyboard.press('Tab'); // Trigger change event
  
  // Reload and verify
  await page.reload();
  await page.click('.actor[data-document-id="test-actor"]');
  await expect(page.locator('input[name="system.abilities.str.value"]')).toHaveValue('18');
});
```

### Testing Strategy Workflow

1. **Pre-Migration**: Run full screenshot suite on V1 implementation
2. **During Migration**: Test each component as it's migrated
3. **Post-Migration**: Run complete regression suite
4. **Continuous**: Include visual tests in CI/CD pipeline

### Tools and Setup

**Recommended Tools**:
- **Playwright**: Best for modern web app testing
- **Percy** or **Chromatic**: Visual regression testing services
- **Storybook**: Component isolation testing
- **Pa11y**: Accessibility testing

**Screenshot Organization**:
```
/tests/
  /visual-regression/
    /baseline/              # V1 screenshots (before migration)
      /actor-sheets/
        level-0-character.png
        cleric-character-tab.png
        cleric-spells-tab.png
        warrior-equipment-tab.png
        /...
      /item-sheets/
        weapon-longsword.png
        spell-magic-missile.png
        armor-chain-mail.png
        /...
      /dialogs/
        actor-config.png
        level-change.png
        fleeting-luck.png
        /...
    /current/               # V2 screenshots (after migration)
      /actor-sheets/
      /item-sheets/
      /dialogs/
    /diff/                  # Generated difference images
      /failed/
        actor-sheet-diff.png
        /...
    /test-data/
      test-world-export.json # Consistent test data
      README.md             # Documentation of test scenarios
```

**Test Data Setup**:
```javascript
// Create consistent test data
const testActors = {
  levelZero: { level: 0, class: 'Zero-Level' },
  cleric: { level: 3, class: 'Cleric', spells: [...] },
  // ... other test actors
};

const testItems = {
  weapon: { type: 'weapon', name: 'Longsword' },
  spell: { type: 'spell', name: 'Magic Missile' },
  // ... other test items
};
```

**Playwright Configuration** (`tests/playwright.config.js`):
```javascript
module.exports = {
  testDir: './visual-regression',
  use: {
    baseURL: 'http://localhost:30000',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'baseline',
      testDir: './visual-regression/baseline-capture',
      use: { browserName: 'chromium' }
    },
    {
      name: 'comparison',
      testDir: './visual-regression/comparison',
      use: { browserName: 'chromium' }
    }
  ]
};
```

**Manual Screenshot Script**:
```bash
#!/bin/bash
# scripts/capture-baseline.sh

echo "Capturing baseline screenshots..."
mkdir -p tests/visual-regression/baseline/{actor-sheets,item-sheets,dialogs}

# Start Foundry in test mode
npm run foundry:test &
FOUNDRY_PID=$!

# Wait for Foundry to start
sleep 10

# Run screenshot capture
npx playwright test --project=baseline

# Stop Foundry
kill $FOUNDRY_PID

echo "Baseline screenshots captured in tests/visual-regression/baseline/"
```

**Git Management**:
Add to `.gitignore`:
```gitignore
# Visual regression testing
/tests/visual-regression/current/
/tests/visual-regression/diff/
/tests/visual-regression/playwright-report/
/tests/visual-regression/test-results/

# Keep baseline screenshots and test data in version control
!/tests/visual-regression/baseline/
!/tests/visual-regression/test-data/
```

**Documentation** (`tests/visual-regression/README.md`):
```markdown
# Visual Regression Testing for DCC V13 Migration

## Setup
1. Install Playwright: `npm install @playwright/test`
2. Create test world with consistent data
3. Run baseline capture: `./scripts/capture-baseline.sh`

## Running Tests
- Capture new screenshots: `npx playwright test --project=comparison`
- Update baselines: `npx playwright test --update-snapshots`
- View results: `npx playwright show-report`

## Test Data
- Import `test-data/test-world-export.json` into a clean world
- Test actors include all classes and edge cases
- Test items cover all types and configurations

## Screenshot Naming Convention
- `{component}-{variant}-{state}.png`
- Examples: `actor-sheet-cleric-character-tab.png`, `item-sheet-weapon-melee.png`
```

## 13. ProseMirror Editor Migration in V13 ApplicationV2

**CRITICAL**: V13 ApplicationV2 requires migrating from the `{{editor}}` handlebars helper to the new `<prose-mirror>` custom element.

### Required Template Migration

**Old V12 Pattern (Deprecated):**
```handlebars
{{editor corruptionHTML target="system.class.corruption" engine="prosemirror" button=true editable=editable}}
```

**New V13 Pattern (Required):**
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

### Key `<prose-mirror>` Attributes

- **`name`**: Form field path for submission (e.g., `"system.class.corruption"`)
- **`button`**: Show toggle button (`"true"` or `"false"`)
- **`editable`**: Pass through editable state (`"{{editable}}"`)
- **`toggled`**: Initial toggle state (`"false"` for closed by default)
- **`value`**: Raw field data for editing (`"{{system.class.corruption}}"`)
- **Content**: Enriched HTML for display (`{{{corruptionHTML}}}`)

### Context Preparation (Unchanged)

Continue enriching content in `_prepareContext()`:

```javascript
async _prepareContext(options) {
  const context = await super._prepareContext(options);
  
  // Enrich content for display
  context.corruptionHTML = await TextEditor.enrichHTML(
    this.document.system.class.corruption,
    { 
      secrets: this.document.isOwner,
      relativeTo: this.document 
    }
  );
  
  return context;
}
```

### Complete Migration Example

**ApplicationV2 Class:**
```javascript
class DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Enrich corruption content
    context.corruptionHTML = await this.#prepareCorruption();
    
    return context;
  }

  async #prepareCorruption() {
    if (this.actor.system.class) {
      const context = { relativeTo: this.document, secrets: this.document.isOwner }
      let corruption = this.actor.system.class.corruption || ''
      
      // Handle corrupted Promise strings
      if (corruption === '[object Promise]') {
        corruption = ''
        this.actor.update({ 'system.class.corruption': '' })
      }
      
      return await TextEditor.enrichHTML(corruption, context)
    }
    return ''
  }
}
```

**Template:**
```handlebars
<div class="corruption-section">
  <div class="dark-title">{{localize "DCC.Corruptions"}}</div>
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
</div>
```

### Key Benefits

- **Native form integration** - Automatic form submission handling
- **Conditional editing** - Clean separation of edit/view modes
- **Better performance** - Improved editor performance in V13
- **Cleaner markup** - No need for complex wrapper elements

### Migration Checklist

- [ ] Replace all `{{editor}}` helpers with `<prose-mirror>` elements
- [ ] Add `{{#if editable}}` conditional wrapper
- [ ] Provide read-only fallback in `{{else}}` clause  
- [ ] Update field paths in `name` and `value` attributes
- [ ] Move enrichment to `_prepareContext()` with `await`
- [ ] Test editor functionality and form submission

## 14. Migration Checklist

- [ ] **Set up visual regression testing environment**
- [ ] **Take baseline screenshots of all components**
- [ ] **CRITICAL: Register all actor and item sheets explicitly**
- [ ] Update class inheritance
- [ ] Convert `defaultOptions` to `DEFAULT_OPTIONS`
- [ ] Add `tag: 'form'` to DEFAULT_OPTIONS
- [ ] Move dimensions to `position` object
- [ ] Move window properties to `window` object
- [ ] Add `'themed', 'theme-light'` to classes
- [ ] Rename `getData()` to `_prepareContext()`
- [ ] Move title to `window` object
- [ ] Define `PARTS` for templates
- [ ] Split tab templates into separate files
- [ ] Define `TABS` configuration
- [ ] Implement `_getTabsConfig()` if needed
- [ ] Implement `_configureRenderParts()` if needed
- [ ] Convert `activateListeners` to `actions`
- [ ] Change event handler methods from `_` prefix to `#` prefix
- [ ] Update HTML templates to use `data-action` attributes
- [ ] Convert drag/drop configuration to `#createDragDropHandlers()`
- [ ] Implement `_canDragStart()` and `_canDragDrop()` permission methods
- [ ] Update `_onDragStart()` implementation if needed
- [ ] Change `this.object` to `this.document` throughout
- [ ] Remove all jQuery usage
- [ ] **CRITICAL: Migrate all `{{editor}}` helpers to `<prose-mirror>` custom elements**
- [ ] Test with CSS Layers compatibility
- [ ] Verify Node 20+ compatibility
- [ ] Test all functionality

## 13. Handling Image Edits in ApplicationV2

ApplicationV2 uses a different approach for handling image edits compared to V1. Instead of the `data-edit` attribute, V2 uses the actions system with `data-action` attributes.

### V1 Pattern (Deprecated):
```html
<img id="portrait" src="{{img}}" data-edit="img" height="100px" width="100px" alt="{{localize 'DCC.CharacterPortrait'}}">
```

### V2 Pattern (Required):

#### Template Update:
```html
<img id="portrait" src="{{img}}" data-action="editImage" data-field="img" height="100px" width="100px" alt="{{localize 'DCC.CharacterPortrait'}}">
```

#### Sheet Class Configuration:
```javascript
class MyActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    actions: {
      editImage: MyActorSheet.#onEditImage
    }
  };

  /**
   * Handle image editing
   * @this {MyActorSheet}
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @private
   */
  static async #onEditImage(event, target) {
    const field = target.dataset.field || "img";
    const current = foundry.utils.getProperty(this.document, field);
    
    const fp = new foundry.applications.apps.FilePicker({
      type: "image",
      current: current,
      callback: (path) => {
        this.document.update({ [field]: path });
      }
    });
    
    fp.render(true);
  }
}
```

### Important V13 FilePicker Change:
**CRITICAL**: In V13, the global `FilePicker` has been moved to `foundry.applications.apps.FilePicker`. Using the old global will show a deprecation warning:

```
Error: You are accessing the global "FilePicker" which is now namespaced under foundry.applications.apps.FilePicker.implementation
Deprecated since Version 13
```

**V12 Pattern (Deprecated):**
```javascript
const fp = new FilePicker({
  type: "image",
  current: current,
  callback: (path) => {
    this.document.update({ [field]: path });
  }
});
```

**V13 Pattern (Required):**
```javascript
const fp = new foundry.applications.apps.FilePicker({
  type: "image",
  current: current,
  callback: (path) => {
    this.document.update({ [field]: path });
  }
});
```

### Key Changes:
1. **Remove `data-edit`**: Replace with `data-action="editImage"`
2. **Add `data-field`**: Specify which field to update (defaults to "img")
3. **Define Action**: Add `editImage` to the `actions` object in `DEFAULT_OPTIONS`
4. **Implement Handler**: Create static `#onEditImage` method with proper V2 signature
5. **Use `this.document`**: Reference the document through the action context

### Alternative Field Names:
```html
<!-- For token image -->
<img src="{{prototypeToken.texture.src}}" data-action="editImage" data-field="prototypeToken.texture.src">

<!-- For custom image fields -->
<img src="{{system.customImage}}" data-action="editImage" data-field="system.customImage">
```

### Multiple Image Support:
For sheets with multiple editable images, use the same action with different `data-field` attributes:
```html
<img src="{{img}}" data-action="editImage" data-field="img" alt="Portrait">
<img src="{{prototypeToken.texture.src}}" data-action="editImage" data-field="prototypeToken.texture.src" alt="Token">
```

The `#onEditImage` handler will automatically handle different fields based on the `data-field` attribute.