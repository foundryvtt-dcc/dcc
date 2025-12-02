# V13 Breaking Changes

This document covers critical breaking changes in FoundryVTT V13 that affect system development.

## HTML Element Changes (CRITICAL)

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

## Document Update API Changes

```javascript
// V12 Pattern (BREAKS in V13)
this.object.update({ data: { results } })

// V13 Pattern (REQUIRED)
this.object.update({ system: { results } })
```

## Namespace Deprecations

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

## Hook Name Changes

### Render Hook Changes

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

### Context Menu Hook Changes (CRITICAL)

All V12 context menu hook names were replaced with a new paradigm `get{DocumentName}ContextOptions`. These hooks also have completely different signatures:

**V12 to V13 Hook Mappings:**
```javascript
// Chat Messages
getChatLogEntryContext           → getChatMessageContextOptions

// Actor Directory
getActorDirectoryEntryContext    → getActorContextOptions

// Scene Navigation
getSceneNavigationContext        → getSceneContextOptions

// Combat Tracker
getCombatTrackerEntryContext     → getCombatContextOptions
getCombatantEntryContext         → getCombatantContextOptions

// Other Directories
getMacroDirectoryEntryContext    → getMacroContextOptions
getPlaylistDirectoryEntryContext → getPlaylistContextOptions
getPlaylistSoundContext          → getPlaylistSoundContextOptions

// Folders
getFolderContext                 → getFolderContextOptions

// Users (unchanged)
getUserContextOptions            → getUserContextOptions
```

**New Hook Signature:**
```javascript
// V12 Pattern (Old)
Hooks.on("getChatLogEntryContext", (html, options) => {
  // html is jQuery object
  // options is array to push to
  options.push({
    name: "Custom Option",
    icon: '<i class="fas fa-star"></i>',
    condition: li => {
      // li is jQuery object
      const messageId = li.data("message-id")
      return game.messages.get(messageId)?.isAuthor
    },
    callback: li => {
      // li is jQuery object
      const messageId = li.data("message-id")
      // ... handle action
    }
  })
})

// V13 Pattern (New)
Hooks.on("getChatMessageContextOptions", (application, menuItems) => {
  // application is the ApplicationV2 instance
  // menuItems is array to mutate
  // 'element' is a DOM element, not a jQuery object
  menuItems.push({
    name: "Custom Option",
    icon: '<i class="fas fa-star"></i>',
    condition: element => {
      // element is HTMLElement
      const messageId = element.dataset.messageId
      return game.messages.get(messageId)?.isAuthor
    },
    callback: element => {
      // element is HTMLElement
      const messageId = element.dataset.messageId
      // ... handle action
    }
  })
})
```

**Important Notes:**
- **jQuery Removal**: Callback handlers receive HTMLElement instances instead of jQuery objects
- **ContextMenu.create Deprecated**: Use `new ContextMenu` directly or `ApplicationV2#_createContextMenu` helper
- **Early v13 Names Removed**: Temporary names like `getEntryContextChatLog` are no longer supported
- **Hook Parameters Changed**: First parameter is now the ApplicationV2 instance, not jQuery HTML

## Rollable Table Property Deprecations

Several properties on Rollable Tables have been deprecated in V13:

**TableResult Changes:**
```javascript
// V12 (deprecated)
result.text  // The text content of the result

// V13 (required)
result.description  // Replaces result.text
```

**TableResult Compendium Changes:**
```javascript
// V12 (deprecated)
table.compendium  // Reference to compendium collection

// V13 (required)
table.collection  // Replaces table.compendium
```

## Sheet Registration Requirement (V13.341)

**CRITICAL**: All systems must explicitly register their sheets. You should also unregister core sheets first:

```javascript
// In your system's init hook
Hooks.once('init', () => {
  const { Actors, Items } = foundry.documents.collections
  const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets

  // Unregister core sheets first
  Actors.unregisterSheet('core', ActorSheetV2)
  Items.unregisterSheet('core', ItemSheetV2)

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

## CSS Layering and Variables

**CRITICAL**: V13 introduces CSS Layers, which means existing styling that relied on Foundry styles is probably broken. See [TEMPLATES_AND_THEMES.md](TEMPLATES_AND_THEMES.md) for how to implement theming.

Key points:
- Checkboxes now use FontAwesome icons instead of native checkboxes
- Style the `::before` and `::after` pseudo-elements of checkboxes
- Style the `:active` state for before and after pseudo-elements
- Test all UI elements thoroughly after migration

## Related Documentation

- [Migration Basics](MIGRATION_BASICS.md) - How to convert to ApplicationV2
- [Templates](TEMPLATES.md) - Template migration patterns
- [Themes](THEMES.md) - CSS variables and theming
- [Checklist](CHECKLIST.md) - Complete migration checklist
