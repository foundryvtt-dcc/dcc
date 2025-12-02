# Tab System Migration

This document covers implementing the tab system in ApplicationV2.

## Basic Tab Configuration

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

## Tab Template Requirements

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
- **CRITICAL**: Each tab template MUST have exactly one root element (single root node). Multiple root elements will cause Foundry's tab system to error out.

## INCORRECT: Container with Template Placeholders

**DO NOT** use a container template that loops over tabs and creates empty template placeholders:

```html
{{!-- WRONG: This causes focus and state preservation issues --}}
<section class="sheet-body">
  {{#each tabs as |tab|}}
    <template id="{{tab.id}}" data-application-part="{{tab.id}}"></template>
  {{/each}}
</section>
```

**Why this fails:**
- Template placeholders don't contain actual content during state preservation
- Focus restoration fails because form fields aren't where HandlebarsApplicationMixin expects them
- Tab state preservation becomes unreliable due to timing issues

## CORRECT: Direct Tab Parts

Instead, define each tab as a direct application part:

```javascript
// CORRECT: Each tab is a direct part
static PARTS = {
  tabs: {
    template: 'systems/dcc/templates/item-sheet-partial-tabs.html'
  },
  weapon: {
    template: 'systems/dcc/templates/item-sheet-weapon.html'
  },
  description: {
    template: 'systems/dcc/templates/item-sheet-partial-description.html'
  }
}
```

**Benefits of direct parts:**
- Natural focus preservation within each part
- Reliable tab state preservation
- Simpler architecture without intermediate containers
- Better performance due to fewer DOM manipulations

## Dynamic Tab Configuration

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

## CSS Warning for Tabs

**Problem**: If parent elements have `display: grid` or `display: flex`, ALL tabs will be visible at once.

**Solution**: Never set `display` properties on elements that directly contain tabs:

```css
/* WRONG - Breaks tab switching */
.sheet-body { display: grid; }

/* CORRECT - Apply to inner elements */
.tab-content-wrapper { /* no display here */ }
.character-grid { display: grid; }
```

## Tab Navigation Template

Create a tabs navigation partial:

```html
{{!-- actor-partial-tabs.html --}}
<nav class="tabs sheet-tabs" data-group="{{tabs.sheet.group}}">
  {{#each tabs.sheet.tabs}}
    <a class="tab {{this.cssClass}}" data-tab="{{this.id}}" data-group="{{this.group}}">
      {{localize this.label}}
    </a>
  {{/each}}
</nav>
```

## Complete Tab Setup Example

```javascript
class DCCActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
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

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    // Tab configuration is automatically added to context
    return context
  }
}
```

## Related Documentation

- [Migration Basics](MIGRATION_BASICS.md) - Class inheritance and setup
- [Forms and Events](FORMS_AND_EVENTS.md) - Form handling and events
- [Templates](TEMPLATES.md) - Template patterns
- [Themes](THEMES.md) - CSS variables and theming
- [Checklist](CHECKLIST.md) - Complete migration checklist
