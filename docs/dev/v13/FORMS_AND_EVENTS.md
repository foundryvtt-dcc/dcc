# Forms and Events

This document covers form configuration, event handling, and the action system in ApplicationV2.

## Form Tag Requirements

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

## Form Submission Patterns

### Pattern 1: Submit on Change (For Sheets)

For actor/item sheets where changes should save immediately:
```javascript
static DEFAULT_OPTIONS = {
  tag: 'form',
  form: {
    submitOnChange: true  // Auto-save on any field change
  }
}
// No handler needed - ActorSheetV2/ItemSheetV2 handle updates automatically
```

### Pattern 2: Static Form Handler (For Dialogs)

For configuration dialogs where you want explicit submit:
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
  await this.options.document.update(formData.object)
}
```

## Inline Item Modifications on Actor Sheets

When you need to edit items inline on an actor sheet (e.g., weapons, equipment, spells), you must handle these updates separately from the main actor update. This is because ApplicationV2's form validation will strip out nested item data.

**Template Pattern:**
```html
{{!-- Use "items" prefix for inline item edits --}}
<li class="weapon" data-item-id="{{weapon._id}}">
  <input type="text"
         name="items.{{weapon._id}}.name"
         value="{{weapon.name}}"/>
  <input type="checkbox"
         name="items.{{weapon._id}}.system.equipped"
         {{checked weapon.system.equipped}}/>
  <input type="text"
         name="items.{{weapon._id}}.system.damage"
         value="{{weapon.system.damage}}"/>
</li>
```

**Implementation Pattern (actor-sheet.js):**
```javascript
/** @override */
_processFormData(event, form, formData) {
  // Extract the raw form data object BEFORE validation strips out items
  const expanded = foundry.utils.expandObject(formData.object)

  // Handle items separately if they exist
  if (expanded.items) {
    // Store for later processing
    this._pendingItemUpdates = Object.entries(expanded.items).map(([id, itemData]) => ({
      _id: id,
      ...itemData
    }))
  }

  // Call parent with modified formData
  return super._processFormData(event, form, formData)
}

/** @override */
async _processSubmitData(event, form, formData) {
  // Process the actor data normally
  const result = await super._processSubmitData(event, form, formData)

  // Now handle any pending item updates
  if (this._pendingItemUpdates?.length > 0) {
    await this.options.document.updateEmbeddedDocuments('Item', this._pendingItemUpdates)
    delete this._pendingItemUpdates // Clean up
  }

  return result
}
```

**Key Points:**
- Use `items.{{id}}.property` naming convention in templates
- Override `_processFormData` to extract item data before validation
- Store item updates temporarily in `this._pendingItemUpdates`
- Override `_processSubmitData` to apply item updates after actor update
- Clean up temporary storage after updates complete

## Constructor Pattern Changes

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

## Document Access in V2

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

## Image Editing Migration

### Recommended Approach: Use Inherited editImage

**RECOMMENDED**: Use DocumentSheetV2's built-in `editImage` method instead of implementing your own. This provides better compatibility with hosting platforms like Forge VTT.

**Template (Same for both approaches):**
```html
<img src="{{img}}" data-action="editImage" data-edit="img" alt="Portrait">
```

**V2 Pattern (Recommended - Use Inherited Method):**
```javascript
static DEFAULT_OPTIONS = {
  actions: {
    editImage: YourSheetClass.editImage  // Reference inherited static method
  }
}

// No custom implementation needed - DocumentSheetV2 handles it automatically
```

**Benefits of using inherited editImage:**
- Automatic compatibility with Forge VTT file storage
- Handles edge cases and URL formats correctly
- Future-proof against hosting platform changes
- Less code to maintain

### Custom Implementation (Legacy/Special Cases)

Only implement custom editImage if you need special behavior not provided by the built-in method:

**V2 Pattern (Custom Implementation):**
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

**Migration Notes:**
- ActorSheetV2, ItemSheetV2, and DocumentSheetV2 all inherit editImage from DocumentSheetV2
- Remove any custom `#editImage` methods when switching to inherited approach
- Update action references from `this.#editImage` to `YourSheetClass.editImage`

## Related Documentation

- [Migration Basics](MIGRATION_BASICS.md) - Class inheritance and setup
- [Tabs](TABS.md) - Tab system implementation
- [Drag and Drop](DRAG_DROP.md) - Drag and drop patterns
- [Checklist](CHECKLIST.md) - Complete migration checklist
