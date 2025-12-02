# Template Migration

This document covers template migration patterns for V13.

## ProseMirror Editor Migration

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

## Context Preparation for Editors

```javascript
// Import at top of file
const { TextEditor } = foundry.applications.ux

async _prepareContext(options) {
  const context = await super._prepareContext(options)

  // Enrich content for display
  context.corruptionHTML = await TextEditor.enrichHTML(
    this.document.system.class.corruption,
    {
      secrets: this.document.isOwner,
      relativeTo: this.document
    }
  )

  return context
}
```

## Static Initializer Configuration Issue

**CRITICAL**: Cannot use CONFIG values in static field initializers:

```javascript
// BROKEN - CONFIG.DCC is undefined during static initialization
static PARTS = {
  form: {
    template: CONFIG.DCC.templates.rollModifierDialog // ERROR
  }
}

// WORKING - Hard-coded template path
static PARTS = {
  form: {
    template: 'systems/dcc/templates/dialog-roll-modifiers.html'
  }
}
```

## Template Structure for ApplicationV2

When using `tag: 'form'` in DEFAULT_OPTIONS, templates should NOT contain `<form>` elements:

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

## Related Documentation

- [Themes](THEMES.md) - CSS variables and theming
- [Forms and Events](FORMS_AND_EVENTS.md) - Form handling patterns
- [Tabs](TABS.md) - Tab template requirements
- [Checklist](CHECKLIST.md) - Complete migration checklist
