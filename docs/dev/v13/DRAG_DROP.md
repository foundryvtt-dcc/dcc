# Drag and Drop Migration

This document covers implementing drag and drop functionality in ApplicationV2.

## Understanding the V13 Drag/Drop Architecture

**CRITICAL INSIGHT**: FoundryVTT V13 has a two-tier drag/drop system:

1. **ApplicationV2 (Generic)**: Manual setup required, no automatic handlers
2. **ActorSheetV2 (Actor-specific)**: Automatic `.draggable` setup with basic item/effect support

## ActorSheetV2 Automatic Features

If you're extending `ActorSheetV2`, you get these features automatically:

```javascript
const { ActorSheetV2 } = foundry.applications.sheets

class MyActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // ActorSheetV2 automatically provides:
  // - DragDrop setup with '.draggable' selector in _onRender()
  // - Permission checks via _canDragStart/_canDragDrop (checks isEditable)
  // - Basic item dragging for elements with data-item-id
  // - Active effect dragging for elements with data-effect-id
  // - Item sorting within the same actor via _onSortItem
  // - Document drop handling with delegation to _onDropItem, _onDropActiveEffect, etc.
}
```

**What ActorSheetV2 gives you for free:**
- Elements with class `draggable` are automatically draggable
- Items with `data-item-id` create proper item drag data
- Active effects with `data-effect-id` create proper effect drag data
- Dropping items on the sheet automatically adds them to the actor
- Dropping items from the same actor triggers sorting via `_onSortItem`
- Permission checks based on `isEditable` property

## When You Need Manual Setup

You need manual drag/drop setup when:
1. Using base `ApplicationV2` (not ActorSheetV2)
2. Creating custom drag types beyond basic items/effects
3. Need different selectors than `.draggable`
4. Need custom permission logic

## ApplicationV2 vs ActorSheetV2 Comparison

**V1 Pattern (Old - Automatic):**
```javascript
static get defaultOptions() {
  return foundry.utils.mergeObject(super.defaultOptions, {
    dragDrop: [{ dragSelector: '.item', dropSelector: '.item-list' }]
  })
}
// Framework automatically created and bound DragDrop handlers
```

**V2 ActorSheetV2 Pattern (Automatic for Basic Items):**
```javascript
const { ActorSheetV2 } = foundry.applications.sheets

class MyActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // No drag/drop setup needed for basic items!
  // Just add class="draggable" and data-item-id to your templates
}
```

**Template for ActorSheetV2 Auto Drag/Drop:**
```html
<!-- ActorSheetV2 handles this automatically -->
<li class="item draggable" data-item-id="{{item._id}}">
  {{item.name}}
</li>

<!-- Active effects work automatically too -->
<li class="effect draggable" data-effect-id="{{effect._id}}">
  {{effect.name}}
</li>
```

## Manual ApplicationV2 Setup

**V2 ApplicationV2 Pattern (Manual Setup Required):**
```javascript
const { DragDrop } = foundry.applications.ux

class MyAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
  #dragDrop

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
        dragover: this._onDragOver.bind(this),
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

  _onDragOver(event) {
    // Optional: handle dragover events if needed
  }
}
```

## Important Implementation Notes

### Event Handler Signatures
ApplicationV2 calls drag handlers with different signatures than v1:

```javascript
// Correct V2 signature - single event parameter
_onDragStart(event) {
  const element = event.currentTarget
  // Implementation
}

// Old v1 signature - two parameters (not used by ApplicationV2)
_onDragStart(event, target) {
  // This signature is not used by the framework
}
```

### Static Method Access
If your drag handlers need to call static helper methods, make sure they're public:

```javascript
// Good - Public static method accessible from instance methods
static findDataset(element, attribute) {
  while (element && !(attribute in element.dataset)) {
    element = element.parentElement
  }
  return element?.dataset[attribute] || null
}

// Bad - Private static method not accessible from instances
static #findDataset(element, attribute) {
  // Can't call this from _onDragStart instance method
}

// Usage in drag handler
_onDragStart(event) {
  const itemId = MyClass.findDataset(event.currentTarget, 'itemId')
}
```

## Template Requirements

Add `data-drag="true"` to draggable elements:

```html
<ol class="items">
  {{#each items}}
  <li data-drag="true" data-item-id="{{this.id}}" data-drag-action="weapon">
    {{this.name}}
  </li>
  {{/each}}
</ol>
```

## DCC System Example: Hybrid Approach

The DCC system uses a hybrid approach that extends ActorSheetV2's automatic features with custom drag types:

```javascript
class DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  #dragDrop

  static DEFAULT_OPTIONS = {
    // Custom selectors override ActorSheetV2 defaults
    dragDrop: [{
      dragSelector: '[data-drag="true"]',  // Custom selector
      dropSelector: '.dcc.actor'           // Drop anywhere on the actor sheet
    }]
  }

  constructor(options = {}) {
    super(options)
    this.#dragDrop = this.#createDragDropHandlers()
  }

  _onRender(context, options) {
    // Manual setup replaces ActorSheetV2's automatic setup
    this.#dragDrop.forEach((d) => d.bind(this.element))
  }

  // Custom drag handler for DCC-specific drag types
  _onDragStart(event) {
    const li = event.currentTarget
    if (!li.dataset.drag) return

    const dragAction = li.dataset.dragAction
    let dragData = null

    switch (dragAction) {
      case 'ability': {
        // Custom DCC ability check macro creation
        const abilityId = DCCActorSheet.findDataset(event.currentTarget, 'ability')
        dragData = {
          type: 'Ability',
          actorId: this.actor.id,
          data: { abilityId }
        }
        break
      }
      case 'spellCheck': {
        // Custom DCC spell check macro creation
        const ability = DCCActorSheet.findDataset(event.currentTarget, 'ability')
        dragData = {
          type: 'Spell Check',
          actorId: this.actor.id,
          data: { ability }
        }
        break
      }
      case 'weapon': {
        // Falls back to ActorSheetV2 item handling if needed
        const itemId = DCCActorSheet.findDataset(event.currentTarget, 'itemId')
        const weapon = this.actor.items.get(itemId)
        if (weapon) {
          dragData = Object.assign(weapon.toDragData(), {
            dccType: 'Weapon',
            actorId: this.actor.id
          })
        }
        break
      }
    }

    if (dragData) {
      if (this.actor.isToken) dragData.tokenId = this.actor.token.id
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
    }
  }

  _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event)
    if (!data) return false

    // Convert DCC-specific drops back to standard Item drops
    if (data.type === 'DCC Item') {
      data.type = 'Item'
    }

    // Delegate to ActorSheetV2's built-in drop handling
    return super._onDrop?.(event)
  }
}
```

## Key Insight: Choose Your Approach

1. **For simple actor sheets**: Use ActorSheetV2 with `.draggable` class - no setup needed
2. **For custom drag types**: Override with manual setup (like DCC system)
3. **For non-actor applications**: Use full manual ApplicationV2 setup

## ActorSheetV2 Built-in Methods You Can Override

ActorSheetV2 provides these methods you can customize:

```javascript
// Permission checks (default: checks this.isEditable)
_canDragStart(selector) { return this.isEditable }
_canDragDrop(selector) { return this.isEditable }

// Drag start (default: handles items with data-item-id, effects with data-effect-id)
_onDragStart(event) { /* creates item/effect drag data */ }

// Drop handling (default: delegates to _onDropDocument)
_onDrop(event) { /* processes drop data, calls hooks */ }

// Document drop routing (default: routes to specific handlers)
_onDropDocument(event, document) { /* routes by document type */ }

// Item drops (default: creates item on actor or sorts within actor)
_onDropItem(event, item) { /* handles item creation/sorting */ }

// Item sorting (default: uses Foundry's integer sort algorithm)
_onSortItem(event, item) { /* reorders items within actor */ }
```

This hybrid approach allows you to leverage ActorSheetV2's built-in functionality while adding system-specific features.

## Related Documentation

- [Migration Basics](MIGRATION_BASICS.md) - Class inheritance and base classes
- [Forms and Events](FORMS_AND_EVENTS.md) - Event handling patterns
- [Checklist](CHECKLIST.md) - Complete migration checklist
