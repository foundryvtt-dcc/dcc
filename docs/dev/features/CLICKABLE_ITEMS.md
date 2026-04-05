# Clickable Non-Weapon Items

**Status:** Proposed
**Prior Art:** `feature-clickable-items` branch (stale, pre-v12)
**Issue:** [#390](https://github.com/foundryvtt-dcc/dcc/issues/390)
**Effort:** Medium

## Overview

Allow players to click on non-weapon items (armor, equipment, ammunition, mounts, treasure, containers) on their character sheet to "activate" them — posting the item's name, image, and description to chat. This mirrors how weapons already have a dedicated `rollWeaponAttack` action, but for items where the action is simply "show this item to the table."

Extension modules (dcc-qol, xcc, etc.) can hook into the activation to add custom behavior — e.g. applying armor effects, tracking ammunition consumption, or triggering treasure-specific mechanics.

## Background

### Current State

- **Weapons** have a full click-to-roll flow: `data-action="rollWeaponAttack"` on the sheet template dispatches to `DCCActorSheet.#rollWeaponAttack` → `actor.rollWeaponAttack()` → chat card with attack/damage/crit results.
- **Spells** have `rollSpellCheck` on the item sheet, but not directly from the actor sheet equipment tab.
- **Treasure** items have `rollValue()` on `DCCItem`, but it's only accessible from the item sheet — not the actor sheet.
- **All other items** (armor, equipment, ammunition, mounts, containers) are display-only on the actor sheet with no click action.
- **Hotbar macros** for non-spell/non-weapon items call `_item.roll()` which **does not exist**, so dragging these items to the hotbar creates a broken macro.

### What the Old Branch Did

The `feature-clickable-items` branch (2020-2024, now stale) added:
- An `activate()` method on `DCCItem` that posts item name + description to chat
- A `chatCardTemplate` / `chatCardData` getter pattern on `DCCItem`
- A `chat-card-activate-item.html` template
- A `dcc.activateItem` hook fired before the chat message is created
- Click handlers on armor and equipment rows in the actor sheet
- A `dcc.spendFunds` hook placeholder for the Funds row

Most of the v12/v13 API modernization in that branch has already landed on `main` through other work.

## Implementation Plan

### Phase 1: Item Activation Core

#### 1a. Add `activate()` method to `DCCItem`

In `module/item.js`, add a generic activation method:

```javascript
/**
 * Activate this item, posting its details to chat
 * @param {Object} options - Options for activation
 * @returns {Promise<ChatMessage>}
 */
async activate (options = {}) {
  const speaker = ChatMessage.getSpeaker({ actor: this.actor })

  const flags = {
    'dcc.RollType': 'ActivateItem',
    'dcc.ItemId': this.id,
    'dcc.ItemType': this.type
  }

  const messageData = {
    content: await foundry.applications.handlebars.renderTemplate(
      this.chatCardTemplate,
      this.chatCardData
    ),
    flavor: this.name,
    user: game.user.id,
    speaker,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags
  }

  // Allow extensions to modify or handle the activation
  Hooks.callAll('dcc.activateItem', this, messageData, options)

  return ChatMessage.create(messageData)
}
```

#### 1b. Add chat card getters to `DCCItem`

```javascript
/** Template for this item's chat card */
get chatCardTemplate () {
  return `systems/dcc/templates/chat-card-activate-item.hbs`
}

/** Data for the chat card template */
get chatCardData () {
  return {
    item: this,
    name: this.name,
    img: this.img,
    type: this.type,
    typeLabel: game.i18n.localize(`TYPES.Item.${this.type}`),
    description: this.system.description?.value || '',
    summary: this.system.description?.summary || '',
    properties: this._getChatCardProperties()
  }
}
```

#### 1c. Add `_getChatCardProperties()` helper

Returns type-specific properties to display on the chat card:

| Item Type | Properties |
|-----------|-----------|
| `armor` | AC bonus, check penalty, fumble die, equipped status |
| `equipment` | Quantity, weight |
| `ammunition` | Quantity, weight |
| `mount` | Speed, carry capacity |
| `treasure` | Currency values (pp/ep/gp/sp/cp) |
| `container` | Capacity, current weight |

#### 1d. Create chat card template

Create `templates/chat-card-activate-item.hbs`:

```handlebars
<div class="dcc chat-card item-card">
  <header class="card-header">
    {{#if img}}<img src="{{img}}" alt="{{name}}" width="36" height="36"/>{{/if}}
    <h3>{{name}}</h3>
    {{#if typeLabel}}<span class="item-type">{{typeLabel}}</span>{{/if}}
  </header>
  {{#if properties.length}}
  <div class="card-properties">
    {{#each properties}}
    <span class="property">{{this}}</span>
    {{/each}}
  </div>
  {{/if}}
  {{#if description}}
  <div class="card-content">{{{description}}}</div>
  {{/if}}
</div>
```

### Phase 2: Sheet Integration

#### 2a. Register the action handler

In `module/actor-sheet.js`, add to `DEFAULT_OPTIONS.actions`:

```javascript
activateItem: this.#activateItem,
```

#### 2b. Implement the action handler

```javascript
static async #activateItem (event, target) {
  const itemId = DCCActorSheet.findDataset(target, 'itemId')
  const item = this.document.items.get(itemId)
  if (!item) return
  const options = DCCActorSheet.fillRollOptions(event)
  await item.activate(options)
}
```

#### 2c. Update equipment templates

Add `data-action="activateItem"` to clickable elements in the item row templates.

**`templates/actor-partial-npc-equipment.html`** — update the `ItemRow` partial:

The item name `<div>` becomes a clickable element:
```handlebars
<div class="rollable" data-action="activateItem">{{item.name}}</div>
```

Similarly for `armorRow` (armor name), `TreasureRow` (treasure name), and container rows.

**Key design decision:** Make the item **name** the click target, not the entire row. This avoids conflicts with inline inputs (equipped checkbox, quantity, name editing) and matches user expectations — click the name to "use" or "show" the item.

For items where the name is an `<input>` field (armor), add a small clickable icon or button adjacent to the name instead, similar to how weapons have the attack button separate from the name field.

#### 2d. Add CSS for clickable items

In `styles/dcc.scss`, add hover/cursor styles for the new clickable elements:

```scss
.item .rollable {
  cursor: pointer;
  &:hover {
    text-shadow: 0 0 8px var(--color-shadow-primary);
  }
}
```

### Phase 3: Hotbar Macro Fix

#### 3a. Update `_createDCCItemMacro` in `module/dcc.js`

Replace the broken `_item.roll()` call with `_item.activate()`:

```javascript
// For other item types, create an activation macro
return {
  name: item.name,
  command: `const _item = await fromUuid("${uuid}"); if (_item) { _item.activate() }`,
  img: item.img || EntityImages.imageForItem(item.type)
}
```

This fixes the existing bug where non-spell/non-weapon items dragged to the hotbar produce broken macros.

### Phase 4: Extension Hook

#### 4a. Document the `dcc.activateItem` hook

The hook signature:
```javascript
Hooks.callAll('dcc.activateItem', item, messageData, options)
```

- `item` — the `DCCItem` being activated
- `messageData` — the chat message data object (mutable — extensions can modify `content`, add `flags`, etc.)
- `options` — activation options (includes roll modifier flags from shift/ctrl/alt)

Extension modules can use this to:
- Add buttons to the chat card (e.g. "Apply AC" for armor)
- Suppress the default chat message and do something else entirely
- Track usage (ammunition consumption, charges, etc.)

#### 4b. Add to existing hook documentation

Add `dcc.activateItem` to the hooks list in the README or wherever system hooks are documented.

## Items NOT Included

- **Spend Funds** — The old branch had a placeholder `dcc.spendFunds` hook for clicking the Funds row. This is a separate feature with its own UX design (dialog for selecting amount/denomination). Should be a follow-up issue.
- **Treasure `rollValue()`** — Already exists on `DCCItem`. The activation chat card should show resolved values; it should not re-roll them. If a treasure still needs its value rolled, the user should do that from the item sheet.
- **Spell activation from equipment tab** — Spells already have `rollSpellCheck` on the actor sheet. No changes needed.
- **Armor equip toggle from chat** — Could be a follow-up enhancement where the chat card has a button to toggle equipped status.

## Testing

### Unit Tests

- `DCCItem.activate()` produces a chat message with correct content and flags
- `DCCItem.chatCardData` returns correct properties for each item type
- `_getChatCardProperties()` returns appropriate data per type
- `_createDCCItemMacro()` generates `activate()` calls (not `roll()`)

### Integration Tests

- Click equipment name on actor sheet → chat message appears with item details
- Click armor icon on actor sheet → chat message with AC/penalty info
- Drag equipment to hotbar → macro works and posts to chat
- `dcc.activateItem` hook fires and allows message modification

### Manual Testing

- Verify no false triggers when editing item name inputs or toggling checkboxes
- Verify click targets are visually distinct (cursor, hover effect)
- Test with dcc-qol and xcc modules loaded to ensure no conflicts

## Dependent Modules

Per CLAUDE.md, check these modules before merging:
- `../../modules/dcc-qol` — may want to hook `dcc.activateItem`
- `../../modules/xcc` — verify no conflicts with sheet rendering
- `../../mcc-classes` — verify class sheets still render correctly
- `../../dcc-crawl-classes` — same as above

## i18n Keys

New localization keys needed:

| Key | English | Purpose |
|-----|---------|---------|
| `DCC.ActivateItem` | `Activate Item` | Tooltip for clickable item names |
| `DCC.ItemProperties` | `Properties` | Chat card properties header (if needed) |

Existing keys that will be reused: `TYPES.Item.armor`, `TYPES.Item.equipment`, etc. for type labels on chat cards.
