# Theme Implementation

This document covers implementing theme support for V13.

## Overview

FoundryVTT V13 provides built-in theme support with automatic light/dark mode switching. Here's how to implement theme-aware styling in your system.

## 1. Create CSS Variables File

Create a `variables.css` file to hold CSS variables for colors and other values that might change between light and dark themes:

```css
:root {
  /* System variables - use "system-" prefix to prevent collisions */
  --system-primary-color: #1c1c1c;
  --system-background-color: #ffffff;
  --system-border-color: #cccccc;
  --system-shadow-color: rgba(0, 0, 0, 0.1);
  --system-text-color: #2d2d2d;
  --system-input-background: #f8f8f8;
  --system-button-background: #e0e0e0;
  --system-accent-color: #0066cc;
}

/* Dark theme overrides */
.theme-dark {
  --system-primary-color: #e0e0e0;
  --system-background-color: #2d2d2d;
  --system-border-color: #555555;
  --system-shadow-color: rgba(0, 0, 0, 0.3);
  --system-text-color: #e0e0e0;
  --system-input-background: #404040;
  --system-button-background: #505050;
  --system-accent-color: #4d9fff;
}
```

## 2. Update system.json

Add the variables file to your styles array in `system.json` with the `variables` layer:

```json
{
  "styles": [
    {
      "src": "styles/variables.css",
      "layer": "variables"
    },
    {
      "src": "styles/dcc.css",
      "layer": "system"
    }
  ]
}
```

## 3. Use Variables in Your Stylesheet

Update your primary stylesheet to use variables instead of hard-coded values:

```scss
.dcc {
  color: var(--system-primary-color);
  background-color: var(--system-background-color);
  border: 1px solid var(--system-border-color);

  .sheet-header {
    background: var(--system-accent-color);
    color: var(--system-background-color);
  }

  input, select, textarea {
    background-color: var(--system-input-background);
    color: var(--system-text-color);
    border: 1px solid var(--system-border-color);
  }

  button {
    background-color: var(--system-button-background);
    color: var(--system-text-color);
    box-shadow: 0 2px 4px var(--system-shadow-color);
  }
}
```

## 4. Variable Naming Convention

Use the `system-` prefix for all your CSS variables to prevent name collisions with Foundry's built-in variables:

```css
/* GOOD - Prevents collisions */
--system-primary-color: #1c1c1c;
--system-dialog-background: #ffffff;
--system-tab-active-color: #0066cc;

/* BAD - Might conflict with Foundry */
--primary-color: #1c1c1c;
--background: #ffffff;
--active: #0066cc;
```

## 5. Handling Opacity and Layering

Be careful with colors that use opacity/alpha channels. Foundry often stacks UI elements, which can cause unexpected darkening due to multiple semi-transparent layers:

```css
/* Potentially problematic - may stack and become too dark */
--system-overlay-color: rgba(0, 0, 0, 0.5);

/* Better - use solid colors or very low opacity */
--system-overlay-color: rgba(0, 0, 0, 0.1);
```

## 6. Testing Theme Implementation

Test your theme implementation thoroughly:

1. Switch between light and dark themes in Foundry settings
2. Verify all UI elements update correctly
3. Check for proper contrast ratios in both themes
4. Test with various transparency effects
5. Ensure variables cascade properly to child elements
6. Test out multiple combinations in the Foundry Settings of interface and app being light and dark

## 7. ApplicationV2 Theme Classes

When using ApplicationV2, you can add theme classes to your DEFAULT_OPTIONS (though this is a temporary workaround compared to implementing your own theming as described above):

```javascript
static DEFAULT_OPTIONS = {
  classes: ['dcc', 'sheet', 'actor', 'themed', 'theme-light'],
  // ... other options
}
```

**Note**: The `themed` and `theme-light` classes are temporary workarounds to try and get back pre-V13 styling until you build your own theme support.

## CSS Layering Notes

V13 introduces CSS Layers, which means existing styling that relied on Foundry styles is probably broken. Key points:

- Checkboxes now use FontAwesome icons instead of native checkboxes
- Style the `::before` and `::after` pseudo-elements of checkboxes
- Style the `:active` state for before and after pseudo-elements
- Test all UI elements thoroughly after migration

## Related Documentation

- [Templates](TEMPLATES.md) - Template migration patterns
- [Breaking Changes](BREAKING_CHANGES.md) - CSS and namespace changes
- [Migration Basics](MIGRATION_BASICS.md) - Basic setup
- [Checklist](CHECKLIST.md) - Complete migration checklist
